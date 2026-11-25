// c-robust.js: tests the earlier studies did not run.
//  1. joint neighbourhood: ADX threshold x ADX length x II length (BB-CORE alone; R/DDo is scale-free, so the 1.05x does not matter)
//  2. sub-periods (years) for each rule and for the whole account
//  3. coin-level contribution
//  4. paired block bootstrap of New - Current (whole account, mark to market)
//  5. II computed on MEXC candles instead of Binance (what the live bot would see)
'use strict';
const K = require('./core');
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d);
const Y = (y) => Date.UTC(y, 0, 1) / 1000, CUT = Y(2024);
const bb = (o, a = K.T0, b = K.END) => K.book([{ trades: K.bbTrades(o), weight: 1 }], a, b);
const base = { all: bb({}), is: bb({}, K.T0, CUT), oos: bb({}, CUT) };
const rdd = (r) => r.R / r.mdd;
console.log(`BB live: R/DDo all ${rdd(base.all).toFixed(2)}  2020-23 ${rdd(base.is).toFixed(2)}  2024-26 ${rdd(base.oos).toFixed(2)}`);

// 1. grid
const TH = [20, 22, 25, 27, 30, 33, 36, 40], AL = [10, 14, 20, 28], IL = [0, 10, 14, 21, 28, 35];
const grid = [];
for (const al of AL) for (const th of TH) for (const il of IL) {
  const o = { adxTh: th, adxLen: al, ...(il ? { iiShort: true, iiLen: il } : {}) };
  const all = bb(o), is = bb(o, K.T0, CUT), oos = bb(o, CUT);
  grid.push({ al, th, il, all: rdd(all) / rdd(base.all), is: rdd(is) / rdd(base.is), oos: rdd(oos) / rdd(base.oos), eqR: all.R / all.avgW - base.all.R, eqRoos: oos.R / oos.avgW - base.oos.R, ddo: all.mdd / all.avgW, ddc: all.dd / all.avgW });
}
const pct = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
console.log(`\nGrid ${grid.length} settings. R/DDo ratio vs live (1 = same):`);
for (const k of ['all', 'is', 'oos']) console.log(`  ${k}: min ${pct(grid.map((g) => g[k]), 0).toFixed(2)} p10 ${pct(grid.map((g) => g[k]), 0.1).toFixed(2)} median ${pct(grid.map((g) => g[k]), 0.5).toFixed(2)} p90 ${pct(grid.map((g) => g[k]), 0.9).toFixed(2)}; share > 1: ${(100 * grid.filter((g) => g[k] > 1).length / grid.length).toFixed(0)}%`);
console.log(`  equal-average-risk extra R vs live, all years: median ${f(pct(grid.map((g) => g.eqR), 0.5))} p10 ${f(pct(grid.map((g) => g.eqR), 0.1))}; 2024-26: median ${f(pct(grid.map((g) => g.eqRoos), 0.5))} p10 ${f(pct(grid.map((g) => g.eqRoos), 0.1))}`);
const chosen = grid.find((g) => g.al === 14 && g.th === 27 && g.il === 21);
const rank = (k) => 1 + grid.filter((g) => g[k] > chosen[k]).length;
console.log(`  chosen (14, 27, 21): all ${chosen.all.toFixed(2)} (rank ${rank('all')}/${grid.length}) 2020-23 ${chosen.is.toFixed(2)} (rank ${rank('is')}) 2024-26 ${chosen.oos.toFixed(2)} (rank ${rank('oos')}); equal-risk extra R ${f(chosen.eqR)} / 2024-26 ${f(chosen.eqRoos)}`);
console.log('\nII length x ADX threshold, ADX length 14: R/DDo ratio vs live, 2024-26 (all years in brackets)');
console.log('| II len \\ ADX th | ' + TH.join(' | ') + ' |'); console.log('|' + '---|'.repeat(TH.length + 1));
for (const il of IL) console.log(`| ${il || 'none'} | ` + TH.map((th) => { const g = grid.find((x) => x.al === 14 && x.th === th && x.il === il); return `${g.oos.toFixed(2)} (${g.all.toFixed(2)})`; }).join(' | ') + ' |');
console.log('\nADX length x threshold, II 21: R/DDo ratio vs live, 2024-26 (all years)');
console.log('| ADX len \\ th | ' + TH.join(' | ') + ' |'); console.log('|' + '---|'.repeat(TH.length + 1));
for (const al of AL) console.log(`| ${al} | ` + TH.map((th) => { const g = grid.find((x) => x.al === al && x.th === th && x.il === 21); return `${g.oos.toFixed(2)} (${g.all.toFixed(2)})`; }).join(' | ') + ' |');
// II alone by length (no ADX)
console.log('\nII short filter alone, by length: R / DDc / DDo (all years) | 2024-26 R / DDo');
for (const il of [10, 14, 21, 28, 35]) { const a = bb({ iiShort: true, iiLen: il }), o = bb({ iiShort: true, iiLen: il }, CUT); console.log(`  II ${il}: ${f(a.R)} / ${a.dd.toFixed(1)} / ${a.mdd.toFixed(1)} | ${f(o.R)} / ${o.mdd.toFixed(1)}`); }
console.log(`  live : ${f(base.all.R)} / ${base.all.dd.toFixed(1)} / ${base.all.mdd.toFixed(1)} | ${f(base.oos.R)} / ${base.oos.mdd.toFixed(1)}`);

