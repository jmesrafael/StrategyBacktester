// ind.js — causal indicator library (every value at index i uses bars <= i only). Arrays are Float64Array, NaN until valid.
'use strict';
const N = (n) => new Float64Array(n).fill(NaN);
const ok = (v) => v === v;
function sma(x, n) { const o = N(x.length); let s = 0, c = 0; for (let i = 0; i < x.length; i++) { if (ok(x[i])) { s += x[i]; c++; } if (i >= n && ok(x[i - n])) { s -= x[i - n]; c--; } if (c === n) o[i] = s / n; } return o; }
function ema(x, n) { const o = N(x.length), k = 2 / (n + 1); let f = 0; while (f < x.length && !ok(x[f])) f++; if (f + n > x.length) return o; let s = 0; for (let i = f; i < f + n; i++) s += x[i]; let e = s / n; o[f + n - 1] = e; for (let i = f + n; i < x.length; i++) { e = x[i] * k + e * (1 - k); o[i] = e; } return o; }
function rma(x, n) { const o = N(x.length); let f = 0; while (f < x.length && !ok(x[f])) f++; if (f + n > x.length) return o; let s = 0; for (let i = f; i < f + n; i++) s += x[i]; let e = s / n; o[f + n - 1] = e; for (let i = f + n; i < x.length; i++) { e = (e * (n - 1) + x[i]) / n; o[i] = e; } return o; }
function stdev(x, n) { const o = N(x.length); for (let i = n - 1; i < x.length; i++) { let m = 0; for (let j = i - n + 1; j <= i; j++) m += x[j]; m /= n; let v = 0; for (let j = i - n + 1; j <= i; j++) v += (x[j] - m) ** 2; o[i] = Math.sqrt(v / n); } return o; }
function highest(x, n) { const o = N(x.length); for (let i = n - 1; i < x.length; i++) { let h = -Infinity; for (let j = i - n + 1; j <= i; j++) if (x[j] > h) h = x[j]; o[i] = h; } return o; }
function lowest(x, n) { const o = N(x.length); for (let i = n - 1; i < x.length; i++) { let l = Infinity; for (let j = i - n + 1; j <= i; j++) if (x[j] < l) l = x[j]; o[i] = l; } return o; }
function shift(x, k) { const o = N(x.length); for (let i = k; i < x.length; i++) o[i] = x[i - k]; return o; } // x[i-k]
function trueRange(H, L, C) { const o = N(H.length); for (let i = 1; i < H.length; i++) o[i] = Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1])); return o; }
// Wilder ATR, seeded with the plain mean of TR[1..n] (same as I-Core's atrSeries)
function atr(H, L, C, n = 14) { return rma(trueRange(H, L, C), n); }
function rsi(C, n = 14) {
  const g = N(C.length), l = N(C.length);
  for (let i = 1; i < C.length; i++) { const d = C[i] - C[i - 1]; g[i] = d > 0 ? d : 0; l[i] = d < 0 ? -d : 0; }
  const ag = rma(g, n), al = rma(l, n), o = N(C.length);
  for (let i = 0; i < C.length; i++) if (ok(ag[i])) o[i] = al[i] === 0 ? 100 : 100 - 100 / (1 + ag[i] / al[i]);
  return o;
}
function adx(H, L, C, n = 14) {
  const pdm = N(H.length), mdm = N(H.length);
  for (let i = 1; i < H.length; i++) { const up = H[i] - H[i - 1], dn = L[i - 1] - L[i]; pdm[i] = up > dn && up > 0 ? up : 0; mdm[i] = dn > up && dn > 0 ? dn : 0; }
  const tr = trueRange(H, L, C), a = rma(tr, n), p = rma(pdm, n), m = rma(mdm, n), pdi = N(H.length), mdi = N(H.length), dx = N(H.length);
  for (let i = 0; i < H.length; i++) if (ok(a[i]) && a[i] > 0) { pdi[i] = 100 * p[i] / a[i]; mdi[i] = 100 * m[i] / a[i]; const s = pdi[i] + mdi[i]; dx[i] = s > 0 ? 100 * Math.abs(pdi[i] - mdi[i]) / s : 0; }
  return { adx: rma(dx, n), pdi, mdi };
}
function roc(C, n) { const o = N(C.length); for (let i = n; i < C.length; i++) o[i] = (C[i] / C[i - n] - 1) * 100; return o; }
function cci(H, L, C, n = 20) {
  const tp = C.map((c, i) => (H[i] + L[i] + c) / 3), m = sma(tp, n), o = N(C.length);
  for (let i = n - 1; i < C.length; i++) { let d = 0; for (let j = i - n + 1; j <= i; j++) d += Math.abs(tp[j] - m[i]); d /= n; o[i] = d > 0 ? (tp[i] - m[i]) / (0.015 * d) : 0; }
  return o;
}
function macd(C, f = 12, s = 26, g = 9) { const ef = ema(C, f), es = ema(C, s), line = ef.map((v, i) => v - es[i]), sig = ema(line, g); return { line, sig, hist: line.map((v, i) => v - sig[i]) }; }
function obv(C, V) { const o = N(C.length); o[0] = 0; for (let i = 1; i < C.length; i++) o[i] = o[i - 1] + (C[i] > C[i - 1] ? V[i] : C[i] < C[i - 1] ? -V[i] : 0); return o; }
function stoch(x, n) { const hh = highest(x, n), ll = lowest(x, n), o = N(x.length); for (let i = 0; i < x.length; i++) if (ok(hh[i])) o[i] = hh[i] > ll[i] ? 100 * (x[i] - ll[i]) / (hh[i] - ll[i]) : 50; return o; }
function midHL(H, L, n) { const h = highest(H, n), l = lowest(L, n); return h.map((v, i) => (v + l[i]) / 2); } // Ichimoku lines
function rollingVwap(H, L, C, V, n) { const tpv = C.map((c, i) => (H[i] + L[i] + c) / 3 * V[i]), a = sma(tpv, n), b = sma(V, n); return a.map((v, i) => v / b[i]); }
function efficiency(C, n) { const o = N(C.length); for (let i = n; i < C.length; i++) { let p = 0; for (let j = i - n + 1; j <= i; j++) p += Math.abs(C[j] - C[j - 1]); o[i] = p > 0 ? Math.abs(C[i] - C[i - n]) / p : 0; } return o; }
function chop(H, L, C, n = 14) {
  const tr = trueRange(H, L, C), hh = highest(H, n), ll = lowest(L, n), o = N(C.length);
  for (let i = n; i < C.length; i++) { let s = 0; for (let j = i - n + 1; j <= i; j++) s += tr[j]; o[i] = hh[i] > ll[i] ? 100 * Math.log10(s / (hh[i] - ll[i])) / Math.log10(n) : NaN; }
  return o;
}
const crossUp = (a, b, i) => i > 0 && a[i] > b[i] && a[i - 1] <= b[i - 1];
const crossDn = (a, b, i) => i > 0 && a[i] < b[i] && a[i - 1] >= b[i - 1];
module.exports = { N, ok, sma, ema, rma, stdev, highest, lowest, shift, trueRange, atr, rsi, adx, roc, cci, macd, obv, stoch, midHL, rollingVwap, efficiency, chop, crossUp, crossDn };
