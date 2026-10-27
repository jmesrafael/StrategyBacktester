// merged-yearly.js — one table per strategy (bb-core, EMA 20/100, merged two-slot 1R each), year by year, then a side-by-side summary.
//   node merged-yearly.js [--coin SOL] [--venue binance]
'use strict';
const { runMerged } = require('./merged.js');
const { summarize, DEFAULTS } = require('./v2-core.js');
const { loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const COIN = opt('coin', 'SOL'), venue = opt('venue', 'binance'), D = loadCoin(COIN, venue), RISK = 5;
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2), usd = (v) => (v < 0 ? '−$' : '+$') + Math.abs(Math.round(v * RISK)).toLocaleString('en-US');
const B = (v) => (v < 0 ? `**${v}**` : v);
const S = [['bb-core', 'bb'], ['EMA 20/100', 'ema'], ['Merged: bb-core + EMA 20/100, two slots, 1R each', 'two']];
const T = Object.fromEntries(S.map(([, m]) => [m, runMerged(D.B, m, DEFAULTS.cost, D.funding).trades]));
const yOf = (t) => new Date(t.tExit * 1000).getUTCFullYear(), YRS = [...new Set(Object.values(T).flat().map(yOf))].sort();

console.log(`# bb-core vs EMA 20/100 vs merged — ${COIN}, ${venue} 4h, real fees/slippage/funding, $${RISK} risk per trade\n`);
console.log('Years are by exit date. DD = largest peak-to-trough drop inside that year. **Bold** = losing year.\n');
for (const [label, m] of S) {
  console.log(`## ${label}\n`);
  const split = m === 'two';
  console.log(`| year | trades | wins | win% | ${split ? 'bb R | EMA R | ' : ''}total R | $ | expectancy | best trade | worst trade | DD in year |`);
  console.log(`|---|---|---|---|${split ? '---|---|' : ''}---|---|---|---|---|---|`);
  for (const y of YRS) {
    const t = T[m].filter((x) => yOf(x) === y); if (!t.length) continue;
    const s = summarize(t), rs = t.map((x) => x.R), part = (g) => f1(t.filter((x) => x.trig === g).reduce((a, x) => a + x.R, 0));
    console.log(`| ${y} | ${s.n} | ${rs.filter((r) => r > 0).length} | ${(s.win * 100).toFixed(0)}% | ${split ? part('bb') + ' | ' + part('ema') + ' | ' : ''}**${B(f1(s.R))}** | ${usd(s.R)} | ${f2(s.avgR)} | ${f1(Math.max(...rs))} | ${f1(Math.min(...rs))} | ${s.dd.toFixed(1)} |`);
  }
  const s = summarize(T[m]), rs = T[m].map((x) => x.R), part = (g) => f1(T[m].filter((x) => x.trig === g).reduce((a, x) => a + x.R, 0));
  console.log(`| **total** | **${s.n}** | **${rs.filter((r) => r > 0).length}** | **${(s.win * 100).toFixed(0)}%** | ${split ? '**' + part('bb') + '** | **' + part('ema') + '** | ' : ''}**${f1(s.R)}** | **${usd(s.R)}** | **${f2(s.avgR)}** | ${f1(Math.max(...rs))} | ${f1(Math.min(...rs))} | **${s.dd.toFixed(1)}** (all-time) |\n`);
}

console.log('## Summary — the three side by side\n');
console.log('### R per year\n');
console.log('| year | ' + S.map(([l]) => l.split(':')[0]).join(' | ') + ' | best |'); console.log('|---|' + S.map(() => '---').join('|') + '|---|');
for (const y of YRS) {
  const v = S.map(([, m]) => T[m].filter((x) => yOf(x) === y).reduce((a, x) => a + x.R, 0));
  console.log(`| ${y} | ${v.map((x) => B(f1(x))).join(' | ')} | ${S[v.indexOf(Math.max(...v))][0].split(':')[0]} |`);
}
console.log('\n### Overall\n');
console.log('| | ' + S.map(([l]) => l.split(':')[0]).join(' | ') + ' |'); console.log('|---|' + S.map(() => '---').join('|') + '|');
const st = S.map(([, m]) => ({ s: summarize(T[m]), t: T[m] }));
const row = (l, f) => console.log(`| ${l} | ${st.map(f).join(' | ')} |`);
row('total R', ({ s }) => `**${f1(s.R)}**`); row(`total $ (@$${RISK})`, ({ s }) => usd(s.R)); row('trades', ({ s }) => s.n); row('win rate', ({ s }) => (s.win * 100).toFixed(0) + '%');
row('expectancy per trade', ({ s }) => f2(s.avgR) + 'R'); row('max drawdown', ({ s }) => s.dd.toFixed(1) + 'R'); row('return ÷ drawdown', ({ s }) => (s.R / s.dd).toFixed(1));
row('positive years', ({ s }) => { const v = Object.values(s.years); return `${v.filter((x) => x > 0).length}/${v.length}`; });
row('worst year', ({ s }) => f1(Math.min(...Object.values(s.years)))); row('average year', ({ s }) => f1(s.R / Object.keys(s.years).length));
row('max risk open at once', (_, k) => (k === 2 ? '2R' : '1R'));
