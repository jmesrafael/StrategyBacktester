// engine.js — swing-breakout backtester on 4h Binance USDT-M futures candles. No look-ahead:
//   * a signal is computed from candles up to and including bar i (closed); the order fills at the OPEN of bar i+1
//   * the stop is checked inside every bar with its high/low (gap through the stop -> filled at the open, i.e. worse)
//   * a trailing stop / signal exit decided at the close of bar i only takes effect from bar i+1
//   * costs = bb-core's: taker 0.05% + 0.02% slippage on entry and on every exit, plus 0.005% per 4h bar for funding (charged both ways = pessimistic)
'use strict';
const fs = require('fs'), path = require('path');
const IV = 14400;
const SRC = [path.join(__dirname, 'data'), path.join(__dirname, '..', 'bb-core-v2', 'data'), path.join(__dirname, '..', 'bb-core', 'data-other-coins')];
const CORE5 = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const ALL = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'BTC', 'ETH', 'BNB', 'XRP', 'DOGE', 'LINK', 'LTC', 'AVAX'];

function load(coin) {
  for (const d of SRC) {
    const f = path.join(d, coin + '.json'); if (!fs.existsSync(f)) continue;
    const now = Date.now() / 1000;
    const rows = JSON.parse(fs.readFileSync(f, 'utf8')).filter((r) => r[0] + IV <= now);   // drop the still-forming candle
    return rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  }
  throw new Error('no data for ' + coin);
}

// ---------- indicators (all arrays aligned with B; value at i uses candles <= i only) ----------
const sma = (a, n) => { const o = new Array(a.length).fill(NaN); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; };
const ema = (a, n) => { const o = new Array(a.length).fill(NaN), k = 2 / (n + 1); let e = NaN; for (let i = 0; i < a.length; i++) { if (i === n - 1) { let s = 0; for (let j = 0; j < n; j++) s += a[j]; e = s / n; o[i] = e; } else if (i >= n) { e = a[i] * k + e * (1 - k); o[i] = e; } } return o; };
const wilder = (a, n) => { const o = new Array(a.length).fill(NaN); let e = NaN; for (let i = 0; i < a.length; i++) { if (i === n) { let s = 0; for (let j = 1; j <= n; j++) s += a[j]; e = s / n; o[i] = e; } else if (i > n) { e = (e * (n - 1) + a[i]) / n; o[i] = e; } } return o; };
const rollMax = (a, n) => a.map((_, i) => { if (i < n - 1) return NaN; let m = -Infinity; for (let j = i - n + 1; j <= i; j++) if (a[j] > m) m = a[j]; return m; });
const rollMin = (a, n) => a.map((_, i) => { if (i < n - 1) return NaN; let m = Infinity; for (let j = i - n + 1; j <= i; j++) if (a[j] < m) m = a[j]; return m; });
const rollSum = (a, n) => { const o = new Array(a.length).fill(NaN); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s; } return o; };

function base(B) {
  const H = B.map((b) => b.high), L = B.map((b) => b.low), C = B.map((b) => b.close);
  const tr = B.map((b, i) => (i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - B[i - 1].close), Math.abs(b.low - B[i - 1].close))));
  return { B, H, L, C, tr, atr: wilder(tr, 14), sma200: sma(C, 200) };
}

