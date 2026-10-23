// test/telegram-test.js - Telegram: message formats, credentials, the telegram-setup flow, and "a Telegram failure never blocks a trade".
//   node test/telegram-test.js       No network (fetch is a mock), no real token, nothing sent anywhere.
'use strict';
const path = require('path');
const H = require('./helpers.js');
const STATE = H.tmp('telegram-state');
process.env.LUCIDIO_STATE_DIR = STATE; process.env.LUCIDIO_JOURNAL_DIR = path.join(STATE, 'journal');
process.env.LUCIDIO_ENV_FILE = path.join(STATE, 'no-such.env'); process.env.LUCIDIO_KEYS = path.join(STATE, 'no-such-keys.json');
delete process.env.LUCIDIO_NO_NOTIFY;
for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET']) delete process.env[k];
const FAKE_TOKEN = '123456789' + ':' + 'FAKE_TOKEN_' + 'FOR_TEST_ONLY_0123456789';    // built in pieces: nothing token-shaped in the source
const tg = require('../telegram.js'), bot = require('../lucidio.js');

let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const mockTelegram = (handlers) => { const calls = []; const f = async (url, opts) => { const m = /\/bot[^/]+\/(\w+)/.exec(url)[1]; calls.push({ method: m, body: JSON.parse((opts && opts.body) || '{}') }); return handlers[m] ? handlers[m](JSON.parse((opts && opts.body) || '{}')) : reply({ ok: false, description: 'unexpected' }, 404); }; f.calls = calls; return f; };

