// metrics.js — standard performance metrics for BB-CORE 4h (live) / BB-CORE 1h / BB-1H-WIDE on the live coins,
// PHP 1,000 from Jan 1 2020, compounding, live risk steps (2.5% / 2% at $500 / 1.5% at $1000 highest balance, PHP 60 per USD).
//  - Equity is marked to market every hour (open trades valued at the 1h close), so drawdown includes open-trade swings.
//  - Fees, slippage and funding are inside each trade's R (engine.js).
//  - "MEXC" version: whole contracts only (today's contract size x the price at entry, minVol), skip if one contract risks
//    > 1.5x the target, skip if free margin is short (leverage = min(20, floor(0.5 / (stop % + maintenance rate)))). Same rule as replace-nov25/sim.js.
//  - Sharpe / Sortino: daily returns of the hourly-marked equity at 00:00 UTC, annualised x sqrt(365), risk-free 0.
'use strict';
const L = require('./lib.js'), V = require('./fam-vol.js');
const { run } = require('../strat-hunt-nov6/engine.js'), { S, makeCtx, exitOf } = require('../strat-hunt-nov6/strategies.js');
const DET = require('../zec-replacement-2/detail.json'), DL = Array.isArray(DET) ? DET : DET.data || Object.values(DET);
const PHP = 60, START = 1000, TIERS = [[0, 0.025], [500 * PHP, 0.02], [1000 * PHP, 0.015]];
const pct = (pk) => { let p = TIERS[0][1]; for (const [b, r] of TIERS) if (pk >= b) p = r; return p; };
const LIVE = ['SOL', 'NEAR', 'ADA', 'GALA', 'ZEC', 'ARB'], E = { kind: 'M', bars: 192 };
const SPEC = {}; for (const c of LIVE) { const d = DL.find((s) => s.symbol === c + '_USDT'); SPEC[c] = { cs: d.contractSize, minVol: d.minVol || 1, mmr: d.maintenanceMarginRate || 0.004 }; }
const T0 = Date.parse(process.env.START_AT || '2020-01-01') / 1000;

const one = (mult) => L.evaluate(V.strat({ len: 80, mult, trend: 800, minStop: 0.3, filt: null }, E), V.mkEx(E), LIVE, 1, true).trades.filter((t) => t.t >= T0);
function core4h() {
  const s = S.find((x) => x.id === 'bb-core'), out = [];
  for (const cn of LIVE) {
    const B = L.C.load(cn, '4h').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })), c = makeCtx(B, '4h');
    for (const t of run(B, c.atr14, s.build(c), exitOf('BBX', c), L.C.funding(cn), 14400).trades) if (t.t >= T0) { t.coin = cn; out.push(t); }
  }
  return out;
}
// hourly closes per coin, keyed by hour open time
const CL = {}; for (const c of LIVE) { const m = new Map(); for (const r of L.C.load(c, '1h', { from: T0 })) m.set(r[0], r[4]); CL[c] = m; }

