// multiple-testing.js — how many variants / coins were tried in research/bollinger/ (plus this audit's own looks), and what that does to the SOL+ZEC result.
//   node audit/multiple-testing.js
// Part A  counts (each line: where the number comes from).
// Part B  corrections: (1) effective number of independent trials (PCA participation ratio) for coins and for parameter variants,
//         (2) Sidak-adjusted p-values, (3) Deflated Sharpe Ratio (Bailey & Lopez de Prado 2014), (4) empirical-Bayes shrinkage of the coin edge.
// Series: trade R summed per calendar day (0 on days without a closed trade), screen = base costs, NO funding (funding exists only for a few coins).
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, DEFAULTS } = require('../lucidio-core.js');
const RB = path.join(__dirname, '..', '..', 'research', 'bollinger'), D = path.join(__dirname, '..', 'data'), DAY = 86400;
const toB = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };

// ---------------------------------------------------------------- Part A: counts
const GRID = (...a) => a.reduce((p, x) => p * x, 1);
const jsonLen = (f) => JSON.parse(fs.readFileSync(path.join(RB, f), 'utf8')).length;
const sweepPts = (sw, base) => 1 + Object.entries(sw).reduce((s, [k, v]) => s + v.filter((x) => x !== base[k]).length, 0); // base + every non-base value
const SW_SQ = { n: [14, 20, 30, 40], k: [1.5, 2, 2.5, 3], look: [50, 100, 200], pct: [0.1, 0.15, 0.25, 0.35, 0.5], recent: [1, 3, 6, 10, 20], stop: ['mid', 1, 1.5, 2, 3], tp: [1.5, 2, 3, 4, 5], trendN: [0, 50, 100, 200], beR: [0, 1], maxBars: [0, 12, 24, 48] };
const BASE_SQ = { n: 20, k: 2, look: 100, pct: 0.25, recent: 10, stop: 'mid', tp: 3, trendN: 0, beR: 0, maxBars: 0 };
const SW_FVG = { minGap: [0.1, 0.2, 0.3, 0.5, 0.8, 1.2], disp: [0, 0.5, 1, 1.5], depth: [0, 0.25, 0.5, 0.75, 1], stop: ['gap', 'c2', 'origin'], tp: [1, 1.5, 2, 3, 4, 5], expire: [3, 6, 12, 20, 40], trend: [0, 'htf'], maxHold: [0, 12, 24, 48], fillBuf: [0, 0.05, 0.1, 0.25], direct: [false, true] };
const BASE_FVG = { minGap: 0.5, disp: 0, depth: 0, stop: 'origin', tp: 3, expire: 20, trend: 'htf', maxHold: 0, fillBuf: 0, direct: false };
const data4h = fs.readdirSync(path.join(RB, 'data4h')).filter((f) => f.endsWith('.json')).length;
const T = [ // [id, what, settings, coins, source, how derived, family]
  ['A1', 'explore1: mean-reversion + squeeze grids, 15m/1h/4h', jsonLen('results-explore1.json'), 3, 'explore1.js', 'rows in results-explore1.json (exact)', 'BB'],
  ['A2', 'explore2: one-factor sweeps of the squeeze breakout, 60/120/240m', 3 * sweepPts(SW_SQ, BASE_SQ), 3, 'explore2.js', '3 timeframes x (base + every non-base sweep value), computed from the SWEEP table', 'BB'],
  ['A3', 'explore3: squeeze vs no squeeze control, 4h', GRID(3, 2, 2, 2, 2), 3, 'explore3.js', 'loop product 3x2x2x2x2', 'BB'],
  ['A4', 'bb-focus robustness grid (n x k x trend x target x time exit) SOL/DOGE/ZEC', GRID(3, 3, 3, 3, 3), 3, 'bb-focus.js:45', 'loop product 3^5 (reported "243 nearby settings")', 'BB'],
  ['A5', 'rr4: target 3R/4R/5R (BB) after seeing all years', 3, 4, 'rr4.js', 'SYS table; 4R chosen', 'BB'],
  ['A6', 'tf-sweep: frozen rules on 9 timeframes (5m..1D); 4h kept', 9 * 4, 3, 'tf-sweep.js', '9 TFs x (2 cost cases + same-hold + by-year runs)', 'BB'],
  ['A7', 'tune2h: 2h-chart grid (n,k,trend,target,time-exit,stop)', GRID(4, 4, 4, 4, 4, 3), 3, 'tune2h.js:12', 'loop product 4x4x4x4x4x3 (different timeframe; searched on SOL/DOGE/ZEC)', 'BB-2h'],
  ['A8', 'bb-deep: candidate improvements (skip filters, break-even, throttle)', 6 + 2, 3, 'bb-deep.js:350', 'HYP table + throttle', 'BB'],
  ['A9', 'bb-deep: conditions-at-entry views (5 features x 3 terciles) + month-regime buckets (5 x ~4)', 15 + 18, 3, 'bb-deep.js', 'descriptive tables, none adopted', 'BB'],
  ['B1', 'explore-fvg: FVG pullback grids, 15/60/240m (BTC/ETH/SOL) + SOL 5m + SOL/ZEC/DOGE 60 & 240m', 288 * 6, 3, 'explore-fvg.js', '6 result files x 288 (exact)', 'FVG'],
  ['B2', 'explore-fvg2: FVG one-factor sweeps, 240m and 60m, two coin sets', 2 * 2 * sweepPts(SW_FVG, BASE_FVG), 3, 'explore-fvg2.js', '2 TFs x 2 coin sets x sweep points', 'FVG'],
  ['B3', 'explore-confirm: FVG confirmation entries, 240/60/15m (as documented in its usage line)', GRID(2, 2, 3, 3, 2, 2) * 3, 3, 'explore-confirm.js', 'loop product 144 x 3 TFs (upper bound: no result file kept)', 'FVG'],
  ['B4', 'test-fvg: frozen FVG, 3 entry modes x 4 timeframes', 12, 3, 'test-fvg.js', 'MODES x TFS', 'FVG'],
  ['C1', 'test-frozen: frozen BB rules on 13 coins (3 tuned + 10 fresh)', 1, 13, 'test-frozen.js', '1 setting, 13 coins', 'coins'],
  ['C2', 'coin screen: frozen 4h rules on every coin file in data4h (COIN-REGISTRY)', 1, data4h, 'data4h/, COIN-REGISTRY-bb-breakout.md', `${data4h} coin files in data4h (robustness.js analysed 131 with >=1500 candles and >=40 trades)`, 'coins'],
  ['D1', 'this audit: one-at-a-time + 72-set grid + walk-forward', 22 + 72, 2, 'audit/robustness.js', 'counted from the script', 'audit'],
];
console.log('=== PART A: WHAT WAS TRIED (research/bollinger/ + this audit) ===');
console.log('id  settings x coins   source                         what');
let totSettings = 0, totEval = 0; const fam = {};
for (const [id, what, n, coins, src, how, f] of T) {
  console.log(`${id.padEnd(3)} ${String(n).padStart(6)} x ${String(coins).padEnd(3)}      ${src.padEnd(30)} ${what}\n      derived: ${how}`);
  if (f !== 'coins') { totSettings += n; totEval += n * coins; fam[f] = (fam[f] || 0) + n; }
}
console.log(`\nSETTINGS evaluated (strategy parameter sets, excluding the coin screens): ${totSettings}  (by family: ${Object.entries(fam).map(([k, v]) => k + ' ' + v).join(', ')})`);
console.log(`setting x coin evaluations: ${totEval} (+ ${data4h} coin screens of one frozen setting + 13 in test-frozen)`);
console.log('Strategy FAMILIES compared before choosing: mean reversion (MR), squeeze breakout, no-squeeze breakout (chosen), FVG pullback/confirm/direct = 5.');
console.log('Timeframes compared: 5m,15m,30m,1h,2h,4h,6h,12h,1D. Coins: 133 data files screened, ~25 examined in detail (COIN-REGISTRY), 2 chosen.');
console.log('NOT counted (cannot be, not recorded): parameter ideas tried interactively and discarded, earlier "v7" variants (REPORT notes ~200), 35 scripts edited and re-run.');

