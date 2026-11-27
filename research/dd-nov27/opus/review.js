// review.js - independent review harness (Opus). Usage: node review.js <setting> [full]
// Settings (declared before running): BASE, S8 (allSame>8 -> x0.5, bot order bb,ic,tc), S8 under other bot orders
// (S8_<order> via weights key order), S8_coinrev (engine order:'reverse'), S8_nopend (heat ignores same-close orders),
// COMBO = S8 x (equity >= 15% below peak seen at signal times -> x0.75), same peak convention as famA.
'use strict';
const fs = require('fs'), X = require('./causalO');
const [name, only] = process.argv.slice(2);
const W0 = { bb: 0.5, ic: 0.25, tc: 0.25 };
const ordW = (s) => Object.fromEntries(s.split('').map((k) => ({ b: 'bb', i: 'ic', t: 'tc' })[k]).map((b) => [b, W0[b]]));
const s8 = (c) => (c.allSame > 8 ? 0.5 : 1);
const mk = () => {
  const o = { mode: 'live', start: 600, cap: 500 };
  if (name === 'BASE') return o;
  if (name.startsWith('BASE_')) return { ...o, weights: ordW(name.slice(5)) };
  if (name === 'S8') return { ...o, sizeFn: s8 };
  if (name === 'S8_coinrev') return { ...o, sizeFn: s8, order: 'reverse' };
  if (name === 'S8_nopend') return { ...o, sizeFn: s8, heatNoPend: true };
  if (name.startsWith('S8_')) return { ...o, sizeFn: s8, weights: ordW(name.slice(3)) };
  if (name === 'COMBO') { let pk = 0; return { ...o, sizeFn: (c) => { if (c.equity > pk) pk = c.equity; return s8(c) * (pk > 0 && 1 - c.equity / pk >= 0.15 ? 0.75 : 1); } }; }
  throw new Error('unknown ' + name);
};
const go = (extra = {}) => X.run({ ...mk(), ...extra }); // mk() fresh per run (fresh peak state)
const ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000;
const wins = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= X.END) wins.push([ts(y, m), ts(y + 1, m)]);
const full = go(), fs_ = X.stats(full);
const halved = full.trades.filter((t) => t.mult < 1).length;
const res = { name, end: fs_.end, dd: fs_.dd, n: full.trades.length, halved, sumR: full.trades.reduce((a, t) => a + t.R, 0) };
if (only !== 'full') {
  res.f24 = X.stats(go({ from: X.CUT })); res.x2 = X.stats(go({ cost: 2 }));
  res.w = wins.map(([a, b]) => X.stats(go({ from: a, to: b })));
}
fs.writeFileSync(__dirname + '/out-' + name + '.json', JSON.stringify(res));
console.log(name, Math.round(res.end), (100 * res.dd).toFixed(2), res.n, 'reduced', halved);
