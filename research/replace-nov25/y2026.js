// y2026.js: a fresh PHP 1,000 on 1 January 2026, current TRI-CORE against New, to Nov 24 2026.
//   node y2026.js  -> 2026.md
'use strict';
const fs = require('fs'), path = require('path');
const S = require('./sim');
const CFG = require('../../intel/config.json').bots, DETAIL = require('../zec-replacement-2/detail.json');
const { IV, END } = S, ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, YEAR = +process.argv[2] || 2026, A = ts(YEAR), Z = Math.min(ts(YEAR + 1), END), PART = Z < ts(YEAR + 1), PHP = 58, START = 1000 / PHP;
const list = Array.isArray(DETAIL) ? DETAIL : DETAIL.data || Object.values(DETAIL);
const SPECS = {}, THEN = process.argv[3] === 'then';
for (const c of new Set([...CFG.bbcore.coins, ...CFG.icore.coins, ...CFG.tcore.coins])) { const d = list.find((s) => s.symbol === c + '_USDT'), x = S.real(c); SPECS[c] = { unit: d.contractSize * x.C[x.n - 1], cs: THEN ? d.contractSize : 0, minVol: d.minVol || 1, mmr: d.maintenanceMarginRate }; }
const bots = (bbKind, bbMult, trail) => [{ name: 'bb', kind: bbKind, coins: CFG.bbcore.coins, weight: 0.5, mult: bbMult }, { name: 'ic', kind: 'ic', coins: CFG.icore.coins, weight: 0.25, mult: 1 }, { name: 'tc', kind: 'tc', coins: CFG.tcore.coins, weight: 0.25, mult: 1, spec: { kTrail: trail } }];
const V = [['Current', bots('bb', 1, 14)], ['New', bots('bbT', 1.05, 12)]];
const hash = (seed, s, t) => { let h = (seed * 2654435761) >>> 0; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); h = Math.imul(h ^ Math.floor(t / IV), 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const frictions = (seed) => ({ skip: (b, c, t) => hash(seed, 'm' + b + c, t) < 0.15, extra: (b, c, t) => hash(seed, 's' + b + c, t) * 0.0015, feeMult: 1 + hash(seed, 'fee', 0) });
const run = (B, o = {}) => { const r = S.account(B, { start: o.start ?? START, from: o.from ?? A, to: Z, sets: S.real, specs: o.ideal ? null : SPECS, rnd: o.rnd, fee20: o.fee20 }); return { ...S.curveStats(r.curve, o.start ?? START), curve: r.curve, taken: r.taken }; };
const p = (v) => Math.round(v * PHP).toLocaleString('en-US'), pc = (v, d = 0) => (100 * v).toFixed(d) + '%', f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d);
const q = (a, x) => [...a].sort((m, n) => m - n)[Math.min(a.length - 1, Math.floor(x * a.length))];
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; if (PART) M.splice(10, 2, 'Nov (to 24)');
const at = (curve, t) => { let v = START; for (const [u, e] of curve) { if (u <= t) v = e; else break; } return v; };

