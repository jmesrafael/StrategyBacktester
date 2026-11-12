// mtf.js — Multi-timeframe confluence strategy ("Triple Screen" style), built on the bots' validated trade loop.
//   Screen 1 (daily, trend)   : last COMPLETED UTC day: close > EMA50 and EMA20 > EMA50 (mirror for shorts)      [required]
//   Screen 2 (4h, setup)      : last CLOSED 4h bar: close > SMA200 (the bots' trend rule)                        [required]
//                               + ADX(14) > 20 with +DI > -DI                                                       ['adx']
//                               + pullback: 4h RSI(14) dipped below 45 within the last 6 closed 4h bars             ['pull']
//   Screen 3 (1h, trigger)    : 1h close > highest high of the previous 6 hours and > 1h EMA20                    [required]
//                               + 1h volume >= 1.5x its 20-bar average                                              ['vol']
//   Exits (price distances in 4h ATR, so they match I-CORE/T-CORE): P7 = 2 ATR stop + 7 ATR trail, P14 = 2 + 14,
//                               SW7 = stop under the lowest low of the last 12 hours + 7 ATR trail.
// No look-ahead: a 1h bar closing at t only sees 4h bars that closed by t and days that ended by t. audit.js checks this.
'use strict';
const path = require('path');
const LIB = require(path.join(__dirname, '../../candles/candles.js'));
const I = require(path.join(__dirname, '../strat-hunt-nov6/ind.js'));
const { run, stats, COST } = require(path.join(__dirname, '../strat-hunt-nov6/engine.js'));
const { ok } = I;
const toB = rows => rows.map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));

function build(coin, opt = {}) {
  const tEnd = opt.tEnd || Infinity;
  const h1 = toB(LIB.load(coin, '1h').filter(r => r[0] + 3600 <= tEnd));
  const h4 = toB(LIB.load(coin, '4h').filter(r => r[0] + 14400 <= tEnd));
  const funding = LIB.funding(coin).filter(r => r[0] <= tEnd);
  // ---- 4h indicators
  const H4 = Float64Array.from(h4, b => b.high), L4 = Float64Array.from(h4, b => b.low), C4 = Float64Array.from(h4, b => b.close);
  const sma200 = I.sma(C4, 200), atr4 = I.atr(H4, L4, C4, 14), dmi = I.adx(H4, L4, C4, 14), rsi4 = I.rsi(C4, 14);
  const rsiMin6 = I.lowest(rsi4, 6), rsiMax6 = I.highest(rsi4, 6);
  // ---- daily bars from 4h (a day is usable once its 20:00 bar has closed = day start + 86400)
  const days = []; for (const b of h4) { const d = Math.floor(b.time / 86400) * 86400; const x = days[days.length - 1]; if (!x || x.t !== d) days.push({ t: d, c: b.close, n: 1 }); else { x.c = b.close; x.n++; } }
  const DC = Float64Array.from(days, d => d.c), e20 = I.ema(DC, 20), e50 = I.ema(DC, 50);
  // ---- 1h indicators
  const n = h1.length, H = Float64Array.from(h1, b => b.high), L = Float64Array.from(h1, b => b.low), C = Float64Array.from(h1, b => b.close), V = Float64Array.from(h1, b => b.volume);
  const ema20 = I.ema(C, 20), hh6 = I.highest(H, 6), ll6 = I.lowest(L, 6), ll12 = I.lowest(L, 12), hh12 = I.highest(H, 12), v20 = I.sma(V, 20);
  // ---- align: for 1h bar i (closes at t1) -> last closed 4h bar j, last completed day k
  const A4 = new Int32Array(n).fill(-1), AD = new Int32Array(n).fill(-1), ATR = new Float64Array(n).fill(NaN);
  for (let i = 0, j = -1, k = -1, kc = -1; i < n; i++) {
    const t1 = h1[i].time + 3600;
    while (j + 1 < h4.length && h4[j + 1].time + 14400 <= t1) j++;
    while (k + 1 < days.length && days[k + 1].t + 86400 <= t1) { k++; if (days[k].n === 6) kc = k; }   // last FINISHED, complete day
    A4[i] = j; AD[i] = kc; ATR[i] = j >= 0 ? atr4[j] : NaN;
  }
  return { coin, h1, n, H, L, C, V, ema20, hh6, ll6, ll12, hh12, v20, A4, AD, ATR, C4, sma200, dmi, rsiMin6, rsiMax6, DC, e20, e50, funding };
}

function signals(d, cfg) {
  const f = new Set(cfg.filters || []), { n } = d, Lf = new Uint8Array(n), Sf = new Uint8Array(n), stopL = new Float64Array(n).fill(NaN), stopS = new Float64Array(n).fill(NaN);
  for (let i = 7; i < n; i++) {
    const j = d.A4[i], k = d.AD[i]; if (j < 0 || k < 0) continue;
    if (!ok(d.sma200[j]) || !ok(d.e50[k]) || !ok(d.ATR[i]) || !ok(d.ema20[i]) || !ok(d.v20[i - 1])) continue;
    const up1 = d.DC[k] > d.e50[k] && d.e20[k] > d.e50[k], dn1 = d.DC[k] < d.e50[k] && d.e20[k] < d.e50[k];
    const up2 = d.C4[j] > d.sma200[j], dn2 = d.C4[j] < d.sma200[j];
    const trig = d.C[i] > d.hh6[i - 1] && d.C[i] > d.ema20[i], trigS = d.C[i] < d.ll6[i - 1] && d.C[i] < d.ema20[i];
    const volOk = d.V[i] >= 1.5 * d.v20[i - 1];
    let L = up1 && up2 && trig, S = dn1 && dn2 && trigS;
    if (f.has('adx')) { L = L && d.dmi.adx[j] > 20 && d.dmi.pdi[j] > d.dmi.mdi[j]; S = S && d.dmi.adx[j] > 20 && d.dmi.mdi[j] > d.dmi.pdi[j]; }
    if (f.has('pull')) { L = L && d.rsiMin6[j] < 45; S = S && d.rsiMax6[j] > 55; }
    if (f.has('vol')) { L = L && volOk; S = S && volOk; }
    if (cfg.dir === 'long') S = false;
    if (L) { Lf[i] = 1; stopL[i] = d.ll12[i]; }
    if (S) { Sf[i] = 1; stopS[i] = d.hh12[i]; }
  }
  const st = { L: Lf, S: Sf, warmup: 1300 };
  if (cfg.exit === 'SW7') { st.stopL = stopL; st.stopS = stopS; }
  return st;
}
const EXITS = { P7: { kInit: 2, kTrail: 7, maxBars: 0, sigExit: false }, P14: { kInit: 2, kTrail: 14, maxBars: 0, sigExit: false }, SW7: { kInit: 0, kTrail: 7, maxBars: 0, sigExit: false } };

function backtest(coin, cfg, opt = {}) {
  const d = opt.data || build(coin, opt);
  const r = run(d.h1, d.ATR, signals(d, cfg), EXITS[cfg.exit], d.funding, 3600, opt.cost || COST);
  return r.trades.map(t => ({ ...t, coin }));
}
module.exports = { build, signals, backtest, EXITS, stats, COST };
