// search6.js — round 3: new families (BB breakout, EMA cross, MACD, RSI pull-back) + fixed profit targets.
// PICK on 2020-22 (5 coins), FREEZE, then score on the unseen 2023-26 against bb-core on SIX measures:
//   total R, max drawdown (R), win rate, years positive, coin-years that lost money, end equity of a 2.5%-risk compounding account started 2023.
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const bb = require('../bb-core-v2/v2-core.js');
const { loadCoin } = require('../bb-core-v2/load.js');
const C = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], TY = [2023, 2024, 2025, 2026], ALLY = [2020, 2021, 2022, 2023, 2024, 2025, 2026], RP = 0.025, START = 1000;
const g = {}; const get = (c) => g[c] || (g[c] = (() => { const B = E.load(c); return { B, X: E.base(B) }; })());
const sum = (T) => T.reduce((a, t) => a + t.R, 0), yr = (t) => new Date(t.tExit * 1000).getUTCFullYear(), f0 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0);
function acct(T) { const tr = [...T].sort((a, b) => a.t - b.t), done = []; for (const x of tr) { const eq = START + done.filter((d) => d.tExit <= x.t).reduce((a, d) => a + d.pnl, 0); done.push({ tExit: x.tExit, pnl: x.R * RP * eq }); }
  done.sort((a, b) => a.tExit - b.tExit); let eq = START, pk = START, dd = 0; for (const d of done) { eq += d.pnl; pk = Math.max(pk, eq); dd = Math.max(dd, (pk - eq) / pk); } return { eq, dd }; }
function metrics(T, years) {
  const y = E.yearly(T), a = acct(T);
  const loss = C.reduce((n, c) => { const yy = E.yearly(T.filter((t) => t.coin === c)); return n + years.filter((v) => (yy[v] || 0) < -0.5).length; }, 0);
  return { R: sum(T), dd: E.maxDD(T), win: T.filter((t) => t.R > 0).length / T.length, yp: years.filter((v) => (y[v] || 0) > 0).length, loss, eq: a.eq, ddp: a.dd, n: T.length };
}
const bbAll = C.flatMap((c) => { const d = loadCoin(c); return bb.backtest(d.B, {}, d.funding).trades.map((t) => ({ ...t, coin: c })); });
const bbTest = bbAll.filter((t) => yr(t) >= 2023), BT = metrics(bbTest, TY);

const FAM = [['ichimoku', { full: false }], ['keltner', { n: 10, m: 1.5 }], ['keltner', { n: 20, m: 2 }], ['donchian', { n: 20 }], ['donchian', { n: 55 }], ['supertrend', { n: 10, m: 3 }], ['vortex', { n: 14, min: 1.0 }],
  ['bbbreak', { n: 20, m: 2 }], ['emacross', { f: 20, sl: 50 }], ['emacross', { f: 10, sl: 30 }], ['macd', {}], ['rsipull', { lo: 40 }], ['rsipull', { lo: 45 }], ['rsipull', { lo: 35 }]];
const rows = [];
for (const [fam, p] of FAM) for (const kInit of [1.5, 2, 3]) for (const kTrail of [5, 7, 9, 99]) for (const targetR of [0, 2, 3, 4, 6]) for (const trend of [false, true]) {
  if (kTrail === 99 && !targetR) continue;                                    // no trail and no target = never exits except by stop; skip
  const ex = { kInit, kTrail, targetR, trend, exitOpp: false, maxBars: 300 }, T = C.flatMap((c) => E.run(get(c).B, get(c).X, fam, p, { coin: c, ...ex }));
  const tr = T.filter((t) => yr(t) <= 2022), y = E.yearly(tr);
  if (![2020, 2021, 2022].every((v) => (y[v] || 0) > 0)) continue;
  if (C.filter((c) => sum(tr.filter((t) => t.coin === c)) > 0).length < 4) continue;
  rows.push({ fam, p, ex, T, train: sum(tr), trainDD: E.maxDD(tr) });
}
rows.forEach((r) => (r.score = r.train / Math.max(10, r.trainDD))); rows.sort((a, b) => b.score - a.score);

let out = `# Round 3 — new families + profit targets (picked on 2020-22, judged on 2023-26 only)\n\nbb-core 2023-26 on the 5 coins: ${f0(BT.R)}R | DD ${BT.dd.toFixed(0)}R | win ${(BT.win * 100).toFixed(0)}% | years+ ${BT.yp}/4 | coin-years lost ${BT.loss} | $1,000 at 2.5% -> $${Math.round(BT.eq).toLocaleString()} (DD ${(BT.ddp * 100).toFixed(0)}%)\n\nPassed the train filter (green every train year, >=4/5 coins profitable): ${rows.length} configs. Top 25 by train R/DD:\n\n`;
out += '| strategy | stop/trail/target/trend | train R | TEST R | TEST DD | win% | yrs+ | coin-yrs lost | test $ | test DD% | beats on (of 6) |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
let full = 0;
for (const r of rows.slice(0, 25)) {
  const M = metrics(r.T.filter((t) => yr(t) >= 2023), TY);
  const b = [M.R > BT.R, M.dd < BT.dd, M.win > BT.win, M.yp === 4, M.loss <= BT.loss, M.eq > BT.eq], k = b.filter(Boolean).length; if (k === 6) full++;
  out += `| ${r.fam} ${JSON.stringify(r.p).replace(/"/g, '')} | ${r.ex.kInit}/${r.ex.kTrail === 99 ? 'none' : r.ex.kTrail}/${r.ex.targetR || 'none'}/${r.ex.trend ? 'T' : 'F'} | ${f0(r.train)} | ${f0(M.R)} | ${M.dd.toFixed(0)} | ${(M.win * 100).toFixed(0)}% | ${M.yp}/4 | ${M.loss} | ${Math.round(M.eq).toLocaleString()} | ${(M.ddp * 100).toFixed(0)}% | **${k}/6** ${b.map((x) => (x ? '✓' : '·')).join('')} |\n`;
}
out += `\nBeat bb-core on all 6 in the unseen window: ${full}\n(✓ order: total R, drawdown, win rate, all test years positive, coin-years lost, end equity)\n`;
fs.writeFileSync(path.join(__dirname, 'RESULTS-search6.md'), out); console.log(out);

// ---- screen of ALL train-passing configs (not a fair pick: just "does anything exist?") ----
const cnt = [0, 0, 0, 0, 0, 0, 0], best = [];
for (const r of rows) { const M = metrics(r.T.filter((t) => yr(t) >= 2023), TY), b = [M.R > BT.R, M.dd < BT.dd, M.win > BT.win, M.yp === 4, M.loss <= BT.loss, M.eq > BT.eq], k = b.filter(Boolean).length; cnt[k]++; if (k >= 5 || (k === 4 && b[0] && b[1])) best.push({ r, M, b, k }); }
console.log('\nSCREEN of all', rows.length, 'configs: number beating bb-core on k of 6 (k=0..6):', cnt.join(' '));
best.sort((a, b) => b.k - a.k || b.M.R - a.M.R);
for (const x of best.slice(0, 8)) console.log(x.k + '/6', x.r.fam, JSON.stringify(x.r.p), `${x.r.ex.kInit}/${x.r.ex.kTrail}/${x.r.ex.targetR}/${x.r.ex.trend}`, 'R', f0(x.M.R), 'DD', x.M.dd.toFixed(0), 'win', (x.M.win * 100).toFixed(0), 'yrs', x.M.yp, 'lost', x.M.loss, '$', Math.round(x.M.eq), x.b.map((v) => (v ? '✓' : '·')).join(''));
