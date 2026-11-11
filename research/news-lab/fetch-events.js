// Downloads historical USD high-impact economic events (CPI, NFP, FOMC, PPI, GDP, PCE, ...) from
// ForexFactory's monthly calendar pages. Polite: one page every ~4s, resumable (skips months already saved).
//   node research/news-lab/fetch-events.js [fromYYYY-MM] [toYYYY-MM]
'use strict';
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'data', 'ff-usd-high.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function month(y, m) {
  const url = `https://www.forexfactory.com/calendar?month=${MON[m]}.${y}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    // curl, not fetch: ForexFactory's bot protection rejects Node's TLS fingerprint (HTTP 403) but accepts curl.
    let h = '', code = 0;
    try {
      const out = require('child_process').execFileSync('curl', ['-s', '-m', '40', '-A', UA, '-H', 'Accept: text/html', '-H', 'Accept-Language: en-US,en;q=0.9', '-w', '\n%{http_code}', url], { maxBuffer: 64 << 20 }).toString();
      const k = out.lastIndexOf('\n'); h = out.slice(0, k); code = +out.slice(k + 1);
    } catch (e) { code = 0; }
    if (code === 429 || code >= 500 || code === 0) { await sleep(30000 * (attempt + 1)); continue; }
    if (code !== 200) throw new Error(`${url} HTTP ${code}`);
    const out = [];
    for (const m2 of h.matchAll(/\{"id":(\d+),[^{}]*?"name":"([^"]+)"[^{}]*?"dateline":(\d+)[^{}]*?"currency":"USD"[^{}]*?"impactName":"high"[^{}]*?\}/g)) {
      const obj = m2[0], g = (k) => { const x = obj.match(new RegExp(`"${k}":"([^"]*)"`)); return x ? x[1].replace(/\\\//g, '/') : null; };
      out.push({ id: +m2[1], name: m2[2].replace(/\\\//g, '/'), t: +m2[3], actual: g('actual'), forecast: g('forecast'), previous: g('previous') });
    }
    return out;
  }
  throw new Error(`${url} kept failing`);
}

(async () => {
  const [from = '2020-09', to = new Date().toISOString().slice(0, 7)] = process.argv.slice(2);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const db = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { months: {}, events: [] };
  let [y, m] = from.split('-').map(Number); m -= 1;
  const [ty, tm] = to.split('-').map(Number);
  const thisMonth = new Date().toISOString().slice(0, 7);
  while (y < ty || (y === ty && m <= tm - 1)) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    if (!db.months[key] || key === thisMonth) {
      const ev = await month(y, m);
      db.months[key] = ev.length;
      const ids = new Set(ev.map((e) => e.id));
      db.events = db.events.filter((e) => !ids.has(e.id)).concat(ev);
      db.events.sort((a, b) => a.t - b.t);
      fs.writeFileSync(OUT, JSON.stringify(db));
      console.log(key, ev.length, 'events');
      await sleep(4000);
    }
    if (++m === 12) { m = 0; y++; }
  }
  console.log('done', db.events.length, 'events');
})().catch((e) => { console.error(e.message); process.exit(1); });
