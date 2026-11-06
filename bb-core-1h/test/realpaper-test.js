// node --test test/realpaper-test.js  -  the realistic paper executor (realpaper.js) against a fake MEXC client: no network, no keys.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRealisticPaper, walkBook, bookSlip, feeRates, fundingBetween, recordedSlip } = require('../realpaper.js');
const { DEFAULTS } = require('../lucidio-core.js');

const cost = DEFAULTS.cost, IV = 3600;
const spec = { contractSize: 0.1, volUnit: 1, minVol: 1, maxVol: 1e6, takerFeeRate: 0.0002, makerFeeRate: 0, maintenanceMarginRate: 0.0023, maxLeverage: 100 };
// a book around 100.00: spread 0.02, 50 contracts (5 coins) per level
const book = { bids: [[99.99, 50, 1], [99.98, 50, 1], [99.97, 500, 1]], asks: [[100.01, 50, 1], [100.02, 50, 1], [100.03, 500, 1]] };
const mkClient = (over = {}) => ({ contract: async () => spec, depth: async () => book, fundingHistory: async () => ({ resultList: [] }), ...over });
const mk = (client, cfg = {}, extra = {}) => createRealisticPaper({ client, cfgFn: () => ({ maxRiskMult: 1.5, maxLeverage: 20, minTakerFee: 0.0002, ...cfg }), cost, interval: IV, summaryFile: '/nonexistent/slip.json', ...extra });
const entryOpts = (o = {}) => ({ dir: 1, stop: 95, tp: null, refOpen: 100, t0: 1793000000, sigTime: 1792996400, riskUsd: 5, ...o });

test('walkBook: volume-weighted price, partial fill flagged', () => {
  assert.deepEqual(walkBook(book.asks, 50), { avg: 100.01, filled: 50, complete: true });
  const w = walkBook(book.asks, 75);
  assert.ok(Math.abs(w.avg - (50 * 100.01 + 25 * 100.02) / 75) < 1e-9); assert.equal(w.complete, true);
  const thin = walkBook([[100, 10, 1]], 30);
  assert.equal(thin.complete, false); assert.equal(thin.filled, 10);
  assert.equal(walkBook([], 5).avg, null);
});

test('bookSlip: adverse against the mid, half spread included, for both sides', () => {
  const buy = bookSlip(book, 1, 50), sell = bookSlip(book, -1, 50);
  assert.ok(Math.abs(buy.mid - 100) < 1e-9);
  assert.ok(Math.abs(buy.adverse - 0.0001) < 1e-9);           // paid 100.01 against a 100.00 mid
  assert.ok(Math.abs(sell.adverse - 0.0001) < 1e-9);          // sold at 99.99
  assert.ok(bookSlip(book, 1, 120).adverse > buy.adverse);     // a bigger order walks further
  assert.equal(bookSlip({ asks: [], bids: [] }, 1, 5), null);
});

test('feeRates: the listed taker rate, never below the floor', () => {
  assert.equal(feeRates({ takerFeeRate: 0.0006, makerFeeRate: 0.0002 }, { minTakerFee: 0.0002 }).taker, 0.0006);
  assert.equal(feeRates({ takerFeeRate: 0, makerFeeRate: 0 }, { minTakerFee: 0.0002 }).taker, 0.0002);     // a promotional 0% is not counted as free
  assert.equal(feeRates({ takerFeeRate: 0, makerFeeRate: 0 }, { minTakerFee: 0 }).taker, 0);
  assert.equal(feeRates(null, {}).taker, 0.0002);
});

test('fundingBetween: only the settlements after the entry and up to the exit', () => {
  const h = [{ settleTime: 1000, fundingRate: 0.0001 }, { settleTime: 2000, fundingRate: 0.0002 }, { settleTime: 3000, fundingRate: -0.0001 }];
  assert.deepEqual(fundingBetween(h, 1000, 3000), { sum: 0.0001, events: 2 });      // 1000 itself is before the entry, 3000 is included
  assert.deepEqual(fundingBetween(h, 5000, 6000), { sum: 0, events: 0 });
  assert.deepEqual(fundingBetween(null, 0, 1), { sum: 0, events: 0 });
});

test('recordedSlip: interpolates between measured sizes, refuses stale data', () => {
  const sum = { updated_ms: 1e12, coins: { SOL_USDT: { buy: { 1000: { med: 1, p90: 2 }, 5000: { med: 3, p90: 6 } }, sell: { 1000: { med: 1, p90: 2 } } } } };
  assert.equal(recordedSlip(sum, 'SOL_USDT', 1, 3000, 'p90', 1e12 + 1000).bp, 4);           // halfway between 2 and 6
  assert.equal(recordedSlip(sum, 'SOL_USDT', 1, 500, 'med', 1e12 + 1000).bp, 1);
  assert.match(recordedSlip(sum, 'SOL_USDT', 1, 9000, 'med', 1e12 + 1000).size_note, /larger/);
  assert.equal(recordedSlip(sum, 'SOL_USDT', 1, 3000, 'p90', 1e12 + 7 * 3600e3), null);     // older than 6 hours
  assert.equal(recordedSlip(sum, 'ZEC_USDT', 1, 3000, 'p90', 1e12), null);
  assert.equal(recordedSlip(null, 'SOL_USDT', 1, 3000), null);
});

test('enter: whole contracts, the real fill, risk = what the contracts really risk', async () => {
  const x = mk(mkClient()), pos = await x.enter('SOL', entryOpts());
  assert.equal(pos.vol, 10);                                    // 5 USD / (5 x 0.1) = 10 contracts
  assert.ok(Math.abs(pos.entry - 100.01) < 1e-9);               // filled on the ask
  assert.ok(Math.abs(pos.riskUsd - 10 * 0.1 * 5.01) < 1e-9);    // contracts x size x (fill - stop)
  assert.equal(pos.fees.taker, 0.0002); assert.equal(pos.entrySlipSource, 'live book walk');
  assert.ok(pos.entryBook.spread_bp > 0 && pos.degraded === undefined);
});

