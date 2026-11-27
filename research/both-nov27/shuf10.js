// shuf10.js - shuffle test (2,000 orders, full and 5-trade blocks) of T-CORE trail 10 vs live, own trades each; plus
// neighbour check trail 8 and 9 on the bench (exploration only: outside the pre-listed grid, reported as such).
'use strict';
const H = require('./h.js'), X = H.X, { shuffleTest } = require('../dd-nov27/mc.js');
const L = { mode: 'live', start: 600, cap: 500 };
const base = X.run(L).trades, t10 = X.run({ ...L, spec: { tc: { kTrail: 10 } } }).trades;
for (const b of [1, 5]) for (const [n, tr] of [['live', base], ['trail 10', t10]]) {
  const s = shuffleTest(tr, { n: 2000, block: b, seed: 3 });
  console.log(`block ${b} ${n.padEnd(9)} profit ${(100 * s.pProfit).toFixed(0)}% median end ${Math.round(s.medianEnd)} p5 end ${Math.round(s.p5End)} median fall ${H.p(s.medianDD)} p95 fall ${H.p(s.p95DD)}`);
}
for (const k of [8, 9]) H.evaluate({ spec: { tc: { kTrail: k } } }, 'T-CORE trail ' + k + ' (neighbour)');
