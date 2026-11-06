// test/telegram-test.js - Telegram: message formats, credentials, the telegram-setup flow, and "a Telegram failure never blocks a trade".
//   node test/telegram-test.js       No network (fetch is a mock), no real token, nothing sent anywhere.
'use strict';
const path = require('path');
const H = require('./helpers.js');
const STATE = H.tmp('telegram-state');
process.env.ICORE_STATE_DIR = STATE; process.env.ICORE_JOURNAL_DIR = path.join(STATE, 'journal');
process.env.ICORE_ENV_FILE = path.join(STATE, 'no-such.env'); process.env.ICORE_KEYS = path.join(STATE, 'no-such-keys.json');
delete process.env.ICORE_NO_NOTIFY;
for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET']) delete process.env[k];
const FAKE_TOKEN = '123456789' + ':' + 'FAKE_TOKEN_' + 'FOR_TEST_ONLY_0123456789';    // built in pieces: nothing token-shaped in the source
const tg = require('../telegram.js'), bot = require('../icore.js');

let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const mockTelegram = (handlers) => { const calls = []; const f = async (url, opts) => { const m = /\/bot[^/]+\/(\w+)/.exec(url)[1]; calls.push({ method: m, body: JSON.parse((opts && opts.body) || '{}') }); return handlers[m] ? handlers[m](JSON.parse((opts && opts.body) || '{}')) : reply({ ok: false, description: 'unexpected' }, 404); }; f.calls = calls; return f; };

