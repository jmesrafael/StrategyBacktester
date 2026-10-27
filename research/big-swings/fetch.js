// fetch.js — Binance USDT-M futures 4h klines (public, no key) for the extra coins -> data/<COIN>.json as [t_sec,o,h,l,c,v]
'use strict';
const fs = require('fs'), path = require('path');
const COINS = process.argv.slice(2);
(async () => {
  for (const c of COINS) {
    const f = path.join(__dirname, 'data', c + '.json'), out = []; let t = Date.UTC(2019, 8, 1);
    for (;;) {
      const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${c}USDT&interval=4h&startTime=${t}&limit=1500`);
      if (!r.ok) throw new Error(c + ' HTTP ' + r.status);
      const rows = await r.json(); if (!rows.length) break;
      for (const k of rows) out.push([Math.floor(k[0] / 1000), +k[1], +k[2], +k[3], +k[4], +k[5]]);
      t = rows[rows.length - 1][0] + 14400000; if (rows.length < 1500) break;
    }
    const seen = new Set(), ded = out.filter((r) => !seen.has(r[0]) && seen.add(r[0]));
    fs.writeFileSync(f, JSON.stringify(ded)); console.log(c, ded.length, new Date(ded[0][0] * 1000).toISOString().slice(0, 10), new Date(ded[ded.length - 1][0] * 1000).toISOString().slice(0, 10));
  }
})();