// ---------------------------------------------------------------- Part B
const cost = DEFAULTS.cost;
const day = (t) => Math.floor(t / DAY);
function dailySeries(trades, d0, d1) { const n = d1 - d0 + 1, s = new Float64Array(n); for (const t of trades) { const i = day(t.tExit) - d0; if (i >= 0 && i < n) s[i] += t.R; } return s; }
function moments(x) { const m = mean(x), s = sd(x), n = x.length; let g3 = 0, g4 = 0; for (const v of x) { const z = (v - m) / s; g3 += z ** 3; g4 += z ** 4; } return { m, s, sr: m / s, g3: g3 / n, g4: g4 / n, n }; }
// normal cdf / inverse
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
function PhiInv(p) { // Acklam
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00], b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01],
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00], d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pl = 0.02425; let q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
function eigenvalues(M) { // Jacobi, symmetric
  const n = M.length, A = M.map((r) => [...r]);
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2; if (off < 1e-14) break;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-15) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const kp = A[k][p], kq = A[k][q]; A[k][p] = c * kp - s * kq; A[k][q] = s * kp + c * kq; }
      for (let k = 0; k < n; k++) { const pk = A[p][k], qk = A[q][k]; A[p][k] = c * pk - s * qk; A[q][k] = s * pk + c * qk; }
    }
  }
  return A.map((r, i) => r[i]);
}
function nEff(series) { // series: array of equal-length arrays -> participation ratio of the correlation-matrix eigenvalues
  const k = series.length, z = series.map((s) => { const m = mean(s), v = sd(s) || 1; return Array.from(s, (x) => (x - m) / v); });
  const C = Array.from({ length: k }, () => new Array(k).fill(0)), n = z[0].length;
  for (let i = 0; i < k; i++) for (let j = i; j < k; j++) { let s = 0; for (let t = 0; t < n; t++) s += z[i][t] * z[j][t]; C[i][j] = C[j][i] = s / (n - 1); }
  const ev = eigenvalues(C).filter((x) => x > 0), S = ev.reduce((a, b) => a + b, 0), S2 = ev.reduce((a, b) => a + b * b, 0);
  let off = 0; for (let i = 0; i < k; i++) for (let j = 0; j < i; j++) off += C[i][j]; return { k, nEff: S * S / S2, avgCorr: off / (k * (k - 1) / 2) };
}
const weekly = (daily) => { const w = []; for (let i = 0; i + 7 <= daily.length; i += 7) { let s = 0; for (let j = 0; j < 7; j++) s += daily[i + j]; w.push(s); } return w; };

