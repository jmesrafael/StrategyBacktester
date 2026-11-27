// diag.js - what is behind family B (crowded side cut)? Exploratory, written after round 1.  node diag.js
'use strict';
const E = require('./engine');
const { H, T0, END, CUT, PHP, BASE, trades, account, stats } = E;
const bots = () => Object.entries(BASE).map(([id, weight]) => ({ id, weight, trades: trades(id) }));
const p = (v) => (100 * v).toFixed(1);
// count of open same-side trades at entry. prior = ignore trades entered in the same hour (order-free)
const count = (st, x, prior) => st.W.reduce((n, w) => n + w.open.reduce((m, o) => m + (o.x.dir === x.dir && (!prior || o.x.t < x.t) ? 1 : 0), 0), 0);

// 1. trade quality by crowding at entry (counts do not depend on size)
const at = new Map();
account(bots(), { mult: (x, id, st) => { at.set(x, { id, n: count(st, x, false), np: count(st, x, true) }); return 1; } });
const all = [...at.entries()];
console.log('R per trade by number already open the same way (weighted by the live size rule)');
for (const [lbl, f] of [['0-3', (n) => n <= 3], ['4-6', (n) => n >= 4 && n <= 6], ['7-9', (n) => n >= 7 && n <= 9], ['10-12', (n) => n >= 10 && n <= 12], ['13+', (n) => n >= 13]]) {
  const part = (a, b, id) => { const s = all.filter(([x, v]) => f(v.n) && x.t >= a && x.t < b && (!id || v.id === id)).map(([x]) => x.w * x.R); return `${s.length} tr ${(s.reduce((q, v) => q + v, 0) / (s.length || 1)).toFixed(2)}R`; };
  console.log(lbl.padEnd(6), '2020-23', part(T0, CUT), '| 2024-26', part(CUT, END), '| bb', part(T0, END, 'bb'), 'ic', part(T0, END, 'ic'), 'tc', part(T0, END, 'tc'));
}
console.log('10+ trades per year: ' + [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => { const s = all.filter(([x, v]) => v.n >= 10 && new Date(x.t * 1000).getUTCFullYear() === y).map(([x]) => x.w * x.R); return `${y}: ${s.length} / ${s.reduce((q, v) => q + v, 0).toFixed(0)}R`; }).join(', '));

// 2. same rule at several risk multipliers (exploratory: the pass rules fix k from 2020-23)
const rule = (N, m, prior) => (x, id, st) => (count(st, x, prior) >= N ? m : 1);
const show = (name, o) => { const f = stats(account(bots(), o)), l = stats(account(bots(), { ...o, mexc: true, flat: false, start: 1000 / PHP }));
  const a = stats(account(bots(), { ...o, to: CUT })), b = stats(account(bots(), { ...o, from: CUT }));
  console.log(name.padEnd(34), `flat 20-23 ${p(a.cagr)}/${p(a.dd)} 24-26 ${p(b.cagr)}/${p(b.dd)} all ${p(f.cagr)}/${p(f.dd)} | live PHP ${Math.round(l.end * PHP / 1e5) / 10}M fall ${p(l.dd)}`); };
show('TRI today', {});
for (const k of [1, 1.1, 1.2, 1.3, 1.43]) show(`10+ x0.25, k ${k}`, { k, mult: rule(10, 0.25) });
for (const k of [1, 1.2, 1.43]) show(`10+ x0.25 order-free, k ${k}`, { k, mult: rule(10, 0.25, true) });
