// batch1h.js — 1-HOUR timeframe search, 7 coins, 2019/2020 -> Nov 2026. Same engine/costs as the 4h tests (funding scaled to 1h), signal on closed bar, fill next open.
// Lengths are given at 4h-equivalent x4 plus some native 1h lengths. Trend filter = SMA(800 x 1h = 200 x 4h). Time exit 2400 bars (= 600 x 4h = 100 days).
process.env.IV = '3600'; process.env.TREND = '800'; process.env.COINS = process.env.COINS || 'SOL,ZEC,NEAR,ADA,GALA,BTC,ETH';
const fs = require('fs'); process.env.DATADIR = 'data1h';
const { sim, COINS, D, SPLIT } = require('./rstrat.js'); const { IND2 } = require('./batch2.js'); const { account } = require('./baseline');
const isn = Number.isNaN;
const CFG = [];
for (const n of [80, 200, 400, 24, 48]) CFG.push(['Donchian', 'n' + n, [n]]);
for (const [n, m] of [[80, 2], [200, 3], [400, 3], [20, 2], [50, 3]]) CFG.push(['Keltner', `ema${n}x${m}`, [n, m]]);
for (const [p, x, q] of [[40, 1, 36], [80, 2, 72], [160, 2, 144], [10, 1, 9]]) CFG.push(['CKSP', `${p}-${x}-${q}`, [p, x, q]]);
for (const [f, s, g] of [[32, 68, 36], [48, 104, 72], [8, 17, 9], [12, 26, 9]]) for (const md of ['sig', 'sigpos']) CFG.push(['MACD', `${f}-${s}-${g}${md}`, [f, s, g, md]]);
for (const n of [60, 120]) for (const md of ['zero', 'sig']) CFG.push(['TRIX', `n${n}${md}`, [n, md]]);
for (const n of [80, 200, 400, 20, 50]) CFG.push(['ZLEMA', 'n' + n, [n]]);
for (const n of [80, 200]) CFG.push(['LSMA', 'n' + n, [n]], ['McGinley', 'n' + n, [n]]);
for (const [n, m] of [[28, 3], [40, 3], [10, 3], [28, 4]]) CFG.push(['Supertrend', `atr${n}x${m}`, [n, m]]);
for (const n of [56, 84, 14, 28]) CFG.push(['Vortex', 'n' + n, [n]]);
for (const n of [100, 200, 25, 50]) CFG.push(['Aroon', 'n' + n, [n]]);
for (const [s, x] of [[.02, .2], [.005, .05]]) CFG.push(['PSAR', `step${s}`, [s, x]]);
CFG.push(['TSI', '100-50', [100, 50]], ['TSI', '25-13', [25, 13]], ['Squeeze', 'n80', [80]], ['Squeeze', 'n20', [20]], ['Chandelier', 'n88x3', [88, 3]], ['Chandelier', 'n200x5', [200, 5]], ['DMI', 'n56adx25', [56, 25]], ['DMI', 'n14adx25', [14, 25]]);
function eventsFor(ind, args, c, filt) { const d = D[c], ev = IND2[ind](d, ...args), C = d.C; return ev.map((s, i) => s && (!filt || (!isn(d.S200[i]) && C[i] > d.S200[i])) ? 1 : 0); }
function run(ind, args, filt, kI, kT) { const all = []; for (const c of COINS) all.push(...sim(c, eventsFor(ind, args, c, filt), kI, kT, 2400, 'open', 'nextOpen'));
  return { full: account(all), train: account(all, .025, 0, SPLIT), test: account(all, .025, SPLIT), trades: all }; }
module.exports = { run, CFG, eventsFor };
if (require.main === module) { const res = []; let k = 0; const tot = CFG.length * 12;
  for (const [ind, lab, args] of CFG) for (const filt of [false, true]) for (const kI of [2, 3]) for (const kT of [10, 20, 30]) { const r = run(ind, args, filt, kI, kT); res.push({ ind, lab, filt, kI, kT, full: r.full, train: r.train, test: r.test }); if (++k % 40 === 0) process.stdout.write(`\r${k}/${tot}`); }
  fs.writeFileSync('results-1H.json', JSON.stringify(res)); console.log('\ndone', res.length); }