// ---- load all coins
const files = fs.readdirSync(path.join(RB, 'data4h')).filter((f) => f.endsWith('.json'));
const coins = [];
for (const f of files) {
  let rows; try { rows = JSON.parse(fs.readFileSync(path.join(RB, 'data4h', f), 'utf8')); } catch { continue; }
  if (!Array.isArray(rows) || rows.length < 1500) continue;
  const B = toB(rows), tr = backtest(B, { cost }).trades; if (tr.length < 40) continue;
  coins.push({ c: f.slice(0, -5), B, tr, t0: day(B[0].time), t1: day(B[B.length - 1].time), R: tr.map((t) => t.R) });
}
// SOL and ZEC are not in research data4h (that folder is "every other coin"): add them from data/ so the cross-section contains the selected coins too
for (const c of ['SOL', 'ZEC']) { const B = toB(JSON.parse(fs.readFileSync(path.join(D, c + '.json'), 'utf8'))), tr = backtest(B, { cost }).trades; coins.push({ c, B, tr, t0: day(B[0].time), t1: day(B[B.length - 1].time), R: tr.map((t) => t.R) }); }
const D1 = Math.max(...coins.map((c) => c.t1)), D0all = Math.min(...coins.map((c) => c.t0));
for (const c of coins) { c.daily = dailySeries(c.tr, c.t0, D1); c.m = moments(c.daily); c.avg = mean(c.R); c.se = sd(c.R) / Math.sqrt(c.R.length); c.t = c.avg / c.se; }
coins.sort((a, b) => b.avg - a.avg);
const byName = (n) => coins.find((c) => c.c === n);
console.log(`\n=== PART B: CORRECTIONS (${coins.length} coins = 131 from research data4h with >=1500 candles and >=40 trades, plus SOL and ZEC; base costs, no funding) ===`);
for (const n of ['SOL', 'ZEC']) { const c = byName(n); console.log(`${n}: avgR ${c.avg.toFixed(3)} t=${c.t.toFixed(2)} n=${c.R.length} rank ${coins.indexOf(c) + 1}/${coins.length} daily SR ${c.m.sr.toFixed(4)} (annualised ${(c.m.sr * Math.sqrt(365)).toFixed(2)})`); }

