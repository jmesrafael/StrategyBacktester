// run.js — v2 experiments. All numbers are in R (1R = the amount risked), 5 coins SOL ZEC NEAR ADA GALA summed, real costs + real funding.
//   node run.js A        break-even grid            node run.js D     limit-entry grid (+ what the missed signals would have made)
//   node run.js B        break-even x target        node run.js E     combinations
//   node run.js C        partial / trailing         node run.js all   everything        [--venue mexc] [--costs 2]
'use strict';
const { backtest, summarize, scaleCost, DEFAULTS } = require('./v2-core.js');
const { COINS: ALLC, loadCoin } = require('./load.js');
const COINS = [...ALLC];

const args = process.argv.slice(2), section = (args.find((a) => !a.startsWith('--')) || 'all').toUpperCase();
const venue = args.includes('--venue') ? args[args.indexOf('--venue') + 1] : 'binance';
const baseK = args.includes('--costs') ? +args[args.indexOf('--costs') + 1] : 1;
const SEL = args.includes('--coins') ? args[args.indexOf('--coins') + 1].split(',') : null;
if (SEL) { COINS.length = 0; COINS.push(...SEL); }
const DATA = Object.fromEntries(COINS.map((c) => [c, loadCoin(c, venue)]));

function run(cfg, k = baseK) {
  const cost = scaleCost(DEFAULTS.cost, k), per = {}, all = [], missed = [];
  for (const c of COINS) {
    const r = backtest(DATA[c].B, { ...cfg, cost: { ...cost, ...(cfg.cost || {}) } }, DATA[c].funding);
    per[c] = r; all.push(...r.trades.map((t) => ({ ...t, coin: c }))); missed.push(...r.missed.map((m) => ({ ...m, coin: c })));
  }
  return { per, all, missed, s: summarize(all) };
}
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
const base = run({}), base2 = run({}, baseK * 2);

