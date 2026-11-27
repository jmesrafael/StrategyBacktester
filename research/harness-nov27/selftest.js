// selftest.js: reproduce ICHI-X4 (hunt-4h-nov26 REPORT/validate-b12: MAIN 1x R 381, DD 30, ex10 298, 7/7; 2x R 283, DD 41) via checkStrategy.
'use strict';
const F = require('../hunt-4h-nov26/fam.js'), { checkStrategy, monthlyCorrelation, tradeOverlap } = require('./checks.js');
const cand = { fam: 'ichi', p: { t: 9, k: 26, s: 52, mode: 'cross' }, trend: 0, exit: { k: 2, bars: 12 } };
const r = checkStrategy({ strat: (c) => F.build(c, cand), exFn: F.exOf(cand), tf: '4h', auditId: 'ICHI-X4', auditCuts: 12 });
console.log(r.text);
const exp = [['1x R', r.x1.total, 381], ['1x DD', r.x1.dd, 30], ['1x ex10', r.x1.ex10, 298], ['1x yrs+', r.x1.posYears, 7],
  ['2x R', r.x2.total, 283], ['2x DD', r.x2.dd, 41], ['2x yrs+', r.x2.posYears, 7], ['audit mismatches', r.audit.mismatches, 0]];
let ok = true;
for (const [k, got, want] of exp) { const m = Math.round(got) === want; ok = ok && m; console.log(`${m ? 'OK  ' : 'DIFF'} ${k}: got ${got.toFixed(2)} expected ${want}`); }
console.log('self-overlap', tradeOverlap(r.trades, r.trades).toFixed(2), 'self-corr', monthlyCorrelation(r.trades, r.trades).toFixed(2));

// 1h case: BB-1H-WIDE (hunt-1h-nov26/validate.txt: MAIN 1x R 1157, DD 67, worst yr +89, 7/7; 2x R 1046 DD 71; audit 0 mismatches)
const V = require('../hunt-1h-nov26/fam-vol.js'), P = { len: 80, mult: 2.6, trend: 800, minStop: 0.3, filt: null }, E = { kind: 'M', bars: 192 };
const r1 = checkStrategy({ strat: V.strat(P, E), exFn: V.mkEx(E), tf: '1h', auditId: 'BB-1H-WIDE', auditCuts: 12 });
console.log(r1.text);
const worst = Math.min(...Object.values(r1.x1.years));
for (const [k, got, want] of [['1h 1x R', r1.x1.total, 1157], ['1h 1x DD', r1.x1.dd, 67], ['1h worst yr', worst, 89], ['1h 1x yrs+', r1.x1.posYears, 7],
  ['1h 1x ex10', r1.x1.ex10, 894], ['1h 2x R', r1.x2.total, 1046], ['1h 2x DD', r1.x2.dd, 71], ['1h audit mismatches', r1.audit.mismatches, 0]]) {
  const m = Math.round(got) === want; ok = ok && m; console.log(`${m ? 'OK  ' : 'DIFF'} ${k}: got ${got.toFixed(2)} expected ${want}`); }
console.log(ok ? 'SELFTEST PASS' : 'SELFTEST DIFFERENCES');
process.exit(ok ? 0 : 1);
