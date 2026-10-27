// separate-accounts.js — two separate MEXC accounts, each started with ₱30,000 on 1 Jan of every year, compounding at the same % risk per trade, 5 coins:
//   account A = bb-core, account B = EMA 20/100 (the sub-account). Positions still open on 31 Dec are valued at that day's price.
//   node separate-accounts.js [--risk 2.5] [--venue binance|mexc]
'use strict';
const { runMerged } = require('./merged.js'); const { DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d), RISK = +opt('risk', 2.5) / 100, V = opt('venue', 'binance');
const CAP = +opt('cap-usd', Infinity), FX = 63, START = +opt('start-php', 30000) / FX, php = (v) => '₱' + Math.round(v * FX).toLocaleString('en-US'), pc = (v) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(0) + '%';
const D = Object.fromEntries(COINS.map((c) => [c, loadCoin(c, V)])), cache = {};
const trades = (m) => cache[m] || (cache[m] = COINS.flatMap((c) => runMerged(D[c].B, m, DEFAULTS.cost, D[c].funding).trades.map((t) => ({ ...t, coin: c }))));
// equity curve of one account over the year: [[time, balance]...]
function account(m, Y) {
  const t0 = Date.UTC(Y, 0, 1) / 1000, t1 = Date.UTC(Y + 1, 0, 1) / 1000, c = DEFAULTS.cost;
  const T = trades(m).filter((t) => t.t >= t0 && t.t < t1).map((t) => {
    if (t.tExit < t1) return t;
    const B = D[t.coin].B, k = B.findIndex((b) => b.time + 14400 > t1) - 1, px = B[k].close;
    return { ...t, tExit: t1, R: t.w * (t.dir * (px - t.entry) / t.entry - c.entryFee - c.timeFee) / t.dist };
  });
  const ev = []; T.forEach((t, k) => ev.push({ time: t.t, kind: 1, k }, { time: t.tExit, kind: 0, k })); ev.sort((a, b) => a.time - b.time || a.kind - b.kind);
  let bal = START, wins = 0; const risked = {}, curve = [[t0, START]];
  for (const e of ev) { if (e.kind === 1) risked[e.k] = Math.min(bal * RISK, CAP); else { bal += T[e.k].R * risked[e.k]; wins += T[e.k].R > 0; curve.push([e.time, bal]); } }
  return { bal, curve, n: T.length, win: T.length ? wins / T.length : 0 };
}
const dd = (curve) => { let pk = -Infinity, m = 0; for (const [, b] of curve) { pk = Math.max(pk, b); m = Math.max(m, (pk - b) / pk); } return m; };
const combine = (a, b) => { const ev = [...a.map(([t, v]) => [t, 0, v]), ...b.map(([t, v]) => [t, 1, v])].sort((x, y) => x[0] - y[0]), last = [START, START], out = []; for (const [t, i, v] of ev) { last[i] = v; out.push([t, last[0] + last[1]]); } return out; };
const YRS = [2020, 2021, 2022, 2023, 2024, 2025, 2026], R = [];
console.log(`# Two separate accounts, ₱${(START * FX).toLocaleString('en-US')} each, fresh every 1 Jan, ${RISK * 100}% risk per trade compounding — ${V.toUpperCase()}, 5 coins\n`);
console.log('A = bb-core account · B = EMA 20/100 sub-account · Combined = A + B. Year-end value, % return and worst drop from a peak during the year. 2026 runs to 21 Oct.\n');
console.log(`| year | **A: bb-core** | **B: EMA 20/100** | **Combined** (₱${(2 * START * FX).toLocaleString('en-US')} in) | winner |\n|---|---|---|---|---|`);
for (const y of YRS) {
  const a = account('bb', y), b = account('ema', y), c = combine(a.curve, b.curve), tot = a.bal + b.bal; R.push({ y, a, b, tot, ddA: dd(a.curve), ddB: dd(b.curve), ddC: dd(c) });
  const cell = (x, d) => `${php(x.bal)} (${pc(x.bal / START - 1)}, drop ${(d * 100).toFixed(0)}%, ${x.n} trades, ${(x.win * 100).toFixed(0)}% win)`;
  console.log(`| ${y}${y === 2026 ? ' (to Oct)' : ''} | ${cell(a, dd(a.curve))} | ${cell(b, dd(b.curve))} | ${php(tot)} (${pc(tot / (2 * START) - 1)}, drop ${(dd(c) * 100).toFixed(0)}%, ${a.n + b.n} trades) | ${b.bal > a.bal ? 'EMA' : 'bb-core'} |`);
}
const sum = (f) => R.reduce((s, r) => s + f(r), 0), med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log('\n## Scorecard over the 7 yearly restarts\n\n| | A: bb-core | B: EMA 20/100 | Combined |\n|---|---|---|---|');
const ra = R.map((r) => r.a.bal / START - 1), rb = R.map((r) => r.b.bal / START - 1), rc = R.map((r) => r.tot / (2 * START) - 1);
console.log(`| years it won | ${R.filter((r) => r.a.bal >= r.b.bal).length} | ${R.filter((r) => r.b.bal > r.a.bal).length} | – |`);
console.log(`| years up | ${ra.filter((v) => v > 0).length}/7 | ${rb.filter((v) => v > 0).length}/7 | ${rc.filter((v) => v > 0).length}/7 |`);
console.log(`| median year | ${pc(med(ra))} | ${pc(med(rb))} | ${pc(med(rc))} |`);
console.log(`| average year | ${pc(ra.reduce((a, b) => a + b, 0) / 7)} | ${pc(rb.reduce((a, b) => a + b, 0) / 7)} | ${pc(rc.reduce((a, b) => a + b, 0) / 7)} |`);
console.log(`| worst year | ${pc(Math.min(...ra))} | ${pc(Math.min(...rb))} | ${pc(Math.min(...rc))} |`);
console.log(`| best year | ${pc(Math.max(...ra))} | ${pc(Math.max(...rb))} | ${pc(Math.max(...rc))} |`);
console.log(`| average worst drop in the year | ${(sum((r) => r.ddA) / 7 * 100).toFixed(0)}% | ${(sum((r) => r.ddB) / 7 * 100).toFixed(0)}% | ${(sum((r) => r.ddC) / 7 * 100).toFixed(0)}% |`);
console.log(`| deepest drop in any year | ${(Math.max(...R.map((r) => r.ddA)) * 100).toFixed(0)}% | ${(Math.max(...R.map((r) => r.ddB)) * 100).toFixed(0)}% | ${(Math.max(...R.map((r) => r.ddC)) * 100).toFixed(0)}% |`);
console.log(`| trades per year (average) | ${(sum((r) => r.a.n) / 7).toFixed(0)} | ${(sum((r) => r.b.n) / 7).toFixed(0)} | – |`);
console.log(`| win rate (average) | ${(sum((r) => r.a.win) / 7 * 100).toFixed(0)}% | ${(sum((r) => r.b.win) / 7 * 100).toFixed(0)}% | – |`);
console.log(`| total profit if you restarted every year and kept the profit aside | ${php(sum((r) => r.a.bal - START))} | ${php(sum((r) => r.b.bal - START))} | ${php(sum((r) => r.tot - 2 * START))} |`);
const lone = R.filter((r) => r.b.bal < START).length;
console.log(`\nYears the EMA account finished BELOW its start: ${lone}/7 (${R.filter((r) => r.b.bal < START).map((r) => r.y).join(', ') || 'none'}). bb-core: ${R.filter((r) => r.a.bal < START).length}/7. Share of the combined profit that came from EMA: ${(100 * sum((r) => r.b.bal - START) / sum((r) => r.tot - 2 * START)).toFixed(0)}%.`);
