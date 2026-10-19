// v7m-monthly.js — month by month, SOL, v7 vs v7+1m candidates ($1 risk = 1R). Uses every Binance 1m year file present.
// usage: node v7m-monthly.js → results/v7m-monthly.md
const fs = require('fs'), V = require('./v7m.js');
const C1 = { entry: 'confirm', confLen: 2, confTouch: 'mid', confStop: '1m', tpKeepPrice: true, beR: 1 };
const VAR = [['v7', {}], ['C1', C1], ['C2', { ...C1, tpKeepPrice: false, tpR: 5 }]];
const years = [2020, 2021, 2022, 2023, 2024, 2025].filter((y) => fs.existsSync(`data/binance-sol1-${y}.json`));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const f = (x) => (Math.abs(x) < 0.005 ? '0.00' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(2));
const L = ['# v7 vs v7+1m — SOL month by month ($1 risk per trade, Binance futures)', '',
  'v7 = 15m limit at FVG mid, 15m stop, 3R. **C1** = same v7 setup; when price reaches the v7 entry, wait for a 1m CHoCH, enter there, stop under the 1m sweep low, target = v7\'s 3R price, BE at 1R. **C2** = C1 with a fixed 5R target.',
  'Oct 2025 – Oct 2026 is the year the 1m rules were chosen on; earlier years are validation.', ''];
const yearTot = [];
for (const y of years) {
  const T = Object.fromEntries(VAR.map(([n, o]) => [n, V.run('SOL', o, [`${y}-10-18`, `${y + 1}-10-18`], y)]));
  L.push(`## Oct ${y} – Oct ${y + 1}${y === 2025 ? ' (tuning year)' : ' (validation)'}`, '', '| Month | v7 trades | v7 | C1 trades | C1 | C2 | C1 − v7 |', '|---|---|---|---|---|---|---|');
  const tot = { v7: 0, C1: 0, C2: 0 }; let c1Better = 0, months = 0, c1Pos = 0, v7Pos = 0;
  for (let d = new Date(Date.UTC(y, 9, 1)); d < new Date(Date.UTC(y + 1, 10, 1)); d.setUTCMonth(d.getUTCMonth() + 1)) {
    const k = d.toISOString().slice(0, 7), sel = (a) => a.filter((t) => new Date(t.fvgT * 1000).toISOString().slice(0, 7) === k);
    const r = Object.fromEntries(VAR.map(([n]) => [n, sel(T[n])]));
    if (!r.v7.length && !r.C1.length && !r.C2.length) continue;
    const s = Object.fromEntries(VAR.map(([n]) => [n, r[n].reduce((a, t) => a + t.R, 0)]));
    for (const n of Object.keys(tot)) tot[n] += s[n];
    months++; if (s.C1 > s.v7 + 0.005) c1Better++; if (s.C1 > 0) c1Pos++; if (s.v7 > 0) v7Pos++;
    L.push(`| ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()} | ${r.v7.length} | ${f(s.v7)} | ${r.C1.length} | ${f(s.C1)} | ${f(s.C2)} | ${f(s.C1 - s.v7)} |`);
  }
  L.push(`| **Year** | ${T.v7.length} | **${f(tot.v7)}** | ${T.C1.length} | **${f(tot.C1)}** | **${f(tot.C2)}** | **${f(tot.C1 - tot.v7)}** |`, '',
    `Profitable months: v7 ${v7Pos}/${months}, C1 ${c1Pos}/${months}. C1 beat v7 in ${c1Better}/${months} months.`, '');
  yearTot.push([y, tot]);
}
L.push('## Summary by year', '', '| Year | v7 | C1 | C2 |', '|---|---|---|---|');
for (const [y, t] of yearTot) L.push(`| Oct ${y}–${y + 1}${y === 2025 ? ' (tuning)' : ''} | ${f(t.v7)} | ${f(t.C1)} | ${f(t.C2)} |`);
const val = yearTot.filter(([y]) => y !== 2025), sv = (k) => val.reduce((a, [, t]) => a + t[k], 0);
L.push(`| **Validation years total** | **${f(sv('v7'))}** | **${f(sv('C1'))}** | **${f(sv('C2'))}** |`);
fs.writeFileSync('results/v7m-monthly.md', L.join('\n') + '\n');
console.log(L.join('\n'));
