// dashboard-push.js - the bot PUSHES signed events to the hosted dashboard (Vercel). Vercel never connects to the VPS: no inbound port exists.
//
//   Off unless DASHBOARD_URL and DASHBOARD_PUSH_SECRET are set (server env file). Off = the bot behaves exactly as before.
//   Fully decoupled from trading: enqueue() never throws, flush() is fire-and-forget with a 5 s timeout, and every failure is swallowed
//   (counted, logged as a throttled warning). A Vercel outage cannot block, delay or crash a trade or the main loop.
//
//   Outbox   state/outbox.jsonl (append + fsync) and state/outbox.cursor.json (how many leading lines were acknowledged). A line is only counted
//            as sent after a 2xx. Events go out in order, in batches; after an outage the queue drains with no duplicates (each event has a unique
//            event_id and the server ignores a repeat; a crash between the 2xx and the cursor write can only cause a harmless resend).
//   Signing  header X-Lucidio-Signature = hex HMAC-SHA256(secret, `${timestamp}.${body}`), header X-Lucidio-Timestamp = ms. The server rejects > 5 min skew.
//   Privacy  only whitelisted fields are built here; only SOL_USDT / ZEC_USDT events are sent; a final scan refuses any payload that contains a key, token,
//            chat id, secret, IP address or file path. Real MEXC account equity is NOT sent unless DASHBOARD_SHARE_LIVE_EQUITY=true.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const config = require('./config.js');

const BATCH = 25, TIMEOUT_MS = 5000, MAX_BACKOFF_MS = 300000;
const stateDir = () => process.env.LUCIDIO_STATE_DIR || path.join(__dirname, 'state');
const OUTBOX = () => path.join(stateDir(), 'outbox.jsonl'), CURSOR = () => path.join(stateDir(), 'outbox.cursor.json'), REJECTED = () => path.join(stateDir(), 'outbox.rejected.jsonl');

const enabled = () => !!(process.env.DASHBOARD_URL && process.env.DASHBOARD_PUSH_SECRET);
const baseUrl = () => String(process.env.DASHBOARD_URL || '').replace(/\/+$/, '');
const shareLiveEquity = () => String(process.env.DASHBOARD_SHARE_LIVE_EQUITY || '').toLowerCase() === 'true';

let logger = () => {}, warnAt = 0;
const setLogger = (fn) => { logger = fn; };
const warn = (m) => { if (Date.now() - warnAt > 600000) { warnAt = Date.now(); try { logger(`WARNING dashboard push: ${m}`); } catch {} } };

// ---------------- signing ----------------
const sign = (secret, tsMs, body) => crypto.createHmac('sha256', secret).update(`${tsMs}.${body}`).digest('hex');

