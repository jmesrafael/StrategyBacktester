// matrend-core.js — the MA Trend algorithm, standalone (no dependencies, no browser). Same shape as icore-core.js: one function, backtest(candles, cfg).
//
// Research: research/indicator-top10/ (REPORT.md, REPORT-7COINS.md). The same logic runs in the chart replay as strategies/ma-trend-strategy.js;
// research/indicator-top10/replay-check.js proves the two give the same trades.
//
// RULES (4h chart, everything decided on a candle's CLOSE, filled at the NEXT candle's open; only closed candles are ever used)
//   Entry LONG : close crosses ABOVE the MA(maLen) (previous close <= previous MA) AND close > SMA(trendLen).   SHORT mirror when long-only is off.
//   MA types   : 1 SMA, 2 EMA, 3 WMA, 4 VWMA, 5 SMMA, 6 HMA, 7 DEMA, 8 TEMA, 9 KAMA, 10 ALMA — all streaming (value at bar i uses bars 0..i only).
//   Stop       : the signal close -/+ kInit x ATR(14); the fill is at the next open, so 1R = |fill - stop|.
//   Trail      : after every candle that does not stop the trade: stop = best price since entry -/+ kTrail x ATR(14), only in the trade's favour,
//                live from the NEXT candle. No profit target.
//   Time       : safety exit after maxBars candles in the trade, filled at the next open.
//   Skip       : a signal while a candle is missing in the last 200 candles.
//   Size       : risk a fixed amount (R) per trade. One position at a time per coin.
// Candle format: { time, open, high, low, close, volume? }. Costs as I-Core: taker fee + slippage on entry and every exit, funding per candle held.
(function () {
'use strict';
const NAN = NaN, isn = Number.isNaN;
const DEFAULTS = {
  maKind: 1, maLen: 200, trendLen: 200, kInit: 2, kTrail: 14, maxBars: 600, longOnly: 1, atrLen: 14, warmup: 205, interval: 14400, gapLen: 200,
  cost: { fee: 0.0005, slip: 0.0002, fund: 0.00005 },
};
const FREE = { fee: 0, slip: 0, fund: 0 };
const KINDS = ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'HMA', 'DEMA', 'TEMA', 'KAMA', 'ALMA'];

// ---- streaming moving averages: push(close, volume) -> value at the bar just pushed (NaN until warmed up) ------------------------------------
const Win = (n) => ({ a: [], push(x) { this.a.push(x); if (this.a.length > n) this.a.shift(); return this.a.length === n; } });
const mkSMA = (n) => { const w = Win(n); return { push(x) { return w.push(x) ? w.a.reduce((s, v) => s + v, 0) / n : NAN; } }; };
const mkWMA = (n) => { const w = Win(n), d = n * (n + 1) / 2; return { push(x) { if (!w.push(x)) return NAN; let s = 0; for (let k = 0; k < n; k++) s += w.a[n - 1 - k] * (n - k); return s / d; } }; };
const mkVWMA = (n) => { const w = Win(n), v = Win(n); return { push(x, vol) { const a = w.push(x); v.push(vol); if (!a) return NAN; let p = 0, q = 0; for (let k = 0; k < n; k++) { p += w.a[k] * v.a[k]; q += v.a[k]; } return q ? p / q : NAN; } }; };
const mkALMA = (n, off = 0.85, sg = 6) => { const w = Win(n), m = off * (n - 1), s = n / sg, ws = []; let nm = 0; for (let k = 0; k < n; k++) { const e = Math.exp(-((k - m) ** 2) / (2 * s * s)); ws.push(e); nm += e; } return { push(x) { if (!w.push(x)) return NAN; let a = 0; for (let k = 0; k < n; k++) a += w.a[k] * ws[k]; return a / nm; } }; };
const mkEMA = (n) => { const k = 2 / (n + 1); let cnt = 0, sum = 0, v = NAN; return { push(x) { if (isn(x)) return NAN; cnt++; if (cnt < n) { sum += x; return NAN; } if (cnt === n) { sum += x; v = sum / n; return v; } v = x * k + v * (1 - k); return v; } }; };
const mkSMMA = (n) => { let cnt = 0, sum = 0, v = NAN; return { push(x) { if (isn(x)) return NAN; cnt++; if (cnt < n) { sum += x; return NAN; } if (cnt === n) { sum += x; v = sum / n; return v; } v = (v * (n - 1) + x) / n; return v; } }; };
const mkDEMA = (n) => { const e1 = mkEMA(n), e2 = mkEMA(n); return { push(x) { const a = e1.push(x), b = e2.push(a); return 2 * a - b; } }; };
const mkTEMA = (n) => { const e1 = mkEMA(n), e2 = mkEMA(n), e3 = mkEMA(n); return { push(x) { const a = e1.push(x), b = e2.push(a), c = e3.push(b); return 3 * a - 3 * b + c; } }; };
const mkKAMA = (n) => { const w = Win(n + 1), fs = 2 / 3, ss = 2 / 31; let v = NAN; return { push(x) { if (!w.push(x)) return NAN; const a = w.a; let vol = 0; for (let k = 1; k <= n; k++) vol += Math.abs(a[k] - a[k - 1]); const er = vol ? Math.abs(a[n] - a[0]) / vol : 0, sc = (er * (fs - ss) + ss) ** 2, prev = isn(v) ? a[n - 1] : v; v = prev + sc * (x - prev); return v; } }; };
const mkHMA = (n) => { const h = Math.max(1, Math.round(n / 2)), r = Math.max(1, Math.round(Math.sqrt(n))), a = mkWMA(h), b = mkWMA(n), c = mkWMA(r); return { push(x) { const p = a.push(x), q = b.push(x); if (isn(p) || isn(q)) return NAN; return c.push(2 * p - q); } }; };
const MAKE = [mkSMA, mkEMA, mkWMA, mkVWMA, mkSMMA, mkHMA, mkDEMA, mkTEMA, mkKAMA, mkALMA];

// Wilder ATR (seed = mean of true ranges 1..atrLen, candle 0 has no previous close and is not in the seed) — same as icore-core.js
function atrSeries(B, n = DEFAULTS.atrLen) {
  const o = new Array(B.length).fill(null); if (B.length <= n) return o;
  const tr = (i) => Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close));
  let a = 0; for (let i = 1; i <= n; i++) a += tr(i); a /= n; o[n] = a;
  for (let i = n + 1; i < B.length; i++) { a = (a * (n - 1) + tr(i)) / n; o[i] = a; }
  return o;
}

