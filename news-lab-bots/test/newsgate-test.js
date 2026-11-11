// node --test news-lab-bots/test/newsgate-test.js — the news gate client (pure decide + fail-open fetch)
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { decide, fetchSignal, STALE_MS } = require('../newsgate.js');

const NOW = Date.UTC(2026, 10, 11, 12);
const sig = (coins, updated = NOW) => ({ version: 1, updated, coins });
const UNAV = { veto: false, mult: 1, reason: 'news: unavailable', reasons: [], source: 'unavailable' };

test('allow -> no veto, size 1, source signal', () => {
  assert.deepEqual(decide(sig({ SOL: { long: { allow: true, size: 1, reasons: [] }, short: { allow: true, size: 1, reasons: [] } } }), 'SOL', 1, NOW),
    { veto: false, mult: 1, reason: null, reasons: [], source: 'signal' });
});
test('veto -> veto with the reasons joined', () => {
  const d = decide(sig({ ZEC: { long: { allow: false, size: 0, reasons: ['blackout: CPI m/m in 2h', 'market hack: X $120M'] }, short: { allow: true, size: 1, reasons: [] } } }), 'ZEC', 1, NOW);
  assert.equal(d.veto, true); assert.equal(d.mult, 0); assert.equal(d.source, 'signal');
  assert.equal(d.reason, 'blackout: CPI m/m in 2h; market hack: X $120M');
});
test('direction is respected: a vetoed long does not veto the short', () => {
  const s = sig({ SOL: { long: { allow: false, size: 0, reasons: ['r'] }, short: { allow: true, size: 1, reasons: [] } } });
  assert.equal(decide(s, 'SOL', 1, NOW).veto, true);
  assert.equal(decide(s, 'SOL', -1, NOW).veto, false);
});
test('shrink -> mult = size (only 0 < size <= 1 is honoured)', () => {
  const mk = (size) => decide(sig({ SOL: { long: { allow: true, size, reasons: [] } } }), 'SOL', 1, NOW);
  assert.equal(mk(0.5).mult, 0.5); assert.equal(mk(0.5).reason, 'size x0.5');
  assert.equal(mk(2).mult, 1); assert.equal(mk(-1).mult, 1); assert.equal(mk('x').mult, 1); assert.equal(mk(0).mult, 1);
});
test('fail-open: null, junk, unknown coin, missing side, stale, future-dated', () => {
  assert.deepEqual(decide(null, 'SOL', 1, NOW), UNAV);
  assert.deepEqual(decide({}, 'SOL', 1, NOW), UNAV);
  assert.deepEqual(decide('x', 'SOL', 1, NOW), UNAV);
  assert.deepEqual(decide(sig({}), 'SOL', 1, NOW), UNAV);
  assert.deepEqual(decide(sig({ SOL: { long: { allow: 'no' } } }), 'SOL', 1, NOW), UNAV);
  assert.deepEqual(decide(sig({ SOL: { short: { allow: false } } }), 'SOL', 1, NOW), UNAV);
  const veto = { SOL: { long: { allow: false, size: 0, reasons: ['x'] } } };
  assert.deepEqual(decide(sig(veto, NOW - STALE_MS - 1), 'SOL', 1, NOW), UNAV);       // older than 6 h
  assert.equal(decide(sig(veto, NOW - STALE_MS + 60000), 'SOL', 1, NOW).veto, true);  // just inside 6 h
  assert.deepEqual(decide(sig(veto, NOW + 3600e3), 'SOL', 1, NOW), UNAV);              // clock nonsense
  assert.deepEqual(decide(sig(veto, 'x'), 'SOL', 1, NOW), UNAV);
  assert.deepEqual(decide(sig(veto), 'SOL', 0, NOW), UNAV);
});
test('reasons are capped (5 items, 120 chars) and stringified', () => {
  const d = decide(sig({ SOL: { long: { allow: false, reasons: [1, 2, 3, 4, 5, 6, 'y'.repeat(300)] } } }), 'SOL', 1, NOW);
  assert.deepEqual(d.reasons, ['1', '2', '3', '4', '5']);
});
test('fetchSignal: never throws; null on HTTP error, bad JSON, network error, no coins', async () => {
  const ok = (body, okFlag = true) => async () => ({ ok: okFlag, json: async () => body });
  assert.deepEqual(await fetchSignal({ fetchImpl: ok({ updated: 1, coins: {} }) }), { updated: 1, coins: {} });
  assert.equal(await fetchSignal({ fetchImpl: ok({ updated: 1, coins: {} }, false) }), null);
  assert.equal(await fetchSignal({ fetchImpl: ok({ updated: 1 }) }), null);
  assert.equal(await fetchSignal({ fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }) }), null);
  assert.equal(await fetchSignal({ fetchImpl: async () => { throw new Error('ECONNRESET'); } }), null);
  // a hanging server: the abort signal (timeoutMs) ends the wait and the result is null
  const hang = (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  assert.equal(await fetchSignal({ fetchImpl: hang, timeoutMs: 50 }), null);
});
test('fetchSignal uses NEWS_SIGNAL_URL when set', async () => {
  let seen = null; process.env.NEWS_SIGNAL_URL = 'https://example.invalid/sig';
  await fetchSignal({ fetchImpl: async (u) => { seen = u; return { ok: false }; } });
  delete process.env.NEWS_SIGNAL_URL;
  assert.equal(seen, 'https://example.invalid/sig');
});
