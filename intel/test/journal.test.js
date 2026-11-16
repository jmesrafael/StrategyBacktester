'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const J = require('../engines/journal');
const M = require('../lib/market');

test('journal exports build, run, report, rAt', () => {
  assert.deepEqual(Object.keys(J).sort(), ['build', 'report', 'rAt', 'run'].sort());
});

// build/run/report need the real market dataset (lib/market.js reads the real candle library path from config),
// so they are covered by end-to-end.test.js. Only the pure rAt is tested here, with M.priceAt stubbed.
function withPrice(fn, body) { const orig = M.priceAt; M.priceAt = fn; try { return body(); } finally { M.priceAt = orig; } }
const short = { coin: 'SOL', dir: -1, entry_s: 100, exit_s: null, entry_price: 100, one_r: 5, r: null };

test('rAt: a short that moved in its favour is positive: -1 x (90 - 100) / 5 = +2', () => {
  assert.equal(withPrice(() => 90, () => J.rAt(short, 150)), 2);
  assert.equal(withPrice(() => 105, () => J.rAt(short, 150)), -1);
});
test('rAt: before entry the trade is worth 0 (price is not even asked)', () => {
  assert.equal(withPrice(() => { throw new Error('should not be called'); }, () => J.rAt(short, 99)), 0);
});
test('rAt: long uses the same formula with dir 1', () => {
  assert.equal(withPrice(() => 110, () => J.rAt({ ...short, dir: 1 }, 150)), 2);
});
test('rAt: a closed trade returns its recorded R from exit_s on, whatever the price', () => {
  const t = { ...short, exit_s: 200, r: 1.7 };
  assert.equal(withPrice(() => 1, () => J.rAt(t, 200)), 1.7);
  assert.equal(withPrice(() => 1, () => J.rAt(t, 5000)), 1.7);
  assert.equal(withPrice(() => 90, () => J.rAt(t, 199)), 2);      // still open one second before the exit
});
test('rAt: an open trade with no known price is 0', () => {
  assert.equal(withPrice(() => null, () => J.rAt(short, 150)), 0);
});
test('rAt: no look-ahead, the price is asked for exactly time T', () => {
  const asked = []; withPrice((c, T) => { asked.push([c, T]); return 100; }, () => J.rAt(short, 150));
  assert.deepEqual(asked, [['SOL', 150]]);
});