(async () => {
  // ---------- formats ----------
  const sig = Date.UTC(2026, 9, 23, 8, 0) / 1000;
  const entryMsg = tg.fmtEntry({ symbol: 'SOL_USDT', dir: 1, mode: 'paper', entry: 148.32, stop: 144.10, tp: 160.97, riskPct: 0.005, oneR: 4.22, sigTime: sig });
  ok(entryMsg === '🟢 ENTRY LONG SOL_USDT [paper]\nEntry 148.32 | SL 144.10 | TP 160.97\nRisk 0.5% (1R = 4.22) | Signal candle 2026-10-23 08:00 UTC', 'entry message is exactly the specified format');
  const shortMsg = tg.fmtEntry({ symbol: 'ZEC_USDT', dir: -1, mode: 'live', entry: 1219.5, stop: 1240, tp: 1137.5, riskPct: 0.01, oneR: 20.5, sigTime: sig });
  ok(shortMsg.startsWith('🔴 ENTRY SHORT ZEC_USDT [live]') && /Risk 1% \(1R = 20\.50\)/.test(shortMsg), 'short entry: red marker, symbol, mode, risk % and 1R in price terms');
  const exitMsg = tg.fmtExit({ symbol: 'SOL_USDT', dir: 1, mode: 'paper', why: 'target', exit: 160.97, entry: 148.32, R: 3.91, holdSec: 5 * 86400 + 3 * 3600 });
  ok(exitMsg === '✅ EXIT LONG SOL_USDT [paper]\ntarget @ 160.97 (entry 148.32) | +3.91R | held 5d 3h', 'exit message: reason, exit price, R, hold duration');
  ok(/❌ EXIT/.test(tg.fmtExit({ symbol: 'SOL_USDT', dir: 1, mode: 'paper', why: 'stop', exit: 144, entry: 148.32, R: -1.02, holdSec: 5400 })) && /held 1h 30m/.test(tg.fmtExit({ symbol: 'SOL_USDT', dir: 1, mode: 'paper', why: 'stop', exit: 144, entry: 148.32, R: -1.02, holdSec: 5400 })), 'stop exit: loss marker and short hold format');

  // ---------- credentials ----------
  ok(!tg.configured() && tg.creds().tokenFrom === 'missing', 'no credentials -> not configured');
  process.env.TELEGRAM_BOT_TOKEN = FAKE_TOKEN; process.env.TELEGRAM_CHAT_ID = '555000111';
  ok(tg.configured() && tg.creds().tokenFrom === 'env' && tg.creds().chatFrom === 'env', 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the environment (env file) are used');
  ok(!tg.scrub(`failed https://api.telegram.org/bot${FAKE_TOKEN}/sendMessage`).includes('FAKE_TOKEN'), 'scrub() removes the token from any text');

  // ---------- send(): never throws, times out ----------
  const t0 = Date.now(); const hang = await tg.send('x', { fetchImpl: () => new Promise(() => {}), timeoutMs: 80 });
  ok(hang.ok === false && Date.now() - t0 < 1500 && /timeout/.test(hang.error || ''), `a hanging Telegram request times out (${Date.now() - t0} ms) and returns { ok: false }`);
  const thrown = await tg.send('x', { fetchImpl: async () => { throw new Error(`connect failed bot${FAKE_TOKEN}`); } });
  ok(thrown.ok === false && !String(thrown.error).includes('FAKE_TOKEN'), 'a throwing fetch is caught and the error text carries no token');
  const http401 = await tg.send('x', { fetchImpl: async () => reply({ ok: false, description: 'Unauthorized' }, 401) });
  ok(http401.ok === false && /401/.test(http401.error), 'HTTP errors are reported, not thrown');

  // ---------- telegram-setup ----------
  const run = async (handlers, env) => {
    for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']) delete process.env[k];
    Object.assign(process.env, env || {});
    const out = [], f = mockTelegram(handlers), r = await tg.setup({ fetchImpl: f, out: (l) => out.push(l) });
    return { r, text: out.join('\n'), f };
  };
  let s = await run({});
  ok(!s.r.ok && s.r.step === 'token' && s.f.calls.length === 0 && /@BotFather/.test(s.text), 'setup without a token: tells you to create the bot, makes no request');
  s = await run({ getMe: () => reply({ ok: false, description: 'Unauthorized' }, 401) }, { TELEGRAM_BOT_TOKEN: FAKE_TOKEN });
  ok(!s.r.ok && s.r.step === 'getMe' && !s.text.includes('FAKE_TOKEN'), 'setup with a bad token: getMe fails, clear message, token not printed');
  s = await run({ getMe: () => reply({ ok: true, result: { username: 'lucidio_bot' } }), getUpdates: () => reply({ ok: true, result: [] }) }, { TELEGRAM_BOT_TOKEN: FAKE_TOKEN });
  ok(!s.r.ok && s.r.step === 'no-update' && /press START/i.test(s.text) && /@lucidio_bot/.test(s.text) && !s.f.calls.some((c) => c.method === 'sendMessage'), 'no chat id and no update yet: asks you to press Start on the bot and rerun, sends nothing');
  s = await run({ getMe: () => reply({ ok: true, result: { username: 'lucidio_bot' } }), getUpdates: () => reply({ ok: true, result: [{ update_id: 1, message: { chat: { id: 424242, type: 'private', username: 'jamesrfael' } } }] }), sendMessage: () => reply({ ok: true, result: {} }) }, { TELEGRAM_BOT_TOKEN: FAKE_TOKEN });
  ok(s.r.ok && s.r.chatId === '424242' && /chat id found\s+: 424242/.test(s.text) && /TELEGRAM_CHAT_ID=424242/.test(s.text) && s.f.calls.some((c) => c.method === 'sendMessage' && c.body.chat_id === '424242'), 'chat id found via getUpdates, printed, and the test message is sent to it');
  ok(!s.text.includes('FAKE_TOKEN') && !s.text.includes('123456789:'), 'the setup output never contains the token');
  s = await run({ getMe: () => reply({ ok: true, result: { username: 'lucidio_bot' } }), sendMessage: () => reply({ ok: true, result: {} }) }, { TELEGRAM_BOT_TOKEN: FAKE_TOKEN, TELEGRAM_CHAT_ID: '777' });
  ok(s.r.ok && !s.f.calls.some((c) => c.method === 'getUpdates') && s.f.calls.some((c) => c.method === 'sendMessage' && c.body.chat_id === '777'), 'chat id already set: no getUpdates, test message sent');
  s = await run({ getMe: () => reply({ ok: true, result: { username: 'lucidio_bot' } }), sendMessage: () => reply({ ok: false, description: 'chat not found' }, 400) }, { TELEGRAM_BOT_TOKEN: FAKE_TOKEN, TELEGRAM_CHAT_ID: '777' });
  ok(!s.r.ok && s.r.step === 'sendMessage' && /START/.test(s.text), 'test message refused (chat not found): clear hint about pressing Start');
  const rch = await tg.reachable({ fetchImpl: mockTelegram({ getMe: () => reply({ ok: true, result: { username: 'lucidio_bot' } }) }) });
  ok(rch.configured && rch.ok && /@lucidio_bot/.test(rch.detail), 'reachable() (used by `check`): configured and reachable');

  // ---------- Telegram failure never blocks, delays or crashes a trade ----------
  process.env.TELEGRAM_BOT_TOKEN = FAKE_TOKEN; process.env.TELEGRAM_CHAT_ID = '555000111';
  const sc = H.scenario('SOL', 40), sent = [];
  global.fetch = async (url, opts) => { sent.push(JSON.parse(opts.body).text); return reply({ ok: true, result: {} }); };
  let r1 = await H.runTrade(bot.processCoin, bot.paper, sc, { hooks: bot.makeHooks() });
  const entries = sent.filter((m) => m.includes('ENTRY')), exits = sent.filter((m) => m.includes('EXIT'));
  const enterEvents = r1.events.filter((e) => e.startsWith('ENTER')).length;   // the exit candle can also open the next trade (allowed), which is a second ENTRY
ok(r1.st.n === 1 && entries.length === enterEvents && enterEvents >= 1 && exits.length === 1, `every ENTER sends exactly one ENTRY message and the exit exactly one EXIT message (${entries.length} entry for ${enterEvents} ENTER event(s), ${exits.length} exit)`);
  ok(/^(🟢|🔴) ENTRY (LONG|SHORT) SOL_USDT \[paper\]\nEntry \d+\.\d\d \| SL \d+\.\d\d \| TP \d+\.\d\d\nRisk [\d.]+% \(1R = \d+\.\d\d\) \| Signal candle \d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(entries[0]), `the live entry message has the specified shape: ${JSON.stringify(entries[0])}`);
  const modes = [['hanging', () => new Promise(() => {})], ['rejecting', async () => { throw new Error('network down'); }], ['HTTP 500', async () => reply({ ok: false }, 500)]];
  for (const [name, impl] of modes) {
    global.fetch = impl;
    const t1 = Date.now(), r2 = await H.runTrade(bot.processCoin, bot.paper, sc, { hooks: bot.makeHooks() });
    ok(r2.st.n === 1 && r2.st.trades[0].why === r1.st.trades[0].why && Math.abs(r2.st.trades[0].R - r1.st.trades[0].R) < 1e-9 && Date.now() - t1 < 3000, `Telegram ${name}: the trade is opened, managed and closed with the identical result (${Date.now() - t1} ms, no delay, no crash)`);
  }
  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
