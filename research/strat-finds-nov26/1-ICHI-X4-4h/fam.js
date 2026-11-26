// fam.js — 4h non-Bollinger families. build(ctx,cfg) -> {L,S,stopL?,stopS?,warmup}; exOf(cfg) -> engine exit object.
'use strict';
const lib = require('./lib.js'), I = lib.I;
const sh = (a, k) => I.shift(a, k);
function ichi(ctx, t, k, s) {
  return ctx.m(`ichi${t},${k},${s}`, () => {
    const tk = I.midHL(ctx.H, ctx.L, t), kj = I.midHL(ctx.H, ctx.L, k), sb = I.midHL(ctx.H, ctx.L, s);
    const sa = tk.map((v, i) => (v + kj[i]) / 2);
    return { tk, kj, saS: sh(sa, k), sbS: sh(sb, k) }; // cloud shifted forward k: value at i uses i-k (causal)
  });
}
function build(ctx, cfg) {
  const n = ctx.n, C = ctx.C, H = ctx.H, Lo = ctx.L, atr = ctx.atr14, p = cfg.p;
  const L = new Uint8Array(n), S = new Uint8Array(n);
  const T = cfg.trend, sma = T ? ctx.m('sma' + T, () => I.sma(C, T)) : null;
  const up = (i) => !sma || C[i] > sma[i], dn = (i) => !sma || C[i] < sma[i];
  let stopL = null, stopS = null, warm = T || 0;
  if (cfg.fam === 'donch') {
    const hh = ctx.m('hh' + p.N, () => sh(I.highest(H, p.N), 1)), ll = ctx.m('ll' + p.N, () => sh(I.lowest(Lo, p.N), 1));
    const q = p.q ? ctx.m('vq', () => { const a100 = I.sma(atr, 100); return atr.map((v, i) => v / a100[i]); }) : null;
    for (let i = 1; i < n; i++) {
      if (q && !(q[i - 1] < p.q)) continue;
      if (C[i] > hh[i] && up(i)) L[i] = 1; else if (C[i] < ll[i] && dn(i)) S[i] = 1;
    }
    warm = Math.max(warm, p.N + 100);
    if (cfg.exit.chan) {
      const m = cfg.exit.chan; stopL = ctx.m('cl' + m, () => I.lowest(Lo, m)); stopS = ctx.m('ch' + m, () => I.highest(H, m));
    }
  } else if (cfg.fam === 'roc') {
    const sc = ctx.m('rz' + p.n, () => { const o = new Float64Array(n).fill(NaN); for (let i = p.n; i < n; i++) o[i] = (C[i] - C[i - p.n]) / (atr[i] * Math.sqrt(p.n)); return o; });
    for (let i = 1; i < n; i++) {
      if (sc[i] > p.k && !(sc[i - 1] > p.k) && up(i)) L[i] = 1; else if (sc[i] < -p.k && !(sc[i - 1] < -p.k) && dn(i)) S[i] = 1;
    }
    warm = Math.max(warm, p.n + 20);
  } else if (cfg.fam === 'ichi') {
    const x = ichi(ctx, p.t, p.k, p.s);
    for (let i = 1; i < n; i++) {
      const top = Math.max(x.saS[i], x.sbS[i]), bot = Math.min(x.saS[i], x.sbS[i]);
      if (!(top === top)) continue;
      const cu = x.tk[i] > x.kj[i] && !(x.tk[i - 1] > x.kj[i - 1]);
      const cd = x.tk[i] < x.kj[i] && !(x.tk[i - 1] < x.kj[i - 1]);
      if (p.mode === 'cloud') {
        const a = C[i] > top && !(C[i - 1] > Math.max(x.saS[i - 1], x.sbS[i - 1])), b = C[i] < bot && !(C[i - 1] < Math.min(x.saS[i - 1], x.sbS[i - 1]));
        if (a && up(i)) L[i] = 1; else if (b && dn(i)) S[i] = 1;
      } else {
        if (cu && C[i] > top && up(i)) L[i] = 1; else if (cd && C[i] < bot && dn(i)) S[i] = 1;
      }
    }
    warm = Math.max(warm, p.s + p.k + 10);
    if (cfg.exit.kijunStop) { stopL = x.kj; stopS = x.kj; }
  } else if (cfg.fam === 'pull') {
    const r = ctx.m('rsi' + p.r, () => I.rsi(C, p.r)), sl = ctx.m('sma' + p.T, () => I.sma(C, p.T)), sl2 = sh(sl, p.sk || 20);
    for (let i = 1; i < n; i++) {
      const tu = C[i] > sl[i] && sl[i] > sl2[i], td = C[i] < sl[i] && sl[i] < sl2[i];
      if (tu && r[i - 1] < p.lo && r[i] >= p.lo) L[i] = 1; else if (td && r[i - 1] > 100 - p.lo && r[i] <= 100 - p.lo) S[i] = 1;
    }
    warm = Math.max(warm, p.T + 40);
  } else if (cfg.fam === 'slope') {
    const m = ctx.m('sma' + p.n, () => I.sma(C, p.n));
    const z = ctx.m('slz' + p.n + ',' + p.m, () => { const o = new Float64Array(n).fill(NaN); for (let i = p.m; i < n; i++) o[i] = (m[i] - m[i - p.m]) / atr[i]; return o; });
    for (let i = 1; i < n; i++) {
      if (z[i] > p.k && !(z[i - 1] > p.k) && C[i] > m[i] && up(i)) L[i] = 1; else if (z[i] < -p.k && !(z[i - 1] < -p.k) && C[i] < m[i] && dn(i)) S[i] = 1;
    }
    warm = Math.max(warm, p.n + p.m + 20);
  }
  return { L, S, stopL, stopS, warmup: warm };
}
const exOf = (cfg) => { const e = cfg.exit; return { kInit: e.k || 3, kTrail: e.trail || 0, maxBars: e.bars || 0, sigExit: false }; };
module.exports = { build, exOf };
