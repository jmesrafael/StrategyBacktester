// fetchtf.js — native Binance USDT-M futures klines for one timeframe and a list of coins -> datatf/<tf>/<COIN>.json
// usage: node fetchtf.js 5m BTC ETH SOL        (rows [time, o, h, l, c, v], UTC-aligned, forming bar dropped)
const fs = require('fs'), path = require('path');
const [tf, ...coins] = process.argv.slice(2);
const SEC = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400 }[tf];
const OUT = path.join(__dirname, 'datatf', tf); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (const c of coins) {
    let start = Date.UTC(2019, 8, 1), rows = [], pages = 0;
    for (;;) {
      const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${c}USDT&interval=${tf}&limit=1500&startTime=${start}`);
      if (r.status === 429 || r.status === 418) { await sleep(30000); continue; }
      const j = await r.json();
      if (!Array.isArray(j)) { console.log(c, 'error', JSON.stringify(j).slice(0, 120)); break; }
      if (!j.length) break;
      for (const k of j) rows.push([k[0] / 1000, +k[1], +k[2], +k[3], +k[4], +k[5]]);
      start = j[j.length - 1][0] + 1;
      if (++pages % 100 === 0) console.log(c, tf, pages, 'pages', rows.length, 'bars');
      if (j.length < 1500) break;
      await sleep(120);
    }
    if (rows.length && rows[rows.length - 1][0] + SEC > Date.now() / 1000) rows.pop();
    let gaps = 0; for (let i = 1; i < rows.length; i++) if (rows[i][0] - rows[i - 1][0] !== SEC) gaps++;
    fs.writeFileSync(path.join(OUT, c + '.json'), JSON.stringify(rows));
    console.log(c, tf, rows.length, 'bars', new Date(rows[0][0] * 1000).toISOString().slice(0, 10), '→', new Date(rows[rows.length - 1][0] * 1000).toISOString().slice(0, 10), 'gaps', gaps);
  }
})();
