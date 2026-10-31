// binance.js — Binance USDT-M futures klines (the "SOLUSDT.P" charts).
// fapi.binance.com sends Access-Control-Allow-Origin: *, so the browser calls it
// directly — no proxy. Same market as the research backtests (official source).
// Every app timeframe is native on Binance, so nothing is built from lower bars.

const BINANCE = (() => {
  const API = 'https://fapi.binance.com/fapi/v1/klines';
  const PAGE = 1500; // max bars per request

  // app interval -> Binance interval
  const NATIVE = { '1': '1m', '3': '3m', '5': '5m', '15': '15m', '30': '30m', '60': '1h',
    '120': '2h', '240': '4h', '360': '6h', '480': '8h', '720': '12h', 'D': '1d', 'W': '1w' };

  const pair = (symbol) => symbol.replace(/\.P$/, '');

  // Retry with backoff so a transient failure doesn't drop the chart to the offline sample.
  async function get(url) {
    let lastErr;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(url);
        const j = await res.json();
        if (Array.isArray(j)) return j;
        lastErr = new Error((j && j.msg) || 'Binance error');
        if (res.status === 400) break; // bad symbol / interval — retrying won't help
        if (res.status === 429 || res.status === 418) { // rate limited: wait as long as Binance asks
          const wait = Math.min(120, +res.headers.get('retry-after') || 30);
          if (i < 2) { await new Promise((r) => setTimeout(r, wait * 1000)); continue; }
        }
      } catch (e) { lastErr = e; }
      if (i < 2) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
    throw lastErr;
  }

  // Same contract as api.js _fetchPages: ascending candles, newest `target` kept.
  // The newest bar may still be forming.
  async function fetchPages(symbol, interval, target, onProgress, endSec) {
    const code = NATIVE[interval];
    if (!code) throw new Error(`Binance has no ${interval} interval`);
    // "Since 2020" mode: walk back until 1 Jan 2020 (or SINCE_MAX_BARS candles, whichever comes first)
    const since = target >= CFG.SINCE_2020;
    const startMs = since ? CFG.SINCE_START_MS : null;
    if (since) target = CFG.SINCE_MAX_BARS;
    const wanted = since ? Math.min(target, ((endSec != null ? endSec * 1000 : Date.now()) - startMs) / 1000 / intervalToSeconds(interval)) : target;
    const pages = Math.max(1, Math.ceil(wanted / PAGE));
    const merged = new Map();
    let endMs = endSec != null ? endSec * 1000 : null;

    for (let page = 1; merged.size < target && page <= pages + 1; page++) {
      if (onProgress) onProgress(Math.min(page, pages), pages);
      const limit = Math.min(PAGE, target - merged.size);
      const rows = await get(`${API}?symbol=${pair(symbol)}&interval=${code}&limit=${limit}` +
        (endMs != null ? `&endTime=${endMs}` : ''));
      if (!rows.length) break; // reached the start of Binance's history for this TF
      for (const k of rows) {
        const t = k[0] / 1000;
        merged.set(t, { time: t, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] });
      }
      if (rows.length < limit) break;
      if (startMs != null && rows[0][0] <= startMs) break; // reached 1 Jan 2020
      endMs = rows[0][0] - 1;
      if (since) await new Promise((r) => setTimeout(r, 60)); // long walk: stay gentle on the public API
    }

    let all = [...merged.values()].sort((a, b) => a.time - b.time);
    if (startMs != null) all = all.filter((c) => c.time * 1000 >= startMs);
    if (!all.length) throw new Error('No data');
    return all.length > target ? all.slice(all.length - target) : all;
  }

  return { fetchPages, PAGE };
})();
