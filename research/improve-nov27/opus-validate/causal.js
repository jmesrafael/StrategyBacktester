// causal.js - independent, strictly causal event-driven backtest of TRI-CORE (BB-CORE v4, I-CORE v3, T-CORE v3) and the
// "crowded side" sizing rule. Written from the live bot rules (bb-trail/icore-core.js, js/icore-core.js, js/bbcore-core.js,
// intel/engines/backtest/strategies.js v3 parameters, BBCORE-V4-INSTALL-WHEN-HOME.md) - not copied from the research sims.
//
// How look-ahead is made impossible:
//   * Market keeps every candle in a closure. The only way to get data is market.step(t), which returns the bars that CLOSED
//     in (t-1h, t] and the funding events in (t-1h, t]. The clock only moves forward (step() throws if t goes back).
//   * Each bot/coin slot builds its OWN history from the bars pushed to it, and every indicator reads that history only.
//   * Orders decided at a close fill at the open of a later 1h bar (seen only when that bar arrives); stops are checked hour by
//     hour on 1h bars (gap-aware: a 1h bar opening past the stop fills at its open); funding is paid when the event happens.
//   * Account equity used for sizing = cash + open trades marked at the last closed 1h close.
'use strict';
const path = require('path');
const C = require(path.join(__dirname, '../../../candles/candles.js'));
const DET = require(path.join(__dirname, '../../zec-replacement-2/detail.json'));
const DL = Array.isArray(DET) ? DET : DET.data || Object.values(DET);
const H = 3600, IV = 14400, FEE = 0.0005, SLIP = 0.0002;
const T0 = Date.UTC(2020, 0, 1) / 1000, END = Date.UTC(2026, 10, 24) / 1000, CUT = Date.UTC(2024, 0, 1) / 1000, PHP = 60;
const COINS = { bb: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'], ic: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH'], tc: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'] };
const WEIGHT = { bb: 0.5, ic: 0.25, tc: 0.25 };
const SPEC = {};
for (const c of new Set(Object.values(COINS).flat())) { const d = DL.find((s) => s.symbol === c + '_USDT'); SPEC[c] = { cs: +d.contractSize, minVol: +d.minVol || 1, step: +d.volUnit || 1, mmr: +d.maintenanceMarginRate || 0.004, maxLev: +d.maxLeverage || 20 }; }

// ------------------------------------------------------------------ market (the only data source) ------------------------
// opt.cut: bars closing after cut are removed ('truncate') or replaced by random junk ('corrupt'); same for funding.
const RAW = {};
function raw(coin) {
  if (!RAW[coin]) RAW[coin] = { h4: C.load(coin, '4h'), h1: C.load(coin, '1h'), f: C.funding(coin) };
  return RAW[coin];
}
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function doctor(rows, tf, cut, mode, r) {
  if (cut == null) return rows;
  const keep = rows.filter((x) => x[0] + tf <= cut);
  if (mode !== 'corrupt') return keep;
  let p = keep.length ? keep[keep.length - 1][4] : 1;
  return keep.concat(rows.filter((x) => x[0] + tf > cut).map((x) => { p = Math.max(1e-6, p * Math.exp((r() - 0.5) * 0.4)); const o = p * (1 + (r() - 0.5) * 0.1), h = Math.max(o, p) * (1 + r() * 0.2), l = Math.min(o, p) * (1 - r() * 0.2); return [x[0], o, h, l, p, r() * 1e7]; }));
}
function market(coins, opt = {}) {
  const r = rng(opt.seed || 7), D = {};
  for (const c of coins) {
    const R = raw(c);
    const f = opt.cut == null ? R.f : opt.mode === 'corrupt' ? R.f.map((x) => (x[0] <= opt.cut ? x : [x[0], (r() - 0.5) * 0.02])) : R.f.filter((x) => x[0] <= opt.cut);
    D[c] = { h4: doctor(R.h4, IV, opt.cut, opt.mode, r), h1: doctor(R.h1, H, opt.cut, opt.mode, r), f, i4: 0, i1: 0, iF: 0 };
  }
  let now = -Infinity;
  return {
    first() { let t = Infinity; for (const c of coins) if (D[c].h4.length) t = Math.min(t, D[c].h4[0][0]); return t; },
    // everything that closed in (t - 1h, t]. Frozen copies: the caller cannot reach the arrays.
    step(t) {
      if (!(t > now)) throw new Error('clock moved back'); now = t;
      const out = { h1: {}, h4: {}, f: {} };
      for (const c of coins) {
        const d = D[c];
        while (d.i1 < d.h1.length && d.h1[d.i1][0] + H <= t) { const x = d.h1[d.i1++]; if (x[0] + H > t - H) out.h1[c] = Object.freeze({ t: x[0], o: x[1], h: x[2], l: x[3], c: x[4] }); }
        while (d.i4 < d.h4.length && d.h4[d.i4][0] + IV <= t) { const x = d.h4[d.i4++]; if (x[0] + IV > t - H) out.h4[c] = Object.freeze({ t: x[0], o: x[1], h: x[2], l: x[3], c: x[4], v: x[5] }); }
        while (d.iF < d.f.length && d.f[d.iF][0] <= t) { const x = d.f[d.iF++]; if (x[0] > t - H) (out.f[c] || (out.f[c] = [])).push([x[0], x[1]]); }
      }
      return out;
    },
  };
}

