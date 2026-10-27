// contenders.js — other well-known strategies as standalone contenders to bb-core, with TEXTBOOK settings (not tuned to SOL).
// Same execution rules as bb-core: decide on a CLOSED 4h candle, fill at the next open, one position at a time, stop checked before target
// inside a candle, gaps fill at the open, trailing stops / exit signals act from the next candle, same costs + real funding, same "hole in the
// last 200 candles → no new signal" rule. R = result / initial risk (entry → initial stop).
//   node contenders.js [--coins SOL] [--venue mexc]          → table
//   require('./contenders.js').runStrat(B, name, cost, funding)  → { trades, open, setup }  (used by the look-ahead check)
'use strict';
const { DEFAULTS } = require('./v2-core.js');

// ---- causal indicators: value at i uses candles 0..i only ----
const sma = (a, n) => { const o = Array(a.length).fill(null); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; };
const ema = (a, n) => { const o = Array(a.length).fill(null), k = 2 / (n + 1); let e = null; for (let i = 0; i < a.length; i++) { e = e == null ? a[i] : a[i] * k + e * (1 - k); if (i >= n - 1) o[i] = e; } return o; };
const atrW = (B, n) => { const o = Array(B.length).fill(null); let a = null, s = 0; for (let i = 0; i < B.length; i++) { const tr = i ? Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close)) : B[i].high - B[i].low; if (i < n) { s += tr; if (i === n - 1) a = s / n; } else a = (a * (n - 1) + tr) / n; o[i] = a; } return o; };
const hhPrev = (B, n) => B.map((_, i) => (i >= n ? Math.max(...B.slice(i - n, i).map((b) => b.high)) : null));   // highest high of the n candles BEFORE i
const llPrev = (B, n) => B.map((_, i) => (i >= n ? Math.min(...B.slice(i - n, i).map((b) => b.low)) : null));
const rsiW = (c, n) => { const o = Array(c.length).fill(null); let g = 0, l = 0; for (let i = 1; i < c.length; i++) { const ch = c[i] - c[i - 1]; if (i <= n) { g += Math.max(ch, 0) / n; l += Math.max(-ch, 0) / n; } else { g = (g * (n - 1) + Math.max(ch, 0)) / n; l = (l * (n - 1) + Math.max(-ch, 0)) / n; } if (i >= n) o[i] = l ? 100 - 100 / (1 + g / l) : 100; } return o; };
function supertrend(B, n = 10, m = 3) {
  const at = atrW(B, n), st = Array(B.length).fill(null), dir = Array(B.length).fill(0); let fu = null, fl = null;
  for (let i = 0; i < B.length; i++) {
    if (at[i] == null) continue;
    const hl2 = (B[i].high + B[i].low) / 2, bu = hl2 + m * at[i], bl = hl2 - m * at[i], pc = i ? B[i - 1].close : B[i].close;
    fu = fu == null || bu < fu || pc > fu ? bu : fu; fl = fl == null || bl > fl || pc < fl ? bl : fl;
    const prev = i ? dir[i - 1] : 0;
    dir[i] = prev === 1 ? (B[i].close < fl ? -1 : 1) : prev === -1 ? (B[i].close > fu ? 1 : -1) : (B[i].close > hl2 ? 1 : -1);
    st[i] = dir[i] === 1 ? fl : fu;
  }
  return { st, dir };
}

