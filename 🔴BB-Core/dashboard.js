// dashboard.js — Lucidyo monitor. Lightweight local web page: capital (MEXC + paper), open trades, recent trades, health checks,
// run timings and a live log terminal. Reads what lucidyo.js writes to state/; talks to MEXC read-only.
//   node dashboard.js            (or double-click open-dashboard.cmd)  -> http://127.0.0.1:8787 opens in the browser
// Binds to 127.0.0.1 only: open it on the VPS itself (RDP). API keys never leave this process; the page only sees numbers.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { exec } = require('child_process');
const mexc = require('./mexc.js');
const { CFG, riskFor } = require('./lucidyo.js');
const config = require('./config.js');

const DIR = __dirname, ST = path.join(DIR, 'state'), PORT = +(process.env.LUCIDYO_DASH_PORT || 8787), IV = 14400;
const URL = `http://127.0.0.1:${PORT}`;

const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(path.join(ST, f), 'utf8')); } catch { return d; } };
function tail(f, maxLines, maxBytes = 400000) {
  try {
    const p = path.join(ST, f), size = fs.statSync(p).size, fd = fs.openSync(p, 'r'), len = Math.min(size, maxBytes), buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len); fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n').filter(Boolean);
    return (size > len ? lines.slice(1) : lines).slice(-maxLines);
  } catch { return []; }
}
const jsonl = (f, n) => tail(f, n).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

// MEXC calls are cached so a page left open does not hammer the API
const cache = {};
async function cached(key, ttlMs, fn) {
  const c = cache[key];
  if (c && Date.now() - c.at < ttlMs) return c.v;
  let v; try { const r = await fn(); v = { ok: true, data: r.data, ms: r.ms, at: Date.now() }; } catch (e) { v = { ok: false, error: e.message, ms: e.ms }; }
  cache[key] = { at: Date.now(), v }; return v;
}

