// acceptance-math.js — how many events a paper-trading window really contains, and what each acceptance criterion can statistically prove.
//   node audit/acceptance-math.js
// Everything printed is computed from data/ (MEXC and Binance candles, engine with the C3 fix) or from exact binomial / normal formulas.
// ASSUMPTIONS (not measured) are marked ASSUMED.
'use strict';
const fs = require('fs'), path = require('path');
const { backtest } = require('../../../🔴BB-Core/lucidio-core.js');
const D = path.join(__dirname, '..', '..', '..', '🔴BB-Core', 'data'), rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const DAY = 86400, mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function load(c) {
  const B = rd(c + '.json').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  let F = rd('funding/' + c + '.json'); if (c.startsWith('MEXC_')) { const bin = rd('funding/' + c.slice(5) + '.json'); F = [...bin.filter((r) => r[0] < F[0][0]), ...F]; }
  return { B, F };
}
const sets = {};
for (const v of ['MEXC_', '']) { const all = []; let t0 = Infinity, t1 = 0; for (const c of ['SOL', 'ZEC']) { const { B, F } = load(v + c); const tr = backtest(B, {}, F).trades; all.push(...tr.map((t) => ({ ...t, coin: c }))); t0 = Math.min(t0, B[200].time); t1 = Math.max(t1, B[B.length - 1].time); } sets[v || 'BINANCE_'] = { tr: all.sort((a, b) => a.t - b.t), t0, t1 }; }

console.log('=== 1. HOW MANY TRADES (SOL+ZEC together) IN 60 / 90 / 180 DAYS ===');
for (const [name, s] of Object.entries(sets)) {
  const years = (s.t1 - s.t0) / (365.25 * DAY), tpy = s.tr.length / years;
  console.log(`\n${name} candles: ${s.tr.length} trades over ${years.toFixed(2)} years = ${tpy.toFixed(1)} trades/year for the PAIR (${(tpy / 2).toFixed(1)}/coin) = ${(tpy / 365.25).toFixed(3)} per day`);
  // full calendar years only
  const fy = [2021, 2022, 2023, 2024, 2025].map((y) => s.tr.filter((t) => new Date(t.t * 1000).getUTCFullYear() === y).length);
  console.log(`  entries per full calendar year 2021..2025: ${fy.join(', ')}  (mean ${mean(fy).toFixed(1)})`);
  console.log('  window   expected   rolling-window distribution of trade ENTRIES (every start day from history):  min   p5   p25  median  p75  p95  max   P(>=25 trades)  P(>=30)');
  for (const W of [60, 90, 180, 365]) {
    const counts = []; for (let st = s.t0; st + W * DAY <= s.t1; st += DAY) counts.push(s.tr.filter((t) => t.t >= st && t.t < st + W * DAY).length);
    const ge = (k) => (100 * counts.filter((c) => c >= k).length / counts.length).toFixed(0) + '%';
    console.log(`  ${String(W).padStart(4)}d   ${(tpy * W / 365.25).toFixed(1).padStart(7)}     ${' '.repeat(62)}${[Math.min(...counts), q(counts, .05), q(counts, .25), q(counts, .5), q(counts, .75), q(counts, .95), Math.max(...counts)].map((x) => String(x).padStart(4)).join(' ')}      ${ge(25).padStart(5)}        ${ge(30).padStart(5)}`);
  }
  // days until >=25 / >=50 / >=100 trades with 80% / 95% probability
  const need = (k, p) => { for (let W = 20; W <= 1500; W += 5) { const counts = []; for (let st = s.t0; st + W * DAY <= s.t1; st += 3 * DAY) counts.push(s.tr.filter((t) => t.t >= st && t.t < st + W * DAY).length); if (counts.filter((c) => c >= k).length / counts.length >= p) return W; } return NaN; };
  console.log(`  days needed for >= 25 trades: ${need(25, .5)} (50% of start dates) / ${need(25, .8)} (80%) / ${need(25, .95)} (95%);  >= 50 trades: ${need(50, .5)} / ${need(50, .8)} / ${need(50, .95)};  >= 100 trades: ${need(100, .5)} / ${need(100, .8)} / ${need(100, .95)};  >= 300 trades: ${need(300, .5)} days`);
}
console.log('\n(The old report said "60 days is about 100 trades for the pair". The data say ~17. 100 is the number per YEAR.)');

const R = sets.MEXC_.tr.map((t) => t.R), sdR = sd(R), mR = mean(R);
console.log(`\n=== 2. WHAT A TRADE COUNT CAN PROVE ABOUT PROFIT (MEXC candles, base costs + funding: mean ${mR.toFixed(3)}R, sd per trade ${sdR.toFixed(2)}R) ===`);
console.log('  trades   window(days)   SE of mean R   95% CI half-width   z if true mean = +0.15R   z if +0.30R');
for (const n of [17, 25, 50, 100, 200, 300, 600]) { const se = sdR / Math.sqrt(n); console.log(`  ${String(n).padStart(6)}   ${String(Math.round(n / (sets.MEXC_.tr.length / ((sets.MEXC_.t1 - sets.MEXC_.t0) / DAY)))).padStart(11)}   ${se.toFixed(3).padStart(12)}   +/-${(1.96 * se).toFixed(3).padStart(8)}R        ${(0.15 / se).toFixed(2).padStart(10)}                  ${(0.30 / se).toFixed(2).padStart(6)}`); }
const dayPerTrade = ((sets.MEXC_.t1 - sets.MEXC_.t0) / DAY) / sets.MEXC_.tr.length;
const nFor = (edge, power = 0.8, alpha = 0.05) => { const za = alpha === 0.05 ? 1.645 : 2.326, zb = power === 0.8 ? 0.8416 : 1.2816; return Math.ceil(((za + zb) * sdR / edge) ** 2); };
console.log('\n  trades needed to reject "true edge = 0" (one-sided 5%) with 80% power, if the TRUE edge is:');
for (const e of [0.10, 0.15, 0.25, 0.35]) console.log(`    +${e.toFixed(2)}R/trade: ${nFor(e)} trades = ${(nFor(e) * dayPerTrade / 365.25).toFixed(1)} years`);
console.log('  (report said "300+ trades, about 2 years": 300 trades is ' + (300 * dayPerTrade / 365.25).toFixed(1) + ' years at the historical rate)');

