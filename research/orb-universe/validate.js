// Validate the data set and write data/MANIFEST.json.   node validate.js [COINS]
// Checks per coin and timeframe: strictly increasing times, no duplicates, OHLC sanity (l<=o,c<=h, >0),
// gaps (missing bars), closed-only (last bar closes before now), and a cross-check that rebuilds 1h/4h
// candles from the 1m series and compares O/H/L/C with the downloaded 1h/4h bars.
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, 'data');
const DEFAULT = 'SOL,ADA,NEAR,GALA,ZEC,BTC,ETH,BNB,XRP,DOGE,AVAX,LINK,DOT,SUI'.split(',');
const COINS = process.argv[2] ? process.argv[2].split(',') : DEFAULT;
const rd = f => fs.existsSync(path.join(D, f)) ? JSON.parse(fs.readFileSync(path.join(D, f))) : null;
const iso = t => new Date(t * 1e3).toISOString().slice(0, 16).replace('T', ' ');
const now = Math.floor(Date.now() / 1000);

function check(rows, secs) {
  const r = { n: rows.length, first: iso(rows[0][0]), last: iso(rows.at(-1)[0]), dup: 0, order: 0, badOHLC: 0, gaps: 0, missing: 0, maxGapH: 0, open: 0, zeroVol: 0 };
  for (let i = 0; i < rows.length; i++) {
    const [t, o, h, l, c, v] = rows[i];
    if (!(o > 0 && h > 0 && l > 0 && c > 0) || l > Math.min(o, c) + 1e-12 || h < Math.max(o, c) - 1e-12 || h < l) r.badOHLC++;
    if (v === 0) r.zeroVol++;
    if (i) {
      const d = t - rows[i - 1][0];
      if (d === 0) r.dup++; else if (d < 0) r.order++;
      else if (d > secs) { r.gaps++; r.missing += d / secs - 1; r.maxGapH = Math.max(r.maxGapH, (d - secs) / 3600); }
    }
  }
  if (rows.at(-1)[0] + secs > now) r.open = 1;
  return r;
}
// rebuild a higher-TF candle from 1m rows (only when every minute of the bar is present)
function rebuild(m, secs, htf) {
  const idx = new Map(); // 1m open time -> index
  for (let i = 0; i < m.length; i++) idx.set(m[i][0], i);
  let cmp = 0, bad = 0, skipped = 0, worst = 0; const ex = [];
  const mins = secs / 60;
  for (const b of htf) {
    const i0 = idx.get(b[0]); if (i0 === undefined || i0 + mins > m.length || m[i0 + mins - 1][0] !== b[0] + secs - 60) { skipped++; continue; }
    let h = -Infinity, l = Infinity;
    for (let k = i0; k < i0 + mins; k++) { if (m[k][2] > h) h = m[k][2]; if (m[k][3] < l) l = m[k][3]; }
    const o = m[i0][1], c = m[i0 + mins - 1][4];
    const e = Math.max(Math.abs(o - b[1]), Math.abs(h - b[2]), Math.abs(l - b[3]), Math.abs(c - b[4])) / b[4];
    cmp++; if (e > worst) worst = e;
    if (e > 1e-9) { bad++; if (ex.length < 3) ex.push(iso(b[0])); }
  }
  return { compared: cmp, mismatches: bad, skippedIncomplete: skipped, worstRelErr: worst, examples: ex };
}

const man = { generated: new Date().toISOString(), source: 'Binance USDT-M perpetual futures (fapi), closed candles only', coins: {} };
let allOk = true;
for (const c of COINS) {
  const e = man.coins[c] = {};
  for (const [iv, secs] of [['1h', 3600], ['4h', 14400], ['1m', 60]]) {
    const rows = rd(`${c}-${iv}.json`);
    if (!rows) { e[iv] = 'MISSING'; continue; }
    e[iv] = check(rows, secs);
    if (iv === '1m') {
      const h1 = rd(`${c}-1h.json`), h4 = rd(`${c}-4h.json`);
      e.xcheck1h = rebuild(rows, 3600, h1); e.xcheck4h = rebuild(rows, 14400, h4);
    }
  }
  const f = rd(`${c}-funding.json`); e.funding = f ? { n: f.length, first: iso(f[0][0]), last: iso(f.at(-1)[0]) } : 'MISSING';
  const bad = ['1h', '4h', '1m'].some(iv => e[iv] && e[iv].n && (e[iv].dup || e[iv].order || e[iv].badOHLC || e[iv].open)) ||
    (e.xcheck1h && e.xcheck1h.mismatches) || (e.xcheck4h && e.xcheck4h.mismatches);
  e.status = bad ? 'CHECK' : (e['1m'] === 'MISSING' || e['1m'] === undefined ? 'HTF-ONLY' : 'OK');
  if (bad) allOk = false;
  const s = x => x && x.n ? `${x.n} bars ${x.first}..${x.last} gaps ${x.gaps} (missing ${x.missing}, max ${x.maxGapH.toFixed(1)}h) bad ${x.badOHLC}` : String(x);
  console.log(`${c.padEnd(5)} ${e.status}\n   1h ${s(e['1h'])}\n   4h ${s(e['4h'])}\n   1m ${s(e['1m'])}`);
  if (e.xcheck1h) console.log(`   rebuild 1m->1h: ${e.xcheck1h.compared} bars compared, ${e.xcheck1h.mismatches} mismatch, ${e.xcheck1h.skippedIncomplete} skipped (worst ${e.xcheck1h.worstRelErr.toExponential(1)})` +
    `\n   rebuild 1m->4h: ${e.xcheck4h.compared} compared, ${e.xcheck4h.mismatches} mismatch, ${e.xcheck4h.skippedIncomplete} skipped`);
}
fs.writeFileSync(path.join(D, 'MANIFEST.json'), JSON.stringify(man, null, 1));
console.log(allOk ? '\nALL OK' : '\nSOME COINS NEED A LOOK (see above)');
