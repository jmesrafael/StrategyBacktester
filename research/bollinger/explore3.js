// explore3.js — phase 3: 4h only, TRAIN data (entries < 2023-01-01). Does the squeeze matter? (pct 1 = no squeeze requirement)
// usage: node explore3.js
const L = require('./lib.js'), F = require('./fam.js');
const COINS = ['BTC', 'ETH', 'SOL'], END = L.ts(2023);
const rows = [];
for (const pct of [0.25, 0.5, 1]) for (const trendN of [0, 200]) for (const tp of [3, 4]) for (const maxBars of [0, 48]) for (const stop of ['mid', 3]) {
  const c = { tf: 240, n: 20, k: 2, look: 100, pct, recent: 10, stop, tp, trailATR: 0, trendN, beR: 0, maxBars };
  const per = {}, all = [];
  for (const s of COINS) { const tr = L.slice(F.sq(s, c), 0, END); per[s] = L.stats(tr); all.push(...tr); }
  rows.push({ c, p: L.stats(all), per });
}
const fmt = (r) => `pct=${String(r.c.pct).padEnd(4)} trend=${String(r.c.trendN).padEnd(3)} tp=${r.c.tp} maxBars=${String(r.c.maxBars).padEnd(2)} stop=${String(r.c.stop).padEnd(3)} | n=${String(r.p.n).padStart(3)} sum=${L.f2(r.p.sum).padStart(7)} avg=${L.f2(r.p.avg)} t=${r.p.t.toFixed(2)} PF=${r.p.pf.toFixed(2)} dd=${r.p.dd.toFixed(1)} | ` +
  COINS.map((s) => `${s} ${L.f2(r.per[s].sum)}`).join(' ');
rows.forEach((r) => console.log(fmt(r)));
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log('\nmean avg-R per trade by squeeze requirement (all other settings pooled):');
for (const pct of [0.25, 0.5, 1]) console.log(`  pct=${pct}${pct === 1 ? ' (NO squeeze)' : ''}: ${L.f2(avg(rows.filter((r) => r.c.pct === pct).map((r) => r.p.avg)))}  mean trades ${avg(rows.filter((r) => r.c.pct === pct).map((r) => r.p.n)).toFixed(0)}`);
console.log('mean avg-R per trade by trend filter:');
for (const t of [0, 200]) console.log(`  trendN=${t}: ${L.f2(avg(rows.filter((r) => r.c.trendN === t).map((r) => r.p.avg)))}`);