// ------------------------------------------------------------------ one bot on one coin: history, indicators, rules -------
const RULES = {
  // BB-CORE v4: Bollinger(20, 1.8) close beyond the band, with SMA200; stop = middle band (>= 0.3 ATR(14, variant A));
  // shorts only if Intraday Intensity(21) < 0; half size if ADX(14) > 27; time exit at the next open after 42 candles; 3 candle wait after a loss.
  bb: { atr: 'A', warmup: 202, bbLen: 20, bbMult: 1.8, level: true, maxBars: 42, nextOpen: true, cool: 3, kTrail: 0, lockAtR: 0, staleBars: 0, v4: true },
  // I-CORE v3: Ichimoku (9, 26, 52) cloud break with SMA200, stop 1.75 ATR (variant B), trail 7 ATR, lock +1R once +4R ahead, safety exit 600 candles
  ic: { atr: 'B', warmup: 205, ichi: true, kInit: 1.75, kTrail: 7, lockAtR: 4, lockToR: 1, staleBars: 0, maxBars: 600, cool: 0 },
  // T-CORE v3: Bollinger(30, 2) entry with SMA200 and the 0.3 ATR filter, stop 2 ATR, trail 14 ATR, out if under +1R after 48 candles, safety 1200
  tc: { atr: 'B', warmup: 205, bbLen: 30, bbMult: 2, kInit: 2, kTrail: 14, lockAtR: 0, lockToR: 1, staleBars: 48, staleR: 1, maxBars: 1200, cool: 0 },
};
class Slot {
  constructor(bot, coin, spec) {
    this.bot = bot; this.coin = coin; this.S = { ...RULES[bot], ...spec };
    this.T = []; this.O = []; this.Hh = []; this.L = []; this.Cc = []; this.V = []; this.P = [0]; this.trs = []; this.atr = [];
    this.adx = []; this.ax = { tr: 0, p: 0, m: 0, a: 0, k: 0 };
    this.lastGap = -Infinity; this.coolUntil = -1; this.pos = null; this.pend = null; this.pendExit = null;
  }
  get n() { return this.Cc.length; }
  push(b) { // a 4h bar that has CLOSED
    const i = this.Cc.length;
    if (i > 0 && b.t - this.T[i - 1] !== IV) this.lastGap = i;
    this.T.push(b.t); this.O.push(b.o); this.Hh.push(b.h); this.L.push(b.l); this.Cc.push(b.c); this.V.push(b.v); this.P.push(this.P[i] + b.c);
    const tr = i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - this.Cc[i - 1]), Math.abs(b.l - this.Cc[i - 1]));
    this.trs.push(tr);
    if (this.S.atr === 'A') { // Wilder, seed = mean of TR 0..13 at index 13
      const a = i === 13 ? this.trs.slice(0, 14).reduce((x, y) => x + y, 0) / 14 : i > 13 ? (this.atr[i - 1] * 13 + tr) / 14 : null; this.atr.push(a);
    } else { // Wilder, seed = mean of TR 1..14 at index 14
      const a = i === 14 ? this.trs.slice(1, 15).reduce((x, y) => x + y, 0) / 14 : i > 14 ? (this.atr[i - 1] * 13 + tr) / 14 : null; this.atr.push(a);
    }
    if (this.S.v4) { // ADX(14), Wilder
      let v = NaN; const s = this.ax;
      if (i >= 1) {
        const up = b.h - this.Hh[i - 1], dn = this.L[i - 1] - b.l, pd = up > dn && up > 0 ? up : 0, md = dn > up && dn > 0 ? dn : 0;
        if (i <= 14) { s.tr += tr; s.p += pd; s.m += md; } else { s.tr += tr - s.tr / 14; s.p += pd - s.p / 14; s.m += md - s.m / 14; }
        if (i >= 14) { const q = s.p + s.m, dx = q > 0 ? (100 * Math.abs(s.p - s.m)) / q : 0; s.k++; if (s.k <= 14) { s.a += dx / 14; if (s.k === 14) v = s.a; } else { s.a = (s.a * 13 + dx) / 14; v = s.a; } }
      }
      this.adx.push(v);
    }
    return i;
  }
  band(i, len, mult) { let s = 0; for (let j = i - len + 1; j <= i; j++) s += this.Cc[j]; const m = s / len; let v = 0; for (let j = i - len + 1; j <= i; j++) v += (this.Cc[j] - m) ** 2; const sd = Math.sqrt(v / len); return { mid: m, up: m + mult * sd, lo: m - mult * sd }; }
  hl(e, len) { let h = -Infinity, l = Infinity; for (let j = e - len + 1; j <= e; j++) { if (this.Hh[j] > h) h = this.Hh[j]; if (this.L[j] < l) l = this.L[j]; } return (h + l) / 2; }
  cloud(i) { const e = i - 26, a = (this.hl(e, 9) + this.hl(e, 26)) / 2, b = this.hl(e, 52); return { top: Math.max(a, b), bot: Math.min(a, b) }; }
  ii(i) { let s = 0, v = 0; for (let j = i - 20; j <= i; j++) { const r = this.Hh[j] - this.L[j]; if (r > 0) s += ((2 * this.Cc[j] - this.Hh[j] - this.L[j]) / r) * this.V[j]; v += this.V[j]; } return v > 0 ? s / v : 0; }
  // the entry rule on the candle that just closed (index i = last pushed). Returns { dir, stop?, w } or null
  signal(i) {
    const S = this.S, c = this.Cc[i];
    if (i < 199) return null;
    const sma = (this.P[i + 1] - this.P[i - 199]) / 200;
    if (S.ichi) {
      if (i < 78) return null;
      const k = this.cloud(i), p = this.cloud(i - 1);
      if (c > k.top && this.Cc[i - 1] <= p.top && c > sma) return { dir: 1, w: 1 };
      if (c < k.bot && this.Cc[i - 1] >= p.bot && c < sma) return { dir: -1, w: 1 };
      return null;
    }
    const b = this.band(i, S.bbLen, S.bbMult), d = c > b.up ? 1 : c < b.lo ? -1 : 0;
    if (!d) return null;
    if (S.level) { if (d === 1 ? c < sma : c > sma) return null; }         // BB-CORE: with (or on) the 200 average
    else if (d === 1 ? !(c > sma) : !(c < sma)) return null;                // T-CORE: strictly beyond it
    const z = Math.abs(c - b.mid);
    if (!(z > 0) || z < 0.3 * this.atr[i]) return null;                    // stop too tight
    let w = 1;
    if (S.v4) { if (d === -1 && !(this.ii(i) < 0)) return null; if (this.adx[i] > 27) w = 0.5; }
    return { dir: d, stop: S.level ? c - d * z : null, w };
  }
  canSignal(i) { const S = this.S; return this.blockAt !== i && !this.pos && !this.pend && !this.pendExit && i >= S.warmup && this.atr[i] > 0 && i - this.lastGap >= 200 && i >= this.coolUntil; }
}

