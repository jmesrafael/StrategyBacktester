// strict-baseline.js — every baseline variant that was 7/7 on MAIN: re-run at 2x costs and on the HOLD basket (never used to pick).
'use strict';
const L = require('./lib.js'), { S, makeCtx, exitOf } = require('../strat-hunt-nov6/strategies.js');
const base = JSON.parse(require('fs').readFileSync('baseline.json'));
const ctxs = new Map(), built = new Map();
const sc = (c) => { if (!ctxs.has(c.sym)) ctxs.set(c.sym, makeCtx(c.B, '1h')); return ctxs.get(c.sym); };
for (const row of base.filter((r) => r.posYears === 7)) {
  const [id, p] = row.id.split('|'), s = S.find((x) => x.id === id);
  const strat = (c) => { const k = id + c.sym; if (!built.has(k)) built.set(k, s.build(sc(c))); const b = built.get(k); return p.startsWith('BB') ? b : { ...b, stopL: null, stopS: null }; };
  const ex = (c) => exitOf(p, sc(c));
  const m2 = L.evaluate(strat, ex, L.MAIN, 2), h1 = L.evaluate(strat, ex, L.HOLD, 1), h2 = L.evaluate(strat, ex, L.HOLD, 2);
  console.log(row.id.padEnd(18), `main1x r/dd=${row.rdd.toFixed(1)} | main2x ${m2.posYears}/7 worst=${m2.worst.toFixed(0)} r/dd=${m2.rdd.toFixed(1)} | hold1x ${h1.posYears}/7 worst=${h1.worst.toFixed(0)} r/dd=${h1.rdd.toFixed(1)} coins+=${h1.coinsPos}/12 | hold2x ${h2.posYears}/7 worst=${h2.worst.toFixed(0)}`);
  built.clear();
}
