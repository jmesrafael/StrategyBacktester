// fetch-solzec.js — native 4h Binance USDT-M futures klines for SOL, ZEC -> data4h/<COIN>.json
const fs = require('fs'), path = require('path');
const COINS = ['SOL', 'ZEC'];
const OUT = path.join(__dirname, 'data4h'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  for (const c of COINS) {
    let start = Date.UTC(2019, 8, 1), rows = [];
    for (;;) {
      const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${c}USDT&interval=4h&limit=1500&startTime=${start}`);
      const j = await r.json();
      if (!Array.isArray(j)) { console.log(c, 'error', JSON.stringify(j).slice(0, 120)); if (r.status === 429) { await new Promise((x) => setTimeout(x, 30000)); continue; } break; }
      if (!j.length) break;
      for (const k of j) rows.push([k[0] / 1000, +k[1], +k[2], +k[3], +k[4], +k[5]]);
      start = j[j.length - 1][0] + 1;
      if (j.length < 1500) break;
      await new Promise((x) => setTimeout(x, 150));
    }
    if (rows.length && rows[rows.length - 1][0] + 14400 > Date.now() / 1000) rows.pop();
    fs.writeFileSync(path.join(OUT, c + '.json'), JSON.stringify(rows));
    console.log(c, rows.length, rows.length ? new Date(rows[0][0] * 1000).toISOString().slice(0, 10) + ' -> ' + new Date(rows[rows.length - 1][0] * 1000).toISOString().slice(0, 10) : '');
  }
})();
