// telegram.js - Telegram Bot API alerts for Lucid'io. No npm packages. A bot token + chat id, never a phone number.
//
//   credentials   env TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (server env file), else the older fields telegramToken / telegramChatId
//                 in mexc-keys.json. The token is never printed, logged or put in an error message (scrub()).
//   send(text)    fire-and-forget safe: 8 s timeout, catches everything, returns { ok } and never throws. Callers do NOT await it
//                 in the trading path, so Telegram being slow or down can never block, delay or crash a trade or the main loop.
//   setup()       `node lucidio.js telegram-setup`: checks the env vars, getMe, finds the chat id via getUpdates, sends a test message.
//   fmtEntry/fmtExit  the two trade messages.
'use strict';
const fs = require('fs'), path = require('path');

const API = 'https://api.telegram.org';
const keysFile = () => process.env.LUCIDIO_KEYS || path.join(__dirname, 'mexc-keys.json');
function readKeys() { try { return JSON.parse(fs.readFileSync(keysFile(), 'utf8')); } catch { return {}; } }

function creds() {
  const k = readKeys();
  const token = String(process.env.TELEGRAM_BOT_TOKEN || k.telegramToken || '').trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || k.telegramChatId || '').trim();
  const from = (envName, keyName) => (process.env[envName] ? 'env' : k[keyName] ? 'mexc-keys.json' : 'missing');
  return { token, chatId, tokenFrom: from('TELEGRAM_BOT_TOKEN', 'telegramToken'), chatFrom: from('TELEGRAM_CHAT_ID', 'telegramChatId') };
}
const configured = () => { const c = creds(); return !!(c.token && c.chatId); };

// remove the token (and the bot<token> URL form) from any text that might be logged
const scrub = (s, token = creds().token) => {
  let t = String(s == null ? '' : s);
  if (token) t = t.split(`bot${token}`).join('bot***').split(token).join('***');
  return t.replace(/\d{6,12}:[A-Za-z0-9_-]{30,}/g, '***');
};

// a hard deadline even for a fetch that ignores its AbortSignal
const withTimeout = (p, ms) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), ms); })]).finally(() => clearTimeout(t)); };

