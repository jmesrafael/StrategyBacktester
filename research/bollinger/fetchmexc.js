// fetchmexc.js — MEXC USDT-M perpetual 4h klines + funding history for SOL / DOGE / ZEC.
//   klines  -> datatf/4h/MEXC_<COIN>.json   ([time, o, h, l, c, v], forming bar dropped)
//   funding -> datafund/MEXC_<COIN>.json    ([[time_sec, rate], ...])
// usage: node fetchmexc.js SOL DOGE ZEC
const fs = require('fs'), path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => { for (let i = 0; i < 5; i++) { try { const j = await (await fetch(url)).json(); if (j && j.success) return j.data; } catch (e) {} await sleep(1000 * (i + 1)); } throw new Error('MEXC failed: ' + url); };
(async () => {
  fs.mkdirSync(path.join(__dirname, 'datatf', '4h'), { recursive: true }); fs.mkdirSync(path.join(__dirname, 'datafund'), { recursive: true });
  for (const c of process.argv.slice(2)) {
    const sym = c + '_USDT', SEC = 14400, merged = new Map();
    let end = Math.floor(Date.now() / 1000);
    for (let page = 0; page < 40; page++) {
      const d = await get(`https://contract.mexc.com/api/v1/contract/kline/${sym}?interval=Hour4&start=${end - 1999 * SEC}&end=${end}`);
      const t = (d && d.time) || []; if (!t.length) break;
      for (let i = 0; i < t.length; i++) merged.set(t[i], [t[i], +d.open[i], +d.high[i], +d.low[i], +d.close[i], +d.vol[i]]);
      end = t[0] - 1; await sleep(200);
    }
    let rows = [...merged.values()].sort((a, b) => a[0] - b[0]);
    if (rows.length && rows[rows.length - 1][0] + SEC > Date.now() / 1000) rows.pop();
    fs.writeFileSync(path.join(__dirname, 'datatf', '4h', `MEXC_${c}.json`), JSON.stringify(rows));
    let gaps = 0; for (let i = 1; i < rows.length; i++) if (rows[i][0] - rows[i - 1][0] !== SEC) gaps++;
    // funding history (paged, newest first)
    const fund = [];
    for (let p = 1; p < 200; p++) {
      const d = await get(`https://contract.mexc.com/api/v1/contract/funding_rate/history?symbol=${sym}&page_num=${p}&page_size=1000`);
      const list = (d && d.resultList) || []; for (const x of list) fund.push([Math.round(x.settleTime / 1000), +x.fundingRate]);
      if (!list.length || p >= (d.totalPage || 1)) break; await sleep(200);
    }
    fund.sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(path.join(__dirname, 'datafund', `MEXC_${c}.json`), JSON.stringify(fund));
    const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
    console.log(c, 'klines', rows.length, iso(rows[0][0]), '→', iso(rows[rows.length - 1][0]), 'gaps', gaps, '| funding', fund.length, fund.length ? iso(fund[0][0]) + ' → ' + iso(fund[fund.length - 1][0]) : '');
  }
})();
