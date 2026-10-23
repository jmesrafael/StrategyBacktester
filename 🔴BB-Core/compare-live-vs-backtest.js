#!/usr/bin/env node
// compare-live-vs-backtest.js - did the bot do what the backtester says it should have done on the SAME candles?
//
//   node compare-live-vs-backtest.js [--journal journal/trades.jsonl] [--from ISO|ms] [--to ISO|ms] [--tolerance 0.05] [--mode paper|live]
//                                    [--shadow-dir DIR] [--out-dir audit/out] [--push] [--quiet]
//
// 1. reads journal/trades.jsonl (entries, exits, skipped signals, bot starts)
// 2. downloads FINISHED 4h candles for the window from MEXC (public GET endpoints only; the still-forming candle is dropped)
// 3. runs the existing backtest() from lucidio-core.js, unchanged, on exactly that window (flat at the window start, like a freshly started bot)
// 4. joins journal trades to backtest trades on the match key: symbol + side + signal candle open time (UTC ms)
// 5. reports: matched / live-only / backtest-only (with the skipped signals that explain them), exit reason and exit candle differences,
//    entry price and R differences beyond the tolerance (default 0.05R), recorded vs freshly downloaded candles (journal candles and shadow
//    recorder data when present), and for every mismatch the distance (%) of the signal close to its nearest threshold.
// MATCH = same trade set, same exit reasons, R (and entry) within tolerance. Anything else is an investigation item with that evidence.
// Writes audit/out/compare-<date>.json and .txt, prints the summary, exits 0 on match and 1 otherwise. It never sends an order and never
// needs a key, so it is safe as a daily cron job / systemd timer. --push also sends the summary to the dashboard (if configured).
'use strict';
const fs = require('fs'), path = require('path');
require('./envfile.js').load();
const core = require('./lucidio-core.js');
const journal = require('./journal.js');
const config = require('./config.js');

const IV = 14400, S = core.DEFAULTS;
const iso = (sec) => new Date(sec * 1000).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
const pct = (v) => (v == null ? '—' : `${v.toFixed(4)}%`);

// ------------------------------------------------------------------ candles
// finished 4h candles [fromSec, toSec] for one symbol. client = mexc client (public GETs). The forming candle (time + 4h > now) is dropped.
async function downloadCandles(client, symbol, fromSec, toSec, nowSec) {
  const rows = new Map(), step = 1800 * IV;
  for (let s = fromSec; s < toSec; s += step) {
    let got, lastErr;
    for (let k = 0; k < 3 && !got; k++) { try { got = await client.klines(symbol, 'Hour4', s, Math.min(toSec, s + step)); } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1000 * (k + 1))); } }
    if (!got) throw lastErr;
    for (const r of got) rows.set(r.time, r);
  }
  return [...rows.values()].sort((a, b) => a.time - b.time).filter((c) => c.time + IV <= nowSec);
}

// shadow-recorder candle records (kind "candle"): latest snapshot per coin+candle -> Map key "SOL_USDT|<sec>" -> {open,high,low,close}
function readShadow(dirs) {
  const out = new Map();
  for (const d of dirs) {
    let text; try { text = fs.readFileSync(path.join(d, 'records.jsonl'), 'utf8'); } catch { continue; }
    for (const l of text.split('\n')) {
      let r; try { r = JSON.parse(l); } catch { continue; }
      if (r.kind !== 'candle' || !r.mexc || !r.coin) continue;
      const key = `${r.coin}_USDT|${r.candle}`, prev = out.get(key);
      if (!prev || r.ts >= prev.ts) out.set(key, { ts: r.ts, open: +r.mexc.open, high: +r.mexc.high, low: +r.mexc.low, close: +r.mexc.close, src: 'shadow recorder' });
    }
  }
  return out;
}

