// test/ops-test.js - deployment safeguards: live gate, 1% risk cap, skipped-signal alerts, heartbeat after every run, "no run in 4h20m" watchdog.
//   node test/ops-test.js
// No network and no money: MEXC calls are replaced by mocks, fetch() is a recorder, and the bot runs in a throw-away COPY of its own files
// (fake Telegram token, fake heartbeat URL), so your real bot-config.json / mexc-keys.json / state/ are never read or written.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FAKE_TOKEN = '123456789' + ':' + 'FAKE_TOKEN_' + 'FOR_TEST_ONLY_0123456789';   // built in pieces so deploy/package.sh's secret scan has nothing to match
const BOX = fs.mkdtempSync(path.join(os.tmpdir(), 'lucidio-ops-')), STATE = path.join(BOX, 'state');
for (const f of ['lucidio.js', 'lucidio-core.js', 'live.js', 'mexc.js', 'config.js', 'ledger-sync.js', 'telegram.js', 'journal.js', 'dashboard-push.js', 'envfile.js']) fs.copyFileSync(path.join(ROOT, f), path.join(BOX, f));
fs.mkdirSync(path.join(BOX, 'deploy'));
fs.copyFileSync(path.join(ROOT, 'deploy', 'watchdog.js'), path.join(BOX, 'deploy', 'watchdog.js'));
fs.writeFileSync(path.join(BOX, 'mexc-keys.json'), JSON.stringify({ telegramToken: FAKE_TOKEN, telegramChatId: '42' }));
const writeCfg = (o) => fs.writeFileSync(path.join(BOX, 'bot-config.json'), JSON.stringify({ mode: 'paper', coins: ['SOL', 'ZEC'], riskPct: 0.01, heartbeatUrl: 'https://hc.example/abc-123', ...o }));
writeCfg({});
process.env.LUCIDIO_STATE_DIR = STATE; process.env.LUCIDIO_KEYS = path.join(BOX, 'mexc-keys.json');
delete process.env.LUCIDIO_ALLOW_LIVE; delete process.env.LUCIDIO_NO_NOTIFY;
for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET']) delete process.env[k];   // a real env file must never leak into a test

const calls = [];                                                    // every fetch() the bot or watchdog makes
global.fetch = async (url, opts) => { calls.push({ url: String(url), body: opts && opts.body ? String(opts.body) : '' }); return { ok: true, status: 200, text: async () => '{}' }; };
const mexc = require(path.join(BOX, 'mexc.js')), bot = require(path.join(BOX, 'lucidio.js')), config = require(path.join(BOX, 'config.js'));
const wd = require(path.join(BOX, 'deploy', 'watchdog.js'));
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const hb = () => calls.filter((c) => c.url.startsWith('https://hc.example/')).map((c) => c.url);
const tg = () => calls.filter((c) => c.url.includes('api.telegram.org')).map((c) => JSON.parse(c.body).text);
const reset = () => { calls.length = 0; fs.rmSync(STATE, { recursive: true, force: true }); };
const events = () => { try { return fs.readFileSync(path.join(STATE, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)); } catch { return []; } };

const IV = 14400, raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'SOL.json'), 'utf8')).slice(-500);
const B = raw.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })), last = B[B.length - 1];
const forming = { time: last.time + IV, open: last.close, high: last.close, low: last.close, close: last.close };
let timeCalls = 0, clock = last.time + IV + 2;
mexc.client.now = () => clock * 1000;
mexc.serverTime = async () => { timeCalls++; return { data: Date.now(), ms: 10 }; };

