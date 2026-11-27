// surv.js - survivor checks for 6/6 settings: every 12-month start (live US$600) and each calendar year, vs live TRI-CORE.
//   node surv.js  -> surv.json + printed table. Candidates are listed in CAND (add winners from other families here).
'use strict';
const fs = require('fs'), H = require('./h.js'), X = H.X, p = H.p, ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000;
const CAND = JSON.parse(process.env.CAND || 'null') || [
  { label: 'T-CORE trail 10', spec: { tc: { kTrail: 10 } } },
  { label: 'T-CORE trail 11', spec: { tc: { kTrail: 11 } } },
];
const LIVE = { mode: 'live', start: 600, cap: 500 };
const go = (c, a, b) => { const o = { ...LIVE, ...c, from: a, to: b }; delete o.label; delete o.engine; if (c.sizeFn) o.sizeFn = c.sizeFn(); const E = c.engine || X; return E.stats(E.run(o)); };
const wins = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= X.END) wins.push([ts(y, m), ts(y + 1, m)]);
const yrs = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => [ts(y), Math.min(ts(y + 1), X.END)]);
const B = { w: wins.map(([a, b]) => go({}, a, b)), y: yrs.map(([a, b]) => go({}, a, b)) };
const out = [];
for (const c of CAND) {
  const w = wins.map(([a, b]) => go(c, a, b)), y = yrs.map(([a, b]) => go(c, a, b));
  const r = { label: c.label, ret: w.filter((x, i) => x.ret > B.w[i].ret).length, dd: w.filter((x, i) => x.dd < B.w[i].dd).length,
    both: w.filter((x, i) => x.ret > B.w[i].ret && x.dd < B.w[i].dd).length, n: w.length, worst: Math.max(...w.map((x) => x.dd)), bworst: Math.max(...B.w.map((x) => x.dd)),
    losing: w.filter((x) => x.ret < 0).length, blosing: B.w.filter((x) => x.ret < 0).length,
    years: y.map((x, i) => `${2020 + i} ${p(x.ret)}/${p(x.dd)} vs ${p(B.y[i].ret)}/${p(B.y[i].dd)}`) };
  console.log(`${c.label}: 12-month starts higher return ${r.ret}/${r.n}, smaller fall ${r.dd}/${r.n}, both ${r.both}/${r.n}; worst 12-month fall ${p(r.worst)} vs ${p(r.bworst)}; losing windows ${r.losing} vs ${r.blosing}`);
  console.log('   years return/fall (vs live): ' + r.years.join(' | '));
  out.push(r);
}
fs.writeFileSync(__dirname + '/surv-' + (process.env.TAG || 'f1') + '.json', JSON.stringify(out, null, 1));
