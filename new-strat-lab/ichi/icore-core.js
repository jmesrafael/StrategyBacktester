// icore-core.js (ICHI-X4 version) — the ICHI-X4 algorithm, standalone (no dependencies, no browser).
// The file keeps I-Core's name and API (backtest, signalAt, indicators, atrSeries, gapInWindow, stats, DEFAULTS, FREE, scaleCost) so the paper bot
// machinery around it (icore.js, journal, compare) runs unchanged. Only the strategy differs.
//
// RULES (4h chart, everything decided on a candle's CLOSE, filled at the NEXT candle's open) — frozen on Nov 26, 2026, do not tune them during the paper test
//   Lines  : tenkan = mid of the 9-candle high/low, kijun = mid of the 26-candle high/low.
//            cloud at candle i = senkou A / B taken from candle i-26 (A = mid of tenkan and kijun, B = mid of the 52-candle high/low). Only past candles.
//   LONG   : tenkan crosses above kijun on this close  AND  close above both cloud lines
//   SHORT  : tenkan crosses below kijun on this close  AND  close below both cloud lines
//   Filter : none (no long average, no minimum distance)
//   Stop   : entry ∓ 2 × ATR(14) of the signal candle. That distance is 1R. It never moves.
//   Time   : closed after maxBars (12) candles beyond the entry candle (about 2 days) if the stop was not hit. No new signal is taken on that candle.
//   Gaps   : no new signal if a candle is missing anywhere in the last trendLen (80) candles.
//
// Research: StrategyBacktester/research/hunt-4h-nov26 (candidate ICHI-X4), research/four-bot-nov26. `node test.js` in new-strat-lab proves this file takes
// the same entries as the research engine.
// Candle format: { time (unix sec), open, high, low, close }.
'use strict';

const DEFAULTS = {
  tenkan: 9, kijun: 26, senkou: 52, trendLen: 80, atrLen: 14, kInit: 2, kTrail: 0, lockAtR: 0, lockToR: 1, staleBars: 0, staleR: 1, maxBars: 12, warmup: 205, interval: 14400, gapSkip: true,
  // the same flat cost model as the bot's plain paper executor (the realistic paper executor in realpaper.js replaces it with real fees, book fills and funding)
  cost: { fee: 0.0005, slip: 0.0002, fund: 0.00005 },
};
const LEGACY = {};           // there are no older rules: every trade is judged by the rules above
const RULES_V3_FROM = 0;     // (name kept: icore.js asks which rule set a trade belongs to)
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

// mid of the highest high and lowest low of the n candles ending at i (null until n candles exist)
function mid(B, i, n) {
  if (i - n + 1 < 0) return null;
  let h = -Infinity, l = Infinity;
  for (let j = i - n + 1; j <= i; j++) { if (B[j].high > h) h = B[j].high; if (B[j].low < l) l = B[j].low; }
  return (h + l) / 2;
}
// the Ichimoku lines the decision on candle i uses
function linesAt(B, i, cfg = DEFAULTS) {
  const e = i - cfg.kijun;   // the cloud under candle i was built kijun candles ago
  if (i < 1 || e - cfg.senkou + 1 < 0) return null;
  const tk = mid(B, i, cfg.tenkan), kj = mid(B, i, cfg.kijun), tk1 = mid(B, i - 1, cfg.tenkan), kj1 = mid(B, i - 1, cfg.kijun);
  const a = (mid(B, e, cfg.tenkan) + mid(B, e, cfg.kijun)) / 2, b = mid(B, e, cfg.senkou);
  return { tk, kj, tk1, kj1, senkouA: a, senkouB: b, top: Math.max(a, b), bot: Math.min(a, b) };
}

// The entry rule, shared by the backtest and the bot. B = candles up to and including the just-closed candle (B.length-1). Returns +1 / -1 / 0.
function signalAt(B, userCfg = {}, atr = null) {
  const cfg = { ...DEFAULTS, ...userCfg }, i = B.length - 1, x = linesAt(B, i, cfg);
  if (!x) return 0;
  const a = atr != null ? atr : atrSeries(B)[i];
  if (!(a > 0)) return 0;
  const c = B[i].close;
  if (x.tk > x.kj && !(x.tk1 > x.kj1) && c > x.top) return 1;
  if (x.tk < x.kj && !(x.tk1 < x.kj1) && c < x.bot) return -1;
  return 0;
}

