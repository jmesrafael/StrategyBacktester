#!/usr/bin/env node
// compare-live-vs-backtest.js - did the bot do what the backtester says it should have done on the SAME candles?
//
//   node compare-live-vs-backtest.js [--journal journal/trades.jsonl] [--state state/state.json] [--from ISO|ms] [--to ISO|ms]
//                                    [--tolerance 0.05] [--rel-tolerance 0.02] [--mode paper|live] [--out-dir audit/out] [--push] [--quiet]
//
// 1. reads journal/trades.jsonl (entries, exits, skipped signals, bot starts) and the bot's state file (open positions and their CURRENT trailing stop)
// 2. downloads FINISHED 4h candles for the window from MEXC (public GET endpoints only; the still-forming candle is dropped)
// 3. runs the existing backtest() from icore-core.js, unchanged, on exactly that window: flat at the window start like a freshly started bot, with
//    WARM candles of history before it so ATR / SMA / cloud have the same values the bot computed from its own 500-candle fetch
// 4. joins journal trades to backtest trades on the match key: symbol + side + signal candle open time (UTC ms)
// 5. reports: matched / live-only / backtest-only (with the skipped signals that explain them), exit reason and exit candle differences,
//    entry price and R differences beyond the tolerance, the trailing stop of every OPEN trade (bot state vs backtest), recorded vs freshly
//    downloaded signal candles, and for every mismatch the distance (%) of the signal close to its nearest threshold.
// MATCH = same trade set, same exit reasons and exit candles, R / entry / open stop within tolerance. Anything else is an investigation item with that evidence.
// R tolerance per trade = max(--tolerance R, --rel-tolerance × |backtest R|): a +60R trade carries real funding for hundreds of candles, the backtest a flat estimate.
// Writes audit/out/compare-<date>.json and .txt, prints the summary, exits 0 on match, 1 otherwise, 2 when the comparison could not run.
// It never sends an order and never needs a key, so it is safe as a daily systemd timer. --push also sends the summary to the dashboard (if configured).
'use strict';
const fs = require('fs'), path = require('path');
require('./envfile.js').load();
const core = require('./icore-core.js');
const journal = require('./journal.js');
const config = require('./config.js');
const MK = require('./matchkey.js');

const IV = 14400, S = core.DEFAULTS;
// journal skip reasons that mean "the exchange (or its margin) did not allow the order": same list as the Telegram SIGNAL MISSED alert, minus risk_cap (the bot's own rule)
const REFUSED = new Set(['entry_refused', 'insufficient_margin', 'not_tradable']);
const refusalText = (d) => String(d).replace(/^entry order not filled:\s*/i, '').replace(/^BLOCKED:\s*MEXC\s+\S+\s+/i, '').slice(0, 90);
const WARM = 500;   // candles of history before the first signal candle: the bot itself decides on a 500-candle fetch
const iso = (sec) => new Date(sec * 1000).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
const pct = (v) => (v == null ? '—' : `${v.toFixed(4)}%`);
const coinOf = (symbol) => String(symbol).replace(/_USDT$/, '');

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

// the bot's open positions from state/state.json: Map trade_id -> { stop, stop0, entry, lastTime } (the trailing stop lives only here, the journal has entries and exits)
function openFromState(file) {
  const out = new Map(); let st;
  try { st = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return out; }
  for (const [coin, c] of Object.entries((st && st.coins) || {})) {
    const p = c && c.pos; if (!p || p.dir == null || p.stop == null) continue;
    const sig = p.sigTime ?? (p.t0 != null ? p.t0 - IV : null); if (sig == null) continue;
    out.set(MK.tradeId(config.coinToSymbol(coin), p.dir, sig), { stop: +p.stop, stop0: p.stop0 != null ? +p.stop0 : null, entry: +p.entry, lastTime: c.lastTime ?? null, mode: st.mode || null });
  }
  return out;
}

