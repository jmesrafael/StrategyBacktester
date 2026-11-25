// compare.js: the three live bots, the candidates that might beat them, and the account mix, on one basis:
// live coins, Binance 4h to Nov 24 2026, v3 rules, 0.05% fee + 0.02% slippage per side + real funding.
//   node compare.js  -> COMPARE.md
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./engine');
const E = require('../../intel/engines/backtest/engine');
const { bot } = require('../../intel/engines/backtest/strategies');
const cfgI = require('../../intel/config.json').bots;
const { END } = require('./check');
const K = require('./locked.json');
const ts = (y) => Date.UTC(y, 0, 1) / 1000, T0 = ts(2020), IV = L.IV, YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

// every strategy becomes a list of trades { c, dir, t, tExit, R, entry, dist, w }
function fromIntel(name, extra = {}) {
  return cfgI[name].coins.flatMap((c) => { const x = L.load(c, END);
    return E.run(x.bars, bot(name, 'v3', extra), E.standardCost({ funding: x.funding })).trades.map((q) => ({ c, dir: q.dir, t: q.t, tExit: q.tExit, R: q.R, entry: q.entry, dist: q.dist, w: 1 })); });
}
function fromReplay(cfg, k) { // BB-CORE family: attach entry price and stop distance so open trades can be valued
  return L.replay(cfg, { endT: END }).trades.map((q) => { const x = L.load(q.c, END); let a = 0, b = x.n - 1; while (a < b) { const m = (a + b) >> 1; if (x.T[m] < q.t) a = m + 1; else b = m; }
    let s = 0; for (let j = q.sig - 19; j <= q.sig; j++) s += x.Cl[j]; const entry = x.O[a] * (1 + q.dir * 0.0002); return { ...q, entry, dist: Math.abs(entry - s / 20) / entry, w: q.w * k }; });
}
const mix = (...parts) => parts.flatMap(([tr, share]) => tr.map((q) => ({ ...q, w: q.w * share })));
function build(trades) {
  trades = [...trades].sort((a, b) => a.tExit - b.tExit || a.t - b.t);
  const ev = new Map(), add = (t, v) => ev.set(t, (ev.get(t) || 0) + v);
  for (const q of trades) { const x = L.load(q.c, END); let prev = 0, a = 0, b = x.n - 1; while (a < b) { const m = (a + b) >> 1; if (x.T[m] < q.t) a = m + 1; else b = m; }
    for (let i = a; i < x.n && x.T[i] + IV < q.tExit; i++) { const v = q.w * (q.dir * (x.Cl[i] - q.entry) / q.entry - 0.001 - q.dir * x.fund(q.t, x.T[i] + IV)) / q.dist; add(x.T[i] + IV, v - prev); prev = v; }
    add(q.tExit, q.w * q.R - prev); }
  const curveT = [], curveE = []; let e = 0; for (let t = T0 - 400 * 86400; t <= END; t += IV) { e += ev.get(t) || 0; curveT.push(t); curveE.push(e); }
  return { trades, curveT, curveE };
}
const BBt = (k) => fromReplay(K.iiCombo.cfg, k);
const bb = fromReplay({}, 1), ic = fromIntel('icore'), tc = fromIntel('tcore');
const GROUPS = [
  ['BB-CORE family (6 coins)', [['BB-CORE (LIVE)', bb], ['BB tweak 1.00x', BBt(1)], ['BB tweak 1.05x', BBt(1.05)], ['BB tweak 1.15x', BBt(K.iiCombo.k)], ['Intensity filter', fromReplay({ ii: { len: 21, th: 0, lo: 0 } }, 1)]]],
  ['I-CORE (5 coins)', [['I-CORE (LIVE)', ic]]],
  ['T-CORE family (8 coins)', [['T-CORE (LIVE, trail 14)', tc], ['T-CORE trail 12', fromIntel('tcore', { kTrail: 12 })], ['T-CORE trail 10', fromIntel('tcore', { kTrail: 10 })]]],
  ['Whole account, TRI-CORE 50 / 25 / 25', [['TRI-CORE (LIVE)', mix([bb, 0.5], [ic, 0.25], [tc, 0.25])], ['TRI with BB tweak 1.00x', mix([BBt(1), 0.5], [ic, 0.25], [tc, 0.25])], ['TRI with BB tweak 1.05x', mix([BBt(1.05), 0.5], [ic, 0.25], [tc, 0.25])],
    ['TRI with T trail 12', mix([bb, 0.5], [ic, 0.25], [fromIntel('tcore', { kTrail: 12 }), 0.25])], ['TRI with BB tweak 1.05x + T trail 12', mix([BBt(1.05), 0.5], [ic, 0.25], [fromIntel('tcore', { kTrail: 12 }), 0.25])]]],
];
const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(0);
const md = ['# Live bots and candidates, one basis (to Nov 24 2026)', '', 'R = risk units (1R = 1% of the account at 1% risk per trade, without compounding). TRI-CORE rows are weighted R, comparable only with each other.', ''];
for (const [title, list] of GROUPS) {
  const rs = list.map(([n, tr]) => { const r = build(tr); return { n, all: L.measure(r, T0, END), un: L.measure(r, ts(2024), END), y: YEARS.map((q) => L.measure(r, ts(q), Math.min(ts(q + 1), END))) }; });
  md.push(`## ${title}`, '', '| Strategy | Total R | Drop closed | Drop open | Total / drop open | 2024-26 R | 2024-26 drop closed | 2024-26 drop open | Trades | Green years |', '|' + '---|'.repeat(10));
  for (const r of rs) md.push(`| ${r.n} | ${f(r.all.R)} | ${r.all.dd.toFixed(1)} | ${r.all.mdd.toFixed(1)} | ${r.all.rdd.toFixed(1)} | ${f(r.un.R)} | ${r.un.dd.toFixed(1)} | ${r.un.mdd.toFixed(1)} | ${r.all.n} | ${r.y.filter((m) => m.R > 0).length}/7 |`);
  md.push('', `| Strategy (R / closed drop) | ${YEARS.join(' | ')} |`, '|' + '---|'.repeat(YEARS.length + 1));
  for (const r of rs) md.push(`| ${r.n} | ${r.y.map((m) => `${f(m.R)} / ${m.dd.toFixed(0)}`).join(' | ')} |`);
  md.push('');
}
fs.writeFileSync(path.join(__dirname, 'COMPARE.md'), md.join('\n') + '\n'); console.log(md.join('\n'));
