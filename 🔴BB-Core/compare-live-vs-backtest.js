#!/usr/bin/env node
// compare-live-vs-backtest.js - did the bot do what the backtester says it should have done on the SAME candles?
//
//   node compare-live-vs-backtest.js [--journal journal/trades.jsonl] [--from ISO|ms] [--to ISO|ms] [--tolerance 0.05] [--mode paper|live]
//                                    [--shadow-dir DIR] [--out-dir audit/out] [--push] [--quiet] [--state state/state.json] [--no-journal]
//
// TWO MODES. With a journal (the journal version of the bot) every check below runs. WITHOUT one (a bot that predates the journal, or an empty journal) it falls
// back to the bot's own trade records in state/state.json joined to the shadow recorder's decisions on the same match key; the report then says, in a
// "CANNOT CHECK" list, exactly which checks that mode cannot do (skipped signals, recorded indicators, recorded candles, exit candle, fill slippage, provenance).
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
const MK = require('./matchkey.js'), READER = require('./shadow-reader.js');

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

// shadow-recorder candle records (kind "candle"): latest snapshot per coin+candle -> Map key "SOL_USDT|<sec>" -> {open,high,low,close}.
// The Map also carries .decisions (the recorder's decision per signal candle, key "SOL_USDT|<signal candle open ms>"): same match key as the journal.
// Reads records-YYYY-MM-DD.jsonl and the older records.jsonl, plain or .gz (rotated files).
function readShadow(dirs) {
  const out = new Map(); out.decisions = new Map();
  for (const d of dirs) {
    const { rows, files } = READER.readRecords(d); if (!files) continue;
    for (const r of rows) {
      if (r.kind !== 'candle' || !r.mexc || !r.coin) continue;
      const key = `${r.coin}_USDT|${r.candle}`, prev = out.get(key);
      if (!prev || r.ts >= prev.ts) out.set(key, { ts: r.ts, open: +r.mexc.open, high: +r.mexc.high, low: +r.mexc.low, close: +r.mexc.close, src: 'shadow recorder' });
    }
    for (const [k, v] of READER.decisionMap(d)) if (!out.decisions.has(k)) out.decisions.set(k, v);
  }
  return out;
}
const recText = (d) => (!d ? 'no recorder data for this candle' : `recorder (${d.snap}, fetched ${d.wake_lag_sec == null ? '?' : d.wake_lag_sec + ' s'} after the close) ${d.signal === 'none' ? 'saw NO signal' + (d.reasons && d.reasons[0] ? ': ' + d.reasons[0] : '') : 'saw ' + d.signal}`);

