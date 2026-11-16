'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../engines/backtest/engine');
const U = require('../lib/util');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

// 20 bars, close 100, low 99, high 100+h. TR(i) = h+1 for every bar (prev close 100 so |high-pc| = h, |low-pc| = 1).
// h = 1,2,3,4,5 then 1 for the rest => TR = 2,3,4,5,6,2,2,2...
const H_ = [1, 2, 3, 4, 5, ...new Array(15).fill(1)];
const SERIES = H_.map((h, i) => ({ time: i * 3600, open: 100, high: 100 + h, low: 99, close: 100 }));

test('atrA len 5: null before index 4, seed at index 4 = mean of TR0..4 (TR0 = high-low) = 4', () => {
  const a = E.atrA(SERIES, 5);
  for (let i = 0; i < 4; i++) assert.equal(a[i], null);
  near(a[4], 4);
  near(a[5], (4 * 4 + 2) / 5);          // 3.6
  near(a[6], (3.6 * 4 + 2) / 5);        // 3.28
});
test('atrB len 5: null before index 5, seed at index 5 = mean of TR1..5 = (3+4+5+6+2)/5 = 4', () => {
  const b = E.atrB(SERIES, 5);
  for (let i = 0; i < 5; i++) assert.equal(b[i], null);
  near(b[5], 4);
  near(b[6], 3.6);
});
test('atr default len 14: A seeds at index 13, B at index 14, both 38/14 on this series', () => {
  const a = E.atrA(SERIES), b = E.atrB(SERIES);
  assert.equal(a[12], null); near(a[13], 38 / 14);
  assert.equal(b[13], null); near(b[14], 38 / 14);
});
test('atr: too few candles gives all null', () => {
  assert.deepEqual(E.atrA(SERIES.slice(0, 3), 5), [null, null, null]);
  assert.deepEqual(E.atrB(SERIES.slice(0, 5), 5), [null, null, null, null, null]);
});

test('bands: closes 1..5, len 5 mult 2: mid 3, population sd sqrt(2)', () => {
  const B = [1, 2, 3, 4, 5].map((c, i) => ({ time: i, open: c, high: c, low: c, close: c }));
  const b = E.bands(B, 4, 5, 2, 0);
  near(b.mid, 3); near(b.sd, Math.SQRT2); near(b.up, 3 + 2 * Math.SQRT2); near(b.lo, 3 - 2 * Math.SQRT2); assert.equal(b.sma, null);
  near(E.bands(B, 4, 5, 2, 5).sma, 3);
  near(E.bands(B, 4, 3, 1, 2).sma, 4.5);        // trend over the last 2 closes
  assert.equal(E.bands(B, 3, 5, 2, 0), null);   // not enough bars
  assert.equal(E.bands(B, 4, 5, 2, 6), null);   // trend window longer than history
});
test('hlMid: midpoint of highest high and lowest low of the n bars ending at end', () => {
  const B = [[10, 5], [12, 6], [11, 4], [9, 7]].map(([h, l], i) => ({ time: i, open: l, high: h, low: l, close: l }));
  assert.equal(E.hlMid(B, 3, 3), (12 + 4) / 2);
  assert.equal(E.hlMid(B, 3, 1), 8);
  assert.equal(E.hlMid(B, 1, 2), (12 + 5) / 2);
  assert.ok(Number.isNaN(E.hlMid(B, 1, 3)));
});

