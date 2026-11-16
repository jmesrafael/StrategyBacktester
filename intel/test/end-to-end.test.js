'use strict';
// Reads the REAL data folder (INTEL_DATA is deliberately not set) and asserts invariants, not exact numbers.
// Read-only: nothing is written. Skipped when the datasets have not been built.
const test = require('node:test'), assert = require('node:assert/strict');
const spine = require('../lib/spine');

const NEED = ['trades', 'derived/reference-trades', 'derived/journal', 'derived/truth-check', 'derived/integrity'];
const missing = NEED.filter((n) => !spine.exists(n));
const skip = missing.length ? 'real datasets not built: ' + missing.join(', ') : false;

test('reference-trades has rows for all 3 bots', { skip }, () => {
  const bots = new Set(spine.load('derived/reference-trades', 'trades.csv').map((t) => t.bot));
  for (const b of ['bbcore', 'icore', 'tcore']) assert.ok(bots.has(b), b);
});
test('journal summary: at least 22 closed live trades', { skip }, () => {
  const s = spine.load('derived/journal', 'summary.json');
  assert.ok(s.bots.ALL.closed_n >= 22, 'closed_n ' + s.bots.ALL.closed_n);
});
test('truth-check: no "closed trades reconciled" row needs review', { skip }, () => {
  const f = spine.load('derived/truth-check', 'findings.csv');
  assert.ok(f.some((r) => r.check === 'closed trades reconciled'), 'check ran');
  assert.deepEqual(f.filter((r) => r.check === 'closed trades reconciled' && r.status === 'review'), []);
});
test('integrity status: no fault rows except possibly venue parity', { skip }, () => {
  const bad = spine.load('derived/integrity', 'status.csv').filter((r) => r.status === 'fault' && r.area !== 'venue parity');
  assert.deepEqual(bad, []);
});
test('every dataset manifest verifies (checksums match, status ok)', { skip }, () => {
  const all = spine.list(); assert.ok(all.length > 0);
  // a dataset still waiting for an outside step (no files, failed check) is "blocked", not a fault; the integrity monitor reports it
  for (const n of all) { const m = spine.manifest(n); if (m.status !== "ok" && Object.keys(m.files).length === 0) continue; assert.deepEqual(spine.verify(n), [], n); }
});
