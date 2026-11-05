// engine.js — decision on CLOSED bar t-1, fill at OPEN of bar t. Costs 0.04% commission + 0.02% slippage per side (app rules).
// 1x notional, no leverage, compounding handled by caller. Funding not modelled.
const FEE = 0.0006;
function run(bars, desired, longOnly) {
  const n = bars.length, ret = new Array(n).fill(0), trades = []; let pos = 0, tf = 1, ts = -1;
  for (let t = 1; t < n; t++) {
    const o = bars[t][1], c = bars[t][4], pc = bars[t - 1][4];
    let want = desired[t - 1] || 0; if (longOnly && want < 0) want = 0;
    let f = 1;
    if (want === pos) {
      if (pos) { const bf = (1 + pos * (o / pc - 1)) * (1 + pos * (c / o - 1)); f = bf; tf *= bf; }
    } else {
      if (pos) { const g = (1 + pos * (o / pc - 1)) * (1 - FEE); f *= g; tf *= g; trades.push({ t0: ts, t1: t, r: tf - 1 }); }
      pos = want;
      if (pos) { const g = (1 - FEE) * (1 + pos * (c / o - 1)); f *= g; tf = g; ts = t; }
    }
    ret[t] = f - 1;
  }
  if (pos) trades.push({ t0: ts, t1: n - 1, r: tf - 1 });
  return { ret, trades };
}
module.exports = { run, FEE };
