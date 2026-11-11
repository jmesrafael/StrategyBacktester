// ETH vs the 5 bot coins, per strategy: losing months, streaks, rolling windows, early vs recent.
//   node research/eth-yearly/compare.js   (reads trades.json from run.js) -> COMPARE.md
// Uses a common window (2021-01 → 2026-10, full months only) so every coin is judged on the same market,
// except GALA, which starts Sep 2021 (its window starts 2022-01, marked *).
'use strict';
const fs = require('fs'), path = require('path');
const { trades: T, bots } = JSON.parse(fs.readFileSync(path.join(__dirname, 'trades.json'), 'utf8'));
const COINS = ['ETH', 'SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], BOTS = Object.keys(bots);
const START = 2021 * 12, END = 2026 * 12 + 9, START_GALA = 2022 * 12, SPLIT = 2024 * 12; // month index = y*12+m
const mi = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const lbl = (k) => `${Math.floor(k / 12)}-${String(k % 12 + 1).padStart(2, '0')}`;

function analyse(tr, from) {
  const M = []; for (let k = from; k <= END; k++) M.push(0);
  const inWin = tr.filter((t) => mi(t.tExit) >= from && mi(t.tExit) <= END);
  for (const t of inWin) M[mi(t.tExit) - from] += t.R;
  const n = M.length, lose = M.filter((v) => v < 0).length;
  let streak = 0, maxStreak = 0, sStart = 0, worstStreakAt = 0;
  M.forEach((v, i) => { if (v < 0) { if (!streak) sStart = i; if (++streak > maxStreak) { maxStreak = streak; worstStreakAt = sStart; } } else streak = 0; });
  const roll = (w) => { const s = []; for (let i = 0; i + w <= n; i++) s.push(M.slice(i, i + w).reduce((a, b) => a + b, 0)); return s; };
  const r3 = roll(3), r6 = roll(6), r12 = roll(12);
  // equity curve on month ends: max drawdown and longest time below a previous high (months)
  let eq = 0, pk = 0, dd = 0, under = 0, maxUnder = 0;
  for (const v of M) { eq += v; if (eq >= pk) { pk = eq; under = 0; } else maxUnder = Math.max(maxUnder, ++under); dd = Math.max(dd, pk - eq); }
  let gp = 0, gl = 0; for (const t of inWin) t.R > 0 ? (gp += t.R) : (gl -= t.R);
  const half = (a, b) => M.slice(Math.max(0, a - from), b - from + 1);
  const early = half(from, SPLIT - 1), late = half(SPLIT, END);
  const yr = {}; M.forEach((v, i) => { const y = Math.floor((from + i) / 12); yr[y] = (yr[y] || 0) + v; });
  return {
    months: n, lose, losePct: lose / n, maxStreak, streakAt: lbl(from + worstStreakAt), worstM: Math.min(...M), bestM: Math.max(...M),
    r3neg: r3.filter((v) => v < 0).length / r3.length, r6neg: r6.filter((v) => v < 0).length / r6.length, r12neg: r12.filter((v) => v < 0).length / r12.length,
    worst6: Math.min(...r6), worst12: Math.min(...r12), total: eq, perMonth: eq / n, dd, retDD: dd ? eq / dd : 0, maxUnder,
    trades: inWin.length, exp: inWin.length ? eq / inWin.length : 0, pf: gl ? gp / gl : Infinity,
    earlyLose: early.filter((v) => v < 0).length / early.length, lateLose: late.filter((v) => v < 0).length / late.length,
    earlyPM: early.reduce((a, b) => a + b, 0) / early.length, latePM: late.reduce((a, b) => a + b, 0) / late.length,
    loseYears: Object.values(yr).filter((v) => v < 0).length, years: Object.keys(yr).length,
  };
}

const f1 = (x) => (x > 0 ? '+' : '') + x.toFixed(1), f2 = (x) => (x > 0 ? '+' : '') + x.toFixed(2), pc = (x) => Math.round(x * 100) + '%';
const name = (c) => (c === 'ETH' ? '**ETH**' : c === 'GALA' ? 'GALA*' : c);
const A = {}; for (const b of BOTS) for (const c of COINS) A[b + '|' + c] = analyse(T[b + '|' + c], c === 'GALA' ? START_GALA : START);
// rank 1 = best among the 6 coins on that measure
const rankOf = (b, key, higherBetter) => { const v = COINS.map((c) => A[b + '|' + c][key]); const e = A[b + '|ETH'][key]; return 1 + v.filter((x) => (higherBetter ? x > e : x < e)).length; };

let md = `# ETH vs the 5 bot coins — losing months and long-term consistency\n\nGenerated ${new Date().toISOString().slice(0, 16)} UTC from trades.json (run.js). ` +
  `**Same window for every coin: Jan 2021 → Oct 2026 (70 full months)** so each coin faces the same market; *GALA starts Jan 2022 (58 months) because its data starts Sep 2021. ` +
  `R by the month a trade closes. A month with no closed trade counts as flat (not losing). "Early" = 2021–2023, "recent" = 2024 → Oct 2026.\n`;

for (const b of BOTS) {
  md += `\n## ${b}\n\n### Losing months and streaks\n\n| coin | losing months | % losing | longest losing run (months) | run started | worst month R | best month R | losing years |\n|---|---|---|---|---|---|---|---|\n`;
  for (const c of COINS) { const a = A[b + '|' + c]; md += `| ${name(c)} | ${a.lose}/${a.months} | ${pc(a.losePct)} | ${a.maxStreak} | ${a.streakAt} | ${f1(a.worstM)} | ${f1(a.bestM)} | ${a.loseYears}/${a.years} |\n`; }
  md += `\n### Rolling windows (share of all 3/6/12-month windows that ended negative)\n\n| coin | 3-mo windows < 0 | 6-mo windows < 0 | 12-mo windows < 0 | worst 6 months R | worst 12 months R | longest below a high (months) |\n|---|---|---|---|---|---|---|\n`;
  for (const c of COINS) { const a = A[b + '|' + c]; md += `| ${name(c)} | ${pc(a.r3neg)} | ${pc(a.r6neg)} | ${pc(a.r12neg)} | ${f1(a.worst6)} | ${f1(a.worst12)} | ${a.maxUnder} |\n`; }
  md += `\n### Long-term quality\n\n| coin | trades | PF | exp R | total R | R per month | max DD R | return / DD | early R/mo | recent R/mo | early % losing mo | recent % losing mo |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const c of COINS) { const a = A[b + '|' + c]; md += `| ${name(c)} | ${a.trades} | ${a.pf.toFixed(2)} | ${f2(a.exp)} | ${f1(a.total)} | ${f2(a.perMonth)} | ${a.dd.toFixed(1)} | ${a.retDD.toFixed(1)} | ${f2(a.earlyPM)} | ${f2(a.latePM)} | ${pc(a.earlyLose)} | ${pc(a.lateLose)} |\n`; }
  const r = (k, hb) => rankOf(b, k, hb);
  md += `\n**ETH rank among the 6 coins (1 = best):** % losing months ${r('losePct', false)} · longest losing run ${r('maxStreak', false)} · 12-mo windows negative ${r('r12neg', false)} · worst 12 months ${r('worst12', true)} · expectancy ${r('exp', true)} · PF ${r('pf', true)} · max DD ${r('dd', false)} · return/DD ${r('retDD', true)} · recent R/mo ${r('latePM', true)}\n`;
}

md += `\n## Summary — ETH vs the average of the 5 bot coins\n\n| strategy | measure | ETH | 5-coin avg | 5-coin range |\n|---|---|---|---|---|\n`;
const KEYS = [['losePct', '% losing months', pc], ['maxStreak', 'longest losing run', (x) => x.toFixed(1)], ['r12neg', '12-mo windows negative', pc], ['worst12', 'worst 12 months R', f1], ['exp', 'expectancy R', f2], ['pf', 'profit factor', (x) => x.toFixed(2)], ['dd', 'max DD R', (x) => x.toFixed(1)], ['retDD', 'return / DD', (x) => x.toFixed(1)], ['latePM', 'recent R/month', f2]];
for (const b of BOTS) for (const [k, l, fm] of KEYS) {
  const v = COINS.slice(1).map((c) => A[b + '|' + c][k]);
  md += `| ${b} | ${l} | **${fm(A[b + '|ETH'][k])}** | ${fm(v.reduce((x, y) => x + y, 0) / v.length)} | ${fm(Math.min(...v))} … ${fm(Math.max(...v))} |\n`;
}
fs.writeFileSync(path.join(__dirname, 'COMPARE.md'), md);
fs.writeFileSync(path.join(__dirname, 'compare.json'), JSON.stringify(A, null, 1));
console.log(md);
