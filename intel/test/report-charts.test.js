// The admin report's chart helpers: every function must return a complete, well-formed SVG with the data drawn in it.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const K = require('../report/charts');
const balanced = (s) => { const open = (s.match(/<(svg|g|text|path|rect|line|circle)\b/g) || []).length, selfOrClosed = (s.match(/<(path|rect|line|circle)\b[^>]*\/>/g) || []).length + (s.match(/<\/(svg|g|text)>/g) || []).length; return open === selfOrClosed; };
test('esc escapes markup so a title cannot break the page', () => assert.equal(K.esc('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;'));
test('ticks gives round steps inside the range', () => { const t = K.ticks(0, 97, 5); assert.deepEqual(t, [0, 20, 40, 60, 80]); });
test('line draws one path per series, the legend names, and is well formed', () => {
  const s = K.line({ series: [{ name: 'A', color: '#000', pts: [[0, 1], [1, 3], [2, 2]] }, { name: 'B', color: '#f00', pts: [[0, 0], [2, 1]] }], hlines: [{ y: 1, label: 'limit' }], vlines: [{ x: 1, label: '1' }], marks: [{ x: 1, y: 3, color: '#f00', shape: 'tri' }] });
  assert.ok(s.startsWith('<svg') && s.endsWith('</svg>')); assert.equal((s.match(/stroke-linejoin="round"/g) || []).length, 2); assert.ok(s.includes('>A<') && s.includes('>B<') && s.includes('limit')); assert.ok(balanced(s));
});
test('bars colours positive green and negative red, and handles missing values', () => {
  const s = K.bars({ items: [{ label: 'x', value: 2 }, { label: 'y', value: -1 }, { label: 'z', values: [1, null] }] });
  assert.ok(s.includes(K.C.green) && s.includes(K.C.red)); assert.ok(balanced(s));
});
test('ranges draws a line and a dot for every row', () => { const s = K.ranges({ rows: [{ label: 'a', lo: -1, hi: 1, mid: 0, color: '#000' }, { label: 'b', lo: 0.5, hi: 2, mid: 1, color: '#000' }], xmin: -3, xmax: 3 }); assert.equal((s.match(/<circle/g) || []).length, 2); assert.ok(balanced(s)); });
test('matrix shows pass, fail and skip cells and the verdict', () => { const s = K.matrix({ cols: ['c1', 'c2', 'c3'], rows: [{ label: 'r', cells: ['pass', 'fail', 'skip'], verdict: 'WATCH' }] }); assert.ok(s.includes('✓') && s.includes('✗') && s.includes('WATCH')); assert.ok(balanced(s)); });
test('stacked sizes segments by value', () => { const s = K.stacked({ items: [{ label: 'a', x: 5, y: 5 }], keys: ['x', 'y'], colors: ['#000', '#fff'] }); assert.equal((s.match(/<rect/g) || []).length, 4); assert.ok(balanced(s)); });
test('an empty series does not throw', () => assert.ok(K.bars({ items: [] }).startsWith('<svg')));
