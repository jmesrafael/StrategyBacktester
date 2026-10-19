// v7m-sweep.js — v7+1m variants on SOL. usage: node v7m-sweep.js [year=2025] [range from] [range to]
const V = require('./v7m.js');
const year = +(process.argv[2] || 2025), from = process.argv[3] || `${year}-10-18`, to = process.argv[4] || `${year + 1}-10-18`;
const sum = (a) => a.reduce((x, t) => x + t.R, 0);
function show(name, o) {
  const t = V.run('SOL', o, [from, to], year), R = t.map((x) => x.R);
  const gp = R.filter((x) => x > 0).reduce((a, b) => a + b, 0), gl = -R.filter((x) => x <= 0).reduce((a, b) => a + b, 0);
  let c = 0, pk = 0, dd = 0; for (const x of R) { c += x; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); }
  const k = {}; for (const x of t) k[x.reason] = (k[x.reason] || 0) + 1;
  console.log(name.padEnd(46), String(t.length).padStart(3), sum(t).toFixed(2).padStart(7), (gl ? gp / gl : 99).toFixed(2).padStart(6), dd.toFixed(1).padStart(5), ' ', JSON.stringify(k));
  return t;
}
console.log('variant'.padEnd(46), '  n', '  totR', '    PF', '   DD');
const G = JSON.parse(process.env.GRID || 'null');
if (G) { for (const [n, o] of G) show(n, o); return; }
show('v7 (BE 1R)', {});
console.log('-- breakeven trigger / lock');
for (const be of [0.3, 0.5, 0.6, 0.75, 1.25, 1.5]) show(`beR ${be}`, { beR: be });
for (const be of [0.5, 0.75, 1]) for (const lk of [0.1, 0.2]) show(`beR ${be} lock +${lk}R`, { beR: be, beLock: lk });
console.log('-- 1m structure breakeven (keeps beR 1)');
for (const mr of [0.3, 0.5, 0.75]) for (const k of [2, 3, 5]) show(`struct BE after ${mr}R, 1m pivot ${k}`, { sbMode: true, sbMinR: mr, confLen: k });
console.log('-- follow-through rule');
show('no ft rule', { ftMinR: -99 });
for (const [mn, r] of [[30, 0.25], [45, 0.25], [60, 0.5], [90, 0.25]]) show(`ft ${mn}min <${r}R → −0.5R`, { ftMin: mn, ftMinR: r });
console.log('-- target');
for (const r of [2, 2.5, 4, 5]) show(`tpR ${r}`, { tpR: r });
show('tp next 15m swing', { tp: 'swing' }); show('tp max(swing, 3R)', { tp: 'swingFloor' });
console.log('-- 1m trailing');
for (const tr of [1.5, 2]) for (const tl of [3, 5]) for (const r of [3, 5, 10]) show(`trail after ${tr}R pivot${tl} tp ${r}R`, { trailR: tr, trailLen: tl, tpR: r });
console.log('-- entry');
for (const fb of [0.5, 0.618, 0.705, 0.786]) { show(`fib ${fb} inside FVG only`, { entry: 'fib', fib: fb }); show(`fib ${fb} clamped to FVG`, { entry: 'fib', fib: fb, fibClamp: true }); }
for (const k of [2, 3]) for (const cs of ['1m', '15m']) for (const tl of ['mid', 'edge']) show(`1m-CHoCH confirm k${k} stop ${cs} touch ${tl}`, { entry: 'confirm', confLen: k, confStop: cs, confTouch: tl });
show('1m-CHoCH confirm k2 stop 1m, keep 3R price', { entry: 'confirm', confLen: 2, confStop: '1m', tpKeepPrice: true });
