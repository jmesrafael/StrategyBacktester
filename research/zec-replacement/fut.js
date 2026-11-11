// fut.js — same three bots on Binance USDT-M FUTURES 4h candles (what perps really traded), scored from the first candle after a 205-bar warmup.
//   node fut.js [COIN ...]
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const COINS = process.argv.slice(2).length ? process.argv.slice(2) : ['ZEC', 'ETH', 'ONE', 'BNB', 'ADA', 'DOGE', 'BTC', 'XRP', 'LINK', 'VET'];
const IV = 14400, W = { 'BB-CORE': ['BBX', 0.5], 'I-CORE': ['P7', 0.25], 'T-CORE': ['P14', 0.25] };
const j = async (u) => { for (let a = 0; a < 6; a++) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) {} await new Promise((s) => setTimeout(s, 1500 * (a + 1))); } throw new Error(u); };
async function klines(sym) {
  const f = `data4h-fut/${sym}.json`; if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const rows = []; let start = Date.UTC(2019, 8, 1); const now = Date.now();
  for (;;) { const k = await j(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=4h&startTime=${start}&limit=1500`); if (!k.length) break;
    for (const r of k) if (r[6] < now) rows.push([r[0] / 1000, +r[1], +r[2], +r[3], +r[4], +r[7]]); if (k.length < 1500) break; start = k[k.length - 1][0] + 1; }
  const out = []; for (const r of rows) { if (out.length) { const p = out[out.length - 1]; for (let t = p[0] + IV; t < r[0]; t += IV) out.push([t, p[4], p[4], p[4], p[4], 0]); } out.push(r); }
  fs.writeFileSync(f, JSON.stringify(out)); return out;
}
(async () => {
  console.log('coin  first      scored-from  years  TRI total  DD    BB/IC/TC avgR          TRI by year (2020..2026)                yrs+  BB/IC/TC yrs+');
  for (const coin of COINS) {
    const raw = await klines(coin + 'USDT'), B = raw.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
    const F = JSON.parse(fs.readFileSync(`funding/${coin}.json`, 'utf8')), c = makeCtx(B, '4h'), from = B[205].time;
    const bbc = S.find((s) => s.id === 'bb-core').build(c), built = { BBX: bbc, P7: S.find((s) => s.id === 'i-core').build(c), P14: { ...bbc, stopL: null, stopS: null } };
    const yrs = {}, by = {}, avg = {}; let all = [];
    for (const [bot, [p, w]] of Object.entries(W)) {
      const tr = run(B, c.atr14, built[p], exitOf(p, c), F, IV, COST).trades; by[bot] = {}; avg[bot] = tr.reduce((s, t) => s + t.R, 0) / tr.length;
      for (const t of tr) { let y = new Date(t.tExit * 1000).getUTCFullYear(); if (y === 2019) y = 2020; yrs[y] = (yrs[y] || 0) + t.R * w; by[bot][y] = (by[bot][y] || 0) + t.R; all.push({ tExit: t.tExit, R: t.R * w }); }
    }
    all.sort((a, b) => a.tExit - b.tExit); let eq = 0, pk = 0, dd = 0; for (const t of all) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
    const Y = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'], pos = Y.filter((y) => (yrs[y] || 0) > 0).length;
    const fy = new Date(from * 1000).toISOString().slice(0, 10), span = ((Date.now() / 1000 - from) / (365.25 * 86400)).toFixed(1);
    console.log(`${coin.padEnd(5)} ${new Date(B[0].time * 1000).toISOString().slice(0, 10)} ${fy}   ${span}   ${(eq >= 0 ? '+' : '') + eq.toFixed(1).padStart(6)}  ${dd.toFixed(1).padStart(4)}  ${Object.values(avg).map((v) => (v >= 0 ? '+' : '') + v.toFixed(2)).join('/')}   ${Y.map((y) => (yrs[y] || 0).toFixed(0).padStart(4)).join(' ')}   ${pos}/7   ${Object.values(by).map((b) => Y.filter((y) => (b[y] || 0) > 0).length).join('/')}`);
  }
})();
