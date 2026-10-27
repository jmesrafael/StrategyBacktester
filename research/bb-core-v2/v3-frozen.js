// v3-frozen.js — "up to 2 positions per coin" (maxPos 2, nothing else changed) on every coin, vs bb-core and vs bb-core at DOUBLE risk.
// Nothing is tuned here: maxPos 2 was picked on SOL (v3-explore.js) and is applied unchanged. Real fees/slippage/funding, $5 risk per position.
//   node v3-frozen.js [--venue mexc] [--pos 2] [--both]
'use strict';
const { backtest, scaleCost, DEFAULTS } = require('./v3-core.js');
const { summarize } = require('./v2-core.js');
const { COINS, loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const venue = opt('venue', 'binance'), POS = +opt('pos', 2), BOTH = args.includes('--both'), RISK = 5, cost = scaleCost(DEFAULTS.cost, 1);
const R = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), $ = (v) => (v < 0 ? '−$' : '+$') + Math.abs(Math.round(v * RISK)).toLocaleString('en-US');
const peak = (t) => { const ev = []; for (const x of t) ev.push([x.i0, 1], [x.i1, -1]); ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]); let c = 0, m = 0; for (const [, d] of ev) { c += d; m = Math.max(m, c); } return m; };
const bars = (t) => t.reduce((a, x) => a + x.bars, 0);

const out = {}, all = { b: [], p: [] };
for (const coin of COINS) {
  const { B, funding } = loadCoin(coin, venue);
  out[coin] = { b: backtest(B, { cost }, funding).trades, p: backtest(B, { cost, maxPos: POS, addSameDir: !BOTH }, funding).trades };
  all.b.push(...out[coin].b); all.p.push(...out[coin].p);
}
console.log(`# bb-core vs up to ${POS} positions per coin${BOTH ? ' (either direction)' : ''} — ${venue} candles, $${RISK} per position\n`);
console.log('"bb-core ×2 risk" = the same bb-core trades with every trade sized double (R and drawdown exactly double): the honest benchmark, since two positions risk about twice as much.\n');
console.log('| coin | | trades | total R | total $ | win rate | max drawdown | return ÷ drawdown | most open | R ≤2023 | R ≥2024 | yrs+ |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
const line = (coin, tag, t, k = 1) => {
  const s = summarize(t), ys = Object.values(s.years);
  console.log(`| ${coin} | ${tag} | ${s.n} | **${R(s.R * k)}R** | **${$(s.R * k)}** | ${(s.win * 100).toFixed(1)}% | ${(s.dd * k).toFixed(1)}R | ${(s.R / s.dd).toFixed(1)} | ${k === 2 ? '(1 at 2× size)' : peak(t)} | ${R(s.isR * k)} | ${R(s.oosR * k)} | ${ys.filter((v) => v > 0).length}/${ys.length} |`);
};
for (const c of [...COINS, 'ALL']) {
  const b = c === 'ALL' ? all.b : out[c].b, p = c === 'ALL' ? all.p : out[c].p;
  line(c === 'ALL' ? '**ALL 5**' : c, 'bb-core', b); line('', 'bb-core ×2 risk', b, 2); line('', `**${POS} positions**`, p);
}
console.log('\n## Verdict per coin\n');
console.log('| coin | extra R vs bb-core | extra R vs ×2 risk | drawdown vs ×2 risk | efficiency (R per 100 position-candles) | beats bb-core? | beats ×2 risk? |'); console.log('|---|---|---|---|---|---|---|');
let wb = 0, w2 = 0;
for (const c of [...COINS, 'ALL']) {
  const b = summarize(c === 'ALL' ? all.b : out[c].b), p = summarize(c === 'ALL' ? all.p : out[c].p), tb = c === 'ALL' ? all.b : out[c].b, tp = c === 'ALL' ? all.p : out[c].p;
  const vb = p.R > b.R, v2 = p.R > 2 * b.R;
  if (c !== 'ALL') { wb += vb; w2 += v2; }
  console.log(`| ${c} | ${R(p.R - b.R)}R | ${R(p.R - 2 * b.R)}R | ${(p.dd - 2 * b.dd >= 0 ? '+' : '') + (p.dd - 2 * b.dd).toFixed(1)}R | ${(100 * b.R / bars(tb)).toFixed(2)} → ${(100 * p.R / bars(tp)).toFixed(2)} | ${vb ? 'yes' : 'NO'} | ${v2 ? 'yes' : 'NO'} |`);
}
console.log(`\nMore total R than bb-core on ${wb} of 5 coins; more than bb-core at double risk on ${w2} of 5 coins.`);
const ys = [...new Set([...all.b, ...all.p].map((x) => new Date(x.tExit * 1000).getUTCFullYear()))].sort();
console.log('\n## All 5 coins, return per year, R (bb-core → bb-core ×2 → ' + POS + ' positions)\n');
console.log('| | ' + ys.join(' | ') + ' | total |'); console.log('|---|' + ys.map(() => '---').join('|') + '|---|');
const yb = summarize(all.b).years, yp = summarize(all.p).years;
console.log('| R | ' + ys.map((y) => `${R(yb[y] || 0)} → ${R(2 * (yb[y] || 0))} → ${R(yp[y] || 0)}`).join(' | ') + ` | **${R(summarize(all.b).R)} → ${R(2 * summarize(all.b).R)} → ${R(summarize(all.p).R)}** |`);
