// ie.js — iteration engine. Defaults reproduce orig-backtest.js exactly (the first SOL report).
// Every tweak is a config switch whose default = the original formula.
const fs = require('fs'), vm = require('vm'), path = require('path');
const APP = 'C:/Users/WEB.WEB-DEVPC1/Desktop/testing/StrategyBacktester';
const DATA = APP + '/research/sol-ny-smc/data';

const ctx = {
  console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity,
  window: {}, CFG: { ALL_INTERVALS: [['1', '1m'], ['15', '15m'], ['60', '1h'], ['D', '1D']] },
  document: { getElementById: () => ({ value: '' }) },
  requestAnimationFrame: () => 0, ResizeObserver: class { observe() {} }, ChartView: {},
  intervalToSeconds: (iv) => (iv === 'D' ? 86400 : iv === 'W' ? 604800 : parseInt(iv) * 60),
  peekCandleCache: () => null, fetchCandles: () => Promise.reject(new Error('offline')),
};
vm.runInNewContext(fs.readFileSync(path.join(APP, 'js/smc.js'), 'utf8') + '\n;this.SMC = SMCIndicator;', ctx);
const SMC = ctx.SMC;

const BASE = {
  // ---- original formula ----
  swingLen: 5, fvgWindow: 10, sessionHours: 6.5, slBufferPct: 0.0002,
  makerFee: 0.0002, takerFee: 0.00055, stopSlip: 0.0002, riskPct: 0.01, maxLeverage: 10, startEquity: 10000,
  pdTol: 0.0015, pdSweep: 0.005, sdImpulseATR: 2.0, allHours: false,
  // ---- tweak switches (defaults = original) ----
  sessOffsetH: 0,        // session start relative to toolkit NY line (h)
  chochWindowH: null,    // CHoCH must occur within first N h of session (null = whole session)
  entryFrac: 0.5,        // depth into FVG from proximal edge: 0 = near edge, 0.5 = midpoint, 1 = far edge
  stopMode: 'leg',       // 'leg' (orig) | 'legATR' (leg extreme ± stopATR×ATR)
  stopATR: 0,
  tpMode: 'swing',       // 'swing' | 'R' (fixed tpR) | 'swingMinR' (skip if swing < tpR·R) | 'swingFloorR' (max(swing, tpR·R))
  tpR: 1,
  beR: 1,                // move stop to entry at this R (null = never)
  beLockR: 0,            // where the stop goes at BE trigger (0 = entry, 0.1 = +0.1R)
  filter: null,          // fn(setup) → bool
  minStopPct: 0, maxStopPct: Infinity,
  minRR: 0,              // planned RR floor
  htfMin: 0, htfEma: 50, // HTF trend: last *completed* htfMin-bar close vs EMA(htfEma) of HTF closes
  htfMode: 'with',       // 'with' | 'against'
  minFvgATR: 0,          // FVG height ≥ k × ATR
  minDispATR: 0,         // CHoCH bar range ≥ k × ATR
  sessExit: false,       // flatten any open trade at session end (market, taker)
  maxHoldBars: Infinity, // time stop (market exit)
  maxTradesPerSession: Infinity,
  fillThrough: 0,        // stress: limit fills only if price trades this fraction beyond the entry
  costMult: 1,           // stress: multiply fees + slippage
  // ---- round-6 refinements (from candle diagnostics) ----
  chochSkip: null,       // [a, b]: skip CHoCHs a..b hours after session start (e.g. [1, 2] = 09:30-10:30 ET)
  maxFillBars: Infinity, // cancel the limit order if not filled within N bars of the FVG
  maxStopATR: Infinity,  // skip setups whose stop is wider than k × ATR
  ftBars: 0, ftMinR: 0,  // follow-through check: at the close of fill+ftBars, if best excursion < ftMinR ...
  ftMode: 'exit',        //   'exit' = close at market · 'tighten' = move stop to -ftTightR
  ftTightR: 0.5,
  partialR: null, partialFrac: 0.5, // take partialFrac off at +partialR (limit, maker)
};

function load(sym) {
  const f = sym === 'SOL' ? [DATA + '/sol15-oos.json', DATA + '/sol15.json'] : [DATA + '/' + sym.toLowerCase() + '15-all.json'];
  return f.flatMap((x) => JSON.parse(fs.readFileSync(x, 'utf8')));
}

