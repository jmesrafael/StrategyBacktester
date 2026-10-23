// test/dashboard-api-test.js - smoke test of the four Vercel function files (dashboard/api/*.js) with mock req/res objects and a stubbed Supabase.
// Proves the wiring (raw body from the stream, cookies, status codes, store calls). It does NOT run the real Vercel runtime.
//   node test/dashboard-api-test.js
'use strict';
const { Readable } = require('stream');
const sigLib = require('../dashboard/lib/signature.js');

const SECRET = 'a'.repeat(32), PASSWORD = 'correct horse battery', SESSION = 'b'.repeat(24);
Object.assign(process.env, { DASHBOARD_PUSH_SECRET: SECRET, DASHBOARD_PASSWORD: PASSWORD, DASHBOARD_SESSION_SECRET: SESSION, SUPABASE_URL: 'https://proj.supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-for-test' });
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };

const supa = []; const stored = new Map();
global.fetch = async (url, opts = {}) => {
  supa.push({ url: String(url), method: opts.method || 'GET', headers: opts.headers });
  const json = async () => {
    if ((opts.method || 'GET') === 'POST') { const rows = JSON.parse(opts.body), fresh = rows.filter((r) => !stored.has(r.event_id)); fresh.forEach((r) => stored.set(r.event_id, r)); return fresh; }
    if (/type=eq\.heartbeat/.test(url)) return [];
    return [...stored.values()];
  };
  return { ok: true, status: 200, json };
};

const mkReq = (method, url, body, headers = {}) => { const r = Readable.from(body == null ? [] : [Buffer.from(body)]); Object.assign(r, { method, url, headers: { host: 'x', ...headers }, socket: { remoteAddress: '9.9.9.9' } }); return r; };
const mkRes = () => { const res = { headers: {}, statusCode: 200, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b || ''; this.done(); } }; res.finished = new Promise((r) => { res.done = r; }); return res; };
const call = async (mod, req) => { const res = mkRes(); await require(mod)(req, res); await res.finished; return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null, headers: res.headers }; };

(async () => {
  let r = await call('../dashboard/api/health.js', mkReq('GET', '/api/health'));
  ok(r.status === 200 && JSON.stringify(r.json) === '{"ok":true}', 'GET /api/health -> {"ok":true} and nothing else');

  const ev = [{ event_id: 'evt-api-smoke-1', type: 'signal', ts_ms: Date.now(), mode: 'paper', symbol: 'SOL_USDT', side: 'LONG', data: { decision: 'skipped', reason: 'late_entry' } }];
  const body = JSON.stringify({ events: ev }), ts = Date.now();
  const sign = (b, t = ts, s = SECRET) => ({ 'x-lucidio-timestamp': String(t), 'x-lucidio-signature': sigLib.sign(s, t, b) });
  r = await call('../dashboard/api/ingest.js', mkReq('POST', '/api/ingest', body, sign(body)));
  ok(r.status === 200 && r.json.accepted === 1 && stored.has('evt-api-smoke-1'), 'POST /api/ingest: signed body read from the stream, verified, written to the store');
  const row = stored.get('evt-api-smoke-1');
  ok(/bot_events\?on_conflict=event_id/.test(supa[0].url) && supa[0].headers.Prefer.includes('ignore-duplicates') && supa[0].headers.apikey === 'service-role-key-for-test' && row.symbol === 'SOL_USDT', 'the store call is an insert with on_conflict=event_id / ignore-duplicates and the service-role key (server side only)');
  r = await call('../dashboard/api/ingest.js', mkReq('POST', '/api/ingest', body, sign(body)));
  ok(r.status === 200 && r.json.accepted === 0 && r.json.duplicates === 1, 'the same request again: accepted 0, duplicates 1');
  r = await call('../dashboard/api/ingest.js', mkReq('POST', '/api/ingest', body, sign(body, ts, 'z'.repeat(32))));
  ok(r.status === 401, 'wrong signature: 401');
  r = await call('../dashboard/api/ingest.js', mkReq('POST', '/api/ingest', 'x'.repeat(70000), sign('x')));
  ok(r.status === 413, 'oversized body: 413 (the stream is cut off at 64 KB)');
  r = await call('../dashboard/api/ingest.js', mkReq('GET', '/api/ingest'));
  ok(r.status === 405, 'GET /api/ingest: 405');

  r = await call('../dashboard/api/data.js', mkReq('GET', '/api/data'));
  ok(r.status === 401, 'GET /api/data without a session: 401 (the trading data is not public)');
  r = await call('../dashboard/api/login.js', mkReq('POST', '/api/login', JSON.stringify({ password: 'wrong' })));
  ok(r.status === 401 && !r.headers['set-cookie'], 'POST /api/login wrong password: 401, no cookie');
  r = await call('../dashboard/api/login.js', mkReq('POST', '/api/login', JSON.stringify({ password: PASSWORD })));
  const cookie = String(r.headers['set-cookie'] || '');
  ok(r.status === 200 && /^lucidio_session=v1\.\d+\.[0-9a-f]{64}; HttpOnly; Secure; SameSite=Strict/.test(cookie), 'POST /api/login right password: 200 and an HttpOnly Secure SameSite=Strict cookie');
  r = await call('../dashboard/api/data.js', mkReq('GET', '/api/data?mode=paper', null, { cookie: cookie.split(';')[0] }));
  ok(r.status === 200 && r.json.mode === 'paper' && Array.isArray(r.json.trades) && r.json.status && r.json.status.alive === false, 'GET /api/data with the cookie: 200 and the aggregated JSON');
  r = await call('../dashboard/api/data.js', mkReq('GET', '/api/data', null, { cookie: cookie.split(';')[0].slice(0, -3) + 'abc' }));
  ok(r.status === 401, 'a tampered cookie: 401');
  r = await call('../dashboard/api/login.js', mkReq('DELETE', '/api/login'));
  ok(r.status === 200 && /Max-Age=0/.test(String(r.headers['set-cookie'])), 'DELETE /api/login clears the cookie');

  const saved = process.env.DASHBOARD_PASSWORD; delete process.env.DASHBOARD_PASSWORD;
  r = await call('../dashboard/api/data.js', mkReq('GET', '/api/data', null, { cookie }));
  ok(r.status === 503, 'no DASHBOARD_PASSWORD on the server: the data API answers 503 (locked), never open');
  process.env.DASHBOARD_PASSWORD = saved;
  const lim = []; for (let i = 0; i < 10; i++) lim.push((await call('../dashboard/api/login.js', mkReq('POST', '/api/login', JSON.stringify({ password: 'guess' + i })))).status);
  ok(lim.filter((s) => s === 429).length >= 1, `password guessing is rate limited (${lim.join(',')})`);

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
