// allaspects.js - which of the 26 settings beat TRI-CORE on EVERY test, without the US$500 risk cap (live account: US$600, risk steps, MEXC minimums).
//   node --max-old-space-size=8192 allaspects.js -> allaspects.json
'use strict';
const fs = require('fs');
const X = require('../improve-nov27/opus-validate/causal');
const p = (v) => (100 * v).toFixed(1), ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000;
const src = fs.readFileSync(__dirname + '/run.js', 'utf8');
const { CAND, TRI, COINS } = new Function('X', src.slice(src.indexOf('X.RULES.ix'), src.indexOf('const FLAT =')) + '; return { CAND, TRI, COINS };')(X);
const LIVE = { mode: 'live', start: 600 }, FLAT = { mode: 'flat', start: 1000 };
const go = (c, acc, from = X.T0, to = X.END, extra = {}) => X.stats(X.run({ ...acc, weights: c.weights, K: c.K, coins: COINS, from, to, ...extra }));
const both = (a, b) => a.cagr > b.cagr && a.dd < b.dd;
const TESTS = [
  ['live full period', (c) => go(c, LIVE)],
  ['live fresh 2020-23', (c) => go(c, LIVE, X.T0, X.CUT)],
  ['live fresh 2024-26', (c) => go(c, LIVE, X.CUT)],
  ['flat 2020-23', (c) => go(c, FLAT, X.T0, X.CUT)],
  ['flat 2024-26', (c) => go(c, FLAT, X.CUT)],
  ['live, double costs', (c) => go(c, LIVE, X.T0, X.END, { cost: 2 })],
  ['live, fills 1h late', (c) => go(c, LIVE, X.T0, X.END, { delayH: 1 })],
];
const base = TESTS.map(([, f]) => f(TRI));
const rows = CAND.map((c) => {
  const res = TESTS.map(([, f]) => f(c)), pass = res.map((r, i) => both(r, base[i]));
  return { c, res, pass, n: pass.filter(Boolean).length };
}).sort((a, b) => b.n - a.n);
console.log('tests: ' + TESTS.map(([n], i) => `${i + 1}=${n}`).join(' | '));
console.log(`TRI-CORE: ${base.map((r) => `${p(r.cagr)}/${p(r.dd)}`).join('  ')}`);
for (const r of rows) console.log(`${String(r.n).padStart(1)}/7 ${r.c.label.padEnd(38)} ${r.pass.map((q) => (q ? 'y' : '.')).join('')}  ${r.res.map((x) => `${p(x.cagr)}/${p(x.dd)}`).join('  ')}`);

// the deeper checks only for settings that pass all 7: rolling 12 months, each calendar year
const wins = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= X.END) wins.push([ts(y, m), ts(y + 1, m)]);
const bw = wins.map(([a, b]) => go(TRI, LIVE, a, b)), by = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => go(TRI, LIVE, ts(y), Math.min(ts(y + 1), X.END)));
const top = rows.filter((r) => r.n >= TESTS.length - 2);
console.log(`\n${rows.filter((r) => r.n === TESTS.length).length} setting(s) pass all 7. Deeper checks on the ${top.length} closest (live account, fresh start each window):`);
for (const r of top) {
  const w = wins.map(([a, b]) => go(r.c, LIVE, a, b)), yr = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => go(r.c, LIVE, ts(y), Math.min(ts(y + 1), X.END)));
  r.roll = { ret: w.filter((x, i) => x.ret > bw[i].ret).length / w.length, dd: w.filter((x, i) => x.dd < bw[i].dd).length / w.length, both: w.filter((x, i) => x.ret > bw[i].ret && x.dd < bw[i].dd).length / w.length,
    worstDD: Math.max(...w.map((x) => x.dd)), baseWorstDD: Math.max(...bw.map((x) => x.dd)) };
  r.years = yr.map((x, i) => ({ y: 2020 + i, ret: x.ret, dd: x.dd, tri: by[i] }));
  console.log(`${r.c.label}: 12-month runs higher return ${p(r.roll.ret)}%, smaller fall ${p(r.roll.dd)}%, both ${p(r.roll.both)}%, worst 12-month fall ${p(r.roll.worstDD)} vs ${p(r.roll.baseWorstDD)}`);
  console.log('   years (return/fall vs TRI): ' + r.years.map((x) => `${x.y} ${p(x.ret)}/${p(x.dd)} vs ${p(x.tri.ret)}/${p(x.tri.dd)}`).join(' | '));
}
fs.writeFileSync(__dirname + '/allaspects.json', JSON.stringify({ tests: TESTS.map(([n]) => n), base, rows: rows.map((r) => ({ label: r.c.label, weights: r.c.weights, K: r.c.K, res: r.res, pass: r.pass, roll: r.roll, years: r.years })) }));
