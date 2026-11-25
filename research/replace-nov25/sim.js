// sim.js: one candle-by-candle engine for BB-CORE, I-CORE and T-CORE that works on real or synthetic candles, and a
// shared-account simulator. Exit and fill rules are a port of intel/engines/backtest/engine.js (parity checked in run.js).
'use strict';
const C = require('../../candles/candles.js');
const E = require('../../intel/engines/backtest/engine');
const IV = 14400, FEE = 0.0005, SLIP = 0.0002;
const END = Date.UTC(2026, 10, 24) / 1000;

// ---------- candle sets: typed arrays + funding booked per candle (events in (open, open + 4h]) ----------
function pack(coin, rows, fundPerBar) {
  const n = rows.length, x = { coin, n, T: new Float64Array(n), O: new Float64Array(n), H: new Float64Array(n), L: new Float64Array(n), C: new Float64Array(n), V: new Float64Array(n), cache: {} };
  for (let i = 0; i < n; i++) { const r = rows[i]; x.T[i] = r[0]; x.O[i] = r[1]; x.H[i] = r[2]; x.L[i] = r[3]; x.C[i] = r[4]; x.V[i] = r[5]; }
  x.F = fundPerBar; x.FS = new Float64Array(n + 1); for (let i = 0; i < n; i++) x.FS[i + 1] = x.FS[i] + fundPerBar[i];
  return x;
}
const REAL = {};
function real(coin) {
  if (REAL[coin]) return REAL[coin];
  const rows = C.load(coin, '4h').filter((r) => r[0] + IV <= END), f = C.funding(coin), per = new Float64Array(rows.length);
  let k = 0; for (const [ft, rate] of f) { if (ft > END) break; while (k < rows.length && rows[k][0] + IV < ft) k++; if (k < rows.length && ft > rows[k][0]) per[k] += rate; }
  return (REAL[coin] = pack(coin, rows, per));
}

// ---------- signals (causal): per candle direction, stop level (BB only), ATR ----------
const objBars = (x) => x.cache.bars || (x.cache.bars = Array.from({ length: x.n }, (_, i) => ({ time: x.T[i], open: x.O[i], high: x.H[i], low: x.L[i], close: x.C[i] })));
const prefix = (x) => x.cache.p || (x.cache.p = (() => { const p = new Float64Array(x.n + 1); for (let i = 0; i < x.n; i++) p[i + 1] = p[i] + x.C[i]; return p; })());
function bandArr(x, len, mult) {
  const mid = new Float64Array(x.n).fill(NaN), up = new Float64Array(x.n).fill(NaN), lo = new Float64Array(x.n).fill(NaN);
  for (let i = len - 1; i < x.n; i++) { let s = 0; for (let j = i - len + 1; j <= i; j++) s += x.C[j]; const m = s / len; let v = 0; for (let j = i - len + 1; j <= i; j++) v += (x.C[j] - m) ** 2; const sd = Math.sqrt(v / len); mid[i] = m; up[i] = m + mult * sd; lo[i] = m - mult * sd; }
  return { mid, up, lo };
}
function adxArr(x, len = 14) {
  const o = new Float64Array(x.n).fill(NaN); let tr = 0, p = 0, m = 0, a = 0, k = 0;
  for (let i = 1; i < x.n; i++) {
    const up = x.H[i] - x.H[i - 1], dn = x.L[i - 1] - x.L[i], pd = up > dn && up > 0 ? up : 0, md = dn > up && dn > 0 ? dn : 0;
    const t = Math.max(x.H[i] - x.L[i], Math.abs(x.H[i] - x.C[i - 1]), Math.abs(x.L[i] - x.C[i - 1]));
    if (i <= len) { tr += t; p += pd; m += md; } else { tr += t - tr / len; p += pd - p / len; m += md - m / len; }
    if (i >= len) { const s = p + m, dx = s > 0 ? (100 * Math.abs(p - m)) / s : 0; k++; if (k <= len) { a += dx / len; if (k === len) o[i] = a; } else { a = (a * (len - 1) + dx) / len; o[i] = a; } }
  }
  return o;
}
function iiArr(x, len = 21) { const o = new Float64Array(x.n).fill(NaN); for (let i = len - 1; i < x.n; i++) { let s = 0, v = 0; for (let j = i - len + 1; j <= i; j++) { const r = x.H[j] - x.L[j]; if (r > 0) s += ((2 * x.C[j] - x.H[j] - x.L[j]) / r) * x.V[j]; v += x.V[j]; } o[i] = v > 0 ? s / v : 0; } return o; }

