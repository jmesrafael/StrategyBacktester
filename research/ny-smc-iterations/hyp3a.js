// hyp3a.js — Round 3 Part A: indicator filters on frozen v7 setups, live-style (setups filtered before execution). Protocol: ITERATION-LOG.md.
// usage: node hyp3a.js [SYM=SOL] [rules e.g. A1,A4] → results/hyp3a-<sym>.md
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js'), PD = require('./pdny.js'), I = require('./ind.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const SYM = process.argv[2] || 'SOL', ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const SPLIT = D0('2023-10-18'), END = D0('2026-10-18'), START = { SOL: D0('2020-10-18'), ETH: D0('2019-12-15') }[SYM];
let seed = 31; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const D = E.analyze(SYM + '-binance', JSON.parse(fs.readFileSync(`data/binance-${SYM.toLowerCase()}15.json`, 'utf8')), C.swingLen), B = D.B;
const S = E.setupsFor(D, C), cl = B.map((b) => b.close);
// ---- indicators ----
const rsi = I.rsi(cl, 14), e200 = I.ema(cl, 200), mac = I.macd(cl), adx = I.adx(B, 14), bb = I.bb(cl, 20, 2), obv = I.obv(B), atr = I.atr(B, 14);
const h1 = I.resample(B, 3600), h1c = h1.H.map((b) => b.close), h1e50 = I.ema(h1c, 50), h1e200 = I.ema(h1c, 200), h1m = I.macd(h1c);
const atrMed = new Array(B.length).fill(null); // 30-day (2880 bars) median of ATR, sampled every 4 bars for speed
{ const W = 2880; for (let i = W; i < B.length; i++) { if (i % 4 && atrMed[i - 1] != null) { atrMed[i] = atrMed[i - 1]; continue; } const a = atr.slice(i - W, i).filter((x) => x != null).sort((x, y) => x - y); atrMed[i] = a[a.length >> 1]; } }
// NY-day VWAP (anchored 00:00 ET)
const vwap = new Array(B.length).fill(null); { let day = null, pv = 0, v = 0; for (let i = 0; i < B.length; i++) { const d = PD.et(B[i].time).day; if (d !== day) { day = d; pv = 0; v = 0; } const tp = (B[i].high + B[i].low + B[i].close) / 3; pv += tp * B[i].volume; v += B[i].volume; vwap[i] = v ? pv / v : null; } }
const SH = D.A.swings.hi, SL = D.A.swings.lo;
function feats(s) {
  const c = s.chochIdx, dir = s.long ? 1 : -1, L = s.legXi, hi = h1.map[c];
  let mn = Infinity, mx = -Infinity; for (let j = L; j <= c; j++) if (rsi[j] != null) { mn = Math.min(mn, rsi[j]); mx = Math.max(mx, rsi[j]); }
  // divergence: previous confirmed swing (same side) before the leg extreme
  let div = false; const piv = (s.long ? SL : SH).filter((p) => p.idx < L - 2 && p.confirmIdx <= c).slice(-1)[0];
  if (piv && rsi[piv.idx] != null && rsi[L] != null) div = s.long ? B[L].low < piv.price && rsi[L] > rsi[piv.idx] : B[L].high > piv.price && rsi[L] < rsi[piv.idx];
  let legV = 0; for (let j = L; j <= c; j++) legV += B[j].volume; let pre = 0; for (let j = L - 96; j < L; j++) pre += B[j].volume;
  const b = bb[L];
  return {
    A1: rsi[c] != null && dir * (rsi[c] - 50) > 0, A2: s.long ? mn < 30 : mx > 70, A3: div,
    A4: e200[c] != null && dir * (cl[c] - e200[c]) > 0, A5: e200[c] != null && dir * (cl[c] - e200[c]) < 0,
    A6: hi >= 0 && h1e200[hi] != null && dir * (h1e50[hi] - h1e200[hi]) > 0, A7: mac.hist[c] != null && dir * mac.hist[c] > 0,
    A8: hi >= 0 && h1m.sig[hi] != null && dir * (h1m.line[hi] - h1m.sig[hi]) > 0, A9: adx[c] != null && adx[c] < 20, A10: adx[c] != null && adx[c] > 25,
    A11: b && (s.long ? B[L].low < b.lo : B[L].high > b.up), A12: vwap[c] != null && dir * (vwap[c] - s.entry) > 0,
    A13: (legV / (c - L + 1)) >= 1.3 * (pre / 96), A14: dir * (obv[c] - obv[L]) > 0, A15: atrMed[c] != null && atr[c] > atrMed[c],
  };
}
const F = S.map(feats);
const NAMES = { A1: 'RSI > 50 long / < 50 short', A2: 'RSI < 30 / > 70 in the leg', A3: 'RSI divergence at leg extreme', A4: 'With 15m EMA200', A5: 'Against 15m EMA200',
  A6: '1h EMA50/200 aligned', A7: '15m MACD hist in direction', A8: '1h MACD aligned', A9: 'ADX < 20 (ranging)', A10: 'ADX > 25 (trending)', A11: 'Leg beyond Bollinger band',
  A12: 'Entry at VWAP discount', A13: 'Leg rel. volume ≥ 1.3', A14: 'OBV with the CHoCH leg', A15: 'ATR above 30-day median' };