// ------------------------------------------------------------------ the comparison (pure: no network, no clock unless given)
// o: { events (journal events), candles { SOL_USDT: [finished candles, oldest first] }, open (Map from openFromState), tolerance (R), relTolerance, mode, fromSec, toSec, now (sec) }
function buildReport(o) {
  const tol = o.tolerance ?? 0.05, rel = o.relTolerance ?? 0.02, now = o.now ?? Date.now() / 1000, warnings = [];
  const tolFor = (R) => Math.max(tol, rel * Math.abs(R || 0));
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

  // 1) backtest on exactly the window, per symbol: history before fromSig only warms the indicators up (cfg.warmup = first index the backtest may signal on)
  const bt = new Map(), toSigBySym = {}, finalByKey = new Map(), lastFinished = {}, btLast = {};
  for (const s of symbols) {
    const C = o.candles[s];
    lastFinished[s] = C[C.length - 1].time;
    const toSig = Math.min(lastFinished[s] - IV, o.toSec != null ? Math.floor(o.toSec / IV) * IV : Infinity);
    toSigBySym[s] = toSig;
    for (const c of C) finalByKey.set(`${s}|${c.time}`, c);
    const k = C.findIndex((c) => c.time >= fromSig - WARM * IV);
    if (k < 0) { warnings.push(`${s}: no candles before ${iso(fromSig)}`); continue; }
    const slice = C.slice(k), w = slice.findIndex((c) => c.time >= fromSig);
    if (w < 0) continue;
    if (w < S.warmup) warnings.push(`${s}: only ${w} warm-up candles before ${iso(fromSig)} (the bot uses ${WARM}); early signals may differ`);
    // the backtest's candles end with the last one the window covers + 1 (that candle's open is the fill of a signal on toSig)
    const end = slice.findIndex((c) => c.time > toSig + IV), used = end < 0 ? slice : slice.slice(0, end);
    btLast[s] = used[used.length - 1].time;   // the last candle the backtest managed an open trade on (the bot's state.lastTime must be the same one)
    const res = core.backtest(used, { warmup: Math.max(w, S.warmup) });
    const all = res.trades.map((t) => ({ ...t, open: false }));
    if (res.open) all.push({ dir: res.open.dir, t: slice[res.open.i0].time, entry: res.open.entry, stop: res.open.stop, stop0: res.open.stop0, R: null, why: null, exit: null, tExit: null, open: true });
    for (const t of all) {
      const sig = t.t - IV; if (sig < fromSig || sig > toSig) continue;
      const side = MK.sideName(t.dir), key = MK.tradeId(s, side, sig);
      bt.set(key, { key, symbol: s, side, sigSec: sig, entry: t.entry, stop: t.stop, stop0: t.stop0, exit: t.exit, R: t.R, why: t.why, bars: t.bars ?? null, exitCandleOpenMs: t.tExit != null ? (t.tExit - IV) * 1000 : null, tExitSec: t.tExit ?? null, open: t.open });
    }
  }
  const inWindow = (ms, s) => ms != null && ms / 1000 >= fromSig && ms / 1000 <= (toSigBySym[s] ?? Infinity);

  // 2) journal side
  const live = new Map(), skips = [], sessions = evs.filter((e) => e.type === 'session').length;
  for (const e of evs) if (e.type === 'entry' && inWindow(e.match_key.signal_candle_open_ms, e.symbol)) live.set(e.trade_id, { entry: e, exit: null });
  for (const e of evs) if (e.type === 'exit' && live.has(e.trade_id)) live.get(e.trade_id).exit = e;
  for (const e of evs) if (e.type === 'skip' && inWindow(e.match_key.signal_candle_open_ms, e.symbol)) skips.push(e);
  const skipByKey = new Map(skips.filter((e) => e.trade_id).map((e) => [e.trade_id, e]));

  // 3) recorded signal candles (journal) vs final candles
  const candleDiffs = [], seen = new Set();
  const checkCandle = (symbol, ms, rec, src) => {
    const k = `${src}|${symbol}|${ms}`; if (seen.has(k)) return; seen.add(k);
    const f = finalByKey.get(`${symbol}|${ms / 1000}`); if (!f) return;
    const fields = ['open', 'high', 'low', 'close'].filter((x) => Math.abs(rec[x] - f[x]) > 1e-9 * Math.max(1, Math.abs(f[x])));
    if (fields.length) candleDiffs.push({ symbol, candle_open_ms: ms, candle: iso(ms / 1000), source: src, differs: fields, recorded: { open: rec.open, high: rec.high, low: rec.low, close: rec.close }, final: { open: f.open, high: f.high, low: f.low, close: f.close } });
  };
  for (const e of evs) if ((e.type === 'entry' || e.type === 'skip') && e.signal_candle) checkCandle(e.symbol, e.signal_candle.open_time_ms, e.signal_candle, 'journal');

  // evidence for a mismatch: nearest threshold distance from the FINAL candles, and whether the recorded signal candle differs
  const evidence = (symbol, sigMs, entryEv) => {
    const C = o.candles[symbol] || [], idx = C.findIndex((c) => c.time === sigMs / 1000);
    const ind = idx >= 0 ? journal.indicators(C.slice(Math.max(0, idx - 399), idx + 1), S) : null;
    const rec = entryEv && entryEv.indicators ? entryEv.indicators.nearest_threshold_pct : null;
    return { nearest_threshold_pct: ind ? ind.nearest_threshold_pct : null, live_recorded_threshold_pct: rec ?? null, candle_differs: candleDiffs.some((d) => d.symbol === symbol && d.candle_open_ms === sigMs) };
  };

  // 4) join
  const rows = [], investigation = [], open = o.open || new Map(), stopChecks = [], refusedBt = [];
  let matched = 0, liveOnly = 0, btOnly = 0;
  const flag = (kind, row, why, extra = {}) => investigation.push({ kind, symbol: row.symbol, side: row.side, signal_candle_open_ms: row.signal_candle_open_ms, signal_candle: iso(row.signal_candle_open_ms / 1000), why, ...row.ev, ...extra });
  for (const [key, b] of bt) {
    const L = live.get(key), sigMs = b.sigSec * 1000, base = { symbol: b.symbol, side: b.side, signal_candle_open_ms: sigMs };
    if (!L) {
      btOnly++;
      const sk = skipByKey.get(key), ev = evidence(b.symbol, sigMs, null);
      rows.push({ ...base, status: 'backtest-only', backtest: { entry: b.entry, exit: b.exit, R: b.R, why: b.why, open: b.open }, explained_by: sk ? `journal skip: ${sk.reason}` : null });
      if (sk && REFUSED.has(sk.reason)) {   // the bot wanted the trade and the exchange refused it: a missed trade, not a logic difference. Explained, and it carries the exchange's own words
        refusedBt.push(b);
        flag('exchange-refused', { ...base, ev }, `missed trade: the exchange refused the order (${sk.reason}${sk.detail ? ': ' + refusalText(sk.detail) : ''})`, { backtest_R: b.R, backtest_exit_reason: b.why, explained: true, reason: sk.reason });
        continue;
      }
      flag('backtest-only', { ...base, ev }, sk ? `the backtest takes this trade, the bot skipped the signal (${sk.reason}${sk.detail ? ': ' + sk.detail : ''})` : 'the backtest takes this trade, the journal has no entry and no skip for it (bot down? candle missing?)', { backtest_R: b.R, backtest_exit_reason: b.why });
      continue;
    }
    const en = L.entry, ex = L.exit, diffs = [];
    const oneR = Math.abs(b.entry - b.stop0), entryDiffR = oneR > 0 ? Math.abs(en.entry.fill_price - b.entry) / oneR : null;
    if (entryDiffR != null && entryDiffR > tol) diffs.push(`entry price differs by ${entryDiffR.toFixed(3)}R (live ${en.entry.fill_price}, backtest ${+b.entry.toPrecision(7)}; tolerance ${tol}R)`);
    if (ex && b.open) diffs.push('live exited but the backtest is still in the trade');
    else if (!ex && !b.open) diffs.push('backtest exited, the journal has no exit yet');
    let rDiff = null, stopDiffR = null;
    if (ex && !b.open) {
      if (ex.exit_reason !== b.why) diffs.push(`exit reason: live ${ex.exit_reason}, backtest ${b.why}`);
      // a time exit fills at the close of the last candle: the bot files it under the next candle's open, the backtest under the candle itself
      const exitMs = ex.exit_reason === 'time' && b.why === 'time' ? ex.exit_candle_open_ms - IV * 1000 : ex.exit_candle_open_ms;
      if (ex.exit_candle_open_ms != null && exitMs !== b.exitCandleOpenMs) diffs.push(`exit candle: live ${iso(ex.exit_candle_open_ms / 1000)}, backtest ${iso(b.exitCandleOpenMs / 1000)}`);
      rDiff = ex.r_result - b.R;
      if (Math.abs(rDiff) > tolFor(b.R)) diffs.push(`R differs by ${rDiff >= 0 ? '+' : ''}${rDiff.toFixed(3)} (live ${ex.r_result.toFixed(3)}R, backtest ${b.R.toFixed(3)}R; tolerance ${tolFor(b.R).toFixed(3)}R)`);
    }
    if (!ex && b.open) {   // both still in the trade: the trailing stop must sit where the backtest has it (the bot state keeps the live stop)
      const s = open.get(key), sym = b.symbol, lastSig = btLast[sym];
      if (!s) stopChecks.push({ key, symbol: sym, side: b.side, status: 'no state', note: 'the bot state has no open position for this trade (or no state file was given)' });
      else if (s.lastTime != null && s.lastTime !== lastSig) stopChecks.push({ key, symbol: sym, side: b.side, status: 'not comparable', note: `the bot last processed ${iso(s.lastTime)}, the backtest ${iso(lastSig)}`, live_stop: s.stop, backtest_stop: b.stop });
      else {
        stopDiffR = oneR > 0 ? Math.abs(s.stop - b.stop) / oneR : null;
        const okStop = stopDiffR != null && stopDiffR <= tol;
        stopChecks.push({ key, symbol: sym, side: b.side, status: okStop ? 'same' : 'differs', live_stop: s.stop, backtest_stop: b.stop, diff_r: stopDiffR, locked_r_live: oneR > 0 ? MK.sideName(b.side) === 'LONG' ? (s.stop - b.entry) / oneR : (b.entry - s.stop) / oneR : null });
        if (!okStop) diffs.push(`trailing stop differs by ${stopDiffR == null ? '?' : stopDiffR.toFixed(3)}R (bot ${s.stop}, backtest ${+b.stop.toPrecision(7)}; tolerance ${tol}R)`);
      }
    }
    rows.push({ ...base, status: diffs.length ? 'differs' : 'matched', live: { entry: en.entry.fill_price, exit: ex ? ex.exit_price : null, R: ex ? ex.r_result : null, why: ex ? ex.exit_reason : null, open: !ex }, backtest: { entry: b.entry, exit: b.exit, R: b.R, why: b.why, open: b.open, stop: b.open ? b.stop : null }, entry_diff_r: entryDiffR, r_diff: rDiff, stop_diff_r: stopDiffR, diffs });
    if (diffs.length) flag('differs', { ...base, ev: evidence(b.symbol, sigMs, en) }, diffs.join('; '), { entry_diff_r: entryDiffR, r_diff: rDiff, stop_diff_r: stopDiffR, live_exit_reason: ex ? ex.exit_reason : null, backtest_exit_reason: b.why });
    else matched++;
  }
  for (const [key, L] of live) {
    if (bt.has(key)) continue;
    liveOnly++;
    const en = L.entry, base = { symbol: en.symbol, side: en.side, signal_candle_open_ms: en.match_key.signal_candle_open_ms };
    rows.push({ ...base, status: 'live-only', live: { entry: en.entry.fill_price, exit: L.exit ? L.exit.exit_price : null, R: L.exit ? L.exit.r_result : null, why: L.exit ? L.exit.exit_reason : null, open: !L.exit } });
    // the backtest was still inside a trade the exchange refused, the bot was flat: it could take a signal on the same coin that the backtest had to pass on
    const sigSec = base.signal_candle_open_ms / 1000, cause = refusedBt.find((r) => r.symbol === en.symbol && r.sigSec < sigSec && (r.tExitSec == null || sigSec < r.tExitSec));
    if (cause) { flag('follows-refused', { ...base, ev: evidence(en.symbol, base.signal_candle_open_ms, en) }, `follows the refused ${cause.side} of ${iso(cause.sigSec).slice(5, 16).replace('T', ' ')} UTC: the backtest was still in that trade, the bot was flat and took this one`, { live_R: L.exit ? L.exit.r_result : null, explained: true, reason: 'follows_refused' }); continue; }
    flag('live-only', { ...base, ev: evidence(en.symbol, base.signal_candle_open_ms, en) }, 'the bot traded this signal, the backtest on the final candles has no such trade', { live_R: L.exit ? L.exit.r_result : null });
  }
  const skippedRows = skips.map((e) => ({ symbol: e.symbol, side: e.side, signal_candle_open_ms: e.match_key.signal_candle_open_ms, signal_candle: e.match_key.signal_candle_open_ms ? iso(e.match_key.signal_candle_open_ms / 1000) : null, reason: e.reason, detail: e.detail, in_backtest: e.trade_id ? bt.has(e.trade_id) : false }));

  // totals on both sides (closed trades only), so drift shows up even when every single trade is inside its tolerance
  const closedRows = rows.filter((r) => r.live && r.backtest && r.live.R != null && r.backtest.R != null);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const totals = { closed_both: closedRows.length, live_R: sum(closedRows.map((r) => r.live.R)), backtest_R: sum(closedRows.map((r) => r.backtest.R)),
    live_R_all: sum([...live.values()].filter((L) => L.exit).map((L) => L.exit.r_result)), backtest_R_all: sum([...bt.values()].filter((b) => !b.open).map((b) => b.R)) };
  totals.drift_R = totals.live_R - totals.backtest_R;

  const prov = (k) => [...new Set(evs.map((e) => e.provenance && e.provenance[k]).filter(Boolean))];
  const lastMs = Math.max(...Object.values(toSigBySym)) * 1000 + IV * 1000;
  return {
    generated_at: new Date(now * 1000).toISOString(), mode, tolerance_r: tol, rel_tolerance: rel, strategy: 'icore-core DEFAULTS, the same settings and cost model as the bot (paper funding is a flat estimate)',
    window: { from_ms: fromSig * 1000, to_ms: lastMs, from_iso: iso(fromSig), to_iso: iso(lastMs / 1000), note: 'signal candles from the first journal event to the last finished candle' },
    match: investigation.every((i) => i.explained),   // a refused order (and the trade that follows from it) is a missed trade to read, not a logic difference
    counts: { explained: investigation.filter((i) => i.explained).length, refused: refusedBt.length, matched, live_only: liveOnly, backtest_only: btOnly, differs: rows.filter((r) => r.status === 'differs').length, skipped_signals: skips.length, candle_diffs: candleDiffs.length, backtest_trades: bt.size, journal_trades: live.size, open_trades: rows.filter((r) => r.backtest && r.backtest.open).length, journal_events: evs.length, bot_starts: sessions },
    totals, trades: rows, investigation, skipped: skippedRows, candle_diffs: candleDiffs, open_stops: stopChecks,
    provenance: { git_commits: prov('git_commit'), code_hashes: prov('code_hash'), config_hashes: prov('config_hash'), versions: prov('bot_version') },
    warnings, source: 'journal',
    cannot_check: ['what the bot decided on candles with NO signal (the journal only records entries, exits and skipped signals: a candle the bot never looked at shows up as a backtest-only trade)',
      'the trailing stop history of a CLOSED trade (only the current stop of an open trade is kept, in the state file)'],
    note: matched + liveOnly + btOnly === 0 ? 'no trades on either side in this window: nothing to compare yet (that is a match only by absence)' : undefined,
  };
}

