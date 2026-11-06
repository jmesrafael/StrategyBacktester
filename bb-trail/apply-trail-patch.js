// apply-trail-patch.js — turns the copied I-Core files into the BB-TRAIL PAPER lab bot. Each edit must match exactly the expected number of times, or it stops.
// Run once on a fresh copy of i-core/ (without .git, state/, journal/, keys). icore-core.js is replaced as a whole file (the bb-trail core), not patched here.
// What changes: the strategy core, a hard paper lock, realistic paper costs (realpaper.js), the dashboard bot tag (bbtr), labels, and extra research data per trade
// (how far each trade went for and against us, how often the stop moved, the indicators with the full-series ATR).
'use strict';
const fs = require('fs'); let total = 0;
const NL = String.fromCharCode(10), CRNL = String.fromCharCode(13, 10);
function edit(file, pairs) { let s = fs.readFileSync(file, 'utf8'); const crlf = s.includes(CRNL); for (let [a, b, want] of pairs) { if (crlf) { a = a.split(CRNL).join(NL).split(NL).join(CRNL); b = b.split(CRNL).join(NL).split(NL).join(CRNL); } const n = s.split(a).length - 1; if (n !== want) throw new Error(`${file}: expected ${want} of ${JSON.stringify(a.slice(0, 90))}, found ${n}`); s = s.split(a).join(b); total += n; } fs.writeFileSync(file, s); }

