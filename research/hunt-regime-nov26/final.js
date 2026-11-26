'use strict';
const L = require('./lib.js'), F = require('./fam.js'), fs = require('fs');
const mo = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const BB = { m4: JSON.parse(fs.readFileSync('bbcore-monthly-14400.json')), m1: JSON.parse(fs.readFileSync('bbcore-monthly-3600.json')) };
const ex = (mb) => ({ maxBars: mb, sigExit: false, kInit: 0, kTrail: 0 });
function run(p, mb, coins = L.MAIN, mul = 1) { return L.evaluate((c) => F.weekend(c, p), ex(mb), coins, mul, true); }
function monthly(tr) { const m = {}; for (const t of tr) m[mo(t.tExit)] = (m[mo(t.tExit)] || 0) + t.R; return m; }
function corr(a, b) { const ks = [...new Set([...Object.keys(a), ...Object.keys(b)])]; const x = ks.map((k) => a[k] || 0), y = ks.map((k) => b[k] || 0), n = ks.length;
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sx * sy); }
function lossMonths(m, ref) { const ks = Object.keys(ref).filter((k) => ref[k] < 0); const pos = ks.filter((k) => (m[k] || 0) > 0).length; const sum = ks.reduce((s, k) => s + (m[k] || 0), 0); return `${pos}/${ks.length} pos, sum ${sum.toFixed(0)}R`; }
function report(label, p, mb) {
  const r = run(p, mb), m = monthly(r.trades);
  console.log('\n##', label, JSON.stringify(p), 'bars=' + mb); console.log(' MAIN 1x', L.fmt(r));
  const r2 = run(p, mb, L.MAIN, 2); console.log(' MAIN 2x', L.fmt(r2));
  for (const [k, ref] of [['BB4h main', BB.m4.main], ['BB4h live', BB.m4.live], ['BB1h main', BB.m1.main]]) console.log(`  corr vs ${k}: ${corr(m, ref).toFixed(2)}  | BB-losing months (${Object.keys(ref).filter((x) => ref[x] < 0).length}): ${lossMonths(m, ref)}`);
  return r;
}
module.exports = { run, monthly, corr, lossMonths, report, ex };
if (require.main === module) {
  const arg = process.argv[2];
  if (arg === 'pick') { // IS-only ranking of trend-filtered Friday long
    const rows = [];
    for (const hour of [16, 18, 20, 22]) for (const mb of [24, 36, 48]) for (const kStop of [2, 3]) { const r = run({ trend: 1, day: 5, hour, dir: 1, kStop }, mb);
      const is = [2020, 2021, 2022, 2023].map((y) => r.years[y]); rows.push({ hour, mb, kStop, isTot: is.reduce((a, b) => a + b, 0), min: Math.min(...is), n: r.n }); }
    rows.sort((a, b) => b.isTot - a.isTot); for (const x of rows) console.log(JSON.stringify(x));
  }
}
