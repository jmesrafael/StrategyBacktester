'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-spine-'));
process.env.INTEL_DATA = TMP;
const spine = require('../lib/spine'), U = require('../lib/util');
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const SCH = { id: 'int', name: 'string', val: 'number', flag: 'bool', note: 'string?', extra: 'json?' };
const ROWS = [
  { id: 1, name: 'a,b', val: 1.5, flag: true, note: 'say "x"\nline', extra: { k: [1, 2] } },
  { id: 2, name: 'c', val: -2, flag: false, note: null, extra: null },
];
let n = 0; const fresh = (p = 'ds') => p + (++n);
const build = (name, over = {}) => spine.write(name, { generator: 't', source: { kind: 'test' }, files: { 'r.csv': { rows: ROWS, schema: SCH }, 'r.jsonl': { rows: ROWS, schema: SCH }, 'j.json': { json: { x: 1 } } }, ...over });
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };

test('data goes to INTEL_DATA, never the real data folder', () => {
  assert.equal(spine.ROOT(), TMP);
  const name = fresh(); build(name);
  assert.ok(fs.existsSync(path.join(TMP, name, 'manifest.json')));
});
test('write then load returns typed rows (csv and jsonl)', () => {
  const name = fresh(), m = build(name);
  assert.equal(m.status, 'ok');
  assert.deepEqual(spine.load(name, 'r.csv'), ROWS);
  assert.deepEqual(spine.load(name, 'r.jsonl'), ROWS);
  assert.deepEqual(spine.load(name, 'j.json'), { x: 1 });
  assert.equal(typeof spine.load(name, 'r.csv')[0].id, 'number');
  assert.equal(spine.load(name, 'r.csv')[1].flag, false);
});
test('manifest schema: files, rows, sha256, status, lineage', () => {
  const name = fresh(), m = build(name, { inputs: [{ dataset: 'x' }], notes: ['n'] });
  assert.equal(m.dataset, name); assert.equal(m.schema_version, 1); assert.equal(m.status, 'ok');
  assert.equal(m.files['r.csv'].rows, 2);
  assert.deepEqual(m.files['r.csv'].schema, SCH);
  assert.match(m.files['r.csv'].sha256, /^[0-9a-f]{64}$/);
  assert.equal(m.files['r.csv'].sha256, U.sha256(fs.readFileSync(path.join(TMP, name, 'r.csv'), 'utf8')));
  assert.equal(m.files['j.json'].rows, null);
  assert.ok(!Number.isNaN(Date.parse(m.built_at)));
  assert.deepEqual(m.inputs, [{ dataset: 'x' }]);
  assert.deepEqual(spine.manifest(name), m);
  assert.deepEqual(spine.verify(name), []);
  assert.ok(spine.exists(name)); assert.ok(!spine.exists('nope'));
  assert.ok(spine.list().includes(name));
});
test('ref gives a stable fingerprint of the files', () => {
  const name = fresh(); build(name);
  const r = spine.ref(name);
  assert.equal(r.dataset, name);
  assert.equal(r.manifest_sha256, U.sha256(U.canonical(spine.manifest(name).files)));
});
test('load refuses MISSING dataset and missing file', () => {
  assert.equal(code(() => spine.load('does-not-exist', 'r.csv')), 'MISSING');
  const name = fresh(); build(name);
  assert.equal(code(() => spine.load(name, 'other.csv')), 'MISSING');
  fs.rmSync(path.join(TMP, name, 'r.csv'));
  assert.equal(code(() => spine.load(name, 'r.csv')), 'MISSING');
});
test('load refuses a FAILED dataset (a failing check)', () => {
  const name = fresh(), m = build(name, { checks: [{ name: 'c1', ok: true, detail: '' }, { name: 'c2', ok: false, detail: 'bad' }] });
  assert.equal(m.status, 'failed');
  assert.equal(code(() => spine.load(name, 'r.csv')), 'FAILED');
  assert.throws(() => spine.load(name, 'r.csv'), /c2 \(bad\)/);
});
test('load refuses CORRUPT data (one byte changed), verify reports it', () => {
  const name = fresh(); build(name);
  const f = path.join(TMP, name, 'r.csv'), buf = fs.readFileSync(f);
  buf[buf.length - 3] = buf[buf.length - 3] === 0x31 ? 0x32 : 0x31;
  fs.writeFileSync(f, buf);
  assert.equal(code(() => spine.load(name, 'r.csv')), 'CORRUPT');
  assert.deepEqual(spine.verify(name), ['r.csv: checksum mismatch']);
  assert.deepEqual(spine.load(name, 'r.jsonl'), ROWS);   // other files unaffected
});
test('load refuses a CORRUPT manifest and a wrong row count', () => {
  const name = fresh(); build(name);
  const mf = path.join(TMP, name, 'manifest.json'), good = fs.readFileSync(mf, 'utf8');
  const m = JSON.parse(good); m.files['r.csv'].rows = 5; fs.writeFileSync(mf, JSON.stringify(m));
  assert.equal(code(() => spine.load(name, 'r.csv')), 'CORRUPT');
  fs.writeFileSync(mf, '{ not json');
  assert.equal(code(() => spine.load(name, 'r.csv')), 'CORRUPT');
  assert.match(spine.verify(name)[0], /CORRUPT/);
});
test('load refuses STALE data via maxAgeHours', () => {
  const name = fresh(); build(name);
  assert.ok(spine.load(name, 'r.csv', { maxAgeHours: 1 }));
  const mf = path.join(TMP, name, 'manifest.json'), m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  m.built_at = new Date(Date.now() - 5 * 3600e3).toISOString(); fs.writeFileSync(mf, JSON.stringify(m));
  assert.equal(code(() => spine.load(name, 'r.csv', { maxAgeHours: 2 })), 'STALE');
  assert.ok(spine.load(name, 'r.csv', { maxAgeHours: 10 }));
  assert.ok(spine.load(name, 'r.csv'));   // no limit given: accepted
});
test('SCHEMA: a row with a wrong type or empty required field makes status failed', () => {
  for (const bad of [{ ...ROWS[0], id: 'x' }, { ...ROWS[0], id: 1.5 }, { ...ROWS[0], val: NaN }, { ...ROWS[0], name: null }, { ...ROWS[0], flag: 'true' }, { ...ROWS[0], val: Infinity }]) {
    const name = fresh(), m = spine.write(name, { files: { 'r.csv': { rows: [ROWS[1], bad], schema: SCH } } });
    assert.equal(m.status, 'failed', JSON.stringify(bad));
    const c = m.checks.find((x) => x.name === 'schema');
    assert.ok(c && !c.ok && /row 2/.test(c.detail));
    assert.equal(code(() => spine.load(name, 'r.csv')), 'FAILED');
    assert.match(spine.verify(name)[0], /status is failed/);
  }
});
test('SCHEMA: load re-validates rows even when the checksum was fixed up', () => {
  const name = fresh(); build(name);
  const f = path.join(TMP, name, 'r.csv'), mf = path.join(TMP, name, 'manifest.json');
  const text = fs.readFileSync(f, 'utf8').replace('-2', 'abc'); fs.writeFileSync(f, text);
  const m = JSON.parse(fs.readFileSync(mf, 'utf8')); m.files['r.csv'].sha256 = U.sha256(text); fs.writeFileSync(mf, JSON.stringify(m));
  assert.equal(code(() => spine.load(name, 'r.csv')), 'SCHEMA');
});
test('checkRow optional fields accept null/undefined', () => {
  assert.doesNotThrow(() => spine.checkRow({ id: 1, name: 'x', val: 1, flag: true }, SCH, 'w'));
  assert.throws(() => spine.checkRow({ name: 'x', val: 1, flag: true }, SCH, 'w'), /field "id" is empty/);
});

