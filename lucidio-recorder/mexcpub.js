// mexcpub.js - MEXC's PUBLIC futures data: no key, no signature, no way to place an order. Built-in fetch (Node 20+), a hard timeout on every call, two retries.
'use strict';
const BASE = process.env.RECORDER_MEXC_BASE || 'https://api.mexc.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IV = { '1m': { name: 'Min1', sec: 60 }, '1h': { name: 'Min60', sec: 3600 }, '4h': { name: 'Hour4', sec: 14400 } };

function createClient({ timeoutMs = 10000, fetchImpl = fetch, base = BASE } = {}) {
  async function get(path, query) {
    const qs = query ? '?' + Object.entries(query).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
    let last;
    for (let k = 0; k < 3; k++) {
      try {
        const res = await fetchImpl(base + path + qs, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'lucidio-recorder' } });
        if (res.status === 429) throw Object.assign(new Error('rate limited (429)'), { retry: true });
        if (res.status >= 500) throw Object.assign(new Error(`HTTP ${res.status}`), { retry: true });
        const j = await res.json();
        if (!j || j.success !== true) throw Object.assign(new Error(`MEXC ${path} code ${j && j.code}: ${j && j.message}`), { retry: false });
        return j.data;
      } catch (e) {
        last = e;
        const transient = e.retry === true || e.name === 'TimeoutError' || e.name === 'AbortError' || e.cause || /fetch failed|network|ECONN|ETIMEDOUT/i.test(e.message || '');
        if (!transient || k === 2) break;
        await sleep(1500 * (k + 1));
      }
    }
    throw last;
  }
  return {
    ping: () => get('/api/v1/contract/ping'),
    detail: (symbol) => get('/api/v1/contract/detail', { symbol }),
    depth: (symbol, limit = 100) => get(`/api/v1/contract/depth/${symbol}`, { limit }),
    fundingRate: (symbol) => get(`/api/v1/contract/funding_rate/${symbol}`),
    fundingHistory: async (symbol, pageSize = 60) => ((await get('/api/v1/contract/funding_rate/history', { symbol, page_num: 1, page_size: pageSize })) || {}).resultList || [],
    // closed AND forming candles in [startSec, endSec], as [time, open, high, low, close, volume] rows, oldest first (the caller drops the forming one)
    async klines(symbol, tf, startSec, endSec) {
      const d = await get(`/api/v1/contract/kline/${symbol}`, { interval: IV[tf].name, start: startSec, end: endSec });
      if (!d || !Array.isArray(d.time)) return [];
      return d.time.map((t, i) => [t, +d.open[i], +d.high[i], +d.low[i], +d.close[i], +d.vol[i]]);
    },
  };
}

module.exports = { createClient, IV };
