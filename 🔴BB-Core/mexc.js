// mexc.js — minimal MEXC USDT-M futures client for Lucid'io (no npm packages, Node 18+).
//
// Docs: https://www.mexc.com/api-docs/futures/integration-guide  (checked 2026-10-22)
//   base https://api.mexc.com (since 2026-01-19) · trading API reopened 2026-03-31 · order placing needs KYC + an API key with
//   "Order Placing" permission · keys WITHOUT an IP binding expire after 90 days -> bind the VPS static IP.
//   Signature: HMAC-SHA256(secret, apiKey + Request-Time(ms) + paramString), hex. GET: business params sorted a→z joined with &;
//   POST: the raw JSON body. Request-Time must be within 10 s of MEXC's clock -> we sign with the server-corrected time.
// Rate limits used here (per the docs): kline/ticker/ping/positions/orders queries 20 per 2 s · order create 4 per 2 s ·
//   TP/SL place 5 per 2 s · close_all 4 per 2 s · change_leverage 10 per 10 s. Lucid'io makes ~5–15 calls per coin every 4 h.
//
// Safety rules baked in:
//   - GET requests retry on network errors / 500 / 501 / 510 / 9999 (back-off 1 s, 2 s, 4 s).
//   - POST order/create is NEVER retried blindly — callers look the order up by its externalOid instead (no double orders).
'use strict';
const crypto = require('crypto');

const BASE = 'https://api.mexc.com';
const RETRY_CODES = new Set([500, 501, 510, 9999]);
const BLOCK_TEXT = /region|country|jurisdiction|restricted|not available in|access denied|forbidden|unauthori[sz]ed|no permission|permission denied|insufficient permission/i;   // 402 (key expired) and 406 (IP not bound) keep their own hints
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class MexcError extends Error {
  constructor(msg, code, body) { super(msg); this.code = code; this.body = body; }
}

