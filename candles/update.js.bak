// Local candle library updater: Binance USDT-M perpetual futures (fapi), public endpoints only.
//   node update.js              update every coin in coins.json (only new closed bars are downloaded)
//   node update.js XYZ,ABC      update / add just these coins
//   node update.js --full SOL   throw away the stored 1h/4h/funding files and re-download that coin from listing
//   node update.js --no-1m      skip the 1m series (1h/4h/funding only, a few seconds)
//   node update.js --fill-gaps  also re-request every hole inside the 1m series (holes Binance cannot fill are real exchange downtime)
// Layout: binance-futures/1h/<COIN>.json, 4h/<COIN>.json  rows [openTimeSec, o, h, l, c, volume]
//         binance-futures/1m/<COIN>.json                  rows [openTimeSec, o, h, l, c]  (fills / stops; ~130 MB per coin)
//         binance-futures/funding/<COIN>.json             rows [fundingTimeSec, rate]
// The 1m series also back-fills its head: if it starts after the coin's first 1h bar, the missing early minutes are fetched.
// Rules that keep the data honest:
//  * only CLOSED candles are stored (the forming bar is never written)
//  * existing bars are never rewritten; the last stored bar is re-fetched and must match exactly,
//    otherwise the coin is flagged (exchange revised history) and left untouched
//  * after every update the series is checked for duplicates, out-of-order rows, gaps and bad OHLC
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, 'binance-futures');
const TF = [['1h', 3600], ['4h', 14400]];
const LISTING_ERA = 1567900800; // 2019-09-08, first Binance USDT-M perp; the API starts each coin at its own listing
const args = process.argv.slice(2), full = args.includes('--full'), no1m = args.includes('--no-1m'), fillGaps = args.includes('--fill-gaps');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'coins.json')));
const list = args.filter(a => !a.startsWith('--'));
const COINS = (list.length ? list.join(',').split(',') : [...cfg.bots, ...cfg.extra]).map(s => s.trim().toUpperCase()).filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let last = 0;
async function jget(u) {
  for (let i = 0; i < 8; i++) {
    const w = 260 - (Date.now() - last); if (w > 0) await sleep(w); last = Date.now();
    let r;
    try { r = await fetch(u); } catch (e) { await sleep(2000 * (i + 1)); continue; }
    if (r.ok) return r.json();
    if (r.status === 429 || r.status === 418) { await sleep(+(r.headers.get('retry-after') || 30) * 1000); continue; }
    if (r.status === 400) throw new Error(`400 ${await r.text()} ${u}`);
    await sleep(2000 * (i + 1));
  }
  throw new Error('fetch failed ' + u);
}
const nowSec = () => Math.floor(Date.now() / 1000);
// endSec (optional, exclusive): stop before this open time. 1m rows carry no volume (same format as the research 1m files).
async function klines(sym, iv, secs, startSec, endSec) {
  const out = []; let s = startSec; const now = nowSec(), vol = iv !== '1m';
  while (endSec == null || s < endSec) {
    const j = await jget(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${iv}&limit=1500&startTime=${s * 1000}` + (endSec != null ? `&endTime=${(endSec - secs) * 1000}` : ''));
    if (!j.length) break;
    for (const k of j) {
      const t = k[0] / 1000;
      if (t + secs <= now && (endSec == null || t < endSec)) out.push(vol ? [t, +k[1], +k[2], +k[3], +k[4], +k[5]] : [t, +k[1], +k[2], +k[3], +k[4]]);
    }
    const l = j[j.length - 1][0] / 1000;
    if (j.length < 1500 || l + secs > now) break;
    s = l + secs;
  }
  return out;
}
const dedupe = rows => { rows.sort((a, b) => a[0] - b[0]); const o = []; for (const r of rows) if (!o.length || o.at(-1)[0] !== r[0]) o.push(r); return o; };
// 1m: head back-fill, optional hole fill, tail append (tail must match exactly)
async function update1m(c, sym, e) {
  const F = path.join(ROOT, '1m', `${c}.json`), h1 = rd(path.join(ROOT, '1h', `${c}.json`));
  if (!h1.length) throw new Error('1m needs the 1h file first');
  let rows = rd(F), head = 0, holes = 0, add = 0;
  if (rows.length) {
    const tail = rows.at(-1), fresh = await klines(sym, '1m', 60, tail[0]);
    if (!fresh.length || !same(fresh[0], tail)) {
      console.log(`${c} 1m: last stored minute ${iso(tail[0])} does not match the exchange now; NOT updated`);
      e['1m'] = { ...(e['1m'] || {}), flag: 'tail-mismatch' }; return 1;
    }
    add = fresh.length - 1; rows = rows.concat(fresh.slice(1));
    if (rows[0][0] > h1[0][0]) { const a = await klines(sym, '1m', 60, h1[0][0], rows[0][0]); head = a.length; rows = a.concat(rows); }
  } else { rows = await klines(sym, '1m', 60, h1[0][0]); add = rows.length; }
  if (fillGaps) {
    const gaps = []; for (let i = 1; i < rows.length; i++) if (rows[i][0] - rows[i - 1][0] > 60) gaps.push([rows[i - 1][0] + 60, rows[i][0]]);
    const got = []; for (const [a, b] of gaps) got.push(...await klines(sym, '1m', 60, a, b));
    holes = got.length; if (got.length) rows = dedupe(rows.concat(got));
  }
  const q = check(rows, 60);
  fs.writeFileSync(F, JSON.stringify(rows));   // written in place (keeps hard links elsewhere pointing at the same data)
  e['1m'] = { bars: rows.length, first: iso(rows[0][0]), last: iso(rows.at(-1)[0]), ...q, updated: new Date().toISOString() };
  console.log(`${c.padEnd(5)} 1m  +${add}${head ? ' head +' + head : ''}${fillGaps ? ' holes filled +' + holes : ''}  ${rows.length} bars  ${e['1m'].first} -> ${e['1m'].last}  gaps ${q.gaps} (${q.missing} min)${q.dup || q.order || q.bad ? '  !! dup ' + q.dup + ' order ' + q.order + ' badOHLC ' + q.bad : ''}`);
  return q.dup || q.order || q.bad ? 1 : 0;
}
const rd = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [];
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const iso = t => new Date(t * 1e3).toISOString().slice(0, 16).replace('T', ' ');
function check(rows, secs) {
  let dup = 0, order = 0, gaps = 0, missing = 0, bad = 0;
  for (let i = 0; i < rows.length; i++) {
    const [t, o, h, l, c] = rows[i];
    if (!(o > 0 && h > 0 && l > 0 && c > 0) || l > Math.min(o, c) || h < Math.max(o, c)) bad++;
    if (i) { const d = t - rows[i - 1][0]; if (d === 0) dup++; else if (d < 0) order++; else if (d > secs) { gaps++; missing += d / secs - 1; } }
  }
  return { dup, order, gaps, missing, bad };
}
(async () => {
  for (const d of ['1h', '4h', '1m', 'funding']) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
  const manF = path.join(ROOT, 'MANIFEST.json');
  const man = fs.existsSync(manF) ? JSON.parse(fs.readFileSync(manF)) : { source: 'Binance USDT-M perpetual futures (fapi.binance.com), closed candles only', coins: {} };
  let problems = 0;
  for (const c of COINS) {
    const sym = c + 'USDT', e = man.coins[c] = man.coins[c] || {};
    try {
      for (const [iv, secs] of TF) {
        const F = path.join(ROOT, iv, `${c}.json`);
        let rows = full ? [] : rd(F), added = 0;
        if (!rows.length) { rows = await klines(sym, iv, secs, LISTING_ERA); added = rows.length; }
        else {
          const tail = rows.at(-1), fresh = await klines(sym, iv, secs, tail[0]);
          if (!fresh.length || fresh[0][0] !== tail[0] || !same(fresh[0], tail)) {
            console.log(`${c} ${iv}: last stored bar ${iso(tail[0])} does not match the exchange now; NOT updated (run --full ${c} to rebuild)`);
            problems++; e[iv] = { ...(e[iv] || {}), flag: 'tail-mismatch' }; continue;
          }
          const add = fresh.slice(1); rows = rows.concat(add); added = add.length;
        }
        if (!rows.length) throw new Error('no data (symbol not on Binance futures?)');
        const q = check(rows, secs);
        if (q.dup || q.order || q.bad) problems++;
        fs.writeFileSync(F, JSON.stringify(rows));
        e[iv] = { bars: rows.length, first: iso(rows[0][0]), last: iso(rows.at(-1)[0]), ...q, updated: new Date().toISOString() };
        console.log(`${c.padEnd(5)} ${iv}  +${String(added).padStart(5)}  ${rows.length} bars  ${e[iv].first} -> ${e[iv].last}  gaps ${q.gaps} (${q.missing} bars)${q.dup || q.order || q.bad ? '  !! dup ' + q.dup + ' order ' + q.order + ' badOHLC ' + q.bad : ''}`);
      }
      const FF = path.join(ROOT, 'funding', `${c}.json`);
      const fund = full ? [] : rd(FF); let s = fund.length ? (fund.at(-1)[0] + 1) * 1000 : LISTING_ERA * 1000, nf = 0;
      while (true) {
        const j = await jget(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1000&startTime=${s}`);
        if (!j.length) break;
        for (const f of j) { const t = Math.round(f.fundingTime / 1000); if (!fund.length || t > fund.at(-1)[0]) { fund.push([t, +f.fundingRate]); nf++; } }
        if (j.length < 1000) break; s = j.at(-1).fundingTime + 1;
      }
      fs.writeFileSync(FF, JSON.stringify(fund));
      e.funding = { rows: fund.length, first: iso(fund[0][0]), last: iso(fund.at(-1)[0]) };
      console.log(`${c.padEnd(5)} funding +${nf}  ${fund.length} rows`);
      if (!no1m) problems += await update1m(c, sym, e);
    } catch (err) { problems++; console.log(`${c}: ERROR ${err.message}`); }
  }
  man.updated = new Date().toISOString();
  fs.writeFileSync(manF, JSON.stringify(man, null, 1));
  console.log(problems ? `\n${problems} problem(s), see above` : '\nall up to date, no problems');
})();
