'use strict';
const L = require('./lib.js'), I = L.I, F = require('./fam.js'), { audit } = require('./audit.js');
function bbcore(c) {
  const mid = c.m('bm20', () => I.sma(c.C, 20)), sd = c.m('bs20', () => I.stdev(c.C, 20)), tr = c.m('sma200', () => I.sma(c.C, 200)), n = c.n;
  const Lf = new Uint8Array(n), Sf = new Uint8Array(n), sL = new Float64Array(n), sS = new Float64Array(n);
  for (let i = 205; i < n; i++) {
    const m = mid[i], s = sd[i], a = c.atr14[i], cl = c.C[i];
    if (!(m === m) || !(a > 0) || Math.abs(cl - m) < 0.3 * a) continue;
    if (cl > m + 2 * s && cl > tr[i]) { Lf[i] = 1; sL[i] = m; } else if (cl < m - 2 * s && cl < tr[i]) { Sf[i] = 1; sS[i] = m; }
  }
  return { L: Lf, S: Sf, stopL: sL, stopS: sS, warmup: 205 };
}
const BBX = { kInit: 0, kTrail: 0, maxBars: 48, sigExit: false };
const ALL = [...L.MAIN, ...L.HOLD];
const yrs = (y) => L.YEARS.map((k) => (y[k] || 0).toFixed(0).padStart(5)).join('');
const cand = JSON.parse(process.argv[2]);
const strat = (x) => F.build(x, cand), ex = F.exOf(cand);
console.log('CAND', JSON.stringify(cand), '\nyears               ' + L.YEARS.join('    '));
let allOk = true;
for (const [bk, coins, cm] of [['MAIN', L.MAIN, 1], ['MAIN', L.MAIN, 2], ['MAIN', L.MAIN, 3], ['HOLD', L.HOLD, 1], ['HOLD', L.HOLD, 2], ['ALL24', ALL, 1]]) {
  const r = L.evaluate(strat, ex, coins, cm);
  console.log(`${bk.padEnd(5)} ${cm}x ${yrs(r.years)} | R=${r.total.toFixed(0)} dd=${r.dd.toFixed(0)} r/dd=${r.rdd.toFixed(1)} exp=${r.exp.toFixed(3)} n=${r.n} ${r.posYears}/7 ex10=${r.ex10.toFixed(0)} coins+=${r.coinsPos}/${coins.length}`);
}
const rA = L.evaluate(strat, ex, ALL, 1, true), T = rA.trades;
const a = audit([{ id: 'cand', build: strat }], { coins: ['SOL', 'BTC', 'ADA', 'LTC'], cuts: 12 });
console.log('audit ok =', a.ok, JSON.stringify(a.perStrategy.map((p) => [p.checks, p.mismatches])));
const rB = L.evaluate(bbcore, BBX, ALL, 1, true), R = rB.trades;
console.log('BB-CORE 4h ALL24', yrs(rB.years), 'R=' + rB.total.toFixed(0));
const key = (t) => t.coin + '|' + t.dir, ri = {}; for (const t of R) (ri[key(t)] = ri[key(t)] || []).push(t.t);
const ov = T.filter((t) => (ri[key(t)] || []).some((x) => Math.abs(x - t.t) <= 6 * 14400)).length;
const ov2 = T.filter((t) => (ri[key(t)] || []).some((x) => x <= t.t + 12 * 14400 && x + 48 * 14400 >= t.t)).length;
const mon = (Tr) => { const m = {}; for (const t of Tr) { const d = new Date(t.tExit * 1000), k = d.getUTCFullYear() * 100 + d.getUTCMonth(); m[k] = (m[k] || 0) + t.R; } return m; };
const m1 = mon(T), m2 = mon(R), ks = Object.keys(m1).filter((k) => k in m2), x = ks.map((k) => m1[k]), y = ks.map((k) => m2[k]);
const mean = (v) => v.reduce((s, z) => s + z, 0) / v.length, mx = mean(x), my = mean(y);
const corr = x.reduce((s, z, i) => s + (z - mx) * (y[i] - my), 0) / Math.sqrt(x.reduce((s, z) => s + (z - mx) ** 2, 0) * y.reduce((s, z) => s + (z - my) ** 2, 0));
console.log(`overlap (entry within 24h same coin+side): ${ov}/${T.length} = ${(100 * ov / T.length).toFixed(0)}%; overlap (entry while BB-CORE position open): ${ov2}/${T.length} = ${(100 * ov2 / T.length).toFixed(0)}%; monthly corr ${corr.toFixed(2)}`);
const lo = T.filter((t) => t.dir === 1).reduce((s, t) => s + t.R, 0);
console.log('long R', lo.toFixed(0), 'short R', (rA.total - lo).toFixed(0), 'win', (100 * rA.win).toFixed(0) + '%');
