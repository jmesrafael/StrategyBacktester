'use strict';
// Tests for the pure helpers of engines/execution. Nothing is written to intel/data.
const os = require('os'), path = require('path'), fs = require('fs');
process.env.INTEL_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-exec-'));
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../engines/execution');
const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('slipBp: long paying more is positive, short paying less is positive', () => {
  close(E.slipBp({ dir: 1, entry_price: 101, intended_price: 100 }), 100);   // (1/100)*1e4
  close(E.slipBp({ dir: 1, entry_price: 99, intended_price: 100 }), -100);
  close(E.slipBp({ dir: -1, entry_price: 99, intended_price: 100 }), 100);   // short sold lower = worse
  close(E.slipBp({ dir: -1, entry_price: 101, intended_price: 100 }), -100);
  assert.equal(E.slipBp({ dir: 1, entry_price: 101, intended_price: null }), null);
});

test('overshootR: short stopped above its stop', () => {
  // short, stop 105, exit 106, 1R = 5 -> dir*(stop-exit)/oneR = -1*(105-106)/5 = +0.2 (worse)
  close(E.overshootR({ dir: -1, stop_price: 105, exit_price: 106, one_r: 5 }), 0.2);
  close(E.overshootR({ dir: -1, stop_price: 105, exit_price: 105, one_r: 5 }), 0);
  // long, stop 95, exit 94 -> 1*(95-94)/5 = 0.2
  close(E.overshootR({ dir: 1, stop_price: 95, exit_price: 94, one_r: 5 }), 0.2);
});

test('stopUnmoved: bbcore always, others only near -1R', () => {
  assert.equal(E.stopUnmoved({ bot: 'bbcore', stop_at_exit_r: 0.5 }), true);
  assert.equal(E.stopUnmoved({ bot: 'tcore', stop_at_exit_r: null }), true);
  assert.equal(E.stopUnmoved({ bot: 'tcore', stop_at_exit_r: -0.98 }), true);
  assert.equal(E.stopUnmoved({ bot: 'icore', stop_at_exit_r: 0.3 }), false);
});

test('costR: fees plus paid funding over dollar value of 1R', () => {
  // realized -10 at r -1 -> 1R = 10 USD. fees -0.5, funding -0.5 -> cost -1/10 = -0.1
  close(E.costR({ realized_usd: -10, r_result: -1, fees_usd: -0.5, funding_usd: -0.5 }), -0.1);
  // positive funding is ignored: fees -0.6, 1R = 20/2 = 10 -> -0.06
  close(E.costR({ realized_usd: 20, r_result: 2, fees_usd: -0.6, funding_usd: 0.4 }), -0.06);
  assert.equal(E.costR({ realized_usd: 1, r_result: 0.02, fees_usd: -0.1, funding_usd: 0 }), null);
});

test('liquidity ratio and flag', () => {
  close(E.liquidityRatio(50, 100), 0.5);
  assert.equal(E.liquidityRatio(null, 100), null);
  const D = 86400, asOf = 200 * D;
  // 180d window: hours at days 20..199; last 30 days (170..199) have volume 1 x close 10 = 10, older hours 40 x 10 = 400
  const bars = [];
  for (let d = 20; d < 200; d++) bars.push([d * D, 10, 10.5, 10, 10, d >= 170 ? 1 : 40]);
  const s = E.liquidityStats(bars, asOf);
  close(s.median_usd_30d, 10);
  close(s.median_usd_180d, 400);          // 150 of 180 bars are 400
  close(s.ratio_30d_180d, 0.025);
  assert.equal(s.falling, true);
  assert.equal(s.n_bars_30d, 30);
  close(s.median_range_bp_30d, (10.5 / 10 - 1) * 1e4);
  const ok = E.liquidityStats(bars.map((b) => [b[0], b[1], b[2], b[3], b[4], 5]), asOf);
  assert.equal(ok.falling, false);
});

test('participation and headroom', () => {
  const n = E.notionalOf({ risk_pct: 0.01, entry_price: 100, one_r: 2 }, 10000);   // 0.01*10000*100/2 = 5000
  close(n, 5000);
  close(E.participation(n, 1e6), 0.005);
  close(E.maxNotional1pct(1e6), 10000);
  close(E.headroom(1e6, n), 2);
  assert.equal(E.notionalOf({ risk_pct: null, entry_price: 100, one_r: 2 }, 10000), null);
});

test('equityBefore picks the last snapshot at or before the time', () => {
  const s = [{ t: 10, equity_usdt: 1 }, { t: 20, equity_usdt: 2 }, { t: 30, equity_usdt: 3 }];
  assert.equal(E.equityBefore(s, 25), 2);
  assert.equal(E.equityBefore(s, 30), 3);
  assert.equal(E.equityBefore(s, 5), null);
});