test('enter: a coin whose one contract risks too much is skipped, like live', async () => {
  const r = await mk(mkClient()).enter('SOL', entryOpts({ riskUsd: 0.1 }));
  assert.match(r.skip, /more than 1\.5× the/);
});

test('enter: a failed book or contract call falls back to the fixed model and says so', async () => {
  const noBook = await mk(mkClient({ depth: async () => { throw new Error('boom'); } })).enter('SOL', entryOpts());
  assert.ok(Math.abs(noBook.entry - 100 * (1 + cost.slip)) < 1e-9); assert.ok(noBook.degraded.some((d) => /order book/.test(d)));
  const noSpec = await mk(mkClient({ contract: async () => { throw new Error('boom'); } })).enter('SOL', entryOpts());
  assert.equal(noSpec.vol, null); assert.ok(noSpec.degraded.some((d) => /contract detail/.test(d)));
  assert.equal(noSpec.fees.taker, 0.0002);
});

test('enter: a stop on the wrong side of the fill is refused', async () => {
  assert.equal(await mk(mkClient()).enter('SOL', entryOpts({ stop: 101 })), null);
});

test('stop exit: R includes both fees, the entry slippage, the exit slippage and funding', async () => {
  const funding = { resultList: [{ settleTime: 1793000000 * 1000 + 3600e3, fundingRate: 0.0003, collectCycle: 8 }] };
  const x = mk(mkClient({ fundingHistory: async () => funding }), {}, { clock: () => 1793000000 * 1000 });
  const pos = await x.enter('SOL', entryOpts());
  const out = await x.checkExit(pos, { time: 1793000000 + 3600, open: 98, high: 98.5, low: 94, close: 95 });
  assert.equal(out.why, 'stop'); assert.ok(out.px < 95);         // 95 stop, sold below it by the book
  const dist = pos.dist, move = (out.px - pos.entry) / pos.entry;
  const expected = (move - 0.0002 - 0.0002 - 1 * 0.0003) / dist;
  assert.ok(Math.abs(out.R - expected) < 1e-9, `${out.R} vs ${expected}`);
  assert.equal(out.costs.funding_events, 1); assert.ok(Math.abs(out.costs.funding_r + 0.0003 / dist) < 1e-9);
  assert.equal(out.costs.kind, 'modelled (paper)'); assert.equal(out.costs.exit_slip_source, 'live book now');
  assert.ok(out.costs.fees_r > 0 && out.costs.slippage_pct > 0);
});

test('a short receives funding when the rate is positive', async () => {
  const funding = { resultList: [{ settleTime: 1793000000 * 1000 + 1000, fundingRate: 0.0004 }] };
  const x = mk(mkClient({ fundingHistory: async () => funding }), {}, { clock: () => 1793000000 * 1000 });
  const pos = await x.enter('SOL', entryOpts({ dir: -1, stop: 105 }));
  const out = await x.checkExit(pos, { time: 1793000000, open: 102, high: 106, low: 101, close: 105 });
  assert.ok(out.costs.funding_r > 0);                            // positive rate: shorts receive, which adds to R
});

test('a gap through the stop fills at the open, not at the stop', async () => {
  const x = mk(mkClient()), pos = await x.enter('SOL', entryOpts());
  const out = await x.checkExit(pos, { time: 1793000000 + 3600, open: 90, high: 91, low: 89, close: 90 });
  assert.ok(out.px < 90);
});

test('no exit while the candle stays inside the stop', async () => {
  const x = mk(mkClient()), pos = await x.enter('SOL', entryOpts());
  assert.equal(await x.checkExit(pos, { time: 1793000000 + 3600, open: 101, high: 103, low: 96, close: 102 }), null);
});

test('time exit: sells into the book and reports the cost', async () => {
  const x = mk(mkClient()), pos = await x.enter('SOL', entryOpts());
  const out = await x.timeExit(pos, 104);
  assert.equal(out.why, 'time'); assert.ok(out.px < 104 && out.px > 103.9); assert.ok(out.R > 0);
});

test('failed funding history: counted as 0 and flagged, the trade still closes', async () => {
  const x = mk(mkClient({ fundingHistory: async () => { throw new Error('down'); } })), pos = await x.enter('SOL', entryOpts());
  const out = await x.timeExit(pos, 103);
  assert.equal(out.costs.funding_r === 0 || Object.is(out.costs.funding_r, -0), true); assert.ok(out.costs.degraded.some((d) => /funding/.test(d)));
});

test('recorded slippage beats the live book when the recorder summary is fresh', async () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const f = path.join(os.tmpdir(), `slip-${process.pid}.json`);
  fs.writeFileSync(f, JSON.stringify({ updated_ms: 1793000000 * 1000, coins: { SOL_USDT: { buy: { 1000: { med: 1, p90: 3 } }, sell: { 1000: { med: 1, p90: 3 } } } } }));
  try {
    const x = mk(mkClient(), {}, { summaryFile: f, clock: () => 1793000000 * 1000 }), pos = await x.enter('SOL', entryOpts());
    const stop = await x.checkExit(pos, { time: 1793000000 + 3600, open: 98, high: 98.5, low: 94, close: 95 });
    assert.equal(stop.costs.exit_slip_source, 'recorded p90'); assert.ok(Math.abs(stop.costs.exit_slip_bp - 3) < 1e-9);
    const time = await x.timeExit(pos, 104);
    assert.equal(time.costs.exit_slip_source, 'recorded med');
  } finally { fs.unlinkSync(f); }
});
