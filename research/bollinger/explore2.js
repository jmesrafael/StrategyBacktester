// explore2.js — phase 2: one-factor-at-a-time sensitivity of the squeeze breakout, TRAIN data only (entries before 2023-01-01).
// For each timeframe: a base setting, then every parameter varied alone. A real edge shows as a plateau (neighbours also work).
// usage: node explore2.js
const L = require('./lib.js'), F = require('./fam.js');
const COINS = ['BTC', 'ETH', 'SOL'], END = L.ts(2023);
const BASE = { n: 20, k: 2, look: 100, pct: 0.25, recent: 10, stop: 'mid', tp: 3, trailATR: 0, trendN: 0, beR: 0, maxBars: 0 };
const SWEEP = { n: [14, 20, 30, 40], k: [1.5, 2, 2.5, 3], look: [50, 100, 200], pct: [0.1, 0.15, 0.25, 0.35, 0.5], recent: [1, 3, 6, 10, 20],
  stop: ['mid', 1, 1.5, 2, 3], tp: [1.5, 2, 3, 4, 5], trendN: [0, 50, 100, 200], beR: [0, 1], maxBars: [0, 12, 24, 48] };
const line = (name, c) => {
  const per = {}, all = [];
  for (const s of COINS) { const tr = L.slice(F.sq(s, c), 0, END); per[s] = L.stats(tr); all.push(...tr); }
  const p = L.stats(all);
  const yrs = [2019, 2020, 2021, 2022].map((y) => L.sum(L.slice(all, L.ts(y), L.ts(y + 1)).map((t) => t.R)));
  return `${name.padEnd(14)} n=${String(p.n).padStart(4)} sum=${L.f2(p.sum).padStart(7)} avg=${L.f2(p.avg)} t=${p.t.toFixed(2).padStart(5)} PF=${p.pf.toFixed(2)} dd=${p.dd.toFixed(1).padStart(4)} | ` +
    COINS.map((s) => `${s} ${L.f2(per[s].sum)}`).join(' ') + ' | yr19-22 ' + yrs.map(L.f2).join(' ');
};
for (const tf of [60, 120, 240]) {
  console.log(`\n######## timeframe ${tf}m  (train: entries < 2023-01-01; BTC/ETH from 2019, SOL from late 2020)`);
  const base = { ...BASE, tf };
  console.log(line('BASE', base));
  for (const [key, vals] of Object.entries(SWEEP)) {
    console.log(`-- ${key}`);
    for (const v of vals) { if (v === base[key]) continue; console.log('  ' + line(`${key}=${v}`, { ...base, [key]: v })); }
  }
}
