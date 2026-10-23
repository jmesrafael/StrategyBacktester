// fetch-1m.js — download 1-minute candles for the trade windows.   node audit/fetch-1m.js mexc | binance   [SOL,ZEC]
//   mexc    : MEXC contract Min1, everything the API still serves. MEXC keeps only ~44,000 one-minute rows (~30.6 days): older trades CANNOT be replayed on MEXC data.
//             Saved to audit/out/v2/mexc-1m-<COIN>.json (small; kept as evidence because the API will drop it).
//   binance : Binance USDT-M futures 1m for the window [entry candle open, exit candle close] of EVERY trade of the Binance 4h backtest.
//             Saved to audit/cache-1m/binance-1m-<COIN>.json (large, gitignored, resumable).
// Row format [time_sec, open, high, low, close].
'use strict';
const fs = require('fs'), path = require('path');
const { backtest } = require('../lucidio-core.js');
const D = path.join(__dirname, '..', 'data'), CACHE = path.join(__dirname, 'cache-1m'), OUT = path.join(__dirname, 'out', 'v2');
const venue = process.argv[2], COINS = (process.argv[3] || 'SOL,ZEC').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
async function jget(url, tries = 6) {
  for (let k = 0; k < tries; k++) {
    try { const r = await fetch(url); if (r.status === 429 || r.status === 418) { await sleep(5000 * (k + 1)); continue; } return await r.json(); }
    catch (e) { await sleep(1500 * (k + 1)); }
  }
  throw new Error('request failed: ' + url);
}
async function mexc(coin) {
  const now = Math.floor(Date.now() / 1000), m = new Map(); let end = now;
  for (let p = 0; p < 40; p++) {
    const j = await jget(`https://contract.mexc.com/api/v1/contract/kline/${coin}_USDT?interval=Min1&start=${end - 1999 * 60}&end=${end}`), d = j && j.data, t = (d && d.time) || [];
    if (!t.length) break;
    t.forEach((x, i) => m.set(x, [x, +d.open[i], +d.high[i], +d.low[i], +d.close[i]]));
    end = t[0] - 1; await sleep(300);
  }
  const rows = [...m.values()].sort((a, b) => a[0] - b[0]);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `mexc-1m-${coin}.json`), JSON.stringify(rows));
  console.log(`MEXC ${coin}: ${rows.length} one-minute rows ${new Date(rows[0][0] * 1000).toISOString()} .. ${new Date(rows[rows.length - 1][0] * 1000).toISOString()} (fetched ${new Date().toISOString()})`);
}
async function binance(coin) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `binance-1m-${coin}.json`), have = new Map();
  if (fs.existsSync(file)) JSON.parse(fs.readFileSync(file, 'utf8')).forEach((r) => have.set(r[0], r));
  const B = rd(coin + '.json').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })), F = rd('funding/' + coin + '.json');
  const trades = backtest(B, {}, F).trades; let reqs = 0, next = 0, doneN = 0;
  const todo = trades.filter((t) => { for (let s = t.t; s < t.tExit; s += 60) if (!have.has(s)) return true; return false; });
  const save = () => fs.writeFileSync(file, JSON.stringify([...have.values()].sort((a, b) => a[0] - b[0])));
  async function worker() { // 6 parallel workers: each takes the next trade window (single request takes ~2 s from here)
    for (;;) {
      const t = todo[next++]; if (!t) return;
      let s = t.t;
      while (s < t.tExit) {
        const j = await jget(`https://fapi.binance.com/fapi/v1/klines?symbol=${coin}USDT&interval=1m&limit=1500&startTime=${s * 1000}&endTime=${t.tExit * 1000 - 1}`);
        if (!Array.isArray(j)) throw new Error('binance: ' + JSON.stringify(j).slice(0, 150));
        if (!j.length) break;
        for (const x of j) have.set(x[0] / 1000, [x[0] / 1000, +x[1], +x[2], +x[3], +x[4]]);
        s = j[j.length - 1][0] / 1000 + 60; reqs++; await sleep(150);
      }
      if (++doneN % 20 === 0) { console.log(`${coin}: ${doneN}/${todo.length} windows, ${have.size} rows, ${reqs} requests`); save(); }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  const rows = [...have.values()].sort((a, b) => a[0] - b[0]); fs.writeFileSync(file, JSON.stringify(rows));
  console.log(`Binance ${coin}: ${rows.length} one-minute rows for ${trades.length} trade windows (${reqs} requests this run)`);
}
(async () => { for (const c of COINS) await (venue === 'mexc' ? mexc(c) : binance(c)); })().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
