// node --test test/recorder-test.js  -  the recorder's pieces, offline: regime, order-book stats, the archive, the MEXC client, the dashboard heartbeat (against the dashboard's own validator).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
process.env.RECORDER_DIR = tmp();                         // before recorder.js is loaded

const regime = require('../regime.js'), bs = require('../bookstats.js'), { createArchive, holesIn } = require('../archive.js'), { createClient } = require('../mexcpub.js'), push = require('../push.js');
const schema = require('../../LEDGER/lib/schema.js'), signature = require('../../LEDGER/lib/signature.js');

const H = 3600, T0 = 1700000000 - (1700000000 % H);
const candles = (n, f) => Array.from({ length: n }, (_, i) => { const c = f(i); return [T0 + i * H, c.o ?? c, (c.h ?? c) + 0.01, (c.l ?? c) - 0.01, c.c ?? c, 1000]; });
const noise = (i) => 100 + Math.sin(i / 2) * 0.15 + Math.sin(i / 7) * 0.1;

// ---------------- regime ----------------
test('regime: a steady climb is trending_up, a flat wobble is not', () => {
  const up = regime.coinRegime(candles(1000, (i) => 100 + i * 0.05)), flat = regime.coinRegime(candles(1000, noise));
  assert.equal(up.state, 'trending_up'); assert.ok(up.er48 > 0.9 && up.trend_pct > 0);
  assert.notEqual(flat.state, 'trending_up'); assert.notEqual(flat.state, 'trending_down'); assert.ok(flat.er48 < 0.3);
});
test('regime: a steady fall is trending_down; too little history is null', () => {
  assert.equal(regime.coinRegime(candles(1000, (i) => 200 - i * 0.05)).state, 'trending_down');
  assert.equal(regime.coinRegime(candles(500, noise)), null);
});
test('regime: a squeeze is quiet, an expansion is volatile', () => {
  const wild = (i) => 100 + Math.sin(i / 3) * (i < 900 ? 0.05 : 1.5) * (i % 2 ? 1 : -1) * (i < 900 ? 1 : 1);
  const quiet = regime.coinRegime(candles(1000, (i) => 100 + (i < 700 ? Math.sin(i / 2) * 2 + (i % 3) : Math.sin(i / 2) * 0.02)));
  assert.equal(quiet.state, 'quiet'); assert.ok(quiet.bbw_pctile <= 20);
  const vol = regime.coinRegime(candles(1000, (i) => 100 + (i < 800 ? Math.sin(i / 2) * 0.02 : (i % 2 ? 1 : -1) * 2)));
  assert.equal(vol.state, 'volatile'); assert.ok(vol.bbw_pctile >= 80);
  void wild;
});
test('regime: a candle far outside the band has |bb_pos| above 1', () => {
  const rows = candles(1000, noise); rows[999] = [rows[999][0], 100, 106, 100, 105, 1];
  assert.ok(regime.coinRegime(rows).bb_pos > 1);
});
test('market regime: correlated coins, counts and a market state', () => {
  const m = regime.marketRegime({ A: candles(1000, (i) => 100 + i * 0.05), B: candles(1000, (i) => 50 + i * 0.025), C: candles(1000, (i) => 80 + i * 0.04), D: candles(1000, noise), E: candles(400, noise) });
  assert.equal(m.coins.E, null); assert.equal(m.market.n, 4); assert.equal(m.market.market_state, 'trending_up'); assert.ok(m.market.avg_corr_7d != null);
  assert.equal(regime.marketRegime({ A: candles(100, noise) }).market, null);
  assert.ok(Math.abs(regime.corr([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12);
});

// ---------------- order book ----------------
const spec = { contractSize: 0.1 };
const book = { bids: [[99.99, 100, 1], [99.9, 10000, 1]], asks: [[100.01, 100, 1], [100.1, 10000, 1]] };   // 100 contracts x 0.1 x ~100 = about $1,000 at the best level
test('walkNotional: exact at the first level, deeper orders pay more, a shallow book gives null', () => {
  assert.equal(+bs.walkNotional(book.asks, 0.1, 500).toFixed(6), 100.01);
  assert.ok(bs.walkNotional(book.asks, 0.1, 5000) > 100.01);
  assert.equal(bs.walkNotional([[100, 1, 1]], 0.1, 5000), null);
});
test('snapshotOf: spread, adverse slippage against the mid for both sides, depth', () => {
  const s = bs.snapshotOf(book, spec, 1700000000000);
  assert.equal(s.mid, 100); assert.equal(s.sp, 2);                            // 0.02 on 100 = 2 bp
  assert.equal(s.buy[100], 1); assert.equal(s.sell[100], 1);                   // half the spread
  assert.ok(s.buy[5000] > 1 && s.sell[5000] > 1); assert.equal(s.buy[20000] === null || s.buy[20000] > s.buy[5000], true);
  assert.ok(s.ask_d01 > 0); assert.equal(bs.snapshotOf({ asks: [], bids: [] }, spec, 1), null); assert.equal(bs.snapshotOf(book, {}, 1), null);
});
test('summarize and heartbeatSlip: median, p90, short lower-case keys, numbers only', () => {
  const snaps = Array.from({ length: 100 }, (_, i) => ({ sp: 2, buy: { 100: 1, 500: 1, 1000: 1 + i / 100, 5000: 3, 20000: null }, sell: { 100: 1, 500: 1, 1000: 1, 5000: 3, 20000: null } }));
  const s = bs.summarize(snaps);
  assert.equal(s.n, 100); assert.equal(s.buy['1000'].med, 1.5); assert.equal(s.buy['1000'].p90, 1.9); assert.equal(s.buy['20000'].n, 0);
  const h = bs.heartbeatSlip(s);
  assert.ok(Object.keys(h).every((k) => /^[a-z0-9_]{1,24}$/.test(k)) && Object.values(h).every(Number.isFinite) && Object.keys(h).length <= 16);
  assert.equal(h.b20000, undefined);
});

// ---------------- archive ----------------
test('archive: candles are stored once, read back in order, finished months are gzipped and still readable', () => {
  const a = createArchive(tmp()), rows = [[1700000000, 1, 2, 0.5, 1.5, 10], [1700003600, 1.5, 2, 1, 1.8, 11]];
  assert.equal(a.appendCandles('SOL_USDT', '1h', rows), 2);
  assert.equal(a.appendCandles('SOL_USDT', '1h', rows), 0);                    // the same candles again: nothing
  assert.equal(a.appendCandles('SOL_USDT', '1h', [[1700007200, 1.8, 2, 1, 1.9, 12], [1700000000, 9, 9, 9, 9, 9]]), 1);   // the old one is ignored
  assert.deepEqual(a.readCandles('SOL_USDT', '1h', 10).map((c) => c[0]), [1700000000, 1700003600, 1700007200]);
  assert.equal(a.newestCandle('SOL_USDT', '1h'), 1700007200);
  const month = '2023-11'; assert.ok(fs.existsSync(path.join(a.root, 'candles', 'SOL_USDT', '1h', `${month}.jsonl`)));
  assert.equal(a.rotate(Date.parse('2026-01-01')), 1);                         // a month long gone
  assert.ok(fs.existsSync(path.join(a.root, 'candles', 'SOL_USDT', '1h', `${month}.jsonl.gz`)) && !fs.existsSync(path.join(a.root, 'candles', 'SOL_USDT', '1h', `${month}.jsonl`)));
  assert.equal(createArchive(a.root).readCandles('SOL_USDT', '1h', 10).length, 3);       // a fresh process reads the gz
  assert.equal(createArchive(a.root).appendCandles('SOL_USDT', '1h', rows), 0);          // and knows what it already has
});
test('archive: a torn last line is skipped, not fatal', () => {
  const root = tmp(), a = createArchive(root); a.appendCandles('ZEC_USDT', '1h', [[1700000000, 1, 2, 0.5, 1.5, 10]]);
  fs.appendFileSync(path.join(root, 'candles', 'ZEC_USDT', '1h', '2023-11.jsonl'), '[1700003600,1.5,2,1,1.');
  assert.equal(createArchive(root).readCandles('ZEC_USDT', '1h', 10).length, 1);
});
test('archive: funding is deduplicated by settle time; book snapshots are read by time', () => {
  const a = createArchive(tmp());
  assert.equal(a.appendFunding('SOL_USDT', [{ settleTime: 1000, fundingRate: 0.0001, collectCycle: 8 }, { settleTime: 2000, fundingRate: -0.0001, collectCycle: 8 }]), 2);
  assert.equal(a.appendFunding('SOL_USDT', [{ settleTime: 2000, fundingRate: 0.5 }, { settleTime: 3000, fundingRate: 0.0002 }]), 1);
  assert.deepEqual(a.readFunding('SOL_USDT').map((r) => r[0]), [1000, 2000, 3000]);
  const now = Date.parse('2026-11-05T12:00:00Z');
  a.appendBook('SOL_USDT', { t: now - 3 * 86400e3, sp: 1 }); a.appendBook('SOL_USDT', { t: now - 3600e3, sp: 2 }); a.appendBook('SOL_USDT', { t: now, sp: 3 });
  assert.deepEqual(a.readBook('SOL_USDT', now - 86400e3).map((s) => s.sp), [2, 3]);
});
test('holesIn counts the missing steps', () => { assert.equal(holesIn([[0], [3600], [14400], [18000]], 3600), 2); assert.equal(holesIn([], 3600), 0); });

// ---------------- the MEXC client ----------------
test('mexcpub: retries a 500, reads klines into rows, stops on success:false', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    if (url.includes('/kline/') && calls === 1) return { status: 500, json: async () => ({}) };
    if (url.includes('/kline/')) return { status: 200, json: async () => ({ success: true, data: { time: [1, 2], open: [1, 2], high: [2, 3], low: [0, 1], close: [1.5, 2.5], vol: [10, 20] } }) };
    return { status: 200, json: async () => ({ success: false, code: 600, message: 'nope' }) };
  };
  const c = createClient({ fetchImpl });
  assert.deepEqual(await c.klines('SOL_USDT', '1h', 0, 10), [[1, 1, 2, 0, 1.5, 10], [2, 2, 3, 1, 2.5, 20]]); assert.equal(calls, 2);
  await assert.rejects(c.detail('SOL_USDT'), /nope/);
});

// ---------------- the dashboard heartbeat ----------------
test('push: the signature is the one the dashboard server verifies', () => {
  const body = '{"events":[]}', ts = 1700000000000, sig = push.sign('secret', ts, body);
  assert.match(sig, /^[0-9a-f]{64}$/);
  assert.equal(typeof signature.sign, 'function'); assert.equal(signature.sign('secret', ts, body), sig);
});
test('the heartbeat built from a real archive passes the dashboard validator, and nothing else is allowed from the recorder', () => {
  const rec = require('../recorder.js'), a = rec.archive;
  for (const sym of rec.SYMBOLS) {
    a.appendCandles(sym, '1h', candles(1100, noise).map((c) => [c[0], c[1], c[2], c[3], c[4], c[5]]));
    for (let i = 0; i < 40; i++) a.appendBook(sym, bs.snapshotOf(book, spec, Date.now() - i * 300000));
  }
  rec.computeSlippage(); rec.computeRegime(); rec.st.ok.candles = Date.now();
  const data = rec.heartbeatData(), ev = push.heartbeatEvent(data);
  const r = schema.validateEvent(ev);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.event.data.bot, 'recorder'); assert.ok(r.event.data.regime.SOL_USDT && r.event.data.market_state && r.event.data.slippage.SOL_USDT && r.event.data.recorder.version === 1);
  assert.equal(schema.validateEvent({ ...ev, type: 'equity', data: {} }).ok, false);                       // heartbeats only
  assert.equal(schema.validateEvent({ ...ev, event_id: 'hb:1700000000' }).ok, false);                      // the prefix is required
  assert.equal(schema.validateEvent({ ...ev, bot: 'bbcore' }).ok, false);                                  // and reserved
});
test('the 1h lab bot passes the dashboard validator with its own prefix, and cannot use the BB-Core one', () => {
  const ev = { event_id: 'bb1h|eq:paper:1700000000', type: 'equity', ts_ms: 1700000000000, mode: 'paper', bot: 'bb1h', data: { total_r: 1, paper_balance: 250 } };
  const r = schema.validateEvent(ev); assert.equal(r.ok, true, JSON.stringify(r.errors)); assert.equal(r.event.data.bot, 'bb1h');
  assert.equal(schema.validateEvent({ ...ev, bot: undefined }).ok, false);                                  // an untagged event may not use the lab's prefix
  assert.equal(schema.validateEvent({ ...ev, event_id: 'eq:paper:1700000000' }).ok, false);                // a tagged one must
});
