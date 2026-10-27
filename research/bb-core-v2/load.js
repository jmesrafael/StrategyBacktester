// load.js — candles + funding from ./data (a copy of bb-core/data, taken Oct 27, 2026). venue 'binance' (default) or 'mexc' (MEXC_<COIN>.json).
'use strict';
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, 'data');
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];

// same rule as bb-core/backtest.js: for MEXC files the years before MEXC's own funding history are filled with Binance funding
function loadFunding(name) {
  const read = (c) => { const f = path.join(DATA, 'funding', c + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const own = read(name);
  if (!name.startsWith('MEXC_')) return own;
  const bin = read(name.slice(5));
  if (!own || !own.length) return bin;
  return bin ? [...bin.filter((r) => r[0] < own[0][0]), ...own] : own;
}
function loadCoin(coin, venue = 'binance') {
  const name = venue === 'mexc' ? 'MEXC_' + coin : coin;
  const B = JSON.parse(fs.readFileSync(path.join(DATA, name + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  return { name, B, funding: loadFunding(name) };
}
module.exports = { COINS, loadCoin };
