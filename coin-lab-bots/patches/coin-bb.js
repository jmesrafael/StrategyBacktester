// coin-bb: BB-CORE 4h (fresh copy of D:\testing\Strat\bb-core) -> BB-CORE COIN LAB paper bot on ARB, dashboard tag cbb.
// Same strategy, risk steps and $100 start as BB-CORE. Paper only (lock), realistic paper costs (realpaper.js, as the 1h lab), no Telegram.
// The paper-lock and realistic-cost edits are the same as news-lab-bots/patches/news-bb.js, WITHOUT the news gate.
// Run inside the copy (build.js does that). Every edit must match exactly, or the build stops.
'use strict';
const { edit } = require('./edit.js');
const { applyLab } = require('./lab.js');

edit('lucidio.js', [
  ["// lucidio.js — Lucid'io — auto-trader for MEXC USDT-M perpetuals. PAPER by default; LIVE when bot-config.json has \"mode\": \"live\".",
   "// lucidio.js (BB-CORE COIN LAB) — BB-CORE 4h on ARB, PAPER ONLY (live is locked off below). Built from bb-core by coin-lab-bots/patches/coin-bb.js.", 1],
  ["const liveAllowed = () => process.argv.includes('--allow-live') || process.env.LUCIDIO_ALLOW_LIVE === '1';",
   'const liveAllowed = () => false; // BB-CORE COIN LAB: real trading is impossible here, whatever the config, flags or environment say', 1],
  ["const ledgerSync = require('./ledger-sync.js');", "const ledgerSync = require('./ledger-sync.js');\nconst { createRealisticPaper } = require('./realpaper.js');", 1],
  ["const entryCosts = (p) => (p.live ? { kind: 'actual',",
   "const entryCosts = (p) => (p.entrySlipSource ? { kind: 'modelled (paper)', entry_fee_pct: (p.fees ? p.fees.taker : COST.entryFee) * 100, entry_slippage_pct: (p.entrySlipFrac ?? COST.slip) * 100, entry_slip_source: p.entrySlipSource, book: p.entryBook ?? null, fee_listed_taker: p.fees ? p.fees.listed_taker : null, contracts: p.vol ?? null, ...(p.degraded ? { degraded: p.degraded } : {}) } : p.live ? { kind: 'actual',", 1],
  ['function exitCosts(p, x) {\n', 'function exitCosts(p, x) {\n  if (x.costs) return x.costs;                                      // the realistic paper executor measured them\n', 1],
  ["const getLive = () => (liveExec = liveExec || createLiveExecutor({ api: mexc.client, cfg: CFG, log: (m) => event('warn', 'MEXC', m) }));",
   "const getLive = () => (liveExec = liveExec || createLiveExecutor({ api: mexc.client, cfg: CFG, log: (m) => event('warn', 'MEXC', m) }));\n" +
   "// the paper executor with real costs (realpaper.js, as the 1h lab): the coin's real fee rate, the order book's real fill, real funding. Used when bot-config.json has \"realisticPaper\": true.\n" +
   "let realPaperExec = null;\n" +
   "const getRealPaper = () => (realPaperExec = realPaperExec || createRealisticPaper({ client: mexc.client, cfgFn: () => CFG, cost: COST, interval: IV, log: (m) => event('warn', 'paper', m) }));", 1],
  ['  let exec = paper;\n', '  let exec = CFG.realisticPaper ? getRealPaper() : paper;\n', 1],
  ["console.log(`Lucid'io check · mode", "console.log(`BB-CORE COIN LAB check · mode", 1],
  ["console.log(`Lucid'io ${CFG.mode.toUpperCase()} bot · coins", "console.log(`BB-CORE COIN LAB ${CFG.mode.toUpperCase()} bot · coins", 1],
]);
edit('config.js', [
  ["  ledgerWalletSync: false,", "  ledgerWalletSync: false,\n  realisticPaper: false,   // true = paper trades cost what they would on MEXC (see realpaper.js)\n  minTakerFee: 0.0002,     // a market order never costs less than this, even where MEXC lists 0%", 1],
]);
edit('mexc.js', [
  ["    depth: (symbol, limit = 200) => get(`/api/v1/contract/depth/${symbol}`, { limit }),",
   "    fundingRate: (symbol) => get(`/api/v1/contract/funding_rate/${symbol}`),\n    fundingHistory: (symbol, pageSize = 60) => get('/api/v1/contract/funding_rate/history', { symbol, page_num: 1, page_size: pageSize }),   // public, used by realpaper.js\n    depth: (symbol, limit = 200) => get(`/api/v1/contract/depth/${symbol}`, { limit }),", 1],
]);
applyLab({
  codeFilesFrom: "'telegram.js', 'journal.js',", codeFilesTo: "'telegram.js', 'realpaper.js', 'journal.js',",
  mk: ["const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: String(id), type, ts_ms: Math.round(tsMs), mode, ...extra, data });",
       "// BB-CORE COIN LAB: tagged bot:'cbb', ids start with \"cbb|\" (the dashboard keeps it apart from every other bot)\nconst mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'cbb|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'cbb', ...extra, data });"],
  coreFrom: "const CORE = 'CORE 1';", coreTo: "const CORE = 'BB COIN LAB';",
  coins: ['ARB'], label: 'BB-CORE COIN LAB',
});
console.log('coin-bb patched');
