// validate-app.js — run the app's own Strategy-mode engine (js/strategy.js simulate()) headless with
// strategies/ny-smc-v7-strategy.js, and compare it with the research engine (ie.js v7) on the same candles.
// usage: node validate-app.js
const fs = require('fs'), vm = require('vm'), path = require('path'), E = require('./ie.js');
const APP = path.resolve(__dirname, '../..');
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat,
  window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {};
vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/ny-smc-v7-strategy.js'])
  vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const strat = ctx.window.__STRATEGIES.nysmcv7;
const prm = Object.fromEntries(Object.entries(strat.params).map(([k, d]) => [k, d.default]));

const S2 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5 };
const V7 = { ...S2, tpMode: 'R', tpR: 3, minDispATR: 1, minFvgATR: 0.2,
  chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5, maxStopATR: 4, maxFillBars: 8 };

const runApp = (bars, comm, slip) => ctx.SM.simulate(strat, prm, bars, {
  fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: comm, slippagePct: slip, startBalance: 10000,
  sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 1000, session: { enabled: false } }, null);
const rOf = (t) => { // R of an app trade = pnl / amount risked (1% of the balance before the trade)
  return t.usd / (t.balBefore * 0.01); };

for (const sym of ['SOL', 'ETH']) {
  const raw = E.load(sym);
  const bars = raw.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
  const research = E.runSym(sym, { ...V7, costMult: 0, stopSlip: 0 }).trades;
  const app = runApp(bars, 0, 0);
  let bal = 10000; for (const t of app.trades) { t.balBefore = bal; bal += t.usd; }
  // match trades by entry candle
  const rByIdx = new Map(research.map((t) => [t.fillIdx, t]));
  const aByIdx = new Map(app.trades.map((t) => [t.entryIndex, t]));
  const both = [...aByIdx.keys()].filter((k) => rByIdx.has(k));
  const sameExit = both.filter((k) => rByIdx.get(k).exitIdx === aByIdx.get(k).exitIndex).length;
  const sumR = (a) => a.reduce((x, y) => x + y, 0);
  console.log(`${sym}: research ${research.length} trades, ${sumR(research.map((t) => t.R)).toFixed(1)}R | ` +
    `app ${app.trades.length} trades, ${sumR(app.trades.map(rOf)).toFixed(1)}R | same entry candle ${both.length}, same exit candle ${sameExit}`);
  const onlyR = [...rByIdx.keys()].filter((k) => !aByIdx.has(k)), onlyA = [...aByIdx.keys()].filter((k) => !rByIdx.has(k));
  if (onlyR.length || onlyA.length) console.log(`   research-only entries: ${onlyR.length}, app-only entries: ${onlyA.length}`,
    onlyR.slice(0, 4).map((k) => new Date(bars[k].time * 1000).toISOString().slice(0, 16)), onlyA.slice(0, 4).map((k) => new Date(bars[k].time * 1000).toISOString().slice(0, 16)));
  // with realistic app costs (single commission rate both sides + slippage on exits)
  const real = runApp(bars, 0.04, 0.02);
  console.log(`   app with 0.04% commission + 0.02% slippage: ${real.stats.totalTrades} trades, net ${real.stats.netPct.toFixed(1)}%, PF ${real.stats.profitFactor.toFixed(2)}, win ${real.stats.winRate.toFixed(0)}%, max DD ${real.stats.maxDrawdown.toFixed(1)}%`);
}
