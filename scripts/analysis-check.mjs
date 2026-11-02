// analysis-check.mjs — js/analysis-core.js against the admin reports, on the bots' own data files (no download).
//   node scripts/analysis-check.mjs
// Expected (ledger/reports/icore-10k-report.html and bbcore-no-target-three-way.html, data to late Oct 2026):
//   I-Core 760 trades, +658R; fresh ₱10,000 2021 = 101 trades +₱109,790; compounding end ₱27,543,569.  BB-Core no target 1331 trades, +601R.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const app = join(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.ICore = require(join(app, '..', '🔴I-Core', 'icore-core.js'));
globalThis.BBCore = require(join(app, '..', '🔴BB-Core', 'lucidio-core.js'));
const A = require(join(app, 'js', 'analysis-core.js'));
const load = (f) => JSON.parse(readFileSync(f)).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const ic = [], nt = [];
for (const c of A.COINS) {
  ic.push(...A.coinTrades('icore', c, load(join(app, '..', '🔴I-Core', 'data', c + '.json')), null, {}, 14400).trades);
  const ff = join(app, '..', '🔴BB-Core', 'data', 'funding', c + '.json');
  nt.push(...A.coinTrades('bbnt', c, load(join(app, '..', '🔴BB-Core', 'data', c + '.json')), existsSync(ff) ? JSON.parse(readFileSync(ff)) : null, {}, 14400).trades);
}
const m = { start: 10000, risk: 0.025, cap: 0 };
const fr = A.analyse(ic, { ...m, mode: 'fresh' }), co = A.analyse(ic, { ...m, mode: 'compound' });
const s = fr.stats, y21 = fr.years.find((y) => y.y === 2021);
console.log(`I-Core   ${s.n} trades, ${s.net.toFixed(1)}R, win ${(s.win * 100).toFixed(1)}%   (report 760, +658R, 32.0%)`);
console.log(`  fresh 2021: ${y21.n} trades, +₱${Math.round(y21.profit).toLocaleString()} (report 101, +₱109,790); compounding end ₱${Math.round(co.curve.pts.at(-1)[1]).toLocaleString()} (report ₱27,543,569)`);
console.log('  per year fresh:', fr.years.map((y) => `${y.y} ${y.n} ${y.R.toFixed(1)}R ₱${Math.round(y.profit)} dd${Math.round(y.dd * 100)}% low${Math.round(y.low)}`).join(' | '));
const n = A.stats(nt);
console.log(`BB-Core NT ${n.n} trades, ${n.net.toFixed(1)}R, win ${(n.win * 100).toFixed(1)}%   (report 1331, +601R, 36.5%)`);
