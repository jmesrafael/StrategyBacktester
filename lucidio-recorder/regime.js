// regime.js - what kind of market is each coin in right now, and the market as a whole. Pure: 1h candles in, numbers and a label out (no files, no network, no clock).
// The same code runs on the VPS every hour (live regime on the dashboard) and in regime-history.js (the 1h backtest's trades tagged with the regime they were taken in),
// so "historically, in this regime BB-Core earned X" compares like with like.
//
// candles = [[time, open, high, low, close, volume], ...] oldest first, closed 1h candles only.
//
//   atr_pct       average true range (14 candles) as % of price: how far a candle normally travels
//   rv24, rv7d    realised volatility: standard deviation of 1h returns over 24 h / 7 d, scaled to a day (%)
//   trend_pct     close against its 800-candle average (the bot's own trend filter), in %
//   er48          efficiency ratio over 48 h, 0..1: net move divided by the distance travelled. 1 = a straight line, near 0 = going nowhere
//   bbw           Bollinger band width (80 candles, 2 sigma) as % of the middle band, and bbw_pctile where it stands among the last 90 days (0..100)
//   bb_pos        where the close is against the band: 0 = middle, +1 = on the upper band, -1 = on the lower band; beyond 1 = a breakout candle
//
// states (the coin): trending_up | trending_down  (er48 >= 0.30: a directional move)
//                    volatile                      (not trending, band width in the widest fifth)
//                    quiet                         (band width in the narrowest fifth: a squeeze, where breakouts start)
//                    ranging                       (everything else: chop)
'use strict';

const BB_LEN = 80, BB_MULT = 2, TREND_LEN = 800, ATR_LEN = 14, ER_LEN = 48, PCT_WINDOW = 24 * 90;
const ER_TREND = 0.30, WIDE = 80, NARROW = 20;
const MIN_CANDLES = TREND_LEN + 5;

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const r = (v, d = 3) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(d));

function bandWidthAt(closes, end) {            // band width % of the BB over closes[end-BB_LEN+1 .. end]
  const w = closes.slice(end - BB_LEN + 1, end + 1), mid = mean(w), s = sd(w);
  return { mid, s, width: mid > 0 ? ((2 * BB_MULT * s) / mid) * 100 : null };
}

// the metrics of one coin at the last candle of `candles`. null when there is not enough history.
function coinRegime(candles) {
  const n = candles.length;
  if (n < MIN_CANDLES) return null;
  const closes = candles.map((c) => c[4]), close = closes[n - 1];
  // ATR(14), simple mean of the last 14 true ranges (a level, not a signal: Wilder smoothing would add nothing here)
  const trs = [];
  for (let i = n - ATR_LEN; i < n; i++) { const h = candles[i][2], l = candles[i][3], pc = candles[i - 1][4]; trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))); }
  const atrPct = (mean(trs) / close) * 100;
  // realised volatility, scaled to one day
  const rets = (k) => { const out = []; for (let i = n - k; i < n; i++) out.push(Math.log(closes[i] / closes[i - 1])); return out; };
  const rv24 = sd(rets(24)) * Math.sqrt(24) * 100, rv7d = sd(rets(168)) * Math.sqrt(24) * 100;
  const sma = mean(closes.slice(n - TREND_LEN)), trendPct = ((close - sma) / sma) * 100;
  let path = 0; for (let i = n - ER_LEN + 1; i < n; i++) path += Math.abs(closes[i] - closes[i - 1]);
  const er = path > 0 ? Math.abs(closes[n - 1] - closes[n - ER_LEN]) / path : 0;
  const b = bandWidthAt(closes, n - 1), up = b.mid + BB_MULT * b.s, bbPos = b.s > 0 ? (close - b.mid) / (BB_MULT * b.s) : 0;
  // where today's band width stands among the last 90 days (sampled every 6 candles: the same answer, a quarter of the work)
  const widths = []; for (let e = Math.max(BB_LEN - 1, n - 1 - PCT_WINDOW); e < n; e += 6) widths.push(bandWidthAt(closes, e).width);
  const below = widths.filter((w) => w != null && w <= b.width).length, bbwPctile = widths.length ? (below / widths.length) * 100 : null;
  let state;
  if (er >= ER_TREND) state = close >= sma ? 'trending_up' : 'trending_down';
  else if (bbwPctile >= WIDE) state = 'volatile';
  else if (bbwPctile <= NARROW) state = 'quiet';
  else state = 'ranging';
  return { state, atr_pct: r(atrPct), rv24: r(rv24), rv7d: r(rv7d), trend_pct: r(trendPct, 2), er48: r(er), bbw: r(b.width, 2), bbw_pctile: r(bbwPctile, 1), bb_pos: r(bbPos, 2), sma800: sma, upper: up };
}

// correlation of two equal-length return series
function corr(a, b) {
  const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
}

// byCoin = { SOL_USDT: candles, ... } aligned on the same clock. Returns { coins: { SYM: metrics|null }, market }.
// market: avg_corr_7d (how alike the coins move: near 1 = they are one bet), breadth_up_pct (share of coins above their 800 average), counts per state, market_state.
function marketRegime(byCoin) {
  const coins = {}, ok = [];
  for (const [sym, candles] of Object.entries(byCoin)) { coins[sym] = coinRegime(candles); if (coins[sym]) ok.push(sym); }
  if (!ok.length) return { coins, market: null };
  const series = ok.map((s) => { const c = byCoin[s], k = 168, out = []; for (let i = c.length - k; i < c.length; i++) out.push(Math.log(c[i][4] / c[i - 1][4])); return out; });
  const cs = []; for (let i = 0; i < series.length; i++) for (let j = i + 1; j < series.length; j++) { const v = corr(series[i], series[j]); if (v != null) cs.push(v); }
  const states = ok.map((s) => coins[s].state), count = (f) => states.filter(f).length;
  const up = count((s) => s === 'trending_up'), down = count((s) => s === 'trending_down'), trending = up + down;
  const above = ok.filter((s) => coins[s].trend_pct > 0).length;
  const choppy = count((s) => s === 'ranging' || s === 'quiet');
  const market_state = trending >= Math.ceil(ok.length / 2) ? (up >= down ? 'trending_up' : 'trending_down') : choppy >= Math.ceil(ok.length / 2) ? 'choppy' : 'mixed';
  return { coins, market: { avg_corr_7d: r(cs.length ? mean(cs) : null, 2), breadth_up_pct: r((above / ok.length) * 100, 0), trending_n: trending, ranging_n: count((s) => s === 'ranging'), quiet_n: count((s) => s === 'quiet'),
    volatile_n: count((s) => s === 'volatile'), avg_er48: r(mean(ok.map((s) => coins[s].er48)), 2), avg_bbw_pctile: r(mean(ok.map((s) => coins[s].bbw_pctile)), 0), n: ok.length, market_state } };
}

module.exports = { coinRegime, marketRegime, corr, MIN_CANDLES, STATES: ['trending_up', 'trending_down', 'volatile', 'quiet', 'ranging'] };
