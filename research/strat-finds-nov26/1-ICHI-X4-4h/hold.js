'use strict';
const lib = require('./lib.js'), F = require('./fam.js'), fs = require('fs');
const out = JSON.parse(fs.readFileSync('scan.json')).filter((o) => o.r.posYears === 7);
const res = [];
for (const o of out) {
  const c = o.c, ex = F.exOf(c), b = (x) => F.build(x, c);
  const m2 = lib.evaluate(b, ex, lib.MAIN, 2), h = lib.evaluate(b, ex, lib.HOLD, 1);
  const m2ok = lib.YEARS.every((y) => m2.years[y] > 0);
  res.push({ c, main: o.r, m2: m2.years, m2ok, hold: h.years, hPos: h.posYears, hTot: h.total, hWorst: h.worst, ex10: o.r.ex10 });
}
fs.writeFileSync('hold.json', JSON.stringify(res));
console.log('main7/7', res.length, 'm2ok', res.filter((r) => r.m2ok).length, 'hold7/7', res.filter((r) => r.hPos === 7).length, 'both', res.filter((r) => r.hPos === 7 && r.m2ok).length);
const pr = (r) => console.log(JSON.stringify(r.c), 'M', lib.YEARS.map((y) => r.main.years[y].toFixed(0)).join(' '), '| H', lib.YEARS.map((y) => r.hold[y].toFixed(0)).join(' '), '| m2ok', r.m2ok, 'ex10', r.ex10.toFixed(0));
res.filter((r) => r.hPos >= 6).sort((a, b) => b.hWorst - a.hWorst).slice(0, 30).forEach(pr);
