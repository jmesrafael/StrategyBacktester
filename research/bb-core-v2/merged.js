// merged.js — ONE strategy with TWO triggers: bb-core breakout + EMA 20/100 cross. Research only (bb-core/ is never touched).
//   Trigger A (bb)  : 4h close beyond Bollinger(20,2) with the 200 SMA → stop = middle band, target 4R, 48 candles max     (bb-core, unchanged)
//   Trigger B (ema) : EMA20 crosses EMA100 → stop 2×ATR(14), exit on the opposite cross                                    (EMA 20/100, unchanged)
// Same execution as both parents: decide on a CLOSED candle, fill at the next open, stop before target, gaps at the open, same costs + funding,
// same "hole in the last 200 candles → no signal" rule. Nothing is tuned: every rule below is stated up front.
//
// Modes (how the two triggers share the account):
//   bb / ema      parents, for parity checks
//   two           two independent slots (one per trigger), each risking a FULL 1R like each parent alone (up to 2R at risk at once)
//   twoHalf       the same two slots at ½R each (total risk never above bb-core's) = the earlier "combo"
//   one           ONE position at a time; whichever trigger fires first takes the slot (bb wins a tie); each trade keeps its own exit rules
//   regime        like `one`, but a bb breakout is only taken when the EMA20/100 regime points the same way
//   ride          like `one`, but a bb breakout that agrees with the EMA regime is held like an EMA trade: stop = middle band at entry,
//                 NO 4R cap and NO 48-candle cap, exit when the regime flips. A disagreeing breakout stays a normal bb-core trade.
//   rideOnly      like `ride`, but disagreeing breakouts are skipped
//   node merged.js [--coin SOL] [--venue mexc]
'use strict';
const { signalFrom, summarize, scaleCost, DEFAULTS, backtest } = require('./v2-core.js');
const { runStrat } = require('./contenders.js');
const { loadCoin } = require('./load.js');

const ema = (a, n) => { const o = Array(a.length).fill(null), k = 2 / (n + 1); let e = null; for (let i = 0; i < a.length; i++) { e = e == null ? a[i] : a[i] * k + e * (1 - k); if (i >= n - 1) o[i] = e; } return o; };
const atrW = (B, n) => { const o = Array(B.length).fill(null); let a = null, s = 0; for (let i = 0; i < B.length; i++) { const tr = i ? Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close)) : B[i].high - B[i].low; if (i < n) { s += tr; if (i === n - 1) a = s / n; } else a = (a * (n - 1) + tr) / n; o[i] = a; } return o; };

const MODES = ['bb', 'ema', 'two', 'twoHalf', 'one', 'regime', 'ride', 'rideOnly'];