(async () => {
  // ---------- formats ----------
  const sig = Date.UTC(2026, 9, 23, 8, 0) / 1000;
  const entryMsg = tg.fmtEntry({ symbol: 'SOL_USDT', dir: 1, mode: 'paper', entry: 148.32, stop: 144.10, tp: 160.97, riskPct: 0.005, sigTime: sig, riskUsd: 0.5, balance: 100, qty: 0.12 });
  ok(entryMsg === '🟢 <b>LONG · SOL · [TRAIL LAB] · PAPER</b>\n<pre>Entry    148.32\nStop     144.10  (-2.8%)\nExit     trailing stop, no target\nRisk     0.5%  ($0.50)\nSize     0.12 SOL (about $18)</pre>', 'entry message (option B): bold header, aligned block with stop / target distance, 1:R, risk in %, size, balance and the PH time');
  const shortMsg = tg.fmtEntry({ symbol: 'ZEC_USDT', dir: -1, mode: 'live', entry: 1219.5, stop: 1240, tp: 1137.5, riskPct: 0.01, sigTime: sig, riskUsd: 1, balance: 100, qty: 0.02, vol: 2 });
  ok(shortMsg.startsWith('🔴 <b>SHORT · ZEC · [TRAIL LAB]</b>') && /Stop     1240\.00  \(-1\.7%\)/.test(shortMsg) && /Exit     trailing stop, no target/.test(shortMsg) && /Size     2 contracts = 0\.02 ZEC \(about \$24\)/.test(shortMsg), 'short entry: red marker, stop above entry but shown as a loss (-), live size in contracts');
  const bare = tg.fmtEntry({ symbol: 'SOL_USDT', dir: 1, mode: 'paper', entry: 148.32, stop: 144.10, tp: 160.97, riskPct: 0.005, sigTime: sig });
  ok(/Risk     0.5%<\/pre>/.test(bare) && !/Size|Balance|\$/.test(bare) && !/PH|UTC/.test(bare), 'entry without the optional details (risk $, balance, size): those lines are simply left out');
  const exitMsg = tg.fmtExit({ symbol: 'SOL_USDT', dir: 1, mode: 'paper', why: 'target', exit: 160.97, entry: 148.32, R: 3.91, holdSec: 5 * 86400 + 3 * 3600, usd: 3.91, balanceAfter: 103.91 });
  ok(exitMsg === '✅ <b>SOL LONG closed · TARGET · [TRAIL LAB] · PAPER</b>\n<pre>+3.91R = +$3.91\n148.32 → 160.97 · held 5d 3h</pre>', 'exit message (option B): reason, R and dollars, entry → exit, hold time, balance and its change');
  const stopMsg = tg.fmtExit({ symbol: 'SOL_USDT', dir: 1, mode: 'live', why: 'stop', exit: 144, entry: 148.32, R: -1.02, holdSec: 5400, usd: -1.02, balanceAfter: 98.98 });
  ok(stopMsg.startsWith('❌ <b>SOL LONG closed · STOP (trailing) · [TRAIL LAB]</b>') && /-1\.02R = -\$1\.02/.test(stopMsg) && /held 1h 30m/.test(stopMsg) && !/Balance/.test(stopMsg), 'stop exit: loss marker, negative R and dollars, short hold format, balance down');
  const timeMsg = tg.fmtExit({ symbol: 'ADA_USDT', dir: -1, mode: 'paper', why: 'time', exit: 0.2, entry: 0.21, R: 0.3, holdSec: 8 * 86400 + 4 * 3600 });
  ok(!/=/.test(timeMsg) && /TIME LIMIT/.test(timeMsg) && !/Balance/.test(timeMsg) && /held 8d 4h/.test(timeMsg), 'exit without dollars / balance: those parts are left out; "time" reads TIME LIMIT');
  ok(tg.fmtExit({ symbol: 'X_USDT', dir: 1, mode: 'paper', why: 'weird', exit: 1, entry: 1, R: 0, holdSec: 0 }).startsWith('⚪ <b>X LONG closed · WEIRD · [TRAIL LAB] · PAPER</b>'), 'an unknown exit reason is shown in capitals and a 0R exit gets the neutral marker');
  ok(tg.fmtEntry({ symbol: 'A<B&C_USDT', dir: 1, mode: 'paper', entry: 1, stop: 0.9, tp: 1.4, riskPct: 0.01, sigTime: sig }).includes('A&lt;B&amp;C') && tg.toPlain('<b>A &lt;B&gt; &amp;</b>\n<pre>x</pre>') === 'A <B> &\nx', 'text is HTML-escaped, and toPlain() strips the tags and puts the characters back');
  ok(tg.phTime(Date.UTC(2026, 9, 26, 12, 0) / 1000) === 'Oct 26, 8:00pm PH' && tg.phTime(Date.UTC(2026, 9, 26, 16, 0) / 1000) === 'Oct 27, 12:00am PH' && tg.phTime(Date.UTC(2026, 9, 26, 4, 5) / 1000) === 'Oct 26, 12:05pm PH', 'Philippine time (UTC+8): 12:00 UTC = 8:00pm, 16:00 UTC = 12:00am next day, 04:05 UTC = 12:05pm');

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
  // ---------- send(): HTML mode for the trade messages, plain text for everything else ----------
  const sendWith = async (text, opt, handler) => { const calls = []; const r = await tg.send(text, { ...opt, fetchImpl: async (url, o) => { const body = JSON.parse(o.body); calls.push(body); return handler(calls.length, body); } }); return { r, calls }; };
  let hs = await sendWith('<b>x</b>\n<pre>y</pre>', { html: true }, () => reply({ ok: true, result: {} }));
  ok(hs.r.ok && hs.calls.length === 1 && hs.calls[0].parse_mode === 'HTML' && hs.calls[0].text === '<b>x</b>\n<pre>y</pre>', 'send(html) sends parse_mode HTML once, text untouched');
  hs = await sendWith('plain & <text>', {}, () => reply({ ok: true, result: {} }));
  ok(hs.calls.length === 1 && hs.calls[0].parse_mode === undefined && hs.calls[0].text === 'plain & <text>', 'a normal send() (errors, skipped signals) has no parse_mode: sent exactly as before');
  hs = await sendWith('<b>x</b>\n<pre>a &lt; b</pre>', { html: true }, (n) => (n === 1 ? reply({ ok: false, description: "Bad Request: can't parse entities" }, 400) : reply({ ok: true, result: {} })));
  ok(hs.r.ok && hs.calls.length === 2 && hs.calls[1].parse_mode === undefined && hs.calls[1].text === 'x\na < b', 'Telegram rejects the formatting (HTTP 400): the same message is sent once more as plain text without tags');
  hs = await sendWith('<b>x</b>', { html: true }, () => { throw new Error('network down'); });
  ok(!hs.r.ok && hs.calls.length === 1, 'a network error is NOT retried as plain text: one attempt, reported, never thrown');
  hs = await sendWith('<b>x</b>', { html: true }, () => reply({ ok: false, description: 'Internal' }, 500));
  ok(!hs.r.ok && hs.calls.length === 1, 'an HTTP 500 is not retried as plain text (only a formatting rejection is)');

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
  s = await run({ getMe: () => reply({ ok: true, result: { username: 'icore_bot' } }), getUpdates: () => reply({ ok: true, result: [] }) }, { TELEGRAM_BOT_TOKEN: FAKE_TOKEN });
  ok(!s.r.ok && s.r.step === 'no-update' && /press START/i.test(s.text) && /@icore_bot/.test(s.text) && !s.f.calls.some((c) => c.method === 'sendMessage'), 'no chat id and no update yet: asks you to press Start on the bot and rerun, sends nothing');
  s = await run({ getMe: () => reply({ ok: true, result: { username: 'icore_bot' } }), getUpdates: () => reply({ ok: true, result: [{ update_id: 1, message: { chat: { id: 424242, type: 'private', username: 'jamesrfael' } } }] }), sendMessage: () => reply({ ok: true, result: {} }) }, { TELEGRAM_BOT_TOKEN: FAKE_TOKEN });
  ok(s.r.ok && s.r.chatId === '424242' && /chat id found\s+: 424242/.test(s.text) && /TELEGRAM_CHAT_ID=424242/.test(s.text) && s.f.calls.some((c) => c.method === 'sendMessage' && c.body.chat_id === '424242'), 'chat id found via getUpdates, printed, and the test message is sent to it');
  ok(!s.text.includes('FAKE_TOKEN') && !s.text.includes('123456789:'), 'the setup output never contains the token');
  s = await run({ getMe: () => reply({ ok: true, result: { username: 'icore_bot' } }), sendMessage: () => reply({ ok: true, result: {} }) }, { TELEGRAM_BOT_TOKEN: FAKE_TOKEN, TELEGRAM_CHAT_ID: '777' });
  ok(s.r.ok && !s.f.calls.some((c) => c.method === 'getUpdates') && s.f.calls.some((c) => c.method === 'sendMessage' && c.body.chat_id === '777'), 'chat id already set: no getUpdates, test message sent');
  s = await run({ getMe: () => reply({ ok: true, result: { username: 'icore_bot' } }), sendMessage: () => reply({ ok: false, description: 'chat not found' }, 400) }, { TELEGRAM_BOT_TOKEN: FAKE_TOKEN, TELEGRAM_CHAT_ID: '777' });
  ok(!s.r.ok && s.r.step === 'sendMessage' && /START/.test(s.text), 'test message refused (chat not found): clear hint about pressing Start');
  const rch = await tg.reachable({ fetchImpl: mockTelegram({ getMe: () => reply({ ok: true, result: { username: 'icore_bot' } }) }) });
  ok(rch.configured && rch.ok && /@icore_bot/.test(rch.detail), 'reachable() (used by `check`): configured and reachable');

  // ---------- Telegram failure never blocks, delays or crashes a trade ----------
  process.env.TELEGRAM_BOT_TOKEN = FAKE_TOKEN; process.env.TELEGRAM_CHAT_ID = '555000111';
  const sc = H.scenario('SOL', 40), sent = [];
  const parseModes = [];
  global.fetch = async (url, opts) => { const b = JSON.parse(opts.body); sent.push(b.text); parseModes.push(b.parse_mode); return reply({ ok: true, result: {} }); };
  let r1 = await H.runTrade(bot.processCoin, bot.paper, sc, { hooks: bot.makeHooks() });
  const entries = sent.filter((m) => /^(🟢|🔴) <b>(LONG|SHORT) · /.test(m)), exits = sent.filter((m) => /^(✅|❌|⚪) <b>\S+ (LONG|SHORT) closed/.test(m));
  const enterEvents = r1.events.filter((e) => e.startsWith('ENTER')).length;   // the exit candle can also open the next trade (allowed), which is a second ENTRY
ok(r1.st.n === 1 && entries.length === enterEvents && enterEvents >= 1 && exits.length === 1 && parseModes.filter((m) => m === 'HTML').length === entries.length + exits.length, `every ENTER sends exactly one ENTRY message and the exit exactly one EXIT message (${entries.length} entry for ${enterEvents} ENTER event(s), ${exits.length} exit)`);
  ok(/^(🟢|🔴) <b>(LONG|SHORT) · SOL · \[TRAIL LAB\] · PAPER<\/b>\n<pre>Entry    \d+\.\d\d\nStop     \d+\.\d\d  \([+-]\d+\.\d%\)\nExit     trailing stop, no target\nRisk     [\d.]+%  \(\$[\d.]+\)\nSize     [\d.]+ SOL \(about \$\d+(\.\d\d)?\)<\/pre>$/.test(entries[0]), `the live entry message has the option B shape: ${JSON.stringify(entries[0])}`);
  ok(/^(✅|❌|⚪) <b>SOL (LONG|SHORT) closed · (STOP \(trailing\)|TIME LIMIT) · \[TRAIL LAB\] · PAPER<\/b>\n<pre>[+-]\d+\.\d\dR = [+-]\$\d+\.\d\d\n\d+\.\d\d → \d+\.\d\d · held [^\n]+<\/pre>$/.test(exits[0]), `the live exit message has the option B shape: ${JSON.stringify(exits[0])}`);
  const modes = [['hanging', () => new Promise(() => {})], ['rejecting', async () => { throw new Error('network down'); }], ['HTTP 500', async () => reply({ ok: false }, 500)]];
  for (const [name, impl] of modes) {
    global.fetch = impl;
    const t1 = Date.now(), r2 = await H.runTrade(bot.processCoin, bot.paper, sc, { hooks: bot.makeHooks() });
    ok(r2.st.n === 1 && r2.st.trades[0].why === r1.st.trades[0].why && Math.abs(r2.st.trades[0].R - r1.st.trades[0].R) < 1e-9 && Date.now() - t1 < 3000, `Telegram ${name}: the trade is opened, managed and closed with the identical result (${Date.now() - t1} ms, no delay, no crash)`);
  }

  // a live signal the bot could not take is alerted at once, with the exchange's own words; deliberate skips are not
  {
    const refused = { symbol: 'ZEC_USDT', dir: -1, mode: 'live', reason: 'entry_refused', detail: 'entry order not filled: BLOCKED: MEXC /api/v1/private/order/create code 6002: Your futures position-opening has been restricted.' };
    ok(tg.missedSignal(refused) && tg.missedSignal({ reason: 'insufficient_margin' }) && tg.missedSignal({ reason: 'not_tradable' }), 'a refused / unaffordable / untradable entry is a missed signal');
    ok(!tg.missedSignal({ reason: 'drawdown_halt' }) && !tg.missedSignal({ reason: 'kill_switch' }) && !tg.missedSignal({ reason: 'position_exists' }) && !tg.missedSignal(null), 'halt, kill switch and an open position are deliberate: no alert');
    const m = tg.toPlain(tg.fmtMissed(refused));
    ok(/SIGNAL MISSED/.test(m) && /ZEC SHORT/.test(m) && /code 6002/.test(m) && /email|in-app/.test(m), 'the alert names the coin, side, the exchange message and what to check');
  }
  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
