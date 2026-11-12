'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '../strat-hunt-nov6'), C = require('../../candles/candles.js');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, WT = { 'BB-CORE': .5, 'I-CORE': .25, 'T-CORE': .25 };
const END = Date.UTC(2026, 10, 12) / 1000, by = id => S.find(s => s.id === id), yr = t => new Date(t * 1e3).getUTCFullYear();
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d);
const res = {};
for (const c of ['ENJ', 'ONE', 'GRT', 'KSM', 'UNI', 'ANKR']) {
  const B = C.load(c, '4h').map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })), F = C.funding(c);
  const x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  const T = { TRI: [] };
  for (const [bot, p] of Object.entries(BOTS)) { T[bot] = run(B, x.atr14, built[p], exitOf(p, x), F, 14400, COST).trades.filter(t => t.tExit <= END).map(t => ({ x: t.tExit, R: t.R })); T[bot].forEach(t => T.TRI.push({ x: t.x, R: t.R * WT[bot] })); }
  res[c] = T;
}
const Y = [2021, 2022, 2023, 2024, 2025, 2026], out = [];
for (const k of ['BB-CORE', 'I-CORE', 'T-CORE', 'TRI']) {
  out.push(`\n### ${k === 'TRI' ? 'TRI mix (50% BB-CORE + 25% I-CORE + 25% T-CORE)' : k}: R per year (2021-2026; the 2-3 month 2020 stubs left out)\n| Coin | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total R | Max drawdown | Worst year | Years positive |\n|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const c of Object.keys(res)) {
    const tr = res[c][k].filter(t => yr(t.x) >= 2021).sort((a, b) => a.x - b.x);
    const yv = Y.map(y => tr.filter(t => yr(t.x) === y).reduce((a, t) => a + t.R, 0));
    let e = 0, pk = 0, dd = 0; for (const t of tr) { e += t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); }
    out.push(`| ${c} | ${yv.map(v => f(v)).join(' | ')} | **${f(e)}** | ${dd.toFixed(0)}R | ${f(Math.min(...yv))} | ${yv.filter(v => v > 0).length}/6 |`);
  }
}
fs.writeFileSync(path.join(__dirname, 'BY-STRATEGY.md'), out.join('\n'));
console.log(out.join('\n'));
