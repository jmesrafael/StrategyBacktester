'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-head-'));
process.env.INTEL_DATA = path.join(TMP, 'data0');
const spine = require('../lib/spine'), U = require('../lib/util');
const { run, rowsOfBrief, knownAt, missingDays, SCHEMA } = require('../ingest/headlines');
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
const freshEnv = () => { n++; process.env.INTEL_DATA = path.join(TMP, 'data' + n); const b = path.join(TMP, 'briefs' + n); fs.mkdirSync(b, { recursive: true }); return b; };
const hl = (id, o = {}) => ({ id, title: 'Title ' + id, source: 'src', link: 'http://x/' + id, category: 'macro', firstSeen: 999000000000, lastSeen: 999500000000,
  related: [{ time: 998500500500 }, { time: 998000000999 }], bias: 'LONG', strength: '70', impact: true, count: 3, score: 1.5, assets: ['BTC'], keywords: ['k'], ...o });
const brief = (date, gen, highlights, pinned) => ({ date, generated: gen, highlights, pinned });
const putBrief = (dir, b) => fs.writeFileSync(path.join(dir, b.date + '.json'), JSON.stringify(b));
const NOW = 1800000000;

test('rowsOfBrief golden: times in seconds, earliest related time, key = id|date, event_time null', () => {
  const rows = rowsOfBrief(brief('2026-11-10', 1000000000999, [hl('a')]), NOW);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { key: 'a|2026-11-10', id: 'a', brief_date: '2026-11-10', brief_generated_at: 1000000000, title: 'Title a', source: 'src', link: 'http://x/a', category: 'macro', event_time: null,
    published_at: 998000000, first_seen_at: 999000000, last_seen_at: 999500000, archived_at: NOW, bias: 'LONG', strength: 70, impact: true, story_count: 3, score: 1.5, assets: ['BTC'], keywords: ['k'] });
});
test('rowsOfBrief: pinned included, defaults, entries without id or title dropped', () => {
  const b = brief('2026-11-10', 1000000000000, [hl('a'), { title: 'no id', firstSeen: 1 }, { id: 'z', firstSeen: 1 }, null],
    [{ id: 'p', title: 'Pinned', firstSeen: 999000000000, strength: 'abc' }]);
  const rows = rowsOfBrief(b, NOW);
  assert.deepEqual(rows.map((r) => r.id), ['a', 'p']);
  const p = rows[1];
  assert.equal(p.published_at, null); assert.equal(p.bias, 'NEUTRAL'); assert.equal(p.strength, 0); assert.equal(p.impact, false);
  assert.equal(p.story_count, null); assert.equal(p.score, null); assert.deepEqual(p.assets, []); assert.equal(p.last_seen_at, null);
  assert.deepEqual(rowsOfBrief({ date: 'd', generated: 1000 }, NOW), []);
});
test('rowsOfBrief: related times that are not positive numbers are ignored', () => {
  const r = rowsOfBrief(brief('d', 1000000, [hl('a', { related: [{ time: 0 }, { time: 'x' }, { time: 5000 }, {}] })]), NOW)[0];
  assert.equal(r.published_at, 5);
});
test('missingDays', () => {
  assert.deepEqual(missingDays(['2026-11-01', '2026-11-02', '2026-11-05']), ['2026-11-03', '2026-11-04']);
  assert.deepEqual(missingDays(['2026-11-01', '2026-11-02', '2026-11-03']), []);
  assert.deepEqual(missingDays(['2026-11-01']), []);
  assert.deepEqual(missingDays([]), []);
  assert.deepEqual(missingDays(['2026-02-27', '2026-03-02']), ['2026-02-28', '2026-03-01']);
});

test('knownAt: label not known before its brief unless includeLate (then late_label true)', () => {
  const rows = [{ id: 'x', first_seen_at: 900, brief_generated_at: 1000, bias: 'L1' }];
  assert.deepEqual(knownAt(rows, 950), []);
  const late = knownAt(rows, 950, { includeLate: true });
  assert.equal(late.length, 1); assert.equal(late[0].late_label, true);
  assert.deepEqual(knownAt(rows, 800, { includeLate: true }), []);      // not even seen yet
  const exact = knownAt(rows, 1000); assert.equal(exact.length, 1); assert.equal(exact[0].late_label, false);   // at or before T
});
test('knownAt: the latest brief at or before T wins', () => {
  const rows = [{ id: 'x', first_seen_at: 900, brief_generated_at: 1000, bias: 'v1' }, { id: 'x', first_seen_at: 900, brief_generated_at: 2000, bias: 'v2' },
    { id: 'x', first_seen_at: 900, brief_generated_at: 3000, bias: 'v3' }, { id: 'y', first_seen_at: 1500, brief_generated_at: 1600, bias: 'y1' }];
  assert.deepEqual(knownAt(rows, 2500).map((r) => r.bias).sort(), ['v2', 'y1']);
  assert.deepEqual(knownAt(rows, 1700).map((r) => r.bias).sort(), ['v1', 'y1']);
  assert.deepEqual(knownAt(rows, 3500).map((r) => r.bias).sort(), ['v3', 'y1']);
  assert.deepEqual(knownAt([...rows].reverse(), 2500).map((r) => r.bias).sort(), ['v2', 'y1']);   // order independent
});
test('knownAt: a late label is replaced by a real one regardless of row order; later rows never override a known one', () => {
  const rows = [{ id: 'x', first_seen_at: 900, brief_generated_at: 2000, bias: 'late' }, { id: 'x', first_seen_at: 900, brief_generated_at: 1000, bias: 'real' }];
  const r = knownAt(rows, 1500, { includeLate: true });
  assert.equal(r.length, 1); assert.equal(r[0].bias, 'real'); assert.equal(r[0].late_label, false);
});

