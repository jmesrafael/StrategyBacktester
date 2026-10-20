// monthly.js — BB breakout (frozen settings) monthly P&L for SOL and ETH at $5 risk per trade. usage: node monthly.js
const L = require('./lib.js'), F = require('./fam.js'), fs = require('fs');
const B = { tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 3, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const RISK = 5, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mk = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const f = (v) => v == null ? '·' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
const out = [`# BB breakout (4h) — monthly P&L at $${RISK} risk per trade\n`, 'Frozen settings (see README-bb-breakout.md), 0.04% commission + 0.02% slippage. · = no trades. ' +
  'Flat $' + RISK + ' per trade (no compounding). Years 2019–2022 are the TRAINING period for SOL / ETH; 2023 on is held out.\n'];
const all = {};
for (const sym of ['SOL', 'ETH']) all[sym] = F.sq(sym, B);
all['SOL + ETH'] = all.SOL.concat(all.ETH);
for (const [name, tr] of Object.entries(all)) {
  const m = {}; for (const t of tr) m[mk(t.t)] = (m[mk(t.t)] || 0) + t.R * RISK;
  out.push(`## ${name}\n`, `| Year | ${MON.join(' | ')} | **Year** | Trades | Months + |`, `|---|${MON.map(() => '---').join('|')}|---|---|---|`);
  for (let y = 2020; y <= 2026; y++) {
    let yt = 0, pos = 0, cnt = 0;
    const cells = MON.map((_, i) => { const v = m[`${y}-${String(i + 1).padStart(2, '0')}`]; if (v == null) return '·'; yt += v; cnt++; if (v > 0) pos++; return f(v); });
    const n = L.slice(tr, L.ts(y), L.ts(y + 1)).length;
    if (n) out.push(`| ${y}${y < 2023 ? ' (train)' : ''} | ${cells.join(' | ')} | **${f(yt)}** | ${n} | ${pos}/${cnt} |`);
  }
  const te = L.slice(tr, L.ts(2023), L.ts(2100)), months = (Date.UTC(2026, 9, 20) - Date.UTC(2023, 0, 1)) / (30.44 * 86400000);
  out.push('', `Held-out (2023-01 → 2026-10): ${te.length} trades, ${f(L.sum(te.map((t) => t.R)) * RISK)} total, about ${f(L.sum(te.map((t) => t.R)) * RISK / months)} per month, max drawdown $${(L.stats(te).dd * RISK).toFixed(0)}.\n`);
}
fs.writeFileSync(__dirname + '/results-monthly-5usd.md', out.join('\n') + '\n');
console.log(out.join('\n'));
