// verify-no-lookahead-v3.js — live-replay proof for the v3 engine (several positions per coin). Same method as verify-no-lookahead.js:
// at many cut points k the engine sees only candles 0..k and funding known by then; its closed trades, ALL open positions and pending signal
// must equal the full-history run at that moment.
//   node verify-no-lookahead-v3.js [--coins SOL] [--pos 2] [--cuts 400]
'use strict';
const { backtest, scaleCost, DEFAULTS } = require('./v3-core.js');
const { loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const both = args.includes('--both'), coins = opt('coins', 'SOL').split(','), POS = +opt('pos', 2), CUTS = +opt('cuts', 400), venue = opt('venue', 'binance');
const cost = scaleCost(DEFAULTS.cost, 1), key = (t) => `${t.i0}:${t.dir}:${t.entry.toFixed(10)}`;
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const same = (a, b) => a.i0 === b.i0 && a.i1 === b.i1 && a.dir === b.dir && a.why === b.why && Math.abs(a.entry - b.entry) < 1e-9 && Math.abs(a.exit - b.exit) < 1e-9 && Math.abs(a.R - b.R) < 1e-9;
let all = 0, badAll = 0;
for (const [label, cfg0] of [['bb-core', {}], [`up to ${POS} positions`, { maxPos: POS, addSameDir: !both }]]) for (const coin of coins) {
  const { B, funding } = loadCoin(coin, venue), cfg = { ...cfg0, cost }, full = backtest(B, cfg, funding), n = B.length, r = rng(11);
  const fullAll = [...full.trades, ...full.open], cuts = new Set();
  for (let j = 0; j < CUTS; j++) cuts.add(210 + Math.floor(r() * (n - 212)));
  for (const t of full.trades) for (const d of [-1, 0, 1]) { cuts.add(t.i0 + d - 1); cuts.add(t.i1 + d); }
  let checks = 0, bad = 0, first = null;
  const byExit = (a, b) => a.i1 - b.i1 || a.i0 - b.i0;
  for (const k of cuts) {
    if (k < 210 || k >= n - 1) continue;
    const part = backtest(B.slice(0, k + 1), cfg, funding ? funding.filter((f) => f[0] <= B[k].time + DEFAULTS.interval) : null);
    const want = full.trades.filter((t) => t.i1 <= k).sort(byExit), got = [...part.trades].sort(byExit);
    let ok = got.length === want.length && got.every((t, i) => same(t, want[i]));
    const wantOpen = fullAll.filter((t) => t.i0 <= k && !(t.i1 <= k)).map(key).sort(), gotOpen = part.open.map(key).sort();
    if (ok) ok = JSON.stringify(wantOpen) === JSON.stringify(gotOpen);
    const nxt = fullAll.find((t) => t.i0 === k + 1);
    if (ok) ok = part.setup ? !!nxt && nxt.dir === part.setup.dir : !nxt;
    checks++; if (!ok) { bad++; first = first ?? k; }
  }
  all += checks; badAll += bad;
  console.log(`${label.padEnd(20)} ${coin.padEnd(5)} ${String(full.trades.length).padStart(4)} trades  ${String(checks).padStart(5)} cut points  ${bad ? 'MISMATCH at ' + first + ' (' + bad + ')' : 'identical'}`);
}
console.log(badAll ? `\nFAIL: ${badAll} of ${all} cut points differ` : `\nPASS: ${all} cut points, 0 mismatches — only data available at each moment was used`);
process.exit(badAll ? 1 : 0);
