// flat-peso-per-year.js — ₱10,000 account each year, NOT compounding: every trade risks a flat 2.5% of the starting ₱10,000 (₱250).
// Profit per year = sum of R × ₱250, trades booked in their EXIT year (closing basis, section 11).
//   node flat-peso-per-year.js
'use strict';
const fs = require('fs'), path = require('path');
const BB = 'C:/Users/WEB.WEB-DEVPC1/Desktop/testing/Strat/bb-core';
const { backtest } = require(BB + '/lucidio-core.js');
const DATA = path.join(BB, 'data');
const coins = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const START = 10000, RISK = 0.025, PER_R = START * RISK;
const read = (c) => { const f = path.join(DATA, 'funding', c + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const yr = (t) => new Date(t * 1000).getUTCFullYear();
const run = (cfg) => { const all = []; for (const coin of coins) { const B = JSON.parse(fs.readFileSync(path.join(DATA, coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })); all.push(...backtest(B, cfg, read(coin)).trades); } return all; };
const ys = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const res = {};
for (const [name, cfg] of [['BB 1:4', { targetR: 4 }], ['BB no-target', { targetR: 0 }]]) {
  const t = run(cfg); res[name] = {};
  for (const y of ys) { const a = t.filter((x) => yr(x.tExit) === y); const R = a.reduce((s, x) => s + x.R, 0); res[name][y] = { n: a.length, pesos: R * PER_R, R }; }
  res[name].total = Object.values(res[name]).reduce((s, v) => s + (v.pesos || 0), 0);
}
const peso = (v) => (v < 0 ? '-₱' : '+₱') + Math.round(Math.abs(v)).toLocaleString('en-US');
console.log(`₱10,000 each year, flat ₱${PER_R} per trade (2.5%), no compounding, by exit year`);
console.log('year   | BB 1:4: trades  profit   | BB no-target: trades  profit');
for (const y of ys) console.log(`${y}   | ${String(res['BB 1:4'][y].n).padStart(5)}  ${peso(res['BB 1:4'][y].pesos).padStart(9)} | ${String(res['BB no-target'][y].n).padStart(5)}  ${peso(res['BB no-target'][y].pesos).padStart(9)}`);
console.log(`total  |       ${peso(res['BB 1:4'].total).padStart(9)} |         ${peso(res['BB no-target'].total).padStart(9)}`);
