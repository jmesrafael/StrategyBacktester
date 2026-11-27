// run.js - Nov 27 2026: round 1 of PLAN.md.  node --max-old-space-size=8192 run.js [round file] -> results-<round>.json
'use strict';
const fs = require('fs');
const E = require('./engine');
const { T0, END, CUT, PHP, BASE, STARTS, trades, account, stats } = E;
const ROUND = process.argv[2] || 'round1';
const FAMILIES = require('./' + ROUND);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const pc = (v) => (100 * v).toFixed(1);

// a version = { id, label, weights, rebal, openPart, mult }
const norm = (v) => ({ weights: BASE, ...v });
const bots = (v, cost = 1, drop = null) => Object.entries(v.weights).filter(([, w]) => w > 0).map(([id, w]) => ({ id, weight: w, trades: drop ? trades(id, cost).filter((x) => !drop.has(x)) : trades(id, cost) }));
const opts = (v) => ({ openPart: v.openPart, rebal: v.rebal, mult: v.mult });
const judge = (v, k, from, to, cost = 1, drop = null) => stats(account(bots(v, cost, drop), { ...opts(v), k, from, to }));
const liveRun = (v, k, from = T0, to = END) => stats(account(bots(v), { ...opts(v), k, from, to, mexc: true, flat: false, start: 1000 / PHP }));

const TRI = norm({ id: 'tri', label: 'TRI-CORE today' });
const base = { is: judge(TRI, 1, T0, CUT), oos: judge(TRI, 1, CUT, END), oos2: judge(TRI, 1, CUT, END, 2), live: liveRun(TRI, 1), win: STARTS.map(([a, b]) => liveRun(TRI, 1, a, b)) };
if (Math.round(base.live.end * PHP / 1e4) !== 4303 || pc(base.live.dd) !== '46.6') throw new Error(`parity failed: ${base.live.end * PHP} ${pc(base.live.dd)}`);
log('parity ok. TRI 2020-23', pc(base.is.cagr), pc(base.is.dd), '| 2024-26', pc(base.oos.cagr), pc(base.oos.dd));

// rule 1: k that gives a 2020-23 worst fall 2 points under TRI's
function kFor(v) {
  const target = base.is.dd - 0.02; let lo = 0.1, hi = 3, k = lo;
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (judge(v, m, T0, CUT).dd <= target) { lo = m; k = m; } else hi = m; }
  return k;
}
const beats = (a, b) => a.cagr > b.cagr && a.dd < b.dd;

// rule 8: the same size cuts, dealt to random trades of the same bot
function luck(v, k, N = 200) {
  const used = new Map(), rec = { ...v, mult: (x, id, st) => { const m = v.mult(x, id, st); if (x.t >= CUT) used.set(x, [id, m]); return m; } };
  const real = judge(rec, k, CUT, END), score = (s) => Math.log(1 + s.cagr) / s.dd;
  const per = {}; for (const [x, [id, m]] of used) (per[id] || (per[id] = [])).push([x, m]);
  let seed = 987654; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let as = 0;
  for (let n = 0; n < N; n++) {
    const map = new Map();
    for (const list of Object.values(per)) { const ms = list.map((e) => e[1]); for (let i = ms.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ms[i], ms[j]] = [ms[j], ms[i]]; } list.forEach((e, i) => map.set(e[0], ms[i])); }
    if (score(judge({ ...v, mult: (x) => map.get(x) ?? 1 }, k, CUT, END)) >= score(real)) as++;
  }
  return as / N;
}

function fullCheck(v, k) {
  const r = {};
  r.oos2 = judge(v, k, CUT, END, 2); r.r6 = beats(r.oos2, base.oos2);
  r.live = liveRun(v, k); r.r4 = r.live.end > base.live.end && r.live.dd < base.live.dd;
  const w = STARTS.map(([a, b]) => liveRun(v, k, a, b));
  r.winRet = w.filter((x, i) => x.ret > base.win[i].ret).length / w.length; r.winDD = w.filter((x, i) => x.dd < base.win[i].dd).length / w.length; r.r5 = r.winRet > 0.5 && r.winDD > 0.5;
  // rule 9: without the 10 biggest winners among the three live bots' trades, removed from both
  const all = ['bb', 'ic', 'tc'].flatMap((id) => trades(id)).sort((a, b) => b.w * b.R - a.w * a.R), drop = new Set(all.slice(0, 10));
  r.top = judge(v, k, T0, END, 1, drop); r.topBase = judge(TRI, 1, T0, END, 1, drop); r.r9 = beats(r.top, r.topBase);
  return r;
}

const out = { round: ROUND, base: { is: base.is, oos: base.oos, oos2: base.oos2, live: base.live }, families: [] };
for (const f of FAMILIES) {
  const rows = f.versions.map((raw) => { const v = norm(raw), k = kFor(v), is = judge(v, k, T0, CUT), oos = judge(v, k, CUT, END); return { v, k, is, oos, r2: is.cagr > base.is.cagr && is.dd < base.is.dd, r3: beats(oos, base.oos) }; });
  const pick = rows.reduce((a, b) => (b.is.cagr > a.is.cagr ? b : a));
  const neigh = rows.filter((r) => r.r3).length / rows.length;
  const res = { id: f.id, name: f.name, tried: rows.length, pick: pick.v.label, k: pick.k, is: pick.is, oos: pick.oos, r2: pick.r2, r3: pick.r3, neigh, r7: neigh >= 0.5,
    rows: rows.map((r) => ({ label: r.v.label, k: r.k, is: r.is, oos: r.oos, r2: r.r2, r3: r.r3 })) };
  if (pick.r2 && pick.r3) {
    Object.assign(res, fullCheck(pick.v, pick.k));
    if (pick.v.mult && f.size) { res.luck = luck(pick.v, pick.k); res.r8 = res.luck <= 0.1; }
  }
  res.pass = ['r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r9'].every((x) => res[x] === true) && res.r8 !== false;
  out.families.push(res);
  const flags = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => (res['r' + n] === true ? 'y' : res['r' + n] === false ? '.' : '-')).join('');
  log(f.id, pick.v.label, `k ${pick.k.toFixed(2)} | 20-23 ${pc(pick.is.cagr)}/${pc(pick.is.dd)} | 24-26 ${pc(pick.oos.cagr)}/${pc(pick.oos.dd)} | neigh ${(100 * neigh).toFixed(0)}% | rules2-9 ${flags}`
    + (res.live ? ` | live ${Math.round(res.live.end * PHP)} ${pc(res.live.dd)} win ${pc(res.winRet)}/${pc(res.winDD)}${res.luck != null ? ' luck ' + res.luck : ''}` : '') + (res.pass ? '  PASS' : ''));
}
fs.writeFileSync(`${__dirname}/results-${ROUND}.json`, JSON.stringify(out));
log('written');