// R statistics of the trades closed in 2026
const rst = (B) => B.map((b) => { const t = b.coins.flatMap((c) => S.coinTrades(S.real(c), b.kind, { spec: b.spec, mult: b.mult })).filter((x) => x.tExit > A && x.tExit <= Z).sort((x, y) => x.tExit - y.tExit); return { name: b.name, t, w: b.weight }; });
const R = V.map(([name, B]) => {
  const parts = rst(B), all = parts.flatMap((x) => x.t.map((t) => ({ ...t, w: t.w * x.w }))).sort((x, y) => x.tExit - y.tExit);
  const sum = (t) => { let e = 0, pk = 0, dd = 0; for (const x of t) { e += x.w * x.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); } return { n: t.length, win: t.filter((x) => x.R > 0).length / t.length, R: e, dd }; };
  const real = run(B), ideal = run(B, { ideal: true }), fee = run(B, { fee20: true });
  const mon = M.map((_, m) => { const a = m ? at(real.curve, ts(YEAR, m)) : START, b = at(real.curve, Math.min(ts(YEAR, m + 1), Z)); let pk = a, dd = 0; for (const [u, e] of real.curve) if (u > ts(YEAR, m) && u <= ts(YEAR, m + 1)) { pk = Math.max(pk, e); dd = Math.max(dd, 1 - e / pk); } return { end: b, ret: b / a - 1, dd, R: all.filter((x) => x.tExit > ts(YEAR, m) && x.tExit <= ts(YEAR, m + 1)).reduce((s, x) => s + x.w * x.R, 0) }; });
  return { name, B, real, ideal, fee, mon, all: sum(all), bots: parts.map((x) => ({ name: x.name, ...sum(x.t) })) };
});
const [a, b] = R, md = [`# ${YEAR}: PHP 1,000 started 1 January, current TRI-CORE against New`, '', (PART ? 'To Nov 24 2026. ' : 'Full year. ') + 'Live sizing: shared pool 50/25/25, quarterly rebalance, 2.5% risk, MEXC minimum orders at ' + (THEN ? 'the price of each date' : 'today\'s prices') + ', fees, slippage, funding. PHP 58 per USD. Backtest, not live results.', '', '| Measure | Current | New |', '|---|---|---|'];
const row = (n, fn) => md.push(`| ${n} | ${fn(a)} | ${fn(b)} |`);
row('End value (PHP)', (r) => p(r.real.end)); row('Return', (r) => f(r.real.ret ?? (r.real.end / START - 1) * 100) + '%'); row('Deepest fall', (r) => pc(r.real.dd, 1)); row('Lowest value (PHP)', (r) => p(r.real.low));
row('Longest time under a previous high (days)', (r) => Math.round(r.real.underDays)); row('Positive months', (r) => `${r.mon.filter((m) => m.ret > 0).length} of ${M.length}`); row('Worst month', (r) => pc(Math.min(...r.mon.map((m) => m.ret)), 1)); row('Best month', (r) => '+' + pc(Math.max(...r.mon.map((m) => m.ret)), 1));
row('Orders filled in the account', (r) => r.real.taken); row('Win rate (all signals)', (r) => pc(r.all.win, 1)); row('R, weighted 50/25/25', (r) => f(r.all.R, 1)); row('R drop, closed trades', (r) => r.all.dd.toFixed(1));
row('End value after a 20% profit fee (PHP)', (r) => p(r.fee.end)); row('End value if no order minimums (PHP)', (r) => p(r.ideal.end)); row('Deepest fall if no order minimums', (r) => pc(r.ideal.dd, 1));
md.push('', '## Month by month', '', '| Month | Current value (PHP) | New value (PHP) | Current gain (PHP) | New gain (PHP) | Current return | New return | Current fall in month | New fall in month | Current R | New R | Higher value |', '|' + '---|'.repeat(12));
const whole = (v) => Math.round(v * PHP), g = (v) => (v >= 0 ? '+' : '') + v.toLocaleString('en-US'), gain = (r, i) => whole(r.mon[i].end) - (i ? whole(r.mon[i - 1].end) : whole(START));
M.forEach((n, i) => { const x = a.mon[i], y = b.mon[i]; md.push(`| ${n} | ${p(x.end)} | ${p(y.end)} | ${g(gain(a, i))} | ${g(gain(b, i))} | ${f(x.ret * 100, 1)}% | ${f(y.ret * 100, 1)}% | ${pc(x.dd)} | ${pc(y.dd)} | ${f(x.R, 1)} | ${f(y.R, 1)} | ${y.end > x.end ? 'New' : 'Current'} |`); });
const tg = (r) => g(M.reduce((s, _, i) => s + gain(r, i), 0)), higher = M.filter((_, i) => b.mon[i].end > a.mon[i].end).length;
md.push(`| **Total** | **${p(a.real.end)}** | **${p(b.real.end)}** | **${tg(a)}** | **${tg(b)}** | **${f((a.real.end / START - 1) * 100)}%** | **${f((b.real.end / START - 1) * 100)}%** | **${pc(a.real.dd, 1)}** | **${pc(b.real.dd, 1)}** | **${f(a.all.R, 1)}** | **${f(b.all.R, 1)}** | New ${higher}, Current ${M.length - higher} |`);
md.push('', 'Total row: gains and R are sums; value = end value; return = compounded whole period (percents are not added); fall = deepest fall of the whole period.');
md.push('', `## Each bot in ${YEAR} (R, own trades)`, '', '| Bot | Current: trades, win, R, closed drop | New: trades, win, R, closed drop |', '|---|---|---|');
a.bots.forEach((x, i) => { const y = b.bots[i], s = (z) => `${z.n}, ${pc(z.win)}, ${f(z.R)}R, ${z.dd.toFixed(1)}`; md.push(`| ${{ bb: 'BB-CORE', ic: 'I-CORE', tc: 'T-CORE' }[x.name]} | ${s(x)} | ${s(y)} |`); });
{ const t = (r) => `${r.bots.reduce((s, x) => s + x.n, 0)}, ${pc(r.all.win)}, ${f(r.bots.reduce((s, x) => s + x.R, 0))}R, ${r.all.dd.toFixed(1)} weighted`; md.push(`| **Total** | **${t(a)}** | **${t(b)}** |`, '', 'Total row: trades and R summed over the three bots (unweighted); win rate and drop are for all trades together (drop weighted 50/25/25).'); }
// robustness: random frictions, and other start months in 2026
const N = 300, mc = V.map(([, B]) => Array.from({ length: N }, (_, s) => run(B, { rnd: frictions(s + 1) })));
md.push('', `## ${N} replays of ${YEAR} with 15% missed signals, random extra slippage and fees`, '', '| Version | Typical end (PHP) | Bad case (1 in 20) | Good case (1 in 20) | Ended with a profit | Typical deepest fall | Bad case fall |', '|---|---|---|---|---|---|---|');
V.forEach(([n], k) => { const e = mc[k].map((x) => x.end), d = mc[k].map((x) => x.dd); md.push(`| ${n} | ${p(q(e, 0.5))} | ${p(q(e, 0.05))} | ${p(q(e, 0.95))} | ${pc(e.filter((v) => v > START).length / N)} | ${pc(q(d, 0.5), 1)} | ${pc(q(d, 0.95), 1)} |`); });
md.push('', `New ended with more money in ${pc(mc[1].filter((x, i) => x.end > mc[0][i].end).length / N)} of runs and had the smaller fall in ${pc(mc[1].filter((x, i) => x.dd < mc[0][i].dd).length / N)}.`);
md.push('', `## Starting in a different month of ${YEAR} (to the end of the period)`, '', '| Start | Current end (PHP) / deepest fall | New end (PHP) / deepest fall |', '|---|---|---|');
for (let m = 0; m < 10; m++) { const x = run(V[0][1], { from: ts(YEAR, m) }), y = run(V[1][1], { from: ts(YEAR, m) }); md.push(`| ${M[m]} | ${p(x.end)} / ${pc(x.dd)} | ${p(y.end)} / ${pc(y.dd)} |`); }
fs.writeFileSync(path.join(__dirname, YEAR + (THEN ? '-then' : '') + '.md'), md.join('\n') + '\n'); console.log(md.join('\n'));
