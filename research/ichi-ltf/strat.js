// strat.js — lower-TF (1h) entries inside a 4h Ichimoku trend, with SHORT holding exits (to differ from TRI-CORE).
// Entries (long; shorts mirrored), all need the 4h filter: last CLOSED 4h bar close above the 4h cloud and Tenkan > Kijun.
//   E1 ICHI : 1h Tenkan crosses above Kijun, 1h close above the 1h cloud, Chikou free (close > close 26 bars ago)
//   E2 ICHI+: E1 + RSI(14) between 50 and 70 + MACD(12,26,9) histogram > 0
//   E3 EMA  : 1h EMA9 crosses above EMA21 + RSI > 50 + MACD hist > 0
//   E4 DARV : 1h Darvas box (top = a high not exceeded for 3 bars, bottom = lowest low after it held for 3 bars) — close above the top + volume >= 1.5x avg
// Exits: T2 = stop at 1h Kijun (Darvas: box bottom), 2R target, 48-bar cap | KJ = same stop, exit on a 1h close back through Kijun, 96-bar cap
//        P7 = 2 ATR(4h) stop + 7 ATR trail (I-CORE's exit, reference only)
// Trade loop = the bots' engine (../strat-hunt-nov6/engine.js) plus a resting target (stop checked first inside a candle).
'use strict';
const path = require('path');
const LIB = require(path.join(__dirname, '../../candles/candles.js'));
const I = require(path.join(__dirname, '../strat-hunt-nov6/ind.js'));
const { COST } = require(path.join(__dirname, '../strat-hunt-nov6/engine.js'));
const { ok } = I;
const toB = rows => rows.map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));

function ichi(H, L, n) {
  const ten = I.midHL(H, L, 9), kij = I.midHL(H, L, 26), sb = I.midHL(H, L, 52), top = new Float64Array(n).fill(NaN), bot = new Float64Array(n).fill(NaN);
  for (let i = 26; i < n; i++) { const a = (ten[i - 26] + kij[i - 26]) / 2, b = sb[i - 26]; if (ok(a) && ok(b)) { top[i] = Math.max(a, b); bot[i] = Math.min(a, b); } }
  return { ten, kij, top, bot };
}
function darvas(H, L, C, n) {   // causal state machine; box known only once confirmed
  const bt = new Float64Array(n).fill(NaN), bb = new Float64Array(n).fill(NaN);
  let top = NaN, topI = -1, bottom = NaN, botI = -1, state = 0, boxT = NaN, boxB = NaN;
  for (let i = 0; i < n; i++) {
    if (state === 0) { if (topI < 0 || H[i] > top) { top = H[i]; topI = i; } else if (i - topI >= 3) { state = 1; bottom = L[topI]; botI = topI; for (let k = topI; k <= i; k++) if (L[k] < bottom) { bottom = L[k]; botI = k; } } }
    else if (state === 1) { if (H[i] > top) { state = 0; top = H[i]; topI = i; } else if (L[i] < bottom) { bottom = L[i]; botI = i; } else if (i - botI >= 3) { state = 2; boxT = top; boxB = bottom; } }
    else if (state === 2 && (C[i] > boxT || C[i] < boxB)) { state = 0; top = H[i]; topI = i; }   // box broken: start a new one
    bt[i] = boxT; bb[i] = boxB;   // last completed box (usable at bar i's close)
  }
  return { bt, bb };
}

