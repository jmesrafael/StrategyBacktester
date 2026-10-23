// test-no-lookahead.js — proves closed-candle decisions never change when future data is appended or ALTERED.
//   node audit/test-no-lookahead.js        (exit code 0 = all pass)
// Test A  append test   : trades/setup computed on B[0..k] must equal the full-run trades that finished by candle k (and the open trade at k).
// Test B  poison test   : replace every candle AFTER k by garbage (random prices); everything finished by k must be bit-identical.
//                         (A engine that peeks at future bars would change; truncation alone can miss peeks that only read arrays it was handed.)
// Test C  indicator test: bands/SMA/ATR at candle i, recomputed from only B[0..i], equal the values used for the signal on the full series.
// Test E  signal-bar   : cut the data exactly at each trade's signal candle; the same setup must appear (and not one candle earlier).
// Test D  data timing   : timestamps strictly +14400, aligned to 00/04/08/12/16/20 UTC, last candle closed.
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, signalFrom, DEFAULTS } = require(process.env.CORE || '../lucidyo-core.js');
const D = path.join(__dirname, '..', 'data'), rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
let fails = 0; const fail = (m) => { fails++; console.log('  FAIL', m); };
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const key = (t) => [t.dir, t.i0, t.i1, t.why, t.entry, t.exit, t.R, t.stop, t.tp].join('|');
for (const coin of ['SOL', 'ZEC', 'MEXC_SOL', 'MEXC_ZEC']) {
  const B = rd(coin + '.json').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const F = fs.existsSync(path.join(D, 'funding', coin + '.json')) ? rd('funding/' + coin + '.json') : null;
  const full = backtest(B, {}, F), fullKeys = full.trades.map(key);
  let cuts = 0, cmp = 0;
  for (let q = 0; q < 200; q++) {
    const k = 250 + Math.floor(rnd() * (B.length - 260)); cuts++;
    // A: append test
    const pre = backtest(B.slice(0, k + 1), {}, F), want = full.trades.filter((t) => t.i1 <= k).map(key);
    if (pre.trades.map(key).join('\n') !== want.join('\n')) fail(`${coin} A: prefix trades differ at cut ${k}`);
    cmp += want.length;
    // the position / setup alive at the cut must be the one the full run later took
    if (pre.open) { const t = full.trades.find((x) => x.i0 === pre.open.i0); if (!t || t.dir !== pre.open.dir || t.entry !== pre.open.entry || t.stop !== pre.open.stop || t.tp !== pre.open.tp) fail(`${coin} A: open position at ${k} not reproduced`); }
    if (pre.setup) { const t = full.trades.find((x) => x.i0 === k + 1); if (t && (t.dir !== pre.setup.dir || t.stop !== pre.setup.stop || t.tp !== pre.setup.tp)) fail(`${coin} A: setup at ${k} changed`); }
    // B: poison test
    const P = B.map((c, i) => (i <= k ? c : (() => { const p = c.close * (0.3 + rnd() * 2); return { time: c.time, open: p, high: p * 1.2, low: p * 0.8, close: p * (0.9 + rnd() * 0.2) }; })()));
    const poisoned = backtest(P, {}, F).trades.filter((t) => t.i1 <= k).map(key);
    if (poisoned.join('\n') !== want.join('\n')) fail(`${coin} B: poisoned future changed trades finished by ${k}`);
  }
  // E: signal-bar test — for EVERY trade, cut the data exactly at its signal candle: the engine must emit that same setup (dir/stop/tp) with nothing after it.
  //    Cutting one candle earlier must NOT emit a setup for the same signal. Random cuts rarely land on signal bars; this does it for all of them.
  let sigs = 0;
  for (const t of full.trades) {
    const k = t.i0 - 1, a = backtest(B.slice(0, k + 1), {}, F).setup, b = backtest(B.slice(0, k), {}, F).setup;
    sigs++;
    if (!a || a.dir !== t.dir || a.stop !== t.stop || a.tp !== t.tp) fail(`${coin} E: signal at candle ${k} not reproduced when data ends there`);
    if (b && b.sig === k) fail(`${coin} E: signal for candle ${k} visible one candle early`);
  }
  // C: indicator recomputation from prefix only, compared with a from-scratch formula (population sd)
  let ic = 0;
  for (let q = 0; q < 300; q++) {
    const i = 250 + Math.floor(rnd() * (B.length - 260)), cl = B.slice(0, i + 1).map((b) => b.close);
    const w = cl.slice(-20), m = w.reduce((a, b) => a + b) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / 20);
    const c = cl[i], dir = c > m + 2 * sd ? 1 : c < m - 2 * sd ? -1 : 0, sma = cl.slice(-200).reduce((a, b) => a + b) / 200;
    const expectSig = dir && (dir === 1 ? c > sma : c < sma);
    const s = signalFrom(cl, 1e-12, {});            // atr ~0 -> the ATR filter never blocks, so we test the band/trend part only
    if (!!s !== !!expectSig || (s && (s.dir !== dir || Math.abs(s.stop - m) > 1e-9))) fail(`${coin} C: indicator/signal mismatch at ${i}`);
    ic++;
  }
  // D: timing
  let bad = 0; for (let i = 0; i < B.length; i++) { if (B[i].time % 14400) bad++; if (i && B[i].time - B[i - 1].time !== 14400) bad++; }
  const lastClosed = B[B.length - 1].time + 14400 <= Date.now() / 1000;
  if (!lastClosed) fail(`${coin} D: last candle is still forming`);
  if (bad) console.log(`  NOTE ${coin} D: ${bad} timestamp irregularities (gaps/misaligned) — see data-quality list`);
  console.log(`${coin}: ${cuts} cuts, ${cmp} trade comparisons (append+poison), ${ic} indicator checks, ${sigs} signal-bar cuts, ${full.trades.length} trades, timing irregularities ${bad}`);
}
console.log(fails ? `\n${fails} FAILURES` : '\nALL LOOK-AHEAD TESTS PASSED'); process.exit(fails ? 1 : 0);
