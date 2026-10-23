// lucidio-core.js — the Lucid'io algorithm, standalone (no dependencies, no browser).
//
// One function, `backtest(candles, cfg)`, is the whole strategy. It walks the candles one at a time and only ever looks at
// candles that have already CLOSED, so the same loop is safe to use for a live bot (feed it closed candles, act on `setup`).
//
// RULES (4h chart, everything decided on a candle's CLOSE, filled at the NEXT candle's open)
//   Entry  LONG  : close > upper Bollinger(20, 2σ)  AND  close > SMA(200)
//          SHORT : close < lower Bollinger(20, 2σ)  AND  close < SMA(200)
//   Stop   : the Bollinger middle band (the 20-SMA) at the signal close
//   Target : entry ± 4 × (distance from signal close to the stop)        -> 1:4 risk/reward
//   Time   : still open after 48 candles (8 days) -> close at the next open
//   Filter : skip the signal if the stop is closer than 0.3 × ATR(14) (too tight, the stop would be noise)
//   Size   : risk a fixed amount (R) per trade — e.g. $5. One position at a time per coin.
//
// Candle format: { time (unix sec), open, high, low, close }.  Funding: [[time_sec, rate], ...] (optional).
'use strict';

const DEFAULTS = {
  bbLen: 20, bbMult: 2, trendLen: 200, targetR: 4, maxBars: 48, minStopAtr: 0.3, atrLen: 14, warmup: 202,
  // execution costs as fractions of price. Defaults = the "REAL" live-bot assumptions used in the research
  // (taker entry/stop/time exits, maker target that must be traded THROUGH by tpBuf, plus real funding if provided).
  cost: { entryFee: 0.0005, stopFee: 0.0005, timeFee: 0.0005, tpFee: 0.0002, slip: 0.0002, tpSlip: 0, tpBuf: 0.0005 },
};
const FREE = { entryFee: 0, stopFee: 0, timeFee: 0, tpFee: 0, slip: 0, tpSlip: 0, tpBuf: 0 }; // frictionless, for sanity checks
const scaleCost = (c, k) => ({ ...c, entryFee: c.entryFee * k, stopFee: c.stopFee * k, timeFee: c.timeFee * k, tpFee: c.tpFee * k, slip: c.slip * k });

// Returns { trades, open, setup }
//   trades : closed trades { dir, i0, i1, t, tExit, entry, exit, stop, tp, R, why: 'stop'|'target'|'time'|'end', bars, fundR }
//   open   : the position still open on the last candle (or null)
//   setup  : a signal on the LAST candle -> enter at the next open (or null)   <- this is what a live bot acts on
// R = result in units of the amount risked (1R = the stop distance). Fees, slippage and funding are included in R.
function backtest(B, userCfg = {}, funding = null) {
  const cfg = { ...DEFAULTS, ...userCfg, cost: { ...DEFAULTS.cost, ...(userCfg.cost || {}) } };
  const cost = cfg.cost, n = B.length, trades = [];
  const closes = [], trs = [];
  let atr = null, pos = null, pend = null, pendClose = false;

  for (let i = 0; i < n; i++) {
    const c = B[i];

    // 1) fills decided at the previous close happen at THIS candle's open
    if (pend) {
      const d = pend.dir, fill = c.open * (1 + d * cost.slip), dist = Math.abs(fill - pend.stop) / fill;
      if (dist > 0 && (d === 1 ? pend.stop < fill : pend.stop > fill)) pos = { ...pend, entry: fill, i0: i, dist };
      pend = null;
    }
    if (pendClose && pos) exit(c.open * (1 - pos.dir * cost.slip), i, cost.timeFee, 'time');
    pendClose = false;

    // 2) manage the open position inside this candle: stop first (if both are touched we assume the worst), gaps fill at the open
    if (pos) {
      const d = pos.dir;
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop)
        exit((d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * cost.slip), i, cost.stopFee, 'stop');
      else if (d === 1 ? c.high >= pos.tp * (1 + cost.tpBuf) : c.low <= pos.tp * (1 - cost.tpBuf))
        exit((d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open)) * (1 - d * cost.tpSlip), i, cost.tpFee, 'target');
    }

    // 3) the candle has now CLOSED: indicators see this candle and nothing later
    closes.push(c.close);
    trs.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - B[i - 1].close), Math.abs(c.low - B[i - 1].close)));
    if (i === cfg.atrLen - 1) atr = trs.slice(0, cfg.atrLen).reduce((a, b) => a + b, 0) / cfg.atrLen; // Wilder ATR
    else if (i >= cfg.atrLen) atr = (atr * (cfg.atrLen - 1) + trs[i]) / cfg.atrLen;

    if (pos) { if (cfg.maxBars > 0 && i - pos.i0 >= cfg.maxBars) pendClose = true; continue; }
    if (i < cfg.warmup) continue;

    // 4) look for a signal (only while flat)
    const s = signalFrom(i + 1 < n ? closes.concat([B[i + 1].close]) : closes, atr, cfg); /* PLANTED LOOK-AHEAD */
    if (s) pend = { ...s, sig: i };
  }

  const open = pos ? { ...pos, bars: n - 1 - pos.i0, exitNext: pendClose } : null;
  return { trades, open, setup: pend, cfg };

  function exit(px, i, fee, why) {
    let fr = 0; // funding paid (+) / received (−) for every 8h funding event the trade was open through
    if (funding) { const te = B[pos.i0].time, tx = B[i].time + 7200; for (const [t, r] of funding) { if (t > tx) break; if (t > te) fr += r; } }
    const R = (pos.dir * (px - pos.entry) / pos.entry - cost.entryFee - fee - pos.dir * fr) / pos.dist;
    trades.push({ dir: pos.dir, i0: pos.i0, i1: i, t: B[pos.i0].time, tExit: B[i].time + 14400, entry: pos.entry, exit: px, stop: pos.stop, tp: pos.tp,
      R, why, bars: i - pos.i0 + 1, fundR: -pos.dir * fr / pos.dist });
    pos = null;
  }
}

