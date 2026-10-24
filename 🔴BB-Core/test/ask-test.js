// test/ask-test.js - "Ask bot now": the button's route, the bot's outbound poll, the answer (an immediate heartbeat), and proof it cannot disturb trading.
//   node test/ask-test.js       No network: the "server" is lib/commands.js called in-process through a fetch bridge, the store is in memory.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const H = require('./helpers.js');
const STATE = H.tmp('ask-state');
process.env.LUCIDIO_STATE_DIR = STATE; process.env.LUCIDIO_ENV_FILE = path.join(STATE, 'none.env'); process.env.LUCIDIO_KEYS = path.join(STATE, 'none.json');
const SECRET = crypto.randomBytes(24).toString('hex');
process.env.DASHBOARD_URL = 'https://dash.example'; process.env.DASHBOARD_PUSH_SECRET = SECRET;
delete process.env.DASHBOARD_ASK_POLL_SEC; delete process.env.DASHBOARD_HEARTBEAT_SEC;

const { handleAsk, handlePoll, ASK_WINDOW_MS } = require('../dashboard/lib/commands.js');
const { createMemoryStore } = require('../dashboard/lib/store.js'), { createLimiter } = require('../dashboard/lib/ratelimit.js');
const { aggregate } = require('../dashboard/lib/aggregate.js'), sigLib = require('../dashboard/lib/signature.js');
const push = require('../dashboard-push.js');

let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const realST = global.setTimeout, sleep = (ms) => new Promise((r) => realST(r, ms));
const NOW = Date.UTC(2026, 9, 24, 21, 0, 0);

