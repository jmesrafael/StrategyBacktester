// round3.js - designed AFTER round 2: the same crowding idea without a hard threshold. Same pass rules (PLAN.md).
'use strict';
const list = (...a) => a.reduce((acc, arr) => acc.flatMap((p) => arr.map((v) => [...p, v])), [[]]);
const fam = (id, name, versions) => ({ id, name, versions: versions.map((v) => ({ id, ...v })), size: true });
// open trades on the same side: all = across the 3 bots, else only the entering bot's own
const n = (st, x, id, all) => st.W.reduce((q, w) => q + (all || w.id === id ? w.open.reduce((m, p) => m + (p.x.dir === x.dir ? 1 : 0), 0) : 0), 0);
module.exports = [
  fam('C1', 'smooth, all bots: size 1/(1+c*n)', [0.05, 0.1, 0.15, 0.2, 0.3, 0.45].map((c) => ({ label: `all bots, size 1/(1+${c}n)`, mult: (x, id, st) => 1 / (1 + c * n(st, x, id, true)) }))),
  fam('C2', 'smooth, own bot: size 1/(1+c*n)', [0.1, 0.2, 0.3, 0.45, 0.6, 0.9].map((c) => ({ label: `own bot, size 1/(1+${c}n)`, mult: (x, id, st) => 1 / (1 + c * n(st, x, id, false)) }))),
  fam('C3', 'ramp, own bot', list([1, 2, 3], [3, 5], [0.25, 0.5]).map(([a, len, f]) => ({ label: `own bot, full to ${a} open, down to x${f} over ${len}`,
    mult: (x, id, st) => Math.max(f, 1 - (1 - f) * Math.max(0, n(st, x, id, false) - a) / len) }))),
  fam('C4', 'ramp, all bots', list([4, 6, 8], [4, 8], [0.25, 0.5]).map(([a, len, f]) => ({ label: `all bots, full to ${a} open, down to x${f} over ${len}`,
    mult: (x, id, st) => Math.max(f, 1 - (1 - f) * Math.max(0, n(st, x, id, true) - a) / len) }))),
];