// ---- the contenders. entry(i) → { dir, stop, tpR?, maxBars? } or null; exit(i, p) → true = close at next open; trail(i, p) → new stop or null ----
function build(name, B) {
  const C = B.map((b) => b.close), A14 = atrW(B, 14), A20 = atrW(B, 20), A10 = atrW(B, 10), S200 = sma(C, 200), S5 = sma(C, 5);
  const trendOK = (i, d) => S200[i] != null && (d === 1 ? C[i] > S200[i] : C[i] < S200[i]);
  const em = /^ema(\d+)\/(\d+)(?::([\d.]+))?(-trend)?$/.exec(name);
  if (em) {                                                                       // EMA fast/slow cross, stop k × ATR(14) (default 2), exit on the opposite cross
    const F = ema(C, +em[1]), S = ema(C, +em[2]), k = em[3] ? +em[3] : 2, x = (i) => (F[i] > S[i] ? 1 : -1);
    return { warm: 202, entry: (i) => (S[i - 1] != null && x(i) !== x(i - 1) && (!em[4] || trendOK(i, x(i))) ? { dir: x(i), stop: C[i] - x(i) * k * A14[i] } : null), exit: (i, p) => x(i) !== p.dir };
  }
  switch (name) {
    case 'donchian20': case 'donchian55': case 'donchian20-trend': {             // Turtle: break of the prior N-candle high/low, stop 2 ATR(20), exit on the M-candle opposite break
      const N = name === 'donchian55' ? 55 : 20, M = name === 'donchian55' ? 20 : 10, H = hhPrev(B, N), L = llPrev(B, N), h = hhPrev(B, M), l = llPrev(B, M);
      return { warm: 202, entry: (i) => { if (H[i] == null || A20[i] == null) return null; const d = C[i] > H[i] ? 1 : C[i] < L[i] ? -1 : 0; if (!d || (name.endsWith('trend') && !trendOK(i, d))) return null; return { dir: d, stop: C[i] - d * 2 * A20[i] }; },
        exit: (i, p) => (p.dir === 1 ? C[i] < l[i] : C[i] > h[i]) };
    }
    case 'keltner': {                                                             // close beyond EMA20 ± 2 ATR(10) with the 200 SMA, stop and trailing stop = EMA20
      const E20 = ema(C, 20);
      return { warm: 202, entry: (i) => { if (E20[i] == null || A10[i] == null) return null; const d = C[i] > E20[i] + 2 * A10[i] ? 1 : C[i] < E20[i] - 2 * A10[i] ? -1 : 0; return d && trendOK(i, d) ? { dir: d, stop: E20[i] } : null; },
        trail: (i) => E20[i] };
    }
    case 'supertrend': {                                                          // Supertrend(10,3): enter on a flip, stop = the line, trails with it
      const { st, dir } = supertrend(B, 10, 3);
      return { warm: 202, entry: (i) => (dir[i] && dir[i - 1] && dir[i] !== dir[i - 1] ? { dir: dir[i], stop: st[i] } : null), trail: (i, p) => (dir[i] === p.dir ? st[i] : null), exit: (i, p) => dir[i] !== p.dir };
    }
    case 'ema20/50': {                                                            // EMA 20/50 cross, stop 2 ATR(14), exit on the opposite cross
      const F = ema(C, 20), S = ema(C, 50), x = (i) => (F[i] > S[i] ? 1 : -1);
      return { warm: 202, entry: (i) => (S[i - 1] != null && x(i) !== x(i - 1) ? { dir: x(i), stop: C[i] - x(i) * 2 * A14[i] } : null), exit: (i, p) => x(i) !== p.dir };
    }
    case 'macd': {                                                                // MACD(12,26,9) signal cross with the 200 SMA, stop 2 ATR, exit on the opposite cross
      const e12 = ema(C, 12), e26 = ema(C, 26), m = e12.map((v, i) => (v != null && e26[i] != null ? v - e26[i] : null)), m0 = m.map((v) => v ?? 0), sg = ema(m0, 9), x = (i) => (m[i] > sg[i] ? 1 : -1);
      return { warm: 202, entry: (i) => (m[i - 1] != null && x(i) !== x(i - 1) && trendOK(i, x(i)) ? { dir: x(i), stop: C[i] - x(i) * 2 * A14[i] } : null), exit: (i, p) => x(i) !== p.dir };
    }
    case 'rsi2': {                                                                // Connors RSI(2) pullback: buy RSI2<10 above the 200 SMA (short >90 below), exit when the close crosses the 5 SMA, 3-ATR safety stop, 10 candles max
      const r = rsiW(C, 2);
      return { warm: 202, entry: (i) => { const d = r[i] < 10 ? 1 : r[i] > 90 ? -1 : 0; return d && trendOK(i, d) ? { dir: d, stop: C[i] - d * 3 * A14[i], maxBars: 10 } : null; },
        exit: (i, p) => (p.dir === 1 ? C[i] > S5[i] : C[i] < S5[i]) };
    }
    case 'nr7': {                                                                 // NR7: the previous candle had the narrowest range of 7; this close breaks it (with the 200 SMA). Stop = other side, 2R target, 12 candles
      const rng = B.map((b) => b.high - b.low);
      return { warm: 202, entry: (i) => { const j = i - 1; if (j < 7 || !(rng[j] <= Math.min(...rng.slice(j - 6, j + 1)))) return null; const d = C[i] > B[j].high ? 1 : C[i] < B[j].low ? -1 : 0; return d && trendOK(i, d) ? { dir: d, stop: d === 1 ? B[j].low : B[j].high, tpR: 2, maxBars: 12 } : null; } };
    }
    default: throw new Error('unknown strategy ' + name);
  }
}
const NAMES = ['donchian20', 'donchian20-trend', 'donchian55', 'keltner', 'supertrend', 'ema20/50', 'macd', 'rsi2', 'nr7'];