const run = (keep) => E.execute(D, C, S.filter((s, i) => keep(i))).filter((t) => t.t >= START && t.t < END).map((t) => ({ post: t.t >= SPLIT, R: t.R }));
const st = (a) => { const n = a.length, R = a.reduce((x, t) => x + t.R, 0); let c = 0, pk = 0, dd = 0; for (const t of a) { c += t.R; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); } return { n, R, avg: n ? R / n : NaN, dd, rd: dd ? R / dd : R > 0 ? 99 : 0 }; };
const f2 = (x) => (isNaN(x) ? '—' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(2));
const v7 = run(() => true), v = { pre: st(v7.filter((t) => !t.post)), post: st(v7.filter((t) => t.post)), all: st(v7) };
const L2 = [`# Round 3 Part A — indicator filters on v7, ${SYM} (Binance 15m, live-style, $1 risk)`, '',
  '| Rule | 2020–23 avg (n) | 2023–26 avg (n) | Kept | Total R | Max DD | Total ÷ DD | Random pct | **Pass** |', '|---|---|---|---|---|---|---|---|---|',
  `| v7 | ${f2(v.pre.avg)} (${v.pre.n}) | ${f2(v.post.avg)} (${v.post.n}) | 100% | ${v.all.R.toFixed(1)} | ${v.all.dd.toFixed(1)} | ${v.all.rd.toFixed(2)} | — | — |`];
const out = {};
for (const h of Object.keys(NAMES).filter((h) => !ONLY || ONLY.includes(h))) {
  const tr = run((i) => F[i][h]), a = { pre: st(tr.filter((t) => !t.post)), post: st(tr.filter((t) => t.post)), all: st(tr) };
  const rate = F.filter((f) => f[h]).length / F.length; let below = 0;
  for (let k = 0; k < 1000; k++) { const r = st(run(() => rnd() < rate)); if (r.avg < a.all.avg) below++; }
  const pct = below / 10, kept = a.all.n / v.all.n;
  const pass = a.pre.avg > v.pre.avg && a.post.avg > v.post.avg && pct >= 97.5 && kept >= 0.35 && a.all.rd >= v.all.rd;
  out[h] = { ...a, pct, kept, pass };
  L2.push(`| ${h} ${NAMES[h]} | ${f2(a.pre.avg)} (${a.pre.n}) | ${f2(a.post.avg)} (${a.post.n}) | ${(kept * 100).toFixed(0)}% | ${a.all.R.toFixed(1)} | ${a.all.dd.toFixed(1)} | ${a.all.rd.toFixed(2)} | ${pct.toFixed(1)} | ${pass ? '✅' : '❌'} |`);
  process.stderr.write(h + ' ');
}
fs.writeFileSync(`results/hyp3a-${SYM.toLowerCase()}.md`, L2.join('\n') + '\n'); fs.writeFileSync(`results/hyp3a-${SYM.toLowerCase()}.json`, JSON.stringify(out, null, 1));
console.log('\n' + L2.join('\n'));
