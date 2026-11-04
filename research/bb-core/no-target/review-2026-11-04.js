'use strict';
// review-2026-11-04.js: the statistics behind REVIEW-2026-11-04.md, in one re-runnable script (read-only, no network).
//   node review-2026-11-04.js            (STRAT_ROOT = folder holding bb-core, same as lib.js)
// Uses bb-core's own backtest() (lucidio-core.js, no-target default) on data/<COIN>.json + funding, five coins, fees + funding included.
// Prints: win/loss R stats, win buckets, per year, per month (79 months), month-loss odds, losing streaks, no-target vs 1:4, "how normal is a bad start".
// Also writes monthly-r.csv next to this file.
const fs = require('fs'), path = require('path');
const ROOT = (process.env.STRAT_ROOT || 'c:/Users/WEB.WEB-DEVPC1/Desktop/testing/Strat').replace(/\/?$/, '/') + 'bb-core/';
const { backtest } = require(ROOT + 'lucidio-core.js');
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const fund = (c) => { const f = path.join(ROOT, 'data', 'funding', c + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const run = (targetR) => COINS.flatMap((c) => {
  const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', c + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  return backtest(B, { targetR }, fund(c)).trades.map((t) => ({ c, t: t.t, R: t.R, why: t.why }));
}).sort((a, b) => a.t - b.t);
const A = run(0), T = run(4);   // A = no target (live now), T = old 1:4
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const f2 = (x) => x.toFixed(2), f1 = (x) => x.toFixed(1);
const st = (l, a) => a.length && console.log(l.padEnd(11), String(a.length).padStart(5), 'mean', f2(mean(a)), 'med', f2(q(a, .5)), 'p25', f2(q(a, .25)), 'p75', f2(q(a, .75)), 'p90', f2(q(a, .9)), 'max', f2(Math.max(...a)), 'min', f2(Math.min(...a)));
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
const lastFull = '2026-10';   // the data ends in October 2026: months before this are complete

console.log('=== 1. PER-TRADE R (no target)', A.length, 'trades');
const W = A.filter((t) => t.R > 0), L = A.filter((t) => t.R <= 0);
console.log('win rate', f1(100 * W.length / A.length) + '%', ' expectancy', mean(A.map((t) => t.R)).toFixed(3) + 'R');
st('WINS', W.map((t) => t.R)); st('LOSSES', L.map((t) => t.R));
for (const w of ['stop', 'time']) st('exit:' + w, A.filter((t) => t.why === w).map((t) => t.R));
for (const [a, b] of [[0, 1], [1, 2], [2, 4], [4, 8], [8, 1e9]]) { const x = W.filter((t) => t.R > a && t.R <= b); console.log(`wins ${a}-${b > 1e8 ? '+' : b}R`.padEnd(14), x.length, f1(100 * x.length / W.length) + '% of wins', f1(x.reduce((s, t) => s + t.R, 0)) + 'R'); }
const top = [...W].sort((a, b) => b.R - a.R); console.log('top 10 wins', f1(top.slice(0, 10).reduce((s, t) => s + t.R, 0)) + 'R of', f1(W.reduce((s, t) => s + t.R, 0)) + 'R total wins');

console.log('\n=== 2. PER YEAR (no target)');
for (let y = 2020; y <= 2026; y++) { const x = A.filter((t) => new Date(t.t * 1000).getUTCFullYear() === y); if (!x.length) continue; const w = x.filter((t) => t.R > 0).map((t) => t.R), l = x.filter((t) => t.R <= 0).map((t) => t.R); console.log(y, 'n', x.length, 'win%', f1(100 * w.length / x.length), 'avgWin', f2(mean(w)), 'medWin', f2(q(w, .5)), 'avgLoss', f2(mean(l)), 'expect', f2(mean(x.map((t) => t.R)))); }

console.log('\n=== 3. PER MONTH (complete months only, before', lastFull + ')');
const M = {}; for (const t of A) (M[ym(t.t)] = M[ym(t.t)] || []).push(t.R);
const ks = Object.keys(M).sort().filter((k) => k < lastFull), rows = ['month,trades,wins,winrate,avgWinR,medWinR,avgLossR,netR,expectancyR'];
for (const k of ks) { const x = M[k], w = x.filter((r) => r > 0), l = x.filter((r) => r <= 0); rows.push([k, x.length, w.length, f2(w.length / x.length), w.length ? f2(mean(w)) : '', w.length ? f2(q(w, .5)) : '', l.length ? f2(mean(l)) : '', f1(x.reduce((s, r) => s + r, 0)), f2(mean(x))].join(',')); }
fs.writeFileSync(path.join(__dirname, 'monthly-r.csv'), rows.join('\n') + '\n');
const net = ks.map((k) => M[k].reduce((s, r) => s + r, 0));
st('avgWin/mo', ks.map((k) => M[k].filter((r) => r > 0)).filter((w) => w.length).map(mean)); st('netR/mo', net); st('wins/mo', ks.map((k) => M[k].filter((r) => r > 0).length)); st('trades/mo', ks.map((k) => M[k].length));
const since = ks.filter((k) => k >= '2022-01'), sn = since.map((k) => M[k].reduce((s, r) => s + r, 0));
console.log('since 2022:', since.length, 'months; negative', sn.filter((x) => x < 0).length, '(' + f1(100 * sn.filter((x) => x < 0).length / sn.length) + '%); months with ZERO winners', since.filter((k) => !M[k].some((r) => r > 0)).length);
console.log('Novembers:', ks.filter((k) => k.endsWith('-11')).map((k) => k + ' ' + M[k].length + 'tr ' + f1(M[k].reduce((s, r) => s + r, 0)) + 'R').join(' | '));
let run1 = 0, best = 0; for (const x of sn) { if (x < 0) { run1++; best = Math.max(best, run1); } else run1 = 0; } console.log('longest run of consecutive negative months:', best);

console.log('\n=== 4. LOSING STREAKS (trades, all five coins merged by entry time)');
let s = 0, ls = 0; for (const t of A) { if (t.R <= 0) { s++; ls = Math.max(ls, s); } else s = 0; } console.log('longest losing streak', ls);
for (const n of [7, 10, 15, 18]) { let c = 0, tot = 0; for (let i = 0; i + n <= A.length; i++) { tot++; if (A.slice(i, i + n).every((t) => t.R <= 0)) c++; } console.log(`windows of ${n} trades all losing: ${c}/${tot} = ${f2(100 * c / tot)}%`); }

console.log('\n=== 5. HOW NORMAL IS A BAD START (windows in the history)');
const all7 = []; for (let i = 0; i + 7 <= A.length; i++) all7.push(A.slice(i, i + 7).reduce((s2, t) => s2 + t.R, 0));
console.log('7-trade windows at -5R or worse:', f1(100 * all7.filter((x) => x <= -5).length / all7.length) + '%');
const D = 86400, t0 = Date.parse('2022-01-01') / 1000, t1 = Date.parse('2026-10-22') / 1000; let n30 = 0, b5 = 0, b12 = 0;
for (let st0 = t0; st0 + 30 * D <= t1; st0 += D) { n30++; const R = A.filter((t) => t.t >= st0 && t.t < st0 + 30 * D).reduce((a, t) => a + t.R, 0); if (R <= -5) b5++; if (R <= -12) b12++; }
console.log('30-day windows at -5R or worse:', f1(100 * b5 / n30) + '%; at -12R or worse:', f1(100 * b12 / n30) + '%');
const sorted = Object.keys(M).filter((k) => k >= '2022-01').sort((a, b) => M[a].reduce((s2, r) => s2 + r, 0) - M[b].reduce((s2, r) => s2 + r, 0));
console.log('worst months since 2022:', sorted.slice(0, 5).map((k) => k + ' ' + f1(M[k].reduce((s2, r) => s2 + r, 0)) + 'R').join(', '), '(Oct 2026 is partial data, ends ~Oct 21-26)');

console.log('\n=== 6. NO TARGET vs 1:4 (same coins, same entries, trades counted by entry date)');
const sum = (a, f, to) => { const x = a.filter((t) => t.t >= Date.parse(f) / 1000 && t.t < Date.parse(to) / 1000); const R = x.reduce((s2, t) => s2 + t.R, 0); return `${String(x.length).padStart(4)} tr ${(R >= 0 ? '+' : '') + R.toFixed(0)}R ${f2(R / x.length)}R/tr win ${Math.round(100 * x.filter((t) => t.R > 0).length / x.length)}%`; };
const per = [...[2020, 2021, 2022, 2023, 2024, 2025].map((y) => [String(y), y + '-01-01', (y + 1) + '-01-01']), ['2026 YTD', '2026-01-01', '2026-11-01'], ['last 6 mo', '2026-04-01', '2026-10-22'], ['last 3 mo', '2026-07-01', '2026-10-22']];
for (const [l, f, to] of per) console.log(l.padEnd(10), 'noTarget', sum(A, f, to), ' | 1:4', sum(T, f, to));
const dd = (a) => { let e = 0, p = 0, d = 0; for (const t of a) { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); } return d; };
console.log('max drawdown (sum of R in order): noTarget', f1(dd(A)) + 'R, 1:4', f1(dd(T)) + 'R');

console.log('\n=== 7. RUN FOR N MONTHS UNTOUCHED (rolling windows of N x 30 days, any start day since 2022, before Oct 22 2026)');
for (const months of [1, 3, 6]) {
  const len = months * 30 * D, res = [], ntr = [];
  for (let st0 = t0; st0 + len <= t1; st0 += D) { const x = A.filter((t) => t.t >= st0 && t.t < st0 + len); res.push(x.reduce((a, t) => a + t.R, 0)); ntr.push(x.length); }
  console.log(`${months} mo: ${res.length} windows | trades median ${q(ntr, .5)} | net R p5 ${f1(q(res, .05))} p10 ${f1(q(res, .1))} p25 ${f1(q(res, .25))} med ${f1(q(res, .5))} p75 ${f1(q(res, .75))} p90 ${f1(q(res, .9))} | negative ${f1(100 * res.filter((x) => x < 0).length / res.length)}% | worse than -10R ${f1(100 * res.filter((x) => x < -10).length / res.length)}%`);
}
