'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-validator-'));
process.env.INTEL_DATA = TMP;
const spine = require('../lib/spine');
const V = require('../engines/validator');
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const CUT = Date.UTC(2024, 0, 1) / 1000, DAY = 86400;
const ts = (y, m = 5) => Date.UTC(y, m, 15) / 1000;
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test('exports', () => {
  for (const k of ['validate', 'runOne', 'selftest', 'causality', 'sizeAndSignificance', 'outOfSample', 'concentration', 'perYear', 'leaveOneCoinOut', 'walkForward', 'neighbours', 'overlapWithBots', 'runAll', 'logExperiment']) assert.equal(typeof V[k], 'function', k);
});

test('concentration: passes when the total without the 10 best trades is positive', () => {
  const tr = [...rep(10, () => ({ R: 5 })), ...rep(20, () => ({ R: 0.5 }))];
  const c = V.concentration(tr);
  assert.equal(c.pass, true); near(c.value, 10);
});
test('concentration: fails when the 10 best carry everything (50 - 20 total 30, rest -20)', () => {
  const tr = [...rep(10, () => ({ R: 5 })), ...rep(20, () => ({ R: -1 }))];
  const c = V.concentration(tr);
  assert.equal(c.pass, false); near(c.value, -20);
});
test('perYear: counts positive years by exit year (4 of 5 = 0.8 pass, 2 of 5 = 0.4 fail, 3 of 5 = 0.6 pass)', () => {
  const mk = (signs) => signs.map((s, i) => ({ R: s, tExit: ts(2021 + i) }));
  const a = V.perYear(mk([1, -1, 1, 1, 1])); assert.equal(a.pass, true); near(a.value, 0.8);
  const b = V.perYear(mk([1, -1, -1, 1, -1])); assert.equal(b.pass, false); near(b.value, 0.4);
  assert.equal(V.perYear(mk([1, -1, 1, -1, 1])).pass, true);
  assert.equal(V.perYear([]).pass, false);
});
test('perYear: trades of one year are summed, and the year is the exit year not the entry year', () => {
  const tr = [{ R: 2, tExit: ts(2022) }, { R: -1, tExit: ts(2022, 7) }, { R: -3, tExit: ts(2023) }];
  const r = V.perYear(tr); near(r.value, 0.5); assert.equal(r.pass, false);
  assert.equal(V.perYear([{ R: 1, t: ts(2020), tExit: ts(2021) }]).detail.includes('2021'), true);
});
test('leaveOneCoinOut: fails when one coin carries all the profit', () => {
  const tr = [{ coin: 'A', R: 10 }, { coin: 'B', R: -2 }, { coin: 'C', R: 1 }];
  const r = V.leaveOneCoinOut(tr, ['A', 'B', 'C']);
  assert.equal(r.pass, false); near(r.value, -1);       // without A: -2 + 1
});
test('leaveOneCoinOut: passes when every coin-out total stays positive', () => {
  const r = V.leaveOneCoinOut([{ coin: 'A', R: 5 }, { coin: 'B', R: 4 }, { coin: 'C', R: 3 }], ['A', 'B', 'C']);
  assert.equal(r.pass, true); near(r.value, 7);
});
test('outOfSample: needs at least 40 trades from 2024 on and a positive average', () => {
  const pre = rep(30, (i) => ({ R: 1, t: CUT - (i + 1) * DAY }));
  const post = (n, R) => rep(n, (i) => ({ R, t: CUT + i * DAY }));
  assert.equal(V.outOfSample([...pre, ...post(39, 1)]).pass, false);
  const ok = V.outOfSample([...pre, ...post(40, 0.5)]);
  assert.equal(ok.pass, true); near(ok.value, 0.5); near(ok.deg, 0.5);
  assert.equal(V.outOfSample([...pre, ...post(40, -0.1)]).pass, false);
  assert.equal(V.outOfSample([...pre, ...post(40, 0)]).pass, false, 'zero average is not positive');
});
test('outOfSample: the cut is 2024-01-01 00:00 UTC on the ENTRY time t', () => {
  const t = [{ R: 1, t: CUT - 1 }, ...rep(40, () => ({ R: 1, t: CUT }))];
  assert.equal(V.outOfSample(t).pass, true);
  assert.equal(V.outOfSample([...rep(39, () => ({ R: 1, t: CUT })), { R: 1, t: CUT - 1 }]).pass, false);
});
test('sizeAndSignificance: 150 trades, mean 1, sd 0.5017 => t 24.41 passes', () => {
  const tr = rep(150, (i) => ({ R: i % 2 ? 0.5 : 1.5 }));
  const r = V.sizeAndSignificance(tr, 1);
  assert.equal(r.pass, true); near(r.value, 1 / (Math.sqrt(37.5 / 149) / Math.sqrt(150)), 1e-9); near(r.value, 24.41, 0.01);
});
test('sizeAndSignificance: 149 trades fail however good; t below 2 fails at 150', () => {
  assert.equal(V.sizeAndSignificance(rep(149, (i) => ({ R: i % 2 ? 0.5 : 1.5 })), 1).pass, false);
  const weak = rep(150, (i) => ({ R: i % 2 ? 1.1 : -0.9 }));       // mean 0.1, t about 1.22
  const r = V.sizeAndSignificance(weak, 1); assert.equal(r.pass, false); near(r.value, 1.22, 0.01);
});
test('sizeAndSignificance: the bar rises with the number of experiments (t 2.44 passes at 1, fails after 10)', () => {
  const tr = rep(150, (i) => ({ R: i % 2 ? 1.2 : -0.8 }));        // mean 0.2
  assert.equal(V.sizeAndSignificance(tr, 1).pass, true);
  const r = V.sizeAndSignificance(tr, 10);
  assert.equal(r.pass, false);
  assert.ok(r.detail.includes('3.07'), r.detail);                  // 2 + 0.5 x sqrt(2 ln 10)
});

