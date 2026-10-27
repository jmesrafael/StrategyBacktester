// year-monthly.js — one year, per coin and per month: bb-core vs EMA 20/100 vs merged (side by side, 1R each).  node year-monthly.js [year] [binance|mexc]
'use strict';
const { runMerged } = require('./merged.js'); const { summarize, DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const Y = +(process.argv[2] || 2026), V = process.argv[3] || 'mexc', f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1);
const mo = (sec) => new Date(sec * 1000).getUTCMonth(), yr = (sec) => new Date(sec * 1000).getUTCFullYear(), MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const all = { bb: [], ema: [], two: [] }, per = {};
for (const c of COINS) { const D = loadCoin(c, V); per[c] = {}; for (const m of ['bb', 'ema', 'two']) { per[c][m] = runMerged(D.B, m, DEFAULTS.cost, D.funding).trades.map((t) => ({ ...t, coin: c })); all[m].push(...per[c][m]); } }
const closed = (t) => t.filter((x) => yr(x.tExit) === Y), opened = (t) => t.filter((x) => yr(x.t) === Y);
console.log(`# ${Y} on ${V.toUpperCase()} candles — bb-core vs EMA 20/100 vs merged (side by side, 1R each)\n`);
console.log(`## Per coin (trades closed in ${Y})\n`); console.log('| coin | bb-core R (trades, win%) | EMA 20/100 R (trades, win%) | Merged R (trades, win%) |'); console.log('|---|---|---|---|');
const cell = (t) => { const s = summarize(t); return `${f1(s.R)} (${s.n}, ${s.n ? (s.win * 100).toFixed(0) : 0}%)`; };
for (const c of COINS) console.log(`| ${c} | ${['bb', 'ema', 'two'].map((m) => cell(closed(per[c][m]))).join(' | ')} |`);
console.log(`| **All 5** | ${['bb', 'ema', 'two'].map((m) => '**' + cell(closed(all[m])) + '**').join(' | ')} |`);
const last = Math.max(...all.two.map((x) => mo(x.tExit) + (yr(x.tExit) === Y ? 0 : -99)));
console.log(`\n## Month by month, all 5 coins\n\n"Opened" = trades that started that month. R = profit of trades that closed that month.\n`);
console.log('| month | opened: bb-core | opened: EMA | **opened: merged** | R bb-core | R EMA | **R merged** |'); console.log('|---|---|---|---|---|---|---|');
let tb = 0, te = 0;
for (let m = 0; m <= last; m++) { const o = (k) => opened(all[k]).filter((x) => mo(x.t) === m).length, r = (k) => closed(all[k]).filter((x) => mo(x.tExit) === m).reduce((a, x) => a + x.R, 0); tb += o('bb'); te += o('ema');
  console.log(`| ${MN[m]} | ${o('bb')} | ${o('ema')} | **${o('two')}** | ${f1(r('bb'))} | ${f1(r('ema'))} | **${f1(r('two'))}** |`); }
console.log(`| **Total** | ${tb} | ${te} | **${tb + te}** | ${f1(closed(all.bb).reduce((a, x) => a + x.R, 0))} | ${f1(closed(all.ema).reduce((a, x) => a + x.R, 0))} | **${f1(closed(all.two).reduce((a, x) => a + x.R, 0))}** |`);
console.log(`\n## Merged trades opened per month, per coin\n`); console.log('| coin | ' + MN.slice(0, last + 1).join(' | ') + ' | total |'); console.log('|---|' + MN.slice(0, last + 1).map(() => '---').join('|') + '|---|');
for (const c of COINS) { const n = MN.slice(0, last + 1).map((_, m) => opened(per[c].two).filter((x) => mo(x.t) === m).length); console.log(`| ${c} | ${n.join(' | ')} | **${n.reduce((a, b) => a + b, 0)}** |`); }
