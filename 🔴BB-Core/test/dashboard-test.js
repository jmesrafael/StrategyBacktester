// test/dashboard-test.js - the hosted dashboard, both ends: the signed ingest route (signature, stale timestamp, replay, schema, limits), the bot's
// outbox (catch-up after an outage, no duplicates, push failure never blocks a trade), privacy (no secret in any payload), aggregation and the login gate.
//   node test/dashboard-test.js      No network: the "server" is lib/ingest.js called in-process through a fetch bridge, the store is in memory.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const H = require('./helpers.js');
const STATE = H.tmp('dashboard-state');
process.env.LUCIDIO_STATE_DIR = STATE; process.env.LUCIDIO_JOURNAL_DIR = path.join(STATE, 'journal'); process.env.LUCIDIO_ENV_FILE = path.join(STATE, 'none.env');
const KEYS = path.join(STATE, 'keys.json'); process.env.LUCIDIO_KEYS = KEYS;
const FAKE = { tgToken: '123456789' + ':' + 'FAKE_TOKEN_' + 'FOR_TEST_ONLY_0123456789', chat: '987654321', apiKey: 'mx0vglFAKEAPIKEY0001', apiSecret: 'f00dfeed'.repeat(4), secret: crypto.randomBytes(24).toString('hex') };
fs.writeFileSync(KEYS, JSON.stringify({ apiKey: FAKE.apiKey, apiSecret: FAKE.apiSecret, telegramToken: FAKE.tgToken, telegramChatId: FAKE.chat }));
process.env.DASHBOARD_URL = 'https://dash.example'; process.env.DASHBOARD_PUSH_SECRET = FAKE.secret;
process.env.TELEGRAM_BOT_TOKEN = FAKE.tgToken; process.env.TELEGRAM_CHAT_ID = FAKE.chat; process.env.LUCIDIO_NO_NOTIFY = '1';
delete process.env.DASHBOARD_SHARE_LIVE_EQUITY;

const sig = require('../dashboard/lib/signature.js'), schema = require('../dashboard/lib/schema.js'), { handleIngest } = require('../dashboard/lib/ingest.js');
const { createMemoryStore } = require('../dashboard/lib/store.js'), { createLimiter } = require('../dashboard/lib/ratelimit.js'), { makeAuth } = require('../dashboard/lib/auth.js');
const { aggregate } = require('../dashboard/lib/aggregate.js');
const push = require('../dashboard-push.js'), journal = require('../journal.js'), bot = require('../lucidio.js');

let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const SECRET = FAKE.secret, now0 = Date.now();
const ev = (id, over = {}) => ({ event_id: id, type: 'signal', ts_ms: now0, mode: 'paper', symbol: 'SOL_USDT', side: 'LONG', data: { decision: 'skipped', reason: 'late_entry', signal_candle_open_ms: now0 - 1000 }, ...over });
const req = (events, { secret = SECRET, ts = now0, body, headers } = {}) => { const raw = body ?? JSON.stringify({ events }); return { method: 'POST', rawBody: raw, headers: { 'x-lucidio-timestamp': String(ts), 'x-lucidio-signature': sig.sign(secret, ts, raw), ...(headers || {}) }, now: now0, secret: SECRET }; };
const post = (store, r) => handleIngest({ store, ...r });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => { for (let i = 0; i < 100 && push.status().inflight !== false && push.pending() > 0; i++) await sleep(20); await sleep(30); };

// the "Vercel" side, reachable through fetch: verifies the signature exactly as api/ingest.js does
function bridge(store, state = {}) {
  const f = async (url, opts) => {
    f.calls.push(url);
    if (state.down) throw new Error('ECONNREFUSED');
    if (state.hang) return new Promise(() => {});
    if (/\/api\/health$/.test(url)) return { ok: true, status: 200, json: async () => ({ ok: true }) };
    const out = await handleIngest({ method: opts.method, headers: { 'x-lucidio-timestamp': opts.headers['X-Lucidio-Timestamp'], 'x-lucidio-signature': opts.headers['X-Lucidio-Signature'] }, rawBody: opts.body, secret: state.secret || SECRET, store, now: Date.now() });
    return { ok: out.status < 300, status: out.status, json: async () => out.body };
  };
  f.calls = []; return f;
}
const reset = () => { push._reset(); fs.rmSync(path.join(STATE, 'outbox.jsonl'), { force: true }); fs.rmSync(path.join(STATE, 'outbox.cursor.json'), { force: true }); fs.rmSync(path.join(STATE, 'outbox.rejected.jsonl'), { force: true }); };

