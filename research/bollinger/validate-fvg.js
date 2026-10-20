// validate-fvg.js — the app's Strategy-mode engine (js/strategy.js simulate()) running strategies/fvg-pullback-strategy.js against the
// research engine (lib.js + fvg.js) with the frozen settings, trade by trade, for all three entry modes. usage: node validate-fvg.js
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js'), { fvgpb } = require('./fvg.js');
const APP = path.resolve(__dirname, '../..');
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat,
  window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {};
vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/fvg-pullback-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const strat = ctx.window.__STRATEGIES.fvgpullback;
const def = Object.fromEntries(Object.entries(strat.params).map(([k, d]) => [k, d.default]));
const FROZEN = { minGap: 0.5, disp: 0, depth: 0, stop: 'origin', tp: 3, expire: 20, trend: 'htf', maxHold: 0 };
const MODES = { pullback: 'Pullback (limit)', confirm: 'Pullback + confirmation (market)', direct: 'Direct (market)' };
const runApp = (bars, prm) => ctx.SM.simulate(strat, prm, bars, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0.04, slippagePct: 0.02,
  startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } }, null);
let bad = 0;
for (const [sym, tf] of [['SOL', 240], ['ZEC', 240], ['DOGE', 240], ['SOL', 60], ['ZEC', 60], ['DOGE', 60], ['DOGE', 15]]) {
  const bars = L.bars(sym, tf);
  for (const [mode, label] of Object.entries(MODES)) {
    const research = fvgpb(sym, { ...FROZEN, tf, direct: mode === 'direct', confirm: mode === 'confirm' });
    const app = runApp(bars, { ...def, entry: label });
    let bal = 10000; const aR = app.trades.map((t) => { const r = t.usd / (bal * 0.01); bal += t.usd; return { ...t, R: r }; });
    const rBy = new Map(research.map((t) => [t.i0, t])), aBy = new Map(aR.map((t) => [t.entryIndex, t]));
    const both = [...aBy.keys()].filter((k) => rBy.has(k)), sameExit = both.filter((k) => rBy.get(k).i1 === aBy.get(k).exitIndex).length;
    const sr = L.sum(research.map((t) => t.R)), sa = L.sum(aR.map((t) => t.R));
    const ok = research.length === aR.length && both.length === research.length && sameExit === both.length && Math.abs(sr - sa) < 0.05;
    if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'DIFF'} ${sym} ${String(tf).padStart(3)}m ${mode.padEnd(8)} research ${String(research.length).padStart(4)} ${L.f2(sr).padStart(8)}R | app ${String(aR.length).padStart(4)} ${L.f2(sa).padStart(8)}R | same entry ${both.length}, same exit ${sameExit}`);
    if (!ok) {
      const onlyR = [...rBy.keys()].filter((k) => !aBy.has(k)), onlyA = [...aBy.keys()].filter((k) => !rBy.has(k));
      console.log(`     research-only ${onlyR.length} ${onlyR.slice(0, 3).map((k) => new Date(bars[k].time * 1000).toISOString().slice(0, 13))}, app-only ${onlyA.length} ${onlyA.slice(0, 3).map((k) => new Date(bars[k].time * 1000).toISOString().slice(0, 13))}`);
    }
  }
}
console.log(bad ? `\n${bad} combinations differ` : '\nall combinations identical');