// ---- effective number of independent trials
const fullCoins = coins.filter((c) => c.t0 <= day(Date.UTC(2021, 0, 1) / 1000)); // coins with data for the whole common window
const d0c = day(Date.UTC(2021, 0, 1) / 1000);
const wk = fullCoins.map((c) => weekly(dailySeries(c.tr, d0c, D1)));
const effC = nEff(wk);
console.log(`\n(1) effective independent trials`);
console.log(`  COINS : ${effC.k} coins with data from 2021-01 -> weekly R correlation matrix: average pairwise correlation ${effC.avgCorr.toFixed(2)}, participation-ratio N_eff = ${effC.nEff.toFixed(1)} (raw count ${coins.length})`);
// parameter variants: the 243-set grid of bb-focus on SOL+ZEC (re-implemented in the core engine), plus the audit's 72
const sol = toB(JSON.parse(fs.readFileSync(path.join(D, 'SOL.json'), 'utf8'))), zec = toB(JSON.parse(fs.readFileSync(path.join(D, 'ZEC.json'), 'utf8')));
const runPair = (cfg) => [...backtest(sol, { ...cfg, cost }).trades, ...backtest(zec, { ...cfg, cost }).trades];
const pd0 = Math.min(day(sol[0].time), day(zec[0].time)), pd1 = Math.max(day(sol[sol.length - 1].time), day(zec[zec.length - 1].time));
const variants = [];
for (const bbLen of [14, 20, 30]) for (const bbMult of [1.5, 2, 2.5]) for (const trendLen of [100, 200, 300]) for (const targetR of [2, 3, 4]) for (const maxBars of [24, 48, 0]) variants.push({ bbLen, bbMult, trendLen, targetR, maxBars, warmup: Math.max(202, trendLen + 2) });
const vser = variants.map((v) => dailySeries(runPair(v), pd0, pd1));
const effP = nEff(vser.map(weekly));
const vSR = vser.map((s) => moments(Array.from(s)).sr);
console.log(`  PARAMS: ${variants.length} variants (the 243-set grid of bb-focus.js) on SOL+ZEC -> average pairwise correlation ${effP.avgCorr.toFixed(2)}, N_eff = ${effP.nEff.toFixed(1)}; SR spread across variants: min ${Math.min(...vSR).toFixed(3)} max ${Math.max(...vSR).toFixed(3)} (daily)`);
const NEFF = effC.nEff * effP.nEff;
console.log(`  combined N_eff (coins x parameters, treated as independent dimensions) = ${NEFF.toFixed(0)}`);

// ---- the selected strategy: SOL+ZEC pooled
const pairs = {};
for (const [lab, set] of [['Binance, no funding (same basis as the screen)', () => runPair({})], ['Binance, with funding', () => { const f = (c) => JSON.parse(fs.readFileSync(path.join(D, 'funding', c + '.json'), 'utf8')); return [...backtest(sol, { cost }, f('SOL')).trades, ...backtest(zec, { cost }, f('ZEC')).trades]; }],
  ['MEXC candles, with funding (traded venue)', () => { const L = (c) => { const B = toB(JSON.parse(fs.readFileSync(path.join(D, 'MEXC_' + c + '.json'), 'utf8'))); let F = JSON.parse(fs.readFileSync(path.join(D, 'funding', 'MEXC_' + c + '.json'), 'utf8')); const bin = JSON.parse(fs.readFileSync(path.join(D, 'funding', c + '.json'), 'utf8')); F = [...bin.filter((r) => r[0] < F[0][0]), ...F]; return backtest(B, { cost }, F).trades; }; return [...L('SOL'), ...L('ZEC')]; }]]) {
  const tr = set(); pairs[lab] = { tr, daily: Array.from(dailySeries(tr, pd0, pd1)) };
}

