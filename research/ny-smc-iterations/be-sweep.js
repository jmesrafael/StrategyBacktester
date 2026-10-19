// be-sweep.js — v7 (target 1:3) with different breakeven triggers / locks. $10 per R. Bybit 3 years + MEXC last year.
const fs = require('fs'), E = require('./ie.js');
const V7 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5, tpMode: 'R', tpR: 3, minDispATR: 1, minFvgATR: 0.2,
  chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5, maxStopATR: 4, maxFillBars: 8 };
E.RAW.SOLm = JSON.parse(fs.readFileSync('data/mexc-sol15.json', 'utf8')); E.RAW.ETHm = JSON.parse(fs.readFileSync('data/mexc-eth15.json', 'utf8'));
const M0 = Date.parse('2025-10-23T00:00:00Z') / 1000, M1 = Date.parse('2026-10-18T00:00:00Z') / 1000;
const VARS = [['no BE', null, 0], ['0.5R', 0.5, 0], ['0.75R', 0.75, 0], ['1.0R (v7)', 1, 0], ['1.25R', 1.25, 0], ['1.5R', 1.5, 0], ['2.0R', 2, 0], ['2.5R', 2.5, 0],
  ['0.75R lock +0.1R', 0.75, 0.1], ['1.0R lock +0.1R', 1, 0.1], ['1.0R lock +0.2R', 1, 0.2], ['1.0R lock +0.3R', 1, 0.3], ['1.5R lock +0.3R', 1.5, 0.3], ['1.5R lock +0.5R', 1.5, 0.5], ['2.0R lock +0.5R', 2, 0.5], ['2.0R lock +1.0R', 2, 1]];
const f = (x, d = 0) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d);
const rows = [];
console.log('| Breakeven | 3-yr profit (both) | PF | Max DD | Profit ÷ DD | Worst month | Coin-years ≥ v7 | SOL Y1/Y2/Y3 | ETH Y1/Y2/Y3 | MEXC yr profit | MEXC DD | Exits TP / BE / SL |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
let base;
for (const [nm, be, lock] of VARS) {
  const c = { ...V7, beR: be, beLockR: lock };
  const r = { SOL: E.runSym('SOL', c), ETH: E.runSym('ETH', c) };
  const T = [...r.SOL.trades, ...r.ETH.trades].sort((a, b) => a.t - b.t), S = E.stats(T);
  const cy = ['SOL', 'ETH'].flatMap((s) => ['Y1', 'Y2', 'Y3'].map((y) => r[s].by[y].sumR * 10));
  if (nm === '1.0R (v7)') base = cy;
  // monthly
  const m = new Map(); for (const t of T) { const d = new Date(t.t * 1000), k = d.getUTCFullYear() * 12 + d.getUTCMonth(); m.set(k, (m.get(k) || 0) + t.R * 10); }
  const worst = Math.min(...m.values());
  const mx = ['SOL', 'ETH'].flatMap((s) => E.runSym(s + 'm', c).trades.filter((t) => t.t >= M0 && t.t < M1));
  const MS = E.stats(mx.sort((a, b) => a.t - b.t));
  rows.push({ nm, cy, S, worst, MS });
}
for (const x of rows) {
  const better = x.cy.filter((v, i) => v >= base[i] - 0.5).length;
  console.log(`| ${x.nm} | ${f(x.S.sumR * 10)} | ${x.S.pfR.toFixed(2)} | −$${(x.S.ddR * 10).toFixed(0)} | ${(x.S.sumR / x.S.ddR).toFixed(1)} | ${f(x.worst)} | ${better}/6 | ${x.cy.slice(0, 3).map((v) => v.toFixed(0)).join('/')} | ${x.cy.slice(3).map((v) => v.toFixed(0)).join('/')} | ${f(x.MS.sumR * 10)} | −$${(x.MS.ddR * 10).toFixed(0)} | ${x.S.tp} / ${x.S.be} / ${x.S.sl} |`);
}