const cache = new Map();
function analyze(key, raw, swingLen) {
  const k = key + ':' + swingLen;
  if (cache.has(k)) return cache.get(k);
  const B = raw.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
  const A = SMC.analyze(B, 900, { ch1_len: swingLen, chBreak: 'close', fvgFill: 'wick', tz: 8, nyTime: '21:30', nyAutoDST: true, dayStart: '08:00' });
  const N = B.length, tIdx = new Map(B.map((b, i) => [b.time, i]));
  const atr = new Array(N).fill(null);
  { let s = 0; for (let i = 1; i < N; i++) {
    const tr = Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close));
    if (i <= 14) { s += tr; if (i === 14) atr[i] = s / 14; } else atr[i] = (atr[i - 1] * 13 + tr) / 14; } }
  const v = { B, A, N, tIdx, atr, htf: {} };
  cache.set(k, v);
  return v;
}

// HTF trend sign at bar i using only completed HTF candles: +1 above EMA, -1 below
function htfTrend(D, min, len) {
  const key = min + ':' + len;
  if (D.htf[key]) return D.htf[key];
  const { B, N } = D, sec = min * 60, out = new Int8Array(N);
  let ema = null, n = 0, lastClose = null, curBucket = null, sign = 0, sum = 0;
  const k = 2 / (len + 1);
  for (let i = 0; i < N; i++) {
    const bk = Math.floor(B[i].time / sec);
    if (curBucket !== null && bk !== curBucket) {  // previous HTF candle completed with lastClose
      n++;
      if (n <= len) { sum += lastClose; if (n === len) ema = sum / len; } else ema = lastClose * k + ema * (1 - k);
      sign = ema == null ? 0 : lastClose > ema ? 1 : -1;
    }
    curBucket = bk; lastClose = B[i].close;
    out[i] = sign;   // known at the open of bar i... used at setup bar (after close of i): conservative
  }
  return (D.htf[key] = out);
}

