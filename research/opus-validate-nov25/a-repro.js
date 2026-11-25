// a-repro.js: reproduce headline numbers + ablation. node a-repro.js
'use strict';
const K = require('./core');
const S = require('../replace-nov25/sim');   // ONLY for comparing indicator values, not for results
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d);
const one = (trades, w = 1) => K.book([{ trades, weight: w }]);
const line = (name, r) => console.log(`${name.padEnd(42)} n ${String(r.n).padStart(5)} R ${f(r.R, 1).padStart(8)} DDc ${r.dd.toFixed(1).padStart(6)} DDo ${r.mdd.toFixed(1).padStart(6)} avgW ${r.avgW.toFixed(3)} R/DDo ${(r.R / r.mdd).toFixed(2)}`);

// 1. indicator parity with sim.js (values on every candle)
for (const c of K.COINS.bb) {
  const d = K.data(c), a = K.adx(d.B), b = S.adxArr(S.real(c)), i1 = K.ii(d.B), i2 = (() => { const x = S.real(c); const o = []; for (let i = 20; i < x.n; i++) { let s = 0, v = 0; for (let j = i - 20; j <= i; j++) { const r = x.H[j] - x.L[j]; if (r > 0) s += ((2 * x.C[j] - x.H[j] - x.L[j]) / r) * x.V[j]; v += x.V[j]; } o[i] = v > 0 ? s / v : 0; } return o; })();
  let ma = 0, mi = 0, n = 0; for (let i = 40; i < d.B.length; i++) { if (!isNaN(a[i]) && !isNaN(b[i])) ma = Math.max(ma, Math.abs(a[i] - b[i])); mi = Math.max(mi, Math.abs(i1[i] - i2[i])); n++; }
  console.log(`${c}: candles ${d.B.length} sim ${S.real(c).n}  max |ADX diff| ${ma.toExponential(2)}  max |II diff| ${mi.toExponential(2)}`);
}
// 2. per bot
console.log('\nPer bot, 2020 to Nov 24 2026 (trades exiting after 2020-01-01), unweighted');
const V = {
  'BB live': {}, 'BB II-short only': { iiShort: true, iiLen: 21 }, 'BB ADX>27 half only': { adxTh: 27, adxLen: 14 },
  'BB tweak 1.00x': { iiShort: true, iiLen: 21, adxTh: 27 }, 'BB tweak 1.05x': K.NEW_BB, 'BB tweak 1.15x': { ...K.NEW_BB, mult: 1.15 },
};
for (const [n, o] of Object.entries(V)) line(n, one(K.bbTrades(o)));
line('I-CORE', one(K.icTrades())); line('T-CORE 14', one(K.tcTrades(14))); line('T-CORE 12', one(K.tcTrades(12)));
// 3. portfolio ablation (weighted 50/25/25)
console.log('\nTRI-CORE weighted');
const P = [['Current', {}, 14], ['+ II short filter', V['BB II-short only'], 14], ['+ ADX half', V['BB ADX>27 half only'], 14], ['+ both (1.00x)', V['BB tweak 1.00x'], 14],
  ['+ both 1.05x', K.NEW_BB, 14], ['Current + T12 only', {}, 12], ['NEW (both 1.05x + T12)', K.NEW_BB, 12], ['both 1.00x + T12', V['BB tweak 1.00x'], 12]];
for (const [n, o, k] of P) line(n, K.book(K.portfolio(o, k)));
// 4. equal-exposure benchmark: Current with BB scaled to the tweak's average weight
const avg = one(K.bbTrades(K.NEW_BB)).avgW; console.log('\nBB New average risk multiplier per trade', avg.toFixed(3));
line('Current, BB risk x avgW(New)', K.book(K.portfolio({ mult: avg }, 14)));
line('Current, BB risk x avgW, T12', K.book(K.portfolio({ mult: avg }, 12)));
