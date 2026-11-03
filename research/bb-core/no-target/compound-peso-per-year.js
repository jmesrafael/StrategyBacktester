// compound-peso-per-year.js — the ₱10,000 account at 2.5% risk, COMPOUNDING (risk = 2.5% of the realized balance at entry, PnL booked at exit).
//   A) a fresh ₱10,000 each year, compounding inside that year (trades booked by EXIT year, as in section 11)
//   B) one ₱10,000 account from 2020 compounding through Oct 2026 (drawdown from peak)
//   node compound-peso-per-year.js
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
// compounding account: trades in entry order; risk = RISK × balance realized by the entry time; pnl booked at exit
function account(trades, start) {
  const ts = [...trades].sort((a, b) => a.t - b.t || a.tExit - b.tExit);
  let booked = [], bal = start, pk = start, dd = 0;
  const done = [];                    // [exitTime, pnl]
  for (const t of ts) {
    // realized balance at this entry = start + every trade already closed by now
    let real = start; for (const [te, p] of done) if (te <= t.t) real += p;
    const pnl = t.R * RISK * real;
    done.push([t.tExit, pnl]);
  }
  // equity curve by exit time for drawdown + end balance
  const ev = done.slice().sort((a, b) => a[0] - b[0]);
  for (const [, p] of ev) { bal += p; pk = Math.max(pk, bal); dd = Math.max(dd, (pk - bal) / pk); }
  return { end: bal, dd, pnl: done.map((d) => d[1]) };
}
const ys = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const peso = (v) => (v < 0 ? '-₱' : '+₱') + Math.round(Math.abs(v)).toLocaleString('en-US');
const out = {};
for (const [name, cfg] of [['BB 1:4', { targetR: 4 }], ['BB no-target', { targetR: 0 }]]) {
  const t = run(cfg); out[name] = { yearly: {}, whole: null };
  for (const y of ys) {
    const sub = t.filter((x) => yr(x.tExit) === y);
    const a = account(sub, START);
    out[name].yearly[y] = { n: sub.length, profit: a.end - START, dd: a.dd };
  }
  out[name].whole = account(t, START);
}
console.log('A) fresh ₱10,000 each year, 2.5% of realized balance per trade, compounding within the year (trades by exit year)');
console.log('year   | BB 1:4 profit (dd)        | BB no-target profit (dd)');
let tot = { '1:4': 0, nt: 0 };
for (const y of ys) {
  const a = out['BB 1:4'].yearly[y], b = out['BB no-target'].yearly[y];
  tot['1:4'] += a.profit; tot.nt += b.profit;
  console.log(`${y}   | ${peso(a.profit).padStart(10)} (${(a.dd * 100).toFixed(0)}%)`.padEnd(30) + `| ${peso(b.profit).padStart(10)} (${(b.dd * 100).toFixed(0)}%)`);
}
console.log(`sum    | ${peso(tot['1:4']).padStart(10)}${''.padEnd(16)}| ${peso(tot.nt).padStart(10)}`);
console.log('\nB) ONE ₱10,000 account from 2020, compounding through Oct 2026');
for (const name of ['BB 1:4', 'BB no-target']) { const w = out[name].whole; console.log(`${name.padEnd(14)} end ${peso(w.end)}  (max drop from peak ${(w.dd * 100).toFixed(1)}%)`); }
