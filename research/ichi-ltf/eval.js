// 12 pre-declared variants x 14 coins + the overlap/correlation check vs the live bots (bot coins SOL NEAR ADA GALA).
const fs = require('fs'), path = require('path');
const LIB = require(path.join(__dirname, '../../candles/candles.js'));
const { build, backtest, COST } = require('./strat.js');
const BT = JSON.parse(fs.readFileSync(path.join(__dirname, '../zec-replacement-2/trades-fill.json')));
const ALL = LIB.coins(), BOT = ['SOL', 'NEAR', 'ADA', 'GALA'], Y24 = Date.UTC(2024, 0, 1) / 1000;
const T0 = Date.UTC(2020, 9, 20) / 1000, T1 = Date.UTC(2026, 10, 11) / 1000;
const mk = t => { const d = new Date(t * 1e3); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }, m0 = mk(T0), NM = mk(T1 - 1) - m0 + 1;
const monthly = tr => { const M = new Array(NM).fill(0); tr.forEach(t => { const k = mk(t.tExit) - m0; if (k >= 0 && k < NM) M[k] += t.R; }); return M; };
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let s = 0, a = 0, b = 0; for (let i = 0; i < n; i++) { s += (x[i] - mx) * (y[i] - my); a += (x[i] - mx) ** 2; b += (y[i] - my) ** 2; } return a && b ? s / Math.sqrt(a * b) : 0; };
const ddR = tr => { let e = 0, p = 0, d = 0; [...tr].sort((a, b) => a.tExit - b.tExit).forEach(t => { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); }); return d; };
const avg = a => a.length ? a.reduce((x, t) => x + t.R, 0) / a.length : 0, sum = a => a.reduce((x, t) => x + t.R, 0);
const clip = tr => tr.filter(t => t.tExit >= T0 && t.tExit < T1);
const bots = { BB: clip(BOT.flatMap(c => BT[c + '|BB-CORE'].map(t => ({ ...t, coin: c })))), I: clip(BOT.flatMap(c => BT[c + '|I-CORE'].map(t => ({ ...t, coin: c })))), T: clip([...BOT, 'ETH'].flatMap(c => BT[c + '|T-CORE'].map(t => ({ ...t, coin: c })))) };
const MB = { BB: monthly(bots.BB), I: monthly(bots.I), T: monthly(bots.T) }, TRI = MB.BB.map((v, i) => .5 * v + .25 * MB.I[i] + .25 * MB.T[i]);
const anyBot = [...bots.BB, ...bots.I, ...bots.T];
const overlap = A => A.filter(a => anyBot.some(b => b.coin === a.coin && b.dir === a.dir && b.t < a.tExit && b.tExit > a.t)).length / (A.length || 1);
const data = {}; for (const c of ALL) data[c] = build(c);
const rows = [];
console.log('variant  | 14 coins: n   avgR   IS    OOS  x2cost +coinsOOS | bot coins: n  avgR  totR  DD   +yrs | corr TRI  BB   I    T | overlap any bot | in TRI losing months');
for (const entry of ['E1', 'E2', 'E3', 'E4']) for (const exit of ['T2', 'KJ', 'P7']) {
  const cfg = { entry, exit }, per = {}, per2 = {};
  for (const c of ALL) { per[c] = backtest(c, cfg, { data: data[c] }); per2[c] = backtest(c, cfg, { data: data[c], cost: { fee: COST.fee * 2, slip: COST.slip * 2 } }); }
  const all = ALL.flatMap(c => per[c]), x2 = ALL.flatMap(c => per2[c]);
  const posO = ALL.filter(c => avg(per[c].filter(t => t.tExit >= Y24)) > 0).length;
  const bt = clip(BOT.flatMap(c => per[c])), M = monthly(bt);
  const yrs = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => bt.filter(t => new Date(t.tExit * 1e3).getUTCFullYear() === y)).map(sum);
  const bad = TRI.map((v, i) => [v, M[i]]).filter(x => x[0] < 0);
  const r = { entry, exit, n: all.length, avg: avg(all), is: avg(all.filter(t => t.tExit < Y24)), oos: avg(all.filter(t => t.tExit >= Y24)), x2: avg(x2), posO,
    bn: bt.length, bavg: avg(bt), btot: sum(bt), bdd: ddR(bt), byrs: yrs, cTRI: corr(M, TRI), cBB: corr(M, MB.BB), cI: corr(M, MB.I), cT: corr(M, MB.T), ov: overlap(bt), badR: bad.reduce((a, x) => a + x[1], 0), badPos: bad.filter(x => x[1] > 0).length, monthly: M };
  rows.push(r);
  console.log(`${entry} ${exit}    | ${String(r.n).padStart(5)} ${r.avg.toFixed(3).padStart(6)} ${r.is.toFixed(2).padStart(5)} ${r.oos.toFixed(2).padStart(5)} ${r.x2.toFixed(2).padStart(6)}  ${String(posO).padStart(2)}/14 | ${String(r.bn).padStart(5)} ${r.bavg.toFixed(3)} ${r.btot.toFixed(0).padStart(5)} ${r.bdd.toFixed(0).padStart(3)}R ${yrs.filter(v => v > 0).length}/7 | ${r.cTRI.toFixed(2).padStart(5)} ${r.cBB.toFixed(2).padStart(5)} ${r.cI.toFixed(2).padStart(5)} ${r.cT.toFixed(2).padStart(5)} | ${(r.ov * 100).toFixed(0).padStart(3)}% | ${r.badR.toFixed(1)}R (${r.badPos}/${bad.length} +)`);
}
fs.writeFileSync(path.join(__dirname, 'eval.json'), JSON.stringify(rows));
