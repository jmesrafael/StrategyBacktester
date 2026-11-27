// verify.js - extra checks on the passing version (PLAN.md, "Extra checks").  node verify.js -> verify.json
'use strict';
const fs = require('fs');
const E = require('./engine');
const C = require('../../candles/candles.js');
const { H, T0, END, CUT, PHP, OWN, BASE, trades, tradesOn, account, stats } = E;
const PICK = require('./round3').find((f) => f.id === 'C3').versions;
const RES = require('./results-round3.json').families.find((f) => f.id === 'C3');
const rule = PICK.find((v) => v.label === RES.pick).mult, K = RES.k;
const p = (v) => (100 * v).toFixed(1), OUT = { pick: RES.pick, k: K };
const ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000;
const bots = (rev) => Object.entries(BASE).map(([id, weight]) => ({ id, weight, trades: rev ? [...trades(id)].sort((a, b) => a.t - b.t || b.c.localeCompare(a.c)) : trades(id) }));
const run = (o, rev, live, from = T0, to = END) => account(bots(rev), { ...o, from, to, ...(live ? { mexc: true, flat: false, start: 1000 / PHP } : {}) });
const tri = {}, c3 = { k: K, mult: rule };

console.log('picked:', RES.pick, 'k', K.toFixed(3));
console.log('C3 settings (2020-23 growth/fall | 2024-26 growth/fall)');
for (const r of RES.rows) console.log('  ', r.label.padEnd(44), 'k', r.k.toFixed(2), p(r.is.cagr), p(r.is.dd), '|', p(r.oos.cagr), p(r.oos.dd), r.r3 ? 'pass3' : '');

console.log('\norder reversed');
for (const [n, o] of [['TRI', tri], ['rule', c3]]) {
  const a = stats(run(o, true, false, T0, CUT)), b = stats(run(o, true, false, CUT)), l = stats(run(o, true, true));
  console.log('  ', n.padEnd(5), `20-23 ${p(a.cagr)}/${p(a.dd)} 24-26 ${p(b.cagr)}/${p(b.dd)} live PHP ${Math.round(l.end * PHP)} fall ${p(l.dd)}`);
}

console.log('\nrisk sweep (live account, and flat 2.5% both halves)'); OUT.sweep = [];
for (const [n, o] of [['TRI today', tri], ...[1, 1.05, K, 1.15].map((k) => [`rule, risk x${k.toFixed(2)}`, { k, mult: rule }])]) {
  const l = stats(run(o, false, true)), a = stats(run(o, false, false, T0, CUT)), b = stats(run(o, false, false, CUT));
  OUT.sweep.push({ n, live: { end: l.end * PHP, cagr: l.cagr, dd: l.dd }, is: a, oos: b });
  console.log('  ', n.padEnd(18), `live PHP ${Math.round(l.end * PHP)} growth ${p(l.cagr)} fall ${p(l.dd)} | 20-23 ${p(a.cagr)}/${p(a.dd)} | 24-26 ${p(b.cagr)}/${p(b.dd)}`);
}

console.log('\nyear by year (live account, compounding): return / worst fall inside the year');
const curves = { tri: run(tri, false, true), k1: run({ mult: rule }, false, true), c3: run(c3, false, true) }; OUT.years = [];
for (let y = 2020; y <= 2026; y++) {
  const row = { y };
  for (const [n, r] of Object.entries(curves)) {
    const a = Math.round((ts(y) - T0) / H), b = Math.min(r.curve.length, Math.round((ts(y + 1) - T0) / H)), s0 = a ? r.curve[a - 1] : r.start;
    let pk = s0, dd = 0; for (let i = a; i < b; i++) { pk = Math.max(pk, r.curve[i]); dd = Math.max(dd, 1 - r.curve[i] / pk); }
    row[n] = { ret: r.curve[b - 1] / s0 - 1, dd, end: r.curve[b - 1] * PHP };
  }
  OUT.years.push(row); console.log('  ', y, `TRI ${p(row.tri.ret)} / ${p(row.tri.dd)}   rule x1.00 ${p(row.k1.ret)} / ${p(row.k1.dd)}   rule x${K.toFixed(2)} ${p(row.c3.ret)} / ${p(row.c3.dd)}`);
}

