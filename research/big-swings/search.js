// search.js — wide search with a built-in honesty rule:
//   PICK on 2020-2022 only (must be positive in each of those 3 years), then FREEZE and judge on 2023-2026 + 10 unseen coins.
//   Success = beats bb-core's total R on BTC+ETH+SOL, 7/7 years, and also beats bb-core on the 2023-26 half it never saw.
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const bb = require('../bb-core-v2/v2-core.js');
const COINS = ['BTC', 'ETH', 'SOL'], YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const OTHER = ['BNB', 'XRP', 'DOGE', 'LINK', 'LTC', 'AVAX', 'ADA', 'NEAR', 'ZEC', 'GALA'];
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), sum = (T) => T.reduce((a, t) => a + t.R, 0);
const yr = (t) => new Date(t.tExit * 1000).getUTCFullYear();
const cache = {}; const get = (c) => cache[c] || (cache[c] = (() => { const B = E.load(c); return { B, X: E.base(B) }; })());
const runC = (cs, fam, p, ex) => cs.flatMap((c) => E.run(get(c).B, get(c).X, fam, p, { coin: c, ...ex }));

const bbT = COINS.flatMap((c) => bb.backtest(get(c).B, {}, null).trades);
const bbTrain = sum(bbT.filter((t) => yr(t) <= 2022)), bbTest = sum(bbT.filter((t) => yr(t) >= 2023));

const FAM = [];
for (const n of [10, 20, 30, 55, 100]) FAM.push(['donchian', { n }]);
FAM.push(['ichimoku', { full: false }], ['ichimoku', { full: true }]);
FAM.push(['darvas', { conf: 3, look: 50 }], ['darvas', { conf: 3, look: 20 }], ['darvas', { conf: 5, look: 100 }]);
for (const [n, min] of [[14, 1.0], [14, 1.1], [21, 1.0]]) FAM.push(['vortex', { n, min }]);
for (const [n, m] of [[10, 2], [10, 3], [20, 4]]) FAM.push(['supertrend', { n, m }]);
for (const [n, m] of [[10, 1.5], [20, 1.5], [20, 2], [20, 2.5], [50, 3], [30, 2]]) FAM.push(['keltner', { n, m }]);
for (const [n, min] of [[14, 20], [14, 25], [14, 30]]) FAM.push(['adx', { n, min }]);

const rows = [];
for (const [fam, p] of FAM) for (const kInit of [1.5, 2, 3, 5]) for (const kTrail of [2.5, 3, 4, 5, 7]) for (const trend of [false, true]) for (const exitOpp of [true, false]) {
  const ex = { kInit, kTrail, trend, exitOpp }, T = runC(COINS, fam, p, ex);
  const tr = T.filter((t) => yr(t) <= 2022), y = E.yearly(tr);
  if (![2020, 2021, 2022].every((v) => (y[v] || 0) > 0)) continue;     // must be green in every TRAIN year
  rows.push({ fam, p, ex, train: sum(tr), T });
}
rows.sort((a, b) => b.train - a.train);
const top = rows.slice(0, 25);
let out = `# Search for a bb-core beater (picked on 2020-22 only, then frozen)\n\nbb-core on BTC+ETH+SOL: total ${f1(sum(bbT))}R | 2020-22 ${f1(bbTrain)}R | 2023-26 ${f1(bbTest)}R | DD ${E.maxDD(bbT).toFixed(0)}R\n\nConfigs green in all 3 train years: ${rows.length}. Top 25 by train R, then judged unseen:\n\n`;
out += '| strategy | kInit/kTrail/trend/exitOpp | train R (20-22) | TEST R (23-26) | total R | DD | yrs+ | beats bb-core test? | unseen coins +/10 (R) |\n|---|---|---|---|---|---|---|---|---|\n';
let winners = 0;
for (const r of top) {
  const test = sum(r.T.filter((t) => yr(t) >= 2023)), tot = sum(r.T), y = E.yearly(r.T), pos = YEARS.filter((v) => (y[v] || 0) > 0).length;
  const un = OTHER.map((c) => sum(runC([c], r.fam, r.p, r.ex))), up = un.filter((v) => v > 0).length;
  const win = test > bbTest && tot > sum(bbT) && pos === 7; if (win) winners++;
  out += `| ${r.fam} ${JSON.stringify(r.p).replace(/"/g, '')} | ${r.ex.kInit}/${r.ex.kTrail}/${r.ex.trend ? 'T' : 'F'}/${r.ex.exitOpp ? 'T' : 'F'} | ${f1(r.train)} | ${f1(test)} | ${f1(tot)} | ${E.maxDD(r.T).toFixed(0)} | ${pos}/7 | ${win ? '**YES**' : 'no'} | ${up}/10 (${f1(un.reduce((a, b) => a + b, 0))}) |\n`;
}
out += `\nWinners (test > bb-core test, total > bb-core, 7/7): ${winners}\n`;
fs.writeFileSync(path.join(__dirname, 'RESULTS-search.md'), out); console.log(out);
