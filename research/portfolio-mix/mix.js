// Portfolio mix & match: strategies stay SEPARATE sleeves; find which subset (2-5 sleeves, equal capital) makes the best account.
// Bot coins SOL NEAR ADA GALA (T-CORE also ETH), Oct 20 2020 - Nov 10 2026. Pick on IS (trades closed before 2024), judge OOS.
// Metric: return / max drawdown, trade by trade (each sleeve risks 1% of ITS capital per trade -> account R = sleeve R x weight).
const fs = require('fs'), path = require('path');
const R = p => path.join(__dirname, '..', p);
const T0 = Date.UTC(2020, 9, 20) / 1000, Y24 = Date.UTC(2024, 0, 1) / 1000, T1 = Date.UTC(2026, 10, 11) / 1000, BOT = ['SOL', 'NEAR', 'ADA', 'GALA'];
const clip = tr => tr.filter(t => t.tExit >= T0 && t.tExit < T1).map(t => ({ tExit: t.tExit, R: t.R }));
const S = {};
const BT = JSON.parse(fs.readFileSync(R('zec-replacement-2/trades-fill.json')));
S['BB-CORE'] = clip(BOT.flatMap(c => BT[c + '|BB-CORE'])); S['I-CORE'] = clip(BOT.flatMap(c => BT[c + '|I-CORE'])); S['T-CORE'] = clip([...BOT, 'ETH'].flatMap(c => BT[c + '|T-CORE']));
const mtf = JSON.parse(fs.readFileSync(R('mtf-confluence/deep.json')));
for (const k of Object.keys(mtf)) S[k] = clip(mtf[k].bot);
const ich = require(R('ichi-ltf/strat.js'));
const ICH = ['E4/both/TM24', 'E2/ichi4/KJ', 'E4/ichi4/T2', 'E1/none/P7', 'E2/d1/P14'];
const data = {}; for (const c of BOT) data[c] = ich.build(c);
for (const k of ICH) { const [entry, htf, exit] = k.split('/'); S['ICHI ' + k] = clip(BOT.flatMap(c => ich.backtest(c, { entry, htf, exit }, { data: data[c] }))); }
const orb = require(R('orb-sol/engine.js'));
const G = { tf: 240, session: 'ldn', orBars: 1, stop: 'mid', target: 3, entry: 'close', dir: 'long', filters: ['vwap', 'rvol', 'pd'] };
S['ORB-G'] = clip(BOT.flatMap(c => orb.run({ ...G, coin: c }).trades));
const names = Object.keys(S);
console.error('sleeves', names.map(n => n + ':' + S[n].length).join(' '));

function curve(tr) { const s = [...tr].sort((a, b) => a.tExit - b.tExit); let e = 0, p = 0, d = 0; for (const t of s) { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); } return { tot: e, dd: d, rdd: d > 0 ? e / d : 0 }; }
const port = (ws, a, b) => curve(Object.entries(ws).flatMap(([k, w]) => S[k].filter(t => t.tExit >= a && t.tExit < b).map(t => ({ tExit: t.tExit, R: t.R * w }))));
const eq = ks => Object.fromEntries(ks.map(k => [k, 1 / ks.length]));
const subsets = []; const rec = (i, cur) => { if (cur.length >= 2 && cur.length <= 5) subsets.push([...cur]); if (cur.length === 5) return; for (let j = i; j < names.length; j++) { cur.push(names[j]); rec(j + 1, cur); cur.pop(); } }; rec(0, []);
const rows = subsets.map(ks => { const w = eq(ks); return { ks, is: port(w, T0, Y24), oos: port(w, Y24, T1), all: port(w, T0, T1) }; });
const rank = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); idx.forEach(([, i], k) => r[i] = k); return r; };
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let s = 0, a = 0, b = 0; for (let i = 0; i < n; i++) { s += (x[i] - mx) * (y[i] - my); a += (x[i] - mx) ** 2; b += (y[i] - my) ** 2; } return s / Math.sqrt(a * b); };
const rho = corr(rank(rows.map(r => r.is.rdd)), rank(rows.map(r => r.oos.rdd)));
const f = c => `${c.rdd.toFixed(1).padStart(5)} (${c.tot.toFixed(0).padStart(4)}R/${c.dd.toFixed(1).padStart(5)}R)`;
const tri = { 'BB-CORE': .5, 'I-CORE': .25, 'T-CORE': .25 };
console.log('return/DD (total R / max DD R), account units = sleeve R x weight\n');
console.log('BASELINES                                   IS 2020-23            OOS 2024-26           ALL');
for (const [nm, w] of [['TRI-CORE 50/25/25 (live)', tri], ['BB+I+T equal', eq(['BB-CORE', 'I-CORE', 'T-CORE'])], ['BB-CORE alone', { 'BB-CORE': 1 }], ['I-CORE alone', { 'I-CORE': 1 }], ['T-CORE alone', { 'T-CORE': 1 }]])
  console.log(nm.padEnd(44) + f(port(w, T0, Y24)) + '   ' + f(port(w, Y24, T1)) + '   ' + f(port(w, T0, T1)));
console.log(`\n${rows.length} subsets (2-5 sleeves, equal capital). Rank correlation IS vs OOS return/DD: ${rho.toFixed(2)}`);
rows.sort((a, b) => b.is.rdd - a.is.rdd);
const triO = port(tri, Y24, T1).rdd;
console.log(`Subsets beating live TRI-CORE OOS (${triO.toFixed(1)}): ${rows.filter(r => r.oos.rdd > triO).length}/${rows.length}`);
console.log('\nTOP 12 picked on IS                                                        IS                    OOS                   ALL');
for (const r of rows.slice(0, 12)) console.log(r.ks.join(' + ').padEnd(74).slice(0, 74) + f(r.is) + '   ' + f(r.oos) + '   ' + f(r.all));
// which sleeves appear in the IS top 30 and OOS top 30
const cnt = arr => { const c = {}; arr.forEach(r => r.ks.forEach(k => c[k] = (c[k] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '); };
console.log('\nSleeves in IS top 30 : ' + cnt(rows.slice(0, 30)));
console.log('Sleeves in OOS top 30: ' + cnt([...rows].sort((a, b) => b.oos.rdd - a.oos.rdd).slice(0, 30)));
// each extra sleeve added to the live TRI-CORE at 20% (TRI scaled to 80%), IS and OOS
console.log('\nADD ONE SLEEVE TO LIVE TRI-CORE (80% TRI + 20% sleeve)         IS                    OOS');
for (const k of names.filter(n => !tri[n])) { const w = { 'BB-CORE': .4, 'I-CORE': .2, 'T-CORE': .2, [k]: .2 }; console.log(k.padEnd(60) + f(port(w, T0, Y24)) + '   ' + f(port(w, Y24, T1))); }
fs.writeFileSync(path.join(__dirname, 'mix.json'), JSON.stringify({ rho, rows: rows.map(r => ({ ks: r.ks, is: r.is, oos: r.oos, all: r.all })) }));
