// fetch-other.js — 4h history for top-100 coins without a Binance spot market: Binance USDT-M futures if listed there, else MEXC futures (the bots' venue).
//   node fetch-other.js COIN:BINANCEFUT:MEXC ...   (BINANCEFUT may be empty)  -> data4h/<COIN>.json, funding/<COIN>.json, fetch-meta.json
// XMR: Binance delisted it, so the 10-year Poloniex series (data4h-10y/XMR.json, fetch10.js) is copied instead.
'use strict';
const fs = require('fs');
const IV = 14400;
const j = async (u) => { for (let a = 0; a < 6; a++) { try { const r = await fetch(u); if (r.ok) return await r.json(); if (r.status === 400) return null; } catch (e) {} await new Promise((s) => setTimeout(s, 1500 * (a + 1))); } throw new Error(u); };
const fill = (rows) => { const out = []; let slots = 0; for (const r of rows) { if (out.length) { const q = out[out.length - 1]; for (let t = q[0] + IV; t < r[0]; t += IV) { out.push([t, q[4], q[4], q[4], q[4], 0]); slots++; } } out.push(r); } return { out, slots }; };
async function binFut(sym) {
  const rows = []; let start = Date.UTC(2019, 8, 1); const now = Date.now();
  for (;;) { const k = await j(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}USDT&interval=4h&startTime=${start}&limit=1500`); if (!k || !k.length) break;
    for (const r of k) if (r[6] < now) rows.push([r[0] / 1000, +r[1], +r[2], +r[3], +r[4], +r[7]]); if (k.length < 1500) break; start = k[k.length - 1][0] + 1; }
  const F = [], W = 200 * 86400e3;
  for (let a = Date.UTC(2019, 8, 1); a < now; a += W) { const f = await j(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}USDT&startTime=${a}&endTime=${a + W - 1}&limit=1000`); if (f) for (const r of f) F.push([Math.floor(r.fundingTime / 1000), +r.fundingRate]); }
  return { rows, F };
}
async function mexc(sym) {
  // MEXC contract klines: at most 2000 per call, walk forward in 1500-candle windows from 2020
  const rows = []; const now = Math.floor(Date.now() / 1000);
  for (let s = Date.UTC(2020, 0, 1) / 1000; s < now; s += 1500 * IV) {
    const k = await j(`https://contract.mexc.com/api/v1/contract/kline/${sym}_USDT?interval=Hour4&start=${s}&end=${Math.min(s + 1500 * IV - 1, now)}`);
    const d = k && k.data; if (d && d.time) for (let i = 0; i < d.time.length; i++) if (d.time[i] + IV <= now) rows.push([d.time[i], +d.open[i], +d.high[i], +d.low[i], +d.close[i], +d.amount[i]]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  const F = [];
  for (let p = 1; p < 200; p++) { const f = await j(`https://contract.mexc.com/api/v1/contract/funding_rate/history?symbol=${sym}_USDT&page_num=${p}&page_size=100`); const l = f && f.data && f.data.resultList; if (!l || !l.length) break; for (const r of l) F.push([Math.floor(r.settleTime / 1000), +r.fundingRate]); }
  F.sort((a, b) => a[0] - b[0]);
  return { rows: rows.filter((r, i) => !i || r[0] !== rows[i - 1][0]), F };
}
(async () => {
  const meta = fs.existsSync('fetch-meta.json') ? JSON.parse(fs.readFileSync('fetch-meta.json', 'utf8')) : {};
  for (const arg of process.argv.slice(2)) {
    const [coin, bf, mx] = arg.split(':');
    let src, rows, F;
    if (coin === 'XMR' && fs.existsSync('data4h-10y/XMR.json')) { rows = JSON.parse(fs.readFileSync('data4h-10y/XMR.json', 'utf8')); F = JSON.parse(fs.readFileSync('funding/XMR.json', 'utf8')); src = 'poloniex (10y series)'; }
    else if (bf) { ({ rows, F } = await binFut(bf)); src = 'binance futures'; }
    else { ({ rows, F } = await mexc(mx)); src = 'mexc futures'; }
    if (!rows.length) { console.log(coin, 'no data'); continue; }
    const { out, slots } = fill(rows);
    fs.writeFileSync(`data4h/${coin}.json`, JSON.stringify(out)); fs.writeFileSync(`funding/${coin}.json`, JSON.stringify(F));
    meta[coin] = { source: src, candles: out.length, first: new Date(out[0][0] * 1000).toISOString().slice(0, 10), last: new Date(out[out.length - 1][0] * 1000).toISOString().slice(0, 16), gapSlots: slots, fundingFrom: F.length ? new Date(F[0][0] * 1000).toISOString().slice(0, 10) : null, funding: F.length };
    fs.writeFileSync('fetch-meta.json', JSON.stringify(meta, null, 1));
    console.log(coin, JSON.stringify(meta[coin]));
  }
})();
