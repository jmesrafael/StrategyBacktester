// ema-bestyear.js — which coin made the most R each calendar year with EMA 20/100 (same scan as ema-scan.js). node ema-bestyear.js
'use strict';
const fs = require('fs'), path = require('path');
const { runStrat } = require('./contenders.js'); const { DEFAULTS } = require('./v2-core.js');
const D4 = path.join(__dirname, '..', 'bollinger', 'data4h'), FUND = path.join(__dirname, '..', 'bollinger', 'datafund'), BTC = path.join(__dirname, '..', 'bb-core', 'data-other-coins', 'BTC.json');
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const MAIN = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], END = Date.UTC(2026, 8, 25) / 1000, f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1);
const coins = fs.readdirSync(D4).filter((f) => f.endsWith('.json') && !f.startsWith('MEXC_')).map((f) => f.slice(0, -5)); if (!coins.includes('BTC')) coins.push('BTC');
const Y = {};   // year -> [{c, R, n, liquid, main}]
for (const c of coins) {
  const rows = c === 'BTC' && !fs.existsSync(path.join(D4, 'BTC.json')) ? rd(BTC) : rd(path.join(D4, c + '.json')); if (!rows || rows.length < 1200) continue;
  const B = rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })); if (B[B.length - 1].time < END) continue;
  const t = runStrat(B, 'ema20/100', DEFAULTS.cost, rd(path.join(FUND, c + '.json'))).trades, vol = B.slice(-540).reduce((a, b) => a + b.close * b.volume, 0) / 90, ys = {};
  for (const x of t) { const y = new Date(x.tExit * 1000).getUTCFullYear(); (ys[y] ||= { R: 0, n: 0, best: -9 }); ys[y].R += x.R; ys[y].n++; ys[y].best = Math.max(ys[y].best, x.R); }
  for (const [y, o] of Object.entries(ys)) (Y[y] ||= []).push({ c, ...o, liquid: vol >= 30e6, main: MAIN.includes(c) });
}
const show = (a) => a.map((r) => `${r.c} ${f1(r.R)}`).join(', ');
console.log('# Biggest EMA 20/100 return each year (R, Binance 4h, 156 coins still trading; liquid = ≥ $30M/day)\n');
console.log('| year | coins with data | #1 of all | #1 liquid | top 3 liquid | best of our 5 | median coin |\n|---|---|---|---|---|---|---|');
for (const y of Object.keys(Y).sort()) {
  const a = [...Y[y]].sort((p, q) => q.R - p.R), l = a.filter((r) => r.liquid), m = a.filter((r) => r.main), med = [...a].map((r) => r.R).sort((p, q) => p - q)[Math.floor(a.length / 2)];
  console.log(`| ${y}${y === '2026' ? ' (to Oct)' : ''} | ${a.length} | ${a[0].c} ${f1(a[0].R)}${a[0].liquid ? '' : ' (illiquid)'} | **${l[0] ? l[0].c + ' ' + f1(l[0].R) : '–'}** | ${show(l.slice(0, 3)) || '–'} | ${m[0] ? m[0].c + ' ' + f1(m[0].R) : '–'} | ${f1(med)} |`);
}
console.log('\nWho keeps showing up in the liquid top 5 each year:');
const cnt = {}; for (const y of Object.keys(Y)) [...Y[y]].filter((r) => r.liquid).sort((p, q) => q.R - p.R).slice(0, 5).forEach((r) => (cnt[r.c] = (cnt[r.c] || 0) + 1));
console.log(Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => `${c} ${n}×`).join(', '));
console.log('\nSingle-year winners are mostly one huge trade: biggest single trade of the #1 liquid coin each year —');
for (const y of Object.keys(Y).sort()) { const l = [...Y[y]].filter((r) => r.liquid).sort((p, q) => q.R - p.R)[0]; if (l) console.log(`${y}: ${l.c} total ${f1(l.R)}R of which best trade ${f1(l.best)}R (${l.n} trades)`); }
