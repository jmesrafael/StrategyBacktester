// sensitivity.js — v7 robustness: (1) every parameter nudged ±20%, (2) stricter limit fills, (3) higher costs. v7 frozen; ie.js untouched.
// usage: node sensitivity.js  → results/sensitivity.json, results/sensitivity.md
const fs = require('fs'), path = require('path'), E = require('./ie.js'), T = require('./trades-windows.js');
const D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const IS = [D0('2023-10-18'), D0('2026-10-18')], PRE = [D0('2021-10-18'), D0('2023-10-18')];
const YRS = { Y1: E.Y.Y1, Y2: E.Y.Y2, Y3: E.Y.Y3 };
const raw = {}; for (const s of ['SOL', 'ETH']) raw[s] = T.SERIES[s].flatMap((f) => JSON.parse(fs.readFileSync(path.resolve(__dirname, f), 'utf8')));
const cache = {};
function run(over) {
  const C = { ...T.C, ...over }, res = { all: [] };
  for (const s of ['SOL', 'ETH']) {
    const k = s + C.swingLen; const D = cache[k] || (cache[k] = E.analyze(s + '-full', raw[s], C.swingLen));
    res[s] = E.execute(D, C, E.setupsFor(D, C));
  }
  const sum = (a, lo, hi) => a.filter((t) => t.t >= lo && t.t < hi).reduce((x, t) => x + t.R * 10, 0);
  const cnt = (a, lo, hi) => a.filter((t) => t.t >= lo && t.t < hi).length;
  const both = [...res.SOL, ...res.ETH];
  const w = both.filter((t) => t.t >= IS[0] && t.t < IS[1]), gp = w.filter((t) => t.R > 0).reduce((a, t) => a + t.R, 0), gl = -w.filter((t) => t.R <= 0).reduce((a, t) => a + t.R, 0);
  return { is: sum(both, ...IS), sol: sum(res.SOL, ...IS), eth: sum(res.ETH, ...IS), n: cnt(both, ...IS), pf: gl ? gp / gl : 99,
    pre: sum(both, ...PRE), preN: cnt(both, ...PRE), yrs: Object.values(YRS).map(([a, b]) => sum(both, a, b)) };
}
const base = run({});
const P = [['swingLen', [4, 6]], ['minDispATR', [0.8, 1.2]], ['minFvgATR', [0.16, 0.24]], ['maxStopATR', [3.2, 4.8]], ['maxFillBars', [6, 10]], ['tpR', [2.4, 3.6]],
  ['ftBars', [3, 5]], ['ftMinR', [0.2, 0.3]], ['ftTightR', [0.4, 0.6]], ['fvgWindow', [8, 12]], ['entryFrac', [0.4, 0.6]], ['chochWindowH', [2.4, 3.6]]];
const rows = [];
for (const [k, vs] of P) for (const v of vs) { const r = run({ [k]: v }); rows.push({ k, v, base: T.C[k], ...r }); process.stderr.write(k + '=' + v + ' ' + r.is.toFixed(0) + '\n'); }
const fills = [0, 0.0003, 0.0006, 0.001, 0.002].map((f) => ({ f, ...run({ fillThrough: f }) }));
const costs = [1, 1.5, 2, 3].map((m) => ({ m, ...run({ costMult: m }) }));
const combo = run({ fillThrough: 0.0006, costMult: 1.5 });
const out = { base, rows, fills, costs, combo };
fs.writeFileSync(path.join(__dirname, 'results/sensitivity.json'), JSON.stringify(out, null, 1));
const u = (x) => (x < 0 ? '−$' : '+$') + Math.abs(x).toFixed(0);
const L = ['# v7 sensitivity', '', `Baseline Oct23–Oct26: ${u(base.is)} (${base.n} trades, PF ${base.pf.toFixed(2)}); pre-2023: ${u(base.pre)}`, '',
  '| Param | Base | Tested | Oct23–26 | vs base | SOL | ETH | trades | PF | pre-2023 |', '|---|---|---|---|---|---|---|---|---|---|'];
for (const r of rows) L.push(`| ${r.k} | ${r.base} | ${r.v} | ${u(r.is)} | ${((r.is / base.is - 1) * 100).toFixed(0)}% | ${u(r.sol)} | ${u(r.eth)} | ${r.n} | ${r.pf.toFixed(2)} | ${u(r.pre)} |`);
L.push('', '| Fill must trade through by | Oct23–26 | SOL | ETH | trades | PF |', '|---|---|---|---|---|---|');
for (const r of fills) L.push(`| ${(r.f * 100).toFixed(2)}% | ${u(r.is)} | ${u(r.sol)} | ${u(r.eth)} | ${r.n} | ${r.pf.toFixed(2)} |`);
L.push('', '| Cost × | Oct23–26 | SOL | ETH | PF |', '|---|---|---|---|---|');
for (const r of costs) L.push(`| ${r.m} | ${u(r.is)} | ${u(r.sol)} | ${u(r.eth)} | ${r.pf.toFixed(2)} |`);
L.push('', `Combined (0.06% through + 1.5× costs): ${u(combo.is)}, PF ${combo.pf.toFixed(2)}, ${combo.n} trades`);
fs.writeFileSync(path.join(__dirname, 'results/sensitivity.md'), L.join('\n') + '\n');
console.log(L.join('\n'));
