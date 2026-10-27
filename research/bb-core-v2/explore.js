// explore.js — try to beat the bb-core rules on ONE coin (default SOL), honestly.
//   node explore.js H0     which signal features separate winners from losers? (baseline trades, terciles, split by period)
//   node explore.js G      strategy parameters (trend length, band width/length, direction)
//   node explore.js H      one-at-a-time signal filters
//   node explore.js I      stops, targets, time exit, stagnation exit
//   node explore.js J      greedy search on 2020–2023 ONLY, then judged on 2024–2026 (the honest test)   [--reverse: tune on 2024+, judge on ≤2023]
//   options: --coins SOL  --venue mexc  --costs 2
// IS = trades that exited before 2024-01-01, OOS = 2024-01-01 on. A change only counts if it helps in BOTH periods.
'use strict';
const { backtest, summarize, scaleCost, DEFAULTS } = require('./v2-core.js');
const { loadCoin } = require('./load.js');

const args = process.argv.slice(2), section = (args.find((a) => !a.startsWith('--')) || 'H0').toUpperCase();
const opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const COIN = opt('coins', 'SOL'), venue = opt('venue', 'binance'), K = +opt('costs', 1), reverse = args.includes('--reverse');
const D = loadCoin(COIN, venue), CUT = Date.UTC(2024, 0, 1) / 1000;
const cost = scaleCost(DEFAULTS.cost, K);

const run = (cfg) => backtest(D.B, { ...cfg, cost }, D.funding).trades;
const sumR = (t) => t.reduce((a, x) => a + x.R, 0);
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
const isT = (t) => t.filter((x) => x.tExit < CUT), oosT = (t) => t.filter((x) => x.tExit >= CUT);

// deterministic RNG for the random-subset test
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const baseTrades = run({}), baseR = baseTrades.map((t) => t.R);
// share of random subsets of the BASELINE trades (same size) whose average R is at least `avg`: small = the filter picks better trades than luck would
function pAvg(n, avg, draws = 4000) {
  if (n >= baseR.length) return null;
  const r = rng(12345); let hit = 0;
  for (let d = 0; d < draws; d++) { let s = 0; const idx = new Set(); while (idx.size < n) idx.add(Math.floor(r() * baseR.length)); for (const k of idx) s += baseR[k]; if (s / n >= avg) hit++; }
  return hit / draws;
}

function header(title, note, withP) {
  console.log(`\n## ${title}\n${note ? note + '\n' : ''}`);
  console.log(`| config | trades | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 |${withP ? ' p(avg) |' : ''}`);
  console.log(`|---|---|---|---|---|---|---|---|---|${withP ? '---|' : ''}`);
}
function row(label, cfg, withP = false) {
  const t = run(cfg), s = summarize(t), ys = Object.values(s.years);
  const p = withP ? pAvg(s.n, s.avgR) : undefined;
  console.log(`| ${label} | ${s.n} | **${f1(s.R)}** | ${f3(s.avgR)} | ${(s.win * 100).toFixed(0)}% | ${s.dd.toFixed(1)} | ${ys.filter((v) => v > 0).length}/${ys.length} | ${f1(s.isR)} | ${f1(s.oosR)} |${withP ? ' ' + (p == null ? '–' : p.toFixed(3)) + ' |' : ''}`);
  return { t, s };
}

const b = summarize(baseTrades);
console.log(`# bb-core v2 — trying to beat the baseline on ${COIN} (${venue}, costs x${K})`);
console.log(`Baseline bb-core: ${b.n} trades, ${f1(b.R)}R, avg ${f3(b.avgR)}R, maxDD ${b.dd.toFixed(1)}R, ≤2023 ${f1(b.isR)}R (${isT(baseTrades).length} trades), ≥2024 ${f1(b.oosR)}R (${oosT(baseTrades).length} trades)`);

