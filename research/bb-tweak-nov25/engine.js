// engine.js: candle-by-candle PORTFOLIO replay of BB-CORE v3 with optional tweaks.
// All coins move forward together in time. At each candle close only candles up to that close are used; orders fill at
// the NEXT open; the stop is checked first inside a candle. Nothing after `endT` is read.
// With no tweak set, the trades equal intel/engines/backtest (bbcore v3) exactly (checked by check.js).
'use strict';
const C = require('../../candles/candles.js');
const E = require('../../intel/engines/backtest/engine');
const IV = 14400, FEE = 0.0005, SLIP = 0.0002;
const LIVE = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'];

// ---------- coin data and causal indicators ----------
function wrap(coin, rows, funding) {
  const n = rows.length, x = { coin, n, T: new Float64Array(n), O: new Float64Array(n), H: new Float64Array(n), L: new Float64Array(n), Cl: new Float64Array(n), V: new Float64Array(n), funding, cache: new Map() };
  rows.forEach((r, i) => { x.T[i] = r[0]; x.O[i] = r[1]; x.H[i] = r[2]; x.L[i] = r[3]; x.Cl[i] = r[4]; x.V[i] = r[5]; });
  const FT = funding.map((r) => r[0]), S = new Float64Array(funding.length + 1);
  for (let i = 0; i < funding.length; i++) S[i + 1] = S[i] + funding[i][1];
  const idx = (t) => { let lo = 0, hi = FT.length; while (lo < hi) { const m = (lo + hi) >> 1; if (FT[m] <= t) lo = m + 1; else hi = m; } return lo; };
  x.fund = (a, b) => S[idx(b)] - S[idx(a)];
  x.bars = rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  x.atr = E.atrA(x.bars, 14);
  return x;
}
const CACHE = new Map();
function load(coin, endT = Infinity) {
  const k = coin + '|' + endT;
  if (!CACHE.has(k)) CACHE.set(k, wrap(coin, C.load(coin, '4h').filter((r) => r[0] + IV <= endT), C.funding(coin).filter((r) => r[0] <= endT)));
  return CACHE.get(k);
}
const memo = (x, k, fn) => { let v = x.cache.get(k); if (v === undefined) { v = fn(); x.cache.set(k, v); } return v; };
const smaArr = (x, len) => memo(x, 'sma' + len, () => { const o = new Float64Array(x.n).fill(NaN); for (let i = len - 1; i < x.n; i++) { let s = 0; for (let j = i - len + 1; j <= i; j++) s += x.Cl[j]; o[i] = s / len; } return o; });
const sdArr = (x, len) => memo(x, 'sd' + len, () => { const m = smaArr(x, len), o = new Float64Array(x.n).fill(NaN); for (let i = len - 1; i < x.n; i++) { let v = 0; for (let j = i - len + 1; j <= i; j++) v += (x.Cl[j] - m[i]) ** 2; o[i] = Math.sqrt(v / len); } return o; });
const iiArr = (x, len) => memo(x, 'ii' + len, () => { const o = new Float64Array(x.n).fill(NaN); for (let i = len - 1; i < x.n; i++) { let s = 0, v = 0; for (let j = i - len + 1; j <= i; j++) { const r = x.H[j] - x.L[j]; if (r > 0) s += ((2 * x.Cl[j] - x.H[j] - x.L[j]) / r) * x.V[j]; v += x.V[j]; } o[i] = v > 0 ? s / v : 0; } return o; });
const adxArr = (x, len = 14) => memo(x, 'adx' + len, () => {
  const o = new Float64Array(x.n).fill(NaN); let tr = 0, p = 0, m = 0, a = 0, k = 0;
  for (let i = 1; i < x.n; i++) {
    const up = x.H[i] - x.H[i - 1], dn = x.L[i - 1] - x.L[i], pd = up > dn && up > 0 ? up : 0, md = dn > up && dn > 0 ? dn : 0;
    const t = Math.max(x.H[i] - x.L[i], Math.abs(x.H[i] - x.Cl[i - 1]), Math.abs(x.L[i] - x.Cl[i - 1]));
    if (i <= len) { tr += t; p += pd; m += md; } else { tr += t - tr / len; p += pd - p / len; m += md - m / len; }
    if (i >= len) { const s = p + m, dx = s > 0 ? (100 * Math.abs(p - m)) / s : 0; k++; if (k <= len) { a += dx / len; if (k === len) o[i] = a; } else { a = (a * (len - 1) + dx) / len; o[i] = a; } }
  }
  return o;
});
// BTC side at the same candle: +1 above its 200 average, -1 below
const btcSide = (endT) => { const b = load('BTC', endT); return memo(b, 'side', () => { const s = smaArr(b, 200), m = new Map(); for (let i = 199; i < b.n; i++) m.set(b.T[i], b.Cl[i] > s[i] ? 1 : -1); return m; }); };