// ---------------- privacy guard ----------------
function leakCheck(json) {
  const bad = [];
  const secrets = [process.env.DASHBOARD_PUSH_SECRET, process.env.TELEGRAM_BOT_TOKEN, process.env.MEXC_API_KEY, process.env.MEXC_API_SECRET];
  try { const k = JSON.parse(fs.readFileSync(process.env.LUCIDIO_KEYS || path.join(__dirname, 'mexc-keys.json'), 'utf8')); secrets.push(k.apiKey, k.apiSecret, k.telegramToken, k.ledgerBotKey, k.ledgerKey); } catch {}
  for (const s of secrets) if (s && String(s).length >= 6 && json.includes(String(s))) bad.push('a configured secret');
  const chat = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  if (chat.length >= 6 && new RegExp(`(^|[^0-9])${chat.replace(/[^0-9-]/g, '')}([^0-9]|$)`).test(json)) bad.push('the Telegram chat id');
  if (/\d{6,12}:[A-Za-z0-9_-]{30,}/.test(json)) bad.push('a bot-token-like string');
  if (/(^|[^0-9.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}([^0-9.]|$)/.test(json)) bad.push('an IP address');
  if (/(["'\s]|^)\/(opt|home|root|etc|var|usr|tmp|Users)\//.test(json) || /[A-Za-z]:\\\\/.test(json) || /mexc-keys|\.env\b/.test(json)) bad.push('a file path');
  return bad;
}

// ---------------- building events (whitelists) ----------------
const numOrNull = (v) => (v == null || !Number.isFinite(+v) ? null : +v);
const strN = (v, n = 200) => (v == null ? null : String(v).slice(0, n));
const allowedSymbol = (s) => config.ALLOWED_SYMBOLS.includes(s);
const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: String(id), type, ts_ms: Math.round(tsMs), mode, ...extra, data });

// journal record -> dashboard events (one or two). Used live (right after the journal write) and by `dashboard-backfill`, with the same event ids.
function fromJournal(rec) {
  if (!rec || !rec.type) return [];
  if (rec.symbol && !allowedSymbol(rec.symbol)) return [];
  const mode = rec.mode === 'live' ? 'live' : 'paper', live = mode === 'live', share = !live || shareLiveEquity();
  const key = { symbol: rec.symbol, side: rec.side };
  if (rec.type === 'entry') {
    const ind = rec.indicators || {};
    const data = { trade_id: rec.trade_id, signal_candle_open_ms: rec.match_key.signal_candle_open_ms, entry: numOrNull(rec.entry.fill_price), intended_price: numOrNull(rec.entry.intended_price),
      sl: numOrNull(rec.sl), tp: numOrNull(rec.tp), qty: numOrNull(rec.position.qty), contracts: numOrNull(rec.position.contracts), risk_pct: numOrNull(rec.risk.risk_pct), one_r: numOrNull(rec.risk.one_r_price),
      slippage_r: numOrNull(rec.entry.slippage_r), delay_sec: numOrNull(rec.entry.delay_sec), nearest_threshold_pct: numOrNull(ind.nearest_threshold_pct), costs_kind: strN(rec.costs && rec.costs.kind, 20) };
    if (share) { data.risk_usd = numOrNull(rec.risk.risk_usd); data.balance_used = numOrNull(rec.risk.balance_used); }
    return [
      mk('signal', `${rec.event_id}:sig`, rec.ts_ms, mode, key, { decision: 'entered', signal_candle_open_ms: data.signal_candle_open_ms, trade_id: rec.trade_id }),
      mk('entry', rec.event_id, rec.ts_ms, mode, key, data),
    ];
  }
  if (rec.type === 'exit') {
    const c = rec.costs || {};
    const data = { trade_id: rec.trade_id, reason: strN(rec.exit_reason, 20), exit: numOrNull(rec.exit_price), entry: numOrNull(rec.entry_summary && rec.entry_summary.fill_price), r: numOrNull(rec.r_result),
      hold_sec: numOrNull(rec.hold_sec), exit_candle_open_ms: numOrNull(rec.exit_candle_open_ms), costs_kind: strN(c.kind, 20), fees_pct_est: numOrNull(c.fees_pct), slippage_pct_est: numOrNull(c.slippage_pct), funding_est: numOrNull(c.funding_usd != null ? c.funding_usd : c.funding_r), fees_r: numOrNull(c.fees_r) };
    if (share) { data.usd = numOrNull(rec.usd_pnl); data.balance_after = numOrNull(rec.balance_after); }
    return [mk('exit', rec.event_id, rec.ts_ms, mode, key, data)];
  }
  if (rec.type === 'skip') {
    return [mk('signal', rec.event_id, rec.ts_ms, mode, key, { decision: 'skipped', reason: strN(rec.reason, 40), detail: strN(rec.detail, 200), signal_candle_open_ms: rec.match_key.signal_candle_open_ms, trade_id: rec.trade_id })];
  }
  return [];   // 'session' and anything else stays local
}

const lastPrice = {};   // symbol -> { px, candleMs }: public market data, lets the dashboard show the current R of an open position
const notePrice = (symbol, px, candleMs) => { if (allowedSymbol(symbol) && Number.isFinite(+px)) lastPrice[symbol] = { px: +px, candle_ms: candleMs }; };

function heartbeatEvent(i, nowMs = Date.now()) {
  const prices = {}; for (const s of config.ALLOWED_SYMBOLS) if (lastPrice[s]) prices[s] = lastPrice[s];
  return mk('heartbeat', `hb:${i.mode}:${Math.floor(nowMs / 1000)}`, nowMs, i.mode, {}, {
    status: strN(i.status || 'running', 20), last_candle_ms: i.lastCandleMs || {}, kill_switch: !!i.kill, drawdown_r: numOrNull(i.drawdownR), halt_r: numOrNull(i.haltR),
    commit: strN(i.commit, 12), version: strN(i.version, 20), uptime_sec: numOrNull(i.uptimeSec), next_wake_ms: numOrNull(i.nextWakeMs), prices, enabled_coins: i.coins || [],
  });
}
function equityEvent(i, nowMs = Date.now()) {
  const live = i.mode === 'live', share = !live || shareLiveEquity();
  const data = { total_r: numOrNull(i.totalR), peak_r: numOrNull(i.peakR), drawdown_r: numOrNull(i.drawdownR), trades: numOrNull(i.trades), candle_ms: numOrNull(i.candleMs) };
  if (share && i.balance != null) data[live ? 'equity_usd' : 'paper_balance'] = numOrNull(i.balance);
  return mk('equity', `eq:${i.mode}:${i.candleMs || Math.floor(nowMs / 14400000) * 14400}`, nowMs, i.mode, {}, data);
}
function compareEvent(summary, nowMs = Date.now()) {
  const s = summary || {};
  return mk('compare', `cmp:${s.generated_at || nowMs}`, nowMs, s.mode === 'live' ? 'live' : 'paper', {}, {
    match: !!s.match, window_from_ms: numOrNull(s.window && s.window.from_ms), window_to_ms: numOrNull(s.window && s.window.to_ms), tolerance_r: numOrNull(s.tolerance_r),
    matched: numOrNull(s.counts && s.counts.matched), live_only: numOrNull(s.counts && s.counts.live_only), backtest_only: numOrNull(s.counts && s.counts.backtest_only),
    skipped_signals: numOrNull(s.counts && s.counts.skipped_signals), candle_diffs: numOrNull(s.counts && s.counts.candle_diffs),
    mismatches: (s.investigation || []).slice(0, 20).map((m) => ({ kind: strN(m.kind, 30), symbol: allowedSymbol(m.symbol) ? m.symbol : null, side: strN(m.side, 6), signal_candle_open_ms: numOrNull(m.signal_candle_open_ms), why: strN(m.why, 160), nearest_threshold_pct: numOrNull(m.nearest_threshold_pct) })),
  });
}

// ---------------- outbox ----------------
let flushing = false, failures = 0, nextAttemptAt = 0, lastOkAt = 0, lastError = null, hbAt = 0;
function readCursor() { try { return Math.max(0, +JSON.parse(fs.readFileSync(CURSOR(), 'utf8')).sent || 0); } catch { return 0; } }
function writeCursor(n) { const tmp = CURSOR() + '.tmp', fd = fs.openSync(tmp, 'w'); try { fs.writeSync(fd, JSON.stringify({ sent: n })); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } fs.renameSync(tmp, CURSOR()); }
function readLines() { try { return fs.readFileSync(OUTBOX(), 'utf8').split('\n').filter((l) => l.trim()); } catch { return []; } }
const pending = () => Math.max(0, readLines().length - readCursor());

// queue events (already built). Never throws. Returns how many were queued.
function enqueue(events) {
  if (!enabled()) return 0;
  let n = 0;
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    const lines = [];
    for (const ev of events) {
      if (!ev || (ev.symbol && !allowedSymbol(ev.symbol))) continue;
      const json = JSON.stringify(ev), bad = leakCheck(json);
      if (bad.length) { warn(`event ${ev.type} dropped: it contained ${bad.join(', ')}`); continue; }
      lines.push(json); n++;
    }
    if (lines.length) { const fd = fs.openSync(OUTBOX(), 'a'); try { fs.writeSync(fd, lines.join('\n') + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
  } catch (e) { warn(`outbox write failed: ${e.message}`); }
  kick();
  return n;
}

// a hard deadline even for a fetch that ignores its AbortSignal
const withTimeout = (p, ms) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), ms); })]).finally(() => clearTimeout(t)); };

