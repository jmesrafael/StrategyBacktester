'use strict';
const L = require('./lib.js'), { strat } = require('./fam.js'), fs = require('fs');
const IS = (r) => [2020, 2021, 2022, 2023].every((y) => r.years[y] > 0);
const cfgs = [];
const exits = [];
for (const ki of [2, 3, 4]) for (const kt of [0, 6, 10]) for (const mb of [0, 48, 120]) if (kt || mb) exits.push({ kInit: ki, kTrail: kt, maxBars: mb, sigExit: false });
const ownExits = [];
for (const kt of [0, 6, 10]) for (const mb of [12, 48, 120]) ownExits.push({ kInit: 0, kTrail: kt, maxBars: mb, sigExit: false });
const P = [];
for (const N of [12, 24, 48, 96]) for (const thr of [0.6, 0.8]) for (const k of [3, 12]) for (const trend of [0, 200, 400]) P.push({ fam: 'f1', N, thr, k, trend });
for (const kv of [2, 3, 5]) for (const kr of [1.2, 1.8]) for (const trend of [0, 200, 400]) P.push({ fam: 'f2', kv, kr, trend });
for (const N of [12, 24, 48]) for (const wick of [0.5, 1]) for (const trend of [0, 200]) for (const counter of [false]) P.push({ fam: 'f3', N, wick, trend, counter });
for (const [s0, s1, cut] of [[0, 8, 16], [0, 8, 12], [8, 14, 22], [13, 16, 24], [0, 4, 12]]) for (const stopMode of ['mid', 'far', 'atr']) for (const trend of [0, 200]) P.push({ fam: 'f4', s0, s1, cut, stopMode, trend });
for (const hr of [6, 14, 22]) for (const look of [3, 6]) for (const k of [1, 2]) for (const follow of [true, false]) for (const trend of [0]) P.push({ fam: 'f5', hr, look, k, follow, trend });
const out = [];
let cnt = 0;
for (const p of P) {
  const own = p.fam === 'f3' || (p.fam === 'f4' && p.stopMode !== 'atr');
  for (const ex of own ? ownExits : exits) {
    const r = L.evaluate(strat(p), ex, L.MAIN, 1);
    cnt++;
    out.push({ p, ex, n: r.n, total: r.total, exp: r.exp, years: r.years, is: IS(r), posYears: r.posYears });
  }
}
fs.writeFileSync('scan.json', JSON.stringify(out));
console.log('configs', cnt, 'IS-positive 4/4:', out.filter((o) => o.is).length, 'all 7:', out.filter((o) => o.posYears === 7).length);
const top = out.filter((o) => o.is).sort((a, b) => b.exp - a.exp).slice(0, 25);
for (const o of top) console.log(JSON.stringify(o.p), JSON.stringify(o.ex), 'n', o.n, 'R', o.total.toFixed(0), 'exp', o.exp.toFixed(3), L.YEARS.map((y) => o.years[y].toFixed(0)).join(' '));