function runMerged(B, mode, cost = DEFAULTS.cost, funding = null) {
  const iv = DEFAULTS.interval, C = B.map((b) => b.close), A = atrW(B, 14), F = ema(C, 20), S = ema(C, 100), x = (i) => (F[i] > S[i] ? 1 : -1);
  const useBB = mode !== 'ema', useEMA = mode !== 'bb', two = mode === 'two' || mode === 'twoHalf', w = mode === 'twoHalf' ? 0.5 : 1;
  const slots = (two ? ['bb', 'ema'] : ['all']).map((name) => ({ name, pos: null, pend: null, pendExit: false }));
  const trades = [], closes = []; let lastGap = -Infinity;

  for (let i = 0; i < B.length; i++) {
    const c = B[i];
    if (i > 0 && c.time - B[i - 1].time !== iv) lastGap = i;
    for (const s of slots) {
      if (s.pend) {                                                                   // fill the order decided at the previous close
        const p = s.pend, d = p.dir, fill = c.open * (1 + d * cost.slip), dist = Math.abs(fill - p.stop) / fill;
        if (dist > 0 && (d === 1 ? p.stop < fill : p.stop > fill)) s.pos = { ...p, entry: fill, i0: i, dist };
        s.pend = null;
      }
      if (s.pendExit && s.pos) close(s, c.open * (1 - s.pos.dir * cost.slip), i, cost.timeFee, 'exit');
      s.pendExit = false;
      const pos = s.pos;
      if (pos) {                                                                      // manage inside this candle: stop first, then target
        const d = pos.dir;
        if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) close(s, (d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * cost.slip), i, cost.stopFee, 'stop');
        else if (pos.tp != null && (d === 1 ? c.high >= pos.tp * (1 + cost.tpBuf) : c.low <= pos.tp * (1 - cost.tpBuf))) close(s, (d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open)) * (1 - d * cost.tpSlip), i, cost.tpFee, 'target');
      }
    }
    closes.push(c.close);                                                             // candle closed: indicators see it, nothing later
    for (const s of slots) if (s.pos) {
      const p = s.pos;
      if ((p.exitOnFlip && x(i) !== p.dir) || (p.maxBars && i - p.i0 >= p.maxBars)) s.pendExit = true;
    }
    if (i < 202 || i - lastGap < 200) continue;
    const bb = useBB ? signalFrom(closes, A[i]) : null;
    const cross = useEMA && S[i - 1] != null && x(i) !== x(i - 1) ? { dir: x(i), stop: C[i] - x(i) * 2 * A[i], tp: null, trig: 'ema', exitOnFlip: true } : null;
    const bbSig = bb && { dir: bb.dir, stop: bb.stop, tp: bb.tp, trig: 'bb', maxBars: DEFAULTS.maxBars };
    if (bbSig && (mode === 'regime' || mode === 'ride' || mode === 'rideOnly')) {
      const agree = S[i] != null && x(i) === bbSig.dir;
      if (agree && (mode === 'ride' || mode === 'rideOnly')) Object.assign(bbSig, { tp: null, maxBars: 0, exitOnFlip: true, ride: true });
      else if (!agree && (mode === 'regime' || mode === 'rideOnly')) bbSig.skip = true;
    }
    for (const s of slots) {
      if (s.pos || s.pend) continue;
      const cand = s.name === 'bb' ? [bbSig] : s.name === 'ema' ? [cross] : [bbSig, cross];       // bb wins a tie in the single slot
      const pick = cand.find((q) => q && !q.skip && Number.isFinite(q.stop));
      if (pick) s.pend = pick;
    }
  }
  return { trades, open: slots.map((s) => s.pos).filter(Boolean), setup: slots.map((s) => s.pend).filter(Boolean) };

  function close(s, px, i, fee, why) {
    const p = s.pos; let fr = 0;
    if (funding) { const te = B[p.i0].time, tx = B[i].time + 7200; for (const [t, r] of funding) { if (t > tx) break; if (t > te) fr += r; } }
    trades.push({ dir: p.dir, i0: p.i0, i1: i, t: B[p.i0].time, tExit: B[i].time + iv, entry: p.entry, exit: px, trig: p.ride ? 'bb-ride' : p.trig, why, stop: p.stop, dist: p.dist, w,
      R: w * (p.dir * (px - p.entry) / p.entry - cost.entryFee - fee - p.dir * fr) / p.dist, bars: i - p.i0 + 1 });
    s.pos = null;
  }
}
module.exports = { runMerged, MODES };

