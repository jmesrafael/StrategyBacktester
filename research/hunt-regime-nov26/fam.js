// fam.js - regime-filtered range / failed-breakout families. All indicators causal. Regime chosen BEFORE testing:
// ranging = efficiency ratio ER(erN) < erMax  (also ADX(14)<adxMax variant). Pre-registered grids, small.
'use strict';
const L = require('./lib.js'), I = L.I, ok = I.ok;
const TFH = L.IV === 14400 ? 4 : 1; // bars per hour factor: scale lookbacks so 1h/4h cover the same wall time /4
const er = (c, n) => c.m('er' + n, () => I.efficiency(c.C, n));
const adx = (c) => c.m('adx14', () => I.adx(c.H, c.L, c.C, 14).adx);
const smaC = (c, n) => c.m('sma' + n, () => I.sma(c.C, n));
const bb = (c, n) => c.m('bb' + n, () => ({ mid: I.sma(c.C, n), sd: I.stdev(c.C, n) }));
const hi = (c, n) => c.m('hi' + n, () => I.highest(c.H, n));
const lo = (c, n) => c.m('lo' + n, () => I.lowest(c.L, n));
const rsiC = (c, n) => c.m('rsi' + n, () => I.rsi(c.C, n));

function regime(c, p) { // returns Uint8Array range flag at close i
  const e = er(c, p.erN), a = adx(c), f = new Uint8Array(c.n);
  for (let i = 0; i < c.n; i++) {
    if (p.noReg) { f[i] = 1; continue; }
    if (!ok(e[i])) continue;
    if (e[i] < p.erMax && (!p.adxMax || (ok(a[i]) && a[i] < p.adxMax))) f[i] = 1;
  }
  return f;
}
const base = (c) => ({ L: new Uint8Array(c.n), S: new Uint8Array(c.n), stopL: new Float64Array(c.n), stopS: new Float64Array(c.n), xL: new Uint8Array(c.n), xS: new Uint8Array(c.n) });

