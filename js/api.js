// api.js — data loading (Bybit live paginated, with offline synthetic fallback)

// Returns ascending array of { time(sec), open, high, low, close, volume }.
// Walks backward through Bybit v5 kline pages until `target` candles are
// collected (or history runs out), then deduplicates the one-bar page overlap.
//   target     — how many candles to end up with (most-recent kept)
//   onProgress — optional (pageNo, pages) callback for the loading indicator
async function fetchCandles(symbol, interval, target, onProgress) {
  const pages = Math.max(1, Math.ceil(target / CFG.PAGE_LIMIT));
  const merged = new Map(); // keyed by candle.time(sec) → dedupes page overlap
  let end = null;           // ms upper bound for the next page (exclusive)

  for (let page = 1; page <= pages; page++) {
    if (onProgress) onProgress(page, pages);

    let url = `https://api.bybit.com/v5/market/kline?category=linear` +
      `&symbol=${symbol}&interval=${interval}&limit=${CFG.PAGE_LIMIT}`;
    if (end != null) url += `&end=${end}`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.retCode !== 0) throw new Error(data.retMsg || 'Bybit error');

    const raw = data.result.list; // descending: newest first
    if (!raw || raw.length === 0) break;

    for (const c of raw) {
      const t = Math.floor(parseInt(c[0]) / 1000); // ms -> sec
      merged.set(t, {
        time: t,
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
      });
    }

    // earliest bar in this page (descending list → last element)
    const earliestMs = parseInt(raw[raw.length - 1][0]);
    end = earliestMs - 1; // step the boundary so the bar is not refetched

    if (raw.length < CFG.PAGE_LIMIT) break; // hit the start of available data
    if (merged.size >= target) break;
  }

  // dedupe → sort ascending → keep the most-recent `target`
  const all = [...merged.values()].sort((a, b) => a.time - b.time);
  return all.length > target ? all.slice(all.length - target) : all;
}

// Deterministic synthetic OHLC so the app fully works offline / if CORS blocks.
function syntheticCandles(symbol, interval, count) {
  const seedBase = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
  let rng = mulberry32(seedBase * 7 + 13);
  const stepSec = intervalToSeconds(interval);
  const startPrice = { ETHUSDT: 3400, BTCUSDT: 64000, SOLUSDT: 150, BNBUSDT: 580,
    XRPUSDT: 0.52, DOGEUSDT: 0.16, APEUSDT: 1.2 }[symbol] || 100;
  const now = Math.floor(Date.now() / 1000);
  const t0 = now - stepSec * count;
  const out = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const drift = (rng() - 0.48) * 0.006;
    const vol = 0.004 + rng() * 0.012;
    const open = price;
    const close = open * (1 + drift);
    const hi = Math.max(open, close) * (1 + rng() * vol);
    const lo = Math.min(open, close) * (1 - rng() * vol);
    out.push({
      time: t0 + i * stepSec,
      open, high: hi, low: lo, close,
      volume: 500 + rng() * 4000,
    });
    price = close;
  }
  return out;
}

function intervalToSeconds(iv) {
  if (iv === 'D') return 86400;
  if (iv === 'W') return 604800;
  return parseInt(iv) * 60;
}

// small seeded PRNG
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Recompute cut index proportionally when timeframe changes (stability)
function proportionalCut(oldCut, oldLen, newLen) {
  if (oldLen <= 1) return Math.min(newLen - 1, Math.floor(newLen * 0.4));
  return Math.max(1, Math.min(newLen - 1, Math.round((oldCut / (oldLen - 1)) * (newLen - 1))));
}
