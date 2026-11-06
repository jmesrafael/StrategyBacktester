// strategies.js — every strategy is a pure function of the CLOSED candles up to i (no look-ahead; verified by lookahead.js).
// Periods are written for the 4h chart and multiplied by ctx.k (1 on 4h, 4 on 1h: same time horizon, like bb-core-1h).
// Entry events only fire while flat. Trend filter = SMA(200 x k) like bb-core / I-Core.
'use strict';
const I = require('./ind.js');
const { N, ok } = I;

function makeCtx(B, tf) {
  const k = tf === '4h' ? 1 : 4, sq = tf === '4h' ? 1 : 2, n = B.length;
  const O = Float64Array.from(B, (b) => b.open), H = Float64Array.from(B, (b) => b.high), L = Float64Array.from(B, (b) => b.low), C = Float64Array.from(B, (b) => b.close), V = Float64Array.from(B, (b) => b.volume);
  const atr14 = I.atr(H, L, C, 14), sma200 = I.sma(C, 200 * k);
  return { B, n, k, sq, tf, O, H, L, C, V, atr14, sma200, up: (i) => C[i] > sma200[i], dn: (i) => C[i] < sma200[i] };
}
// build entry flags from fn(i) -> +1 / -1 / 0
function flags(c, fn, from = 1) {
  const Lf = new Uint8Array(c.n), Sf = new Uint8Array(c.n);
  for (let i = Math.max(from, 1); i < c.n; i++) { if (!ok(c.sma200[i])) continue; const s = fn(i); if (s === 1) Lf[i] = 1; else if (s === -1) Sf[i] = 1; }
  return { L: Lf, S: Sf, warmup: 200 * c.k + 2 };
}
const lvl = (x, i, v) => ok(x[i]) && ok(x[i - 1]);
const crossAbove = (x, lev, i) => ok(x[i]) && ok(x[i - 1]) && x[i] > lev && x[i - 1] <= lev;
const crossBelow = (x, lev, i) => ok(x[i]) && ok(x[i - 1]) && x[i] < lev && x[i - 1] >= lev;

// shared Bollinger pieces (bb-core: 20, 2 sigma, stop = middle band, skip if stop < 0.3 ATR away)
function bb(c) { const m = I.sma(c.C, 20 * c.k), s = I.stdev(c.C, 20 * c.k); return { mid: m, up: m.map((v, i) => v + 2 * s[i]), lo: m.map((v, i) => v - 2 * s[i]) }; }
function bbSignal(c, b, i) {
  if (!ok(b.mid[i]) || !ok(c.sma200[i]) || !ok(c.atr14[i])) return 0;
  const d = c.C[i] > b.up[i] && c.C[i] > c.sma200[i] ? 1 : c.C[i] < b.lo[i] && c.C[i] < c.sma200[i] ? -1 : 0;
  if (!d) return 0;
  const dist = Math.abs(c.C[i] - b.mid[i]);
  return dist > 0 && dist >= 0.3 * c.atr14[i] ? d : 0;
}
function bbBuild(c, extra) {
  const b = bb(c), st = flags(c, (i) => { const s = bbSignal(c, b, i); return s && (!extra || extra(i, s)) ? s : 0; });
  st.stopL = Float64Array.from(b.mid); st.stopS = Float64Array.from(b.mid); return st;
}

const S = [];
const add = (id, family, exits, build, desc) => S.push({ id, family, exits, build, desc });

