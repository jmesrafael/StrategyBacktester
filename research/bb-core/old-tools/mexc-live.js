// mexc-live.js — signed MEXC USDT-M futures client + connection tests. Keys come from .env (never committed) or the environment.
//
//   node mexc-live.js check            READ-ONLY: auth works? futures balance, open positions, SOL/ZEC contract info + min order size
//   node mexc-live.js smoke SOL --yes  REAL ORDERS: opens the minimum size (1 contract) with a stop + take-profit, then closes it at market
//
// .env (next to this file):   MEXC_API_KEY=...   MEXC_API_SECRET=...
// Docs: https://mexcdevelop.github.io/apidocs/contract_v1_en/   (sign = HMAC-SHA256 hex of accessKey + timestamp + paramString)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

try { for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); } } catch {}
const KEY = process.env.MEXC_API_KEY, SECRET = process.env.MEXC_API_SECRET, BASE = 'https://contract.mexc.com';

async function call(method, endpoint, params = {}, signed = true) {
  const ts = Date.now().toString(), headers = { 'Content-Type': 'application/json' };
  let url = BASE + endpoint, body;
  if (method === 'GET') {
    const qs = Object.keys(params).sort().map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
    if (qs) url += '?' + qs;
    if (signed) { headers.ApiKey = KEY; headers['Request-Time'] = ts; headers.Signature = sign(KEY + ts + qs); }
  } else {
    body = JSON.stringify(params);
    headers.ApiKey = KEY; headers['Request-Time'] = ts; headers.Signature = sign(KEY + ts + body);
  }
  const r = await fetch(url, { method, headers, body });
  const text = await r.text();
  try { return JSON.parse(text); } catch { throw new Error(`${method} ${endpoint} -> HTTP ${r.status}: ${text.slice(0, 200)}`); }
}
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const need = () => { if (!KEY || !SECRET) { console.error('Missing MEXC_API_KEY / MEXC_API_SECRET. Put them in .env next to this file (it is gitignored).'); process.exit(1); } };
const ok = (j) => j && j.success === true;
const show = (j) => JSON.stringify(j).slice(0, 300);

async function contract(coin) {
  const j = await call('GET', '/api/v1/contract/detail', { symbol: coin + '_USDT' }, false);
  if (!ok(j)) throw new Error('contract detail: ' + show(j));
  return j.data;
}

async function check() {
  need();
  console.log(`key ${KEY.slice(0, 6)}… loaded\n`);
  const a = await call('GET', '/api/v1/private/account/asset/USDT');
  if (ok(a)) console.log(`AUTH OK · futures USDT: equity ${a.data.equity}, available ${a.data.availableBalance}, positionMargin ${a.data.positionMargin}`);
  else { console.log('AUTH / ACCOUNT FAILED:', show(a), '\n  (2xxx errors: wrong key/secret or IP not allowed; check the key has Futures "View Account Details")'); return; }
  const p = await call('GET', '/api/v1/private/position/open_positions');
  console.log(ok(p) ? `open positions: ${p.data.length ? p.data.map((x) => `${x.symbol} ${x.positionType === 1 ? 'LONG' : 'SHORT'} vol ${x.holdVol}`).join(', ') : 'none'}` : 'open_positions FAILED: ' + show(p));
  for (const coin of ['SOL', 'ZEC']) {
    const c = await contract(coin), tk = await call('GET', '/api/v1/contract/ticker', { symbol: coin + '_USDT' }, false);
    const px = ok(tk) ? tk.data.lastPrice : NaN;
    console.log(`${coin}_USDT: apiAllowed ${c.apiAllowed} · 1 contract = ${c.contractSize} ${coin} ≈ $${(c.contractSize * px).toFixed(2)} · min ${c.minVol} step ${c.volUnit} · max leverage ${c.maxLeverage}x`);
  }
  console.log('\nRead-only check done. Order permission is only proven by `smoke` (real minimum-size orders).');
}

async function smoke(coin, yes) {
  need();
  if (!yes) { console.log('This places REAL orders (1 contract, opened then closed at market). Re-run with --yes to confirm.'); return; }
  const sym = coin + '_USDT', c = await contract(coin);
  if (!c.apiAllowed) throw new Error(sym + ' has apiAllowed=false');
  const tk = await call('GET', '/api/v1/contract/ticker', { symbol: sym }, false), px = +tk.data.lastPrice;
  const lev = 5, r = (v) => +(Math.round(v / c.priceUnit) * c.priceUnit).toFixed(c.priceScale);
  const sl = r(px * 0.97), tp = r(px * 1.12);
  console.log(`${sym} last ${px} · opening LONG ${c.minVol} contract (${c.contractSize} ${coin}) isolated ${lev}x, stop ${sl}, tp ${tp}`);
  const o = await call('POST', '/api/v1/private/order/submit', { symbol: sym, price: px, vol: c.minVol, leverage: lev, side: 1, type: 5, openType: 1, stopLossPrice: sl, takeProfitPrice: tp, externalOid: 'smoke' + Date.now() });
  console.log('open order:', show(o));
  if (!ok(o)) { console.log('\nOrder REJECTED — placement is not available on this key/account (see the message above). Nothing was opened.'); return; }
  await new Promise((r2) => setTimeout(r2, 1500));
  const p = await call('GET', '/api/v1/private/position/open_positions', { symbol: sym });
  const pos = ok(p) && p.data.find((x) => x.positionType === 1);
  if (!pos) { console.log('position not found after order — check the MEXC app manually. open_positions:', show(p)); return; }
  console.log(`position ${pos.positionId}: vol ${pos.holdVol} avg ${pos.holdAvgPrice} · closing at market`);
  const x = await call('POST', '/api/v1/private/order/submit', { symbol: sym, price: px, vol: pos.holdVol, side: 4, type: 5, openType: 1, positionId: pos.positionId });
  console.log('close order:', show(x));
  console.log(ok(x) ? 'DONE — verify in the MEXC app that the position is flat and the stop/TP are gone.' : 'CLOSE FAILED — close the position manually in the MEXC app NOW.');
}

const [cmd, a1, a2] = process.argv.slice(2);
(cmd === 'check' ? check() : cmd === 'smoke' ? smoke((a1 || 'SOL').toUpperCase(), a2 === '--yes') : Promise.resolve(console.log('usage: node mexc-live.js check | smoke SOL --yes')))
  .catch((e) => { console.error('ERROR', e.message); process.exit(1); });
