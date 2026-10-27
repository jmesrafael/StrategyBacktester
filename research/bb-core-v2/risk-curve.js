// risk-curve.js — how does growth change as the risk per trade goes up? (uncapped, compounding, fresh start every 1 Jan, open trades valued at year end)
//   Also the Kelly fraction: the risk % that maximises average log growth per trade. node risk-curve.js [bb|ema] [binance|mexc]
'use strict';
const { runMerged } = require('./merged.js'); const { DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const M = process.argv[2] || 'bb', V = process.argv[3] || 'binance', D = Object.fromEntries(COINS.map((c) => [c, loadCoin(c, V)]));
const all = COINS.flatMap((c) => runMerged(D[c].B, M, DEFAULTS.cost, D[c].funding).trades.map((t) => ({ ...t, coin: c })));
function year(Y, pct) {
  const t0 = Date.UTC(Y, 0, 1) / 1000, t1 = Date.UTC(Y + 1, 0, 1) / 1000, c = DEFAULTS.cost;
  const T = all.filter((t) => t.t >= t0 && t.t < t1).map((t) => { if (t.tExit < t1) return t; const B = D[t.coin].B, k = B.findIndex((b) => b.time + 14400 > t1) - 1, px = B[k].close; return { ...t, tExit: t1, R: (t.dir * (px - t.entry) / t.entry - c.entryFee - c.timeFee) / t.dist }; });
  const ev = []; T.forEach((t, k) => ev.push({ time: t.t, kind: 1, k }, { time: t.tExit, kind: 0, k })); ev.sort((a, b) => a.time - b.time || a.kind - b.kind);
  let bal = 1, peak = 1, dd = 0, minb = 1; const risked = {};
  for (const e of ev) { if (e.kind === 1) risked[e.k] = bal * pct; else { bal = Math.max(0, bal + T[e.k].R * risked[e.k]); peak = Math.max(peak, bal); minb = Math.min(minb, bal); dd = Math.max(dd, (peak - bal) / peak); } }
  return { m: bal, dd, minb };
}
const YRS = [2020, 2021, 2022, 2023, 2024, 2025, 2026], LEVELS = [0.5, 1, 1.25, 1.5, 2, 2.5, 3.5, 5, 7.5, 10, 15, 20];
const x = (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(2)) + '×';
console.log(`# Growth vs risk per trade — ${M === 'bb' ? 'bb-core' : 'EMA 20/100'}, ${V}, 5 coins, NO cap, compounding, ₱ multiple of the start after each calendar year\n`);
console.log('| risk per trade | median year | geometric mean year | worst year | best year | deepest drop in a year | years with a drop of 50%+ |\n|---|---|---|---|---|---|---|');
const rows = [];
for (const p of LEVELS) { const r = YRS.map((y) => year(y, p / 100)), ms = r.map((a) => a.m), gm = Math.exp(ms.reduce((s, v) => s + Math.log(Math.max(v, 1e-6)), 0) / 7); rows.push({ p, gm }); console.log(`| ${p}% | ${x([...ms].sort((a, b) => a - b)[3])} | **${x(gm)}** | ${x(Math.min(...ms))} | ${x(Math.max(...ms))} | ${(Math.max(...r.map((a) => a.dd)) * 100).toFixed(0)}% | ${r.filter((a) => a.dd >= 0.5).length}/7 |`); }
const best = rows.reduce((a, b) => (b.gm > a.gm ? b : a));
// Kelly on the pooled trade list (treats trades as one sequence; ignores that up to 5 can be open together)
const R = all.map((t) => t.R); let kf = 0, kb = -1;
for (let f = 0.0005; f <= 0.4; f += 0.0005) { const g = R.reduce((s, r) => s + Math.log(Math.max(1e-9, 1 + f * r)), 0) / R.length; if (g > kb) { kb = g; kf = f; } }
console.log(`\nGrowth-maximising risk on the 7 yearly restarts: **${best.p}%** per trade. Kelly on the pooled ${R.length} trades (one trade at a time): **${(kf * 100).toFixed(1)}%** per trade.`);
const mean = R.reduce((a, b) => a + b, 0) / R.length, sd = Math.sqrt(R.reduce((a, r) => a + (r - mean) ** 2, 0) / (R.length - 1));
console.log(`Edge estimate: ${mean.toFixed(2)}R per trade ± ${(1.96 * sd / Math.sqrt(R.length)).toFixed(2)} (95%). If the true edge is at the LOW end (${(mean - 1.96 * sd / Math.sqrt(R.length)).toFixed(2)}R), the Kelly risk is about ${(kf * 100 * (mean - 1.96 * sd / Math.sqrt(R.length)) / mean).toFixed(1)}%; going past the real Kelly makes growth go DOWN.`);
