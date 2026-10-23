// test/helpers.js - shared fixtures for the journal / telegram / compare / dashboard tests: a REAL signal from the stored SOL history,
// stepped through the bot's own processCoin one candle at a time (no network, no money).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { backtest } = require('../lucidio-core.js');

const IV = 14400;
const load = (coin) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const forming = (c) => ({ time: c.time, open: c.open, high: c.open, low: c.open, close: c.open });
const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `lucidio-${name}-`));

// trade number k of the SOL backtest: all candles, the trade, and the index of its entry candle (the signal candle is i0 - 1)
function scenario(coin = 'SOL', k = 40) {
  const all = load(coin), trade = backtest(all).trades[k];
  return { all, trade, i0: trade.i0, coin };
}
// the view the bot has at wake-up for candle index `idx`: 500 closed candles before it + the forming candle `idx` (opens at its real open)
const viewAt = (all, idx) => ({ B: all.slice(idx - 500, idx).concat([forming(all[idx])]), now: all[idx].time + 5, nowPx: all[idx].open });

// run processCoin from the entry candle until the trade has closed (or `maxSteps`); returns { st, acct, events }
async function runTrade(processCoin, exec, sc, opt = {}) {
  const st = opt.st || { lastTime: null, pos: null, realizedR: 0, n: 0, trades: [] }, acct = opt.acct || { balance: 100, totalR: 0, peakR: 0 }, events = [];
  for (let idx = sc.i0; idx < Math.min(sc.all.length - 1, sc.i0 + (opt.maxSteps || 400)); idx++) {
    const v = viewAt(sc.all, idx);
    events.push(...await processCoin(sc.coin, v.B, st, exec, { acct, now: v.now, nowPx: v.nowPx, hooks: opt.hooks, save: () => {} }));
    if (opt.stopWhen && opt.stopWhen(st, events)) break;
    if (st.n > 0) break;                         // the first trade has closed (a new signal on the same candle may already have opened the next one)
  }
  return { st, acct, events };
}

module.exports = { IV, load, forming, tmp, scenario, viewAt, runTrade };
