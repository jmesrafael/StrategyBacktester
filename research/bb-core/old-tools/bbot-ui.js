// bbot-ui.js — tiny local settings page for BBOT: change the MEXC access/secret key, test the connection, see bot status.
//   node bbot-ui.js        then open http://127.0.0.1:8138   (start-bbot.cmd does both)
// Listens on 127.0.0.1 only. The secret is written to .env and never sent back to the browser.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { execFile } = require('child_process');
const DIR = __dirname, ENV = path.join(DIR, '.env'), PORT = 8138;

const readEnv = () => { const o = {}; try { for (const l of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) o[m[1]] = m[2]; } } catch {} return o; };
function writeEnv(upd) {
  const keep = []; try { for (const l of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) if (l.trim() && !/^\s*MEXC_API_(KEY|SECRET)\s*=/.test(l)) keep.push(l); } catch {}
  fs.writeFileSync(ENV, [...keep, `MEXC_API_KEY=${upd.key}`, `MEXC_API_SECRET=${upd.secret}`].join('\n') + '\n');
}
const run = (args) => new Promise((res) => execFile(process.execPath, args, { cwd: DIR, timeout: 30000 }, (e, so, se) => res((so || '') + (se || '') || String(e || ''))));
const mask = (s) => (s ? s.slice(0, 6) + '…' + s.slice(-3) : '');

const PAGE = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>BBOT settings</title>
<style>:root{color-scheme:dark light}body{font:15px system-ui;max-width:640px;margin:32px auto;padding:0 16px}h1{font-size:20px}label{display:block;margin:14px 0 4px;font-weight:600}
input{width:100%;box-sizing:border-box;padding:9px;font:14px ui-monospace,monospace;border-radius:6px;border:1px solid #888}button{padding:9px 16px;margin:14px 8px 0 0;border-radius:6px;border:0;background:#2962ff;color:#fff;font-size:14px;cursor:pointer}
button.alt{background:#555}pre{background:#1118;padding:12px;border-radius:6px;white-space:pre-wrap;font-size:13px}small{opacity:.7}</style>
<h1>BBOT — MEXC API settings</h1>
<small>Saved to <b>.env</b> on this PC only. Use a futures key with View Account Details + View Order Details + Order Placing, no withdraw. Restart the bot after changing keys.</small>
<label>Access Key</label><input id=k autocomplete=off placeholder="mx0…">
<label>Secret Key</label><input id=s type=password autocomplete=off placeholder="leave empty to keep the saved secret">
<div><button onclick=save()>Save</button><button class=alt onclick=test()>Test connection (read-only)</button><button class=alt onclick=stat()>Bot status</button></div>
<pre id=o>loading…</pre>
<script>
const o=document.getElementById('o'),api=(p,b)=>fetch(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})}).then(r=>r.json());
async function load(){const r=await fetch('/api/current').then(r=>r.json());k.value=r.key;o.textContent=r.key?'Saved key: '+r.key+'   secret: '+(r.hasSecret?'saved':'MISSING'):'No key saved yet.'}
async function save(){const r=await api('/api/save',{key:k.value.trim(),secret:s.value.trim()});o.textContent=r.msg;s.value='';if(r.ok)load()}
async function test(){o.textContent='testing…';o.textContent=(await api('/api/test')).out}
async function stat(){o.textContent='…';o.textContent=(await api('/api/status')).out}
load()</script>`;

http.createServer(async (req, res) => {
  const host = req.headers.host || '', origin = req.headers.origin;
  const local = /^(127\.0\.0\.1|localhost):8138$/.test(host) && (!origin || /^http:\/\/(127\.0\.0\.1|localhost):8138$/.test(origin));
  if (!local) { res.writeHead(403); return res.end('forbidden'); }
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'GET' && req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  if (req.method === 'GET' && req.url === '/api/current') { const e = readEnv(); return json({ key: mask(e.MEXC_API_KEY), hasSecret: !!e.MEXC_API_SECRET }); }
  if (req.method !== 'POST') { res.writeHead(404); return res.end(); }
  let body = ''; for await (const c of req) body += c;
  let b = {}; try { b = JSON.parse(body || '{}'); } catch {}
  if (req.url === '/api/save') {
    const e = readEnv(), cur = e.MEXC_API_KEY || '';
    const key = !b.key || b.key === mask(cur) ? cur : b.key, secret = b.secret || e.MEXC_API_SECRET || '';
    if (!/^[\w-]{8,}$/.test(key) || !/^[\w-]{8,}$/.test(secret)) return json({ ok: false, msg: 'Enter both keys (letters/digits only). Secret may be left empty only if one is already saved.' });
    writeEnv({ key, secret }); return json({ ok: true, msg: 'Saved. Run "Test connection" next. Restart the bot (close and reopen start-bbot.cmd) so it picks up the new key.' });
  }
  if (req.url === '/api/test') return json({ out: await run(['mexc-live.js', 'check']) });
  if (req.url === '/api/status') return json({ out: await run(['bbot.js', 'status']) });
  res.writeHead(404); res.end();
}).listen(PORT, '127.0.0.1', () => console.log(`BBOT settings: http://127.0.0.1:${PORT}`));
