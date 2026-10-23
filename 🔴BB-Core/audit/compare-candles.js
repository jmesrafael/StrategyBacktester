// compare-candles.js — candle-by-candle comparison of the STORED data/ files against a fresh download (public endpoints, no key).
//   node audit/compare-candles.js SOL,ZEC            Binance USDT-M futures  vs data/<COIN>.json          (detects historical revisions)
//   node audit/compare-candles.js SOL,ZEC --mexc     MEXC contract           vs data/MEXC_<COIN>.json
//   node audit/compare-candles.js SOL,ZEC --cross    fresh Binance vs fresh MEXC over the last ~2000 candles (venue basis)
// Reports: missing / extra / duplicate candles, any OHLC difference > tol, the largest differences, and the still-forming candle if present.
'use strict';
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), COINS = (args[0] || 'SOL,ZEC').split(','), MEXC = args.includes('--mexc'), CROSS = args.includes('--cross');
const D = path.join(__dirname, '..', 'data'), SEC = 14400, TOL = 1e-9;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function binance(c, startMs) {
  const rows = []; let s = startMs;
  for (;;) {
    const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${c}USDT&interval=4h&limit=1500&startTime=${s}`), j = await r.json();
    if (!Array.isArray(j)) throw new Error('binance: ' + JSON.stringify(j).slice(0, 100));
    if (!j.length) break; for (const k of j) rows.push([k[0] / 1000, +k[1], +k[2], +k[3], +k[4], +k[5]]);
    s = j[j.length - 1][0] + 1; if (j.length < 1500) break; await sleep(150);
  }
  return rows;
}
async function mexc(c, fromSec) {
  const m = new Map(); let end = Math.floor(Date.now() / 1000);
  for (let p = 0; p < 40 && end > fromSec; p++) {
    const r = await fetch(`https://contract.mexc.com/api/v1/contract/kline/${c}_USDT?interval=Hour4&start=${end - 1999 * SEC}&end=${end}`), j = await r.json();
    const d = j && j.data, t = (d && d.time) || []; if (!t.length) break;
    t.forEach((x, i) => m.set(x, [x, +d.open[i], +d.high[i], +d.low[i], +d.close[i], +d.vol[i]])); end = t[0] - 1; await sleep(250);
  }
  return [...m.values()].sort((a, b) => a[0] - b[0]);
}
function diff(label, A, B, fromT) {
  const a = new Map(A.filter((r) => r[0] >= fromT).map((r) => [r[0], r])), b = new Map(B.filter((r) => r[0] >= fromT).map((r) => [r[0], r]));
  const lastA = Math.max(...a.keys()), lastB = Math.max(...b.keys());
  const common = [...a.keys()].filter((t) => b.has(t)), onlyA = [...a.keys()].filter((t) => !b.has(t)), onlyB = [...b.keys()].filter((t) => !a.has(t));
  const dev = common.map((t) => { const x = a.get(t), y = b.get(t); return { t, o: Math.abs(x[1] / y[1] - 1), h: Math.abs(x[2] / y[2] - 1), l: Math.abs(x[3] / y[3] - 1), c: Math.abs(x[4] / y[4] - 1) }; });
  const bad = dev.filter((d) => Math.max(d.o, d.h, d.l, d.c) > TOL).sort((p, q) => Math.max(q.o, q.h, q.l, q.c) - Math.max(p.o, p.h, p.l, p.c));
  const pct = (v) => (v * 100).toFixed(3) + '%', iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);
  console.log(`${label}: ${common.length} common candles | only-A ${onlyA.length} | only-B ${onlyB.length} | OHLC differing ${bad.length} (${(100 * bad.length / Math.max(1, common.length)).toFixed(2)}%)`);
  if (onlyA.length) console.log('   only in A (first 5):', onlyA.slice(0, 5).map(iso).join(', '));
  if (onlyB.length) console.log('   only in B (first 5):', onlyB.slice(0, 5).map(iso).join(', '), ` | B newest ${iso(lastB)}, A newest ${iso(lastA)}`);
  for (const d of bad.slice(0, 5)) console.log(`   ${iso(d.t)} dO ${pct(d.o)} dH ${pct(d.h)} dL ${pct(d.l)} dC ${pct(d.c)}`);
  const cd = dev.map((d) => d.c).sort((p, q) => p - q); if (cd.length) console.log(`   |close diff| median ${pct(cd[cd.length >> 1])}  p99 ${pct(cd[Math.floor(cd.length * .99)])}  max ${pct(cd[cd.length - 1])}`);
  return bad.length;
}
(async () => {
  for (const c of COINS) {
    if (CROSS) { const [b, m] = [await binance(c, Date.now() - 2000 * SEC * 1000), await mexc(c, Math.floor(Date.now() / 1000) - 2000 * SEC)]; diff(`${c} fresh Binance (A) vs fresh MEXC (B)`, b, m, 0); continue; }
    const stored = JSON.parse(fs.readFileSync(path.join(D, (MEXC ? 'MEXC_' : '') + c + '.json'), 'utf8'));
    const fresh = MEXC ? await mexc(c, stored[0][0]) : await binance(c, stored[0][0] * 1000);
    diff(`${c} stored (A) vs fresh ${MEXC ? 'MEXC' : 'Binance'} (B)`, stored, fresh, stored[0][0]);
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
