'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { checkSeries } = require('../ingest/candles');

const T0 = 1700000000 - (1700000000 % 14400);   // aligned to 4h
const bar = (t, o = 100, h = 101, l = 99, c = 100.5, v = 10) => [t, o, h, l, c, v];
const series = (times, tf = 3600) => times.map((i) => bar(T0 + i * tf));

test('clean 1h series has no faults, gaps or missing bars', () => {
  assert.deepEqual(checkSeries(series([0, 1, 2, 3, 4]), '1h'), { faults: [], gaps: 0, missing: 0 });
});
test('clean 4h series', () => {
  assert.deepEqual(checkSeries(series([0, 1, 2], 14400), '4h'), { faults: [], gaps: 0, missing: 0 });
});
test('a single bar is clean; empty or non-array is a fault', () => {
  assert.deepEqual(checkSeries(series([0]), '1h'), { faults: [], gaps: 0, missing: 0 });
  assert.deepEqual(checkSeries([], '1h').faults, ['empty or not an array']);
  assert.deepEqual(checkSeries({}, '1h').faults, ['empty or not an array']);
});
test('gaps: counts gaps and missing bars (golden: 1 gap of 1 bar + 1 gap of 3 bars)', () => {
  // hours 0,1,3 (one missing: hour 2), then 7 (hours 4,5,6 missing)
  const r = checkSeries(series([0, 1, 3, 7]), '1h');
  assert.deepEqual(r, { faults: [], gaps: 2, missing: 4 });
  assert.deepEqual(checkSeries(series([0, 1, 2], 14400).filter((_, i) => i !== 1), '4h'), { faults: [], gaps: 1, missing: 1 });
});
test('duplicate and out-of-order times are faults', () => {
  const dup = checkSeries(series([0, 1, 1, 2]), '1h');
  assert.equal(dup.faults.length, 1);
  assert.match(dup.faults[0], /out of order or duplicate at /);
  const ooo = checkSeries(series([0, 2, 1, 3]), '1h');
  assert.equal(ooo.faults.length, 1);
  assert.match(ooo.faults[0], /out of order or duplicate/);
});
test('bad OHLC: high below close, low above open, zero price, negative volume, non-finite', () => {
  const t = T0;
  assert.match(checkSeries([bar(t, 100, 99, 98, 100)], '1h').faults[0], /bad OHLC at /);        // high 99 < open/close 100
  assert.match(checkSeries([bar(t, 100, 101, 99, 102)], '1h').faults[0], /bad OHLC/);            // high 101 < close 102
  assert.match(checkSeries([bar(t, 100, 102, 100.5, 101)], '1h').faults[0], /bad OHLC/);         // low above open
  assert.match(checkSeries([bar(t, 0, 1, 0, 0.5)], '1h').faults[0], /bad OHLC/);                 // zero price
  assert.match(checkSeries([bar(t, 100, 101, 0, 100)], '1h').faults[0], /bad OHLC/);             // zero low
  assert.match(checkSeries([bar(t, 100, 101, 99, 100, -1)], '1h').faults[0], /bad OHLC/);        // negative volume
  assert.match(checkSeries([bar(t, NaN, 101, 99, 100)], '1h').faults[0], /bad OHLC/);
  assert.deepEqual(checkSeries([bar(t, 100, 101, 99, 100, 0)], '1h').faults, []);                // zero volume is fine
  assert.deepEqual(checkSeries([bar(t, 100, 100, 100, 100)], '1h').faults, []);                  // flat bar is fine
});
test('bad OHLC fault names the bar time (UTC)', () => {
  assert.equal(checkSeries([bar(1700000000, 0, 1, 0, 0.5)], '1h').faults[0], 'bad OHLC at 2023-11-14 22:13');
});
test('fault list stops growing after 6 faults', () => {
  const bad = Array.from({ length: 20 }, (_, i) => bar(T0 + i * 3600, 0, 1, 0, 1));
  assert.equal(checkSeries(bad, '1h').faults.length, 6);
});
test('funding series: irregular spacing is not a gap; order and duplicates still checked; no OHLC check', () => {
  const ok = [[T0, 0.0001], [T0 + 28800, -0.0002], [T0 + 28800 + 3600, 0]];
  assert.deepEqual(checkSeries(ok, 'funding'), { faults: [], gaps: 0, missing: 0 });
  const dup = checkSeries([[T0, 0.0001], [T0, 0.0001]], 'funding');
  assert.match(dup.faults[0], /out of order or duplicate/);
  const ooo = checkSeries([[T0 + 100, 0.0001], [T0, 0.0001]], 'funding');
  assert.equal(ooo.faults.length, 1);
});
test('a non-numeric time does not crash the checker', {}, () => {
  const r = checkSeries([['abc', 1, 1, 1, 1, 1]], '1h');
  assert.match(r.faults[0], /bad OHLC/);
});
