// d-sizing.js: can the live order sizing (bb-core/live.js sizeOrder: round to nearest contract, at least minVol,
// never above maxRiskMult 1.5 x target, else skip) deliver half risk and x1.05? Uses the BB New trades 2025-01-01 .. Nov 24 2026
// at their real entry price and stop distance, MEXC contract sizes (research/zec-replacement-2/detail.json).
'use strict';
const K = require('./core');
const D = require('../zec-replacement-2/detail.json'), L = Array.isArray(D) ? D : D.data || Object.values(D);
const SPEC = Object.fromEntries(K.COINS.bb.map((c) => { const s = L.find((x) => x.symbol === c + '_USDT'); return [c, { cs: +s.contractSize, minVol: +s.minVol || 1, step: +s.volUnit || 1 }]; }));
function sizeOrder(risk, px, dist, sp) { const perC = px * dist * sp.cs; let v = Math.round(risk / perC / sp.step) * sp.step; if (v < sp.minVol) v = sp.minVol; while (v >= sp.minVol && v * perC > 1.5 * risk) v -= sp.step; return v < sp.minVol ? null : v * perC; }
const A = Date.UTC(2025, 0, 1) / 1000;
const tr = K.bbTrades(K.NEW_BB).filter((t) => t.t >= A);
const levels = [['PHP 1,000 total (BB base $8.6, 2.5%)', 8.62 * 0.025], ['$394 total, Nov 10 live (BB base $197, 2.5%)', 197 * 0.025], ['$1,000 total (BB base $500, 2%)', 500 * 0.02], ['$4,000 total (BB base $2,000, 1.5%)', 2000 * 0.015]];
console.log('| Account | Half-risk trades | skipped (1 contract > 1.5x half target) | of them would be taken at full risk | real risk / intended, half trades (median, range) | real risk / intended, full trades (median) | half trades whose real risk >= 0.75 of full target |');
console.log('|---|---|---|---|---|---|---|');
const T = { n: 0, sk: 0, skFull: 0 };
for (const [name, base] of levels) {
  let n = 0, sk = 0, skFull = 0, big = 0; const rh = [], rf = [];
  for (const t of tr) {
    const sp = SPEC[t.coin], full = base * 1.05;
    if (t.w < 1) { n++; const want = base * t.w, got = sizeOrder(want, t.entry, t.dist, sp), gf = sizeOrder(full, t.entry, t.dist, sp);
      if (got == null) { sk++; if (gf != null) skFull++; } else { rh.push(got / want); if (got >= 0.75 * full) big++; } }
    else { const got = sizeOrder(full, t.entry, t.dist, sp); if (got != null) rf.push(got / full); }
  }
  const s = (a) => [...a].sort((x, y) => x - y), m = (a) => (a.length ? s(a)[a.length >> 1].toFixed(2) : '-');
  console.log(`| ${name} | ${n} | ${sk} (${(100 * sk / n).toFixed(0)}%) | ${skFull} | ${m(rh)} (${rh.length ? s(rh)[0].toFixed(2) : '-'} to ${rh.length ? s(rh)[rh.length - 1].toFixed(2) : '-'}) | ${m(rf)} | ${big} (${(100 * big / n).toFixed(0)}%) |`);
  T.n += n; T.sk += sk; T.skFull += skFull;
}
console.log(`| Total (4 account sizes) | ${T.n} | ${T.sk} | ${T.skFull} | - | - | - |`);
console.log(`BB trades in the window: ${tr.length}; half-risk share ${(100 * tr.filter((t) => t.w < 1).length / tr.length).toFixed(1)}%`);
