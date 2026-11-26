// forward.js — how the two new strategies (and live BB-CORE for scale) have done on candles that did not exist when their rules were frozen.
//   node ../candles/update.js      (get the newest candles first)
//   node forward.js
// Read-only, Binance candles with real funding, fee 0.05% + slippage 0.02% per side, the six BB-CORE coins, entries from Nov 26, 2026.
// The rules below are the frozen ones. Do not change them during the test. It also prints where the result sits among past 90-day stretches.
'use strict';
const C = require('../candles/candles.js');
const S = require('../research/replace-nov25/sim.js');
const L4 = require('../research/hunt-4h-nov26/lib.js'), F4 = require('../research/hunt-4h-nov26/fam.js');
const L1 = require('../research/hunt-1h-nov26/lib.js'), FV = require('../research/hunt-1h-nov26/fam-vol.js');
const { run } = require('../research/strat-hunt-nov6/engine.js');
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'];
const START = Date.UTC(2026, 10, 26) / 1000, FROZEN = Date.UTC(2026, 10, 25) / 1000, DAY = 86400;
const ICHI = { fam: 'ichi', p: { t: 9, k: 26, s: 52, mode: 'cross' }, trend: 0, exit: { k: 2, bars: 12 } };
const WIDE = [{ len: 80, mult: 2.6, trend: 800, minStop: 0.3, filt: null }, { kind: 'M', bars: 192 }];

const hunt = (L, strat, ex, iv) => (coin) => {
  const x = L.coin(coin), r = run(x.B, x.atr14, strat(x), ex, x.funding, iv);
  return { trades: r.trades.map((t) => ({ ...t, coin, w: 1 })), open: r.open ? { coin, dir: r.open.dir, t: x.B[r.open.i0].time } : null, last: x.B[x.n - 1].time + iv };
};
// BB-CORE v4 through the replacement study's engine, on every candle in the library (its own loader stops at Nov 24, 2026)
const bbCore = (coin) => {
  const rows = C.load(coin, '4h'), per = new Float64Array(rows.length); let k = 0;
  for (const [ft, rate] of C.funding(coin)) { while (k < rows.length && rows[k][0] + S.IV < ft) k++; if (k < rows.length && ft > rows[k][0]) per[k] += rate; }
  const x = S.pack(coin, rows, per), m = new S.Pos(x, 'bbT'), trades = [];
  for (let i = 0; i < x.n; i++) { m.open(i, null, (t) => trades.push({ ...t, coin })); m.shut(i, 1.05); }
  return { trades, open: m.pos ? { coin, dir: m.pos.dir, t: x.T[m.pos.i0] } : null, last: x.T[x.n - 1] + S.IV };
};
const STRATS = [
  ['ICHI-X4', hunt(L4, (x) => F4.build(x, ICHI), F4.exOf(ICHI), 14400)],
  ['BB-1H-WIDE', hunt(L1, FV.strat(...WIDE), FV.mkEx(WIDE[1]), 3600)],
  ['BB-CORE v4 (live rules)', bbCore],
];
const day = (t) => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const sg = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);

for (const [name, fn] of STRATS) {
  const res = COINS.map(fn), all = res.flatMap((r) => r.trades), last = Math.min(...res.map((r) => r.last));
  const fwd = all.filter((t) => t.t >= START).sort((a, b) => a.tExit - b.tExit), open = res.map((r) => r.open).filter((o) => o && o.t >= START);
  const R = (a) => a.reduce((s, t) => s + t.w * t.R, 0);
  let eq = 0, pk = 0, dd = 0; for (const t of fwd) { eq += t.w * t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  console.log(`\n${name}   candles up to ${day(last)} UTC`);
  console.log(`  since ${day(START)}: ${fwd.length} closed trades, ${sg(R(fwd))}R, win ${fwd.length ? Math.round((100 * fwd.filter((t) => t.R > 0).length) / fwd.length) : 0}%, worst fall ${dd.toFixed(1)}R, open now ${open.length}${open.length ? ' (' + open.map((o) => `${o.coin} ${o.dir === 1 ? 'long' : 'short'}`).join(', ') + ')' : ''}`);
  // where does this sit among every stretch of the same length before the rules were frozen?
  const days = Math.max(30, Math.min(365, Math.floor((last - START) / DAY))), sums = [];
  for (let a = Date.UTC(2020, 3, 1) / 1000; a + days * DAY <= FROZEN; a += 7 * DAY) sums.push(R(all.filter((t) => t.t >= a && t.tExit <= a + days * DAY)));
  sums.sort((a, b) => a - b);
  const q = (p) => sums[Math.floor(p * (sums.length - 1))];
  console.log(`  past stretches of ${days} days (2020 to Nov 2026): bad (1 in 20) ${sg(q(0.05))}R · middle ${sg(q(0.5))}R · good (19 in 20) ${sg(q(0.95))}R`);
  if (last - START >= 30 * DAY) console.log(`  this test is above ${Math.round((100 * sums.filter((v) => v < R(fwd)).length) / sums.length)}% of those`);
  else console.log('  too short to judge (under 30 days of new candles)');
}
console.log('\nReview: end of February 2027. A strategy FAILS if its result is below the bad (1 in 20) line, or if its paper bot does not match its backtest.');
console.log('Beating another strategy over three months proves little: do not pick a winner on that alone.');
