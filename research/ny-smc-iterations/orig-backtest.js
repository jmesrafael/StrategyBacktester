// SOL NY-session SMC backtest — CHoCH → post-CHoCH FVG → limit entry at FVG midpoint.
// Structure (NY open, PDH/PDL, FVG, CHoCH, swings) comes from the app's own
// 📐 SMC Toolkit code (js/smc.js), loaded unchanged.
// usage: node backtest.js <dataFile> <tfMinutes> [--verify]
const fs = require('fs'), vm = require('vm'), path = require('path');
const APP = 'C:/Users/WEB.WEB-DEVPC1/Desktop/testing/StrategyBacktester';

// ---- load the SMC Toolkit headless -----------------------------------------
function intervalToSeconds(iv) { return iv === 'D' ? 86400 : iv === 'W' ? 604800 : parseInt(iv) * 60; }
const ctx = {
  console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity,
  window: {}, CFG: { ALL_INTERVALS: [['1', '1m'], ['15', '15m'], ['60', '1h'], ['D', '1D']] },
  document: { getElementById: () => ({ value: '' }) },
  requestAnimationFrame: () => 0, ResizeObserver: class { observe() {} }, ChartView: {},
  intervalToSeconds, peekCandleCache: () => null, fetchCandles: () => Promise.reject(new Error('offline')),
};
vm.runInNewContext(fs.readFileSync(path.join(APP, 'js/smc.js'), 'utf8') + '\n;this.SMC = SMCIndicator;', ctx);
const SMC = ctx.SMC;

// ---- config ------------------------------------------------------------------
const CONF = {
  swingLen: 5,            // toolkit default (CHoCH swing length)
  fvgWindow: 10,          // post-CHoCH FVG must complete within N bars of the CHoCH bar
  sessionHours: 6.5,      // NY session = NY open (toolkit line) → +6.5h (09:30–16:00 ET)
  slBufferPct: 0.0002,    // stop placed 0.02% beyond the swing
  makerFee: 0.0002,       // Bybit perp VIP0: maker 0.02% (limit entry, TP)
  takerFee: 0.00055,      // taker 0.055% (stop-loss / breakeven stop)
  stopSlip: 0.0002,       // 0.02% slippage on stop (market) exits
  riskPct: 0.01,          // risk 1% of equity per trade
  maxLeverage: 10,        // notional cap
  startEquity: 10000,
  pdTol: 0.0015,          // within 0.15% of PDH/PDL counts as "at the level"
  pdSweep: 0.005,         // ...or a sweep up to 0.5% beyond it
  sdImpulseATR: 2.0,      // S/D zone: 3-bar displacement >= 2 x ATR(14)
  minRR: 0,               // sensitivity: skip setups whose planned reward:risk is below this
  allHours: false,        // sensitivity: ignore the NY-session filter
  tag: '',
};
Object.assign(CONF, JSON.parse(process.env.BTCONF || '{}'));

const [dataFile, tfArg, flag] = process.argv.slice(2);
const SEC = +tfArg * 60;
const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const B = raw.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
const N = B.length;
const tIdx = new Map(B.map((b, i) => [b.time, i]));

console.time('analyze');
const A = SMC.analyze(B, SEC, { ch1_len: CONF.swingLen, chBreak: 'close', fvgFill: 'wick', tz: 8,
  nyTime: '21:30', nyAutoDST: true, dayStart: '08:00' });
console.timeEnd('analyze');

// ---- derived lookups (all causal) ---------------------------------------------
// NY sessions
const sessions = A.ny.map((t) => [t, t + CONF.sessionHours * 3600]);
function sessionOf(t) {   // binary search: session containing t, or null
  let lo = 0, hi = sessions.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (sessions[m][1] <= t) lo = m + 1; else if (sessions[m][0] > t) hi = m - 1; else return sessions[m]; }
  return null;
}
// PDH/PDL by trading day (day = 08:00 PH = 00:00 UTC); value for day k = day k-1 range
const pdByDay = new Map(A.pd.map((d) => [d.t1, d]));
function pdAt(t) { return pdByDay.get(Math.floor(t / 86400) * 86400) || null; }

// FVGs by candle-3 index
const fvgByC3 = new Map();
for (const g of A.fvg) { const i = tIdx.get(g.t1) + 2; (fvgByC3.get(i) || fvgByC3.set(i, []).get(i)).push(g); }

// confirmed swing pivots (strength = swingLen): usable only from confirmIdx
const SH = A.swings.hi, SL = A.swings.lo;

