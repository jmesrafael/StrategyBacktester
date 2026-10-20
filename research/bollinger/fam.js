// fam.js — the two Bollinger families under test.
const L = require('./lib.js');

// ---- MR: mean reversion. Fade a close outside the band, aim back at the middle band. ----
// p: { tf, n, k, mode:'touch'|'reentry', adxMax (0 = off), stopATR, tp:'mid'|<R multiple>, minRR, maxBars }
function mr(sym, p) {
  const I = L.ind(sym, p.tf), B = I.B, bb = I.bb(p.n, p.k), atr = I.atr(14), adx = p.adxMax ? I.adx(14).adx : null, cl = I.closes;
  const sig = (i) => {
    const up = bb.upper[i], lo = bb.lower[i], mid = bb.middle[i], a = atr[i];
    if (up == null || a == null || (adx && (adx[i] == null || adx[i] > p.adxMax))) return null;
    let dir = 0;
    if (p.mode === 'touch') dir = cl[i] < lo ? 1 : cl[i] > up ? -1 : 0;
    else { // re-entry: previous close was outside, this one closed back inside
      const pu = bb.upper[i - 1], pl = bb.lower[i - 1];
      if (pl != null && cl[i - 1] < pl && cl[i] >= lo) dir = 1;
      else if (pu != null && cl[i - 1] > pu && cl[i] <= up) dir = -1;
    }
    if (!dir) return null;
    const stop = cl[i] - dir * p.stopATR * a, dist = p.stopATR * a;
    let tp;
    if (p.tp === 'mid') { tp = mid; if (dir * (tp - cl[i]) < p.minRR * dist) return null; } // not enough room back to the mean
    else tp = cl[i] + dir * p.tp * dist;
    return { dir, stop, tp, maxBars: p.maxBars };
  };
  return L.run(B, sig, Math.max(p.n, 30) + 2);
}

// ---- SQ: squeeze breakout. After the bands pinch, trade the close outside them. ----
// p: { tf, n, k, look (bars for the width rank), pct (squeeze = width in lowest pct of the last `look`), recent (squeeze seen within
//      this many bars), stop:'mid'|<ATR multiple>, tp:<R multiple>|0, trailATR (0 = off), maxBars }
function sq(sym, p) {
  const I = L.ind(sym, p.tf), B = I.B, bb = I.bb(p.n, p.k), atr = I.atr(14), cl = I.closes, w = bb.width;
  const tma = p.trendN ? I.sma(p.trendN) : null; // optional trend filter: longs above, shorts below the SMA
  // squeeze flag per bar: current width is within the lowest `pct` of the last `look` widths
  const flag = new Uint8Array(B.length);
  for (let i = p.look + p.n; i < B.length; i++) {
    let below = 0;
    for (let j = i - p.look + 1; j < i; j++) if (w[j] < w[i]) below++;
    flag[i] = below <= p.pct * p.look ? 1 : 0;
  }
  const sig = (i) => {
    const up = bb.upper[i], lo = bb.lower[i], mid = bb.middle[i], a = atr[i];
    if (up == null || a == null) return null;
    let dir = cl[i] > up ? 1 : cl[i] < lo ? -1 : 0;
    if (!dir) return null;
    if (tma && (tma[i] == null || (dir === 1 ? cl[i] < tma[i] : cl[i] > tma[i]))) return null;
    let sq = false;
    for (let j = i - p.recent; j < i; j++) if (flag[j]) { sq = true; break; }
    if (!sq) return null;
    const stop = p.stop === 'mid' ? mid : cl[i] - dir * p.stop * a;
    const dist = Math.abs(cl[i] - stop);
    if (!(dist > 0) || dist < 0.3 * a) return null;
    return { dir, stop, tp: p.tp ? cl[i] + dir * p.tp * dist : null, trail: p.trailATR ? p.trailATR * a : null,
      be: p.beR ? cl[i] + dir * p.beR * dist : null, maxBars: p.maxBars };
  };
  return L.run(B, sig, Math.max(p.look + p.n + p.recent, p.trendN || 0) + 2);
}

module.exports = { mr, sq };
