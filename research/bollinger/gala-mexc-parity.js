// gala-mexc-parity.js — does MEXC's own GALA_USDT candle history produce the same BB-breakout entry signals as Binance's?
// Same check NEAR and ADA got before being added (see COIN-REGISTRY-bb-breakout.md, config.js comment in BB-Core).
// Frozen rule: 4h close beyond Bollinger(20,2) AND beyond the 200 SMA -> signal. Independently computed on each exchange's own candles
// (no cross-exchange data mixing), then aligned by candle time and compared from 2022-01-01 on (matches the "from 2022" wording used for NEAR).
// usage: node gala-mexc-parity.js
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const ctx = { Math, Array, Object, Number, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/indicators.js'), 'utf8') + '\n;this.IND = { sma, bollinger };', ctx);
const { sma, bollinger } = ctx.IND;

function load(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
}
const bin = load(path.join(__dirname, 'data4h/GALA.json'));
const mex = load(path.join(__dirname, 'datatf/4h/MEXC_GALA.json'));

// independent signal series per exchange: closed-candle only, no look-ahead
function signals(bars) {
  const closes = bars.map((b) => b.close);
  const bb = bollinger(closes, 20, 2), sma200 = sma(closes, 200);
  const out = new Map();
  for (let i = 0; i < bars.length; i++) {
    if (bb.upper[i] == null || sma200[i] == null) continue;
    const c = closes[i];
    let dir = 0;
    if (c > bb.upper[i] && c > sma200[i]) dir = 1;
    else if (c < bb.lower[i] && c < sma200[i]) dir = -1;
    if (dir) out.set(bars[i].time, dir);
  }
  return out;
}
const sBin = signals(bin), sMex = signals(mex);

const CUTOFF = Math.floor(new Date('2022-01-01T00:00:00Z').getTime() / 1000);
const times = new Set([...sBin.keys(), ...sMex.keys()].filter((t) => t >= CUTOFF));
// also need the set of candle times both exchanges actually have in the compared window, to report true negatives too
const binTimes = new Set(bin.map((b) => b.time).filter((t) => t >= CUTOFF));
const mexTimes = new Set(mex.map((b) => b.time).filter((t) => t >= CUTOFF));
const common = [...binTimes].filter((t) => mexTimes.has(t)).sort((a, b) => a - b);

let bothAgree = 0, bothSignal = 0, onlyBin = 0, onlyMex = 0, oppositeDir = 0, neitherSignal = 0;
const mismatches = [];
for (const t of common) {
  const a = sBin.get(t) || 0, b = sMex.get(t) || 0;
  if (a === 0 && b === 0) { neitherSignal++; continue; }
  bothSignal++;
  if (a === b) bothAgree++;
  else if (a !== 0 && b === 0) { onlyBin++; mismatches.push([t, 'onlyBinance', a]); }
  else if (a === 0 && b !== 0) { onlyMex++; mismatches.push([t, 'onlyMexc', b]); }
  else { oppositeDir++; mismatches.push([t, 'opposite', a, b]); }
}
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
console.log(`Binance GALA: ${bin.length} candles (${iso(bin[0].time)} -> ${iso(bin[bin.length - 1].time)})`);
console.log(`MEXC    GALA: ${mex.length} candles (${iso(mex[0].time)} -> ${iso(mex[mex.length - 1].time)})`);
console.log(`Common 4h candle times from 2022-01-01: ${common.length}`);
console.log(`Candles with no signal on either side: ${neitherSignal}`);
console.log(`Candles with a signal on at least one side: ${bothSignal}`);
console.log(`  same direction on both: ${bothAgree}`);
console.log(`  signal on Binance only: ${onlyBin}`);
console.log(`  signal on MEXC only:    ${onlyMex}`);
console.log(`  opposite direction:     ${oppositeDir}`);
console.log(`Agreement rate (of candles where either fired): ${(100 * bothAgree / bothSignal).toFixed(1)}%`);
if (mismatches.length) {
  console.log('\nFirst 20 mismatches:');
  for (const m of mismatches.slice(0, 20)) console.log(' ', iso(m[0]), ...m.slice(1));
}
