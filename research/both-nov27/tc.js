// tc.js - focus: T-CORE trailing stop 14 (live) vs 8..13 ATR. Causal engine copy with MEXC specs for the pool (causalF4).
//  1 standalone T-CORE (live 8 coins), flat US$1000 (no sizing noise): total R, worst fall, per year R
//  2 per-coin R live-8 coins: how many coins improve at 10 / 11
//  3 hold-out: T-CORE on 9 coins NOT in the live list (BTC BNB XRP DOGE LINK AVAX DOT LTC TRX), trail 14 vs 10/11, 1x and 3x costs
//  4 3x costs on the live coins; ex-top-10 trades
const X = require('./causalF4.js'), H = require('./h.js'), p = H.p;
const TR = [14, 13, 12, 11, 10, 9, 8], LIVE8 = X.COINS.tc, HOLD = ['BTC', 'BNB', 'XRP', 'DOGE', 'LINK', 'AVAX', 'DOT', 'LTC', 'TRX'];
const yr = (t) => new Date(t * 1000).getUTCFullYear();
const run = (k, coins, cost = 1) => { const r = X.run({ mode: 'flat', start: 1000, weights: { tc: 1 }, coins: { tc: coins }, from: X.T0, to: X.END, cost, spec: { tc: { kTrail: k } } }); return { r, s: X.stats(r), R: r.trades.reduce((a, t) => a + t.R, 0) }; };
const yrs = (r) => { const o = {}; for (const t of r.trades) o[yr(t.tExit)] = (o[yr(t.tExit)] || 0) + t.R; return Object.keys(o).sort().map((y) => `${y}:${o[y].toFixed(0)}`).join(' '); };
console.log('1) standalone T-CORE, live 8 coins, flat 1x'); const base = {};
for (const k of TR) { const x = run(k, LIVE8); base[k] = x; console.log(`trail ${String(k).padStart(2)}  R ${x.R.toFixed(0).padStart(5)}  fall ${p(x.s.dd).padStart(5)}  trades ${x.r.trades.length}  by year ${yrs(x.r)}`); }
console.log('\n2) per coin R (live 8), trail 14 -> 11 / 10');
const pc = (x) => { const o = {}; for (const t of x.r.trades) o[t.coin] = (o[t.coin] || 0) + t.R; return o; }, p14 = pc(base[14]), p11 = pc(base[11]), p10 = pc(base[10]);
let n11 = 0, n10 = 0; for (const c of LIVE8) { console.log(`${c.padEnd(5)} ${(p14[c] || 0).toFixed(0).padStart(5)} -> ${(p11[c] || 0).toFixed(0).padStart(5)} / ${(p10[c] || 0).toFixed(0).padStart(5)}`); if ((p11[c] || 0) > (p14[c] || 0)) n11++; if ((p10[c] || 0) > (p14[c] || 0)) n10++; }
console.log(`coins better than 14: trail 11 ${n11}/8, trail 10 ${n10}/8`);
console.log('\n3) hold-out coins (not live), flat, 1x and 3x costs');
for (const cost of [1, 3]) for (const k of [14, 12, 11, 10, 9]) { const x = run(k, HOLD, cost); console.log(`cost x${cost} trail ${String(k).padStart(2)}  R ${x.R.toFixed(0).padStart(5)}  fall ${p(x.s.dd).padStart(5)}  by year ${yrs(x.r)}`); }
console.log('\n4) live coins: 3x costs, and without the 10 best trades');
for (const k of [14, 11, 10]) { const a = run(k, LIVE8, 3), t = base[k].r.trades.map((q) => q.R).sort((x, y) => y - x), ex = t.slice(10).reduce((x, y) => x + y, 0); console.log(`trail ${k}  3x costs R ${a.R.toFixed(0)} fall ${p(a.s.dd)}  | 1x total R ${base[k].R.toFixed(0)}, ex-top-10 R ${ex.toFixed(0)}`); }