(async () => {
  // ================= server: signature, timestamp, replay =================
  let store = createMemoryStore(), r = await post(store, req([ev('evt-valid-0001')]));
  ok(r.status === 200 && r.body.accepted === 1 && store._rows.size === 1, 'valid signature: 200, event stored');
  r = await post(store, req([ev('evt-bad-sig-001')], { secret: 'not-the-secret-not-the-secret-123456' }));
  ok(r.status === 401 && /bad signature/.test(r.body.error) && store._rows.size === 1, 'bad signature: 401, nothing stored');
  const good = req([ev('evt-tamper-0001')]); r = await post(store, { ...good, rawBody: good.rawBody.replace('late_entry', 'tampered!!') });
  ok(r.status === 401 && store._rows.size === 1, 'body changed after signing: 401');
  r = await post(store, req([ev('evt-stale-0001')], { ts: now0 - 6 * 60000 }));
  ok(r.status === 401 && /stale timestamp/.test(r.body.error), 'timestamp 6 minutes old (signature otherwise valid): 401 stale');
  r = await post(store, req([ev('evt-future-001')], { ts: now0 + 6 * 60000 }));
  ok(r.status === 401 && /stale timestamp/.test(r.body.error), 'timestamp 6 minutes in the future: 401');
  r = await post(store, req([ev('evt-edge-00001')], { ts: now0 - 4 * 60000 }));
  ok(r.status === 200, 'timestamp 4 minutes old: still accepted (window is 5 minutes)');
  const orig = req([ev('evt-replay-0001')]); const a1 = await post(store, orig), a2 = await post(store, orig);
  ok(a1.status === 200 && a1.body.accepted === 1 && a2.status === 200 && a2.body.accepted === 0 && a2.body.duplicates === 1 && [...store._rows.keys()].filter((k) => k === 'evt-replay-0001').length === 1, 'the exact same request replayed: 200 but accepted 0, duplicates 1 (event_id deduped, stored once)');
  const a3 = await post(store, req([ev('evt-replay-0001')], { ts: now0 + 1000 }));
  ok(a3.body.accepted === 0 && a3.body.duplicates === 1, 'a re-signed event with a repeated event_id is also ignored');
  r = await post(store, { ...orig, headers: {} }); ok(r.status === 401, 'missing signature headers: 401');
  r = await post(store, { ...orig, secret: '' }); ok(r.status === 503, 'server without a secret configured: 503, never open');
  r = await post(store, { ...orig, method: 'GET' }); ok(r.status === 405, 'GET: 405');
  r = await post(store, req([ev('evt-bad-json-01')], { body: '{not json' })); ok(r.status === 400 && /invalid JSON/.test(r.body.error), 'signed but invalid JSON: 400');
  r = await post(store, req(null, { body: ' '.repeat(70000) })); ok(r.status === 413, 'body over 64 KB: 413');
  const lim = createLimiter({ max: 3, windowMs: 60000 }); const codes = []; for (let i = 0; i < 5; i++) codes.push((await post(store, { ...req([ev(`evt-rate-000${i}`)]), limiter: lim, ip: '1.2.3.4' })).status);
  ok(codes.join() === '200,200,200,429,429', `rate limit per IP: ${codes.join(',')}`);

  // ================= server: schema =================
  r = await post(store, req([ev('evt-btc-000001', { symbol: 'BTC_USDT' })]));
  ok(r.status === 400 && /not allowed/.test(JSON.stringify(r.body.details)) && ![...store._rows.values()].some((x) => x.symbol === 'BTC_USDT'), 'a signed event for BTC_USDT is rejected (400) and not stored');
  for (const [name, bad] of [['unknown envelope field', { extra: 1 }], ['bad mode', { mode: 'demo' }], ['bad type', { type: 'withdraw' }], ['bad side', { side: 'UP' }], ['bad id', { event_id: 'x' }], ['bad ts', { ts_ms: 5 }], ['entry without symbol', { type: 'entry', symbol: undefined, data: { entry: 1 } }], ['data wrong type', { data: { decision: 'skipped', reason: 12345 } }]]) {
    const rr = await post(store, req([ev('evt-schema-0001', bad)])); if (rr.status !== 400) ok(false, `schema must reject: ${name} (got ${rr.status})`);
  }
  ok(true, 'schema rejects: unknown field, bad mode, bad type, bad side, bad event_id, bad timestamp, entry without symbol, wrongly typed data');
  r = await post(store, req([ev('evt-extra-data-1', { data: { decision: 'skipped', reason: 'x', apiSecret: 'leak', note: 'also dropped' } })]));
  ok(r.status === 200 && !('apiSecret' in store._rows.get('evt-extra-data-1').data) && !('note' in store._rows.get('evt-extra-data-1').data), 'unknown data keys are dropped, never stored');
  const sz = schema.validateBody({ events: Array.from({ length: 51 }, (_, i) => ev(`evt-many-${String(i).padStart(4, '0')}`)) }); ok(!sz.ok, 'more than 50 events per request: rejected');

  // ================= login gate =================
  const auth = makeAuth({ password: 'correct horse battery', sessionSecret: crypto.randomBytes(16).toString('hex') });
  const tok = auth.issue(now0);
  ok(auth.configured() && auth.checkPassword('correct horse battery') && !auth.checkPassword('wrong') && !auth.checkPassword(''), 'password check: right accepted, wrong and empty refused');
  ok(auth.verifyToken(tok, now0 + 1000) && !auth.verifyToken(tok, now0 + 13 * 3600 * 1000) && !auth.verifyToken(tok.slice(0, -2) + '00', now0) && !auth.verifyToken('', now0) && !auth.verifyToken('v1.9999999999999.' + '0'.repeat(64), now0), 'session cookie: valid until it expires; tampered, empty and forged tokens refused');
  ok(auth.fromCookie(`a=1; lucidio_session=${tok}; b=2`) === tok && /HttpOnly; Secure; SameSite=Strict/.test(auth.cookie(tok)), 'cookie is HttpOnly, Secure, SameSite=Strict');
  ok(!makeAuth({ password: '', sessionSecret: 'x' }).configured(), 'no password / short secret configured: the gate reports "not configured" (the API answers 503, never open)');

  // ================= bot -> dashboard end to end =================
  reset(); store = createMemoryStore(); const br = bridge(store);
  global.fetch = br;                                              // every fetch the bot makes (heartbeat of the dashboard) goes to the in-process "Vercel"
  const sc = H.scenario('SOL', 40);
  const r1 = await H.runTrade(bot.processCoin, bot.paper, sc, { hooks: bot.makeHooks() });
  push.pushHeartbeat({ mode: 'paper', status: 'running', lastCandleMs: { SOL_USDT: sc.all[sc.i0].time * 1000 }, kill: false, drawdownR: 1.5, haltR: 39, commit: 'abc123456789', version: '1.1.0', uptimeSec: 100, coins: ['SOL_USDT', 'ZEC_USDT'] });
  await settle(); await push.flush({ force: true });
  const rows = [...store._rows.values()], types = rows.map((x) => x.type).sort().join();
  ok(r1.st.n === 1 && rows.some((x) => x.type === 'entry') && rows.some((x) => x.type === 'exit') && rows.some((x) => x.type === 'heartbeat') && rows.some((x) => x.type === 'signal' && x.data.decision === 'entered'), `a paper trade reaches the dashboard store: ${types}`);
  const en = rows.find((x) => x.type === 'entry'), ex = rows.find((x) => x.type === 'exit');
  ok(en.symbol === 'SOL_USDT' && en.data.sl > 0 && en.data.tp > 0 && en.data.entry > 0 && ex.data.reason === r1.st.trades[0].why && Math.abs(ex.data.r - r1.st.trades[0].R) < 1e-9 && ex.data.costs_kind.includes('estimate'), 'entry (price, SL, TP) and exit (reason, R, costs labelled estimate) arrive intact');
  const jr = journal.readAll().events.filter((e) => e.type === 'entry' || e.type === 'exit');
  ok(rows.filter((x) => x.type === 'entry' || x.type === 'exit').every((x) => jr.some((j) => j.event_id === x.event_id)), 'dashboard event ids = journal event ids (so a backfill can never double count)');

  // ================= privacy =================
  const wire = JSON.stringify(rows), outboxText = fs.readFileSync(path.join(STATE, 'outbox.jsonl'), 'utf8');
  const secretsList = [FAKE.tgToken, FAKE.chat, FAKE.apiKey, FAKE.apiSecret, FAKE.secret, 'mexc-keys', 'telegram'];
  ok(secretsList.every((s) => !wire.includes(s) && !outboxText.includes(s)), 'no API key, secret, Telegram token or chat id, push secret or key-file name appears in the stored events or the outbox');
  ok(!/(^|[^0-9.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}([^0-9.]|$)/.test(wire) && !/\/(opt|home|root|tmp|Users)\//.test(wire) && !/[A-Za-z]:\\\\/.test(wire), 'no IP address and no file path in any payload');
  ok(rows.every((x) => !x.symbol || ['SOL_USDT', 'ZEC_USDT'].includes(x.symbol)), 'only SOL_USDT / ZEC_USDT events');
  reset(); const before = push.enqueue([{ event_id: 'evt-leak-token-1', type: 'signal', ts_ms: now0, mode: 'paper', symbol: 'SOL_USDT', side: 'LONG', data: { decision: 'skipped', detail: `oops ${FAKE.tgToken}` } },
    { event_id: 'evt-leak-path-001', type: 'signal', ts_ms: now0, mode: 'paper', symbol: 'SOL_USDT', side: 'LONG', data: { decision: 'skipped', detail: 'see /opt/lucidio/state/state.json' } },
    { event_id: 'evt-leak-ip-00001', type: 'signal', ts_ms: now0, mode: 'paper', symbol: 'SOL_USDT', side: 'LONG', data: { decision: 'skipped', detail: 'from 193.181.221.91' } },
    { event_id: 'evt-btc-queue-001', type: 'signal', ts_ms: now0, mode: 'paper', symbol: 'BTC_USDT', side: 'LONG', data: { decision: 'skipped' } }]);
  ok(before === 0 && push.pending() === 0, 'the final scan refuses events containing a token, a file path or an IP address, and a BTC event is never queued');
  const liveRec = { ...journal.readAll().events.find((e) => e.type === 'entry'), mode: 'live' }, liveExit = { ...journal.readAll().events.find((e) => e.type === 'exit'), mode: 'live' };
  const lv = [...push.fromJournal(liveRec), ...push.fromJournal(liveExit)];
  ok(lv.every((x) => !('risk_usd' in x.data) && !('balance_used' in x.data) && !('usd' in x.data) && !('balance_after' in x.data)), 'live mode: no dollar amounts (risk, balance, P&L) are sent by default');
  const eqLive = push.equityEvent({ mode: 'live', totalR: 3, peakR: 4, drawdownR: 1, trades: 5, candleMs: 1, balance: 12345.67 }), eqPaper = push.equityEvent({ mode: 'paper', totalR: 3, peakR: 4, drawdownR: 1, trades: 5, candleMs: 1, balance: 111 });
  ok(!('equity_usd' in eqLive.data) && eqPaper.data.paper_balance === 111 && eqLive.data.total_r === 3, 'real MEXC equity is not sent in live mode (R only); the paper balance is');
  process.env.DASHBOARD_SHARE_LIVE_EQUITY = 'true'; ok(push.equityEvent({ mode: 'live', totalR: 3, peakR: 4, drawdownR: 1, trades: 5, candleMs: 1, balance: 12345.67 }).data.equity_usd === 12345.67, 'DASHBOARD_SHARE_LIVE_EQUITY=true sends it'); delete process.env.DASHBOARD_SHARE_LIVE_EQUITY;

  // ================= outbox: outage, catch-up, no duplicates, order =================
  reset(); store = createMemoryStore(); const st = { down: true }, b2 = bridge(store, st); global.fetch = b2;
  const mk = (i) => ({ event_id: `evt-queue-${String(i).padStart(4, '0')}`, type: 'signal', ts_ms: now0 + i, mode: 'paper', symbol: i % 2 ? 'ZEC_USDT' : 'SOL_USDT', side: 'LONG', data: { decision: 'skipped', reason: 'late_entry', signal_candle_open_ms: now0 } });
  push.enqueue(Array.from({ length: 60 }, (_, i) => mk(i))); await sleep(60);
  ok(push.pending() === 60 && store._rows.size === 0 && push.status().lastError, `outage: 60 events queued on disk, none lost, none sent (${push.status().lastError})`);
  const t0 = Date.now(); const noRetry = await push.flush(); ok(noRetry.backoff === true && Date.now() - t0 < 200, 'during back-off the sender does not hammer the server');
  st.down = false; const got = []; const orig2 = store.insert; store.insert = async (events) => { got.push(...events.map((e) => e.event_id)); return orig2(events); };
  const fl = await push.flush({ force: true });
  ok(fl.sent === 60 && fl.pending === 0 && store._rows.size === 60, `server back: the queue drains (${fl.sent} sent, ${store._rows.size} stored)`);
  ok(got.length === 60 && got.every((id, i) => id === `evt-queue-${String(i).padStart(4, '0')}`), 'events arrive in the order they were queued');
  const again = await push.flush({ force: true }); ok(again.sent === 0, 'nothing is sent twice once acknowledged');
  fs.writeFileSync(path.join(STATE, 'outbox.cursor.json'), JSON.stringify({ sent: 35 }));          // crash after the 2xx but before the cursor was saved
  const dup = await push.flush({ force: true }); ok(dup.sent === 25 && store._rows.size === 60, 'crash between 2xx and cursor save: the resend is ignored by the server (still 60 stored, no duplicates)');

  // 400 poison event does not block the queue; 401 keeps events queued
  reset(); store = createMemoryStore(); global.fetch = bridge(store);
  push.enqueue([mk(1)]); await sleep(60);
  fs.appendFileSync(path.join(STATE, 'outbox.jsonl'), JSON.stringify({ event_id: 'evt-poison-0001', type: 'signal', ts_ms: now0, mode: 'paper', symbol: 'DOGE_USDT', data: {} }) + '\n');
  push.enqueue([mk(3)]); await sleep(60); await push.flush({ force: true });
  ok(store._rows.size === 2 && push.pending() === 0 && fs.existsSync(path.join(STATE, 'outbox.rejected.jsonl')), 'a schema-rejected event is set aside (outbox.rejected.jsonl); the events around it are delivered');
  reset(); store = createMemoryStore(); global.fetch = bridge(store, { secret: 'a-different-secret-a-different-secret' });
  push.enqueue([mk(1), mk(2)]); await sleep(80);
  ok(push.pending() === 2 && store._rows.size === 0 && /401/.test(push.status().lastError), 'wrong secret / clock: HTTP 401, events stay queued (not dropped)');

  // ================= a push failure never blocks a trade =================
  const baseline = r1.st.trades[0];
  for (const [name, state] of [['hanging', { hang: true }], ['unreachable', { down: true }], ['wrong secret', { secret: 'x'.repeat(32) }]]) {
    reset(); global.fetch = bridge(createMemoryStore(), state);
    const t1 = Date.now(), rr = await H.runTrade(bot.processCoin, bot.paper, sc, { hooks: bot.makeHooks() });
    ok(rr.st.n === 1 && rr.st.trades[0].why === baseline.why && Math.abs(rr.st.trades[0].R - baseline.R) < 1e-9 && Date.now() - t1 < 3000, `dashboard ${name}: the trade is opened, managed and closed with the identical result (${Date.now() - t1} ms)`);
  }
  const savedUrl = process.env.DASHBOARD_URL; delete process.env.DASHBOARD_URL; reset(); global.fetch = bridge(createMemoryStore());
  const rOff = await H.runTrade(bot.processCoin, bot.paper, sc, { hooks: bot.makeHooks() });
  ok(rOff.st.n === 1 && global.fetch.calls.length === 0 && !fs.existsSync(path.join(STATE, 'outbox.jsonl')), 'DASHBOARD_URL unset: pushing is off, no request, no outbox file, the bot runs exactly as before');
  process.env.DASHBOARD_URL = savedUrl;

  // ================= backfill, heartbeat cadence, reachability =================
  reset(); store = createMemoryStore(); global.fetch = bridge(store);
  const jr2 = journal.readAll().events, bf = await push.backfill(jr2, { force: true });
  const n1 = store._rows.size; const bf2 = await push.backfill(jr2, { force: true });
  ok(bf.ok && bf.queued > 0 && n1 > 0 && store._rows.size === n1, `dashboard-backfill sends the journal history (${n1} events) and a second run adds nothing (${store._rows.size})`);
  ok(push.heartbeatDue(now0 + 400000) === true && (push.pushHeartbeat({ mode: 'paper', coins: [] }, now0), push.heartbeatDue(now0 + 100000) === false && push.heartbeatDue(now0 + 301000) === true), 'heartbeats are due every 5 minutes');
  const rc = await push.reachable({ fetchImpl: bridge(store) }); ok(rc.configured && rc.ok, 'check: dashboard configured and reachable (GET /api/health)');
  const rcDown = await push.reachable({ fetchImpl: bridge(store, { down: true }) }); ok(rcDown.configured && !rcDown.ok && /unreachable/.test(rcDown.detail), 'check: configured but unreachable is reported');

  // ================= aggregation =================
  const evs = [...store._rows.values()].filter((x) => x.type !== 'heartbeat'), hb = { type: 'heartbeat', ts_ms: now0, mode: 'paper', data: { kill_switch: false, drawdown_r: 2, halt_r: 39, last_candle_ms: {}, prices: { SOL_USDT: { px: 100, candle_ms: 1 } } } };
  const mkT = (id, symbol, side, r, t) => [{ type: 'entry', event_id: `e-${id}`, ts_ms: t, mode: 'paper', symbol, side, data: { trade_id: id, entry: 100, sl: 95, tp: 120, risk_pct: 0.01 } }, { type: 'exit', event_id: `x-${id}`, ts_ms: t + 1000, mode: 'paper', symbol, side, data: { trade_id: id, exit: 101, reason: r > 0 ? 'target' : 'stop', r, hold_sec: 3600 } }];
  const synth = [...mkT('a', 'SOL_USDT', 'LONG', 4, 1e12), ...mkT('b', 'SOL_USDT', 'LONG', -1, 2e12), ...mkT('c', 'SOL_USDT', 'SHORT', -1, 3e12), ...mkT('d', 'ZEC_USDT', 'LONG', 4, 4e12), ...mkT('e', 'ZEC_USDT', 'LONG', -1, 5e12),
    { type: 'entry', event_id: 'e-open', ts_ms: 6e12, mode: 'paper', symbol: 'SOL_USDT', side: 'LONG', data: { trade_id: 'open1', entry: 90, sl: 80, tp: 130 } },
    { type: 'signal', event_id: 's1', ts_ms: 7e12, mode: 'paper', symbol: 'ZEC_USDT', side: 'SHORT', data: { decision: 'skipped', reason: 'drawdown_halt', detail: '40R' } }, { type: 'compare', event_id: 'c1', ts_ms: 8e12, mode: 'paper', data: { match: false, matched: 3, mismatches: [] } }];
  const ag = aggregate({ events: synth, heartbeat: { ...hb, ts_ms: Date.now() - 600000 }, now: Date.now() });
  ok(ag.overall.trades === 5 && ag.overall.total_r === 5 && ag.per_coin.SOL_USDT.trades === 3 && ag.per_coin.SOL_USDT.win_rate === 0.333 && ag.per_coin.SOL_USDT.profit_factor === 2 && ag.per_coin.SOL_USDT.longest_losing_streak === 2 && ag.per_coin.SOL_USDT.max_dd_r === 2, `per-coin stats: ${JSON.stringify(ag.per_coin.SOL_USDT)}`);
  ok(ag.equity.length === 5 && ag.equity[4].r_cum === 5 && ag.equity.every((p) => p.dd_r >= 0) && ag.open.length === 1 && ag.open[0].current_r === 1 && ag.skipped.length === 1 && ag.compare && ag.compare.match === false, 'equity curve and drawdown from closed trades; open position with its current R (+1.00R at 100 vs entry 90, SL 80); skipped signals; latest compare');
  ok(ag.status.alive === true && aggregate({ events: synth, heartbeat: { ...hb, ts_ms: Date.now() - (4 * 3600 + 21 * 60) * 1000 }, now: Date.now() }).status.alive === false && aggregate({ events: synth, heartbeat: { ...hb, ts_ms: Date.now() - (4 * 3600 + 19 * 60) * 1000 }, now: Date.now() }).status.alive === true, 'status banner: alive up to 4h20m since the last heartbeat, stale after (same limit as the watchdog)');
  ok(aggregate({ events: [], heartbeat: null, now: Date.now() }).status.alive === false && aggregate({ events: evs, heartbeat: null, now: Date.now() }).mode === 'paper', 'no data yet: waiting state, nothing crashes');

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
