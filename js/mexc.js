// mexc.js — MEXC USDT-M perpetual klines (the "SOLUSDT.P" charts).
// contract.mexc.com sends no CORS header, so the browser can't call it directly:
// requests go through a proxy — the local dev server (`npm run serve` → /mexc/...)
// or the optional Supabase edge function (supabase/functions/mexc-proxy).
// History depth is MEXC's: 1m ≈ last 30 days, 5m/15m ≈ months, 1h and up = years.

const MEXC = (() => {
  const PAGE = 2000; // max bars per request (MEXC returns the newest 2000 of a range)

  // app interval -> MEXC native interval
  const NATIVE = { '1': 'Min1', '5': 'Min5', '15': 'Min15', '30': 'Min30', '60': 'Min60',
    '240': 'Hour4', '480': 'Hour8', 'D': 'Day1', 'W': 'Week1' };
  // timeframes MEXC doesn't offer, built from a lower one: [base interval, bars per candle]
  const BUILT = { '3': ['1', 3], '120': ['60', 2], '360': ['60', 6], '720': ['240', 3] };

  const contract = (symbol) => symbol.replace(/\.P$/, '').replace(/USDT$/, '_USDT');

  function proxies() {
    const list = ['/mexc'];
    if (window.SUPA && SUPA.url) list.push(`${SUPA.url}/functions/v1/mexc-proxy`);
    return list;
  }

  function headersFor(base) {
    return base.startsWith('http') && window.SUPA
      ? { apikey: SUPA.anonKey, Authorization: `Bearer ${SUPA.anonKey}` } : undefined;
  }

  async function tryGet(base, path) {
    const res = await fetch(base + path, { headers: headersFor(base) });
    const j = await res.json();
    if (j && j.success) return j.data;
    throw new Error((j && j.message) || 'MEXC error');
  }

  // First call finds a proxy that answers; later calls use it, retrying with
  // backoff so a transient failure doesn't drop the chart to the offline sample.
  let base = null;
  async function get(path) {
    if (!base) {
      let lastErr;
      for (const b of proxies()) {
        try { const d = await tryGet(b, path); base = b; return d; } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('MEXC proxy unreachable');
    }
    let lastErr;
    for (let i = 0; i < 3; i++) {
      try { return await tryGet(base, path); } catch (e) { lastErr = e; }
      if (i < 2) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
    throw lastErr;
  }

  // Volume comes in contracts; contractSize converts it to coins (SOL 0.1, DOGE 100, ZEC 0.01).
  const _size = new Map();
  async function contractSize(symbol) {
    if (_size.has(symbol)) return _size.get(symbol);
    let size = 1;
    try { size = +(await get(`/api/v1/contract/detail?symbol=${contract(symbol)}`)).contractSize || 1; } catch {}
    _size.set(symbol, size);
    return size;
  }

  // Merge lower-TF bars into UTC-aligned higher-TF candles. The oldest bucket is
  // dropped if it starts mid-candle; the newest one may still be forming.
  function aggregate(bars, outSec) {
    const out = [];
    let cur = null;
    for (const b of bars) {
      const t = Math.floor(b.time / outSec) * outSec;
      if (!cur || cur.time !== t) {
        if (!cur && b.time !== t) continue;
        cur = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
        out.push(cur);
      } else {
        cur.high = Math.max(cur.high, b.high);
        cur.low = Math.min(cur.low, b.low);
        cur.close = b.close;
        cur.volume += b.volume;
      }
    }
    return out;
  }

  // Same contract as api.js _fetchPages: ascending candles, newest `target` kept.
  async function fetchPages(symbol, interval, target, onProgress, endSec) {
    const [baseIv, k] = BUILT[interval] || [interval, 1];
    const code = NATIVE[baseIv];
    if (!code) throw new Error(`MEXC has no ${interval} interval`);
    const sec = intervalToSeconds(baseIv);
    const need = target * k + (k > 1 ? k : 0); // extra bars so the oldest built candle is whole
    const pages = Math.max(1, Math.ceil(need / PAGE));
    const size = await contractSize(symbol);
    const merged = new Map();
    let end = endSec != null ? endSec : Math.floor(Date.now() / 1000);

    // a page can hold one bar fewer than PAGE, so keep going until `need` is reached
    for (let page = 1; merged.size < need && page <= pages + 2; page++) {
      if (onProgress) onProgress(Math.min(page, pages), pages);
      const start = end - (PAGE - 1) * sec;
      const d = await get(`/api/v1/contract/kline/${contract(symbol)}?interval=${code}&start=${start}&end=${end}`);
      const t = (d && d.time) || [];
      if (!t.length) break; // reached the start of MEXC's history for this TF
      for (let i = 0; i < t.length; i++) {
        merged.set(t[i], { time: t[i], open: +d.open[i], high: +d.high[i], low: +d.low[i],
          close: +d.close[i], volume: +d.vol[i] * size });
      }
      end = t[0] - 1;
    }

    let all = [...merged.values()].sort((a, b) => a.time - b.time);
    if (k > 1) all = aggregate(all, intervalToSeconds(interval));
    if (!all.length) throw new Error('No data');
    return all.length > target ? all.slice(all.length - target) : all;
  }

  return { fetchPages, PAGE };
})();
