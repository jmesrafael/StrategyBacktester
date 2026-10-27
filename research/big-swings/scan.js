// scan.js — every family x params x exit width x trend filter on BTC + ETH + SOL (Binance USDT-M 4h), R per calendar year.
//   node scan.js            -> prints table, writes RESULTS-scan.md
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const bb = require('../bb-core-v2/v2-core.js');
const COINS = ['BTC', 'ETH', 'SOL'], YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const data = Object.fromEntries(COINS.map((c) => { const B = E.load(c); return [c, { B, X: E.base(B) }]; }));

const GRID = [];
for (const n of [20, 55, 100]) GRID.push(['donchian', { n }]);
GRID.push(['ichimoku', { full: true }], ['ichimoku', { full: false }]);
GRID.push(['darvas', { conf: 3, look: 50 }], ['darvas', { conf: 5, look: 100 }]);
for (const [n, min] of [[14, 1.0], [14, 1.1], [21, 1.0]]) GRID.push(['vortex', { n, min }]);
GRID.push(['supertrend', { n: 10, m: 3 }], ['supertrend', { n: 20, m: 4 }]);
GRID.push(['keltner', { n: 20, m: 2 }], ['keltner', { n: 50, m: 3 }]);
GRID.push(['adx', { n: 14, min: 25 }], ['adx', { n: 14, min: 30 }]);

const rows = [];
for (const [fam, p] of GRID) for (const k of [2, 3, 5]) for (const trend of [false, true]) {
  const per = {}, all = [];
  for (const c of COINS) { const T = E.run(data[c].B, data[c].X, fam, p, { coin: c, kInit: k, kTrail: k, trend }); per[c] = T; all.push(...T); }
  const y = E.yearly(all), py = Object.fromEntries(COINS.map((c) => [c, E.yearly(per[c])]));
  rows.push({ name: `${fam} ${JSON.stringify(p).replace(/"/g, '')} trail${k}${trend ? ' +SMA200' : ''}`, fam, all, y, py, per, R: all.reduce((a, t) => a + t.R, 0), dd: E.maxDD(all), pos: YEARS.filter((yy) => (y[yy] || 0) > 0).length, minY: Math.min(...YEARS.map((yy) => y[yy] || 0)), n: all.length });
}
// benchmark: bb-core (v2-core defaults = bb-core rules) on the same three coins
const { loadCoin } = require('../bb-core-v2/load.js');
const bbAll = [], bbPer = {};
for (const c of COINS) {
  let B, f; try { const d = loadCoin(c); B = d.B; f = d.funding; } catch (e) { B = data[c].B; f = null; }
  bbPer[c] = bb.backtest(B, {}, f).trades; bbAll.push(...bbPer[c]);
}
const by = (T) => { const o = {}; for (const t of T) { const k = new Date(t.tExit * 1000).getUTCFullYear(); o[k] = (o[k] || 0) + t.R; } return o; };
const bby = by(bbAll);

const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0);
let out = `# Big-swing strategies on BTC + ETH + SOL — Binance USDT-M 4h, R per calendar year\n\nCosts: 0.07% each side (fee+slippage) + 0.005%/bar funding. Entry at next open, stop checked on high/low, trail updates at the close. 1R = initial stop distance.\n\n`;
out += `**Benchmark bb-core (same 3 coins, its own rules):** ${bbAll.length} trades, ${f1(bbAll.reduce((a, t) => a + t.R, 0))}R, maxDD ${E.maxDD(bbAll).toFixed(1)}R, years: ${YEARS.map((y) => y + ' ' + f1(bby[y] || 0)).join(' | ')}\n\n`;
out += `| strategy | trades | total R | maxDD | yrs+ | ${YEARS.join(' | ')} |\n|---|---|---|---|---|${YEARS.map(() => '---').join('|')}|\n`;
rows.sort((a, b) => b.pos - a.pos || b.minY - a.minY);
for (const r of rows) out += `| ${r.name} | ${r.n} | ${f1(r.R)} | ${r.dd.toFixed(0)} | ${r.pos}/7 | ${YEARS.map((y) => f1(r.y[y] || 0)).join(' | ')} |\n`;
fs.writeFileSync(path.join(__dirname, 'RESULTS-scan.md'), out);
console.log(out.split('\n').slice(0, 40).join('\n'));
console.log('...\nconfigs:', rows.length, ' with 7/7:', rows.filter((r) => r.pos === 7).length, ' with 6/7+:', rows.filter((r) => r.pos >= 6).length);
