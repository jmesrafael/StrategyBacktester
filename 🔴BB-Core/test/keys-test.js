// test/keys-test.js - MEXC API key expiry + reserve key: date maths, alerts, failover in mexc.js, adding a reserve, the watchdog warnings.
//   node test/keys-test.js       No network (fetch is a mock), fake keys only, nothing sent anywhere.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const H = require('./helpers.js');
const STATE = H.tmp('keys-state');
process.env.LUCIDIO_STATE_DIR = STATE; process.env.LUCIDIO_KEYS = path.join(STATE, 'mexc-keys.json');
process.env.WATCHDOG_DRY = '';
const ki = require('../keyinfo.js'), mexc = require('../mexc.js');

let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const D = (s) => ki.parseDay(s), AK = 'AKEY-PRIMARY-' + 'xx11', AS = 'asecret-primary-' + 'yy22', BK = 'AKEY-RESERVE-' + 'zz33', BS = 'asecret-reserve-' + 'ww44';
const FILE = { apiKey: AK, apiSecret: AS, apiKeyCreated: '2026-10-23', reserveApiKey: BK, reserveApiSecret: BS, reserveApiKeyCreated: '2026-12-01', telegramToken: 'TT', telegramChatId: '1' };

(async () => {
  // ---------- date maths ----------
  ok(D('2026-10-23') === Date.UTC(2026, 9, 23) && D('2026-02-30') === null && D('bad') === null, 'parseDay accepts real days only');
  const c = ki.candidates(FILE);
  ok(c.length === 2 && c[0].expiresMs === D('2026-10-23') + 90 * ki.DAY && ki.isoDay(c[0].expiresMs) === '2027-01-21', 'created Oct 23, 2026 + 90 days = Jan 21, 2027');
  ok(ki.fmtDay(c[0].expiresMs) === 'Jan 21, 2027', 'day format is "Jan 21, 2027"');
  ok(ki.candidates({ apiKey: 'a', apiSecret: 'b', apiKeyExpires: '2027-02-01', apiKeyCreated: '2026-10-23' })[0].expiresMs === D('2027-02-01'), 'an explicit expiry day wins over created + 90');
  ok(ki.candidates({ apiKey: 'a', apiSecret: 'b', apiKeyCreated: '2026-10-23', apiKeyLifetimeDays: 30 })[0].expiresMs === D('2026-11-22'), 'lifetime can be changed');
  ok(ki.candidates({ apiKey: 'a', apiSecret: 'b' })[0].expiresMs === null, 'no date = unknown expiry');
  ok(ki.candidates({}).length === 0 && ki.candidates({ apiKey: 'your MEXC key', apiSecret: 'x' }).length === 0, 'empty file / placeholder = no keys');
  const exp = c[0].expiresMs;
  ok(ki.activeOf(c, exp - 1).label === 'primary' && ki.activeOf(c, exp).label === 'reserve', 'primary in use until its expiry day starts, then the reserve');
  ok(ki.daysLeft(c[0], exp - 14 * ki.DAY) === 14 && ki.daysLeft(c[0], exp - 1) === 1, 'days left counts whole days, rounded up');

  // ---------- alerts ----------
  const t = (n) => exp - n * ki.DAY - 3600000;       // a bit more than n days before expiry
  const nr = { apiKey: AK, apiSecret: AS, apiKeyCreated: '2026-10-23' };
  ok(ki.alerts(nr, exp - 30 * ki.DAY).length === 0, 'no alert 30 days before');
  const a14 = ki.alerts(nr, exp - 13.5 * ki.DAY);
  ok(a14.length === 1 && /d14$/.test(a14[0].id) && /NO reserve/.test(a14[0].text) && a14[0].text.includes(ki.ADD_CMD), 'within 14 days and no reserve: warns, says how to add one');
  ok(/d7$/.test(ki.alerts(nr, exp - 6.5 * ki.DAY)[0].id) && /d3$/.test(ki.alerts(nr, exp - 2.5 * ki.DAY)[0].id) && /d1$/.test(ki.alerts(nr, exp - 0.5 * ki.DAY)[0].id), 'alerts at 7, 3 and 1 days');
  const sent = { [a14[0].id]: 1 };
  ok(ki.alerts(nr, exp - 13 * ki.DAY, sent).length === 0, 'a delivered warning is not repeated');
  const withRes = ki.alerts(FILE, exp - 6.5 * ki.DAY);
  ok(withRes.length === 1 && /takes over by itself/.test(withRes[0].text), 'with a reserve that outlives it the text says it takes over');
  const after = ki.alerts(FILE, exp + 3600000);
  ok(after.some((a) => /primary key EXPIRED/.test(a.text) && /now using the reserve/.test(a.text)), 'after expiry with a reserve: told the reserve is in use');
  const dead = ki.alerts(nr, exp + 3600000);
  ok(dead.some((a) => /no other valid key/.test(a.text)) && dead.some((a) => /ALL MEXC API KEYS HAVE EXPIRED/.test(a.text)), 'expired with no reserve: urgent messages');
  ok(ki.alerts({ apiKey: AK, apiSecret: AS }, exp)[0].id === 'primary:nodate', 'no date recorded: asks for one');
  ok(JSON.stringify([ki.alerts(FILE, exp - 5 * ki.DAY), ki.alerts(nr, exp + 1e9), ki.describe(FILE, exp - 5 * ki.DAY), ki.status(FILE)]).split(AS).length === 1 && JSON.stringify([ki.alerts(FILE, exp + 1), ki.status(FILE)]).indexOf(BS) < 0 && JSON.stringify(ki.status(FILE)).indexOf(AK) < 0, 'alerts / status / describe never contain a secret or key');
  ok(ki.describe(nr).some((l) => /reserve key: none attached/.test(l)), 'status shows when no reserve is attached');

  // ---------- addReserve ----------
  const NOW = D('2026-12-05');
  const r1 = ki.addReserve({ apiKey: AK, apiSecret: AS, apiKeyCreated: '2026-10-23' }, { apiKey: BK, apiSecret: BS, created: '2026-12-05' }, NOW);
  ok(r1.keys.reserveApiKey === BK && r1.keys.apiKey === AK && r1.keys.reserveApiKeyCreated === '2026-12-05', 'reserve added next to the primary');
  const r2 = ki.addReserve({ ...FILE, apiKeyCreated: '2026-07-01' }, { apiKey: 'NEW-K', apiSecret: 'NEW-S', created: '2026-12-05' }, NOW);
  ok(r2.keys.apiKey === BK && r2.keys.apiSecret === BS && r2.keys.apiKeyCreated === '2026-12-01' && r2.keys.reserveApiKey === 'NEW-K' && /promoted/.test(r2.action), 'primary expired: old reserve promoted, new key becomes the reserve');
  const r3 = ki.addReserve(FILE, { apiKey: 'NEW-K', apiSecret: 'NEW-S' }, NOW);
  ok(r3.keys.apiKey === AK && r3.keys.reserveApiKey === 'NEW-K' && r3.keys.telegramToken === 'TT', 'primary still valid: only the reserve is replaced, other fields kept');
  const bad = (k, n) => { try { ki.addReserve(k, n, NOW); return false; } catch { return true; } };
  ok(bad(FILE, { apiKey: AK, apiSecret: 'x' }) && bad(FILE, { apiKey: 'a' }) && bad({}, { apiKey: 'a', apiSecret: 'b' }) && bad(FILE, { apiKey: 'n', apiSecret: 's', created: 'nope' }) && bad(FILE, { apiKey: 'n', apiSecret: 's', created: '2030-01-01' }), 'refuses the same key, missing secret, no primary, bad or future dates');

  // ---------- keys linked to the server IP never expire ----------
  const bound = { apiKey: AK, apiSecret: AS, apiKeyIpBound: true };
  ok(ki.candidates(bound)[0].expiresMs === null && ki.candidates(bound)[0].ipBound && ki.activeOf(ki.candidates(bound), exp * 5).label === 'primary', 'an IP-bound key has no expiry: still in use years later');
  ok(ki.alerts(bound, exp * 5).length === 0 && ki.describe(bound, exp).some((l) => /does not expire/.test(l)), 'IP-bound: no warnings, status says it does not expire');
  const bres = ki.addReserve(nr, { apiKey: BK, apiSecret: BS, ipBound: true }, NOW);
  ok(bres.keys.reserveApiKeyIpBound === true && ki.alerts(bres.keys, exp - 6.5 * ki.DAY).every((x) => /primary/.test(x.id)) && /takes over by itself/.test(ki.alerts(bres.keys, exp - 6.5 * ki.DAY)[0].text), 'an IP-bound reserve: the primary still warns, and the text says the reserve takes over');
  const prom = ki.addReserve({ ...nr, apiKeyCreated: '2026-07-01', reserveApiKey: BK, reserveApiSecret: BS, reserveApiKeyIpBound: true }, { apiKey: 'NEW-K', apiSecret: 'NEW-S' }, NOW);
  ok(prom.keys.apiKey === BK && prom.keys.apiKeyIpBound === true && !prom.keys.apiKeyCreated, 'promoting an IP-bound reserve carries its flag over');
  // ---------- failover in mexc.js ----------
  const calls = []; const realFetch = global.fetch;
  const resp = (body, status = 200) => ({ status, text: async () => JSON.stringify(body) });
  let script = () => resp({ success: true, code: 0, data: { ok: 1 } });
  global.fetch = async (url, opts) => { calls.push({ url, method: opts.method, key: opts.headers.ApiKey, sig: opts.headers.Signature, ts: opts.headers['Request-Time'], body: opts.body }); return script(calls[calls.length - 1]); };
  const logs = [], events = []; let nowMs = D('2026-11-01');
  const keysL = () => ki.candidates(FILE);
  const mk = (extra = {}) => mexc.createClient({ keys: keysL, log: (m) => logs.push(m), clock: () => nowMs, onKeyEvent: (e) => events.push(e), ...extra });
  const expired = () => resp({ success: false, code: 402, message: 'API key expired' });
  let cl = mk(); calls.length = 0;
  await cl.asset();
  ok(calls.length === 1 && calls[0].key === AK, 'normal call signs with the primary key');
  const want = (x) => crypto.createHmac('sha256', x.s).update(x.k + x.ts + (x.qs || '')).digest('hex');
  ok(calls[0].sig === want({ k: AK, s: AS, ts: calls[0].ts }), 'signature is HMAC of the primary key + secret');
  script = (c) => (c.key === AK ? expired() : resp({ success: true, code: 0, data: { ok: 2 } })); calls.length = 0;
  const r = await cl.asset();
  ok(calls.length === 2 && calls[1].key === BK && r && calls[1].sig === want({ k: BK, s: BS, ts: calls[1].ts }), 'expired primary: same call repeated once with the reserve, signed with the RESERVE secret');
  ok(events.length === 1 && events[0].from === 'primary' && events[0].to === 'reserve', 'a key-switch event is reported (labels only)');
  calls.length = 0; await cl.asset();
  ok(calls.length === 1 && calls[0].key === BK, 'the reserve stays in use for the next calls (rejection is remembered)');
  nowMs += 25 * 3600000; calls.length = 0; await cl.asset();
  ok(calls[0].key === AK, 'after 24 hours the primary is tried again');

  cl = mk(); calls.length = 0; script = (c) => (c.key === AK ? expired() : resp({ success: true, code: 0 }));
  await cl.createOrder({ symbol: 'SOL_USDT', side: 1, vol: 1, type: 5, openType: 2, leverage: 1, externalOid: 'x1' });
  ok(calls.length === 2 && calls[0].method === 'POST' && calls[1].key === BK && calls[0].body === calls[1].body, 'a POST rejected for its KEY (nothing processed) is repeated once with the reserve, same body / order id');

  for (const [name, fn] of [
    ['network error', () => { throw new Error('boom'); }], ['406 IP not bound', () => resp({ success: false, code: 406, message: 'IP not bound' })],
    ['signature error', () => resp({ success: false, code: 602, message: 'Signature verification failed' })], ['HTTP 500', () => resp({ success: false, code: 500, message: 'server error' }, 500)] ]) {
    cl = mk(); calls.length = 0; events.length = 0; script = fn;
    let threw = false; try { await cl.createOrder({ symbol: 'SOL_USDT', side: 1, vol: 1, type: 5, openType: 2, leverage: 1, externalOid: 'x2' }); } catch { threw = true; }
    ok(calls.length === 1 && !events.length && calls[0].key === AK, `${name}: no key switch and the POST is not repeated`);
  }
  cl = mk(); calls.length = 0; script = expired; let err = null;
  try { await cl.asset(); } catch (e) { err = e; }
  ok(calls.length === 2 && err, 'every key rejected: each tried once, then the error surfaces (no loop)');
  const dated = mexc.createClient({ keys: () => ki.candidates(FILE), clock: () => D('2027-01-22'), log: () => {} }); calls.length = 0; script = () => resp({ success: true, code: 0 });
  await dated.asset();
  ok(calls[0].key === BK, 'a primary past its recorded expiry day is skipped without asking MEXC');
  const wrongDate = mexc.createClient({ keys: () => ki.candidates({ apiKey: AK, apiSecret: AS, apiKeyCreated: '2020-01-01' }), clock: () => nowMs, log: () => {} }); calls.length = 0;
  await wrongDate.asset();
  ok(calls.length === 1 && calls[0].key === AK, 'with only one key, a wrong date never stops the bot: the exchange has the last word');
  const single = mexc.createClient({ apiKey: AK, apiSecret: AS, log: () => {} }); calls.length = 0; script = () => resp({ success: true, code: 0 });
  await single.asset();
  ok(calls[0].key === AK, 'old-style single apiKey / apiSecret still works');
  await cl.ticker('SOL_USDT').catch(() => {}); ok(true, 'public call needs no key');
  ok(logs.length > 0 && !logs.join('\n').includes(AS) && !logs.join('\n').includes(BS) && !logs.join('\n').includes(AK) && !logs.join('\n').includes(BK), 'logs name keys by label only, never a key or secret');
  global.fetch = realFetch;

  // ---------- default client: keys file, hot reload, event file ----------
  fs.writeFileSync(process.env.LUCIDIO_KEYS, JSON.stringify({ apiKey: AK, apiSecret: AS }));
  ok(mexc.currentKeys().length === 1 && mexc.hasKeys(), 'default client reads the keys file');
  fs.writeFileSync(process.env.LUCIDIO_KEYS, JSON.stringify({ apiKey: AK, apiSecret: AS, reserveApiKey: BK, reserveApiSecret: BS })); fs.utimesSync(process.env.LUCIDIO_KEYS, new Date(), new Date(Date.now() + 5000));
  ok(mexc.currentKeys().length === 2, 'a reserve key added while the bot runs is picked up (no restart)');
  fs.rmSync(process.env.LUCIDIO_KEYS);
  ok(mexc.currentKeys().length === 0 && !mexc.hasKeys(), 'no file, no env = no keys (paper mode)');

  // ---------- watchdog ----------
  process.env.WATCHDOG_DRY = '';
  const wd = require('../deploy/watchdog.js'), sentMsgs = [];
  const tg = async (url, opts) => { sentMsgs.push(JSON.parse(opts.body).text); return { ok: true, status: 200 }; };
  fs.writeFileSync(process.env.LUCIDIO_KEYS, JSON.stringify({ ...nr, telegramToken: 'TT', telegramChatId: '1' }));
  let w = await wd.keyAlerts({ now: exp - 6.5 * ki.DAY, fetchImpl: tg });
  ok(w.sent.length === 1 && /expires Jan 21, 2027/.test(sentMsgs[0]) && /Lucid'io WATCHDOG/.test(sentMsgs[0]), 'watchdog sends the warning once it is due');
  w = await wd.keyAlerts({ now: exp - 6 * ki.DAY, fetchImpl: tg });
  ok(sentMsgs.length === 1 && w.sent.length === 0, 'and does not send it again on the next 10-minute run');
  w = await wd.keyAlerts({ now: exp - 2.5 * ki.DAY, fetchImpl: tg });
  ok(sentMsgs.length === 2 && /in 3 days/.test(sentMsgs[1]), 'the next threshold (3 days) warns again');
  const failing = async () => ({ ok: false, status: 500 });
  w = await wd.keyAlerts({ now: exp - 0.5 * ki.DAY, fetchImpl: failing });
  ok(w.sent.length === 0, 'a failed Telegram send is not marked as delivered');
  w = await wd.keyAlerts({ now: exp - 0.4 * ki.DAY, fetchImpl: tg });
  ok(w.sent.length === 1 && /in 1 day/.test(sentMsgs[2]), '...and is retried on the next run');
  fs.writeFileSync(path.join(STATE, 'api-key-event.json'), JSON.stringify({ event: 'switched', from: 'primary', to: 'reserve', reason: 'expired (code 402)', at: '2026-12-01T00:00:00.000Z' }));
  w = await wd.keyAlerts({ now: exp - 20 * ki.DAY, fetchImpl: tg });
  ok(w.switched && /rejected the primary API key/.test(sentMsgs[3]) && /switched to the reserve/.test(sentMsgs[3]), 'a real key switch is reported');
  w = await wd.keyAlerts({ now: exp - 20 * ki.DAY, fetchImpl: tg });
  ok(sentMsgs.length === 4, 'the switch is reported once');
  ok(!sentMsgs.join('\n').includes(AS) && !sentMsgs.join('\n').includes(AK), 'Telegram text never contains a key or secret');
  ok(!fs.readFileSync(path.join(STATE, 'key-alerts.json'), 'utf8').includes(AS), 'key-alerts.json holds no secret');
  fs.rmSync(process.env.LUCIDIO_KEYS); fs.rmSync(path.join(STATE, 'key-alerts.json'));
  w = await wd.keyAlerts({ now: exp, fetchImpl: tg });
  ok(w.due.length === 0 && !w.error, 'no keys file: nothing to warn about, no crash');

  // ---------- scripts ----------
  for (const f of ['add-reserve-key.sh', 'make-keys.sh', 'lucidio-menu.sh']) {
    const p = path.join(__dirname, '..', 'deploy', f), txt = fs.readFileSync(p, 'utf8');
    let good = f === 'lucidio-menu.sh' || !txt.includes('\r');   // the menu is CRLF only in this Windows checkout (autocrlf); git stores LF try { cp.execFileSync('bash', ['-n', 'deploy/' + f], { cwd: path.join(__dirname, '..'), stdio: 'pipe' }); } catch (e) { good = false; console.log(String(e.stderr).slice(0, 200)); }
    ok(good, `deploy/${f}: bash syntax ok, LF line endings`);
  }
  ok(/read -rsp "Reserve apiSecret/.test(fs.readFileSync(path.join(__dirname, '..', 'deploy', 'add-reserve-key.sh'), 'utf8')), 'add-reserve-key.sh asks for the secret with a hidden prompt');

  console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
