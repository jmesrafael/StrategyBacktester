'use strict';
// Tests for engines/correlation. Pure helpers only; nothing is written to intel/data.
const os = require('os'), fs = require('fs'), path = require('path');
process.env.INTEL_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-corr-'));
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../engines/correlation/index.js'), U = require('../lib/util');
const H = 3600, T0 = 1700000000 - (1700000000 % H);

const series = (n, seed) => { const r = U.rng(seed), a = []; for (let i = 0; i < n; i++) a.push((r() - 0.5) * 0.02); return a; };
// raw rows [openTime, o, h, l, c, v] from a list of log returns; first bar is the start price
const rowsFrom = (rets, from = 0, p0 = 100) => { let p = p0; return rets.map((r, i) => { const o = p; p = p * Math.exp(r); return [T0 + (from + i) * H, o, Math.max(o, p), Math.min(o, p), p, 1]; }); };

test('perfect correlation is 1 and inverted is -1', () => {
  const x = series(200, 1), y = x.map((v) => 3 * v + 0.001), z = x.map((v) => -v);
  assert.ok(Math.abs(E.corrRange(x, y) - 1) < 1e-9);
  assert.ok(Math.abs(E.corrRange(x, z) + 1) < 1e-9);
});

test('missing values (NaN) are skipped pair by pair', () => {
  const x = [1, 2, NaN, 4, 5, 6], y = [2, 4, 100, 8, 10, 12];
  const r = E.pairCorr(x, y);
  assert.equal(r.n, 5); assert.ok(Math.abs(r.corr - 1) < 1e-9);
});

test('beta of y = 2x is 2', () => {
  const x = series(300, 2), y = x.map((v) => 2 * v);
  assert.ok(Math.abs(E.betaRange(y, x) - 2) < 1e-9);
});

test('lead-lag finds lag +1 when the coin is BTC shifted by one hour', () => {
  const btc = series(500, 3), coin = btc.map((_, i) => (i > 0 ? btc[i - 1] : NaN));
  const best = [-3, -2, -1, 0, 1, 2, 3].map((k) => ({ k, c: E.lagCorr(btc, coin, k, 0, 499).corr })).sort((a, b) => b.c - a.c)[0];
  assert.equal(best.k, 1);
  assert.ok(best.c > 0.99);
  assert.ok(Math.abs(E.lagCorr(btc, coin, 0, 0, 499).corr) < 0.2);
});

test('tail probability is 1 for identical series and near the baseline for unrelated ones', () => {
  const x = series(2000, 4), r = E.tailStats(x, x.slice());
  assert.equal(r.pDown, 1); assert.equal(r.pUp, 1);
  const u = E.tailStats(x, series(2000, 99));
  assert.ok(u.pDown < 0.25);
  const split = E.tailStats(x, x.slice(), 1000);
  assert.equal(split.nBefore + split.nFrom, split.nDown);
});

test('percentile needs enough history', () => {
  assert.equal(E.pctile(0.5, [0.1, 0.2]), null);
  const prev = Array.from({ length: 100 }, (_, i) => i / 100);
  assert.ok(Math.abs(E.pctile(0.5, prev) - 50.5) < 1);
});

test('matrix: a missing bar gives NaN for that hour and the next one', () => {
  const rows = rowsFrom(series(300, 5)); rows.splice(100, 1);
  const mx = E.buildMatrix({ A: rows });
  assert.ok(Number.isNaN(mx.R.A[100])); assert.ok(Number.isNaN(mx.R.A[101]));
  assert.ok(Number.isFinite(mx.R.A[102]));
});

test('a coin without a full window is left out of the window statistics', () => {
  const rows = { A: rowsFrom(series(400, 6)), B: rowsFrom(series(400, 7)) };
  rows.B.splice(350, 1);
  const r = E.latestFromRows(rows, T0 + 400 * H, 168);
  assert.deepEqual(r.coins, ['A']);
});

test('no lookahead: latest(asOf) is the same when later bars are appended or changed', () => {
  const a = series(600, 8), b = series(600, 9).map((v, i) => v + 0.5 * a[i]), c = series(600, 10);
  const asOf = T0 + 400 * H, cut = (rows) => rows.slice(0, 600);
  const short = { A: rowsFrom(a.slice(0, 400)), B: rowsFrom(b.slice(0, 400)), C: rowsFrom(c.slice(0, 400)) };
  const wild = (x) => x.map((v, i) => (i < 400 ? v : v * 50 + 0.3));
  const long = { A: cut(rowsFrom(wild(a))), B: cut(rowsFrom(wild(b))), C: cut(rowsFrom(wild(c))) };
  const r1 = E.latestFromRows(short, asOf, 168), r2 = E.latestFromRows(long, asOf, 168);
  assert.deepEqual(r1.coins, ['A', 'B', 'C']);
  assert.deepEqual(r1.corr, r2.corr); assert.deepEqual(r1.cov, r2.cov); assert.deepEqual(r1.vol, r2.vol);
  assert.ok(r1.corr[0][1] > 0.3);
  for (let i = 0; i < 3; i++) assert.equal(r1.corr[i][i], 1);
});
