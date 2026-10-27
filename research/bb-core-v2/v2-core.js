// v2-core.js — RESEARCH FORK of bb-core/lucidio-core.js. bb-core itself is untouched; this file is a copy with opt-in extras.
//
// With every v2 option at its default this engine must give the SAME trades as bb-core (node verify-parity.js proves it, trade for trade).
// Signal rule, stop, 4R target, 48-bar time exit, ATR/gap filters and the cost model are copied unchanged.
//
// v2 options (all off by default):
//   BREAK-EVEN   beAtR: once price has run beAtR × R in favour (R = entry→stop distance), move the stop to entry (+ beOffset as a fraction
//                of price, to pay the exit fee). Effective from the NEXT candle (we cannot know the order of high/low inside a candle, so
//                the original stop stays live in the trigger candle: pessimistic). Exits at the moved stop are labelled 'be'.
//                trailMid: after break-even, ratchet the stop to the 20-SMA each candle close (only in the trade's favour) -> 'trail'.
//   PARTIAL      partialAtR / partialFrac: take partialFrac of the position at partialAtR × R (maker fee, price must trade through by tpBuf);
//                partialBE (default true) moves the stop of the rest to break-even.
//   LIMIT ENTRY  entry: 'market' (default: next open) | 'mid' (limit at the midpoint of the signal candle, wicks included)
//                | 'retrace' (limit at the close pulled back by retraceFrac × [candle range | entry-to-stop distance], retraceBase 'range'|'dist').
//                The order waits limitBars candles (from the next one). Fills: if the next open is already at/through the level -> filled at the open
//                as a taker (+ slippage); else when price trades THROUGH the level by limitBuf -> filled at the level as a maker (no slippage).
//                Cancelled (trade missed) if: price reaches the original 4R target before the fill, gaps below/above the stop, or the time runs out.
//                Stop = unchanged (middle band at the signal close). Target: tpAnchor 'entry' = 4 × (new entry→stop), 'signal' = the original price.
//                In the candle where a limit order fills only the STOP is checked (target / break-even / partial start next candle: pessimistic).
//                limitFallback: if the order is still unfilled after limitBars candles, enter at the NEXT open as a market order instead of giving up.
//
// Candle format: { time (unix sec), open, high, low, close }.  Funding: [[time_sec, rate], ...] (optional).
'use strict';

const DEFAULTS = {
  bbLen: 20, bbMult: 2, trendLen: 200, targetR: 4, maxBars: 48, minStopAtr: 0.3, atrLen: 14, warmup: 202, interval: 14400, gapSkip: true,
  cost: { entryFee: 0.0005, stopFee: 0.0005, timeFee: 0.0005, tpFee: 0.0002, slip: 0.0002, tpSlip: 0, tpBuf: 0.0005 },
  // ---- v2 ----
  entry: 'market', retraceFrac: 0.25, retraceBase: 'range', limitBars: 1, limitBuf: 0.0005, tpAnchor: 'entry', limitFallback: false,
  beAtR: 0, beOffset: 0, trailMid: false,
  partialAtR: 0, partialFrac: 0.5, partialBE: true,
  // ---- v2 signal-quality filters (null = off). Every one is evaluated on the CLOSED signal candle only ----
  dirOnly: null,                    // 1 = longs only, -1 = shorts only
  minBreakAtr: null, maxBreakAtr: null,   // how far the close is beyond the band, in ATR
  minClosePos: null,                // close location inside the candle range, 0..1 (1 = closed at the extreme in trade direction)
  minBodyAtr: null, maxRangeAtr: null,    // candle body / full range in ATR
  minVolRatio: null, maxVolRatio: null,   // volume / average volume of the previous 20 candles
  maxSqRank: null,                  // previous candle's band width rank among the last 120 (0 = tightest squeeze); keep only if <= this
  maxPrevOut: null, freshLook: 5,   // max number of the previous freshLook candles that already closed outside the band in this direction
  minSlope: null, slopeLen: 20,     // trend SMA slope over slopeLen candles, in the trade direction, as a fraction (0.02 = 2%)
  minExt: null, maxExt: null,       // distance of the close from the trend SMA in the trade direction, fraction of the SMA
  maxFundDir: null,                 // skip if funding rate x direction > this (crowded side)
  skipHours: null, skipDow: null,   // UTC hour of the signal candle's close / day of week (0 = Sunday)
  skipAfterLosses: null,            // skip the next signal after this many losing trades in a row
  // ---- v2 stop variants ----
  stopMode: 'mid', stopFrac: 1, stopAtr: 2,   // 'mid' = middle band (bb-core) | 'frac' = stopFrac × (close→middle band) | 'atr' = stopAtr × ATR. Target = targetR × risk in every mode
  // ---- v2 stagnation exit: stagBars candles after entry, if the trade is less than stagR in profit, close at the next open ----
  stagBars: 0, stagR: 0,
  // ---- v2 free-form filter: filterFn(features, signal) -> false drops the signal. btc = { time_sec: (BTC close - BTC SMA200)/SMA200 } for the regime feature ----
  filterFn: null, btc: null,
};
const scaleCost = (c, k) => ({ ...c, entryFee: c.entryFee * k, stopFee: c.stopFee * k, timeFee: c.timeFee * k, tpFee: c.tpFee * k, slip: c.slip * k });

