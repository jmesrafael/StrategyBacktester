// luck.js — how much of v7's profit is a handful of trades? bootstrap + drop-best-N. v7 frozen.
const T = require('./trades-windows.js'), E = require('./ie.js');
const D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000, lo = D0('2023-10-18'), hi = D0('2026-10-18');
let all = []; for (const s of ['SOL', 'ETH']) all.push(...T.build(s).trades.filter((t) => t.t >= lo && t.t < hi));
const R = all.map((t) => t.R * 10).sort((a, b) => b - a), tot = R.reduce((a, b) => a + b, 0), n = R.length;
console.log('trades', n, 'total', tot.toFixed(0), 'avg/trade', (tot / n).toFixed(2), 'winners', R.filter((x) => x > 0.5).length, 'losers', R.filter((x) => x < -0.5).length);
for (const k of [3, 5, 10]) console.log('drop best', k, '->', (tot - R.slice(0, k).reduce((a, b) => a + b, 0)).toFixed(0), '| best', k, 'trades =', R.slice(0, k).reduce((a, b) => a + b, 0).toFixed(0));
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const bs = []; for (let i = 0; i < 20000; i++) { let s = 0; for (let j = 0; j < n; j++) s += R[Math.floor(rnd() * n)]; bs.push(s); }
bs.sort((a, b) => a - b); const q = (p) => bs[Math.floor(p * bs.length)];
console.log('bootstrap total: 5th', q(0.05).toFixed(0), 'median', q(0.5).toFixed(0), '95th', q(0.95).toFixed(0), '| P(total<=0)', (bs.filter((x) => x <= 0).length / bs.length * 100).toFixed(2) + '%');
// halve the edge: shrink every winner by 25% (stand-in for live decay)
const dec = R.map((x) => (x > 0 ? x * 0.75 : x)).reduce((a, b) => a + b, 0); console.log('winners -25% ->', dec.toFixed(0));
// by direction/by month concentration
const mo = {}; for (const t of all) { const k = new Date(t.t * 1000).toISOString().slice(0, 7); mo[k] = (mo[k] || 0) + t.R * 10; }
const ms = Object.values(mo).sort((a, b) => b - a); console.log('best 3 months', ms.slice(0, 3).map((x) => x.toFixed(0)).join(','), 'sum', ms.slice(0, 3).reduce((a, b) => a + b, 0).toFixed(0), 'of', ms.reduce((a, b) => a + b, 0).toFixed(0));
