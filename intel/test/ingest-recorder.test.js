'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-rec-'));
process.env.INTEL_DATA = path.join(TMP, 'data0');
const spine = require('../lib/spine');
const { run, bookDaily, readLines, BOOK } = require('../ingest/recorder');
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
const freshEnv = () => { n++; process.env.INTEL_DATA = path.join(TMP, 'data' + n); };
const snap = (sp, b100, b1000, s100, s1000) => JSON.stringify({ sp, buy: { 100: b100, 1000: b1000 }, sell: { 100: s100, 1000: s1000 } });
const mkRoot = (name = 'rec') => {
  const root = path.join(TMP, name + (++n)), d = path.join(root, 'book', 'SOL_USDT'); fs.mkdirSync(d, { recursive: true });
  // plain file with a torn last line (no newline, cut mid-JSON)
  fs.writeFileSync(path.join(d, '2026-11-10.jsonl'), [snap(1, 2, 10, 1, 5), snap(2, 4, 20, 3, 15), snap(4, 6, 30, 5, 25)].join('\n') + '\n{"sp":9,"buy":{"100"');
  // gzipped finished file: 2 snapshots, only size 100
  const gz = ['{"sp":3,"buy":{"100":1},"sell":{"100":2}}', '{"sp":5,"buy":{"100":3},"sell":{"100":4}}'].join('\n') + '\n';
  fs.writeFileSync(path.join(d, '2026-11-11.jsonl.gz'), zlib.gzipSync(gz));
  fs.mkdirSync(path.join(root, 'summary'), { recursive: true }); fs.writeFileSync(path.join(root, 'summary', 'status.json'), '{}');
  return root;
};

test('readLines skips the torn last line and blank lines; reads .gz', () => {
  const root = mkRoot(), d = path.join(root, 'book', 'SOL_USDT');
  const plain = readLines(path.join(d, '2026-11-10.jsonl'));
  assert.equal(plain.length, 3); assert.deepEqual(plain.map((s) => s.sp), [1, 2, 4]);
  const gz = readLines(path.join(d, '2026-11-11.jsonl.gz'));
  assert.deepEqual(gz.map((s) => s.sp), [3, 5]);
  const f = path.join(root, 'blank.jsonl'); fs.writeFileSync(f, '\n{"a":1}\n   \n{"a":\n{"a":2}\n');
  assert.deepEqual(readLines(f), [{ a: 1 }, { a: 2 }]);
});
test('bookDaily golden medians and p90 (linear interpolation)', () => {
  const rows = bookDaily(mkRoot());
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { symbol: 'SOL_USDT', coin: 'SOL', day: '2026-11-10', snapshots: 3, spread_bp_median: 2, size_usd: 100, buy_bp_median: 4, buy_bp_p90: 5.6, sell_bp_median: 3, sell_bp_p90: 4.6 });
  assert.deepEqual(rows[1], { symbol: 'SOL_USDT', coin: 'SOL', day: '2026-11-10', snapshots: 3, spread_bp_median: 2, size_usd: 1000, buy_bp_median: 20, buy_bp_p90: 28, sell_bp_median: 15, sell_bp_p90: 23 });
  // gz day: spread median(3,5)=4; buy 1,3 -> median 2, p90 2.8; sell 2,4 -> 3, 3.8
  assert.deepEqual(rows[2], { symbol: 'SOL_USDT', coin: 'SOL', day: '2026-11-11', snapshots: 2, spread_bp_median: 4, size_usd: 100, buy_bp_median: 2, buy_bp_p90: 2.8, sell_bp_median: 3, sell_bp_p90: 3.8 });
});
test('bookDaily: no book folder -> empty; missing values give null; empty day skipped', () => {
  assert.deepEqual(bookDaily(path.join(TMP, 'does-not-exist')), []);
  const root = path.join(TMP, 'sparse' + (++n)), d = path.join(root, 'book', 'ABC_USDT'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, '2026-11-12.jsonl'), '{"buy":{"100":5}}\n');
  fs.writeFileSync(path.join(d, '2026-11-13.jsonl'), '');
  const rows = bookDaily(root);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].spread_bp_median, null); assert.equal(rows[0].sell_bp_median, null); assert.equal(rows[0].buy_bp_median, 5);
});
test('run({root}) with a missing folder: status failed, spine.load refuses', () => {
  freshEnv();
  const m = run({ root: path.join(TMP, 'not-there') });
  assert.equal(m.status, 'failed');
  assert.equal(m.checks[0].name, 'recorder data pulled'); assert.equal(m.checks[0].ok, false);
  assert.throws(() => spine.load('mexc', 'book_daily.csv'), (e) => e.code === 'FAILED');
});
test('run({root}) with the fake folder: ok, inventory and schema round trip', () => {
  freshEnv();
  const root = mkRoot(), m = run({ root });
  assert.equal(m.status, 'ok', JSON.stringify(m.checks));
  assert.equal(m.checks[0].detail, '3 files');
  assert.ok(m.notes.includes('recorder status file present'));
  const inv = spine.load('mexc', 'inventory.json');
  assert.deepEqual(Object.keys(inv.files).sort(), ['book/SOL_USDT/2026-11-10.jsonl', 'book/SOL_USDT/2026-11-11.jsonl.gz', 'summary/status.json']);
  assert.match(inv.files['summary/status.json'].sha256, /^[0-9a-f]{64}$/);
  const book = spine.load('mexc', 'book_daily.csv');
  assert.equal(book.length, 3);
  assert.deepEqual(Object.keys(book[0]).sort(), Object.keys(BOOK).sort());
  assert.equal(book[0].size_usd, 100); assert.equal(book[0].buy_bp_p90, 5.6); assert.equal(book[2].day, '2026-11-11');
  assert.deepEqual(spine.verify('mexc'), []);
});
test('run: a finished .gz file that changed or vanished is a fault; an open .jsonl may change', () => {
  freshEnv();
  const root = mkRoot(); assert.equal(run({ root }).status, 'ok');
  fs.appendFileSync(path.join(root, 'book', 'SOL_USDT', '2026-11-10.jsonl'), '\n');   // growing file: fine
  assert.equal(run({ root }).status, 'ok');
  const gz = path.join(root, 'book', 'SOL_USDT', '2026-11-11.jsonl.gz');
  fs.writeFileSync(gz, zlib.gzipSync('{"sp":1}\n'));
  const m = run({ root });
  assert.equal(m.status, 'failed');
  assert.match(m.checks[1].detail, /changed: book\/SOL_USDT\/2026-11-11\.jsonl\.gz/);
  freshEnv();
  const root2 = mkRoot(); run({ root: root2 });
  fs.rmSync(path.join(root2, 'book', 'SOL_USDT', '2026-11-11.jsonl.gz'));
  const m2 = run({ root: root2 });
  assert.equal(m2.status, 'failed'); assert.match(m2.checks[1].detail, /lost: book\/SOL_USDT\/2026-11-11\.jsonl\.gz/);
});
