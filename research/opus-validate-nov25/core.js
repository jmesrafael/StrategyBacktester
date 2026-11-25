// core.js - independent validation path (Nov 25 2026). Uses the PROJECT engine (intel/engines/backtest/engine.js) for
// trades, with OWN indicator code for ADX and Intraday Intensity, and OWN portfolio / drawdown accounting.
// Nothing from research/replace-nov25 or research/bb-tweak-nov25 is imported.
'use strict';
const C = require('../../candles/candles.js');
const E = require('../../intel/engines/backtest/engine');
const ST = require('../../intel/engines/backtest/strategies');
const IV = 14400, END = Date.UTC(2026, 10, 24) / 1000, T0 = Date.UTC(2020, 0, 1) / 1000;
const COINS = { bb: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'], ic: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], tc: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'] };
const WEIGHT = { bb: 0.5, ic: 0.25, tc: 0.25 };

const DATA = {};
function data(coin, end = END) {
  const k = coin + end; if (DATA[k]) return DATA[k];
  const rows = C.load(coin, '4h').filter((r) => r[0] + IV <= end);
  const B = rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const F = C.funding(coin).filter((f) => f[0] <= end);
  const idx = new Map(); B.forEach((b, i) => idx.set(b.time, i));
  return (DATA[k] = { coin, B, F, idx });
}

// ---- own indicators ----
// Wilder ADX, TA-Lib style: smoothed sums seeded with a plain sum of the first `len` values (bars 1..len),
// then S = S - S/len + x; ADX seeded with the mean of the first `len` DX values, then Wilder average.
function adx(B, len = 14) {
  const n = B.length, out = new Array(n).fill(NaN);
  let sTR = 0, sP = 0, sM = 0, dxSum = 0, dxN = 0, a = NaN;
  for (let i = 1; i < n; i++) {
    const h = B[i].high, l = B[i].low, pc = B[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const upMove = h - B[i - 1].high, downMove = B[i - 1].low - l;
    const pdm = upMove > downMove && upMove > 0 ? upMove : 0, mdm = downMove > upMove && downMove > 0 ? downMove : 0;
    if (i <= len) { sTR += tr; sP += pdm; sM += mdm; if (i < len) continue; }
    else { sTR = sTR - sTR / len + tr; sP = sP - sP / len + pdm; sM = sM - sM / len + mdm; }
    const pdi = sTR > 0 ? 100 * sP / sTR : 0, mdi = sTR > 0 ? 100 * sM / sTR : 0, dx = pdi + mdi > 0 ? 100 * Math.abs(pdi - mdi) / (pdi + mdi) : 0;
    if (dxN < len) { dxSum += dx; dxN++; if (dxN === len) { a = dxSum / len; out[i] = a; } }
    else { a = (a * (len - 1) + dx) / len; out[i] = a; }
  }
  return out;
}
// Intraday Intensity %: sum((2C-H-L)/(H-L) * V, len) / sum(V, len); a candle with H == L adds 0 to the top, V to the bottom
function ii(B, len = 21) {
  const n = B.length, out = new Array(n).fill(NaN); let num = 0, den = 0;
  const term = (b) => (b.high > b.low ? ((2 * b.close - b.high - b.low) / (b.high - b.low)) * b.volume : 0);
  for (let i = 0; i < n; i++) {
    num += term(B[i]); den += B[i].volume;
    if (i >= len) { num -= term(B[i - len]); den -= B[i - len].volume; }
    if (i >= len - 1) out[i] = den > 0 ? num / den : 0;
  }
  return out;
}
// exact (non-running) II for parity checks
function iiAt(B, i, len = 21) { let s = 0, v = 0; for (let j = i - len + 1; j <= i; j++) { const b = B[j], r = b.high - b.low; if (r > 0) s += ((2 * b.close - b.high - b.low) / r) * b.volume; v += b.volume; } return v > 0 ? s / v : 0; }

// II computed on the local MEXC candle copy (bb-core/data, to Oct 2026), aligned to the Binance candles by time;
// where MEXC has no candle (ARB, after the copy ends) the Binance value is used. Returns { arr, used }.
function mexcII(coin, B, len) {
  const fs = require('fs'), f = `D:/testing/Strat/bb-core/data/MEXC_${coin}.json`, base = ii(B, len);
  if (!fs.existsSync(f)) return base;
  const M = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })), mi = ii(M, len), at = new Map(M.map((b, i) => [b.time, mi[i]]));
  return B.map((b, i) => (at.has(b.time) && !isNaN(at.get(b.time)) ? at.get(b.time) : base[i]));
}
// ---- runs ----
// BB variant: o = { iiLen, iiShort (filter shorts), iiLong (filter longs), adxLen, adxTh, adxLo, mult }
function runBB(coin, o = {}, opt = {}) {
  const d = data(coin, opt.end), S = ST.bot('bbcore', 'v3'), base = S.signal;
  const A = o.adxTh != null ? adx(d.B, o.adxLen || 14) : null, I = o.iiShort || o.iiLong ? (o.iiSrc === 'mexc' ? mexcII(coin, d.B, o.iiLen || 21) : ii(d.B, o.iiLen || 21)) : null;
  const W = new Map();
  S.signal = (ctx, i) => {
    const s = base(ctx, i); if (!s) return null;
    if (o.iiShort && s.dir === -1 && !(I[i] < (o.iiTh || 0))) return null;
    if (o.iiLong && s.dir === 1 && !(I[i] > -(o.iiTh || 0))) return null;
    let w = o.mult || 1; if (A && A[i] > o.adxTh) w *= o.adxLo ?? 0.5;
    W.set(ctx.B[i].time, w); return s;
  };
  const cost = E.standardCost({ funding: d.F, scale: opt.cost || 1 });
  const r = E.run(d.B, S, cost);
  return { trades: r.trades.map((t) => ({ ...t, coin, bot: 'bb', w: W.get(t.sigT) ?? (o.mult || 1) })), open: r.open };
}
function runT(coin, kTrail = 14, opt = {}) {
  const d = data(coin, opt.end), S = ST.bot('tcore', 'v3', { kTrail }), r = E.run(d.B, S, E.standardCost({ funding: d.F, scale: opt.cost || 1 }));
  return { trades: r.trades.map((t) => ({ ...t, coin, bot: 'tc', w: 1 })), open: r.open };
}
function runI(coin, opt = {}) {
  const d = data(coin, opt.end), S = ST.bot('icore', 'v3'), r = E.run(d.B, S, E.standardCost({ funding: d.F, scale: opt.cost || 1 }));
  return { trades: r.trades.map((t) => ({ ...t, coin, bot: 'ic', w: 1 })), open: r.open };
}
const MEMO = {};
function bbTrades(o = {}, opt = {}) { const k = 'bb' + JSON.stringify(o) + JSON.stringify(opt); return MEMO[k] || (MEMO[k] = COINS.bb.flatMap((c) => runBB(c, o, opt).trades)); }
function tcTrades(k = 14, opt = {}) { const key = 'tc' + k + JSON.stringify(opt); return MEMO[key] || (MEMO[key] = COINS.tc.flatMap((c) => runT(c, k, opt).trades)); }
function icTrades(opt = {}) { const key = 'ic' + JSON.stringify(opt); return MEMO[key] || (MEMO[key] = COINS.ic.flatMap((c) => runI(c, opt).trades)); }

