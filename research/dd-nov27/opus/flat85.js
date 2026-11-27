// flat85.js - control: flat x0.85 on every trade (same end as S8), same 71 windows; how often does S8 beat it?
'use strict';
const X = require('./causalO'), S8 = require('./out-S8.json'), NP = require('./out-S8_nopend.json');
const L = { mode: 'live', start: 600, cap: 500, sizeFn: () => 0.85 };
const ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, wins = [];
for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= X.END) wins.push([ts(y, m), ts(y + 1, m)]);
const w = wins.map(([a, b]) => X.stats(X.run({ ...L, from: a, to: b })));
const cmp = (R) => ({ smallerFall: R.w.filter((x, i) => x.dd < w[i].dd).length, higherRet: R.w.filter((x, i) => x.ret > w[i].ret).length, both: R.w.filter((x, i) => x.dd < w[i].dd && x.ret > w[i].ret).length });
console.log('S8 vs flat0.85', cmp(S8), ' S8_nopend vs flat0.85', cmp(NP));
const x2 = X.stats(X.run({ ...L, cost: 2 })); console.log('flat0.85 x2', Math.round(x2.end), (100 * x2.dd).toFixed(1));
