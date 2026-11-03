// monthly-deposit-peso.js — ONE ₱10,000 account from 1 Jan 2020, ₱DEPOSIT (default 2,000) added on the 1st of every month from Feb 2020.
//   Sizing as section 15: risk = 2.5% of the balance on 1 January of the trade's ENTRY year, fixed all year.
//   Deposits made during a year are counted in the balance from the next 1 January (they are not risked until then).
//   PnL booked at exit; profit grouped by exit year (section 11). Drawdown = deepest fall of the equity (deposits included) from its peak.
//   node monthly-deposit-peso.js            (DEPOSIT=2000 default; DEPOSIT=0 reproduces the no-deposit account)
'use strict';
const fs = require('fs'), path = require('path');
const BB = 'C:/Users/WEB.WEB-DEVPC1/Desktop/testing/Strat/bb-core';
const { backtest } = require(BB + '/lucidio-core.js');
const DATA = path.join(BB, 'data');
const coins = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const START = +(process.env.START || 10000), RISK = +(process.env.RISK || 0.025), DEPOSIT = +(process.env.DEPOSIT || 2000);
const read = (c) => { const f = path.join(DATA, 'funding', c + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const yr = (t) => new Date(t * 1000).getUTCFullYear();
const run = (cfg) => { const all = []; for (const coin of coins) { const B = JSON.parse(fs.readFileSync(path.join(DATA, coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })); all.push(...backtest(B, cfg, read(coin)).trades); } return all; };
const ys = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const monthStarts = [];                       // 1st of every month Feb 2020 .. Oct 2026
for (let y = 2020; y <= 2026; y++) for (let m = 0; m < 12; m++) { if (y === 2020 && m === 0) continue; if (y === 2026 && m > 9) break; monthStarts.push(Date.UTC(y, m, 1) / 1000); }
const deposits = monthStarts.map((t) => [t, DEPOSIT]);
const peso = (v) => (v < 0 ? '-₱' : '+₱') + Math.round(Math.abs(v)).toLocaleString('en-US');

function simulate(trades) {
  // sizing pass: balance on each 1 January = START + all deposits before it + PnL of trades closed before it
  const booked = [];                          // [exitTime, pnl]
  const jan = {};
  for (const y of ys) {
    const j1 = Date.UTC(y, 0, 1) / 1000;
    const dep = deposits.filter(([t]) => t < j1).reduce((s, [, a]) => s + a, 0);
    const pnlClosed = booked.filter(([te]) => te < j1).reduce((s, [, p]) => s + p, 0);
    jan[y] = START + dep + pnlClosed;
    const risk = RISK * jan[y];
    for (const t of trades.filter((x) => yr(x.t) === y)) booked.push([t.tExit, t.R * risk]);
  }
  // equity timeline: deposits + realized PnL, in time order
  const ev = [...deposits.map(([t, a]) => [t, a, 'dep']), ...booked.map(([t, p]) => [t, p, 'pnl'])].sort((a, b) => a[0] - b[0]);
  let eq = START, pk = START, dd = {}, prof = {}, cnt = {}, dep = {};
  for (const [t, a, k] of ev) {
    const y = yr(t);
    eq += a; pk = Math.max(pk, eq);
    dd[y] = Math.max(dd[y] || 0, (pk - eq) / pk);
    if (k === 'pnl') { prof[y] = (prof[y] || 0) + a; cnt[y] = (cnt[y] || 0) + 1; } else dep[y] = (dep[y] || 0) + a;
  }
  const put = START + deposits.reduce((s, [, a]) => s + a, 0);
  return { jan, prof, cnt, dd, dep, end: eq, put };
}
const out = {};
for (const [name, cfg] of [['BB 1:4', { targetR: 4 }], ['BB no-target', { targetR: 0 }]]) out[name] = simulate(run(cfg));
console.log(`₱${START} on 1 Jan 2020, +₱${DEPOSIT} on the 1st of every month from Feb 2020; risk ${(RISK * 100).toFixed(1)}% of the 1 January balance, fixed all year`);
console.log('year   | 1 Jan balance | deposits in year | BB 1:4 profit (trades, dd)     | BB no-target profit (trades, dd)');
for (const y of ys) {
  const a = out['BB 1:4'], b = out['BB no-target'];
  console.log(`${y}   | ${peso(a.jan[y]).padStart(13)} | ${peso(a.dep[y] || 0).padStart(16)} | ${peso(a.prof[y] || 0).padStart(13)} (${String(a.cnt[y] || 0).padStart(3)}, ${((a.dd[y] || 0) * 100).toFixed(0)}%) | ${peso(b.prof[y] || 0).padStart(13)} (${String(b.cnt[y] || 0).padStart(3)}, ${((b.dd[y] || 0) * 100).toFixed(0)}%)`);
}
for (const name of Object.keys(out)) { const o = out[name]; console.log(`${name.padEnd(14)} end balance ${peso(o.end)}  (money put in ${peso(o.put)}, profit ${peso(o.end - o.put)})`); }