test('standardCost R: long 100->102, 10 bars, dist 0.02 = (0.02 - 0.001 - 0.0005)/0.02 = 0.925', () => {
  const c = E.standardCost();
  near(c.R({ dir: 1, entry: 100, exit: 102, dist: 0.02, bars: 10, t: 0, tExit: 1 }), 0.925);
});
test('standardCost R: short 100->98 gives the same 0.925, short 100->101 gives -0.575', () => {
  const c = E.standardCost();
  near(c.R({ dir: -1, entry: 100, exit: 98, dist: 0.02, bars: 10, t: 0, tExit: 1 }), 0.925);
  near(c.R({ dir: -1, entry: 100, exit: 101, dist: 0.02, bars: 10, t: 0, tExit: 1 }), (-0.01 - 0.001 - 0.0005) / 0.02);
});
test('standardCost: slippage on fills, scale doubles fee, slip and funding', () => {
  const c = E.standardCost();
  near(c.entryFill(100, 1), 100.02); near(c.entryFill(100, -1), 99.98);
  near(c.exitFill(102, 1), 102 * (1 - 0.0002)); near(c.exitFill(98, -1), 98 * (1 + 0.0002));
  const c2 = E.standardCost({ scale: 2 });
  near(c2.R({ dir: 1, entry: 100, exit: 102, dist: 0.02, bars: 10, t: 0, tExit: 1 }), (0.02 - 0.002 - 0.001) / 0.02);
});
test('standardCost with a real funding series: only rates in (t, tExit] count, paid by longs, received by shorts', () => {
  const F = [[50, 0.001], [150, 0.001], [200, 0.001], [250, 0.5]];
  const c = E.standardCost({ funding: F });
  const base = { entry: 100, exit: 102, dist: 0.02, bars: 3, t: 100, tExit: 200 };
  near(c.R({ ...base, dir: 1 }), (0.02 - 0.001 - 0.002) / 0.02);            // rates at 150 and 200
  near(c.R({ ...base, dir: -1, exit: 98 }), (0.02 - 0.001 + 0.002) / 0.02);
});
test('freeCost: no fees at all, long 100->102 dist 0.02 = 1R', () => {
  const c = E.freeCost();
  near(c.R({ dir: 1, entry: 100, exit: 102, dist: 0.02 }), 1);
  near(c.R({ dir: -1, entry: 100, exit: 102, dist: 0.02 }), -1);
  assert.equal(c.entryFill(5, 1), 5); assert.equal(c.exitFill(5, -1), 5);
});

// ---------- run() on tiny hand-built candles ----------
const bar = (i, o = 100, h = 101, l = 99, c = 100, time = i * 3600) => ({ time, open: o, high: h, low: l, close: c });
function strat(over = {}) {
  const { sig = 3, dir = 1, stop = 98, ...rest } = over;
  return { name: 'fixed', params: {}, interval: 3600, atr: 'A', atrLen: 3, warmup: 3, gapLookback: 3, stopMode: 'level', timeExit: 'nextOpen', maxBars: 2, coolBars: 0, kTrail: 0,
    signal: (ctx, i) => (i === sig ? { dir, stop } : null), ...rest };
}
const flat = (n) => Array.from({ length: n }, (_, i) => bar(i));

