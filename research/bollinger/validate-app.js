// validate-app.js — the app's own Strategy-mode engine (js/strategy.js simulate()) running strategies/bb-breakout-strategy.js,
// against the research engine (lib.js + fam.js) with the frozen settings, trade by trade. usage: node validate-app.js
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js'), F = require('./fam.js');
const APP = path.resolve(__dirname, '../..');
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat,
  window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {};
vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/bb-breakout-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const strat = ctx.window.__STRATEGIES.bbbreakout;
const prm = Object.fromEntries(Object.entries(strat.params).map(([k, d]) => [k, d.default]));
const FROZEN = { tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 3, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const runApp = (bars, comm, slip) => ctx.SM.simulate(strat, prm, bars, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: comm, slippagePct: slip,
  startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } }, null);
let totalApp = 0, totalRes = 0;
for (const sym of ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT']) {
  const bars = L.bars(sym, 240);
  for (const [label, comm, slip] of [['zero costs', 0, 0], ['0.04% + 0.02%', 0.04, 0.02]]) {
    L.COST.comm = comm / 100; L.COST.slip = slip / 100;
    const research = F.sq(sym, FROZEN);
    L.COST.comm = 0.0004; L.COST.slip = 0.0002;
    const app = runApp(bars, comm, slip);
    let bal = 10000; const aR = app.trades.map((t) => { const r = t.usd / (bal * 0.01); bal += t.usd; return { ...t, R: r }; });
    const rBy = new Map(research.map((t) => [t.i0, t])), aBy = new Map(aR.map((t) => [t.entryIndex, t]));
    const both = [...aBy.keys()].filter((k) => rBy.has(k));
    const sameExit = both.filter((k) => rBy.get(k).i1 === aBy.get(k).exitIndex).length;
    const sr = L.sum(research.map((t) => t.R)), sa = L.sum(aR.map((t) => t.R));
    console.log(`${sym} ${label.padEnd(14)} research ${String(research.length).padStart(3)} trades ${L.f2(sr).padStart(7)}R | app ${String(aR.length).padStart(3)} trades ${L.f2(sa).padStart(7)}R | same entry ${both.length}, same exit ${sameExit}`);
    if (comm) { totalApp += sa; totalRes += sr; }
    const onlyR = [...rBy.keys()].filter((k) => !aBy.has(k)), onlyA = [...aBy.keys()].filter((k) => !rBy.has(k));
    if (onlyR.length || onlyA.length) console.log(`     research-only ${onlyR.length} ${onlyR.slice(0, 3).map((k) => new Date(bars[k].time * 1000).toISOString().slice(0, 13))}, app-only ${onlyA.length} ${onlyA.slice(0, 3).map((k) => new Date(bars[k].time * 1000).toISOString().slice(0, 13))}`);
  }
}
console.log(`with costs, 6 coins: research ${L.f2(totalRes)}R vs app ${L.f2(totalApp)}R`);
