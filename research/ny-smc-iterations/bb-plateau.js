// bb-plateau.js — robustness of A11 (CHoCH leg extreme beyond a Bollinger band) across band settings, SOL + ETH, live-style.
// Not used to pick settings: A11 stays at (20, 2). Checks that neighbours behave the same way.
// usage: node bb-plateau.js → results/bb-plateau.md
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js'), I = require('./ind.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000, SPLIT = D0('2023-10-18'), END = D0('2026-10-18');
const START = { SOL: D0('2020-10-18'), ETH: D0('2019-12-15') };
const st = (a) => { const n = a.length, R = a.reduce((x, t) => x + t.R, 0); let c = 0, pk = 0, dd = 0; for (const t of a) { c += t.R; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); } return { n, R, avg: n ? R / n : NaN, dd }; };
const f2 = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(2);
const L = ['# A11 plateau — CHoCH leg beyond Bollinger band, by band setting (live-style, $1 risk)', '', '| Coin | Band (len, σ) | 2020–23 avg | 2023–26 avg | Trades | Total R | Max DD | Total ÷ DD |', '|---|---|---|---|---|---|---|---|'];
for (const sym of ['SOL', 'ETH']) {
  const D = E.analyze(sym + '-binance', JSON.parse(fs.readFileSync(`data/binance-${sym.toLowerCase()}15.json`, 'utf8')), C.swingLen), B = D.B, S = E.setupsFor(D, C), cl = B.map((b) => b.close);
  const run = (keep) => E.execute(D, C, S.filter(keep)).filter((t) => t.t >= START[sym] && t.t < END);
  const row = (lab, tr) => { const a = st(tr.filter((t) => t.t < SPLIT)), b = st(tr.filter((t) => t.t >= SPLIT)), c = st(tr); L.push(`| ${sym} | ${lab} | ${f2(a.avg)} (${a.n}) | ${f2(b.avg)} (${b.n}) | ${c.n} | ${c.R.toFixed(1)} | ${c.dd.toFixed(1)} | ${(c.R / c.dd).toFixed(2)} |`); };
  row('v7 (no filter)', run(() => true));
  for (const n of [14, 20, 30]) for (const k of [1.5, 2, 2.5]) {
    const bb = I.bb(cl, n, k);
    row(`${n}, ${k}${n === 20 && k === 2 ? ' ◀ rule' : ''}`, run((s) => { const b = bb[s.legXi]; return b && (s.long ? B[s.legXi].low < b.lo : B[s.legXi].high > b.up); }));
  }
}
fs.writeFileSync('results/bb-plateau.md', L.join('\n') + '\n'); console.log(L.join('\n'));
