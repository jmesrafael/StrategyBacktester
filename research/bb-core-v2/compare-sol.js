// compare-sol.js — SOL: bb-core vs the two v2 candidates, year by year. Real costs + real funding, $5 risk per trade (the bb-core convention).
//   node compare-sol.js [--venue mexc] [--risk 5]
'use strict';
const { backtest, summarize, scaleCost, DEFAULTS } = require('./v2-core.js');
const { loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const venue = opt('venue', 'binance'), RISK = +opt('risk', 5), D = loadCoin('SOL', venue), cost = scaleCost(DEFAULTS.cost, 1);

const V = [
  ['bb-core (current)', {}],
  ['v2-A: hold up to 96 candles (16 days)', { maxBars: 96 }],
  ['v2-B: breakout ≥0.5 ATR + 2-ATR stop + 96 candles', { minBreakAtr: 0.5, stopMode: 'atr', stopAtr: 2, targetR: 4, maxBars: 96 }],
];
const res = V.map(([name, cfg]) => {
  const t = backtest(D.B, { ...cfg, cost }, D.funding).trades, s = summarize(t);
  const ex = {}; for (const x of t) ex[x.why] = (ex[x.why] || 0) + 1;
  const yr = {}; for (const x of t) { const y = new Date(x.tExit * 1000).getUTCFullYear(); (yr[y] = yr[y] || { n: 0, w: 0, R: 0 }); yr[y].n++; yr[y].R += x.R; if (x.R > 0) yr[y].w++; }
  const gp = t.filter((x) => x.R > 0).reduce((a, x) => a + x.R, 0), gl = -t.filter((x) => x.R <= 0).reduce((a, x) => a + x.R, 0);
  return { name, t, s, ex, yr, pf: gp / gl };
});
const years = Object.keys(res[0].yr).sort(), R = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), $ = (v) => (v < 0 ? '−$' : '+$') + Math.abs(Math.round(v * RISK)).toLocaleString('en-US');

console.log(`# SOL — bb-core vs v2 (${venue} candles, ${years[0]}–${years[years.length - 1]}, real fees/slippage/funding, $${RISK} risked per trade, 1R = $${RISK})\n`);
console.log('## Summary\n');
console.log('| | ' + res.map((r) => r.name).join(' | ') + ' |'); console.log('|---|' + res.map(() => '---').join('|') + '|');
const line = (l, f) => console.log(`| ${l} | ` + res.map(f).join(' | ') + ' |');
line('Total return', (r) => `**${$(r.s.R)}**`);
line('Total R', (r) => `**${R(r.s.R)}R**`);
line('Win rate', (r) => `${(r.s.win * 100).toFixed(1)}%`);
line('Trades', (r) => r.s.n);
line('Average R per trade', (r) => `${r.s.avgR >= 0 ? '+' : ''}${r.s.avgR.toFixed(3)}R`);
line('Profit factor', (r) => r.pf.toFixed(2));
line('Max drawdown', (r) => `${r.s.dd.toFixed(1)}R (${$(-r.s.dd).replace('+', '')})`);
line('Return ÷ drawdown', (r) => (r.s.R / r.s.dd).toFixed(1));
line('Profitable years', (r) => `${Object.values(r.yr).filter((y) => y.R > 0).length} / ${years.length}`);
line('Exits (target / stop / time)', (r) => `${r.ex.target || 0} / ${r.ex.stop || 0} / ${r.ex.time || 0}`);
line('Best / worst year', (r) => { const v = Object.values(r.yr).map((y) => y.R); return `${R(Math.max(...v))}R / ${R(Math.min(...v))}R`; });

console.log('\n## Return per year (R, and $ at $' + RISK + ' risk)\n');
console.log('| year | ' + res.map((r) => r.name).join(' | ') + ' |'); console.log('|---|' + res.map(() => '---').join('|') + '|');
for (const y of years) console.log(`| ${y}${y === '2020' ? ' (from Aug)' : y === years[years.length - 1] ? ' (to Oct)' : ''} | ` + res.map((r) => { const v = r.yr[y]; return v ? `${R(v.R)}R · ${$(v.R)}` : '–'; }).join(' | ') + ' |');
console.log(`| **Total** | ` + res.map((r) => `**${R(r.s.R)}R · ${$(r.s.R)}**`).join(' | ') + ' |');

console.log('\n## Win rate and trades per year\n');
console.log('| year | ' + res.map((r) => r.name).join(' | ') + ' |'); console.log('|---|' + res.map(() => '---').join('|') + '|');
for (const y of years) console.log(`| ${y} | ` + res.map((r) => { const v = r.yr[y]; return v ? `${(100 * v.w / v.n).toFixed(0)}% of ${v.n}` : '–'; }).join(' | ') + ' |');
console.log(`| **All** | ` + res.map((r) => `**${(r.s.win * 100).toFixed(0)}% of ${r.s.n}**`).join(' | ') + ' |');

console.log('\n## Change vs bb-core\n');
console.log('| | total R | win rate | max drawdown | 2020–2023 R | 2024+ R |'); console.log('|---|---|---|---|---|---|');
for (const r of res) console.log(`| ${r.name} | ${R(r.s.R)}R (${r.s.R / res[0].s.R >= 1 ? '+' : ''}${((r.s.R / res[0].s.R - 1) * 100).toFixed(0)}%) | ${(r.s.win * 100).toFixed(1)}% | ${r.s.dd.toFixed(1)}R | ${R(r.s.isR)}R | ${R(r.s.oosR)}R |`);
