// validate-app-bb.js — the app's Strategy-mode engine (js/strategy.js) with ny-smc-v7-strategy.js in both risk modes,
// against the research engine on Binance 15m (zero costs, trade-by-trade). Research "less risk" = A11 (leg beyond Bollinger 20,2).
// usage: node validate-app-bb.js
const fs = require('fs'), vm = require('vm'), path = require('path'), E = require('./ie.js'), T = require('./trades-windows.js');
const APP = path.resolve(__dirname, '../..');
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat,
  window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {};
vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/ny-smc-v7-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const strat = ctx.window.__STRATEGIES.nysmcv7, def = Object.fromEntries(Object.entries(strat.params).map(([k, d]) => [k, d.default]));
const C = { ...T.C, costMult: 0, stopSlip: 0 };
for (const sym of ['SOL', 'ETH']) {
  const raw = JSON.parse(fs.readFileSync(`data/binance-${sym.toLowerCase()}15.json`, 'utf8'));
  const bars = raw.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
  const D = E.analyze(sym + '-binance', raw, C.swingLen), S = E.setupsFor(D, C);
  const bb = (function () { const c = D.B.map((b) => b.close), n = 20, k = 2, o = []; for (let i = 0; i < c.length; i++) { if (i < n - 1) { o.push(null); continue; } let m = 0; for (let j = i - n + 1; j <= i; j++) m += c[j]; m /= n; let v = 0; for (let j = i - n + 1; j <= i; j++) v += (c[j] - m) ** 2; const sd = Math.sqrt(v / n); o.push({ lo: m - k * sd, up: m + k * sd }); } return o; })();
  for (const mode of ['Standard', 'Less risk (Bollinger stretch)']) {
    const set = mode === 'Standard' ? S : S.filter((s) => { const b = bb[s.legXi]; return b && (s.long ? D.B[s.legXi].low < b.lo : D.B[s.legXi].high > b.up); });
    const research = E.execute(D, C, set);
    const app = ctx.SM.simulate(strat, { ...def, riskMode: mode }, bars, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0, slippagePct: 0, startBalance: 10000,
      sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 1000, session: { enabled: false } }, null);
    const r = new Map(research.map((t) => [t.fillIdx, t])), a = new Map(app.trades.map((t) => [t.entryIndex, t]));
    const both = [...a.keys()].filter((k) => r.has(k)), sameExit = both.filter((k) => r.get(k).exitIdx === a.get(k).exitIndex).length;
    const onlyA = [...a.keys()].filter((k) => !r.has(k)), onlyR = [...r.keys()].filter((k) => !a.has(k));
    console.log(`${sym} ${mode.padEnd(30)} research ${research.length} | app ${app.trades.length} | same entry ${both.length}, same exit ${sameExit} | app-only ${onlyA.length}, research-only ${onlyR.length}`);
  }
}
