// fetch.js — long 4h history for MEXC's liquid tradfi perps (stocks, indices, metals, oil).
//   node fetch.js            -> data4h/<NAME>.json  rows [time, o, h, l, c, v]  (exchange-hours candles only, split-adjusted)
//                               funding/<NAME>.json  MEXC funding history [time, rate]
// Sources: Dukascopy 4h (bid) for long history (gold/oil/indices 2013+, US stocks 2017+);
//          Yahoo 1h -> 4h for markets Dukascopy lacks (2 years only). Splits from Yahoo daily (range=max).
'use strict';
const fs = require('fs'), path = require('path');
const { getHistoricalRates } = require('dukascopy-node');
const OUT = path.join(__dirname, 'data4h'), FUND = path.join(__dirname, 'funding');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(FUND, { recursive: true });

// name: [mexc symbol, source, id, yahoo ticker for splits (stocks only), from]
const U = {
  XAU: ['XAU_USDT', 'duka', 'xauusd', null, '2013-01-01'],
  SILVER: ['SILVER_USDT', 'duka', 'xagusd', null, '2013-01-01'],
  USOIL: ['USOIL_USDT', 'duka', 'lightcmdusd', null, '2013-01-01'],
  UKOIL: ['UKOIL_USDT', 'duka', 'brentcmdusd', null, '2013-01-01'],
  SPX500: ['SPX500_USDT', 'duka', 'usa500idxusd', null, '2013-01-01'],
  NAS100: ['NAS100_USDT', 'duka', 'usatechidxusd', null, '2013-01-01'],
  US30: ['US30_USDT', 'duka', 'usa30idxusd', null, '2013-01-01'],
  NVDA: ['NVIDIA_USDT', 'duka', 'nvdaususd', 'NVDA', '2017-01-26'],
  MU: ['MUSTOCK_USDT', 'duka', 'muususd', 'MU', '2017-11-02'],
  TSLA: ['TESLA_USDT', 'duka', 'tslaususd', 'TSLA', '2017-01-26'],
  AMD: ['AMDSTOCK_USDT', 'duka', 'amdususd', 'AMD', '2017-11-02'],
  INTC: ['INTCSTOCK_USDT', 'duka', 'intcususd', 'INTC', '2017-01-26'],
  AVGO: ['AVGOSTOCK_USDT', 'duka', 'avgoususd', 'AVGO', '2017-01-26'],
  GOOGL: ['GOOGLSTOCK_USDT', 'duka', 'googlususd', 'GOOGL', '2017-01-26'],
  TSM: ['TSMSTOCK_USDT', 'duka', 'tsmususd', 'TSM', '2018-02-01'],
  AAPL: ['AAPLSTOCK_USDT', 'duka', 'aaplususd', 'AAPL', '2017-01-26'],
  MSFT: ['MSFTSTOCK_USDT', 'duka', 'msftususd', 'MSFT', '2017-01-26'],
  SMH: ['SOXL_USDT', 'duka', 'smhususd', 'SMH', '2017-01-26'], // semiconductor ETF, stands in for SOXL's index (SOXL = 3x daily)
  SNDK: ['SNDKSTOCK_USDT', 'yahoo', 'SNDK', 'SNDK'],
  SKHYNIX: ['SKHYNIXSTOCK_USDT', 'yahoo', '000660.KS', '000660.KS'],
  SAMSUNG: ['SAMSUNGSTOCK_USDT', 'yahoo', '005930.KS', '005930.KS'],
  MSTR: ['MSTRSTOCK_USDT', 'yahoo', 'MSTR', 'MSTR'],
  CRCL: ['CRCLSTOCK_USDT', 'yahoo', 'CRCL', 'CRCL'],
  NBIS: ['NBISSTOCK_USDT', 'yahoo', 'NBIS', 'NBIS'],
  CRWV: ['CRWVSTOCK_USDT', 'yahoo', 'CRWV', 'CRWV'],
  SOXL: ['SOXL_USDT', 'yahoo', 'SOXL', 'SOXL'],
};
const END = new Date('2026-11-11T00:00:00Z');