edit('icore.js', [
  ['// icore.js — I-Core — auto-trader for MEXC USDT-M perpetuals. PAPER by default; LIVE when bot-config.json has "mode": "live".\n// Strategy: Ichimoku cloud-breakout TREND-FOLLOWER with a trailing stop (see icore-core.js).',
   '// icore.js (BB-TRAIL PAPER LAB) — the I-Core bot machinery running the bb-trail P14 strategy, PAPER ONLY (live is locked off below).\n// Strategy: bb-core\'s Bollinger entry, 2 ATR stop, 14 ATR trailing stop, no target (see icore-core.js). Was: Ichimoku cloud-breakout TREND-FOLLOWER (see icore-core.js).', 1],
  ["const liveAllowed = () => process.argv.includes('--allow-live') || process.env.ICORE_ALLOW_LIVE === '1';", 'const liveAllowed = () => false; // BB-TRAIL PAPER LAB: real trading is impossible here, whatever the config, flags or environment say', 1],
  ["const ledgerSync = require('./ledger-sync.js');", "const ledgerSync = require('./ledger-sync.js');\nconst { createRealisticPaper } = require('./realpaper.js');", 1],
  // the full-series ATR goes into the signal and the journal (the 0.3 ATR filter must see the same ATR as the backtest, not one re-seeded on a 400-candle window)
  ['const indAt = (i) => (H ? core.indicators(win(i), S) : null);', 'const indAt = (i) => (H ? core.indicators(win(i), S, atr[i]) : null);', 1],
  ['core.signalAt(win(i), S)', 'core.signalAt(win(i), S, atr[i])', 2],
  // research data per trade: worst price against us (MAE) on every candle held, including the exit candle
  ['    if (st.pos) {\n      const x = await exec.checkExit(st.pos, c);', '    if (st.pos) {\n      st.pos.adv = st.pos.dir === 1 ? Math.min(st.pos.adv ?? st.pos.entry, c.low) : Math.max(st.pos.adv ?? st.pos.entry, c.high);\n      const x = await exec.checkExit(st.pos, c);', 1],
  ['    p.stop = got === true ? ns : got;\n', '    p.stop = got === true ? ns : got;\n    p.trailMoves = (p.trailMoves || 0) + 1;\n', 1],
  ['      balanceAfter: acct.balance, exitSec: tExit, exitCandleOpenSec: exitCandleOpen, holdSec: tExit - p.t0, costs: exitCosts(p, { ...x, exitSec: tExit }) });',
   '      balanceAfter: acct.balance, exitSec: tExit, exitCandleOpenSec: exitCandleOpen, holdSec: tExit - p.t0, costs: exitCosts(p, { ...x, exitSec: tExit }), excursion: excursionOf(p, { ...x, exitSec: tExit }) });', 1],
  ['// cost fields for the journal.', `// research numbers for one closed trade, in R of the INITIAL risk: best price reached (MFE), worst (MAE), where the trail stood, how often it moved, how long it ran
function excursionOf(p, x) {
  const oneR = Math.abs(p.entry - (p.stop0 ?? p.stop)), r = (v) => (v == null || !(oneR > 0) ? null : +(p.dir * (v - p.entry) / oneR).toFixed(4));
  return { mfe_r: r(p.ext ?? p.entry), mae_r: r(p.adv ?? p.entry), stop_at_exit_r: r(p.stop), result_r: x.R != null ? +x.R.toFixed(4) : null, gave_back_r: p.ext != null && x.R != null ? +(r(p.ext) - x.R).toFixed(4) : null,
    trail_moves: p.trailMoves || 0, bars: Math.max(1, Math.round(((x.exitSec ?? p.t0) - p.t0) / IV)), one_r_price: oneR };
}
// cost fields for the journal.`, 1],
  // realistic paper costs: the entry and exit records carry what realpaper.js modelled
  ["const entryCosts = (p) => (p.live ?", "const entryCosts = (p) => (p.fees && !p.live ? { kind: 'modelled (paper)', fee_taker: p.fees.taker, fee_listed_taker: p.fees.listed_taker, entry_slip_source: p.entrySlipSource || null, entry_slip_bp: p.entrySlipFrac != null ? +(p.entrySlipFrac * 1e4).toFixed(3) : null, order_book: p.entryBook || null, contracts: p.vol ?? null, leverage: p.lev ?? null, ...(p.degraded ? { degraded: p.degraded } : {}) } : p.live ?", 1],
  ['function exitCosts(p, x) {\n', 'function exitCosts(p, x) {\n  if (!p.live && x.costs) return x.costs;   // realistic paper: the modelled fees, slippage and real funding of this trade\n', 1],
  ['  let exec = paper;\n', '  let exec = CFG.realisticPaper ? getRealPaper() : paper;\n', 1],
  ["const getLive = () => (liveExec = liveExec || createLiveExecutor({ api: mexc.client, cfg: CFG, log: (m) => event('warn', 'MEXC', m) }));",
   `const getLive = () => (liveExec = liveExec || createLiveExecutor({ api: mexc.client, cfg: CFG, log: (m) => event('warn', 'MEXC', m) }));
// the paper executor with real costs (realpaper.js, the same file as the 1h lab bot): the coin's real fee rate, the order book's real fill, real settled funding,
// whole contracts. Used when bot-config.json has "realisticPaper": true. The trailing stop only changes a number here (no order exists), like the plain paper executor.
let realPaperExec = null;
const getRealPaper = () => {
  if (realPaperExec) return realPaperExec;
  const rp = createRealisticPaper({ client: mexc.client, cfgFn: () => CFG, cost: { ...COST, entryFee: COST.fee, tpFee: COST.fee, tpBuf: 0 }, interval: IV, log: (m) => event('warn', 'paper', m), clock: () => Date.now() });
  return (realPaperExec = { enter: (coin, o) => { config.assertAllowedSymbol(config.coinToSymbol(coin), 'paper entry'); return rp.enter(coin, { ...o, tp: null }); }, checkExit: (pos, c) => rp.checkExit(pos, c), timeExit: (pos, c) => rp.timeExit(pos, c.close), async moveStop(pos, ns) { return ns; } });
};`, 1],
  ['tg.send(raw ? text : `I-Core ${CFG.mode.toUpperCase()}: ${text}`, opt)', 'tg.send(raw ? text : `BB-Trail ${CFG.mode.toUpperCase()}: ${text}`, opt)', 1],
  ['console.log(`I-Core check · mode', 'console.log(`BB-Trail PAPER LAB check · mode', 1],
  ['console.log(`I-Core ${CFG.mode.toUpperCase()} mode`);', 'console.log(`BB-Trail ${CFG.mode.toUpperCase()} mode`);', 1],
  ['console.log(`I-Core ${CFG.mode.toUpperCase()} bot · coins', 'console.log(`BB-Trail ${CFG.mode.toUpperCase()} LAB bot · coins', 1],
  ['module.exports = { vsStart, processCoin, paper, CFG,', 'module.exports = { getRealPaper: () => getRealPaper(), vsStart, processCoin, paper, CFG,', 1],
]);

