'use strict';
const lib = require('./lib.js'), F = require('./fam.js'), fs = require('fs');
const trends = [0, 100, 200, 400];
const exits = [];
for (const k of [2, 3, 4]) { for (const b of [6, 12, 24, 48]) exits.push({ k, bars: b }); for (const t of [4, 8, 12]) exits.push({ k, trail: t }); }
const cfgs = [];
for (const tr of trends) for (const ex of exits) {
  for (const N of [20, 40, 80, 120]) cfgs.push({ fam: 'donch', p: { N }, trend: tr, exit: ex });
  for (const N of [20, 40, 80]) cfgs.push({ fam: 'donch', p: { N, q: 0.8 }, trend: tr, exit: ex });
  for (const n of [6, 12, 24, 48]) for (const k of [1, 1.5, 2]) cfgs.push({ fam: 'roc', p: { n, k }, trend: tr, exit: ex });
  for (const [t, k, s] of [[9, 26, 52], [20, 60, 120], [12, 36, 72]]) for (const mode of ['cloud', 'cross']) cfgs.push({ fam: 'ichi', p: { t, k, s, mode }, trend: tr, exit: ex });
  for (const r of [7, 14]) for (const lo of [30, 40]) for (const T of [100, 200]) cfgs.push({ fam: 'pull', p: { r, lo, T }, trend: tr, exit: ex });
  for (const n of [50, 100]) for (const m of [10, 20]) for (const k of [0.5, 1, 2]) cfgs.push({ fam: 'slope', p: { n, m, k }, trend: tr, exit: ex });
}
for (const N of [20, 40, 80]) for (const m of [10, 20]) for (const tr of [0, 200]) for (const k of [2, 3]) cfgs.push({ fam: 'donch', p: { N }, trend: tr, exit: { k, chan: m, bars: 60 } });
console.log('configs', cfgs.length);
const out = [];
const IS = [2020, 2021, 2022, 2023];
for (const c of cfgs) {
  const r = lib.evaluate((x) => F.build(x, c), F.exOf(c), lib.MAIN, 1);
  const isPos = IS.filter((y) => r.years[y] > 0).length, isTot = IS.reduce((a, y) => a + r.years[y], 0);
  out.push({ c, isPos, isTot, r: { n: r.n, total: r.total, dd: r.dd, years: r.years, posYears: r.posYears, ex10: r.ex10 } });
}
fs.writeFileSync('scan.json', JSON.stringify(out));
const fams = {};
for (const o of out) { const f = o.c.fam; fams[f] = fams[f] || { n: 0, is4: 0, y7: 0 }; fams[f].n++; if (o.isPos === 4) fams[f].is4++; if (o.r.posYears === 7) fams[f].y7++; }
console.log(JSON.stringify(fams));
out.filter((o) => o.r.posYears === 7).sort((a, b) => b.r.total / b.r.dd - a.r.total / a.r.dd).slice(0, 25).forEach((o) => console.log(JSON.stringify(o.c), 'R', o.r.total.toFixed(0), 'dd', o.r.dd.toFixed(0), lib.YEARS.map((y) => o.r.years[y].toFixed(0)).join(' ')));
