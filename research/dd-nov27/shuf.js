// shuf.js - rule 5: shuffle test. State-dependent rules (A fall throttle, C streak) are RE-APPLIED on each shuffled path
// (their size depends on that path's own equity / losses); B heat rules depend on trades overlapping in time, which a shuffle
// destroys, so B keeps each trade's size multiplier from the real run (weaker test, said so in the report).
// Closed-trade replay is shallower than the engine, so only compare with the baseline under identical orders.
'use strict';
const { mulberry32 } = require('./mc.js');
const tier = (b) => (b >= 1000 ? 0.015 : b >= 500 ? 0.02 : 0.025), W = { bb: 0.5, ic: 0.25, tc: 0.25 };
function replay(list, dyn) {
  let eq = 600, pk = 600, dd = 0, loss = 0; const pb = {};
  for (const t of list) {
    const base = eq * W[t.bot]; pb[t.bot] = Math.max(pb[t.bot] || 0, base);
    let m = t.mult ?? 1;
    if (dyn?.T && eq < pk * (1 - dyn.T)) m *= dyn.f;
    if (dyn?.n && loss >= dyn.n) m *= dyn.f;
    const risk = Math.min(500, tier(pb[t.bot]) * base * (t.bot === 'bb' ? 1.05 * (t.w ?? 1) : 1) * m);
    eq = Math.max(0, eq + t.R * risk); loss = t.R <= 0 ? loss + 1 : 0;
    if (eq > pk) pk = eq; else if (pk > 0) dd = Math.max(dd, 1 - eq / pk);
  }
  return { end: eq, dd };
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function test(tr, dyn, block, n = 2000) {
  const r = mulberry32(7), s = [...tr].sort((a, b) => a.tExit - b.tExit), ch = [];
  for (let i = 0; i < s.length; i += block) ch.push(s.slice(i, i + block));
  const E = [], D = [];
  for (let k = 0; k < n; k++) { const o = ch.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } const x = replay(o.flat(), dyn); E.push(x.end); D.push(x.dd); }
  return { p: E.filter((e) => e > 600).length / n, med: q(E, .5), p5: q(E, .05), mdd: q(D, .5), p95: q(D, .95) };
}
const A = require('./famA-trades.json'), B = require('./famB-trades.json');
const raw = A.BASELINE; // mult 1 everywhere
const rows = [['BASELINE', raw, null], ['A T10 x0.75', raw, { T: .10, f: .75 }], ['A T15 x0.75', raw, { T: .15, f: .75 }], ['A T20 x0.75', raw, { T: .20, f: .75 }],
  ['C S3 x0.5 (3 losses)', raw, { n: 3, f: .5 }], ['C S2 x0.5', raw, { n: 2, f: .5 }], ['B S8 (static mult)', B.S8, null], ['B R6 (static mult)', B.R6, null]];
const usd = (v) => Math.round(v).toLocaleString('en-US'), pc = (v) => (100 * v).toFixed(1) + '%';
let out = '| Setting | Block | Profit in | Median end | 5th pct end | Median fall | 95th pct fall |\n|---|---|---|---|---|---|---|\n';
for (const b of [1, 5]) for (const [nm, tr, d] of rows) { const s = test(tr, d, b); out += `| ${nm} | ${b} | ${pc(s.p)} | ${usd(s.med)} | ${usd(s.p5)} | ${pc(s.mdd)} | ${pc(s.p95)} |\n`; }
console.log(out); require('fs').writeFileSync(__dirname + '/shuffle-results.md', out);
