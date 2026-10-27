// v3-core.js — second research engine: bb-core rules (market entry at the next open) + structural ideas the v2 engine cannot express.
// With every option at its default it must equal bb-core trade for trade (verify-parity-v3.js).
//
//   PYRAMIDING    maxPos: up to this many positions open at once on the coin (bb-core: 1 — signals during a trade are ignored).
//                 addSameDir: a new position must be in the same direction as the open ones. addMinR: and every open one must already be
//                 at least this many R in profit at the signal close (null = no condition). Each position is sized, stopped and exited on its own.
//   LET WINNERS RUN  extendIfR: at the 48-candle time exit, a trade at least this many R in profit (on the close) is NOT closed; its stop moves to
//                 entry + extendLockR × R and it may run to maxBars2 candles. Trades below extendIfR are closed as in bb-core.
//   CHANDELIER    chandAtR: once the trade has been this many R in profit (high/low), the stop trails the best price since entry minus chandAtr × ATR
//                 (only ever tightens). Pair it with a larger targetR to let big moves run.
//   NEW EXTREME   newHighN: the signal close must also be the highest (long) / lowest (short) close of the last newHighN candles.
//
// Same timing rules as bb-core: decisions on a CLOSED candle, fills at the next open, stop before target inside a candle, new trailing stops
// take effect from the next candle.
'use strict';

const DEFAULTS = {
  bbLen: 20, bbMult: 2, trendLen: 200, targetR: 4, maxBars: 48, minStopAtr: 0.3, atrLen: 14, warmup: 202, interval: 14400, gapSkip: true,
  cost: { entryFee: 0.0005, stopFee: 0.0005, timeFee: 0.0005, tpFee: 0.0002, slip: 0.0002, tpSlip: 0, tpBuf: 0.0005 },
  maxPos: 1, addSameDir: true, addMinR: null,
  extendIfR: null, extendLockR: 0, maxBars2: 96,
  chandAtR: null, chandAtr: 3,
  newHighN: null,
};
const scaleCost = (c, k) => ({ ...c, entryFee: c.entryFee * k, stopFee: c.stopFee * k, timeFee: c.timeFee * k, tpFee: c.tpFee * k, slip: c.slip * k });

