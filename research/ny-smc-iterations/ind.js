// ind.js — indicator helpers on OHLCV bar arrays ({time, open, high, low, close, volume}). All causal: value i uses bars ≤ i.
function ema(x, n) { const o = new Array(x.length).fill(null), k = 2 / (n + 1); let s = 0;
  for (let i = 0; i < x.length; i++) { if (i < n) { s += x[i]; if (i === n - 1) o[i] = s / n; } else o[i] = x[i] * k + o[i - 1] * (1 - k); } return o; }
function sma(x, n) { const o = new Array(x.length).fill(null); let s = 0; for (let i = 0; i < x.length; i++) { s += x[i]; if (i >= n) s -= x[i - n]; if (i >= n - 1) o[i] = s / n; } return o; }
function wilder(x, n) { const o = new Array(x.length).fill(null); let s = 0; for (let i = 0; i < x.length; i++) { if (i < n) { s += x[i]; if (i === n - 1) o[i] = s / n; } else o[i] = (o[i - 1] * (n - 1) + x[i]) / n; } return o; }
function rsi(c, n = 14) {
  const up = [0], dn = [0]; for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1]; up.push(Math.max(d, 0)); dn.push(Math.max(-d, 0)); }
  const u = wilder(up, n), d = wilder(dn, n); return u.map((v, i) => (v == null || d[i] == null ? null : d[i] === 0 ? 100 : 100 - 100 / (1 + v / d[i])));
}
function macd(c, f = 12, s = 26, g = 9) { const a = ema(c, f), b = ema(c, s), line = c.map((_, i) => (a[i] == null || b[i] == null ? null : a[i] - b[i]));
  const first = line.findIndex((v) => v != null), sig = new Array(c.length).fill(null), e = ema(line.slice(first), g); e.forEach((v, j) => { sig[first + j] = v; });
  return { line, sig, hist: line.map((v, i) => (v == null || sig[i] == null ? null : v - sig[i])) }; }
function trs(B) { return B.map((b, i) => (i ? Math.max(b.high - b.low, Math.abs(b.high - B[i - 1].close), Math.abs(b.low - B[i - 1].close)) : b.high - b.low)); }
function atr(B, n = 14) { return wilder(trs(B), n); }
function adx(B, n = 14) {
  const pdm = [0], ndm = [0]; for (let i = 1; i < B.length; i++) { const u = B[i].high - B[i - 1].high, d = B[i - 1].low - B[i].low; pdm.push(u > d && u > 0 ? u : 0); ndm.push(d > u && d > 0 ? d : 0); }
  const tr = wilder(trs(B), n), p = wilder(pdm, n), m = wilder(ndm, n);
  const dx = B.map((_, i) => { if (tr[i] == null || !tr[i]) return null; const pi = 100 * p[i] / tr[i], mi = 100 * m[i] / tr[i]; return pi + mi ? 100 * Math.abs(pi - mi) / (pi + mi) : 0; });
  const first = dx.findIndex((v) => v != null), out = new Array(B.length).fill(null); wilder(dx.slice(first), n).forEach((v, j) => { out[first + j] = v; }); return out;
}
function bb(c, n = 20, k = 2) { const m = sma(c, n); return c.map((_, i) => { if (m[i] == null) return null; let s = 0; for (let j = i - n + 1; j <= i; j++) s += (c[j] - m[i]) ** 2; const sd = Math.sqrt(s / n); return { mid: m[i], up: m[i] + k * sd, lo: m[i] - k * sd }; }); }
function obv(B) { const o = [0]; for (let i = 1; i < B.length; i++) o.push(o[i - 1] + (B[i].close > B[i - 1].close ? B[i].volume : B[i].close < B[i - 1].close ? -B[i].volume : 0)); return o; }
// resample to a higher timeframe; map15[i] = index of the last HTF bar fully closed when 15m bar i closes
function resample(B, sec, barSec = 900) {
  const H = [], map = new Array(B.length); let cur = null;
  for (let i = 0; i < B.length; i++) {
    const b = B[i], k = Math.floor(b.time / sec);
    if (!cur || cur.k !== k) { if (cur) H.push(cur); cur = { k, time: k * sec, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }; }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; cur.volume += b.volume; }
    const closesBucket = (b.time + barSec) % sec === 0; // this 15m bar completes the HTF bar
    map[i] = closesBucket ? H.length : H.length - 1;     // H.length = index the current bucket will get
  }
  if (cur) H.push(cur);
  return { H, map };
}
module.exports = { ema, sma, wilder, rsi, macd, atr, adx, bb, obv, resample, trs };