async function yjson(url) {
  for (let k = 0; k < 4; k++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (r.ok) return await r.json(); } catch (e) { /* retry */ }
    await new Promise((s) => setTimeout(s, 2000 * (k + 1)));
  }
  throw new Error('fetch failed ' + url);
}
async function splits(tk) {
  const j = await yjson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tk)}?interval=1d&range=max&events=split`);
  return Object.values(j.chart.result[0].events?.splits || {}).map((s) => ({ t: s.date, ratio: s.numerator / s.denominator })).sort((a, b) => a.t - b.t);
}
// divide every price before a split by its ratio (back-adjust), so the series is continuous at today's scale
function adjust(rows, sp) {
  // Yahoo stamps a split at the open (13:30 UTC); every candle from that UTC day on already trades at the new scale
  for (const s of sp) { const day = Math.floor(s.t / 86400) * 86400; for (const r of rows) if (r[0] < day) for (let j = 1; j <= 4; j++) r[j] /= s.ratio; }
  return rows;
}
async function duka(id, from) {
  const rows = [];
  for (let y = new Date(from).getUTCFullYear(); y <= END.getUTCFullYear(); y++) { // a year at a time keeps requests small
    const a = new Date(Math.max(Date.UTC(y, 0, 1), +new Date(from))), b = new Date(Math.min(Date.UTC(y + 1, 0, 1), +END));
    const d = await getHistoricalRates({ instrument: id, dates: { from: a, to: b }, timeframe: 'h4', format: 'array', retryCount: 5, pauseBetweenRetriesMs: 2000, batchSize: 10, pauseBetweenBatchesMs: 500 });
    for (const r of d) rows.push([r[0] / 1000, r[1], r[2], r[3], r[4], r[5] || 0]);
  }
  return rows;
}
async function yahoo(tk) { // 1h for the last 730 days, grouped into UTC 4h buckets
  const j = await yjson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tk)}?interval=1h&range=730d`);
  const r = j.chart.result[0], q = r.indicators.quote[0], B = new Map();
  r.timestamp.forEach((t, i) => {
    if (q.open[i] == null || q.close[i] == null) return;
    const k = Math.floor(t / 14400) * 14400, b = B.get(k);
    if (!b) B.set(k, [k, q.open[i], q.high[i], q.low[i], q.close[i], q.volume[i] || 0]);
    else { b[2] = Math.max(b[2], q.high[i]); b[3] = Math.min(b[3], q.low[i]); b[4] = q.close[i]; b[5] += q.volume[i] || 0; }
  });
  return [...B.values()].sort((a, b) => a[0] - b[0]);
}
async function funding(sym) {
  const out = [];
  for (let p = 1; p <= 20; p++) {
    const j = await yjson(`https://contract.mexc.com/api/v1/contract/funding_rate/history?symbol=${sym}&page_num=${p}&page_size=1000`);
    const L = j.data?.resultList || []; for (const r of L) out.push([Math.floor(r.settleTime / 1000), +r.fundingRate]);
    if (L.length < 1000) break;
  }
  return out.sort((a, b) => a[0] - b[0]);
}

(async () => {
  const meta = {}, only = process.argv.slice(2);
  for (const [name, [sym, src, id, ytk, from]] of Object.entries(U)) {
    if (only.length && !only.includes(name)) continue;
    const f = path.join(OUT, name + '.json');
    try {
      let rows = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null, sp = [];
      if (!rows) {
        rows = src === 'duka' ? await duka(id, from) : await yahoo(id);
        if (ytk && src === 'duka') { sp = await splits(ytk); adjust(rows, sp); } // Yahoo intraday is already split-adjusted
        rows = rows.filter((r) => r[1] > 0 && r[4] > 0);
        fs.writeFileSync(f, JSON.stringify(rows));
      }
      // largest bar-to-bar jump: a missed split would show up here
      let jump = 0, at = 0; for (let i = 1; i < rows.length; i++) { const x = Math.abs(Math.log(rows[i][1] / rows[i - 1][4])); if (x > jump) { jump = x; at = rows[i][0]; } }
      const fr = await funding(sym); fs.writeFileSync(path.join(FUND, name + '.json'), JSON.stringify(fr));
      meta[name] = { sym, src, id, bars: rows.length, from: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), to: new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10), splits: sp.map((s) => [new Date(s.t * 1000).toISOString().slice(0, 10), s.ratio]), maxGapPct: +(100 * (Math.exp(jump) - 1)).toFixed(1), maxGapAt: new Date(at * 1000).toISOString().slice(0, 10), fundingN: fr.length, fundingMean: fr.length ? fr.reduce((a, r) => a + r[1], 0) / fr.length : null };
      console.log(name, JSON.stringify(meta[name]));
    } catch (e) { console.log(name, 'FAILED', e.message); meta[name] = { error: e.message }; }
  }
  const mf = path.join(__dirname, 'fetch-meta.json'), old = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
  fs.writeFileSync(mf, JSON.stringify({ ...old, ...meta }, null, 1));
})();
