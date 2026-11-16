// engines/backtest/strategies.js - strategy definitions for the unified engine.
// The three live bots are defined here in both rule sets: "v3" (from the signal candle of Nov 14 2026 00:00 UTC) and
// "legacy" (before). test/backtest-parity.test.js proves each one reproduces the bot's own backtest trade for trade.
// A new idea is added the same way: an object with a signal(ctx, i) function and exit settings.
'use strict';
const E = require('./engine');
const RULES_V3_FROM = Date.UTC(2026, 10, 14, 0) / 1000;

// BB-CORE: close beyond the Bollinger band, with the 200 average; stop = the middle band; time exit at the next open.
function bbcore(v = {}) {
  const c = { bbLen: 20, bbMult: 1.8, trendLen: 200, maxBars: 42, coolBars: 3, minStopAtr: 0.3, ...v };
  return { name: 'bbcore', params: c, interval: 14400, atr: 'A', atrLen: 14, warmup: 202, gapLookback: Math.max(c.bbLen, c.trendLen), stopMode: 'level', timeExit: 'nextOpen', maxBars: c.maxBars, coolBars: c.coolBars, kTrail: 0,
    signal(ctx, i) {
      if (i + 1 < Math.max(c.bbLen, c.trendLen)) return null;
      const b = E.bands(ctx.B, i, c.bbLen, c.bbMult, c.trendLen), close = ctx.B[i].close, dir = close > b.up ? 1 : close < b.lo ? -1 : 0;
      if (!dir) return null;
      if (c.trendLen > 0 && (dir === 1 ? close < b.sma : close > b.sma)) return null;
      const dist = Math.abs(close - b.mid);
      return !(dist > 0) || dist < c.minStopAtr * ctx.atr[i] ? null : { dir, stop: b.mid };
    } };
}
// T-CORE: the same entry (Bollinger length 30), stop 2 ATR, trail 14 ATR, out if under +1R after 48 candles.
function tcore(v = {}) {
  const c = { bbLen: 30, bbMult: 2, minStopAtr: 0.3, trendLen: 200, kInit: 2, kTrail: 14, lockAtR: 0, lockToR: 1, staleBars: 48, staleR: 1, maxBars: 1200, ...v };
  return { name: 'tcore', params: c, interval: 14400, atr: 'B', atrLen: 14, warmup: 205, gapLookback: c.trendLen, stopMode: 'atr', timeExit: 'close', kInit: c.kInit, kTrail: c.kTrail, lockAtR: c.lockAtR, lockToR: c.lockToR, staleBars: c.staleBars, staleR: c.staleR, maxBars: c.maxBars,
    signal(ctx, i) {
      if (i + 1 >= ctx.B.length) return null;
      const b = E.bands(ctx.B, i, c.bbLen, c.bbMult, c.trendLen); if (!b) return null;
      const close = ctx.B[i].close, dir = close > b.up && close > b.sma ? 1 : close < b.lo && close < b.sma ? -1 : 0; if (!dir) return null;
      const dist = Math.abs(close - b.mid);
      return dist > 0 && dist >= c.minStopAtr * ctx.atr[i] ? { dir } : null;
    } };
}
// I-CORE: Ichimoku cloud break with the 200 average, stop 1.75 ATR, trail 7 ATR, profit lock at +4R.
function icore(v = {}) {
  const c = { tenkan: 9, kijun: 26, senkouB: 52, trendLen: 200, kInit: 1.75, kTrail: 7, lockAtR: 4, lockToR: 1, staleBars: 0, staleR: 1, maxBars: 600, ...v };
  const cloud = (B, i) => { const e = i - c.kijun, a = (E.hlMid(B, e, c.tenkan) + E.hlMid(B, e, c.kijun)) / 2, b = E.hlMid(B, e, c.senkouB); return { top: Math.max(a, b), bot: Math.min(a, b) }; };
  return { name: 'icore', params: c, interval: 14400, atr: 'B', atrLen: 14, warmup: 205, gapLookback: c.trendLen, stopMode: 'atr', timeExit: 'close', maxBarsAlways: true, kInit: c.kInit, kTrail: c.kTrail, lockAtR: c.lockAtR, lockToR: c.lockToR, staleBars: c.staleBars, staleR: c.staleR, maxBars: c.maxBars,
    signal(ctx, i) {
      const B = ctx.B; if (i + 1 >= B.length || i < c.senkouB + c.kijun + 1) return null;
      const k = cloud(B, i), p = cloud(B, i - 1), sma = E.smaClose(B, i, c.trendLen);
      if (isNaN(k.top) || isNaN(p.top) || isNaN(sma)) return null;
      if (B[i].close > k.top && B[i - 1].close <= p.top && B[i].close > sma) return { dir: 1 };
      if (B[i].close < k.bot && B[i - 1].close >= p.bot && B[i].close < sma) return { dir: -1 };
      return null;
    } };
}
const LEGACY = { bbcore: { bbMult: 2, maxBars: 48, coolBars: 0 }, icore: { kInit: 2, lockAtR: 0, staleBars: 0 }, tcore: { bbLen: 20, lockAtR: 0, staleBars: 0 } };
const MAKE = { bbcore, icore, tcore };
// version: 'v3' (current rules) or 'legacy'
const bot = (name, version = 'v3', extra = {}) => MAKE[name]({ ...(version === 'legacy' ? LEGACY[name] : {}), ...extra });
// the backtest as the live bot ran it across the rules change: signals before RULES_V3_FROM by the legacy rules, later ones by v3
function liveRules(name, B, cost) {
  const old = E.run(B, bot(name, 'legacy'), cost), now = E.run(B, bot(name, 'v3'), cost);
  const trades = old.trades.filter((t) => t.sigT < RULES_V3_FROM).concat(now.trades.filter((t) => t.sigT >= RULES_V3_FROM)).sort((a, b) => a.tExit - b.tExit || a.t - b.t);
  const open = now.open && now.open.sigT >= RULES_V3_FROM ? now.open : old.open && old.open.sigT < RULES_V3_FROM ? old.open : null;
  return { trades, open, setup: now.setup };
}

