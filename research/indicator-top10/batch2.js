// batch2.js — NEXT indicators from the pasted list (rest of Trend + Volatility/Channel breakouts), 4h, 7 coins, same trade loop/costs as rstrat.js.
// Every indicator is computed forward-only (value at bar i uses bars <= i); entry decided on closed bar i, filled at open i+1.
// Usage: node batch2.js            -> sweep, writes results-B2.json
process.env.COINS = process.env.COINS || 'SOL,ZEC,NEAR,ADA,GALA,BTC,ETH';
const fs = require('fs');
const { sim, COINS, D, SPLIT } = require('./rstrat.js');
const { account } = require('./baseline');
const NaNv = NaN, isn = Number.isNaN;

// ---------- helpers (all causal) ----------
const sma = (x, n) => { const o = new Array(x.length).fill(NaNv); let s = 0, c = 0; const q = [];
  for (let i = 0; i < x.length; i++) { if (isn(x[i])) { o[i] = NaNv; continue; } q.push(x[i]); s += x[i]; if (q.length > n) s -= q.shift(); if (q.length === n) o[i] = s / n; } return o; };
const ema = (x, n, k = 2 / (n + 1)) => { const o = new Array(x.length).fill(NaNv); let cnt = 0, s = 0, v = NaNv;
  for (let i = 0; i < x.length; i++) { if (isn(x[i])) continue; cnt++; if (cnt < n) { s += x[i]; continue; } if (cnt === n) { s += x[i]; v = s / n; o[i] = v; continue; } v = x[i] * k + v * (1 - k); o[i] = v; } return o; };
const rma = (x, n) => ema(x, n, 1 / n);
const wma = (x, n) => { const o = new Array(x.length).fill(NaNv), d = n * (n + 1) / 2; for (let i = n - 1; i < x.length; i++) { let s = 0, ok = true; for (let k = 0; k < n; k++) { const v = x[i - k]; if (isn(v)) { ok = false; break; } s += v * (n - k); } if (ok) o[i] = s / d; } return o; };
const hi = (x, n) => x.map((_, i) => { if (i < n - 1) return NaNv; let m = -Infinity; for (let k = 0; k < n; k++) m = Math.max(m, x[i - k]); return m; });
const lo = (x, n) => x.map((_, i) => { if (i < n - 1) return NaNv; let m = Infinity; for (let k = 0; k < n; k++) m = Math.min(m, x[i - k]); return m; });
const shift = (x, k) => x.map((_, i) => i - k >= 0 ? x[i - k] : NaNv);
const trOf = (H, L, C) => H.map((h, i) => i ? Math.max(h - L[i], Math.abs(h - C[i - 1]), Math.abs(L[i] - C[i - 1])) : h - L[i]);
const atrN = (H, L, C, n) => { const t = trOf(H, L, C); t[0] = NaNv; return rma(t, n); }; // Wilder
const std = (x, n) => x.map((_, i) => { if (i < n - 1) return NaNv; let m = 0; for (let k = 0; k < n; k++) m += x[i - k]; m /= n; let v = 0; for (let k = 0; k < n; k++) v += (x[i - k] - m) ** 2; return Math.sqrt(v / n); });
const linreg = (x, n) => { const o = new Array(x.length).fill(NaNv), sx = n * (n - 1) / 2, sxx = (n - 1) * n * (2 * n - 1) / 6;
  for (let i = n - 1; i < x.length; i++) { let sy = 0, sxy = 0; for (let k = 0; k < n; k++) { const y = x[i - n + 1 + k]; sy += y; sxy += k * y; }
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n; o[i] = a + b * (n - 1); } return o; };
const up = (a, b) => a.map((_, i) => i && !isn(a[i]) && !isn(b[i]) && !isn(a[i - 1]) && !isn(b[i - 1]) && a[i] > b[i] && a[i - 1] <= b[i - 1] ? 1 : 0);
const crossC = (a, c) => a.map((_, i) => i && !isn(a[i]) && !isn(a[i - 1]) && a[i] > c && a[i - 1] <= c ? 1 : 0);
const onset = cond => cond.map((v, i) => v && !(i && cond[i - 1]) ? 1 : 0); // condition newly true

