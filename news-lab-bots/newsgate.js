// newsgate.js — NEWS LAB: client for the news gate signal (https://cryptobai.vercel.app/api/signal).
// The bot fetches the signal ONCE per run, then asks decide() for each new entry. The gate can only VETO or SHRINK an entry; it never opens one.
// FAIL-OPEN: no signal, a stale signal (older than 6 h), an unknown coin or a malformed answer -> the entry goes ahead unchanged (source 'unavailable').
'use strict';

const DEFAULT_URL = 'https://cryptobai.vercel.app/api/signal';
const STALE_MS = 6 * 3600 * 1000;
const unavailable = () => ({ veto: false, mult: 1, reason: 'news: unavailable', reasons: [], source: 'unavailable' });

// -> the signal JSON, or null on any problem (network, timeout, HTTP error, bad JSON). Never throws.
async function fetchSignal({ url = process.env.NEWS_SIGNAL_URL || DEFAULT_URL, timeoutMs = 8000, fetchImpl = (typeof fetch === 'function' ? fetch : null) } = {}) {
  if (!fetchImpl) return null;
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'news-lab-bot', Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res || !res.ok) return null;
    const j = await res.json();
    return j && typeof j === 'object' && j.coins && typeof j.coins === 'object' ? j : null;
  } catch { return null; }
}

// pure: (signal, 'SOL', 1|-1, nowMs) -> { veto, mult, reason, reasons, source }
function decide(signal, coin, dir, nowMs = Date.now()) {
  if (!signal || typeof signal !== 'object' || !signal.coins || typeof signal.coins !== 'object') return unavailable();
  const upd = +signal.updated;
  if (!Number.isFinite(upd) || nowMs - upd > STALE_MS || upd - nowMs > 10 * 60 * 1000) return unavailable();
  const c = signal.coins[coin], g = c && c[dir === 1 ? 'long' : dir === -1 ? 'short' : '?'];
  if (!g || typeof g !== 'object' || typeof g.allow !== 'boolean') return unavailable();
  const reasons = Array.isArray(g.reasons) ? g.reasons.map((r) => String(r).slice(0, 120)).slice(0, 5) : [];
  if (!g.allow) return { veto: true, mult: 0, reason: reasons.join('; ') || 'vetoed', reasons, source: 'signal' };
  const s = +g.size, mult = Number.isFinite(s) && s > 0 && s <= 1 ? s : 1;
  return { veto: false, mult, reason: mult < 1 ? `size x${mult}` : null, reasons, source: 'signal' };
}

module.exports = { fetchSignal, decide, DEFAULT_URL, STALE_MS };