// exit settings (live v3 rules)
const SPEC = {
  bb: { atr: 'A', warmup: 202, level: true, maxBars: 42, nextOpen: true, cool: 3, kTrail: 0 },
  ic: { atr: 'B', warmup: 205, kInit: 1.75, kTrail: 7, lockAtR: 4, lockToR: 1, staleBars: 0, maxBars: 600 },
  tc: { atr: 'B', warmup: 205, kInit: 2, kTrail: 14, lockAtR: 0, lockToR: 1, staleBars: 48, staleR: 1, maxBars: 1200 },
};
const atrOf = (x, k) => x.cache['atr' + k] || (x.cache['atr' + k] = (k === 'A' ? E.atrA : E.atrB)(objBars(x), 14));
// raw signals: dir[i] (+1 / -1 / 0), dist[i] = |close - stop level| (BB), size[i] = risk multiplier (BB tweak)
function signals(x, kind) {
  const key = 'sig' + kind; if (x.cache[key]) return x.cache[key];
  const n = x.n, dir = new Int8Array(n), dist = new Float64Array(n), size = new Float64Array(n).fill(1), P = prefix(x), sma200 = (i) => (P[i + 1] - P[i - 199]) / 200;
  if (kind === 'bb' || kind === 'bbT') {
    const b = x.cache.b20 || (x.cache.b20 = bandArr(x, 20, 1.8)), A = atrOf(x, 'A'), adx = kind === 'bbT' ? adxArr(x) : null, ii = kind === 'bbT' ? iiArr(x) : null;
    for (let i = 199; i < n; i++) { const c = x.C[i], d = c > b.up[i] ? 1 : c < b.lo[i] ? -1 : 0; if (!d) continue; const s = sma200(i); if (d === 1 ? c < s : c > s) continue;
      const z = Math.abs(c - b.mid[i]); if (!(z > 0) || z < 0.3 * A[i]) continue;
      if (kind === 'bbT') { if (d === -1 && !(-ii[i] > 0)) continue; if (adx[i] > 27) size[i] = 0.5; }
      dir[i] = d; dist[i] = z; }
  } else if (kind === 'tc') {
    const b = x.cache.b30 || (x.cache.b30 = bandArr(x, 30, 2)), A = atrOf(x, 'B');
    for (let i = 199; i < n; i++) { const c = x.C[i], s = sma200(i), d = c > b.up[i] && c > s ? 1 : c < b.lo[i] && c < s ? -1 : 0; if (!d) continue; const z = Math.abs(c - b.mid[i]); if (z > 0 && z >= 0.3 * A[i]) dir[i] = d; }
  } else {
    const hl = (e, len) => { let h = -Infinity, l = Infinity; for (let j = e - len + 1; j <= e; j++) { if (x.H[j] > h) h = x.H[j]; if (x.L[j] < l) l = x.L[j]; } return (h + l) / 2; };
    const top = new Float64Array(n).fill(NaN), bot = new Float64Array(n).fill(NaN);
    for (let i = 77; i < n; i++) { const e = i - 26, a = (hl(e, 9) + hl(e, 26)) / 2, b = hl(e, 52); top[i] = Math.max(a, b); bot[i] = Math.min(a, b); }
    for (let i = 199; i < n; i++) { const c = x.C[i], s = sma200(i); if (c > top[i] && x.C[i - 1] <= top[i - 1] && c > s) dir[i] = 1; else if (c < bot[i] && x.C[i - 1] >= bot[i - 1] && c < s) dir[i] = -1; }
  }
  return (x.cache[key] = { dir, dist, size });
}