// ---------- signal families: each returns fn(i) -> +1 / -1 / 0 given the closed bar i ----------
const FAMILY = {
  // Donchian / Turtle: close beyond the highest high / lowest low of the previous N bars
  donchian: (X, { n }) => { const hi = rollMax(X.H, n), lo = rollMin(X.L, n); return (i) => (i < n + 1 ? 0 : X.C[i] > hi[i - 1] ? 1 : X.C[i] < lo[i - 1] ? -1 : 0); },

  // Ichimoku 9/26/52: the cloud drawn at bar i was computed at bar i-26 (shifted forward) = no look-ahead.
  // Entry = first close outside the cloud, tenkan on the right side of kijun, chikou span (close vs close 26 bars ago) clear.
  ichimoku: (X, { t = 9, k = 26, b = 52, full = true }) => {
    const mid = (n) => { const h = rollMax(X.H, n), l = rollMin(X.L, n); return h.map((v, i) => (v + l[i]) / 2); };
    const ten = mid(t), kij = mid(k), spB = mid(b), spA = ten.map((v, i) => (v + kij[i]) / 2);
    const top = (i) => Math.max(spA[i - k], spB[i - k]), bot = (i) => Math.min(spA[i - k], spB[i - k]);
    return (i) => {
      if (i < b + k + 1 || isNaN(spB[i - k]) || isNaN(spB[i - 1 - k])) return 0;
      const up = X.C[i] > top(i) && X.C[i - 1] <= top(i - 1), dn = X.C[i] < bot(i) && X.C[i - 1] >= bot(i - 1);
      if (up && (!full || (ten[i] > kij[i] && X.C[i] > X.C[i - k]))) return 1;
      if (dn && (!full || (ten[i] < kij[i] && X.C[i] < X.C[i - k]))) return -1;
      return 0;
    };
  },

  // Darvas box: a high that the next `conf` bars fail to exceed = box top (and it must itself be a `look`-bar high);
  // bottom = lowest low from that bar to confirmation. Long when a close breaks the top of a live box; short = mirrored (inverse box).
  darvas: (X, { conf = 3, look = 50, life = 60 }) => {
    const hi = rollMax(X.H, look), lo = rollMin(X.L, look);
    const sig = new Array(X.C.length).fill(0);
    let box = null, boxS = null;
    for (let i = look + conf + 1; i < X.C.length; i++) {
      const j = i - conf;                                           // candidate top bar, only confirmed now at bar i
      let mxA = -Infinity, mnB = Infinity, mnL = Infinity, mxH = -Infinity;
      for (let q = j + 1; q <= i; q++) { mxA = Math.max(mxA, X.H[q]); mnB = Math.min(mnB, X.L[q]); }
      for (let q = j; q <= i; q++) { mnL = Math.min(mnL, X.L[q]); mxH = Math.max(mxH, X.H[q]); }
      if (X.H[j] >= hi[j] && X.H[j] > mxA) box = { top: X.H[j], bot: mnL, born: i };
      if (X.L[j] <= lo[j] && X.L[j] < mnB) boxS = { bot: X.L[j], top: mxH, born: i };
      if (box && i - box.born > life) box = null;
      if (boxS && i - boxS.born > life) boxS = null;
      if (box && i > box.born && X.C[i] > box.top) { sig[i] = 1; box = null; }
      else if (boxS && i > boxS.born && X.C[i] < boxS.bot) { sig[i] = -1; boxS = null; }
      else if (box && X.C[i] < box.bot) box = null;               // box broke the wrong way -> discard
      else if (boxS && X.C[i] > boxS.top) boxS = null;
    }
    return (i) => sig[i];
  },

  // Vortex (VTX): VI+ = sum|H - prevL| / sum TR, VI- = sum|L - prevH| / sum TR. Signal = VI+ crosses above VI- (VI+ >= min), or mirrored.
  vortex: (X, { n = 14, min = 1.0 }) => {
    const vp = X.B.map((b, i) => (i ? Math.abs(b.high - X.B[i - 1].low) : 0)), vm = X.B.map((b, i) => (i ? Math.abs(b.low - X.B[i - 1].high) : 0));
    const sp = rollSum(vp, n), sm = rollSum(vm, n), st = rollSum(X.tr, n);
    const P = sp.map((v, i) => v / st[i]), M = sm.map((v, i) => v / st[i]);
    return (i) => (i < n + 2 ? 0 : P[i] > M[i] && P[i - 1] <= M[i - 1] && P[i] >= min ? 1 : M[i] > P[i] && M[i - 1] <= P[i - 1] && M[i] >= min ? -1 : 0);
  },

  // Supertrend(period, mult): a band flip = a trade
  supertrend: (X, { n = 10, m = 3 }) => {
    const atr = wilder(X.tr, n), sig = new Array(X.C.length).fill(0);
    let fu = NaN, fl = NaN, d = 1;
    for (let i = n + 1; i < X.C.length; i++) {
      const mid = (X.H[i] + X.L[i]) / 2, bu = mid + m * atr[i], bl = mid - m * atr[i];
      fu = isNaN(fu) || bu < fu || X.C[i - 1] > fu ? bu : fu;
      fl = isNaN(fl) || bl > fl || X.C[i - 1] < fl ? bl : fl;
      const nd = d === 1 && X.C[i] < fl ? -1 : d === -1 && X.C[i] > fu ? 1 : d;
      if (nd !== d && i > n + 1) sig[i] = nd;
      d = nd;
    }
    return (i) => sig[i];
  },

  // Keltner channel breakout: first close beyond EMA(n) +/- m x ATR(14)
  keltner: (X, { n = 20, m = 2 }) => {
    const e = ema(X.C, n);
    return (i) => (i < n + 15 ? 0 : X.C[i] > e[i] + m * X.atr[i] && X.C[i - 1] <= e[i - 1] + m * X.atr[i - 1] ? 1 : X.C[i] < e[i] - m * X.atr[i] && X.C[i - 1] >= e[i - 1] - m * X.atr[i - 1] ? -1 : 0);
  },

  // DMI/ADX: +DI crosses -DI while ADX >= min
  adx: (X, { n = 14, min = 25 }) => {
    const pdm = X.B.map((b, i) => (i && b.high - X.B[i - 1].high > X.B[i - 1].low - b.low && b.high - X.B[i - 1].high > 0 ? b.high - X.B[i - 1].high : 0));
    const mdm = X.B.map((b, i) => (i && X.B[i - 1].low - b.low > b.high - X.B[i - 1].high && X.B[i - 1].low - b.low > 0 ? X.B[i - 1].low - b.low : 0));
    const a = wilder(X.tr, n), P = wilder(pdm, n).map((v, i) => 100 * v / a[i]), M = wilder(mdm, n).map((v, i) => 100 * v / a[i]);
    const dx = P.map((v, i) => 100 * Math.abs(v - M[i]) / (v + M[i])), ax = new Array(dx.length).fill(NaN);
    let e = NaN; for (let i = 2 * n; i < dx.length; i++) { if (i === 2 * n) { let s = 0; for (let j = n + 1; j <= 2 * n; j++) s += dx[j]; e = s / n; } else e = (e * (n - 1) + dx[i]) / n; ax[i] = e; }
    return (i) => (i < 2 * n + 2 ? 0 : P[i] > M[i] && P[i - 1] <= M[i - 1] && ax[i] >= min ? 1 : M[i] > P[i] && M[i - 1] <= P[i - 1] && ax[i] >= min ? -1 : 0);
  },
};


