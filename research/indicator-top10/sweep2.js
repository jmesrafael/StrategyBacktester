const fs = require('fs'); const { cfgRun } = require('./rstrat.js'); const { IND } = require('./indicators');
const PN = [20, 50, 100, 200], XP = [[10, 30], [20, 50], [21, 55], [50, 100], [50, 200]], res = [];
for (const name of Object.keys(IND)) for (const lo of [false, true]) for (const filt of [false, true]) for (const kI of [2, 3, 4]) for (const kT of [7, 10, 14, 20]) {
  for (const n of PN) res.push({ name, mode: 'P', p: [n], filt, lo, kI, kT }); for (const p of XP) res.push({ name, mode: 'X', p, filt, lo, kI, kT }); }
let k = 0; for (const r of res) { const o = cfgRun(r.name, r.mode, r.p, r.filt, r.lo, r.kI, r.kT); r.full = o.full; r.train = o.train; r.test = o.test; r.coins = o.coins; r.trades = undefined;
  r.yrs = (() => { const y = {}; for (const t of o.trades) { const Y = new Date(t.tExit * 1000).getUTCFullYear(); y[Y] = (y[Y] || 0) + t.R; } return y; })(); if (++k % 500 === 0) process.stdout.write('\r' + k + '/' + res.length); }
fs.writeFileSync('results-R2.json', JSON.stringify(res)); console.log('\ndone', res.length);