if (section === 'H0') {
  console.log('\n## H0. Do signal features separate winners from losers? (baseline trades, split into thirds by feature value)\nA feature is only interesting if the best/worst third ordering is the SAME in both periods.\n');
  const feats = ['breakAtr', 'closePos', 'bodyAtr', 'rangeAtr', 'volRatio', 'bw', 'sqRank', 'prevOut', 'slope', 'ext', 'fund', 'hour', 'dow'];
  console.log('| feature | third | value range | trades | avg R | avg R ≤2023 | avg R ≥2024 | win% |');
  console.log('|---|---|---|---|---|---|---|---|');
  const avg = (a) => (a.length ? sumR(a) / a.length : NaN);
  for (const f of feats) {
    const ts = baseTrades.filter((t) => t.feat && t.feat[f] != null && Number.isFinite(t.feat[f])).sort((x, y) => x.feat[f] - y.feat[f]);
    if (ts.length < 30) continue;
    const parts = f === 'hour' || f === 'dow' || f === 'prevOut' ? null : [0, 1, 2].map((k) => ts.slice(Math.floor(ts.length * k / 3), Math.floor(ts.length * (k + 1) / 3)));
    const groups = parts || [...new Set(ts.map((t) => t.feat[f]))].sort((a, c) => a - c).map((v) => ts.filter((t) => t.feat[f] === v));
    groups.forEach((g, k) => {
      if (g.length < 8) return;
      const lo = g[0].feat[f], hi = g[g.length - 1].feat[f], fmt = (v) => (Math.abs(v) < 0.01 && v !== 0 ? v.toExponential(1) : +v.toFixed(3));
      console.log(`| ${f} | ${parts ? ['low', 'mid', 'high'][k] : fmt(lo)} | ${fmt(lo)} … ${fmt(hi)} | ${g.length} | ${f3(avg(g))} | ${f3(avg(isT(g)))} | ${f3(avg(oosT(g)))} | ${(100 * g.filter((t) => t.R > 0).length / g.length).toFixed(0)}% |`);
    });
  }
}

if (section === 'G') {
  header('G1. Trend filter length (bb-core: 200)');
  for (const v of [0, 50, 100, 150, 200, 250, 300, 400]) row(`trendLen ${v}${v === 200 ? ' (baseline)' : ''}`, { trendLen: v, warmup: Math.max(202, v + 2) });
  header('G2. Band width (bb-core: 2σ) and length (bb-core: 20)');
  for (const m of [1.5, 1.75, 2, 2.25, 2.5, 3]) row(`bbMult ${m}`, { bbMult: m });
  for (const l of [10, 14, 20, 30, 40, 60]) row(`bbLen ${l}`, { bbLen: l });
  header('G3. Direction');
  row('longs only', { dirOnly: 1 }); row('shorts only', { dirOnly: -1 });
}

