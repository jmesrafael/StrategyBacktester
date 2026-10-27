'use strict';
const { runMerged } = require('./merged.js'); const { DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1), mo = (s) => new Date(s * 1000).getUTCMonth(), yr = (s) => new Date(s * 1000).getUTCFullYear();
for (const M of [8, 9]) { console.log(`\n### ${['Sep', 'Oct'][M - 8]} 2026 (R, MEXC) — trades closed that month\n\n| coin | bb-core R (n) | EMA R (n) | merged R (n) | biggest win | biggest loss |\n|---|---|---|---|---|---|`);
  let tot = [0, 0, 0], cnt = [0, 0, 0];
  for (const c of COINS) { const D = loadCoin(c, 'mexc'), r = ['bb', 'ema', 'two'].map((m) => runMerged(D.B, m, DEFAULTS.cost, D.funding).trades.filter((t) => yr(t.tExit) === 2026 && mo(t.tExit) === M));
    r.forEach((t, i) => { tot[i] += t.reduce((a, x) => a + x.R, 0); cnt[i] += t.length; });
    const s = (t) => `${f1(t.reduce((a, x) => a + x.R, 0))} (${t.length})`, rs = r[2].map((x) => x.R);
    console.log(`| ${c} | ${s(r[0])} | ${s(r[1])} | ${s(r[2])} | ${f1(Math.max(...rs))} | ${f1(Math.min(...rs))} |`); }
  console.log(`| **All 5** | **${f1(tot[0])} (${cnt[0]})** | **${f1(tot[1])} (${cnt[1]})** | **${f1(tot[2])} (${cnt[2]})** | | |`); }
