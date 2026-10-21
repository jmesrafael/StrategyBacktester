// rr4.js — 1:3 vs 1:4 target, v7 and BB Breakout run separately, year by year, $5 risk per trade. usage: node rr4.js -> results-rr4.md
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js'), F = require('./fam.js');
const APP = path.resolve(__dirname, '../..'), RISK = 5, YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
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
const C4 = ['SOL', 'ZEC', 'BTC', 'XRP', 'DOGE', 'ETH'], TPS = [3, 4, 5];
const G = { 'v7 (15m)': (tp) => Object.fromEntries(C4.map((s) => [s, v7trades(tp)(s)])), 'BB Breakout (4h)': (tp) => Object.fromEntries(C4.map((s) => [s, F.sq(s, BB(tp))])) };
const out = ['# v7 and BB Breakout per coin — yearly then monthly, targets 1:3 / 1:4 / 1:5\n', '$5 risk per trade, 0.04% commission + 0.02% slippage, no funding. Trades counted in the month they open. 2026 is to Oct. Each cell group is 1:3 / 1:4 / 1:5.\n'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], key = (t) => new Date(t * 1000).toISOString().slice(0, 7);
for (const [name, g] of Object.entries(G)) {
  const R = TPS.map((tp) => g(tp)), cell = (c, k) => TPS.map((_, i) => f(L.sum(R[i][c].filter((x) => key(x.t).startsWith(k)).map((x) => x.R)) * RISK)).join(' / ');
  const hdr = '| ' + ['Period', ...C4].join(' | ') + ' |', sep = '|' + '---|'.repeat(5);
  out.push(`## ${name} — by year (1:3 / 1:4 / 1:5)\n`, hdr, sep);
  for (const y of YEARS) out.push(`| ${y} | ${C4.map((c) => cell(c, String(y))).join(' | ')} |`);
  out.push(`| **Total** | ${C4.map((c) => '**' + cell(c, '') + '**').join(' | ')} |`, '', `## ${name} — by month (1:3 / 1:4 / 1:5)\n`, hdr, sep);
  const pos = C4.map(() => [0, 0, 0]);
  for (const y of YEARS) for (let m = 0; m < 12; m++) { if (y === 2026 && m > 9) break; const k = `${y}-${String(m + 1).padStart(2, '0')}`;
    C4.forEach((c, ci) => TPS.forEach((_, i) => { if (L.sum(R[i][c].filter((x) => key(x.t) === k).map((x) => x.R)) > 0) pos[ci][i]++; }));
    out.push(`| ${MON[m]} ${y} | ${C4.map((c) => cell(c, k)).join(' | ')} |`); }
  out.push(`| **Profitable months** | ${pos.map((p) => p.join(' / ')).join(' | ')} |`, '');
}
fs.writeFileSync(__dirname + '/results-rr4-allyears.md', out.join('\n') + '\n'); console.log(out.join('\n'));
