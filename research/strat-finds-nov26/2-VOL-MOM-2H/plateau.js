'use strict';
const L = require('./lib.js'), { strat } = require('./fam.js');
const row = (tag, r) => console.log(tag.padEnd(46), 'n', String(r.n).padStart(4), 'R', r.total.toFixed(0).padStart(5), 'exp', r.exp.toFixed(2), 'yrs', r.posYears + '/7', L.YEARS.map((y) => r.years[y].toFixed(0).padStart(4)).join(''), 'ex10', r.ex10.toFixed(0));
for (const kv of [3, 4, 5, 6, 8]) for (const kr of [1.2]) for (const trend of [0, 400]) for (const ki of [2, 2.5]) for (const kt of [8, 10, 14]) {
  const p = { fam: 'f2', kv, kr, trend }, ex = { kInit: ki, kTrail: kt, maxBars: 0, sigExit: false };
  const a = L.evaluate(strat(p), ex, L.MAIN), b = L.evaluate(strat(p), ex, L.HOLD);
  row(`kv${kv} kr${kr} tr${trend} ki${ki} kt${kt} MAIN`, a); row('   HOLD', b);
}