if (section === 'H') {
  header('H. One-at-a-time signal filters', 'p(avg) = share of random subsets of the same size (from the baseline trades) with an average R at least this good. Small = better than luck. With ~35 filters tried, expect a few p<0.05 by chance alone.', true);
  const F = [
    ['breakout ≥0.1 ATR beyond band', { minBreakAtr: 0.1 }], ['breakout ≥0.25 ATR', { minBreakAtr: 0.25 }], ['breakout ≥0.5 ATR', { minBreakAtr: 0.5 }], ['breakout ≤0.5 ATR (not stretched)', { maxBreakAtr: 0.5 }], ['breakout ≤1 ATR', { maxBreakAtr: 1 }],
    ['close in top 60% of range', { minClosePos: 0.6 }], ['close in top 75% of range', { minClosePos: 0.75 }], ['close in top 90% of range', { minClosePos: 0.9 }],
    ['body ≥0.5 ATR', { minBodyAtr: 0.5 }], ['body ≥1 ATR', { minBodyAtr: 1 }], ['range ≤2 ATR', { maxRangeAtr: 2 }], ['range ≤3 ATR', { maxRangeAtr: 3 }],
    ['volume ≥1× avg', { minVolRatio: 1 }], ['volume ≥1.5× avg', { minVolRatio: 1.5 }], ['volume ≥2× avg', { minVolRatio: 2 }], ['volume ≤3× avg', { maxVolRatio: 3 }],
    ['after squeeze: prev band width in tightest 30%', { maxSqRank: 0.3 }], ['…tightest 50%', { maxSqRank: 0.5 }], ['…tightest 70%', { maxSqRank: 0.7 }],
    ['fresh: none of prev 5 candles outside band', { maxPrevOut: 0 }], ['fresh: ≤1 of prev 5', { maxPrevOut: 1 }],
    ['trend SMA rising/falling with the trade (20 candles)', { minSlope: 0 }], ['…by ≥2%', { minSlope: 0.02 }], ['…by ≥5%', { minSlope: 0.05 }],
    ['not extended: close ≤20% from SMA', { maxExt: 0.2 }], ['…≤35%', { maxExt: 0.35 }], ['…≤50%', { maxExt: 0.5 }], ['at least 5% from SMA', { minExt: 0.05 }], ['at least 10% from SMA', { minExt: 0.1 }],
    ['skip if funding on the crowded side >0.01%', { maxFundDir: 0.0001 }], ['skip if funding on the crowded side >0.03%', { maxFundDir: 0.0003 }], ['skip if funding on the crowded side >0', { maxFundDir: 0 }],
    ['skip the signal after a losing trade', { skipAfterLosses: 1 }], ['skip the signal after 2 losing trades in a row', { skipAfterLosses: 2 }],
  ];
  for (const [l, c] of F) row(l, c, true);
  header('H2. Time of day / weekday (UTC close of the signal candle) — EXPLORATORY, high chance of pure noise', '', true);
  for (const h of [0, 4, 8, 12, 16, 20]) row(`skip signals closing at ${String(h).padStart(2, '0')}:00`, { skipHours: [h] }, true);
  for (const d of [0, 1, 2, 3, 4, 5, 6]) row(`skip ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]} closes`, { skipDow: [d] }, true);
}

if (section === 'I') {
  header('I1. Stop distance (bb-core: the middle band, 1.0×). Target stays targetR × risk', '');
  for (const f of [0.5, 0.75, 1, 1.25, 1.5, 2]) for (const tg of [4]) row(`stop ${f}× the close→middle-band distance, target ${tg}R`, { stopMode: 'frac', stopFrac: f, targetR: tg });
  for (const f of [0.75, 1, 1.5]) for (const tg of [6, 8]) row(`stop ${f}× the middle-band distance, target ${tg}R`, { stopMode: 'frac', stopFrac: f, targetR: tg });
  header('I2. ATR-based stop');
  for (const a of [1, 1.5, 2, 2.5, 3, 4]) for (const tg of [3, 4, 6]) row(`stop ${a} ATR, target ${tg}R`, { stopMode: 'atr', stopAtr: a, targetR: tg });
  header('I3. Time exit and target');
  for (const mb of [36, 48, 72, 96, 144, 200]) row(`maxBars ${mb}`, { maxBars: mb });
  for (const tg of [3, 4, 5, 6, 8, 10, 15]) row(`target ${tg}R`, { targetR: tg });
  header('I4. Stagnation exit: if the trade is below stagR in profit after stagBars candles, close at the next open');
  for (const sb of [6, 12, 18, 24]) for (const sr of [0, 0.5, 1]) row(`after ${sb} candles, below ${sr}R → exit`, { stagBars: sb, stagR: sr });
}

