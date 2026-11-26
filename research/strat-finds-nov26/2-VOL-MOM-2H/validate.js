'use strict';
const L = require('./lib.js'), { strat } = require('./fam.js'), fs = require('fs');
const P = { fam: 'f2', kv: 2.5, kr: 1.2, trend: 400 }, EX = { kInit: 2, kTrail: 8, maxBars: 0, sigExit: false };
const out = []; const log = (s) => { out.push(s); console.log(s); };
const tab = (n, r) => log(n.padEnd(14) + L.YEARS.map((y) => r.years[y].toFixed(0).padStart(6)).join('') + `  tot ${r.total.toFixed(0)} n ${r.n} exp ${r.exp.toFixed(2)} dd ${r.dd.toFixed(0)} r/dd ${r.rdd.toFixed(1)} ex10 ${r.ex10.toFixed(0)} coins+ ${r.coinsPos}/12`);
log('year          ' + L.YEARS.map((y) => String(y).padStart(6)).join(''));
const M = L.evaluate(strat(P), EX, L.MAIN, 1, true), H = L.evaluate(strat(P), EX, L.HOLD, 1, true);
tab('MAIN 1x', M); tab('HOLD 1x', H);
for (const m of [2, 3]) { tab('MAIN ' + m + 'x', L.evaluate(strat(P), EX, L.MAIN, m)); tab('HOLD ' + m + 'x', L.evaluate(strat(P), EX, L.HOLD, m)); }
// long/short split & avg bars
const sp = (T) => { const l = T.filter((t) => t.dir > 0), s = T.filter((t) => t.dir < 0); return `long ${l.reduce((a, t) => a + t.R, 0).toFixed(0)} (${l.length}) short ${s.reduce((a, t) => a + t.R, 0).toFixed(0)} (${s.length}) avgbars ${(T.reduce((a, t) => a + t.bars, 0) / T.length).toFixed(1)} win ${(100 * T.filter((t) => t.R > 0).length / T.length).toFixed(0)}%`; };
log('MAIN ' + sp(M.trades)); log('HOLD ' + sp(H.trades));
log('max single trade MAIN ' + Math.max(...M.trades.map((t) => t.R)).toFixed(1) + ' HOLD ' + Math.max(...H.trades.map((t) => t.R)).toFixed(1));
// excl 2024-10-28 20-22h bad window
const bad = (t) => t.t >= Date.parse('2024-10-28T18:00:00Z') / 1000 && t.t <= Date.parse('2024-10-28T22:00:00Z') / 1000;
log('trades entered in bad window MAIN: ' + M.trades.filter(bad).length);
// BB-CORE 1h reference trades
const L1 = require('../hunt-1h-nov26/lib.js'), FV = require('../hunt-1h-nov26/fam-vol.js');
const E1 = { kind: 'M', bars: 192 }, REF = { len: 80, mult: 2.0, trend: 800, minStop: 0.3, filt: null };
const R1 = L1.evaluate(FV.strat(REF, E1), FV.mkEx(E1), L1.MAIN, 1, true);
log('BB-CORE 1h MAIN ref: ' + L1.YEARS.map((y) => R1.years[y].toFixed(0)).join(' ') + ' tot ' + R1.total.toFixed(0));
const mon = (T) => { const o = {}; for (const t of T) { const d = new Date(t.tExit * 1000), k = d.getUTCFullYear() * 100 + d.getUTCMonth(); o[k] = (o[k] || 0) + t.R; } return o; };
const a = mon(M.trades), b = mon(R1.trades), ks = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
const x = ks.map((k) => a[k] || 0), y = ks.map((k) => b[k] || 0), mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length;
let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
log('monthly correlation (MAIN, exit months, n=' + ks.length + ') = ' + (sxy / Math.sqrt(sxx * syy)).toFixed(3));
// overlap A: same coin+side with BB-CORE entry within 24h ; B: holding intervals intersect on same coin+side
const idx = {}; for (const t of R1.trades) (idx[t.coin + '|' + t.dir] = idx[t.coin + '|' + t.dir] || []).push(t);
const ovA = M.trades.filter((t) => (idx[t.coin + '|' + t.dir] || []).some((r) => Math.abs(r.t - t.t) <= 24 * 3600)).length;
const ovB = M.trades.filter((t) => (idx[t.coin + '|' + t.dir] || []).some((r) => r.t < t.tExit && r.tExit > t.t)).length;
log(`overlap A (BB-CORE same coin+side entry within 24h): ${ovA}/${M.trades.length} = ${(100 * ovA / M.trades.length).toFixed(0)}%`);
log(`overlap B (holding periods intersect, same coin+side): ${ovB}/${M.trades.length} = ${(100 * ovB / M.trades.length).toFixed(0)}%`);
const { audit } = require('./audit.js');
const au = audit([{ id: 'f2-volume-momentum-2h', build: (c) => require('./fam.js').F.f2(c, P) }], { coins: ['SOL', 'BTC', 'ADA', 'LTC'], cuts: 12 });
log('audit ok = ' + au.ok + ' checks=' + au.perStrategy[0].checks);
fs.writeFileSync('validate.txt', out.join('\n'));