// ---- simple reference ideas used to test the validator (both are in the tested-strategies registry as rejected) ----
// Bollinger fade: buy a close below the lower band, sell a close above the upper band, stop 2 ATR, exit after 12 candles.
function bbFade(v = {}) {
  const c = { bbLen: 20, bbMult: 2, kInit: 2, maxBars: 12, ...v };
  return { name: 'bb-fade', params: c, interval: 14400, atr: 'B', atrLen: 14, warmup: 205, gapLookback: 200, stopMode: 'atr', timeExit: 'close', kInit: c.kInit, kTrail: 0, maxBars: c.maxBars,
    signal(ctx, i) { if (i + 1 >= ctx.B.length) return null; const b = E.bands(ctx.B, i, c.bbLen, c.bbMult, 0); if (!b) return null; const cl = ctx.B[i].close; return cl < b.lo ? { dir: 1 } : cl > b.up ? { dir: -1 } : null; } };
}
// RSI(2) mean reversion with the 200 average: long when RSI(2) < 10 above the average, short when > 90 below it.
function rsi2(v = {}) {
  const c = { len: 2, lo: 10, hi: 90, trendLen: 200, kInit: 2, maxBars: 6, ...v };
  return { name: 'rsi2', params: c, interval: 14400, atr: 'B', atrLen: 14, warmup: 205, gapLookback: 200, stopMode: 'atr', timeExit: 'close', kInit: c.kInit, kTrail: 0, maxBars: c.maxBars,
    prepare(ctx) { const B = ctx.B, r = new Array(B.length).fill(null); let g = 0, l = 0;
      for (let i = 1; i < B.length; i++) { const d = B[i].close - B[i - 1].close, up = Math.max(d, 0), dn = Math.max(-d, 0); if (i <= c.len) { g += up / c.len; l += dn / c.len; } else { g = (g * (c.len - 1) + up) / c.len; l = (l * (c.len - 1) + dn) / c.len; } if (i >= c.len) r[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
      ctx.rsi = r; },
    signal(ctx, i) { if (i + 1 >= ctx.B.length) return null; const sma = E.smaClose(ctx.B, i, c.trendLen), r = ctx.rsi[i], cl = ctx.B[i].close; if (isNaN(sma) || r == null) return null; return r < c.lo && cl > sma ? { dir: 1 } : r > c.hi && cl < sma ? { dir: -1 } : null; } };
}
module.exports = { bbcore, icore, tcore, bot, liveRules, bbFade, rsi2, LEGACY, RULES_V3_FROM, MAKE };
