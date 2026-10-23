// c2-decision.js — evidence for C2 (49 vs 48 candles held): same engine, maxBars 48 (= 49 candles in the trade, current) vs 47 (= exactly 48 candles).
'use strict';
const fs = require('fs'), path = require('path');
const { backtest } = require('../lucidio-core.js');
const D = path.join(__dirname, '..', 'data'), rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
for (const c of ['SOL', 'ZEC', 'MEXC_SOL', 'MEXC_ZEC']) {
  const B = rd(c + '.json').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  let F = fs.existsSync(path.join(D, 'funding', c + '.json')) ? rd('funding/' + c + '.json') : null;
  if (c.startsWith('MEXC_')) { const bin = rd('funding/' + c.slice(5) + '.json'); F = [...bin.filter((r) => r[0] < F[0][0]), ...F]; }
  const out = [];
  for (const mb of [48, 47]) {
    const tr = backtest(B, { maxBars: mb }, F).trades, R = tr.map((t) => t.R), time = tr.filter((t) => t.why === 'time');
    const held = time.map((t) => t.bars);
    out.push({ mb, n: tr.length, net: R.reduce((a, b) => a + b, 0), timeN: time.length, timeR: time.reduce((a, t) => a + t.R, 0), bars: held.length ? `${Math.min(...held)}..${Math.max(...held)} (incl. exit candle)` : '-' });
  }
  const [a, b] = out;
  console.log(`${c.padEnd(9)} maxBars=48 (49 candles held): n=${a.n} net=${a.net.toFixed(2)}R time-exits=${a.timeN} (${a.timeR.toFixed(1)}R) | maxBars=47 (48 held): n=${b.n} net=${b.net.toFixed(2)}R time-exits=${b.timeN} (${b.timeR.toFixed(1)}R) | difference ${(b.net - a.net).toFixed(2)}R, ${b.n - a.n} trades`);
}