// the README stop-review trigger: rolling 50-trade sum below -14R
let seed = 11; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const dm = R.map((r) => r - mR);
console.log('\n=== 3. README STOP TRIGGER "rolling 50-trade result below -14R": how often does it fire by chance? (bootstrap of the trade-R distribution, mean shifted to the stated true edge, 20000 runs, 200 trades = ~2 years) ===');
for (const edge of [0.30, 0.15, 0.0, -0.10]) {
  let hit = 0, N = 20000, first = []; for (let k = 0; k < N; k++) { const a = []; let fired = -1; for (let i = 0; i < 200; i++) { a.push(dm[Math.floor(rnd() * dm.length)] + edge); if (i >= 49 && fired < 0) { let s = 0; for (let j = i - 49; j <= i; j++) s += a[j]; if (s < -14) fired = i; } } if (fired >= 0) { hit++; first.push(fired + 1); } }
  console.log(`  true edge ${edge >= 0 ? '+' : ''}${edge.toFixed(2)}R/trade: trigger fires within 200 trades in ${(100 * hit / N).toFixed(1)}% of runs${first.length ? ` (median trade # ${q(first, .5)})` : ''}`);
}

console.log('\n=== 3b. CANDIDATE REPLACEMENT TRIGGERS: P(fires within 300 trades ~ 3 years) for a rolling-window sum of R below -X ===');
console.log('  window  X       true edge +0.30R   +0.15R    0.00R   -0.10R     (a good trigger rarely fires at +0.15R and usually fires at 0R or worse)');
for (const [W, X] of [[50, 14], [100, 20], [100, 25], [100, 30], [150, 30], [150, 40]]) {
  const row = [];
  for (const edge of [0.30, 0.15, 0.0, -0.10]) {
    let hit = 0; const N = 6000;
    for (let k = 0; k < N; k++) { const a = []; let f = false; for (let i = 0; i < 300 && !f; i++) { a.push(dm[Math.floor(rnd() * dm.length)] + edge); if (i >= W - 1) { let sm = 0; for (let j = i - W + 1; j <= i; j++) sm += a[j]; if (sm < -X) f = true; } } if (f) hit++; }
    row.push((100 * hit / N).toFixed(1).padStart(6) + '%');
  }
  console.log(`  ${String(W).padStart(4)}   -${String(X).padStart(2)}R              ${row.join('   ')}`);
}

console.log('\n=== 4. EXACT BINOMIAL: how many FAILURES may a criterion tolerate and still prove "true failure rate <= q" at 95% confidence? ===');
const lf = (() => { const t = [0, 0]; for (let i = 2; i < 5000; i++) t[i] = t[i - 1] + Math.log(i); return t; })();
const binomCdf = (k, n, p) => { let s = 0; for (let i = 0; i <= k; i++) s += Math.exp(lf[n] - lf[i] - lf[n - i] + (i ? i * Math.log(p) : 0) + (n - i) * Math.log(1 - p)); return s; };
const maxFail = (n, qq) => { let k = -1; while (k < n && binomCdf(k + 1, n, qq) <= 0.05) k++; return k; }; // largest k with P(X<=k | q) <= 5%
const ns = [['17 trades (60 d)', 17], ['25 trades', 25], ['50 trades (~6 mo)', 50], ['100 trades (~1 yr)', 100], ['360 candles (1 coin, 60 d)', 360], ['720 candles (2 coins, 60 d)', 720], ['1080 candles (2 coins, 90 d)', 1080], ['2160 candles (2 coins, 180 d)', 2160]];
console.log('  sample                          prove rate<=0.5%   <=1%   <=5%   <=10%   <=20%     (entry = max allowed failures; "-" = cannot be proven with this n)');
for (const [lab, n] of ns) console.log(`  ${lab.padEnd(30)} ${[0.005, 0.01, 0.05, 0.10, 0.20].map((qq) => { const k = maxFail(n, qq); return (k < 0 ? '-' : String(k)).padStart(8); }).join('  ')}`);
console.log('  e.g. 720 candles with 0 revisions proves "revision rate <= 0.5%" (needs n >= 598); with 17 trades even 0 failures only proves "<= 16%".');

console.log('\n=== 5. PAIRED / CONTINUOUS CRITERIA: CI half-width of a mean with n trades (ASSUMED per-trade sd; measure the real one in the first 10 trades) ===');
console.log('  quantity                         ASSUMED sd   n=17     n=25     n=50');
for (const [lab, s] of [['entry slippage vs signal-candle open (% of price)', 0.05], ['live R minus reference R (R)', 0.20], ['fee+slippage per trade (R)', 0.10]]) console.log(`  ${lab.padEnd(48)} ${String(s).padStart(5)}   ${[17, 25, 50].map((n) => ('+/-' + (1.96 * s / Math.sqrt(n)).toFixed(3)).padStart(8)).join('  ')}`);