// ---------- configuration: BB-CORE v3 plus tweaks (null = off) ----------
const BASE = {
  len: 20, mult: 1.8, trend: 200, minStop: 0.3, maxBars: 42, cool: 3,
  ii: null,        // { len, th, lo, side }  II% x direction must be > th; else risk x lo (0 = skip)
  adx: null,       // { max, min, lo }       ADX above max (or below min): risk x lo
  ext: null,       // { atr, lo }            stop distance above atr x ATR: risk x lo
  btc: null,       // { lo }                 against BTC's 200 average: risk x lo
  slow: null,      // { len, lo }            against a long average: risk x lo
  dirSize: 0,      // risk 1 / (1 + dirSize x other same-direction positions)
  dirCap: 0,       // at most this many positions in one direction
  throttle: null,  // { dd, mult }           risk x mult while closed-trade drawdown >= dd R
  extend: null,    // { atR, bars }          at the time exit, if open profit >= atR, hold up to `bars`
  stale: null,     // { bars, r }            after `bars` candles, exit if open profit < r
  lock: null,      // { atR, toR }           once +atR was reached, stop moves to +toR
};

// ---------- replay ----------
// opt: { coins, endT, cost (1 = normal, 2 = double fee+slippage), delayFill: (coin, openTime) => price | null }
function replay(cfg, opt = {}) {
  const o = { ...BASE, ...cfg }, coins = opt.coins || LIVE, endT = opt.endT ?? Infinity, cs = opt.cost || 1, fee = FEE * cs, slip = SLIP * cs;
  const S = coins.map((c) => {
    const x = load(c, endT);
    return { x, i: 0, mid: smaArr(x, o.len), sd: sdArr(x, o.len), tr: smaArr(x, o.trend), ii: o.ii ? iiArr(x, o.ii.len) : null, adx: o.adx ? adxArr(x) : null, slow: o.slow ? smaArr(x, o.slow.len) : null,
      pos: null, pend: null, close: false, lastGap: -Infinity, coolUntil: -1 };
  });
  const btc = o.btc ? btcSide(endT) : null;
  let t0 = Infinity, t1 = -Infinity;
  for (const s of S) if (s.x.n) { t0 = Math.min(t0, s.x.T[0]); t1 = Math.max(t1, s.x.T[s.x.n - 1]); }
  const trades = [], curveT = [], curveE = [];
  let realized = 0, peak = 0;
  const exit = (s, raw, ix, why) => {
    const p = s.pos, d = p.dir, x = s.x, px = raw * (1 - d * slip), tIn = x.T[p.i0], tOut = x.T[ix] + IV;
    const R = (d * (px - p.entry) / p.entry - 2 * fee - d * x.fund(tIn, tOut)) / p.dist;
    trades.push({ c: x.coin, dir: d, sig: p.sig, sigT: x.T[p.sig], t: tIn, tExit: tOut, R, w: p.w, why, bars: ix - p.i0 + 1 });
    realized += p.w * R; peak = Math.max(peak, realized);
    if (R <= 0 && o.cool > 0) s.coolUntil = ix + o.cool;
    s.pos = null;
  };
  for (let t = t0; t <= t1; t += IV) {
    const now = []; // coins with a candle at this time
    for (const s of S) { while (s.i < s.x.n && s.x.T[s.i] < t) s.i++; if (s.i < s.x.n && s.x.T[s.i] === t) now.push(s); }
    // ----- inside the candle: fills at the open, exits decided earlier, stop
    for (const s of now) {
      const x = s.x, i = s.i;
      if (i > 0 && x.T[i] - x.T[i - 1] !== IV) s.lastGap = i;
      if (s.pend) {
        const q = s.pend, d = q.dir; let ref = x.O[i];
        if (opt.delayFill) { const v = opt.delayFill(x.coin, x.T[i]); if (v != null) ref = v; }
        const fill = ref * (1 + d * slip), dist = Math.abs(fill - q.stop) / fill;
        if (dist > 0 && (d === 1 ? q.stop < fill : q.stop > fill)) s.pos = { dir: d, i0: i, sig: q.sig, entry: fill, stop: q.stop, dist, w: q.w, ext: fill, max: o.maxBars };
        s.pend = null;
      }
      if (s.pos && s.close) exit(s, x.O[i], i, s.close);
      s.close = false;
      const p = s.pos;
      if (p) {
        const long = p.dir === 1;
        if (long ? x.L[i] <= p.stop : x.H[i] >= p.stop) exit(s, long ? Math.min(x.O[i], p.stop) : Math.max(x.O[i], p.stop), i, 'stop');
        else if (o.lock) { p.ext = long ? Math.max(p.ext, x.H[i]) : Math.min(p.ext, x.L[i]); const oneR = p.dist * p.entry;
          if (p.dir * (p.ext - p.entry) >= o.lock.atR * oneR) { const ns = p.entry + p.dir * o.lock.toR * oneR; if (long ? ns > p.stop : ns < p.stop) p.stop = ns; } }
      }
    }
    // ----- the candle has closed: manage positions, then mark to market
    for (const s of now) {
      const p = s.pos; if (!p) continue;
      const x = s.x, i = s.i, held = i - p.i0, openR = (p.dir * (x.Cl[i] - p.entry)) / p.entry / p.dist;
      if (o.extend && held === o.maxBars && openR >= o.extend.atR) p.max = o.extend.bars;
      if (held >= p.max) s.close = 'time';
      else if (o.stale && held >= o.stale.bars && held < o.maxBars && openR < o.stale.r) s.close = 'stale';
    }
    let open = 0;
    for (const s of S) if (s.pos) { const p = s.pos, x = s.x, i = x.T[s.i] === t ? s.i : s.i - 1; open += p.w * (p.dir * (x.Cl[i] - p.entry) / p.entry - 2 * fee - p.dir * x.fund(x.T[p.i0], t + IV)) / p.dist; }
    curveT.push(t + IV); curveE.push(realized + open);
    // ----- new signals at this close
    const cand = [];
    for (const s of now) {
      if (s.pos || s.pend) continue;
      const x = s.x, i = s.i, A = x.atr[i];
      if (i < 202 || !(A > 0) || i - s.lastGap < Math.max(o.len, o.trend, 200) || i < s.coolUntil || isNaN(s.tr[i])) continue;
      const c = x.Cl[i], m = s.mid[i], up = m + o.mult * s.sd[i], lo = m - o.mult * s.sd[i], d = c > up ? 1 : c < lo ? -1 : 0;
      if (!d || (d === 1 ? c < s.tr[i] : c > s.tr[i])) continue;
      const dist = d * (c - m); if (!(dist > 0) || dist < o.minStop * A) continue;
      if (opt.skip && opt.skip(x.coin, x.T[i])) continue; // randomness test: this signal is missed
      let w = 1;
      if (o.ii && (!o.ii.side || o.ii.side === (d === 1 ? 'L' : 'S')) && !(d * s.ii[i] > o.ii.th)) w *= o.ii.lo;
      if (o.adx && (s.adx[i] > (o.adx.max ?? Infinity) || s.adx[i] < (o.adx.min ?? -Infinity))) w *= o.adx.lo;
      if (o.ext && dist > o.ext.atr * A) w *= o.ext.lo;
      if (o.btc) { const b = btc.get(x.T[i]); if (b && b !== d) w *= o.btc.lo; }
      if (o.slow && !isNaN(s.slow[i]) && d * (c - s.slow[i]) < 0) w *= o.slow.lo;
      if (w > 0) cand.push({ s, d, stop: m, w, i });
    }
    if (!cand.length) continue;
    const held = { 1: 0, '-1': 0 }; for (const s of S) { if (s.pos && !s.close) held[s.pos.dir]++; else if (s.pend) held[s.pend.dir]++; }
    const same = { 1: 0, '-1': 0 }; for (const q of cand) same[q.d]++;
    const used = { 1: 0, '-1': 0 };
    const hot = o.throttle && peak - realized >= o.throttle.dd;
    for (const q of cand) {
      if (o.dirCap && held[q.d] + used[q.d] >= o.dirCap) continue;
      let w = q.w;
      if (o.dirSize) w /= 1 + o.dirSize * (held[q.d] + same[q.d] - 1);
      if (hot) w *= o.throttle.mult;
      used[q.d]++;
      q.s.pend = { dir: q.d, stop: q.stop, sig: q.i, w };
    }
  }
  trades.sort((a, b) => a.tExit - b.tExit || a.t - b.t);
  return { trades, curveT, curveE, open: S.filter((s) => s.pos).map((s) => ({ c: s.x.coin, dir: s.pos.dir, t: s.x.T[s.pos.i0], w: s.pos.w })) };
}