function setupsFor(D, C) {
  const { B, A, N, tIdx, atr } = D;
  const sessions = A.ny.map((t) => [t + C.sessOffsetH * 3600, t + (C.sessOffsetH + C.sessionHours) * 3600]);
  const sessionOf = (t) => {
    let lo = 0, hi = sessions.length - 1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (sessions[m][1] <= t) lo = m + 1; else if (sessions[m][0] > t) hi = m - 1; else return sessions[m]; }
    return null;
  };
  const pdByDay = new Map(A.pd.map((d) => [d.t1, d]));
  const pdAt = (t) => pdByDay.get(Math.floor(t / 86400) * 86400) || null;
  const fvgByC3 = new Map();
  for (const g of A.fvg) { const i = tIdx.get(g.t1) + 2; (fvgByC3.get(i) || fvgByC3.set(i, []).get(i)).push(g); }
  const SH = A.swings.hi, SL = A.swings.lo;
  if (!D.zones) {
    const zones = { demand: [], supply: [] };
    for (let k = 15; k + 3 < N; k++) {
      const a = atr[k]; if (!a) continue;
      const c = B[k];
      if (c.close < c.open && B[k + 3].close - c.close >= C.sdImpulseATR * a) zones.demand.push({ low: c.low, high: c.high, born: k + 3, dead: null });
      if (c.close > c.open && c.close - B[k + 3].close >= C.sdImpulseATR * a) zones.supply.push({ low: c.low, high: c.high, born: k + 3, dead: null });
    }
    for (const z of zones.demand) for (let j = z.born + 1; j < N; j++) if (B[j].close < z.low) { z.dead = j; break; }
    for (const z of zones.supply) for (let j = z.born + 1; j < N; j++) if (B[j].close > z.high) { z.dead = j; break; }
    D.zones = zones;
  }
  const zones = D.zones;
  const zoneTouched = (list, idx, price, isDemand) => {
    for (let q = list.length - 1; q >= 0; q--) {
      const z = list[q];
      if (z.born >= idx) continue;
      if (idx - z.born > 2000) break;
      if (z.dead != null && z.dead < idx) continue;
      if (isDemand ? (price <= z.high && price >= z.low * 0.999) : (price >= z.low && price <= z.high * 1.001)) return true;
    }
    return false;
  };
  const trendlineBroken = (isLong, fromIdx, toIdx, at) => {
    const piv = isLong ? SH : SL, known = [];
    for (let q = piv.length - 1; q >= 0 && known.length < 2; q--) if (piv[q].confirmIdx <= at && piv[q].idx < fromIdx) known.push(piv[q]);
    if (known.length < 2) return false;
    const [p2, p1] = known;
    if (isLong ? !(p2.price < p1.price) : !(p2.price > p1.price)) return false;
    const slope = (p2.price - p1.price) / (p2.idx - p1.idx);
    for (let j = Math.max(p2.confirmIdx, fromIdx); j <= toIdx; j++) {
      const line = p2.price + slope * (j - p2.idx);
      if (isLong ? B[j].close > line : B[j].close < line) return true;
    }
    return false;
  };
  const htf = C.htfMin ? htfTrend(D, C.htfMin, C.htfEma) : null;

  const chochs = A.structure.filter((e) => e.type === 'CHoCH').map((e) => ({ ...e, b: tIdx.get(e.t2), p: tIdx.get(e.t1) }));
  const setups = [];
  for (const e of chochs) {
    const sess = C.allHours ? [B[e.b].time, Infinity] : sessionOf(B[e.b].time);
    if (!sess) continue;
    if (C.chochWindowH != null && B[e.b].time >= sess[0] + C.chochWindowH * 3600) continue;
    if (C.chochSkip && B[e.b].time >= sess[0] + C.chochSkip[0] * 3600 && B[e.b].time < sess[0] + C.chochSkip[1] * 3600) continue;
    let fvg = null, fi = -1;
    for (let i = e.b + 1; i <= e.b + C.fvgWindow && i < N; i++) {
      const g = (fvgByC3.get(i) || []).find((x) => x.bull === e.bull);
      if (g) { fvg = g; fi = i; break; }
    }
    if (!fvg) continue;
    const long = e.bull;
    let legX = long ? Infinity : -Infinity, legXi = e.p;
    for (let j = e.p; j <= e.b; j++) { const v = long ? B[j].low : B[j].high; if (long ? v < legX : v > legX) { legX = v; legXi = j; } }
    let imp = long ? -Infinity : Infinity;
    for (let j = legXi; j <= fi; j++) imp = long ? Math.max(imp, B[j].high) : Math.min(imp, B[j].low);
    const h = fvg.top - fvg.bottom;
    const entry = C.entryFrac === 0.5 ? (fvg.top + fvg.bottom) / 2 : long ? fvg.top - C.entryFrac * h : fvg.bottom + C.entryFrac * h;
    let stop = long ? legX * (1 - C.slBufferPct) : legX * (1 + C.slBufferPct);
    if (C.stopMode === 'legATR') stop = long ? stop - C.stopATR * atr[fi] : stop + C.stopATR * atr[fi];
    if (long ? entry <= stop : entry >= stop) continue;
    let swingTp = null;
    for (const s of (long ? SH : SL)) {
      if (s.confirmIdx > fi || fi - s.idx > 3000) continue;
      if (long ? s.price > imp && (swingTp == null || s.price < swingTp) : s.price < imp && (swingTp == null || s.price > swingTp)) swingTp = s.price;
    }
    const risk = Math.abs(entry - stop), dir = long ? 1 : -1;
    let tp = null;
    if (C.tpMode === 'swing') tp = swingTp;
    else if (C.tpMode === 'R') tp = entry + dir * C.tpR * risk;
    else if (C.tpMode === 'swingMinR') tp = swingTp != null && Math.abs(swingTp - entry) >= C.tpR * risk ? swingTp : null;
    else if (C.tpMode === 'swingFloorR') tp = swingTp == null ? entry + dir * C.tpR * risk : (long ? Math.max(swingTp, entry + C.tpR * risk) : Math.min(swingTp, entry - C.tpR * risk));
    if (tp == null) continue;
    if (Math.abs(tp - entry) / risk < C.minRR) continue;
    const stopPct = risk / entry;
    if (stopPct < C.minStopPct || stopPct > C.maxStopPct) continue;
    if (C.minFvgATR && h < C.minFvgATR * atr[fi]) continue;
    if (risk > C.maxStopATR * atr[fi]) continue;
    if (C.minDispATR && B[e.b].high - B[e.b].low < C.minDispATR * atr[e.b]) continue;
    if (htf) { const t = htf[fi]; if (C.htfMode === 'with' ? t !== dir : t !== -dir) continue; }
    const fibR = Math.abs(imp - entry) / Math.abs(imp - legX);
    const pd = pdAt(B[legXi].time);
    const nearLvl = (x, lvl) => long ? (x <= lvl * (1 + C.pdTol) && x >= lvl * (1 - C.pdSweep)) : (x >= lvl * (1 - C.pdTol) && x <= lvl * (1 + C.pdSweep));
    const s = {
      long, chochIdx: e.b, fvgIdx: fi, legXi, entry, stop, tp, risk, swingTp, sessStart: sess[0], sessEnd: sess[1],
      plannedRR: Math.abs(tp - entry) / risk, stopPct, fvgATR: h / atr[fi], fibR,
      f: {
        fib: fibR >= 0.382 && fibR <= 0.618,
        pd: !!pd && (nearLvl(legX, long ? pd.pdl : pd.pdh) || nearLvl(legX, long ? pd.pdh : pd.pdl)),
        sd: zoneTouched(long ? zones.demand : zones.supply, legXi, legX, long),
        tl: trendlineBroken(long, legXi, fi, fi),
      },
    };
    if (C.filter && !C.filter(s)) continue;
    setups.push(s);
  }
  return setups;
}

