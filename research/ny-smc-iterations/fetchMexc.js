// fetchMexc.js — MEXC USDT-M perpetual klines (same endpoint the app's js/mexc.js uses), saved as [t,o,h,l,c,v] with volume in coins.
// usage: node fetchMexc.js <SYMBOL e.g. SOL_USDT> <Min15|Min5|...> <startISO> <endISO> <outFile>
const fs = require('fs');
const [sym, code, startISO, endISO, out] = process.argv.slice(2);
const SEC = { Min1: 60, Min5: 300, Min15: 900, Min30: 1800, Min60: 3600 }[code];
const start = Date.parse(startISO) / 1000, end0 = Date.parse(endISO) / 1000;
const get = async (p) => { for (let i = 0; i < 6; i++) { try { const j = await (await fetch('https://contract.mexc.com' + p)).json(); if (j.success) return j.data; } catch {} await new Promise((r) => setTimeout(r, 700 * (i + 1))); } throw new Error('MEXC failed ' + p); };
(async () => {
  const size = +(await get('/api/v1/contract/detail?symbol=' + sym)).contractSize || 1;
  const m = new Map(); let end = end0 - 1, empty = 0;
  while (end > start) {
    const s = end - 1999 * SEC;
    const d = await get(`/api/v1/contract/kline/${sym}?interval=${code}&start=${Math.max(s, start)}&end=${end}`);
    const t = (d && d.time) || [];
    if (!t.length) { if (++empty >= 3) break; end = s - 1; continue; }
    empty = 0;
    for (let i = 0; i < t.length; i++) if (t[i] >= start && t[i] < end0) m.set(t[i], [t[i], +d.open[i], +d.high[i], +d.low[i], +d.close[i], +d.vol[i] * size]);
    end = t[0] - 1;
    await new Promise((r) => setTimeout(r, 120));
  }
  const arr = [...m.values()].sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(out, JSON.stringify(arr));
  console.log(sym, code, 'contractSize', size, 'bars', arr.length, arr.length ? new Date(arr[0][0] * 1000).toISOString() + ' → ' + new Date(arr[arr.length - 1][0] * 1000).toISOString() : '');
})();
