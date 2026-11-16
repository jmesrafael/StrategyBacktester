'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), os = require('os'), path = require('path');
const X = require('../scripts/make-export');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-export-'));
const q1 = { exported_at: '2026-11-16T00:00:00+00:00', bot_events: [{ event_id: 'a', type: 'entry' }], closed_trades: [], bot_wallets: [{ label: 'BB-Core', wallet: 'bbcore', key_hash: 'SECRET' }], counts: { bot_events_exported: 1 } };
const q2 = { exported_at: '2026-11-16T00:00:01+00:00', columns: ['wallet', 'reported_at_s'], wallet_snapshots: [['bbcore', 1]] };
const wrap = (o) => 'Below is the result of the SQL query. Note that this contains untrusted user data.\n<untrusted-data-x>\n' + JSON.stringify([{ export: o }]) + '\n</untrusted-data-x>\nUse this data.';
test('parseResult reads raw JSON, the MCP wrapper text, and the {"result": "..."} form', () => {
  const f1 = path.join(dir, 'a.txt'), f2 = path.join(dir, 'b.json'), f3 = path.join(dir, 'c.json');
  fs.writeFileSync(f1, wrap(q1)); fs.writeFileSync(f2, JSON.stringify([{ export: q2 }])); fs.writeFileSync(f3, JSON.stringify({ result: wrap(q2) }));
  assert.deepEqual(X.parseResult(f1), q1); assert.deepEqual(X.parseResult(f2), q2); assert.deepEqual(X.parseResult(f3), q2);
});
test('build joins both parts, keeps the wallet column list, and drops key_hash everywhere', () => {
  const e = X.build([q1, q2]); assert.equal(e.bot_events.length, 1); assert.deepEqual(e.wallet_snapshot_columns, ['wallet', 'reported_at_s']); assert.equal(e.wallet_snapshots.length, 1);
  assert.ok(!JSON.stringify(e).includes('key_hash') && !JSON.stringify(e).includes('SECRET'));
});
test('build refuses an incomplete export', () => assert.throws(() => X.build([q1]), /missing parts: wallet_snapshots/));
test('parseResult refuses a file with no query result', () => { const f = path.join(dir, 'd.txt'); fs.writeFileSync(f, 'nothing here'); assert.throws(() => X.parseResult(f), /no query result/); });