function execute(D, C, setups) {
  const { B, N, A, tIdx } = D;
  const breaks = A.structure.map((e) => ({ bull: e.bull, b: tIdx.get(e.t2) }));
  const trades = [];
  let busyUntil = -1, bi = 0;
  const perSess = new Map();
  for (const s of setups) {
    if (s.fvgIdx < busyUntil) continue;
    if ((perSess.get(s.sessStart) || 0) >= C.maxTradesPerSession) continue;
    while (bi < breaks.length && breaks[bi].b <= s.fvgIdx) bi++;
    let cancelAt = Infinity;
    for (let q = bi; q < breaks.length; q++) if (breaks[q].bull !== s.long) { cancelAt = breaks[q].b; break; }
    let fillIdx = -1, fillPx = 0;
    for (let j = s.fvgIdx + 1; j < N && B[j].time < s.sessEnd && j < cancelAt && j - s.fvgIdx <= C.maxFillBars; j++) {
      const b = B[j];
      if (s.long ? b.low <= s.entry * (1 - C.fillThrough) : b.high >= s.entry * (1 + C.fillThrough)) { fillIdx = j; fillPx = s.long ? Math.min(b.open, s.entry) : Math.max(b.open, s.entry); break; }
      if (s.long ? b.high >= s.tp : b.low <= s.tp) break;
    }
    if (fillIdx < 0) continue;
    const riskPx = Math.abs(fillPx - s.stop);
    let stop = s.stop, be = false, exitIdx = -1, exitPx = 0, reason = '';
    const beTrig = C.beR == null ? null : (s.long ? fillPx + C.beR * riskPx : fillPx - C.beR * riskPx);
    const beLvl = s.long ? fillPx + C.beLockR * riskPx : fillPx - C.beLockR * riskPx;
    const dir = s.long ? 1 : -1;
    const pLvl = C.partialR == null ? null : fillPx + dir * C.partialR * riskPx;
    let mfe = 0, partial = false, ftDone = false;
    for (let j = fillIdx; j < N; j++) {
      const b = B[j];
      const atOpen = j === fillIdx && fillPx === b.open;
      if (s.long ? b.low <= stop : b.high >= stop) {
        exitIdx = j; reason = be ? 'BE' : 'SL';
        const lvl = (j > fillIdx && (s.long ? b.open < stop : b.open > stop)) ? b.open : stop;
        exitPx = s.long ? lvl * (1 - C.stopSlip * C.costMult) : lvl * (1 + C.stopSlip * C.costMult);
        break;
      }
      if ((j > fillIdx || atOpen) && (s.long ? b.high >= s.tp : b.low <= s.tp)) { exitIdx = j; reason = 'TP'; exitPx = s.tp; break; }
      if (j > fillIdx || atOpen) mfe = Math.max(mfe, (dir * ((s.long ? b.high : b.low) - fillPx)) / riskPx);
      if (pLvl != null && !partial && (j > fillIdx || atOpen) && (s.long ? b.high >= pLvl : b.low <= pLvl)) partial = true;
      if (C.ftBars && !ftDone && j === fillIdx + C.ftBars) {
        ftDone = true;
        if (!be && mfe < C.ftMinR) {
          if (C.ftMode === 'exit') { exitIdx = j; reason = 'FT'; exitPx = s.long ? b.close * (1 - C.stopSlip * C.costMult) : b.close * (1 + C.stopSlip * C.costMult); break; }
          const t2 = fillPx - dir * C.ftTightR * riskPx; if (s.long ? t2 > stop : t2 < stop) stop = t2;
        }
      }
      if (beTrig != null && !be && (j > fillIdx || atOpen) && (s.long ? b.high >= beTrig : b.low <= beTrig)) { be = true; stop = beLvl; }
      const timeUp = j - fillIdx + 1 >= C.maxHoldBars || (C.sessExit && j + 1 < N && B[j + 1].time >= s.sessEnd);
      if (timeUp) { exitIdx = j; reason = 'TIME'; exitPx = s.long ? b.close * (1 - C.stopSlip * C.costMult) : b.close * (1 + C.stopSlip * C.costMult); break; }
    }
    if (exitIdx < 0) { exitIdx = N - 1; exitPx = B[N - 1].close; reason = 'END'; }
    // R per trade with orig cost model: maker on entry (+TP), taker+slip on stop/time exits
    const pf = partial ? C.partialFrac : 0;
    const gross = (1 - pf) * dir * (exitPx - fillPx) + (partial ? pf * dir * (pLvl - fillPx) : 0);
    const fee = C.costMult * (fillPx * C.makerFee + (1 - pf) * exitPx * (reason === 'TP' ? C.makerFee : C.takerFee) + (partial ? pf * pLvl * C.makerFee : 0));
    const R = (gross - fee) / riskPx;
    // leverage cap: qty = min(1%eq/riskPx, 10eq/fillPx) → R scales down when stop < 0.1%
    const capF = Math.min(1, (C.maxLeverage / fillPx) / (C.riskPct / riskPx));
    trades.push({ long: s.long, t: B[fillIdx].time, fillIdx, exitIdx, fillPx, stop: s.stop, tp: s.tp, exitPx, reason,
      R: R * capF, plannedRR: Math.abs(s.tp - fillPx) / riskPx, stopPct: riskPx / fillPx, f: s.f, s, riskPx });
    perSess.set(s.sessStart, (perSess.get(s.sessStart) || 0) + 1);
    busyUntil = exitIdx + 1;
  }
  return trades;
}

