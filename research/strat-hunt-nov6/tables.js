// tables.js — leaderboard tables from results.json. node tables.js [results.json] [tf]
'use strict';
const fs = require('fs');
const file = process.argv[2] || 'results.json', R = JSON.parse(fs.readFileSync(file, 'utf8'));
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
const label = (v) => (v.id + ' ' + v.profile);
function row(v) {
  const p = v.pooled, ys = YEARS.map((y) => p.years[y] || 0), pos = ys.filter((x) => x > 0).length;
  const coinsPos = Object.values(v.coins).filter((c) => c.total > 0).length, nCoins = Object.keys(v.coins).length;
  return { v, p, ys, pos, coinsPos, nCoins, worst: Math.min(...ys) };
}
function table(tf, rows, base) {
  const L = ['| # | strategy | exit | trades | exp R | total R | PF | win | maxDD R | R/DD | ' + YEARS.join(' | ') + ' | +yrs | +coins | avg bars |', '|' + '---|'.repeat(11 + YEARS.length + 3)];
  rows.forEach((r, i) => {
    const mark = r.v.family === 'reference' ? '**' : '';
    L.push(`| ${i + 1} | ${mark}${r.v.id}${mark} | ${r.v.profile} | ${r.p.n} | ${f2(r.p.exp)} | ${mark}${f1(r.p.total)}${mark} | ${r.p.pf.toFixed(2)} | ${(r.p.win * 100).toFixed(0)}% | ${r.p.dd.toFixed(1)} | ${r.p.rdd.toFixed(1)} | ${r.ys.map(f1).join(' | ')} | ${r.pos}/7 | ${r.coinsPos}/${r.nCoins} | ${r.p.bars.toFixed(0)} |`);
  });
  return L.join('\n');
}
module.exports = { R, row, table, YEARS, f1, f2, label };
if (require.main === module) {
  for (const tf of process.argv[3] ? [process.argv[3]] : ['4h', '1h']) {
    const rows = Object.values(R).filter((v) => v.tf === tf).map(row).sort((a, b) => b.p.total - a.p.total);
    console.log(`\n### ${tf} — sorted by total R (5 coins pooled)\n`); console.log(table(tf, rows));
  }
}
