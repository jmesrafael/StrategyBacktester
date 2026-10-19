// fetch1m.js — Bybit linear-perp 1m candles for exactly the windows in which v7 trades were open (+ the fill bar).
// usage: node fetch1m.js   → data/m1-sol.json, data/m1-eth.json  ([t,o,h,l,c] ascending)
const fs = require('fs'), T = require('./trades-windows.js');
const SYM = { SOL: 'SOLUSDT', ETH: 'ETHUSDT' };
const get = async (url) => { for (let i = 0; i < 6; i++) { try { const j = await (await fetch(url)).json(); if (j.retCode === 0) return j.result.list; } catch {} await new Promise((r) => setTimeout(r, 800 * (i + 1))); } throw new Error('fetch failed ' + url); };
(async () => {
  for (const s of ['SOL', 'ETH']) {
    const { D, trades } = T.build(s), win = T.windows(D, trades), m = new Map();
    for (const [a, b] of win) for (let c = a; c < b; c += 1000 * 60) {
      const end = Math.min(b, c + 1000 * 60) - 1;
      const list = await get(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${SYM[s]}&interval=1&start=${c * 1000}&end=${end * 1000}&limit=1000`);
      for (const k of list) { const t = +k[0] / 1000; if (t >= a && t < b) m.set(t, [t, +k[1], +k[2], +k[3], +k[4]]); }
      await new Promise((r) => setTimeout(r, 50));
    }
    const arr = [...m.values()].sort((x, y) => x[0] - y[0]);
    let missing = 0; for (const [a, b] of win) for (let t = a; t < b; t += 60) if (!m.has(t)) missing++;
    fs.writeFileSync(`data/m1-${s.toLowerCase()}.json`, JSON.stringify(arr));
    console.log(s, '1m candles', arr.length, 'expected', win.reduce((x, [a, b]) => x + (b - a) / 60, 0), 'missing', missing);
  }
})();
