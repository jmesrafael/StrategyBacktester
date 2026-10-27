// contender-check.js — the EMA 20/50 contender on SOL: (1) live-replay look-ahead proof, (2) is 20/50 a plateau or a lucky spike?,
// (3) year by year vs bb-core, (4) running bb-core and EMA together.   node contender-check.js [--coins SOL]
'use strict';
const { runStrat, NAMES } = require('./contenders.js');
const { backtest, summarize, scaleCost, DEFAULTS } = require('./v2-core.js');
const { loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const COIN = opt('coins', 'SOL'), D = loadCoin(COIN), M = loadCoin(COIN, 'mexc'), cost = DEFAULTS.cost, SPLIT = Date.UTC(2023, 0, 1) / 1000;
const f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3), f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
const E = (t) => t.reduce((a, x) => a + x.R, 0) / Math.max(1, t.length);

// 1) look-ahead: at random + trade-adjacent cut points the strategy sees candles 0..k only and must decide exactly as the full run
console.log(`# EMA crossover contender — ${COIN}\n\n## 1. Look-ahead check (live replay)\n`);
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let bad = 0, checks = 0;
for (const name of ['ema20/50', 'ema20/50-trend']) {
  const full = runStrat(D.B, name, cost, D.funding), r = rng(5), cuts = new Set(); let b = 0, c = 0;
  for (let j = 0; j < 120; j++) cuts.add(210 + Math.floor(r() * (D.B.length - 212)));
  for (const t of full.trades) { cuts.add(t.i0 - 1); cuts.add(t.i0); cuts.add(t.i1 - 1); cuts.add(t.i1); }
  for (const k of cuts) {
    if (k < 210 || k >= D.B.length - 1) continue;
    const p = runStrat(D.B.slice(0, k + 1), name, cost, D.funding.filter((f) => f[0] <= D.B[k].time + DEFAULTS.interval));
    const want = full.trades.filter((t) => t.i1 <= k);
    let ok = p.trades.length === want.length && p.trades.every((t, i) => t.i0 === want[i].i0 && t.i1 === want[i].i1 && Math.abs(t.R - want[i].R) < 1e-9);
    const span = full.trades.find((t) => t.i0 <= k && t.i1 > k) || (full.open && full.open.i0 <= k ? full.open : null);
    if (ok) ok = p.open ? !!span && span.i0 === p.open.i0 : !span;
    const nxt = full.trades.find((t) => t.i0 === k + 1) || (full.open && full.open.i0 === k + 1 ? full.open : null);
    if (ok) ok = p.setup ? !!nxt && nxt.dir === p.setup.dir : !nxt;
    c++; if (!ok) b++;
  }
  bad += b; checks += c; console.log(`- ${name.padEnd(17)} ${String(c).padStart(5)} cut points  ${b ? 'MISMATCH ' + b : 'identical'}`);
}
console.log(bad ? `\nFAIL: ${bad} mismatches` : `\nPASS: ${checks} cut points, 0 mismatches`);

// 2) neighbourhood
console.log('\n## 2. Plateau or spike? Neighbouring EMA pairs and stop sizes (E = expectancy per trade, R)\n');
const pairs = [[10, 30], [10, 50], [15, 40], [20, 40], [20, 50], [20, 60], [25, 60], [30, 70], [20, 100], [50, 100], [50, 200]];
console.log('| EMA pair | stop 1.5 ATR | stop 2 ATR | stop 3 ATR | trades (2 ATR) | total R (2 ATR) | E 2020–22 | E 2023+ | positive years (2 ATR) | with 200-SMA filter: E · total R · positive years |'); console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const [a, b2] of pairs) {
  const t = (k) => runStrat(D.B, `ema${a}/${b2}:${k}`, cost, D.funding).trades, t2 = t(2);
  console.log(`| ${a}/${b2}${a === 20 && b2 === 50 ? ' (textbook)' : ''} | ${f3(E(t(1.5)))} | **${f3(E(t2))}** | ${f3(E(t(3)))} | ${t2.length} | ${f1(t2.reduce((s, x) => s + x.R, 0))} | ${f3(E(t2.filter((x) => x.t < SPLIT)))} | ${f3(E(t2.filter((x) => x.t >= SPLIT)))} | ${Object.values(summarize(t2).years).filter((v) => v > 0).length}/${Object.keys(summarize(t2).years).length} | ${(() => { const tt = runStrat(D.B, `ema${a}/${b2}:2-trend`, cost, D.funding).trades, ss = summarize(tt); return f3(ss.avgR) + ' · ' + f1(ss.R) + ' · ' + Object.values(ss.years).filter((v) => v > 0).length + '/' + Object.keys(ss.years).length; })()} |`);
}

// 3) + 4) year by year and together
const bb = backtest(D.B, { cost }, D.funding).trades, em = runStrat(D.B, 'ema20/50', cost, D.funding).trades, both = [...bb, ...em];
const half = both.map((x) => ({ ...x, R: x.R / 2 }));
const yrs = [...new Set(both.map((x) => new Date(x.tExit * 1000).getUTCFullYear()))].sort();
const Y = (t) => summarize(t).years;
console.log('\n## 3. Year by year (R, $5 risk per trade → ×5 for $)\n');
console.log('| year | bb-core | EMA 20/50 | both (1R each) | both (½R each) |'); console.log('|---|---|---|---|---|');
for (const y of yrs) console.log(`| ${y} | ${f1(Y(bb)[y] || 0)} | ${f1(Y(em)[y] || 0)} | ${f1(Y(both)[y] || 0)} | ${f1(Y(half)[y] || 0)} |`);
console.log('\n## 4. Summary\n');
console.log('| | trades | win% | expectancy | total R | total $ ($5/R) | max drawdown | return ÷ drawdown | losing years |'); console.log('|---|---|---|---|---|---|---|---|---|');
for (const [l, t] of [['bb-core', bb], ['EMA 20/50', em], ['both, 1R each', both], ['both, ½R each (same risk as bb-core alone)', half]]) {
  const s = summarize(t); console.log(`| ${l} | ${s.n} | ${(s.win * 100).toFixed(0)}% | ${f3(s.avgR)}R | ${f1(s.R)} | ${f1(s.R * 5).replace('+', '+$').replace('-', '−$')} | ${s.dd.toFixed(1)}R | ${(s.R / s.dd).toFixed(1)} | ${Object.values(s.years).filter((v) => v <= 0).length} |`);
}
const emM = runStrat(M.B, 'ema20/50', cost, M.funding).trades, bbMx = backtest(M.B, { cost }, M.funding).trades, sm = summarize([...bbMx, ...emM].map((x) => ({ ...x, R: x.R / 2 }))), sb = summarize(bbMx);
console.log(`\nMEXC candles: bb-core ${f1(sb.R)}R, DD ${sb.dd.toFixed(1)}R (R/DD ${(sb.R / sb.dd).toFixed(1)}) · both at ½R ${f1(sm.R)}R, DD ${sm.dd.toFixed(1)}R (R/DD ${(sm.R / sm.dd).toFixed(1)}) · EMA alone E ${f3(E(emM))}R`);
