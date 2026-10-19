// Download SOLUSDT linear-perpetual klines from Bybit's public v5 API.
// usage: node fetch.js <interval> <startISO> <endISO> <outFile>
const fs = require('fs');
const [iv, startISO, endISO, out] = process.argv.slice(2);
const start = Date.parse(startISO), end = Date.parse(endISO);
const ivMs = (iv === 'D' ? 1440 : +iv) * 60000;

(async () => {
  const bars = new Map();
  let cursor = start;
  while (cursor < end) {
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${process.env.SYMBOL || 'SOLUSDT'}&interval=${iv}` +
      `&start=${cursor}&end=${Math.min(end - 1, cursor + 1000 * ivMs - 1)}&limit=1000`;
    let j;
    for (let t = 0; t < 5; t++) {
      try { j = await (await fetch(url)).json(); if (j.retCode === 0) break; } catch {}
      await new Promise((r) => setTimeout(r, 1000 * (t + 1)));
    }
    if (!j || j.retCode !== 0) throw new Error('fetch failed at ' + cursor);
    for (const k of j.result.list) {
      const t = +k[0];
      if (t >= start && t < end) bars.set(t, [t / 1000, +k[1], +k[2], +k[3], +k[4], +k[5]]);
    }
    cursor += 1000 * ivMs;
    await new Promise((r) => setTimeout(r, 60));
  }
  const arr = [...bars.values()].sort((a, b) => a[0] - b[0]);
  // integrity: count gaps (missing bars)
  let gaps = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i][0] - arr[i - 1][0] !== ivMs / 1000) gaps++;
  fs.writeFileSync(out, JSON.stringify(arr));
  console.log(iv, 'bars', arr.length, 'gaps', gaps, 'first', new Date(arr[0][0] * 1000).toISOString(),
    'last', new Date(arr[arr.length - 1][0] * 1000).toISOString());
})();
