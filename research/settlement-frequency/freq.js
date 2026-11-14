// freq.js — how often should the Ledger settle (take the 20% profit share)? Every 1, 2, 3, 6 or 12 months, high-water mark.
// The pool is the 3 live bots (rules v3, live coins), each compounding 2.5% risk on its own third, booked at the close of each trade
// (Binance 4h, Jan 2020 -> Nov 2026). The fee moves units to the manager inside the pool, so the pool itself grows the same whatever the
// frequency: only the split between investor and manager changes. Every start month is tried, for 1, 2 and 3 years in the fund.
//   node freq.js            (writes freq.json next to it)
'use strict';
const path = require('path'), fs = require('fs');
const LAB = path.join(__dirname, '..', 'tweak-lab-nov13');
const { load, START, END } = require(path.join(LAB, 'lab.js'));
const ROOT = path.join(__dirname, '..', '..', '..');
const BOTS = {
  'BB-CORE': { core: require(path.join(ROOT, '🔴BB-Core', 'lucidio-core.js')), coins: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'], run: (core, B) => core.backtest(B, {}, null).trades },
  'I-CORE': { core: require(path.join(ROOT, '🔴I-Core', 'icore-core.js')), coins: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH'], run: (core, B) => core.backtest(B, {}).trades },
  'T-CORE': { core: require(path.join(ROOT, '🔴StrategyBacktester', 'bb-trail', 'icore-core.js')), coins: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'], run: (core, B) => core.backtest(B, {}).trades },
};
const RISK = 0.025, FEE = 0.20, FREQ = [1, 2, 3, 6, 12], HORIZON = [12, 24, 36];

// month starts Jan 2020 .. Nov 2026
const MS = []; for (let y = 2020, m = 0; Date.UTC(y, m, 1) / 1000 <= END; m++) { if (m === 12) { m = 0; y++; } MS.push(Date.UTC(y, m, 1) / 1000); }
// pool value (start 1) at each month start: each bot compounds on its own third
const trades = Object.entries(BOTS).flatMap(([bot, b]) => b.coins.flatMap((c) => b.run(b.core, load(c).B).filter((t) => t.tExit > START && t.tExit <= END).map((t) => ({ bot, t1: t.tExit, R: t.R }))))
  .sort((a, b) => a.t1 - b.t1);
function pool(risk) {
  const bal = Object.fromEntries(Object.keys(BOTS).map((k) => [k, 1 / 3])), P = []; let i = 0;
  for (const t0 of MS) { while (i < trades.length && trades[i].t1 <= t0) { const t = trades[i++]; bal[t.bot] *= 1 + risk * t.R; } P.push(Object.values(bal).reduce((s, v) => s + v, 0)); }
  return P;
}
let P;
// one investor, 1 USDT in at month s, out (settled) at month s + h; settlement every f calendar months (Jan-anchored, like Jan 1, Mar 1, ... for f = 2)
function run(s, h, f) {
  let u = 1 / P[s], hwm = 1, fees = 0, events = 0, mgr = 0;            // mgr: the manager's fee units
  const settle = (k) => { const v = u * P[k], fee = FEE * Math.max(0, v - hwm); if (fee > 0) { u -= fee / P[k]; mgr += fee / P[k]; fees += fee; events++; } hwm = Math.max(hwm, u * P[k]); };
  for (let k = s + 1; k <= s + h; k++) if (k === s + h || new Date(MS[k] * 1000).getUTCMonth() % f === 0) settle(k);
  const gross = P[s + h] / P[s] - 1, net = u * P[s + h] - 1;
  return { gross, net, fees, mgr: mgr * P[s + h], events, eff: gross > 0 ? (gross - net) / gross : null };
}
const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; };
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const RISKS = [0.005, 0.01, 0.025], pc = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
const out = { generated: new Date().toISOString().slice(0, 10), months: MS.length, trades: trades.length, risks: {} };
for (const risk of RISKS) {
  P = pool(risk); const yr = []; for (let s = 0; s + 12 < MS.length; s++) yr.push(P[s + 12] / P[s] - 1);
  const R = (out.risks[risk] = { yearGrossMed: q(yr, 0.5), yearGrossWorst: Math.min(...yr), losingMonths: P.slice(1).filter((v, k) => v < P[k]).length / (P.length - 1), horizons: {} });
  console.log(`
######## risk ${risk * 100}% per trade: a year in the pool, before fees: median ${pc(R.yearGrossMed)}, worst ${pc(R.yearGrossWorst)}; months down ${(R.losingMonths * 100).toFixed(0)}%`);
  for (const h of HORIZON) {
    const starts = []; for (let s = 0; s + h < MS.length; s++) starts.push(s);
    const base = starts.map((s) => run(s, h, 2)); R.horizons[h] = {};
    console.log(`  --- ${h} months in (${starts.length} starts)   investor end vs 2-monthly (median, worst)   manager end vs 2-monthly (median)   profit to manager (median)   fees/yr`);
    for (const f of FREQ) {
      const r = starts.map((s) => run(s, h, f));
      const inv = r.map((x, j) => (1 + x.net) / (1 + base[j].net) - 1), mg = r.map((x, j) => (base[j].mgr > 0 ? x.mgr / base[j].mgr - 1 : 0));
      const effs = r.map((x) => x.eff).filter((x) => x != null);
      const row = (R.horizons[h][f] = { invVs2Med: q(inv, 0.5), invVs2Worst: Math.min(...inv), mgrVs2Med: q(mg, 0.5), effMed: q(effs, 0.5), netMed: q(r.map((x) => x.net), 0.5), events: avg(r.map((x) => x.events)) * 12 / h });
      console.log(`     every ${String(f).padStart(2)} mo   ${pc(row.invVs2Med).padStart(7)}  ${pc(row.invVs2Worst).padStart(7)}        ${pc(row.mgrVs2Med).padStart(7)}        ${(row.effMed * 100).toFixed(1).padStart(5)}%   ${row.events.toFixed(1)}   (investor net median ${pc(row.netMed)})`);
    }
  }
}
fs.writeFileSync(path.join(__dirname, 'freq.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toFixed(5) : v), 1));