// ------------------------------------------------------------------ the comparison (pure: no network, no clock unless given)
// o: { events (journal events), candles { SOL_USDT: [finished candles, oldest first] }, shadow (Map), tolerance (R), mode, fromSec, toSec, now (sec) }
function buildReport(o) {
  const tol = o.tolerance ?? 0.05, now = o.now ?? Date.now() / 1000, warnings = [];
  let evs = (o.events || []).filter((e) => !e.symbol || config.ALLOWED_SYMBOLS.includes(e.symbol));
  const mode = o.mode || (evs.length ? evs[evs.length - 1].mode : 'paper');
  evs = evs.filter((e) => e.mode === mode);
  if (!evs.length) return { error: `no journal events for mode "${mode}"` };
  const firstMs = Math.min(...evs.map((e) => e.ts_ms));
  const fromSig = o.fromSec != null ? Math.floor(o.fromSec / IV) * IV : Math.floor(firstMs / 1000 / IV) * IV - IV;   // first signal candle the bot could have judged
  // only the coins the bot was told to trade (the latest bot start records them); a coin that was switched off would otherwise show up as 'backtest-only'
  const sess = evs.filter((e) => e.type === 'session' && Array.isArray(e.coins) && e.coins.length).pop();
  const active = sess ? sess.coins.map(config.coinToSymbol) : config.ALLOWED_SYMBOLS;
  const symbols = config.ALLOWED_SYMBOLS.filter((s) => active.includes(s) && (o.candles || {})[s] && o.candles[s].length);
  if (!symbols.length) return { error: 'no candles supplied' };

  // 1) backtest on exactly the window, per symbol
  const bt = new Map(), toSigBySym = {}, finalByKey = new Map();
  for (const s of symbols) {
    const C = o.candles[s], lastFinished = C[C.length - 1].time;
    const toSig = Math.min(lastFinished - IV, o.toSec != null ? Math.floor(o.toSec / IV) * IV : Infinity);
    toSigBySym[s] = toSig;
    for (const c of C) finalByKey.set(`${s}|${c.time}`, c);
    const startT = fromSig - S.warmup * IV, k = C.findIndex((c) => c.time >= startT);
    if (k < 0) { warnings.push(`${s}: no candles before ${iso(fromSig)}`); continue; }
    const slice = C.slice(k);
    if (slice[0].time !== startT) warnings.push(`${s}: only ${Math.round((fromSig - slice[0].time) / IV)} warm-up candles available before ${iso(fromSig)} (need ${S.warmup}); early signals may differ`);
    const res = core.backtest(slice, {}, null);
    const all = res.trades.map((t) => ({ ...t, open: false }));
    if (res.open) all.push({ dir: res.open.dir, i0: res.open.i0, t: slice[res.open.i0].time, entry: res.open.entry, stop: res.open.stop, tp: res.open.tp, R: null, why: null, exit: null, tExit: null, open: true });
    for (const t of all) {
      const sig = t.t - IV; if (sig < fromSig || sig > toSig) continue;
      const side = t.dir === 1 ? 'LONG' : 'SHORT', key = `${s}|${side}|${sig * 1000}`;
      bt.set(key, { key, symbol: s, side, sigSec: sig, entry: t.entry, stop: t.stop, tp: t.tp, exit: t.exit, R: t.R, why: t.why, exitCandleOpenMs: t.tExit != null ? (t.tExit - IV) * 1000 : null, open: t.open });
    }
  }
  const inWindow = (ms, s) => ms != null && ms / 1000 >= fromSig && ms / 1000 <= (toSigBySym[s] ?? Infinity);

  // 2) journal side
  const live = new Map(), skips = [], sessions = evs.filter((e) => e.type === 'session').length;
  for (const e of evs) {
    if (e.type === 'entry' && inWindow(e.match_key.signal_candle_open_ms, e.symbol)) live.set(e.trade_id, { entry: e, exit: null });
  }
  for (const e of evs) { if (e.type === 'exit' && live.has(e.trade_id)) live.get(e.trade_id).exit = e; }
  for (const e of evs) if (e.type === 'skip' && inWindow(e.match_key.signal_candle_open_ms, e.symbol)) skips.push(e);
  const skipByKey = new Map(skips.filter((e) => e.trade_id).map((e) => [e.trade_id, e]));

  // evidence for a mismatch: nearest threshold distance from the FINAL candles, and whether the recorded signal candle differs
  const evidence = (symbol, sigMs, entryEv) => {
    const C = o.candles[symbol] || [], idx = C.findIndex((c) => c.time === sigMs / 1000);
    const ind = idx >= 0 ? journal.indicators(C.slice(0, idx + 1).map((c) => c.close), null) : null;
    const rec = entryEv && entryEv.indicators ? entryEv.indicators.nearest_threshold_pct : null;
    return { nearest_threshold_pct: ind ? ind.nearest_threshold_pct : null, live_recorded_threshold_pct: rec ?? null, candle_differs: candleDiffs.some((d) => d.symbol === symbol && d.candle_open_ms === sigMs) };
  };

  // 3) recorded candles vs final candles (journal signal candles, shadow recorder candles)
  const candleDiffs = [], seen = new Set();
  const checkCandle = (symbol, ms, rec, src) => {
    const k = `${src}|${symbol}|${ms}`; if (seen.has(k)) return; seen.add(k);
    const f = finalByKey.get(`${symbol}|${ms / 1000}`); if (!f) return;
    const fields = ['open', 'high', 'low', 'close'].filter((x) => Math.abs(rec[x] - f[x]) > 1e-9 * Math.max(1, Math.abs(f[x])));
    if (fields.length) candleDiffs.push({ symbol, candle_open_ms: ms, candle: iso(ms / 1000), source: src, differs: fields, recorded: { open: rec.open, high: rec.high, low: rec.low, close: rec.close }, final: { open: f.open, high: f.high, low: f.low, close: f.close } });
  };
  for (const e of evs) if ((e.type === 'entry' || e.type === 'skip') && e.signal_candle) checkCandle(e.symbol, e.signal_candle.open_time_ms, e.signal_candle, 'journal');
  for (const [k, r] of (o.shadow || new Map())) { const [symbol, sec] = k.split('|'); if (inWindow(+sec * 1000, symbol)) checkCandle(symbol, +sec * 1000, r, 'shadow recorder'); }

  // 4) join
  const rows = [], investigation = [];
  let matched = 0, liveOnly = 0, btOnly = 0;
  const flag = (kind, row, why, extra = {}) => investigation.push({ kind, symbol: row.symbol, side: row.side, signal_candle_open_ms: row.signal_candle_open_ms, signal_candle: iso(row.signal_candle_open_ms / 1000), why, ...row.ev, ...extra });
  for (const [key, b] of bt) {
    const L = live.get(key), sigMs = b.sigSec * 1000, base = { symbol: b.symbol, side: b.side, signal_candle_open_ms: sigMs };
    if (!L) {
      btOnly++;
      const sk = skipByKey.get(key);
      const ev = evidence(b.symbol, sigMs, null);
      rows.push({ ...base, status: 'backtest-only', backtest: { entry: b.entry, exit: b.exit, R: b.R, why: b.why }, explained_by: sk ? `journal skip: ${sk.reason}` : null });
      flag('backtest-only', { ...base, ev }, sk ? `the backtest takes this trade, the bot skipped the signal (${sk.reason}${sk.detail ? ': ' + sk.detail : ''})` : 'the backtest takes this trade, the journal has no entry and no skip for it (bot down? candle missing?)', { backtest_R: b.R, backtest_exit_reason: b.why });
      continue;
    }
    const en = L.entry, ex = L.exit, diffs = [];
    const oneR = Math.abs(b.entry - b.stop), entryDiffR = oneR > 0 ? Math.abs(en.entry.fill_price - b.entry) / oneR : null;
    if (entryDiffR != null && entryDiffR > tol) diffs.push(`entry price differs by ${entryDiffR.toFixed(3)}R (live ${en.entry.fill_price}, backtest ${+b.entry.toPrecision(7)}; tolerance ${tol}R)`);
    if (!!ex !== !b.open && !(ex && b.open)) {
      if (ex && b.open) diffs.push('live exited but the backtest is still in the trade');
      else if (!ex && !b.open) diffs.push('backtest exited, the journal has no exit yet');
    }
    let rDiff = null;
    if (ex && !b.open) {
      if (ex.exit_reason !== b.why) diffs.push(`exit reason: live ${ex.exit_reason}, backtest ${b.why}`);
      if (ex.exit_candle_open_ms !== b.exitCandleOpenMs) diffs.push(`exit candle: live ${iso(ex.exit_candle_open_ms / 1000)}, backtest ${iso(b.exitCandleOpenMs / 1000)}`);
      rDiff = ex.r_result - b.R;
      if (Math.abs(rDiff) > tol) diffs.push(`R differs by ${rDiff >= 0 ? '+' : ''}${rDiff.toFixed(3)} (live ${ex.r_result.toFixed(3)}R, backtest ${b.R.toFixed(3)}R; tolerance ${tol}R)`);
    }
    rows.push({ ...base, status: diffs.length ? 'differs' : 'matched', live: { entry: en.entry.fill_price, exit: ex ? ex.exit_price : null, R: ex ? ex.r_result : null, why: ex ? ex.exit_reason : null }, backtest: { entry: b.entry, exit: b.exit, R: b.R, why: b.why }, entry_diff_r: entryDiffR, r_diff: rDiff, diffs });
    if (diffs.length) flag('differs', { ...base, ev: evidence(b.symbol, sigMs, en) }, diffs.join('; '), { entry_diff_r: entryDiffR, r_diff: rDiff, live_exit_reason: ex ? ex.exit_reason : null, backtest_exit_reason: b.why });
    else matched++;
  }
  for (const [key, L] of live) {
    if (bt.has(key)) continue;
    liveOnly++;
    const en = L.entry, base = { symbol: en.symbol, side: en.side, signal_candle_open_ms: en.match_key.signal_candle_open_ms };
    rows.push({ ...base, status: 'live-only', live: { entry: en.entry.fill_price, exit: L.exit ? L.exit.exit_price : null, R: L.exit ? L.exit.r_result : null, why: L.exit ? L.exit.exit_reason : null } });
    flag('live-only', { ...base, ev: evidence(en.symbol, base.signal_candle_open_ms, en) }, 'the bot traded this signal, the backtest on the final candles has no such trade', { live_R: L.exit ? L.exit.r_result : null });
  }
  const skippedRows = skips.map((e) => ({ symbol: e.symbol, side: e.side, signal_candle_open_ms: e.match_key.signal_candle_open_ms, signal_candle: e.match_key.signal_candle_open_ms ? iso(e.match_key.signal_candle_open_ms / 1000) : null, reason: e.reason, detail: e.detail, in_backtest: e.trade_id ? bt.has(e.trade_id) : false }));
  // candle differences are reported even when no trade is affected
  for (const d of candleDiffs) if (!investigation.some((i) => i.symbol === d.symbol && i.signal_candle_open_ms === d.candle_open_ms)) { /* informational only */ }

  const prov = (k) => [...new Set(evs.map((e) => e.provenance && e.provenance[k]).filter(Boolean))];
  const lastMs = Math.max(...Object.values(toSigBySym)) * 1000 + IV * 1000;
  return {
    generated_at: new Date(now * 1000).toISOString(), mode, tolerance_r: tol, strategy: 'lucidio-core DEFAULTS (bb 20/2, sma 200, 4R target, 48-bar time exit), costs as the paper bot, no funding',
    window: { from_ms: fromSig * 1000, to_ms: lastMs, from_iso: iso(fromSig), to_iso: iso(lastMs / 1000), note: 'signal candles from the first journal event to the last finished candle' },
    match: investigation.length === 0,
    counts: { matched, live_only: liveOnly, backtest_only: btOnly, differs: rows.filter((r) => r.status === 'differs').length, skipped_signals: skips.length, candle_diffs: candleDiffs.length, backtest_trades: bt.size, journal_trades: live.size, journal_events: evs.length, bot_starts: sessions },
    trades: rows, investigation, skipped: skippedRows, candle_diffs: candleDiffs,
    provenance: { git_commits: prov('git_commit'), code_hashes: prov('code_hash'), config_hashes: prov('config_hash'), versions: prov('bot_version') },
    warnings,
    note: matched + liveOnly + btOnly === 0 ? 'no trades on either side in this window: nothing to compare yet (that is a match only by absence)' : undefined,
  };
}

