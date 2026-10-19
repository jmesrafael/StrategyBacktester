// v7m-validate.js — pre-registered v7+1m candidates vs v7 on SOL, one Oct–Oct year per Binance 1m file. No tuning here.
// usage: node v7m-validate.js [years…]   (default 2020 2021 2022 2023 2024 2025) → results/v7m-validate.md
const fs = require('fs'), V = require('./v7m.js');
const years = process.argv.slice(2).map(Number).filter(Boolean);
const YRS = years.length ? years : [2020, 2021, 2022, 2023, 2024, 2025];
const C1 = { entry: 'confirm', confLen: 2, confTouch: 'mid', confStop: '1m', tpKeepPrice: true, beR: 1 };
const VAR = [['v7 (control)', {}], ['C1 confirm, v7 3R price', C1], ['C2 confirm, fixed 5R', { ...C1, tpKeepPrice: false, tpR: 5 }],
  ['C1 pivot 1 (robustness)', { ...C1, confLen: 1 }], ['C1 pivot 3 (robustness)', { ...C1, confLen: 3 }]];
const L = ['# v7+1m validation — SOL, Binance futures 1m, $1 risk (R)', '', 'Candidates pre-registered in ITERATION-LOG.md before these years were run. 2025 = the tuning year.', '',
  `| Variant | ${YRS.map((y) => `Oct ${String(y).slice(2)}–${String(y + 1).slice(2)}`).join(' | ')} | Total (non-tuning years) | Years beating v7 |`, `|---|${YRS.map(() => '---').join('|')}|---|---|`];
const res = {};
for (const [name, o] of VAR) {
  res[name] = {};
  for (const y of YRS) {
    if (!fs.existsSync(`data/binance-sol1-${y}.json`)) { res[name][y] = null; continue; }
    const t = V.run('SOL', o, [`${y}-10-18`, `${y + 1}-10-18`], y);
    res[name][y] = { n: t.length, R: t.reduce((a, x) => a + x.R, 0), tp: t.filter((x) => x.reason === 'TP').length };
  }
}
for (const [name] of VAR) {
  const r = res[name], base = res['v7 (control)'];
  const val = YRS.filter((y) => y !== 2025 && r[y]);
  const tot = val.reduce((a, y) => a + r[y].R, 0), beat = val.filter((y) => r[y].R > base[y].R).length;
  L.push(`| ${name} | ${YRS.map((y) => (r[y] ? `${r[y].R >= 0 ? '+' : '−'}${Math.abs(r[y].R).toFixed(1)} (${r[y].n}, ${r[y].tp} TP)` : 'no data')).join(' | ')} | **${tot >= 0 ? '+' : '−'}${Math.abs(tot).toFixed(1)}** | ${name.startsWith('v7') ? '—' : `${beat} of ${val.length}`} |`);
}
fs.writeFileSync('results/v7m-validate.md', L.join('\n') + '\n');
console.log(L.join('\n'));
