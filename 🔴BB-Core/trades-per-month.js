// trades-per-month.js: how many trades the strategy takes in each calendar month, from the bot's own backtest (lucidio-core.js, unchanged) on the stored 4h history.
// Read-only: it changes nothing and needs no network. A trade belongs to the month (UTC) of its ENTRY candle.
//   node trades-per-month.js [SOL,ZEC] [--csv out.csv]
// Uses data/<COIN>.json (Binance history, the longest) with the funding history the bot's backtest uses; the month grid is printed per coin and for both coins together.
'use strict';
const fs = require('fs'), path = require('path');
const { backtest } = require('./lucidio-core.js');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--')), csvOut = process.argv.includes('--csv') ? process.argv[process.argv.indexOf('--csv') + 1] : null;
const COINS = (args[0] || 'SOL,ZEC').split(','), DATA = path.join(__dirname, 'data');
const loadFunding = (coin) => { const f = path.join(DATA, 'funding', coin + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const byCoin = {}, span = {};
for (const coin of COINS) {
  const B = JSON.parse(fs.readFileSync(path.join(DATA, coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const r = backtest(B, {}, loadFunding(coin)), trades = r.trades.map((t) => ({ t: t.t, R: t.R })).concat(r.open ? [{ t: r.open.t, R: null }] : []);
  byCoin[coin] = trades; span[coin] = [B[0].time, B[B.length - 1].time];
}
const key = (sec) => { const d = new Date(sec * 1000); return [d.getUTCFullYear(), d.getUTCMonth()]; };
const grid = (list) => { const g = {}; for (const t of list) { const [y, m] = key(t.t); (g[y] = g[y] || Array(12).fill(0))[m]++; } return g; };
const years = (g) => Object.keys(g).map(Number).sort((a, b) => a - b);
function show(title, list, from, to) {
  const g = grid(list), ys = years(g), fy = new Date(from * 1000).getUTCFullYear(), ly = new Date(to * 1000).getUTCFullYear(), fm = new Date(from * 1000).getUTCMonth(), lm = new Date(to * 1000).getUTCMonth();
  console.log(`\n${title}  (${list.length} trades)`); console.log('Year ' + MON.map((m) => m.padStart(4)).join('') + '  Total');
  for (let y = fy; y <= ly; y++) {
    const row = g[y] || Array(12).fill(0);
    // months outside the data (before the first candle, after the last) are shown as "-" and not counted as zero
    const cells = row.map((n, m) => ((y === fy && m < fm) || (y === ly && m > lm) ? '   -' : String(n).padStart(4)));
    console.log(`${y} ${cells.join('')}  ${String(row.reduce((a, b) => a + b, 0)).padStart(5)}`);
  }
  const months = []; for (let y = fy; y <= ly; y++) for (let m = (y === fy ? fm : 0); m <= (y === ly ? lm : 11); m++) months.push((g[y] || Array(12).fill(0))[m]);
  const sorted = [...months].sort((a, b) => a - b), avg = months.reduce((a, b) => a + b, 0) / months.length;
  console.log(`months covered ${months.length} | average ${avg.toFixed(1)} per month | median ${sorted[Math.floor(sorted.length / 2)]} | most ${sorted[sorted.length - 1]} | fewest ${sorted[0]} | months with none ${months.filter((n) => n === 0).length}`);
  return { months, avg };
}
const all = COINS.flatMap((c) => byCoin[c]), from = Math.min(...COINS.map((c) => span[c][0])), to = Math.max(...COINS.map((c) => span[c][1]));
for (const c of COINS) show(`${c}  data ${new Date(span[c][0] * 1000).toISOString().slice(0, 10)} to ${new Date(span[c][1] * 1000).toISOString().slice(0, 10)}`, byCoin[c], span[c][0], span[c][1]);
show(`BOTH COINS together  data ${new Date(from * 1000).toISOString().slice(0, 10)} to ${new Date(to * 1000).toISOString().slice(0, 10)}`, all, from, to);
if (csvOut) {
  const rows = ['month,' + COINS.join(',') + ',total']; const gs = Object.fromEntries(COINS.map((c) => [c, grid(byCoin[c])]));
  for (let y = new Date(from * 1000).getUTCFullYear(); y <= new Date(to * 1000).getUTCFullYear(); y++) for (let m = 0; m < 12; m++) {
    const n = COINS.map((c) => (gs[c][y] || [])[m] || 0); rows.push(`${y}-${String(m + 1).padStart(2, '0')},${n.join(',')},${n.reduce((a, b) => a + b, 0)}`);
  }
  fs.writeFileSync(csvOut, rows.join('\n') + '\n'); console.log('\nwritten: ' + csvOut);
}
