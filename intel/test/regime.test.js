'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const R = require('../engines/regime');
const U = require('../lib/util');
const H = 3600, T0 = 1600000000 - (1600000000 % H);
const row = (i, c) => [T0 + i * H, c, c + 0.01, c - 0.01, c, 100];

test('exports', () => {
  for (const k of ['series', 'regimeAt', 'coinRegimeAt', 'marketAt', 'validate', 'build', 'run']) assert.equal(typeof R[k], 'function', k);
  assert.equal(R.MIN_CANDLES, 805);
});
const uptrend = (n) => Array.from({ length: n }, (_, i) => row(i, 100 + 0.1 * i + (i % 2 ? 0.0005 : -0.0005)));
const zigzag = (n) => Array.from({ length: n }, (_, i) => row(i, i % 2 ? 101 : 100));

test('regimeAt is null below MIN_CANDLES bars and defined from MIN_CANDLES on', () => {
  const S = R.series(uptrend(900));
  assert.equal(R.regimeAt(S, R.MIN_CANDLES - 2), null);
  assert.equal(R.regimeAt(S, 10), null);
  assert.notEqual(R.regimeAt(S, R.MIN_CANDLES - 1), null);
});
test('straight-line uptrend: trending_up, er48 close to 1, positive trend_pct', () => {
  const g = R.regimeAt(R.series(uptrend(900)), 899);
  assert.equal(g.state, 'trending_up');
  assert.ok(g.er48 > 0.95, 'er48 ' + g.er48);
  assert.ok(g.trend_pct > 0);
});
test('straight-line downtrend: trending_down', () => {
  const rows = Array.from({ length: 900 }, (_, i) => row(i, 200 - 0.1 * i + (i % 2 ? 0.0005 : -0.0005)));
  assert.equal(R.regimeAt(R.series(rows), 899).state, 'trending_down');
});
test('mean-reverting zigzag around a flat level is not trending (er48 = 1/47 hand check)', () => {
  const g = R.regimeAt(R.series(zigzag(900)), 899);
  assert.ok(!g.state.startsWith('trending'), g.state);
  assert.ok(Math.abs(g.er48 - 1 / 47) < 0.001, 'er48 ' + g.er48);
});
test('no look-ahead: regimeAt on the full series equals regimeAt on the series cut at i', () => {
  const rnd = U.rng(11); let p = 100; const rows = [];
  for (let i = 0; i < 1000; i++) { p *= 1 + (rnd() - 0.5) * 0.02; rows.push([T0 + i * H, p, p * 1.003, p * 0.997, p, 1]); }
  const full = R.series(rows);
  for (const i of [R.MIN_CANDLES - 1, 850, 999]) assert.deepEqual(R.regimeAt(full, i), R.regimeAt(R.series(rows.slice(0, i + 1)), i), 'i=' + i);
});
test('coinRegimeAt uses the last bar closed at or before T', () => {
  const S = R.series(uptrend(900)), T = T0 + 880 * H;     // bar 879 closes at T
  assert.deepEqual(R.coinRegimeAt(S, T), R.regimeAt(S, 879));
  assert.equal(R.coinRegimeAt(S, T0 + 5000 * H), null);   // bar missing
});

// ---- validate ----
const CUT = Date.UTC(2024, 0, 1) / 1000, DAY = 86400;
function mk(spec) {   // spec: { pre: {A: [n, r], ...}, post: {...} }
  const out = []; let k = 0;
  for (const [s, [n, r]] of Object.entries(spec.pre)) for (let i = 0; i < n; i++) out.push({ t: CUT - (++k) * DAY, r, st: s });
  k = 0;
  for (const [s, [n, r]] of Object.entries(spec.post)) for (let i = 0; i < n; i++) out.push({ t: CUT + (k++) * DAY, r, st: s });
  return out;
}
test('validate: the state best before 2024 is also best after => validated (hand check: spread +2, p 0)', () => {
  const tr = mk({ pre: { A: [20, 1], B: [20, 0], C: [20, -1] }, post: { A: [30, 1], B: [20, 0], C: [30, -1] } });
  const v = R.validate(tr, 'st');
  assert.deepEqual(v.rows.map((x) => x.state), ['A', 'B', 'C']);
  assert.deepEqual(v.best, ['A']); assert.deepEqual(v.worst, ['C']);
  assert.equal(v.pre_spread, 2); assert.equal(v.spread, 2); assert.equal(v.p, 0); assert.equal(v.verdict, 'validated');
});
test('validate: ranking reverses after 2024 => not validated (spread -2, p 1)', () => {
  const tr = mk({ pre: { A: [20, 1], B: [20, 0], C: [20, -1] }, post: { A: [30, -1], B: [20, 0], C: [30, 1] } });
  const v = R.validate(tr, 'st');
  assert.equal(v.spread, -2); assert.equal(v.p, 1); assert.equal(v.verdict, 'not validated');
});
test('validate: tiny list, too few states, too few later trades => not enough data', () => {
  assert.equal(R.validate([{ t: CUT - 1, r: 1, st: 'A' }], 'st').verdict, 'not enough data');
  assert.equal(R.validate([], 'st').verdict, 'not enough data');
  const two = mk({ pre: { A: [20, 1], B: [20, 0] }, post: { A: [40, 1], B: [40, 0] } });
  assert.equal(R.validate(two, 'st').verdict, 'not enough data');                       // only 2 states
  const fewPost = mk({ pre: { A: [20, 1], B: [20, 0], C: [20, -1] }, post: { A: [10, 1], C: [10, -1] } });
  assert.equal(R.validate(fewPost, 'st').verdict, 'not enough data');                   // 20 post trades < 60
});
test('validate: states with fewer than 20 trades before 2024 are dropped from the ranking', () => {
  const tr = mk({ pre: { A: [20, 1], B: [20, 0], C: [20, -1], D: [19, 5] }, post: { A: [30, 1], B: [20, 0], C: [30, -1] } });
  assert.deepEqual(R.validate(tr, 'st').rows.map((x) => x.state), ['A', 'B', 'C']);
});
test('validate is deterministic', () => {
  const tr = mk({ pre: { A: [20, 1], B: [20, 0.2], C: [20, -1] }, post: { A: [30, 0.3], B: [20, 0.1], C: [30, -0.2] } });
  assert.deepEqual(R.validate(tr, 'st'), R.validate(tr, 'st'));
});
