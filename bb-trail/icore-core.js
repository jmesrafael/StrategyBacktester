// icore-core.js (BB-TRAIL version) — the bb-trail P14 algorithm, standalone (no dependencies, no browser).
// The file keeps I-Core's name and API (backtest, signalAt, indicators, atrSeries, gapInWindow, stats, DEFAULTS, FREE, scaleCost) so the I-Core bot
// machinery around it (icore.js, journal, compare, dashboard push) runs unchanged. Only the strategy differs.
//
// RULES (4h chart, everything decided on a candle's CLOSE, filled at the NEXT candle's open)
//   Entry  = bb-core's entry, unchanged:
//            LONG  : close > upper Bollinger band (SMA 20 + 2 population SD of the closes)  AND  close > SMA(200)
//            SHORT : close < lower band                                                   AND  close < SMA(200)
//            and the close is at least 0.3 × ATR(14) away from the middle band (bb-core's "stop too tight" filter).
//   Stop   : entry ∓ kInit (2) × ATR(14) at the signal candle. That distance is 1R.
//   Trail  : after every candle that does not stop the trade: stop = best price since entry ∓ kTrail (14) × ATR(14). It only moves in the trade's favour,
//            and a new stop is live from the NEXT candle. No profit target, no Bollinger-middle stop, no 48-candle exit: a winner runs until the trail catches it.
//   Time   : safety exit after maxBars (1200) candles (the longest trade 2020-2026 was 835 candles).
//
// Research: StrategyBacktester/research/strat-hunt-nov6 (strategy "bb-trail", exit "P14", 4h): 613 trades 2020 → Nov 2026, +788R, win 21%, +1.29R a trade,
// worst drop 29.7R, longest losing streak 26, 7.7 trades a month. `node test/trail-parity.js` proves this file reproduces that engine trade for trade.
// Candle format: { time (unix sec), open, high, low, close }.
'use strict';

const DEFAULTS = {
  bbLen: 20, bbMult: 2, minStopAtr: 0.3, trendLen: 200, atrLen: 14, kInit: 2, kTrail: 14, maxBars: 1200, warmup: 205, interval: 14400, gapSkip: true,
  // the same flat cost model as I-Core's paper executor (the realistic paper executor in realpaper.js replaces it with real fees, book fills and funding)
  cost: { fee: 0.0005, slip: 0.0002, fund: 0.00005 },
};
const FREE = { fee: 0, slip: 0, fund: 0 };
const scaleCost = (c, k) => ({ fee: c.fee * k, slip: c.slip * k, fund: c.fund * k });

// Wilder ATR of the whole series (seed = mean of true ranges 1..atrLen), identical to I-Core's
function atrSeries(B, n = DEFAULTS.atrLen) {
  const out = new Array(B.length).fill(null);
  let e = null;
  for (let i = 1; i < B.length; i++) {
    if (i === n) { let s = 0; for (let j = 1; j <= n; j++) s += tr(B, j); e = s / n; out[i] = e; }
    else if (i > n) { e = (e * (n - 1) + tr(B, i)) / n; out[i] = e; }
  }
  return out;
}
const tr = (B, i) => Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close));

function gapInWindow(B, i, lookback, iv = DEFAULTS.interval) {
  for (let j = Math.max(1, i - lookback + 1); j <= i; j++) if (B[j].time - B[j - 1].time !== iv) return true;
  return false;
}

// Bollinger band + trend of the candle i (population SD, as bb-core)
function bandsAt(B, i, cfg = DEFAULTS) {
  if (i - cfg.bbLen + 1 < 0 || i - cfg.trendLen + 1 < 0) return null;
  let s = 0; for (let j = i - cfg.bbLen + 1; j <= i; j++) s += B[j].close;
  const mid = s / cfg.bbLen;
  let v = 0; for (let j = i - cfg.bbLen + 1; j <= i; j++) v += (B[j].close - mid) ** 2;
  const sd = Math.sqrt(v / cfg.bbLen);
  let t = 0; for (let j = i - cfg.trendLen + 1; j <= i; j++) t += B[j].close;
  return { mid, up: mid + cfg.bbMult * sd, lo: mid - cfg.bbMult * sd, sd, sma: t / cfg.trendLen };
}

// The entry rule, shared by the backtest and the bot. B = candles up to and including the just-closed candle (B.length-1). Returns +1 / -1 / 0.
// atr = ATR(14) of that candle (the bot passes it; when missing it is computed from B, which needs B to start at the same candle for an identical value).
function signalAt(B, userCfg = {}, atr = null) {
  const cfg = { ...DEFAULTS, ...userCfg }, i = B.length - 1;
  const b = bandsAt(B, i, cfg);
  if (!b) return 0;
  const a = atr != null ? atr : atrSeries(B)[i];
  if (!(a > 0)) return 0;
  const c = B[i].close;
  const dir = c > b.up && c > b.sma ? 1 : c < b.lo && c < b.sma ? -1 : 0;
  if (!dir) return 0;
  const dist = Math.abs(c - b.mid);
  return dist > 0 && dist >= cfg.minStopAtr * a ? dir : 0;
}

