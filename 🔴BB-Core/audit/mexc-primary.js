// mexc-primary.js — year-by-year table on MEXC candles ONLY (the venue we trade), base and harsh costs, 2020-2023 and 2024-2026 shown separately.
//   node audit/mexc-primary.js [--nogap]     (--nogap = engine before the C3 fix, for comparison)
// Cost columns are R CONTRIBUTIONS: negative = cost, positive = income (funding received).
// Columns: n trades · net R · avg R · PF · win% · maxDD (R, closed-trade curve inside the period) · exposure (% of candles with a position open) ·
//          costs in R: fees, slippage, funding (all exact per trade, not inferred) · t-stat
// Year = year of EXIT. R = multiples of the amount risked; 1R = stop distance; no compounding.
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, DEFAULTS } = require('../lucidio-core.js');
const D = path.join(__dirname, '..', 'data'), rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const NOGAP = process.argv.includes('--nogap');
const harsh = { entryFee: 0.0008, stopFee: 0.0008, timeFee: 0.0008, tpFee: 0.0008, slip: 0.0005, tpSlip: 0.0005, tpBuf: 0.0005 };
const yr = (t) => new Date(t * 1000).getUTCFullYear();
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
function load(c) {
  const B = rd(c + '.json').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  let F = rd('funding/' + c + '.json'); const bin = rd('funding/' + c.slice(5) + '.json'); F = [...bin.filter((r) => r[0] < F[0][0]), ...F];
  return { B, F };
}
// exact cost split of one trade in R
function split(t, B, cost) {
  const dist = Math.abs(t.entry - t.stop) / t.entry, d = t.dir;
  const feeExit = t.why === 'stop' ? cost.stopFee : t.why === 'target' ? cost.tpFee : cost.timeFee;
  const sx = t.why === 'target' ? cost.tpSlip : cost.slip;
  const rawExit = t.exit / (1 - d * sx);
  const slipFrac = d * (t.entry - B[t.i0].open) / t.entry + d * (rawExit - t.exit) / t.entry;
  return { fees: (cost.entryFee + feeExit) / dist, slip: slipFrac / dist, fund: t.fundR };
}
const f1 = (v, w = 6) => v.toFixed(1).padStart(w);
function line(label, tr, B, from, to, cost) {
  const R = tr.map((t) => t.R), net = R.reduce((a, b) => a + b, 0), w = R.filter((r) => r > 0), l = R.filter((r) => r <= 0);
  let eq = 0, pk = 0, dd = 0; for (const r of R) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const inRange = B.filter((b) => yr(b.time) >= from && yr(b.time) <= to).length, bars = tr.reduce((a, t) => a + t.bars, 0);
  const c = tr.reduce((a, t) => { const s = split(t, B, cost); return { fees: a.fees + s.fees, slip: a.slip + s.slip, fund: a.fund + s.fund }; }, { fees: 0, slip: 0, fund: 0 });
  const t = R.length > 2 ? mean(R) / (sd(R) / Math.sqrt(R.length)) : NaN;
  return `  ${label.padEnd(9)} n=${String(tr.length).padStart(3)} netR=${f1(net, 7)} avgR=${mean(R).toFixed(2).padStart(5)} PF=${(l.length ? w.reduce((a, b) => a + b, 0) / -l.reduce((a, b) => a + b, 0) : Infinity).toFixed(2).padStart(5)} win=${(100 * w.length / (R.length || 1)).toFixed(0).padStart(3)}% maxDD=${f1(dd, 5)}R expo=${(100 * bars / inRange).toFixed(0).padStart(3)}%  costs R: fees ${f1(-c.fees)} slip ${f1(-c.slip)} funding ${f1(c.fund)} (total ${f1(c.fund - c.fees - c.slip)})  t=${t.toFixed(1)}`;
}
const PERIODS = [['2020-2023', 2020, 2023], ['2024-2026', 2024, 2026], ['ALL', 2020, 2026]];
console.log(`MEXC candles only · engine ${NOGAP ? 'WITHOUT' : 'WITH'} the C3 gap rule · SOL = MEXC_SOL.json, ZEC = MEXC_ZEC.json (funding: Binance before MEXC's own history starts 2025-04-29)`);
for (const sc of ['base', 'harsh']) {
  const cost = sc === 'base' ? DEFAULTS.cost : harsh;
  console.log(`\n===== scenario ${sc}: ${sc === 'base' ? 'taker 0.05% entry/stop/time, maker 0.02% target, slip 0.02%, target must trade 0.05% through' : '0.08% fee on every fill, 0.05% slip on every fill'} =====`);
  const pool = {};
  for (const coin of ['SOL', 'ZEC']) {
    const { B, F } = load('MEXC_' + coin), tr = backtest(B, { cost, gapSkip: !NOGAP }, F).trades; pool[coin] = { tr, B };
    console.log(`\n${coin}`);
    for (let y = 2020; y <= 2026; y++) console.log(line(String(y) + (y === 2020 || y === 2026 ? '*' : ''), tr.filter((t) => yr(t.tExit) === y), B, y, y, cost));
    for (const [n, a, b] of PERIODS) console.log(line(n, tr.filter((t) => yr(t.tExit) >= a && yr(t.tExit) <= b), B, a, b, cost) + (n === 'ALL' ? '' : '   <-- period'));
  }
  console.log('\nSOL+ZEC combined (1R per trade per coin, simple sum, trades ordered by exit time; exposure = average of the two coins)');
  const both = [...pool.SOL.tr, ...pool.ZEC.tr].sort((a, b) => a.tExit - b.tExit);
  const Bavg = (a, b) => { const z = [pool.SOL.B, pool.ZEC.B]; return z; };
  for (let y = 2020; y <= 2026; y++) {
    const sub = both.filter((t) => yr(t.tExit) === y), R = sub.map((t) => t.R); let eq = 0, pk = 0, dd = 0; for (const r of R) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
    console.log(`  ${String(y).padEnd(9)} n=${String(sub.length).padStart(3)} netR=${f1(R.reduce((a, b) => a + b, 0), 7)} avgR=${mean(R).toFixed(2).padStart(5)} maxDD=${f1(dd, 5)}R`);
  }
  for (const [n, a, b] of PERIODS) {
    const sub = both.filter((t) => yr(t.tExit) >= a && yr(t.tExit) <= b), R = sub.map((t) => t.R), w = R.filter((r) => r > 0), l = R.filter((r) => r <= 0); let eq = 0, pk = 0, dd = 0; for (const r of R) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
    const exp = (['SOL', 'ZEC']).map((c) => { const B = pool[c].B, tr = sub.filter((t) => pool[c].tr.includes(t)); return 100 * tr.reduce((x, t) => x + t.bars, 0) / B.filter((q) => yr(q.time) >= a && yr(q.time) <= b).length; });
    const cs = sub.reduce((acc, t) => { const B = pool.SOL.tr.includes(t) ? pool.SOL.B : pool.ZEC.B, s = split(t, B, cost); return { fees: acc.fees + s.fees, slip: acc.slip + s.slip, fund: acc.fund + s.fund }; }, { fees: 0, slip: 0, fund: 0 });
    console.log(`  ${n.padEnd(9)} n=${String(sub.length).padStart(3)} netR=${f1(R.reduce((x, y) => x + y, 0), 7)} avgR=${mean(R).toFixed(2).padStart(5)} PF=${(w.reduce((x, y) => x + y, 0) / -l.reduce((x, y) => x + y, 0)).toFixed(2).padStart(5)} win=${(100 * w.length / R.length).toFixed(0)}% maxDD=${f1(dd, 5)}R expo=${exp.map((e) => e.toFixed(0) + '%').join('/')}  costs R: fees ${f1(-cs.fees)} slip ${f1(-cs.slip)} funding ${f1(cs.fund)}  t=${(mean(R) / (sd(R) / Math.sqrt(R.length))).toFixed(1)}`);
  }
}
console.log('\n* 2020 = from 2020-09-25 (SOL) / 2020-06-29 (ZEC, with the 63-day hole); 2026 = to 2026-10-21.');
