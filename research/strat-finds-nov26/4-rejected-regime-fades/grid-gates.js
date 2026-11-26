const F = require('./final.js'), L = require('./lib.js'), fs = require('fs');
const BB = JSON.parse(fs.readFileSync('bbcore-monthly-14400.json')).live, BBm = JSON.parse(fs.readFileSync('bbcore-monthly-14400.json')).main;
const lm = Object.keys(BBm).filter((k) => BBm[k] < 0);
const regs = { trend: { trend: 1 }, none: {}, er: { erN: 96, erMax: 0.25 }, trend_er: { trend: 1, erN: 96, erMax: 0.3 } };
const rows = [];
for (const [rn, r] of Object.entries(regs)) for (const hour of [16, 18, 20, 22]) for (const mb of [24, 36, 48]) for (const kStop of [2, 3]) {
  const p = { ...r, day: 5, hour, dir: 1, kStop }, a = F.run(p, mb), b = F.run(p, mb, L.MAIN, 2), m = F.monthly(a.trades);
  const is = [2020, 2021, 2022, 2023].map((y) => a.years[y]).reduce((x, y) => x + y, 0);
  rows.push({ rn, hour, mb, kStop, isTot: is, w1: a.worst, w2: b.worst, ex10: a.ex10, cor: F.corr(m, BBm), cors: F.corr(m, BB), lpos: lm.filter((k) => (m[k] || 0) > 0).length / lm.length });
}
fs.writeFileSync('grid-gates.json', JSON.stringify(rows));
for (const x of rows.sort((a, b) => b.isTot - a.isTot)) console.log(x.rn.padEnd(9), x.hour, x.mb, x.kStop, 'IS', x.isTot.toFixed(0), 'worst1x', x.w1.toFixed(0), 'worst2x', x.w2.toFixed(0), 'ex10', x.ex10.toFixed(0), 'corr', x.cor.toFixed(2), x.cors.toFixed(2), 'lossPos', x.lpos.toFixed(2));
