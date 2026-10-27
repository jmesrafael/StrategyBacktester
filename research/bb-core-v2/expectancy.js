// expectancy.js — expectancy of bb-core (and the variants tried in v2) with honest uncertainty.
//   Expectancy (R) = win% × average win (R)  −  loss% × average loss (R)   = the plain average R per trade.
//   node expectancy.js [--venue mexc] [--risk 5]
// Every figure is net of fees, slippage and funding unless marked gross. The 95% intervals say how much of the number could be luck.
'use strict';
const { backtest, scaleCost, DEFAULTS } = require('./v2-core.js');
const { COINS, loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const venue = opt('venue', 'binance'), RISK = +opt('risk', 5);
const FREE = { entryFee: 0, stopFee: 0, timeFee: 0, tpFee: 0, slip: 0, tpSlip: 0, tpBuf: 0 };
const f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2), f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3), usd = (v) => (v < 0 ? '−$' : '+$') + Math.abs(v * RISK).toFixed(2);
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function ex(rs) {
  const n = rs.length; if (!n) return null;
  const w = rs.filter((r) => r > 0), l = rs.filter((r) => r <= 0), mean = rs.reduce((a, r) => a + r, 0) / n;
  const sd = Math.sqrt(rs.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(1, n - 1)), se = sd / Math.sqrt(n);
  const winP = w.length / n, avgW = w.length ? w.reduce((a, r) => a + r, 0) / w.length : 0, avgL = l.length ? -l.reduce((a, r) => a + r, 0) / l.length : 0;
  const rnd = rng(99), means = [];
  for (let b = 0; b < 4000; b++) { let s = 0; for (let i = 0; i < n; i++) s += rs[Math.floor(rnd() * n)]; means.push(s / n); }
  means.sort((a, b) => a - b);
  return { n, mean, sd, se, t: mean / se, winP, avgW, avgL, payoff: avgL ? avgW / avgL : Infinity, beWin: 1 / (1 + (avgL ? avgW / avgL : Infinity)),
    lo: means[Math.floor(0.025 * 4000)], hi: means[Math.floor(0.975 * 4000)], pPos: means.filter((m) => m > 0).length / 4000, nNeeded: Math.ceil((2 * sd / Math.max(mean, 1e-9)) ** 2) };
}
const run = (coin, cfg = {}, k = 1, gross = false) => {
  const { B, funding } = loadCoin(coin, venue);
  return backtest(B, { ...cfg, cost: gross ? FREE : scaleCost(DEFAULTS.cost, k) }, gross ? null : funding).trades.map((t) => ({ ...t, coin }));
};
const yearsSpan = (t) => (Math.max(...t.map((x) => x.tExit)) - Math.min(...t.map((x) => x.t))) / 31557600;

const base = {}, all = [];
for (const c of COINS) { base[c] = run(c); all.push(...base[c]); }
console.log(`# Expectancy of bb-core — ${venue} candles, net of fees/slippage/funding, $${RISK} risked per trade (1R = $${RISK})\n`);
console.log('**Expectancy = win% × avg win − loss% × avg loss = average R per trade.** 95% interval = bootstrap (4,000 resamples of the trades). P(E>0) = share of resamples with a positive average.\n');

console.log('## 1. Per coin and portfolio\n');
console.log('| | trades | win% | avg win | avg loss | payoff (win÷loss) | break-even win% | **expectancy** | $ per trade | 95% interval | P(E>0) | t-stat | trades/yr | R per year |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const line = (label, t) => {
  const e = ex(t.map((x) => x.R)), yrs = yearsSpan(t);
  console.log(`| ${label} | ${e.n} | ${(e.winP * 100).toFixed(1)}% | +${e.avgW.toFixed(2)}R | −${e.avgL.toFixed(2)}R | ${e.payoff.toFixed(2)} | ${(e.beWin * 100).toFixed(1)}% | **${f3(e.mean)}R** | ${usd(e.mean)} | ${f2(e.lo)} to ${f2(e.hi)} | ${(e.pPos * 100).toFixed(1)}% | ${e.t.toFixed(1)} | ${(e.n / yrs).toFixed(0)} | ${f1(e.mean * e.n / yrs)} |`);
};
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
for (const c of COINS) line(c, base[c]);
line('**ALL 5 pooled**', all);

console.log('\n## 2. Gross vs net — how much do costs take per trade?\n');
console.log('Gross = no fees, slippage or funding (an upper bound). Cost drag = gross − net. "Costs ×2/×3" = fees and slippage doubled/tripled (funding unchanged).\n');
console.log('| | gross | net (real) | cost drag | costs ×2 | costs ×3 | drag as % of gross |'); console.log('|---|---|---|---|---|---|---|');
for (const c of [...COINS, 'ALL']) {
  const m = (t) => ex(t.map((x) => x.R)).mean, g = c === 'ALL' ? COINS.flatMap((x) => run(x, {}, 1, true)) : run(c, {}, 1, true);
  const n = c === 'ALL' ? all : base[c], x2 = c === 'ALL' ? COINS.flatMap((x) => run(x, {}, 2)) : run(c, {}, 2), x3 = c === 'ALL' ? COINS.flatMap((x) => run(x, {}, 3)) : run(c, {}, 3);
  console.log(`| ${c === 'ALL' ? '**ALL 5**' : c} | ${f3(m(g))}R | **${f3(m(n))}R** | −${(m(g) - m(n)).toFixed(3)}R | ${f3(m(x2))}R | ${f3(m(x3))}R | ${(100 * (m(g) - m(n)) / m(g)).toFixed(0)}% |`);
}