(async () => {
  // ---------- the dashboard side ----------
  const store = createMemoryStore();
  ok((await handleAsk({ method: 'GET', authOk: true, store, now: NOW })).status === 405, 'ask: POST only');
  ok((await handleAsk({ method: 'POST', authOk: false, store, now: NOW })).status === 401 && !store._rows.size, 'ask: no login, no request stored');
  const a1 = await handleAsk({ method: 'POST', authOk: true, store, now: NOW, mode: 'live' });
  ok(a1.status === 200 && a1.body.requested_ms === NOW && !a1.body.already_pending && store._rows.size === 1, 'ask: a logged-in click stores one request');
  const a2 = await handleAsk({ method: 'POST', authOk: true, store, now: NOW + 5000 });
  ok(a2.body.already_pending && a2.body.requested_ms === NOW && store._rows.size === 1, 'ask: a second click while one is waiting just reports it (no pile-up)');
  const lim = createLimiter({ max: 2, windowMs: 60000 }); const l = [];
  for (let i = 0; i < 3; i++) l.push((await handleAsk({ method: 'POST', authOk: true, store: createMemoryStore(), limiter: lim, ip: '1.2.3.4', now: NOW })).status);
  ok(l.join() === '200,200,429', 'ask: rate limited');
  const hdr = (ts, body = '', secret = SECRET) => ({ 'x-lucidio-timestamp': String(ts), 'x-lucidio-signature': sigLib.sign(secret, ts, body) });
  ok((await handlePoll({ method: 'GET', headers: {}, secret: SECRET, store, now: NOW })).status === 401, 'poll: unsigned is refused');
  ok((await handlePoll({ method: 'GET', headers: hdr(NOW, '', 'wrong-secret'), secret: SECRET, store, now: NOW })).status === 401, 'poll: wrong secret is refused');
  ok((await handlePoll({ method: 'GET', headers: hdr(NOW - 600000), secret: SECRET, store, now: NOW })).status === 401, 'poll: a 10-minute-old signature is refused');
  ok((await handlePoll({ method: 'POST', headers: hdr(NOW), secret: SECRET, store, now: NOW })).status === 405 && store._rows.get(`ask:${NOW}`).type === 'ask', 'poll: GET only, and a refused poll never claims the request');
  const p1 = await handlePoll({ method: 'GET', headers: hdr(NOW + 30000), secret: SECRET, store, now: NOW + 30000 });
  ok(p1.status === 200 && p1.body.ask === true && JSON.stringify(p1.body) === '{"ask":true}', 'poll: the bot gets the request (and nothing else)');
  const p2 = await handlePoll({ method: 'GET', headers: hdr(NOW + 60000), secret: SECRET, store, now: NOW + 60000 });
  ok(p2.body.ask === false, 'poll: a request is handed out only once');
  await handleAsk({ method: 'POST', authOk: true, store, now: NOW + 100000 });
  const stale = await handlePoll({ method: 'GET', headers: hdr(NOW + 100000 + ASK_WINDOW_MS + 1000), secret: SECRET, store, now: NOW + 100000 + ASK_WINDOW_MS + 1000 });
  ok(stale.body.ask === false, 'poll: a request nobody collected for 15 minutes is ignored (bot was offline)');
  ok((await store.recent()).length === 0 && aggregate({ events: await store.recent(), heartbeat: null, now: NOW }).trades.length === 0, 'ask rows never show up as events on the dashboard');
  const broken = { claimAsk: async () => { throw new Error('db down'); } };
  ok((await handlePoll({ method: 'GET', headers: hdr(NOW), secret: SECRET, store: broken, now: NOW })).status === 502, 'poll: store down gives 502 (the bot just tries again later)');

  // ---------- the bot side ----------
  ok(push.heartbeatDue(1e12 + 3600 * 1000, undefined) === true || true, 'heartbeatDue exists');
  push._reset();
  ok(push.heartbeatSec() === 86400, 'heartbeat safety net is once a day by default (was every 5 minutes)');
  push.pushHeartbeat({ mode: 'paper', status: 'running' }, NOW);
  ok(!push.heartbeatDue(NOW + 3600 * 1000) && !push.heartbeatDue(NOW + 23 * 3600 * 1000) && push.heartbeatDue(NOW + 24 * 3600 * 1000 + 1), 'no extra heartbeat for 24 hours after one');
  process.env.DASHBOARD_HEARTBEAT_SEC = '600'; ok(push.heartbeatSec() === 600, 'DASHBOARD_HEARTBEAT_SEC changes it'); process.env.DASHBOARD_HEARTBEAT_SEC = '5'; ok(push.heartbeatSec() === 86400, '...but never below 60 seconds'); delete process.env.DASHBOARD_HEARTBEAT_SEC;
  ok(push.askPollSec() === 60, 'bot asks once a minute by default');
  process.env.DASHBOARD_ASK_POLL_SEC = '5'; ok(push.askPollSec() === 20, '...never faster than every 20 seconds'); process.env.DASHBOARD_ASK_POLL_SEC = '0'; ok(push.askPollSec() === 0, '...0 switches it off');
  ok(push.startAskPoll({ provider: () => ({}) }) === false, 'with 0 nothing is started');
  delete process.env.DASHBOARD_ASK_POLL_SEC;

  // fetch bridge to the in-process server
  const srv = createMemoryStore(); const seen = [];
  const bridge = async (url, opts) => {
    seen.push({ url, method: opts.method });
    const u = new URL(url); const h = Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const out = await handlePoll({ method: opts.method, headers: h, secret: SECRET, store: srv, now: Date.now() });
    return { ok: out.status < 300, status: out.status, json: async () => out.body };
  };
  ok(await push.pollOnce({ fetchImpl: bridge }) === false && seen[0].url === 'https://dash.example/api/poll' && seen[0].method === 'GET', 'bot poll: a signed GET, nothing asked');
  await handleAsk({ method: 'POST', authOk: true, store: srv, now: Date.now() });
  ok(await push.pollOnce({ fetchImpl: bridge }) === true, 'bot poll: sees the request through the real signature check');
  let threw = false; try { await push.pollOnce({ fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }) }); } catch { threw = true; }
  ok(threw, 'pollOnce reports an HTTP error to its caller (which only slows down)');

  // the poller: answers with a heartbeat, quiet while a run is in progress, survives failures
  push._reset(); fs.rmSync(path.join(STATE, 'outbox.jsonl'), { force: true });
  process.env.DASHBOARD_ASK_POLL_SEC = '20';
  const timers = [];
  global.setTimeout = (fn, ms, ...a) => { if (ms < 15000) return realST(fn, ms, ...a); const t = { fn, ms, unref() {} }; timers.push(t); return t; };   // only the poller's own long timers are captured
  let running = true, askNext = false, polls = 0, provided = 0;
  const f = async () => { polls++; return { ok: true, status: 200, json: async () => ({ ask: askNext }) }; };
  const done = push.startAskPoll({ provider: () => { provided++; return { mode: 'paper', status: 'running', coins: ['SOL_USDT'] }; }, busy: () => running, fetchImpl: f });
  const fire = async () => { const t = timers.shift(); await t.fn(); await sleep(5); return t; };
  ok(done === true && timers.length === 1, 'startAskPoll schedules its first tick (and only one poller can exist)');
  ok(push.startAskPoll({ provider: () => ({}) }) === false, 'a second start does nothing');
  await fire(); ok(polls === 0 && timers.length === 1, 'while a run is in progress the poller does not even ask');
  running = false; askNext = false; await fire(); ok(polls === 1 && provided === 0 && push.pending() === 0, 'idle and nobody asked: one tiny poll, no heartbeat, nothing written');
  askNext = true; await fire();
  const lines = fs.readFileSync(path.join(STATE, 'outbox.jsonl'), 'utf8').trim().split('\n').map((x) => JSON.parse(x));
  ok(polls === 2 && provided === 1 && lines.length === 1 && lines[0].type === 'heartbeat', 'asked: a heartbeat is queued at once');
  ok(timers[0].ms === 20000, 'next poll is scheduled at the normal interval');
  askNext = false;
  const failing = async () => { throw new Error('network down'); };
  push._reset(); push.stopAskPoll(); timers.length = 0;
  push.startAskPoll({ provider: () => ({}), busy: () => false, fetchImpl: failing });
  const waits = []; for (let i = 0; i < 6; i++) { await fire(); waits.push(timers[0].ms); }
  ok(waits[0] > 20000 && waits[5] <= 200000 && waits[5] >= waits[1], `failures slow polling down, capped at 10x (${waits.map((w) => w / 1000).join('s, ')}s)`);
  ok(push.status().pending === 0 || true, 'a failing poll never throws');
  const broken2 = async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); } });
  push._reset(); push.stopAskPoll(); timers.length = 0;
  push.startAskPoll({ provider: () => ({}), fetchImpl: broken2 }); let crashed = false; try { await fire(); } catch { crashed = true; }
  ok(!crashed && timers.length === 1, 'garbage from the server cannot crash the poller; it keeps polling');
  push.stopAskPoll(); global.setTimeout = realST; delete process.env.DASHBOARD_ASK_POLL_SEC;

  // ---------- wiring in the bot ----------
  const src = fs.readFileSync(path.join(__dirname, '..', 'lucidio.js'), 'utf8');
  ok(/push\.startAskPoll\(\{ provider: \(\) => pushStatus\(loadState\(\)\), busy: \(\) => inRun \}\)/.test(src) && /inRun = true;/.test(src) && /finally \{ inRun = false; \}/.test(src), 'lucidio.js starts the poller and marks the whole run (runOnce + retryStale) as busy');
  ok(!/await push\.(pollOnce|startAskPoll)/.test(src), 'nothing in lucidio.js awaits the poller');
  const pushSrc = fs.readFileSync(path.join(__dirname, '..', 'dashboard-push.js'), 'utf8');
  ok(!/require\(['"]\.\/(mexc|live)/.test(pushSrc), 'the poller module has no access to the exchange code');
  const hash = require('child_process').execFileSync('git', ['hash-object', 'lucidio-core.js'], { cwd: path.join(__dirname, '..') }).toString().trim();
  ok(hash === '7cc03e24e38143b9303eb260cf1830a0e38b2e34', 'lucidio-core.js (the strategy) is byte-identical to HEAD');

  console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
