// d-tswitch.js: what happens if T-CORE's trail is changed from 14 to 12 ATR while trades are open?
// Own T-CORE loop with a trail that depends on the candle: k(i) = 14 before the switch candle, 12 from it on.
// Checked first: with no switch it equals the project engine trade for trade (k = 14 and k = 12).
'use strict';
const K = require('./core');
const { E, ST, IV } = K;
const FEE = 0.0005, SLIP = 0.0002;

function runT(coin, kAt) {
  const d = K.data(coin), B = d.B, n = B.length, atr = E.atrB(B, 14), S = ST.bot('tcore', 'v3'), ctx = { B, atr }, F = d.F;
  const fund = (a, b, dir) => { let s = 0; for (const [ft, r] of F) { if (ft > b) break; if (ft > a) s += dir * r; } return s; };
  const trades = []; let pos = null, pend = null, lastGap = -Infinity;
  const exit = (raw, ix, why) => { const px = raw * (1 - pos.dir * SLIP), t = B[pos.i0].time, tExit = B[ix].time + IV;
    const R = (pos.dir * (px - pos.entry) / pos.entry - 2 * FEE - fund(t, tExit, pos.dir)) / pos.dist;
    trades.push({ coin, dir: pos.dir, i0: pos.i0, i1: ix, t, tExit, R, why, entry: pos.entry, dist: pos.dist, w: 1, bot: 'tc' }); pos = null; };
  for (let i = 0; i < n; i++) {
    const b = B[i];
    if (i > 0 && b.time - B[i - 1].time !== IV) lastGap = i;
    if (pend) { const dd = pend.dir, fill = b.open * (1 + dd * SLIP), stop = fill - dd * 2 * pend.atr; pos = { dir: dd, i0: i, entry: fill, stop0: stop, stop, dist: 2 * pend.atr / fill, ext: b.open, out: false }; pend = null; }
    if (pos && pos.out) exit(B[i - 1].close, i - 1, 'time');
    if (pos) {
      const long = pos.dir === 1;
      if (long ? b.low <= pos.stop : b.high >= pos.stop) exit(long ? Math.min(b.open, pos.stop) : Math.max(b.open, pos.stop), i, 'stop');
      else if (i - pos.i0 >= 1200) exit(b.close, i, 'time');
      else {
        pos.ext = long ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low);
        const ns = pos.ext - pos.dir * kAt(b.time) * atr[i]; if (long ? ns > pos.stop : ns < pos.stop) pos.stop = ns;
        const oneR = Math.abs(pos.entry - pos.stop0);
        if (i - pos.i0 >= 48 && pos.dir * (b.close - pos.entry) < oneR) pos.out = true;
      }
    }
    if (pos) continue;
    if (i < 205 || !(atr[i] > 0) || i - lastGap < 200) continue;
    const s = S.signal(ctx, i); if (s) pend = { dir: s.dir, atr: atr[i] };
  }
  return trades;
}
const all = (kAt) => K.COINS.tc.flatMap((c) => runT(c, kAt));
// parity
for (const k of [14, 12]) {
  const mine = all(() => k), ref = K.tcTrades(k); let diff = 0;
  const key = (t) => t.coin + t.t + t.dir; const m = new Map(ref.map((t) => [key(t), t]));
  for (const t of mine) { const r = m.get(key(t)); if (!r || Math.abs(r.R - t.R) > 1e-9 || r.tExit !== t.tExit) diff++; }
  console.log(`parity trail ${k}: mine ${mine.length} engine ${ref.length} different ${diff}`);
}
// switch on random dates (seeded), 2021-01-01 .. 2026-05-24 (leaves >= 6 months after each switch)
let seed = 7; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const A = Date.UTC(2021, 0, 1) / 1000, Z = Date.UTC(2026, 4, 24) / 1000, END = K.END;
const T14 = all(() => 14), T12 = all(() => 12);
const after = (tr, s, h) => tr.filter((t) => t.tExit > s && t.tExit <= s + h).reduce((a, t) => a + t.R, 0);
const openAt = (tr, s) => tr.filter((t) => t.t <= s && t.tExit > s);
const rows = [];
for (let k = 0; k < 300; k++) {
  const s = A + Math.floor(rnd() * ((Z - A) / IV)) * IV;     // switch from the candle opening at s (trail decided at its close)
  const SW = all((t) => (t >= s ? 12 : 14));
  const open14 = openAt(T14, s), key = (t) => t.coin + t.t;
  const swMap = new Map(SW.map((t) => [key(t), t]));
  // the trades that were open at the switch: R with 14 kept vs R after switching
  let r14 = 0, rsw = 0, closedAtOnce = 0, nOpen = open14.length, worse = 0;
  for (const t of open14) { const u = swMap.get(key(t)); r14 += t.R; rsw += u.R; if (u.tExit <= s + 2 * IV) closedAtOnce++; if (u.R < t.R - 1e-9) worse++; }
  const H = 180 * 86400;
  rows.push({ s, nOpen, r14, rsw, closedAtOnce, worse, h14: after(T14, s, H), hsw: after(SW, s, H), h12: after(T12, s, H), e14: after(T14, s, END - s), esw: after(SW, s, END - s), e12: after(T12, s, END - s) });
}
const sum = (k) => rows.reduce((a, r) => a + r[k], 0), med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const withOpen = rows.filter((r) => r.nOpen > 0);
console.log(`\n300 switch dates; dates with T-CORE trades open: ${withOpen.length}; open trades total ${sum('nOpen')}`);
console.log(`open trades closed within 2 candles of the switch: ${sum('closedAtOnce')} (${(100 * sum('closedAtOnce') / sum('nOpen')).toFixed(1)}%)`);
console.log(`open trades that end worse after the switch: ${sum('worse')} (${(100 * sum('worse') / sum('nOpen')).toFixed(1)}%)`);
console.log(`R of the open trades: keep 14 total ${sum('r14').toFixed(1)}  switch ${sum('rsw').toFixed(1)}  per date mean diff ${((sum('rsw') - sum('r14')) / 300).toFixed(2)}R  median diff ${med(rows.map((r) => r.rsw - r.r14)).toFixed(2)}  worst ${Math.min(...rows.map((r) => r.rsw - r.r14)).toFixed(1)}  best ${Math.max(...rows.map((r) => r.rsw - r.r14)).toFixed(1)}`);
console.log(`next 180 days R (unweighted, 8 coins): mean keep14 ${(sum('h14') / 300).toFixed(1)}  switch ${(sum('hsw') / 300).toFixed(1)}  pure12 ${(sum('h12') / 300).toFixed(1)}; switch beats keep14 on ${rows.filter((r) => r.hsw > r.h14).length}/300 dates`);
console.log(`to the end R: mean keep14 ${(sum('e14') / 300).toFixed(1)}  switch ${(sum('esw') / 300).toFixed(1)}  pure12 ${(sum('e12') / 300).toFixed(1)}; switch beats keep14 on ${rows.filter((r) => r.esw > r.e14).length}/300`);
// distribution of the immediate cost: per-date diff on open trades, buckets
const b = { '< -10R': 0, '-10..-3R': 0, '-3..-0.01R': 0, 'about 0': 0, '> 0': 0 };
for (const r of rows) { const x = r.rsw - r.r14; if (x < -10) b['< -10R']++; else if (x < -3) b['-10..-3R']++; else if (x < -0.01) b['-3..-0.01R']++; else if (x <= 0.01) b['about 0']++; else b['> 0']++; }
console.log('per-date effect on the trades open at the switch:', JSON.stringify(b));
require('fs').writeFileSync(__dirname + '/d-tswitch.json', JSON.stringify(rows));
