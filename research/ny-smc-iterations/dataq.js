// dataq.js — data-quality audit for a candle file: gaps, duplicates, OHLC sanity, volume consistency.
// usage: node dataq.js <file.json> [<file.json.raw.json>]   (prints markdown)
const fs = require('fs');
const [file, rawFile] = process.argv.slice(2);
const A = JSON.parse(fs.readFileSync(file, 'utf8'));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const step = A[1][0] - A[0][0];
const out = [`### ${file.split(/[\\/]/).pop()}`, '',
  `- ${A.length} candles, ${iso(A[0][0])} → ${iso(A[A.length - 1][0])} UTC, step ${step / 60} min`];
// duplicates in the raw download
if (rawFile && fs.existsSync(rawFile)) {
  const raw = JSON.parse(fs.readFileSync(rawFile, 'utf8')), seen = new Map(); let dup = 0, dupDiff = 0;
  for (const r of raw) { const k = r[0]; if (seen.has(k)) { dup++; if (JSON.stringify(seen.get(k)) !== JSON.stringify(r)) dupDiff++; } else seen.set(k, r); }
  out.push(`- duplicate timestamps in the raw download: ${dup} (with differing values: ${dupDiff})`);
}
// gaps
const gaps = [];
for (let i = 1; i < A.length; i++) { const d = A[i][0] - A[i - 1][0]; if (d !== step) gaps.push([A[i - 1][0], A[i][0], d / step - 1]); }
out.push(`- gaps (missing candles): ${gaps.length}` + (gaps.length ? '' : ' — none'));
for (const [a, b, n] of gaps.slice(0, 30)) out.push(`  - after ${iso(a)} → next ${iso(b)}: ${n} candle(s) missing${n > 1 ? ' **(> 1 candle)**' : ''}`);
const back = A.filter((r, i) => i && r[0] <= A[i - 1][0]).length;
out.push(`- out-of-order / non-increasing timestamps: ${back}`);
// OHLC sanity
let bad = 0, flat = 0, zeroV = 0, nonPos = 0;
for (const [, o, h, l, c, v] of A) {
  if (h < Math.max(o, c) - 1e-12 || l > Math.min(o, c) + 1e-12 || h < l) bad++;
  if (o === h && h === l && l === c) flat++;
  if (!(v > 0)) zeroV++;
  if (!(o > 0 && h > 0 && l > 0 && c > 0)) nonPos++;
}
out.push(`- OHLC inconsistent (high < max(open, close) or low > min(open, close)): ${bad}; non-positive prices: ${nonPos}`);
out.push(`- zero-volume candles: ${zeroV}; completely flat candles (O=H=L=C): ${flat}`);
// volume consistency: monthly median volume and median (high-low)/close, flag months far from neighbours
const months = new Map();
for (const [t, o, h, l, c, v] of A) { const d = new Date(t * 1000), k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  (months.get(k) || months.set(k, { v: [], r: [] }).get(k)).v.push(v); months.get(k).r.push((h - l) / c); }
const med = (a) => { a = [...a].sort((x, y) => x - y); return a[a.length >> 1]; };
const rows = [...months.entries()].map(([k, m]) => ({ k, v: med(m.v), r: med(m.r), n: m.v.length }));
const flags = rows.filter((x, i) => { const nb = rows.slice(Math.max(0, i - 3), i + 4).filter((y) => y !== x).map((y) => y.v); const m = med(nb); return x.v > 4 * m || x.v < m / 4; });
out.push(`- monthly median volume (base units): min ${Math.min(...rows.map((x) => x.v)).toFixed(1)} (${rows.reduce((p, q) => (q.v < p.v ? q : p)).k}), ` +
  `max ${Math.max(...rows.map((x) => x.v)).toFixed(1)} (${rows.reduce((p, q) => (q.v > p.v ? q : p)).k}); months more than 4× away from their neighbours: ` +
  (flags.length ? flags.map((x) => x.k).join(', ') : 'none'));
out.push(`- median candle range: ${(med(rows.map((x) => x.r)) * 100).toFixed(2)}% (monthly medians ${(Math.min(...rows.map((x) => x.r)) * 100).toFixed(2)}–${(Math.max(...rows.map((x) => x.r)) * 100).toFixed(2)}%)`);
console.log(out.join('\n'));