function simulate(trades, mexc) {
  const ev = []; trades.forEach((t, i) => { ev.push([t.t, 0, i]); ev.push([t.tExit, 1, i]); });
  ev.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const end = Math.max(...trades.map((t) => t.tExit));
  let bal = START, peak = START, margin = 0, e = 0, eqPeak = START, mdd = 0, mddFrom = 0, mddTo = 0, pkT = T0, closedPeak = START, cdd = 0;
  const open = new Map(), days = [], done = []; let skipped = 0;
  for (let h = T0; h <= end; h += 3600) {
    // events up to the end of this hour
    while (e < ev.length && ev[e][0] <= h) {
      const [, k, i] = ev[e++], t = trades[i];
      if (k === 0) {
        const target = bal * pct(peak);
        let risk = target, mg = 0;
        if (mexc) {
          const sp = SPEC[t.coin], oneC = sp.cs * t.entry, per = oneC * t.dist;
          let vol = Math.max(sp.minVol, Math.round(target / PHP / per)); // contracts are in USD, balance in PHP
          while (vol >= sp.minVol && vol * per * PHP > 1.5 * target) vol--;
          if (vol < sp.minVol) { skipped++; continue; }
          risk = vol * per * PHP;
          const lev = Math.max(1, Math.min(20, Math.floor(0.5 / (t.dist + sp.mmr))));
          mg = vol * oneC * PHP / lev;
          if (!(bal - margin >= mg * 1.1)) { skipped++; continue; }
          margin += mg;
        }
        open.set(i, { risk, mg });
      } else if (open.has(i)) {
        const o = open.get(i), pnl = t.R * o.risk; bal += pnl; margin -= o.mg; open.delete(i); done.push(pnl);
        peak = Math.max(peak, bal); closedPeak = Math.max(closedPeak, bal); cdd = Math.max(cdd, 1 - bal / closedPeak);
      }
    }
    // mark to market at this hour's close
    let eq = bal;
    for (const [i, o] of open) { const t = trades[i], c = CL[t.coin].get(h); if (c != null) eq += o.risk * (t.dir * (c / t.entry - 1)) / t.dist; }
    if (eq > eqPeak) { eqPeak = eq; pkT = h; }
    const dd = 1 - eq / eqPeak; if (dd > mdd) { mdd = dd; mddFrom = pkT; mddTo = h; }
    if (h % 86400 === 0) days.push(eq);
  }
  const rets = []; for (let i = 1; i < days.length; i++) rets.push(days[i] / days[i - 1] - 1);
  const mean = rets.reduce((s, v) => s + v, 0) / rets.length, sd = Math.sqrt(rets.reduce((s, v) => s + (v - mean) ** 2, 0) / (rets.length - 1));
  const dsd = Math.sqrt(rets.reduce((s, v) => s + Math.min(0, v) ** 2, 0) / rets.length);
  const gw = done.filter((v) => v > 0).reduce((s, v) => s + v, 0), gl = -done.filter((v) => v < 0).reduce((s, v) => s + v, 0);
  const yrs = (end - T0) / (365.25 * 86400);
  return { bal, ret: bal / START - 1, cagr: (bal / START) ** (1 / yrs) - 1, mdd, mddFrom, mddTo, cdd, pf: gw / gl, sharpe: mean / sd * Math.sqrt(365), sortino: mean / dsd * Math.sqrt(365),
    n: done.length, win: done.filter((v) => v > 0).length / done.length, skipped };
}
const rPF = (tr) => { const w = tr.filter((t) => t.R > 0).reduce((s, t) => s + t.R, 0), l = -tr.filter((t) => t.R <= 0).reduce((s, t) => s + t.R, 0); return w / l; };
const d = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const money = (v) => v >= 1e6 ? 'PHP ' + (v / 1e6).toFixed(2) + 'M' : 'PHP ' + Math.round(v).toLocaleString('en-US');
const SETS = [['BB-CORE 4h (live bot)', core4h()], ['BB-CORE 1h (2.0σ)', one(2.0)], ['BB-1H-WIDE (2.6σ)', one(2.6)]];
const res = SETS.map(([nm, tr]) => ({ nm, tr, ideal: simulate(tr, false), mexc: simulate(tr, true) }));
let o = '';
for (const [lab, k] of [['No order minimums (ideal sizing)', 'ideal'], ['With MEXC minimum orders and margin (realistic at PHP 1,000)', 'mexc']]) {
  o += `\n### ${lab}\n| Metric | ${res.map((r) => r.nm).join(' | ')} |\n|---|---|---|---|\n`;
  const row = (m, f) => o += `| ${m} | ${res.map((r) => f(r[k], r)).join(' | ')} |\n`;
  row('Max drawdown, peak to trough (open trades marked hourly)', (x) => `−${(x.mdd * 100).toFixed(1)}% (${d(x.mddFrom)} → ${d(x.mddTo)})`);
  row('Max drawdown, closed trades only', (x) => `−${(x.cdd * 100).toFixed(1)}%`);
  row('Profit factor (pesos)', (x) => x.pf.toFixed(2));
  if (k === 'ideal') row('Profit factor (R, before sizing)', (x, r) => rPF(r.tr).toFixed(2));
  row('Sharpe ratio (daily, annualised)', (x) => x.sharpe.toFixed(2));
  row('Sortino ratio (daily, annualised)', (x) => x.sortino.toFixed(2));
  row('Trades taken', (x) => x.n.toLocaleString('en-US'));
  if (k === 'mexc') row('Trades skipped (below minimum / no margin)', (x) => `${x.skipped} (${(100 * x.skipped / (x.n + x.skipped)).toFixed(0)}%)`);
  row('Win rate', (x) => `${(x.win * 100).toFixed(1)}%`);
  row('PHP 1,000 → Nov 25, 2026 (net of fees, slippage, funding)', (x) => money(x.bal));
  row('Net return / CAGR', (x) => `+${Math.round(x.ret * 100).toLocaleString('en-US')}% / ${Math.round(x.cagr * 100)}% a year`);
}
require('fs').writeFileSync(process.env.START_AT ? 'metrics-' + process.env.START_AT.slice(0, 4) + '.md' : 'metrics.md', o); console.log(o);