// ---------- indicators -> long-entry event arrays ----------
const IND2 = {
  ZLEMA: (d, n) => { const lag = Math.round((n - 1) / 2), C = d.C, z = C.map((v, i) => i >= lag ? 2 * v - C[i - lag] : NaNv); return up(C, ema(z, n)); },
  LSMA: (d, n) => up(d.C, linreg(d.C, n)),
  McGinley: (d, n) => { const C = d.C, m = new Array(C.length).fill(NaNv); for (let i = 0; i < C.length; i++) { if (i === 0) { m[i] = C[i]; continue; } const p = m[i - 1]; m[i] = p + (C[i] - p) / (0.6 * n * Math.pow(C[i] / p, 4)); } return up(C, m.map((v, i) => i < n ? NaNv : v)); },
  Supertrend: (d, n, m) => { const H = d.b.map(r => r[2]), L = d.b.map(r => r[3]), C = d.C, A = atrN(H, L, C, n), N = C.length, fu = new Array(N).fill(NaNv), fl = new Array(N).fill(NaNv), dir = new Array(N).fill(0);
    for (let i = 1; i < N; i++) { if (isn(A[i])) continue; const mid = (H[i] + L[i]) / 2, u = mid + m * A[i], l = mid - m * A[i];
      if (isn(fu[i - 1])) { fu[i] = u; fl[i] = l; dir[i] = C[i] > u ? 1 : -1; continue; }
      fu[i] = (u < fu[i - 1] || C[i - 1] > fu[i - 1]) ? u : fu[i - 1]; fl[i] = (l > fl[i - 1] || C[i - 1] < fl[i - 1]) ? l : fl[i - 1];
      dir[i] = dir[i - 1] === 1 ? (C[i] < fl[i] ? -1 : 1) : (C[i] > fu[i] ? 1 : -1); }
    return dir.map((v, i) => v === 1 && i && dir[i - 1] === -1 ? 1 : 0); },
  PSAR: (d, step, mx) => { const H = d.b.map(r => r[2]), L = d.b.map(r => r[3]), N = H.length, ev = new Array(N).fill(0); let long = true, sar = L[0], ep = H[0], af = step;
    for (let i = 1; i < N; i++) { let ns = sar + af * (ep - sar);
      if (long) { ns = Math.min(ns, L[i - 1], i > 1 ? L[i - 2] : L[i - 1]); if (L[i] < ns) { long = false; ns = ep; ep = L[i]; af = step; } else if (H[i] > ep) { ep = H[i]; af = Math.min(af + step, mx); } }
      else { ns = Math.max(ns, H[i - 1], i > 1 ? H[i - 2] : H[i - 1]); if (H[i] > ns) { long = true; ev[i] = 1; ns = ep; ep = H[i]; af = step; } else if (L[i] < ep) { ep = L[i]; af = Math.min(af + step, mx); } }
      sar = ns; } return ev; },
  Aroon: (d, n) => { const H = d.b.map(r => r[2]), L = d.b.map(r => r[3]), N = H.length, U = new Array(N).fill(NaNv), Dn = new Array(N).fill(NaNv);
    for (let i = n; i < N; i++) { let hb = 0, lb = 0; for (let k = 0; k <= n; k++) { if (H[i - k] >= H[i - hb]) hb = k; if (L[i - k] <= L[i - lb]) lb = k; } U[i] = 100 * (n - hb) / n; Dn[i] = 100 * (n - lb) / n; }
    return up(U, Dn); },
  DMI: (d, n, adxMin) => { const H = d.b.map(r => r[2]), L = d.b.map(r => r[3]), C = d.C, N = C.length, pdm = new Array(N).fill(0), mdm = new Array(N).fill(0);
    for (let i = 1; i < N; i++) { const u = H[i] - H[i - 1], dn = L[i - 1] - L[i]; pdm[i] = u > dn && u > 0 ? u : 0; mdm[i] = dn > u && dn > 0 ? dn : 0; }
    pdm[0] = mdm[0] = NaNv; const t = trOf(H, L, C); t[0] = NaNv; const A = rma(t, n), P = rma(pdm, n).map((v, i) => 100 * v / A[i]), M = rma(mdm, n).map((v, i) => 100 * v / A[i]);
    const dx = P.map((p, i) => 100 * Math.abs(p - M[i]) / (p + M[i])), adx = rma(dx, n), x = up(P, M); return x.map((v, i) => v && adx[i] >= adxMin ? 1 : 0); },
  Vortex: (d, n) => { const H = d.b.map(r => r[2]), L = d.b.map(r => r[3]), C = d.C, N = H.length, vp = new Array(N).fill(NaNv), vm = new Array(N).fill(NaNv), t = trOf(H, L, C);
    for (let i = 1; i < N; i++) { vp[i] = Math.abs(H[i] - L[i - 1]); vm[i] = Math.abs(L[i] - H[i - 1]); } t[0] = NaNv;
    const sv = (x) => { const o = new Array(N).fill(NaNv); for (let i = n; i < N; i++) { let s = 0; for (let k = 0; k < n; k++) s += x[i - k]; o[i] = s; } return o; };
    const sp = sv(vp), sm = sv(vm), st = sv(t); return up(sp.map((v, i) => v / st[i]), sm.map((v, i) => v / st[i])); },
  MACD: (d, f, s, g, mode) => { const e1 = ema(d.C, f), e2 = ema(d.C, s), m = e1.map((v, i) => v - e2[i]), sg = ema(m, g); return mode === 'sig' ? up(m, sg) : mode === 'sigpos' ? up(m, sg).map((v, i) => v && m[i] > 0 ? 1 : 0) : crossC(m, 0); },
  TRIX: (d, n, mode) => { const l = d.C.map(Math.log), t = ema(ema(ema(l, n), n), n), r = t.map((v, i) => i ? (v - t[i - 1]) * 10000 : NaNv); return mode === 'zero' ? crossC(r, 0) : up(r, ema(r, 9)); },
  TSI: (d, a, b) => { const C = d.C, m = C.map((v, i) => i ? v - C[i - 1] : NaNv), am = m.map(Math.abs), num = ema(ema(m, a), b), den = ema(ema(am, a), b), t = num.map((v, i) => 100 * v / den[i]); return up(t, ema(t, 13)); },
  STC: (d, f, s, cyc, lvl) => { const e1 = ema(d.C, f), e2 = ema(d.C, s), m = e1.map((v, i) => v - e2[i]), N = m.length;
    const stoch = (x) => x.map((_, i) => { if (i < cyc - 1 || isn(x[i])) return NaNv; let a = Infinity, b = -Infinity, ok = true; for (let k = 0; k < cyc; k++) { const v = x[i - k]; if (isn(v)) { ok = false; break; } a = Math.min(a, v); b = Math.max(b, v); } return ok ? (b > a ? 100 * (x[i] - a) / (b - a) : 0) : NaNv; });
    const sm = (x) => { const o = new Array(N).fill(NaNv); let p = NaNv; for (let i = 0; i < N; i++) { if (isn(x[i])) continue; p = isn(p) ? x[i] : p + 0.5 * (x[i] - p); o[i] = p; } return o; };
    return crossC(sm(stoch(sm(stoch(m)))), lvl); },
  CKSP: (d, p, x, q) => { const H = d.b.map(r => r[2]), L = d.b.map(r => r[3]), C = d.C, A = atrN(H, L, C, p), fh = hi(H, p).map((v, i) => v - x * A[i]), fl = lo(L, p).map((v, i) => v + x * A[i]), ss = hi(fh, q), sl = lo(fl, q);
    return onset(C.map((c, i) => !isn(ss[i]) && c > ss[i] ? 1 : 0)); },
  LRslope: (d, n) => { const lr = linreg(d.C, n); return crossC(lr.map((v, i) => i ? v - lr[i - 1] : NaNv), 0); },
  Donchian: (d, n) => { const H = d.b.map(r => r[2]), C = d.C, ph = shift(hi(H, n), 1); return onset(C.map((c, i) => !isn(ph[i]) && c > ph[i] ? 1 : 0)); },
  Keltner: (d, n, m) => { const H = d.b.map(r => r[2]), L = d.b.map(r => r[3]), C = d.C, e = ema(C, n), A = atrN(H, L, C, 10), u = e.map((v, i) => v + m * A[i]); return up(C, u); },
  Squeeze: (d, n) => { const H = d.b.map(r => r[2]), L = d.b.map(r => r[3]), C = d.C, mid = sma(C, n), sd = std(C, n), A = atrN(H, L, C, n),
      on = C.map((_, i) => !isn(mid[i]) && !isn(A[i]) && mid[i] + 2 * sd[i] < mid[i] + 1.5 * A[i] && mid[i] - 2 * sd[i] > mid[i] - 1.5 * A[i] ? 1 : 0);
    return C.map((c, i) => i && on[i - 1] && !on[i] && c > mid[i] ? 1 : 0); },
  Chandelier: (d, n, m) => { const H = d.b.map(r => r[2]), L = d.b.map(r => r[3]), C = d.C, A = atrN(H, L, C, n), hh = hi(H, n), ce = hh.map((v, i) => v - m * A[i]), N = C.length; // price back above chandelier line after being below
    return onset(C.map((c, i) => !isn(ce[i]) && c > ce[i] ? 1 : 0)); },
};

