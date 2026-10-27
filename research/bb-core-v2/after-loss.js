// after-loss.js — after a bad month, what does the NEXT month do?  node after-loss.js [binance|mexc]
'use strict';
const { runMerged } = require('./merged.js'); const { DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const V = process.argv[2] || 'binance', f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1), mk = (s) => new Date(s * 1000).toISOString().slice(0, 7);
const nxt = (k) => { const [y, m] = k.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
for (const [m, label] of [['bb', 'bb-core'], ['two', 'Merged']]) {
  const M = {}; for (const c of COINS) { const D = loadCoin(c, V); for (const t of runMerged(D.B, m, DEFAULTS.cost, D.funding).trades) M[mk(t.tExit)] = (M[mk(t.tExit)] || 0) + t.R; }
  const keys = Object.keys(M).filter((k) => k >= '2020-06').sort(), has = (k) => M[k] != null;
  const pairs = keys.filter((k) => has(nxt(k))).map((k) => [k, M[k], M[nxt(k)]]);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length, all = pairs.map((p) => p[2]);
  console.log(`\n## ${label} — ${V.toUpperCase()} — ${pairs.length} month pairs; average month ${f1(avg(keys.map((k) => M[k])))}R, positive months ${(100 * keys.filter((k) => M[k] > 0).length / keys.length).toFixed(0)}%\n`);
  console.log('| after a month worse than | such months | next month positive | avg next month | worst next month |\n|---|---|---|---|---|');
  for (const th of [0, -3, -5, -8]) { const p = pairs.filter((x) => x[1] < th); if (p.length) console.log(`| ${f1(th)}R${th === 0 ? ' (any loss)' : ''} | ${p.length} | ${p.filter((x) => x[2] > 0).length}/${p.length} (${(100 * p.filter((x) => x[2] > 0).length / p.length).toFixed(0)}%) | ${f1(avg(p.map((x) => x[2])))}R | ${f1(Math.min(...p.map((x) => x[2])))}R |`); }
  console.log(`| (any month, for reference) | ${pairs.length} | ${(100 * all.filter((v) => v > 0).length / all.length).toFixed(0)}% | ${f1(avg(all))}R | ${f1(Math.min(...all))}R |`);
  console.log('\nThe 10 worst months and what came next:\n\n| bad month | R | next month | R |\n|---|---|---|---|');
  for (const [k, v, n] of [...pairs].sort((a, b) => a[1] - b[1]).slice(0, 10)) console.log(`| ${k} | ${f1(v)} | ${nxt(k)} | ${f1(n)} |`);
  // two bad months in a row
  const two = pairs.filter((p, i) => p[1] < 0 && has(p[0]) && M[keys[keys.indexOf(p[0]) - 1]] < 0);
  console.log(`\nTwo losing months in a row happened ${keys.filter((k, i) => i && M[k] < 0 && M[keys[i - 1]] < 0).length} times; longest losing run: ${(() => { let b = 0, r = 0; for (const k of keys) { r = M[k] < 0 ? r + 1 : 0; b = Math.max(b, r); } return b; })()} months.`);
}