// ---------- measures over a window [a, b): R by exit time; drawdown on closed trades and marked to market ----------
function measure(res, a, b, k = 1) {
  let R = 0, e = 0, pk = 0, dd = 0, st = 0, ls = 0, n = 0, wins = 0;
  const rs = [];
  for (const t of res.trades) { if (t.tExit <= a || t.tExit > b) continue; const r = k * t.w * t.R; n++; R += r; e += r; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); if (t.R > 0) { wins++; st = 0; } else ls = Math.max(ls, ++st); rs.push(r); }
  let base = null, mp = 0, mdd = 0, last = 0;
  for (let i = 0; i < res.curveT.length; i++) { const tt = res.curveT[i]; if (tt <= a) { last = res.curveE[i]; continue; } if (tt > b) break; if (base === null) base = last; const v = k * (res.curveE[i] - base); mp = Math.max(mp, v); mdd = Math.max(mdd, mp - v); }
  rs.sort((p, q) => q - p);
  return { n, R, dd, mdd, rdd: mdd > 0 ? R / mdd : 0, ls, win: n ? wins / n : 0, ex10: R - rs.slice(0, 10).reduce((s, v) => s + v, 0) };
}
// average risk per trade in a window (used to rescale a tweak to the same average risk, fixed from PAST data only)
const meanW = (res, a, b) => { let s = 0, n = 0; for (const t of res.trades) if (t.tExit > a && t.tExit <= b) { s += t.w; n++; } return n ? s / n : 1; };

module.exports = { replay, measure, meanW, load, BASE, LIVE, IV };
