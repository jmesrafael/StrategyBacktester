// Loader for the local candle library. Never touches the network.
//   const C = require('<path>/StrategyBacktester/candles/candles.js');
//   C.load('SOL', '1h')            -> [[openTimeSec, o, h, l, c, vol], ...]   (closed bars only)
//   C.load('SOL', '4h', { from: '2022-01-01', to: '2025-01-01' })   (by bar OPEN time; `to` is exclusive)
//   C.funding('SOL')               -> [[fundingTimeSec, rate], ...]
//   C.coins()                      -> coins present in the library
//   C.closeTime(bar, '1h')         -> the moment the bar becomes known; decide on this, never on the open time
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, 'binance-futures');
const SECS = { '1m': 60, '1h': 3600, '4h': 14400 };   // 1m rows: [t, o, h, l, c] (no volume), ~3M rows per coin
const cache = new Map();
const toSec = x => x == null ? null : typeof x === 'number' ? x : Math.floor(Date.parse(x) / 1000);
function read(f) {
  if (!cache.has(f)) {
    if (!fs.existsSync(f)) throw new Error(`not in the candle library: ${path.relative(__dirname, f)} (add the coin to coins.json and run node update.js)`);
    cache.set(f, JSON.parse(fs.readFileSync(f)));
  }
  return cache.get(f);
}
function slice(rows, o = {}) {
  const a = toSec(o.from), b = toSec(o.to);
  return a == null && b == null ? rows : rows.filter(r => (a == null || r[0] >= a) && (b == null || r[0] < b));
}
module.exports = {
  ROOT, SECS,
  load(coin, tf, o) { if (!SECS[tf]) throw new Error('tf must be 1m, 1h or 4h'); return slice(read(path.join(ROOT, tf, `${coin.toUpperCase()}.json`)), o); },
  funding(coin, o) { return slice(read(path.join(ROOT, 'funding', `${coin.toUpperCase()}.json`)), o); },
  coins() { return fs.readdirSync(path.join(ROOT, '1h')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort(); },
  closeTime(bar, tf) { return bar[0] + SECS[tf]; },
};
