// sweep.js — BB-Core: which fixed profit target (R multiple of the stop distance)? Time exit LOCKED at 48 (research/bb-core/hold-time: 48 is the most robust).
// The bot's own engine (lucidio-core.js), 5 coins, Binance 4h, real funding, costs as in the reports. targetR 0 = no target (the bot today since 29 Oct 2026).
//   node research/bb-core/targets/sweep.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const bb = require(path.join(ROOT, '🔴BB-Core', 'lucidio-core.js'));
const coins = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const load = (f) => JSON.parse(fs.readFileSync(f)).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const D = {}; for (const c of coins) D[c] = { B: load(path.join(ROOT, '🔴BB-Core', 'data', c + '.json')), F: JSON.parse(fs.readFileSync(path.join(ROOT, '🔴BB-Core', 'data', 'funding', c + '.json'))) };
const TARGETS = [1.5, 2, 3, 4, 5, 6, 8, 0], HOLDS = [24, 36, 48, 72, 96];
const yearOf = (t) => new Date(t.tExit * 1000).getUTCFullYear();
function run(targetR, maxBars) {
  const T = [];
  for (const c of coins) for (const t of bb.backtest(D[c].B, { targetR, maxBars }, D[c].F).trades) T.push({ ...t, coin: c });
  T.sort((a, b) => a.tExit - b.tExit);
  const n = T.length, R = T.map((t) => t.R), net = R.reduce((a, b) => a + b, 0), w = R.filter((x) => x > 0), l = R.filter((x) => x <= 0);
  const gw = w.reduce((a, b) => a + b, 0), gl = -l.reduce((a, b) => a + b, 0);
  let eq = 0, pk = 0, dd = 0; for (const r of R) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const sorted = [...R].sort((a, b) => b - a), top10 = sorted.slice(0, 10).reduce((a, b) => a + b, 0);
  const byY = {}; for (const t of T) byY[yearOf(t)] = (byY[yearOf(t)] || 0) + t.R;
  const per = {}; for (const c of coins) per[c] = T.filter((t) => t.coin === c).reduce((a, t) => a + t.R, 0);
  let fresh = 0, worst = 0;
  for (const y of Object.keys(byY)) { let bal = 10000, p = 10000, d = 0; for (const t of T.filter((x) => yearOf(x) === +y)) { bal += t.R * bal * 0.025; p = Math.max(p, bal); d = Math.max(d, 1 - bal / p); } fresh += bal - 10000; worst = Math.max(worst, d); }
  const why = (k) => T.filter((t) => t.why === k).length;
  return { targetR, maxBars, n, net, exp: net / n, win: w.length / n, aw: gw / (w.length || 1), al: -gl / (l.length || 1), pf: gl ? gw / gl : Infinity, dd, top10: net > 0 ? top10 / net : 0,
    noTop10: net - top10, hit: why('target'), stop: why('stop'), time: why('time'), avgDays: T.reduce((a, t) => a + t.bars, 0) / n * 4 / 24, yrsUp: Object.values(byY).filter((v) => v > 0).length, yrs: Object.keys(byY).length,
    coinsUp: Object.values(per).filter((v) => v > 0).length, fresh, worst, per, byY };
}
const f = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d), lab = (t) => (t ? `${t}R` : 'none');
const rows = TARGETS.map((t) => run(t, 48));
console.log('BB-Core fixed target sweep, time exit locked at 48 (held 49 candles). 5 coins, Binance 4h, real funding, costs in.\n');
console.log('target  trades  hit%  stop%  time%  win%   avg win  avg loss  expectancy  total R   PF    maxDD R  top10%  w/o 10 best  worst yr drop  fresh P10k@2.5%  yrs+  coins+');
for (const r of rows) console.log(`${lab(r.targetR).padStart(6)}  ${String(r.n).padStart(6)}  ${(r.hit / r.n * 100).toFixed(0).padStart(3)}%  ${(r.stop / r.n * 100).toFixed(0).padStart(4)}%  ${(r.time / r.n * 100).toFixed(0).padStart(4)}%  ${(r.win * 100).toFixed(1).padStart(5)}  ${f(r.aw, 2).padStart(7)}  ${f(r.al, 2).padStart(8)}  ${f(r.exp, 3).padStart(10)}  ${f(r.net).padStart(8)}  ${r.pf.toFixed(2)}  ${r.dd.toFixed(1).padStart(7)}  ${(r.top10 * 100).toFixed(0).padStart(5)}%  ${f(r.noTop10).padStart(11)}  ${(r.worst * 100).toFixed(0).padStart(11)}%  ${Math.round(r.fresh).toLocaleString().padStart(15)}  ${r.yrsUp}/${r.yrs}  ${r.coinsUp}/5`);
console.log('\nper coin total R:'); console.log('target  ' + coins.map((c) => c.padStart(8)).join(''));
for (const r of rows) console.log(lab(r.targetR).padStart(6) + '  ' + coins.map((c) => f(r.per[c], 0).padStart(8)).join(''));
const ys = Object.keys(rows[0].byY).sort();
console.log('\nper year total R:'); console.log('target  ' + ys.map((y) => y.padStart(8)).join(''));
for (const r of rows) console.log(lab(r.targetR).padStart(6) + '  ' + ys.map((y) => f(r.byY[y] || 0, 0).padStart(8)).join(''));
console.log('\ntotal R: target (rows) x time exit in candles (columns); 48 is locked, the rest is to show the target choice does not hinge on it');
console.log('target  ' + HOLDS.map((h) => String(h).padStart(9)).join(''));
for (const t of TARGETS) console.log(lab(t).padStart(6) + '  ' + HOLDS.map((h) => f(h === 48 ? rows.find((r) => r.targetR === t).net : run(t, h).net).padStart(9)).join(''));
