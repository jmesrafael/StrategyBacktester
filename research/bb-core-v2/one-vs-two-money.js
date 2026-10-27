// one-vs-two-money.js — ₱30,000 ($476 at ₱63) started fresh each 1 Jan, compounding, four ways to run the two strategies. node one-vs-two-money.js [binance|mexc]
'use strict';
const { runMerged } = require('./merged.js'); const { DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const V = process.argv[2] || 'binance', FX = 63, START = 30000 / FX, php = (v) => '₱' + Math.round(v * FX).toLocaleString('en-US');
const D = Object.fromEntries(COINS.map((c) => [c, loadCoin(c, V)])), cache = {};
const trades = (m) => cache[m] || (cache[m] = COINS.flatMap((c) => runMerged(D[c].B, m, DEFAULTS.cost, D[c].funding).trades.map((t) => ({ ...t, coin: c }))));
function sim(m, pct, Y) {
  const t0 = Date.UTC(Y, 0, 1) / 1000, t1 = Date.UTC(Y + 1, 0, 1) / 1000, T = trades(m).filter((t) => t.t >= t0 && t.t < t1).map((t) => { if (t.tExit < t1) return t; const B = D[t.coin].B, k = B.findIndex((b) => b.time + 14400 > t1) - 1, px = B[k].close, c = DEFAULTS.cost; return { ...t, tExit: t1, R: t.w * (t.dir * (px - t.entry) / t.entry - c.entryFee - c.timeFee) / t.dist, marked: true }; }), ev = [];
  T.forEach((t, k) => ev.push({ time: t.t, kind: 1, k }, { time: t.tExit, kind: 0, k })); ev.sort((a, b) => a.time - b.time || a.kind - b.kind);
  let bal = START, peak = START, dd = 0, low = START, maxOpen = 0, open = 0; const risked = {};
  for (const e of ev) { if (e.kind === 1) { risked[e.k] = bal * pct; open++; maxOpen = Math.max(maxOpen, open); } else { bal += T[e.k].R * risked[e.k]; open--; peak = Math.max(peak, bal); low = Math.min(low, bal); dd = Math.max(dd, (peak - bal) / peak); } }
  return { bal, dd, low, n: T.length };
}
const SETUPS = [['bb-core alone, 1.25%', 'bb', 0.0125], ['ONE account, 1.25%', 'one', 0.0125], ['SUB-ACCOUNT, 0.625% each (same max risk per coin)', 'two', 0.00625], ['SUB-ACCOUNT, 1.25% each (double the risk per coin)', 'two', 0.0125], ['SUB-ACCOUNT, 2.5% each (the earlier test)', 'two', 0.025], ['bb-core alone, 2.5% (same max risk as 1.25% each)', 'bb', 0.025], ['ONE account, 2.5%', 'one', 0.025]];
const YRS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
console.log(`# ₱30,000 started fresh every 1 Jan, compounding — ${V.toUpperCase()} candles, 5 coins (2026 to 21 Oct). End balance (worst drop from a peak)\n`);
console.log('| setup | ' + YRS.join(' | ') + ' |\n|---|' + YRS.map(() => '---').join('|') + '|');
const tot = {};
for (const [l, m, p] of SETUPS) { const r = YRS.map((y) => sim(m, p, y)); tot[l] = r; console.log(`| ${l} | ${r.map((x) => `${php(x.bal)} (${(x.dd * 100).toFixed(0)}%)`).join(' | ')} |`); }
console.log('\nSame in return, and what 30,000 turns into if each year\'s result is carried into the next (7 years in a row):\n\n| setup | median year | worst year | best year | years lost money | carried 7 years |\n|---|---|---|---|---|---|');
for (const [l] of SETUPS) { const r = tot[l].map((x) => x.bal / START - 1), s = [...r].sort((a, b) => a - b), carried = tot[l].reduce((a, x) => a * (x.bal / START), 1) * 30000; console.log(`| ${l} | ${(s[3] * 100).toFixed(0)}% | ${(s[0] * 100).toFixed(0)}% | ${(s[s.length - 1] * 100).toFixed(0)}% | ${r.filter((v) => v < 0).length}/7 | ₱${Math.round(carried).toLocaleString('en-US')} |`); }
