// Fetch SOLUSDT perp data from Binance futures (public endpoints only).
// Writes data/sol-1h.json, data/sol-4h.json, data/sol-1m.json (cache + new), data/funding.json
// Candle rows: [openTimeSec, o, h, l, c, volume]. Only CLOSED candles are kept.
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, 'data'); fs.mkdirSync(D, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function jget(u) {
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(u); if (r.ok) return await r.json(); await sleep(2000 * (i + 1)); }
    catch (e) { await sleep(2000 * (i + 1)); }
  }
  throw new Error('fetch failed ' + u);
}
const nowSec = Math.floor(Date.now() / 1000);
async function klines(interval, secs, startSec) {
  const out = []; let s = startSec;
  while (true) {
    const j = await jget(`https://fapi.binance.com/fapi/v1/klines?symbol=SOLUSDT&interval=${interval}&limit=1500&startTime=${s * 1000}`);
    if (!j.length) break;
    for (const k of j) {
      const t = k[0] / 1000;
      if (t + secs > nowSec) continue;               // drop the still-open candle
      out.push([t, +k[1], +k[2], +k[3], +k[4], +k[5]]);
    }
    const last = j[j.length - 1][0] / 1000;
    if (j.length < 1500 || last + secs > nowSec) break;
    s = last + secs; await sleep(150);
  }
  return out;
}
(async () => {
  const START = 1600041600; // 2020-09-14
  for (const [iv, secs] of [['1h', 3600], ['4h', 14400]]) {
    const a = await klines(iv, secs, START);
    fs.writeFileSync(path.join(D, `sol-${iv}.json`), JSON.stringify(a));
    console.log(iv, a.length, new Date(a[0][0] * 1e3).toISOString(), new Date(a.at(-1)[0] * 1e3).toISOString());
  }
  // 1m: reuse the Binance-futures 1m cache from the bb-core audit, then append the gap
  const cache = JSON.parse(fs.readFileSync(path.join(__dirname, '../bb-core/audit/cache-1m/binance-1m-SOL.json')));
  const lastT = cache.at(-1)[0];
  const add = await klines('1m', 60, lastT + 60);
  const m1 = cache.map(r => [r[0], r[1], r[2], r[3], r[4]]).concat(add.map(r => r.slice(0, 5)));
  fs.writeFileSync(path.join(D, 'sol-1m.json'), JSON.stringify(m1));
  console.log('1m', m1.length, 'added', add.length, new Date(m1.at(-1)[0] * 1e3).toISOString());
  // funding history
  const fund = []; let s = START * 1000;
  while (true) {
    const j = await jget(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=SOLUSDT&limit=1000&startTime=${s}`);
    if (!j.length) break;
    for (const f of j) fund.push([Math.round(f.fundingTime / 1000), +f.fundingRate]);
    if (j.length < 1000) break; s = j.at(-1).fundingTime + 1; await sleep(200);
  }
  fs.writeFileSync(path.join(D, 'funding.json'), JSON.stringify(fund));
  console.log('funding', fund.length);
})();
