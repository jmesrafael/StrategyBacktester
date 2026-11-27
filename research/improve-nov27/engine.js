// engine.js - Nov 27 2026: trades + shared account with optional sizing hooks. Read-only study (PLAN.md).
// Account logic copied from ../tri-vs-four-nov27/run.js (hourly-marked, shared sizing, quarterly rebalance, MEXC minimums).
'use strict';
const S = require('../replace-nov25/sim');
const C = require('../../candles/candles.js');
const L4 = require('../hunt-4h-nov26/lib.js'), F4 = require('../hunt-4h-nov26/fam.js');
const L1 = require('../hunt-1h-nov26/lib.js'), FV = require('../hunt-1h-nov26/fam-vol.js');
const DET = require('../zec-replacement-2/detail.json'), DL = Array.isArray(DET) ? DET : DET.data || Object.values(DET);

const H = 3600, ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, T0 = ts(2020), END = S.END, NH = Math.round((END - T0) / H), CUT = ts(2024);
const FEE = 0.0005, PHP = 60;
const LIVE6 = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'];
const OWN = { bb: LIVE6, ic: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH'], tc: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'], wide: LIVE6, ichi: LIVE6 };
const BASE = { bb: 0.5, ic: 0.25, tc: 0.25 };

// ---------------- trades ----------------
const live = (kind, mult) => (coins, cost) => coins.flatMap((c) => S.coinTrades(S.real(c), kind, { mult, cost }).map((x) => ({
  c, dir: x.dir, t: x.t, R: x.R, w: x.w, dist: x.dist, entry: x.entry, why: x.why, iv: 14400, tEff: kind.startsWith('bb') && x.why === 'time' ? x.tExit - 14400 : x.tExit })));
const hunt = (lib, strat, ex, iv) => (coins, cost) => lib.evaluate(strat, ex, coins, cost, true).trades.map((x) => ({
  c: x.coin, dir: x.dir, t: x.t, R: x.R, w: 1, dist: x.dist, entry: x.entry, why: x.why, iv, tEff: x.why === 'sig' ? x.tExit - iv : x.tExit }));
const ICHI = { fam: 'ichi', p: { t: 9, k: 26, s: 52, mode: 'cross' }, trend: 0, exit: { k: 2, bars: 12 } };
const E192 = { kind: 'M', bars: 192 };
const GEN = {
  bb: live('bbT', 1.05), ic: live('ic', 1), tc: live('tc', 1),
  wide: hunt(L1, FV.strat({ len: 80, mult: 2.6, trend: 800, minStop: 0.3, filt: null }, E192), FV.mkEx(E192), H),
  ichi: hunt(L4, F4.build ? (x) => F4.build(x, ICHI) : null, F4.exOf(ICHI), 14400),
};

// ADX(14) on the signal candle (the candle that closed at the entry time)
const ADX = {};
function adxAt(c, t) {
  if (!ADX[c]) {
    const x = S.real(c), m = new Map(), len = 14; let tr = 0, p = 0, mm = 0, a = 0, k = 0;
    for (let i = 1; i < x.n; i++) {
      const up = x.H[i] - x.H[i - 1], dn = x.L[i - 1] - x.L[i], pd = up > dn && up > 0 ? up : 0, md = dn > up && dn > 0 ? dn : 0;
      const r = Math.max(x.H[i] - x.L[i], Math.abs(x.H[i] - x.C[i - 1]), Math.abs(x.L[i] - x.C[i - 1]));
      if (i <= len) { tr += r; p += pd; mm += md; } else { tr += r - tr / len; p += pd - p / len; mm += md - mm / len; }
      if (i >= len) { const s = p + mm, dx = s > 0 ? (100 * Math.abs(p - mm)) / s : 0; k++; if (k <= len) { a += dx / len; if (k === len) m.set(x.T[i] + 14400, a); } else { a = (a * (len - 1) + dx) / len; m.set(x.T[i] + 14400, a); } }
    }
    ADX[c] = m;
  }
  return ADX[c].get(t);
}

const cache = new Map();
function trades(id, cost = 1) {
  const k = id + '|' + cost;
  if (!cache.has(k)) cache.set(k, GEN[id](OWN[id], cost).filter((x) => x.t >= T0 && x.t < END && x.tEff <= END).sort((a, b) => a.t - b.t || a.c.localeCompare(b.c)));
  return cache.get(k);
}

// ---------------- hourly closes and funding ----------------
const HC = {};
function hourly(c) {
  if (HC[c]) return HC[c];
  const close = new Float64Array(NH).fill(NaN), fund = new Float64Array(NH + 1);
  for (const r of C.load(c, '1h')) { const k = (r[0] - T0) / H; if (k >= 0 && k < NH) close[k] = r[4]; }
  for (let k = 1; k < NH; k++) if (Number.isNaN(close[k])) close[k] = close[k - 1];
  for (const [ft, rate] of C.funding(c)) { const k = Math.ceil((ft - T0) / H); if (k >= 0 && k <= NH) fund[k] += rate; }
  for (let k = 1; k <= NH; k++) fund[k] += fund[k - 1];
  return (HC[c] = { close, fund });
}
function openR(x, k) {
  const h = x.h || (x.h = hourly(x.c)), k0 = (x.t - T0) / H, px = h.close[k];
  if (Number.isNaN(px)) return 0;
  const v = (x.dir * (px - x.entry) / x.entry - 2 * FEE - x.dir * (h.fund[k + 1] - h.fund[k0])) / x.dist;
  return x.why === 'stop' && T0 + (k + 1) * H > x.tEff - x.iv ? Math.max(v, x.R) : v;
}

