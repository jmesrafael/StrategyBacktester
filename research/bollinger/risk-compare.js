// risk-compare.js — SOL, ZEC, ADA: BB Breakout 4h, targets 1:3 / 1:4 / 1:5, each under
// fixed $5 risk per trade (no compounding) vs 5% of equity per trade (compounding).
// Same engine/costs as rr4.js (0.04% commission + 0.02% slippage, no funding). usage: node risk-compare.js
const fs = require('fs'), L = require('./lib.js'), F = require('./fam.js');
const COINS = ['SOL', 'ZEC', 'ADA'], TARGETS = [3, 4, 5], FIXED_RISK = 5, START_EQ = 1000, PCT_RISK = 0.05;
const BB = (tp) => ({ tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 });

function fixedStats(trades) {
  const totalR = trades.reduce((a, t) => a + t.R, 0);
  let eq = 0, pk = 0, dd = 0;
  for (const t of trades) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const win = trades.filter((t) => t.R > 0).length;
  return { n: trades.length, win, totalR, totalUSD: totalR * FIXED_RISK, maxDDUSD: dd * FIXED_RISK, avgR: trades.length ? totalR / trades.length : 0 };
}
function compoundStats(trades) {
  let eq = START_EQ, pk = START_EQ, maxDDpct = 0;
  for (const t of trades.slice().sort((a, b) => a.t - b.t)) {
    eq += eq * PCT_RISK * t.R;
    if (eq <= 0) { eq = 0; maxDDpct = 1; break; }
    pk = Math.max(pk, eq);
    maxDDpct = Math.max(maxDDpct, (pk - eq) / pk);
  }
  return { endEquity: eq, multiple: eq / START_EQ, maxDDpct };
}

const out = ['# SOL / ZEC / ADA — BB Breakout, fixed $5 risk vs 5% compounding, targets 1:3 / 1:4 / 1:5\n',
  'Same engine as rr4.js (close signal -> next-open fill, stop = mid band, 0.04% commission + 0.02% slippage, no funding). Fixed = $5/trade on a flat $1000 notional (no compounding). Compounding = 5% of CURRENT equity risked per trade, starting at $1000, trades taken in time order. Max DD for fixed is in $ off peak closed-trade equity; for compounding it\'s % off peak equity.\n'];
const rows = [];
for (const sym of COINS) {
  for (const tp of TARGETS) {
    const trades = F.sq(sym, BB(tp));
    const fx = fixedStats(trades), cp = compoundStats(trades);
    rows.push({ sym, tp, n: trades.length, fx, cp });
  }
}
out.push('| Coin | Target | Trades | Fixed $5: Total $ | Fixed $5: Max DD $ | Fixed $5: Avg R | Compounding 5%: End equity | Compounding 5%: Multiple | Compounding 5%: Max DD % |',
  '|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  out.push(`| ${r.sym} | 1:${r.tp} | ${r.n} | ${r.fx.totalUSD >= 0 ? '+' : ''}$${r.fx.totalUSD.toFixed(0)} | -$${r.fx.maxDDUSD.toFixed(0)} | ${r.fx.avgR >= 0 ? '+' : ''}${r.fx.avgR.toFixed(2)}R | $${r.cp.endEquity.toFixed(0)} | ${r.cp.multiple.toFixed(2)}x | ${(r.cp.maxDDpct * 100).toFixed(1)}% |`);
}
// best target per coin, each scheme
out.push('', '## Best target per coin');
for (const sym of COINS) {
  const sub = rows.filter((r) => r.sym === sym);
  const bestFixed = sub.slice().sort((a, b) => b.fx.totalUSD - a.fx.totalUSD)[0];
  const bestComp = sub.slice().sort((a, b) => b.cp.multiple - a.cp.multiple)[0];
  out.push(`- **${sym}** — fixed $5: best is 1:${bestFixed.tp} (${bestFixed.fx.totalUSD >= 0 ? '+' : ''}$${bestFixed.fx.totalUSD.toFixed(0)}); 5% compounding: best is 1:${bestComp.tp} (${bestComp.cp.multiple.toFixed(2)}x, ${(bestComp.cp.maxDDpct * 100).toFixed(1)}% max DD)`);
}
fs.writeFileSync(__dirname + '/results-risk-compare.md', out.join('\n') + '\n');
console.log(out.join('\n'));
