// validate.js — proves the new engine reproduces the live bots' real cores before any new strategy is trusted.
'use strict';
const path = require('path');
const { load, COINS } = require('./data.js'), { run, stats } = require('./engine.js'), { S, makeCtx, exitOf } = require('./strategies.js');
const bbCore = require(path.join(__dirname, '..', '..', '..', 'bb-core', 'lucidio-core.js'));
const iCore = require(path.join(__dirname, '..', '..', '..', 'i-core', 'icore-core.js'));
const ZERO = { fee: 0, slip: 0 };
const by = (id) => S.find((s) => s.id === id);

function cmp(label, mine, theirs) {
  let mism = 0, maxR = 0; const n = Math.min(mine.length, theirs.length);
  for (let j = 0; j < n; j++) { const a = mine[j], b = theirs[j]; if (a.i0 !== b.i0 || a.i1 !== b.i1 || a.dir !== b.dir) mism++; else maxR = Math.max(maxR, Math.abs(a.R - b.R)); }
  console.log(`${label.padEnd(26)} trades mine ${String(mine.length).padStart(4)} / real ${String(theirs.length).padStart(4)} | entry-exit-direction mismatches ${mism} | max |R diff| on matching trades ${maxR.toExponential(1)}`);
}
console.log('=== A) ZERO costs, 4h, per coin: same trades as the real cores? ===');
for (const coin of COINS) {
  const { B, iv } = load(coin, '4h'), c = makeCtx(B, '4h');
  const m1 = run(B, c.atr14, by('bb-core').build(c), exitOf('BBX', c), null, iv, ZERO).trades;
  const t1 = bbCore.backtest(B, { cost: bbCore.FREE }, null).trades;
  cmp('bb-core ' + coin, m1, t1);
  const m2 = run(B, c.atr14, by('i-core').build(c), exitOf('P7', c), null, iv, ZERO).trades;
  const t2 = iCore.backtest(B, { cost: iCore.FREE }).trades;
  cmp('i-core  ' + coin, m2, t2);
}
console.log('\n=== B) REAL costs + funding, 4h: totals (R) mine vs the real core ===');
let tm1 = 0, tt1 = 0, tm2 = 0, tt2 = 0;
for (const coin of COINS) {
  const { B, iv, funding } = load(coin, '4h'), c = makeCtx(B, '4h');
  const a = stats(run(B, c.atr14, by('bb-core').build(c), exitOf('BBX', c), funding, iv).trades), b = stats(bbCore.backtest(B, {}, funding).trades.map((t) => ({ ...t })));
  const d = stats(run(B, c.atr14, by('i-core').build(c), exitOf('P7', c), funding, iv).trades), e = iCore.stats(iCore.backtest(B, {}).trades, 1);
  console.log(`${coin.padEnd(5)} bb-core mine ${a.total.toFixed(1)}R (${a.n}) vs real ${b.total.toFixed(1)}R (${b.n})   | i-core mine ${d.total.toFixed(1)}R (${d.n}) vs real ${e.net.toFixed(1)}R (${e.n})  [i-core real uses a flat 0.005%/candle funding, mine the real funding]`);
  tm1 += a.total; tt1 += b.total; tm2 += d.total; tt2 += e.net;
}
console.log(`TOTAL bb-core mine ${tm1.toFixed(1)}R vs real ${tt1.toFixed(1)}R | i-core mine ${tm2.toFixed(1)}R vs real ${tt2.toFixed(1)}R`);
