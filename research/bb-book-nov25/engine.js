// engine.js: BB-CORE v3 with the book's ideas as switches (see PLAN.md). With no switch set it must equal
// intel/engines/backtest (bbcore v3) trade for trade: parity is checked by run.js.
'use strict';
const C = require('../../candles/candles.js');
const E = require('../../intel/engines/backtest/engine');
const IV = 14400, END = Date.UTC(2026, 10, 24) / 1000;
const FEE = 0.0005, SLIP = 0.0002;

const memo = (x, k, fn) => { let v = x.cache.get(k); if (v === undefined) { v = fn(); x.cache.set(k, v); } return v; };

function wrap(coin, B, funding) {
  const T = funding.map((r) => r[0]), S = new Float64Array(funding.length + 1);
  for (let i = 0; i < funding.length; i++) S[i + 1] = S[i] + funding[i][1];
  const idx = (t) => { let lo = 0, hi = T.length; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m + 1; else hi = m; } return lo; };
  return { coin, B, n: B.length, fund: (t0, t1) => S[idx(t1)] - S[idx(t0)], funding, cache: new Map() };
}
function load(coin) {
  const B = C.load(coin, '4h').filter((r) => r[0] + IV <= END).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  return wrap(coin, B, C.funding(coin));
}
const cut = (x, k) => wrap(x.coin, x.B.slice(0, k), x.funding); // what was known at candle k (truncation audit)

