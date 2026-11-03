// yearstart-compound-peso.js — ONE ₱10,000 account from 2020. Compounding only at the start of each year:
//   risk for every trade that ENTERS in year Y = 2.5% × the balance on 1 January of Y (fixed for the whole year).
//   The balance carries over, so the account compounds year to year. Trade PnL is booked at its exit.
//   Profit by exit year (section 11 basis). Max drop = deepest fall from the peak inside the year.
//   node yearstart-compound-peso.js
'use strict';
const fs = require('fs'), path = require('path');
const BB = 'C:/Users/WEB.WEB-DEVPC1/Desktop/testing/Strat/bb-core';
const { backtest } = require(BB + '/lucidio-core.js');
const DATA = path.join(BB, 'data');
const coins = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const START = 10000, RISK = 0.025;
const read = (c) => { const f = path.join(DATA, 'funding', c + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const yr = (t) => new Date(t * 1000).getUTCFullYear();
const run = (cfg) => { const all = []; for (const coin of coins) { const B = JSON.parse(fs.readFileSync(path.join(DATA, coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })); all.push(...backtest(B, cfg, read(coin)).trades); } return all; };
const ys = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const peso = (v) => (v < 0 ? '-₱' : '+₱') + Math.round(Math.abs(v)).toLocaleString('en-US');
function simulate(trades) {
  const booked = [];                                   // [exitTime, pnl]
  const bal = {};                                      // start-of-year balance
  const rows = {};
  for (const y of ys) {
    const jan1 = Date.UTC(y, 0, 1) / 1000;
    const start = START + booked.filter(([te]) => te < jan1).reduce((s, [, p]) => s + p, 0);   // trades CLOSED before 1 January
    bal[y] = start;
    const risk = RISK * start;                          // fixed for every trade entering this year
    for (const t of trades.filter((x) => yr(x.t) === y)) booked.push([t.tExit, t.R * risk]);
  }
  // equity by exit time for drawdown and per-exit-year profit
  const ev = booked.slice().sort((a, b) => a[0] - b[0]);
  let eq = START, pk = START;
  const dd = {}, prof = {}, cnt = {};
  for (const [te, p] of ev) {
    const y = yr(te);
    eq += p; pk = Math.max(pk, eq);
    prof[y] = (prof[y] || 0) + p; cnt[y] = (cnt[y] || 0) + 1;
    dd[y] = Math.max(dd[y] || 0, (pk - eq) / pk);
  }
  return { bal, prof, cnt, dd, end: eq, maxDD: 0 };
}
const out = {};
for (const [name, cfg] of [['BB 1:4', { targetR: 4 }], ['BB no-target', { targetR: 0 }]]) {
  const t = run(cfg);
  out[name] = simulate(t.filter((x) => x.t !== undefined));
}
console.log('ONE ₱10,000 account from 2020, risk = 2.5% of the balance on 1 January, fixed all year (compounds year to year)');
console.log('year   | start balance | BB 1:4 profit  (trades, dd)   | BB no-target profit (trades, dd)');
for (const y of ys) {
  const a = out['BB 1:4'], b = out['BB no-target'];
  console.log(`${y}   | ${peso(a.bal[y]).padStart(13)} | ${peso(a.prof[y] || 0).padStart(13)} (${String(a.cnt[y] || 0).padStart(3)}, ${((a.dd[y] || 0) * 100).toFixed(0)}%) | ${peso(b.prof[y] || 0).padStart(13)} (${String(b.cnt[y] || 0).padStart(3)}, ${((b.dd[y] || 0) * 100).toFixed(0)}%)`);
}
for (const name of Object.keys(out)) console.log(`${name.padEnd(14)} end balance ${peso(out[name].end)}`);
