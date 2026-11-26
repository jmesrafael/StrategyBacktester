// baseline.js — the 27 strategies x exits from strat-hunt-nov6 (scaled to 1h: periods x4, ATR multiples x2), main basket, 2020-Nov 2026.
'use strict';
const L = require('./lib.js'), { S, makeCtx, exitOf } = require('../strat-hunt-nov6/strategies.js');
const ctxs = new Map();
const sc = (c) => { if (!ctxs.has(c.sym)) ctxs.set(c.sym, makeCtx(c.B, '1h')); return ctxs.get(c.sym); };
const rows = [];
for (const s of S.filter((x) => x.id !== 'bb-trail')) for (const p of s.exits) {
  const strat = (c) => { const st = sc(c).memo1 = sc(c).memo1 || {}; const key = s.id; if (!st[key]) st[key] = s.build(sc(c)); const b = st[key]; return p.startsWith('BB') ? b : { ...b, stopL: null, stopS: null }; };
  const r = L.evaluate(strat, (c) => exitOf(p, sc(c)));
  rows.push({ id: s.id + '|' + p, r });
  console.log((s.id + '|' + p).padEnd(22), L.fmt(r));
}
require('fs').writeFileSync('baseline.json', JSON.stringify(rows.map((x) => ({ id: x.id, ...x.r, perCoin: undefined }))));