function backtest(B, userCfg = {}, funding = null) {
  const cfg = { ...DEFAULTS, ...userCfg, cost: { ...DEFAULTS.cost, ...(userCfg.cost || {}) } };
  const cost = cfg.cost, n = B.length, trades = [], closes = [], trs = [];
  let atr = null, pend = null, lastGap = -Infinity, open = [];
  const lookback = Math.max(cfg.bbLen, cfg.trendLen);

  for (let i = 0; i < n; i++) {
    const c = B[i];
    if (i > 0 && c.time - B[i - 1].time !== cfg.interval) lastGap = i;

    // 1) entry decided at the previous close fills at this open
    if (pend) {
      const d = pend.dir, fill = c.open * (1 + d * cost.slip), dist = Math.abs(fill - pend.stop) / fill;
      if (dist > 0 && (d === 1 ? pend.stop < fill : pend.stop > fill))
        open.push({ dir: d, stop: pend.stop, stop0: pend.stop, tp: pend.tp, entry: fill, i0: i, dist, risk0: Math.abs(fill - pend.stop), best: fill, layer: open.length + 1 });
      pend = null;
    }
    // time exits decided at the previous close
    for (const p of open.filter((x) => x.pendClose)) exit(p, c.open * (1 - p.dir * cost.slip), i, cost.timeFee, p.extended ? 'time2' : 'time');

    // 2) inside the candle: stop first, then target
    for (const p of [...open]) {
      const d = p.dir;
      if (d === 1 ? c.low <= p.stop : c.high >= p.stop)
        exit(p, (d === 1 ? Math.min(p.stop, c.open) : Math.max(p.stop, c.open)) * (1 - d * cost.slip), i, cost.stopFee, p.stop === p.stop0 ? 'stop' : 'trail');
      else if (d === 1 ? c.high >= p.tp * (1 + cost.tpBuf) : c.low <= p.tp * (1 - cost.tpBuf))
        exit(p, (d === 1 ? Math.max(p.tp, c.open) : Math.min(p.tp, c.open)) * (1 - d * cost.tpSlip), i, cost.tpFee, 'target');
      else p.best = d === 1 ? Math.max(p.best, c.high) : Math.min(p.best, c.low);
    }

    // 3) candle closed: indicators
    closes.push(c.close);
    trs.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - B[i - 1].close), Math.abs(c.low - B[i - 1].close)));
    if (i === cfg.atrLen - 1) atr = trs.slice(0, cfg.atrLen).reduce((a, b) => a + b, 0) / cfg.atrLen;
    else if (i >= cfg.atrLen) atr = (atr * (cfg.atrLen - 1) + trs[i]) / cfg.atrLen;

    for (const p of open) {
      const d = p.dir, openR = d * (c.close - p.entry) / p.risk0;
      if (cfg.chandAtR != null && d * (p.best - p.entry) / p.risk0 >= cfg.chandAtR) {
        const ns = p.best - d * cfg.chandAtr * atr;
        if (d === 1 ? ns > p.stop && ns < c.close : ns < p.stop && ns > c.close) p.stop = ns;
      }
      const age = i - p.i0;
      if (!p.extended && cfg.maxBars > 0 && age >= cfg.maxBars) {
        if (cfg.extendIfR != null && openR >= cfg.extendIfR) {
          p.extended = true;
          const ns = p.entry + d * cfg.extendLockR * p.risk0;
          if ((d === 1 ? ns > p.stop : ns < p.stop) && (d === 1 ? ns < c.close : ns > c.close)) p.stop = ns;
        } else p.pendClose = true;
      }
      if (p.extended && age >= cfg.maxBars2) p.pendClose = true;
    }

    // 4) signal
    if (i < cfg.warmup) continue;
    if (open.length >= cfg.maxPos) continue;
    if (cfg.gapSkip && i - lastGap < lookback) continue;
    const s = signalFrom(closes, atr, cfg);
    if (!s) continue;
    if (cfg.newHighN != null) {
      const w = closes.slice(-cfg.newHighN - 1, -1);
      if (s.dir === 1 ? c.close <= Math.max(...w) : c.close >= Math.min(...w)) continue;
    }
    if (open.length) {
      if (cfg.addSameDir && open.some((p) => p.dir !== s.dir)) continue;
      if (cfg.addMinR != null && open.some((p) => p.dir * (c.close - p.entry) / p.risk0 < cfg.addMinR)) continue;
    }
    pend = { ...s, sig: i };
  }
  return { trades, open: open.map((p) => ({ ...p, bars: n - 1 - p.i0 })), setup: pend, cfg };

  function exit(p, px, i, fee, why) {
    let fr = 0;
    if (funding) { const te = B[p.i0].time, tx = B[i].time + 7200; for (const [t, r] of funding) { if (t > tx) break; if (t > te) fr += r; } }
    const R = (p.dir * (px - p.entry) / p.entry - cost.entryFee - fee - p.dir * fr) / p.dist;
    trades.push({ dir: p.dir, i0: p.i0, i1: i, t: B[p.i0].time, tExit: B[i].time + 14400, entry: p.entry, exit: px, stop: p.stop0, tp: p.tp, R, why, bars: i - p.i0 + 1, layer: p.layer });
    open = open.filter((x) => x !== p);
  }
}

// entry rule — copied unchanged from bb-core/lucidio-core.js
function signalFrom(closes, atr, cfg) {
  const n = closes.length, close = closes[n - 1];
  if (n < Math.max(cfg.bbLen, cfg.trendLen) || atr == null) return null;
  const w = closes.slice(-cfg.bbLen), mid = w.reduce((a, b) => a + b, 0) / cfg.bbLen;
  const sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / cfg.bbLen);
  const up = mid + cfg.bbMult * sd, lo = mid - cfg.bbMult * sd;
  const dir = close > up ? 1 : close < lo ? -1 : 0;
  if (!dir) return null;
  if (cfg.trendLen > 0) {
    const sma = closes.slice(-cfg.trendLen).reduce((a, b) => a + b, 0) / cfg.trendLen;
    if (dir === 1 ? close < sma : close > sma) return null;
  }
  const dist = Math.abs(close - mid);
  if (!(dist > 0) || dist < cfg.minStopAtr * atr) return null;
  return { dir, stop: mid, tp: close + dir * cfg.targetR * dist, sigClose: close };
}

module.exports = { backtest, signalFrom, scaleCost, DEFAULTS };
