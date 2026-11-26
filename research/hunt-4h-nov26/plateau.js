'use strict';
const lib = require('./lib.js'), F = require('./fam.js');
const base = { fam: 'ichi', p: { t: 9, k: 26, s: 52, mode: 'cross' }, trend: 0, exit: { k: 2, bars: 12 } };
const vars = [];
for (const [t, k, s] of [[9, 26, 52], [7, 22, 44], [8, 24, 48], [10, 28, 56], [12, 30, 60], [9, 26, 78], [9, 20, 52], [6, 26, 52], [9, 34, 52]])
  for (const kk of [1.5, 2, 2.5]) for (const bars of [8, 10, 12, 15, 18]) vars.push({ ...base, p: { t, k, s, mode: 'cross' }, exit: { k: kk, bars } });
let pass = 0, tot = 0, passM = 0, passH = 0, pass2 = 0;
const rows = [];
for (const c of vars) {
  const b = (x) => F.build(x, c), ex = F.exOf(c);
  const m = lib.evaluate(b, ex, lib.MAIN, 1), m2 = lib.evaluate(b, ex, lib.MAIN, 2), h = lib.evaluate(b, ex, lib.HOLD, 1);
  const a = m.posYears === 7, b2 = lib.YEARS.every((y) => m2.years[y] > 0), d = h.posYears === 7;
  tot++; if (a) passM++; if (b2) pass2++; if (d) passH++; if (a && b2 && d) pass++;
  rows.push(`${JSON.stringify(c.p)} k${c.exit.k} b${c.exit.bars} M${m.posYears} M2x${b2 ? 'ok' : 'NO'} H${h.posYears} Rm=${m.total.toFixed(0)} Rh=${h.total.toFixed(0)} worstM2=${Math.min(...lib.YEARS.map((y) => m2.years[y])).toFixed(0)} worstH=${h.worst.toFixed(0)}`);
}
console.log(rows.join('\n')); console.log(`plateau: ${pass}/${tot} pass all (main7 ${passM}, 2x ${pass2}, hold7 ${passH})`);
