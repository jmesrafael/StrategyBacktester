// strat-search.js — find additions to bb-core that raise EXPECTANCY, using all 5 coins and an honest split.
//   TRAIN = trades entered before 2023-01-01 (all 5 coins pooled)  ·  TEST = 2023-01-01 on (never used to choose anything)
//   node strat-search.js features      which indicators separate good from bad signals (thresholds set on TRAIN only)
//   node strat-search.js rules         candidate strategies, judged on TEST, per coin, on MEXC, at 2× costs
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, scaleCost, DEFAULTS } = require('./v2-core.js');
const { COINS, loadCoin } = require('./load.js');
const args = process.argv.slice(2), section = (args[0] || 'features').toLowerCase();
const SPLIT = Date.UTC(2023, 0, 1) / 1000;

// BTC regime: (close − SMA200)/SMA200 of the BTC 4h candle that closes at the same moment as the signal candle
const btcRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bb-core', 'data-other-coins', 'BTC.json'), 'utf8'));
const BTC = {}; { let sum = 0; for (let i = 0; i < btcRaw.length; i++) { sum += btcRaw[i][4]; if (i >= 200) sum -= btcRaw[i - 200][4]; if (i >= 199) BTC[btcRaw[i][0]] = (btcRaw[i][4] - sum / 200) / (sum / 200); } }

function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function ex(rs) {
  const n = rs.length; if (!n) return { n: 0, m: NaN, lo: NaN, hi: NaN, t: NaN, win: NaN };
  const m = rs.reduce((a, r) => a + r, 0) / n, sd = Math.sqrt(rs.reduce((a, r) => a + (r - m) ** 2, 0) / Math.max(1, n - 1)), r = rng(3), ms = [];
  for (let b = 0; b < 2000; b++) { let s = 0; for (let i = 0; i < n; i++) s += rs[Math.floor(r() * n)]; ms.push(s / n); }
  ms.sort((a, b) => a - b);
  return { n, m, lo: ms[50], hi: ms[1949], t: m / (sd / Math.sqrt(n)), win: rs.filter((x) => x > 0).length / n };
}
const f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3), f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
const cache = {};
function run(cfg = {}, venue = 'binance', k = 1) {
  const out = [];
  for (const c of COINS) {
    const key = c + venue; const D = cache[key] || (cache[key] = loadCoin(c, venue));
    out.push(...backtest(D.B, { ...cfg, btc: BTC, cost: scaleCost(DEFAULTS.cost, k) }, D.funding).trades.map((t) => ({ ...t, coin: c })));
  }
  return out;
}
const tr = (t) => t.filter((x) => x.t < SPLIT), te = (t) => t.filter((x) => x.t >= SPLIT), R = (t) => t.map((x) => x.R);
const yrs = (t) => (Math.max(...t.map((x) => x.tExit)) - Math.min(...t.map((x) => x.t))) / 31557600;   // calendar years spanned
const base = run();

