// seven.js: current TRI-CORE against the new one over the whole history, year by year and month by month.
//   node seven.js  -> TRICORE-7Y.md
'use strict';
const fs = require('fs'), path = require('path');
const S = require('./sim');
const CFG = require('../../intel/config.json').bots, DETAIL = require('../zec-replacement-2/detail.json');
const { IV, END } = S, ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, T0 = ts(2020), PHP = 58, START = 1000 / PHP, YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const list = Array.isArray(DETAIL) ? DETAIL : DETAIL.data || Object.values(DETAIL);
const SPECS = {};
for (const c of new Set([...CFG.bbcore.coins, ...CFG.icore.coins, ...CFG.tcore.coins])) { const d = list.find((s) => s.symbol === c + '_USDT'), x = S.real(c); SPECS[c] = { unit: d.contractSize * x.C[x.n - 1], minVol: d.minVol || 1, mmr: d.maintenanceMarginRate }; }
const bots = (bbKind, bbMult, trail) => [{ name: 'bb', kind: bbKind, coins: CFG.bbcore.coins, weight: 0.5, mult: bbMult }, { name: 'ic', kind: 'ic', coins: CFG.icore.coins, weight: 0.25, mult: 1 }, { name: 'tc', kind: 'tc', coins: CFG.tcore.coins, weight: 0.25, mult: 1, spec: { kTrail: trail } }];
const V = [['Current TRI-CORE', bots('bb', 1, 14)], ['New TRI-CORE', bots('bbT', 1.05, 12)]];
const months = []; for (let y = 2020; y <= 2026; y++) for (let m = 0; m < 12; m++) if (ts(y, m) < END) months.push([y, m]);

const R = V.map(([name, B]) => {
  const tr = B.flatMap((b) => b.coins.flatMap((c) => S.coinTrades(S.real(c), b.kind, { spec: b.spec, mult: b.mult }).map((t) => ({ ...t, w: t.w * b.weight })))).filter((t) => t.tExit > T0).sort((a, b) => a.tExit - b.tExit || a.t - b.t);
  const len = Math.floor((END - T0) / IV) + 1, d = new Float64Array(len);
  for (const t of tr) { const x = S.real(t.c); let prev = 0; for (let i = t.i0; i < x.n && x.T[i] + IV < t.tExit; i++) { const v = (t.w * (t.dir * (x.C[i] - t.entry) / t.entry - 0.001 - t.dir * (x.FS[i + 1] - x.FS[t.i0]))) / t.dist, k = (x.T[i] + IV - T0) / IV; if (k >= 0 && k < len) d[k] += v - prev; prev = v; } const k = (t.tExit - T0) / IV; if (k >= 0 && k < len) d[k] += t.w * t.R - prev; }
  for (let i = 1; i < len; i++) d[i] += d[i - 1];
  const stat = (a, b) => { const t = tr.filter((x) => x.tExit > a && x.tExit <= b); let e = 0, p = 0, dd = 0; for (const x of t) { e += x.w * x.R; p = Math.max(p, e); dd = Math.max(dd, p - e); }
    const i0 = Math.max(0, (a - T0) / IV), i1 = Math.min(len - 1, (b - T0) / IV), base = d[i0]; let mp = 0, mdd = 0; for (let i = i0; i <= i1; i++) { const v = d[i] - base; mp = Math.max(mp, v); mdd = Math.max(mdd, mp - v); }
    const mr = months.filter(([y, m]) => ts(y, m) >= a && ts(y, m) < b).map(([y, m]) => t.filter((x) => x.tExit > ts(y, m) && x.tExit <= ts(y, m + 1)).reduce((s, x) => s + x.w * x.R, 0));
    return { n: t.length, win: t.filter((x) => x.R > 0).length / t.length, R: e, dd, mdd, pos: mr.filter((v) => v > 0).length, months: mr.length }; };
  const acc = S.account(B, { start: START, from: T0, sets: S.real, specs: SPECS });
  const at = (t) => { let v = START; for (const [u, e] of acc.curve) { if (u <= t) v = e; else break; } return v; };
  const money = (a, b) => { const s = a === T0 ? START : at(a); let p = s, dd = 0; for (const [u, e] of acc.curve) if (u > a && u <= b) { p = Math.max(p, e); dd = Math.max(dd, 1 - e / p); }
    const mr = months.filter(([y, m]) => ts(y, m) >= a && ts(y, m) < b).map(([y, m]) => at(Math.min(ts(y, m + 1), END)) / (y === 2020 && m === 0 ? START : at(ts(y, m))) - 1);
    return { ret: at(Math.min(b, END)) / s - 1, end: at(Math.min(b, END)), dd, pos: mr.filter((v) => v > 1e-12).length, neg: mr.filter((v) => v < -1e-12).length, months: mr.length, worst: Math.min(...mr), avg: mr.reduce((x, y) => x + y, 0) / mr.length, med: [...mr].sort((x, y) => x - y)[mr.length >> 1] }; };
  return { name, all: stat(T0, END), money: money(T0, END), y: YEARS.map((q) => ({ r: stat(ts(q), Math.min(ts(q + 1), END)), m: money(ts(q), Math.min(ts(q + 1), END)) })) };
});
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d), pc = (v, d = 0) => (100 * v).toFixed(d) + '%', int = (v) => Math.round(v).toLocaleString('en-US');
const md = ['# Current TRI-CORE against New TRI-CORE (Jan 2020 to Nov 24 2026)', '', 'New = BB tweak 1.05x + I-CORE + T-CORE trail 12. R is weighted 50 / 25 / 25. Money columns: one ₱1,000 account, 2.5% risk with the live risk steps and MEXC minimums, never withdrawn.', '',
  '| Measure | Current | New |', '|---|---|---|'];
