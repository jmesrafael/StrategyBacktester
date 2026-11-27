// mc.js - shuffle Monte Carlo for a TRI-CORE trade list (compounding replay, live size tiers, US$500 risk cap).
//   node mc.js    baseline table for block=1 and block=5, plus an un-shuffled replay check against the engine.
// Replay: trades are taken in the given order. Each one risks min(cap, tier * base * K * bbFactor * mult) US$, where
// base = equity * weight[bot] and tier uses the bot's peak base (2.5% < 500, 2% from 500, 1.5% from 1000).
// Its P&L = R * risk, added to equity at its exit. Approximation: sizing uses the equity after earlier exits, not the
// equity at entry, and rebalancing between bots is ignored.
'use strict';
const path = require('path');
const X = require(path.join(__dirname, '../improve-nov27/opus-validate/causal.js'));

// seeded PRNG (mulberry32): same seed, same orders
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const tier = (base) => (base >= 1000 ? 0.015 : base >= 500 ? 0.02 : 0.025);

// compound the trades in the given order; returns end equity and worst fall on the closed-trade path
function replay(list, { start, weights, cap, K = 1 }) {
  let eq = start, pk = start, dd = 0;
  const peakBase = {};
  for (const t of list) {
    const base = eq * weights[t.bot];
    peakBase[t.bot] = Math.max(peakBase[t.bot] || 0, base);
    const bbf = t.bot === 'bb' ? 1.05 * (t.w ?? 1) : 1;               // bb: x1.05 and half size when ADX > 27
    const risk = Math.min(cap, tier(peakBase[t.bot]) * base * K * bbf * (t.mult ?? 1));
    eq = Math.max(0, eq + t.R * risk);
    if (eq > pk) pk = eq; else if (pk > 0) dd = Math.max(dd, 1 - eq / pk);
  }
  return { end: eq, dd };
}

// shuffle test: n random orders of the trades (block=1: single trades; block=5: chunks of 5 kept in order)
function shuffleTest(trades, { n = 2000, block = 1, seed = 1, start = 600, weights = { bb: 0.5, ic: 0.25, tc: 0.25 }, cap = 500, K = 1 } = {}) {
  const rnd = mulberry32(seed);
  const sorted = [...trades].sort((a, b) => a.tExit - b.tExit);
  const chunks = [];
  for (let i = 0; i < sorted.length; i += block) chunks.push(sorted.slice(i, i + block));
  const ends = [], dds = [];
  for (let k = 0; k < n; k++) {
    const order = chunks.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const r = replay(order.flat(), { start, weights, cap, K });
    ends.push(r.end); dds.push(r.dd);
  }
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  return {
    pProfit: ends.filter((e) => e > start).length / n,
    medianEnd: q(ends, 0.5), p5End: q(ends, 0.05),
    medianDD: q(dds, 0.5), p95DD: q(dds, 0.95), p99DD: q(dds, 0.99),
  };
}

module.exports = { shuffleTest, replay, mulberry32 };

if (require.main === module) {
  const weights = { bb: 0.5, ic: 0.25, tc: 0.25 }, start = 600, cap = 500, K = 1;
  const r = X.run({ mode: 'live', start, weights, K, cap }), st = X.stats(r);
  const usd = (v) => Math.round(v).toLocaleString('en-US'), pc = (v) => (100 * v).toFixed(1) + '%';
  console.log(`engine: trades ${r.trades.length}, end US$${usd(st.end)}, worst fall ${pc(st.dd)}`);

  const chk = replay(r.trades, { start, weights, cap, K });
  const gap = chk.end / st.end - 1;
  console.log(`sanity: un-shuffled replay end US$${usd(chk.end)} (${gap >= 0 ? '+' : ''}${pc(gap)} vs engine), worst fall ${pc(chk.dd)}` +
    (Math.abs(gap) <= 0.1 ? ' -> within 10%' : ' -> NOT within 10%'));

  console.log('\nblock | P(profit) | median end | 5th pct end | median worst fall | 95th pct fall | 99th pct fall');
  for (const block of [1, 5]) {
    const s = shuffleTest(r.trades, { n: 2000, block, seed: 1, start, weights, cap, K });
    console.log(`${block}     | ${pc(s.pProfit)} | US$${usd(s.medianEnd)} | US$${usd(s.p5End)} | ${pc(s.medianDD)} | ${pc(s.p95DD)} | ${pc(s.p99DD)}`);
  }
}