function dsr(m, N, V) {
  const g = 0.5772156649, sr0 = N < 2 ? 0 : Math.sqrt(V) * ((1 - g) * PhiInv(1 - 1 / N) + g * PhiInv(1 - 1 / (N * Math.E)));
  const z = (m.sr - sr0) * Math.sqrt(m.n - 1) / Math.sqrt(1 - m.g3 * m.sr + (m.g4 - 1) / 4 * m.sr ** 2);
  return { sr0, dsr: Phi(z), z };
}
const srs = coins.map((c) => c.m.sr), Vemp = sd(srs) ** 2;
const Vnull = mean(coins.map((c) => 1 / c.m.n));
console.log(`\n(3) Deflated Sharpe Ratio. Sharpe = daily mean R / daily sd of R (per-day, not annualised). Trial-variance V: empirical across the ${coins.length} coins = ${Vemp.toExponential(2)} (sd of SR ${Math.sqrt(Vemp).toFixed(4)}), sampling-only null 1/T = ${Vnull.toExponential(2)}.`);
for (const [lab, p] of Object.entries(pairs)) {
  const m = moments(p.daily);
  console.log(`\n  SELECTED: SOL+ZEC pooled, ${lab}: ${p.tr.length} trades, T=${m.n} days, daily SR ${m.sr.toFixed(4)} (annualised ${(m.sr * Math.sqrt(365)).toFixed(2)}), skew ${m.g3.toFixed(2)}, kurtosis ${m.g4.toFixed(1)}`);
  console.log('    N (trials assumed)         SR0 (expected best SR under no skill)   DSR = P(true SR > 0 | selection)     [V = empirical | V = sampling-only]');
  for (const [name, N] of [['1 (no correction)', 1], ['N_eff params', effP.nEff], ['N_eff coins', effC.nEff], ['N_eff coins x params', NEFF], ['133 coins (raw)', coins.length], ['243 settings (raw)', 243], ['912 BB settings (raw)', 912], ['133 x 243 (raw, upper bound)', coins.length * 243]]) {
    const a = dsr(m, N, Vemp), b = dsr(m, N, Vnull);
    console.log(`    ${name.padEnd(30)} N=${N.toFixed(0).padStart(6)}   SR0 ${a.sr0.toFixed(4)} | ${b.sr0.toFixed(4)}                 DSR ${(100 * a.dsr).toFixed(1).padStart(5)}% | ${(100 * b.dsr).toFixed(1).padStart(5)}%`);
  }
}

// ---- DSR per coin: the selection happened coin by coin, so this is the fairer unit (the pair's higher Sharpe is partly diversification)
console.log('\n(3b) Deflated Sharpe Ratio PER COIN (no funding, same basis as the screen). SR0 uses the empirical trial variance.');
console.log('  coin  daily SR   N_eff coins(16)   N_eff coins x params(56)   133 coins (raw)   133 x 3.4 (coins x N_eff params)');
for (const n of ['SOL', 'ZEC']) {
  const m = byName(n).m, f = (N) => (100 * dsr(m, N, Vemp).dsr).toFixed(1).padStart(5) + '%';
  console.log(`  ${n}   ${m.sr.toFixed(6)}   ${f(effC.nEff).padStart(14)}   ${f(NEFF).padStart(22)}   ${f(coins.length).padStart(14)}   ${f(coins.length * effP.nEff).padStart(18)}`);
}