// ---- added in round 3 ----
FAMILY.bbbreak = (X, { n = 20, m = 2 }) => { const mid = sma(X.C, n), sd = X.C.map((_, i) => { if (i < n - 1) return NaN; let q = 0; for (let j = i - n + 1; j <= i; j++) q += (X.C[j] - mid[i]) ** 2; return Math.sqrt(q / n); });
  return (i) => (i < n + 1 ? 0 : X.C[i] > mid[i] + m * sd[i] && X.C[i - 1] <= mid[i - 1] + m * sd[i - 1] ? 1 : X.C[i] < mid[i] - m * sd[i] && X.C[i - 1] >= mid[i - 1] - m * sd[i - 1] ? -1 : 0); };
FAMILY.emacross = (X, { f = 20, sl = 50 }) => { const a = ema(X.C, f), b = ema(X.C, sl); return (i) => (i < sl + 2 ? 0 : a[i] > b[i] && a[i - 1] <= b[i - 1] ? 1 : a[i] < b[i] && a[i - 1] >= b[i - 1] ? -1 : 0); };
FAMILY.macd = (X, { f = 12, sl = 26, sg = 9 }) => { const a = ema(X.C, f), b = ema(X.C, sl), mac = a.map((v, i) => v - b[i]); const sgl = new Array(mac.length).fill(NaN); const k = 2 / (sg + 1); let e = NaN; for (let i = sl + sg - 2; i < mac.length; i++) { e = isNaN(e) ? mac.slice(i - sg + 1, i + 1).reduce((x, y) => x + y, 0) / sg : mac[i] * k + e * (1 - k); sgl[i] = e; } const h = mac.map((v, i) => v - sgl[i]);
  return (i) => (i < sl + sg + 2 ? 0 : h[i] > 0 && h[i - 1] <= 0 ? 1 : h[i] < 0 && h[i - 1] >= 0 ? -1 : 0); };