// ---------- indicators (causal: value at i uses candles 0..i) ----------
const atr = (x) => memo(x, 'atr', () => E.atrA(x.B, 14));
const sma200 = (x) => memo(x, 'sma200', () => x.B.map((_, i) => E.smaClose(x.B, i, 200)));
const price = { close: (b) => b.close, typical: (b) => (b.high + b.low + b.close) / 3, weighted: (b) => (b.high + b.low + 2 * b.close) / 4 };
function bands(x, len, mult, src) {
  const base = memo(x, `ms|${len}|${src}`, () => {
    const p = x.B.map(price[src]), mid = new Float64Array(x.n).fill(NaN), sd = new Float64Array(x.n).fill(NaN);
    for (let i = len - 1; i < x.n; i++) { let s = 0; for (let j = i - len + 1; j <= i; j++) s += p[j]; const m = s / len; let v = 0; for (let j = i - len + 1; j <= i; j++) v += (p[j] - m) ** 2; mid[i] = m; sd[i] = Math.sqrt(v / len); }
    return { mid, sd, p };
  });
  return memo(x, `bb|${len}|${mult}|${src}`, () => ({ mid: base.mid, p: base.p,
    up: base.mid.map((m, i) => m + mult * base.sd[i]), lo: base.mid.map((m, i) => m - mult * base.sd[i]),
    bw: base.mid.map((m, i) => (2 * mult * base.sd[i]) / m) }));
}
// true where BandWidth was at its n-candle low somewhere in the last k candles (including i)
function squeezeRecent(x, b, n, k, key) {
  return memo(x, `sq|${key}|${n}|${k}`, () => {
    const out = new Uint8Array(x.n), q = []; let head = 0, last = -Infinity, first = x.B.length;
    for (let i = 0; i < x.n; i++) { if (isNaN(b.bw[i])) continue; if (i < first) first = i;
      while (q.length > head && b.bw[q[q.length - 1]] >= b.bw[i]) q.pop(); q.push(i); while (q[head] <= i - n) head++;
      if (i - first + 1 >= n && q[head] === i) last = i; out[i] = i - last <= k ? 1 : 0; }
    return out;
  });
}
const mfi = (x, len) => memo(x, 'mfi' + len, () => {
  const tp = x.B.map(price.typical), out = new Float64Array(x.n).fill(NaN);
  for (let i = len; i < x.n; i++) { let up = 0, dn = 0; for (let j = i - len + 1; j <= i; j++) { const f = tp[j] * x.B[j].volume; if (tp[j] > tp[j - 1]) up += f; else if (tp[j] < tp[j - 1]) dn += f; } out[i] = up + dn > 0 ? (100 * up) / (up + dn) : 50; }
  return out;
});
function volRatio(x, len, key, part) {
  return memo(x, key + len, () => {
    const out = new Float64Array(x.n).fill(NaN);
    for (let i = len - 1; i < x.n; i++) { let s = 0, v = 0; for (let j = i - len + 1; j <= i; j++) { const b = x.B[j], r = b.high - b.low; if (r > 0) s += (part(b) / r) * b.volume; v += b.volume; } out[i] = v > 0 ? s / v : 0; }
    return out;
  });
}
const iiPct = (x, len) => volRatio(x, len, 'ii', (b) => 2 * b.close - b.high - b.low);
const adPct = (x, len) => volRatio(x, len, 'ad', (b) => b.close - b.open);
const rsi = (x, len) => memo(x, 'rsi' + len, () => {
  const out = new Float64Array(x.n).fill(NaN); let g = 0, l = 0;
  for (let i = 1; i < x.n; i++) { const d = x.B[i].close - x.B[i - 1].close, u = Math.max(d, 0), w = Math.max(-d, 0); if (i <= len) { g += u / len; l += w / len; } else { g = (g * (len - 1) + u) / len; l = (l * (len - 1) + w) / len; } if (i >= len) out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
  return out;
});

// ---------- confirmation conditions at the signal candle: (x, o) -> (i, dir) -> bool ----------
const COND = {
  squeeze: (n, k) => (x, o) => { const b = bands(x, o.len, o.mult, o.src), s = squeezeRecent(x, b, n, k, `${o.len}|${o.mult}|${o.src}`); return (i) => !!s[i]; },
  expand: () => (x, o) => { const b = bands(x, o.len, o.mult, o.src); return (i) => b.bw[i] > b.bw[i - 1]; },
  mfi: (th) => (x) => { const m = mfi(x, 10); return (i, d) => (d === 1 ? m[i] > th : m[i] < 100 - th); },
  ii: (len) => (x) => { const v = iiPct(x, len); return (i, d) => d * v[i] > 0; },
  ad: (len) => (x) => { const v = adPct(x, len); return (i, d) => d * v[i] > 0; },
  rsi: (th) => (x) => { const r = rsi(x, 10); return (i, d) => (d === 1 ? r[i] > th : r[i] < 100 - th); },
  headfake: (k) => (x, o) => { const b = bands(x, o.len, o.mult, o.src); return (i, d) => { for (let j = Math.max(0, i - k); j < i; j++) if (d === 1 ? x.B[j].close < b.lo[j] : x.B[j].close > b.up[j]) return true; return false; }; },
};

const BASE = { len: 20, mult: 1.8, src: 'close', trend: 200, entry: 'break', mfiTh: 80, filter: null, pullback: 0, stop: 'mid', formN: 10, maxBars: 42, tag: false, sar: null, div: false, cool: 3, minStopAtr: 0.3 };

function run(x, ch = {}, costScale = 1) {
  const o = { ...BASE, ...ch }, { B, n } = x, A = atr(x), S = o.trend ? sma200(x) : null, bb = bands(x, o.len, o.mult, o.src), M = mfi(x, 10);
  const filt = o.filter ? o.filter(x, o) : null, fee = FEE * costScale, slip = SLIP * costScale;
  const trades = [];
  let pos = null, pend = null, pendClose = false, lastGap = -Infinity, coolUntil = -1, setup = null;
  const exit = (raw, ix, why) => {
    const d = pos.dir, px = raw * (1 - d * slip), tIn = B[pos.i0].time, tOut = B[ix].time + IV;
    const R = (d * (px - pos.entry) / pos.entry - 2 * fee - d * x.fund(tIn, tOut)) / pos.dist;
    trades.push({ c: x.coin, dir: d, sig: pos.sig, t: tIn, tExit: tOut, R, why, bars: ix - pos.i0 + 1 });
    if (R <= 0 && o.cool > 0) coolUntil = ix + o.cool;
    pos = null;
  };
  // stop price for a signal at candle i, or null when it is on the wrong side / too close
  const stopFor = (i, d) => {
    let s;
    if (o.stop === 'mid') s = bb.mid[i];
    else if (o.stop === 'opp') s = d === 1 ? bb.lo[i] : bb.up[i];
    else { s = d === 1 ? Infinity : -Infinity; for (let j = i - o.formN + 1; j <= i; j++) s = d === 1 ? Math.min(s, B[j].low) : Math.max(s, B[j].high); }
    const dist = d * (B[i].close - s);
    return dist > 0 && dist >= o.minStopAtr * A[i] ? s : null;
  };
  const signal = (i) => {
    const c = B[i].close; let d = 0;
    if (o.entry === 'break') d = c > bb.up[i] ? 1 : c < bb.lo[i] ? -1 : 0;
    else { const pb = (c - bb.lo[i]) / (bb.up[i] - bb.lo[i]); d = pb > 0.8 && M[i] > o.mfiTh ? 1 : pb < 0.2 && M[i] < 100 - o.mfiTh ? -1 : 0; }
    if (!d || (S && (d === 1 ? c < S[i] : c > S[i]))) return 0;
    return d;
  };

  for (let i = 0; i < n; i++) {
    const b = B[i];
    if (i > 0 && b.time - B[i - 1].time !== IV) lastGap = i;
    if (pend) {
      const d = pend.dir, fill = b.open * (1 + d * slip), dist = Math.abs(fill - pend.stop) / fill;
      if (dist > 0 && (d === 1 ? pend.stop < fill : pend.stop > fill)) pos = { dir: d, i0: i, sig: pend.sig, entry: fill, stop: pend.stop, dist, sar: pend.stop, ep: fill, af: o.sar ? o.sar.start : 0,
        run: { hi: d === 1 ? B[pend.sig].high : B[pend.sig].low, m: M[pend.sig] }, prev: null, inTag: true };
      pend = null;
    }
    if (pos && pendClose) exit(b.open, i, pendClose);
    pendClose = false;
    if (pos) {
      const d = pos.dir, long = d === 1; let level = pos.stop, why = 'stop';
      if (o.tag) { const opp = long ? bb.lo[i - 1] : bb.up[i - 1]; if (long ? opp > level : opp < level) { level = opp; why = 'tag'; } }
      if (long ? b.low <= level : b.high >= level) exit(long ? Math.min(b.open, level) : Math.max(b.open, level), i, why);
      else {
        if (o.sar) { // Wilder: next stop = sar + af * (extreme - sar), never inside the last two candles
          if (long ? b.high > pos.ep : b.low < pos.ep) { pos.ep = long ? b.high : b.low; pos.af = Math.min(o.sar.max, pos.af + o.sar.step); }
          let s = pos.sar + pos.af * (pos.ep - pos.sar); s = long ? Math.min(s, b.low, B[i - 1].low) : Math.max(s, b.high, B[i - 1].high);
          pos.sar = long ? Math.max(pos.sar, s) : Math.min(pos.sar, s); if (long ? pos.sar > pos.stop : pos.sar < pos.stop) pos.stop = pos.sar;
        }
        if (o.div) { // a NEW band tag with a further extreme but a weaker money flow than the previous tag
          const tag = long ? b.high >= bb.up[i] : b.low <= bb.lo[i], ext = long ? b.high : b.low;
          if (tag) {
            if (!pos.inTag) { pos.prev = pos.run; pos.run = null; }
            if (pos.prev && (long ? ext > pos.prev.hi && M[i] < pos.prev.m : ext < pos.prev.hi && M[i] > pos.prev.m)) pendClose = 'div';
            if (!pos.run || (long ? ext > pos.run.hi : ext < pos.run.hi)) pos.run = { hi: ext, m: M[i] };
          }
          pos.inTag = tag;
        }
      }
    }
    if (pos) { if (o.maxBars > 0 && i - pos.i0 >= o.maxBars) pendClose = 'time'; continue; }
    if (i < 202 || !(A[i] > 0)) continue;
    if (i - lastGap < Math.max(o.len, 200)) { setup = null; continue; }
    if (i < coolUntil) { setup = null; continue; }
    let d = signal(i), sigAt = i;
    if (o.pullback) {
      if (setup && (i - setup.i > o.pullback || (setup.dir === 1 ? b.close < bb.mid[i] : b.close > bb.mid[i]))) setup = null;
      let fire = 0;
      if (setup && i > setup.i) {
        const move = setup.dir * (b.close - B[i - 1].close);
        if (!setup.pulled) { if (move < 0) setup.pulled = true; } else if (move > 0) { fire = setup.dir; sigAt = setup.i; }
      }
      if (d && (!setup || setup.dir !== d)) setup = { dir: d, i, pulled: false };
      d = fire; if (fire) setup = null;
    }
    if (!d || (filt && !filt(i, d))) continue;
    const s = stopFor(i, d);
    if (s != null) pend = { dir: d, stop: s, sig: sigAt };
  }
  return trades;
}
module.exports = { load, cut, run, BASE, COND, END, IV };
