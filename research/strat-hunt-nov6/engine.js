// engine.js — one trade loop for every strategy, built from the bot's own rules (lucidio-core.js / icore-core.js).
//   decide on a CLOSED candle i, fill at the OPEN of i+1 (slippage against us), one position per coin, stop checked first inside a candle
//   (if both are touched we assume the worst), a stop hit through a gap fills at the open.
//   costs  = bb-core's REAL model: 0.05% taker fee on entry and on every exit, 0.02% slippage on every fill, plus the real Binance funding paid/received.
//   R      = (net % result) / (stop distance in %)   — fees, slippage and funding included.
//   exits  : (a) a stop price given by the strategy (bb-core: the Bollinger middle) or kInit x ATR; (b) optional ATR trail kTrail from the best price (live next candle);
//            (c) optional signal exit; (d) optional time exit after maxBars candles — signal/time exits fill at the NEXT open, like bb-core.
'use strict';
const COST = { fee: 0.0005, slip: 0.0002 };

// funding between (t0, t1]: prefix sums over the (sorted) [time, rate] events
function cumFunding(F) {
  const T = F.map((r) => r[0]), C = new Float64Array(F.length + 1);
  for (let i = 0; i < F.length; i++) C[i + 1] = C[i] + F[i][1];
  const idx = (t) => { let lo = 0, hi = T.length; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m + 1; else hi = m; } return lo; };
  return (t0, t1) => C[idx(t1)] - C[idx(t0)];
}

// strat = { L, S: Uint8Array entry flags at close i; xL, xS: optional exit flags; stopL, stopS: optional stop price arrays; warmup }
// ex    = { kInit, kTrail (0 = none), maxBars (0 = none), sigExit (bool) }
function run(B, ATR, strat, ex, funding, iv, cost = COST) {
  const n = B.length, trades = [], { L, S, xL, xS, stopL, stopS } = strat;
  const warm = Math.max(strat.warmup || 0, 205);
  let pos = null, pend = null, pendClose = false;
  const frSum = funding ? cumFunding(funding) : null;

  function exit(px, i, why) {
    const fr = frSum ? frSum(B[pos.i0].time, B[i].time + iv / 2) : 0;
    const R = (pos.dir * (px - pos.entry) / pos.entry - cost.fee - cost.fee - pos.dir * fr) / pos.dist;
    trades.push({ dir: pos.dir, i0: pos.i0, i1: i, t: B[pos.i0].time, tExit: B[i].time + iv, entry: pos.entry, exit: px, R, why, bars: i - pos.i0 + 1 });
    pos = null;
  }

  for (let i = 1; i < n; i++) {
    const b = B[i];
    if (pend) {
      const d = pend.dir, fill = b.open * (1 + d * cost.slip);
      let stop = null, dist = 0;
      if (pend.stopPx != null) {
        stop = pend.stopPx; dist = Math.abs(fill - stop) / fill;
        if (!(dist > 0 && (d === 1 ? stop < fill : stop > fill))) stop = null;
      } else { dist = ex.kInit * pend.atr / fill; stop = fill - d * ex.kInit * pend.atr; }
      if (stop != null && dist > 0) pos = { dir: d, i0: i, entry: fill, stop, dist, ext: b.open };
      pend = null;
    }
    if (pendClose && pos) exit(b.open * (1 - pos.dir * cost.slip), i, 'sig');
    pendClose = false;
    if (pos) {
      const d = pos.dir;
      if (d === 1 ? b.low <= pos.stop : b.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, b.open) : Math.max(pos.stop, b.open)) * (1 - d * cost.slip), i, 'stop');
      else if (ex.kTrail > 0) {
        pos.ext = d === 1 ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low);
        const ns = pos.ext - d * ex.kTrail * ATR[i];
        if (d === 1 ? ns > pos.stop : ns < pos.stop) pos.stop = ns;
      }
    }
    if (pos) {
      if (ex.maxBars > 0 && i - pos.i0 >= ex.maxBars) pendClose = true;
      else if (ex.sigExit && (pos.dir === 1 ? xL && xL[i] : xS && xS[i])) pendClose = true;
      continue;
    }
    if (i < warm || !(ATR[i] > 0) || i + 1 >= n) continue;
    if (L[i]) pend = { dir: 1, atr: ATR[i], stopPx: stopL ? stopL[i] : null };
    else if (S[i]) pend = { dir: -1, atr: ATR[i], stopPx: stopS ? stopS[i] : null };
    if (pend && pend.stopPx != null && !(pend.stopPx > 0)) pend = null;
  }
  return { trades, open: pos };
}

// ---- statistics (pooled trades are sorted by exit time) ----
function stats(trades) {
  const tr = [...trades].sort((a, b) => a.tExit - b.tExit), n = tr.length, years = {};
  let eq = 0, pk = 0, dd = 0, gp = 0, gl = 0, w = 0;
  for (const t of tr) {
    eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq);
    if (t.R > 0) { gp += t.R; w++; } else gl -= t.R;
    const y = new Date(t.tExit * 1000).getUTCFullYear(); years[y] = (years[y] || 0) + t.R;
  }
  return { n, total: eq, exp: n ? eq / n : 0, pf: gl ? gp / gl : Infinity, win: n ? w / n : 0, dd, rdd: dd > 0 ? eq / dd : 0, years, bars: n ? tr.reduce((a, t) => a + t.bars, 0) / n : 0 };
}
module.exports = { run, stats, COST };
