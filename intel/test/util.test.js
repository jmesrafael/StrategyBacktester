'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const U = require('../lib/util');
const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('mean, sum and empty input', () => {
  assert.equal(U.sum([1, 2, 3]), 6);
  assert.equal(U.mean([1, 2, 3, 4]), 2.5);
  assert.ok(Number.isNaN(U.mean([])));
});
test('sd is the population standard deviation (golden: 2,4,4,4,5,5,7,9 -> 2)', () => {
  assert.equal(U.sd([2, 4, 4, 4, 5, 5, 7, 9]), 2);
  assert.equal(U.sd([5, 5, 5]), 0);
  assert.equal(U.sd([1, 3]), 1);          // population: sqrt(((1-2)^2+(3-2)^2)/2) = 1, sample sd would be 1.414
  assert.ok(Number.isNaN(U.sd([])));
});
test('quantile uses linear interpolation; median', () => {
  assert.equal(U.quantile([1, 2, 3, 4], 0), 1);
  assert.equal(U.quantile([1, 2, 3, 4], 1), 4);
  assert.equal(U.quantile([1, 2, 3, 4], 0.25), 1.75);   // p = 0.75 between 1 and 2
  assert.equal(U.quantile([4, 1, 3, 2], 0.5), 2.5);     // unsorted input, input untouched
  close(U.quantile([10, 20, 30], 0.9), 28);             // p = 1.8 -> 20 + 0.8*10
  assert.equal(U.median([3, 1, 2]), 2);
  assert.equal(U.median([1, 2, 3, 4]), 2.5);
  assert.ok(Number.isNaN(U.quantile([], 0.5)));
  const a = [3, 1, 2]; U.quantile(a, 0.5); assert.deepEqual(a, [3, 1, 2]);
});
test('corr: perfect, anti, hand-computed 0.5, degenerate cases', () => {
  close(U.corr([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  close(U.corr([1, 2, 3, 4], [8, 6, 4, 2]), -1);
  close(U.corr([1, 2, 3], [1, 3, 2]), 0.5);   // x=-1,0,1 y=-1,1,0 -> sab=1, saa=2, sbb=2
  assert.equal(U.corr([1, 2], [1, 2]), null);            // n < 3
  assert.equal(U.corr([1, 1, 1], [1, 2, 3]), null);      // zero variance
});
test('round and signed', () => {
  assert.equal(U.round(1.23456, 2), 1.23);
  assert.equal(U.round(NaN), null);
  assert.equal(U.round(null), null);
  assert.equal(U.signed(1.5), '+1.50');
  assert.equal(U.signed(-1.5, 1), '-1.5');
  assert.equal(U.signed(null), '-');
});
test('rng is deterministic per seed and within [0,1)', () => {
  const a = U.rng(42), b = U.rng(42), c = U.rng(43);
  const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
  assert.ok(new Set(sa).size > 45);
});
test('canonical is independent of key order, handles nesting, arrays, undefined', () => {
  assert.equal(U.canonical({ b: 1, a: 2 }), U.canonical({ a: 2, b: 1 }));
  assert.equal(U.canonical({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(U.canonical({ x: { d: 1, c: [3, { z: 1, y: 2 }] } }), '{"x":{"c":[3,{"y":2,"z":1}],"d":1}}');
  assert.equal(U.canonical([2, 1]), '[2,1]');          // array order matters
  assert.equal(U.canonical(undefined), 'null');
  assert.equal(U.canonical(null), 'null');
  assert.equal(U.sha256(U.canonical({ b: 1, a: 2 })), U.sha256(U.canonical({ a: 2, b: 1 })));
});
test('sha256 golden', () => {
  assert.equal(U.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('CSV round trip with commas, quotes, newlines, empty and null cells', () => {
  const rows = [
    { a: 'plain', b: 'with,comma', c: 'say "hi"', d: 'line1\nline2' },
    { a: '', b: null, c: 'x', d: 'crlf\r\nend' },
    { a: 'ends with quote"', b: ',', c: '""', d: '\n' },
  ];
  const text = U.toCsv(rows, ['a', 'b', 'c', 'd']);
  assert.ok(text.startsWith('a,b,c,d\n'));
  const back = U.parseCsv(text);
  assert.equal(back.length, 3);
  assert.deepEqual(back[0], rows[0]);
  assert.deepEqual(back[1], { a: '', b: '', c: 'x', d: 'crlf\r\nend' });
  assert.deepEqual(back[2], rows[2]);
});
test('CSV golden text, objects serialised as JSON, numbers, CRLF input, no rows', () => {
  assert.equal(U.toCsv([{ a: 1, b: 'x,y', c: { k: 1 } }], ['a', 'b', 'c']), 'a,b,c\n1,"x,y","{""k"":1}"\n');
  assert.deepEqual(U.parseCsv('a,b\r\n1,2\r\n3,4\r\n'), [{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  assert.deepEqual(U.parseCsv('a,b\n'), []);
  assert.deepEqual(U.parseCsv(''), []);
  assert.deepEqual(U.parseCsv('a,b\n1\n'), [{ a: '1', b: '' }]);     // short row padded
  assert.deepEqual(U.parseCsv('a,b\n1,2'), [{ a: '1', b: '2' }]);    // no trailing newline
});
test('JSONL round trip', () => {
  const rows = [{ a: 1, s: 'x\ny' }, { a: null, n: { k: [1, 2] } }];
  const t = U.toJsonl(rows);
  assert.equal(t.split('\n').length, 3);          // two lines and the trailing newline
  assert.deepEqual(U.parseJsonl(t), rows);
  assert.equal(U.toJsonl([]), '');
  assert.deepEqual(U.parseJsonl('{"a":1}\n\n  \n{"a":2}\n'), [{ a: 1 }, { a: 2 }]);
});
test('toSec handles ms, s, ISO strings and empties', () => {
  assert.equal(U.toSec(1700000000000), 1700000000);
  assert.equal(U.toSec(1700000000999), 1700000000);
  assert.equal(U.toSec(1700000000), 1700000000);
  assert.equal(U.toSec('2023-11-14T22:13:20Z'), 1700000000);
  assert.equal(U.toSec('2023-11-14T22:13:20.900Z'), 1700000000);
  assert.equal(U.toSec(null), null);
  assert.equal(U.toSec(undefined), null);
  assert.equal(U.toSec(''), null);
});
test('iso and day formatting (UTC)', () => {
  assert.equal(U.iso(1700000000), '2023-11-14 22:13');
  assert.equal(U.day(1700000000), '2023-11-14');
  assert.equal(U.H, 3600); assert.equal(U.D, 86400);
});
test('mdTable', () => {
  const t = U.mdTable([{ a: 1, b: 'x|y' }, { a: null, b: 'z' }], [['A', (r) => r.a], ['B', (r) => r.b]]);
  assert.equal(t, '| A | B |\n|---|---|\n| 1 | x/y |\n| - | z |');
});