// the numbers behind a decision, for the journal (same formulas as signalAt)
function indicators(B, userCfg = {}, atr = null) {
  const cfg = { ...DEFAULTS, ...userCfg }, i = B.length - 1, b = bandsAt(B, i, cfg);
  if (!b) return null;
  const a = atr != null ? atr : atrSeries(B)[i], close = B[i].close, pct = (v) => (v == null || !isFinite(v) ? null : ((close - v) / v) * 100);
  return {
    close, bb_mid: b.mid, bb_upper: b.up, bb_lower: b.lo, bb_width_pct: (b.up - b.lo) / b.mid * 100, bb_pos: b.up > b.lo ? (close - b.lo) / (b.up - b.lo) : null,
    sma200: b.sma, atr14: a, atr_pct: a / close * 100, dist_mid_atr: a > 0 ? Math.abs(close - b.mid) / a : null,
    dist_upper_pct: pct(b.up), dist_lower_pct: pct(b.lo), dist_sma_pct: pct(b.sma),
    stop_atr: cfg.kInit, trail_atr: cfg.kTrail, nearest_threshold_pct: Math.min(Math.abs(pct(b.up)), Math.abs(pct(b.lo))),
  };
}

// Returns { trades, open, setup } exactly like I-Core's backtest(). R includes the flat costs of cfg.cost.
function backtest(B, userCfg = {}) {
  const cfg = { ...DEFAULTS, ...userCfg, cost: { ...DEFAULTS.cost, ...(userCfg.cost || {}) } };
  const cost = cfg.cost, n = B.length, trades = [], atr = atrSeries(B);
  let pos = null, pend = null;
  const sig = (i) => signalAt(B.slice(Math.max(0, i - Math.max(cfg.trendLen, cfg.bbLen) - 5), i + 1), cfg, atr[i]);
  for (let i = 1; i < n; i++) {
    const b = B[i];
    if (pend && pend.at === i) { const stop = b.open - pend.dir * cfg.kInit * pend.atr; pos = { dir: pend.dir, i0: i, entry: b.open, stop0: stop, stop, risk: cfg.kInit * pend.atr / b.open, ext: b.open, adv: b.open }; pend = null; }
    if (pos) {
      const long = pos.dir === 1;
      let px = null, why = null;
      if (long ? b.low <= pos.stop : b.high >= pos.stop) { px = long ? Math.min(b.open, pos.stop) : Math.max(b.open, pos.stop); why = 'stop'; }
      else if (cfg.maxBars > 0 && i - pos.i0 >= cfg.maxBars) { px = b.close; why = 'time'; }
      if (px !== null) {
        pos.adv = long ? Math.min(pos.adv, b.low) : Math.max(pos.adv, b.high);
        const gross = pos.dir * (px - pos.entry) / pos.entry, c = 2 * (cost.fee + cost.slip) + cost.fund * (i - pos.i0 + 1), oneR = pos.risk * pos.entry;
        trades.push({ dir: pos.dir, i0: pos.i0, i1: i, t: B[pos.i0].time, tExit: b.time + cfg.interval, entry: pos.entry, exit: px, stop0: pos.stop0, stop: pos.stop, R: (gross - c) / pos.risk, why, bars: i - pos.i0 + 1,
          mfeR: pos.dir * (pos.ext - pos.entry) / oneR, maeR: pos.dir * (pos.adv - pos.entry) / oneR });
        pos = null;
      } else {
        pos.ext = long ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low);
        pos.adv = long ? Math.min(pos.adv, b.low) : Math.max(pos.adv, b.high);
        const ns = pos.ext - pos.dir * cfg.kTrail * atr[i];
        if (long ? ns > pos.stop : ns < pos.stop) pos.stop = ns;
      }
    }
    if (!pos && i + 1 < n && i >= cfg.warmup && atr[i] > 0 && !(cfg.gapSkip && gapInWindow(B, i, cfg.trendLen, cfg.interval))) {
      const s = sig(i);
      if (s) pend = { dir: s, at: i + 1, atr: atr[i], sig: i };
    }
  }
  const open = pos ? { ...pos, bars: n - pos.i0 } : null, last = n - 1;
  const setup = last >= cfg.warmup && !pos && atr[last] > 0 && !(cfg.gapSkip && gapInWindow(B, last, cfg.trendLen, cfg.interval)) ? (() => { const s = sig(last); return s ? { dir: s, atr: atr[last], sigClose: B[last].close } : null; })() : null;
  return { trades, open, setup, cfg };
}

// ---- statistics (same as I-Core's) ----
function stats(trades, risk = 5) {
  const n = trades.length, usd = (t) => t.R * risk;
  let eq = 0, pk = 0, dd = 0, streak = 0, maxStreak = 0;
  for (const t of trades) { eq += usd(t); pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); if (t.R <= 0) maxStreak = Math.max(maxStreak, ++streak); else streak = 0; }
  const wins = trades.filter((t) => t.R > 0), gp = wins.reduce((a, t) => a + usd(t), 0), gl = -trades.filter((t) => t.R <= 0).reduce((a, t) => a + usd(t), 0);
  const years = {};
  for (const t of trades) { const y = new Date(t.tExit * 1000).getUTCFullYear(); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net += usd(t); }
  return { n, net: eq, avgR: n ? eq / risk / n : 0, winRate: n ? wins.length / n : 0, pf: gl ? gp / gl : Infinity, maxDD: dd, maxLossStreak: maxStreak, years };
}

const STRATEGY = 'bb-trail P14 (bb-core entry, 2 ATR stop, 14 ATR trail)';
const API = { backtest, signalAt, indicators, atrSeries, bandsAt, gapInWindow, stats, DEFAULTS, FREE, scaleCost, STRATEGY };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis.ICore = API;
