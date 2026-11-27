// F2 signal-quality sizing (Nov 27, 2026). PRE-LISTED before running (16 settings; mult pairs keep average size ~1):
//  quiet = (max high - min low of the 42 4h bars BEFORE the signal bar) / ATR(signal bar) < k   (k = 8 or 12)
//  with = BTC 4h close (closed bar) vs its SMA200: long with btc>sma, short with btc<sma
//  1 Q8 all 1.3/0.8 | 2 Q12 all 1.3/0.8 | 3 Q8 bb only | 4 Q12 bb only | 5 Q8 ic+tc only | 6 Q12 ic+tc only
//  7 ADX>27 ic+tc 0.7 else 1.1 | 8 ADX>27 ic+tc 0.7 else 1.0 | 9 ADX>27 bb 0.6 else 1.1 (stacks on the live 0.5)
//  10 BTC with 1.2/0.8 all | 11 BTC with 1.2/0.8 bb only | 12 BTC with 1.2/0.8 ic+tc only | 13 BTC against 0.7 else 1.0 all
//  14 Q12 1.3/0.8 all x (ADX>27 ic+tc 0.7 else 1.1) | 15 Q12 1.3/0.8 all x BTC with 1.2/0.8 all
//  16 bb band distance |c-mid|/ATR < 1.5 -> 1.2 else 0.8 (bb only)
// Choice: test 3 only = highest test-3 growth among settings with test-3 fall below baseline (else lowest test-3 fall); then fitK on test 3.
'use strict';
const H = require('./h.js'), X = require('./causalF2'), fs = require('fs');
const quietK = (ctx) => { const s = ctx.slot, i = ctx.i; let h = -Infinity, l = Infinity; for (let j = i - 42; j < i; j++) { if (s.Hh[j] > h) h = s.Hh[j]; if (s.L[j] < l) l = s.L[j]; } return (h - l) / s.atr[i]; };
const adx = (ctx) => ctx.slot.adx[ctx.i];
const withBtc = (ctx) => { const n = ctx.btcC.length; if (n < 200) return null; const sma = (ctx.btcP[n] - ctx.btcP[n - 200]) / 200; return (ctx.btcC[n - 1] > sma ? 1 : -1) === ctx.dir; };
const bandD = (ctx) => { const s = ctx.slot, i = ctx.i, b = s.band(i, s.S.bbLen, s.S.bbMult); return Math.abs(s.Cc[i] - b.mid) / s.atr[i]; };
const BB = (c) => c.bot === 'bb', IT = (c) => c.bot !== 'bb', ALL = () => true;
const Q = (k, f) => (c) => (f(c) ? (quietK(c) < k ? 1.3 : 0.8) : 1);
const A = (f, hi, lo) => (c) => (f(c) ? (adx(c) > 27 ? hi : lo) : 1);
const B = (f, up, dn) => (c) => { if (!f(c)) return 1; const w = withBtc(c); return w === null ? 1 : w ? up : dn; };
const S = [
  ['1 Q8 all', Q(8, ALL)], ['2 Q12 all', Q(12, ALL)], ['3 Q8 bb', Q(8, BB)], ['4 Q12 bb', Q(12, BB)], ['5 Q8 ic+tc', Q(8, IT)], ['6 Q12 ic+tc', Q(12, IT)],
  ['7 ADX>27 it .7/1.1', A(IT, 0.7, 1.1)], ['8 ADX>27 it .7/1.0', A(IT, 0.7, 1.0)], ['9 ADX>27 bb .6/1.1', A(BB, 0.6, 1.1)],
  ['10 BTC with all', B(ALL, 1.2, 0.8)], ['11 BTC with bb', B(BB, 1.2, 0.8)], ['12 BTC with it', B(IT, 1.2, 0.8)], ['13 BTC against .7', B(ALL, 1.0, 0.7)],
  ['14 Q12 x ADX it', (c) => Q(12, ALL)(c) * A(IT, 0.7, 1.1)(c)], ['15 Q12 x BTC all', (c) => Q(12, ALL)(c) * B(ALL, 1.2, 0.8)(c)],
  ['16 bb band dist<1.5', (c) => (BB(c) ? (bandD(c) < 1.5 ? 1.2 : 0.8) : 1)],
];
const out = [], R = [], bs = H.base();
const log = (l) => out.push(l);
for (const [name, f] of S) { const r = H.evaluate({ engine: X, sizeFn: () => f, label: name }, name); R.push(r); log(r.line); }
let cand = R.filter((r) => r.res[2].dd < bs[2].dd); cand = cand.length ? cand.sort((a, b) => b.res[2].cagr - a.res[2].cagr) : R.slice().sort((a, b) => a.res[2].dd - b.res[2].dd);
const best = cand[0], f = S.find((s) => s[0] === best.label)[1];
log(`CHOSEN by test 3: ${best.label}`);
const K = H.fitK({ engine: X, sizeFn: () => f });
const fin = H.evaluate({ engine: X, sizeFn: () => f, K }, `${best.label} fitK=${K.toFixed(3)}`); log(fin.line);
const six = R.filter((r) => r.n === 6).map((r) => r.label);
log(`6/6 raw settings: ${six.join(', ') || 'none'}; chosen+fitK: ${fin.n}/6`);
fs.writeFileSync(__dirname + '/f2-results.md', '# F2 signal-quality sizing results\nTest order: 1 live full, 2 live fresh 2024, 3 flat 2020-23, 4 flat 2024-26, 5 double costs, 6 late fills. Cell = Y/. growth%/fall%.\nBaseline: ' + bs.map((b) => `${H.p(b.cagr)}/${H.p(b.dd)}`).join('  ') + '\n\n```\n' + out.join('\n') + '\n```\n');
