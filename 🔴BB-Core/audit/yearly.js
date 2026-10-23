// yearly.js — per coin, per calendar year (by EXIT year): net R, trades, win%, PF, max DD (R), exposure %, cost split (fees+slip / funding), t-stat, bootstrap 95% CI.
//   node audit/yearly.js [binance|mexc]   (default binance).  Scenarios: free | base | harsh (0.08% fee every fill + 0.05% slip)
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, DEFAULTS, FREE } = require('../lucidyo-core.js');
const D = path.join(__dirname, '..', 'data'), rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const harsh = { entryFee: 0.0008, stopFee: 0.0008, timeFee: 0.0008, tpFee: 0.0008, slip: 0.0005, tpSlip: 0.0005, tpBuf: 0.0005 };
const venue = process.argv[2] === 'mexc' ? 'MEXC_' : '';
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const yr = (t) => new Date(t * 1000).getUTCFullYear();
function load(c) {
  const B = rd(c + '.json').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  let F = fs.existsSync(path.join(D, 'funding', c + '.json')) ? rd('funding/' + c + '.json') : null;
  if (c.startsWith('MEXC_')) { const bin = rd('funding/' + c.slice(5) + '.json'); F = [...bin.filter((r) => r[0] < F[0][0]), ...F]; }
  return { B, F };
}
function mean(a) { return a.reduce((x, y) => x + y, 0) / (a.length || 1); }
function sd(a) { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); }
function boot(a, n = 4000) { if (a.length < 3) return [NaN, NaN]; const s = []; for (let k = 0; k < n; k++) { let t = 0; for (let i = 0; i < a.length; i++) t += a[Math.floor(rnd() * a.length)]; s.push(t); } s.sort((x, y) => x - y); return [s[Math.floor(n * .025)], s[Math.floor(n * .975)]]; }
function row(label, tr, free, B, y) {
  const R = tr.map((t) => t.R), net = R.reduce((a, b) => a + b, 0), w = R.filter((r) => r > 0), l = R.filter((r) => r <= 0);
  let eq = 0, pk = 0, dd = 0; for (const r of R) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const bars = tr.reduce((a, t) => a + t.bars, 0), tot = y == null ? B.length : B.filter((b) => yr(b.time) === y).length;
  const fund = tr.reduce((a, t) => a + t.fundR, 0), fr = new Map(free.map((t) => [t.i0, t.R]));
  const frict = tr.reduce((a, t) => a + ((fr.get(t.i0) ?? t.R) - t.R), 0) - fund * -1 * -1; // friction vs frictionless, excluding funding below
  const fees = tr.reduce((a, t) => a + ((fr.get(t.i0) ?? t.R) - t.R), 0) - (-fund);          // fees+slippage = (free-R - R) - funding drag
  const tstat = R.length > 2 ? mean(R) / (sd(R) / Math.sqrt(R.length)) : NaN, [lo, hi] = boot(R);
  return `${label.padEnd(8)} n=${String(tr.length).padStart(3)} netR=${net.toFixed(1).padStart(6)} avgR=${mean(R).toFixed(2).padStart(5)} win=${(100 * w.length / (R.length || 1)).toFixed(0).padStart(3)}% PF=${(l.length ? w.reduce((a, b) => a + b, 0) / -l.reduce((a, b) => a + b, 0) : Infinity).toFixed(2).padStart(5)} maxDD=${dd.toFixed(1).padStart(5)}R expo=${(100 * bars / tot).toFixed(0).padStart(3)}% fees+slip=${(-fees).toFixed(1).padStart(6)}R funding=${fund.toFixed(1).padStart(5)}R t=${tstat.toFixed(1).padStart(4)} CI95netR[${lo.toFixed(0)},${hi.toFixed(0)}]`;
}
for (const sc of ['base', 'harsh']) {
  console.log(`\n===== ${venue ? 'MEXC' : 'Binance'} candles · scenario ${sc} (${sc === 'base' ? '0.05% taker, 0.02% maker TP, 0.02% slip' : '0.08% every fill, 0.05% slip'}) · R units, 1R = risk per trade =====`);
  const pool = {};
  for (const coin of ['SOL', 'ZEC']) {
    const { B, F } = load(venue + coin), cost = sc === 'base' ? DEFAULTS.cost : harsh;
    const tr = backtest(B, { cost }, F).trades, fr = backtest(B, { cost: FREE }, null).trades;
    console.log(`\n${coin}`);
    const ys = [...new Set(tr.map((t) => yr(t.tExit)))].sort();
    for (const y of ys) console.log('  ' + row(String(y), tr.filter((t) => yr(t.tExit) === y), fr, B, y));
    console.log('  ' + row('ALL', tr, fr, B, null)); pool[coin] = { tr, fr, B };
  }
  const both = [...pool.SOL.tr, ...pool.ZEC.tr].sort((a, b) => a.tExit - b.tExit);
  console.log('\nSOL+ZEC combined (each coin 1R risk, simple sum, no compounding)');
  const ys = [...new Set(both.map((t) => yr(t.tExit)))].sort();
  for (const y of ys) { const sub = both.filter((t) => yr(t.tExit) === y); const R = sub.map((t) => t.R); let eq = 0, pk = 0, dd = 0; for (const r of R) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); } console.log(`  ${y} n=${sub.length} netR=${R.reduce((a, b) => a + b, 0).toFixed(1)} maxDD=${dd.toFixed(1)}R`); }
  const R = both.map((t) => t.R); let eq = 0, pk = 0, dd = 0; for (const r of R) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  console.log(`  ALL n=${R.length} netR=${R.reduce((a, b) => a + b, 0).toFixed(1)} avgR=${mean(R).toFixed(3)} t=${(mean(R) / (sd(R) / Math.sqrt(R.length))).toFixed(1)} maxDD=${dd.toFixed(1)}R`);
  const sorted = [...R].sort((a, b) => b - a), tot = R.reduce((a, b) => a + b, 0);
  console.log(`  concentration: best 10 trades = ${sorted.slice(0, 10).reduce((a, b) => a + b, 0).toFixed(1)}R of ${tot.toFixed(1)}R; net without best 10 = ${(tot - sorted.slice(0, 10).reduce((a, b) => a + b, 0)).toFixed(1)}R; without best 20 = ${(tot - sorted.slice(0, 20).reduce((a, b) => a + b, 0)).toFixed(1)}R`);
}
