// verify-parity.js — v2 engine with every v2 option OFF must reproduce bb-core's lucidio-core.js trade for trade (READ-ONLY use of bb-core).
//   node verify-parity.js
'use strict';
const path = require('path');
const orig = require(path.join(__dirname, '..', '..', '..', 'bb-core', 'lucidio-core.js'));
const v2 = require('./v2-core.js');
const { COINS, loadCoin } = require('./load.js');

let bad = 0, total = 0;
for (const venue of ['binance', 'mexc']) for (const coin of COINS) for (const k of [1, 3]) {
  const { B, funding } = loadCoin(coin, venue);
  const cost = orig.scaleCost(orig.DEFAULTS.cost, k);
  const a = orig.backtest(B, { cost }, funding).trades, b = v2.backtest(B, { cost }, funding).trades;
  let diff = a.length !== b.length ? Infinity : 0;
  if (diff === 0) for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.i0 !== y.i0 || x.i1 !== y.i1 || x.why !== y.why || x.dir !== y.dir || Math.abs(x.R - y.R) > 1e-9 || Math.abs(x.entry - y.entry) > 1e-9) { diff++; }
  }
  total += a.length; if (diff) bad++;
  console.log(`${venue.padEnd(8)} ${coin.padEnd(5)} costs x${k}  bb-core ${String(a.length).padStart(4)} trades  v2 ${String(b.length).padStart(4)} trades  ${diff ? 'MISMATCH ' + diff : 'identical'}`);
}
console.log(bad ? `\nFAIL: ${bad} run(s) differ` : `\nPASS: v2 (options off) == bb-core, ${total} trades compared`);
process.exit(bad ? 1 : 0);
