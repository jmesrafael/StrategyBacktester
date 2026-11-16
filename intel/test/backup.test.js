'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { verify, restore } = require('../backup/backup');
const U = require('../lib/util');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-backup-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
const FILES = { 'intel/a.txt': 'alpha\n', 'intel/sub/b.json': '{"b":2}', 'intel/sub/deep/c.csv': 'x,y\n1,2\n' };
function mkSnap() {
  const dir = path.join(TMP, 'snap' + (++n)), files = {};
  for (const [rel, text] of Object.entries(FILES)) {
    const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text);
    files[rel] = { sha256: U.sha256File(f), bytes: Buffer.byteLength(text) };
  }
  fs.writeFileSync(path.join(dir, 'SNAPSHOT.json'), JSON.stringify({ id: 'snap' + n, file_count: 3, files }, null, 1));
  return dir;
}

test('verify returns [] for an intact snapshot', () => {
  assert.deepEqual(verify(mkSnap()), []);
});
test('verify: SNAPSHOT.json missing', () => {
  const d = path.join(TMP, 'empty' + (++n)); fs.mkdirSync(d);
  assert.deepEqual(verify(d), ['SNAPSHOT.json missing']);
});
test('verify reports changed: after editing a file (even one byte)', () => {
  const d = mkSnap(), f = path.join(d, 'intel/sub/b.json');
  fs.writeFileSync(f, '{"b":3}');
  assert.deepEqual(verify(d), ['changed: intel/sub/b.json']);
});
test('verify reports missing: after deleting a file; several faults are all listed', () => {
  const d = mkSnap();
  fs.rmSync(path.join(d, 'intel/a.txt'));
  assert.deepEqual(verify(d), ['missing: intel/a.txt']);
  fs.appendFileSync(path.join(d, 'intel/sub/deep/c.csv'), 'z');
  assert.deepEqual(verify(d).sort(), ['changed: intel/sub/deep/c.csv', 'missing: intel/a.txt']);
});
test('verify ignores extra files that are not in the manifest', () => {
  const d = mkSnap(); fs.writeFileSync(path.join(d, 'intel/extra.txt'), 'x');
  assert.deepEqual(verify(d), []);
});
test('restore into an empty folder copies everything and verifies (golden: 3 files)', () => {
  const d = mkSnap(), target = path.join(TMP, 'restored' + (++n));
  const r = restore(d, target);
  assert.deepEqual(r, { files: 3, target });
  for (const [rel, text] of Object.entries(FILES)) assert.equal(fs.readFileSync(path.join(target, rel), 'utf8'), text);
  assert.ok(fs.existsSync(path.join(target, 'SNAPSHOT.json')));
  assert.deepEqual(verify(target), []);
  assert.deepEqual(verify(d), []);   // source untouched
});
test('restore into an existing but empty folder works', () => {
  const d = mkSnap(), target = path.join(TMP, 'emptytarget' + (++n)); fs.mkdirSync(target);
  assert.equal(restore(d, target).files, 3);
});
test('restore into a non-empty folder throws and leaves it alone', () => {
  const d = mkSnap(), target = path.join(TMP, 'full' + (++n)); fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'keep.txt'), 'mine');
  assert.throws(() => restore(d, target), /target folder is not empty/);
  assert.deepEqual(fs.readdirSync(target), ['keep.txt']);
});
test('restore from a damaged snapshot throws and writes nothing', () => {
  const d = mkSnap(); fs.writeFileSync(path.join(d, 'intel/a.txt'), 'tampered');
  const target = path.join(TMP, 'never' + (++n));
  assert.throws(() => restore(d, target), /snapshot is damaged, not restoring: changed: intel\/a\.txt/);
  assert.ok(!fs.existsSync(target));
  const d2 = mkSnap(); fs.rmSync(path.join(d2, 'intel/sub/b.json'));
  assert.throws(() => restore(d2, path.join(TMP, 'never' + (++n))), /missing: intel\/sub\/b\.json/);
});