function renderText(r) {
  if (r.error) return `compare-live-vs-backtest: ${r.error}\n`;
  const L = [], f2 = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`);
  L.push(`BB-Trail lab (${r.mode}) vs backtest · generated ${r.generated_at}`);
  L.push(`Window: signal candles ${r.window.from_iso} .. ${r.window.to_iso} · tolerance ${r.tolerance_r}R or ${(r.rel_tolerance * 100).toFixed(0)}% of the trade · ${r.strategy}`);
  L.push(`Provenance in the journal: commits ${r.provenance.git_commits.map((c) => c.slice(0, 10)).join(', ') || '?'} · config hashes ${r.provenance.config_hashes.length} · code hashes ${r.provenance.code_hashes.length} · versions ${r.provenance.versions.join(', ') || '?'}`);
  L.push('');
  L.push(`RESULT: ${r.match ? 'MATCH' : 'NOT A MATCH'}${r.note ? ' (' + r.note + ')' : ''}`);
  const c = r.counts, t = r.totals;
  L.push(`  trades: ${c.matched} matched · ${c.live_only} live-only · ${c.backtest_only} backtest-only · ${c.differs} differ  (journal ${c.journal_trades}, backtest ${c.backtest_trades}, still open ${c.open_trades})`);
  L.push(`  closed on both sides: ${t.closed_both} · live ${f2(t.live_R)} vs backtest ${f2(t.backtest_R)} (drift ${f2(t.drift_R)}) · all closed: live ${f2(t.live_R_all)}, backtest ${f2(t.backtest_R_all)}`);
  L.push(`  skipped signals in the journal: ${c.skipped_signals} · recorded candles that differ from the final ones: ${c.candle_diffs} · bot starts: ${c.bot_starts}`);
  if (r.open_stops.length) {
    L.push('', `OPEN TRADES, trailing stop (bot state vs backtest):`);
    for (const s of r.open_stops) L.push(`  - ${s.status.toUpperCase().padEnd(14)} ${s.symbol} ${s.side}${s.live_stop != null ? `  bot ${s.live_stop}  backtest ${+s.backtest_stop.toPrecision(7)}` : ''}${s.diff_r != null ? `  (${s.diff_r.toFixed(3)}R apart, locked ${f2(s.locked_r_live)})` : ''}${s.note ? '  ' + s.note : ''}`);
  }
  if (r.cannot_check && r.cannot_check.length) { L.push('', `CANNOT CHECK (${r.cannot_check.length}):`); for (const x of r.cannot_check) L.push(`  - ${x}`); }
  for (const w of r.warnings) L.push(`  WARNING ${w}`);
  if (r.investigation.length) {
    L.push('', `INVESTIGATE (${r.investigation.length}):`);
    for (const i of r.investigation) {
      L.push(`  - ${i.kind.toUpperCase()}${i.explained ? ' (explained, not a logic difference)' : ''} ${i.symbol} ${i.side} signal candle ${i.signal_candle}`);
      L.push(`      ${i.why}`);
      L.push(`      nearest threshold at the signal close: ${pct(i.nearest_threshold_pct)} (final candles)${i.live_recorded_threshold_pct != null ? ` · ${pct(i.live_recorded_threshold_pct)} (recorded live)` : ''} · recorded candle differs from final: ${i.candle_differs ? 'YES' : 'no'}`);
      if (i.nearest_threshold_pct != null && i.nearest_threshold_pct <= 0.06) L.push('      -> within ~0.06% of a threshold: a tiny candle difference between the bot\'s fetch and the final candle can flip the decision');
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
  const side = (x) => (!x ? '—' : x.open ? 'open' : `${x.why} ${x.R == null ? '' : f2(x.R)}`);
  for (const x of r.trades) L.push(`  ${x.status.padEnd(13)} ${x.symbol} ${x.side} ${iso(x.signal_candle_open_ms / 1000)}  live ${side(x.live)} | backtest ${side(x.backtest)}`);
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
  if (!events.length) { console.error(`compare-live-vs-backtest: no journal events in ${jfile} (start the bot first; it writes a session event at every start)`); return 2; }
  const mode = a.mode || events[events.length - 1].mode;
  const mine = events.filter((e) => e.mode === mode);
  if (!mine.length) { console.error(`compare-live-vs-backtest: no journal events for mode "${mode}"`); return 2; }
  const first = Math.min(...mine.map((e) => e.ts_ms)) / 1000;
  const fromSec = a.from ? toSec(a.from) : null, toSecArg = a.to ? toSec(a.to) : null;
  const fromSig = fromSec != null ? Math.floor(fromSec / IV) * IV : Math.floor(first / IV) * IV - IV;
  const client = deps.client || require('./mexc.js').client;      // public endpoints only: klines need no key
  const nowS = deps.nowSec ?? Math.floor(Date.now() / 1000);
  const candles = {};
  for (const s of config.ALLOWED_SYMBOLS) candles[s] = await downloadCandles(client, s, fromSig - (WARM + 4) * IV, toSecArg ?? nowS, nowS);
  const sfile = a.state || path.join(process.env.ICORE_STATE_DIR || path.join(__dirname, 'state'), 'state.json');
  const report = buildReport({ events, candles, open: openFromState(sfile), tolerance: a.tolerance != null ? +a.tolerance : 0.05, relTolerance: a['rel-tolerance'] != null ? +a['rel-tolerance'] : 0.02, mode, fromSec: fromSec != null ? fromSig : null, toSec: toSecArg, now: nowS });
  if (report.error) { console.error('compare-live-vs-backtest: ' + report.error); return 2; }
  if (bad) report.warnings.push(`${bad} unreadable journal line(s) skipped`);
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

module.exports = { buildReport, renderText, downloadCandles, openFromState, main, WARM };
if (require.main === module) main().then((c) => { process.exitCode = c; }, (e) => { console.error('compare-live-vs-backtest failed: ' + e.message); process.exitCode = 2; });