// ------------------------------------------------------------------ the run --------------------------------------------------
// o: { from, to, start (USD), mode 'flat'|'live', K, bbMult (1.05), rule(N) -> size multiplier | null, cap (USD risk cap, 0 = none),
//      exitAtClose (research convention for stale/time exits, default false = next open), hourStops (default true),
//      delayH (fill delay in hours), cost (fee/slip multiplier), extraSlip (fraction), miss (prob. a signal is missed), seed,
//      order 'live'|'reverse'|'alpha', countClosing (count trades exiting at this close in N), market (custom), log (array),
//      sizeFn(ctx) -> multiplier (override for controls), bots (subset/weights), coins (override per bot) }
function run(o = {}) {
  const from = o.from ?? T0, to = o.to ?? END, start = o.start ?? 1000 / PHP, live = o.mode === 'live', K = o.K ?? 1, bbMult = o.bbMult ?? 1.05;
  const fee = FEE * (o.cost ?? 1), slip = SLIP * (o.cost ?? 1) + (o.extraSlip || 0), delay = o.delayH || 0, hourStops = o.hourStops !== false;
  const weights = o.weights || WEIGHT, coinsOf = o.coins || COINS, log = o.log || null, rule = o.rule || null;
  const ids = Object.keys(weights).filter((b) => weights[b] > 0);
  const allCoins = [...new Set(ids.flatMap((b) => coinsOf[b]))];
  const mk = o.market || market(allCoins, o.marketOpt || {});
  const W = ids.map((id) => {
    let cs = [...coinsOf[id]]; if (o.order === 'reverse') cs.reverse(); if (o.order === 'alpha') cs.sort();
    return { id, weight: weights[id], bal: start * weights[id], margin: 0, peakBase: 0, slots: cs.map((c) => new Slot(id, c, o.spec && o.spec[id])) };
  });
  const slots = W.flatMap((w) => w.slots.map((s) => [w, s]));
  const last = {}; // last closed 1h close per coin (for marks)
  const missR = rng(o.seed || 12345), missMap = new Map();
  const missed = (w, s, t) => { if (!o.miss) return false; const k = w.id + s.coin + t; if (!missMap.has(k)) missMap.set(k, missR() < o.miss); return missMap.get(k); };
  const trades = [], curve = [], stat = { signals: 0, orders: 0, skipMin: 0, skipMargin: 0, skipBad: 0, missed: 0 };
  let lastQ = null, equity = start;
  let clock = 0; // the moment the engine is at; every logged event carries it
  const ev = (s) => { if (log) log.push(clock + ' ' + s); };
  const unreal = (s) => { const p = s.pos; return p ? p.dir * p.qty * ((last[s.coin] ?? p.entry) - p.entry) : 0; };
  const markAll = () => { let e = 0; for (const w of W) { e += w.bal; for (const s of w.slots) e += unreal(s); } return e; };

  function close(w, s, px, t, why, i) {
    const p = s.pos, x = px * (1 - p.dir * slip), gross = p.dir * p.qty * (x - p.entry), fx = fee * p.qty * x;
    w.bal += gross - fx; w.margin -= p.margin;
    const pnl = gross - fx - p.feeIn - p.fund, risk1 = p.qty * Math.abs(p.entry - p.stop0), R = risk1 > 0 ? pnl / risk1 : 0;
    // research-style R (same formula as the bots' backtests) for the cool-down decision
    const Rb = (p.dir * (x - p.entry) / p.entry - 2 * fee - p.fundRate * p.dir) / p.dist;
    if (Rb <= 0 && s.S.cool > 0) s.coolUntil = i + s.S.cool;
    const tr = { bot: w.id, coin: s.coin, dir: p.dir, sigT: p.sigT, t: p.t, tExit: t, entry: p.entry, exit: x, why, qty: p.qty, risk: p.risk, target: p.target, pnl, R, Rb, dist: p.dist, N: p.N, mult: p.mult, w: p.w, i0: p.i0, i1: i };
    if (!p.phantom) trades.push(tr); s.pos = null; s.pendExit = null;
    ev(`X ${w.id} ${s.coin} ${t} ${why} ${x} ${pnl}`);
  }
  function fill(w, s, px, t) {
    const q = s.pend; s.pend = null;
    const d = q.dir, f = px * (1 + d * slip);
    let stop, dist;
    if (s.S.level) { stop = q.stop; dist = Math.abs(f - stop) / f; if (!(dist > 0) || (d === 1 ? stop >= f : stop <= f)) { stat.skipBad++; ev(`B ${w.id} ${s.coin} ${t}`); return; } }
    else { stop = f - d * s.S.kInit * q.atr; dist = (s.S.kInit * q.atr) / f; }
    let target = q.target, qty = target / (dist * f), margin = 0;
    if (live) {
      const sp = SPEC[s.coin], one = sp.cs * f, per = one * dist;
      let vol = Math.round(target / per / sp.step) * sp.step; if (vol < sp.minVol) vol = sp.minVol;
      while (vol >= sp.minVol && vol * per > 1.5 * target) vol -= sp.step;
      if (vol < sp.minVol) { stat.skipMin++; ev(`M ${w.id} ${s.coin} ${t}`); if (o.phantom) phantomPos(s, d, f, stop, dist, px, t, q); return; }
      qty = vol * sp.cs;
      const lev = Math.max(1, Math.min(20, sp.maxLev, Math.floor(0.5 / (dist + sp.mmr))));
      margin = (qty * f) / lev;
      if (!(w.bal - w.margin >= margin * 1.1)) { stat.skipMargin++; ev(`G ${w.id} ${s.coin} ${t}`); if (o.phantom) phantomPos(s, d, f, stop, dist, px, t, q); return; }
    }
    const feeIn = fee * qty * f; w.bal -= feeIn; w.margin += margin;
    s.pos = { dir: d, t, sigT: q.sigT, i0: s.n, entry: f, stop0: stop, stop, dist, ext: px, qty, margin, feeIn, fund: 0, fundRate: 0, risk: qty * Math.abs(f - stop), target, N: q.N, mult: q.mult, w: q.w };
    ev(`F ${w.id} ${s.coin} ${t} ${f} ${qty} ${stop}`);
  }

  // research-engine convention (o.phantom): a trade the account could not take still occupies the coin (exits, cool-down) with size 0
  function phantomPos(s, d, f, stop, dist, px, t, q) { s.pos = { dir: d, t, sigT: q.sigT, i0: s.n, entry: f, stop0: stop, stop, dist, ext: px, qty: 0, margin: 0, feeIn: 0, fund: 0, fundRate: 0, risk: 0, target: q.target, N: q.N, mult: q.mult, w: q.w, phantom: true }; }
  const tStart = Math.max(Math.floor(mk.first() / H) * H + H, 0);
  for (let t = tStart; t <= to; t += H) {
    clock = t; const m = mk.step(t);
    for (const c in m.h1) last[c] = m.h1[c].c;
    const openHour = (t - H) % IV === 0;
    // 1. the 1h bar (t-1h, t]: pending exits, then pending entries, at its open; then stops inside it
    for (const [w, s] of slots) {
      const b = m.h1[s.coin]; if (!b) continue;
      if (s.pendExit && b.t >= s.pendExit.at) { const pe = s.pendExit; s.pendExit = null; close(w, s, b.o, b.t, pe.why, s.n); }
    }
    for (const [w, s] of slots) {
      const b = m.h1[s.coin]; if (!b) continue;
      if (s.pend && b.t >= s.pend.at) fill(w, s, b.o, b.t);
      const p = s.pos;
      if (p && p.t <= b.t) {
        const long = p.dir === 1;
        if (long ? b.l <= p.stop : b.h >= p.stop) {
          const gapOpen = hourStops || (b.t % IV === 0) ? b.o : null;
          const px = gapOpen != null ? (long ? Math.min(gapOpen, p.stop) : Math.max(gapOpen, p.stop)) : p.stop;
          close(w, s, px, b.t + (px === b.o ? 0 : H / 2), 'stop', s.n); s.stoppedIn = s.n;
        }
      }
    }
    // 2. funding events in (t-1h, t] for trades open at that moment
    for (const [w, s] of slots) {
      const F = m.f[s.coin]; if (!F || !s.pos) continue;
      for (const [ft, rate] of F) if (s.pos.t < ft) { const px = last[s.coin] ?? s.pos.entry, pay = s.pos.dir * s.pos.qty * px * rate; w.bal -= pay; s.pos.fund += pay; s.pos.fundRate += rate; }
    }
    // 3. a 4h candle closed: push it, manage open trades, then new orders
    if (t % IV === 0) {
      for (const [w, s] of slots) {
        const b = m.h4[s.coin]; if (!b) continue;
        const i = s.push(b), p = s.pos;
        if (!p || s.stoppedIn === i || p.i0 > i) continue;
        const S = s.S, long = p.dir === 1;
        if (S.maxBars && !S.nextOpen && i - p.i0 >= S.maxBars) { if (o.exitAtClose) { close(w, s, b.c, t, 'time', i); s.blockAt = i; } else s.pendExit = { at: t + delay * H, why: 'time' }; continue; }
        p.ext = long ? Math.max(p.ext, b.h) : Math.min(p.ext, b.l);
        if (S.kTrail > 0) { const ns = p.ext - p.dir * S.kTrail * s.atr[i]; if (long ? ns > p.stop : ns < p.stop) p.stop = ns; }
        const oneR = Math.abs(p.entry - p.stop0);
        if (S.lockAtR > 0 && p.dir * (p.ext - p.entry) >= S.lockAtR * oneR) { const ls = p.entry + p.dir * S.lockToR * oneR; if (long ? ls > p.stop : ls < p.stop) p.stop = ls; }
        if (S.staleBars > 0 && i - p.i0 >= S.staleBars && p.dir * (b.c - p.entry) < S.staleR * oneR) { if (o.exitAtClose) { close(w, s, b.c, t, 'time', i); s.blockAt = i; } else s.pendExit = { at: t + delay * H, why: 'time' }; continue; }
        if (S.nextOpen && i - p.i0 >= S.maxBars) s.pendExit = { at: t, why: 'time' };
      }
      equity = Math.max(0, markAll());
      ev(`E ${t} ${equity}`);
      for (const w of W) {
        const pendingDirs = [];
        for (const s of w.slots) {
          if (!m.h4[s.coin]) continue;
          const i = s.n - 1;
          if (!s.canSignal(i)) continue;
          const g = s.signal(i); if (!g) continue;
          if (s.T[i] < from) continue;           // the account exists from `from` on
          stat.signals++;
          if (missed(w, s, t)) { stat.missed++; continue; }
          const N = w.slots.reduce((n, z) => n + (z.pos && !z.pos.phantom && z.pos.dir === g.dir && (o.countClosing || !z.pendExit) ? 1 : 0), 0) + pendingDirs.filter((d) => d === g.dir).length;
          const base = equity * w.weight; w.peakBase = Math.max(w.peakBase, base);
          const pct = live ? (w.peakBase >= 1000 ? 0.015 : w.peakBase >= 500 ? 0.02 : 0.025) : 0.025;
          const mult = o.sizeFn ? o.sizeFn({ bot: w.id, coin: s.coin, t, N, dir: g.dir }) : rule ? rule(N, w.id) : 1;
          let target = pct * base * K * (w.id === 'bb' ? g.w * bbMult : 1) * mult;
          if (o.cap > 0) target = Math.min(o.cap, target);
          if (!(target > 0)) continue;
          s.pend = { dir: g.dir, stop: g.stop, atr: s.atr[i], target, sigT: s.T[i], at: t + delay * H, N, mult, w: g.w };
          pendingDirs.push(g.dir); stat.orders++;
          ev(`O ${w.id} ${s.coin} ${t} ${g.dir} ${target} ${N} ${mult}`);
        }
      }
    }
    // quarterly rebalance of free cash to the bot weights (at a quarter start, before the fills at that open)
    if (t % 86400 === 0) {
      const d = new Date(t * 1000), q = d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3);
      if (t >= from && lastQ !== null && q !== lastQ) {
        const total = W.reduce((a, w) => a + w.bal, 0), want = W.map((w) => total * w.weight - w.bal);
        const give = want.map((v, k) => (v < 0 ? Math.min(-v, Math.max(0, W[k].bal - W[k].margin)) : 0)), pot = give.reduce((a, v) => a + v, 0), need = want.reduce((a, v) => a + Math.max(0, v), 0);
        W.forEach((w, k) => { w.bal += want[k] > 0 ? (need > 0 ? (pot * want[k]) / need : 0) : -give[k]; });
      }
      if (t >= from) lastQ = q;
    }
    if (t >= from) curve.push(t, Math.max(0, markAll()));
  }
  const open = slots.filter(([, s]) => s.pos).map(([w, s]) => ({ bot: w.id, coin: s.coin, ...s.pos }));
  return { trades, curve: Float64Array.from(curve), start, from, to, stat, open };
}