// A: Donchian failed breakout. bar i-j (j<=look) broke the prior N-bar channel; close[i] back inside -> fade. Stop beyond extreme.
function failDonch(c, p) {
  const o = base(c), reg = regime(c, p), hN = hi(c, p.N), lN = lo(c, p.N), m = smaC(c, p.N), n = c.n;
  o.warmup = Math.max(p.N, p.erN) + 10;
  for (let i = o.warmup; i < n; i++) {
    const a = c.atr14[i]; if (!ok(a) || !ok(hN[i - p.look - 1]) || !reg[i - (p.regLag || 0)]) continue;
    // channel before the break window
    const ch = i - p.look - 1, H0 = hN[ch], L0 = lo(c, p.N)[ch];
    let bh = -Infinity, bl = Infinity;
    for (let j = i - p.look; j <= i; j++) { if (c.H[j] > bh) bh = c.H[j]; if (c.L[j] < bl) bl = c.L[j]; }
    if (bh > H0 && c.C[i] < H0 && c.C[i - 1] >= 0) { // failed up-break -> short
      const st = bh + p.pad * a; if (st - c.C[i] > p.minStop * a) { o.S[i] = 1; o.stopS[i] = st; }
    } else if (bl < L0 && c.C[i] > L0) {
      const st = bl - p.pad * a; if (c.C[i] - st > p.minStop * a) { o.L[i] = 1; o.stopL[i] = st; }
    }
    o.xL[i] = c.C[i] >= m[i] ? 1 : 0; o.xS[i] = c.C[i] <= m[i] ? 1 : 0;
  }
  return o;
}
// B: Bollinger failed breakout: close beyond band within last `look` bars, now closes back inside.
function failBB(c, p) {
  const o = base(c), reg = regime(c, p), b = bb(c, p.len), n = c.n;
  o.warmup = Math.max(p.len, p.erN) + 10;
  for (let i = o.warmup; i < n; i++) {
    const a = c.atr14[i]; if (!ok(a) || !ok(b.mid[i]) || !reg[i]) continue;
    let ex = 0, bh = -Infinity, bl = Infinity;
    for (let j = i - p.look; j < i; j++) {
      const up = b.mid[j] + p.mult * b.sd[j], dn = b.mid[j] - p.mult * b.sd[j];
      if (c.C[j] > up) ex = 1; else if (c.C[j] < dn) ex = -1;
      if (c.H[j] > bh) bh = c.H[j]; if (c.L[j] < bl) bl = c.L[j];
    }
    const up = b.mid[i] + p.mult * b.sd[i], dn = b.mid[i] - p.mult * b.sd[i];
    if (ex === 1 && c.C[i] < up) { const st = Math.max(bh, c.H[i]) + p.pad * a; if (st - c.C[i] > p.minStop * a) { o.S[i] = 1; o.stopS[i] = st; } }
    else if (ex === -1 && c.C[i] > dn) { const st = Math.min(bl, c.L[i]) - p.pad * a; if (c.C[i] - st > p.minStop * a) { o.L[i] = 1; o.stopL[i] = st; } }
    o.xL[i] = c.C[i] >= b.mid[i] ? 1 : 0; o.xS[i] = c.C[i] <= b.mid[i] ? 1 : 0;
  }
  return o;
}
// C: RSI extreme in a ranging regime, ATR stop, exit RSI back to 50 (or time).
function rsiRange(c, p) {
  const o = base(c), reg = regime(c, p), r = rsiC(c, p.rsiN), n = c.n;
  o.warmup = Math.max(p.erN, 30) + 10;
  for (let i = o.warmup; i < n; i++) {
    const a = c.atr14[i]; if (!ok(a) || !ok(r[i]) || !reg[i]) continue;
    if (r[i] < p.lo) { const st = c.C[i] - p.kStop * a; o.L[i] = 1; o.stopL[i] = st; }
    else if (r[i] > 100 - p.lo) { const st = c.C[i] + p.kStop * a; o.S[i] = 1; o.stopS[i] = st; }
    o.xL[i] = r[i] >= 50 ? 1 : 0; o.xS[i] = r[i] <= 50 ? 1 : 0;
  }
  return o;
}
// D: parabolic-spike fade (short only after spike up; long after spike down), no regime flag; filter = spike size in ATR and stretch from SMA.
function spike(c, p) {
  const o = base(c), n = c.n, m = smaC(c, p.ma);
  o.warmup = p.ma + 10;
  for (let i = o.warmup; i < n; i++) {
    const a = c.atr14[i]; if (!ok(a) || !ok(m[i])) continue;
    const mv = (c.C[i - 1] - c.C[i - 1 - p.N]) / a; // move over N bars up to previous bar, in ATR
    const str = (c.C[i - 1] - m[i]) / a;
    if (mv > p.k && str > p.s && c.C[i] < c.L[i - 1]) { const st = Math.max(c.H[i], c.H[i - 1]) + 0.5 * a; o.S[i] = 1; o.stopS[i] = st; }
    else if (!p.shortOnly && mv < -p.k && str < -p.s && c.C[i] > c.H[i - 1]) { const st = Math.min(c.L[i], c.L[i - 1]) - 0.5 * a; o.L[i] = 1; o.stopL[i] = st; }
    o.xL[i] = c.C[i] >= m[i] ? 1 : 0; o.xS[i] = c.C[i] <= m[i] ? 1 : 0;
  }
  return o;
}
// E: weekend drift: enter at given UTC hour on given weekday, direction d, fixed ATR stop, time exit.
function weekend(c, p) {
  const o = base(c), n = c.n;
  o.warmup = 810;
  const reg = p.erN ? regime(c, p) : null, tr = smaC(c, 800);
  for (let i = o.warmup; i < n; i++) {
    const a = c.atr14[i]; if (!ok(a)) continue;
    if (reg && !reg[i]) continue;
    if (p.trend && !(p.dir > 0 ? c.C[i] > tr[i] : c.C[i] < tr[i])) continue;
    const d = new Date((c.B[i].time + L.IV) * 1000); // decision at close of bar i = time of next open
    if (d.getUTCDay() === p.day && d.getUTCHours() === p.hour) {
      if (p.dir >= 0) { o.L[i] = 1; o.stopL[i] = c.C[i] - p.kStop * a; } else { o.S[i] = 1; o.stopS[i] = c.C[i] + p.kStop * a; }
    }
  }
  return o;
}
module.exports = { failDonch, failBB, rsiRange, spike, weekend, regime };