// ---- logExperiment: append-only hash chain ----
const row = (name, o = {}) => ({ name, at: 1700000000, coins: 'SOL ADA', verdict: 'REJECTED', hard_failed: '2,3', trades: 100, avg_r: 0.05, params_hash: 'abcd', ...o });
const logFile = () => path.join(spine.dir('experiments'), 'log.jsonl');
test('logExperiment: two calls give a verified chain of 2 rows', () => {
  assert.ok(TMP.startsWith(os.tmpdir()) && spine.ROOT() === TMP);
  const m1 = V.logExperiment(row('one')); assert.equal(m1.status, 'ok');
  const m2 = V.logExperiment(row('two')); assert.equal(m2.status, 'ok');
  const rows = spine.load('experiments', 'log.jsonl');
  assert.equal(rows.length, 2); assert.deepEqual(rows.map((r) => r.seq), [1, 2]); assert.equal(rows[1].prev_hash, rows[0].row_hash);
  assert.equal(spine.chainVerify(rows), null);
  assert.deepEqual(spine.verify('experiments'), []);
});
test('logExperiment: editing a stored row on disk makes the next call throw', () => {
  const f = logFile(); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"one"', '"ONE"'));
  assert.throws(() => V.logExperiment(row('three')), /altered/);
});

// a passing strategy has no failed hard checks, so hard_failed is '' in runOne. The schema treats '' as empty.
test('logExperiment: a PASSES verdict with no failed checks (hard_failed empty) is stored', {}, () => {
  const sub = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-validator-b-')), prev = process.env.INTEL_DATA;
  process.env.INTEL_DATA = sub;
  try {
    const m = V.logExperiment(row('pass', { verdict: 'PASSES', hard_failed: '' }));
    assert.equal(m.status, 'ok');
    assert.equal(spine.load('experiments', 'log.jsonl').length, 1);
  } finally { process.env.INTEL_DATA = prev; fs.rmSync(sub, { recursive: true, force: true }); }
});
