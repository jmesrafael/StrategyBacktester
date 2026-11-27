// measure.js - TRI-CORE today vs the crowded-side rule at risk x1.00 / x1.05 / x1.11 on my causal engine (strict mode:
// 1h stop timing, exits at the next open, skipped trades free the coin, live coin order, hourly marks).  node measure.js > measure.out
'use strict';
const fs = require('fs'), path = require('path');
const X = require('./causal');
const p = (v) => (100 * v).toFixed(1), ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000;
const V = { 'TRI today': {}, 'rule x1.00': { rule: X.RULE }, 'rule x1.05': { rule: X.RULE, K: 1.05 }, 'rule x1.11': { rule: X.RULE, K: 1.11 } };
const ACC = {
  'live PHP 1,000 no cap (as the earlier study)': { mode: 'live', start: 1000 / 60 },
  'live US$600 + US$500 risk cap (live config)': { mode: 'live', start: 600, cap: 500 },
  'flat 2.5% judging account': { mode: 'flat', start: 1000 },
};
const out = { full: {}, halves: {}, years: {}, roll: {}, sweep: {} };
const yearsOf = (r) => { const res = []; for (let y = 2020; y <= 2026; y++) { const s = X.stats(r, ts(y), Math.min(ts(y + 1), r.to)); res.push({ y, ret: s.ret, dd: s.dd }); } return res; };
for (const [an, ao] of Object.entries(ACC)) {
  out.full[an] = {}; out.years[an] = {};
  for (const [vn, vo] of Object.entries(V)) {
    const r = X.run({ ...ao, ...vo }), s = X.stats(r);
    out.full[an][vn] = { end: s.end, cagr: s.cagr, dd: s.dd, skipMin: r.stat.skipMin, skipMargin: r.stat.skipMargin, trades: r.trades.length };
    out.years[an][vn] = yearsOf(r);
    console.log(an.padEnd(46), vn.padEnd(11), 'end', an.includes('PHP') ? 'PHP ' + Math.round(s.end * 60).toLocaleString() : 'US$ ' + Math.round(s.end).toLocaleString(), 'growth/yr', p(s.cagr), 'worst fall', p(s.dd), 'trades', r.trades.length, 'skipped (min/margin)', r.stat.skipMin, r.stat.skipMargin);
  }
}
// fresh starts: 2020-23 and 2024-26, judging account and realistic live account
for (const [an, ao] of [['flat', { mode: 'flat', start: 1000 }], ['live US$600 cap', { mode: 'live', start: 600, cap: 500 }]]) {
  out.halves[an] = {};
  for (const [vn, vo] of Object.entries(V)) {
    const a = X.stats(X.run({ ...ao, ...vo, from: X.T0, to: X.CUT })), b = X.stats(X.run({ ...ao, ...vo, from: X.CUT, to: X.END }));
    out.halves[an][vn] = { is: a, oos: b };
    console.log('halves', an.padEnd(16), vn.padEnd(11), `2020-23 ${p(a.cagr)}%/yr fall ${p(a.dd)} | 2024-26 ${p(b.cagr)}%/yr fall ${p(b.dd)}`);
  }
}
// rolling 12 months, fresh start each month (US$600 + cap, and flat)
for (const [an, ao] of [['flat', { mode: 'flat', start: 1000 }], ['live US$600 cap', { mode: 'live', start: 600, cap: 500 }]]) {
  out.roll[an] = {};
  const wins = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= X.END) wins.push([ts(y, m), ts(y + 1, m)]);
  const base = wins.map(([a, b]) => X.stats(X.run({ ...ao, from: a, to: b })));
  for (const vn of ['rule x1.00', 'rule x1.05', 'rule x1.11']) {
    const w = wins.map(([a, b]) => X.stats(X.run({ ...ao, ...V[vn], from: a, to: b })));
    const ret = w.filter((x, i) => x.ret > base[i].ret).length / w.length, dd = w.filter((x, i) => x.dd < base[i].dd).length / w.length;
    const both = w.filter((x, i) => x.ret > base[i].ret && x.dd < base[i].dd).length / w.length;
    const worstBase = Math.max(...base.map((x) => x.dd)), worstRule = Math.max(...w.map((x) => x.dd));
    const medRet = (arr) => { const s = arr.map((x) => x.ret).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    out.roll[an][vn] = { n: w.length, higherReturn: ret, smallerFall: dd, both, worstFallBase: worstBase, worstFallRule: worstRule, medianRetBase: medRet(base), medianRetRule: medRet(w) };
    console.log('rolling 12m', an.padEnd(16), vn.padEnd(11), `n ${w.length} higher return ${p(ret)}% smaller fall ${p(dd)}% both ${p(both)}% | worst 12m fall ${p(worstBase)} -> ${p(worstRule)} | median 12m return ${p(medRet(base))} -> ${p(medRet(w))}`);
  }
}
// path dependence at a tiny start: start balance PHP 700..1,500 and start month Jan..Jun 2020
out.sweep.rows = [];
for (const php of [700, 800, 900, 1000, 1100, 1200, 1300, 1500]) for (const m of [0, 1, 2, 3, 4, 5]) {
  const o = { mode: 'live', start: php / 60, from: ts(2020, m) };
  const a = X.stats(X.run(o)), b = X.stats(X.run({ ...o, ...V['rule x1.11'] })), c = X.stats(X.run({ ...o, ...V['rule x1.05'] }));
  out.sweep.rows.push({ php, m, tri: a, r111: b, r105: c });
}
const sw = out.sweep.rows, f = (k, t) => sw.filter(t).length / sw.length;
out.sweep.summary = { n: sw.length, r111MoreMoney: f(0, (r) => r.r111.end > r.tri.end), r111SmallerFall: f(0, (r) => r.r111.dd < r.tri.dd), r111Both: f(0, (r) => r.r111.end > r.tri.end && r.r111.dd < r.tri.dd),
  r105MoreMoney: f(0, (r) => r.r105.end > r.tri.end), r105SmallerFall: f(0, (r) => r.r105.dd < r.tri.dd), r105Both: f(0, (r) => r.r105.end > r.tri.end && r.r105.dd < r.tri.dd),
  triFallRange: [Math.min(...sw.map((r) => r.tri.dd)), Math.max(...sw.map((r) => r.tri.dd))], r111FallRange: [Math.min(...sw.map((r) => r.r111.dd)), Math.max(...sw.map((r) => r.r111.dd))],
  medianDdDiff111: (() => { const d = sw.map((r) => r.r111.dd - r.tri.dd).sort((a, b) => a - b); return d[Math.floor(d.length / 2)]; })(),
  medianEndRatio111: (() => { const d = sw.map((r) => r.r111.end / r.tri.end).sort((a, b) => a - b); return d[Math.floor(d.length / 2)]; })() };
console.log('start-balance / start-month sweep (48 live PHP runs, no cap):', JSON.stringify(out.sweep.summary));
for (const an of Object.keys(out.years)) { console.log('years', an); for (let i = 0; i < 7; i++) console.log('  ', 2020 + i, Object.entries(out.years[an]).map(([vn, ys]) => `${vn} ${p(ys[i].ret)}/${p(ys[i].dd)}`).join(' | ')); }
fs.writeFileSync(path.join(__dirname, 'measure.json'), JSON.stringify(out, null, 1));
