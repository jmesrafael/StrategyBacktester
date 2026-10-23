// deploy/watchdog.js — independent "is the bot alive?" check, run by a systemd timer every 10 minutes (and by OnFailure= when the service dies).
// A dead bot cannot report that it is dead, so this is a separate process. No npm packages, never prints a secret.
//
//   node deploy/watchdog.js                  alert (Telegram) when no run was recorded for 4h20m; repeat hourly; send "recovered" once
//   node deploy/watchdog.js --notify "text"  send one Telegram message now (used by lucidio-failed.service)
//   node deploy/watchdog.js --status         print the decision, send nothing
//
// "A run" = state/state.json lastRun.ts (written at the end of every run, paper or live). The bot runs once per 4h candle close,
// so 4h + 20 min grace = the same rule as a healthchecks.io check with period 4h / grace 20 min on heartbeatUrl.
// Test hooks: LUCIDIO_STATE_DIR, LUCIDIO_KEYS (path of mexc-keys.json), WATCHDOG_NOW (ms), WATCHDOG_DRY=1 (print instead of send).
'use strict';
const fs = require('fs'), path = require('path');
const { load: loadEnv } = require('../envfile.js');

const MAX_SILENCE_MS = (4 * 60 + 20) * 60 * 1000;   // 4h20m
const REPEAT_MS = 60 * 60 * 1000;                   // re-alert hourly while the bot stays silent
const APP = path.join(__dirname, '..');
const STATE_DIR = process.env.LUCIDIO_STATE_DIR || path.join(APP, 'state');
const KEYS = process.env.LUCIDIO_KEYS || path.join(APP, 'mexc-keys.json');
const MARK = path.join(STATE_DIR, 'watchdog.json');

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

// last time the bot finished a run (ms), and where that came from; null = nothing recorded at all
function lastRunMs() {
  const st = readJson(path.join(STATE_DIR, 'state.json'));
  const t = st && st.lastRun && Date.parse(st.lastRun.ts);
  if (t) return { t, from: 'state.json lastRun' };
  const pid = readJson(path.join(STATE_DIR, 'bot.pid')), p = pid && Date.parse(pid.startedAt);   // started but never finished a run yet
  if (p) return { t: p, from: 'bot.pid startedAt' };
  return null;
}

async function send(text, fetchImpl = fetch) {
  const msg = `Lucid'io WATCHDOG: ${text}`;
  if (process.env.WATCHDOG_DRY === '1') { console.log('[dry] would send: ' + msg); return true; }
  loadEnv();
  const k = readJson(KEYS) || {};
  const token = String(process.env.TELEGRAM_BOT_TOKEN || k.telegramToken || '').trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || k.telegramChatId || '').trim();
  if (!token || !chatId) { console.error('ALERT (no Telegram configured): ' + msg); return false; }
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000), body: JSON.stringify({ chat_id: chatId, text: msg }) });
    if (!res.ok) { console.error(`Telegram answered HTTP ${res.status}`); return false; }
    return true;
  } catch (e) { console.error('Telegram send failed: ' + (e.name || 'error')); return false; }   // never print e.message / URL: it can contain the token
}

async function check({ now = Number(process.env.WATCHDOG_NOW) || Date.now(), fetchImpl = fetch, statusOnly = false } = {}) {
  const last = lastRunMs(), mark = readJson(MARK) || {};
  const age = last ? now - last.t : Infinity, silent = age > MAX_SILENCE_MS;
  const human = last ? `${Math.floor(age / 3600000)}h${String(Math.floor(age / 60000) % 60).padStart(2, '0')}m` : 'never';
  const decision = { silent, age: human, lastRun: last ? new Date(last.t).toISOString() : null, down: !!mark.down };
  if (statusOnly) return { ...decision, action: 'none (--status)' };
  let action = 'none';
  if (silent && (!mark.down || now - (mark.alertedAt || 0) >= REPEAT_MS)) {
    const sent = await send(`no bot run recorded for ${human} (limit 4h20m, last run ${decision.lastRun || 'never'}). Check: systemctl status lucidio; journalctl -u lucidio -n 50`, fetchImpl);
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(MARK, JSON.stringify({ down: true, alertedAt: now, sent }));
    action = sent ? 'alert sent' : 'alert FAILED (no Telegram?)';
    if (!sent) process.exitCode = 2;                     // makes `systemctl --failed` show the watchdog unit
  } else if (!silent && mark.down) {
    await send(`bot is running again (last run ${decision.lastRun}).`, fetchImpl);
    fs.writeFileSync(MARK, JSON.stringify({ down: false, recoveredAt: now }));
    action = 'recovery sent';
  }
  return { ...decision, action };
}

module.exports = { check, send, lastRunMs, MAX_SILENCE_MS };

if (require.main === module) {
  const i = process.argv.indexOf('--notify');
  if (i > 0) send(process.argv[i + 1] || 'notification').then((ok) => { process.exitCode = ok ? 0 : 2; });
  else check({ statusOnly: process.argv.includes('--status') }).then((r) => console.log(`[${new Date().toISOString()}] watchdog: last run ${r.lastRun || 'never'} (${r.age} ago) · ${r.silent ? 'SILENT' : 'ok'} · ${r.action}`));
}
