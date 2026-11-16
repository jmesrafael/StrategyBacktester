// engines/backtest/engine.js - the unified backtest engine and the standard transaction-cost model.
//
// One loop for every strategy. A strategy is a plain object (see strategies.js): a signal function plus exit settings.
// Everything is decided on a candle's CLOSE and filled at the NEXT candle's open. Inside a candle the stop is checked
// first: if a candle touches both the stop and anything better, the stop is assumed (worst case). A gap through the
// stop fills at the open. Indicators at candle i use candles 0..i only.
//
// Candles: [{ time (unix s, bar open), open, high, low, close }], oldest first.
// Result: { trades, open }. Each trade has R = result in units of the amount risked (1R = entry to first stop), after costs.
'use strict';

// ---------- indicators ----------
// Wilder ATR, variant A (BB-CORE): true range of candle 0 is high-low; the seed is the mean of the first `len` true ranges, at index len-1.
function atrA(B, len = 14) {
  const out = new Array(B.length).fill(null), trs = []; let a = null;
  for (let i = 0; i < B.length; i++) {
    trs.push(i === 0 ? B[i].high - B[i].low : Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close)));
    if (i === len - 1) a = trs.slice(0, len).reduce((x, y) => x + y, 0) / len; else if (i >= len) a = (a * (len - 1) + trs[i]) / len;
    out[i] = a;
  }
  return out;
}
// Wilder ATR, variant B (I-CORE, T-CORE): candle 0 has no true range; the seed is the mean of true ranges 1..len, at index len.
function atrB(B, len = 14) {
  const out = new Array(B.length).fill(null), tr = (i) => Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close)); let e = null;
  for (let i = 1; i < B.length; i++) { if (i === len) { let s = 0; for (let j = 1; j <= len; j++) s += tr(j); e = s / len; out[i] = e; } else if (i > len) { e = (e * (len - 1) + tr(i)) / len; out[i] = e; } }
  return out;
}
// Bollinger band of the `len` closes ending at i (population standard deviation) and the simple average of `trendLen` closes
function bands(B, i, len, mult, trendLen) {
  if (i - len + 1 < 0 || (trendLen > 0 && i - trendLen + 1 < 0)) return null;
  let s = 0; for (let j = i - len + 1; j <= i; j++) s += B[j].close; const mid = s / len;
  let v = 0; for (let j = i - len + 1; j <= i; j++) v += (B[j].close - mid) ** 2; const sd = Math.sqrt(v / len);
  let sma = null; if (trendLen > 0) { let t = 0; for (let j = i - trendLen + 1; j <= i; j++) t += B[j].close; sma = t / trendLen; }
  return { mid, sd, up: mid + mult * sd, lo: mid - mult * sd, sma };
}
// midpoint of the highest high and lowest low of the n candles ending at `end`
function hlMid(B, end, n) { if (end - n + 1 < 0) return NaN; let h = -Infinity, l = Infinity; for (let j = end - n + 1; j <= end; j++) { if (B[j].high > h) h = B[j].high; if (B[j].low < l) l = B[j].low; } return (h + l) / 2; }
const smaClose = (B, i, n) => { if (i - n + 1 < 0) return NaN; let s = 0; for (let j = i - n + 1; j <= i; j++) s += B[j].close; return s / n; };

// ---------- cost models ----------
// STANDARD: the one model every new study uses. Taker fee on entry and exit, slippage applied to both fill prices,
// funding from the real settled rates when a funding series is given, otherwise a flat pessimistic charge per candle.
function standardCost({ fee = 0.0005, slip = 0.0002, fundPerBar = 0.00005, funding = null, scale = 1 } = {}) {
  fee *= scale; slip *= scale;
  return { name: `standard x${scale}`, fee, slip,
    entryFill: (open, d) => open * (1 + d * slip), exitFill: (raw, d) => raw * (1 - d * slip),
    R(t) {
      let fund = fundPerBar * scale * t.bars;      // flat: charged in both directions
      if (funding) { fund = 0; for (const [ft, r] of funding) { if (ft > t.tExit) break; if (ft > t.t) fund += t.dir * r; } fund *= 1; }
      return (t.dir * (t.exit - t.entry) / t.entry - 2 * fee - fund) / t.dist;
    } };
}
// The bots' own models, kept only to prove the engine reproduces each bot's backtest trade for trade.
function bbNativeCost(c = { entryFee: 0.0005, stopFee: 0.0005, timeFee: 0.0005, slip: 0.0002 }, funding = null) {
  return { name: 'bb-core native', entryFill: (open, d) => open * (1 + d * c.slip), exitFill: (raw, d) => raw * (1 - d * c.slip),
    R(t) { let fr = 0; if (funding) { const tx = t.tLastBar + 7200; for (const [ft, r] of funding) { if (ft > tx) break; if (ft > t.t) fr += r; } }
      return (t.dir * (t.exit - t.entry) / t.entry - c.entryFee - (t.why === 'stop' ? c.stopFee : c.timeFee) - t.dir * fr) / t.dist; } };
}
function icNativeCost(c = { fee: 0.0005, slip: 0.0002, fund: 0.00005 }) {
  return { name: 'i-core native', entryFill: (open) => open, exitFill: (raw) => raw, R: (t) => (t.dir * (t.exit - t.entry) / t.entry - (2 * (c.fee + c.slip) + c.fund * t.bars)) / t.dist };
}
const freeCost = () => ({ name: 'free', entryFill: (o) => o, exitFill: (r) => r, R: (t) => (t.dir * (t.exit - t.entry) / t.entry) / t.dist });