// ATR(14) for S/D zone displacement
const atr = new Array(N).fill(null);
{ let s = 0; for (let i = 1; i < N; i++) {
  const tr = Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close));
  if (i <= 14) { s += tr; if (i === 14) atr[i] = s / 14; } else atr[i] = (atr[i - 1] * 13 + tr) / 14; } }

// Supply / demand zones: last opposite candle before a 3-bar displacement >= k x ATR.
// Demand = last bearish candle before a strong rally; zone = that candle's [low, high].
// Known from the displacement's last bar; dead once a later candle CLOSES through it.
const zones = { demand: [], supply: [] };
for (let k = 15; k + 3 < N; k++) {
  const a = atr[k]; if (!a) continue;
  const c = B[k];
  if (c.close < c.open && B[k + 3].close - c.close >= CONF.sdImpulseATR * a)
    zones.demand.push({ low: c.low, high: c.high, born: k + 3, dead: null });
  if (c.close > c.open && c.close - B[k + 3].close >= CONF.sdImpulseATR * a)
    zones.supply.push({ low: c.low, high: c.high, born: k + 3, dead: null });
}
for (const z of zones.demand) for (let j = z.born + 1; j < N; j++) if (B[j].close < z.low) { z.dead = j; break; }
for (const z of zones.supply) for (let j = z.born + 1; j < N; j++) if (B[j].close > z.high) { z.dead = j; break; }
function zoneTouched(list, idx, price, isDemand) {
  for (let q = list.length - 1; q >= 0; q--) {
    const z = list[q];
    if (z.born >= idx) continue;
    if (idx - z.born > 2000) break;                 // only zones from the recent past
    if (z.dead != null && z.dead < idx) continue;   // already broken before the touch
    if (isDemand ? (price <= z.high && price >= z.low * 0.999) : (price >= z.low && price <= z.high * 1.001)) return true;
  }
  return false;
}

// trendline: two most recent confirmed swing highs (for longs: descending, p2 < p1)
// known at index `at`; broken when a close crosses above the projected line after p2.
function trendlineBroken(isLong, fromIdx, toIdx, at) {
  const piv = isLong ? SH : SL;
  const known = [];
  for (let q = piv.length - 1; q >= 0 && known.length < 2; q--) if (piv[q].confirmIdx <= at && piv[q].idx < fromIdx) known.push(piv[q]);
  if (known.length < 2) return false;
  const [p2, p1] = known;                          // p2 newer
  if (isLong ? !(p2.price < p1.price) : !(p2.price > p1.price)) return false;   // needs a falling (rising) line
  const slope = (p2.price - p1.price) / (p2.idx - p1.idx);
  for (let j = Math.max(p2.confirmIdx, fromIdx); j <= toIdx; j++) {
    const line = p2.price + slope * (j - p2.idx);
    if (isLong ? B[j].close > line : B[j].close < line) return true;
  }
  return false;
}

