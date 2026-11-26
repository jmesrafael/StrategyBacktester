// hold-trend.js — trend-family leaders (fam-trend.js) and the MACD neighbours on the HOLD basket; correlation with BB-1H-WIDE.
'use strict';
const L = require('./lib.js'), T = require('./fam-trend.js'), V = require('./fam-vol.js');
const yrs = (tr) => { const y = {}; for (const t of tr) { const k = L.yearOf(t.tExit); y[k] = (y[k] || 0) + t.R; } return L.YEARS.map((k) => (y[k] || 0).toFixed(0).padStart(5)).join(''); };
const exitObj = (x) => x.type === 'sig' ? { kInit: x.kInit, kTrail: x.kTrail || 0, maxBars: 0, sigExit: true } : { kInit: x.kInit, kTrail: x.kTrail, maxBars: 0, sigExit: false };
const macd = { fam: 'macd', p: { sc: 8, mode: 'sig' }, trend: 1200, qual: 'off', exit: { type: 'sig', kInit: 4, kTrail: 0 } };
const cfgs = [
  ['MACD8 sig tr1200 sig(4)', macd],
  ['  sc6', { ...macd, p: { sc: 6, mode: 'sig' } }], ['  tr800', { ...macd, trend: 800 }], ['  tr2400', { ...macd, trend: 2400 }],
  ['  kInit3', { ...macd, exit: { type: 'sig', kInit: 3, kTrail: 0 } }], ['  kInit5', { ...macd, exit: { type: 'sig', kInit: 5, kTrail: 0 } }],
  ['KC50 x3.5 atr(3,18)', { fam: 'kc', p: { len: 50, mult: 3.5 }, trend: 0, qual: 'off', exit: { type: 'atr', kInit: 3, kTrail: 18 } }],
  ['KC200 x3.5 atr(4,22)', { fam: 'kc', p: { len: 200, mult: 3.5 }, trend: 0, qual: 'off', exit: { type: 'atr', kInit: 4, kTrail: 22 } }],
  ['EMA50/200 er0.2 atr(4,22)', { fam: 'ema', p: { kind: 'ema', fast: 50, slow: 200 }, trend: 0, qual: 'er', qthr: 0.2, exit: { type: 'atr', kInit: 4, kTrail: 22 } }],
];
const mon = (Tr) => { const m = {}; for (const t of Tr) { const d = new Date(t.tExit * 1000), k = d.getUTCFullYear() * 100 + d.getUTCMonth(); m[k] = (m[k] || 0) + t.R; } return m; };
const corr = (a, b) => { const ks = Object.keys(a).filter((k) => k in b), x = ks.map((k) => a[k]), y = ks.map((k) => b[k]), mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length; return x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / Math.sqrt(x.reduce((s, v) => s + (v - mx) ** 2, 0) * y.reduce((s, v) => s + (v - my) ** 2, 0)); };
const ALL = [...L.MAIN, ...L.HOLD], E = { kind: 'M', bars: 192 };
const bbw = mon(L.evaluate(V.strat({ len: 80, mult: 2.6, trend: 800, minStop: 0.3, filt: null }, E), V.mkEx(E), ALL, 1, true).trades);
console.log('years:'.padEnd(54) + L.YEARS.join('  '));
for (const [nm, cfg] of cfgs) for (const [bk, coins, cm] of [['MAIN', L.MAIN, 1], ['HOLD', L.HOLD, 1], ['HOLD', L.HOLD, 2], ['ALL24', ALL, 2]]) {
  const r = L.evaluate((c) => T.build(c, cfg), exitObj(cfg.exit), coins, cm, true);
  const cc = bk === 'ALL24' ? ` corrBBW=${corr(mon(L.evaluate((c) => T.build(c, cfg), exitObj(cfg.exit), ALL, 1, true).trades), bbw).toFixed(2)}` : '';
  console.log(`${nm.padEnd(28)} ${bk.padEnd(5)} ${cm}x ${r.posYears}/7 ${yrs(r.trades)} | R=${r.total.toFixed(0)} dd=${r.dd.toFixed(0)} r/dd=${r.rdd.toFixed(1)} coins+=${r.coinsPos}${cc}`);
}