// ---------- the engine ----------
function run(B, S, cost = standardCost()) {
  const n = B.length, trades = [], atr = S.atr === 'A' ? atrA(B, S.atrLen || 14) : atrB(B, S.atrLen || 14), ctx = { B, atr };
  if (S.prepare) S.prepare(ctx);
  let pos = null, pend = null, pendClose = false, lastGap = -Infinity, coolUntil = -1;
  const exit = (raw, ix, why) => {
    const t = { dir: pos.dir, i0: pos.i0, i1: ix, sigT: B[pos.sig].time, t: B[pos.i0].time, tLastBar: B[ix].time, tExit: B[ix].time + S.interval, entry: pos.entry, exit: cost.exitFill(raw, pos.dir, why), stop0: pos.stop0, stop: pos.stop,
      dist: pos.dist, why, bars: ix - pos.i0 + 1, mfeR: pos.dir * (pos.ext - pos.entry) / (pos.dist * pos.entry) };
    t.R = cost.R(t); trades.push(t);
    if (t.R <= 0 && S.coolBars > 0) coolUntil = ix + S.coolBars;
    pos = null;
  };
  for (let i = 0; i < n; i++) {
    const b = B[i];
    if (i > 0 && b.time - B[i - 1].time !== S.interval) lastGap = i;
    // 1. the order decided at the previous close fills at this open
    if (pend) {
      const d = pend.dir, fill = cost.entryFill(b.open, d);
      if (S.stopMode === 'level') { const dist = Math.abs(fill - pend.stop) / fill; if (dist > 0 && (d === 1 ? pend.stop < fill : pend.stop > fill)) pos = { dir: d, i0: i, sig: pend.sig, entry: fill, stop0: pend.stop, stop: pend.stop, dist, ext: b.open }; }
      else { const stop = fill - d * S.kInit * pend.atr; pos = { dir: d, i0: i, sig: pend.sig, entry: fill, stop0: stop, stop, dist: S.kInit * pend.atr / fill, ext: b.open }; }
      pend = null;
    }
    // 2. exits decided at the previous close
    if (pos && pendClose) exit(b.open, i, 'time');                 // time exit: at this open
    pendClose = false;
    if (pos && pos.out) exit(B[i - 1].close, i - 1, 'time');       // stale exit: a market close right after the previous close
    // 3. inside the candle: stop first, then the safety time exit, else move the trailing stop for the NEXT candle
    if (pos) {
      const long = pos.dir === 1;
      if (long ? b.low <= pos.stop : b.high >= pos.stop) exit(long ? Math.min(b.open, pos.stop) : Math.max(b.open, pos.stop), i, 'stop');
      else if (S.timeExit === 'close' && (S.maxBars > 0 || S.maxBarsAlways) && i - pos.i0 >= S.maxBars) exit(b.close, i, 'time');
      else {
        pos.ext = long ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low);
        if (S.kTrail > 0) { const ns = pos.ext - pos.dir * S.kTrail * atr[i]; if (long ? ns > pos.stop : ns < pos.stop) pos.stop = ns; }
        const oneR = Math.abs(pos.entry - pos.stop0);
        if (S.lockAtR > 0 && pos.dir * (pos.ext - pos.entry) >= S.lockAtR * oneR) { const ls = pos.entry + pos.dir * S.lockToR * oneR; if (long ? ls > pos.stop : ls < pos.stop) pos.stop = ls; }
        if (S.staleBars > 0 && i - pos.i0 >= S.staleBars && pos.dir * (b.close - pos.entry) < S.staleR * oneR) pos.out = true;
      }
    }
    // 4. the candle has closed
    if (pos) { if (S.timeExit === 'nextOpen' && S.maxBars > 0 && i - pos.i0 >= S.maxBars) pendClose = true; continue; }
    if (i < S.warmup || !(atr[i] > 0)) continue;
    if (S.gapSkip !== false && i - lastGap < S.gapLookback) continue;      // a missing candle inside the indicator window: no signal
    if (i < coolUntil) continue;                                           // waiting after a losing trade
    const s = S.signal(ctx, i);
    if (s) pend = { dir: s.dir, stop: s.stop, sig: i, atr: atr[i] };
  }
  return { trades, open: pos ? { ...pos, t: B[pos.i0].time, sigT: B[pos.sig].time, bars: n - 1 - pos.i0 } : null, setup: pend };
}

// summary numbers of a trade list (in exit order)
function stats(trades) {
  const n = trades.length; let eq = 0, pk = 0, dd = 0, st = 0, maxSt = 0;
  for (const t of trades) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); if (t.R <= 0) maxSt = Math.max(maxSt, ++st); else st = 0; }
  const wins = trades.filter((t) => t.R > 0).length, m = n ? eq / n : 0, sdv = n > 1 ? Math.sqrt(trades.reduce((a, t) => a + (t.R - m) ** 2, 0) / (n - 1)) : 0;
  return { n, totalR: eq, avgR: m, winRate: n ? wins / n : 0, maxDD: dd, maxLossStreak: maxSt, tStat: sdv > 0 ? m / (sdv / Math.sqrt(n)) : 0 };
}
module.exports = { run, stats, atrA, atrB, bands, hlMid, smaClose, standardCost, bbNativeCost, icNativeCost, freeCost };