function runStrat(B, name, cost = DEFAULTS.cost, funding = null) {
  const S = build(name, B), trades = [], iv = DEFAULTS.interval;
  let pos = null, pend = null, pendExit = false, lastGap = -Infinity;
  for (let i = 0; i < B.length; i++) {
    const c = B[i];
    if (i > 0 && c.time - B[i - 1].time !== iv) lastGap = i;
    if (pend) {
      const d = pend.dir, fill = c.open * (1 + d * cost.slip), risk = Math.abs(fill - pend.stop);
      if (risk > 0 && (d === 1 ? pend.stop < fill : pend.stop > fill)) pos = { dir: d, entry: fill, stop: pend.stop, stop0: pend.stop, i0: i, risk, dist: risk / fill, tp: pend.tpR ? fill + d * pend.tpR * risk : null, maxBars: pend.maxBars ?? null };
      pend = null;
    }
    if (pendExit && pos) exit(c.open * (1 - pos.dir * cost.slip), i, cost.timeFee, 'exit');
    pendExit = false;
    if (pos) {
      const d = pos.dir;
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * cost.slip), i, cost.stopFee, pos.stop === pos.stop0 ? 'stop' : 'trail');
      else if (pos.tp != null && (d === 1 ? c.high >= pos.tp * (1 + cost.tpBuf) : c.low <= pos.tp * (1 - cost.tpBuf))) exit((d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open)) * (1 - d * cost.tpSlip), i, cost.tpFee, 'target');
    }
    if (pos) {                                                                    // candle closed
      if (S.trail) { const ns = S.trail(i, pos); if (ns != null && (pos.dir === 1 ? ns > pos.stop && ns < c.close : ns < pos.stop && ns > c.close)) pos.stop = ns; }
      if ((S.exit && S.exit(i, pos)) || (pos.maxBars && i - pos.i0 + 1 >= pos.maxBars)) pendExit = true;
      continue;
    }
    if (i < S.warm || i - lastGap < 200) continue;
    const s = S.entry(i);
    if (s && Number.isFinite(s.stop)) pend = s;
  }
  return { trades, open: pos, setup: pend };
  function exit(px, i, fee, why) {
    let fr = 0;
    if (funding) { const te = B[pos.i0].time, tx = B[i].time + 7200; for (const [t, r] of funding) { if (t > tx) break; if (t > te) fr += r; } }
    trades.push({ dir: pos.dir, i0: pos.i0, i1: i, t: B[pos.i0].time, tExit: B[i].time + iv, entry: pos.entry, exit: px, R: (pos.dir * (px - pos.entry) / pos.entry - cost.entryFee - fee - pos.dir * fr) / pos.dist, why, bars: i - pos.i0 + 1 });
    pos = null;
  }
}
module.exports = { runStrat, NAMES };

