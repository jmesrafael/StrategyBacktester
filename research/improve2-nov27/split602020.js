// split602020.js - TRI-CORE 50/25/25 against 60/20/20, year by year on ONE continuous account (US$600 from Jan 2020), causal engine.
//   node split602020.js
'use strict';
const X = require('../improve-nov27/opus-validate/causal');
const ts = (y) => Date.UTC(y, 0, 1) / 1000, p = (v) => (100 * v).toFixed(1), usd = (v) => Math.round(v).toLocaleString('en-US');
const V = [
  ['current 50/25/25, risk x1.0', { bb: 0.5, ic: 0.25, tc: 0.25 }, 1],
  ['60/20/20, risk x1.1', { bb: 0.6, ic: 0.2, tc: 0.2 }, 1.1],
  ['60/20/20, risk x1.0 (split only)', { bb: 0.6, ic: 0.2, tc: 0.2 }, 1],
];
for (const [cap, cl] of [[0, 'NO CAP'], [500, 'US$500 CAP (live bots today)']]) {
  console.log(`\n===== ${cl}`);
  for (const [name, weights, K] of V) {
    const r = X.run({ mode: 'live', start: 600, weights, K, cap }), all = X.stats(r);
    console.log(`\n${name}`);
    for (let y = 2020; y <= 2026; y++) {
      const s = X.stats(r, ts(y), Math.min(ts(y + 1), r.to));
      const tr = r.trades.filter((t) => t.tExit >= ts(y) && t.tExit < ts(y + 1));
      const R = Object.fromEntries(['bb', 'ic', 'tc'].map((b) => [b, tr.filter((t) => t.bot === b).reduce((a, t) => a + t.R, 0)]));
      console.log(`${y} start ${usd(s.start)} end ${usd(s.end)} profit ${usd(s.end - s.start)} return ${p(s.ret)} dd ${p(s.dd)} trades ${tr.length} win ${p(tr.filter((t) => t.pnl > 0).length / tr.length)} R bb ${R.bb.toFixed(0)} ic ${R.ic.toFixed(0)} tc ${R.tc.toFixed(0)}`);
    }
    console.log(`TOTAL start 600 end ${usd(all.end)} profit ${usd(all.end - 600)} multiple ${(all.end / 600).toFixed(0)} growth/yr ${p(all.cagr)} worst dd ${p(all.dd)} trades ${r.trades.length}`);
  }
}
