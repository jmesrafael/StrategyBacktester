'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const H = require('../engines/health');

// engines/health reads the real trades, market and signal datasets (parity, decay), so its behaviour is covered by
// the end-to-end test (end-to-end.test.js). Only the export shape is checked here.
test('health exports parity, decay, run', () => {
  assert.deepEqual(Object.keys(H).sort(), ['decay', 'parity', 'run']);
  for (const k of Object.keys(H)) assert.equal(typeof H[k], 'function');
});
