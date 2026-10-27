// stats-three.js — the solid comparison: bb-core vs EMA 20/100 vs merged, 5 coins pooled. node stats-three.js [binance|mexc]
'use strict';
const { runMerged } = require('./merged.js'); const { summarize, DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const V = process.argv[2] || 'binance', f2 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2), f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1), pc = (v, d = 0) => (v * 100).toFixed(d) + '%';
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SPLIT = Date.UTC(2023, 0, 1) / 1000, S = [['bb', 'bb-core'], ['ema', 'EMA 20/100'], ['two', 'Merged']];
const T = Object.fromEntries(S.map(([m]) => [m, COINS.flatMap((c) => { const D = loadCoin(c, V); return runMerged(D.B, m, DEFAULTS.cost, D.funding).trades.map((t) => ({ ...t, coin: c })); })]));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length, sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const mk = (t) => new Date(t.tExit * 1000).toISOString().slice(0, 7), yr = (t) => new Date(t.tExit * 1000).getUTCFullYear();
const grp = (t, f) => { const o = {}; for (const x of t) o[f(x)] = (o[f(x)] || 0) + x.R; return o; };
const years = (Math.max(...T.two.map((t) => t.tExit)) - Math.min(...T.two.map((t) => t.t))) / 31557600;
const out = {};
for (const [m] of S) {
  const t = T[m], rs = t.map((x) => x.R), n = rs.length, w = rs.filter((r) => r > 0), l = rs.filter((r) => r <= 0), E = mean(rs), s = sd(rs), r = rng(7), bs = [];
  for (let b = 0; b < 4000; b++) { let q = 0; for (let i = 0; i < n; i++) q += rs[Math.floor(r() * n)]; bs.push(q / n); } bs.sort((a, b) => a - b);
  const mo = grp(t, mk), mv = Object.values(mo), yv = Object.values(grp(t, yr)), ordered = [...t].sort((a, b) => a.tExit - b.tExit);
  let streak = 0, best = 0; for (const x of ordered) { streak = x.R <= 0 ? streak + 1 : 0; best = Math.max(best, streak); }
  const mb = []; for (let b = 0; b < 4000; b++) { let q = 0; for (let i = 0; i < mv.length; i++) q += mv[Math.floor(r() * mv.length)]; mb.push(q / mv.length); } mb.sort((a, b) => a - b);
  const e1 = mean(t.filter((x) => x.t < SPLIT).map((x) => x.R)), e2 = mean(t.filter((x) => x.t >= SPLIT).map((x) => x.R)), sm = summarize(t);
  const pl = 1 - w.length / n; let hit10 = 0; for (let k = 0; k < 20000; k++) { let run = 0; for (let i = 0; i < 100; i++) { if (r() < pl) { run++; if (run >= 10) { hit10++; break; } } else run = 0; } }
  out[m] = { n, perYr: n / years, win: w.length / n, avgW: mean(w), avgL: -mean(l), E, lo: bs[100], hi: bs[3899], tstat: E / (s / Math.sqrt(n)), pPos: bs.filter((x) => x > 0).length / 4000, pf: w.reduce((a, b) => a + b, 0) / -l.reduce((a, b) => a + b, 0), total: sm.R, dd: sm.dd, rdd: sm.R / sm.dd,
    beWin: 1 / (1 + mean(w) / -mean(l)), mpos: mv.filter((v) => v > 0).length / mv.length, mavg: mean(mv), mworst: Math.min(...mv), ypos: yv.filter((v) => v > 0).length, ny: yv.length, yavg: mean(yv), streak: best, hit10, e1, e2, pMonthPos: mb.filter((x) => x > 0).length / 4000, sharpeM: mean(mv) / sd(mv), mlo: mb[100], mhi: mb[3899] };
}
const rows = [
  ['Trades (7 yrs)', (o) => o.n], ['Trades per year', (o) => o.perYr.toFixed(0)], ['**Win rate**', (o) => pc(o.win, 1)], ['Break-even win rate needed', (o) => pc(o.beWin, 1)],
  ['Average win', (o) => f2(o.avgW) + 'R'], ['Average loss', (o) => '−' + o.avgL.toFixed(2) + 'R'], ['Payoff (avg win ÷ avg loss)', (o) => (o.avgW / o.avgL).toFixed(2)],
  ['**Expectancy per trade**', (o) => '**' + f2(o.E) + 'R**'], ['95% range of expectancy', (o) => f2(o.lo) + ' to ' + f2(o.hi)], ['t-stat (≥2 is solid)', (o) => o.tstat.toFixed(1)], ['Chance true expectancy > 0', (o) => pc(o.pPos, 1)],
  ['Profit factor (gross win ÷ gross loss)', (o) => o.pf.toFixed(2)], ['Expectancy 2020–22 trades', (o) => f2(o.e1) + 'R'], ['Expectancy 2023+ trades', (o) => f2(o.e2) + 'R'],
  ['**Total R (7 yrs)**', (o) => f1(o.total) + 'R'], ['Average R per year', (o) => f1(o.yavg) + 'R'], ['Max drawdown', (o) => o.dd.toFixed(1) + 'R'], ['Total R ÷ drawdown', (o) => o.rdd.toFixed(1)],
  ['Years positive', (o) => o.ypos + '/' + o.ny], ['Months positive', (o) => pc(o.mpos)], ['Average month', (o) => f1(o.mavg) + 'R'], ['Worst month', (o) => f1(o.mworst) + 'R'],
  ['Chance a month is positive (resampled)', (o) => pc(o.pMonthPos)], ['Monthly "Sharpe" (avg ÷ spread)', (o) => o.sharpeM.toFixed(2)], ['Longest losing streak (trades, pooled)', (o) => o.streak], ['Chance of 10 losers in a row within 100 trades', (o) => pc(o.hit10 / 20000)]];
console.log(`# bb-core vs EMA 20/100 vs Merged — the numbers (${V.toUpperCase()} candles, 5 coins pooled, fees + slippage + funding)\n`);
console.log('| | bb-core | EMA 20/100 | Merged |'); console.log('|---|---|---|---|');
for (const [l, f] of rows) console.log(`| ${l} | ${out.bb ? f(out.bb) : ''} | ${f(out.ema)} | ${f(out.two)} |`);