// ---- references (the live bots, re-built inside this engine; validate.js proves they match the real cores) ----
add('bb-core', 'reference', ['BBX'], (c) => bbBuild(c), 'Bollinger(20,2) close-through + SMA200, stop = middle band, 48-candle time exit (the live bot)');
add('i-core', 'reference', ['P7'], (c) => {
  const kj = 26 * c.k, ten = I.midHL(c.H, c.L, 9 * c.k), kij = I.midHL(c.H, c.L, 26 * c.k), sb = I.midHL(c.H, c.L, 52 * c.k);
  const A = ten.map((v, i) => (v + kij[i]) / 2), top = N(c.n), bot = N(c.n);
  for (let i = kj; i < c.n; i++) { const a = A[i - kj], b = sb[i - kj]; if (ok(a) && ok(b)) { top[i] = Math.max(a, b); bot[i] = Math.min(a, b); } }
  return flags(c, (i) => {
    if (!ok(top[i]) || !ok(top[i - 1])) return 0;
    if (c.C[i] > top[i] && c.C[i - 1] <= top[i - 1] && c.up(i)) return 1;
    if (c.C[i] < bot[i] && c.C[i - 1] >= bot[i - 1] && c.dn(i)) return -1; return 0;
  });
}, 'Ichimoku cloud break + SMA200, 2 ATR stop, 7 ATR trail (the live bot)');

