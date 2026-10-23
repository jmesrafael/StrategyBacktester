// mc-risk.js — Monte Carlo of the maximum drawdown in % of EQUITY at 0.25% / 0.5% / 1% risk per trade (compounded: every trade risks r x current equity).
//   node audit/mc-risk.js
// Trades = SOL+ZEC pooled, actual R multiples from the engine (with funding). Equity path: E <- E x (1 + r x R). Max drawdown = largest peak-to-trough fall of E.
// Three resampling schemes (20,000 paths each):
//   iid     : trades drawn with replacement, independent (the earlier report's method)
//   block10 : chronological blocks of 10 consecutive trades drawn with replacement (keeps streak/clustering inside a block)
//   month   : whole calendar MONTHS drawn with replacement, trades inside a month kept in exit order (keeps SOL/ZEC co-movement and overlap exactly)
// Horizons: FULL = as many trades as the history (6.2 years), 1 YEAR = 100 trades, 2 YEARS = 200 trades.
// Simplification: risk is sized on equity after the previous trade closed (two overlapping trades are each sized on the same equity, as the bot does when both
// coins are open, so the month scheme is the realistic one). Fixed-R curves (no compounding) are in execdiag.js.
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, DEFAULTS } = require('../lucidio-core.js');
const D = path.join(__dirname, '..', 'data'), rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const harsh = { entryFee: 0.0008, stopFee: 0.0008, timeFee: 0.0008, tpFee: 0.0008, slip: 0.0005, tpSlip: 0.0005, tpBuf: 0.0005 };
function pair(venue, cost) {
  const out = [];
  for (const coin of ['SOL', 'ZEC']) {
    const name = venue + coin, B = rd(name + '.json').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
    let F = rd('funding/' + name + '.json'); if (venue) { const bin = rd('funding/' + coin + '.json'); F = [...bin.filter((r) => r[0] < F[0][0]), ...F]; }
    out.push(...backtest(B, { cost }, F).trades);
  }
  return out.sort((a, b) => a.tExit - b.tExit);
}
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
function path_(Rs, r) { let e = 1, pk = 1, dd = 0; for (const x of Rs) { e *= 1 + r * x; if (e <= 0) return { dd: 1, end: 0 }; if (e > pk) pk = e; const d = 1 - e / pk; if (d > dd) dd = d; } return { dd, end: e }; }
function sample(scheme, R, months, n, rnd) {
  const out = [];
  if (scheme === 'iid') for (let i = 0; i < n; i++) out.push(R[Math.floor(rnd() * R.length)]);
  else if (scheme === 'block10') { while (out.length < n) { const s = Math.floor(rnd() * (R.length - 9)); for (let j = 0; j < 10 && out.length < n; j++) out.push(R[s + j]); } }
  else { while (out.length < n) { const m = months[Math.floor(rnd() * months.length)]; for (const x of m) { if (out.length >= n) break; out.push(x); } } }
  return out;
}
const SIMS = 20000, RISKS = (process.env.RISKS || '0.0025,0.005,0.01').split(',').map(Number);
function table(label, trades, rows, edge) {
  let R = trades.map((t) => t.R); if (edge != null) { const m0 = R.reduce((a, b) => a + b, 0) / R.length; R = R.map((x) => x - m0 + edge); trades = trades.map((t, i) => ({ ...t, R: R[i] })); }
  const byM = new Map();
  for (const t of trades) { const k = new Date(t.tExit * 1000).toISOString().slice(0, 7); (byM.get(k) || byM.set(k, []).get(k)).push(t.R); }
  const months = [...byM.values()];
  console.log(`\n--- ${label}: ${trades.length} trades, mean ${(R.reduce((a, b) => a + b, 0) / R.length).toFixed(3)}R, worst single trade ${Math.min(...R).toFixed(2)}R, historical order max DD at each risk: ${RISKS.map((r) => (100 * path_(R, r).dd).toFixed(1) + '% @' + (r * 100) + '%').join(', ')}`);
  console.log('risk/trade  scheme    horizon        median DD    95th pct DD   99th pct DD   P(DD>20%)  P(DD>30%)  P(DD>50%)   median end equity   P(end<start)');
  for (const [scheme, n, hlab] of rows) for (const r of RISKS) {
    const rnd = rng(12345 + Math.round(r * 1e4)), dds = [], ends = [];
    for (let k = 0; k < SIMS; k++) { const p = path_(sample(scheme, R, months, n, rnd), r); dds.push(p.dd); ends.push(p.end); }
    dds.sort((a, b) => a - b); ends.sort((a, b) => a - b);
    const pr = (x) => (100 * dds.filter((d) => d > x).length / SIMS).toFixed(1).padStart(5) + '%';
    console.log(`${(r * 100).toFixed(2)}%`.padEnd(10) + `  ${scheme.padEnd(8)}  ${hlab.padEnd(13)} ${(100 * q(dds, .5)).toFixed(1).padStart(8)}%   ${(100 * q(dds, .95)).toFixed(1).padStart(9)}%   ${(100 * q(dds, .99)).toFixed(1).padStart(9)}%   ${pr(0.2)}     ${pr(0.3)}     ${pr(0.5)}      x${q(ends, .5).toFixed(2).padStart(6)}            ${(100 * ends.filter((e) => e < 1).length / SIMS).toFixed(1)}%`);
  }
}
const main = pair('MEXC_', DEFAULTS.cost), N = main.length;
console.log(`Monte Carlo, ${SIMS} paths per row. Equity compounds: each trade risks r x current equity. DD in % of peak equity.`);
table('MEXC candles, base costs + funding (the traded venue) - MAIN', main, [['iid', N, `FULL ${N}`], ['block10', N, `FULL ${N}`], ['month', N, `FULL ${N}`], ['iid', 100, '1 YEAR 100'], ['month', 100, '1 YEAR 100'], ['month', 200, '2 YEARS 200']]);
table('MEXC candles, HARSH costs + funding', pair('MEXC_', harsh), [['iid', N, `FULL ${N}`], ['month', N, `FULL ${N}`], ['month', 100, '1 YEAR 100']]);
table('Binance candles, base costs + funding', pair('', DEFAULTS.cost), [['iid', 641, 'FULL 641'], ['month', 641, 'FULL 641'], ['month', 100, '1 YEAR 100']]);
// edge haircut: same trade shapes, mean R re-centred. 0.117R = empirical-Bayes estimate for an average coin (6-multiple-testing.txt), 0R = no edge at all
table('EDGE HAIRCUT: MEXC base, mean R re-centred to +0.12R (shrinkage estimate)', main, [['month', N, `FULL ${N}`], ['month', 100, '1 YEAR 100'], ['month', 200, '2 YEARS 200']], 0.117);
table('EDGE HAIRCUT: MEXC base, mean R re-centred to 0R (no edge)', main, [['month', N, `FULL ${N}`], ['month', 100, '1 YEAR 100'], ['month', 200, '2 YEARS 200']], 0);
console.log('\nbot-config.json haltAtR = -39R: at 0.25% / 0.5% / 1% risk that is a ' + RISKS.map((r) => (100 * (1 - Math.pow(1 - r, 39))).toFixed(1) + '%').join(' / ') + ' equity drawdown, respectively (compounded loss of 39 full-R losers in a row).');