// pullback continuation: trend (EMA50 vs SMA200 side) and RSI dips below lo then closes back above it (mirrored for shorts)
FAMILY.rsipull = (X, { lo = 40, n = 14 }) => { const g = X.C.map((c, i) => (i ? Math.max(c - X.C[i - 1], 0) : 0)), l = X.C.map((c, i) => (i ? Math.max(X.C[i - 1] - c, 0) : 0)); const ag = wilder(g, n), al = wilder(l, n), rsi = ag.map((v, i) => 100 - 100 / (1 + v / al[i])); const e50 = ema(X.C, 50);
  return (i) => (i < 210 ? 0 : X.C[i] > X.sma200[i] && e50[i] > X.sma200[i] && rsi[i] > lo && rsi[i - 1] <= lo ? 1 : X.C[i] < X.sma200[i] && e50[i] < X.sma200[i] && rsi[i] < 100 - lo && rsi[i - 1] >= 100 - lo ? -1 : 0); };
// ---------- trade simulation for one coin ----------
const COST = { fee: 0.0005, slip: 0.0002, fund: 0.00005 };
function run(B, X, family, p, ex = {}) {
  const { kInit = 3, kTrail = 3, trend = false, maxBars = 600, sideOnly = 0, exitOpp = true, targetR = 0 } = ex;
  const sig = FAMILY[family](X, p), trades = [];
  let pos = null;
  const n = B.length;
  for (let i = 1; i < n; i++) {
    // 1) manage the open position on bar i (its stop was set at an earlier close)
    if (pos && i >= pos.i0) {
      const b = B[i], long = pos.dir === 1;
      let px = null, why = null;
      if (pos.exitNext) { px = b.open; why = 'signal'; }
      else if (long ? b.low <= pos.stop : b.high >= pos.stop) { px = long ? Math.min(b.open, pos.stop) : Math.max(b.open, pos.stop); why = 'stop'; }
      else if (targetR && (long ? b.high >= pos.tp : b.low <= pos.tp)) { px = long ? Math.max(b.open, pos.tp) : Math.min(b.open, pos.tp); why = 'target'; }
      else if (i - pos.i0 >= maxBars) { px = b.close; why = 'time'; }
      if (px !== null) {
        const gross = pos.dir * (px - pos.entry) / pos.entry, c = (COST.fee + COST.slip) + (why === 'target' ? 0.0002 : COST.fee + COST.slip) + COST.fund * (i - pos.i0 + 1);
        trades.push({ dir: pos.dir, t: B[pos.i0].time, tExit: b.time + IV, R: (gross - c) / pos.risk, risk: pos.risk, why, bars: i - pos.i0 + 1, coin: ex.coin });
        pos = null;
      } else {
        // survived the bar: update the extreme, then (at this close) ratchet the trailing stop and read the exit signal for the NEXT bar
        pos.ext = long ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low);
        const a = X.atr[i], ns = long ? pos.ext - kTrail * a : pos.ext + kTrail * a;
        if (long ? ns > pos.stop : ns < pos.stop) pos.stop = ns;
        if (exitOpp && sig(i) === -pos.dir) pos.exitNext = true;
      }
    }
    // 2) a new signal on the closed bar i -> enter at the OPEN of bar i+1
    if (!pos && i + 1 < n && i >= 205) {
      const s = sig(i); if (!s) continue;
      if (sideOnly && s !== sideOnly) continue;
      if (trend && !(s === 1 ? X.C[i] > X.sma200[i] : X.C[i] < X.sma200[i])) continue;
      const a = X.atr[i]; if (!(a > 0)) continue;
      const entry = B[i + 1].open;
      pos = { dir: s, i0: i + 1, entry, stop: entry - s * kInit * a, risk: kInit * a / entry, ext: entry, exitNext: false, tp: entry + s * (targetR || 0) * kInit * a };
    }
  }
  return trades;
}

function yearly(trades) { const y = {}; for (const t of trades) { const k = new Date(t.tExit * 1000).getUTCFullYear(); y[k] = (y[k] || 0) + t.R; } return y; }
function maxDD(trades) { const t = [...trades].sort((a, b) => a.tExit - b.tExit); let e = 0, pk = 0, dd = 0; for (const x of t) { e += x.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); } return dd; }
module.exports = { load, base, run, yearly, maxDD, CORE5, ALL, FAMILY, COST };