const [a, b] = R, row = (n, fn) => md.push(`| ${n} | ${fn(a)} | ${fn(b)} |`);
row('Trades', (r) => int(r.all.n)); row('Win rate', (r) => pc(r.all.win, 1)); row('Total R', (r) => f(r.all.R)); row('Worst drop, closed trades (R)', (r) => r.all.dd.toFixed(1)); row('Worst drop, with open trades (R)', (r) => r.all.mdd.toFixed(1));
row('Positive months (closed trades)', (r) => `${r.all.pos} of ${r.all.months}`); row('Simple return at 1% risk, no compounding', (r) => f(r.all.R) + '%'); row('Simple return at 2.5% risk, no compounding', (r) => f(r.all.R * 2.5) + '%');
row('Account: end value (PHP)', (r) => int(r.money.end * PHP)); row('Account: total return', (r) => f(r.money.ret * 100) .replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '%'); row('Account: deepest fall', (r) => pc(r.money.dd, 1));
row('Account: positive months', (r) => `${r.money.pos} of ${r.money.months}`); row('Account: median month', (r) => f(r.money.med * 100, 1) + '%'); row('Account: worst month', (r) => f(r.money.worst * 100, 1) + '%');
md.push('', '## Year by year', '', '| Year | Win rate cur / new | R cur / new | Drop closed (R) cur / new | Drop open (R) cur / new | Account return cur / new | Account deepest fall cur / new | Positive months (R) cur / new | Positive months (account) cur / new |', '|' + '---|'.repeat(9));
YEARS.forEach((y, i) => { const p = a.y[i], q = b.y[i]; md.push(`| ${y} | ${pc(p.r.win)} / ${pc(q.r.win)} | ${f(p.r.R)} / ${f(q.r.R)} | ${p.r.dd.toFixed(1)} / ${q.r.dd.toFixed(1)} | ${p.r.mdd.toFixed(0)} / ${q.r.mdd.toFixed(0)} | ${f(p.m.ret * 100)}% / ${f(q.m.ret * 100)}% | ${pc(p.m.dd)} / ${pc(q.m.dd)} | ${p.r.pos} / ${q.r.pos} of ${p.r.months} | ${p.m.pos} / ${q.m.pos} of ${p.m.months} |`); });
fs.writeFileSync(path.join(__dirname, 'TRICORE-7Y.md'), md.join('\n') + '\n'); console.log(md.join('\n'));