// Returns { trades, open, setup }
//   trades : closed trades { dir, i0, i1, t, tExit, entry, exit, stop0, stop, R, why: 'stop'|'time', bars }
//   open   : the position still open on the last candle (or null)
//   setup  : a signal on the LAST candle -> enter at the next open (or null)
function backtest(B, userCfg = {}) {
  const cfg = { ...DEFAULTS, ...userCfg, cost: { ...DEFAULTS.cost, ...(userCfg.cost || {}) } }, cost = cfg.cost, n = B.length;
  const kind = Math.min(10, Math.max(1, Math.round(cfg.maKind))) - 1, make = MAKE[kind];
  const slow = make(cfg.maLen), trend = cfg.trendLen > 0 ? mkSMA(cfg.trendLen) : null, atr = atrSeries(B, cfg.atrLen);
  const trades = []; let pos = null, pend = null, pc = NAN, pm = NAN, lastHole = -1e9, setup = null;
  for (let i = 0; i < n; i++) {
    const b = B[i];
    if (i > 0 && b.time - B[i - 1].time !== cfg.interval) lastHole = i;
    // streaming indicators for the bar that has just CLOSED (used at its close only)
    const m = slow.push(b.close, b.volume || 1), t200 = trend ? trend.push(b.close) : NAN, a = b.close;
    if (i === 0) { pc = a; pm = m; continue; }
    // 1) the order decided at the previous close fills at THIS candle's open; 1R = |fill - stop|, the stop comes from the signal close
    if (pend && pend.at === i) { const st = pend.stop; pos = { dir: pend.dir, i0: i, entry: b.open, stop0: st, stop: st, risk: Math.abs(b.open - st) / b.open, ext: b.open, exitNext: false }; pend = null; }
    // 2) manage the open position
    if (pos) {
      const long = pos.dir === 1; let px = null, why = null;
      if (pos.exitNext) { px = b.open; why = 'time'; }
      else if (long ? b.low <= pos.stop : b.high >= pos.stop) { px = long ? Math.min(b.open, pos.stop) : Math.max(b.open, pos.stop); why = 'stop'; }
      if (px !== null) {
        const gross = pos.dir * (px - pos.entry) / pos.entry, c = 2 * (cost.fee + cost.slip) + cost.fund * (i - pos.i0 + 1);
        trades.push({ dir: pos.dir, i0: pos.i0, i1: i, t: B[pos.i0].time, tExit: b.time + cfg.interval, entry: pos.entry, exit: px, stop0: pos.stop0, stop: pos.stop, R: (gross - c) / pos.risk, why, bars: i - pos.i0 + 1 });
        pos = null;
      } else {
        if (cfg.maxBars > 0 && i - pos.i0 >= cfg.maxBars) pos.exitNext = true;
        pos.ext = long ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low);
        const ns = pos.ext - pos.dir * cfg.kTrail * atr[i];
        if (long ? ns > pos.stop : ns < pos.stop) pos.stop = ns;
      }
    }
    // 3) flat and the candle has CLOSED: a cross of the close through the MA, with the trend (enter at the next open)
    let sig = 0;
    if (!pos && !isn(m) && !isn(pm) && atr[i] > 0 && i >= cfg.warmup && i - lastHole >= cfg.gapLen) {
      if (a > m && pc <= pm) sig = 1; else if (a < m && pc >= pm) sig = -1;
      if (sig === -1 && cfg.longOnly) sig = 0;
      if (sig && cfg.trendLen > 0 && (isn(t200) || (sig === 1 ? a <= t200 : a >= t200))) sig = 0;
    }
    if (sig && i + 1 < n) pend = { dir: sig, at: i + 1, stop: a - sig * cfg.kInit * atr[i] };
    if (i === n - 1) setup = sig ? { dir: sig, atr: atr[i], stop: a - sig * cfg.kInit * atr[i] } : null;
    pc = a; pm = m;
  }
  const open = pos ? { ...pos, bars: n - pos.i0 } : null;
  return { trades, open, setup, cfg };
}

const API = { backtest, atrSeries, DEFAULTS, FREE, KINDS };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis.MATrend = API;
})();
