// f-bbonly.js: BB-CORE switch question. Standalone and 50/25/25 account (T14 + I-CORE unchanged), whole period and 2024-26,
// options: keep; tweak 1.05x; tweak 1.00x; current at equal average risk; current at equal open / closed drop. Then: can 3 months settle it?
'use strict';
const K = require('./core');
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d);
const CUT = Date.UTC(2024, 0, 1) / 1000;
const bb = (o, a, b) => K.book([{ trades: K.bbTrades(o), weight: 1 }], a, b);
const acc = (o, a, b) => K.book(K.portfolio(o, 14), a, b);
const T100 = { iiShort: true, iiLen: 21, adxTh: 27, adxLen: 14 }, T105 = K.NEW_BB;
const live = bb({}), t105 = bb(T105), t100 = bb(T100);
const opts = [
  ['Keep current (x1.00)', {}], ['Tweak 1.05x', T105], ['Tweak 1.00x', T100],
  [`Current x${t105.avgW.toFixed(3)} (= 1.05x avg risk)`, { mult: t105.avgW }], [`Current x${t100.avgW.toFixed(3)} (= 1.00x avg risk)`, { mult: t100.avgW }],
  [`Current x${(t105.mdd / live.mdd).toFixed(3)} (= 1.05x open drop)`, { mult: t105.mdd / live.mdd }], [`Current x${(t105.dd / live.dd).toFixed(3)} (= 1.05x closed drop)`, { mult: t105.dd / live.dd }],
];
console.log('| Option | BB R | BB drop closed | BB drop open | BB 2024-26 R / open drop | Account R | Account drop closed | Account drop open | Account 2024-26 R / open drop |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const [n, o] of opts) { const a = bb(o), b = bb(o, CUT), c = acc(o), d = acc(o, CUT);
  console.log(`| ${n} | ${f(a.R)} | ${a.dd.toFixed(1)} | ${a.mdd.toFixed(1)} | ${f(b.R)} / ${b.mdd.toFixed(1)} | ${f(c.R)} | ${c.dd.toFixed(1)} | ${c.mdd.toFixed(1)} | ${f(d.R)} / ${d.mdd.toFixed(1)} |`); }
// where is the account open drop set? date of the worst account drop, and BB's share in it
function worst(r, a = K.T0) { let c = 0, p = 0, pi = 0, best = { dd: 0 }; for (let i = 0; i < r.inc.length; i++) { c += r.inc[i]; if (c > p) { p = c; pi = i; } if (p - c > best.dd) best = { dd: p - c, from: pi, to: i }; } const iso = (i) => new Date((a + i * K.IV) * 1000).toISOString().slice(0, 10); return { ...best, fromD: iso(best.from), toD: iso(best.to) }; }
const ac = acc({}), w = worst(ac);
console.log(`\nAccount worst open drop ${w.dd.toFixed(1)} from ${w.fromD} to ${w.toD}`);
for (const [n, parts] of [['BB part', [{ trades: K.bbTrades({}), weight: 0.5 }]], ['BB 1.05x part', [{ trades: K.bbTrades(T105), weight: 0.5 }]], ['I part', [{ trades: K.icTrades(), weight: 0.25 }]], ['T part', [{ trades: K.tcTrades(14), weight: 0.25 }]]]) {
  const r = K.book(parts); let s = 0; for (let i = w.from + 1; i <= w.to; i++) s += r.inc[i]; console.log(`  ${n} R in that window ${f(s, 1)}`);
}
const bw = worst(live), bw2 = worst(t105); console.log(`BB live worst open drop ${bw.dd.toFixed(1)} ${bw.fromD}..${bw.toD}; 1.05x ${bw2.dd.toFixed(1)} ${bw2.fromD}..${bw2.toD}`);
// correlation of BB with rest of account (monthly)
// 3-month windows: trades per quarter, and how often a quarter's R difference has the long-run sign
const qs = []; for (let y = 2020; y <= 2026; y++) for (let q = 0; q < 4; q++) { const a = Date.UTC(y, 3 * q, 1) / 1000, b = Date.UTC(y, 3 * q + 3, 1) / 1000; if (b > K.END) continue; if (a < Date.UTC(2020, 3, 1) / 1000) continue;
  const L = bb({}, a, b), N = bb(T105, a, b), N0 = bb(T100, a, b), E = bb({ mult: t105.avgW }, a, b); qs.push({ a, n: L.n, d105: N.R - L.R, d100: N0.R - L.R, dEq: N.R - E.R, ddo: N.mdd - L.mdd, ddoEq: N.mdd - E.mdd }); }
const m = (a) => a.reduce((s, v) => s + v, 0) / a.length, sd = (a) => { const u = m(a); return Math.sqrt(a.reduce((s, v) => s + (v - u) ** 2, 0) / (a.length - 1)); };
console.log(`\n${qs.length} full quarters. BB trades per quarter: mean ${m(qs.map((q) => q.n)).toFixed(0)}`);
for (const [k, lab] of [['d105', '1.05x minus current, R'], ['d100', '1.00x minus current, R'], ['dEq', '1.05x minus current at equal avg risk, R'], ['ddo', '1.05x minus current, open drop'], ['ddoEq', '1.05x minus current x0.913, open drop']]) {
  const v = qs.map((q) => q[k]); console.log(`  ${lab}: mean ${f(m(v), 1)} sd ${sd(v).toFixed(1)} t(3 months) ${(m(v) / sd(v)).toFixed(2)}; quarters > 0: ${v.filter((x) => x > 0).length}/${v.length}; quarters needed for t = 2: ${Math.ceil((2 * sd(v) / Math.abs(m(v))) ** 2)}`);
}
console.log('\n| Quarter | BB trades | R diff 1.05x - current | open-drop diff | R diff vs current x0.913 |'); console.log('|---|---|---|---|---|');
for (const q of qs) console.log(`| ${new Date(q.a * 1000).toISOString().slice(0, 7)} | ${q.n} | ${f(q.d105, 1)} | ${f(q.ddo, 1)} | ${f(q.dEq, 1)} |`);
console.log(`| Total (${qs.length} quarters) | ${qs.reduce((s, q) => s + q.n, 0)} | ${f(qs.reduce((s, q) => s + q.d105, 0), 1)} | whole period ${f(t105.mdd - live.mdd, 1)} | ${f(qs.reduce((s, q) => s + q.dEq, 0), 1)} |`);
