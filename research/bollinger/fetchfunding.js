// fetchfunding.js — Binance USDT-M funding rate history -> datafund/<COIN>.json ([[time_sec, rate], ...]). usage: node fetchfunding.js SOL DOGE ZEC
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'datafund'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (const c of process.argv.slice(2)) {
    let start = Date.UTC(2019, 8, 1), rows = [];
    for (;;) {
      const r = await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${c}USDT&startTime=${start}&limit=1000`);
      if (r.status === 429 || r.status === 418) { await sleep(30000); continue; }
      const j = await r.json();
      if (!Array.isArray(j)) { console.log(c, 'error', JSON.stringify(j).slice(0, 120)); break; }
      if (!j.length) break;
      for (const k of j) rows.push([Math.round(k.fundingTime / 1000), +k.fundingRate]);
      start = j[j.length - 1].fundingTime + 1;
      if (j.length < 1000) break;
      await sleep(150);
    }
    fs.writeFileSync(path.join(OUT, c + '.json'), JSON.stringify(rows));
    const avg = rows.reduce((a, r) => a + r[1], 0) / rows.length;
    console.log(c, rows.length, 'events', new Date(rows[0][0] * 1000).toISOString().slice(0, 10), '→', new Date(rows[rows.length - 1][0] * 1000).toISOString().slice(0, 10), 'mean rate per event', (avg * 100).toFixed(4) + '%');
  }
})();