function build(coin, opt = {}) {
  const tEnd = opt.tEnd || Infinity;
  const h1 = toB(LIB.load(coin, '1h').filter(r => r[0] + 3600 <= tEnd)), h4 = toB(LIB.load(coin, '4h').filter(r => r[0] + 14400 <= tEnd));
  const funding = LIB.funding(coin).filter(r => r[0] <= tEnd);
  const H4 = Float64Array.from(h4, b => b.high), L4 = Float64Array.from(h4, b => b.low), C4 = Float64Array.from(h4, b => b.close);
  const ich4 = ichi(H4, L4, h4.length), atr4 = I.atr(H4, L4, C4, 14);
  const n = h1.length, H = Float64Array.from(h1, b => b.high), L = Float64Array.from(h1, b => b.low), C = Float64Array.from(h1, b => b.close), V = Float64Array.from(h1, b => b.volume);
  const ich = ichi(H, L, n), rsi = I.rsi(C, 14), mac = I.macd(C), e9 = I.ema(C, 9), e21 = I.ema(C, 21), v20 = I.sma(V, 20), dv = darvas(H, L, C, n);
  const days = []; for (const b of h4) { const dd = Math.floor(b.time / 86400) * 86400, x = days[days.length - 1]; if (!x || x.t !== dd) days.push({ t: dd, c: b.close, n: 1 }); else { x.c = b.close; x.n++; } }
  const DC = Float64Array.from(days, x => x.c), de20 = I.ema(DC, 20), de50 = I.ema(DC, 50), hh6 = I.highest(H, 6), ll6 = I.lowest(L, 6), e20 = I.ema(C, 20), ll12 = I.lowest(L, 12), hh12 = I.highest(H, 12);
  const A4 = new Int32Array(n).fill(-1), AD = new Int32Array(n).fill(-1), ATR = new Float64Array(n).fill(NaN);
  for (let i = 0, j = -1, k = -1, kc = -1; i < n; i++) { const t1 = h1[i].time + 3600; while (j + 1 < h4.length && h4[j + 1].time + 14400 <= t1) j++; while (k + 1 < days.length && days[k + 1].t + 86400 <= t1) { k++; if (days[k].n === 6) kc = k; } A4[i] = j; AD[i] = kc; ATR[i] = j >= 0 ? atr4[j] : NaN; }
  return { coin, h1, n, H, L, C, V, ich, rsi, mac, e9, e21, v20, dv, A4, AD, ATR, ich4, C4, funding, DC, de20, de50, hh6, ll6, e20, ll12, hh12 };
}

function signals(d, entry, htf = 'ichi4') {
  const { n, C, ich } = d, Lf = new Uint8Array(n), Sf = new Uint8Array(n), stL = new Float64Array(n).fill(NaN), stS = new Float64Array(n).fill(NaN), xL = new Uint8Array(n), xS = new Uint8Array(n);
  for (let i = 60; i < n; i++) {
    if (ok(ich.kij[i])) { xL[i] = C[i] < ich.kij[i] ? 1 : 0; xS[i] = C[i] > ich.kij[i] ? 1 : 0; }
    const j = d.A4[i]; if (j < 0) continue;
    const t4 = d.ich4.top[j], b4 = d.ich4.bot[j], k = d.AD[i]; if (!ok(t4) || !ok(ich.top[i]) || !ok(d.mac.hist[i]) || !ok(d.v20[i - 1]) || k < 0 || !ok(d.de50[k])) continue;
    const iU = d.C4[j] > t4 && d.ich4.ten[j] > d.ich4.kij[j], iD = d.C4[j] < b4 && d.ich4.ten[j] < d.ich4.kij[j];
    const dU = d.DC[k] > d.de50[k] && d.de20[k] > d.de50[k], dD = d.DC[k] < d.de50[k] && d.de20[k] < d.de50[k];
    const upH = htf === 'ichi4' ? iU : htf === 'd1' ? dU : htf === 'both' ? iU && dU : true, dnH = htf === 'ichi4' ? iD : htf === 'd1' ? dD : htf === 'both' ? iD && dD : true;
    if (!upH && !dnH) continue;
    let L = false, S = false, sL = ich.kij[i], sS = ich.kij[i];
    const tkUp = ich.ten[i] > ich.kij[i] && ich.ten[i - 1] <= ich.kij[i - 1], tkDn = ich.ten[i] < ich.kij[i] && ich.ten[i - 1] >= ich.kij[i - 1];
    const e1L = tkUp && C[i] > ich.top[i] && C[i] > C[i - 26], e1S = tkDn && C[i] < ich.bot[i] && C[i] < C[i - 26];
    const momL = d.rsi[i] > 50 && d.rsi[i] < 70 && d.mac.hist[i] > 0, momS = d.rsi[i] < 50 && d.rsi[i] > 30 && d.mac.hist[i] < 0;
    if (entry === 'E1') { L = e1L; S = e1S; }
    else if (entry === 'E2') { L = e1L && momL; S = e1S && momS; }
    else if (entry === 'E3') { L = d.e9[i] > d.e21[i] && d.e9[i - 1] <= d.e21[i - 1] && d.rsi[i] > 50 && d.mac.hist[i] > 0; S = d.e9[i] < d.e21[i] && d.e9[i - 1] >= d.e21[i - 1] && d.rsi[i] < 50 && d.mac.hist[i] < 0; }
    else if (entry === 'E4') {
      const vol = d.V[i] >= 1.5 * d.v20[i - 1], T = d.dv.bt[i - 1], B = d.dv.bb[i - 1];
      L = ok(T) && C[i] > T && C[i - 1] <= T && vol; S = ok(B) && C[i] < B && C[i - 1] >= B && vol; sL = B; sS = T;
    }
    else if (entry === 'E5') { L = C[i] > d.hh6[i - 1] && C[i] > d.e20[i]; S = C[i] < d.ll6[i - 1] && C[i] < d.e20[i]; sL = d.ll12[i]; sS = d.hh12[i]; }
    if (L && upH) { Lf[i] = 1; stL[i] = sL; }
    if (S && dnH) { Sf[i] = 1; stS[i] = sS; }
  }
  return { L: Lf, S: Sf, stopL: stL, stopS: stS, xL, xS };
}

