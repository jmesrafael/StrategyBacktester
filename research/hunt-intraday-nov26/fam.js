// fam.js - 2h families. All signals use bars <= i only. Build functions return {L,S,stopL?,stopS?,warmup}.
'use strict';
const L = require('./lib.js'), I = L.I, ok = I.ok;
const sma = (c, n) => c.m('sma' + n, () => I.sma(c.C, n));
const hi = (c, n) => c.m('hi' + n, () => I.highest(c.H, n));
const lo = (c, n) => c.m('lo' + n, () => I.lowest(c.L, n));
const atrS = (c, n) => c.m('atr' + n, () => I.atr(c.H, c.L, c.C, n));
const vavg = (c, n) => c.m('va' + n, () => I.sma(c.V, n));
const mk = (n) => ({ L: new Uint8Array(n), S: new Uint8Array(n), stopL: new Float64Array(n), stopS: new Float64Array(n) });

// F1 volatility expansion after compression: close breaks prior N-bar extreme; ATR(14)/ATR(100) was < thr within last k bars
function f1(c, p) {
  const o = mk(c.n), h = hi(c, p.N), l = lo(c, p.N), tr = p.trend ? sma(c, p.trend) : null, a14 = atrS(c, 14), a100 = atrS(c, 100);
  const comp = new Uint8Array(c.n), rec = new Uint8Array(c.n); let last = -999;
  for (let i = 100; i < c.n; i++) { if (a14[i] / a100[i] < p.thr) last = i; rec[i] = i - last <= p.k ? 1 : 0; }
  const w = Math.max(p.N, p.trend || 0, 110) + 2;
  for (let i = w; i < c.n; i++) {
    if (!rec[i]) continue;
    const cl = c.C[i];
    if (cl > h[i - 1] && (!tr || cl > tr[i])) o.L[i] = 1; else if (cl < l[i - 1] && (!tr || cl < tr[i])) o.S[i] = 1;
  }
  o.warmup = w; return o;
}
// F2 momentum continuation after big-volume bar: volume > kv x avg(50), range > kr x ATR, close in extreme 30% of range
function f2(c, p) {
  const o = mk(c.n), va = vavg(c, 50), a = atrS(c, 14), tr = p.trend ? sma(c, p.trend) : null, w = Math.max(60, p.trend || 0) + 2;
  for (let i = w; i < c.n; i++) {
    const r = c.H[i] - c.L[i];
    if (!(c.V[i] > p.kv * va[i]) || !(r > p.kr * a[i]) || r <= 0) continue;
    const pos = (c.C[i] - c.L[i]) / r;
    if (pos > 0.7 && c.C[i] > c.O[i] && (!tr || c.C[i] > tr[i])) o.L[i] = 1;
    else if (pos < 0.3 && c.C[i] < c.O[i] && (!tr || c.C[i] < tr[i])) o.S[i] = 1;
  }
  o.warmup = w; return o;
}
// F3 failed breakout: bar pokes beyond prior N-bar extreme but closes back inside (reversal). stop = bar extreme.
function f3(c, p) {
  const o = mk(c.n), h = hi(c, p.N), l = lo(c, p.N), a = atrS(c, 14), tr = p.trend ? sma(c, p.trend) : null, w = Math.max(p.N, p.trend || 0, 20) + 2;
  for (let i = w; i < c.n; i++) {
    const hh = h[i - 1], ll = l[i - 1];
    if (c.H[i] > hh && c.C[i] < hh && c.C[i] < c.O[i] && c.H[i] - c.C[i] > p.wick * a[i] && (!tr || p.counter || c.C[i] < tr[i])) { o.S[i] = 1; o.stopS[i] = c.H[i]; }
    else if (c.L[i] < ll && c.C[i] > ll && c.C[i] > c.O[i] && c.C[i] - c.L[i] > p.wick * a[i] && (!tr || p.counter || c.C[i] > tr[i])) { o.L[i] = 1; o.stopL[i] = c.L[i]; }
  }
  o.warmup = w; return o;
}
// F4 session range breakout: range of session [s0,s1) UTC hours of the day; after it ends, first close beyond it (before cut hour) -> trade.
// stop = mid | far side of range | ATR (flag stopMode)
function f4(c, p) {
  const o = mk(c.n), tr = p.trend ? sma(c, p.trend) : null, w = (p.trend || 0) + 30;
  let rh = -1, rl = 1e18, day = -1, done = 0, valid = false;
  for (let i = 1; i < c.n; i++) {
    const t = c.B[i].time, hr = (t % 86400) / 3600, d = Math.floor(t / 86400);
    if (d !== day) { day = d; rh = -1; rl = 1e18; done = 0; valid = false; }
    if (hr >= p.s0 && hr < p.s1) { rh = Math.max(rh, c.H[i]); rl = Math.min(rl, c.L[i]); if (hr + 2 >= p.s1) valid = rh > 0; continue; }
    if (!valid || done || hr < p.s1 || hr >= p.cut || i < w) continue;
    const cl = c.C[i];
    if (cl > rh && (!tr || cl > tr[i])) { o.L[i] = 1; o.stopL[i] = p.stopMode === 'mid' ? (rh + rl) / 2 : rl; done = 1; }
    else if (cl < rl && (!tr || cl < tr[i])) { o.S[i] = 1; o.stopS[i] = p.stopMode === 'mid' ? (rh + rl) / 2 : rh; done = 1; }
  }
  o.warmup = w; return o;
}
// F5 funding-time effect: fade/follow the 8h move into funding? long when previous 3 bars (6h) return < -k ATR at hour h (just before funding) - mean reversion into funding
function f5(c, p) {
  const o = mk(c.n), a = atrS(c, 14), tr = p.trend ? sma(c, p.trend) : null, w = (p.trend || 0) + 30;
  for (let i = w; i < c.n; i++) {
    const hr = ((c.B[i].time % 86400) / 3600);
    if (hr !== p.hr) continue;
    const mv = (c.C[i] - c.C[i - p.look]) / a[i];
    const s = p.follow ? 1 : -1;
    if (mv > p.k) { if (s === 1 && (!tr || c.C[i] > tr[i])) o.L[i] = 1; else if (s === -1 && (!tr || c.C[i] < tr[i])) o.S[i] = 1; }
    else if (mv < -p.k) { if (s === 1 && (!tr || c.C[i] < tr[i])) o.S[i] = 1; else if (s === -1 && (!tr || c.C[i] > tr[i])) o.L[i] = 1; }
  }
  o.warmup = w; return o;
}
const F = { f1, f2, f3, f4, f5 };
const useOwnStop = (p) => p.fam === 'f3' || p.fam === 'f4' && p.stopMode !== 'atr';
function strat(p) { return (c) => { const s = c.m('e' + JSON.stringify(p), () => F[p.fam](c, p)); return useOwnStop(p) ? s : { ...s, stopL: null, stopS: null }; }; }
module.exports = { strat, F };
