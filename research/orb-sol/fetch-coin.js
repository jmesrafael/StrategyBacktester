// node fetch-coin.js BTC  -> data/btc-1h.json, btc-4h.json, btc-1m.json (continuous), btc-funding.json
// Binance USDT-M futures public klines. Weight-aware pacing (limit=1000 -> weight 5).
const fs = require('fs'), path = require('path');
const COIN = (process.argv[2] || 'BTC').toUpperCase(), sym = COIN + 'USDT', pre = COIN.toLowerCase();
const D = path.join(__dirname, 'data');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let used = 0;
async function jget(u) {
  for (let i = 0; i < 8; i++) {
    try {
      const r = await fetch(u);
      used = +(r.headers.get('x-mbx-used-weight-1m') || 0);
      if (r.ok) return await r.json();
      await sleep(r.status === 429 || r.status === 418 ? 60000 : 3000 * (i + 1));
    } catch (e) { await sleep(3000 * (i + 1)); }
  }
  throw new Error('fetch failed ' + u);
}
const nowSec = Math.floor(Date.now() / 1000), START = 1600041600; // 2020-09-14
async function klines(interval, secs, from, to) {
  const out = []; let s = from;
  while (s < to) {
    const j = await jget(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=1000&startTime=${s * 1000}&endTime=${(to - secs) * 1000}`);
    if (!j.length) break;
    for (const k of j) { const t = k[0] / 1000; if (t + secs <= nowSec && t < to) out.push([t, +k[1], +k[2], +k[3], +k[4], +k[5]]); }
    s = j.at(-1)[0] / 1000 + secs;
    if (used > 1800) await sleep(15000);
  }
  return out;
}
(async () => {
  for (const [iv, secs] of [['1h', 3600], ['4h', 14400]]) {
    const a = await klines(iv, secs, START, nowSec);
    fs.writeFileSync(path.join(D, `${pre}-${iv}.json`), JSON.stringify(a));
    console.log(COIN, iv, a.length);
  }
  // 1m in 4 parallel chunks
  const chunks = 4, span = Math.ceil((nowSec - START) / chunks / 60) * 60;
  const parts = await Promise.all([...Array(chunks)].map((_, k) => klines('1m', 60, START + k * span, Math.min(nowSec, START + (k + 1) * span))));
  const m1 = [].concat(...parts).map(r => r.slice(0, 5));
  let gaps = 0; for (let i = 1; i < m1.length; i++) if (m1[i][0] - m1[i - 1][0] !== 60) gaps++;
  fs.writeFileSync(path.join(D, `${pre}-1m.json`), JSON.stringify(m1));
  console.log(COIN, '1m', m1.length, 'gaps', gaps);
  const fund = []; let s = START * 1000;
  while (true) {
    const j = await jget(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1000&startTime=${s}`);
    if (!j.length) break;
    for (const f of j) fund.push([Math.round(f.fundingTime / 1000), +f.fundingRate]);
    if (j.length < 1000) break; s = j.at(-1).fundingTime + 1;
  }
  fs.writeFileSync(path.join(D, `${pre}-funding.json`), JSON.stringify(fund));
  console.log(COIN, 'funding', fund.length, 'DONE');
})();