function stats(T, C = BASE) {
  const wins = T.filter((t) => t.R > 0), losses = T.filter((t) => t.R <= 0);
  const gp = wins.reduce((a, t) => a + t.R, 0), gl = -losses.reduce((a, t) => a + t.R, 0);
  let eq = C.startEquity, peak = eq, dd = 0, cr = 0, pk = 0, ddR = 0, st = 0, mst = 0, gpd = 0, gld = 0;
  for (const t of T) {
    const pnl = eq * C.riskPct * t.R; if (pnl > 0) gpd += pnl; else gld -= pnl;
    eq += pnl; peak = Math.max(peak, eq); dd = Math.max(dd, (peak - eq) / peak);
    cr += t.R; pk = Math.max(pk, cr); ddR = Math.max(ddR, pk - cr);
    if (t.R <= 0) mst = Math.max(mst, ++st); else st = 0;
  }
  const n = T.length;
  return { n, win: n ? wins.length / n : 0, pf: gld ? gpd / gld : gpd ? 99 : 0, pfR: gl ? gp / gl : gp ? 99 : 0, sumR: cr, avgR: n ? cr / n : 0,
    netPct: eq / C.startEquity - 1, net: eq - C.startEquity, maxDD: dd, ddR, streak: mst,
    rr: n ? T.reduce((a, t) => a + t.plannedRR, 0) / n : 0,
    tp: T.filter((t) => t.reason === 'TP').length, sl: T.filter((t) => t.reason === 'SL').length, be: T.filter((t) => t.reason === 'BE').length,
    time: T.filter((t) => t.reason === 'TIME').length, ft: T.filter((t) => t.reason === 'FT').length };
}

// year windows
const Y = { Y1: [Date.parse('2023-10-18') / 1000, Date.parse('2024-10-18') / 1000], Y2: [Date.parse('2024-10-18') / 1000, Date.parse('2025-10-18') / 1000], Y3: [Date.parse('2025-10-18') / 1000, Date.parse('2026-10-18') / 1000] };
const RAW = {};
function runSym(sym, conf) {
  const C = { ...BASE, ...conf };
  RAW[sym] = RAW[sym] || load(sym);
  const D = analyze(sym, RAW[sym], C.swingLen);
  const T = execute(D, C, setupsFor(D, C));
  const by = {};
  for (const [k, [a, b]] of Object.entries(Y)) by[k] = stats(T.filter((t) => t.t >= a && t.t < b), C);
  by.train = stats(T.filter((t) => t.t < Y.Y3[0]), C);
  by.all = stats(T, C);
  return { by, trades: T };
}

module.exports = { BASE, SMC, analyze, setupsFor, execute, stats, runSym, load, Y, RAW };