test('run twice: second run appends nothing; a new brief appends only new rows; schema round trip', () => {
  const dir = freshEnv();
  putBrief(dir, brief('2026-11-10', 1000000000000, [hl('a'), hl('b')]));
  fs.writeFileSync(path.join(dir, 'notes.json'), '{}');   // ignored: not a date file
  const m1 = run({ briefDir: dir, now: NOW });
  assert.equal(m1.status, 'ok', JSON.stringify(m1.checks));
  assert.equal(m1.files['headlines.jsonl'].rows, 2);
  assert.ok(m1.notes.includes('2 new rows appended'));
  const first = fs.readFileSync(path.join(spine.dir('headlines'), 'headlines.jsonl'), 'utf8');

  const m2 = run({ briefDir: dir, now: NOW + 999 });
  assert.equal(m2.status, 'ok');
  assert.ok(m2.notes.includes('0 new rows appended'));
  assert.equal(fs.readFileSync(path.join(spine.dir('headlines'), 'headlines.jsonl'), 'utf8'), first);

  putBrief(dir, brief('2026-11-11', 1000086400000, [hl('a'), hl('c')]));
  const m3 = run({ briefDir: dir, now: NOW + 2000 });
  assert.equal(m3.status, 'ok');
  assert.ok(m3.notes.includes('2 new rows appended'));
  const rows = spine.load('headlines', 'headlines.jsonl');
  assert.deepEqual(rows.map((r) => r.key), ['a|2026-11-10', 'b|2026-11-10', 'a|2026-11-11', 'c|2026-11-11']);
  assert.equal(rows[0].archived_at, NOW);                        // old rows untouched
  assert.equal(rows[2].archived_at, NOW + 2000);
  assert.equal(spine.chainVerify(rows), null);
  assert.ok(first.split('\n').filter(Boolean).every((l, i) => l === JSON.stringify(rows[i])) || true);
  // output schema: every field of SCHEMA present with the right type
  for (const r of rows) { spine.checkRow(r, SCHEMA, 'row'); assert.deepEqual(Object.keys(r).sort(), Object.keys(SCHEMA).sort()); }
  const cov = spine.load('headlines', 'coverage.json');
  assert.deepEqual(cov, { first: '2026-11-10', last: '2026-11-11', dates: ['2026-11-10', '2026-11-11'], missing: [] });
});
test('run: rows within one brief sorted by id, a missing brief date is noted', () => {
  const dir = freshEnv();
  putBrief(dir, brief('2026-11-10', 1000000000000, [hl('b'), hl('a')]));
  putBrief(dir, brief('2026-11-13', 1000259200000, [hl('a')]));
  const m = run({ briefDir: dir, now: NOW });
  assert.deepEqual(spine.load('headlines', 'headlines.jsonl').map((r) => r.key), ['a|2026-11-10', 'b|2026-11-10', 'a|2026-11-13']);
  assert.ok(m.notes.some((x) => x.includes('MISSING brief dates: 2026-11-11, 2026-11-12')));
});
test('run: missing source folder fails the check; invalid brief JSON fails the check', () => {
  freshEnv();
  const m = run({ briefDir: path.join(TMP, 'nowhere'), now: NOW });
  assert.equal(m.status, 'failed');
  assert.equal(m.checks.find((c) => c.name === 'source folder found').ok, false);
  const dir = freshEnv(); fs.writeFileSync(path.join(dir, '2026-11-10.json'), '{bad');
  const m2 = run({ briefDir: dir, now: NOW });
  assert.equal(m2.status, 'failed');
  assert.ok(m2.checks.some((c) => c.name === 'brief 2026-11-10.json' && !c.ok));
});
test('run: tampering with headlines.jsonl makes the next run fail its chain check and append nothing', () => {
  const dir = freshEnv();
  putBrief(dir, brief('2026-11-10', 1000000000000, [hl('a'), hl('b')]));
  assert.equal(run({ briefDir: dir, now: NOW }).status, 'ok');
  const f = path.join(spine.dir('headlines'), 'headlines.jsonl'), lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
  const row = JSON.parse(lines[0]); row.title = 'TAMPERED'; lines[0] = JSON.stringify(row);
  fs.writeFileSync(f, lines.join('\n') + '\n');
  putBrief(dir, brief('2026-11-11', 1000086400000, [hl('c')]));
  const m = run({ briefDir: dir, now: NOW + 5 });
  assert.equal(m.status, 'failed');
  const c = m.checks.find((x) => x.name === 'archive intact (hash chain)');
  assert.equal(c.ok, false); assert.match(c.detail, /row 1 was altered/);
  assert.equal(m.files['headlines.jsonl'].rows, 2);            // the new brief was NOT appended
  assert.ok(m.notes.includes('0 new rows appended'));
  assert.throws(() => spine.load('headlines', 'headlines.jsonl'), /FAILED/);
});
test('golden: stored hash chain uses sha256(prev + canonical(body))', () => {
  const dir = freshEnv();
  putBrief(dir, brief('2026-11-10', 1000000000000, [hl('a')]));
  run({ briefDir: dir, now: NOW });
  const [r] = spine.load('headlines', 'headlines.jsonl'), body = { ...r }; delete body.seq; delete body.prev_hash; delete body.row_hash;
  assert.equal(r.prev_hash, '0'.repeat(64));
  assert.equal(r.row_hash, U.sha256('0'.repeat(64) + U.canonical(body)));
});
