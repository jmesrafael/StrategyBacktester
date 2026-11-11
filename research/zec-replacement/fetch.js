// fetch.js: Binance SPOT 4h klines from the first candle to the last closed one, plus Binance USDT-M funding history (from the futures listing on).
//   node fetch.js [COIN ...]   (default: universe.json coins on MEXC + SOL NEAR GALA)
// data4h/<COIN>.json = [[t(s), o, h, l, c, quoteVol], ...]; missing 4h slots (exchange outages) are filled with a flat candle (o=h=l=c=prev close, vol 0) and counted.
'use strict';
const fs = require('fs');
const U = JSON.parse(fs.readFileSync('universe.json', 'utf8')).coins.filter((c) => c.mexcUsd24h != null).map((c) => c.coin);
const COINS = process.argv.slice(2).length ? process.argv.slice(2) : [...U, 'SOL', 'NEAR', 'GALA'];
const IV = 14400;
const j = async (u) => { for (let a = 0; a < 6; a++) { try { const r = await fetch(u); if (r.ok) return await r.json(); if (r.status === 400) return null; } catch (e) {} await new Promise((s) => setTimeout(s, 1500 * (a + 1))); } throw new Error('fetch failed ' + u); };
async function klines(sym) {
  const rows = []; let start = 0; const now = Date.now();
  for (;;) {
    const k = await j(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=4h&startTime=${start}&limit=1000`);
    if (!k || !k.length) break;
    for (const r of k) if (r[6] < now) rows.push([r[0] / 1000, +r[1], +r[2], +r[3], +r[4], +r[7]]);
    if (k.length < 1000) break; start = k[k.length - 1][0] + 1;
  }
  const out = [], gaps = { slots: 0, longest: 0 };
  for (const r of rows) {
    if (out.length) { const p = out[out.length - 1]; let miss = Math.round((r[0] - p[0]) / IV) - 1; if (miss > 0) { gaps.slots += miss; gaps.longest = Math.max(gaps.longest, miss); } for (let t = p[0] + IV; t < r[0]; t += IV) out.push([t, p[4], p[4], p[4], p[4], 0]); }
    out.push(r);
  }
  return { out, gaps };
}
async function funding(sym) {
  // fixed 200-day windows from Sep 2019 (Binance USDT-M start): startTime alone returns only the latest records
  const rows = [], W = 200 * 86400e3;
  for (let a = Date.UTC(2019, 8, 1); a < Date.now(); a += W) {
    const f = await j(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&startTime=${a}&endTime=${a + W - 1}&limit=1000`);
    if (f) for (const r of f) rows.push([Math.floor(r.fundingTime / 1000), +r.fundingRate]);
  }
  rows.sort((x, y) => x[0] - y[0]);
  return rows.filter((r, i) => !i || r[0] !== rows[i - 1][0]);
}
(async () => {
  const meta = fs.existsSync('fetch-meta.json') ? JSON.parse(fs.readFileSync('fetch-meta.json', 'utf8')) : {};
  let q = [...COINS];
  const worker = async () => { while (q.length) { const c = q.shift(), sym = c + 'USDT';
    const have = fs.existsSync(`data4h/${c}.json`) && meta[c];
    const { out, gaps } = have ? { out: JSON.parse(fs.readFileSync(`data4h/${c}.json`, 'utf8')), gaps: { slots: meta[c].gapSlots, longest: meta[c].longestGap } } : await klines(sym);
    const fr = await funding(sym);
    fs.writeFileSync(`data4h/${c}.json`, JSON.stringify(out)); fs.writeFileSync(`funding/${c}.json`, JSON.stringify(fr));
    meta[c] = { candles: out.length, first: new Date(out[0][0] * 1000).toISOString().slice(0, 10), last: new Date(out[out.length - 1][0] * 1000).toISOString().slice(0, 16), gapSlots: gaps.slots, longestGap: gaps.longest, fundingFrom: fr.length ? new Date(fr[0][0] * 1000).toISOString().slice(0, 10) : null, funding: fr.length };
    fs.writeFileSync('fetch-meta.json', JSON.stringify(meta, null, 1));
    console.log(c, JSON.stringify(meta[c])); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  fs.writeFileSync('fetch-meta.json', JSON.stringify(meta, null, 1));
})();