// ---------- one coin of one bot, advanced one candle at a time ----------
class Pos {
  constructor(x, kind, opt = {}) {
    this.x = x; this.S = { ...SPEC[kind.slice(0, 2)], ...opt.spec }; this.atr = atrOf(x, this.S.atr); this.sig = opt.sig || signals(x, kind);
    this.pos = null; this.pend = null; this.close = false; this.lastGap = -Infinity; this.coolUntil = -1; this.fee = FEE; this.slip = SLIP;
  }
  exit(raw, i, why, out) {
    const p = this.pos, x = this.x, d = p.dir, px = raw * (1 - d * this.slip), fund = x.FS[i + 1] - x.FS[p.i0];
    const R = (d * (px - p.entry) / p.entry - 2 * this.fee - d * fund) / p.dist;
    const t = { c: x.coin, dir: d, t: x.T[p.i0], tExit: x.T[i] + IV, R, why, entry: p.entry, dist: p.dist, w: p.w, i0: p.i0, i1: i, size: p.size };
    if (R <= 0 && this.S.cool > 0) this.coolUntil = i + this.S.cool;
    this.pos = null; out(t);
  }
  // fills and everything inside candle i. accept(order) returns { size } to take the entry or null to skip it
  open(i, accept, out) {
    const x = this.x, S = this.S;
    if (i > 0 && x.T[i] - x.T[i - 1] !== IV) this.lastGap = i;
    if (this.pend) {
      const q = this.pend, d = q.dir, fill = x.O[i] * (1 + d * (this.slip + (q.extra || 0)));
      let stop, dist, ok = true;
      if (S.level) { stop = q.stop; dist = Math.abs(fill - stop) / fill; ok = dist > 0 && (d === 1 ? stop < fill : stop > fill); }
      else { stop = fill - d * S.kInit * q.atr; dist = (S.kInit * q.atr) / fill; }
      if (ok) { const a = accept ? accept(this, { dir: d, fill, dist, w: q.w }) : { size: 0 }; if (a) this.pos = { dir: d, i0: i, entry: fill, stop0: stop, stop, dist, ext: x.O[i], w: q.w, size: a.size, margin: a.margin || 0, out: false }; }
      this.pend = null;
    }
    if (this.pos && this.close) this.exit(x.O[i], i, 'time', out);
    this.close = false;
    if (this.pos && this.pos.out) this.exit(x.C[i - 1], i - 1, 'time', out);
    const p = this.pos; if (!p) return;
    const long = p.dir === 1;
    if (long ? x.L[i] <= p.stop : x.H[i] >= p.stop) this.exit(long ? Math.min(x.O[i], p.stop) : Math.max(x.O[i], p.stop), i, 'stop', out);
    else if (!S.nextOpen && i - p.i0 >= S.maxBars) this.exit(x.C[i], i, 'time', out);
    else {
      p.ext = long ? Math.max(p.ext, x.H[i]) : Math.min(p.ext, x.L[i]);
      if (S.kTrail > 0) { const ns = p.ext - p.dir * S.kTrail * this.atr[i]; if (long ? ns > p.stop : ns < p.stop) p.stop = ns; }
      const oneR = Math.abs(p.entry - p.stop0);
      if (S.lockAtR > 0 && p.dir * (p.ext - p.entry) >= S.lockAtR * oneR) { const ls = p.entry + p.dir * S.lockToR * oneR; if (long ? ls > p.stop : ls < p.stop) p.stop = ls; }
      if (S.staleBars > 0 && i - p.i0 >= S.staleBars && p.dir * (x.C[i] - p.entry) < S.staleR * oneR) p.out = true;
    }
  }
  // candle i has closed: time exit flag, or a new order. skip() lets a test drop this signal
  shut(i, mult, skip, extra) {
    const S = this.S, x = this.x;
    if (this.pos) { if (S.nextOpen && i - this.pos.i0 >= S.maxBars) this.close = true; return; }
    if (i < S.warmup || !(this.atr[i] > 0) || i - this.lastGap < 200 || i < this.coolUntil) return;
    const d = this.sig.dir[i]; if (!d || (skip && skip())) return;
    this.pend = { dir: d, stop: x.C[i] - d * this.sig.dist[i], atr: this.atr[i], w: this.sig.size[i] * mult, extra: extra ? extra() : 0 };
  }
}
// all trades of one coin, every entry taken (R accounting)
function coinTrades(x, kind, opt = {}) {
  const m = new Pos(x, kind, opt), out = [], push = (t) => out.push(t);
  if (opt.cost) { m.fee *= opt.cost; m.slip *= opt.cost; }
  if (opt.rnd) m.fee *= opt.rnd.feeMult;
  const R = opt.rnd, nm = opt.name;
  for (let i = 0; i < x.n; i++) { m.open(i, null, push); m.shut(i, opt.mult || 1, R ? () => R.skip(nm, x.coin, x.T[i]) : null, R ? () => R.extra(nm, x.coin, x.T[i]) : null); }
  return out;
}

