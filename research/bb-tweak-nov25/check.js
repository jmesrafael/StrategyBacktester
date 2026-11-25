// check.js: (1) the portfolio replay equals the project engine; (2) no future sight: replaying with the data cut at
// any date gives the same earlier trades, risk sizes and equity curve as the full replay.
'use strict';
const L = require('./engine');
const E = require('../../intel/engines/backtest/engine');
const { bot } = require('../../intel/engines/backtest/strategies');
const C = require('../../candles/candles.js');
const END = Date.UTC(2026, 10, 24) / 1000;

function parity() {
  let n = 0, bad = 0;
  for (const c of C.coins()) {
    const x = L.load(c, END), a = L.replay({}, { coins: [c], endT: END }).trades, b = E.run(x.bars, bot('bbcore', 'v3'), E.standardCost({ funding: x.funding })).trades;
    bad += Math.abs(a.length - b.length);
    for (let i = 0; i < Math.min(a.length, b.length); i++) { n++; if (a[i].t !== b[i].t || a[i].tExit !== b[i].tExit || a[i].dir !== b[i].dir || Math.abs(a[i].R - b[i].R) > 1e-9) bad++; }
  }
  return { n, bad };
}
function noFuture(configs) {
  let trades = 0, points = 0, bad = 0;
  const cuts = ['2021-07-11T08:00', '2022-03-02T00:00', '2022-11-19T16:00', '2023-12-31T20:00', '2024-06-07T04:00', '2025-02-14T12:00', '2025-10-01T00:00', '2026-05-23T20:00'].map((s) => Date.parse(s + 'Z') / 1000);
  for (const cfg of configs) {
    const full = L.replay(cfg, { endT: END });
    for (const cut of cuts) {
      const part = L.replay(cfg, { endT: cut }), a = full.trades.filter((t) => t.tExit <= cut), b = part.trades;
      trades += a.length;
      if (a.length !== b.length || a.some((t, i) => t.c !== b[i].c || t.t !== b[i].t || t.tExit !== b[i].tExit || Math.abs(t.R - b[i].R) > 1e-12 || Math.abs(t.w - b[i].w) > 1e-12)) bad++;
      for (let i = 0; i < part.curveT.length; i++) { points++; if (part.curveT[i] !== full.curveT[i] || Math.abs(part.curveE[i] - full.curveE[i]) > 1e-9) { bad++; break; } }
    }
  }
  return { trades, points, bad };
}
module.exports = { parity, noFuture, END };
if (require.main === module) {
  const p = parity(); console.log(`parity with project engine: ${p.n} trades, ${p.bad} different`);
  const all = { ii: { len: 21, th: 0, lo: 0.5 }, adx: { max: 30, lo: 0.5 }, ext: { atr: 3, lo: 0.5 }, btc: { lo: 0.5 }, slow: { len: 600, lo: 0.5 }, dirSize: 0.25, dirCap: 4, throttle: { dd: 12, mult: 0.5 }, extend: { atR: 2, bars: 66 }, stale: { bars: 24, r: 0 }, lock: { atR: 3, toR: 1 } };
  const f = noFuture([{}, all]); console.log(`no future sight: ${f.trades} trades and ${f.points} equity points compared, ${f.bad} failures`);
  process.exit(p.bad || f.bad ? 1 : 0);
}
