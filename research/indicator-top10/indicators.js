// indicators.js — the first 10 indicators of the list (all trend / moving averages), CAUSAL ONLY:
// value[i] uses bars 0..i and nothing later. NaN until warm-up is complete.
const nan = n => new Array(n).fill(NaN);
const first = a => { for (let i = 0; i < a.length; i++) if (!Number.isNaN(a[i])) return i; return a.length; };

function SMA(x, n) { const o = nan(x.length); const s0 = first(x); let s = 0;
  for (let i = s0; i < x.length; i++) { s += x[i]; if (i - s0 >= n) s -= x[i - n]; if (i - s0 >= n - 1) o[i] = s / n; } return o; }
function EMA(x, n) { const o = nan(x.length); const s0 = first(x); const k = 2 / (n + 1); let s = 0;
  for (let i = s0; i < x.length; i++) { const j = i - s0; if (j < n - 1) s += x[i]; else if (j === n - 1) { s += x[i]; o[i] = s / n; } else o[i] = x[i] * k + o[i - 1] * (1 - k); } return o; }
function SMMA(x, n) { const o = nan(x.length); const s0 = first(x); let s = 0; // Wilder / RMA
  for (let i = s0; i < x.length; i++) { const j = i - s0; if (j < n - 1) s += x[i]; else if (j === n - 1) { s += x[i]; o[i] = s / n; } else o[i] = (o[i - 1] * (n - 1) + x[i]) / n; } return o; }
function WMA(x, n) { const o = nan(x.length); const s0 = first(x); const d = n * (n + 1) / 2;
  for (let i = s0 + n - 1; i < x.length; i++) { let s = 0; for (let k = 0; k < n; k++) s += x[i - k] * (n - k); o[i] = s / d; } return o; }
function VWMA(x, n, v) { const o = nan(x.length);
  for (let i = n - 1; i < x.length; i++) { let a = 0, b = 0; for (let k = 0; k < n; k++) { a += x[i - k] * v[i - k]; b += v[i - k]; } o[i] = b ? a / b : NaN; } return o; }
function HMA(x, n) { const h = Math.max(1, Math.round(n / 2)), r = Math.max(1, Math.round(Math.sqrt(n)));
  const a = WMA(x, h), b = WMA(x, n); return WMA(a.map((v, i) => 2 * v - b[i]), r); }
function DEMA(x, n) { const e1 = EMA(x, n), e2 = EMA(e1, n); return e1.map((v, i) => 2 * v - e2[i]); }
function TEMA(x, n) { const e1 = EMA(x, n), e2 = EMA(e1, n), e3 = EMA(e2, n); return e1.map((v, i) => 3 * v - 3 * e2[i] + e3[i]); }
function KAMA(x, n, fast = 2, slow = 30) { const o = nan(x.length); const fs = 2 / (fast + 1), ss = 2 / (slow + 1);
  for (let i = n; i < x.length; i++) {
    let vol = 0; for (let k = 0; k < n; k++) vol += Math.abs(x[i - k] - x[i - k - 1]);
    const er = vol ? Math.abs(x[i] - x[i - n]) / vol : 0; const sc = (er * (fs - ss) + ss) ** 2;
    const prev = Number.isNaN(o[i - 1]) ? x[i - 1] : o[i - 1]; o[i] = prev + sc * (x[i] - prev); } return o; }
function ALMA(x, n, offset = 0.85, sigma = 6) { const o = nan(x.length); const m = offset * (n - 1), s = n / sigma; const w = []; let norm = 0;
  for (let k = 0; k < n; k++) { const v = Math.exp(-((k - m) ** 2) / (2 * s * s)); w.push(v); norm += v; }
  for (let i = n - 1; i < x.length; i++) { let a = 0; for (let k = 0; k < n; k++) a += x[i - n + 1 + k] * w[k]; o[i] = a / norm; } return o; }

const IND = {
  SMA: (c, v, n) => SMA(c, n), EMA: (c, v, n) => EMA(c, n), WMA: (c, v, n) => WMA(c, n), VWMA: (c, v, n) => VWMA(c, n, v),
  SMMA: (c, v, n) => SMMA(c, n), HMA: (c, v, n) => HMA(c, n), DEMA: (c, v, n) => DEMA(c, n), TEMA: (c, v, n) => TEMA(c, n),
  KAMA: (c, v, n) => KAMA(c, n), ALMA: (c, v, n) => ALMA(c, n),
};
module.exports = { IND, SMA, EMA, WMA, VWMA, SMMA, HMA, DEMA, TEMA, KAMA, ALMA };