// ---- momentum / oscillator entries ----
add('rsi-mom', 'oscillator', ['P7', 'P14'], (c) => { const r = I.rsi(c.C, 14 * c.k); return flags(c, (i) => crossAbove(r, 60, i) && c.up(i) ? 1 : crossBelow(r, 40, i) && c.dn(i) ? -1 : 0); }, 'RSI(14) crosses 60 up / 40 down, with the SMA200 trend');
add('rsi-dip', 'oscillator', ['P7', 'P14'], (c) => {
  const r = I.rsi(c.C, 14 * c.k), lo = I.lowest(r, 10 * c.k), hi = I.highest(r, 10 * c.k);
  return flags(c, (i) => crossAbove(r, 40, i) && lo[i - 1] < 30 && c.up(i) ? 1 : crossBelow(r, 60, i) && hi[i - 1] > 70 && c.dn(i) ? -1 : 0);
}, 'Trend pullback: RSI was <30 in the last 10 bars and crosses back up through 40 (mirror for shorts)');
add('stochrsi', 'oscillator', ['P7', 'P14'], (c) => {
  const sr = I.stoch(I.rsi(c.C, 14 * c.k), 14 * c.k), K = I.sma(sr, 3 * c.k), D = I.sma(K, 3 * c.k);
  return flags(c, (i) => I.crossUp(K, D, i) && K[i] < 30 && c.up(i) ? 1 : I.crossDn(K, D, i) && K[i] > 70 && c.dn(i) ? -1 : 0);
}, 'Stochastic RSI K crosses D from oversold in an uptrend (overbought in a downtrend)');
add('cci100', 'oscillator', ['P7', 'P14'], (c) => { const x = I.cci(c.H, c.L, c.C, 20 * c.k); return flags(c, (i) => crossAbove(x, 100, i) && c.up(i) ? 1 : crossBelow(x, -100, i) && c.dn(i) ? -1 : 0); }, 'CCI(20) crosses +100 / -100 with the trend');
add('ao-zero', 'oscillator', ['P7', 'P14'], (c) => {
  const hl = Float64Array.from(c.C, (_, i) => (c.H[i] + c.L[i]) / 2), ao = I.sma(hl, 5 * c.k).map((v, i) => v - I.sma(hl, 34 * c.k)[i]);
  return flags(c, (i) => crossAbove(ao, 0, i) && c.up(i) ? 1 : crossBelow(ao, 0, i) && c.dn(i) ? -1 : 0);
}, 'Awesome Oscillator (5,34) zero cross with the trend');
add('elder', 'oscillator', ['P7', 'P14'], (c) => {
  const e = I.ema(c.C, 13 * c.k), h = I.macd(c.C, 12 * c.k, 26 * c.k, 9 * c.k).hist;
  const g = (i) => ok(e[i - 1]) && ok(h[i - 1]) && e[i] > e[i - 1] && h[i] > h[i - 1], r = (i) => ok(e[i - 1]) && ok(h[i - 1]) && e[i] < e[i - 1] && h[i] < h[i - 1];
  return flags(c, (i) => g(i) && !g(i - 1) && c.up(i) ? 1 : r(i) && !r(i - 1) && c.dn(i) ? -1 : 0, 2);
}, 'Elder Impulse: EMA13 and MACD histogram both rising (falling) for the first bar, with the trend');
add('fisher', 'oscillator', ['P7', 'P14'], (c) => {
  const n9 = 9 * c.k, hl = Float64Array.from(c.C, (_, i) => (c.H[i] + c.L[i]) / 2), hh = I.highest(hl, n9), ll = I.lowest(hl, n9), F = N(c.n);
  let v = 0, f = 0;
  for (let i = n9 - 1; i < c.n; i++) { const x = hh[i] > ll[i] ? (hl[i] - ll[i]) / (hh[i] - ll[i]) - 0.5 : 0; v = 0.66 * x + 0.67 * v; const vv = Math.max(-0.999, Math.min(0.999, v)); f = 0.5 * Math.log((1 + vv) / (1 - vv)) + 0.5 * f; F[i] = f; }
  const sig = I.shift(F, 1);
  return flags(c, (i) => I.crossUp(F, sig, i) && c.up(i) ? 1 : I.crossDn(F, sig, i) && c.dn(i) ? -1 : 0);
}, 'Fisher Transform(9) crosses its signal line with the trend');
add('tsmom', 'momentum', ['P7', 'P14'], (c) => { const r = I.roc(c.C, 42 * c.k); return flags(c, (i) => crossAbove(r, 0, i) && c.up(i) ? 1 : crossBelow(r, 0, i) && c.dn(i) ? -1 : 0); }, 'Time-series momentum: 7-day rate of change crosses zero, with the trend');
add('kst', 'momentum', ['P7', 'P14'], (c) => {
  const k = c.k, mk = (r, s) => I.sma(I.roc(c.C, r * k), s * k), a = mk(10, 10), b = mk(15, 10), d = mk(20, 10), e = mk(30, 15);
  const kst = a.map((v, i) => v + 2 * b[i] + 3 * d[i] + 4 * e[i]), sig = I.sma(kst, 9 * k);
  return flags(c, (i) => I.crossUp(kst, sig, i) && c.up(i) ? 1 : I.crossDn(kst, sig, i) && c.dn(i) ? -1 : 0);
}, 'Know Sure Thing crosses its signal line with the trend');
add('heikin', 'momentum', ['P7', 'P14'], (c) => {
  const hc = Float64Array.from(c.C, (_, i) => (c.O[i] + c.H[i] + c.L[i] + c.C[i]) / 4), ho = N(c.n); ho[0] = (c.O[0] + c.C[0]) / 2;
  for (let i = 1; i < c.n; i++) ho[i] = (ho[i - 1] + hc[i - 1]) / 2;
  const hh = (i) => Math.max(c.H[i], ho[i], hc[i]), hl = (i) => Math.min(c.L[i], ho[i], hc[i]);
  const bu = (i) => hc[i] > ho[i] && ho[i] - hl(i) < 1e-12 * ho[i], be = (i) => hc[i] < ho[i] && hh(i) - ho[i] < 1e-12 * ho[i];
  return flags(c, (i) => bu(i) && bu(i - 1) && !bu(i - 2) && c.up(i) ? 1 : be(i) && be(i - 1) && !be(i - 2) && c.dn(i) ? -1 : 0, 3);
}, 'Heikin-Ashi: second strong candle in a row (no lower/upper wick), with the trend');
add('ribbon', 'trend', ['P7', 'P14'], (c) => {
  const e8 = I.ema(c.C, 8 * c.k), e21 = I.ema(c.C, 21 * c.k), e55 = I.ema(c.C, 55 * c.k);
  const al = (i) => e8[i] > e21[i] && e21[i] > e55[i] && c.C[i] > e8[i], as = (i) => e8[i] < e21[i] && e21[i] < e55[i] && c.C[i] < e8[i];
  return flags(c, (i) => ok(e55[i - 1]) && al(i) && !al(i - 1) && c.up(i) ? 1 : ok(e55[i - 1]) && as(i) && !as(i - 1) && c.dn(i) ? -1 : 0);
}, 'EMA 8/21/55 ribbon: first bar where price and the three EMAs are fully stacked, with the trend');
add('ichi-tk', 'trend', ['P7', 'P14'], (c) => {
  const kj = 26 * c.k, ten = I.midHL(c.H, c.L, 9 * c.k), kij = I.midHL(c.H, c.L, 26 * c.k), sb = I.midHL(c.H, c.L, 52 * c.k), top = N(c.n), bot = N(c.n);
  for (let i = kj; i < c.n; i++) { const a = (ten[i - kj] + kij[i - kj]) / 2, b = sb[i - kj]; if (ok(a) && ok(b)) { top[i] = Math.max(a, b); bot[i] = Math.min(a, b); } }
  return flags(c, (i) => ok(top[i]) && I.crossUp(ten, kij, i) && c.C[i] > top[i] && c.up(i) ? 1 : ok(bot[i]) && I.crossDn(ten, kij, i) && c.C[i] < bot[i] && c.dn(i) ? -1 : 0);
}, 'Ichimoku Tenkan/Kijun cross while price is outside the cloud, with the trend');
add('vwap', 'trend', ['P7', 'P14'], (c) => {
  const v = I.rollingVwap(c.H, c.L, c.C, c.V, 50 * c.k), sl = 5 * c.k;
  return flags(c, (i) => ok(v[i - sl]) && I.crossUp(c.C, v, i) && v[i] > v[i - sl] && c.up(i) ? 1 : ok(v[i - sl]) && I.crossDn(c.C, v, i) && v[i] < v[i - sl] && c.dn(i) ? -1 : 0, 5 * c.k + 1);
}, 'Price reclaims the rolling VWAP(50) while it slopes the same way, with the trend');
add('obv', 'volume', ['P7', 'P14'], (c) => { const o = I.obv(c.C, c.V), s = I.sma(o, 30 * c.k); return flags(c, (i) => I.crossUp(o, s, i) && c.up(i) ? 1 : I.crossDn(o, s, i) && c.dn(i) ? -1 : 0); }, 'On-Balance-Volume crosses its 30-bar average, with the trend');

