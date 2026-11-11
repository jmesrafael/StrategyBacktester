// fetch10.js — 10-year 4h series: Poloniex <COIN>_USDT 4h from its first candle until Binance spot (data4h/) begins, then Binance spot.
//   node fetch10.js [COIN ...]  -> data4h-10y/<COIN>.json + splice-check.json
// Cleaning (Poloniex part only): wick beyond 2x the candle body range AND > 25% from the body is clipped to 25% (bad prints on thin 2016-18 books); counted.
'use strict';
const fs = require('fs');
const COINS = process.argv.slice(2).length ? process.argv.slice(2) : ['BTC', 'ETH', 'XRP', 'LTC', 'DASH', 'XMR', 'ETC', 'XLM', 'ZEC'];
const IV = 14400, FROM = Date.UTC(2016, 0, 1);
const j = async (u) => { for (let a = 0; a < 6; a++) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) {} await new Promise((s) => setTimeout(s, 1500 * (a + 1))); } throw new Error(u); };
async function polo(c, until) {
  const rows = [], STEP = 480 * IV * 1000;
  until = Math.min(until, Date.now()); // never ask for future candles
  for (let t = FROM; t < until; t += STEP) {
    const k = await j(`https://api.poloniex.com/markets/${c}_USDT/candles?interval=HOUR_4&startTime=${t}&endTime=${Math.min(t + STEP - 1, until)}&limit=500`);
    if (Array.isArray(k)) for (const r of k) rows.push([+r[12] / 1000, +r[2], +r[1], +r[0], +r[3], +r[5]]); // [low, high, open, close, amount, quantity, ...] -> o,h,l,c,quoteVol
    await new Promise((s) => setTimeout(s, 150));
  }
  rows.sort((a, b) => a[0] - b[0]); return rows.filter((r, i) => !i || r[0] !== rows[i - 1][0]);
}
(async () => {
  const check = fs.existsSync('splice-check.json') ? JSON.parse(fs.readFileSync('splice-check.json', 'utf8')) : {};
  for (const c of COINS) {
    // no Binance spot series (XMR: delisted there) -> Poloniex for the whole span
    const bin = fs.existsSync(`data4h/${c}.json`) ? JSON.parse(fs.readFileSync(`data4h/${c}.json`, 'utf8')) : [[Math.floor(Date.now() / 1000 / IV) * IV + IV]];
    const b0 = bin[0][0]; if (bin.length === 1) bin.length = 0;
    let p = await polo(c, (b0 + 60 * 86400) * 1000); // include 60 days of overlap for the splice check
    if (!bin.length) p = p.filter((r) => r[0] * 1000 + IV * 1000 < Date.now()); // closed candles only
    // splice check: median |close diff| over the overlap
    const bm = new Map(bin.map((r) => [r[0], r[4]])), diffs = p.filter((r) => bm.has(r[0])).map((r) => Math.abs(r[4] / bm.get(r[0]) - 1)).sort((a, b) => a - b);
    let clipped = 0;
    p = p.filter((r) => r[0] < b0 && r[4] > 0).map((r) => { let [t, o, h, l, cl, v] = r; const top = Math.max(o, cl), bot = Math.min(o, cl), body = top - bot;
      if (h > top * 1.25 && h - top > 2 * Math.max(body, top * 0.01)) { h = top * 1.25; clipped++; } if (l < bot * 0.75 && bot - l > 2 * Math.max(body, bot * 0.01)) { l = bot * 0.75; clipped++; } return [t, o, h, l, cl, v]; });
    const all = [...p, ...bin], out = [];
    for (const r of all) { if (out.length) { const q = out[out.length - 1]; for (let t = q[0] + IV; t < r[0]; t += IV) out.push([t, q[4], q[4], q[4], q[4], 0]); } out.push(r); }
    fs.writeFileSync(`data4h-10y/${c}.json`, JSON.stringify(out));
    check[c] = { first: new Date(out[0][0] * 1000).toISOString().slice(0, 10), poloniexCandles: p.length, binanceFrom: new Date(b0 * 1000).toISOString().slice(0, 10), overlapCandles: diffs.length, medianCloseDiffPct: diffs.length ? +(diffs[diffs.length >> 1] * 100).toFixed(3) : null, p95CloseDiffPct: diffs.length ? +(diffs[Math.floor(diffs.length * 0.95)] * 100).toFixed(3) : null, wicksClipped: clipped, zeroVolPolo: p.filter((r) => !r[5]).length };
    console.log(c, JSON.stringify(check[c]));
  }
  fs.writeFileSync('splice-check.json', JSON.stringify(check, null, 1));
})();
