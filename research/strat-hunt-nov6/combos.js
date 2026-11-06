// combos.js — bb-core alone vs bb-core + X, each at 1/2 risk (same total risk). Also the monthly-R correlation of X with bb-core.
//   node combos.js 4h   |  node combos.js 1h
'use strict';
const fs = require('fs');
const tf = process.argv[2] || '4h';
let T = {}; for (const f of ['trades.json', 'trades-hybrid.json']) if (fs.existsSync(f)) Object.assign(T, JSON.parse(fs.readFileSync(f, 'utf8')));
const Y = [2020, 2021, 2022, 2023, 2024, 2025, 2026], f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0);
const month = (t) => { const d = new Date(t[2] * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
function agg(parts) { // parts: [[trades, weight]]
  const all = []; for (const [tr, w] of parts) for (const t of tr) all.push([t[2], t[3] * w]);
  all.sort((a, b) => a[0] - b[0]); let e = 0, p = 0, dd = 0; const ys = {};
  for (const [te, r] of all) { e += r; p = Math.max(p, e); dd = Math.max(dd, p - e); const y = new Date(te * 1000).getUTCFullYear(); ys[y] = (ys[y] || 0) + r; }
  return { total: e, dd, ys, rdd: dd ? e / dd : 0, worstYear: Math.min(...Y.map((y) => ys[y] || 0)) };
}
function monthly(tr) { const m = {}; for (const t of tr) m[month(t)] = (m[month(t)] || 0) + t[3]; return m; }
function corr(a, b) { const ks = [...new Set([...Object.keys(a), ...Object.keys(b)])]; const x = ks.map((k) => a[k] || 0), y = ks.map((k) => b[k] || 0), n = ks.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sx * sy); }
const base = T[`bb-core|BBX|${tf}`], bm = monthly(base), b0 = agg([[base, 1]]);
const cands = ['i-core|P7', 'bb-trail|P7', 'bb-hybrid|BBT7', 'bb-hybrid|BBX96', 'fractal|P14', 'don-vol|P14', 'tsmom|P7', 'cci100|P14', 'elder|P7', 'heikin|P7', 'kst|P7', 'ichi-tk|P7'].map((k) => k + '|' + tf).filter((k) => T[k]);
console.log(`### ${tf}: bb-core alone vs bb-core + X at 1/2 risk each`);
console.log('| portfolio | total R | maxDD R | R/DD | worst year | ' + Y.join(' | ') + ' | monthly corr of X with bb-core |\n|' + '---|'.repeat(6 + Y.length));
const line = (name, a, c) => console.log(`| ${name} | ${a.total.toFixed(0)} | ${a.dd.toFixed(1)} | ${a.rdd.toFixed(1)} | ${f1(a.worstYear)} | ${Y.map((y) => f1(a.ys[y] || 0)).join(' | ')} | ${c} |`);
line('**bb-core alone**', b0, '');
for (const k of cands) line(`bb-core + ${k.split('|').slice(0, 2).join(' ')}`, agg([[base, 0.5], [T[k], 0.5]]), corr(bm, monthly(T[k])).toFixed(2));
