// contenders-report.js — one report: every coin × every strategy by year, overall summary, expectancy per coin. Frozen settings, Binance, real costs.
'use strict';
const { runStrat } = require('./contenders.js');
const { backtest, summarize, DEFAULTS } = require('./v2-core.js');
const { COINS, loadCoin } = require('./load.js');
const cost = DEFAULTS.cost, D = Object.fromEntries(COINS.map((c) => [c, loadCoin(c)]));
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
const S = [['bb-core', 'bb-core'], ['EMA 20/100', 'ema20/100'], ['bb-core + EMA 20/100 (½R each)', 'combo'], ['EMA 20/50', 'ema20/50'], ['EMA 10/50', 'ema10/50'], ['EMA 50/100', 'ema50/100'], ['Donchian 55', 'donchian55'], ['MACD + trend', 'macd']];
const one = (c, n) => (n === 'bb-core' ? backtest(D[c].B, { cost }, D[c].funding).trades : runStrat(D[c].B, n, cost, D[c].funding).trades).map((t) => ({ ...t, coin: c }));
const trades = (c, key) => key === 'combo' ? [...one(c, 'bb-core'), ...one(c, 'ema20/100')].map((t) => ({ ...t, R: t.R / 2 })) : one(c, key);
const YRS = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const cell = (v) => (v == null ? '–' : v > 0 ? f1(v) : `**${f1(v)}**`);
const T = {}; for (const c of COINS) for (const [, k] of S) T[c + k] = trades(c, k);

console.log('# bb-core vs contenders — every coin, every year (Binance 4h, real fees/slippage/funding, frozen textbook settings)\n');
console.log('R per year (1R = amount risked per trade; ×$5 for dollars at $5 risk). **Bold** = losing year. Combo = both strategies at half size, same total risk as bb-core alone.\n');
console.log('| coin | strategy | ' + YRS.join(' | ') + ' | total R | trades | win% | expectancy | max DD | positive yrs |');
console.log('|---|---|' + YRS.map(() => '---').join('|') + '|---|---|---|---|---|---|');
for (const c of COINS) for (const [label, k] of S) {
  const s = summarize(T[c + k]), y = s.years, have = YRS.filter((v) => y[v] != null);
  console.log(`| ${label === 'bb-core' ? '**' + c + '**' : ''} | ${label === 'bb-core' ? '**bb-core**' : label} | ` + YRS.map((v) => cell(y[v])).join(' | ') + ` | **${f1(s.R)}** | ${s.n} | ${(s.win * 100).toFixed(0)}% | ${f2(s.avgR)}R | ${s.dd.toFixed(1)}R | ${have.filter((v) => y[v] > 0).length}/${have.length} |`);
}

console.log('\n## Overall — all 5 coins together\n');
console.log('| strategy | ' + YRS.join(' | ') + ' | total R | total $ (@$5) | trades | win% | expectancy | max DD | R ÷ DD | positive yrs | coins positive every year |');
console.log('|---|' + YRS.map(() => '---').join('|') + '|---|---|---|---|---|---|---|---|---|');
for (const [label, k] of S) {
  const all = COINS.flatMap((c) => T[c + k]), s = summarize(all), y = s.years;
  const full = COINS.filter((c) => Object.values(summarize(T[c + k]).years).every((v) => v > 0)).length;
  console.log(`| ${label === 'bb-core' ? '**bb-core**' : label} | ` + YRS.map((v) => cell(y[v])).join(' | ') + ` | **${f1(s.R)}** | ${(s.R * 5 < 0 ? '−$' : '+$') + Math.abs(Math.round(s.R * 5)).toLocaleString('en-US')} | ${s.n} | ${(s.win * 100).toFixed(0)}% | ${f2(s.avgR)}R | ${s.dd.toFixed(1)}R | ${(s.R / s.dd).toFixed(1)} | ${YRS.filter((v) => y[v] > 0).length}/7 | ${full}/5 |`);
}

console.log('\n## Expectancy per trade, by coin (R)\n');
console.log('| strategy | ' + COINS.join(' | ') + ' | all 5 |'); console.log('|---|' + COINS.map(() => '---').join('|') + '|---|');
for (const [label, k] of S) console.log(`| ${label === 'bb-core' ? '**bb-core**' : label} | ` + COINS.map((c) => f2(summarize(T[c + k]).avgR)).join(' | ') + ` | **${f2(summarize(COINS.flatMap((c) => T[c + k])).avgR)}** |`);
