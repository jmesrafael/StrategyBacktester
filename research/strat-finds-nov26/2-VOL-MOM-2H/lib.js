// lib.js — shared harness for the 1h "every year positive" hunt (Nov 26, 2026).
// Uses the repo's no-lookahead engine (../strat-hunt-nov6/engine.js: decide on a CLOSED 1h bar, fill at the NEXT open,
// stop checked first, gaps fill at the open, 0.05% fee + 0.02% slippage per side + real Binance funding) and the local
// candle library (../../candles, closed bars only). Indicators come from ../strat-hunt-nov6/ind.js (causal).
'use strict';
const C = require('../../candles/candles.js');
const { run, stats, COST } = require('../strat-hunt-nov6/engine.js');
const I = require('../strat-hunt-nov6/ind.js');

// Main basket: every major with a Binance perp from 2020 (SOL/AVAX/DOT/NEAR/DOGE join later in 2020).
const MAIN = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'LINK', 'BNB', 'DOGE', 'AVAX', 'DOT', 'NEAR', 'ZEC'];
// Hold-out basket: never used to pick or tune; only for the cross-coin check at the end.
const HOLD = ['LTC', 'BCH', 'TRX', 'ETC', 'XLM', 'ATOM', 'UNI', 'FIL', 'AAVE', 'ALGO', 'XTZ', 'VET'];
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const START = Date.parse('2020-01-01') / 1000;
const IV = 7200;
const GAPS = [];

// 2h bars aligned to even UTC hours; a bar exists only if both 1h halves exist (closed bars only)
function resample(rows) {
  const out = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i], b = rows[i + 1];
    if (a[0] % 7200 === 0 && b[0] === a[0] + 3600)
      out.push({ time: a[0], open: a[1], high: Math.max(a[2], b[2]), low: Math.min(a[3], b[3]), close: b[4], volume: a[5] + b[5] });
  }
  return out;
}
const cache = new Map();
function coin(sym) {
  if (cache.has(sym)) return cache.get(sym);
  const B = resample(C.load(sym, '1h', { from: START }));
  for (let i = 1; i < B.length; i++) if (B[i].time - B[i - 1].time !== IV) GAPS.push(sym + ':' + B[i].time);
  const O = Float64Array.from(B, (b) => b.open), H = Float64Array.from(B, (b) => b.high), L = Float64Array.from(B, (b) => b.low),
    Cl = Float64Array.from(B, (b) => b.close), V = Float64Array.from(B, (b) => b.volume);
  const ctx = { sym, B, n: B.length, O, H, L, C: Cl, V, atr14: I.atr(H, L, Cl, 14), funding: C.funding(sym), memo: new Map() };
  // memo(key, fn): cache an indicator per coin so parameter scans don't recompute it
  ctx.m = (key, fn) => { if (!ctx.memo.has(key)) ctx.memo.set(key, fn()); return ctx.memo.get(key); };
  cache.set(sym, ctx);
  return ctx;
}
// Slice a context to its first `cut` bars (for the truncation / look-ahead audit).
function truncated(ctx, cut) {
  const B = ctx.B.slice(0, cut);
  const O = ctx.O.slice(0, cut), H = ctx.H.slice(0, cut), L = ctx.L.slice(0, cut), Cl = ctx.C.slice(0, cut), V = ctx.V.slice(0, cut);
  const c = { sym: ctx.sym, B, n: cut, O, H, L, C: Cl, V, atr14: I.atr(H, L, Cl, 14), funding: ctx.funding, memo: new Map() };
  c.m = (key, fn) => { if (!c.memo.has(key)) c.memo.set(key, fn()); return c.memo.get(key); };
  return c;
}

const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
// strat(ctx) -> { L, S, stopL?, stopS?, xL?, xS?, warmup }, ex = { kInit, kTrail, maxBars, sigExit }
function evaluate(strat, ex, coins = MAIN, costMul = 1, keepTrades = false) {
  const cost = { fee: COST.fee * costMul, slip: COST.slip * costMul };
  const all = [], perCoin = {};
  for (const s of coins) {
    const c = coin(s), st = strat(c), e = typeof ex === 'function' ? ex(c) : ex;
    const r = run(c.B, c.atr14, st, e, c.funding, IV, cost);
    let sum = 0; for (const t of r.trades) { t.coin = s; sum += t.R; all.push(t); }
    perCoin[s] = { n: r.trades.length, R: sum };
  }
  const st = stats(all), years = {};
  for (const y of YEARS) years[y] = st.years[y] || 0;
  const posYears = YEARS.filter((y) => years[y] > 0).length;
  const worst = Math.min(...YEARS.map((y) => years[y]));
  // fat tails: total without the top 10 winners
  const sorted = all.map((t) => t.R).sort((a, b) => b - a);
  const ex10 = st.total - sorted.slice(0, 10).reduce((a, b) => a + b, 0);
  const coinsPos = Object.values(perCoin).filter((p) => p.R > 0).length;
  const res = { n: st.n, total: st.total, exp: st.exp, pf: st.pf, win: st.win, dd: st.dd, rdd: st.rdd, years, posYears, worst, ex10, coinsPos, perCoin };
  if (keepTrades) res.trades = all;
  return res;
}
const fmt = (r) => `n=${r.n} R=${r.total.toFixed(0)} exp=${r.exp.toFixed(3)} pf=${r.pf.toFixed(2)} dd=${r.dd.toFixed(0)} r/dd=${r.rdd.toFixed(1)} yrs=${r.posYears}/7 worst=${r.worst.toFixed(0)} ex10=${r.ex10.toFixed(0)} coins+=${r.coinsPos} | ` + YEARS.map((y) => `${String(y).slice(2)}:${r.years[y].toFixed(0)}`).join(' ');

module.exports = { GAPS, C, I, run, stats, COST, MAIN, HOLD, YEARS, coin, truncated, evaluate, fmt, IV, yearOf };
