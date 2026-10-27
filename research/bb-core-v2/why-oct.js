// why-oct.js — why is Oct 2026 red for bb-core? Compare the month's trades with the usual ones. Research only.
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const btcRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bb-core', 'data-other-coins', 'BTC.json'), 'utf8')), BTC = {};
{ let sum = 0; for (let i = 0; i < btcRaw.length; i++) { sum += btcRaw[i][4]; if (i >= 200) sum -= btcRaw[i - 200][4]; if (i >= 199) BTC[btcRaw[i][0]] = (btcRaw[i][4] - sum / 200) / (sum / 200); } }
const f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1), mk = (s) => new Date(s * 1000).toISOString().slice(0, 7), avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const all = []; for (const c of COINS) { const D = loadCoin(c); all.push(...backtest(D.B, { cost: DEFAULTS.cost, btc: BTC }, D.funding).trades.map((t) => ({ ...t, coin: c }))); }
// 1. monthly pooled R, ranking
const M = {}; for (const t of all) M[mk(t.tExit)] = (M[mk(t.tExit)] || 0) + t.R;
const ms = Object.entries(M).filter(([k]) => k >= '2020-06').sort((a, b) => a[1] - b[1]);
console.log('## 1. Is −16.6R unusual? bb-core pooled monthly R, worst 8 of ' + ms.length + ' months\n'); ms.slice(0, 8).forEach(([k, v], i) => console.log(`${i + 1}. ${k}  ${f1(v)}R`));
const vals = ms.map((x) => x[1]), mean = avg(vals), sd = Math.sqrt(avg(vals.map((v) => (v - mean) ** 2)));
console.log(`\nAverage month ${f1(mean)}R, std ${sd.toFixed(1)}R → Oct 2026 is ${((M['2026-10'] - mean) / sd).toFixed(1)} std below average. Months negative: ${vals.filter((v) => v < 0).length}/${vals.length}.`);
// 2. what the October trades looked like
const oct = all.filter((t) => mk(t.tExit) === '2026-10'), rest = all.filter((t) => mk(t.tExit) < '2026-10');
const why = (t) => { const o = {}; for (const x of t) o[x.why] = (o[x.why] || 0) + 1; return Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', '); };
console.log(`\n## 2. October 2026 trades (${oct.length}) vs all earlier trades (${rest.length})\n`);
console.log(`| | Oct 2026 | earlier |\n|---|---|---|\n| win rate | ${(100 * oct.filter((t) => t.R > 0).length / oct.length).toFixed(0)}% | ${(100 * rest.filter((t) => t.R > 0).length / rest.length).toFixed(0)}% |\n| avg R | ${f1(avg(oct.map((t) => t.R)))} | ${f1(avg(rest.map((t) => t.R)))} |\n| long / short | ${oct.filter((t) => t.dir === 1).length} / ${oct.filter((t) => t.dir === -1).length} | ${rest.filter((t) => t.dir === 1).length} / ${rest.filter((t) => t.dir === -1).length} |\n| exits | ${why(oct)} | ${why(rest)} |\n| avg candles held | ${avg(oct.map((t) => t.bars)).toFixed(0)} | ${avg(rest.map((t) => t.bars)).toFixed(0)} |`);
for (const [k, l] of [['adx', 'ADX (trend strength)'], ['er', 'efficiency ratio (how straight the last 20 candles ran)'], ['ext', 'distance from 200 SMA'], ['bw', 'band width'], ['atrPct', 'volatility (ATR % of price)'], ['breakAtr', 'breakout size (ATR)'], ['btc', 'BTC stretch same direction']]) {
  const a = oct.map((t) => t.feat && t.feat[k]).filter(Number.isFinite), b = rest.map((t) => t.feat && t.feat[k]).filter(Number.isFinite);
  console.log(`| ${l} | ${avg(a).toFixed(3)} | ${avg(b).toFixed(3)} |`); }
// 3. the trades, with same-day clustering
console.log('\n## 3. Every October trade\n\n| entry | coin | dir | exit | R | candles |\n|---|---|---|---|---|---|');
for (const t of oct.sort((a, b) => a.t - b.t)) console.log(`| ${new Date(t.t * 1000).toISOString().slice(5, 16).replace('T', ' ')} | ${t.coin} | ${t.dir === 1 ? 'long' : 'short'} | ${t.why} | ${f1(t.R)} | ${t.bars} |`);
// 4. do coins lose together? pairs of same-day entries
const d = {}; for (const t of oct) { const k = new Date(t.t * 1000).toISOString().slice(0, 10) + (t.dir === 1 ? 'L' : 'S'); (d[k] ||= []).push(t); }
console.log('\n## 4. Same day, same direction (coins moving together)\n'); for (const [k, v] of Object.entries(d).filter(([, v]) => v.length >= 2)) console.log(`${k}: ${v.map((t) => t.coin + ' ' + f1(t.R)).join(', ')}`);
// 5. 2026 by month, bb-core and BTC context
console.log('\n## 5. 2026 bb-core pooled R by month\n'); let run = 0; for (const [k] of Object.entries(M).filter(([k]) => k >= '2026-01').sort()) { run += M[k]; console.log(`${k}: ${f1(M[k])}R  (running ${f1(run)}R)`); }