if (section === 'features') {
  const feats = ['breakAtr', 'closePos', 'bodyAtr', 'rangeAtr', 'volRatio', 'bw', 'sqRank', 'slope', 'ext', 'fund', 'adx', 'diDir', 'rsi', 'er', 'ret10', 'ret3', 'consec', 'atrRank', 'atrPct', 'btc'];
  console.log('# Which indicators separate good bb-core signals from bad ones? (5 coins pooled)\n');
  console.log(`Baseline expectancy: TRAIN ${f3(ex(R(tr(base))).m)}R (${tr(base).length} trades) · TEST ${f3(ex(R(te(base))).m)}R (${te(base).length} trades)\n`);
  console.log('Thirds are cut at TRAIN values. "spread" = expectancy of the best third minus the worst third. A feature is useful only if the SAME third is best in TRAIN and TEST and on most coins.\n');
  console.log('| feature | third (TRAIN cut) | TRAIN E | TEST E | TEST trades | coins where this third beats the opposite one |');
  console.log('|---|---|---|---|---|---|');
  const ranking = [];
  for (const fe of feats) {
    const has = (t) => t.filter((x) => x.feat && x.feat[fe] != null && Number.isFinite(x.feat[fe]));
    const trv = has(tr(base)).map((x) => x.feat[fe]).sort((a, b) => a - b); if (trv.length < 60) continue;
    const q1 = trv[Math.floor(trv.length / 3)], q2 = trv[Math.floor(2 * trv.length / 3)];
    const bucket = (t, k) => has(t).filter((x) => (k === 0 ? x.feat[fe] < q1 : k === 1 ? x.feat[fe] >= q1 && x.feat[fe] < q2 : x.feat[fe] >= q2));
    const eT = [0, 1, 2].map((k) => ex(R(bucket(tr(base), k))).m), eX = [0, 1, 2].map((k) => ex(R(bucket(te(base), k))).m);
    const coinsHi = COINS.filter((c) => { const t = base.filter((x) => x.coin === c); return ex(R(bucket(t, 2))).m > ex(R(bucket(t, 0))).m; }).length;
    const fmt = (v) => (Math.abs(v) < 0.01 && v !== 0 ? v.toExponential(1) : +v.toFixed(3));
    ['low', 'mid', 'high'].forEach((l, k) => console.log(`| ${k === 0 ? '**' + fe + '**' : ''} | ${l} ${k === 0 ? '< ' + fmt(q1) : k === 1 ? fmt(q1) + '…' + fmt(q2) : '≥ ' + fmt(q2)} | ${f3(eT[k])} | ${f3(eX[k])} | ${bucket(te(base), k).length} | ${k === 2 ? coinsHi + '/5 high>low' : k === 0 ? (5 - coinsHi) + '/5 low>high' : ''} |`));
    const dirT = Math.sign(eT[2] - eT[0]), dirX = Math.sign(eX[2] - eX[0]);
    ranking.push({ fe, consistent: dirT === dirX && (dirT > 0 ? coinsHi >= 4 : coinsHi <= 1), spreadT: Math.abs(eT[2] - eT[0]), spreadX: dirT === dirX ? Math.abs(eX[2] - eX[0]) : 0, dir: dirT > 0 ? 'high' : 'low', q1, q2 });
  }
  console.log('\n## Ranking (consistent = same direction in TRAIN and TEST and on ≥4 of 5 coins)\n');
  console.log('| feature | better side | consistent? | spread TRAIN | spread TEST |'); console.log('|---|---|---|---|---|');
  for (const r of ranking.sort((a, b) => b.consistent - a.consistent || b.spreadX - a.spreadX)) console.log(`| ${r.fe} | ${r.dir} | ${r.consistent ? '**yes**' : 'no'} | ${r.spreadT.toFixed(3)} | ${r.spreadX.toFixed(3)} |`);
}

if (section === 'rules') {
  const cands = require('./strat-candidates.js');
  console.log('# Candidate bb-core strategies — expectancy judged on TEST (2023+, never used to choose), all 5 coins\n');
  const bX = ex(R(te(base))), bA = ex(R(base));
  console.log(`bb-core: TEST E ${f3(bX.m)}R (${bX.n} trades), full E ${f3(bA.m)}R, ${(base.length / yrs(base)).toFixed(0)} trades per year (5 coins), ${f1(bA.m * base.length / yrs(base))}R per year (5 coins)\n`);
  console.log('| strategy | TRAIN E | **TEST E** | TEST 95% range | TEST t | TEST trades | coins with TEST E > bb-core | MEXC TEST E | 2× costs TEST E | full E | trades/yr (5 coins) | **R per year (5 coins)** | TEST total R |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const perCoinYr = (t) => ex(R(t)).m * t.length / yrs(t);
  for (const [label, cfg] of [['bb-core', {}], ...cands]) {
    const t = run(cfg), m = run(cfg, 'mexc'), x2 = run(cfg, 'binance', 2);
    const eT = ex(R(tr(t))), eX = ex(R(te(t))), eA = ex(R(t));
    const coinsBetter = COINS.filter((c) => ex(R(te(t).filter((x) => x.coin === c))).m > ex(R(te(base).filter((x) => x.coin === c))).m).length;
    console.log(`| ${label} | ${f3(eT.m)} | **${f3(eX.m)}** | ${eX.lo.toFixed(2)}…${eX.hi.toFixed(2)} | ${eX.t.toFixed(1)} | ${eX.n} | ${coinsBetter}/5 | ${f3(ex(R(te(m))).m)} | ${f3(ex(R(te(x2))).m)} | ${f3(eA.m)} | ${(t.length / yrs(t)).toFixed(0)} | **${f1(perCoinYr(t))}** | ${f1(te(t).reduce((a, x) => a + x.R, 0))} |`);
  }
}
