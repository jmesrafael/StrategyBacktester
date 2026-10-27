// allred.js — months where EVERY coin lost (by exit month), for bb-core / EMA / merged.  node allred.js [binance|mexc]
'use strict';
const { runMerged } = require('./merged.js'); const { DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const V = process.argv[2] || 'binance', f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1);
const key = (s) => new Date(s * 1000).toISOString().slice(0, 7), M = {};
for (const m of ['bb', 'ema', 'two']) { M[m] = {}; for (const c of COINS) { const D = loadCoin(c, V); for (const t of runMerged(D.B, m, DEFAULTS.cost, D.funding).trades) { const k = key(t.tExit); ((M[m][k] ||= {})[c] ||= { R: 0, n: 0 }); M[m][k][c].R += t.R; M[m][k][c].n++; } } }
const months = [...new Set(Object.values(M).flatMap((o) => Object.keys(o)))].sort();
for (const [m, label] of [['bb', 'bb-core'], ['two', 'Merged (bb-core + EMA 20/100)'], ['ema', 'EMA 20/100']]) {
  const rows = months.map((k) => { const c = M[m][k] || {}, act = COINS.filter((x) => c[x] && c[x].n); return { k, act, tot: act.reduce((a, x) => a + c[x].R, 0), neg: act.filter((x) => c[x].R < 0).length, c }; }).filter((r) => r.act.length >= 4);
  const all = rows.filter((r) => r.neg === r.act.length), most = rows.filter((r) => r.neg >= r.act.length - 1 && r.neg < r.act.length);
  console.log(`\n## ${label} — ${V.toUpperCase()} — ${rows.length} months with ≥4 coins trading\n`);
  console.log(`Months where EVERY coin that traded lost: **${all.length}** (${(100 * all.length / rows.length).toFixed(0)}%) · all but one lost: ${most.length} · month total negative: ${rows.filter((r) => r.tot < 0).length}\n`);
  if (all.length) { console.log('| month | coins | total R | ' + COINS.join(' | ') + ' |'); console.log('|---|---|---|' + COINS.map(() => '---').join('|') + '|'); for (const r of all) console.log(`| ${r.k} | ${r.act.length} | **${f1(r.tot)}** | ${COINS.map((x) => (r.c[x] && r.c[x].n ? f1(r.c[x].R) : '–')).join(' | ')} |`); }
}