// bots' trade loop + optional resting target (tpR x stop distance). Decide at close i, fill at open i+1, stop first.
function run(B, ATR, st, ex, funding, iv, cost = COST) {
  const n = B.length, trades = []; let pos = null, pend = null, pendClose = false;
  const FT = funding.map(r => r[0]), FC = new Float64Array(funding.length + 1); for (let k = 0; k < funding.length; k++) FC[k + 1] = FC[k] + funding[k][1];
  const fidx = t => { let a = 0, b = FT.length; while (a < b) { const m = (a + b) >> 1; if (FT[m] <= t) a = m + 1; else b = m; } return a; };
  const exit = (px, i, why) => { const fr = FC[fidx(B[i].time + iv / 2)] - FC[fidx(B[pos.i0].time)]; const R = (pos.dir * (px - pos.entry) / pos.entry - 2 * cost.fee - pos.dir * fr) / pos.dist; trades.push({ dir: pos.dir, t: B[pos.i0].time, tExit: B[i].time + iv, R, why, bars: i - pos.i0 + 1 }); pos = null; };
  for (let i = 1; i < n; i++) {
    const b = B[i];
    if (pend) {
      const d = pend.dir, fill = b.open * (1 + d * cost.slip); let stop, dist;
      if (ex.atrStop) { stop = fill - d * ex.atrStop * pend.atr; } else stop = pend.stop;
      dist = Math.abs(fill - stop) / fill;
      if (dist > 0.001 && (d === 1 ? stop < fill : stop > fill)) pos = { dir: d, i0: i, entry: fill, stop, dist, ext: b.open, tp: ex.tpR ? fill * (1 + d * ex.tpR * dist) : null };
      pend = null;
    }
    if (pendClose && pos) exit(b.open * (1 - pos.dir * cost.slip), i, 'sig'); pendClose = false;
    if (pos) {
      const d = pos.dir;
      if (d === 1 ? b.low <= pos.stop : b.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, b.open) : Math.max(pos.stop, b.open)) * (1 - d * cost.slip), i, 'stop');
      else if (pos.tp && (d === 1 ? b.high >= pos.tp : b.low <= pos.tp)) exit(d === 1 ? Math.max(pos.tp, b.open) : Math.min(pos.tp, b.open), i, 'tp');
      else if (ex.kTrail) { pos.ext = d === 1 ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low); const ns = pos.ext - d * ex.kTrail * ATR[i]; if (d === 1 ? ns > pos.stop : ns < pos.stop) pos.stop = ns; }
    }
    if (pos) { if (ex.maxBars && i - pos.i0 >= ex.maxBars) pendClose = true; else if (ex.sigExit && (pos.dir === 1 ? st.xL[i] : st.xS[i])) pendClose = true; continue; }
    if (i < 400 || !(ATR[i] > 0) || i + 1 >= n) continue;
    if (st.L[i] && st.stopL[i] > 0) pend = { dir: 1, stop: st.stopL[i], atr: ATR[i] };
    else if (st.S[i] && st.stopS[i] > 0) pend = { dir: -1, stop: st.stopS[i], atr: ATR[i] };
  }
  return trades;
}
const EXITS = { T2: { tpR: 2, maxBars: 48 }, T3: { tpR: 3, maxBars: 96 }, KJ: { sigExit: true, maxBars: 96 }, TM24: { maxBars: 24 }, P7: { atrStop: 2, kTrail: 7 }, P14: { atrStop: 2, kTrail: 14 } };
function backtest(coin, cfg, opt = {}) {
  const d = opt.data || build(coin, opt);
  return run(d.h1, d.ATR, signals(d, cfg.entry, cfg.htf || 'ichi4'), EXITS[cfg.exit], d.funding, 3600, opt.cost || COST).map(t => ({ ...t, coin }));
}
module.exports = { build, signals, backtest, EXITS, COST };
