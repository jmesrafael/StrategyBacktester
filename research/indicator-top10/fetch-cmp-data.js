// fetch-cmp-data.js — public read-only data for the 4h vs 1h decision: Binance funding to today, Binance spot 1h before 2020, MEXC futures 1h + 4h.
const fs = require('fs'); const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const c of ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'BTC', 'ETH']) { let s = Date.UTC(2019, 8, 1), out = [];
    for (;;) { const j = await (await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${c}USDT&startTime=${s}&limit=1000`)).json(); if (!Array.isArray(j)) { console.log(c, 'err', JSON.stringify(j).slice(0, 100)); break; } if (!j.length) break;
      for (const f of j) out.push([Math.round(f.fundingTime / 1000), +f.fundingRate]); s = j[j.length - 1].fundingTime + 1; if (j.length < 1000) break; await sleep(250); }
    fs.writeFileSync(`funding/${c}.json`, JSON.stringify(out)); console.log('funding', c, out.length, new Date(out[out.length - 1][0] * 1000).toISOString().slice(0, 10)); }
  for (const c of ['BTC', 'ETH', 'ADA', 'ZEC']) { let s = Date.UTC(2017, 7, 1), end = Date.UTC(2020, 0, 1), rows = [];
    for (;;) { const j = await (await fetch(`https://api.binance.com/api/v3/klines?symbol=${c}USDT&interval=1h&limit=1000&startTime=${s}&endTime=${end}`)).json(); if (!Array.isArray(j) || !j.length) break; for (const k of j) rows.push([k[0] / 1000, +k[1], +k[2], +k[3], +k[4], +k[5]]); s = j[j.length - 1][0] + 1; if (j.length < 1000) break; await sleep(120); }
    fs.writeFileSync(`data1h-spot/${c}.json`, JSON.stringify(rows)); console.log('spot1h', c, rows.length); }
  for (const [lab, iv, sec, dir] of [['Min60', '1h', 3600, 'mexc1h'], ['Hour4', '4h', 14400, 'mexc4h']]) for (const c of ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA']) { const m = new Map(); let end = Math.floor(Date.now() / 1000);
    for (let k = 0; k < 80; k++) { let d; try { d = await (await fetch(`https://contract.mexc.com/api/v1/contract/kline/${c}_USDT?interval=${lab}&start=${end - 1999 * sec}&end=${end}`)).json(); } catch (e) { break; } const x = d && d.data; if (!x || !x.time || !x.time.length) break; x.time.forEach((t, i) => m.set(t, [t, +x.open[i], +x.high[i], +x.low[i], +x.close[i], +x.vol[i]])); const first = x.time[0]; if (first >= end) break; end = first - sec; await sleep(150); }
    const rows = [...m.values()].sort((a, b) => a[0] - b[0]); if (rows.length && rows[rows.length - 1][0] + sec > Date.now() / 1000) rows.pop(); fs.writeFileSync(`${dir}/${c}.json`, JSON.stringify(rows)); console.log(dir, c, rows.length, rows.length ? new Date(rows[0][0] * 1000).toISOString().slice(0, 10) : '-'); }
})();