// ---- accounting ----
// portfolio: list of { trades, weight }. Returns closed-trade stats and a mark-to-market curve on the 4h grid.
// Mark to market: each open trade is valued at every close at weight * w * (dir*(C-entry)/entry - 2*fee - funding so far)/dist.
function book(parts, a = T0, b = END, { mtm = true } = {}) {
  const tr = parts.flatMap((p) => p.trades.map((t) => ({ ...t, ww: p.weight * t.w }))).filter((t) => t.tExit > a && t.tExit <= b).sort((x, y) => x.tExit - y.tExit || x.t - y.t);
  let e = 0, pk = 0, dd = 0, wins = 0; for (const t of tr) { e += t.ww * t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); if (t.R > 0) wins++; }
  let mdd = 0, inc = null;
  if (mtm) {
    const len = Math.floor((b - a) / IV) + 2; inc = new Float64Array(len);
    for (const t of tr) {
      const d = data(t.coin), B = d.B; let prev = 0;
      // funding prefix from d.F between entry open and each close
      let fi = 0; while (fi < d.F.length && d.F[fi][0] <= t.t) fi++; let fund = 0;
      for (let i = t.i0; i < B.length && B[i].time + IV < t.tExit; i++) {
        while (fi < d.F.length && d.F[fi][0] <= B[i].time + IV) { fund += t.dir * d.F[fi][1]; fi++; }
        const v = t.ww * (t.dir * (B[i].close - t.entry) / t.entry - 0.001 - fund) / t.dist, k = Math.round((B[i].time + IV - a) / IV);
        if (k >= 0 && k < len) inc[k] += v - prev; prev = v;
      }
      const k = Math.round((t.tExit - a) / IV); if (k >= 0 && k < len) inc[k] += t.ww * t.R - prev; else if (k >= len) inc[len - 1] += t.ww * t.R - prev;
    }
    let c = 0, p = 0; for (let i = 0; i < len; i++) { c += inc[i]; p = Math.max(p, c); mdd = Math.max(mdd, p - c); }
  }
  return { n: tr.length, R: e, dd, mdd, win: tr.length ? wins / tr.length : 0, avgW: tr.length ? tr.reduce((s, t) => s + t.ww, 0) / tr.length : 0, trades: tr, inc };
}
const NEW_BB = { iiShort: true, iiLen: 21, adxTh: 27, adxLen: 14, adxLo: 0.5, mult: 1.05 };
const portfolio = (bbOpt, trail, opt = {}) => [{ trades: bbTrades(bbOpt, opt), weight: WEIGHT.bb }, { trades: icTrades(opt), weight: WEIGHT.ic }, { trades: tcTrades(trail, opt), weight: WEIGHT.tc }];
module.exports = { data, adx, ii, iiAt, runBB, runT, runI, bbTrades, tcTrades, icTrades, book, portfolio, NEW_BB, COINS, WEIGHT, IV, END, T0, E, ST };
