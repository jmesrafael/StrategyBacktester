// monthly-tp-vs-notarget.js — BB-Core fixed 1:4 target vs no target, month by month, by EXIT month (closing basis, as in section 11).
//   node monthly-tp-vs-notarget.js  > out-monthly-tp-vs-notarget.txt
// Every coin runs independently with $5 risk per trade; the merged line pools all five coins' trades in that month.
'use strict';
const fs = require('fs'), path = require('path');
const BB = 'C:/Users/WEB.WEB-DEVPC1/Desktop/testing/Strat/bb-core';
const { backtest, stats } = require(BB + '/lucidio-core.js');
const DATA = path.join(BB, 'data');
const coins = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const RISK = 5;
const read = (c) => { const f = path.join(DATA, 'funding', c + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
const run = (cfg) => {
  const per = {}, all = [];
  for (const coin of coins) {
    const B = JSON.parse(fs.readFileSync(path.join(DATA, coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
    per[coin] = backtest(B, cfg, read(coin)).trades;
    all.push(...per[coin]);
  }
  return { per, all };
};
const fixed = run({ targetR: 4 }), notgt = run({ targetR: 0 });
const months = [...new Set([...fixed.all, ...notgt.all].map((t) => ym(t.tExit)))].sort();
const summ = (arr) => {
  const R = arr.reduce((a, t) => a + t.R, 0), wins = arr.filter((t) => t.R > 0).length;
  return { n: arr.length, R, usd: R * RISK, wins, best: arr.length ? Math.max(...arr.map((t) => t.R)) : 0, worst: arr.length ? Math.min(...arr.map((t) => t.R)) : 0 };
};
const monthOf = (arr, m) => arr.filter((t) => ym(t.tExit) === m);
const money = (v) => (v < 0 ? '-$' : '+$') + Math.abs(v).toFixed(0);
const rr = (v) => (v < 0 ? '' : '+') + v.toFixed(1) + 'R';
console.log('Month   | FIXED 1:4: trades  merged net   R     coin trades (S/Z/N/A/G)  | NO TARGET: trades  merged net   R     coin trades (S/Z/N/A/G)  | better');
const tot = { f: 0, g: 0, fn: 0, gn: 0 };
const rows = [];
for (const m of months) {
  const f = summ(monthOf(fixed.all, m)), g = summ(monthOf(notgt.all, m));
  const fc = coins.map((c) => monthOf(fixed.per[c], m).length).join('/');
  const gc = coins.map((c) => monthOf(notgt.per[c], m).length).join('/');
  const better = f.usd === g.usd ? 'tie' : f.usd > g.usd ? 'fixed' : 'no target';
  tot.f += f.usd; tot.g += g.usd; tot.fn += f.n; tot.gn += g.n;
  rows.push({ m, f, g, fc, gc, better });
  console.log(`${m} | ${String(f.n).padStart(3)}  ${money(f.usd).padStart(8)}  ${rr(f.R).padStart(7)}  ${fc.padEnd(20)} | ${String(g.n).padStart(3)}  ${money(g.usd).padStart(8)}  ${rr(g.R).padStart(7)}  ${gc.padEnd(20)} | ${better}`);
}
console.log(`TOTAL: fixed ${tot.fn} trades ${money(tot.f)} | no target ${tot.gn} trades ${money(tot.gn ? tot.g : 0)}`);
const wins = { fixed: rows.filter((r) => r.better === 'fixed').length, 'no target': rows.filter((r) => r.better === 'no target').length, tie: rows.filter((r) => r.better === 'tie').length };
console.log('months won: ' + JSON.stringify(wins) + ' of ' + rows.length);
console.log('\nPer-coin monthly-level check (no target): months with a loss, by coin:');
for (const c of coins) {
  const ms = [...new Set(notgt.per[c].map((t) => ym(t.tExit)))].sort();
  const losing = ms.filter((m) => summ(monthOf(notgt.per[c], m)).usd < 0).length;
  console.log(`  ${c}: ${ms.length} active months, ${losing} losing`);
}
module.exports = { rows, tot, wins };
