// verify-no-lookahead.js — "live replay" proof that a config never uses future data (no repainting).
//
// For many cut points k the engine is given ONLY candles 0..k (and only funding events up to the end of candle k, i.e. what a live bot would know),
// exactly like a live bot at that moment. Whatever it decides must equal what the full-history run decided at that same moment:
//   - every trade closed by candle k is identical (entry, exit, reason, R)
//   - the position still open at k is the same trade (same entry candle and entry price)
//   - a signal pending on candle k becomes the same trade the full run opens on candle k+1
// Cut points: random ones, plus the candles around every entry and exit (where a leak would show first).
//   node verify-no-lookahead.js [--coins SOL,ZEC,NEAR,ADA,GALA] [--venue mexc] [--bars 96] [--cuts 300]
'use strict';
const { backtest, scaleCost, DEFAULTS } = require('./v2-core.js');
const { COINS, loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const coins = opt('coins', COINS.join(',')).split(','), venue = opt('venue', 'binance'), CUTS = +opt('cuts', 300);
const cfgs = [['bb-core (48)', {}], [`v2-A (${opt('bars', 96)})`, { maxBars: +opt('bars', 96) }]];
const cost = scaleCost(DEFAULTS.cost, 1);
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const same = (a, b) => a.i0 === b.i0 && a.i1 === b.i1 && a.dir === b.dir && a.why === b.why && Math.abs(a.entry - b.entry) < 1e-9 && Math.abs(a.exit - b.exit) < 1e-9 && Math.abs(a.R - b.R) < 1e-9;

let totalChecks = 0, totalBad = 0;
for (const [label, extra] of cfgs) for (const coin of coins) {
  const { B, funding } = loadCoin(coin, venue), cfg = { ...extra, cost };
  const full = backtest(B, cfg, funding), n = B.length, r = rng(7 + coin.length);
  const cuts = new Set();
  for (let j = 0; j < CUTS; j++) cuts.add(210 + Math.floor(r() * (n - 212)));
  for (const t of full.trades) for (const d of [-1, 0, 1]) { cuts.add(t.i0 + d - 1); cuts.add(t.i1 + d); }
  let checks = 0, bad = 0, firstBad = null;
  for (const k of cuts) {
    if (k < 210 || k >= n - 1) continue;
    const fk = funding ? funding.filter((f) => f[0] <= B[k].time + DEFAULTS.interval) : null;      // funding known at the close of candle k
    const part = backtest(B.slice(0, k + 1), cfg, fk);
    const want = full.trades.filter((t) => t.i1 <= k);
    let ok = part.trades.length === want.length && part.trades.every((t, i) => same(t, want[i]));
    // the position open at k must be the full run's trade that spans k
    const span = full.trades.find((t) => t.i0 <= k && t.i1 > k) || (full.open && full.open.i0 <= k ? full.open : null);   // full.open = still open when the data ends
    if (ok) ok = part.open ? !!span && span.i0 === part.open.i0 && Math.abs(span.entry - part.open.entry) < 1e-9 : !span;
    // a pending signal on candle k = the trade the full run opens at k+1
    const nxt = full.trades.find((t) => t.i0 === k + 1) || (full.open && full.open.i0 === k + 1 ? full.open : null);
    if (ok) ok = part.setup ? !!nxt && nxt.dir === part.setup.dir && Math.abs(nxt.stop - part.setup.stop) < 1e-9 : !nxt;
    checks++; if (!ok) { bad++; firstBad = firstBad ?? k; }
  }
  totalChecks += checks; totalBad += bad;
  console.log(`${label.padEnd(14)} ${coin.padEnd(5)} ${String(full.trades.length).padStart(3)} trades  ${String(checks).padStart(5)} cut points  ${bad ? 'MISMATCH at candle ' + firstBad + ' (' + bad + ')' : 'identical'}`);
}
console.log(totalBad ? `\nFAIL: ${totalBad} of ${totalChecks} cut points differ — the config looks at the future` : `\nPASS: ${totalChecks} cut points, 0 mismatches — decisions at every moment used only data available at that moment`);
process.exit(totalBad ? 1 : 0);
