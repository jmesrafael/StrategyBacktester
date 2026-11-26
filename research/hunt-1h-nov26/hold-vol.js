// hold-vol.js — Bollinger 1h family (fam-vol.js build) on the HOLD basket (12 coins never used to pick). Unfiltered grid.
'use strict';
const L = require('./lib.js'), { strat, mkEx } = require('./fam-vol.js');
const rows = [];
for (const len of [60, 80, 100, 120]) for (const mult of [2.2, 2.4, 2.6]) for (const trend of [400, 800, 1600])
  for (const e of [{ kind: 'T', k: 16 }, { kind: 'T', k: 20 }, { kind: 'T', k: 28 }, { kind: 'M', bars: 192 }]) {
    const p = { len, mult, trend, minStop: 0.3, filt: null };
    const h = L.evaluate(strat(p, e), mkEx(e), L.HOLD, 1), h2 = L.evaluate(strat(p, e), mkEx(e), L.HOLD, 2);
    const m = L.evaluate(strat(p, e), mkEx(e), L.MAIN, 1);
    const tag = `len${len} x${mult} tr${trend} ${e.kind === 'T' ? 'trail' + e.k : 'time' + e.bars}`;
    rows.push({ tag, h, h2, m });
    console.log(tag.padEnd(28), `MAIN ${m.posYears}/7 r/dd=${m.rdd.toFixed(1)} | HOLD1x ${h.posYears}/7 2x ${h2.posYears}/7 coins+=${h.coinsPos} r/dd=${h.rdd.toFixed(1)} ::`, L.fmt(h));
  }
const both = rows.filter((r) => r.m.posYears === 7 && r.h.posYears === 7);
console.log(`\nMAIN 7/7 AND HOLD 7/7: ${both.length} of ${rows.length}; also HOLD 2x 7/7: ${both.filter((r) => r.h2.posYears === 7).length}`);