// ---- breakout / volatility entries ----
const brk = (c, n) => { const hi = I.highest(c.C, n), lo = I.lowest(c.C, n); return { hi: I.shift(hi, 1), lo: I.shift(lo, 1) }; };
add('don-vol', 'breakout', ['P7', 'P14'], (c) => { const { hi, lo } = brk(c, 20 * c.k), vm = I.sma(c.V, 20 * c.k); return flags(c, (i) => c.C[i] > hi[i] && c.V[i] > 2 * vm[i] && c.up(i) ? 1 : c.C[i] < lo[i] && c.V[i] > 2 * vm[i] && c.dn(i) ? -1 : 0); }, '20-bar closing breakout on >2x average volume, with the trend');
add('er-break', 'breakout', ['P7', 'P14'], (c) => { const { hi, lo } = brk(c, 20 * c.k), er = I.efficiency(c.C, 20 * c.k); return flags(c, (i) => er[i] > 0.35 && c.C[i] > hi[i] && c.up(i) ? 1 : er[i] > 0.35 && c.C[i] < lo[i] && c.dn(i) ? -1 : 0); }, '20-bar closing breakout while Kaufman efficiency ratio > 0.35 (a clean trend), with the trend');
add('chop-break', 'breakout', ['P7', 'P14'], (c) => { const { hi, lo } = brk(c, 20 * c.k), ci = I.chop(c.H, c.L, c.C, 14 * c.k); return flags(c, (i) => ci[i] < 38.2 && c.C[i] > hi[i] && c.up(i) ? 1 : ci[i] < 38.2 && c.C[i] < lo[i] && c.dn(i) ? -1 : 0); }, '20-bar closing breakout while the Choppiness Index < 38.2, with the trend');
add('fractal', 'breakout', ['P7', 'P14'], (c) => {
  const w = 2 * c.k, fh = N(c.n), fl = N(c.n); let lh = NaN, ll = NaN;
  for (let i = 2 * w; i < c.n; i++) { // fractal centred at j = i - w is only known now (w bars later)
    const j = i - w; let isH = true, isL = true;
    for (let m = 1; m <= w; m++) { if (!(c.H[j] > c.H[j - m] && c.H[j] > c.H[j + m])) isH = false; if (!(c.L[j] < c.L[j - m] && c.L[j] < c.L[j + m])) isL = false; }
    if (isH) lh = c.H[j]; if (isL) ll = c.L[j]; fh[i] = lh; fl[i] = ll;
  }
  return flags(c, (i) => ok(fh[i - 1]) && c.C[i] > fh[i] && c.C[i - 1] <= fh[i - 1] && c.up(i) ? 1 : ok(fl[i - 1]) && c.C[i] < fl[i] && c.C[i - 1] >= fl[i - 1] && c.dn(i) ? -1 : 0, 2 * w + 2);
}, 'Close breaks the last confirmed Williams fractal high (low), with the trend');
add('momo-candle', 'breakout', ['P7', 'P14'], (c) => {
  const big = (i, d) => { const r = c.H[i] - c.L[i]; return r > 2 * c.atr14[i - 1] && (d === 1 ? c.C[i] >= c.H[i] - 0.2 * r : c.C[i] <= c.L[i] + 0.2 * r); };
  return flags(c, (i) => ok(c.atr14[i - 1]) && big(i, 1) && c.C[i] > c.O[i] && c.up(i) ? 1 : ok(c.atr14[i - 1]) && big(i, -1) && c.C[i] < c.O[i] && c.dn(i) ? -1 : 0);
}, 'Momentum candle: range > 2 ATR and the close in the top (bottom) 20% of the bar, with the trend');