edit('journal.js', [
  ['    costs: i.costs,\n  };\n}\nfunction skipEvent', '    costs: i.costs,\n    excursion: i.excursion ?? null,\n  };\n}\nfunction skipEvent', 1],
  ["const CODE_FILES = ['icore.js', 'icore-core.js', 'live.js',", "const CODE_FILES = ['icore.js', 'icore-core.js', 'realpaper.js', 'live.js',", 1],
]);

edit('mexc.js', [
  ["    depth: (symbol, limit = 200) => get(`/api/v1/contract/depth/${symbol}`, { limit }),",
   "    depth: (symbol, limit = 200) => get(`/api/v1/contract/depth/${symbol}`, { limit }),\n    fundingHistory: (symbol, pageSize = 60) => get('/api/v1/contract/funding_rate/history', { symbol, page_num: 1, page_size: pageSize }),   // { resultList: [{ fundingRate, settleTime }] } (public)", 1],
]);

edit('dashboard-push.js', [
  ["const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'ic|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'icore', ...extra, data });",
   "// BB-TRAIL lab: tagged bot:'bbtr', ids start with \"bbtr|\" (the dashboard keeps it apart from BB-Core, I-Core and the 1h lab)\nconst mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'bbtr|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'bbtr', ...extra, data });", 1],
]);

// the dashboard gets the trend-capture numbers of every closed trade, and each open trade's CURRENT trailing stop with every heartbeat
edit('dashboard-push.js', [
  ['fees_r: numOrNull(c.fees_r) };\n', `fees_r: numOrNull(c.fees_r) };
    const xc = rec.excursion || {};   // BB-Trail lab: best / worst price, give-back, stop at exit (R of the initial risk), stop moves, candles, real funding and slippage
    Object.assign(data, { mfe_r: numOrNull(xc.mfe_r), mae_r: numOrNull(xc.mae_r), gave_back_r: numOrNull(xc.gave_back_r), stop_at_exit_r: numOrNull(xc.stop_at_exit_r), trail_moves: numOrNull(xc.trail_moves), bars: numOrNull(xc.bars),
      funding_r: numOrNull(c.funding_r), slip_bp: c.slippage_pct != null ? numOrNull(c.slippage_pct * 100) : null });
`, 1],
  ['prices, enabled_coins: i.coins || [],\n', 'prices, enabled_coins: i.coins || [], ...(i.trail && Object.keys(i.trail).length ? { trail: i.trail } : {}),\n', 1],
]);
edit('icore.js', [
  ['function pushStatus(state) {', `// open trades with their CURRENT trailing stop, for the dashboard heartbeat: { SOL_USDT: { entry, stop0, stop, best, locked_r, best_r, moves } } (numbers only)
function trailOf(state) {
  const out = {}, r4 = (v) => (Number.isFinite(v) ? +v.toPrecision(8) : null);
  for (const [coin, c] of Object.entries(state.coins || {})) {
    const p = c.pos; if (!p) continue;
    const oneR = Math.abs(p.entry - (p.stop0 ?? p.stop));
    out[config.coinToSymbol(coin)] = { entry: r4(p.entry), stop0: r4(p.stop0 ?? p.stop), stop: r4(p.stop), best: r4(p.ext ?? p.entry), locked_r: oneR > 0 ? r4(p.dir * (p.stop - p.entry) / oneR) : null, best_r: oneR > 0 ? r4(p.dir * ((p.ext ?? p.entry) - p.entry) / oneR) : null, moves: p.trailMoves || 0 };
  }
  return out;
}
function pushStatus(state) {`, 1],
  ['nextWakeMs: state.nextWakeAt ? Date.parse(state.nextWakeAt) : null, coins: CFG.coins.map(config.coinToSymbol) };', 'nextWakeMs: state.nextWakeAt ? Date.parse(state.nextWakeAt) : null, coins: CFG.coins.map(config.coinToSymbol), trail: trailOf(state) };', 1],
]);

edit('telegram.js', [["const CORE = 'CORE 2';", "const CORE = 'TRAIL LAB';", 1]]);

edit('compare-live-vs-backtest.js', [['L.push(`I-Core live (${r.mode}) vs backtest', 'L.push(`BB-Trail lab (${r.mode}) vs backtest', 1]]);

console.log('patched', total, 'places');
