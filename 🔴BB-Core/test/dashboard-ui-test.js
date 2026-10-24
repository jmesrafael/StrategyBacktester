// test/dashboard-ui-test.js - the bot dashboard page in a REAL browser (headless Chrome): the five tabs (Overview, Status, Trades, Log, Verify), which panels each one shows,
// the "bot / right now" summary, the badges, the address bar (#status), the keys, a stale bot, and a phone-width window.
// A tiny local server serves dashboard/bot-dashboard/* and answers /api/data with the REAL aggregate() on synthetic events; nothing leaves this machine.
//   node test/dashboard-ui-test.js      needs Chrome (found automatically); skipped with a message when there is none. SHOT_DIR=some/folder saves screenshots.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), cp = require('child_process');
const { aggregate } = require('../dashboard/lib/aggregate.js');
const ROOT = path.join(__dirname, '..', 'dashboard', 'bot-dashboard');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
if (!chrome || typeof WebSocket === 'undefined') { console.log('SKIP  no Chrome (or no global WebSocket) on this machine: the dashboard page cannot be driven here'); process.exit(0); }
let pass = 0, failN = 0;
const ok = (c, w, x = '') => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}${!c && x ? '  -> ' + x : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- synthetic data: a closed SOL trade, an open ZEC SHORT, a skipped signal, a comparison, heartbeats
const now = Date.now(), H = 3600000;
const ev = (id, type, t, symbol, side, data, mode = 'paper') => ({ event_id: id, type, ts_ms: t, mode, symbol, side, data });
const events = [
  ev('e1', 'entry', now - 30 * H, 'SOL_USDT', 'LONG', { trade_id: 'SOL_USDT|LONG|1', entry: 100, sl: 95, tp: 120, risk_pct: 0.01, balance_used: 100, risk_usd: 1 }),
  ev('x1', 'exit', now - 20 * H, 'SOL_USDT', 'LONG', { trade_id: 'SOL_USDT|LONG|1', exit: 105, entry: 100, reason: 'target', r: 1.5, usd: 1.5, balance_after: 101.5, hold_sec: 36000 }),
  ev('e2', 'entry', now - 6 * H, 'ZEC_USDT', 'SHORT', { trade_id: 'ZEC_USDT|SHORT|2', entry: 50, sl: 52, tp: 42, risk_pct: 0.01, balance_used: 101.5, risk_usd: 1 }),
  ev('s1', 'signal', now - 10 * H, 'SOL_USDT', 'SHORT', { decision: 'skipped', reason: 'late_entry', detail: '12 min after the open', signal_candle_open_ms: now - 11 * H, trade_id: 'SOL_USDT|SHORT|3' }),
  ev('q1', 'equity', now - 2 * H, null, null, { total_r: 1.5, peak_r: 1.5, drawdown_r: 0, trades: 1, candle_ms: now - 2 * H, paper_balance: 101.5 }),
  ev('c1', 'compare', now - 5 * H, null, null, { match: true, matched: 1, live_only: 0, backtest_only: 0, skipped_signals: 1, candle_diffs: 0, tolerance_r: 0.05, window_from_ms: now - 40 * H, window_to_ms: now - 5 * H, mismatches: [] }),
];
const hb = (ageMs) => ({ event_id: 'hb', type: 'heartbeat', ts_ms: now - ageMs, mode: 'paper', data: { status: 'running', last_candle_ms: { SOL_USDT: now - 2 * H, ZEC_USDT: now - 2 * H }, kill_switch: false, drawdown_r: 1.2, halt_r: -39, commit: 'abc1234def', version: '1.1.0',
  uptime_sec: 7200, next_wake_ms: now + 1.7 * H, prices: { ZEC_USDT: { px: 48, candle_ms: now - 2 * H } }, enabled_coins: ['SOL', 'ZEC'] } });
const beats = Array.from({ length: 40 }, (_, i) => ({ ts_ms: now - (40 - i) * 5 * 60000, mode: 'paper', uptime: 7200 + i * 300 }));
let heartbeatAge = 2 * 60000;
const VPS = { as_of: '2026-10-23', provider: 'Webdock', location: 'Denmark', os: 'Ubuntu 24.04.5 LTS', kernel: '6.8.0', arch: 'x86_64', cpu: { model: 'Intel Xeon', clock: '2.10 GHz', vcpu: 1 }, ram: { total_gb: 1.6, used_gb: 0.34 }, disk: { total_gb: 15, used_gb: 2.4, used_pct: 17, mount: '/' }, booted: '2026-10-23T11:14:05Z', bot_limits: { soft: '300 MB', hard: '450 MB' } };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/data') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(aggregate({ events, heartbeat: hb(heartbeatAge), beats, now: Date.now(), mode: null }))); }
  if (u.pathname === '/api/vps') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(VPS)); }
  const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname.replace(/^\//, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}/`;
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-ui-')), port = 9340 + Math.floor(Math.random() * 50);
  const proc = cp.spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1280,1000', '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  let targets; for (let i = 0; i < 80; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch {} await sleep(250); }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(), errors = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev_ = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  const waitFor = async (expr, what, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev_(expr)) return true; } catch {} await sleep(120); } throw new Error('timed out waiting for ' + what); };
  const shot = async (name) => { if (!process.env.SHOT_DIR) return; fs.mkdirSync(process.env.SHOT_DIR, { recursive: true }); const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(process.env.SHOT_DIR, name + '.png'), Buffer.from(r.result.data, 'base64')); };
  const visible = (sel) => ev_(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && !e.hidden && e.offsetParent !== null; })()`);
  const shown = async () => { const out = []; for (const p of ['pKpis', 'pNow', 'pSystem', 'pServer', 'pChart', 'pOpen', 'pActivity', 'pCompare', 'pTrades', 'pCoin', 'pSkipped']) if (await visible('#' + p)) out.push(p); return out.join(','); };
  const open = async (url) => { await send('Page.navigate', { url: 'about:blank' }); await sleep(100); await send('Page.navigate', { url }); /* a real load each time: changing only the # would not reload the page */ await waitFor(`!!document.querySelector('#app') && !document.querySelector('#app').hidden && !!document.querySelector('#mainTabs button.on')`, 'the dashboard to load'); };
  try {
    await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await ev_(`localStorage.clear()`).catch(() => {}); await open(base);
    ok((await ev_(`[...document.querySelectorAll('#mainTabs button')].map((b) => b.dataset.tab).join(',')`)) === 'overview,status,trades,log,verify', 'five tabs: Overview, Status, Trades, Log, Verify');
    ok((await ev_(`document.querySelector('#mainTabs button.on').dataset.tab`)) === 'overview' && (await shown()) === 'pKpis,pChart,pOpen', 'first visit: Overview, showing the headline numbers, the curve and the open positions', await shown());
    await shot('1-overview');
    // ---- Status
    await ev_(`document.querySelector('#mainTabs [data-tab=status]').click()`);
    ok((await shown()) === 'pNow,pSystem,pServer', 'Status tab: "bot / right now", system / health and server / specs (nothing else)', await shown());
    await waitFor(`document.querySelector('#vpsInline').innerText.includes('Webdock')`, 'the server specs');
    const now_ = await ev_(`document.querySelector('#nowText').innerText`), tiles = await ev_(`[...document.querySelectorAll('#nowTiles .tile')].map((t) => t.innerText.replace(/\\n+/g, ' | '))`);
    ok(/The bot is online in PAPER mode\. It last reported 2m ago and will look at the market again at (\w{3} \d{1,2}, \d{4} )?\d{1,2}:\d\d[ap]m UTC \(in /.test(now_) && /1 position is open \(ZEC SHORT\)/.test(now_) && /1 closed trade, \+1\.50R in total/.test(now_), 'the summary says it in plain words', now_);
    ok(tiles.length === 9 && tiles.some((t) => /^STATE \| ONLINE/.test(t)) && tiles.some((t) => /^OPEN NOW \| 1 open \| ZEC SHORT/i.test(t)) && tiles.some((t) => /^DRAWDOWN VS HALT \| 1\.2R \/ 39R/i.test(t)) && tiles.some((t) => /^KILL SWITCH \| off/i.test(t)) && tiles.some((t) => /LAST SKIPPED SIGNAL \| SOL SHORT \| late_entry/i.test(t)), '9 tiles: state, mode, next check, last candle, open now, closed trades, drawdown, kill switch, last skipped signal', JSON.stringify(tiles));
    const times = tiles.filter((t) => /^(NEXT CHECK|LAST CANDLE)/i.test(t)).join(' ');
    ok(/\d{1,2}:\d\d(am|pm)/.test(times) && !/(^|[^\d])(1[3-9]|2[0-3]):\d\d(?![ap]m)/.test(times), 'times are 12-hour (3:56am), never 24-hour', times);
    ok((await ev_(`document.querySelector('#tbDot').className`)) === 'tb-dot ok', 'the Status tab shows a green dot while the bot is online');
    await shot('2-status');
    // ---- Trades
    await ev_(`document.querySelector('#mainTabs [data-tab=trades]').click()`);
    ok((await shown()) === 'pOpen,pTrades,pCoin' && (await ev_(`document.querySelectorAll('#trades tbody tr').length`)) === 1 && (await ev_(`document.querySelector('#open').innerText`)).includes('ZEC'), 'Trades tab: open positions, trade history (1 trade) and per-coin stats', await shown());
    ok(/Trades\s*2/.test(await ev_(`document.querySelector('#mainTabs [data-tab=trades]').innerText`)), 'the Trades tab shows a count (1 closed + 1 open = 2)');
    await shot('3-trades');
    // ---- Log
    await ev_(`document.querySelector('#mainTabs [data-tab=log]').click()`);
    ok((await shown()) === 'pActivity,pSkipped' && /ENTRY|EXIT|SKIP/i.test(await ev_(`document.querySelector('#activity').innerText`)), 'Log tab: the activity log (entries, exits, skips, candle checks) and the skipped signals', await shown());
    await shot('4-log');
    // ---- Verify
    await ev_(`document.querySelector('#mainTabs [data-tab=verify]').click()`);
    ok((await shown()) === 'pCompare' && /MATCH/.test(await ev_(`document.querySelector('#compare').innerText`)), 'Verify tab: live vs backtest', await shown());
    ok((await ev_(`location.hash`)) === '#verify', 'the address bar follows the tab (#verify)');
    // ---- remembering, the address, the keys
    await open(base + '#trades'); ok((await ev_(`document.querySelector('#mainTabs button.on').dataset.tab`)) === 'trades', 'opening .../#trades goes straight to Trades');
    await open(base); ok((await ev_(`document.querySelector('#mainTabs button.on').dataset.tab`)) === 'trades', 'opening with no # returns to the tab you used last');
    await ev_(`document.body.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }))`);
    ok((await ev_(`document.querySelector('#mainTabs button.on').dataset.tab`)) === 'status', 'the keys 1 to 5 switch tab (2 = Status)');
    await ev_(`const b = document.querySelector('#mainTabs button.on'); b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`);
    ok((await ev_(`document.querySelector('#mainTabs button.on').dataset.tab`)) === 'trades' && (await ev_(`document.activeElement.dataset.tab`)) === 'trades', 'arrow keys move along the tab bar');
    // ---- a stale bot
    heartbeatAge = 6 * H; await open(base + '#status');
    const stale = await ev_(`document.querySelector('#nowText').innerText`);
    ok(/The bot is not reporting\. Its last heartbeat was 6h/.test(stale) && (await ev_(`document.querySelector('#tbDot').className`)) === 'tb-dot bad' && (await ev_(`!document.querySelector('#alert').hidden`)), 'a bot that stopped reporting: red dot, the summary says so, the alert strip shows', stale);
    await shot('5-status-stale');
    // ---- a phone
    heartbeatAge = 2 * 60000; await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 2, mobile: true });
    for (const t of ['overview', 'status', 'trades', 'log', 'verify']) {
      await open(base + '#' + t); await sleep(250);
      ok(await ev_(`document.documentElement.scrollWidth <= window.innerWidth + 1`), `phone width (390 px): the ${t} tab does not scroll sideways`, await ev_(`document.documentElement.scrollWidth + ' > ' + window.innerWidth`));
    }
    await shot('6-phone-verify');
    ok(errors.length === 0, 'no page errors', errors.join(' | '));
  } catch (e) { ok(false, 'the run completed: ' + e.message); }
  finally { try { ws.close(); } catch {} proc.kill(); server.close(); console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0); }
})();