console.log('\n## 3. Where the expectancy comes from (all 5 coins pooled)\n');
console.log('| exit | trades | share | win% | avg R | contribution to total R |'); console.log('|---|---|---|---|---|---|');
const totalR = all.reduce((a, x) => a + x.R, 0);
for (const w of ['target', 'stop', 'time']) { const t = all.filter((x) => x.why === w), e = ex(t.map((x) => x.R)); console.log(`| ${w} | ${t.length} | ${(100 * t.length / all.length).toFixed(0)}% | ${(e.winP * 100).toFixed(0)}% | ${f3(e.mean)}R | ${f1(t.reduce((a, x) => a + x.R, 0))}R (${(100 * t.reduce((a, x) => a + x.R, 0) / totalR).toFixed(0)}%) |`); }
console.log('\n| direction | trades | win% | expectancy | 95% interval |'); console.log('|---|---|---|---|---|');
for (const [l, d] of [['long', 1], ['short', -1]]) { const e = ex(all.filter((x) => x.dir === d).map((x) => x.R)); console.log(`| ${l} | ${e.n} | ${(e.winP * 100).toFixed(1)}% | **${f3(e.mean)}R** | ${f2(e.lo)} to ${f2(e.hi)} |`); }

console.log('\n## 4. Expectancy by year (pooled, 5 coins)\n');
console.log('| year | trades | win% | expectancy | 95% interval |'); console.log('|---|---|---|---|---|');
for (const y of [...new Set(all.map((x) => new Date(x.tExit * 1000).getUTCFullYear()))].sort()) { const e = ex(all.filter((x) => new Date(x.tExit * 1000).getUTCFullYear() === y).map((x) => x.R)); console.log(`| ${y} | ${e.n} | ${(e.winP * 100).toFixed(0)}% | **${f3(e.mean)}R** | ${f2(e.lo)} to ${f2(e.hi)} |`); }

console.log('\n## 5. How much data to trust it?\n');
const eAll = ex(all.map((x) => x.R));
console.log(`Pooled: expectancy ${f3(eAll.mean)}R, standard deviation of one trade ${eAll.sd.toFixed(2)}R. Trades needed for a t-stat of 2 on the pooled number: about ${eAll.nNeeded}. We have ${eAll.n}.`);
for (const c of COINS) { const e = ex(base[c].map((x) => x.R)); console.log(`- ${c}: ${e.n} trades, needs about ${e.nNeeded} for t=2 (t-stat now ${e.t.toFixed(1)}), P(expectancy > 0) = ${(e.pPos * 100).toFixed(1)}%`); }
const rnd = rng(5);
console.log('\nLosing-streak odds (pooled win rate ' + (eAll.winP * 100).toFixed(1) + '%, independent trades): chance that a run of N losers occurs somewhere in the next 100 trades');
const pl = 1 - eAll.winP; for (const N of [5, 8, 10, 12]) { let hit = 0; for (let s = 0; s < 20000; s++) { let run_ = 0, ok = false; for (let i = 0; i < 100; i++) { if (rnd() < pl) { run_++; if (run_ >= N) { ok = true; break; } } else run_ = 0; } if (ok) hit++; } console.log(`- ${N} losers in a row: ${(100 * hit / 20000).toFixed(0)}%`); }

console.log('\n## 6. Do the "improved" variants have a real expectancy difference? (SOL, then all 5 pooled)\n');
console.log('If the 95% intervals overlap heavily, the difference could be luck.\n');
console.log('| variant | coins | trades | expectancy | 95% interval | total R |'); console.log('|---|---|---|---|---|---|');
const V = [['bb-core', {}], ['hold 96 candles', { maxBars: 96 }], ['breakout ≥0.5 ATR', { minBreakAtr: 0.5 }], ['breakout ≥0.5 ATR + 2-ATR stop + 96', { minBreakAtr: 0.5, stopMode: 'atr', stopAtr: 2, maxBars: 96 }]];
for (const [l, c] of V) for (const set of [['SOL'], COINS]) { const t = set.flatMap((x) => run(x, c)), e = ex(t.map((x) => x.R)); console.log(`| ${l} | ${set.length === 1 ? 'SOL' : 'all 5'} | ${e.n} | **${f3(e.mean)}R** | ${f2(e.lo)} to ${f2(e.hi)} | ${f1(t.reduce((a, x) => a + x.R, 0))}R |`); }
