// ORB universe data fetch: Binance USDT-M perpetual futures, public endpoints only.
//   node fetch.js htf [COINS]   -> data/<COIN>-1h.json, <COIN>-4h.json (rows [t,o,h,l,c,vol]) + <COIN>-funding.json
//   node fetch.js 1m  [COINS]   -> data/<COIN>-1m.json (rows [t,o,h,l,c]), resumable, used for fills/stops
// t = candle OPEN time in unix seconds. Only CLOSED candles are stored (the still-forming candle is dropped),
// so a replay can never see a bar that was not finished at fetch time.
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, 'data'); fs.mkdirSync(D, { recursive: true });
const DEFAULT = 'SOL,ADA,NEAR,GALA,ZEC,BTC,ETH,BNB,XRP,DOGE,AVAX,LINK,DOT,SUI'.split(',');
const mode = process.argv[2], COINS = (process.argv[3] ? process.argv[3].split(',') : DEFAULT).map(s => s.toUpperCase());
const sleep = ms => new Promise(r => setTimeout(r, ms));
let last = 0;
async function jget(u) {
  for (let i = 0; i < 8; i++) {
    const w = 260 - (Date.now() - last); if (w > 0) await sleep(w); last = Date.now();   // ~4 req/s, inside the 2400-weight/min limit
    try {
      const r = await fetch(u);
      if (r.ok) return await r.json();
      if (r.status === 429 || r.status === 418) { await sleep(+(r.headers.get('retry-after') || 30) * 1000); continue; }
      if (r.status === 400) throw new Error('400 ' + u);
      await sleep(2000 * (i + 1));
    } catch (e) { if (/^Error: 400/.test(String(e))) throw e; await sleep(2000 * (i + 1)); }
  }
  throw new Error('fetch failed ' + u);
}
const nowSec = Math.floor(Date.now() / 1000);
async function klines(sym, interval, secs, startSec, withVol) {
  const out = []; let s = startSec;
  while (true) {
    const j = await jget(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=1500&startTime=${s * 1000}`);
    if (!j.length) break;
    for (const k of j) { const t = k[0] / 1000; if (t + secs > nowSec) continue; out.push(withVol ? [t, +k[1], +k[2], +k[3], +k[4], +k[5]] : [t, +k[1], +k[2], +k[3], +k[4]]); }
    const l = j[j.length - 1][0] / 1000;
    if (j.length < 1500 || l + secs > nowSec) break;
    s = l + secs;
  }
  return out;
}
(async () => {
  for (const c of COINS) {
    const sym = c + 'USDT', t0 = Date.now();
    if (mode === 'htf') {
      const START = 1567900800; // 2019-09-08, Binance perp listing era; the API returns from the coin's own listing
      for (const [iv, secs] of [['1h', 3600], ['4h', 14400]]) {
        const a = await klines(sym, iv, secs, START, true);
        fs.writeFileSync(path.join(D, `${c}-${iv}.json`), JSON.stringify(a));
        console.log(c, iv, a.length, new Date(a[0][0] * 1e3).toISOString().slice(0, 10), '->', new Date(a.at(-1)[0] * 1e3).toISOString().slice(0, 16));
      }
      const fund = []; let s = 1567900800000;
      while (true) {
        const j = await jget(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1000&startTime=${s}`);
        if (!j.length) break;
        for (const f of j) fund.push([Math.round(f.fundingTime / 1000), +f.fundingRate]);
        if (j.length < 1000) break; s = j.at(-1).fundingTime + 1;
      }
      fs.writeFileSync(path.join(D, `${c}-funding.json`), JSON.stringify(fund));
      console.log(c, 'funding', fund.length);
    } else if (mode === '1m') {
      const F = path.join(D, `${c}-1m.json`);
      let have = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F)) : [];
      let start = have.length ? have.at(-1)[0] + 60 : JSON.parse(fs.readFileSync(path.join(D, `${c}-1h.json`)))[0][0];
      const add = await klines(sym, '1m', 60, start, false);
      have = have.concat(add);
      fs.writeFileSync(F, JSON.stringify(have));
      console.log(c, '1m', have.length, 'added', add.length, new Date(have.at(-1)[0] * 1e3).toISOString().slice(0, 16), ((Date.now() - t0) / 60000).toFixed(1) + 'min');
    } else { console.log('usage: node fetch.js htf|1m [COINS]'); process.exit(1); }
  }
})();
