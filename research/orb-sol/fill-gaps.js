// Fill every hole in data/sol-1m.json from Binance futures 1m klines, then report remaining gaps.
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, 'data', 'sol-1m.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function jget(u) { for (let i = 0; i < 6; i++) { try { const r = await fetch(u); if (r.ok) return await r.json(); await sleep(3000 * (i + 1)); } catch (e) { await sleep(3000 * (i + 1)); } } throw new Error(u); }
(async () => {
  const m = JSON.parse(fs.readFileSync(F));
  const gaps = []; for (let i = 1; i < m.length; i++) if (m[i][0] - m[i - 1][0] > 60) gaps.push([m[i - 1][0] + 60, m[i][0]]);
  console.log('gaps', gaps.length, 'missing min', gaps.reduce((a, g) => a + (g[1] - g[0]) / 60, 0));
  const add = []; let req = 0;
  for (const [a, b] of gaps) {
    let s = a;
    while (s < b) {
      const j = await jget(`https://fapi.binance.com/fapi/v1/klines?symbol=SOLUSDT&interval=1m&limit=1500&startTime=${s * 1000}&endTime=${(b - 60) * 1000}`);
      req++;
      if (!j.length) break;
      for (const k of j) { const t = k[0] / 1000; if (t < b) add.push([t, +k[1], +k[2], +k[3], +k[4]]); }
      s = j.at(-1)[0] / 1000 + 60;
      await sleep(120);
    }
    if (req % 100 < 2) console.log('req', req, 'added', add.length);
  }
  const all = m.concat(add).sort((x, y) => x[0] - y[0]);
  const out = []; for (const r of all) if (!out.length || out.at(-1)[0] !== r[0]) out.push(r);
  fs.writeFileSync(F, JSON.stringify(out));
  let g = 0, big = []; for (let i = 1; i < out.length; i++) if (out[i][0] - out[i - 1][0] > 60) { g++; if (out[i][0] - out[i - 1][0] > 600) big.push(new Date(out[i - 1][0] * 1e3).toISOString() + ' ' + (out[i][0] - out[i - 1][0]) / 60 + 'm'); }
  console.log('done', out.length, 'bars; remaining gaps', g, big.slice(0, 20));
})();