// The bot's own trade records when there is no journal: state/state.json (coins[X].trades and the open position) turned into journal-shaped events with the SAME match
// key (symbol, side, signal candle open ms; the signal candle is the one before the entry candle). Only what the old bot kept: entry price, exit price, exit reason, R, times.
function eventsFromState(file) {
  let st; try { st = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
  if (!st || typeof st !== 'object') return [];
  const mode = st.mode === 'live' ? 'live' : 'paper', evs = [], coins = Object.keys(st.coins || {}), startMs = st.startedAt ? Date.parse(st.startedAt) : NaN;
  const mk = (type, coin, dir, sigSec, tsMs, extra) => {
    const symbol = config.coinToSymbol(coin), side = MK.sideName(dir);
    return { v: 1, type, event_id: `state:${type}:${MK.tradeId(symbol, side, sigSec)}`, ts_ms: tsMs, symbol, side, mode, trade_id: MK.tradeId(symbol, side, sigSec), match_key: MK.matchKey(symbol, side, sigSec), source: 'state', ...extra };
  };
  for (const coin of coins) {
    const c = st.coins[coin] || {};
    for (const t of c.trades || []) {
      const sig = t.t - IV;
      evs.push(mk('entry', coin, t.dir, sig, t.t * 1000, { entry: { fill_price: t.entry, delay_sec: t.entryDelaySec ?? null } }));
      evs.push(mk('exit', coin, t.dir, sig, t.tExit * 1000, { exit_price: t.exit, exit_reason: t.why, exit_candle_open_ms: null, r_result: t.R, usd_pnl: t.usd ?? null, balance_after: t.balance ?? null }));
    }
    if (c.pos) evs.push(mk('entry', coin, c.pos.dir, c.pos.sigTime ?? c.pos.t0 - IV, (c.pos.t0 || 0) * 1000, { entry: { fill_price: c.pos.entry, delay_sec: c.pos.entryDelaySec ?? null } }));
  }
  const first = Math.min(...[startMs, ...evs.map((e) => e.ts_ms)].filter(Number.isFinite));
  if (Number.isFinite(first)) evs.push({ v: 1, type: 'session', event_id: 'state:session', ts_ms: Number.isFinite(startMs) ? startMs : first, symbol: null, side: null, mode, match_key: { symbol: null, side: null, signal_candle_open_ms: null }, coins, source: 'state', note: 'synthesised from state.json (startedAt)' });
  return evs;
}
const CANNOT_STATE = [
  'skipped signals: the state file has no skip records, so a backtest-only trade cannot be told apart as "skipped", "bot was down" or "candle missed" from the bot\'s side (the recorder\'s decision for that candle is shown instead, when there is one)',
  'the indicator values and signal candle the bot itself saw (not kept): only the recorder\'s and the final candles are available, so "recorded live threshold distance" is not shown',
  'recorded-vs-final candle check for the BOT\'s own candles (only the recorder\'s candles are checked)',
  'the exit candle (the state file keeps the exit time, not the candle the decision was made on): exit reason, R and entry price ARE checked',
  'intended price vs fill price, and slippage (the intended price is not kept; the fill price is)',
  'provenance: git commit, code hash, config hash, bot version (not in the state file)',
  'bot starts and downtime (only the first start time, state.json startedAt) and the kill-switch / halt reasons',
  'fees and funding breakdown, and any trade the state file lost if it was ever reset',
];

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

  const recDec = (symbol, sigMs) => (o.shadow && o.shadow.decisions && o.shadow.decisions.get(`${symbol}|${sigMs}`)) || null;
  // evidence for a mismatch: nearest threshold distance from the FINAL candles, and whether the recorded signal candle differs
  const evidence = (symbol, sigMs, entryEv) => {
    const C = o.candles[symbol] || [], idx = C.findIndex((c) => c.time === sigMs / 1000);
    const ind = idx >= 0 ? journal.indicators(C.slice(0, idx + 1).map((c) => c.close), null) : null;
    const rec = entryEv && entryEv.indicators ? entryEv.indicators.nearest_threshold_pct : null;
    return { nearest_threshold_pct: ind ? ind.nearest_threshold_pct : null, live_recorded_threshold_pct: rec ?? null, candle_differs: candleDiffs.some((d) => d.symbol === symbol && d.candle_open_ms === sigMs), recorder: recDec(symbol, sigMs) };
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
      flag('backtest-only', { ...base, ev }, (sk ? `the backtest takes this trade, the bot skipped the signal (${sk.reason}${sk.detail ? ': ' + sk.detail : ''})` : o.source === 'state' ? 'the backtest takes this trade, the bot\'s state file has no such trade (this mode keeps no skip records: skipped signal, bot down and missed candle cannot be told apart)' : 'the backtest takes this trade, the journal has no entry and no skip for it (bot down? candle missing?)') + (ev.recorder ? ' · ' + recText(ev.recorder) : ''), { backtest_R: b.R, backtest_exit_reason: b.why });
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
      if (ex.exit_candle_open_ms != null && ex.exit_candle_open_ms !== b.exitCandleOpenMs) diffs.push(`exit candle: live ${iso(ex.exit_candle_open_ms / 1000)}, backtest ${iso(b.exitCandleOpenMs / 1000)}`);
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

  // the recorder joined to the bot on the shared match key (symbol, side, signal candle open ms): what the engine decided for every candle it watched vs what the bot did
  const recorderJoin = (() => {
    const dec = o.shadow && o.shadow.decisions; if (!dec || !dec.size) return { available: false };
    const inW = [...dec].filter(([k]) => { const [sy, ms] = k.split('|'); return symbols.includes(sy) && inWindow(+ms, sy); });
    const sig = inW.filter(([, d]) => d.signal !== 'none'), botIds = new Set([...live.keys(), ...skipByKey.keys()]);
    const row = (k, d) => { const [sy, ms] = k.split('|'); return { symbol: sy, side: d.signal === 'none' ? null : d.signal, signal_candle_open_ms: +ms, signal_candle: iso(+ms / 1000), snap: d.snap, wake_lag_sec: d.wake_lag_sec }; };
    const recorderOnly = [], sideDisagree = [], journalOnly = [];
    for (const [k, d] of sig) {
      const [sy, ms] = k.split('|'), id = d.trade_id || MK.tradeId(sy, d.signal, +ms / 1000);
      if (botIds.has(id)) continue;
      const other = MK.tradeId(sy, d.signal === 'LONG' ? 'SHORT' : 'LONG', +ms / 1000);
      (botIds.has(other) ? sideDisagree : recorderOnly).push(row(k, d));
    }
    for (const [id] of live) { const m = MK.parseTradeId(id), d = dec.get(`${m.symbol}|${m.signal_candle_open_ms}`); if (d && d.signal === 'none') journalOnly.push(row(`${m.symbol}|${m.signal_candle_open_ms}`, d)); }
    const lags = inW.map(([, d]) => d.wake_lag_sec).filter((v) => v != null).sort((x, y) => x - y);
    return { available: true, candles: inW.length, with_signal: sig.length, joined: sig.length - recorderOnly.length - sideDisagree.length, recorder_only: recorderOnly, side_disagree: sideDisagree, bot_only: journalOnly,
      late_fetches: lags.filter((v) => v > 30).length, median_fetch_lag_sec: lags.length ? lags[Math.floor(lags.length / 2)] : null, max_fetch_lag_sec: lags.length ? lags[lags.length - 1] : null,
      note: o.source === 'state' ? 'recorder_only here may be skipped signals or downtime: this mode has no skip records' : 'recorder_only = the engine signalled, the journal has neither an entry nor a skip for it' };
  })();
  const cannotCheck = [...(o.source === 'state' ? CANNOT_STATE : []), ...(recorderJoin.available ? [] : ['what the engine decided at fetch time, and when the candles were fetched (no shadow recorder data found: see DEPLOY.md section 16)'])];
  const prov = (k) => [...new Set(evs.map((e) => e.provenance && e.provenance[k]).filter(Boolean))];
  const lastMs = Math.max(...Object.values(toSigBySym)) * 1000 + IV * 1000;
  return {
    generated_at: new Date(now * 1000).toISOString(), mode, tolerance_r: tol, strategy: 'lucidio-core DEFAULTS (bb 20/2, sma 200, 4R target, 48-bar time exit), costs as the paper bot, no funding',
    window: { from_ms: fromSig * 1000, to_ms: lastMs, from_iso: iso(fromSig), to_iso: iso(lastMs / 1000), note: 'signal candles from the first journal event to the last finished candle' },
    match: investigation.length === 0,
    counts: { matched, live_only: liveOnly, backtest_only: btOnly, differs: rows.filter((r) => r.status === 'differs').length, skipped_signals: skips.length, candle_diffs: candleDiffs.length, backtest_trades: bt.size, journal_trades: live.size, journal_events: evs.length, bot_starts: sessions },
    trades: rows, investigation, skipped: skippedRows, candle_diffs: candleDiffs,
    provenance: { git_commits: prov('git_commit'), code_hashes: prov('code_hash'), config_hashes: prov('config_hash'), versions: prov('bot_version') },
    warnings, source: o.source || 'journal', cannot_check: cannotCheck, recorder_join: recorderJoin,
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
  L.push(`  source: ${r.source === 'state' ? "the bot's state file (state.json): there is NO journal, so this is the reduced fallback comparison" : 'the bot journal'}`);
  if (r.cannot_check && r.cannot_check.length) { L.push('', `CANNOT CHECK in this mode (${r.cannot_check.length}):`); for (const x of r.cannot_check) L.push(`  - ${x}`); }
  const rj = r.recorder_join;
  if (rj && rj.available) {
    L.push('', `RECORDER vs BOT (joined on symbol + side + signal candle open): ${rj.candles} candles watched, ${rj.with_signal} with a signal, ${rj.joined} also in the bot's records · ${rj.recorder_only.length} recorder-only · ${rj.side_disagree.length} opposite side · ${rj.bot_only.length} bot-only (recorder saw no signal)`);
    L.push(`  fetch lag after the close: median ${rj.median_fetch_lag_sec ?? '?'} s, max ${rj.max_fetch_lag_sec ?? '?'} s, ${rj.late_fetches} fetched later than 30 s (late fetches can flip a decision) · ${rj.note}`);
    for (const x of [...rj.recorder_only.map((y) => ['RECORDER-ONLY', y]), ...rj.side_disagree.map((y) => ['OPPOSITE SIDE', y]), ...rj.bot_only.map((y) => ['BOT-ONLY', y])].slice(0, 30)) L.push(`  - ${x[0]} ${x[1].symbol} ${x[1].side || ''} signal candle ${x[1].signal_candle} (${x[1].snap}, fetched ${x[1].wake_lag_sec ?? '?'} s after the close)`);
  }
  for (const w of r.warnings) L.push(`  WARNING ${w}`);
  if (r.investigation.length) {
    L.push('', `INVESTIGATE (${r.investigation.length}):`);
    for (const i of r.investigation) {
      L.push(`  - ${i.kind.toUpperCase()} ${i.symbol} ${i.side} signal candle ${i.signal_candle}`);
      L.push(`      ${i.why}`);
      if (i.recorder) L.push(`      ${recText(i.recorder)}`);
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
  const jr = a['no-journal'] ? { events: [], bad: 0 } : journal.readAll(jfile);
  let events = jr.events; const bad = jr.bad; let source = 'journal';
  if (!events.length) {   // no journal (an older bot, or nothing written yet): the bot's own state file instead
    const sfile = a.state || path.join(process.env.LUCIDIO_STATE_DIR || path.join(__dirname, 'state'), 'state.json');
    events = eventsFromState(sfile);
    if (events.length) { source = 'state'; console.log(`no journal events in ${jfile}: FALLBACK to the bot state file ${sfile} (reduced comparison: the report lists what it cannot check)`); }
    else { console.error(`compare-live-vs-backtest: no journal events in ${jfile} and no usable state file (${sfile})`); return 2; }
  }
  const mode = a.mode || events[events.length - 1].mode;
  const mine = events.filter((e) => e.mode === mode);
  const first = Math.min(...mine.map((e) => e.ts_ms)) / 1000;
  const fromSec = a.from ? toSec(a.from) : null, toSecArg = a.to ? toSec(a.to) : null;
  const fromSig = fromSec != null ? Math.floor(fromSec / IV) * IV : Math.floor(first / IV) * IV - IV;
  const client = deps.client || require('./mexc.js').createClient();      // no keys: public endpoints only
  const nowS = deps.nowSec ?? Math.floor(Date.now() / 1000);
  const candles = {};
  for (const s of config.ALLOWED_SYMBOLS) candles[s] = await downloadCandles(client, s, fromSig - (S.warmup + 4) * IV, toSecArg ?? nowS, nowS);
  const shadowDirs = a['shadow-dir'] ? [a['shadow-dir']] : [process.env.SHADOW_DIR, '/var/lib/lucidio-shadow', path.join(__dirname, 'shadow'), path.join(__dirname, 'audit', 'shadow')].filter(Boolean).filter((d) => fs.existsSync(d));
  const report = buildReport({ events, source, candles, shadow: readShadow(shadowDirs), tolerance: a.tolerance != null ? +a.tolerance : 0.05, mode, fromSec: fromSec != null ? fromSig : null, toSec: toSecArg, now: nowS });
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

module.exports = { buildReport, renderText, downloadCandles, readShadow, eventsFromState, main };
if (require.main === module) main().then((c) => { process.exitCode = c; }, (e) => { console.error('compare-live-vs-backtest failed: ' + e.message); process.exitCode = 2; });