function renderText(r) {
  if (r.error) return `compare-live-vs-backtest: ${r.error}\n`;
  const L = [];
  L.push(`Live (${r.mode}) vs backtest · generated ${r.generated_at}`);
  L.push(`Window: signal candles ${r.window.from_iso} .. ${r.window.to_iso} · tolerance ${r.tolerance_r}R · strategy: ${r.strategy}`);
  L.push(`Provenance in the journal: commits ${r.provenance.git_commits.map((c) => c.slice(0, 10)).join(', ') || '?'} · config hashes ${r.provenance.config_hashes.length} · code hashes ${r.provenance.code_hashes.length} · versions ${r.provenance.versions.join(', ') || '?'}`);
  L.push('');
  L.push(`RESULT: ${r.match ? 'MATCH' : 'NOT A MATCH'}${r.note ? ' (' + r.note + ')' : ''}`);
  const c = r.counts;
  L.push(`  trades: ${c.matched} matched · ${c.live_only} live-only · ${c.backtest_only} backtest-only · ${c.differs} differ  (journal ${c.journal_trades}, backtest ${c.backtest_trades})`);
  L.push(`  skipped signals in the journal: ${c.skipped_signals} · recorded candles that differ from the final ones: ${c.candle_diffs} · bot starts: ${c.bot_starts}`);
  for (const w of r.warnings) L.push(`  WARNING ${w}`);
  if (r.investigation.length) {
    L.push('', `INVESTIGATE (${r.investigation.length}):`);
    for (const i of r.investigation) {
      L.push(`  - ${i.kind.toUpperCase()} ${i.symbol} ${i.side} signal candle ${i.signal_candle}`);
      L.push(`      ${i.why}`);
      L.push(`      nearest threshold at the signal close: ${pct(i.nearest_threshold_pct)} (final candles)${i.live_recorded_threshold_pct != null ? ` · ${pct(i.live_recorded_threshold_pct)} (recorded live)` : ''} · recorded candle differs from final: ${i.candle_differs ? 'YES' : 'no'}`);
      if (i.nearest_threshold_pct != null && i.nearest_threshold_pct <= 0.06) L.push('      -> within ~0.06% of a threshold: the earlier audit found every venue mismatch happens in this zone (a tiny candle difference flips the decision)');
    }
  }
  if (r.candle_diffs.length) {
    L.push('', `CANDLES that differ from the final download (${r.candle_diffs.length}):`);
    for (const d of r.candle_diffs.slice(0, 30)) L.push(`  - ${d.symbol} ${d.candle} [${d.source}] ${d.differs.join(',')}: recorded ${JSON.stringify(d.recorded)} vs final ${JSON.stringify(d.final)}`);
  }
  if (r.skipped.length) {
    L.push('', `SKIPPED SIGNALS (${r.skipped.length}):`);
    for (const s of r.skipped.slice(0, 40)) L.push(`  - ${s.symbol} ${s.side || ''} ${s.signal_candle || ''}: ${s.reason}${s.detail ? ' (' + s.detail + ')' : ''}${s.in_backtest ? ' · the backtest takes this trade' : ''}`);
  }
  L.push('', 'TRADES:');
  for (const t of r.trades) L.push(`  ${t.status.padEnd(13)} ${t.symbol} ${t.side} ${iso(t.signal_candle_open_ms / 1000)}  live ${t.live ? `${t.live.why || 'open'} ${t.live.R == null ? '' : t.live.R.toFixed(2) + 'R'}` : '—'} | backtest ${t.backtest ? `${t.backtest.why || 'open'} ${t.backtest.R == null ? '' : t.backtest.R.toFixed(2) + 'R'}` : '—'}`);
  return L.join('\n') + '\n';
}