// The entry rule, shared by the backtest and the live bot (one source of truth).
// closes = closes up to and including the just-closed candle, atr = ATR(14) at that candle.
// Returns { dir, stop, tp, sigClose } or null.
function signalFrom(closes, atr, userCfg = {}) {
  const cfg = { ...DEFAULTS, ...userCfg };
  const n = closes.length, close = closes[n - 1];
  if (n < Math.max(cfg.bbLen, cfg.trendLen) || atr == null) return null;
  const w = closes.slice(-cfg.bbLen), mid = w.reduce((a, b) => a + b, 0) / cfg.bbLen;
  const sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / cfg.bbLen);
  const up = mid + cfg.bbMult * sd, lo = mid - cfg.bbMult * sd;
  const dir = close > up ? 1 : close < lo ? -1 : 0;
  if (!dir) return null;
  if (cfg.trendLen > 0) {
    const sma = closes.slice(-cfg.trendLen).reduce((a, b) => a + b, 0) / cfg.trendLen;
    if (dir === 1 ? close < sma : close > sma) return null;            // only trade WITH the 200 SMA
  }
  const dist = Math.abs(close - mid);
  if (!(dist > 0) || dist < cfg.minStopAtr * atr) return null;         // stop too tight
  return { dir, stop: mid, tp: close + dir * cfg.targetR * dist, sigClose: close };
}

// ---- statistics ---------------------------------------------------------------------------------------------------
// trades must be in exit order. risk = $ risked per trade. Returns totals + max drawdown + yearly breakdown (by exit year).
function stats(trades, risk = 5) {
  const n = trades.length;
  const usd = (t) => t.R * risk;
  let eq = 0, pk = 0, dd = 0, streak = 0, maxStreak = 0;
  for (const t of trades) { eq += usd(t); pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); if (t.R <= 0) maxStreak = Math.max(maxStreak, ++streak); else streak = 0; }
  const wins = trades.filter((t) => t.R > 0), gp = wins.reduce((a, t) => a + usd(t), 0), gl = -trades.filter((t) => t.R <= 0).reduce((a, t) => a + usd(t), 0);
  const years = {};
  for (const t of trades) { const y = new Date(t.tExit * 1000).getUTCFullYear(); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net += usd(t); }
  return { n, net: eq, avgR: n ? eq / risk / n : 0, winRate: n ? wins.length / n : 0, pf: gl ? gp / gl : Infinity, maxDD: dd, maxLossStreak: maxStreak,
    byWhy: ['target', 'stop', 'time', 'end'].map((w) => [w, trades.filter((t) => t.why === w).length]), years };
}

const API = { backtest, signalFrom, stats, DEFAULTS, FREE, scaleCost };
if (typeof module !== 'undefined' && module.exports) module.exports = API; // Node (backtest.js, bot.js)
else globalThis.BBCore = API;                                               // browser (viewer.html loads this same file)
