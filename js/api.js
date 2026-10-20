// api.js — data loading (Binance USDT-M futures live paginated, saved on-device
// per enabled TF via CandleStore, with offline synthetic fallback)

// ---- in-memory candle cache -------------------------------------------------
// Avoids re-fetching when switching timeframes back and forth.
// Entries older than CACHE_TTL_MS are "stale": still served instantly (so a TF
// switch never blocks on the network) while the caller revalidates in the
// background. Synthetic fallback data never goes stale.
const _candleCache = new Map();
const _inflight = new Map();   // key -> Promise, so concurrent callers share one fetch
const CACHE_TTL_MS = 5 * 60 * 1000;

// Manual updates (default): candles are downloaded once, kept on the device
// (IndexedDB) and reused on every visit — nothing is fetched until the user taps
// the refresh/update button. Turn auto-update on (Settings) for the old behaviour:
// stale data revalidated on open, newest bars polled every 30 s.
const AUTO_UPDATE_KEY = 'cr.autoUpdate';
let _autoUpdate = false;
try { _autoUpdate = localStorage.getItem(AUTO_UPDATE_KEY) === 'true'; } catch {}
function isAutoUpdate() { return _autoUpdate; }
function setAutoUpdate(v) {
  _autoUpdate = !!v;
  try { localStorage.setItem(AUTO_UPDATE_KEY, String(_autoUpdate)); } catch {}
}
// Ask the browser not to evict the saved candles when storage runs low (phones do).
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}

// endSec (optional) anchors the window so it ENDS at that time instead of "now"
// (used by replay when a lower timeframe's latest history doesn't reach back far enough).
function _cacheKey(symbol, interval, target, endSec) {
  return `${symbol}|${interval}|${target}|${endSec || 'now'}`;
}

function _cacheEntry(symbol, interval, target, endSec) {
  return _candleCache.get(_cacheKey(symbol, interval, target, endSec)) || null;
}

function _isFresh(entry) {
  return !!entry && (!entry.live || !_autoUpdate || Date.now() - entry.ts <= CACHE_TTL_MS);
}

function _cacheSet(symbol, interval, target, data, live, endSec) {
  _candleCache.set(_cacheKey(symbol, interval, target, endSec), { data, ts: Date.now(), live });
  // latest-window live data is also saved on-device (only for enabled TFs)
  if (live && !endSec) CandleStore.save(symbol, interval, data, data.length < target);
}

// Fill the memory cache from the on-device copy (if it covers `target` bars).
// The entry is marked stale, so the caller shows it instantly and then only the
// newest bars are fetched on top (refreshCandles). Resolves true when served.
async function hydrateCandles(symbol, interval, target) {
  if (_cacheEntry(symbol, interval, target)) return true;
  const stored = await CandleStore.get(symbol, interval);
  if (!stored || !stored.data || !stored.data.length) return false;
  if (stored.data.length < target && !stored.complete) return false;
  if (_cacheEntry(symbol, interval, target)) return true; // a fetch landed meanwhile
  const data = stored.data.length > target ? stored.data.slice(stored.data.length - target) : stored.data;
  _candleCache.set(_cacheKey(symbol, interval, target), { data, ts: 0, live: true });
  return true;
}

function dataSourceName() {
  return 'Binance live';
}

// Synchronous read — returns cached data (fresh OR stale) or null.
// Use isCandleCacheFresh() to decide whether to revalidate in the background.
function peekCandleCache(symbol, interval, target, endSec) {
  const e = _cacheEntry(symbol, interval, target, endSec);
  return e ? e.data : null;
}

function isCandleCacheFresh(symbol, interval, target, endSec) {
  return _isFresh(_cacheEntry(symbol, interval, target, endSec));
}

// Call this to force a fresh fetch (e.g. Refresh button).
function clearCandleCache(symbol, interval, target) {
  if (symbol == null) { _candleCache.clear(); return; }
  _candleCache.delete(_cacheKey(symbol, interval, target));
}

// Returns ascending array of { time(sec), open, high, low, close, volume }.
// Walks backward through Binance futures kline pages (js/binance.js) until `target`
// candles are collected (or history runs out).
//   target     — how many candles to end up with (most-recent kept)
//   onProgress — optional (pageNo, pages) callback for the loading indicator
//   opts.endSec — optional window end (unix sec); default = now
//   opts.force  — bypass a fresh cache entry (background revalidation)
async function fetchCandles(symbol, interval, target, onProgress, opts) {
  const endSec = opts && opts.endSec ? Math.floor(opts.endSec) : null;
  const force = !!(opts && opts.force);
  const entry = _cacheEntry(symbol, interval, target, endSec);
  if (!force && _isFresh(entry)) return entry.data;

  const key = _cacheKey(symbol, interval, target, endSec);
  if (_inflight.has(key)) return _inflight.get(key); // share an in-progress (e.g. prefetch) request

  const p = _fetchPages(symbol, interval, target, onProgress, endSec)
    .then((result) => { _cacheSet(symbol, interval, target, result, true, endSec); return result; })
    .finally(() => _inflight.delete(key));
  _inflight.set(key, p);
  return p;
}

