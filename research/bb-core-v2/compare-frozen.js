// compare-frozen.js — bb-core vs the FROZEN v2-A (only change: maxBars 96) on every coin. Real fees/slippage/funding, $5 per trade.
// Nothing here is tuned: the setting was chosen on SOL (explore.js) and is applied unchanged to the other coins.
//   node compare-frozen.js [--coins SOL,ZEC,NEAR,ADA,GALA] [--venue mexc] [--bars 96] [--risk 5]
'use strict';
const { backtest, summarize, scaleCost, DEFAULTS } = require('./v2-core.js');
const { COINS, loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const coins = opt('coins', COINS.join(',')).split(','), venue = opt('venue', 'binance'), RISK = +opt('risk', 5), BARS = +opt('bars', 96);
const cost = scaleCost(DEFAULTS.cost, 1);
const R = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), $ = (v) => (v < 0 ? '−$' : '+$') + Math.abs(Math.round(v * RISK)).toLocaleString('en-US'), pc = (v) => (v * 100).toFixed(1) + '%';
const FROM = (t) => new Date(t * 1000).toISOString().slice(0, 10);

const out = {}; const all = { base: [], v2: [] };
for (const coin of coins) {
  const { B, funding } = loadCoin(coin, venue);
  const base = backtest(B, { cost }, funding).trades, v2 = backtest(B, { cost, maxBars: BARS }, funding).trades;
  out[coin] = { base, v2, from: FROM(B[0].time), to: FROM(B[B.length - 1].time) };
  all.base.push(...base); all.v2.push(...v2);
}
const pf = (t) => { const g = t.filter((x) => x.R > 0).reduce((a, x) => a + x.R, 0), l = -t.filter((x) => x.R <= 0).reduce((a, x) => a + x.R, 0); return l ? g / l : Infinity; };
const years = (t) => summarize(t).years;

console.log(`# bb-core vs v2-A (maxBars ${BARS}, nothing else changed) — ${venue} candles, real fees/slippage/funding, $${RISK} per trade\n`);
console.log('## Per coin\n');
console.log('| coin | data | | trades | total R | total $ | win rate | avg R | profit factor | max drawdown | profitable years | R ≤2023 | R ≥2024 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const line = (coin, from, tag, t) => {
  const s = summarize(t), ys = Object.values(s.years);
  console.log(`| ${coin} | ${from} | ${tag} | ${s.n} | **${R(s.R)}R** | **${$(s.R)}** | ${pc(s.win)} | ${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R | ${pf(t).toFixed(2)} | ${s.dd.toFixed(1)}R | ${ys.filter((v) => v > 0).length}/${ys.length} | ${R(s.isR)} | ${R(s.oosR)} |`);
};
for (const c of coins) { line(c, out[c].from + ' →', 'bb-core', out[c].base); line('', '', '**v2-A**', out[c].v2); }
line('ALL', '', 'bb-core', all.base); line('', '', '**v2-A**', all.v2);

console.log('\n## Change per coin (v2-A minus bb-core)\n');
console.log('| coin | Δ total R | Δ % | Δ win rate | Δ max drawdown | better? |'); console.log('|---|---|---|---|---|---|');
let wins = 0;
for (const c of [...coins, 'ALL']) {
  const a = summarize(c === 'ALL' ? all.base : out[c].base), b = summarize(c === 'ALL' ? all.v2 : out[c].v2);
  if (c !== 'ALL' && b.R > a.R) wins++;
  console.log(`| ${c} | ${R(b.R - a.R)}R (${R((b.R - a.R) * RISK).replace('+', '+$').replace('-', '−$')}) | ${((b.R / a.R - 1) * 100 >= 0 ? '+' : '') + ((b.R / a.R - 1) * 100).toFixed(0)}% | ${((b.win - a.win) * 100 >= 0 ? '+' : '') + ((b.win - a.win) * 100).toFixed(1)} pts | ${(b.dd - a.dd >= 0 ? '+' : '') + (b.dd - a.dd).toFixed(1)}R | ${b.R > a.R ? 'yes' : 'NO'} |`);
}
console.log(`\nv2-A beats bb-core on ${wins} of ${coins.length} coins.`);

console.log('\n## Return per year, R (bb-core → v2-A)\n');
const ys = [...new Set(Object.values(out).flatMap((o) => Object.keys(years(o.base))))].sort();
console.log('| coin | ' + ys.join(' | ') + ' | total |'); console.log('|---|' + ys.map(() => '---').join('|') + '|---|');
for (const c of [...coins, 'ALL']) {
  const a = c === 'ALL' ? all.base : out[c].base, b = c === 'ALL' ? all.v2 : out[c].v2, ya = years(a), yb = years(b);
  console.log(`| ${c} | ` + ys.map((y) => (ya[y] === undefined && yb[y] === undefined ? '–' : `${R(ya[y] || 0)} → ${R(yb[y] || 0)}`)).join(' | ') + ` | **${R(summarize(a).R)} → ${R(summarize(b).R)}** |`);
}
const better = ys.filter((y) => (years(all.v2)[y] || 0) > (years(all.base)[y] || 0));
console.log(`\nAll coins together, v2-A is ahead in ${better.length} of ${ys.length} years (${better.join(', ')}).`);