// ---------------- account ----------------
const SPEC = {};
for (const c of new Set(Object.values(OWN).flat())) { const d = DL.find((s) => s.symbol === c + '_USDT'); SPEC[c] = { cs: d.contractSize, minVol: d.minVol || 1, mmr: d.maintenanceMarginRate || 0.004 }; }
// bots: [{ id, weight, trades }]
// o: { start, from, to, mexc, k, flat, openPart, rebal (months), mult(x, id, st) -> size multiplier }
function account(bots, o = {}) {
  const start = o.start ?? 750, from = o.from ?? T0, to = o.to ?? END, mexc = !!o.mexc, K = o.k ?? 1, flat = o.flat ?? true, openPart = o.openPart || 0, rebal = o.rebal || 3, mult = o.mult;
  const k0 = Math.round((from - T0) / H), k1 = Math.round((to - T0) / H);
  const W = bots.map((b) => { let i = 0; while (i < b.trades.length && b.trades[i].t < from) i++; return { id: b.id, weight: b.weight, i, q: b.trades, bal: start * b.weight, margin: 0, peakBase: 0, open: [] }; });
  const curve = new Float64Array(k1 - k0), st = { W, K, equity: start, openPL: 0, peak: start };
  let lastQ = null;
  for (let k = k0; k < k1; k++) {
    const t = T0 + k * H;
    if (t % 86400 === 0) {
      const d = new Date(t * 1000), qq = Math.floor((d.getUTCFullYear() * 12 + d.getUTCMonth()) / rebal);
      if (lastQ !== null && qq !== lastQ) {
        const total = W.reduce((a, w) => a + w.bal, 0), want = W.map((w) => total * w.weight - w.bal);
        const give = want.map((v, j) => (v < 0 ? Math.min(-v, Math.max(0, W[j].bal - W[j].margin)) : 0)), pot = give.reduce((a, v) => a + v, 0), need = want.reduce((a, v) => a + Math.max(0, v), 0);
        W.forEach((w, j) => { w.bal += want[j] > 0 ? (need > 0 ? (pot * want[j]) / need : 0) : -give[j]; });
      }
      lastQ = qq;
    }
    for (const w of W) while (w.i < w.q.length && w.q[w.i].t === t) {
      const x = w.q[w.i++], base = (st.equity - openPart * Math.max(0, st.openPL)) * w.weight; w.peakBase = Math.max(w.peakBase, base);
      const pct = flat ? 0.025 : w.peakBase >= 1000 ? 0.015 : w.peakBase >= 500 ? 0.02 : 0.025;
      const target = pct * K * base * x.w * (mult ? mult(x, w.id, st) : 1);
      if (!(target > 0)) continue;
      let size = target / x.dist, margin = 0;
      if (mexc) {
        const sp = SPEC[x.c], one = sp.cs * x.entry, per = one * x.dist;
        let vol = Math.max(sp.minVol, Math.round(target / per)); while (vol >= sp.minVol && vol * per > 1.5 * target) vol--;
        if (vol < sp.minVol) continue;
        size = vol * one;
        const lev = Math.max(1, Math.min(20, Math.floor(0.5 / (x.dist + sp.mmr))));
        margin = size / lev;
        if (!(w.bal - w.margin >= margin * 1.1)) continue;
      }
      w.margin += margin; w.open.push({ x, size, margin, end: Math.round((x.tEff - T0) / H) });
    }
    let eq = 0, op = 0;
    for (const w of W) {
      let open = 0;
      for (let j = w.open.length - 1; j >= 0; j--) {
        const p = w.open[j];
        if (p.end <= k + 1) { w.bal += p.size * p.x.R * p.x.dist; w.margin -= p.margin; w.open.splice(j, 1); } else open += p.size * p.x.dist * openR(p.x, k);
      }
      eq += w.bal + open; op += open;
    }
    st.equity = Math.max(0, eq); st.openPL = op; st.peak = Math.max(st.peak, st.equity); curve[k - k0] = st.equity;
  }
  return { curve, start, from };
}
// growth per year and worst fall of a curve
function stats(r) {
  const { curve, start } = r, n = curve.length; let pk = start, dd = 0;
  for (let i = 0; i < n; i++) { const v = curve[i]; if (v > pk) pk = v; else if (1 - v / pk > dd) dd = 1 - v / pk; }
  const end = curve[n - 1], yrs = (n * H) / (365.25 * 86400);
  return { end, ret: end / start - 1, cagr: end > 0 ? (end / start) ** (1 / yrs) - 1 : -1, dd };
}
const STARTS = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= END) STARTS.push([ts(y, m), ts(y + 1, m)]);

// the same trade engines on any coin list (other-coin check)
const perCoin = new Map();
function tradesOn(id, coins) {
  const one = (c) => { const k = id + '|' + c; if (!perCoin.has(k)) perCoin.set(k, GEN[id]([c], 1).filter((x) => x.t >= T0 && x.t < END && x.tEff <= END)); return perCoin.get(k); };
  return coins.flatMap(one).sort((a, b) => a.t - b.t || a.c.localeCompare(b.c));
}

module.exports = { H, T0, END, CUT, PHP, OWN, BASE, STARTS, trades, tradesOn, adxAt, account, stats };