// ---- setups ------------------------------------------------------------------------
const chochs = A.structure.filter((e) => e.type === 'CHoCH').map((e) => ({ ...e, b: tIdx.get(e.t2), p: tIdx.get(e.t1) }));
const breaks = A.structure.map((e) => ({ bull: e.bull, b: tIdx.get(e.t2) }));   // any opposite break cancels
const skipped = { noFvg: 0, outsideSession: 0, invalidStop: 0, noTarget: 0 };
const setups = [];
for (const e of chochs) {
  const sess = CONF.allHours ? [B[e.b].time, Infinity] : sessionOf(B[e.b].time);
  if (!sess) { skipped.outsideSession++; continue; }
  // first same-direction FVG whose middle candle is the CHoCH bar or later
  let fvg = null, fi = -1;
  for (let i = e.b + 1; i <= e.b + CONF.fvgWindow && i < N; i++) {
    const g = (fvgByC3.get(i) || []).find((x) => x.bull === e.bull);
    if (g) { fvg = g; fi = i; break; }
  }
  if (!fvg) { skipped.noFvg++; continue; }
  const long = e.bull;
  // reversal leg: from the broken swing to the CHoCH bar → its extreme is the protected swing
  let legX = long ? Infinity : -Infinity, legXi = e.p;
  for (let j = e.p; j <= e.b; j++) { const v = long ? B[j].low : B[j].high; if (long ? v < legX : v > legX) { legX = v; legXi = j; } }
  // impulse extreme from the leg extreme up to the FVG's completion (for Fibonacci)
  let imp = long ? -Infinity : Infinity;
  for (let j = legXi; j <= fi; j++) imp = long ? Math.max(imp, B[j].high) : Math.min(imp, B[j].low);
  const entry = (fvg.top + fvg.bottom) / 2;
  const stop = long ? legX * (1 - CONF.slBufferPct) : legX * (1 + CONF.slBufferPct);
  if (long ? entry <= stop : entry >= stop) { skipped.invalidStop++; continue; }
  // target: nearest confirmed swing beyond the impulse extreme (known when the FVG completes)
  let tp = null;
  for (const s of (long ? SH : SL)) {
    if (s.confirmIdx > fi || fi - s.idx > 3000) continue;
    if (long ? s.price > imp && (tp == null || s.price < tp) : s.price < imp && (tp == null || s.price > tp)) tp = s.price;
  }
  if (tp == null) { skipped.noTarget++; continue; }
  const risk = Math.abs(entry - stop);
  if (Math.abs(tp - entry) / risk < CONF.minRR) { skipped.lowRR = (skipped.lowRR || 0) + 1; continue; }
  const fibR = Math.abs(imp - entry) / Math.abs(imp - legX);
  const pd = pdAt(B[legXi].time);
  const nearLvl = (x, lvl) => long ? (x <= lvl * (1 + CONF.pdTol) && x >= lvl * (1 - CONF.pdSweep))
                                   : (x >= lvl * (1 - CONF.pdTol) && x <= lvl * (1 + CONF.pdSweep));
  setups.push({
    long, chochIdx: e.b, fvgIdx: fi, legXi, entry, stop, tp, risk,
    plannedRR: Math.abs(tp - entry) / risk, sessEnd: sess[1],
    f: {
      fib: fibR >= 0.382 && fibR <= 0.618,
      pd: !!pd && (nearLvl(legX, long ? pd.pdl : pd.pdh) || nearLvl(legX, long ? pd.pdh : pd.pdl)),
      sd: zoneTouched(long ? zones.demand : zones.supply, legXi, legX, long),
      tl: trendlineBroken(long, legXi, fi, fi),
    },
  });
}

// ---- execution ------------------------------------------------------------------------
function run(filter, opts = {}) {
  let eq = CONF.startEquity, peak = eq, maxDD = 0, fees = 0;
  const trades = [];
  let busyUntil = -1;
  const nextBreak = (from, bull) => { for (const x of breaks) if (x.b > from && x.bull !== bull) return x.b; return Infinity; };
  for (const s of setups) {
    if (!filter(s) || s.fvgIdx < busyUntil) continue;
    const tp = opts.tpImpulse ? null : s.tp;
    // --- pending limit order: from the bar after the FVG completes, until session end,
    // an opposite structure break, or price reaching the target first
    const cancelAt = nextBreak(s.fvgIdx, s.long);
    let fillIdx = -1, fillPx = 0;
    for (let j = s.fvgIdx + 1; j < N && B[j].time < s.sessEnd && j < cancelAt; j++) {
      const b = B[j];
      if (s.long ? b.low <= s.entry : b.high >= s.entry) {
        fillIdx = j; fillPx = s.long ? Math.min(b.open, s.entry) : Math.max(b.open, s.entry); break;
      }
      if (s.long ? b.high >= s.tp : b.low <= s.tp) break;      // ran to target without us
    }
    if (fillIdx < 0) continue;
    // --- position
    const riskPx = Math.abs(fillPx - s.stop);
    const target = opts.tpImpulse ? null : s.tp;
    const qtyRisk = (eq * CONF.riskPct) / riskPx;
    const qty = Math.min(qtyRisk, (eq * CONF.maxLeverage) / fillPx);
    let stop = s.stop, be = false, exitIdx = -1, exitPx = 0, reason = '';
    const oneR = s.long ? fillPx + riskPx : fillPx - riskPx;
    for (let j = fillIdx; j < N; j++) {
      const b = B[j];
      const filledAtOpen = j === fillIdx && fillPx === b.open;
      // stop first (worst case when a bar touches both)
      if (s.long ? b.low <= stop : b.high >= stop) {
        exitIdx = j; reason = be ? 'BE' : 'SL';
        const base = (j > fillIdx && (s.long ? b.open < stop : b.open > stop)) ? b.open : stop;   // gap through
        exitPx = s.long ? base * (1 - CONF.stopSlip) : base * (1 + CONF.stopSlip);
        break;
      }
      if (target != null && (j > fillIdx || filledAtOpen) && (s.long ? b.high >= target : b.low <= target)) {
        exitIdx = j; reason = 'TP'; exitPx = target; break;
      }
      if (!be && (j > fillIdx || filledAtOpen) && (s.long ? b.high >= oneR : b.low <= oneR)) { be = true; stop = fillPx; }
    }
    if (exitIdx < 0) { exitIdx = N - 1; exitPx = B[N - 1].close; reason = 'END'; }
    const gross = (s.long ? exitPx - fillPx : fillPx - exitPx) * qty;
    const fee = fillPx * qty * CONF.makerFee + exitPx * qty * (reason === 'TP' ? CONF.makerFee : CONF.takerFee);
    const pnl = gross - fee;
    fees += fee;
    const R = pnl / (riskPx * qty);
    eq += pnl; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, (peak - eq) / peak);
    // gross R: same exit but at the raw level (no fees, no slippage) — isolates the edge from costs
    const rawExit = reason === 'TP' ? target : reason === 'END' ? exitPx : (s.long ? exitPx / (1 - CONF.stopSlip) : exitPx / (1 + CONF.stopSlip));
    const grossR = (s.long ? rawExit - fillPx : fillPx - rawExit) / riskPx;
    trades.push({ long: s.long, fillIdx, exitIdx, fillPx, exitPx, stop: s.stop, tp: s.tp, reason, pnl, R, grossR, stopPct: riskPx / fillPx,
      plannedRR: Math.abs(s.tp - fillPx) / riskPx, levered: qty < qtyRisk, f: s.f, eq });
    busyUntil = exitIdx + 1;
  }
  return stats(trades, eq, maxDD, fees);
}

