// sui-arb-check.js — SUI and ARB against today's live lineups (BB-CORE: SOL ZEC NEAR ADA GALA; T-CORE: SOL ZEC NEAR ADA GALA ETH), Jun 2023 -> Oct 2026
// (both coins trade from spring 2023). Each coin alone by year, and the lineup with / without it: profit, worst drop, losing months, Sharpe, best-month share.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'T-CORE': 'P14' }, LINE = { 'BB-CORE': ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], 'T-CORE': ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH'] };
const ADD = { 'BB-CORE': [['ARB']], 'T-CORE': [['SUI'], ['ARB'], ['SUI', 'ARB']] };
const A = Date.UTC(2023, 5, 1) / 1000, E = Date.UTC(2026, 10, 1) / 1000;
const load = (c) => { const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'data4h', c + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })); const fp = path.join(__dirname, 'funding', c + '.json'); return { B, F: fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null }; };
const by = (id) => S.find((s) => s.id === id), T = {};
for (const c of ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB']) { const { B, F } = load(c), x = makeCtx(B, '4h'), bbc = by('bb-core').build(x); T[c] = { 'BB-CORE': run(B, x.atr14, bbc, exitOf('BBX', x), F && F.length ? F : null, 14400, COST).trades, 'T-CORE': run(B, x.atr14, { ...bbc, stopL: null, stopS: null }, exitOf('P14', x), F && F.length ? F : null, 14400, COST).trades }; }
const keys = []; for (let d = new Date(A * 1000); d.getTime() / 1000 < E; d.setUTCMonth(d.getUTCMonth() + 1)) keys.push(d.toISOString().slice(0, 7));
function m(tr) { tr = tr.filter((t) => t.tExit > A && t.tExit <= E).sort((a, b) => a.tExit - b.tExit); const mo = Object.fromEntries(keys.map((k) => [k, 0])); for (const t of tr) mo[new Date(t.tExit * 1000).toISOString().slice(0, 7)] += t.R;
  const mv = keys.map((k) => mo[k]); let e = 0, p = 0, d = 0; for (const t of tr) { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); }
  const mean = mv.reduce((a, b) => a + b, 0) / mv.length, sd = Math.sqrt(mv.reduce((a, v) => a + (v - mean) ** 2, 0) / (mv.length - 1)), best = Math.max(...mv);
  const y = {}; for (const t of tr) { const k = new Date(t.tExit * 1000).getUTCFullYear(); y[k] = (y[k] || 0) + t.R; }
  let neg = 0, n = 0; for (let i = 0; i + 12 <= mv.length; i++) { n++; if (mv.slice(i, i + 12).reduce((a, b) => a + b, 0) < 0) neg++; }
  return { total: e, dd: d, lose: mv.filter((v) => v < 0).length / mv.length, sharpe: (mean / sd) * Math.sqrt(12), bestShare: best / e, bestMonth: keys[mv.indexOf(best)], years: y, neg12: neg / n, n: tr.length }; }
const pc = (v) => (v * 100).toFixed(0) + '%', f = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
for (const b of Object.keys(BOTS)) {
  const base = m(LINE[b].flatMap((c) => T[c][b]));
  console.log(`\n=== ${b} today (${LINE[b].join(', ')}), Jun 2023 -> Oct 2026: ${f(base.total)}R, worst drop ${base.dd.toFixed(1)}R, losing months ${pc(base.lose)}, Sharpe ${base.sharpe.toFixed(2)}`);
  for (const c of [...new Set(ADD[b].flat())]) { const a = m(T[c][b]); console.log(`   ${c} alone: ${a.n} trades ${f(a.total)}R | years ${Object.entries(a.years).map(([y, v]) => y + ' ' + f(v)).join(', ')} | losing months ${pc(a.lose)} | worst drop ${a.dd.toFixed(1)}R | 12-mo windows negative ${pc(a.neg12)} | best month ${a.bestMonth} = ${pc(a.bestShare)} of its profit`); }
  for (const add of ADD[b]) { const w = m([...LINE[b], ...add].flatMap((c) => T[c][b])); console.log(`   + ${add.join('+').padEnd(7)}: ${f(w.total)}R (${f(w.total - base.total)}), worst drop ${w.dd.toFixed(1)}R (${f(w.dd - base.dd)}), losing months ${pc(w.lose)}, Sharpe ${w.sharpe.toFixed(2)}, 12-mo neg ${pc(w.neg12)}`); }
}