function _fetchPages(symbol, interval, target, onProgress, endSec) {
  return BINANCE.fetchPages(symbol, interval, target, onProgress, endSec);
}

// Bring a cached (stale) series up to date cheaply: fetch only the newest page
// and merge it onto the cached history. Falls back to a full fetch when there is
// no cache yet, or when the newest page doesn't reach back to the cached end (gap).
function refreshCandles(symbol, interval, target, force) {
  const entry = _cacheEntry(symbol, interval, target);
  if (!entry || !entry.live) return fetchCandles(symbol, interval, target);
  if (!force && _isFresh(entry)) return Promise.resolve(entry.data);

  const key = _cacheKey(symbol, interval, target) + '|refresh';
  if (_inflight.has(key)) return _inflight.get(key);
  const p = (async () => {
    const old = entry.data;
    const latest = await _fetchPages(symbol, interval, Math.min(target, BINANCE.PAGE), null, null);
    const sec = intervalToSeconds(interval);
    if (!old.length || latest[0].time > old[old.length - 1].time + sec) {
      return fetchCandles(symbol, interval, target, null, { force: true });
    }
    const cutoff = latest[0].time;
    const merged = old.filter((c) => c.time < cutoff).concat(latest);
    const result = merged.length > target ? merged.slice(merged.length - target) : merged;
    _cacheSet(symbol, interval, target, result, true);
    return result;
  })().finally(() => _inflight.delete(key));
  _inflight.set(key, p);
  return p;
}

// Live polling: fetch only the newest few bars (the forming one + the last closed ones) and merge them onto the
// cached series, regardless of how fresh the cache is. Resolves to the merged array, or null when there is no
// live cache to merge onto (offline sample, history window) or the newest bars don't join up.
async function pollLatestCandles(symbol, interval, target) {
  const entry = _cacheEntry(symbol, interval, target);
  if (!entry || !entry.live || !entry.data.length) return null;
  const latest = await _fetchPages(symbol, interval, 3, null, null);
  const old = entry.data, sec = intervalToSeconds(interval);
  if (!latest.length || latest[0].time > old[old.length - 1].time + sec) return null;
  const cutoff = latest[0].time;
  const merged = old.filter((c) => c.time < cutoff).concat(latest);
  const result = merged.length > target ? merged.slice(merged.length - target) : merged;
  _cacheSet(symbol, interval, target, result, true);
  return result;
}

// ---- background prefetch -----------------------------------------------------
// Quietly downloads the other enabled timeframes for the current symbol, one at a
// time, so a later TF switch is served straight from memory (no loading state).
// A TF already saved on-device only fetches its newest bars.
// Calling it again (symbol / max change) cancels the previous queue.
let _prefetchGen = 0;
async function prefetchCandles(symbol, intervals, target) {
  const gen = ++_prefetchGen;
  for (const iv of intervals) {
    if (gen !== _prefetchGen) return;
    await hydrateCandles(symbol, iv, target);
    if (gen !== _prefetchGen) return;
    if (!_autoUpdate) continue;   // manual mode: only load what is already saved, never download
    if (isCandleCacheFresh(symbol, iv, target)) continue;
    try { await refreshCandles(symbol, iv, target); }
    catch { return; } // offline / blocked — no point hammering the remaining TFs
    await new Promise((r) => setTimeout(r, 120)); // stay gentle on the public API
  }
}

// Deterministic synthetic OHLC so the app fully works offline / if CORS blocks.
function syntheticCandles(symbol, interval, count, endSec) {
  const seedBase = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
  let rng = mulberry32(seedBase * 7 + 13);
  const stepSec = intervalToSeconds(interval);
  const startPrice = { ETHUSDT: 3400, BTCUSDT: 64000, SOLUSDT: 150, BNBUSDT: 580,
    XRPUSDT: 0.52, DOGEUSDT: 0.16, APEUSDT: 1.2, ZECUSDT: 50 }[symbol.replace(/\.P$/, '')] || 100;
  const now = Math.floor(Date.now() / 1000);
  const t0 = Math.floor((now - stepSec * count) / stepSec) * stepSec; // bar-aligned
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