if (section === 'J') {
  const cand = {   // one key = one parameter; the search may pick at most one value per key
    trendLen: [100, 150, 250, 300].map((v) => ({ trendLen: v, warmup: Math.max(202, v + 2) })),
    bbMult: [1.5, 1.75, 2.25, 2.5, 3].map((v) => ({ bbMult: v })), bbLen: [14, 30, 40].map((v) => ({ bbLen: v })), dir: [{ dirOnly: 1 }, { dirOnly: -1 }],
    breakMin: [0.1, 0.25, 0.5].map((v) => ({ minBreakAtr: v })), breakMax: [0.5, 1].map((v) => ({ maxBreakAtr: v })), closePos: [0.6, 0.75, 0.9].map((v) => ({ minClosePos: v })),
    body: [0.5, 1].map((v) => ({ minBodyAtr: v })), range: [2, 3].map((v) => ({ maxRangeAtr: v })), vol: [1, 1.5, 2].map((v) => ({ minVolRatio: v })),
    sq: [0.3, 0.5, 0.7].map((v) => ({ maxSqRank: v })), fresh: [0, 1].map((v) => ({ maxPrevOut: v })), slope: [0, 0.02, 0.05].map((v) => ({ minSlope: v })),
    extMax: [0.2, 0.35, 0.5].map((v) => ({ maxExt: v })), extMin: [0.05, 0.1].map((v) => ({ minExt: v })), fund: [0, 0.0001, 0.0003].map((v) => ({ maxFundDir: v })),
    stop: [0.5, 0.75, 1.25, 1.5].map((v) => ({ stopMode: 'frac', stopFrac: v })).concat([1.5, 2, 3].map((v) => ({ stopMode: 'atr', stopAtr: v }))),
    target: [3, 5, 6, 8, 10, 15].map((v) => ({ targetR: v })), bars: [72, 96, 144].map((v) => ({ maxBars: v })),
    stag: [[12, 0.5], [18, 0.5], [24, 1], [12, 0]].map(([a, r]) => ({ stagBars: a, stagR: r })),
  };
  const sel = (t) => (reverse ? oosT(t) : isT(t)), other = (t) => (reverse ? isT(t) : oosT(t));
  const name = (c) => JSON.stringify(c).replace(/[{}"]/g, '').replace(/,/g, ' ');
  console.log(`\n## J. Greedy search on ${reverse ? '2024+' : '2020–2023'} ONLY, then judged on ${reverse ? '2020–2023' : '2024+'} (never used for choosing)`);
  console.log('Each step adds the single change that raises the tuning-period total R the most (needs at least +3R and ≥ 60% of the baseline trades kept). Stops when nothing helps.\n');
  console.log(`| step | change | tuning R | tuning trades | JUDGED R | judged trades | judged avg R |`);
  console.log(`|---|---|---|---|---|---|---|`);
  let cur = {}, used = new Set(), curSel = sumR(sel(baseTrades));
  const rep = (t) => console.log(` ${f1(sumR(sel(t)))} | ${sel(t).length} | **${f1(sumR(other(t)))}** | ${other(t).length} | ${f3(sumR(other(t)) / Math.max(1, other(t).length))} |`);
  console.log(`| 0 | baseline | ${f1(curSel)} | ${sel(baseTrades).length} | **${f1(sumR(other(baseTrades)))}** | ${other(baseTrades).length} | ${f3(sumR(other(baseTrades)) / other(baseTrades).length)} |`);
  for (let step = 1; step <= 6; step++) {
    let best = null;
    for (const [key, opts] of Object.entries(cand)) {
      if (used.has(key)) continue;
      for (const o of opts) {
        const t = run({ ...cur, ...o }), r = sumR(sel(t));
        if (sel(t).length < 0.6 * sel(baseTrades).length) continue;
        if (!best || r > best.r) best = { key, o, r, t };
      }
    }
    if (!best || best.r < curSel + 3) { console.log(`\nstopped after ${step - 1} change(s): nothing adds ≥ +3R on the tuning period`); break; }
    used.add(best.key); cur = { ...cur, ...best.o }; curSel = best.r;
    process.stdout.write(`| ${step} | +${name(best.o)} | `); rep(best.t);
  }
  const fin = run(cur);
  console.log(`\nFinal config: ${name(cur) || '(baseline)'}`);
  console.log(`  tuning period: baseline ${f1(sumR(sel(baseTrades)))}R → tuned ${f1(sumR(sel(fin)))}R`);
  console.log(`  JUDGED period: baseline ${f1(sumR(other(baseTrades)))}R → tuned ${f1(sumR(other(fin)))}R   (${other(baseTrades).length} → ${other(fin).length} trades)`);
  console.log(`  full history : baseline ${f1(b.R)}R → tuned ${f1(sumR(fin))}R, maxDD ${b.dd.toFixed(1)}R → ${summarize(fin).dd.toFixed(1)}R`);
}

if (section === 'K') {
  // Combinations fixed IN ADVANCE from the two findings that held in both periods (breakout strength, longer time exit) plus the ATR-stop lead.
  // Nothing here was searched: each row is one pre-written config, then stress-tested on MEXC candles, at 2x costs and year by year.
  const cfgs = [
    ['baseline', {}],
    ['breakout ≥0.5 ATR', { minBreakAtr: 0.5 }],
    ['maxBars 96', { maxBars: 96 }],
    ['breakout ≥0.5 ATR + maxBars 96', { minBreakAtr: 0.5, maxBars: 96 }],
    ['breakout ≥0.25 ATR + maxBars 96', { minBreakAtr: 0.25, maxBars: 96 }],
    ['breakout ≥0.5 ATR + maxBars 96 + target 6R', { minBreakAtr: 0.5, maxBars: 96, targetR: 6 }],
    ['stop 2 ATR, target 4R', { stopMode: 'atr', stopAtr: 2, targetR: 4 }],
    ['stop 2 ATR, target 4R + maxBars 96', { stopMode: 'atr', stopAtr: 2, targetR: 4, maxBars: 96 }],
    ['breakout ≥0.5 ATR + stop 2 ATR, target 4R + maxBars 96', { minBreakAtr: 0.5, stopMode: 'atr', stopAtr: 2, targetR: 4, maxBars: 96 }],
  ];
  const mexc = loadCoin(COIN, 'mexc');
  const go = (cfg, data, k) => backtest(data.B, { ...cfg, cost: scaleCost(DEFAULTS.cost, k) }, data.funding).trades;
  console.log('\n## K. Pre-written combinations, stress-tested');
  console.log('R/DD = total R divided by max drawdown (return per unit of pain). "MEXC" = same rules on MEXC candles (a second, partly independent price history). Costs ×2 = fees and slippage doubled.\n');
  console.log('| config | trades | total R | maxDD R | R/DD | R ≤2023 | R ≥2024 | MEXC R (baseline-relative) | MEXC maxDD | costs ×2 R |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  const mb = summarize(go({}, mexc, 1));
  for (const [l, c] of cfgs) {
    const s = summarize(go(c, D, K)), m = summarize(go(c, mexc, K)), x2 = summarize(go(c, D, K * 2));
    console.log(`| ${l} | ${s.n} | **${f1(s.R)}** | ${s.dd.toFixed(1)} | ${(s.R / s.dd).toFixed(1)} | ${f1(s.isR)} | ${f1(s.oosR)} | ${f1(m.R)} (${f1(m.R - mb.R)}) | ${m.dd.toFixed(1)} | ${f1(x2.R)} |`);
  }
  console.log('\n### Year by year (R)');
  const yrs = Object.keys(summarize(baseTrades).years).sort();
  console.log('| config | ' + yrs.join(' | ') + ' |'); console.log('|---|' + yrs.map(() => '---').join('|') + '|');
  for (const [l, c] of cfgs) { const y = summarize(go(c, D, K)).years; console.log(`| ${l} | ` + yrs.map((v) => f1(y[v] || 0)).join(' | ') + ' |'); }
}
