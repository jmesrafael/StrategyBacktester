// news-ic: I-CORE (fresh copy of D:\testing\Strat\i-core) -> I-CORE NEWS LAB paper bot, dashboard tag icn.
// I-CORE's own strategy (icore-core.js untouched), risk steps and $100 start. Paper lock + realistic paper costs exactly as bb-trail's patch does them, no Telegram, plus the news gate.
'use strict';
const fs = require('fs');
const { edit } = require('./edit.js');
const { applyGate } = require('./gate.js');

edit('icore.js', [
  ['// icore.js — I-Core — auto-trader for MEXC USDT-M perpetuals. PAPER by default; LIVE when bot-config.json has "mode": "live".',
   '// icore.js (I-CORE NEWS LAB) — I-CORE with the NEWS GATE, PAPER ONLY (live is locked off below). Built from i-core by news-lab-bots/patches/news-ic.js.', 1],
  ["const liveAllowed = () => process.argv.includes('--allow-live') || process.env.ICORE_ALLOW_LIVE === '1';",
   'const liveAllowed = () => false; // I-CORE NEWS LAB: real trading is impossible here, whatever the config, flags or environment say', 1],
  ["const ledgerSync = require('./ledger-sync.js');", "const ledgerSync = require('./ledger-sync.js');\nconst { createRealisticPaper } = require('./realpaper.js');", 1],
  ["const entryCosts = (p) => (p.live ?", "const entryCosts = (p) => (p.fees && !p.live ? { kind: 'modelled (paper)', fee_taker: p.fees.taker, fee_listed_taker: p.fees.listed_taker, entry_slip_source: p.entrySlipSource || null, entry_slip_bp: p.entrySlipFrac != null ? +(p.entrySlipFrac * 1e4).toFixed(3) : null, order_book: p.entryBook || null, contracts: p.vol ?? null, leverage: p.lev ?? null, ...(p.degraded ? { degraded: p.degraded } : {}) } : p.live ?", 1],
  ['function exitCosts(p, x) {\n', 'function exitCosts(p, x) {\n  if (!p.live && x.costs) return x.costs;   // realistic paper: the modelled fees, slippage and real funding of this trade\n', 1],
  ['  let exec = paper;\n', '  let exec = CFG.realisticPaper ? getRealPaper() : paper;\n', 1],
  ["const getLive = () => (liveExec = liveExec || createLiveExecutor({ api: mexc.client, cfg: CFG, log: (m) => event('warn', 'MEXC', m) }));",
   `const getLive = () => (liveExec = liveExec || createLiveExecutor({ api: mexc.client, cfg: CFG, log: (m) => event('warn', 'MEXC', m) }));
// the paper executor with real costs (realpaper.js, the same file as the T-CORE and 1h labs). The trailing stop only changes a number here (no order exists).
let realPaperExec = null;
const getRealPaper = () => {
  if (realPaperExec) return realPaperExec;
  const rp = createRealisticPaper({ client: mexc.client, cfgFn: () => CFG, cost: { ...COST, entryFee: COST.fee, tpFee: COST.fee, tpBuf: 0 }, interval: IV, log: (m) => event('warn', 'paper', m), clock: () => Date.now() });
  return (realPaperExec = { enter: (coin, o) => { config.assertAllowedSymbol(config.coinToSymbol(coin), 'paper entry'); return rp.enter(coin, o); }, checkExit: (pos, c) => rp.checkExit(pos, c), timeExit: (pos, c) => rp.timeExit(pos, c.close), async moveStop(pos, ns) { return ns; } });
};`, 1],
  ['console.log(`I-Core check · mode', 'console.log(`I-CORE NEWS LAB check · mode', 1],
  ['console.log(`I-Core ${CFG.mode.toUpperCase()} bot · coins', 'console.log(`I-CORE NEWS LAB ${CFG.mode.toUpperCase()} bot · coins', 1],
]);

edit('mexc.js', [
  ["    depth: (symbol, limit = 200) => get(`/api/v1/contract/depth/${symbol}`, { limit }),",
   "    depth: (symbol, limit = 200) => get(`/api/v1/contract/depth/${symbol}`, { limit }),\n    fundingHistory: (symbol, pageSize = 60) => get('/api/v1/contract/funding_rate/history', { symbol, page_num: 1, page_size: pageSize }),   // public, used by realpaper.js", 1],
]);

applyGate({
  main: 'icore.js',
  codeFilesFrom: "'icore-core.js', 'live.js',", codeFilesTo: "'icore-core.js', 'realpaper.js', 'newsgate.js', 'live.js',",
  mk: ["const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'ic|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'icore', ...extra, data });",
       "// I-CORE NEWS LAB: tagged bot:'icn', ids start with \"icn|\" (the dashboard keeps it apart from every other bot)\nconst mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'icn|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'icn', ...extra, data });"],
  coreFrom: "const CORE = 'CORE 2';", coreTo: "const CORE = 'IC NEWS LAB';",
});

const cfg = JSON.parse(fs.readFileSync('bot-config.json', 'utf8'));
Object.assign(cfg, { mode: 'paper', startBalance: 100, realisticPaper: true, heartbeatUrl: '' });
fs.writeFileSync('bot-config.json', JSON.stringify(cfg, null, 2) + '\n');
if (fs.existsSync('package.json')) { const p = JSON.parse(fs.readFileSync('package.json', 'utf8')); p.name = 'i-core-news-lab'; p.description = 'I-CORE NEWS LAB: I-Core with the news gate, paper only, no Telegram. Built by news-lab-bots/patches/news-ic.js.'; fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n'); }
console.log('news-ic patched');
