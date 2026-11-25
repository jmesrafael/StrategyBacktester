// yearly.js: one table per measure, every version, year by year.
//   node yearly.js  -> YEARLY.md
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./engine');
const { END } = require('./check');
const K = require('./locked.json');
const ts = (y) => Date.UTC(y, 0, 1) / 1000, YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const V = [
  ['BB-CORE today', {}, 1],
  ['Intensity filter', { ii: { len: 21, th: 0, lo: 0 } }, 1],
  ['ADX rule only (1.00x)', K.champion.cfg, 1],
  ['Tweak 1.00x', K.iiCombo.cfg, 1],
  ['Tweak 1.05x', K.iiCombo.cfg, 1.05],
  ['Tweak 1.15x', K.iiCombo.cfg, K.iiCombo.k],
];
const rows = V.map(([name, cfg, k]) => {
  const res = L.replay(cfg, { endT: END }), res2 = L.replay(cfg, { endT: END, cost: 2 });
  const per = (a, b, r = res) => {
    const m = L.measure(r, a, b, k); let e = 1; for (const t of r.trades) if (t.tExit > a && t.tExit <= b) e *= 1 + 0.01 * k * t.w * t.R;
    const mon = {}; for (const t of r.trades) if (t.tExit > a && t.tExit <= b) { const key = new Date((t.tExit - 1) * 1000).toISOString().slice(0, 7); mon[key] = (mon[key] || 0) + t.w * t.R; }
    // marked-to-market change inside the period (open trades valued at the period's start and end)
    let s = 0, z = 0; for (let i = 0; i < r.curveT.length; i++) { if (r.curveT[i] <= a) s = r.curveE[i]; if (r.curveT[i] <= b) z = r.curveE[i]; else break; }
    return { ...m, pct: (e - 1) * 100, mtm: k * (z - s), months: Object.keys(mon).length, red: Object.values(mon).filter((v) => v < 0).length };
  };
  const y = YEARS.map((q) => per(ts(q), Math.min(ts(q + 1), END)));
  return { name, y, all: per(ts(2020), END), y2: YEARS.map((q) => per(ts(q), Math.min(ts(q + 1), END), res2)) };
});
const f = (v) => (v >= 0 ? '+' : '') + Math.round(v).toLocaleString('en-US');
const md = ['# Year by year, every version (2020 to Nov 24 2026; 6 live coins; fees, slippage, funding)', ''];
const table = (title, fn, last, lastName) => {
  md.push(`## ${title}`, '', `| Version | ${YEARS.join(' | ')} |${last ? ` ${lastName} |` : ''}`, '|' + '---|'.repeat(YEARS.length + 1 + (last ? 1 : 0)));
  for (const r of rows) md.push(`| ${r.name} | ${r.y.map((m, i) => fn(m, r, i)).join(' | ')} |${last ? ` ${last(r)} |` : ''}`);
  md.push('');
};
table('Total R (closed trades)', (m) => f(m.R), (r) => f(r.all.R), 'All');
table('Return at 1% risk per trade, compounded inside the year', (m) => f(m.pct) + '%');
table('Worst drawdown R inside the year (closed trades)', (m) => m.dd.toFixed(1), (r) => r.all.dd.toFixed(1), 'All');
table('Worst drawdown R inside the year (with open trades)', (m) => m.mdd.toFixed(1), (r) => r.all.mdd.toFixed(1), 'All');
table('Losing months / months', (m) => `${m.red}/${m.months}`, (r) => `${r.all.red}/${r.all.months}`, 'All');
table('Trades', (m) => String(m.n), (r) => String(r.all.n), 'All');
const green = (a) => `${a.filter((v) => v > 0).length} of ${a.length}`;
md.push('## Green years', '', '| Version | Closed trades | With open trades valued at year end | Double fees and slippage |', '|---|---|---|---|');
for (const r of rows) md.push(`| ${r.name} | ${green(r.y.map((m) => m.R))} | ${green(r.y.map((m) => m.mtm))} (weakest ${f(Math.min(...r.y.map((m) => m.mtm)))}R) | ${green(r.y2.map((m) => m.R))} (weakest ${f(Math.min(...r.y2.map((m) => m.R)))}R) |`);
fs.writeFileSync(path.join(__dirname, 'YEARLY.md'), md.join('\n') + '\n'); console.log(md.join('\n'));
