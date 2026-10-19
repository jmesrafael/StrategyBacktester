// fetchBinance.js — Binance USDT-M futures (perp) klines, saved as [t,o,h,l,c,v] (t in seconds, volume in coins).
// usage: node fetchBinance.js <SYMBOL e.g. SOLUSDT> <15m|1m|...> <startISO> <endISO> <outFile>
const fs = require('fs');
const [sym, iv, startISO, endISO, out] = process.argv.slice(2);
const MS = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '1h': 3600e3 }[iv];
const end = Date.parse(endISO);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(u);
      if (r.ok) return await r.json();
      const wait = (+r.headers.get('retry-after') || 0) * 1000 || Math.min(120e3, 5000 * (i + 1));
      console.error('HTTP', r.status, '— waiting', wait / 1000, 's');
      await sleep(wait); continue;
    } catch {}
    await sleep(2000 * (i + 1));
  }
  throw new Error('Binance failed ' + u);
};
(async () => {
  const m = new Map(); let t = Date.parse(startISO);
  while (t < end) {
    const d = await get(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${iv}&startTime=${t}&endTime=${end - 1}&limit=1500`);
    if (!d.length) break;
    for (const k of d) if (k[0] < end) m.set(k[0], [k[0] / 1000, +k[1], +k[2], +k[3], +k[4], +k[5]]);
    t = d[d.length - 1][0] + MS;
    await sleep(MS < 900e3 ? 300 : 80); // 1m pulls are long: stay well under the weight limit
  }
  const arr = [...m.values()].sort((a, b) => a[0] - b[0]);
  let gaps = 0, missing = 0, bad = 0;
  for (let i = 1; i < arr.length; i++) { const g = (arr[i][0] - arr[i - 1][0]) * 1000 / MS - 1; if (g > 0) { gaps++; missing += g; } }
  for (const [, o, h, l, c] of arr) if (!(h >= Math.max(o, c) && l <= Math.min(o, c) && l > 0)) bad++;
  fs.writeFileSync(out, JSON.stringify(arr));
  console.log(sym, iv, 'bars', arr.length, new Date(arr[0][0] * 1000).toISOString(), '→', new Date(arr[arr.length - 1][0] * 1000).toISOString(), '| gaps', gaps, 'missing bars', missing, 'broken candles', bad);
})();
