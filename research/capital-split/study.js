// study.js — Nov 19, 2026: how should the three live bots size their trades?
//   OWN     today: each bot risks 2.5% of ITS OWN sub-account (the split drifts as the bots win and lose)
//   REB-n   same, but the three sub-accounts are moved back to 50/25/25 every n months (free cash only)
//   SHARED  each bot reads ALL THREE sub-accounts as one total and risks 2.5% x total x its weight (50/25/25).
//           The accounts stay separate (same coin can be open on two bots); only the sizing number is shared.
//           SHARED-CAP: no transfers ever; a trade that does not fit the bot's own free cash is made smaller.
//           SHARED-TOP: when a trade does not fit, the missing margin is moved in from the account with the most free cash.
// Margin model = the live bots' sizing: isolated, leverage = floor(1 / (2 x stop%)) capped at 20x (liquidation ~2x the stop),
// margin = notional / leverage. Every method uses the same margin check, so a small account can never open more than it holds.
// Fee: 20% of new profit above the best level, every 2 months (end of Feb, Apr, Jun, Aug, Oct, Dec), on realized money.
// Trades: rules v3, each bot on its live coins (same loader as ../settlement-frequency/freq.js), Binance 4h, Jan 2020 -> Nov 12 2026.
//   node study.js   -> study.json (read by build-report.js)
'use strict';
const path = require('path'), fs = require('fs');
const { load, START, END } = require(path.join(__dirname, '..', 'tweak-lab-nov13', 'lab.js'));
const ROOT = path.join(__dirname, '..', '..', '..');
const BOTS = [
  { name: 'BB-CORE', w: 0.5, core: require(path.join(ROOT, '🔴BB-Core', 'lucidio-core.js')), coins: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'], run: (c, B) => c.backtest(B, {}, null).trades },
  { name: 'I-CORE', w: 0.25, core: require(path.join(ROOT, '🔴I-Core', 'icore-core.js')), coins: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH'], run: (c, B) => c.backtest(B, {}).trades },
  { name: 'T-CORE', w: 0.25, core: require(path.join(ROOT, '🔴StrategyBacktester', 'bb-trail', 'icore-core.js')), coins: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'], run: (c, B) => c.backtest(B, {}).trades },
];
const W = BOTS.map((b) => b.w), RISK = 0.025, FEE = 0.2, SPLIT = Date.UTC(2023, 0, 1) / 1000, MAXLEV = 20;
const TR = BOTS.flatMap((b, k) => b.coins.flatMap((c) => b.run(b.core, load(c).B).map((t) => {
  const stop = t.stop0 ?? t.stop, sp = Math.abs(t.entry - stop) / t.entry;
  return { k, coin: c, t0: t.t, t1: t.tExit, R: t.R, sp };
}))).filter((t) => t.t0 >= START && t.t1 <= END && t.sp > 0).sort((a, b) => a.t0 - b.t0);
const marginPerRisk = (sp) => { const lev = Math.max(1, Math.min(MAXLEV, Math.floor(1 / (2 * sp)))); return 1 / sp / lev; };

const mEnd = (y, m) => Date.UTC(y, m + 1, 1) / 1000 - 1;                      // last second of month m
const ym = (t) => { const d = new Date(t * 1000); return [d.getUTCFullYear(), d.getUTCMonth()]; };

const METHODS = {
  own: { label: 'Own account (today)', sizing: 'own', reb: 0 },
  reb2: { label: 'Rebalance every 2 months', sizing: 'own', reb: 2 },
  reb3: { label: 'Rebalance every 3 months', sizing: 'own', reb: 3 },
  sharedCap: { label: 'Shared sizing, no transfers', sizing: 'shared', fit: 'cap' },
  sharedTop: { label: 'Shared sizing + top-ups', sizing: 'shared', fit: 'top' },
  sharedReb3: { label: 'Shared sizing + rebalance every 3 months', sizing: 'shared', fit: 'cap', reb: 3 },
};

// one run. trades: list (already filtered to the window); from/end: window; returns curve + stats
function sim(trades, M, from, end, opt = {}) {
  const ev = [];
  for (const t of trades) { ev.push([t.t0, 2, t]); ev.push([t.t1, 0, t]); }
  const [y0, m0] = ym(from);
  for (let y = y0, m = m0; mEnd(y, m) <= end; m++) { if (m === 12) { m = 0; y++; } if (mEnd(y, m) > end) break;
    ev.push([mEnd(y, m), 1, { y, m }]); }
  ev.push([end, 1, { last: true }]);
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const acct = W.map((w) => w * 1000), open = new Map(), locked = [0, 0, 0];
  let hwm = 1000, peak = 1000, dd = 0, ddAt = from, fees = 0, transfers = 0, moved = 0, shrunk = 0, skipped = 0, nOpen = 0, topups = 0, topMoved = 0, mo = 0;
  const monthly = [], shares = [];
  const total = () => acct[0] + acct[1] + acct[2];
  const mark = (t) => { const v = total(); if (v > peak) peak = v; const d = 1 - v / peak; if (d > dd) { dd = d; ddAt = t; } };
  for (const [t, typ, x] of ev) {
    if (typ === 2) {
      const base = M.sizing === 'shared' ? W[x.k] * total() : acct[x.k];
      let risk = RISK * Math.max(0, base); const mpr = marginPerRisk(x.sp); let need = risk * mpr, free = acct[x.k] - locked[x.k];
      if (need > free && M.fit === 'top') {
        const donors = [0, 1, 2].filter((j) => j !== x.k).sort((a, b) => (acct[b] - locked[b]) - (acct[a] - locked[a]));
        let gap = need - free;
        for (const j of donors) { const can = Math.max(0, acct[j] - locked[j]); const g = Math.min(can, gap); if (g > 0) { acct[j] -= g; acct[x.k] += g; gap -= g; topMoved += g; } }
        topups++; free = acct[x.k] - locked[x.k];
      }
      if (need > free) { if (free <= 0) { skipped++; continue; } risk *= free / need; need = free; shrunk++; }
      open.set(x, { risk, need }); locked[x.k] += need; nOpen++; continue;
    }
    if (typ === 0) { const o = open.get(x); if (!o) continue; open.delete(x); locked[x.k] -= o.need; acct[x.k] += x.R * o.risk; mark(t); continue; }
    // month end: fee on even months (and the last partial day), then rebalance, then record
    const v = total();
    if (x.last || x.m % 2 === 1) { if (v > hwm) { const f = FEE * (v - hwm), s = (v - f) / v; for (let j = 0; j < 3; j++) acct[j] *= s; hwm = v - f; fees += f; mark(t); } }
    if (!x.last) {
      mo++;
      if (M.reb && mo % M.reb === 0) {
        const T = total(), d = acct.map((a, j) => W[j] * T - a), give = d.map((q, j) => (q < 0 ? Math.min(-q, Math.max(0, acct[j] - locked[j])) : 0)),
          G = give.reduce((s, q) => s + q, 0), N = d.reduce((s, q) => s + Math.max(0, q), 0), m = Math.min(G, N);
        if (m > 1e-9) { for (let j = 0; j < 3; j++) { if (d[j] < 0) acct[j] -= give[j] * m / G; else acct[j] += d[j] * m / N; } transfers++; moved += m / T; }
      }
      monthly.push([x.y, x.m, total()]); shares.push(acct.map((a) => a / total()));
    }
  }
  return { final: total(), dd, ddAt, fees, transfers, avgMoved: transfers ? moved / transfers : 0, shrunk, skipped, nOpen, topups, topMoved, monthly, shares };
}
const W_ = (from, end) => TR.filter((t) => t.t0 >= from && t.t1 <= end);
const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; };
const out = { generated: '2026-11-19', trades: TR.length, perBot: BOTS.map((b, k) => ({ name: b.name, w: b.w, n: TR.filter((t) => t.k === k).length, R: +TR.filter((t) => t.k === k).reduce((s, t) => s + t.R, 0).toFixed(1) })), methods: {}, start: START, end: END };
for (const [id, M] of Object.entries(METHODS)) out.methods[id] = { label: M.label };

// 1. full history
for (const [id, M] of Object.entries(METHODS)) {
  const r = sim(W_(START, END), M, START, END);
  const ms = r.monthly.map((x, i) => [x[0], x[1], x[2] / (i ? r.monthly[i - 1][2] : 1000) - 1]);
  const years = {}; let prev = 1000; for (const [y, m, v] of r.monthly) { if (m === 11 || (y === 2026 && m === r.monthly[r.monthly.length - 1][1])) { years[y] = v / prev - 1; prev = v; } }
  Object.assign(out.methods[id], { full: { final: r.final, dd: r.dd, ddAt: r.ddAt, fees: r.fees, transfers: r.transfers, avgMoved: r.avgMoved, shrunk: r.shrunk, skipped: r.skipped, nOpen: r.nOpen, topups: r.topups, topMoved: r.topMoved,
    red: ms.filter((x) => x[2] < 0).length, months: ms.length, worstMonth: Math.min(...ms.map((x) => x[2])), years, monthly: r.monthly.map((x) => +x[2].toFixed(2)), shares: r.shares.map((s) => s.map((v) => +v.toFixed(3))) } });
}
out.monthLabels = (() => { const r = sim([], METHODS.own, START, END); return r.monthly.map((x) => `${x[0]}-${String(x[1] + 1).padStart(2, '0')}`); })();
// 2. halves
for (const [id, M] of Object.entries(METHODS)) {
  const a = sim(W_(START, SPLIT), M, START, SPLIT), b = sim(W_(SPLIT, END), M, SPLIT, END);
  out.methods[id].halves = { h1: { final: a.final, dd: a.dd }, h2: { final: b.final, dd: b.dd } };
}
// 3. every start month, 12 and 24 months
const MS = []; for (let y = 2020, m = 0; ; m++) { if (m === 12) { m = 0; y++; } const t = Date.UTC(y, m, 1) / 1000; if (t > END) break; MS.push(t); }
for (const h of [12, 24]) {
  const runs = {}; for (const id of Object.keys(METHODS)) runs[id] = [];
  for (let s = 0; s + h < MS.length; s++) { const from = MS[s], end = MS[s + h] - 1, T = W_(from, end); for (const [id, M] of Object.entries(METHODS)) runs[id].push(sim(T, M, from, end)); }
  for (const id of Object.keys(METHODS)) {
    const rel = runs[id].map((r, i) => r.final / runs.own[i].final - 1);
    out.methods[id]['roll' + h] = { n: rel.length, beats: rel.filter((x) => x > 0.0001).length / rel.length, med: q(rel, 0.5), p10: q(rel, 0.1), p90: q(rel, 0.9),
      retMed: q(runs[id].map((r) => r.final / 1000 - 1), 0.5), retP10: q(runs[id].map((r) => r.final / 1000 - 1), 0.1), ddMed: q(runs[id].map((r) => r.dd), 0.5), ddP90: q(runs[id].map((r) => r.dd), 0.9),
      lose: runs[id].filter((r) => r.final < 1000).length / rel.length };
  }
}
// 4. 1,000 reshuffled 7-year histories: 6-month blocks of trades (all bots together), drawn with replacement
let seed = 20261119; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const BL = []; for (let y = 2020; y <= 2026; y++) for (const m of [0, 6]) { const a = Date.UTC(y, m, 1) / 1000, b = Date.UTC(y, m + 6, 1) / 1000; if (b <= END) BL.push([a, b, TR.filter((t) => t.t0 >= a && t.t0 < b)]); }
const NB = 14, boot = {}; for (const id of Object.keys(METHODS)) boot[id] = [];
for (let it = 0; it < 1000; it++) {
  const T = []; let off = START;
  for (let i = 0; i < NB; i++) { const [a, b, L] = BL[Math.floor(rnd() * BL.length)]; for (const t of L) T.push({ ...t, t0: t.t0 - a + off, t1: t.t1 - a + off }); off += b - a; }
  T.sort((x, y) => x.t0 - y.t0); const end = Math.max(off, ...T.map((t) => t.t1));
  for (const [id, M] of Object.entries(METHODS)) boot[id].push(sim(T, M, START, end));
}
for (const id of Object.keys(METHODS)) {
  const rel = boot[id].map((r, i) => r.final / boot.own[i].final - 1), dds = boot[id].map((r) => r.dd);
  out.methods[id].boot = { beats: rel.filter((x) => x > 0.0001).length / rel.length, med: q(rel, 0.5), p10: q(rel, 0.1), p90: q(rel, 0.9), ddMed: q(dds, 0.5), ddP90: q(dds, 0.9), dd60: dds.filter((d) => d >= 0.6).length / dds.length,
    hist: (() => { const b = new Array(16).fill(0); for (const x of rel) { const i = Math.max(0, Math.min(15, Math.floor((x + 0.8) / 0.1))); b[i]++; } return b; })() };
}
// 5. correlation of the bots' monthly R
const months = out.monthLabels.length, mr = BOTS.map(() => new Array(months).fill(0));
for (const t of TR) { const [y, m] = ym(t.t1), i = (y - 2020) * 12 + m; if (i >= 0 && i < months) mr[t.k][i] += t.R; }
const corr = (a, b) => { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return c / Math.sqrt(va * vb); };
out.bots = BOTS.map((b, k) => ({ name: b.name, avgR: mr[k].reduce((s, v) => s + v, 0) / months, sd: Math.sqrt(mr[k].reduce((s, v) => s + v * v, 0) / months - (mr[k].reduce((s, v) => s + v, 0) / months) ** 2), lossMonths: mr[k].filter((v) => v < 0).length, corr: BOTS.map((_, j) => corr(mr[k], mr[j])), yearR: Object.fromEntries([2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => [y, +mr[k].slice((y - 2020) * 12, (y - 2019) * 12).reduce((s, v) => s + v, 0).toFixed(1)])) }));
fs.writeFileSync(path.join(__dirname, 'study.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toFixed(5) : v)));
const pc = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
console.log('trades', TR.length, out.perBot);
for (const [id, m] of Object.entries(out.methods)) { const f = m.full, o = out.methods.own.full;
  console.log(id.padEnd(10), Math.round(f.final).toLocaleString().padStart(12), pc(f.final / o.final - 1).padStart(8), 'dd', pc(-f.dd), 'red', f.red + '/' + f.months, 'worstM', pc(f.worstMonth), 'shrunk', f.shrunk, 'skip', f.skipped, 'topups', f.topups, 'transfers', f.transfers,
    '| h1', pc(m.halves.h1.final / out.methods.own.halves.h1.final - 1), 'h2', pc(m.halves.h2.final / out.methods.own.halves.h2.final - 1),
    '| r12 beats', pc(m.roll12.beats), 'med', pc(m.roll12.med), '| r24', pc(m.roll24.beats), pc(m.roll24.med), '| boot', pc(m.boot.beats), pc(m.boot.med), 'p10', pc(m.boot.p10), 'dd60', pc(m.boot.dd60), 'ddMed', pc(-m.boot.ddMed)); }
console.log(out.bots.map((b) => [b.name, b.avgR.toFixed(1), b.sd.toFixed(1), b.corr.map((c) => c.toFixed(2)).join(' '), JSON.stringify(b.yearR)].join(' | ')).join('\n'));
