// fetch.js — native 4h Binance USDT-M futures klines for BTC/ETH/SOL/ADA -> data1h/<COIN>.json ([sec,o,h,l,c,v])
const fs = require('fs'), path = require('path');
const COINS = (process.env.COINS || 'BTC,ETH,SOL,ADA').split(',');
(async () => {
  for (const c of COINS) {
    let start = Date.UTC(2019, 8, 1), rows = [];
    for (;;) {
      const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${c}USDT&interval=1h&limit=1500&startTime=${start}`);
      const j = await r.json();
      if (!Array.isArray(j)) { console.log(c, 'error', JSON.stringify(j).slice(0, 120)); if (r.status === 429) { await new Promise(x => setTimeout(x, 30000)); continue; } break; }
      if (!j.length) break;
      for (const k of j) rows.push([k[0] / 1000, +k[1], +k[2], +k[3], +k[4], +k[5]]);
      start = j[j.length - 1][0] + 1;
      if (j.length < 1500) break;
      await new Promise(x => setTimeout(x, 150));
    }
    if (rows.length && rows[rows.length - 1][0] + 3600 > Date.now() / 1000) rows.pop(); // drop forming bar
    fs.writeFileSync(path.join(__dirname, 'data1h', c + '.json'), JSON.stringify(rows));
    console.log(c, rows.length, new Date(rows[0][0] * 1000).toISOString().slice(0, 10), '->', new Date(rows[rows.length - 1][0] * 1000).toISOString().slice(0, 16));
  }
})();
