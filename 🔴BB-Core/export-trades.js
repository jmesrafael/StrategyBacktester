// export-trades.js: writes the bot's backtest trades as a plain JSON file for other tools (e.g. the ledger's seed script).
//   node export-trades.js SOL,ZEC 2025-01-10T02:00:00Z out.json
// Output: { trades: [{ coin, dir, t, tExit, entry, stop, R, why }], closes: { COIN: [[closeTimeSec, close], ...] } }
//   t / tExit = entry / exit time (unix sec); R = result in units of the amount risked (fees, slippage, funding included);
//   closes = every 4h close from the start, so a reader can value open trades at any moment.
'use strict';
const fs = require('fs'), path = require('path');
const { backtest } = require('./lucidio-core.js');

const [coinArg = 'SOL,ZEC', startArg = '2025-01-01T00:00:00Z', out = 'trades.json'] = process.argv.slice(2);
const START = Date.parse(startArg) / 1000, IV = 14400, DATA = path.join(__dirname, 'data');
// same rule as backtest.js: MEXC_<COIN> funding history starts ~Apr 2025, so earlier periods use Binance funding
function loadFunding(coin) {
  const read = (c) => { const f = path.join(DATA, 'funding', c + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const own = read(coin);
  if (!coin.startsWith('MEXC_')) return own;
  const bin = read(coin.slice(5));
  if (!own || !own.length) return bin;
  return bin ? [...bin.filter((x) => x[0] < own[0][0]), ...own] : own;
}
const res = { start: startArg, trades: [], closes: {} };
for (const coin of coinArg.split(',')) {
  const B = JSON.parse(fs.readFileSync(path.join(DATA, coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const r = backtest(B, {}, loadFunding(coin));
  for (const t of r.trades) if (t.t >= START) res.trades.push({ coin, dir: t.dir, t: t.t, tExit: t.tExit, entry: t.entry, stop: t.stop, R: t.R, why: t.why });
  if (r.open && r.open.t >= START) (res.open = res.open || []).push({ coin, dir: r.open.dir, t: r.open.t, entry: r.open.entry, stop: r.open.stop });
  res.closes[coin] = B.filter((b) => b.time + IV >= START).map((b) => [b.time + IV, b.close]);
}
res.trades.sort((a, b) => a.t - b.t || a.tExit - b.tExit);
fs.writeFileSync(out, JSON.stringify(res));
console.log(`${res.trades.length} trades since ${startArg} → ${out}${res.open ? ` (${res.open.length} still open)` : ''}`);
