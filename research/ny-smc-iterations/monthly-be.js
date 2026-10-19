// monthly-rr.js — v7 month by month at $10 risk per trade, breakeven trigger +1R vs +0.5R (target 1:3). Everything else in v7 unchanged.
// usage: node monthly-rr.js mexc|bybit   → results/monthly-be-<src>.md
const fs = require('fs'), E = require('./ie.js');
const src = process.argv[2] || 'mexc';
const V7 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5, tpMode: 'R', tpR: 3, minDispATR: 1, minFvgATR: 0.2,
  chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5, maxStopATR: 4, maxFillBars: 8 };
const VAR = [['BE 1R', { ...V7, tpR: 3, beR: 1 }], ['BE 0.5R', { ...V7, tpR: 3, beR: 0.5 }]];
const D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
let range, keyOf;
if (src === 'mexc') {
  E.RAW.SOLm = JSON.parse(fs.readFileSync('data/mexc-sol15.json', 'utf8')); E.RAW.ETHm = JSON.parse(fs.readFileSync('data/mexc-eth15.json', 'utf8'));
  keyOf = { SOL: 'SOLm', ETH: 'ETHm' }; range = [D0('2025-10-23'), D0('2026-10-18')];
} else { keyOf = { SOL: 'SOL', ETH: 'ETH' }; range = [D0('2023-10-18'), D0('2026-10-18')]; }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const usd = (x) => (Math.abs(x) < 0.5 ? '$0' : (x < 0 ? '−$' : '+$') + Math.abs(x).toFixed(0));
const T = {}; // T[sym][variant] = trades within range
for (const s of ['SOL', 'ETH']) { T[s] = {}; for (const [v, c] of VAR) T[s][v] = E.runSym(keyOf[s], c).trades.filter((t) => t.t >= range[0] && t.t < range[1]); }
const stat = (a) => { const s = E.stats(a); return { n: s.n, hit: a.filter((t) => t.reason === 'TP').length, win: s.win, pf: s.pfR, R: s.sumR, dd: s.ddR }; };
const out = [`# v7 month by month, breakeven trigger +1R vs +0.5R (target 1:3) — ${src === 'mexc' ? 'MEXC USDT-M perp 15m' : 'Bybit USDT perp 15m'}`, '',
  `$10 risk per trade, fees + slippage included, ${new Date(range[0] * 1000).toISOString().slice(0, 10)} → ${new Date(range[1] * 1000).toISOString().slice(0, 10)}. ` +
  'Only the breakeven trigger differs (target 1:3 in both); entry, stop, follow-through tightening and all filters are v7.', ''];
out.push('| Month | SOL BE 1R | SOL BE 0.5R | ETH BE 1R | ETH BE 0.5R | **Both BE 1R** | **Both BE 0.5R** | Both BE 1R running | Both BE 0.5R running |', '|---|---|---|---|---|---|---|---|---|');
const d = new Date(range[0] * 1000); let cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000; const run = { 'BE 1R': 0, 'BE 0.5R': 0 };
const months = [];
while (cur < range[1]) {
  const nd = new Date(cur * 1000), next = Date.UTC(nd.getUTCFullYear(), nd.getUTCMonth() + 1, 1) / 1000;
  const lo = Math.max(cur, range[0]), hi = Math.min(next, range[1]);
  const m = (s, v) => T[s][v].filter((t) => t.t >= lo && t.t < hi).reduce((x, t) => x + t.R * 10, 0);
  const row = { SOL: { 'BE 1R': m('SOL', 'BE 1R'), 'BE 0.5R': m('SOL', 'BE 0.5R') }, ETH: { 'BE 1R': m('ETH', 'BE 1R'), 'BE 0.5R': m('ETH', 'BE 0.5R') } };
  const b3 = row.SOL['BE 1R'] + row.ETH['BE 1R'], b2 = row.SOL['BE 0.5R'] + row.ETH['BE 0.5R']; run['BE 1R'] += b3; run['BE 0.5R'] += b2;
  months.push({ b3, b2, s3: row.SOL['BE 1R'], s2: row.SOL['BE 0.5R'], e3: row.ETH['BE 1R'], e2: row.ETH['BE 0.5R'] });
  let label = `${MON[nd.getUTCMonth()]} ${nd.getUTCFullYear()}`; if (lo !== cur) label += ` (from ${ord(new Date(lo * 1000).getUTCDate())})`; if (hi !== next) label += ` (to ${ord(new Date(hi * 1000 - 1).getUTCDate())})`;
  out.push(`| ${label} | ${usd(row.SOL['BE 1R'])} | ${usd(row.SOL['BE 0.5R'])} | ${usd(row.ETH['BE 1R'])} | ${usd(row.ETH['BE 0.5R'])} | **${usd(b3)}** | **${usd(b2)}** | ${usd(run['BE 1R'])} | ${usd(run['BE 0.5R'])} |`);
  cur = next;
}
const tot = (k) => months.reduce((x, m) => x + m[k], 0);
out.push(`| **Total** | **${usd(tot('s3'))}** | **${usd(tot('s2'))}** | **${usd(tot('e3'))}** | **${usd(tot('e2'))}** | **${usd(tot('b3'))}** | **${usd(tot('b2'))}** | | |`, '');
out.push('## Summary', '', '| | SOL BE 1R | SOL BE 0.5R | ETH BE 1R | ETH BE 0.5R | Both BE 1R | Both BE 0.5R |', '|---|---|---|---|---|---|---|');
const cols = [T.SOL['BE 1R'], T.SOL['BE 0.5R'], T.ETH['BE 1R'], T.ETH['BE 0.5R'], [...T.SOL['BE 1R'], ...T.ETH['BE 1R']].sort((a, b) => a.t - b.t), [...T.SOL['BE 0.5R'], ...T.ETH['BE 0.5R']].sort((a, b) => a.t - b.t)];
const S = cols.map(stat), mk = [months.map((m) => m.s3), months.map((m) => m.s2), months.map((m) => m.e3), months.map((m) => m.e2), months.map((m) => m.b3), months.map((m) => m.b2)];
const r = (name, f) => out.push(`| ${name} | ${cols.map((_, i) => f(i)).join(' | ')} |`);
r('Trades', (i) => S[i].n); r('Target hits', (i) => `${S[i].hit} (${(S[i].hit / S[i].n * 100).toFixed(0)}%)`);
r('Win rate (trades > 0)', (i) => (cols[i].filter((t) => t.R > 0.05).length / S[i].n * 100).toFixed(0) + '%');
r('Profit', (i) => usd(S[i].R * 10)); r('Profit factor', (i) => S[i].pf.toFixed(2));
r('Average per month', (i) => usd(mk[i].reduce((a, b) => a + b, 0) / mk[i].length));
r('Profitable months', (i) => `${mk[i].filter((v) => v > 0.5).length} of ${mk[i].length}`);
r('Losing months', (i) => mk[i].filter((v) => v < -0.5).length);
r('Best / worst month', (i) => `${usd(Math.max(...mk[i]))} / ${usd(Math.min(...mk[i]))}`);
r('Max drawdown', (i) => '−$' + (S[i].dd * 10).toFixed(0));
r('Longest losing-month run', (i) => { let c = 0, m = 0; for (const v of mk[i]) { c = v < -0.5 ? c + 1 : 0; m = Math.max(m, c); } return m; });
const txt = out.join('\n'); fs.writeFileSync(`results/monthly-be-${src}.md`, txt + '\n'); console.log(txt);