// ---------- the shared account ----------
// bots: [{ name, kind, weight, coins, spec, mult }]. Money in USD.
// o: { start, from, to, sets(coin) -> candle set, specs (MEXC minimums or null), rnd, fee20 }
// rnd: { skip(bot, coin, time) -> bool, extra(bot, coin, time) -> extra slippage, feeMult }  (same draw for every version)
function account(bots, o) {
  const to = o.to ?? END, from = o.from, R = o.rnd;
  const W = bots.map((b) => ({ ...b, bal: o.start * b.weight, margin: 0, peakBase: 0, open: 0,
    m: b.coins.map((c) => { const x = o.sets(c); const p = new Pos(x, b.kind, { spec: b.spec }); if (R) p.fee *= R.feeMult; let i = 0; while (i < x.n && x.T[i] < from) i++; return { p, x, i, unit: o.specs ? o.specs[c] : null }; }) }));
  let t0 = Infinity; for (const w of W) for (const c of w.m) if (c.i < c.x.n) t0 = Math.min(t0, c.x.T[c.i]);
  const curve = []; let taken = 0, skipped = 0, equity = o.start, hwm = o.start, lastQ = null;
  const openValue = (c, i) => { const p = c.p.pos; return p ? p.size * (p.dir * (c.x.C[i] - p.entry) / p.entry - 2 * c.p.fee - p.dir * (c.x.FS[i + 1] - c.x.FS[p.i0])) : 0; };
  for (let t = t0; t + IV <= to; t += IV) {
    const d = new Date(t * 1000), q = d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3);
    if (lastQ !== null && q !== lastQ) { // quarterly rebalance of free cash to 50 / 25 / 25
      const total = W.reduce((a, w) => a + w.bal, 0), want = W.map((w) => total * w.weight - w.bal);
      const give = want.map((v, k) => (v < 0 ? Math.min(-v, Math.max(0, W[k].bal - W[k].margin)) : 0)), pot = give.reduce((a, v) => a + v, 0), need = want.reduce((a, v) => a + Math.max(0, v), 0);
      W.forEach((w, k) => { w.bal += want[k] > 0 ? (need > 0 ? (pot * want[k]) / need : 0) : -give[k]; });
    }
    lastQ = q;
    for (const w of W) for (const c of w.m) {
      const i = c.i; if (i >= c.x.n || c.x.T[i] !== t) continue;
      c.p.open(i, (m, o2) => {
        const base = equity * w.weight; w.peakBase = Math.max(w.peakBase, base);
        const pct = w.peakBase >= 1000 ? 0.015 : w.peakBase >= 500 ? 0.02 : 0.025, target = pct * base * o2.w;
        if (!(target > 0)) { skipped++; return null; }
        let size = target / o2.dist; // position value
        // one contract's value: fixed (today's price) or contract size x the price at this entry (unit.cs)
        if (c.unit) { const one = c.unit.cs ? c.unit.cs * o2.fill : c.unit.unit, per = one * o2.dist; let vol = Math.max(c.unit.minVol, Math.round(target / per)); while (vol >= c.unit.minVol && vol * per > 1.5 * target) vol--; if (vol < c.unit.minVol) { skipped++; return null; } size = vol * one; }
        const lev = Math.max(1, Math.min(20, Math.floor(0.5 / (o2.dist + (c.unit?.mmr || 0.004))))), margin = size / lev;
        if (c.unit && !(w.bal - w.margin >= margin * 1.1)) { skipped++; return null; }
        w.margin += margin; taken++; return { size, margin };
      }, (tr) => { w.bal += tr.size * tr.R * tr.dist; });
    }
    // closed candle: margins, new orders, equity
    let eq = 0;
    for (const w of W) {
      w.margin = 0; let open = 0;
      for (const c of w.m) { const i = c.i; if (i < c.x.n && c.x.T[i] === t) { c.p.shut(i, w.mult || 1, R ? () => R.skip(w.name, c.x.coin, t) : null, R ? () => R.extra(w.name, c.x.coin, t) : null); c.last = i; c.i++; }
        if (c.p.pos) { w.margin += c.p.pos.margin; open += openValue(c, c.last); } }
      eq += w.bal + open;
    }
    equity = Math.max(0, eq);
    if (o.fee20) { const m = new Date((t + IV) * 1000); if (m.getUTCDate() === 1 && m.getUTCHours() === 0 && m.getUTCMonth() % 2 === 0 && equity > hwm) { const f = 0.2 * (equity - hwm), tot = W.reduce((a, w) => a + w.bal, 0); if (tot > f) { for (const w of W) w.bal -= (f * w.bal) / tot; equity -= f; hwm = equity; } } }
    curve.push([t + IV, equity]);
    if (equity <= 0) break;
  }
  return { curve, taken, skipped };
}
function curveStats(curve, start) {
  let pk = start, dd = 0, low = start, pkT = curve[0]?.[0], under = 0;
  for (const [t, v] of curve) { if (v >= pk) { pk = v; pkT = t; } dd = Math.max(dd, 1 - v / pk); under = Math.max(under, t - pkT); low = Math.min(low, v); }
  return { end: curve.length ? curve[curve.length - 1][1] : start, dd, low, underDays: under / 86400 };
}
module.exports = { adxArr, real, pack, signals, coinTrades, account, curveStats, Pos, SPEC, IV, END, FEE, SLIP, atrOf };
