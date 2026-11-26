// BB-CORE reference monthly series (4h: BB20/2, SMA200, stop=mid, exit 48; 1h: BB80/2, SMA800, exit 192), for correlation.
'use strict';
const L = require('./lib.js'), I = L.I, ok = I.ok, fs = require('fs');
const [len, mult, trend, mb] = L.IV === 14400 ? [20, 2, 200, 48] : [80, 2, 800, 192];
function st(c) {
  const m = I.sma(c.C, len), sd = I.stdev(c.C, len), tr = I.sma(c.C, trend), n = c.n;
  const o = { L: new Uint8Array(n), S: new Uint8Array(n), stopL: new Float64Array(n), stopS: new Float64Array(n), warmup: trend + 5 };
  for (let i = o.warmup; i < n; i++) { if (!ok(m[i]) || !ok(tr[i])) continue; const cl = c.C[i];
    if (cl > m[i] + mult * sd[i] && cl > tr[i]) { o.L[i] = 1; o.stopL[i] = m[i]; } else if (cl < m[i] - mult * sd[i] && cl < tr[i]) { o.S[i] = 1; o.stopS[i] = m[i]; } }
  return o;
}
const mo = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const res = {};
for (const [name, coins] of [['main', L.MAIN], ['live', ['SOL', 'NEAR', 'ADA', 'GALA']]]) {
  const r = L.evaluate(st, { maxBars: mb, kInit: 0, kTrail: 0 }, coins, 1, true), m = {};
  for (const t of r.trades) m[mo(t.tExit)] = (m[mo(t.tExit)] || 0) + t.R;
  res[name] = m; console.log(L.IV, name, L.fmt(r));
}
fs.writeFileSync('bbcore-monthly-' + L.IV + '.json', JSON.stringify(res));