async function call(method, body, { fetchImpl = fetch, timeoutMs = 8000, token = creds().token } = {}) {
  if (!token) return { ok: false, error: 'no token', skipped: true };
  try {
    const res = await withTimeout(fetchImpl(`${API}/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(timeoutMs) }), timeoutMs);
    let j = null; try { j = await withTimeout(res.json(), timeoutMs); } catch {}
    if (!res.ok || (j && j.ok === false)) return { ok: false, status: res.status, error: scrub(`Telegram ${method}: HTTP ${res.status} ${(j && j.description) || ''}`.trim(), token) };
    return { ok: true, status: res.status, result: j && j.result };
  } catch (e) { return { ok: false, error: scrub(`Telegram ${method}: ${e && e.name === 'TimeoutError' ? 'timeout' : e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'error'}`, token) }; }
}

// text -> the configured chat. Never throws. LUCIDIO_NO_NOTIFY=1 (tests) or missing credentials -> { ok: false, skipped: true }.
async function send(text, opt = {}) {
  try {
    if (process.env.LUCIDIO_NO_NOTIFY) return { ok: false, skipped: true };
    const c = creds();
    if (!c.token || !c.chatId) return { ok: false, skipped: true, error: 'telegram not configured' };
    return await call('sendMessage', { chat_id: c.chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true }, { token: c.token, ...opt });
  } catch (e) { return { ok: false, error: scrub((e && e.message) || 'error') }; }
}

// for `check`: configured? token valid? returns { configured, ok, username?, detail }
async function reachable(opt = {}) {
  const c = creds();
  if (!c.token) return { configured: false, ok: false, detail: 'TELEGRAM_BOT_TOKEN not set (and no telegramToken in mexc-keys.json)' };
  const me = await call('getMe', {}, { token: c.token, ...opt });
  if (!me.ok) return { configured: !!c.chatId, ok: false, detail: me.error };
  return { configured: !!(c.token && c.chatId), ok: true, username: me.result && me.result.username, detail: c.chatId ? `bot @${me.result && me.result.username} reachable, chat id set (${c.chatFrom})` : `bot @${me.result && me.result.username} reachable but TELEGRAM_CHAT_ID is missing: run telegram-setup` };
}

// `node lucidio.js telegram-setup`
async function setup({ fetchImpl = fetch, out = console.log, timeoutMs = 10000 } = {}) {
  const c = creds(), o = { fetchImpl, timeoutMs, token: c.token };
  out('Telegram setup (the token is never printed)');
  out(`  TELEGRAM_BOT_TOKEN : ${c.token ? 'set (' + c.tokenFrom + ')' : 'MISSING'}`);
  out(`  TELEGRAM_CHAT_ID   : ${c.chatId ? 'set (' + c.chatFrom + ')' : 'missing (will try to find it)'}`);
  if (!c.token) { out('\nCreate the bot: Telegram -> @BotFather -> /newbot, copy the token into TELEGRAM_BOT_TOKEN in the server env file, then rerun.'); return { ok: false, step: 'token' }; }
  const me = await call('getMe', {}, o);
  if (!me.ok) { out(`\ngetMe FAILED: ${me.error}. Check the token (copy it again from @BotFather) and that this server can reach api.telegram.org.`); return { ok: false, step: 'getMe' }; }
  const uname = me.result && me.result.username;
  out(`  getMe              : OK, bot @${uname}`);
  let chatId = c.chatId;
  if (!chatId) {
    const up = await call('getUpdates', { limit: 20, timeout: 0 }, o);
    if (!up.ok) { out(`\ngetUpdates FAILED: ${up.error}`); return { ok: false, step: 'getUpdates' }; }
    const hits = (up.result || []).map((u) => (u.message || u.edited_message || (u.my_chat_member && { chat: u.my_chat_member.chat }) || {}).chat).filter((ch) => ch && ch.id != null);
    if (!hits.length) { out(`\nNo update found yet. In Telegram open @${uname}, press START (or send it any message), then run this command again.`); return { ok: false, step: 'no-update' }; }
    const ch = hits[hits.length - 1]; chatId = String(ch.id);
    out(`  chat id found      : ${chatId}${ch.username ? ' (@' + ch.username + ')' : ''}${ch.type && ch.type !== 'private' ? ' [' + ch.type + ']' : ''}`);
    out('\n  -> put this in the server env file:  TELEGRAM_CHAT_ID=' + chatId);
  }
  const t = await call('sendMessage', { chat_id: chatId, text: `Lucid'io: Telegram is connected (test message ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC).` }, o);
  if (!t.ok) { out(`\ntest message FAILED: ${t.error}. For a private chat you must have pressed START on @${uname} first.`); return { ok: false, step: 'sendMessage' }; }
  out('  test message       : SENT, check your Telegram');
  out(c.chatId ? '\nAll set. Restart the service and run `check`.' : '\nNext: add TELEGRAM_CHAT_ID to the env file, `sudo systemctl restart lucidio`, run `check`.');
  return { ok: true, chatId };
}

// ---------------- message formats ----------------
// fixed decimals chosen from the size of the price (SOL and ZEC: 2), so a stop of 144.10 reads "144.10" and not "144.1"
const decimalsFor = (price) => { const p = Math.abs(+price); return p >= 10 ? 2 : p >= 1 ? 4 : p >= 0.1 ? 5 : 6; };
const px = (v, d = 2) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(d));
const utc = (sec) => new Date(sec * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const pctStr = (f) => `${+(f * 100).toFixed(2)}%`;
function dur(sec) {
  sec = Math.max(0, Math.round(sec)); const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}
// i = { symbol, dir (1/-1), mode, entry, stop, tp, riskPct (fraction of balance), oneR (price distance), sigTime (unix sec of the signal candle open) }
function fmtEntry(i) {
  const d = decimalsFor(i.entry);
  return `${i.dir === 1 ? '🟢' : '🔴'} ENTRY ${i.dir === 1 ? 'LONG' : 'SHORT'} ${i.symbol} [${i.mode}]\n` +
    `Entry ${px(i.entry, d)} | SL ${px(i.stop, d)} | TP ${px(i.tp, d)}\n` +
    `Risk ${pctStr(i.riskPct)} (1R = ${px(i.oneR, d)}) | Signal candle ${utc(i.sigTime)}`;
}
// i = { symbol, dir, mode, why ('stop'|'target'|'time'|...), exit, entry, R, holdSec }
function fmtExit(i) {
  const icon = i.R > 0 ? '✅' : i.R < 0 ? '❌' : '⚪', d = decimalsFor(i.entry);
  return `${icon} EXIT ${i.dir === 1 ? 'LONG' : 'SHORT'} ${i.symbol} [${i.mode}]\n` +
    `${i.why} @ ${px(i.exit, d)} (entry ${px(i.entry, d)}) | ${i.R >= 0 ? '+' : ''}${Number(i.R).toFixed(2)}R | held ${dur(i.holdSec)}`;
}

module.exports = { creds, configured, scrub, send, call, reachable, setup, fmtEntry, fmtExit, px, decimalsFor, utc, dur };