// 2. years
const V = { live: {}, ii: { iiShort: true, iiLen: 21 }, adx: { adxTh: 27, adxLen: 14 }, both: { iiShort: true, iiLen: 21, adxTh: 27 } };
console.log('\n| Year | BB live R / DDo | II only R / DDo | ADX only R / DDo | both 1.00x R / DDo | T14 R / DDo | T12 R / DDo | Account Current R / DDo | Account New R / DDo |');
console.log('|---|---|---|---|---|---|---|---|---|');
const tb = (k, a, b) => K.book([{ trades: K.tcTrades(k), weight: 1 }], a, b);
for (let y = 2020; y <= 2026; y++) {
  const a = Y(y), b = Math.min(Y(y + 1), K.END), cell = (r) => `${f(r.R)} / ${r.mdd.toFixed(1)}`;
  console.log(`| ${y} | ${cell(bb(V.live, a, b))} | ${cell(bb(V.ii, a, b))} | ${cell(bb(V.adx, a, b))} | ${cell(bb(V.both, a, b))} | ${cell(tb(14, a, b))} | ${cell(tb(12, a, b))} | ${cell(K.book(K.portfolio({}, 14), a, b))} | ${cell(K.book(K.portfolio(K.NEW_BB, 12), a, b))} |`);
}
{ const cell = (r) => `${f(r.R)} / ${r.mdd.toFixed(1)}`; console.log(`| Total (whole period, DDo not summed) | ${cell(bb(V.live))} | ${cell(bb(V.ii))} | ${cell(bb(V.adx))} | ${cell(bb(V.both))} | ${cell(tb(14))} | ${cell(tb(12))} | ${cell(K.book(K.portfolio({}, 14)))} | ${cell(K.book(K.portfolio(K.NEW_BB, 12)))} |`); }

// 3. coins
console.log('\n| Coin | BB live R / DDo | BB tweak 1.00x R / DDo | change R | T14 R / DDo | T12 R / DDo | change R |'); console.log('|---|---|---|---|---|---|---|');
let sb = 0, st = 0;
for (const c of K.COINS.tc) {
  const one = (tr) => K.book([{ trades: tr, weight: 1 }]);
  const l = K.COINS.bb.includes(c) ? one(K.bbTrades({}).filter((t) => t.coin === c)) : null, n = l ? one(K.bbTrades(V.both).filter((t) => t.coin === c)) : null;
  const a = one(K.tcTrades(14).filter((t) => t.coin === c)), b = one(K.tcTrades(12).filter((t) => t.coin === c));
  if (l) sb += n.R - l.R; st += b.R - a.R;
  console.log(`| ${c} | ${l ? `${f(l.R)} / ${l.mdd.toFixed(1)}` : '-'} | ${n ? `${f(n.R)} / ${n.mdd.toFixed(1)}` : '-'} | ${l ? f(n.R - l.R) : '-'} | ${f(a.R)} / ${a.mdd.toFixed(1)} | ${f(b.R)} / ${b.mdd.toFixed(1)} | ${f(b.R - a.R)} |`);
}
console.log(`| Total | | | ${f(sb)} | | | ${f(st)} |`);