function stats(T, eq, maxDD, fees) {
  const wins = T.filter((t) => t.pnl > 0), losses = T.filter((t) => t.pnl <= 0);
  const gp = wins.reduce((a, t) => a + t.pnl, 0), gl = -losses.reduce((a, t) => a + t.pnl, 0);
  let streak = 0, maxStreak = 0;
  for (const t of T) { if (t.pnl <= 0) maxStreak = Math.max(maxStreak, ++streak); else streak = 0; }
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const days = (B[N - 1].time - B[0].time) / 86400;
  return {
    trades: T.length, longs: T.filter((t) => t.long).length, shorts: T.filter((t) => !t.long).length,
    tp: T.filter((t) => t.reason === 'TP').length, sl: T.filter((t) => t.reason === 'SL').length,
    be: T.filter((t) => t.reason === 'BE').length, open: T.filter((t) => t.reason === 'END').length,
    winRate: T.length ? wins.length / T.length : 0,
    profitFactor: gl ? gp / gl : (gp ? Infinity : 0),
    net: eq - CONF.startEquity, netPct: (eq / CONF.startEquity - 1),
    maxDD, fees,
    avgPlannedRR: avg(T.map((t) => t.plannedRR)), avgR: avg(T.map((t) => t.R)), sumR: T.reduce((a, t) => a + t.R, 0),
    avgWinR: avg(wins.map((t) => t.R)), avgLossR: avg(losses.map((t) => t.R)),
    maxLosingStreak: maxStreak,
    avgHoldBars: avg(T.map((t) => t.exitIdx - t.fillIdx)),
    tradesPerMonth: T.length / (days / 30.44),
    capped: T.filter((t) => t.levered).length,
    avgGrossR: avg(T.map((t) => t.grossR)),
    medianStopPct: T.length ? T.map((t) => t.stopPct).sort((a, b) => a - b)[Math.floor(T.length / 2)] : 0,
    avgCostR: avg(T.map((t) => t.grossR - t.R)),
    _trades: T,
  };
}

// ---- variants ---------------------------------------------------------------------------
const loc = (s) => s.f.sd || s.f.pd;
const V = {
  'A. Base: CHoCH → FVG → midpoint': () => true,
  'B. Base + Fib golden zone': (s) => s.f.fib,
  'C. Base + location (S/D or PDH/PDL)': loc,
  'D. Full: location + Fib golden zone': (s) => loc(s) && s.f.fib,
  'E. Base + supply/demand only': (s) => s.f.sd,
  'F. Base + PDH/PDL only': (s) => s.f.pd,
  'G. Base + trendline break': (s) => s.f.tl,
  'H. Location + trendline break': (s) => loc(s) && s.f.tl,
};
const results = {};
for (const [name, fn] of Object.entries(V)) results[name] = run(fn);

