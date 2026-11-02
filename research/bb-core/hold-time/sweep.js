// sweep.js — BB-Core: what is the best time exit (maxBars)? The bot's own engine (lucidio-core.js), Binance 4h, real funding, costs as in the reports.
//   node research/bb-core/hold-time/sweep.js [no-target|target4]      (default no-target; the bot today)
// maxBars counts candles AFTER the entry candle; the trade is held maxBars+1 candles (49 candles = 8 days 4 h at the bot's 48). 0 = no time exit.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const bb = require(path.join(ROOT, '🔴BB-Core', 'lucidio-core.js'));
const coins = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], other = ['AVAX', 'BNB', 'DOGE', 'ETH', 'LINK', 'LTC', 'XRP'];
const load = (f) => JSON.parse(fs.readFileSync(f)).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const fund = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : null);
const D = {}; for (const c of coins) D[c] = { B: load(path.join(ROOT, '🔴BB-Core', 'data', c + '.json')), F: fund(path.join(ROOT, '🔴BB-Core', 'data', 'funding', c + '.json')) };
const mode = process.argv[2] || 'no-target', targetR = mode === 'target4' ? 4 : 0;
const HOLD = [12, 24, 36, 48, 60, 72, 96, 120, 144, 180, 240, 360, 0];
const yearOf = (t) => new Date(t.tExit * 1000).getUTCFullYear();
function run(maxBars) {
  const T = [];
  for (const c of coins) for (const t of bb.backtest(D[c].B, { targetR, maxBars }, D[c].F).trades) T.push({ ...t, coin: c });
  T.sort((a, b) => a.tExit - b.tExit);
  const n = T.length, R = T.map((t) => t.R), net = R.reduce((a, b) => a + b, 0), w = R.filter((x) => x > 0), l = R.filter((x) => x <= 0);
  let eq = 0, pk = 0, dd = 0; for (const r of R) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const sorted = [...R].sort((a, b) => b - a), top10 = sorted.slice(0, 10).reduce((a, b) => a + b, 0);
  const byY = {}; for (const t of T) byY[yearOf(t)] = (byY[yearOf(t)] || 0) + t.R;
  const per = {}; for (const c of coins) per[c] = T.filter((t) => t.coin === c).reduce((a, t) => a + t.R, 0);
  const fresh = [], wdd = []; // fresh 10,000 each January at 2.5% risk, profit booked at close (one account, compounding by trade); wdd = deepest drop inside each year
  for (const y of Object.keys(byY)) { let bal = 10000, pk = 10000, d = 0; for (const t of T.filter((x) => yearOf(x) === +y)) { bal += t.R * bal * 0.025; pk = Math.max(pk, bal); d = Math.max(d, 1 - bal / pk); } fresh.push(bal - 10000); wdd.push(d); }
  const time = T.filter((t) => t.why === 'time');
  return { maxBars, n, net, exp: net / n, win: w.length / n, pf: l.length ? w.reduce((a, b) => a + b, 0) / -l.reduce((a, b) => a + b, 0) : Infinity, dd, top10: net > 0 ? top10 / net : 0,
    avgDays: T.reduce((a, t) => a + t.bars, 0) / n * 4 / 24, timeExits: time.length, timeR: time.reduce((a, t) => a + t.R, 0), yrsUp: Object.values(byY).filter((v) => v > 0).length, yrs: Object.keys(byY).length,
    coinsUp: Object.values(per).filter((v) => v > 0).length, fresh: fresh.reduce((a, b) => a + b, 0), noBest: (net - sorted[0]) / (n - 1), noTop10: net - top10, noTop10Exp: (net - top10) / (n - 10), worstDD: Math.max(...wdd), byY, per };
}
const rows = HOLD.map(run);
const f = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);
console.log(`BB-Core ${mode}: time exit sweep, 5 coins, Binance 4h, real funding, costs in. 'held' = candles in the trade at most (maxBars+1).\n`);
console.log('maxBars  held(days)  trades  total R   avg R   win%   PF    maxDD R  top10%  avg hold d  time-exits (R)       yrs+  coins+  fresh P10k@2.5% (sum)');
for (const r of rows) console.log(`${String(r.maxBars || 'none').padStart(7)}  ${r.maxBars ? (((r.maxBars + 1) * 4) / 24).toFixed(1).padStart(8) : '    none'}  ${String(r.n).padStart(6)}  ${f(r.net).padStart(8)}  ${f(r.exp, 3).padStart(6)}  ${(r.win * 100).toFixed(1).padStart(5)}  ${r.pf.toFixed(2)}  ${r.dd.toFixed(1).padStart(7)}  ${(r.top10 * 100).toFixed(0).padStart(5)}%  ${r.avgDays.toFixed(1).padStart(9)}  ${String(r.timeExits).padStart(4)} (${f(r.timeR, 0).padStart(5)})  ${r.yrsUp}/${r.yrs}   ${r.coinsUp}/5   ${Math.round(r.fresh).toLocaleString()}`);
const base = rows.find((r) => r.maxBars === 48), best = [...rows].sort((a, b) => b.net - a.net)[0];
console.log('\nhow much is the luck of a few huge trades? (the 10 best trades removed) and the worst drop inside one year at 2.5% risk');
console.log('maxBars  held d   total R   w/o 10 best   avg R w/o 10 best   top10 share   worst yr drop');
for (const r of rows.filter((r) => r.maxBars)) console.log(`${String(r.maxBars).padStart(7)}  ${(((r.maxBars + 1) * 4) / 24).toFixed(1).padStart(6)}  ${f(r.net).padStart(8)}  ${f(r.noTop10).padStart(11)}  ${f(r.noTop10Exp, 3).padStart(17)}  ${(r.top10 * 100).toFixed(0).padStart(9)}%  ${(r.worstDD * 100).toFixed(0).padStart(12)}%`);
console.log(`\nbest total R: maxBars ${best.maxBars || 'none'} ${f(best.net)}R vs today's 48: ${f(base.net)}R (${f(best.net - base.net)}R)`);
console.log('\nper coin total R:'); console.log('maxBars  ' + coins.map((c) => c.padStart(8)).join(''));
for (const r of rows) console.log(String(r.maxBars || 'none').padStart(7) + '  ' + coins.map((c) => f(r.per[c], 0).padStart(8)).join(''));
console.log('\nper year total R:'); const ys = Object.keys(base.byY).sort(); console.log('maxBars  ' + ys.map((y) => y.padStart(8)).join(''));
for (const r of rows) console.log(String(r.maxBars || 'none').padStart(7) + '  ' + ys.map((y) => f(r.byY[y] || 0, 0).padStart(8)).join(''));
// out of sample: pick on 2020-2023, judge on 2024-2026
const half = (r, lo, hi) => Object.entries(r.byY).filter(([y]) => +y >= lo && +y <= hi).reduce((a, [, v]) => a + v, 0);
console.log('\nsplit: R in 2020-2023 | R in 2024-2026'); for (const r of rows) console.log(String(r.maxBars || 'none').padStart(7) + '  ' + f(half(r, 2020, 2023)).padStart(8) + ' | ' + f(half(r, 2024, 2026)).padStart(8));
// the seven coins never used to design the bots (no funding data for them: applied equally)
const O = {}; for (const c of other) { const p = path.join(ROOT, '🔴BB-Core', 'data', c + '.json'); if (fs.existsSync(p)) O[c] = load(p); }
if (Object.keys(O).length) { console.log(`\nunseen coins (${Object.keys(O).join(', ')}), total R, no funding:`); for (const mb of HOLD) { let s = 0, n = 0; for (const c of Object.keys(O)) { const t = bb.backtest(O[c], { targetR, maxBars: mb }, null).trades; s += t.reduce((a, x) => a + x.R, 0); n += t.length; } console.log(String(mb || 'none').padStart(7) + `  ${n} trades  ${f(s)}R`); } }
