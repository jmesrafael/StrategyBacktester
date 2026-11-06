// node --test test/realpaper-integration-test.js  -  a synthetic breakout through the bot's real decision loop (lucidio.js processCoin) with the realistic paper executor:
// the entry carries the real-cost fields, the stop exit reaches the journal hook with costs, funding and fees, and the balance moves by R x the real risk.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os'), path = require('path'), fs = require('fs');
process.env.LUCIDIO_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-int-'));
process.env.LUCIDIO_NO_NOTIFY = '1';
const bot = require('../lucidio.js');
const { createRealisticPaper } = require('../realpaper.js');
const { DEFAULTS } = require('../lucidio-core.js');

const IV = 3600, T0 = 1790000000 - (1790000000 % IV);
const spec = { contractSize: 0.1, volUnit: 1, minVol: 1, maxVol: 1e6, takerFeeRate: 0.0002, makerFeeRate: 0, maintenanceMarginRate: 0.0023, maxLeverage: 100 };
const book = { bids: [[103.99, 500, 1], [103.98, 500, 1]], asks: [[104.01, 500, 1], [104.02, 500, 1]] };
// 1200 quiet candles around 100, then one close at 104 (a breakout above the band and the 800-candle average)
const candle = (i, o, c) => ({ time: T0 + i * IV, open: o, high: Math.max(o, c) + 0.05, low: Math.min(o, c) - 0.05, close: c });
function series() {
  const B = [];
  for (let i = 0; i < 1200; i++) { const c = 100 + Math.sin(i / 3) * 0.3; B.push(candle(i, i ? B[i - 1].close : 100, c)); }
  B.push(candle(1200, B[1199].close, 104));             // the signal candle
  B.push(candle(1201, 104, 104.1));                       // the forming candle the entry happens in
  return B;
}

test('entry and stop exit through processCoin: costs reach the hooks, the balance moves by R x the real risk', async () => {
  const client = { contract: async () => spec, depth: async () => book, fundingHistory: async () => ({ resultList: [{ settleTime: 1, fundingRate: 0.0001 }] }) };
  const exec = createRealisticPaper({ client, cfgFn: () => ({ maxRiskMult: 1.5, maxLeverage: 20, minTakerFee: 0.0002 }), cost: DEFAULTS.cost, interval: IV, summaryFile: '/nonexistent' });
  const got = { entry: [], exit: [] }, hooks = { entry: (i) => got.entry.push(i), exit: (i) => got.exit.push(i), skip: () => {} };
  const B = series(), st = { coins: {}, lastTime: B[1199].time }, acct = { balance: 250, totalR: 0, peakR: 0, peakBalance: 250 };
  const now = B[1201].time + 3;
  const ev1 = await bot.processCoin('SOL', B, st, exec, { acct, now, nowPx: 104.0, hooks, save: () => {} });
  assert.ok(ev1.some((l) => l.startsWith('ENTER SOL LONG')), ev1.join('\n'));
  assert.equal(got.entry.length, 1);
  const en = got.entry[0];
  assert.ok(en.fill > 104 && en.fill < 104.02);                       // filled on the ask side of the real book
  assert.equal(en.costs.kind, 'modelled (paper)'); assert.equal(en.costs.entry_slip_source, 'live book walk'); assert.ok(en.costs.entry_fee_pct >= 0.02);
  assert.ok(st.pos.vol >= 1 && st.pos.riskUsd > 0);

  // the next candle trades through the stop
  const stop = st.pos.stop;
  B.push(candle(1202, 104.1, stop - 1));
  B[1201] = { ...B[1201], close: 104.1 };
  B.push(candle(1203, stop - 1, stop - 1));
  const bal0 = acct.balance;
  const ev2 = await bot.processCoin('SOL', B, st, exec, { acct, now: B[1203].time + 3, nowPx: stop - 1, hooks, save: () => {} });
  assert.ok(ev2.some((l) => l.startsWith('EXIT  SOL LONG stop')), ev2.join('\n'));
  assert.equal(got.exit.length, 1);
  const ex = got.exit[0], c = ex.costs;
  assert.equal(c.kind, 'modelled (paper)'); assert.ok(c.fees_r > 0 && c.slippage_pct > 0 && c.funding_events >= 0 && c.exit_slip_source);
  assert.ok(ex.R < -1);                                              // a stop loses a little more than 1R once real costs are in
  assert.ok(Math.abs((acct.balance - bal0) - ex.R * en.riskUsd) < 0.05, `balance moved ${acct.balance - bal0}, expected ${ex.R * en.riskUsd}`);
});
