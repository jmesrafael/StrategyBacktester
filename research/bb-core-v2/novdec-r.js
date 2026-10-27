'use strict';
const { runMerged } = require('./merged.js'); const { DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const V = process.argv[2] || 'mexc', f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1);
for (let y = 2020; y <= 2025; y++) { const r = {}; for (const m of ['bb', 'ema', 'two']) { r[m] = [0, 0, 0]; for (const c of COINS) { const D = loadCoin(c, V); for (const t of runMerged(D.B, m, DEFAULTS.cost, D.funding).trades) { const d = new Date(t.tExit * 1000); if (d.getUTCFullYear() === y && d.getUTCMonth() >= 10) { r[m][d.getUTCMonth() - 10] += t.R; r[m][2]++; } } } }
  console.log(`${y}: merged Nov ${f1(r.two[0])} Dec ${f1(r.two[1])} total ${f1(r.two[0] + r.two[1])} (${r.two[2]} trades) | bb-core ${f1(r.bb[0] + r.bb[1])} | EMA ${f1(r.ema[0] + r.ema[1])}`); }
