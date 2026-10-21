// fetch-data.js — download 4h candles + funding history from Binance USDT-M futures (public API, no key).
//   node fetch-data.js SOL,ZEC,BTC        -> data/<COIN>.json  and  data/funding/<COIN>.json
//   node fetch-data.js SOL,ZEC --mexc     -> data/MEXC_<COIN>.json and data/funding/MEXC_<COIN>.json (MEXC perpetuals, the venue the bot trades)
// The still-forming last candle is dropped, so every candle in the file is closed.
'use strict';
const fs = require('fs'), path = require('path');
const COINS = (process.argv[2] || '').split(',').filter(Boolean), MEXC = process.argv.includes('--mexc');
const OUT = path.join(__dirname, 'data'); fs.mkdirSync(path.join(OUT, 'funding'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(url) {
  for (;;) {
    const r = await fetch(url);
    if (r.status === 429 || r.status === 418) { await sleep(30000); continue; }
    return r.json();
  }
}
(async () => {
  if (!COINS.length) return console.log('usage: node fetch-data.js SOL,ZEC,BTC [--mexc]');
  if (MEXC) return fetchMexc();
  for (const c of COINS) {
    let start = Date.UTC(2019, 8, 1), rows = [];
    for (;;) {
      const j = await page(`https://fapi.binance.com/fapi/v1/klines?symbol=${c}USDT&interval=4h&limit=1500&startTime=${start}`);
      if (!Array.isArray(j)) { console.log(c, 'error', JSON.stringify(j).slice(0, 120)); break; }
      if (!j.length) break;
      for (const k of j) rows.push([k[0] / 1000, +k[1], +k[2], +k[3], +k[4], +k[5]]);
      start = j[j.length - 1][0] + 1;
      if (j.length < 1500) break;
      await sleep(150);
    }
    if (rows.length && rows[rows.length - 1][0] + 14400 > Date.now() / 1000) rows.pop();
    fs.writeFileSync(path.join(OUT, c + '.json'), JSON.stringify(rows));

    let from = Date.UTC(2019, 8, 1), fr = [];
    for (;;) {
      const j = await page(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${c}USDT&startTime=${from}&limit=1000`);
      if (!Array.isArray(j) || !j.length) break;
      for (const k of j) fr.push([Math.round(k.fundingTime / 1000), +k.fundingRate]);
      from = j[j.length - 1].fundingTime + 1;
      if (j.length < 1000) break;
      await sleep(150);
    }
    fs.writeFileSync(path.join(OUT, 'funding', c + '.json'), JSON.stringify(fr));
    console.log(c, rows.length, 'candles,', fr.length, 'funding events', rows.length ? new Date(rows[0][0] * 1000).toISOString().slice(0, 10) : '');
  }
})();

// MEXC: klines come newest-first in pages of 2000; funding history only goes back to about Apr 2025
// (backtest.js fills the earlier years with Binance funding when data/funding/<COIN>.json exists).
async function fetchMexc() {
  const get = async (url) => { for (let i = 0; i < 5; i++) { try { const j = await page(url); if (j && j.success) return j.data; } catch {} await sleep(1000 * (i + 1)); } throw new Error('MEXC failed: ' + url); };
  for (const c of COINS) {
    const sym = c + '_USDT', SEC = 14400, merged = new Map();
    let end = Math.floor(Date.now() / 1000);
    for (let p = 0; p < 40; p++) {
      const d = await get(`https://contract.mexc.com/api/v1/contract/kline/${sym}?interval=Hour4&start=${end - 1999 * SEC}&end=${end}`);
      const t = (d && d.time) || []; if (!t.length) break;
      for (let i = 0; i < t.length; i++) merged.set(t[i], [t[i], +d.open[i], +d.high[i], +d.low[i], +d.close[i], +d.vol[i]]);
      end = t[0] - 1; await sleep(200);
    }
    const rows = [...merged.values()].sort((a, b) => a[0] - b[0]);
    if (rows.length && rows[rows.length - 1][0] + SEC > Date.now() / 1000) rows.pop();
    fs.writeFileSync(path.join(OUT, `MEXC_${c}.json`), JSON.stringify(rows));
    const fund = [];
    for (let p = 1; p < 200; p++) {
      const d = await get(`https://contract.mexc.com/api/v1/contract/funding_rate/history?symbol=${sym}&page_num=${p}&page_size=1000`);
      const list = (d && d.resultList) || []; for (const x of list) fund.push([Math.round(x.settleTime / 1000), +x.fundingRate]);
      if (!list.length || p >= (d.totalPage || 1)) break; await sleep(200);
    }
    fund.sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(path.join(OUT, 'funding', `MEXC_${c}.json`), JSON.stringify(fund));
    const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
    console.log('MEXC', c, rows.length, 'candles', iso(rows[0][0]), '→', iso(rows[rows.length - 1][0]), '|', fund.length, 'funding events', fund.length ? 'from ' + iso(fund[0][0]) : '');
  }
}