// the numbers behind a decision, for the journal (same formulas as signalAt)
function indicators(B, userCfg = {}, atr = null) {
  const cfg = { ...DEFAULTS, ...userCfg }, i = B.length - 1, x = linesAt(B, i, cfg);
  if (!x) return null;
  const a = atr != null ? atr : atrSeries(B)[i], close = B[i].close, pct = (v) => (v == null || !isFinite(v) ? null : ((close - v) / v) * 100);
  return {
    close, tenkan: x.tk, kijun: x.kj, tenkan_prev: x.tk1, kijun_prev: x.kj1, senkou_a: x.senkouA, senkou_b: x.senkouB, cloud_top: x.top, cloud_bottom: x.bot,
    atr14: a, atr_pct: a / close * 100, stop_atr: cfg.kInit, trail_atr: cfg.kTrail,
    nearest_threshold_pct: Math.min(Math.abs(pct(x.top)), Math.abs(pct(x.bot)), Math.abs((x.tk - x.kj) / x.kj * 100)),
  };
}

// Returns { trades, open, setup } exactly like I-Core's backtest(). R includes the flat costs of cfg.cost.
function backtest(B, userCfg = {}) {
  const cfg = { ...DEFAULTS, ...userCfg, cost: { ...DEFAULTS.cost, ...(userCfg.cost || {}) } };
  const cost = cfg.cost, n = B.length, trades = [], atr = atrSeries(B), span = cfg.kijun + cfg.senkou + 5;
  let pos = null, pend = null;
  const sig = (i) => signalAt(B.slice(Math.max(0, i - span), i + 1), cfg, atr[i]);
  for (let i = 1; i < n; i++) {
    const b = B[i];
    let timed = false;
    if (pend && pend.at === i) { const stop = b.open - pend.dir * cfg.kInit * pend.atr; pos = { dir: pend.dir, i0: i, entry: b.open, stop0: stop, stop, risk: cfg.kInit * pend.atr / b.open, ext: b.open, adv: b.open }; pend = null; }
    if (pos) {
      const long = pos.dir === 1;
      let px = null, why = null;
      if (long ? b.low <= pos.stop : b.high >= pos.stop) { px = long ? Math.min(b.open, pos.stop) : Math.max(b.open, pos.stop); why = 'stop'; }
      else if (cfg.maxBars > 0 && i - pos.i0 >= cfg.maxBars) { px = b.close; why = 'time'; }
      if (px !== null) {
        if (why !== 'stop') { pos.ext = long ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low); timed = true; }
        pos.adv = long ? Math.min(pos.adv, b.low) : Math.max(pos.adv, b.high);
        const gross = pos.dir * (px - pos.entry) / pos.entry, c = 2 * (cost.fee + cost.slip) + cost.fund * (i - pos.i0 + 1), oneR = pos.risk * pos.entry;
        trades.push({ dir: pos.dir, i0: pos.i0, i1: i, t: B[pos.i0].time, tExit: b.time + cfg.interval, entry: pos.entry, exit: px, stop0: pos.stop0, stop: pos.stop, R: (gross - c) / pos.risk, why, bars: i - pos.i0 + 1,
          mfeR: pos.dir * (pos.ext - pos.entry) / oneR, maeR: pos.dir * (pos.adv - pos.entry) / oneR });
        pos = null;
      } else {
        pos.ext = long ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low);
        pos.adv = long ? Math.min(pos.adv, b.low) : Math.max(pos.adv, b.high);
      }
    }
    // a stop frees the coin for a signal on the same candle; the time exit does not (as the bot, and as the research engine)
    if (!pos && !timed && i + 1 < n && i >= cfg.warmup && atr[i] > 0 && !(cfg.gapSkip && gapInWindow(B, i, cfg.trendLen, cfg.interval))) {
      const s = sig(i);
      if (s) pend = { dir: s, at: i + 1, atr: atr[i], sig: i };
    }
  }
  const open = pos ? { ...pos, bars: n - pos.i0 } : null, last = n - 1;
  const setup = last >= cfg.warmup && !pos && atr[last] > 0 && !(cfg.gapSkip && gapInWindow(B, last, cfg.trendLen, cfg.interval)) ? (() => { const s = sig(last); return s ? { dir: s, atr: atr[last], sigClose: B[last].close } : null; })() : null;
  return { trades, open, setup, cfg };
}
const backtestLiveRules = (B, userCfg = {}) => backtest(B, userCfg);

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

const STRATEGY = 'ICHI-X4 (9/26/52 Ichimoku cross with the close outside the cloud, 2 ATR stop, out after 12 candles of 4h)';
const API = { backtest, backtestLiveRules, signalAt, indicators, atrSeries, linesAt, gapInWindow, stats, DEFAULTS, LEGACY, RULES_V3_FROM, FREE, scaleCost, STRATEGY };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis.ICore = API;
