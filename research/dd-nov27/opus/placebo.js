// placebo.js - controls: is S8 better than cutting size blindly by the same amount?
// (a) flat multiplier on every trade; (b) random x0.5 on 42.5% of trades (= S8's share of reduced trades), 20 seeds.
'use strict';
const X = require('./causalO'), p = (v) => (100 * v).toFixed(1), u = (v) => Math.round(v).toLocaleString('en-US');
const L = { mode: 'live', start: 600, cap: 500 };
const one = (sf) => { const r = X.run({ ...L, sizeFn: sf }), s = X.stats(r), f = X.stats(X.run({ ...L, sizeFn: sf, from: X.CUT })); return { end: s.end, dd: s.dd, c24: f.cagr, d24: f.dd }; };
for (const k of [0.95, 0.9, 0.85, 0.8]) { const r = one(() => k); console.log('flat', k, u(r.end), p(r.dd), p(r.c24), p(r.d24)); }
const ends = [], dds = [];
for (let seed = 1; seed <= 20; seed++) { const R = X.rng(seed * 977); const r = one(() => (R() < 0.425 ? 0.5 : 1)); ends.push(r.end); dds.push(r.dd); console.log('rand', seed, u(r.end), p(r.dd), p(r.c24), p(r.d24)); }
const srt = (a) => [...a].sort((x, y) => x - y);
console.log('random median end', u(srt(ends)[10]), 'median dd', p(srt(dds)[10]), 'min dd', p(srt(dds)[0]), 'max dd', p(srt(dds)[19]));