if (require.main === module) {
  const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
  const COIN = opt('coin', 'SOL'), venue = opt('venue', 'binance'), D = loadCoin(COIN, venue), SPLIT = Date.UTC(2023, 0, 1) / 1000;
  const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3), cell = (v) => (v == null ? '–' : v > 0 ? f1(v) : `**${f1(v)}**`);
  const yrsN = (D.B[D.B.length - 1].time - D.B[202].time) / 31557600;
  const LABEL = { bb: 'bb-core (parent)', ema: 'EMA 20/100 (parent)', two: 'TWO slots side by side, 1R each', twoHalf: 'TWO slots side by side, ½R each', one: 'MERGED one slot (first trigger wins)', regime: 'MERGED + bb only with EMA regime', ride: 'MERGED + ride (bb with regime → hold to flip)', rideOnly: 'MERGED ride, skip bb against regime' };
  const run = (m, k = 1, DD = D) => runMerged(DD.B, m, scaleCost(DEFAULTS.cost, k), DD.funding).trades;
  const R = {}; for (const m of MODES) R[m] = run(m);
  const ys = [...new Set(Object.values(R).flat().map((t) => new Date(t.tExit * 1000).getUTCFullYear()))].sort();

  console.log(`# Merged bb-core + EMA 20/100 — ${COIN}, ${venue} 4h candles, real fees/slippage/funding, ${ys[0]}–${ys[ys.length - 1]}\n`);
  console.log('R = profit in multiples of the amount risked per trade (×$5 for dollars at $5 risk). **Bold** = losing year. "two" runs both parents at 1R each (up to 2R at risk at once); "twoHalf" halves each; the single-slot merges risk 1R at a time like bb-core.\n');
  console.log('## 1. Every year\n');
  console.log('| strategy | ' + ys.join(' | ') + ' | **total R** | trades | win% | E per trade | max DD | R÷DD | +yrs |');
  console.log('|---|' + ys.map(() => '---').join('|') + '|---|---|---|---|---|---|---|');
  for (const m of MODES) {
    const t = R[m], s = summarize(t), yv = ys.map((y) => s.years[y]), E = s.R / s.n;
    console.log(`| ${LABEL[m]} | ${yv.map(cell).join(' | ')} | **${f1(s.R)}** | ${s.n} | ${(s.win * 100).toFixed(0)}% | ${f3(E)} | ${s.dd.toFixed(1)} | ${(s.R / s.dd).toFixed(1)} | ${yv.filter((v) => v > 0).length}/${yv.filter((v) => v != null).length} |`);
  }

  console.log('\n## 2. Which trigger made the money (inside each merged strategy)\n');
  console.log('| strategy | trigger | trades | win% | E per trade | total R | avg candles held |'); console.log('|---|---|---|---|---|---|---|');
  for (const m of ['two', 'twoHalf', 'one', 'regime', 'ride', 'rideOnly']) for (const g of ['bb', 'bb-ride', 'ema']) {
    const t = R[m].filter((x) => x.trig === g); if (!t.length) continue; const r = t.reduce((a, x) => a + x.R, 0);
    console.log(`| ${LABEL[m]} | ${g} | ${t.length} | ${(100 * t.filter((x) => x.R > 0).length / t.length).toFixed(0)}% | ${f3(r / t.length)} | ${f1(r)} | ${(t.reduce((a, x) => a + x.bars, 0) / t.length).toFixed(0)} |`);
  }

  console.log('\n## 3. Robustness\n');
  const MEX = loadCoin(COIN, 'mexc');
  const half = (t, f) => { const u = t.filter(f); return u.length ? u.reduce((a, x) => a + x.R, 0) / u.length : NaN; };
  console.log('| strategy | E 2020–22 | E 2023+ | MEXC candles: total R / DD | 2× costs: total R | trades/yr | avg open positions |'); console.log('|---|---|---|---|---|---|---|');
  for (const m of MODES) {
    const t = R[m], mx = summarize(run(m, 1, MEX)), x2 = summarize(run(m, 2)), open = t.reduce((a, x) => a + x.bars, 0) / (D.B.length - 202);
    console.log(`| ${LABEL[m]} | ${f3(half(t, (x) => x.t < SPLIT))} | ${f3(half(t, (x) => x.t >= SPLIT))} | ${f1(mx.R)} / ${mx.dd.toFixed(1)} | ${f1(x2.R)} | ${(t.length / yrsN).toFixed(0)} | ${open.toFixed(2)} |`);
  }

  console.log('\n## 4. Checks\n');
  const same = (a, b) => a.length === b.length && a.every((t, k) => t.i0 === b[k].i0 && t.i1 === b[k].i1 && Math.abs(t.R - b[k].R) < 1e-9);
  const bbRef = backtest(D.B, { cost: DEFAULTS.cost }, D.funding).trades, emaRef = runStrat(D.B, 'ema20/100', DEFAULTS.cost, D.funding).trades;
  console.log(`- Parity: mode bb = bb-core engine → ${same(R.bb, bbRef) ? 'IDENTICAL' : 'DIFFERENT'} (${R.bb.length} trades); mode ema = EMA 20/100 engine → ${same(R.ema, emaRef) ? 'IDENTICAL' : 'DIFFERENT'} (${R.ema.length} trades).`);
  const two = [...bbRef, ...emaRef].map((t) => t.R).reduce((a, b) => a + b, 0);
  console.log(`- "two" total ${f1(summarize(R.two).R)}R vs the two parents added at full size ${f1(two)}R → ${Math.abs(summarize(R.two).R - two) < 1e-6 ? 'match' : 'MISMATCH'}.`);
  // no-lookahead: cutting the data at any point must reproduce exactly the trades that were already closed
  let bad = 0, cuts = 0;
  for (const m of MODES) {
    const full = R[m];
    for (let cut = 400; cut < D.B.length; cut += 37) {
      cuts++; const tr = runMerged(D.B.slice(0, cut), m, DEFAULTS.cost, D.funding).trades, ref = full.filter((t) => t.i1 <= cut - 1);
      if (!same(tr, ref)) bad++;
    }
  }
  console.log(`- No look-ahead: ${cuts} truncation points across ${MODES.length} modes → ${bad === 0 ? 'PASS (every truncated run equals the full run up to that point)' : 'FAIL: ' + bad + ' mismatches'}.`);
}