// ---- Sidak
console.log('\n(2) Sidak-adjusted p-values for the best result among N independent looks: p_adj = 1-(1-p)^N, one-sided p from the t-statistic of mean R per trade');
const pOf = (t) => 1 - Phi(t);
const pairT = (() => { const R = pairs['Binance, no funding (same basis as the screen)'].tr.map((t) => t.R); return mean(R) / (sd(R) / Math.sqrt(R.length)); })();
console.log(`  SOL t=${byName('SOL').t.toFixed(2)}, ZEC t=${byName('ZEC').t.toFixed(2)}, pair t=${pairT.toFixed(2)}`);
for (const [name, N] of [['N_eff coins', effC.nEff], ['133 coins', coins.length], ['N_eff coins x params', NEFF], ['133 x 243', coins.length * 243]]) {
  const adj = (t) => { const p = pOf(t), v = 1 - Math.pow(1 - p, N); return v < 1e-4 ? v.toExponential(1) : v.toFixed(4); };
  console.log(`  N=${name.padEnd(22)} (${N.toFixed(0).padStart(6)}):  SOL p_adj ${adj(byName('SOL').t).padStart(8)}   ZEC p_adj ${adj(byName('ZEC').t).padStart(8)}   pair p_adj ${adj(pairT).padStart(8)}`);
}
console.log('  Harvey-Liu-Zhu rule of thumb: after ~300 tested factors a new one needs t > 3.0 (~3.4 for 1000); the pair has t = ' + pairT.toFixed(2) + ', single coins ' + byName('SOL').t.toFixed(1) + ' / ' + byName('ZEC').t.toFixed(1) + '.');

// ---- empirical Bayes, DerSimonian-Laird random-effects estimate of the between-coin variance
const obs = coins.map((c) => ({ c: c.c, y: c.avg, se2: c.se ** 2 }));
const wts = obs.map((o) => 1 / o.se2), W = wts.reduce((x, y) => x + y, 0), ybar = obs.reduce((x, o, i) => x + wts[i] * o.y, 0) / W;
const Q = obs.reduce((x, o, i) => x + wts[i] * (o.y - ybar) ** 2, 0), kk = obs.length, tau2 = Math.max(0, (Q - (kk - 1)) / (W - wts.reduce((x, w) => x + w * w, 0) / W));
const chi2p = (q, df) => { const z = (Math.cbrt(q / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df)); return 1 - Phi(z); }; // Wilson-Hilferty
console.log(`
(4) Empirical-Bayes shrinkage of the per-trade edge (random-effects, DerSimonian-Laird). ${kk} coins, precision-weighted mean ${ybar.toFixed(3)}R (unweighted ${mean(obs.map((o) => o.y)).toFixed(3)}R).`);
console.log(`  Heterogeneity: Q = ${Q.toFixed(1)} on ${kk - 1} df (p = ${chi2p(Q, kk - 1).toFixed(3)}), estimated true between-coin sd tau = ${Math.sqrt(tau2).toFixed(3)}R.`);
console.log('  => ' + (chi2p(Q, kk - 1) > 0.05 ? 'the spread between coins is NOT larger than sampling noise alone would produce: the data cannot show that SOL/ZEC have a better edge than the average coin.' : 'coins differ more than noise: some real heterogeneity.'));
const sol0 = obs.find((x) => x.c === 'SOL'), zec0 = obs.find((x) => x.c === 'ZEC');
console.log(`  SOL observed ${sol0.y.toFixed(3)}R (se ${Math.sqrt(sol0.se2).toFixed(3)}), ZEC observed ${zec0.y.toFixed(3)}R (se ${Math.sqrt(zec0.se2).toFixed(3)}); the pair's excess over the all-coin mean is ${((sol0.y + zec0.y) / 2 - ybar).toFixed(3)}R per trade (about ${(((sol0.y + zec0.y) / 2 - ybar) / (Math.sqrt(sol0.se2 + zec0.se2) / 2)).toFixed(1)} standard errors)`);
console.log('  posterior (shrunk) per-trade edge for the pair under different assumed true between-coin sd tau (tau 0 = every coin has the same edge):');
for (const tau of [0, 0.05, 0.10, 0.15, 0.20, Math.sqrt(tau2)]) {
  const post = (o) => { const B = tau * tau / (tau * tau + o.se2); return ybar + B * (o.y - ybar); }, a = post(sol0), b = post(zec0);
  console.log(`    tau ${tau.toFixed(3)}R${tau === Math.sqrt(tau2) ? ' (DL estimate)' : ''}: SOL ${a.toFixed(3)}R, ZEC ${b.toFixed(3)}R, pair ${((a * sol0.se2 ** -1 + b * zec0.se2 ** -1) / (sol0.se2 ** -1 + zec0.se2 ** -1)).toFixed(3)}R`);
}
console.log('  CAVEAT: coins share the same market regimes, so their errors are correlated; independent-error shrinkage UNDER-corrects. The selection effect is real but this is a floor on it, not a ceiling.');
