// Withdraw part of new profit each month, trades untouched (Nov 26 2026). Same compounding as money.js; start 50,000 PHP.
// Each month end: if the account is above its previous high (after withdrawals), a share of the excess is taken out. Open trades are not touched.
'use strict';
const path = require('path'), fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8');
const body = src.slice(src.indexOf("const path = require('path')"), src.indexOf('// ---- parity'));
const { data, run, BOTS } = new Function('require', '__dirname', 'process', body + '\nreturn { data, run, BOTS };')(require, __dirname, { argv: [] });
const PHP = 58, TIERS = [[0, 0.025], [500, 0.02], [1000, 0.015]], W = { bbcore: 0.5, icore: 0.25, tcore: 0.25 }, START = 50000;
const riskFor = (p) => { let r = TIERS[0][1]; for (const [b, x] of TIERS) if (p >= b) r = x; return r; };
const mkey = (T) => { const d = new Date(T * 1000); return d.getUTCFullYear() * 100 + d.getUTCMonth(); };
const M = {}; let end = 0;
for (const b of BOTS) { M[b] = {}; for (const t of [].concat(...data[b].map((D) => run(D)))) { const k = mkey(t.tExit - 1); M[b][k] = (M[b][k] || 0) + t.R; end = Math.max(end, k); } }
function sim(from, f) {
  let eq = START, high = START, out = 0, worst = 0, hi = START; const share = {}, peak = {}; for (const b in W) { share[b] = eq * W[b]; peak[b] = share[b] / PHP; }
  for (let k = from; k <= end; k = (k % 100 === 11) ? k + 89 : k + 1) {
    for (const b in W) { const r = riskFor(peak[b]); share[b] *= Math.max(0.01, 1 + r * (M[b][k] || 0)); peak[b] = Math.max(peak[b], share[b] / PHP); }
    eq = Object.values(share).reduce((a, c) => a + c, 0);
    const total = eq + out; hi = Math.max(hi, total); worst = Math.max(worst, (hi - total) / hi);
    if (f && eq > high) { const w = f * (eq - high), s = (eq - w) / eq; for (const b in W) share[b] *= s; eq -= w; out += w; }
    high = Math.max(high, eq);
    if ((k % 100) % 3 === 2) for (const b in W) share[b] = eq * W[b];
  }
  return { eq, out, worst };
}
const peso = (x) => '₱' + (x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : Math.round(x).toLocaleString('en-US'));
const lines = ['# Withdraw a share of new profit each month, trades untouched (start 50,000 PHP, to Nov 25 2026; backtest, not expected income)', ''];
for (const [label, from] of [['From Jan 2025', 202500], ['From Jan 2026', 202600], ['From Jan 2022 (weak start)', 202200]]) {
  lines.push(`## ${label}`, '', '| Withdraw from new profit | Taken out | Left in account | Total | Taken out as share of total |', '|---|---|---|---|---|');
  for (const f of [0, 0.25, 0.5]) { const r = sim(from, f); lines.push(`| ${f * 100}% | ${peso(r.out)} | ${peso(r.eq)} | ${peso(r.out + r.eq)} | ${Math.round(100 * r.out / (r.out + r.eq))}% |`); }
  lines.push('');
}
fs.writeFileSync(path.join(__dirname, 'withdraw.md'), lines.join('\n') + '\n'); console.log(lines.join('\n'));
