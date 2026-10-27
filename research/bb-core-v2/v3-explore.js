// v3-explore.js — new structural ideas vs bb-core on one coin (default SOL). Real fees/slippage/funding.
//   node v3-explore.js [--coins SOL]
// Every row is checked four ways: 2020–2023, 2024+, MEXC candles, fees+slippage ×2. "robust" = beats bb-core on ALL four.
'use strict';
const { backtest, scaleCost, DEFAULTS } = require('./v3-core.js');
const { summarize } = require('./v2-core.js');
const { loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const COIN = opt('coins', 'SOL'), BIN = loadCoin(COIN, 'binance'), MEX = loadCoin(COIN, 'mexc');
const R = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);

const go = (cfg, D, k = 1) => backtest(D.B, { ...cfg, cost: scaleCost(DEFAULTS.cost, k) }, D.funding).trades;
// equity-curve filter, applied to the bb-core trade list as a SHADOW book (live: the bot paper-tracks every bb-core signal and only
// takes a real trade when the last N shadow trades that closed before the entry sum to >= thr R). Uses only trades already closed.
function eqFilter(trades, N, thr) {
  const byExit = [...trades].sort((a, b) => a.tExit - b.tExit);
  return trades.filter((t) => { const done = byExit.filter((x) => x.tExit <= t.t); if (done.length < N) return true; return done.slice(-N).reduce((a, x) => a + x.R, 0) >= thr; });
}
function peakOpen(trades) { const ev = []; for (const t of trades) { ev.push([t.i0, 1], [t.i1, -1]); } ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]); let c = 0, m = 0; for (const [, d] of ev) { c += d; m = Math.max(m, c); } return m; }

function evaluate(cfg, post = (t) => t) {
  const t = post(go(cfg, BIN)), s = summarize(t);
  return { t, s, mex: summarize(post(go(cfg, MEX))).R, x2: summarize(post(go(cfg, BIN, 2))).R, peak: peakOpen(t) };
}
const base = evaluate({});
function header(title, note) {
  console.log(`\n## ${title}\n${note ? note + '\n' : ''}`);
  console.log('| config | trades | total R | win% | avg R | maxDD R | R/DD | yrs+ | R ≤2023 | R ≥2024 | MEXC R | costs ×2 R | max open | R per 100 position-candles | robust? |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
}
const found = [];
function row(label, cfg, post) {
  const e = evaluate(cfg, post), s = e.s, ys = Object.values(s.years), b = base.s;
  const robust = s.isR > b.isR && s.oosR > b.oosR && e.mex > base.mex && e.x2 > base.x2;
  if (robust) found.push([label, e]);
  console.log(`| ${label} | ${s.n} | **${R(s.R)}** | ${(s.win * 100).toFixed(0)}% | ${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)} | ${s.dd.toFixed(1)} | ${(s.R / s.dd).toFixed(1)} | ${ys.filter((v) => v > 0).length}/${ys.length} | ${R(s.isR)} | ${R(s.oosR)} | ${R(e.mex)} | ${R(e.x2)} | ${e.peak} | ${(100 * s.R / e.t.reduce((a, x) => a + x.bars, 0)).toFixed(2)} | ${robust ? '**yes**' : ''} |`);
}

console.log(`# v3 ideas vs bb-core — ${COIN}\n`);
console.log('robust? = beats bb-core in 2020–2023 AND 2024+ AND on MEXC candles AND with costs doubled. "max open" = most positions open at the same time (risk scales with it).');
header('Baseline'); row('bb-core', {});

header('1. Pyramiding — take signals that fire while a trade is open', 'Each extra position risks the same 1R with its own stop/target/time exit. addMinR = only add when every open position is already that far in profit.');
for (const mp of [2, 3, 5]) for (const am of [null, 0, 1, 2]) row(`up to ${mp} positions${am == null ? '' : `, add only if open ones ≥ +${am}R`}`, { maxPos: mp, addMinR: am });
row('up to 2 positions, either direction', { maxPos: 2, addSameDir: false });

header('1b. EVERY signal gets its own entry, even on a coin that already has trades open', 'maxPos 99 = no limit. "R per 100 position-candles" = return per unit of exposure (bb-core holds one position at a time, so more open trades = more money at risk at once).');
row('every signal, same direction as open trades', { maxPos: 99 });
row('every signal, either direction', { maxPos: 99, addSameDir: false });
row('every signal, same direction, only when open trades ≥ +0R', { maxPos: 99, addMinR: 0 });
header('2. Let winners run — at the 48-candle exit keep trades that are in profit', 'extendIfR = keep the trade if it is at least this far in profit at candle 48; lock = stop moves to entry + lock R; then exit at maxBars2 at the latest.');
for (const ifR of [0, 0.5, 1, 2]) for (const lock of [0, 0.5]) for (const mb2 of [96, 144]) if (lock <= ifR) row(`keep if ≥ +${ifR}R, lock +${lock}R, max ${mb2} candles`, { extendIfR: ifR, extendLockR: lock, maxBars2: mb2 });

header('3. Chandelier trailing stop for big moves', 'Once the trade has been chandAtR in profit, the stop trails the best price − k × ATR. Larger targets let the trail do the exiting.');
for (const at of [1, 2, 3]) for (const k of [2, 3, 4]) for (const tg of [4, 8]) row(`trail from +${at}R at ${k} ATR, target ${tg}R`, { chandAtR: at, chandAtr: k, targetR: tg });
for (const at of [2, 3]) for (const k of [3, 4]) row(`trail from +${at}R at ${k} ATR, target 8R, max 96 candles`, { chandAtR: at, chandAtr: k, targetR: 8, maxBars: 96 });

header('4. Equity-curve filter — pause when the strategy itself is cold', 'Shadow book: every bb-core signal is paper-tracked; a real trade is taken only when the last N closed shadow trades sum to ≥ thr R.');
for (const N of [5, 10, 20, 30]) for (const thr of [0, -3]) row(`last ${N} trades ≥ ${thr}R`, {}, (t) => eqFilter(t, N, thr));

header('5. Breakout must also be a new N-candle closing high/low');
for (const N of [10, 20, 50, 100]) row(`new ${N}-candle extreme`, { newHighN: N });

console.log(`\n## Robust on ${COIN} (${found.length} of the rows above)\n`);
if (!found.length) console.log('None: no idea beat bb-core in both periods, on MEXC and at double costs.');
else for (const [l, e] of found) console.log(`- ${l}: ${R(e.s.R)}R (bb-core ${R(base.s.R)}R), maxDD ${e.s.dd.toFixed(1)}R (bb-core ${base.s.dd.toFixed(1)}R), max ${e.peak} open at once`);
