// h.js - shared test bench for "more return AND smaller fall" (Nov 27, 2026). Causal engine, live rules, US$500 risk cap.
//   const H = require('./h.js'); H.evaluate({ spec, sizeFn, coins, weights, K, ... }, 'label')  -> row (also printed)
// A candidate is any set of extra run() options (see causal.js header). sizeFn must be a FACTORY: () => (ctx) => mult, so each
// test run gets fresh state. Engine path can be swapped with opts.engine (a copied engine module) for families that need more ctx.
'use strict';
const fs = require('fs');
const X0 = require('../improve-nov27/opus-validate/causal');
const LIVE = { mode: 'live', start: 600, cap: 500 }, FLAT = { mode: 'flat', start: 1000 };
const TESTS = [
  ['live full 2020-Nov26', LIVE, 'T0', 'END', {}],
  ['live fresh 2024', LIVE, 'CUT', 'END', {}],
  ['flat 2020-23 (pick here)', FLAT, 'T0', 'CUT', {}],
  ['flat 2024-26 (unseen)', FLAT, 'CUT', 'END', {}],
  ['live double costs', LIVE, 'T0', 'END', { cost: 2 }],
  ['live fills 1h late', LIVE, 'T0', 'END', { delayH: 1 }],
];
function one(c, k, X = c.engine || X0) {
  const [, acc, a, b, extra] = TESTS[k], o = { ...acc, ...c, from: X[a], to: X[b], ...extra };
  delete o.engine; delete o.label; if (c.sizeFn) o.sizeFn = c.sizeFn();
  const r = X.run(o), s = X.stats(r); return { cagr: s.cagr, dd: s.dd, end: s.end, n: r.trades.length };
}
const BF = __dirname + '/base.json';
let BASE = fs.existsSync(BF) ? JSON.parse(fs.readFileSync(BF)) : null;
function base() { if (!BASE) { BASE = TESTS.map((_, k) => one({}, k)); fs.writeFileSync(BF, JSON.stringify(BASE)); } return BASE; }
const p = (v) => (100 * v).toFixed(1);
// pass on a test = higher growth AND smaller fall than live TRI-CORE
function evaluate(c, label, tests = TESTS.map((_, k) => k)) {
  const B = base(), res = {}, pass = {};
  for (const k of tests) { res[k] = one(c, k); pass[k] = res[k].cagr > B[k].cagr && res[k].dd < B[k].dd; }
  const n = Object.values(pass).filter(Boolean).length;
  const line = `${n}/${tests.length} ${String(label).padEnd(34)} ` + tests.map((k) => `${pass[k] ? 'Y' : '.'}${p(res[k].cagr)}/${p(res[k].dd)}`).join('  ');
  console.log(line); return { label, res, pass, n, line };
}
module.exports = { evaluate, base, TESTS, X: X0, p };
if (require.main === module) {
  const B = base(); TESTS.forEach(([n], k) => console.log(`${n.padEnd(26)} growth/yr ${p(B[k].cagr)}%  fall ${p(B[k].dd)}%  end ${Math.round(B[k].end)}  trades ${B[k].n}`));
  console.log('\nsize-only frontier (K): a real improvement must beat these, not just the K=1 row');
  for (const K of [0.8, 0.9, 1.1, 1.2]) evaluate({ K }, 'K=' + K);
}
// fitK: the ONLY allowed scaling. Picks K on flat 2020-23 alone so that its worst fall = baseline's minus 2 points (54.1 -> 52.1),
// then the candidate is judged with that K on all 6 tests. Bisection, 7 steps, K in [0.5, 2].
function fitK(c, target = base()[2].dd - 0.02) {
  let lo = 0.5, hi = 2;
  for (let i = 0; i < 7; i++) { const K = (lo + hi) / 2, r = one({ ...c, K: (c.K || 1) * K }, 2); if (r.dd > target) hi = K; else lo = K; }
  return (c.K || 1) * lo;
}
module.exports.fitK = fitK;