// ---- hash chain ----
const mk = (k) => spine.chainAppend([], Array.from({ length: k }, (_, i) => ({ a: i + 1, s: 'row' + (i + 1) })));
test('chain: intact chain verifies, golden first hash, GENESIS', () => {
  const rows = mk(4);
  assert.equal(spine.chainVerify(rows), null);
  assert.equal(spine.chainVerify([]), null);
  assert.deepEqual(rows.map((r) => r.seq), [1, 2, 3, 4]);
  assert.equal(rows[0].prev_hash, '0'.repeat(64));
  assert.equal(rows[0].row_hash, U.sha256('0'.repeat(64) + '{"a":1,"s":"row1"}'));
  assert.equal(rows[1].prev_hash, rows[0].row_hash);
});
test('chain: appending to an existing chain continues it', () => {
  const rows = mk(2), more = spine.chainAppend(rows, [{ a: 3, s: 'row3' }]);
  assert.equal(more.length, 3); assert.equal(more[2].seq, 3); assert.equal(spine.chainVerify(more), null);
  assert.deepEqual(more.slice(0, 2), rows);
  assert.equal(rows.length, 2);   // input not mutated
  assert.deepEqual(mk(3), more);
});
test('chain: editing a field of an old row is detected at that sequence number', () => {
  const rows = mk(4); rows[1] = { ...rows[1], a: 999 };
  assert.equal(spine.chainVerify(rows), 2);
  const r2 = mk(4); r2[0] = { ...r2[0], s: 'changed' };
  assert.equal(spine.chainVerify(r2), 1);
  const r3 = mk(4); r3[3] = { ...r3[3], extra: 1 };
  assert.equal(spine.chainVerify(r3), 4);
});
test('chain: deleting a row is detected', () => {
  const mid = mk(4); mid.splice(1, 1);
  assert.equal(spine.chainVerify(mid), 2);
  const first = mk(4); first.shift();
  assert.equal(spine.chainVerify(first), 1);
});
test('chain: reordering rows is detected', () => {
  const rows = mk(4); [rows[1], rows[2]] = [rows[2], rows[1]];
  assert.equal(spine.chainVerify(rows), 2);
});
test('chain: with a schema, a row hashes identically before and after a JSON round trip', () => {
  const S = { a: 'int', opt: 'string?', opt2: 'number?', seq: 'int', prev_hash: 'string', row_hash: 'string' };
  const rows = spine.chainAppend([], [{ a: 1 }, { a: 2, opt: 'x' }, { a: 3, opt2: 0.5 }], S);
  assert.ok(rows.every((r) => 'opt' in r && 'opt2' in r));
  const back = U.parseJsonl(U.toJsonl(rows));
  assert.equal(spine.chainVerify(back), null);
  assert.deepEqual(back, rows);
  const more = spine.chainAppend(back, [{ a: 4 }], S);
  assert.equal(spine.chainVerify(more), null);
});
test('chain: with a schema, fields outside the schema are dropped; hash fields in input are ignored', () => {
  const S = { a: 'int', seq: 'int', prev_hash: 'string', row_hash: 'string' };
  const [r] = spine.chainAppend([], [{ a: 1, junk: 'z', seq: 77, row_hash: 'bad' }], S);
  assert.ok(!('junk' in r)); assert.equal(r.seq, 1);
  assert.equal(spine.chainVerify([r]), null);
});
test('chain stored through the spine: write, load, verify, then tamper', () => {
  const S = { a: 'int', s: 'string', seq: 'int', prev_hash: 'string', row_hash: 'string' };
  const name = fresh('chain'), rows = spine.chainAppend([], [{ a: 1, s: 'x' }, { a: 2, s: 'y' }], S);
  assert.equal(spine.write(name, { files: { 'log.jsonl': { rows, schema: S } } }).status, 'ok');
  assert.equal(spine.chainVerify(spine.load(name, 'log.jsonl')), null);
  const f = path.join(TMP, name, 'log.jsonl');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"y"', '"Y"'));
  assert.equal(code(() => spine.load(name, 'log.jsonl')), 'CORRUPT');
  assert.equal(spine.chainVerify(U.parseJsonl(fs.readFileSync(f, 'utf8'))), 2);
});
