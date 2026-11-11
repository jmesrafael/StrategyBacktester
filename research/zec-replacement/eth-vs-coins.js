// eth-vs-coins.js — ETH against each of the bots' five coins (SOL, ZEC, NEAR, ADA, GALA), bot by bot, on the same window for every coin.
//   node eth-vs-coins.js [FROM-YEAR]   default 2022 (Jan 2022 -> Oct 2026, 58 months: GALA's data starts Sep 2021, so every coin is complete).
//   2021: 70 months, GALA left out (it has no 2021). 2020: 82 months, only the coins with a complete 2020 (ETH, ZEC, ADA; SOL and NEAR start late 2020).
// A month with no closed trade counts as flat (0R), not losing. Trades: trades.json (screen.js: the bots' exact rules, real fees, slippage and funding).
'use strict';
const fs = require('fs'), path = require('path');
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'trades.json'), 'utf8'));
const FROM = +(process.argv[2] || 2022), BOTS = ['BB-CORE', 'I-CORE', 'T-CORE'];
const COINS = ['ETH', 'SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'].filter((c) => { const first = Math.min(...T[c]['BB-CORE'].map((t) => t[0])); return first < Date.UTC(FROM, 0, 15) / 1000; }); // complete window only
const A = Date.UTC(FROM, 0, 1) / 1000, B = Date.UTC(2026, 10, 1) / 1000, RECENT = Date.UTC(2025, 0, 1) / 1000;
const MONTHS = []; for (let y = FROM, m = 0; Date.UTC(y, m, 1) / 1000 < B; m++) { if (m === 12) { m = 0; y++; } if (Date.UTC(y, m, 1) / 1000 < B) MONTHS.push(`${y}-${String(m + 1).padStart(2, '0')}`); }

function measure(tr) {
  tr = tr.filter((t) => t[1] > A && t[1] <= B).sort((a, b) => a[1] - b[1]);
  const R = tr.map((t) => t[2]), wins = R.filter((r) => r > 0), loss = R.filter((r) => r <= 0);
  const mo = Object.fromEntries(MONTHS.map((k) => [k, 0])); for (const t of tr) mo[new Date(t[1] * 1000).toISOString().slice(0, 7)] += t[2];
  const mv = MONTHS.map((k) => mo[k]);
  let run = 0, maxRun = 0; for (const v of mv) { if (v < 0) { run++; maxRun = Math.max(maxRun, run); } else run = 0; }
  let w12 = Infinity, neg12 = 0, n12 = 0; for (let i = 0; i + 12 <= mv.length; i++) { const s = mv.slice(i, i + 12).reduce((a, b) => a + b, 0); w12 = Math.min(w12, s); n12++; if (s < 0) neg12++; }
  let e = 0, pk = 0, dd = 0, under = 0, maxUnder = 0; for (const v of mv) { e += v; if (e >= pk) { pk = e; under = 0; } else { under++; maxUnder = Math.max(maxUnder, under); } dd = Math.max(dd, pk - e); }
  let te = 0, tp = 0, tdd = 0; for (const r of R) { te += r; tp = Math.max(tp, te); tdd = Math.max(tdd, tp - te); }   // trade-level drawdown (deeper than month-end)
  const years = {}; for (const t of tr) { const y = new Date(t[1] * 1000).getUTCFullYear(); years[y] = (years[y] || 0) + t[2]; }
  const rec = mv.slice(MONTHS.findIndex((k) => k >= '2025-01'));
  return { trades: R.length, win: wins.length / R.length, pf: wins.reduce((a, b) => a + b, 0) / -loss.reduce((a, b) => a + b, 0), exp: te / R.length, total: te,
    perMonth: te / mv.length, losingMonths: mv.filter((v) => v < 0).length, months: mv.length, losingRun: maxRun, worstMonth: Math.min(...mv), bestMonth: Math.max(...mv),
    worst12: w12, neg12: neg12 / n12, maxDD: tdd, underwater: maxUnder, yearsPos: Object.values(years).filter((v) => v > 0).length, yearsN: Object.keys(years).length, worstYear: Math.min(...Object.values(years)),
    recentPerMonth: rec.reduce((a, b) => a + b, 0) / rec.length, recentLosing: rec.filter((v) => v < 0).length / rec.length };
}
// rows: [label, key, higherIsBetter, format]
const pc = (v) => (v * 100).toFixed(0) + '%', r1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), r2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
const ROWS = [
  ['Losing months', 'losingMonths', false, (v, m) => `${v}/${m.months} (${pc(v / m.months)})`],
  ['Longest run of losing months', 'losingRun', false, String],
  ['Worst month (R)', 'worstMonth', true, r1],
  ['Rolling 12 months ending negative', 'neg12', false, pc],
  ['Worst 12 months (R)', 'worst12', true, r1],
  ['Max drawdown (R, trade by trade)', 'maxDD', false, (v) => v.toFixed(1)],
  ['Longest time below a previous high (months)', 'underwater', false, String],
  [`Years positive (${FROM}-2026)`, 'yearsPos', true, (v, m) => `${v}/${m.yearsN}`],
  ['Worst year (R)', 'worstYear', true, r1],
  ['Win rate', 'win', true, pc],
  ['Profit factor', 'pf', true, (v) => v.toFixed(2)],
  ['Expectancy (R per trade)', 'exp', true, r2],
  ['R per month', 'perMonth', true, r2],
  ['Recent (2025-26) R per month', 'recentPerMonth', true, r2],
  ['Recent (2025-26) losing months', 'recentLosing', false, pc],
];
const out = {};
for (const bot of BOTS) {
  const m = Object.fromEntries(COINS.map((c) => [c, measure(T[c][bot])])); out[bot] = m;
  console.log(`\n${bot} — Jan ${FROM} to Oct 2026 (${MONTHS.length} months; coins with complete data: ${COINS.join(", ")})`);
  console.log('Measure'.padEnd(46) + COINS.map((c) => c.padStart(12)).join('') + `   ETH rank`);
  let firsts = [];
  for (const [label, key, hi, fmt] of ROWS) {
    const vals = COINS.map((c) => m[c][key]), sorted = [...vals].sort((a, b) => (hi ? b - a : a - b)), rank = sorted.indexOf(m.ETH[key]) + 1;
    if (rank === 1) firsts.push(label);
    console.log(label.padEnd(46) + COINS.map((c) => fmt(m[c][key], m[c]).padStart(12)).join('') + `   ${rank}/${COINS.length}${rank === 1 ? '  BEST' : rank === COINS.length ? '  worst' : ''}`);
  }
  console.log('ETH is best on: ' + (firsts.length ? firsts.join('; ') : 'nothing'));
}
fs.writeFileSync(path.join(__dirname, `eth-vs-coins-${FROM}.json`), JSON.stringify(out, null, 1));
