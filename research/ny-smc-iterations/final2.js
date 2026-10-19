// final2.js — v6 / v7 (round 6-7 refinements) vs v3/v4/v5b: per coin-year, stress tests, bootstrap CI.
const fs = require('fs'), E = require('./ie.js');
const S2 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5 };
const v3 = { ...S2, tpMode: 'R', tpR: 3 }, v4 = { ...v3, minDispATR: 1 }, v5b = { ...v4, minFvgATR: 0.2 };
const REF = { chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5, maxStopATR: 4, maxFillBars: 8 };
const V = [['v3', v3], ['v4', v4], ['v5b', v5b], ['v6', { ...v4, ...REF }], ['v7', { ...v5b, ...REF }]];
const Ys = ['Y1', 'Y2', 'Y3'], sg = (x) => ((x >= 0 ? '+' : '') + x.toFixed(1));
const boot = (a, it = 5000) => { const m = []; let seed = 11; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < it; i++) { let s = 0; for (let j = 0; j < a.length; j++) s += a[Math.floor(r() * a.length)]; m.push(s / a.length); }
  m.sort((x, y) => x - y); return [m[Math.floor(it * 0.05)], m[Math.floor(it * 0.95)]]; };
const out = {};
const md = ['| Version | Coin | Y1 (Oct23–Oct24) | Y2 (Oct24–Oct25) | Y3 (Oct25–Oct26) | Years positive |', '|---|---|---|---|---|---|'];
const sum = ['| Version | Trades (3 yr) | Per month | PF | Total R | Avg R/trade | 90% CI avg R | Max DD (R) | Max DD (1% risk) | Longest losing run | TP / SL / BE |', '|---|---|---|---|---|---|---|---|---|---|---|'];
for (const [id, c] of V) {
  const r = { SOL: E.runSym('SOL', c), ETH: E.runSym('ETH', c) };
  for (const k of ['SOL', 'ETH']) md.push(`| ${k === 'SOL' ? '**' + id + '**' : ''} | ${k} | ` + Ys.map((y) => `${sg(r[k].by[y].sumR)}R · PF ${r[k].by[y].pf.toFixed(2)} · n=${r[k].by[y].n}`).join(' | ') + ` | ${Ys.filter((y) => r[k].by[y].sumR > 0).length}/3 |`);
  const T = [...r.SOL.trades, ...r.ETH.trades].sort((a, b) => a.t - b.t), A = E.stats(T), ci = boot(T.map((t) => t.R));
  sum.push(`| ${id} | ${A.n} | ${(A.n / 36).toFixed(1)} | ${A.pfR.toFixed(2)} | ${sg(A.sumR)} | ${(A.avgR >= 0 ? "+" : "") + A.avgR.toFixed(2)} | ${ci[0].toFixed(2)} … ${ci[1].toFixed(2)} | ${A.ddR.toFixed(1)} | ${(A.maxDD * 100).toFixed(1)}% | ${A.streak} | ${A.tp} / ${A.sl} / ${A.be} |`);
  out[id] = { conf: c, all: A, ci };
}
const ST = [['As tested', {}], ['Fees + slippage ×2', { costMult: 2 }], ['Fees + slippage ×3', { costMult: 3 }],
  ['Fill only if price trades 0.02% through', { fillThrough: 0.0002 }], ['Fill only if price trades 0.05% through', { fillThrough: 0.0005 }],
  ['Costs ×2 + 0.02% through', { costMult: 2, fillThrough: 0.0002 }], ['Costs ×2 + 0.05% through', { costMult: 2, fillThrough: 0.0005 }]];
const st = ['| Stress (SOL+ETH pooled) | v4 3yr | v4 Y3 | v5b 3yr | v5b Y3 | **v6 3yr** | **v6 Y3** | **v7 3yr** | **v7 Y3** |', '|---|---|---|---|---|---|---|---|---|'];
for (const [nm, p] of ST) {
  const cells = [];
  for (const id of ['v4', 'v5b', 'v6', 'v7']) {
    const c = { ...out[id].conf, ...p };
    const T = [...E.runSym('SOL', c).trades, ...E.runSym('ETH', c).trades];
    const a = E.stats(T), y = E.stats(T.filter((t) => t.t >= E.Y.Y3[0]));
    cells.push(`PF ${a.pfR.toFixed(2)} · ${sg(a.sumR)}R`, `PF ${y.pfR.toFixed(2)} · ${sg(y.sumR)}R`);
  }
  st.push(`| ${nm} | ${cells.join(' | ')} |`);
}
const txt = ['## Per coin, per year', '', ...md, '', '## Summary (SOL+ETH pooled, 3 years)', '', ...sum, '', '## Stress tests', '', ...st].join('\n');
fs.writeFileSync(__dirname + '/results/final2.md', txt); fs.writeFileSync(__dirname + '/results/final2.json', JSON.stringify(out, null, 1));
console.log(txt);