async function status() {
  Object.assign(CFG, config.load());                       // pick up Settings changes (the bot re-reads the file every run too)
  const now = Date.now(), state = readJson('state.json', { coins: {} }), pidf = readJson('bot.pid');
  const runs = jsonl('runs.jsonl', 60), events = jsonl('events.jsonl', 400), logLines = tail('bot.log', 300);
  const [ping, account, positions, ...tickers] = await Promise.all([
    cached('ping', 30000, () => mexc.serverTime()),
    mexc.hasKeys() ? cached('acct', 30000, () => mexc.account()) : null,
    mexc.hasKeys() ? cached('pos', 30000, () => mexc.positions()) : null,
    ...CFG.coins.map((c) => cached('tk' + c, 15000, () => mexc.ticker(c))),
  ]);
  const price = {}; CFG.coins.forEach((c, i) => { if (tickers[i].ok) price[c] = +tickers[i].data.lastPrice; });

  // trades, open positions, equity curve (paper)
  const trades = [], open = [], pending = [], live = CFG.mode === 'live';
  let realizedR = 0;
  for (const [coin, st] of Object.entries(state.coins || {})) {
    realizedR += st.realizedR || 0;
    for (const t of st.trades || []) trades.push(t);
    if (st.pos) {
      const p = st.pos, px = price[coin];
      const uR = px ? (p.dir * (px - p.entry) / p.entry) / p.dist : null;
      const barsHeld = Math.floor((now / 1000 - p.t0) / IV);
      open.push({ coin, dir: p.dir, entry: p.entry, stop: p.stop, tp: p.tp, t0: p.t0, riskUsd: p.riskUsd, px, uR, uUsd: uR == null ? null : uR * p.riskUsd, barsHeld, entryDelaySec: p.entryDelaySec,
        live: !!p.live, vol: p.vol, lev: p.lev, slipR: p.slipR });
    }
    if (st.pending) pending.push({ coin, ...st.pending });
  }
  trades.sort((a, b) => a.tExit - b.tExit);
  let eqR = 0, pkR = 0, ddR = 0, maxDdR = 0, streak = 0, maxStreak = 0;
  for (const t of trades) { eqR += t.R; pkR = Math.max(pkR, eqR); ddR = pkR - eqR; maxDdR = Math.max(maxDdR, ddR); streak = t.R < 0 ? streak + 1 : 0; maxStreak = Math.max(maxStreak, streak); }
  // the halt rule is a drawdown from the account's best point (state.totalR / state.peakR); fall back to the trade list for old state files
  if (state.totalR != null) { eqR = state.totalR; pkR = Math.max(state.peakR || 0, eqR); ddR = pkR - eqR; maxDdR = Math.max(maxDdR, ddR); }
  const wins = trades.filter((t) => t.R > 0).length;
  const balance = state.balance ?? CFG.startBalance;

  // ---------------- health checks ----------------
  const H = [], add = (level, name, detail) => H.push({ level, name, detail });
  const lastRun = runs[runs.length - 1], lastRunAt = lastRun ? Date.parse(lastRun.ts) : null;
  const procAlive = pidf && alive(pidf.pid);
  // the next scheduled run is 30s after the first 4h close following the last run; allow 10 min of grace
  const dueAt = lastRunAt ? (Math.floor(lastRunAt / 1000 / IV) + 1) * IV * 1000 + 30000 : null;
  if (state.mode && state.mode !== CFG.mode) add('bad', 'Mode', `state/ was written in ${state.mode.toUpperCase()} mode but bot-config.json says ${CFG.mode.toUpperCase()}: the bot refuses to run until state/ is renamed`);
  else add(live ? 'warn' : 'ok', 'Mode', live ? 'LIVE: real orders on MEXC' : 'PAPER: no orders are sent');
  for (const p of pending) add('warn', `${p.coin} unfinished order`, `order ${p.oid} sent but not confirmed yet; the bot resolves it on the next run`);
  if (procAlive) add('ok', 'Bot process', `running (pid ${pidf.pid}) since ${pidf.startedAt}`);
  else if (pidf) add('bad', 'Bot process', `not running: pid ${pidf.pid} from ${pidf.startedAt} is gone (crashed, closed, or VPS restarted). Start start-lucidyo.cmd`);
  else if (lastRunAt && now < dueAt + 600000) add('warn', 'Bot process', 'no loop process found, but runs are on time (Task Scheduler with `once`?)');
  else add('bad', 'Bot process', lastRun ? 'not running. Start start-lucidyo.cmd' : 'the bot has never run on this machine. Start start-lucidyo.cmd');
  if (lastRun) {
    const late = now - dueAt;
    add(late > 600000 ? 'bad' : 'ok', 'Schedule', late > 600000 ? `MISSED a run: one was due ${Math.round(late / 60000)} min ago (last run ${lastRun.ts})` : `last run ${Math.round((now - lastRunAt) / 60000)} min ago · next at ${state.nextWakeAt || new Date(dueAt).toISOString()}`);
    add(lastRun.errors.length ? 'bad' : 'ok', 'Last run errors', lastRun.errors.length ? lastRun.errors.join(' · ') : 'none');
    add(lastRun.warnings.length ? 'warn' : 'ok', 'Last run warnings', lastRun.warnings.length ? lastRun.warnings.join(' · ') : 'none');
    const lags = Object.entries(lastRun.coins || {}).filter(([, c]) => c.lagSec != null);
    const slow = lags.filter(([, c]) => c.lagSec > CFG.maxEntryDelaySec);
    add(slow.length ? 'warn' : 'ok', 'Reaction time', lags.map(([k, c]) => `${k} checked ${c.lagSec}s after candle close`).join(' · ') + (slow.length ? ` — over ${CFG.maxEntryDelaySec}s, a new signal would be skipped` : ''));
    add(lastRun.durationMs > 30000 ? 'warn' : 'ok', 'Execution time', `last run ${lastRun.durationMs} ms` + (lastRun.durationMs > 30000 ? ' (slow: MEXC or network trouble?)' : ''));
  }
  const day = now - 86400000, recent = events.filter((e) => Date.parse(e.ts) > day);
  const err24 = recent.filter((e) => e.type === 'error'), warn24 = recent.filter((e) => e.type === 'warn'), skip = events.filter((e) => e.type === 'skip');
  add(err24.length ? 'warn' : 'ok', 'Errors (24h)', err24.length ? `${err24.length}: ${err24.slice(-3).map((e) => e.msg).join(' · ')}` : 'none');
  if (warn24.length) add('warn', 'Warnings (24h)', `${warn24.length}: ${warn24.slice(-3).map((e) => e.msg).join(' · ')}`);
  add(skip.length ? 'warn' : 'ok', 'Skipped signals', skip.length ? `${skip.length} total, last: ${skip[skip.length - 1].msg}` : 'none (every signal was taken)');
  // drift uses the ping's receive time, not now: the ping is cached for 30 s
  if (ping.ok) { const drift = Math.round(ping.at - ping.ms / 2 - ping.data); add(Math.abs(drift) > 10000 ? 'bad' : Math.abs(drift) > 2000 ? 'warn' : 'ok', 'VPS clock', `${drift >= 0 ? '+' : ''}${drift} ms vs MEXC · MEXC ping ${ping.ms} ms`); }
  else add('bad', 'MEXC reachable', ping.error);
  for (const c of CFG.coins) if (!tickers[CFG.coins.indexOf(c)].ok) add('warn', `${c} price`, tickers[CFG.coins.indexOf(c)].error);
  if (fs.existsSync(path.join(DIR, 'STOP'))) add('warn', 'Kill switch', 'STOP file present: no new entries');
  const haltR = Math.abs(CFG.haltAtR);
  add(ddR >= haltR ? 'bad' : ddR >= haltR * 0.5 ? 'warn' : 'ok', 'Drawdown', ddR >= haltR ? `HALTED: ${ddR.toFixed(1)}R below the best point (limit ${haltR}R), no new entries` : `${ddR.toFixed(1)}R below the best point (halts at ${haltR}R)`);
  for (const o of open) if (o.barsHeld > 49) add('bad', `${o.coin} position`, `open ${o.barsHeld} candles: the 48-candle time exit did not happen`);
  if (!mexc.hasKeys()) add(live ? 'bad' : 'warn', 'MEXC API key', live ? 'not set: LIVE mode cannot trade without mexc-keys.json' : 'not set: capital below is PAPER only. Add mexc-keys.json to see the real balance');
  else if (!account.ok) add('bad', 'MEXC account', account.error);
  else add('ok', 'MEXC account', `read in ${account.ms} ms`);
  if (positions && positions.ok) {
    const mex = positions.data.map((p) => p.symbol.replace('_USDT', '') + ' ' + p.side).sort().join(', ');
    const bot = open.map((o) => o.coin + ' ' + (o.dir === 1 ? 'LONG' : 'SHORT')).sort().join(', ');
    if (mex !== bot) add(live ? 'bad' : 'warn', 'Positions match', `MEXC: ${mex || 'none'} · bot: ${bot || 'none'}` + (live ? ' — the bot and the exchange disagree, check MEXC now' : ' (paper mode: the bot does not place orders)'));
    else add('ok', 'Positions match', mex || 'both flat');
  }
  if (live && !CFG.heartbeatUrl) add('warn', 'Outside alert', 'no heartbeatUrl in bot-config.json: if the VPS or bot dies, nothing alerts you except this page');
  if (CFG.riskPct > 0.03) add('warn', 'Risk setting', `riskPct ${CFG.riskPct * 100}% is above the 1–2% recommended in the risk report (expect drawdowns over 50%)`);

  // execution-time stats over recorded runs
  const dur = runs.map((r) => r.durationMs).filter((v) => v != null);
  const fetchMs = runs.flatMap((r) => Object.values(r.coins || {}).map((c) => c.fetchMs)).filter((v) => v != null);
  const avg = (a) => (a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : null);
  const entryDelays = trades.map((t) => t.entryDelaySec).concat(open.map((o) => o.entryDelaySec)).filter((v) => v != null);

  return {
    now: new Date(now).toISOString(), mode: live ? 'LIVE' : 'PAPER', coins: CFG.coins, pending,
    config: { riskPct: CFG.riskPct, riskUsd: CFG.riskUsd, maxRiskUsd: CFG.maxRiskUsd, startBalance: CFG.startBalance, haltAtR: CFG.haltAtR, maxEntryDelaySec: CFG.maxEntryDelaySec },
    capital: {
      paper: { balance, start: CFG.startBalance, pnl: balance - CFG.startBalance, nextRisk: riskFor({ ...state, balance }), unrealized: open.reduce((s, o) => s + (o.uUsd || 0), 0) },
      mexc: !mexc.hasKeys() ? null : account.ok ? account.data : { error: account.error },
      mexcPositions: positions && positions.ok ? positions.data : null,
      history: runs.filter((r) => r.account).map((r) => ({ ts: r.ts, equity: r.account.equity })),
    },
    stats: { trades: trades.length, wins, realizedR, ddR, maxDdR, streak, maxStreak },
    open, trades: trades.slice(-50).reverse(), price,
    health: H,
    timing: { runs: runs.length, avgRunMs: avg(dur), maxRunMs: dur.length ? Math.max(...dur) : null, avgFetchMs: avg(fetchMs), maxFetchMs: fetchMs.length ? Math.max(...fetchMs) : null, avgEntryDelaySec: avg(entryDelays), maxEntryDelaySec: entryDelays.length ? Math.max(...entryDelays) : null },
    runs: runs.slice(-30).reverse(),
    log: logLines,
  };
}