// 4. paired block bootstrap (90-day blocks of the 4h mark-to-market increments, same blocks for both)
const cur = K.book(K.portfolio({}, 14)), neu = K.book(K.portfolio(K.NEW_BB, 12)), bbOnlyNew = K.book(K.portfolio(K.NEW_BB, 14)), tOnly = K.book(K.portfolio({}, 12));
const eqExp = K.book(K.portfolio({ mult: 0.913 }, 14));   // Current with BB at the tweak's average risk
function boot(A, B, N = 4000, blk = 540) {
  const n = Math.min(A.inc.length, B.inc.length); let s = 12345; const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
  let moreR = 0, lessDD = 0, both = 0; const dR = [], dDD = [];
  for (let k = 0; k < N; k++) {
    let ca = 0, cb = 0, pa = 0, pb = 0, da = 0, db = 0, len = 0;
    while (len < n) { const st0 = Math.floor(rnd() * (n - blk)); for (let i = st0; i < st0 + blk && len < n; i++, len++) { ca += A.inc[i]; cb += B.inc[i]; pa = Math.max(pa, ca); pb = Math.max(pb, cb); da = Math.max(da, pa - ca); db = Math.max(db, pb - cb); } }
    dR.push(cb - ca); dDD.push(db - da); if (cb > ca) moreR++; if (db < da) lessDD++; if (cb > ca && db <= da) both++;
  }
  return { moreR: moreR / N, lessDD: lessDD / N, both: both / N, dR: [pct(dR, 0.05), pct(dR, 0.5), pct(dR, 0.95)], dDD: [pct(dDD, 0.05), pct(dDD, 0.5), pct(dDD, 0.95)] };
}
console.log('\nPaired block bootstrap, 4,000 resampled 7-year histories of 90-day blocks (account, weighted R, mark to market)');
console.log('| Versus Current | P(more R) | P(smaller open drop) | P(both) | R difference 5% / 50% / 95% | open-drop difference 5% / 50% / 95% |'); console.log('|---|---|---|---|---|---|');
for (const [name, B] of [['New (all three changes)', neu], ['BB tweak 1.05x only', bbOnlyNew], ['T12 only', tOnly], ['Current, BB at 0.913x risk (no new rule)', eqExp]]) {
  const r = boot(cur, B); console.log(`| ${name} | ${(100 * r.moreR).toFixed(0)}% | ${(100 * r.lessDD).toFixed(0)}% | ${(100 * r.both).toFixed(0)}% | ${r.dR.map((v) => f(v)).join(' / ')} | ${r.dDD.map((v) => f(v, 1)).join(' / ')} |`);
}
// BB alone bootstrap: tweak 1.00x vs live at equal average risk
const bbL = K.book([{ trades: K.bbTrades({}), weight: 0.87 }]), bbT = K.book([{ trades: K.bbTrades(V.both), weight: 1 }]);
const rb = boot(bbL, bbT); console.log(`| BB alone: tweak 1.00x vs live at 0.87x (same average risk) | ${(100 * rb.moreR).toFixed(0)}% | ${(100 * rb.lessDD).toFixed(0)}% | ${(100 * rb.both).toFixed(0)}% | ${rb.dR.map((v) => f(v)).join(' / ')} | ${rb.dDD.map((v) => f(v, 1)).join(' / ')} |`);

// 5. II from MEXC candles
console.log('\nII from MEXC candles (5 coins to Oct 2026; ARB and later candles use Binance):');
for (const [n, o] of [['II short only, Binance', V.ii], ['II short only, MEXC', { ...V.ii, iiSrc: 'mexc' }], ['both 1.00x, Binance', V.both], ['both 1.00x, MEXC', { ...V.both, iiSrc: 'mexc' }]]) {
  const a = bb(o), b2 = bb(o, CUT); console.log(`  ${n.padEnd(26)} n ${a.n} R ${f(a.R)} DDc ${a.dd.toFixed(1)} DDo ${a.mdd.toFixed(1)} R/DDo ${rdd(a).toFixed(2)} | 2024-26 R ${f(b2.R)} DDo ${b2.mdd.toFixed(1)}`);
}
