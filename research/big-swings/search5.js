// search5.js — tune on the bb-core 5 coins (SOL ZEC NEAR ADA GALA), PICK on 2020-2022 only, freeze, judge on 2023-2026 and on BTC/ETH (unseen this time).
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const bb = require('../bb-core-v2/v2-core.js');
const { loadCoin } = require('../bb-core-v2/load.js');
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], UNSEEN = ['BTC', 'ETH'], YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), sum = (T) => T.reduce((a, t) => a + t.R, 0);
const yr = (t) => new Date(t.tExit * 1000).getUTCFullYear();
const cache = {}; const get = (c) => cache[c] || (cache[c] = (() => { const B = E.load(c); return { B, X: E.base(B) }; })());
const runC = (cs, fam, p, ex) => cs.flatMap((c) => E.run(get(c).B, get(c).X, fam, p, { coin: c, ...ex }));
const bbT = COINS.flatMap((c) => { const d = loadCoin(c); return bb.backtest(d.B, {}, d.funding).trades; });
const bbTrain = sum(bbT.filter((t) => yr(t) <= 2022)), bbTest = sum(bbT.filter((t) => yr(t) >= 2023)), bbTot = sum(bbT);

const FAM = [];
for (const n of [10, 20, 30, 55, 100]) FAM.push(['donchian', { n }]);
FAM.push(['ichimoku', { full: false }], ['ichimoku', { full: true }]);
FAM.push(['darvas', { conf: 3, look: 50 }], ['darvas', { conf: 3, look: 20 }], ['darvas', { conf: 5, look: 100 }]);
for (const [n, min] of [[14, 1.0], [14, 1.1], [21, 1.0]]) FAM.push(['vortex', { n, min }]);
for (const [n, m] of [[10, 2], [10, 3], [20, 4]]) FAM.push(['supertrend', { n, m }]);
for (const [n, m] of [[10, 1.5], [20, 1.5], [20, 2], [20, 2.5], [50, 3], [30, 2]]) FAM.push(['keltner', { n, m }]);
for (const [n, min] of [[14, 20], [14, 25], [14, 30]]) FAM.push(['adx', { n, min }]);

const rows = [];
for (const [fam, p] of FAM) for (const kInit of [1.5, 2, 3, 4]) for (const kTrail of [3, 4, 5, 7]) for (const trend of [false, true]) for (const exitOpp of [true, false]) {
  const ex = { kInit, kTrail, trend, exitOpp }, T = runC(COINS, fam, p, ex), tr = T.filter((t) => yr(t) <= 2022), y = E.yearly(tr);
  if (![2020, 2021, 2022].every((v) => (y[v] || 0) > 0)) continue;                                   // pooled green in every TRAIN year
  const coinsPos = COINS.filter((c) => sum(tr.filter((t) => t.coin === c)) > 0).length;
  if (coinsPos < 4) continue;                                                                          // and >= 4 of 5 coins profitable in train
  // rank by train R discounted by train drawdown (don't just reward big swings)
  rows.push({ fam, p, ex, T, train: sum(tr), trainDD: E.maxDD(tr), coinsPos });
}
rows.forEach((r) => (r.score = r.train / Math.max(10, r.trainDD)));
rows.sort((a, b) => b.score - a.score);
let out = `# Tuned on the 5 coins (picked on 2020-22 only, frozen)\n\nbb-core, same 5 coins: total ${f1(bbTot)}R | 2020-22 ${f1(bbTrain)}R | 2023-26 ${f1(bbTest)}R | DD ${E.maxDD(bbT).toFixed(0)}R\n\nConfigs that were green in all 3 train years with >=4/5 coins profitable: ${rows.length}. Ranked by train R / train DD; top 20 judged on the unseen 2023-26 and on BTC+ETH:\n\n`;
out += '| strategy | stop/trail/trend/exitOpp | train R | train DD | TEST R (23-26) | TEST DD | total R | yrs+ | coins+ (total) | BTC+ETH R | beats bb-core? |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
let wins = 0;
for (const r of rows.slice(0, 20)) {
  const te = r.T.filter((t) => yr(t) >= 2023), tot = sum(r.T), y = E.yearly(r.T), pos = YEARS.filter((v) => (y[v] || 0) > 0).length;
  const cp = COINS.filter((c) => sum(r.T.filter((t) => t.coin === c)) > 0).length, un = sum(runC(UNSEEN, r.fam, r.p, r.ex));
  const win = sum(te) > bbTest && E.maxDD(te) <= E.maxDD(bbT.filter((t) => yr(t) >= 2023)) * 1.5 && pos === 7; if (win) wins++;
  out += `| ${r.fam} ${JSON.stringify(r.p).replace(/"/g, '')} | ${r.ex.kInit}/${r.ex.kTrail}/${r.ex.trend ? 'T' : 'F'}/${r.ex.exitOpp ? 'T' : 'F'} | ${f1(r.train)} | ${r.trainDD.toFixed(0)} | ${f1(sum(te))} | ${E.maxDD(te).toFixed(0)} | ${f1(tot)} | ${pos}/7 | ${cp}/5 | ${f1(un)} | ${win ? '**YES**' : 'no'} |\n`;
}
out += `\nbb-core 2023-26 DD on these coins: ${E.maxDD(bbT.filter((t) => yr(t) >= 2023)).toFixed(0)}R. "beats" = test R > bb-core test R, test DD <= 1.5x bb-core's, 7/7 years.\nWinners: ${wins}\n`;
fs.writeFileSync(path.join(__dirname, 'RESULTS-search5.md'), out); console.log(out);
fs.writeFileSync(path.join(__dirname, 'picks5.json'), JSON.stringify(rows.slice(0, 20).map((r) => ({ fam: r.fam, p: r.p, ex: r.ex }))));