async function post(events, { fetchImpl = fetch, now = Date.now() } = {}) {
  const body = JSON.stringify({ events }), secret = process.env.DASHBOARD_PUSH_SECRET;
  const res = await withTimeout(fetchImpl(`${baseUrl()}/api/ingest`, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', 'X-Lucidio-Timestamp': String(now), 'X-Lucidio-Signature': sign(secret, now, body) }, body }), TIMEOUT_MS);
  return res.status;
}

// send everything queued, in order. Single-flight, with backoff. Resolves to { sent, pending } and never rejects.
async function flush({ fetchImpl = fetch, now = () => Date.now(), force = false } = {}) {
  if (!enabled() || flushing) return { sent: 0, pending: enabled() ? pending() : 0, skipped: true };
  if (!force && now() < nextAttemptAt) return { sent: 0, pending: pending(), backoff: true };
  flushing = true; let sent = 0;
  try {
    for (;;) {
      const lines = readLines(), cur = readCursor(), batch = lines.slice(cur, cur + BATCH);
      if (!batch.length) break;
      const events = []; for (const l of batch) { try { events.push(JSON.parse(l)); } catch {} }
      let status;
      try { status = await post(events, { fetchImpl, now: now() }); }
      catch (e) { failures++; lastError = e && e.name === 'TimeoutError' ? 'timeout' : (e && e.message) || 'network'; nextAttemptAt = now() + Math.min(MAX_BACKOFF_MS, 5000 * 2 ** Math.min(failures, 6)); warn(`push failed (${lastError}); ${lines.length - cur} event(s) queued, retrying later`); break; }
      if (status >= 200 && status < 300) { writeCursor(cur + batch.length); sent += batch.length; failures = 0; lastOkAt = now(); lastError = null; continue; }
      if (status === 400 || status === 413 || status === 422) {          // schema rejection: isolate the bad event(s) so they cannot block the queue
        let advanced = 0;
        for (const l of batch) {
          let one; try { one = JSON.parse(l); } catch { advanced++; continue; }
          let st2; try { st2 = await post([one], { fetchImpl, now: now() }); } catch (e) { st2 = 0; }
          if (st2 >= 200 && st2 < 300) { advanced++; sent++; }
          else if (st2 === 400 || st2 === 413 || st2 === 422) { try { fs.appendFileSync(REJECTED(), JSON.stringify({ at: new Date().toISOString(), status: st2, event: one }) + '\n'); } catch {} advanced++; }
          else break;                                                    // outage or auth problem: stop here, retry later
        }
        if (advanced) { writeCursor(cur + advanced); }
        if (advanced < batch.length) { failures++; lastError = `HTTP ${status}`; nextAttemptAt = now() + Math.min(MAX_BACKOFF_MS, 5000 * 2 ** Math.min(failures, 6)); break; }
        continue;
      }
      failures++; lastError = `HTTP ${status}`; nextAttemptAt = now() + Math.min(MAX_BACKOFF_MS, 5000 * 2 ** Math.min(failures, 6));   // 401/403 (secret, clock), 429, 5xx: keep the queue
      warn(`dashboard answered HTTP ${status}${status === 401 || status === 403 ? ' (check DASHBOARD_PUSH_SECRET and the server clock)' : ''}; events stay queued`);
      break;
    }
  } catch (e) { warn(`flush error: ${e.message}`); }
  finally { flushing = false; }
  return { sent, pending: pending() };
}
const kick = () => { if (enabled() && !flushing) flush().catch(() => {}); };

// ---------------- the bot's calls ----------------
const safe = (fn) => { try { return fn(); } catch (e) { warn(e.message); return 0; } };
const pushJournal = (rec) => safe(() => enqueue(fromJournal(rec)));
const pushHeartbeat = (info, nowMs = Date.now()) => safe(() => { hbAt = nowMs; return enqueue([heartbeatEvent(info, nowMs)]); });
// the bot already reports at EVERY 4h candle close (lucidio.js, after each run); this is only the safety net for a long quiet spell: once a day by default (was 5 minutes).
// Anything faster is the "Ask bot now" button's job. DASHBOARD_HEARTBEAT_SEC changes it (minimum 60).
const heartbeatSec = () => { const n = Number(process.env.DASHBOARD_HEARTBEAT_SEC); return Number.isFinite(n) && n >= 60 ? n : 86400; };
const heartbeatDue = (nowMs = Date.now(), everyMs = heartbeatSec() * 1000) => enabled() && nowMs - hbAt >= everyMs;
const pushEquity = (info) => safe(() => enqueue([equityEvent(info)]));
const pushCompare = (summary) => safe(() => enqueue([compareEvent(summary)]));

// ---------------- "Ask bot now" ----------------
// The dashboard button leaves a request; the bot ASKS for it (outbound GET /api/poll, signed, no body) and answers with an immediate heartbeat. Nothing connects to the VPS.
// Safety: this is its own timer, never awaited by the main loop or by a trade; it does nothing while a run is in progress (busy()); one request at a time with a 5 s hard
// timeout; every failure is swallowed and slows the polling down (up to 10x) instead of retrying fast; the answer only reads the state file (atomic writes) and queues a normal heartbeat.
//   DASHBOARD_ASK_POLL_SEC   seconds between asks, default 60, minimum 20; 0 = never ask (the button then cannot reach the bot)
const askPollSec = () => { const v = process.env.DASHBOARD_ASK_POLL_SEC; if (v === undefined || v === '') return 60; const n = Number(v); return !Number.isFinite(n) ? 60 : n <= 0 ? 0 : Math.max(20, n); };
let askTimer = null, askFails = 0, askBusy = false;
async function pollOnce({ fetchImpl = fetch, now = Date.now() } = {}) {   // -> true (someone asked) | false; throws on network / HTTP errors (the caller counts them)
  const secret = process.env.DASHBOARD_PUSH_SECRET;
  const res = await withTimeout(fetchImpl(`${baseUrl()}/api/poll`, { method: 'GET', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'X-Lucidio-Timestamp': String(now), 'X-Lucidio-Signature': sign(secret, now, '') } }), TIMEOUT_MS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await withTimeout(res.json(), TIMEOUT_MS);
  return !!(j && j.ask === true);
}
// provider() -> the same status object the run-end heartbeat uses; busy() -> true while a run is in progress
function startAskPoll({ provider, busy = () => false, fetchImpl = fetch } = {}) {
  const base = askPollSec();
  if (!enabled() || !base || askTimer) return false;
  const tick = async () => {
    let next = base * 1000;
    try {
      if (!askBusy && !busy()) {
        askBusy = true;
        try { if (await pollOnce({ fetchImpl })) safe(() => pushHeartbeat(provider())); askFails = 0; }
        catch (e) { askFails++; next = base * 1000 * Math.min(10, 2 ** Math.min(askFails, 4)); if (askFails === 3) warn(`ask-poll failing (${(e && e.message) || 'error'}); slowing down`); }
        finally { askBusy = false; }
      }
    } catch {}
    askTimer = setTimeout(tick, next); if (askTimer.unref) askTimer.unref();
  };
  askTimer = setTimeout(tick, Math.min(15000, base * 1000)); if (askTimer.unref) askTimer.unref();
  return true;
}
const stopAskPoll = () => { if (askTimer) clearTimeout(askTimer); askTimer = null; askFails = 0; askBusy = false; };

// `check`: configured? reachable? (GET /api/health, no auth, returns {ok:true} and nothing else)
async function reachable({ fetchImpl = fetch } = {}) {
  if (!enabled()) return { configured: false, ok: false, detail: 'DASHBOARD_URL / DASHBOARD_PUSH_SECRET not set: pushing is off (the bot works the same without it)' };
  try {
    const res = await withTimeout(fetchImpl(`${baseUrl()}/api/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) }), TIMEOUT_MS);
    let j = null; try { j = await withTimeout(res.json(), TIMEOUT_MS); } catch {}
    return { configured: true, ok: res.ok && !!(j && j.ok), detail: res.ok ? `reachable (HTTP ${res.status}), ${pending()} event(s) queued` : `HTTP ${res.status}` };
  } catch (e) { return { configured: true, ok: false, detail: `unreachable: ${e && e.name === 'TimeoutError' ? 'timeout' : (e && e.message) || 'error'}` }; }
}
const status = () => ({ enabled: enabled(), pending: enabled() ? pending() : 0, failures, lastOkAt, lastError });

// `dashboard-backfill`: every event already in the journal, same event ids (so nothing is ever double counted)
async function backfill(journalEvents, opt = {}) {
  if (!enabled()) return { ok: false, detail: 'DASHBOARD_URL / DASHBOARD_PUSH_SECRET not set' };
  const evs = journalEvents.flatMap((r) => fromJournal(r)); const n = enqueue(evs);
  const r = await flush({ ...opt, force: true });
  return { ok: true, queued: n, journalEvents: journalEvents.length, sent: r.sent, pending: r.pending };
}

const _reset = () => { flushing = false; failures = 0; nextAttemptAt = 0; lastOkAt = 0; lastError = null; hbAt = 0; warnAt = 0; stopAskPoll(); for (const k of Object.keys(lastPrice)) delete lastPrice[k]; };

module.exports = { enabled, setLogger, sign, leakCheck, fromJournal, heartbeatEvent, equityEvent, compareEvent, enqueue, flush, kick, pending, pushJournal, pushHeartbeat, heartbeatDue, heartbeatSec, pollOnce, startAskPoll, stopAskPoll, askPollSec, pushEquity, pushCompare, notePrice, reachable, status, backfill, shareLiveEquity, _reset };