(async () => {
  // ---------- 1. risk cap ----------
  ok(config.MAX_RISK_PCT === 0.01 && config.FIELDS.riskPct.max === 0.01, 'riskPct cap is 1% in config.js (MAX_RISK_PCT and the Settings field limit)');
  const v = config.validate({ riskPct: 0.02 }); ok(!v.ok && v.errors.riskPct, `dashboard/settings write of riskPct 2% is refused (${v.errors.riskPct})`);
  ok(config.validate({ riskPct: 0.01 }).ok && config.validate({ riskPct: 0.005 }).ok, 'riskPct 1% and 0.5% are accepted');
  writeCfg({ riskPct: 0.05 });
  const c5 = config.load(); ok(c5.riskPct === 0.01 && c5.riskPctClamped === 0.05, 'a hand-edited riskPct of 5% is clamped to 1% on load (and remembered for the warning)');

  // ---------- 2. live gate ----------
  ok(bot.liveAllowed() === false, 'live is NOT allowed by default (no --allow-live, no LUCIDIO_ALLOW_LIVE)');
  process.env.LUCIDIO_ALLOW_LIVE = '1'; ok(bot.liveAllowed() === true, 'LUCIDIO_ALLOW_LIVE=1 opens the gate'); delete process.env.LUCIDIO_ALLOW_LIVE;
  reset(); timeCalls = 0; writeCfg({ mode: 'live' });
  await bot.runOnce();
  const st1 = JSON.parse(fs.readFileSync(path.join(STATE, 'state.json'), 'utf8'));
  ok(st1.lastRun.errors === 1 && events().some((e) => e.type === 'error' && /live trading is not enabled on this machine/.test(e.msg)), 'mode "live" in bot-config.json WITHOUT the flag: the run is refused with an error');
  ok(timeCalls === 0 && !calls.some((c) => c.url.includes('mexc.com')), 'refused before any MEXC call (not even the clock check) and no order path was reached');
  ok(hb().length === 1 && hb()[0].endsWith('/fail') && tg().some((t) => /not enabled on this machine/.test(t)), 'the refusal pings the heartbeat /fail and alerts Telegram');

  // ---------- 3. heartbeat after every successful run; /fail otherwise ----------
  writeCfg({}); reset(); timeCalls = 0;
  mexc.klines = async () => ({ data: B.concat([forming]), ms: 5 });
  await bot.runOnce();
  ok(hb().length === 1 && hb()[0] === 'https://hc.example/abc-123', `a successful paper run pings the heartbeat once, plain URL (${hb().join(', ')})`);
  ok(timeCalls === 1, 'paper run uses only the mocked MEXC (clock check mocked)');
  reset(); let polls = 0;
  mexc.klines = async () => { polls++; clock += 30; return { data: B, ms: 5 }; };           // the new candle never appears
  clock = last.time + IV + 2;
  await bot.runOnce({ fetch: { pollMs: 1 } });
  ok(hb().length === 1 && hb()[0] === 'https://hc.example/abc-123/fail', `a run whose 4h candle never appeared pings /fail (${hb().join(', ')}) after ${polls} polls`);
  clock = last.time + IV + 2; reset();
  bot.CFG.heartbeatUrl = 'https://hc.example/x/'; bot.heartbeat(true); bot.heartbeat(false);
  ok(hb().join(' ') === 'https://hc.example/x https://hc.example/x/fail', 'heartbeat strips a trailing slash: ok -> URL, failure -> URL/fail');
  bot.CFG.heartbeatUrl = ''; calls.length = 0; bot.heartbeat(true); ok(calls.length === 0, 'no heartbeatUrl -> no request');

  // ---------- 4. alerts: skipped signals ----------
  reset(); writeCfg({}); bot.reloadConfig();
  bot.event('skip', 'SOL', 'SIGNAL SOL LONG on candle 2026-10-23 08:00Z SKIPPED: next candle opened 35 min ago (too late to enter at its open)');
  bot.event('skip', 'ZEC', 'SIGNAL ZEC SHORT on candle 2026-10-23 12:00Z skipped: HALTED (account 40.0R below its best point, limit 39R)');
  bot.event('warn', 'SOL', 'WARNING SOL: signal on candle 2026-10-23 08:00Z SKIPPED: gap in the last 200 candles (MEXC history has a hole, indicators unreliable)');
  ok(tg().length === 3 && /too late/.test(tg()[0]) && /HALTED/.test(tg()[1]) && /gap/.test(tg()[2]), `skipped signals (late / halted / gap) each send a Telegram message (${tg().length} sent)`);
  calls.length = 0; bot.event('info', 'BOT', 'settings reloaded: riskPct'); bot.event('warn', 'SOL', 'WARNING SOL: 1 gap(s) in MEXC 4h candles');
  ok(tg().length === 0, 'routine info/warn events do not spam Telegram');
  ok(tg().length === 0 && (bot.event('error', 'SOL', 'ERROR SOL: boom'), tg().length === 1), 'errors still alert');

  // ---------- 5. watchdog: no run in 4h20m ----------
  const T0 = Date.UTC(2026, 9, 24, 12, 0, 0), min = 60000;
  const setLast = (ms) => { fs.mkdirSync(STATE, { recursive: true }); fs.writeFileSync(path.join(STATE, 'state.json'), JSON.stringify({ lastRun: { ts: new Date(ms).toISOString() } })); };
  reset(); setLast(T0);
  let r = await wd.check({ now: T0 + (4 * 60 + 19) * min });
  ok(!r.silent && tg().length === 0, `4h19m since the last run: quiet (${r.age})`);
  r = await wd.check({ now: T0 + (4 * 60 + 21) * min });
  ok(r.silent && tg().length === 1 && /no bot run recorded for 4h21m/.test(tg()[0]), `4h21m: ALERT sent -> "${tg()[0]}"`);
  r = await wd.check({ now: T0 + (4 * 60 + 40) * min }); ok(tg().length === 1, 'still silent 19 min later: no repeat yet (once per hour)');
  r = await wd.check({ now: T0 + (5 * 60 + 25) * min }); ok(tg().length === 2, 'still silent after 1h: alert repeated');
  setLast(T0 + 6 * 3600000); r = await wd.check({ now: T0 + 6 * 3600000 + 10 * min });
  ok(!r.silent && tg().length === 3 && /running again/.test(tg()[2]), 'bot back: one "running again" message');
  r = await wd.check({ now: T0 + 6 * 3600000 + 20 * min }); ok(tg().length === 3, 'and nothing more afterwards');
  ok(wd.MAX_SILENCE_MS === 260 * min, 'threshold is exactly 4h20m');
  // no state at all, and no Telegram configured: loud on stderr, exit code 2, no crash, token never printed
  reset(); fs.writeFileSync(process.env.LUCIDIO_KEYS, '{}');
  const errs = []; const oe = console.error; console.error = (...a) => errs.push(a.join(' '));
  r = await wd.check({ now: T0 }); console.error = oe;
  ok(r.silent && r.lastRun === null && process.exitCode === 2 && errs.some((e) => /no Telegram configured/.test(e)), 'no state + no Telegram: silent=true, ALERT on stderr, exit code 2');
  process.exitCode = 0;
  fs.writeFileSync(process.env.LUCIDIO_KEYS, JSON.stringify({ telegramToken: FAKE_TOKEN, telegramChatId: '42' }));
  reset(); setLast(T0); const errs2 = []; console.error = (...a) => errs2.push(a.join(' '));
  await wd.check({ now: T0 + 5 * 3600000, fetchImpl: async (u) => { throw new Error('connect failed ' + u); } }); console.error = oe; process.exitCode = 0;
  ok(errs2.length > 0 && !errs2.join(' ').includes('FAKE_TOKEN'), 'a failing Telegram request is reported without printing the token or URL');

  console.log(`\n${pass} passed, ${failN} failed`);
  fs.rmSync(BOX, { recursive: true, force: true });
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