if (require.main === module) {
  const { backtest, scaleCost } = require('./v2-core.js'), { summarize } = require('./v2-core.js'), { loadCoin } = require('./load.js');
  const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
  const COIN = opt('coins', 'SOL'), BIN = loadCoin(COIN), MEX = loadCoin(COIN, 'mexc'), SPLIT = Date.UTC(2023, 0, 1) / 1000;
  function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const ex = (rs) => { const n = rs.length; if (!n) return { m: NaN, lo: NaN, hi: NaN, t: NaN }; const m = rs.reduce((a, r) => a + r, 0) / n, sd = Math.sqrt(rs.reduce((a, r) => a + (r - m) ** 2, 0) / Math.max(1, n - 1)), r = rng(3), ms = []; for (let b = 0; b < 2000; b++) { let s = 0; for (let i = 0; i < n; i++) s += rs[Math.floor(r() * n)]; ms.push(s / n); } ms.sort((a, b) => a - b); return { m, lo: ms[50], hi: ms[1949], t: m / (sd / Math.sqrt(n)) }; };
  const months = (t) => { const o = {}; for (const x of t) { const k = new Date(x.tExit * 1000).toISOString().slice(0, 7); o[k] = (o[k] || 0) + x.R; } return o; };
  const corr = (a, b) => { const ks = [...new Set([...Object.keys(a), ...Object.keys(b)])], x = ks.map((k) => a[k] || 0), y = ks.map((k) => b[k] || 0), mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sx * sy); };
  const f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3), f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
  const years = (BIN.B[BIN.B.length - 1].time - BIN.B[202].time) / 31557600;
  const runAny = (name, D, k = 1) => (name === 'bb-core' ? backtest(D.B, { cost: scaleCost(DEFAULTS.cost, k) }, D.funding).trades : runStrat(D.B, name, scaleCost(DEFAULTS.cost, k), D.funding).trades);
  const bbM = months(runAny('bb-core', BIN));
  console.log(`# Contenders vs bb-core — ${COIN}, 4h, textbook settings, real costs + funding\n`);
  console.log('E = expectancy (average R per trade). 2020–22 / 2023+ split by entry date. Corr = correlation of monthly R with bb-core (low = good partner to run alongside).\n');
  console.log('| strategy | trades | win% | **E** | 95% range | t | total R | R/yr | maxDD R | R/DD | yrs+ | E 2020–22 | E 2023+ | MEXC E | 2× costs E | corr w/ bb-core |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const name of ['bb-core', ...NAMES, 'ema10/50', 'ema20/100', 'ema50/100']) {
    const t = runAny(name, BIN), s = summarize(t), e = ex(t.map((x) => x.R)), ys = Object.values(s.years);
    const e1 = ex(t.filter((x) => x.t < SPLIT).map((x) => x.R)), e2 = ex(t.filter((x) => x.t >= SPLIT).map((x) => x.R));
    console.log(`| ${name === 'bb-core' ? '**bb-core**' : name} | ${s.n} | ${(s.win * 100).toFixed(0)}% | **${f3(e.m)}** | ${e.lo.toFixed(2)}…${e.hi.toFixed(2)} | ${e.t.toFixed(1)} | ${f1(s.R)} | ${f1(s.R / years)} | ${s.dd.toFixed(1)} | ${(s.R / s.dd).toFixed(1)} | ${ys.filter((v) => v > 0).length}/${ys.length} | ${f3(e1.m)} | ${f3(e2.m)} | ${f3(ex(runAny(name, MEX).map((x) => x.R)).m)} | ${f3(ex(runAny(name, BIN, 2).map((x) => x.R)).m)} | ${name === 'bb-core' ? '—' : corr(bbM, months(t)).toFixed(2)} |`);
  }
}
