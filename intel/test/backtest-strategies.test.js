'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const S = require('../engines/backtest/strategies');
const bb = (c) => ({ time: 0, open: c, high: c + 1, low: c - 1, close: c });

test('bbcore legacy vs v3 parameters', () => {
  const l = S.bot('bbcore', 'legacy').params, v = S.bot('bbcore', 'v3').params;
  assert.equal(l.bbMult, 2); assert.equal(l.maxBars, 48); assert.equal(l.coolBars, 0);
  assert.equal(v.bbMult, 1.8); assert.equal(v.maxBars, 42); assert.equal(v.coolBars, 3);
  assert.equal(S.bot('bbcore').params.bbMult, 1.8, 'default version is v3');
});
test('icore legacy vs v3 parameters', () => {
  const l = S.bot('icore', 'legacy').params, v = S.bot('icore', 'v3').params;
  assert.equal(l.kInit, 2); assert.equal(l.lockAtR, 0); assert.equal(v.kInit, 1.75); assert.equal(v.lockAtR, 4);
});
test('tcore legacy vs v3 parameters', () => {
  assert.equal(S.bot('tcore', 'legacy').params.bbLen, 20); assert.equal(S.bot('tcore', 'v3').params.bbLen, 30);
});
test('bot(): extra overrides win over the version', () => {
  assert.equal(S.bot('bbcore', 'legacy', { bbMult: 3 }).params.bbMult, 3);
  assert.equal(S.bot('bbcore', 'v3', { maxBars: 10 }).maxBars, 10);
});
test('rules change cut-off is 2026-11-14 00:00 UTC', () => {
  assert.equal(S.RULES_V3_FROM, Date.UTC(2026, 10, 14, 0) / 1000);
  assert.equal(S.RULES_V3_FROM, 1794614400);
  assert.equal(typeof S.liveRules, 'function');
});
test('bbFade and rsi2 factories return strategy objects with a signal function and params', () => {
  for (const f of [S.bbFade, S.rsi2]) { const s = f(); assert.equal(typeof s.signal, 'function'); assert.equal(typeof s.params, 'object'); assert.equal(s.interval, 14400); }
  assert.equal(S.bbFade({ kInit: 3 }).params.kInit, 3);
  assert.equal(S.rsi2().params.lo, 10);
});

// bbFade: 19 closes at 100, then close 90 at index 20 (window = 19x100 + 90: mean 99.5, pop sd sqrt(4.75+90.25)/... = 2.179, lower band 95.14)
function fadeSeries(last) { const B = []; for (let i = 0; i < 20; i++) B.push(bb(100)); B.push(bb(last)); B.push(bb(100)); return B; }
test('bbFade: close below the lower band => long, above the upper band => short, inside => none', () => {
  const s = S.bbFade();
  assert.deepEqual(s.signal({ B: fadeSeries(90) }, 20), { dir: 1 });
  assert.deepEqual(s.signal({ B: fadeSeries(110) }, 20), { dir: -1 });
  assert.equal(s.signal({ B: fadeSeries(100) }, 20), null);      // flat window: close on the mean, inside the bands
  assert.equal(s.signal({ B: fadeSeries(90) }, 10), null);      // not enough history for the band
  assert.equal(s.signal({ B: fadeSeries(90).slice(0, 21) }, 20), null);   // last bar: no next candle to fill on
});
test('bbFade: no look-ahead, the signal at i ignores later candles', () => {
  const s = S.bbFade(), full = fadeSeries(90);
  full[21] = bb(1000);
  assert.deepEqual(s.signal({ B: full }, 20), s.signal({ B: fadeSeries(90) }, 20));
});

// rsi2: uptrend of +0.1 per candle (RSI 100), then a drop of 1: g = 0.05, l = 0.5 => RS 0.1 => RSI 9.09 < 10, close above the 200 average => long
function rsiCtx(B, strat) { const ctx = { B }; strat.prepare(ctx); return ctx; }
test('rsi2: sharp drop inside an uptrend gives a long (RSI 9.09 hand check)', () => {
  const s = S.rsi2(), B = []; for (let i = 0; i < 230; i++) B.push(bb(i < 225 ? 100 + 0.1 * i : i === 225 ? 100 + 0.1 * 224 - 1 : 100 + 0.1 * 224 - 1));
  const ctx = rsiCtx(B, s);
  assert.ok(Math.abs(ctx.rsi[224] - 100) < 1e-9);
  assert.ok(Math.abs(ctx.rsi[225] - (100 - 100 / 1.1)) < 1e-6, 'rsi ' + ctx.rsi[225]);
  assert.deepEqual(s.signal(ctx, 225), { dir: 1 });
  assert.equal(s.signal(ctx, 224), null);                       // RSI 100 but close above the average: no short
});
test('rsi2: sharp jump inside a downtrend gives a short (RSI 90.9)', () => {
  const s = S.rsi2(), B = []; for (let i = 0; i < 230; i++) B.push(bb(i < 225 ? 200 - 0.1 * i : 200 - 0.1 * 224 + 1));
  const ctx = rsiCtx(B, s);
  assert.ok(Math.abs(ctx.rsi[225] - (100 - 100 / 11)) < 1e-6, 'rsi ' + ctx.rsi[225]);
  assert.deepEqual(s.signal(ctx, 225), { dir: -1 });
});
test('rsi2: needs 200 candles for the average; flat series gives no signal', () => {
  const s = S.rsi2(), B = Array.from({ length: 230 }, () => bb(100)), ctx = rsiCtx(B, s);
  assert.equal(s.signal(ctx, 100), null); assert.equal(s.signal(ctx, 210), null);
});
test('rsi2: no look-ahead, prepare and signal at i do not change when later candles change', () => {
  const s = S.rsi2(), A = []; for (let i = 0; i < 230; i++) A.push(bb(i < 225 ? 100 + 0.1 * i : 121.4));
  const B2 = A.map((c, i) => (i > 225 ? bb(5) : c));
  assert.deepEqual(s.signal(rsiCtx(A, s), 225), s.signal(rsiCtx(B2, s), 225));
});
