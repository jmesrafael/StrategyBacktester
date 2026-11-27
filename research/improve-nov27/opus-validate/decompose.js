// decompose.js - why my engine and improve-nov27/engine.js give different PHP figures for TRI-CORE: feed THEIR account my trades.
'use strict';
const E = require('../engine'), X = require('./causal');
const p = (v) => (100 * v).toFixed(1);
const live = (bots, o = {}) => E.stats(E.account(bots, { mexc: true, flat: false, start: 1000 / 60, ...o }));
const theirs = ['bb', 'ic', 'tc'].map((id) => ({ id, weight: E.BASE[id], trades: E.trades(id) }));
const a = live(theirs); console.log('their engine, their trades      PHP', Math.round(a.end * 60).toLocaleString(), 'fall', p(a.dd));
// my research-convention trades (flat, all taken) converted to their format
const r = X.run({ mode: 'flat', start: 1000, hourStops: false, exitAtClose: true });
const conv = (id, useMyR) => r.trades.filter((t) => t.bot === id).map((t) => ({ c: t.coin, dir: t.dir, t: t.t, R: useMyR ? t.Rb : null, w: t.w * (id === 'bb' ? 1.05 : 1), dist: t.dist, entry: t.entry, why: t.why, iv: 14400, tEff: id === 'bb' && t.why === 'time' ? t.tExit : t.why === 'stop' ? Math.ceil(t.tExit / 14400) * 14400 : t.tExit, _k: `${t.coin}|${t.t}` })).sort((x, y) => x.t - y.t || x.c.localeCompare(y.c));
// same trades but their R (to isolate R accounting)
for (const id of ['bb', 'ic', 'tc']) { const m = new Map(E.trades(id).map((x) => [`${x.c}|${x.t}`, x])); }
const mine = ['bb', 'ic', 'tc'].map((id) => ({ id, weight: E.BASE[id], trades: conv(id, true) }));
const b = live(mine); console.log('their engine, my trades + my R  PHP', Math.round(b.end * 60).toLocaleString(), 'fall', p(b.dd));
const withTheirR = ['bb', 'ic', 'tc'].map((id) => { const m = new Map(E.trades(id).map((x) => [`${x.c}|${x.t}`, x])); return { id, weight: E.BASE[id], trades: conv(id, true).map((x) => ({ ...x, R: m.get(x._k) ? m.get(x._k).R : x.R })) }; });
const c = live(withTheirR); console.log('their engine, my trades + their R PHP', Math.round(c.end * 60).toLocaleString(), 'fall', p(c.dd));
const extra = ['bb', 'ic', 'tc'].map((id) => E.trades(id).filter((x) => !conv(id, true).some((y) => y._k === `${x.c}|${x.t}`)).length);
console.log('their trades not in my list per bot', extra, '(trades entered before 2020 or still open at the end are dropped by one side)');
// start-balance sensitivity of their engine (path dependence at PHP 1,000)
for (const s of [950, 1000, 1050, 1100]) { const z = live(theirs, { start: s / 60 }); const q = live(theirs, { start: s / 60, k: 1.11, mult: (x, id, st) => { const n = st.W.find((w) => w.id === id).open.reduce((m, pp) => m + (pp.x.dir === x.dir ? 1 : 0), 0); return Math.max(0.25, 1 - 0.75 * Math.max(0, n - 2) / 3); } });
  console.log(`their engine start PHP ${s}: TRI ${Math.round(z.end * 60).toLocaleString()} / ${p(z.dd)}   rule x1.11 ${Math.round(q.end * 60).toLocaleString()} / ${p(q.dd)}`); }
