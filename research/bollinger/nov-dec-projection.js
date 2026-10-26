// nov-dec-projection.js — SOL+ZEC+ADA combined, BB Breakout 1:4, 5% compounding risk per trade.
// Projects a Nov 1 - Dec 31 window by replaying the SAME calendar window from each past year (2021-2025)
// as a stand-in for "today -> end of 2026" (we don't have Nov/Dec 2026 data yet - it hasn't happened).
// usage: node nov-dec-projection.js
const fs = require('fs'), L = require('./lib.js'), F = require('./fam.js');
const COINS = ['SOL', 'ZEC', 'ADA'], PCT_RISK = 0.05, FX = 63.5, START_PHP = 3000;
const START_USD = START_PHP / FX;
const BB4 = { tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 4, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const ts = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;

const allTrades = {};
for (const sym of COINS) allTrades[sym] = F.sq(sym, BB4);

const out = [`# Nov 1 - Dec 31 projection, SOL+ZEC+ADA combined, BB Breakout 1:4, 5% compounding\n`,
  `Start capital: ${START_PHP} PHP = $${START_USD.toFixed(2)} (at ${FX} PHP/USD). Trades from all 3 coins merged in time order; each risks 5% of whatever the shared equity is at that moment. Since Nov-Dec 2026 hasn't happened yet, this replays the same Nov1-Dec31 window from each past year as a stand-in for "2 months from here" — not a guarantee, a range of what 2 similar months have actually done.\n`,
  `| Year window | Trades | End equity | Return | Max DD % |`, `|---|---|---|---|---|`];

const results = [];
for (const y of [2021, 2022, 2023, 2024, 2025]) {
  const a = ts(y, 11, 1), b = ts(y + 1, 1, 1);
  const trades = COINS.flatMap((s) => allTrades[s].filter((t) => t.t >= a && t.t < b)).sort((p, q) => p.t - q.t);
  let eq = START_USD, pk = START_USD, dd = 0;
  for (const t of trades) { eq += eq * PCT_RISK * t.R; pk = Math.max(pk, eq); dd = Math.max(dd, (pk - eq) / pk); }
  const ret = (eq / START_USD - 1) * 100;
  results.push({ y, n: trades.length, eq, ret, dd });
  out.push(`| Nov-Dec ${y} | ${trades.length} | $${eq.toFixed(2)} (${(eq * FX).toFixed(0)} PHP) | ${ret >= 0 ? '+' : ''}${ret.toFixed(1)}% | ${(dd * 100).toFixed(1)}% |`);
}
const avgRet = results.reduce((a, r) => a + r.ret, 0) / results.length;
const best = results.slice().sort((a, b) => b.ret - a.ret)[0], worst = results.slice().sort((a, b) => a.ret - b.ret)[0];
out.push('', `**Average of the 5 windows: ${avgRet >= 0 ? '+' : ''}${avgRet.toFixed(1)}%.** Best: Nov-Dec ${best.y} (${best.ret >= 0 ? '+' : ''}${best.ret.toFixed(1)}%). Worst: Nov-Dec ${worst.y} (${worst.ret >= 0 ? '+' : ''}${worst.ret.toFixed(1)}%).`);
fs.writeFileSync(__dirname + '/results-nov-dec-projection.md', out.join('\n') + '\n');
console.log(out.join('\n'));