// ------------------------------------------------------------------ statistics ------------------------------------------------
// curve = [t0, v0, t1, v1, ...] hourly
// value at moment a (the mark at or just before a; the start balance at or before r.from), then growth and worst fall to b
function stats(r, a = r.from, b = r.to) {
  const cv = r.curve; let s0 = a <= r.from ? r.start : null, pk = s0, dd = 0, end = s0, t1 = a;
  for (let k = 0; k < cv.length; k += 2) {
    const t = cv[k], v = cv[k + 1];
    if (t <= a) { if (a > r.from) { s0 = v; pk = v; end = v; } continue; }
    if (t > b) break;
    if (v > pk) pk = v; else if (pk > 0 && 1 - v / pk > dd) dd = 1 - v / pk;
    end = v; t1 = t;
  }
  const yrs = (t1 - Math.max(a, r.from)) / (365.25 * 86400);
  return { start: s0, end, ret: end / s0 - 1, cagr: end > 0 && yrs > 0 ? (end / s0) ** (1 / yrs) - 1 : -1, dd };
}
const ruleOf = (a = 2, len = 3, f = 0.25) => (N) => Math.max(f, 1 - ((1 - f) * Math.max(0, N - a)) / len);
const RULE = ruleOf(2, 3, 0.25); // 0-2 full, 3 -> 0.75, 4 -> 0.5, 5+ -> 0.25
module.exports = { run, stats, market, raw, RULE, ruleOf, H, IV, T0, END, CUT, PHP, COINS, WEIGHT, SPEC, FEE, SLIP, Slot, RULES, rng };