function createClient({ apiKey = '', apiSecret = '', base = BASE, timeoutMs = 10000, log = () => {} } = {}) {
  let offsetMs = 0;          // MEXC server time − local time
  let lastPrivate = 0;       // simple spacing between private calls (well under every limit)

  const now = () => Date.now() + offsetMs;

  async function http(method, path, { query = null, body = null, auth = false } = {}) {
    let qs = '';
    if (query) {
      const keys = Object.keys(query).filter((k) => query[k] != null && query[k] !== '').sort();
      qs = keys.map((k) => `${k}=${encodeURIComponent(query[k])}`).join('&');
    }
    const url = base + path + (qs ? '?' + qs : '');
    const headers = { 'Content-Type': 'application/json', Language: 'English' };
    const raw = body != null ? JSON.stringify(body) : '';
    if (auth) {
      if (!apiKey || !apiSecret) throw new MexcError('no API key / secret configured', 'NOKEY');
      const wait = lastPrivate + 120 - Date.now();
      if (wait > 0) await sleep(wait);
      lastPrivate = Date.now();
      const ts = String(Math.round(now()));
      const signed = method === 'GET' ? qs.split('&').map(decodeURIComponent).join('&') : raw;
      headers.ApiKey = apiKey;
      headers['Request-Time'] = ts;
      headers['Recv-Window'] = '15';
      headers.Signature = crypto.createHmac('sha256', apiSecret).update(apiKey + ts + (method === 'GET' ? (qs ? signed : '') : raw)).digest('hex');
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res, text;
    try {
      res = await fetch(url, { method, headers, body: method === 'POST' ? raw : undefined, signal: ctl.signal });
      text = await res.text();
    } catch (e) {
      throw new MexcError(`network: ${e.name === 'AbortError' ? 'timeout' : e.message}`, 9999);
    } finally { clearTimeout(timer); }
    // 403 / 451 = blocked (region, IP, WAF): its own error type, never retried
    if (res.status === 403 || res.status === 451) throw new MexcError(`BLOCKED: HTTP ${res.status} ${text.replace(/\s+/g, ' ').slice(0, 200)}`, 'BLOCKED');
    let j;
    try { j = JSON.parse(text); } catch { throw new MexcError(`HTTP ${res.status}: ${text.slice(0, 200)}`, res.status === 429 ? 510 : 500); }
    if (!j.success && ![402, 406].includes(+j.code) && BLOCK_TEXT.test(j.message || '')) throw new MexcError(`BLOCKED: MEXC ${path} code ${j.code}: ${String(j.message).slice(0, 200)}`, 'BLOCKED', j);
    if (!j.success) throw new MexcError(`MEXC ${path} code ${j.code}: ${j.message || JSON.stringify(j).slice(0, 200)}`, j.code, j);
    return j.data;
  }

  async function get(path, query, auth = false) {
    for (let k = 0; ; k++) {
      try { return await http('GET', path, { query, auth }); }
      catch (e) {
        if (k >= 3 || !RETRY_CODES.has(e.code)) throw e;
        log(`retry ${path} after ${e.message}`);
        await sleep(1000 * 2 ** k);
      }
    }
  }
  const post = (path, body) => http('POST', path, { body, auth: true });

  return {
    now, MexcError,
    get offsetMs() { return offsetMs; },

    // ---- public ----
    async syncTime() {                                   // TOTP-style: we never "sync", we just measure the offset each run
      const t0 = Date.now(), srv = await get('/api/v1/contract/ping'), t1 = Date.now();
      offsetMs = srv - (t0 + t1) / 2;
      return { offsetMs, rttMs: t1 - t0, serverMs: srv };
    },
    contract: (symbol) => get('/api/v1/contract/detail', { symbol }),
    ticker: (symbol) => get('/api/v1/contract/ticker', { symbol }),
    async klines(symbol, interval, startSec, endSec) {   // max 2000 per request (docs); includes the still-forming candle
      const d = await get(`/api/v1/contract/kline/${symbol}`, { interval, start: startSec, end: endSec });
      return d.time.map((t, i) => ({ time: t, open: +d.open[i], high: +d.high[i], low: +d.low[i], close: +d.close[i] }));
    },

    // ---- private: read ----
    asset: (currency = 'USDT') => get(`/api/v1/private/account/asset/${currency}`, null, true),
    positionMode: () => get('/api/v1/private/position/position_mode', null, true),
    openPositions: (symbol) => get('/api/v1/private/position/open_positions', { symbol }, true),
    historyPositions: (symbol, startMs) => get('/api/v1/private/position/list/history_positions', { symbol, start_time: startMs, page_num: 1, page_size: 50 }, true),
    orderByExternalOid: (symbol, oid) => get(`/api/v1/private/order/external/${symbol}/${oid}`, null, true),
    openTpSl: (symbol) => get('/api/v1/private/stoporder/open_orders', { symbol }, true),

    // ---- private: write (never auto-retried) ----
    createOrder: (o) => post('/api/v1/private/order/create', o),
    placeTpSl: (o) => post('/api/v1/private/stoporder/place', o),
    cancelTpSl: (ids) => post('/api/v1/private/stoporder/cancel', ids.map((id) => ({ stopPlanOrderId: id }))),
  };
}

// ---- default client: keys from mexc-keys.json (gitignored) or env MEXC_API_KEY / MEXC_API_SECRET ----
// The helpers below return { data, ms } (ms = request time) — the shape dashboard.js and the run records use.
function loadKeys() {
  try { const k = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'mexc-keys.json'), 'utf8')); if (k.apiKey && k.apiSecret && !/your MEXC/i.test(k.apiKey)) return k; } catch {}
  return { apiKey: process.env.MEXC_API_KEY || '', apiSecret: process.env.MEXC_API_SECRET || '' };
}
const client = createClient(loadKeys());
const timed = async (fn) => { const t = Date.now(); try { return { data: await fn(), ms: Date.now() - t }; } catch (e) { e.ms = Date.now() - t; throw e; } };
const IV4H = 14400;

module.exports = {
  createClient, MexcError, BASE, client, isBlocked: (e) => !!e && e.code === 'BLOCKED',
  hasKeys: () => { const k = loadKeys(); return !!(k.apiKey && k.apiSecret); },
  // ms = round trip; data = MEXC's raw server time in ms (drift = Date.now() - ms/2 - data). Also refreshes the client's clock offset.
  serverTime: () => timed(() => client.syncTime().then((r) => r.serverMs)),
  klines: (coin, bars = 500) => timed(() => { const end = Math.floor(client.now() / 1000); return client.klines(`${coin}_USDT`, 'Hour4', end - bars * IV4H, end); }),
  ticker: (coin) => timed(() => client.ticker(`${coin}_USDT`)),
  account: () => timed(async () => { const a = await client.asset('USDT'); return { ...a, equity: +a.equity, available: +a.availableBalance, unrealized: +a.unrealized }; }),
  positions: () => timed(async () => (await client.openPositions()).map((p) => ({
    symbol: p.symbol, side: p.positionType === 1 ? 'LONG' : 'SHORT', contracts: +p.holdVol, entry: +p.holdAvgPrice, liq: +p.liquidatePrice, leverage: p.leverage, positionId: p.positionId,
  }))),
};
