// validate-bbx.js — the 🎯 BB Breakout indicator (js/bbx.js scan) vs the app's BB Breakout backtest, trade by trade, plus a
// no-look-ahead check: on any cut, the indicator's history must match the full run and its "new setup" must be the trade the
// full run enters on the next candle. usage: node validate-bbx.js
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js');
const APP = path.resolve(__dirname, '../..');
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat, window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {}; vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/bb-breakout-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/bbx.js'), 'utf8') + '\n;this.BBX = BBXIndicator;', ctx);
const strat = ctx.window.__STRATEGIES.bbbreakout, prm = Object.fromEntries(Object.entries(strat.params).map(([k, d]) => [k, d.default]));
const P = ctx.BBX.getDefaults();
let bad = 0;
for (const sym of ['SOL', 'DOGE', 'ZEC', 'MEXC_SOL', 'MEXC_DOGE', 'MEXC_ZEC']) {
  const B = L.bars(sym, 240);
  const app = ctx.SM.simulate(strat, prm, B, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0, slippagePct: 0, startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } }, null);
  const r = ctx.BBX.scan(B, P);
  const appT = app.trades.filter((t, i) => !(i === app.trades.length - 1 && app.signals[app.signals.length - 1].reason === 'Session end'));
  const appOpen = appT.length < app.trades.length ? app.trades[app.trades.length - 1] : null;
  const same = r.trades.length === appT.length && r.trades.every((t, i) => t.i0 === appT[i].entryIndex && t.i1 === appT[i].exitIndex);
  const openSame = (!appOpen && !r.open) || (appOpen && r.open && appOpen.entryIndex === r.open.i0);
  // look-ahead: 200 random cuts
  let cutBad = 0;
  for (let k = 0, seed = 99; k < 200; k++) {
    seed = (seed * 16807) % 2147483647; const cut = 300 + Math.floor((seed / 2147483647) * (B.length - 310));
    const p = ctx.BBX.scan(B.slice(0, cut + 1), P);
    const fullBefore = r.trades.filter((t) => t.i1 <= cut);
    if (p.trades.length !== fullBefore.length || p.trades.some((t, i) => t.i0 !== fullBefore[i].i0 || t.i1 !== fullBefore[i].i1)) cutBad++;
    const nextEntry = r.trades.concat(r.open ? [r.open] : []).find((t) => t.i0 === cut + 1);
    if (!!p.setup !== !!nextEntry || (p.setup && p.setup.dir !== nextEntry.dir)) cutBad++;
  }
  if (!same || !openSame || cutBad) bad++;
  console.log(`${(same && openSame && !cutBad) ? 'OK  ' : 'DIFF'} ${sym.padEnd(10)} app ${appT.length} closed trades${appOpen ? ' + 1 open' : ''} | indicator ${r.trades.length}${r.open ? ' + 1 open' : ''} | same trades: ${same} | same open trade: ${openSame} | look-ahead cuts with a mismatch: ${cutBad}/200`);
}
console.log(bad ? `\n${bad} differ` : '\nindicator == backtest on every coin; no look-ahead');
