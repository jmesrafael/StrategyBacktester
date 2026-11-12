// yearly.js: ENJ ONE GRT KSM UNI ANKR on each bot and the TRI mix, per calendar year: R, max drawdown inside the year (trade by trade), trades, win rate, losing streak.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '../strat-hunt-nov6'), C = require('../../candles/candles.js');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, WT = { 'BB-CORE': .5, 'I-CORE': .25, 'T-CORE': .25 };
const END = Date.UTC(2026, 10, 12) / 1000, by = id => S.find(s => s.id === id), yr = t => new Date(t * 1e3).getUTCFullYear();
const f = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);
function ys(tr, y) {
  const s = tr.filter(t => yr(t.x) === y).sort((a, b) => a.x - b.x); let e = 0, pk = 0, dd = 0, ls = 0, cur = 0;
  for (const t of s) { e += t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); cur = t.R <= 0 ? cur + 1 : 0; ls = Math.max(ls, cur); }
  return { n: s.length, R: e, dd, win: s.length ? s.filter(t => t.R > 0).length / s.length : 0, ls };
}
function all(tr) { const s = [...tr].sort((a, b) => a.x - b.x); let e = 0, pk = 0, dd = 0, ls = 0, cur = 0; for (const t of s) { e += t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); cur = t.R <= 0 ? cur + 1 : 0; ls = Math.max(ls, cur); } return { n: s.length, R: e, dd, win: s.filter(t => t.R > 0).length / s.length, ls }; }
const cell = s => s.n ? `${f(s.R)} / ${s.dd.toFixed(1)} / ${s.n} / ${(s.win * 100).toFixed(0)}%` : '-';
const out = ['Each cell: R / max drawdown inside the year (R, trade by trade) / trades / win rate. TRI = 0.5 BB + 0.25 I + 0.25 T. Bots at own 1% risk, real fees, slippage, funding. 2026 = to Nov 12.\n'];
for (const c of ['ENJ', 'ONE', 'GRT', 'KSM', 'UNI', 'ANKR']) {
  const B = C.load(c, '4h').map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })), F = C.funding(c);
  const x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  const T = {}, tri = [];
  for (const [bot, p] of Object.entries(BOTS)) { T[bot] = run(B, x.atr14, built[p], exitOf(p, x), F, 14400, COST).trades.filter(t => t.tExit <= END).map(t => ({ x: t.tExit, R: t.R })); T[bot].forEach(t => tri.push({ x: t.x, R: t.R * WT[bot] })); }
  T.TRI = tri;
  const years = [...new Set(tri.map(t => yr(t.x)))].sort();
  out.push(`### ${c}\n| Year | BB-CORE | I-CORE | T-CORE | TRI mix |\n|---|---|---|---|---|`);
  for (const y of years) out.push(`| ${y} | ${['BB-CORE', 'I-CORE', 'T-CORE', 'TRI'].map(k => cell(ys(T[k], y))).join(' | ')} |`);
  out.push(`| **All years** | ${['BB-CORE', 'I-CORE', 'T-CORE', 'TRI'].map(k => { const a = all(T[k]); return `**${f(a.R)} / ${a.dd.toFixed(1)} / ${a.n} / ${(a.win * 100).toFixed(0)}%**`; }).join(' | ')} |`);
  out.push(`| Longest losing streak | ${['BB-CORE', 'I-CORE', 'T-CORE', 'TRI'].map(k => all(T[k]).ls).join(' | ')} |\n`);
}
fs.writeFileSync(path.join(__dirname, 'YEARLY-SIX.md'), out.join('\n'));
console.log(out.join('\n'));
