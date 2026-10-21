// rr4.js — 1:3 vs 1:4 target, v7 and BB Breakout run separately, year by year, $5 risk per trade. usage: node rr4.js -> results-rr4.md
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js'), F = require('./fam.js');
const APP = path.resolve(__dirname, '../..'), RISK = 5, YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat, window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {}; vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/ny-smc-v7-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const v7 = ctx.window.__STRATEGIES.nysmcv7, v7p = Object.fromEntries(Object.entries(v7.params).map(([k, d]) => [k, d.default]));
const v7trades = (tp) => (sym) => { const bars = L.bars(sym, 15); const r = ctx.SM.simulate(v7, { ...v7p, targetR: tp }, bars, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0.04, slippagePct: 0.02,
  startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } }, null);
  let bal = 10000; return r.trades.map((t) => { const R = t.usd / (bal * 0.01); bal += t.usd; return { t: bars[t.entryIndex].time, R }; }); };
const BB = (tp) => ({ tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 });
const f = (v) => v == null ? '·' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(0);
const dd = (tr) => { let c = 0, pk = 0, d = 0; for (const x of tr.slice().sort((a, b) => a.t - b.t)) { c += x.R; pk = Math.max(pk, c); d = Math.max(d, pk - c); } return d * RISK; };
const C4 = ['SOL', 'ETH', 'DOGE', 'ZEC'], TPS = [3, 4, 5];
const G = { 'v7 (15m)': (tp) => Object.fromEntries(C4.map((s) => [s, v7trades(tp)(s)])), 'BB Breakout (4h)': (tp) => Object.fromEntries(C4.map((s) => [s, F.sq(s, BB(tp))])) };
const out = ['# v7 and BB Breakout — yearly then monthly, targets 1:3 / 1:4 / 1:5\n', 'All four coins (SOL, ETH, DOGE, ZEC) combined, $5 risk per trade, 0.04% commission + 0.02% slippage, no funding. Trades counted in the month they open. 2026 is to Oct.\n'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
for (const [name, g] of Object.entries(G)) {
  const R = TPS.map((tp) => Object.values(g(tp)).flat());
  const key = (t) => new Date(t * 1000).toISOString().slice(0, 7);
  out.push(`## ${name} — by year\n`, '| Year | 1:3 | 1:4 | 1:5 |', '|---|---|---|---|');
  for (const y of YEARS) out.push(`| ${y} | ${R.map((a) => f(L.sum(a.filter((x) => key(x.t).startsWith(y)).map((x) => x.R)) * RISK)).join(' | ')} |`);
  out.push(`| **Total** | ${R.map((a) => '**' + f(L.sum(a.map((x) => x.R)) * RISK) + '**').join(' | ')} |`, '', `## ${name} — by month\n`, '| Month | 1:3 | 1:4 | 1:5 |', '|---|---|---|---|');
  const run = [0, 0, 0], pos = [0, 0, 0]; let nm = 0;
  for (const y of YEARS) for (let m = 0; m < 12; m++) { const k = `${y}-${String(m + 1).padStart(2, '0')}`; if (y === 2026 && m > 9) break;
    const v = R.map((a) => L.sum(a.filter((x) => key(x.t) === k).map((x) => x.R)) * RISK); nm++; v.forEach((x, i) => { run[i] += x; if (x > 0) pos[i]++; });
    out.push(`| ${MON[m]} ${y} | ${v.map(f).join(' | ')} |`); }
  out.push(`| **Profitable months** | ${pos.map((p) => `${p} of ${nm}`).join(' | ')} |`, '');
}
fs.writeFileSync(__dirname + '/results-rr4-monthly.md', out.join('\n') + '\n'); console.log(out.join('\n'));
