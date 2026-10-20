// explore1.js — phase 1: coarse grid of both families on TRAIN data only (trades entered before 2023-01-01).
// 2023-01 onwards is held out and not looked at here. usage: node explore1.js
const L = require('./lib.js'), F = require('./fam.js'), fs = require('fs');
const COINS = ['BTC', 'ETH', 'SOL'], TRAIN_END = L.ts(2023);
const cfgs = [];
for (const tf of [15, 60, 240]) for (const n of [20, 40]) for (const k of [2, 2.5, 3]) for (const mode of ['touch', 'reentry'])
  for (const adxMax of [0, 25]) for (const stopATR of [1.5, 2.5]) for (const tp of ['mid', 1.5]) for (const maxBars of [12, 48])
    cfgs.push({ fam: 'mr', tf, n, k, mode, adxMax, stopATR, tp, minRR: 0.5, maxBars });
for (const tf of [15, 60, 240]) for (const k of [2, 2.5]) for (const pct of [0.1, 0.25]) for (const recent of [3, 10])
  for (const stop of ['mid', 2]) for (const tp of [2, 3, 0]) for (const trailATR of (tp ? [0] : [2, 3]))
    cfgs.push({ fam: 'sq', tf, n: 20, k, look: 100, pct, recent, stop, tp, trailATR, maxBars: 0 });

const rows = [];
let done = 0;
for (const c of cfgs) {
  const per = {};
  let all = [];
  for (const sym of COINS) {
    const tr = L.slice(F[c.fam](sym, c), 0, TRAIN_END);
    per[sym] = L.stats(tr); all = all.concat(tr);
  }
  const pool = L.stats(all);
  rows.push({ c, per, pool, pos: COINS.filter((s) => per[s].n >= 10 && per[s].sum > 0).length });
  if (++done % 100 === 0) process.stderr.write(`${done}/${cfgs.length}\n`);
}
fs.writeFileSync(__dirname + '/results-explore1.json', JSON.stringify(rows));
const show = (r) => `${r.c.fam} ${JSON.stringify({ ...r.c, fam: undefined, minRR: undefined })} | n=${r.pool.n} sum=${L.f2(r.pool.sum)} avg=${L.f2(r.pool.avg)} t=${r.pool.t.toFixed(2)} PF=${r.pool.pf.toFixed(2)} | ` +
  COINS.map((s) => `${s} ${r.per[s].n}:${L.f2(r.per[s].sum)}`).join(' ');
for (const fam of ['mr', 'sq']) {
  const f = rows.filter((r) => r.c.fam === fam);
  console.log(`\n=== ${fam}: ${f.length} configs. Profitable in train: ${f.filter((r) => r.pool.sum > 0).length}; all 3 coins positive: ${f.filter((r) => r.pos === 3).length}`);
  console.log('median pooled avg R/trade:', L.f2(f.map((r) => r.pool.avg).sort((a, b) => a - b)[Math.floor(f.length / 2)]));
  console.log('top 12 by pooled t-stat (min 60 trades):');
  f.filter((r) => r.pool.n >= 60).sort((a, b) => b.pool.t - a.pool.t).slice(0, 12).forEach((r) => console.log('  ' + show(r)));
}
