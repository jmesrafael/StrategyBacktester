// contenders-pooled.js — every contender on all 5 coins together (frozen textbook settings), year by year, vs bb-core and bb-core + contender.
'use strict';
const { runStrat } = require('./contenders.js');
const { backtest, summarize, DEFAULTS } = require('./v2-core.js');
const { COINS, loadCoin } = require('./load.js');
const venue = process.argv.includes('--mexc') ? 'mexc' : 'binance', D = Object.fromEntries(COINS.map((c) => [c, loadCoin(c, venue)])), cost = DEFAULTS.cost;
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
const get = (name) => COINS.flatMap((c) => (name === 'bb-core' ? backtest(D[c].B, { cost }, D[c].funding).trades : runStrat(D[c].B, name, cost, D[c].funding).trades).map((t) => ({ ...t, coin: c })));
const names = ['bb-core', 'ema20/50', 'ema10/50', 'ema20/100', 'ema50/100', 'donchian55', 'macd'];
const T = Object.fromEntries(names.map((n) => [n, get(n)])), yrs = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
console.log(`# All 5 coins together (${venue}), frozen textbook settings, 1R per trade\n`);
console.log('| strategy | trades | expectancy | total R | max DD | R/DD | ' + yrs.join(' | ') + ' | positive years | coins with 7/7 (6/6 GALA) |');
console.log('|---|---|---|---|---|---|' + yrs.map(() => '---').join('|') + '|---|---|');
const row = (label, t) => {
  const s = summarize(t), y = s.years, full = COINS.filter((c) => { const ys = Object.values(summarize(t.filter((x) => x.coin === c)).years); return ys.every((v) => v > 0); }).length;
  console.log(`| ${label} | ${s.n} | ${f3(s.avgR)}R | **${f1(s.R)}** | ${s.dd.toFixed(1)} | ${(s.R / s.dd).toFixed(1)} | ` + yrs.map((k) => (y[k] == null ? '–' : (y[k] > 0 ? '' : '**') + f1(y[k]) + (y[k] > 0 ? '' : '**'))).join(' | ') + ` | ${yrs.filter((k) => y[k] > 0).length}/7 | ${full}/5 |`);
};
for (const n of names) row(n === 'bb-core' ? '**bb-core**' : n, T[n]);
console.log('\n## bb-core + a contender, each at ½R (same total risk as bb-core alone)\n');
console.log('| combination | trades | expectancy | total R | max DD | R/DD | ' + yrs.join(' | ') + ' | positive years | coins with 7/7 |');
console.log('|---|---|---|---|---|---|' + yrs.map(() => '---').join('|') + '|---|---|');
for (const n of names.slice(1)) row(`bb-core + ${n}`, [...T['bb-core'], ...T[n]].map((x) => ({ ...x, R: x.R / 2 })));
