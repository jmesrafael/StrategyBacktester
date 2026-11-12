// Build continuous 1m files from Binance's bulk archive (data.binance.vision, no API weight).
// node vision-1m.js BTC,ETH,XRP  -> ../orb-universe/data/<COIN>-1m.json  rows [t,o,h,l,c]
// Monthly zips up to last month, daily zips for this month, then the API for the last few hours.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const OUT = path.join(__dirname, '../orb-universe/data');
const TMP = process.env.VISION_TMP; if (!TMP) throw new Error('set VISION_TMP to an empty download dir');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function dl(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return true;
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(url); if (r.status === 404) return false; if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return true; } } catch (e) {}
    await sleep(2000 * (i + 1));
  }
  throw new Error('download failed ' + url);
}
function parseCsv(txt, rows) {
  for (const line of txt.split('\n')) {
    if (!line || line[0] < '0' || line[0] > '9') continue;          // header
    const p = line.split(',');
    let t = +p[0]; t = t > 1e14 ? Math.floor(t / 1e6) : Math.floor(t / 1e3);   // us or ms
    rows.push([t, +p[1], +p[2], +p[3], +p[4]]);
  }
}
(async () => {
  const coins = (process.argv[2] || 'BTC,ETH,XRP').split(',');
  const now = new Date(), nowSec = Math.floor(now / 1000);
  for (const c of coins) {
    const sym = c + 'USDT', dir = path.join(TMP, c); fs.mkdirSync(dir, { recursive: true });
    const first = JSON.parse(fs.readFileSync(path.join(OUT, `${c}-1h.json`)))[0][0];
    const jobs = [];
    for (let d = new Date(Date.UTC(new Date(first * 1e3).getUTCFullYear(), new Date(first * 1e3).getUTCMonth(), 1)); d < new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); d.setUTCMonth(d.getUTCMonth() + 1)) {
      const ym = d.toISOString().slice(0, 7);
      jobs.push([`https://data.binance.vision/data/futures/um/monthly/klines/${sym}/1m/${sym}-1m-${ym}.zip`, path.join(dir, `m-${ym}.zip`)]);
    }
    for (let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); d < new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); d.setUTCDate(d.getUTCDate() + 1)) {
      const ymd = d.toISOString().slice(0, 10);
      jobs.push([`https://data.binance.vision/data/futures/um/daily/klines/${sym}/1m/${sym}-1m-${ymd}.zip`, path.join(dir, `d-${ymd}.zip`)]);
    }
    let k = 0; const got = [];
    await Promise.all([...Array(6)].map(async () => { while (k < jobs.length) { const j = jobs[k++]; if (await dl(...j)) got.push(j[1]); } }));
    const rows = [];
    for (const z of got.sort()) {
      const x = path.join(dir, 'x'); fs.rmSync(x, { recursive: true, force: true }); fs.mkdirSync(x);
      execFileSync('C:/Windows/System32/tar.exe', ['-xf', z, '-C', x]);
      for (const f of fs.readdirSync(x)) if (f.endsWith('.csv')) parseCsv(fs.readFileSync(path.join(x, f), 'utf8'), rows);
    }
    // top up today's closed minutes from the API (a handful of requests)
    let s = rows.length ? rows.at(-1)[0] + 60 : first;
    while (s + 60 <= nowSec) {
      const j = await (await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=1m&limit=1000&startTime=${s * 1000}`)).json();
      if (!j.length) break;
      for (const q of j) { const t = q[0] / 1000; if (t + 60 <= nowSec) rows.push([t, +q[1], +q[2], +q[3], +q[4]]); }
      s = j.at(-1)[0] / 1000 + 60; await sleep(400);
      if (j.length < 1000) break;
    }
    rows.sort((a, b) => a[0] - b[0]);
    const out = []; for (const r of rows) if (r[0] >= first && (!out.length || out.at(-1)[0] !== r[0])) out.push(r);
    let gaps = 0, missing = 0; for (let i = 1; i < out.length; i++) { const g = out[i][0] - out[i - 1][0]; if (g !== 60) { gaps++; missing += g / 60 - 1; } }
    const F = path.join(OUT, `${c}-1m.json`);
    if (fs.existsSync(F)) { console.log(c, 'file appeared meanwhile, not overwriting'); continue; }
    fs.writeFileSync(F + '.tmp', JSON.stringify(out)); fs.renameSync(F + '.tmp', F);
    console.log(c, out.length, 'bars', new Date(out[0][0] * 1e3).toISOString().slice(0, 16), '->', new Date(out.at(-1)[0] * 1e3).toISOString().slice(0, 16), 'gaps', gaps, 'missing min', missing, 'files', got.length + '/' + jobs.length);
  }
})();
