// control.js - Is the gain from WHICH trades are cut, or only from risking less? (same average size, spread evenly)
'use strict';
const fs = require('fs');
const E = require('./engine');
const C = require('../../candles/candles.js');
const { T0, END, CUT, OWN, BASE, trades, tradesOn, account, stats } = E;
const RES = require('./results-round3.json').families.find((f) => f.id === 'C3');
const rule = require('./round3').find((f) => f.id === 'C3').versions.find((v) => v.label === RES.pick).mult, K = RES.k;
const p = (v) => (100 * v).toFixed(1), ts = (y) => Date.UTC(y, 0, 1) / 1000, score = (s) => Math.log(Math.max(1e-9, 1 + s.cagr)) / s.dd;

// one basket: the rule at x1, and TRI-CORE with every trade at the rule's average size
function both(bs, from, to, byN) {
  let sum = 0, n = 0;
  const a = stats(account(bs, { from, to, mult: (x, id, st) => { const m = rule(x, id, st); sum += m; n++;
    if (byN) { const q = st.W.find((w) => w.id === id).open.filter((o) => o.x.dir === x.dir).length; const b = q <= 2 ? 0 : q === 3 ? 1 : q === 4 ? 2 : 3; byN[b].n++; byN[b].R += x.w * x.R; } return m; } }));
  const avg = sum / n, flat = stats(account(bs, { from, to, k: avg }));
  return { rule: a, flat, avg };
}
const live = () => Object.entries(BASE).map(([id, weight]) => ({ id, weight, trades: trades(id) }));
const out = {};
const table = (byN) => byN.map((b, i) => ({ open: ['0-2', '3', '4', '5+'][i], trades: b.n, avgR: b.R / (b.n || 1) }));
const fresh = () => [0, 1, 2, 3].map(() => ({ n: 0, R: 0 }));

console.log('LIVE coins: rule x1.00 against TRI at the same average size');
for (const [lbl, from, to] of [['all', T0, END], ['2020-23', T0, CUT], ['2024-26', CUT, END]]) {
  const byN = fresh(), r = both(live(), from, to, byN); out['live ' + lbl] = { ...r, byN: table(byN) };
  console.log(` ${lbl}: average size ${r.avg.toFixed(2)} | rule ${p(r.rule.cagr)}/${p(r.rule.dd)} | even cut ${p(r.flat.cagr)}/${p(r.flat.dd)}`);
  console.log('   R per trade by own-bot open same side: ' + table(byN).map((b) => `${b.open}: ${b.avgR.toFixed(2)}R (${b.trades})`).join('  '));
}

const used = new Set(Object.values(OWN).flat());
const pool = C.coins().filter((c) => !used.has(c)).filter((c) => { try { const r = C.load(c, '4h'); C.funding(c); return r[0][0] < ts(2022) && r[r.length - 1][0] > Date.UTC(2026, 9, 1) / 1000; } catch { return false; } });
let seed = 777; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const sets = [];
for (let n = 0; n < 200; n++) {
  const d = [...pool]; for (let i = 0; i < 8; i++) { const j = i + Math.floor(rnd() * (d.length - i)); [d[i], d[j]] = [d[j], d[i]]; }
  const [q1, q2, q3, q4, q5, q6, q7, q8] = d; sets.push({ bb: [q1, q2, q3, q4, q5, q6], ic: [q1, q2, q3, q4, q5, q7], tc: [q1, q2, q3, q4, q5, q7, q8, q6] });
}
console.log('\nOTHER coins (200 sets): rule x1.00 against TRI at the same average size');
for (const [lbl, from, to] of [['all', T0, END], ['2020-23', T0, CUT], ['2024-26', CUT, END]]) {
  const byN = fresh(), rows = sets.map((set) => both(Object.entries(BASE).map(([id, weight]) => ({ id, weight, trades: tradesOn(id, set[id]) })), from, to, byN));
  const share = (fn) => rows.filter(fn).length / rows.length, o = { growth: share((r) => r.rule.cagr > r.flat.cagr), fall: share((r) => r.rule.dd < r.flat.dd), perFall: share((r) => score(r.rule) > score(r.flat)), byN: table(byN) };
  out['other ' + lbl] = o;
  console.log(` ${lbl}: rule beats the even cut on growth ${p(o.growth)}%, on fall ${p(o.fall)}%, on growth per fall ${p(o.perFall)}%`);
  console.log('   R per trade by own-bot open same side: ' + o.byN.map((b) => `${b.open}: ${b.avgR.toFixed(2)}R (${b.trades})`).join('  '));
}
fs.writeFileSync(__dirname + '/control.json', JSON.stringify(out));