test('run: order decided at the signal close fills at the NEXT bar open (free costs)', () => {
  const B = flat(10); B[4] = bar(4, 101, 102, 100, 101);
  const r = E.run(B, strat({ maxBars: 0 }), E.freeCost());
  assert.equal(r.open.i0, 4);
  assert.equal(r.open.entry, 101);                     // bar 4 open, not bar 3 close (100)
  assert.equal(r.open.sigT, 3 * 3600); assert.equal(r.open.t, 4 * 3600);
  near(r.open.dist, 3 / 101);
  assert.equal(r.trades.length, 0);
});
test('run: no signal before warmup; a signal on the last bar stays a pending setup', () => {
  const r = E.run(flat(4), strat({ sig: 3 }), E.freeCost());
  assert.equal(r.trades.length, 0); assert.equal(r.open, null); assert.equal(r.setup.dir, 1); assert.equal(r.setup.stop, 98); assert.equal(r.setup.sig, 3);
  assert.equal(E.run(flat(10), strat({ sig: 2 }), E.freeCost()).setup, null);   // i < warmup
});
test('run: stop and a better price touched in the same bar exits at the STOP (worst case)', () => {
  const B = flat(10); B[4] = bar(4, 101, 105, 97, 101);
  const t = E.run(B, strat(), E.freeCost()).trades[0];
  assert.equal(t.why, 'stop'); assert.equal(t.exit, 98); assert.equal(t.i1, 4); assert.equal(t.bars, 1);
  near(t.R, -1);                                       // (98-101)/101 / (3/101)
  assert.equal(t.tExit, 4 * 3600 + 3600);
});
test('run: a gap through the stop exits at the open, not at the stop', () => {
  const B = flat(10); B[4] = bar(4, 101, 102, 100, 101); B[5] = bar(5, 96, 97, 95, 96);
  const t = E.run(B, strat(), E.freeCost()).trades[0];
  assert.equal(t.why, 'stop'); assert.equal(t.exit, 96); assert.equal(t.i1, 5);
  near(t.R, (96 - 101) / 3);
});
test('run: short stop with a gap up exits at the open', () => {
  const B = flat(10); B[4] = bar(4, 99, 100, 98, 99); B[5] = bar(5, 104, 105, 103, 104);
  const t = E.run(B, strat({ dir: -1, stop: 102 }), E.freeCost()).trades[0];
  assert.equal(t.dir, -1); assert.equal(t.entry, 99); assert.equal(t.exit, 104); assert.equal(t.why, 'stop');
});
test('run: time exit happens at the NEXT open after maxBars (golden trade object)', () => {
  const B = flat(12); B[4] = bar(4, 101, 102, 100, 101); B[7] = bar(7, 103, 104, 101, 103);
  const r = E.run(B, strat({ maxBars: 2 }), E.freeCost());
  // entry bar 4; bar 6 is the first close with i - i0 >= 2; exit at the open of bar 7
  assert.equal(r.trades.length, 1); assert.equal(r.open, null);
  const t = r.trades[0];
  assert.deepEqual({ dir: t.dir, i0: t.i0, i1: t.i1, sigT: t.sigT, t: t.t, tLastBar: t.tLastBar, tExit: t.tExit, entry: t.entry, exit: t.exit, stop0: t.stop0, why: t.why, bars: t.bars },
    { dir: 1, i0: 4, i1: 7, sigT: 10800, t: 14400, tLastBar: 25200, tExit: 28800, entry: 101, exit: 103, stop0: 98, why: 'time', bars: 4 });
  near(t.R, (103 - 101) / 3);
});
test('run: standard costs applied to fills (entry slip up for a long)', () => {
  const B = flat(10); B[4] = bar(4, 101, 102, 100, 101);
  const r = E.run(B, strat({ maxBars: 0 }), E.standardCost());
  near(r.open.entry, 101 * 1.0002);
});
test('run: a missing candle inside gapLookback suppresses the signal; the same bars without the gap trade', () => {
  const mk = (gap) => Array.from({ length: 12 }, (_, i) => bar(i, 100, 101, 99, 100, (gap && i >= 6 ? i + 1 : i) * 3600));
  const withGap = E.run(mk(true), strat({ sig: 8, gapLookback: 5 }), E.freeCost());
  assert.equal(withGap.trades.length, 0); assert.equal(withGap.open, null); assert.equal(withGap.setup, null);
  const clean = E.run(mk(false), strat({ sig: 8, gapLookback: 5 }), E.freeCost());
  assert.ok(clean.open, 'control produced a position');
  // gap at 6, signal at 11: 11 - 6 = 5 is not < 5, so the signal is allowed again
  assert.ok(E.run(mk(true), strat({ sig: 11, gapLookback: 5 }), E.freeCost()).setup);
});
test('run: coolBars after a losing trade blocks the next signals', () => {
  const B = flat(14); B[4] = bar(4, 101, 105, 97, 101);
  const sig = (ctx, i) => ((i === 3 || i === 5 || i === 8) ? { dir: 1, stop: 98 } : null);
  const r = E.run(B, strat({ signal: sig, coolBars: 3, maxBars: 0 }), E.freeCost());
  // trade 1 stops out on bar 4 (loss) -> cool until bar 7: the bar-5 signal is ignored, the bar-8 signal is allowed
  assert.equal(r.trades.length, 1); assert.equal(r.open.sig, 8);
});
test('run: atr stop mode uses kInit x ATR as the stop distance', () => {
  const B = Array.from({ length: 12 }, (_, i) => bar(i, 100, 101, 99, 100));   // TR = 2, ATR(3) = 2
  const S = strat({ stopMode: 'atr', atr: 'B', kInit: 1.5, maxBars: 0, signal: (c, i) => (i === 5 ? { dir: 1 } : null) });
  const r = E.run(B, S, E.freeCost());
  assert.equal(r.open.entry, 100); assert.equal(r.open.stop0, 100 - 1.5 * 2); near(r.open.dist, 3 / 100);
});

