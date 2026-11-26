'use strict';
const L = require('./lib.js'), { strat } = require('./fam.js');
let tot = 0, good = 0;
for (const kv of [2.5, 3, 3.5, 4]) for (const kr of [1, 1.2, 1.5]) for (const trend of [300, 400, 600]) for (const ki of [1.5, 2, 2.5]) for (const kt of [6, 8, 10]) {
  const p = { fam: 'f2', kv, kr, trend }, ex = { kInit: ki, kTrail: kt, maxBars: 0, sigExit: false };
  const a = L.evaluate(strat(p), ex, L.MAIN), b = L.evaluate(strat(p), ex, L.HOLD), c = L.evaluate(strat(p), ex, L.MAIN, 2);
  const g = a.posYears === 7 && b.posYears === 7 && c.posYears === 7 && a.ex10 > 0 && b.ex10 > 0; tot++; if (g) good++;
  console.log((g ? 'PASS ' : 'fail ') + `kv${kv} kr${kr} tr${trend} ki${ki} kt${kt} M ${a.posYears} H ${b.posYears} 2x ${c.posYears} ex10 ${a.ex10.toFixed(0)}/${b.ex10.toFixed(0)} Mexp ${a.exp.toFixed(2)} Hexp ${b.exp.toFixed(2)} Hyrs ${L.YEARS.map(y=>b.years[y].toFixed(0)).join(',')}`);
}
console.log('pass', good, 'of', tot);
