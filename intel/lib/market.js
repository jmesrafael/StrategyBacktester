// market.js - validated access to the candle library (Binance USDT-M perps, closed bars only).
// The library itself stays where it is (../candles). The spine dataset "market" is its registry: one entry
// per coin and timeframe with row count, time range, faults and a checksum, written by ingest/candles.js.
// bars() refuses a coin that is not registered, has faults, or whose file changed since it was registered.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('./spine'), cfg = require('./config');
const { SpineError } = spine;

const SECS = { '1h': 3600, '4h': 14400 };
const fileOf = (coin, tf) => path.join(cfg.path(cfg.candleLibrary), 'binance-futures', tf, coin + '.json');
let reg = null; const cache = new Map();
const registry = () => (reg || (reg = spine.load('market', 'registry.json')));
const reset = () => { reg = null; cache.clear(); };

// raw rows [openTimeSec, open, high, low, close, volume] (funding: [timeSec, rate]); opts.from / opts.to in unix seconds
function bars(coin, tf, opts = {}) {
  const key = coin + '/' + tf;
  if (!cache.has(key)) {
    const e = registry().series[key];
    if (!e) throw new SpineError('MISSING', `market: ${key} is not in the registry (add the coin to the candle library and run "ingest candles")`);
    if (e.faults.length) throw new SpineError('FAILED', `market: ${key} has faults: ${e.faults.join('; ')}`);
    const f = fileOf(coin, tf), st = fs.statSync(f);
    if (st.size !== e.bytes) throw new SpineError('STALE', `market: ${key} changed on disk since it was registered (run "ingest candles")`);
    cache.set(key, JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  let rows = cache.get(key);
  if (opts.from != null || opts.to != null) rows = rows.filter((r) => (opts.from == null || r[0] >= opts.from) && (opts.to == null || r[0] < opts.to));
  return rows;
}
// candles as objects { time, open, high, low, close, volume } for the backtest engine
const candles = (coin, tf, opts) => bars(coin, tf, opts).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
const has = (coin, tf) => { const e = registry().series[coin + '/' + tf]; return !!e && !e.faults.length; };
const coins = (tf = '1h') => Object.keys(registry().series).filter((k) => k.endsWith('/' + tf) && !registry().series[k].faults.length).map((k) => k.split('/')[0]);

// index helper: price known at time T = close of the last bar that closed at or before T (never a bar still forming)
function closeIndex(rows, tfSecs) { const m = new Map(); rows.forEach((r, i) => m.set(r[0] + tfSecs, i)); return m; }
function priceAt(coin, T, tf = '1h') {
  const rows = bars(coin, tf), s = SECS[tf], key = coin + '/' + tf + '/idx';
  if (!cache.has(key)) cache.set(key, closeIndex(rows, s));
  const i = cache.get(key).get(Math.floor(T / s) * s);
  return i == null ? null : rows[i][4];
}
const lastClose = (coin = 'BTC', tf = '1h') => { const r = bars(coin, tf); return r[r.length - 1][0] + SECS[tf]; };

module.exports = { bars, candles, has, coins, priceAt, lastClose, fileOf, reset, SECS };
