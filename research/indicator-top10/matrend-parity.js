// matrend-parity.js — js/matrend-core.js (the analysis page's engine) vs the research batch run (rstrat.js): same trades?
process.env.COINS = 'SOL,ZEC,NEAR,ADA,GALA,BTC,ETH';
const fs = require('fs'), R = require('./rstrat.js'), MT = require('../../js/matrend-core.js');
const T = [['SMA', 1, 200, 14, 1, 2], ['VWMA', 4, 200, 14, 1, 2], ['HMA', 6, 20, 14, 1, 2], ['KAMA', 9, 100, 20, 0, 2], ['EMA', 2, 50, 10, 0, 3], ['DEMA', 7, 20, 14, 1, 2]];
let tot = 0, bad = 0;
for (const [nm, kind, len, kT, lo, kI] of T) { let n = 0, b = 0, md = 0;
  for (const c of R.COINS) { const B = JSON.parse(fs.readFileSync(`data4h/${c}.json`)).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
    const a = MT.backtest(B, { maKind: kind, maLen: len, kInit: kI, kTrail: kT, longOnly: lo, trendLen: 200 }).trades, r = R.sim(c, R.events(nm, c, 'P', [len], true, !!lo), kI, kT, 600, 'close', 'nextOpen');
    n += a.length; if (a.length !== r.length) b += Math.abs(a.length - r.length);
    for (let k = 0; k < Math.min(a.length, r.length); k++) { const d = Math.abs(a[k].R - r[k].R); md = Math.max(md, d); if (a[k].t !== r[k].t || a[k].tExit !== r[k].tExit || d > 1e-4) b++; } }
  console.log(`${nm.padEnd(5)} len ${len} trail ${kT} ${lo ? 'long-only' : 'both'}: ${n} trades, ${b} mismatches vs research batch, max |R diff| ${md.toExponential(1)}`); tot += n; bad += b; }
console.log(`PARITY: ${tot} trades, ${bad} mismatches`);