function header(title, note) {
  console.log(`\n## ${title}\n${note ? note + '\n' : ''}`);
  console.log('| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
}
function row(label, cfg) {
  const r = run(cfg), r2 = run(cfg, baseK * 2), s = r.s;
  const ys = Object.values(s.years), fills = s.n, miss = r.missed.length;
  const coinsPos = COINS.filter((c) => summarize(r.all.filter((t) => t.coin === c)).R > 0).length;
  console.log(`| ${label} | ${s.n} | ${cfg.entry && cfg.entry !== 'market' ? (100 * fills / (fills + miss)).toFixed(0) + '%' : '100%'} | **${f1(s.R)}** | ${f2(s.avgR)} | ${(s.win * 100).toFixed(0)}% | ${s.dd.toFixed(1)} | ${ys.filter((v) => v > 0).length}/${ys.length} | ${f1(s.isR)} | ${f1(s.oosR)} | ${coinsPos}/${COINS.length} | ${f1(r2.s.R)} |`);
  return r;
}
const why = (r) => Object.entries(r.s.why).map(([k, v]) => `${k} ${v}`).join(' · ');

console.log(`# bb-core v2 research — ${venue} candles, costs x${baseK}, coins ${COINS.join(' ')}`);
console.log(`Baseline = bb-core rules unchanged (market entry at the next open, stop = middle band, 4R target, 48-bar time exit). Exits: ${why(base)}`);
header('Baseline');
row('bb-core (baseline)', {});

if (section === 'A' || section === 'ALL') {
  header('A. Break-even stop (market entry, target 4R)', 'beAtR = how far in profit (in R) before the stop jumps to entry. offset 0.12% = entry + enough to pay the exit fee/slippage. Takes effect from the NEXT candle.');
  for (const off of [0, 0.0012]) for (const at of [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]) row(`BE at ${at}R, offset ${off * 100}%`, { beAtR: at, beOffset: off });
}
if (section === 'B' || section === 'ALL') {
  header('B. Break-even at 1R vs target size', 'Does BE change which target is best?');
  for (const tg of [2, 3, 4, 5, 6, 8, 10]) { row(`target ${tg}R, no BE`, { targetR: tg }); row(`target ${tg}R, BE at 1R (+0.12%)`, { targetR: tg, beAtR: 1, beOffset: 0.0012 }); }
  header('B2. Break-even at 1R vs time exit');
  for (const mb of [24, 48, 72, 96]) { row(`maxBars ${mb}, no BE`, { maxBars: mb }); row(`maxBars ${mb}, BE at 1R (+0.12%)`, { maxBars: mb, beAtR: 1, beOffset: 0.0012 }); }
}
if (section === 'C' || section === 'ALL') {
  header('C. Partial profit and trailing the stop (market entry)', 'partial = sell part at X R and move the rest to break-even; trail = after BE the stop follows the 20-SMA (only in profit direction).');
  const off = 0.0012;
  for (const [at, fr] of [[1, 0.5], [1, 0.33], [2, 0.5], [2, 0.33], [3, 0.5]]) row(`partial ${fr * 100}% at ${at}R + BE rest (4R)`, { partialAtR: at, partialFrac: fr, beOffset: off });
  for (const [be, tg] of [[1, 4], [1.5, 4], [1, 6], [1, 8], [1, 10], [2, 8]]) row(`BE ${be}R + trail 20-SMA, target ${tg}R`, { beAtR: be, beOffset: off, trailMid: true, targetR: tg });
  for (const [at, fr, tg] of [[2, 0.5, 8], [2, 0.5, 6], [1, 0.5, 8]]) row(`partial ${fr * 100}% at ${at}R + trail, target ${tg}R`, { partialAtR: at, partialFrac: fr, beOffset: off, trailMid: true, targetR: tg });
}
if (section === 'D' || section === 'ALL') {
  const modes = [
    ['mid: limit at the midpoint of the signal candle (wicks included)', { entry: 'mid' }, 'mid'],
    ['25% pullback from the close, % of the candle range', { entry: 'retrace', retraceFrac: 0.25, retraceBase: 'range' }, 'rr25'],
    ['50% pullback from the close, % of the candle range', { entry: 'retrace', retraceFrac: 0.5, retraceBase: 'range' }, 'rr50'],
    ['25% pullback from the close, % of the close→stop distance', { entry: 'retrace', retraceFrac: 0.25, retraceBase: 'dist' }, 'rd25'],
    ['50% pullback from the close, % of the close→stop distance', { entry: 'retrace', retraceFrac: 0.5, retraceBase: 'dist' }, 'rd50'],
  ];
  for (const [title, cfg, tag] of modes) {
    header(`D. Limit entry — ${title}`, 'limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).');
    for (const lb of [1, 2, 3, 6]) for (const an of ['entry', 'signal']) row(`${tag}, wait ${lb} candle(s), target ${an}`, { ...cfg, limitBars: lb, tpAnchor: an });
  }
  // selection effect: what would the signals that the limit order missed have made at market?
  console.log('\n### D2. Which signals does a limit order miss? (R of the SAME signals traded at market, baseline rules)');
  console.log('| config | signals matched | market R of signals FILLED | limit R of the same trades | market R of signals MISSED | missed (ran away / expired / other) |');
  console.log('|---|---|---|---|---|---|');
  for (const [, cfg, tag] of modes) for (const lb of [1, 3]) {
    const r = run({ ...cfg, limitBars: lb, tpAnchor: 'entry' });
    let mf = 0, lf = 0, mm = 0, nf = 0, nm = 0; const out = { ran_away: 0, expired: 0, other: 0 };
    for (const c of COINS) {
      const bm = new Map(base.per[c].trades.map((t) => [t.sig, t.R]));
      for (const t of r.per[c].trades) if (bm.has(t.sig)) { mf += bm.get(t.sig); lf += t.R; nf++; }
      for (const m of r.per[c].missed) { out[m.reason === 'ran_away' || m.reason === 'expired' ? m.reason : 'other']++; if (bm.has(m.sig)) { mm += bm.get(m.sig); nm++; } }
    }
    console.log(`| ${tag}, wait ${lb} | ${nf + nm} | ${f1(mf)} (${nf}) | ${f1(lf)} | ${f1(mm)} (${nm}) | ${out.ran_away} / ${out.expired} / ${out.other} |`);
  }
  header('D3. Fill model sensitivity (mid, wait 2, target entry)', 'limitBuf 0 = the order fills as soon as price TOUCHES the level (optimistic); 0.05% = price must trade through (default); 0.15% = harsher.');
  for (const buf of [0, 0.0005, 0.0015]) row(`mid, wait 2, limitBuf ${buf * 100}%`, { entry: 'mid', limitBars: 2, limitBuf: buf });
}
if (section === 'D4' || section === 'ALL') {
  header('D4. Limit entry that falls back to a MARKET entry if not filled', 'Order rests limitBars candles; if still unfilled it is bought at the next open (stop and target unchanged). Keeps the price improvement on pullbacks without missing the runaway breakouts, but the late market entries are worse than baseline.');
  for (const [tag, e] of [['mid', { entry: 'mid' }], ['rr25', { entry: 'retrace', retraceFrac: 0.25, retraceBase: 'range' }], ['rd25', { entry: 'retrace', retraceFrac: 0.25, retraceBase: 'dist' }], ['rd50', { entry: 'retrace', retraceFrac: 0.5, retraceBase: 'dist' }]])
    for (const lb of [1, 2, 3]) for (const an of ['entry', 'signal']) row(`${tag}, wait ${lb} then market, target ${an}`, { ...e, limitBars: lb, limitFallback: true, tpAnchor: an });
}
if (section === 'F' || section === 'ALL') {
  header('F. Maximise profit without break-even: target size × time exit (market entry)', 'CAUTION: the 4R target was already chosen after seeing these years; every extra grid cell here adds more in-sample selection. Look for a broad plateau, not the best single cell.');
  for (const tg of [4, 6, 8, 10, 15, 20]) for (const mb of [48, 72, 96, 144]) row(`target ${tg}R, maxBars ${mb}`, { targetR: tg, maxBars: mb });
}
if (section === 'E' || section === 'ALL') {
  header('E. Combinations');
  const off = 0.0012;
  for (const [tag, e] of [['mid, wait 1, target signal', { entry: 'mid', limitBars: 1, tpAnchor: 'signal' }], ['mid, wait 1 then market', { entry: 'mid', limitBars: 1, limitFallback: true, tpAnchor: 'signal' }]]) {
    row(tag, e);
    row(`${tag} + BE 1R`, { ...e, beAtR: 1, beOffset: off });
    row(`${tag} + target 8R`, { ...e, targetR: 8 });
    row(`${tag} + target 10R, maxBars 96`, { ...e, targetR: 10, maxBars: 96 });
  }
  row('market + target 8R', { targetR: 8 });
  row('market + target 10R, maxBars 96', { targetR: 10, maxBars: 96 });
}
