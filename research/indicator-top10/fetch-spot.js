// fetch-spot.js — Binance SPOT 4h klines (api.binance.com) from listing to 2020-01-01 for pre-futures history -> data4h-spot/<COIN>.json ([sec,o,h,l,c,v])
const fs = require('fs');
(async () => { for (const c of ['BTC', 'ETH', 'ADA', 'ZEC']) { let start = Date.UTC(2017, 7, 1), rows = [], end = Date.UTC(2020, 0, 1);
  for (;;) { const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${c}USDT&interval=4h&limit=1000&startTime=${start}&endTime=${end}`); const j = await r.json();
    if (!Array.isArray(j)) { console.log(c, 'error', JSON.stringify(j).slice(0, 150)); break; } if (!j.length) break;
    for (const k of j) rows.push([k[0] / 1000, +k[1], +k[2], +k[3], +k[4], +k[5]]); start = j[j.length - 1][0] + 1; if (j.length < 1000) break; await new Promise(x => setTimeout(x, 150)); }
  if (rows.length) { fs.writeFileSync(`data4h-spot/${c}.json`, JSON.stringify(rows)); console.log(c, rows.length, new Date(rows[0][0] * 1000).toISOString().slice(0, 10), '->', new Date(rows[rows.length - 1][0] * 1000).toISOString().slice(0, 16)); } } })();
