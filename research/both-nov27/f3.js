// f3.js - FAMILY F3 allocation. Grid pre-listed BEFORE running (16 settings). Choice by test 3 (index 2) only, then fitK, then judge.
//  1 vt30   vol target, 30d window, clamp .6-1.5      2 vt60  60d window
//  3 vt60n  60d, clamp .7-1.3 (narrow)
//  4 eq20   bot cumR above its 20-trade avg -> 1 else .6     5 eq40  same 40-trade
//  6 eq20s  symmetric 1.25 above / .75 below (20)           7 eq40s symmetric (40)
//  8 eq20m  mild 1 / .8 (20)
//  9 tilt10 quarterly 10% weight toward best trailing-6mo R/dd bot   10 tilt20  20%
// 11 corr70 x0.7 if same coin+dir open in another bot       12 corr50 x0.5
// 13 vt60+corr70   14 eq40s+corr70   15 tilt10+corr70   16 vt30+eq20s
'use strict';
const fs = require('fs'), H = require('./h.js'), X = require('./causalF3.js');
const D = 86400, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const vt = (win, lo = 0.6, hi = 1.5) => () => {
  const eq = [], vols = [];
  return (c) => {
    const L = eq[eq.length - 1]; if (!L || L[0] !== c.t) eq.push([c.t, c.equity]);
    while (eq.length > 1 && eq[0][0] < c.t - win * D) eq.shift();
    if (eq.length < 8) return 1;
    let s = 0, s2 = 0, n = 0;
    for (let i = 1; i < eq.length; i++) { const dt = (eq[i][0] - eq[i - 1][0]) / D, r = Math.log(Math.max(1e-9, eq[i][1]) / Math.max(1e-9, eq[i - 1][1])) / Math.sqrt(dt); s += r; s2 += r * r; n++; }
    const v = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)); if (!(v > 0)) return 1;
    vols.push(v); if (vols.length < 5) return 1;
    return clamp(med(vols) / v, lo, hi);
  };
};
const eqf = (n, up, dn) => () => (c) => {
  const R = c.trades.filter((x) => x.bot === c.bot).map((x) => x.R); if (R.length < n) return 1;
  const cum = []; let a = 0; for (const r of R) cum.push((a += r));
  const avg = cum.slice(-n).reduce((x, y) => x + y, 0) / n;
  return cum[cum.length - 1] >= avg ? up : dn;
};
const tilt = (a) => () => {
  let q = null, m = { bb: 1, ic: 1, tc: 1 };
  return (c) => {
    const d = new Date(c.t * 1000), k = d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3);
    if (k !== q) {
      q = k; m = { bb: 1, ic: 1, tc: 1 }; const sc = {};
      for (const b of ['bb', 'ic', 'tc']) {
        const T = c.trades.filter((x) => x.bot === b && x.tExit > c.t - 182 * D && x.tExit <= c.t); if (T.length < 5) { sc[b] = null; continue; }
        let cum = 0, pk = 0, dd = 0; for (const x of T) { cum += x.R; pk = Math.max(pk, cum); dd = Math.max(dd, pk - cum); }
        sc[b] = cum / Math.max(dd, 1);
      }
      const ok = Object.keys(sc).filter((b) => sc[b] != null);
      if (ok.length === 3) {
        const best = ok.reduce((x, y) => (sc[y] > sc[x] ? y : x)), W = X.WEIGHT;
        for (const b of ok) m[b] = (W[b] * (1 - a) + (b === best ? a : 0)) / W[b];
      }
    }
    return m[c.bot];
  };
};
const corr = (f) => () => (c) => (c.openTrades().some((o) => o.bot !== c.bot && o.coin === c.coin && o.dir === c.dir) ? f : 1);
const mul = (...fs_) => () => { const g = fs_.map((f) => f()); return (c) => g.reduce((m, f) => m * f(c), 1); };
const G = [
  ['vt30', vt(30)], ['vt60', vt(60)], ['vt60n', vt(60, 0.7, 1.3)],
  ['eq20', eqf(20, 1, 0.6)], ['eq40', eqf(40, 1, 0.6)], ['eq20s', eqf(20, 1.25, 0.75)], ['eq40s', eqf(40, 1.25, 0.75)], ['eq20m', eqf(20, 1, 0.8)],
  ['tilt10', tilt(0.1)], ['tilt20', tilt(0.2)], ['corr70', corr(0.7)], ['corr50', corr(0.5)],
  ['vt60+corr70', mul(vt(60), corr(0.7))], ['eq40s+corr70', mul(eqf(40, 1.25, 0.75), corr(0.7))], ['tilt10+corr70', mul(tilt(0.1), corr(0.7))], ['vt30+eq20s', mul(vt(30), eqf(20, 1.25, 0.75))],
];
const out = ['# F3 allocation results (causalF3 engine, reproduces baseline 0/6 exactly)', 'format: n/6 label, per test Y/. growth%/fall%; tests: live full, live 2024, flat20-23(pick), flat24-26, dbl cost, 1h late', '', '## raw grid (K=1)'];
const log = (l) => out.push(l);
const rows = G.map(([n, f]) => { const r = H.evaluate({ engine: X, sizeFn: f }, n); log(r.line); return { n, f, r }; });
// pick by test 3 only: best growth among those with fall < baseline fall, else lowest fall
const B = H.base()[2], ok = rows.filter((x) => x.r.res[2].dd < B.dd);
const pick = (ok.length ? ok.sort((a, b) => b.r.res[2].cagr - a.r.res[2].cagr) : rows.sort((a, b) => a.r.res[2].dd - b.r.res[2].dd))[0];
log('', `## chosen on test 3 only: ${pick.n}`);
const K = H.fitK({ engine: X, sizeFn: pick.f }); log(`fitK = ${K.toFixed(3)}`);
const fin = H.evaluate({ engine: X, sizeFn: pick.f, K }, pick.n + ' fitK'); log(fin.line);
log('', `## verdict: best raw ${Math.max(...rows.map((x) => x.r.n))}/6; chosen+fitK ${fin.n}/6. ` + (fin.n === 6 ? 'WIN (lead to paper-test, not proof).' : 'No 6/6 in F3.'));
fs.writeFileSync(__dirname + '/f3-results.md', out.join('\n') + '\n');