// ---- bb-core variants: same entry idea, one change ----
add('bb-vol', 'bb-variant', ['BBX', 'P7', 'P14'], (c) => { const vm = I.sma(c.V, 20 * c.k); return bbBuild(c, (i) => c.V[i] > 1.5 * vm[i]); }, 'bb-core entry only on >1.5x average volume');
add('bb-adx', 'bb-variant', ['BBX', 'P7', 'P14'], (c) => { const a = I.adx(c.H, c.L, c.C, 14 * c.k).adx; return bbBuild(c, (i) => a[i] > 25); }, 'bb-core entry only while ADX > 25');
add('bb-squeeze', 'bb-variant', ['BBX', 'P7', 'P14'], (c) => {
  const b = bb(c), bw = b.mid.map((m, i) => (b.up[i] - b.lo[i]) / m), low = I.lowest(bw, 120 * c.k), sq = new Uint8Array(c.n);
  for (let i = 0; i < c.n; i++) sq[i] = ok(low[i]) && bw[i] <= 1.25 * low[i] ? 1 : 0;
  const recent = (i) => { for (let j = i - 6 * c.k; j <= i; j++) if (sq[j]) return true; return false; };
  return bbBuild(c, (i) => i > 130 * c.k && recent(i));
}, 'bb-core entry only if the bands were in a squeeze (width within 25% of its 120-bar low) in the last 6 bars');
add('bb-hybrid', 'bb-variant', ['BBT7', 'BBT14', 'BBT7T', 'BBX96', 'BBX192'], (c) => bbBuild(c), 'bb-core entry AND its Bollinger-middle stop, plus an ATR trail (BBT7/14) and/or a longer time exit (96/192 candles instead of 48)');
add('bb-trail', 'bb-variant', ['P7', 'P14'], (c) => flags(c, (i) => bbSignal(c, bb(c), i)), 'bb-core entry, but an ATR stop/trail instead of the Bollinger-middle stop and the 48-bar exit');