// parameter grid: [indicator, label, args]
const CFG = [];
for (const n of [20, 50, 100, 200]) { CFG.push(['ZLEMA', 'n' + n, [n]], ['LSMA', 'n' + n, [n]], ['McGinley', 'n' + n, [n]]); }
for (const n of [7, 10, 14]) for (const m of [2, 3, 4]) CFG.push(['Supertrend', `atr${n}x${m}`, [n, m]]);
for (const [s, x] of [[.02, .2], [.01, .1], [.03, .3]]) CFG.push(['PSAR', `step${s}`, [s, x]]);
for (const n of [14, 25, 50, 100]) CFG.push(['Aroon', 'n' + n, [n]]);
for (const n of [14, 28]) for (const a of [0, 20, 25]) CFG.push(['DMI', `n${n}adx${a}`, [n, a]]);
for (const n of [14, 21, 42]) CFG.push(['Vortex', 'n' + n, [n]]);
for (const [f, s, g] of [[12, 26, 9], [24, 52, 18], [8, 17, 9]]) for (const md of ['sig', 'sigpos', 'zero']) CFG.push(['MACD', `${f}-${s}-${g}${md}`, [f, s, g, md]]);
for (const n of [15, 30, 60]) for (const md of ['zero', 'sig']) CFG.push(['TRIX', `n${n}${md}`, [n, md]]);
for (const [a, b] of [[25, 13], [50, 25]]) CFG.push(['TSI', `${a}-${b}`, [a, b]]);
for (const [f, s, c, l] of [[23, 50, 10, 25], [23, 50, 10, 50], [46, 100, 20, 25]]) CFG.push(['STC', `${f}-${s}-${c}@${l}`, [f, s, c, l]]);
for (const [p, x, q] of [[10, 1, 9], [20, 2, 18], [40, 2, 36]]) CFG.push(['CKSP', `${p}-${x}-${q}`, [p, x, q]]);
for (const n of [50, 100, 200]) CFG.push(['LRslope', 'n' + n, [n]]);
for (const n of [20, 50, 100, 200]) CFG.push(['Donchian', 'n' + n, [n]]);
for (const [n, m] of [[20, 2], [50, 3], [100, 3]]) CFG.push(['Keltner', `ema${n}x${m}`, [n, m]]);
for (const n of [20, 50]) CFG.push(['Squeeze', 'n' + n, [n]]);
for (const [n, m] of [[22, 3], [50, 5], [100, 8]]) CFG.push(['Chandelier', `n${n}x${m}`, [n, m]]);

function eventsFor(ind, args, c, filt) { const d = D[c], ev = IND2[ind](d, ...args), C = d.C;
  return ev.map((s, i) => s && (!filt || (!isn(d.S200[i]) && C[i] > d.S200[i])) ? 1 : 0); }
function run(ind, args, filt, kI, kT) { const all = []; for (const c of COINS) all.push(...sim(c, eventsFor(ind, args, c, filt), kI, kT, 600, 'open', 'nextOpen'));
  return { full: account(all), train: account(all, .025, 0, SPLIT), test: account(all, .025, SPLIT), trades: all }; }
module.exports = { run, IND2, CFG, eventsFor };

if (require.main === module) {
  const res = []; let k = 0; const tot = CFG.length * 2 * 2 * 3;
  for (const [ind, lab, args] of CFG) for (const filt of [false, true]) for (const kI of [2, 3]) for (const kT of [7, 14, 20]) {
    const r = run(ind, args, filt, kI, kT); res.push({ ind, lab, filt, kI, kT, full: r.full, train: r.train, test: r.test });
    if (++k % 50 === 0) process.stdout.write(`\r${k}/${tot}`); }
  fs.writeFileSync('results-B2.json', JSON.stringify(res)); console.log('\ndone', res.length);
}
