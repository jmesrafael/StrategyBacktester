// round2.js - designed AFTER round 1 (crowded side was the only family near a pass). Same pass rules (PLAN.md).
'use strict';
const list = (...a) => a.reduce((acc, arr) => acc.flatMap((p) => arr.map((v) => [...p, v])), [[]]);
const fam = (id, name, versions) => ({ id, name, versions: versions.map((v) => ({ id, ...v })), size: true });
const count = (st, f) => st.W.reduce((n, w) => n + w.open.reduce((m, p) => m + (f(p, w.id) ? 1 : 0), 0), 0);
const M = [0, 0.25, 0.5, 0.75];
module.exports = [
  fam('B2', 'all bots, 9-14 open same side', list([9, 10, 11, 12, 13, 14], M).map(([n, m]) => ({ label: `${n}+ open same side: size x${m}`, mult: (x, id, st) => (count(st, (p) => p.x.dir === x.dir) >= n ? m : 1) }))),
  fam('B3', 'all bots, only trades from earlier candles counted', list([8, 9, 10, 11, 12], M).map(([n, m]) => ({ label: `${n}+ earlier open same side: size x${m}`, mult: (x, id, st) => (count(st, (p) => p.x.dir === x.dir && p.x.t < x.t) >= n ? m : 1) }))),
  fam('B4', 'each bot counts only its own trades', list([3, 4, 5, 6], M).map(([n, m]) => ({ label: `bot has ${n}+ open same side: size x${m}`, mult: (x, id, st) => (count(st, (p, oid) => oid === id && p.x.dir === x.dir) >= n ? m : 1) }))),
  fam('B5', 'open risk on one side', list([1.5, 2, 2.5, 3, 3.5], M).map(([u, m]) => ({ label: `same-side open risk >= ${u} trade units: size x${m}`,
    mult: (x, id, st) => { let r = 0; for (const w of st.W) for (const p of w.open) if (p.x.dir === x.dir) r += p.size * p.x.dist; return r >= u * 0.025 * st.K * st.equity ? m : 1; } }))),
  fam('B6', 'coins held on one side', list([4, 5, 6, 7], M).map(([n, m]) => ({ label: `${n}+ coins already open same side: size x${m}`,
    mult: (x, id, st) => { const s = new Set(); for (const w of st.W) for (const p of w.open) if (p.x.dir === x.dir) s.add(p.x.c); return s.size >= n ? m : 1; } }))),
];
