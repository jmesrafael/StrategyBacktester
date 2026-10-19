// fetchq.js — download Bybit linear-perp klines and keep EVERY raw row, so duplicate timestamps can be audited.
// usage: node fetchq.js <SYMBOL> <interval-min> <startISO> <endISO> <outFile>
// writes <outFile> (deduplicated, sorted [t, o, h, l, c, v]) and <outFile>.raw.json (all rows as returned).
const fs = require('fs');
const [sym, iv, startISO, endISO, out] = process.argv.slice(2);
const start = Date.parse(startISO), end = Date.parse(endISO), ivMs = +iv * 60000;

(async () => {
  const raw = [];
  for (let cursor = start; cursor < end; cursor += 1000 * ivMs) {
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym}&interval=${iv}` +
      `&start=${cursor}&end=${Math.min(end - 1, cursor + 1000 * ivMs - 1)}&limit=1000`;
    let j;
    for (let t = 0; t < 6; t++) {
      try { j = await (await fetch(url)).json(); if (j.retCode === 0) break; } catch {}
      await new Promise((r) => setTimeout(r, 1000 * (t + 1)));
    }
    if (!j || j.retCode !== 0) throw new Error('fetch failed at ' + new Date(cursor).toISOString());
    for (const k of j.result.list) {
      const t = +k[0];
      if (t >= start && t < end) raw.push([t / 1000, +k[1], +k[2], +k[3], +k[4], +k[5]]);
    }
    await new Promise((r) => setTimeout(r, 60));
  }
  const byT = new Map();
  for (const r of raw) if (!byT.has(r[0])) byT.set(r[0], r);
  const arr = [...byT.values()].sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(out, JSON.stringify(arr));
  fs.writeFileSync(out + '.raw.json', JSON.stringify(raw));
  console.log(sym, iv + 'm', 'raw rows', raw.length, 'unique', arr.length,
    'first', arr.length ? new Date(arr[0][0] * 1000).toISOString() : '-', 'last', arr.length ? new Date(arr[arr.length - 1][0] * 1000).toISOString() : '-');
})();
