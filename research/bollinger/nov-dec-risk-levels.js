// nov-dec-risk-levels.js — SOL+ZEC+ADA combined, BB Breakout 1:4, compounding risk at 1% / 2% / 5%,
// WITH a 5,000 PHP deposit added at the start of each calendar month (Nov 1, Dec 1).
// Replays the Nov1-Dec31 window from 2021-2025 as a stand-in for "today -> end of 2026".
// usage: node nov-dec-risk-levels.js
const fs = require('fs'), L = require('./lib.js'), F = require('./fam.js');
const COINS = ['SOL', 'ZEC', 'ADA'], FX = 63.5, START_PHP = 3000, DEPOSIT_PHP = 5000;
const START_USD = START_PHP / FX, DEPOSIT_USD = DEPOSIT_PHP / FX;
const RISKS = [0.01, 0.02, 0.05];
const BB4 = { tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 4, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const ts = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;

const allTrades = {};
for (const sym of COINS) allTrades[sym] = F.sq(sym, BB4);

function run(trades, deposits, pctRisk) {
  let eq = START_USD, pk = START_USD, dd = 0;
  const events = trades.map((t) => ({ t: t.t, type: 'trade', R: t.R }))
    .concat(deposits.map((d) => ({ t: d, type: 'deposit' })))
    .sort((a, b) => a.t - b.t);
  for (const e of events) {
    if (e.type === 'deposit') { eq += DEPOSIT_USD; pk = Math.max(pk, eq); continue; }
    eq += eq * pctRisk * e.R;
    pk = Math.max(pk, eq);
    dd = Math.max(dd, (pk - eq) / pk);
  }
  return { eq, dd };
}

const out = [`# Nov 1 - Dec 31 projection WITH 5,000 PHP/month deposits, SOL+ZEC+ADA, BB Breakout 1:4\n`,
  `Start: ${START_PHP} PHP ($${START_USD.toFixed(2)}). +${DEPOSIT_PHP} PHP deposited Nov 1 and Dec 1 (2 deposits = ${DEPOSIT_PHP * 2} PHP contributed on top of the ${START_PHP} start). Total contributed by Dec 31: ${START_PHP + DEPOSIT_PHP * 2} PHP. Replays each past year's Nov1-Dec31 trades as a stand-in for the 2026 window.\n`];

for (const risk of RISKS) {
  out.push(`## ${(risk * 100).toFixed(0)}% risk per trade\n`, '| Year window | End equity (no-growth baseline would be ' + (START_PHP + DEPOSIT_PHP * 2) + ' PHP) | Return on contributed capital | Max DD % |', '|---|---|---|---|');
  const results = [];
  for (const y of [2021, 2022, 2023, 2024, 2025]) {
    const a = ts(y, 11, 1), b = ts(y + 1, 1, 1);
    const trades = COINS.flatMap((s) => allTrades[s].filter((t) => t.t >= a && t.t < b)).sort((p, q) => p.t - q.t);
    const deposits = [ts(y, 11, 1), ts(y, 12, 1)];
    const { eq, dd } = run(trades, deposits, risk);
    const contributed = START_USD + 2 * DEPOSIT_USD;
    const ret = (eq / contributed - 1) * 100;
    results.push({ y, eq, dd, ret });
    out.push(`| Nov-Dec ${y} | $${eq.toFixed(2)} (${(eq * FX).toFixed(0)} PHP) | ${ret >= 0 ? '+' : ''}${ret.toFixed(1)}% | ${(dd * 100).toFixed(1)}% |`);
  }
  const avgRet = results.reduce((a, r) => a + r.ret, 0) / results.length;
  const avgDD = results.reduce((a, r) => a + r.dd, 0) / results.length;
  const worst = results.slice().sort((a, b) => a.ret - b.ret)[0];
  out.push('', `**Avg return: ${avgRet >= 0 ? '+' : ''}${avgRet.toFixed(1)}%, avg max DD: ${(avgDD * 100).toFixed(1)}%. Worst window: Nov-Dec ${worst.y} (${worst.ret >= 0 ? '+' : ''}${worst.ret.toFixed(1)}%, ${(worst.dd * 100).toFixed(1)}% DD).**\n`);
}
fs.writeFileSync(__dirname + '/results-nov-dec-risk-levels.md', out.join('\n') + '\n');
console.log(out.join('\n'));
