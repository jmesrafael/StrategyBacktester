// compare3.js — side by side: BB-CORE 4h (live bot) vs BB-CORE 1h (2.0σ) vs BB-1H-WIDE (2.6σ), live coins,
// fresh PHP 1,000 every Jan 1, month by month. Same sizing as months.js (live risk steps, trade counted in the month it closes).
'use strict';
const L = require('./lib.js'), V = require('./fam-vol.js');
const { run } = require('../strat-hunt-nov6/engine.js'), { S, makeCtx, exitOf } = require('../strat-hunt-nov6/strategies.js');
const PHP = 60, TIERS = [[0, 0.025], [500 * PHP, 0.02], [1000 * PHP, 0.015]], START = 1000;
const pct = (pk) => { let p = TIERS[0][1]; for (const [b, r] of TIERS) if (pk >= b) p = r; return p; };
const LIVE = ['SOL', 'NEAR', 'ADA', 'GALA', 'ZEC', 'ARB'], E = { kind: 'M', bars: 192 }, Y = L.YEARS;
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ym = (t) => { const d = new Date(t * 1000); return [d.getUTCFullYear(), d.getUTCMonth()]; };
const one = (mult) => L.evaluate(V.strat({ len: 80, mult, trend: 800, minStop: 0.3, filt: null }, E), V.mkEx(E), LIVE, 1, true).trades;
function core4h() { const s = S.find((x) => x.id === 'bb-core'), out = []; for (const cn of LIVE) { const B = L.C.load(cn, '4h').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })); const c = makeCtx(B, '4h'); for (const t of run(B, c.atr14, s.build(c), exitOf('BBX', c), L.C.funding(cn), 14400).trades) if (t.tExit >= 1577836800) out.push(t); } return out; }
function sim(tr) {
  const ev = []; tr.forEach((t, i) => { ev.push([t.t, 0, i]); ev.push([t.tExit, 1, i]); }); ev.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const acc = {}, get = (y) => acc[y] || (acc[y] = { bal: START, peak: START, dd: 0, n: 0, w: 0, m: {} }), risk = {};
  for (const [ts, k, i] of ev) {
    const yE = ym(tr[i].tExit)[0];
    if (k === 0) { const a = get(yE); risk[i] = ym(ts)[0] === yE ? a.bal * pct(a.peak) : START * pct(START); }
    else { const a = get(yE), mo = ym(ts)[1], R = tr[i].R, p = R * risk[i], mm = a.m[mo] = a.m[mo] || { n: 0, start: a.bal, pnl: 0 }; mm.n++; mm.pnl += p; a.bal += p; a.n++; if (R > 0) a.w++; a.peak = Math.max(a.peak, a.bal); a.dd = Math.max(a.dd, 1 - a.bal / a.peak); }
  }
  return acc;
}
const N = ['BB-CORE 4h (live bot)', 'BB-CORE 1h (2.0σ)', 'BB-1H-WIDE (2.6σ)'];
const A = [sim(core4h()), sim(one(2.0)), sim(one(2.6))];
const kb = (v) => v >= 1e4 ? (v / 1e3).toFixed(1) + 'k' : Math.round(v).toLocaleString('en-US');
const sg = (v) => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
let o = '## Yearly: fresh PHP 1,000 each Jan 1 → year end (worst fall inside the year)\n| Year | ' + N.join(' | ') + ' | Best |\n|---|---|---|---|---|\n';
const wins = [0, 0, 0];
for (const y of Y) { const v = A.map((a) => a[y].bal), b = v.indexOf(Math.max(...v)); wins[b]++; o += `| ${y} | ${A.map((a) => `${kb(a[y].bal)} (${sg(a[y].bal / START - 1)}, −${Math.round(a[y].dd * 100)}%)`).join(' | ')} | ${N[b].split(' (')[0]} |\n`; }
o += `\nYears best: ${N.map((n, i) => n + ' ' + wins[i]).join(', ')}\n`;
// summary
o += '\n## Summary (81 months, Mar 2020 – Nov 2026)\n| | ' + N.join(' | ') + ' |\n|---|---|---|---|\n';
const ms = A.map((a) => Y.flatMap((y) => Object.values(a[y].m).map((m) => m.pnl / m.start)));
const row = (lab, f) => o += `| ${lab} | ${A.map((a, i) => f(a, i)).join(' | ')} |\n`;
row('Trades', (a) => Y.reduce((s, y) => s + a[y].n, 0));
row('Trades per month', (a) => (Y.reduce((s, y) => s + a[y].n, 0) / 81).toFixed(0));
row('Win rate', (a) => Math.round(100 * Y.reduce((s, y) => s + a[y].w, 0) / Y.reduce((s, y) => s + a[y].n, 0)) + '%');
row('Average year (fresh 1,000)', (a) => sg(Y.reduce((s, y) => s + a[y].bal / START - 1, 0) / Y.length));
row('Worst year', (a) => sg(Math.min(...Y.map((y) => a[y].bal / START - 1))));
row('Worst fall inside a year', (a) => '−' + Math.round(100 * Math.max(...Y.map((y) => a[y].dd))) + '%');
row('Positive months', (a, i) => `${ms[i].filter((v) => v > 0).length} of ${ms[i].length}`);
row('Best month', (a, i) => sg(Math.max(...ms[i])));
row('Worst month', (a, i) => sg(Math.min(...ms[i])));
// monthly side by side, one table per year
o += '\n## Month by month (% that month; balance at month end)\n';
for (const y of Y) {
  o += `\n### ${y}\n| Month | ${N.join(' | ')} |\n|---|---|---|---|\n`;
  const bal = [START, START, START];
  for (let mo = 0; mo < 12; mo++) {
    if (y === 2026 && mo > 10) break;
    const cells = A.map((a, i) => { const mm = a[y].m[mo]; if (!mm) return `0% · ${kb(bal[i])}`; bal[i] = mm.start + mm.pnl; return `${sg(mm.pnl / mm.start)} · ${kb(bal[i])}`; });
    o += `| ${M[mo]} | ${cells.join(' | ')} |\n`;
  }
}
require('fs').writeFileSync('compare3.md', o); console.log(o);