// ------------------------------------------------------------------ CLI
function args(argv) {
  const o = {}; for (let i = 2; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1]; if (nx === undefined || nx.startsWith('--')) o[k] = true; else { o[k] = nx; i++; } } }
  return o;
}
const toSec = (v) => (v == null ? null : /^\d+$/.test(String(v)) ? (+v > 1e11 ? +v / 1000 : +v) : Date.parse(v) / 1000);

async function main(argv = process.argv, deps = {}) {
  const a = args(argv);
  const jfile = a.journal || journal.file();
  const { events, bad } = journal.readAll(jfile);
  if (!events.length) { console.error(`compare-live-vs-backtest: no journal events in ${jfile}`); return 2; }
  const mode = a.mode || events[events.length - 1].mode;
  const mine = events.filter((e) => e.mode === mode);
  const first = Math.min(...mine.map((e) => e.ts_ms)) / 1000;
  const fromSec = a.from ? toSec(a.from) : null, toSecArg = a.to ? toSec(a.to) : null;
  const fromSig = fromSec != null ? Math.floor(fromSec / IV) * IV : Math.floor(first / IV) * IV - IV;
  const client = deps.client || require('./mexc.js').createClient();      // no keys: public endpoints only
  const nowS = deps.nowSec ?? Math.floor(Date.now() / 1000);
  const candles = {};
  for (const s of config.ALLOWED_SYMBOLS) candles[s] = await downloadCandles(client, s, fromSig - (S.warmup + 4) * IV, toSecArg ?? nowS, nowS);
  const shadowDirs = a['shadow-dir'] ? [a['shadow-dir']] : [process.env.SHADOW_DIR, path.join(__dirname, 'shadow'), path.join(__dirname, 'audit', 'shadow')].filter(Boolean).filter((d) => fs.existsSync(d));
  const report = buildReport({ events, candles, shadow: readShadow(shadowDirs), tolerance: a.tolerance != null ? +a.tolerance : 0.05, mode, fromSec: fromSec != null ? fromSig : null, toSec: toSecArg, now: nowS });
  if (report.error) { console.error('compare-live-vs-backtest: ' + report.error); return 2; }
  if (bad) report.warnings.push(`${bad} unreadable journal line(s) skipped`);
  report.shadow_sources = shadowDirs.length;
  const text = renderText(report), day = new Date(nowS * 1000).toISOString().slice(0, 10);
  const outDir = a['out-dir'] || path.join(__dirname, 'audit', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `compare-${day}.json`), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(outDir, `compare-${day}.txt`), text);
  if (!a.quiet) process.stdout.write(text);
  console.log(`written: ${path.join(outDir, `compare-${day}.json`)} and .txt`);
  if (a.push) { const push = require('./dashboard-push.js'); push.pushCompare(report); const r = await push.flush({ force: true }); console.log(push.enabled() ? `dashboard: ${r.sent} sent, ${r.pending} queued` : 'dashboard not configured: summary not pushed'); }
  return report.match ? 0 : 1;
}

module.exports = { buildReport, renderText, downloadCandles, readShadow, main };
if (require.main === module) main().then((c) => { process.exitCode = c; }, (e) => { console.error('compare-live-vs-backtest failed: ' + e.message); process.exitCode = 2; });