// factor breakdown inside the base set
const base = results['A. Base: CHoCH → FVG → midpoint']._trades;
const breakdown = {};
for (const k of ['fib', 'sd', 'pd', 'tl']) {
  const w = base.filter((t) => t.f[k]), wo = base.filter((t) => !t.f[k]);
  const s = (a) => ({ n: a.length, winRate: a.length ? a.filter((t) => t.pnl > 0).length / a.length : 0,
    avgR: a.length ? a.reduce((x, t) => x + t.R, 0) / a.length : 0,
    pf: (() => { const gp = a.filter((t) => t.pnl > 0).reduce((x, t) => x + t.pnl, 0), gl = -a.filter((t) => t.pnl <= 0).reduce((x, t) => x + t.pnl, 0); return gl ? gp / gl : 0; })() });
  breakdown[k] = { with: s(w), without: s(wo) };
}

const out = {
  tf: tfArg + 'm', bars: N, from: new Date(B[0].time * 1000).toISOString(), to: new Date((B[N - 1].time + SEC) * 1000).toISOString(),
  chochs: chochs.length, setups: setups.length, skipped, sessions: sessions.length,
  results: Object.fromEntries(Object.entries(results).map(([k, v]) => { const { _trades, ...rest } = v; return [k, rest]; })),
  breakdown,
};
fs.writeFileSync(path.join(require('os').tmpdir(), `result-${tfArg}m${CONF.tag}.json`), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(require('os').tmpdir(), `trades-${tfArg}m${CONF.tag}.json`), JSON.stringify(base.map((t) => ({ ...t,
  fillTime: new Date(B[t.fillIdx].time * 1000).toISOString(), exitTime: new Date(B[t.exitIdx].time * 1000).toISOString() }))));
console.log(JSON.stringify({ tf: out.tf, bars: N, chochs: out.chochs, setups: out.setups, skipped }, null, 0));
for (const [k, v] of Object.entries(out.results))
  console.log(k.padEnd(40), `n=${v.trades}`.padEnd(7), `win=${(v.winRate * 100).toFixed(1)}%`.padEnd(11),
    `PF=${v.profitFactor.toFixed(2)}`.padEnd(9), `net=${v.net.toFixed(0)}`.padEnd(11), `DD=${(v.maxDD * 100).toFixed(1)}%`.padEnd(10),
    `avgR=${v.avgR.toFixed(3)}`.padEnd(12), `grossR=${v.avgGrossR.toFixed(3)}`.padEnd(14), `cost=${v.avgCostR.toFixed(3)}R`.padEnd(12),
    `stop=${(v.medianStopPct * 100).toFixed(2)}%`.padEnd(12), `RR=${v.avgPlannedRR.toFixed(2)}`, `TP/SL/BE=${v.tp}/${v.sl}/${v.be}`, `capped=${v.capped}`);

// ---- look-ahead audit: re-run the toolkit on data truncated at the fill bar and
// confirm the CHoCH + FVG behind each sampled trade already existed then.
if (flag === '--verify') {
  const sample = base.filter((_, i) => i % Math.max(1, Math.floor(base.length / 25)) === 0).slice(0, 25);
  let ok = 0;
  for (const t of sample) {
    const s = setups.find((x) => x.long === t.long && Math.abs(x.entry - t.fillPx) < 1e-9 || false) || null;
    const lo = Math.max(0, t.fillIdx - 6000);
    const cut = B.slice(lo, t.fillIdx);                 // everything strictly BEFORE the fill bar
    const a = SMC.analyze(cut, SEC, { ch1_len: CONF.swingLen, chBreak: 'close', fvgFill: 'wick' });
    const set = setups.find((x) => x.fvgIdx < t.fillIdx && x.long === t.long && t.fillIdx > x.fvgIdx && Math.abs(Math.min(B[t.fillIdx].open, x.entry) - t.fillPx) < 1e-9);
    const S = set || s;
    const hasChoch = a.structure.some((e) => e.type === 'CHoCH' && e.bull === t.long && e.t2 === B[S.chochIdx].time);
    const hasFvg = a.fvg.some((g) => g.bull === t.long && (g.top + g.bottom) / 2 === S.entry);
    if (hasChoch && hasFvg) ok++;
    else console.log('AUDIT FAIL', new Date(B[t.fillIdx].time * 1000).toISOString(), { hasChoch, hasFvg });
  }
  console.log(`look-ahead audit: ${ok}/${sample.length} sampled trades fully reproducible from data before the fill bar`);
}