// ---------------- Settings (write) ----------------
// Only this page may change settings: the Host must be this dashboard (blocks DNS rebinding), POSTs need our custom header (a page on
// another site cannot send it without a CORS preflight, which we never answer) and, if present, our own Origin.
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const sameSite = (req) => HOSTS.has(req.headers.host) && (!req.headers.origin || HOSTS.has(req.headers.origin.replace(/^http:\/\//, '')));
const writeAllowed = (req) => sameSite(req) && req.headers['x-lucidyo'] === '1' && /^application\/json/.test(req.headers['content-type'] || '');
function readBody(req) {
  return new Promise((ok, bad) => { let b = ''; req.on('data', (d) => { b += d; if (b.length > 10000) { bad(new Error('too large')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { bad(new Error('bad JSON')); } }); });
}
function keyInfo() {   // true/false only: key contents never leave this process
  let k = {}; try { k = JSON.parse(fs.readFileSync(path.join(DIR, 'mexc-keys.json'), 'utf8')); } catch {}
  return { mexcApiKey: mexc.hasKeys(), telegram: !!(k.telegramToken && k.telegramChatId) };
}
function audit(msg) {   // same files the bot writes, so the change shows in the terminal panel and the events list
  const ts = new Date().toISOString();
  try {
    fs.mkdirSync(ST, { recursive: true });
    fs.appendFileSync(path.join(ST, 'events.jsonl'), JSON.stringify({ ts, type: 'info', coin: 'SETTINGS', msg }) + '\n');
    fs.appendFileSync(path.join(ST, 'bot.log'), `[${ts}] SETTINGS ${msg}\n`);
  } catch {}
}
const fmt = (k, v) => (k === 'riskPct' ? `${+(v * 100).toFixed(2)}%` : Array.isArray(v) ? v.join('+') : v === '' ? '(empty)' : String(v));
function configPayload() {
  const st = readJson('state.json', {});
  return { config: config.load(), fields: config.FIELDS, keys: keyInfo(), killSwitch: fs.existsSync(path.join(DIR, 'STOP')), stateMode: st.mode || null,
    balance: st.balance ?? config.load().startBalance };
}
async function postConfig(req) {
  const body = await readBody(req), patch = body.patch || {}, cur = config.load();
  const v = config.validate(patch, cur);
  if (!v.ok) return [400, { ok: false, errors: v.errors }];
  if (v.next.mode === 'live' && cur.mode !== 'live') {
    if (body.confirm !== 'LIVE') return [400, { ok: false, errors: { mode: 'type LIVE to confirm real-money trading' } }];
    if (!mexc.hasKeys()) return [400, { ok: false, errors: { mode: 'add mexc-keys.json (with Order Placing permission) first' } }];
  }
  const changes = config.save(v.next);
  Object.assign(CFG, config.load());
  if (changes.length) audit(`changed from the dashboard: ${changes.map((c) => `${c.k} ${fmt(c.k, c.from)} → ${fmt(c.k, c.to)}`).join(', ')} (applies at the next 4h run)`);
  return [200, { ok: true, changes, ...configPayload() }];
}
async function postStop(req) {
  const body = await readBody(req), f = path.join(DIR, 'STOP'), was = fs.existsSync(f);
  if (body.on && !was) { fs.writeFileSync(f, `kill switch turned on from the dashboard ${new Date().toISOString()}\n`); audit('kill switch ON: no new entries (open trades keep their stop / target)'); }
  if (!body.on && was) { fs.unlinkSync(f); audit('kill switch OFF: new entries allowed again'); }
  return [200, { ok: true, ...configPayload() }];
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  try {
    if (!HOSTS.has(req.headers.host)) { res.writeHead(403); return res.end('forbidden host'); }
    if (req.url === '/api/config' && req.method === 'GET') return json(res, 200, configPayload());
    if ((req.url === '/api/config' || req.url === '/api/stop') && req.method === 'POST') {
      if (!writeAllowed(req)) return json(res, 403, { ok: false, errors: { _: 'refused: settings can only be changed from this dashboard page' } });
      const [code, out] = req.url === '/api/config' ? await postConfig(req) : await postStop(req);
      return json(res, code, out);
    }
    if (req.url === '/' || req.url === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(fs.readFileSync(path.join(DIR, 'dashboard.html'))); }
    if (req.url === '/api/status') { const s = await status(); res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(s)); }
    res.writeHead(404); res.end('not found');
  } catch (e) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('dashboard error: ' + e.message); }
});
const openBrowser = () => { if (process.env.LUCIDYO_DASH_NO_OPEN) return; const cmd = process.platform === 'win32' ? `start "" "${URL}"` : process.platform === 'darwin' ? `open ${URL}` : `xdg-open ${URL}`; exec(cmd); };
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.log(`Dashboard already running at ${URL}, opening it.`); openBrowser(); setTimeout(() => process.exit(0), 500); }
  else { console.error(e); process.exit(1); }
});
server.listen(PORT, '127.0.0.1', () => { console.log(`Lucidyo dashboard: ${URL}\nClose this window to stop the dashboard (the bot keeps running).`); openBrowser(); });