// 3-month block reshuffle of monthly returns, same months for both
const monthly = (r) => { const out = []; let prev = r.start; for (let i = 0; i < r.curve.length; i++) { const t = T0 + (i + 1) * H; if ((t % 86400 === 0 && new Date(t * 1000).getUTCDate() === 1) || i === r.curve.length - 1) { out.push(r.curve[i] / prev - 1); prev = r.curve[i]; } } return out; };
const A = monthly(curves.tri), B = monthly(curves.c3); let seed = 12345;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
let br = 0, bd = 0, both = 0; const N = 5000;
for (let s = 0; s < N; s++) {
  const idx = []; while (idx.length < 24) { const a = Math.floor(rnd() * A.length); for (let j = 0; j < 3 && idx.length < 24; j++) idx.push((a + j) % A.length); }
  const f = (m) => { let v = 1, pk = 1, d = 0; for (const i of idx) { v *= 1 + m[i]; pk = Math.max(pk, v); d = Math.max(d, 1 - v / pk); } return [v, d]; };
  const a = f(A), b = f(B); if (b[0] > a[0]) br++; if (b[1] < a[1]) bd++; if (b[0] > a[0] && b[1] < a[1]) both++;
}
OUT.reshuffle = { ret: br / N, dd: bd / N, both: both / N };
console.log(`\nreshuffled 24-month histories: higher return ${p(br / N)}%, smaller fall ${p(bd / N)}% (month-end values), both ${p(both / N)}%`);

// other coins
const used = new Set(Object.values(OWN).flat());
const pool = C.coins().filter((c) => !used.has(c)).filter((c) => { try { const r = C.load(c, '4h'); C.funding(c); return r[0][0] < ts(2022) && r[r.length - 1][0] > ts(2026, 9); } catch { return false; } });
console.log(`\nother-coin pool: ${pool.length} coins`);
seed = 777; const rows = [];
for (let n = 0; n < 200; n++) {
  const d = [...pool]; for (let i = 0; i < 8; i++) { const j = i + Math.floor(rnd() * (d.length - i)); [d[i], d[j]] = [d[j], d[i]]; }
  const [q1, q2, q3, q4, q5, q6, q7, q8] = d, set = { bb: [q1, q2, q3, q4, q5, q6], ic: [q1, q2, q3, q4, q5, q7], tc: [q1, q2, q3, q4, q5, q7, q8, q6] };
  const bs = Object.entries(BASE).map(([id, weight]) => ({ id, weight, trades: tradesOn(id, set[id]) }));
  const f = (o, from, to) => stats(account(bs, { ...o, from, to }));
  const row = {}; for (const [key, from, to] of [['all', T0, END], ['is', T0, CUT], ['oos', CUT, END]]) row[key] = { tri: f(tri, from, to), c3: f(c3, from, to), c1: f({ mult: rule }, from, to) };
  rows.push(row);
}
const share = (fn) => rows.filter(fn).length / rows.length, score = (s) => Math.log(Math.max(1e-9, 1 + s.cagr)) / s.dd;
OUT.other = { pool: pool.length, sets: rows.length };
for (const key of ['all', 'is', 'oos']) {
  const o = { growth: share((r) => r[key].c3.cagr > r[key].tri.cagr), fall: share((r) => r[key].c3.dd < r[key].tri.dd), both: share((r) => r[key].c3.cagr > r[key].tri.cagr && r[key].c3.dd < r[key].tri.dd),
    perFall: share((r) => score(r[key].c3) > score(r[key].tri)), x1fall: share((r) => r[key].c1.dd < r[key].tri.dd), x1growth: share((r) => r[key].c1.cagr > r[key].tri.cagr), x1perFall: share((r) => score(r[key].c1) > score(r[key].tri)) };
  const med = (g) => { const v = rows.map(g).sort((a, b) => a - b); return v[v.length >> 1]; };
  Object.assign(o, { triG: med((r) => r[key].tri.cagr), triD: med((r) => r[key].tri.dd), c3G: med((r) => r[key].c3.cagr), c3D: med((r) => r[key].c3.dd), c1G: med((r) => r[key].c1.cagr), c1D: med((r) => r[key].c1.dd) });
  OUT.other[key] = o;
  console.log(`  ${key.padEnd(4)} rule x${K.toFixed(2)}: higher growth ${p(o.growth)}%, smaller fall ${p(o.fall)}%, both ${p(o.both)}%, more growth per fall ${p(o.perFall)}% | rule x1.00: smaller fall ${p(o.x1fall)}%, higher growth ${p(o.x1growth)}%, per fall ${p(o.x1perFall)}%`);
  console.log(`       median growth/fall: TRI ${p(o.triG)}/${p(o.triD)}  rule x${K.toFixed(2)} ${p(o.c3G)}/${p(o.c3D)}  rule x1.00 ${p(o.c1G)}/${p(o.c1D)}`);
}
fs.writeFileSync(__dirname + '/verify.json', JSON.stringify(OUT));