function backtest(B, userCfg = {}, funding = null) {
  const cfg = { ...DEFAULTS, ...userCfg, cost: { ...DEFAULTS.cost, ...(userCfg.cost || {}) } };
  const cost = cfg.cost, n = B.length, trades = [], missed = [];
  const closes = [], trs = [];
  let atr = null, pos = null, pend = null, lim = null, pendClose = false, lastGap = -Infinity, lossStreak = 0;
  const atrs = [];
  const lookback = Math.max(cfg.bbLen, cfg.trendLen);

  for (let i = 0; i < n; i++) {
    const c = B[i];
    if (i > 0 && c.time - B[i - 1].time !== cfg.interval) lastGap = i;
    let limitFill = false;                                   // true in the candle where a resting limit order filled below the open

    // 1a) market entry decided at the previous close: filled at THIS candle's open (identical to bb-core)
    if (pend) {
      const d = pend.dir, fill = c.open * (1 + d * cost.slip), dist = Math.abs(fill - pend.stop) / fill;
      if (dist > 0 && (d === 1 ? pend.stop < fill : pend.stop > fill)) pos = openPos(pend, fill, i, dist, cost.entryFee, pend.kind || 'market', pend.tp);
      pend = null;
    }
    // 1b) resting limit order
    if (lim && !pos) {
      const d = lim.dir;
      if (d === 1 ? c.open <= lim.stop : c.open >= lim.stop) { missed.push({ sig: lim.sig, reason: 'gap_stop' }); lim = null; }
      else {
        const atOpen = d === 1 ? c.open <= lim.level : c.open >= lim.level;
        const touched = d === 1 ? c.low <= lim.level * (1 - cfg.limitBuf) : c.high >= lim.level * (1 + cfg.limitBuf);
        if (atOpen || touched) {
          const fill = atOpen ? c.open * (1 + d * cost.slip) : lim.level, dist = Math.abs(fill - lim.stop) / fill;
          const tp = cfg.tpAnchor === 'signal' ? lim.tp : fill + d * cfg.targetR * Math.abs(fill - lim.stop);
          if (dist > 0 && (d === 1 ? lim.stop < fill : lim.stop > fill)) {
            pos = openPos(lim, fill, i, dist, atOpen ? cost.entryFee : cost.tpFee, atOpen ? 'open' : 'limit', tp);
            limitFill = !atOpen;
          } else missed.push({ sig: lim.sig, reason: 'bad_fill' });
          lim = null;
        } else if (d === 1 ? c.high >= lim.tp : c.low <= lim.tp) { missed.push({ sig: lim.sig, reason: 'ran_away' }); lim = null; }
        else if (i >= lim.last) {
          if (cfg.limitFallback) pend = { ...lim, kind: 'fallback' };       // still unfilled: take it at the NEXT open as a market order (stop and target unchanged)
          else missed.push({ sig: lim.sig, reason: 'expired' });
          lim = null;
        }
      }
    }
    if (pendClose && pos) exit(c.open * (1 - pos.dir * cost.slip), i, cost.timeFee, pos.closeWhy || 'time');
    pendClose = false;

    // 2) manage the open position inside this candle: stop first (if both are touched we assume the worst), gaps fill at the open
    if (pos) {
      const d = pos.dir;
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop)
        exit((d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * cost.slip), i, cost.stopFee, pos.stopKind);
      else if (!limitFill) {
        if (d === 1 ? c.high >= pos.tp * (1 + cost.tpBuf) : c.low <= pos.tp * (1 - cost.tpBuf))
          exit((d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open)) * (1 - d * cost.tpSlip), i, cost.tpFee, 'target');
        else {
          const lvl = (r) => pos.entry + d * r * pos.risk0;
          if (cfg.partialAtR > 0 && !pos.partialDone) {
            const p = lvl(cfg.partialAtR);
            if (d === 1 ? c.high >= p * (1 + cost.tpBuf) : c.low <= p * (1 - cost.tpBuf)) {
              pos.realized += legR(cfg.partialFrac, p, cost.tpFee, i); pos.rem -= cfg.partialFrac; pos.partialDone = true;
              if (cfg.partialBE) toBreakEven();
            }
          }
          if (cfg.beAtR > 0 && !pos.beOn && (d === 1 ? c.high >= lvl(cfg.beAtR) : c.low <= lvl(cfg.beAtR))) toBreakEven();
        }
      }
    }

    // 3) the candle has now CLOSED: indicators see this candle and nothing later
    closes.push(c.close);
    trs.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - B[i - 1].close), Math.abs(c.low - B[i - 1].close)));
    if (i === cfg.atrLen - 1) atr = trs.slice(0, cfg.atrLen).reduce((a, b) => a + b, 0) / cfg.atrLen; // Wilder ATR
    else if (i >= cfg.atrLen) atr = (atr * (cfg.atrLen - 1) + trs[i]) / cfg.atrLen;

    atrs.push(atr);
    if (pos) {
      if (cfg.trailMid && pos.beOn && closes.length >= cfg.bbLen) {
        const m = closes.slice(-cfg.bbLen).reduce((a, b) => a + b, 0) / cfg.bbLen, d = pos.dir;
        if (d === 1 ? (m > pos.stop && m < c.close) : (m < pos.stop && m > c.close)) { pos.stop = m; pos.stopKind = 'trail'; }
      }
      if (cfg.stagBars > 0 && i - pos.i0 === cfg.stagBars && pos.dir * (c.close - pos.entry) / pos.risk0 < cfg.stagR) { pendClose = true; pos.closeWhy = 'stag'; }
      if (cfg.maxBars > 0 && i - pos.i0 >= cfg.maxBars) pendClose = true;
      continue;
    }
    if (lim || pend || i < cfg.warmup) continue;

    // 4) look for a signal (only while flat and no order is resting)
    if (cfg.gapSkip && i - lastGap < lookback) continue;                 // a hole in the last 200 candles: indicators span it, skip (C3)
    const s0 = signalFrom(closes, atr, cfg.stopMode === 'mid' ? cfg : { ...cfg, minStopAtr: 0 });
    const s = s0 && qualify(s0, i);
    if (!s) continue;
    if (cfg.entry === 'market') { pend = { ...s, sig: i }; continue; }
    const range = c.high - c.low, dist = Math.abs(s.sigClose - s.stop);
    const level = cfg.entry === 'mid' ? (c.high + c.low) / 2
      : s.sigClose - s.dir * cfg.retraceFrac * (cfg.retraceBase === 'dist' ? dist : range);
    if (!(s.dir === 1 ? level > s.stop : level < s.stop)) { missed.push({ sig: i, reason: 'level_beyond_stop' }); continue; }
    lim = { ...s, sig: i, level, last: i + cfg.limitBars };
  }

  const open = pos ? { ...pos, bars: n - 1 - pos.i0, exitNext: pendClose } : null;
  return { trades, missed, open, setup: pend, resting: lim, cfg };

  // Signal features (all known at the close of the signal candle) + the optional v2 filters and stop variants. Returns the signal (stop/target possibly
  // replaced) or null. With every filter off and stopMode 'mid' it returns the signal unchanged, so bb-core parity holds.
  function qualify(s, i) {
    const c = B[i], d = s.dir, n = closes.length, L = cfg.bbLen, T = cfg.trendLen;
    const bandAt = (m) => {                                   // Bollinger bands from closes[..m]
      const w = closes.slice(m - L + 1, m + 1), mid = w.reduce((a, b) => a + b, 0) / L, sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / L);
      return { up: mid + cfg.bbMult * sd, lo: mid - cfg.bbMult * sd, bw: (2 * cfg.bbMult * sd) / mid };
    };
    const sma = (m, len) => { let t = 0; for (let j = m - len + 1; j <= m; j++) t += closes[j]; return t / len; };
    const bn = bandAt(n - 1), edge = d === 1 ? bn.up : bn.lo, rng = c.high - c.low;
    const f = { breakAtr: Math.abs(c.close - edge) / atr, bodyAtr: Math.abs(c.close - c.open) / atr, rangeAtr: rng / atr, bw: bn.bw,
      closePos: rng > 0 ? (d === 1 ? c.close - c.low : c.high - c.close) / rng : 0.5, hour: new Date((c.time + cfg.interval) * 1000).getUTCHours(),
      dow: new Date((c.time + cfg.interval) * 1000).getUTCDay() };
    if (c.volume != null && i >= 20) { let v = 0; for (let j = i - 20; j < i; j++) v += B[j].volume; v /= 20; f.volRatio = v > 0 ? c.volume / v : null; }
    if (n >= L + 122) {
      const cur = bandAt(n - 2).bw; let lower = 0;
      for (let m = n - 122; m < n - 2; m++) if (bandAt(m).bw < cur) lower++;
      f.sqRank = lower / 120;
    }
    if (n >= L + cfg.freshLook + 1) {
      let k = 0;
      for (let m = n - 2; m >= n - 1 - cfg.freshLook; m--) { const b = bandAt(m); if (d === 1 ? closes[m] > b.up : closes[m] < b.lo) k++; }
      f.prevOut = k;
    }
    if (n >= T + cfg.slopeLen) { const now = sma(n - 1, T), past = sma(n - 1 - cfg.slopeLen, T); f.slope = d * (now - past) / past; f.ext = d * (c.close - now) / now; }
    if (funding) { let r = null; for (let j = funding.length - 1; j >= 0; j--) if (funding[j][0] <= c.time + cfg.interval) { r = funding[j][1]; break; } f.fund = r; }

    // ---- more indicators (all from candles up to and including i) ----
    {
      const W = Math.min(i, 160); let trS = 0, pS = 0, mS = 0, adx = null, dxs = [];
      for (let j = i - W + 1; j <= i; j++) {
        const up = B[j].high - B[j - 1].high, dn = B[j - 1].low - B[j].low, pdm = up > dn && up > 0 ? up : 0, mdm = dn > up && dn > 0 ? dn : 0;
        const tr = Math.max(B[j].high - B[j].low, Math.abs(B[j].high - B[j - 1].close), Math.abs(B[j].low - B[j - 1].close));
        trS = trS - trS / 14 + tr; pS = pS - pS / 14 + pdm; mS = mS - mS / 14 + mdm;
        const pdi = trS ? 100 * pS / trS : 0, mdi = trS ? 100 * mS / trS : 0; dxs.push(pdi + mdi ? 100 * Math.abs(pdi - mdi) / (pdi + mdi) : 0);
        if (j === i) { f.pdi = pdi; f.mdi = mdi; }
      }
      adx = dxs.slice(-14).reduce((a, b) => a + b, 0) / 14; f.adx = adx; f.diDir = d === 1 ? f.pdi - f.mdi : f.mdi - f.pdi;
      let g = 0, ls = 0; for (let j = Math.max(1, i - 150); j <= i; j++) { const ch = B[j].close - B[j - 1].close; g = (g * 13 + Math.max(ch, 0)) / 14; ls = (ls * 13 + Math.max(-ch, 0)) / 14; }
      f.rsi = ls ? 100 - 100 / (1 + g / ls) : 100; if (d === -1) f.rsi = 100 - f.rsi;            // rsi in the trade direction: high = strongly with the trade
      let path = 0; for (let j = i - 19; j <= i; j++) path += Math.abs(B[j].close - B[j - 1].close); f.er = path ? Math.abs(B[i].close - B[i - 20].close) / path : 0;
      f.ret10 = d * (c.close - B[i - 10].close) / atr; f.ret3 = d * (c.close - B[i - 3].close) / atr;
      let k = 0; for (let j = i; j > 0 && d * (B[j].close - B[j - 1].close) > 0; j--) k++; f.consec = k;
      const ar = atrs.slice(-120).filter((v) => v != null); f.atrRank = ar.length ? ar.filter((v) => v < atr).length / ar.length : null; f.atrPct = atr / c.close;
      if (cfg.btc && cfg.btc[c.time] != null) f.btc = d * cfg.btc[c.time];
    }
    const on = (v) => v != null;
    if (cfg.filterFn && !cfg.filterFn(f, s)) return null;
    if (on(cfg.dirOnly) && d !== cfg.dirOnly) return null;
    if (on(cfg.minBreakAtr) && f.breakAtr < cfg.minBreakAtr) return null;
    if (on(cfg.maxBreakAtr) && f.breakAtr > cfg.maxBreakAtr) return null;
    if (on(cfg.minClosePos) && f.closePos < cfg.minClosePos) return null;
    if (on(cfg.minBodyAtr) && f.bodyAtr < cfg.minBodyAtr) return null;
    if (on(cfg.maxRangeAtr) && f.rangeAtr > cfg.maxRangeAtr) return null;
    if (on(cfg.minVolRatio) && on(f.volRatio) && f.volRatio < cfg.minVolRatio) return null;
    if (on(cfg.maxVolRatio) && on(f.volRatio) && f.volRatio > cfg.maxVolRatio) return null;
    if (on(cfg.maxSqRank) && on(f.sqRank) && f.sqRank > cfg.maxSqRank) return null;
    if (on(cfg.maxPrevOut) && on(f.prevOut) && f.prevOut > cfg.maxPrevOut) return null;
    if (on(cfg.minSlope) && on(f.slope) && f.slope < cfg.minSlope) return null;
    if (on(cfg.minExt) && on(f.ext) && f.ext < cfg.minExt) return null;
    if (on(cfg.maxExt) && on(f.ext) && f.ext > cfg.maxExt) return null;
    if (on(cfg.maxFundDir) && on(f.fund) && d * f.fund > cfg.maxFundDir) return null;
    if (cfg.skipHours && cfg.skipHours.includes(f.hour)) return null;
    if (cfg.skipDow && cfg.skipDow.includes(f.dow)) return null;
    if (on(cfg.skipAfterLosses) && lossStreak >= cfg.skipAfterLosses) { lossStreak = 0; return null; }

    const out = { ...s, feat: f };
    if (cfg.stopMode !== 'mid') {
      const r = cfg.stopMode === 'atr' ? cfg.stopAtr * atr : cfg.stopFrac * Math.abs(s.sigClose - s.stop);
      out.stop = s.sigClose - d * r; out.tp = s.sigClose + d * cfg.targetR * r;
      if (!(r > 0) || r < cfg.minStopAtr * atr) return null;
    }
    return out;
  }
  function openPos(s, entry, i0, dist, entryFee, kind, tp) {
    return { dir: s.dir, stop: s.stop, stop0: s.stop, tp, entry, i0, dist, sig: s.sig, kind, entryFee, risk0: Math.abs(entry - s.stop), feat: s.feat,
      rem: 1, realized: 0, beOn: false, stopKind: 'stop', partialDone: false };
  }
  function toBreakEven() {
    pos.beOn = true;
    const ns = pos.entry * (1 + pos.dir * cfg.beOffset);
    if (pos.dir === 1 ? ns > pos.stop : ns < pos.stop) { pos.stop = ns; pos.stopKind = 'be'; }
  }
  // funding paid (+) / received (−) for every 8h funding event the trade was open through, up to candle iExit
  function fundTo(iExit) {
    let fr = 0;
    if (funding) { const te = B[pos.i0].time, tx = B[iExit].time + 7200; for (const [t, r] of funding) { if (t > tx) break; if (t > te) fr += r; } }
    return fr;
  }
  // result in R of `frac` of the position closed at px (fees, funding included)
  function legR(frac, px, fee, iExit) {
    return frac * (pos.dir * (px - pos.entry) / pos.entry - pos.entryFee - fee - pos.dir * fundTo(iExit)) / pos.dist;
  }
  function exit(px, i, fee, why) {
    const R = pos.realized + legR(pos.rem, px, fee, i);
    trades.push({ dir: pos.dir, i0: pos.i0, i1: i, sig: pos.sig, t: B[pos.i0].time, tExit: B[i].time + 14400, entry: pos.entry, exit: px, stop: pos.stop0, tp: pos.tp,
      R, why, bars: i - pos.i0 + 1, kind: pos.kind, partial: pos.partialDone, be: pos.beOn, feat: pos.feat });
    lossStreak = R <= 0 ? lossStreak + 1 : 0;
    pos = null;
  }
}

// The entry rule — copied unchanged from bb-core/lucidio-core.js.
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

// trades (any order) -> numbers in R. Portfolio drawdown is taken over trades sorted by exit time.
function summarize(trades) {
  const t = [...trades].sort((a, b) => a.tExit - b.tExit), n = t.length;
  let eq = 0, pk = 0, dd = 0;
  for (const x of t) { eq += x.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const years = {};
  for (const x of t) { const y = new Date(x.tExit * 1000).getUTCFullYear(); years[y] = (years[y] || 0) + x.R; }
  const cut = Date.UTC(2024, 0, 1) / 1000;
  const why = {}; for (const x of t) why[x.why] = (why[x.why] || 0) + 1;
  return { n, R: eq, avgR: n ? eq / n : 0, win: n ? t.filter((x) => x.R > 0).length / n : 0, dd, years, why,
    isR: t.filter((x) => x.tExit < cut).reduce((a, x) => a + x.R, 0), oosR: t.filter((x) => x.tExit >= cut).reduce((a, x) => a + x.R, 0) };
}

module.exports = { backtest, signalFrom, summarize, scaleCost, DEFAULTS };
