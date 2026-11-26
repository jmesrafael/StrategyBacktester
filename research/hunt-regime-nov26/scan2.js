'use strict';
const L = require('./lib.js'), F = require('./fam.js');
const sc = L.IV === 14400 ? 1 / 4 : 1; const S = (x) => Math.max(2, Math.round(x * sc));
const regs = [{}, { erN: S(96), erMax: 0.25 }, { trend: 1 }];
const out = [];
for (const r of regs) for (const day of [5, 6]) for (const hour of (L.IV === 14400 ? [0, 12, 20] : [12, 16, 20, 22])) for (const dir of [1, -1]) for (const kStop of [2, 3, 4]) for (const mb of [12, 24, 36, 48].map(S)) {
  const p = { ...r, day, hour, dir, kStop }, ex = { maxBars: mb, sigExit: false, kInit: 0, kTrail: 0 };
  const res = L.evaluate((c) => F.weekend(c, p), ex, L.MAIN, 1);
  const is = [2020, 2021, 2022, 2023].map((y) => res.years[y]); out.push({ p, ex, res, isTot: is.reduce((a, b) => a + b, 0), isPos: is.filter((v) => v > 0).length });
}
out.sort((a, b) => b.isPos - a.isPos || b.isTot - a.isTot);
console.log('IS4/4:', out.filter((o) => o.isPos === 4).length, 'of', out.length);
for (const o of out.slice(0, 15)) console.log(o.isPos + '/4', JSON.stringify(o.p), o.ex.maxBars, L.fmt(o.res));