// ---------- stats ----------
test('stats on a known R list', () => {
  const R = [1, -1, -1, 2, -0.5, -0.5, -0.5, 1], s = E.stats(R.map((x) => ({ R: x })));
  assert.equal(s.n, 8); near(s.totalR, 0.5); near(s.avgR, 0.0625); near(s.winRate, 3 / 8);
  near(s.maxDD, 2);                // equity 1,0,-1,1,.5,0,-.5,.5 with peak 1 -> deepest -1 => 2
  assert.equal(s.maxLossStreak, 3);
  const sd = Math.sqrt(R.reduce((a, r) => a + (r - 0.0625) ** 2, 0) / 7);
  near(s.tStat, 0.0625 / (sd / Math.sqrt(8)));
});
test('stats: empty list and a zero-R trade counts as a loss', () => {
  assert.deepEqual(E.stats([]), { n: 0, totalR: 0, avgR: 0, winRate: 0, maxDD: 0, maxLossStreak: 0, tStat: 0 });
  assert.equal(E.stats([{ R: 0 }, { R: 0 }]).maxLossStreak, 2);
});

// ---------- no look-ahead ----------
test('no look-ahead: running on candles[0..k] gives the same trades that closed before k as the full run', () => {
  const rnd = U.rng(7); let p = 100; const B = [];
  for (let i = 0; i < 400; i++) { const o = p, c = o * (1 + (rnd() - 0.5) * 0.04), h = Math.max(o, c) * (1 + rnd() * 0.01), l = Math.min(o, c) * (1 - rnd() * 0.01); B.push({ time: i * 3600, open: o, high: h, low: l, close: c }); p = c; }
  const S = () => ({ name: 'zig', params: {}, interval: 3600, atr: 'B', atrLen: 5, warmup: 10, gapLookback: 5, stopMode: 'atr', kInit: 1.5, kTrail: 3, lockAtR: 2, lockToR: 0.5, timeExit: 'close', maxBars: 6, coolBars: 1,
    signal: (ctx, i) => (i % 3 === 0 ? { dir: ctx.B[i].close > ctx.B[i - 1].close ? 1 : -1 } : null) });
  const cost = E.standardCost(), full = E.run(B, S(), cost).trades;
  assert.ok(full.length > 20, 'enough trades to be meaningful: ' + full.length);
  for (const k of [60, 120, 200, 301, 399]) {
    const part = E.run(B.slice(0, k + 1), S(), cost).trades;
    assert.deepEqual(part, full.filter((t) => t.i1 <= k), 'cut at ' + k);
  }
});
test('run is deterministic', () => {
  const B = Array.from({ length: 40 }, (_, i) => bar(i, 100 + (i % 2), 103, 98, 100 + ((i + 1) % 2)));
  const S = strat({ atr: 'B', stopMode: 'atr', kInit: 1, maxBars: 3, timeExit: 'close', warmup: 5, signal: (c, i) => (i % 4 === 1 ? { dir: 1 } : null) });
  assert.deepEqual(E.run(B, S, E.standardCost()), E.run(B, S, E.standardCost()));
});
