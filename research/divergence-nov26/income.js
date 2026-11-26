// Passive income stage (Nov 26 2026): a 1,000,000 PHP account, trades untouched, a fixed % of the balance taken every month end.
// "Half edge": every bot's monthly R is lowered by half of its average monthly R over the window (same ups and downs, half the average).
'use strict';
const path = require('path'), fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8');
const body = src.slice(src.indexOf("const path = require('path')"), src.indexOf('// ---- parity'));
const { data, run, BOTS } = new Function('require', '__dirname', 'process', body + '\nreturn { data, run, BOTS };')(require, __dirname, { argv: [] });
const PHP = 58, TIERS = [[0, 0.025], [500, 0.02], [1000, 0.015]], W = { bbcore: 0.5, icore: 0.25, tcore: 0.25 }, START = 1e6;
const riskFor = (p) => { let r = TIERS[0][1]; for (const [b, x] of TIERS) if (p >= b) r = x; return r; };
const mkey = (T) => { const d = new Date(T * 1000); return d.getUTCFullYear() * 100 + d.getUTCMonth(); };
const nextK = (k) => (k % 100 === 11) ? k + 89 : k + 1;
const M = {}; let end = 0;
for (const b of BOTS) { M[b] = {}; for (const t of [].concat(...data[b].map((D) => run(D)))) { const k = mkey(t.tExit - 1); M[b][k] = (M[b][k] || 0) + t.R; end = Math.max(end, k); } }
function sim(from, take, edge) {
  const months = []; for (let k = from; k <= end; k = nextK(k)) months.push(k);
  const cut = {}; for (const b in W) cut[b] = (1 - edge) * months.reduce((a, k) => a + (M[b][k] || 0), 0) / months.length;
  let eq = START; const share = {}, peak = {}, inc = [], rets = []; for (const b in W) { share[b] = eq * W[b]; peak[b] = share[b] / PHP; }
  let hi = START, worst = 0, low = START;
  for (const k of months) {
    const before = eq;
    for (const b in W) { const r = riskFor(peak[b]); share[b] *= Math.max(0.01, 1 + r * ((M[b][k] || 0) - cut[b])); peak[b] = Math.max(peak[b], share[b] / PHP); }
    eq = Object.values(share).reduce((a, c) => a + c, 0); rets.push(eq / before - 1);
    const w = take * eq; for (const b in W) share[b] *= 1 - take; eq -= w; inc.push(w);
    hi = Math.max(hi, eq); worst = Math.max(worst, 1 - eq / hi); low = Math.min(low, eq);
    if ((k % 100) % 3 === 2) for (const b in W) share[b] = eq * W[b];
  }
  const s = [...inc].sort((a, b) => a - b);
  return { months: months.length, inc, total: inc.reduce((a, c) => a + c, 0), med: s[Math.floor(s.length / 2)], min: s[0], eq, low, worst, rets };
}
const p = (x) => '₱' + (x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : Math.round(x / 1000) + 'K'), pc = (x) => Math.round(x * 100) + '%';
const out = ['# Monthly income from a 1,000,000 PHP account (TRI-CORE, trades untouched, to Nov 2026; backtest, not expected income)', ''];
const r0 = sim(202200, 0, 1).rets, s0 = [...r0].sort((a, b) => a - b); let u = 0, mu = 0, v = 1, h = 1;
for (const r of r0) { v *= 1 + r; if (v >= h) { h = v; u = 0; } else { u++; mu = Math.max(mu, u); } }
out.push(`Months since Jan 2022: ${r0.length}; losing ${r0.filter((r) => r < 0).length}; middle month ${(100 * s0[Math.floor(s0.length / 2)]).toFixed(1)}%; worst ${(100 * s0[0]).toFixed(1)}%; best ${(100 * s0[s0.length - 1]).toFixed(1)}%; longest stretch below a previous high ${mu} months.`, '');
for (const [label, from] of [['Start Jan 2022', 202200], ['Start Jan 2025', 202500]]) for (const [el, edge] of [['as backtested', 1], ['half as good', 0.5]]) {
  const res = [0.02, 0.05, 0.1].map((t) => sim(from, t, edge));
  out.push(`## ${label}, results ${el}`, '', '| | Take 2% a month | Take 5% a month | Take 10% a month |', '|---|---|---|---|');
  const row = (n, g) => out.push(`| ${n} | ` + res.map(g).join(' | ') + ' |');
  row('First month income', (r) => p(r.inc[0])); row('Middle month income', (r) => p(r.med)); row('Lowest month income', (r) => p(r.min));
  row('Account at the end', (r) => p(r.eq)); row('Lowest account balance', (r) => p(r.low)); row('Biggest fall from a high (with withdrawals)', (r) => pc(r.worst));
  row('Income received', (r) => p(r.total)); row('**Total (income + account)**', (r) => `**${p(r.total + r.eq)}**`); out.push('');
}
fs.writeFileSync(path.join(__dirname, 'income.md'), out.join('\n') + '\n'); console.log(out.join('\n'));
