// coin-worth.js — is ETH worth adding to I-CORE, and BNB to T-CORE? Judged on each coin's WHOLE history with the LIVE bot cores (rules v3).
//   1. the coin alone, every year it has data (ETH from 2016, BNB from late 2017)
//   2. the bot with and without the coin, 2020 -> Nov 2026: profit, worst drop, losing streak, losing months, year by year
//   3. does the coin lose when the bot loses? (monthly correlation, result during the bot's worst months and inside its worst drop)
//   4. how much of the coin's profit is a few giant trades; first half vs second half
//   node coin-worth.js
'use strict';
const path = require('path'), fs = require('fs');
const { load, LINEUP, START, END } = require('./lab.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const CASES = [
  { bot: 'I-CORE', coin: 'ETH', core: require(path.join(ROOT, '🔴I-Core', 'icore-core.js')), base: LINEUP['I-CORE'] },
  { bot: 'T-CORE', coin: 'BNB', core: require(path.join(ROOT, '🔴StrategyBacktester', 'bb-trail', 'icore-core.js')), base: LINEUP['T-CORE'] },
];
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d), pc = (v) => (v * 100).toFixed(0) + '%', sum = (a) => a.reduce((s, v) => s + v, 0);
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7), yr = (t) => ym(t).slice(0, 4);
function measure(tr, from, to) {
  tr = tr.filter((t) => t.t1 > from && t.t1 <= to).sort((a, b) => a.t1 - b.t1);
  let e = 0, p = 0, dd = 0, ls = 0, cur = 0, ddFrom = null, ddTo = null, pkT = from; for (const t of tr) { e += t.R; if (e > p) { p = e; pkT = t.t1; } if (p - e > dd) { dd = p - e; ddFrom = pkT; ddTo = t.t1; } cur = t.R <= 0 ? cur + 1 : 0; ls = Math.max(ls, cur); }
  const m = {}; for (let d = new Date(from * 1000); d.getTime() / 1000 < to; d.setUTCMonth(d.getUTCMonth() + 1, 1)) m[d.toISOString().slice(0, 7)] = 0;
  const y = {}; for (const t of tr) { if (ym(t.t1) in m) m[ym(t.t1)] += t.R; y[yr(t.t1)] = (y[yr(t.t1)] || 0) + t.R; }
  const mv = Object.values(m), w = tr.filter((t) => t.R > 0);
  return { n: tr.length, R: e, dd, ddFrom, ddTo, ls, loseM: mv.filter((v) => v < 0).length / mv.length, wr: tr.length ? w.length / tr.length : 0, yrs: y, months: m, pf: sum(w.map((t) => t.R)) / -sum(tr.filter((t) => t.R <= 0).map((t) => t.R)) };
}
const corr = (a, b) => { const n = a.length, ma = sum(a) / n, mb = sum(b) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return c / Math.sqrt(va * vb); };
const out = {};
for (const k of CASES) {
  const run = (c) => k.core.backtest(load(c).B, {}).trades.map((t) => ({ c, t0: t.t, t1: t.tExit, R: t.R, bars: t.bars, d: t.dir }));
  const own = run(k.coin), first = load(k.coin).B[0].time, ownAll = measure(own, first, END);
  const baseTr = k.base.flatMap(run), A = measure(baseTr, START, END), Bm = measure([...baseTr, ...own], START, END), ownWin = measure(own, START, END);
  console.log(`\n======== ${k.coin} on ${k.bot} (live core, rules v3) ========`);
  console.log(`1) ${k.coin} ALONE, whole history ${new Date(first * 1000).toISOString().slice(0, 7)} -> Nov 2026: ${ownAll.n} trades, ${f(ownAll.R)}R, win ${pc(ownAll.wr)}, PF ${ownAll.pf.toFixed(2)}, worst drop ${ownAll.dd.toFixed(0)}R (${ym(ownAll.ddFrom)} -> ${ym(ownAll.ddTo)}), longest losing streak ${ownAll.ls}`);
  const ys = Object.entries(ownAll.yrs).sort(); console.log('   by year: ' + ys.map(([y, v]) => `${y} ${f(v)}`).join(' | '));
  console.log(`   years up ${ys.filter(([, v]) => v > 0).length} of ${ys.length}; worst year ${f(Math.min(...ys.map(([, v]) => v)))}R; best year ${f(Math.max(...ys.map(([, v]) => v)))}R = ${pc(Math.max(...ys.map(([, v]) => v)) / ownAll.R)} of all its profit`);
  const sorted = [...own].sort((a, b) => b.R - a.R), top = (n) => sum(sorted.slice(0, n).map((t) => t.R));
  console.log(`   giant trades: best 3 = ${f(top(3))}R (${pc(top(3) / ownAll.R)} of profit), best 5 = ${f(top(5))}R (${pc(top(5) / ownAll.R)}); without the best 5: ${f(ownAll.R - top(5))}R; best trades: ${sorted.slice(0, 5).map((t) => `${f(t.R, 1)}R ${ym(t.t1)}`).join(', ')}`);
  const mid = (first + END) / 2, h1 = measure(own, first, mid), h2 = measure(own, mid, END);
  console.log(`   halves: first (to ${ym(mid)}) ${f(h1.R)}R in ${h1.n} trades · second ${f(h2.R)}R in ${h2.n} trades | last 3 years (Nov 2023 ->): ${f(measure(own, END - 3 * 365.25 * 86400, END).R)}R | last 12 months: ${f(measure(own, END - 365.25 * 86400, END).R)}R`);
  // rolling 12-month result of the coin alone
  const mk = Object.keys(ownAll.months), mvv = Object.values(ownAll.months); let neg = 0, cnt = 0, worst = Infinity; for (let i = 0; i + 12 <= mvv.length; i++) { const s = sum(mvv.slice(i, i + 12)); cnt++; if (s < 0) neg++; worst = Math.min(worst, s); }
  console.log(`   any 12 months in a row: negative ${neg} of ${cnt} windows (${pc(neg / cnt)}), worst 12 months ${f(worst)}R; months with a loss ${pc(ownAll.loseM)}`);

  console.log(`2) ${k.bot} 2020 -> Nov 2026, WITHOUT vs WITH ${k.coin}`);
  const L = (m) => `${f(m.R).padStart(6)}R  worst drop ${m.dd.toFixed(1).padStart(5)}R  losing streak ${String(m.ls).padStart(2)}  losing months ${pc(m.loseM)}  profit/drop ${(m.R / m.dd).toFixed(1)}`;
  console.log(`   without  ${L(A)}\n   with     ${L(Bm)}`);
  const yrsAll = Object.keys(A.yrs).sort();
  console.log('   year      ' + yrsAll.map((y) => y.padStart(7)).join(''));
  console.log('   without   ' + yrsAll.map((y) => f(A.yrs[y]).padStart(7)).join(''));
  console.log(`   ${k.coin} adds  ` + yrsAll.map((y) => f(ownWin.yrs[y] || 0).padStart(7)).join(''));
  console.log(`   ${k.coin} added profit in ${yrsAll.filter((y) => (ownWin.yrs[y] || 0) > 0).length} of ${yrsAll.length} years`);
  // drop of each year with / without
  const ddY = (tr, y) => measure(tr, Date.UTC(+y, 0, 1) / 1000, Math.min(END, Date.UTC(+y + 1, 0, 1) / 1000)).dd;
  console.log('   worst drop inside each year, without -> with: ' + yrsAll.map((y) => `${y} ${ddY(baseTr, y).toFixed(0)}->${ddY([...baseTr, ...own], y).toFixed(0)}`).join(' | '));

  console.log(`3) does ${k.coin} lose when the bot loses?`);
  const keys = Object.keys(A.months), a = keys.map((m) => A.months[m]), b = keys.map((m) => ownWin.months[m] || 0);
  const badIdx = [...keys.keys()].sort((i, j) => a[i] - a[j]).slice(0, 15), lossIdx = [...keys.keys()].filter((i) => a[i] < 0);
  console.log(`   monthly correlation with the rest of the bot: ${corr(a, b).toFixed(2)} (0 = independent, 1 = moves together)`);
  console.log(`   in the bot's ${lossIdx.length} losing months, ${k.coin} made ${f(sum(lossIdx.map((i) => b[i])), 1)}R in total (up in ${lossIdx.filter((i) => b[i] > 0).length}, down in ${lossIdx.filter((i) => b[i] < 0).length}, no trade in ${lossIdx.filter((i) => b[i] === 0).length})`);
  console.log(`   in the bot's 15 worst months (${f(sum(badIdx.map((i) => a[i])))}R), ${k.coin} made ${f(sum(badIdx.map((i) => b[i])), 1)}R`);
  const inDD = measure(own, A.ddFrom, A.ddTo);
  console.log(`   inside the bot's worst drop without it (${A.dd.toFixed(0)}R, ${ym(A.ddFrom)} -> ${ym(A.ddTo)}): ${k.coin} made ${f(inDD.R, 1)}R in ${inDD.n} trades`);
  console.log(`   the worst drop WITH ${k.coin}: ${Bm.dd.toFixed(0)}R, ${ym(Bm.ddFrom)} -> ${ym(Bm.ddTo)}; ${k.coin} alone lost ${f(measure(own, Bm.ddFrom, Bm.ddTo).R, 1)}R inside it`);
  // how often does adding the coin help over any 12-month window
  const tot = keys.map((_, i) => a[i] + b[i]); let better = 0, n12 = 0, negA = 0, negB = 0; for (let i = 0; i + 12 <= keys.length; i++) { const sa = sum(a.slice(i, i + 12)), sb = sum(tot.slice(i, i + 12)); n12++; if (sb > sa) better++; if (sa < 0) negA++; if (sb < 0) negB++; }
  console.log(`   any 12 months in a row (${n12} windows): with ${k.coin} was better in ${better} (${pc(better / n12)}); losing windows without ${negA}, with ${negB}`);
  out[k.coin] = { bot: k.bot, alone: { n: ownAll.n, R: ownAll.R, dd: ownAll.dd, ls: ownAll.ls, wr: ownAll.wr, pf: ownAll.pf, yrs: ownAll.yrs, top5: top(5), h1: h1.R, h2: h2.R }, without: { R: A.R, dd: A.dd, ls: A.ls, loseM: A.loseM, yrs: A.yrs }, with: { R: Bm.R, dd: Bm.dd, ls: Bm.ls, loseM: Bm.loseM, yrs: Bm.yrs }, corr: corr(a, b) };
}
fs.writeFileSync(path.join(__dirname, 'coin-worth.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
