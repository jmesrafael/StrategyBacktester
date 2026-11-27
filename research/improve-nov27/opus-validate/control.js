// control.js - is the gain from choosing WHICH trades to shrink, or just from shrinking/reshaping risk?
//  1. Even cut at a matched worst fall: TRI-CORE with all risk x k, k set so its worst fall equals the rule's, same period.
//  2. Random cut: the rule's own size cuts dealt to random trades of the same bot (200 draws).
//  3. Rule cuts by count of OTHER-side open trades (a placebo crowding count with the same shape).
// node control.js > control.out
'use strict';
const fs = require('fs'), path = require('path');
const X = require('./causal');
const p = (v) => (100 * v).toFixed(1);
const out = {};
const P = { full: [X.T0, X.END], '2020-23': [X.T0, X.CUT], '2024-26': [X.CUT, X.END] };
const ACC = { flat: { mode: 'flat', start: 1000 }, 'live US$600 cap': { mode: 'live', start: 600, cap: 500 } };
const runS = (o, [a, b]) => X.stats(X.run({ ...o, from: a, to: b }));
function kMatch(acc, per, dd) { let lo = 0.3, hi = 2, k = 1; for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2, s = runS({ ...acc, K: m }, per); if (s.dd <= dd) { lo = m; k = m; } else hi = m; } return k; }
out.even = [];
for (const [an, acc] of Object.entries(ACC)) for (const [pn, per] of Object.entries(P)) for (const K of [1, 1.11]) {
  const r = runS({ ...acc, rule: X.RULE, K }, per), k = kMatch(acc, per, r.dd), e = runS({ ...acc, K: k }, per);
  out.even.push({ acc: an, per: pn, K, rule: r, evenK: k, even: e });
  console.log(`even cut | ${an.padEnd(16)} ${pn.padEnd(8)} rule x${K.toFixed(2)}: ${p(r.cagr)}%/yr fall ${p(r.dd)} | TRI x${k.toFixed(3)} at the same fall: ${p(e.cagr)}%/yr fall ${p(e.dd)} | rule ${r.cagr > e.cagr ? 'BETTER' : 'WORSE'} by ${p(r.cagr - e.cagr)} pts/yr`);
}
// 2. random cut (flat account)
const dec = []; X.run({ mode: 'flat', start: 1000, rule: X.RULE, sizeFn: (c) => { const m = X.RULE(c.N); dec.push([`${c.bot}|${c.coin}|${c.t}`, c.bot, m]); return m; } });
const score = (s) => Math.log(1 + s.cagr) / s.dd;
out.random = {};
for (const [pn, per] of Object.entries(P)) {
  const real = runS({ mode: 'flat', start: 1000, rule: X.RULE }, per), r = X.rng(4242); let ge = 0, geRet = 0, geDd = 0; const sc = [];
  for (let n = 0; n < 200; n++) {
    const map = new Map();
    for (const bot of ['bb', 'ic', 'tc']) { const L = dec.filter((d) => d[1] === bot), ms = L.map((d) => d[2]); for (let i = ms.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ms[i], ms[j]] = [ms[j], ms[i]]; } L.forEach((d, i) => map.set(d[0], ms[i])); }
    const s = runS({ mode: 'flat', start: 1000, sizeFn: (c) => map.get(`${c.bot}|${c.coin}|${c.t}`) ?? 1 }, per);
    sc.push(score(s)); if (score(s) >= score(real)) ge++; if (s.cagr >= real.cagr) geRet++; if (s.dd <= real.dd) geDd++;
  }
  sc.sort((a, b) => a - b);
  out.random[pn] = { real: real, realScore: score(real), share: ge / 200, shareRet: geRet / 200, shareDd: geDd / 200, medianScore: sc[100] };
  console.log(`random cut | ${pn.padEnd(8)} rule score ${score(real).toFixed(2)} (${p(real.cagr)}%/yr, fall ${p(real.dd)}) | random draws at least as good: ${p(ge / 200)}% (return ${p(geRet / 200)}%, fall ${p(geDd / 200)}%) | median random score ${sc[100].toFixed(2)}`);
}
// 3. placebo count: the same cut schedule driven by the bot's open trades on the OTHER side
for (const [pn, per] of Object.entries(P)) {
  const s = runS({ mode: 'flat', start: 1000, sizeFn: (c) => 1 }, per);
  out['placebo-' + pn] = s;
}
fs.writeFileSync(path.join(__dirname, 'control.json'), JSON.stringify(out, null, 1));