// ---- mean reversion (own exits: 2 ATR stop, exit on the signal, 12-bar time limit) ----
add('zscore-rev', 'reversion', ['REV'], (c) => {
  const m = I.sma(c.C, 20 * c.k), s = I.stdev(c.C, 20 * c.k), z = m.map((v, i) => (c.C[i] - v) / s[i]);
  const st = flags(c, (i) => crossBelow(z, -2, i) && c.up(i) ? 1 : crossAbove(z, 2, i) && c.dn(i) ? -1 : 0);
  st.xL = new Uint8Array(c.n); st.xS = new Uint8Array(c.n); for (let i = 0; i < c.n; i++) { st.xL[i] = z[i] > 0 ? 1 : 0; st.xS[i] = z[i] < 0 ? 1 : 0; } return st;
}, 'Buy a -2 sigma dip inside an uptrend (sell a +2 sigma rally in a downtrend), exit at the mean');
add('rsi2-rev', 'reversion', ['REV'], (c) => {
  const r = I.rsi(c.C, 2), st = flags(c, (i) => crossBelow(r, 10, i) && c.up(i) ? 1 : crossAbove(r, 90, i) && c.dn(i) ? -1 : 0);
  st.xL = new Uint8Array(c.n); st.xS = new Uint8Array(c.n); for (let i = 0; i < c.n; i++) { st.xL[i] = r[i] > 65 ? 1 : 0; st.xS[i] = r[i] < 35 ? 1 : 0; } return st;
}, 'Connors RSI(2) < 10 inside an uptrend (> 90 in a downtrend), exit when RSI(2) normalises');
add('bb-fade', 'reversion', ['REV'], (c) => {
  const b = bb(c), st = flags(c, (i) => ok(b.lo[i]) && ok(b.lo[i - 1]) && c.C[i] < b.lo[i] && c.C[i - 1] >= b.lo[i - 1] && c.up(i) ? 1 : ok(b.up[i - 1]) && c.C[i] > b.up[i] && c.C[i - 1] <= b.up[i - 1] && c.dn(i) ? -1 : 0);
  st.xL = new Uint8Array(c.n); st.xS = new Uint8Array(c.n); for (let i = 0; i < c.n; i++) { st.xL[i] = c.C[i] >= b.mid[i] ? 1 : 0; st.xS[i] = c.C[i] <= b.mid[i] ? 1 : 0; } return st;
}, 'The OPPOSITE of bb-core: fade a close below the lower band when the 200 SMA trend is up (and vice versa)');

// exit profiles. sq scales ATR multiples for the 1h chart (volatility grows with sqrt(time)); k scales bar counts
function exitOf(p, c) {
  if (p === 'P7') return { kInit: 2 * c.sq, kTrail: 7 * c.sq, maxBars: 0, sigExit: false };
  if (p === 'P14') return { kInit: 2 * c.sq, kTrail: 14 * c.sq, maxBars: 0, sigExit: false };
  if (p === 'BBX') return { kInit: 0, kTrail: 0, maxBars: 48 * c.k, sigExit: false };
  if (p === 'BBT7') return { kInit: 0, kTrail: 7 * c.sq, maxBars: 0, sigExit: false };
  if (p === 'BBT14') return { kInit: 0, kTrail: 14 * c.sq, maxBars: 0, sigExit: false };
  if (p === 'BBT7T') return { kInit: 0, kTrail: 7 * c.sq, maxBars: 96 * c.k, sigExit: false };
  if (p === 'BBX96') return { kInit: 0, kTrail: 0, maxBars: 96 * c.k, sigExit: false };
  if (p === 'BBX192') return { kInit: 0, kTrail: 0, maxBars: 192 * c.k, sigExit: false };
  if (p === 'REV') return { kInit: 2 * c.sq, kTrail: 0, maxBars: 12 * c.k, sigExit: true };
  throw new Error('profile ' + p);
}
module.exports = { S, makeCtx, exitOf };
