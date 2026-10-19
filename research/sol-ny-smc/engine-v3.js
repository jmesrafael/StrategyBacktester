// engine-v3.js — v2 engine plus: fixed-$ risk sizing, minimum reward:risk filter,
// fee-adjusted breakeven, extra target modes. With default options it behaves
// exactly like engine.js (the frozen baseline), which stays untouched.
// CHoCH → first post-CHoCH FVG → limit entry at the FVG midpoint, stop beyond the
// reversal swing, target at a defined swing / R multiple, breakeven at 1R.
// Structure (NY open, PDH/PDL, FVG, CHoCH, swings) comes from the app's own
// 📐 SMC Toolkit (js/smc.js), loaded unchanged in a sandbox.
const fs = require('fs'), vm = require('vm'), path = require('path');
const APP = process.env.APP_DIR || path.join(__dirname, '..', '..');   // repo root

function loadToolkit() {
  const ctx = {
    console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity,
    window: {}, CFG: { ALL_INTERVALS: [['1', '1m'], ['15', '15m'], ['60', '1h'], ['D', '1D']] },
    document: { getElementById: () => ({ value: '' }) },
    requestAnimationFrame: () => 0, ResizeObserver: class { observe() {} }, ChartView: {},
    intervalToSeconds: (iv) => (iv === 'D' ? 86400 : parseInt(iv) * 60),
    peekCandleCache: () => null, fetchCandles: () => Promise.reject(new Error('offline')),
  };
  vm.runInNewContext(fs.readFileSync(path.join(APP, 'js/smc.js'), 'utf8') + '\n;this.SMC = SMCIndicator;', ctx);
  return ctx.SMC;
}
const SMC = loadToolkit();

const DEFAULT_CONF = {
  swingLen: 5,            // toolkit default (CHoCH swing length)
  fvgWindow: 10,          // post-CHoCH FVG must complete within N bars of the CHoCH bar
  sessionHours: 6.5,      // NY session = toolkit NY-open line → +6.5h (09:30–16:00 ET)
  allHours: false,        // true = ignore the session filter
  slBufferPct: 0.0002,    // stop 0.02% beyond the reversal swing
  makerFee: 0.0002, takerFee: 0.00055, stopSlip: 0.0002,
  fill: 'touch',          // 'touch' = filled when price reaches the midpoint · 'through' = must trade beyond it
  throughPct: 0.0002,     //   ...by this much (0.02%) for 'through'
  funding: null,          // [[timeSec, rate], ...] → applied to open positions at each funding time
  tpMode: 'swing',        // 'swing' | 'impulse' | 'swingMin1R' | 'R1.5' | 'R2'
  sizing: 'compound',     // 'compound' (1% of current equity) | 'fixed' (1% of starting equity) | 'usd' (riskUsd per trade)
  riskUsd: 10,            //   planned loss per trade for sizing 'usd' (before fees/slippage)
  minRR: 0,               // skip setups whose target is closer than minRR x risk
  beFeeAdjusted: false,
  tpR: 2,                 // R multiple for tpMode 'R'
  breakeven: true,        // move the stop to breakeven at +1R   // breakeven stop placed where the exit nets $0 after fees + stop slippage
  riskPct: 0.01, maxLeverage: 10, startEquity: 10000,
  pdTol: 0.0015, pdSweep: 0.005,
  sdImpulseATR: 2.0, sdBars: 3, sdMaxAge: 2000,
  tpLookback: 3000,
};

function prepare(raw, sec, confIn) {
  const C = { ...DEFAULT_CONF, ...confIn };
  const B = raw.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
  const N = B.length;
  const tIdx = new Map(B.map((b, i) => [b.time, i]));
  const A = SMC.analyze(B, sec, { ch1_len: C.swingLen, chBreak: 'close', fvgFill: 'wick', tz: 8,
    nyTime: '21:30', nyAutoDST: true, dayStart: '08:00' });

  const sessions = A.ny.map((t) => [t, t + C.sessionHours * 3600]);
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

  const atr = new Array(N).fill(null);
  { let s = 0; for (let i = 1; i < N; i++) {
    const tr = Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close));
    if (i <= 14) { s += tr; if (i === 14) atr[i] = s / 14; } else atr[i] = (atr[i - 1] * 13 + tr) / 14; } }

  // supply/demand zones (known at `born`; `dead` = first later close through the zone)
  const zones = { demand: [], supply: [] };
  for (let k = 15; k + C.sdBars < N; k++) {
    const a = atr[k]; if (!a) continue;
    const c = B[k], e = B[k + C.sdBars];
    if (c.close < c.open && e.close - c.close >= C.sdImpulseATR * a) zones.demand.push({ low: c.low, high: c.high, born: k + C.sdBars, dead: null });
    if (c.close > c.open && c.close - e.close >= C.sdImpulseATR * a) zones.supply.push({ low: c.low, high: c.high, born: k + C.sdBars, dead: null });
  }
  for (const z of zones.demand) for (let j = z.born + 1; j < N; j++) if (B[j].close < z.low) { z.dead = j; break; }
  for (const z of zones.supply) for (let j = z.born + 1; j < N; j++) if (B[j].close > z.high) { z.dead = j; break; }
  const zoneTouched = (list, idx, price, isDemand) => {
    for (let q = list.length - 1; q >= 0; q--) {
      const z = list[q];
      if (z.born >= idx) continue;
      if (idx - z.born > C.sdMaxAge) break;
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

  // ---- setups (every CHoCH; rejected ones keep their reason) ----
  const chochs = A.structure.filter((e) => e.type === 'CHoCH').map((e) => ({ ...e, b: tIdx.get(e.t2), p: tIdx.get(e.t1) }));
  const breaks = A.structure.map((e) => ({ bull: e.bull, b: tIdx.get(e.t2) }));
  const setups = [], rejected = [];
  for (const e of chochs) {
    const reject = (why) => rejected.push({ long: e.bull, chochIdx: e.b, why });
    const sess = C.allHours ? [B[e.b].time, Infinity] : sessionOf(B[e.b].time);
    if (!sess) { reject('outside NY session'); continue; }
    let fvg = null, fi = -1;
    for (let i = e.b + 1; i <= e.b + C.fvgWindow && i < N; i++) {
      const g = (fvgByC3.get(i) || []).find((x) => x.bull === e.bull);
      if (g) { fvg = g; fi = i; break; }
    }
    if (!fvg) { reject('no post-CHoCH FVG within ' + C.fvgWindow + ' bars'); continue; }
    const long = e.bull;
    let legX = long ? Infinity : -Infinity, legXi = e.p;
    for (let j = e.p; j <= e.b; j++) { const v = long ? B[j].low : B[j].high; if (long ? v < legX : v > legX) { legX = v; legXi = j; } }
    let imp = long ? -Infinity : Infinity;
    for (let j = legXi; j <= fi; j++) imp = long ? Math.max(imp, B[j].high) : Math.min(imp, B[j].low);
    const entry = (fvg.top + fvg.bottom) / 2;
    const stop = long ? legX * (1 - C.slBufferPct) : legX * (1 + C.slBufferPct);
    if (long ? entry <= stop : entry >= stop) { reject('entry beyond stop'); continue; }
    let swingTp = null;
    for (const s of (long ? SH : SL)) {
      if (s.confirmIdx > fi || fi - s.idx > C.tpLookback) continue;
      if (long ? s.price > imp && (swingTp == null || s.price < swingTp) : s.price < imp && (swingTp == null || s.price > swingTp)) swingTp = s.price;
    }
    const risk = Math.abs(entry - stop), dir = long ? 1 : -1;
    let tp;
    if (C.tpMode === 'swing') tp = swingTp;
    else if (C.tpMode === 'impulse') tp = imp;
    else if (C.tpMode === 'swingMin1R') tp = swingTp != null && Math.abs(swingTp - entry) >= risk ? swingTp : null;
    else if (C.tpMode === 'R1.5') tp = entry + dir * 1.5 * risk;
    else if (C.tpMode === 'R2') tp = entry + dir * 2 * risk;
    else if (C.tpMode === 'R3') tp = entry + dir * 3 * risk;
    else if (C.tpMode === 'R') tp = entry + dir * C.tpR * risk;
    else if (C.tpMode === 'swingAtLeastMinRR') {           // nearest swing that is at least minRR away
      tp = null;
      for (const s of (long ? SH : SL)) {
        if (s.confirmIdx > fi || fi - s.idx > C.tpLookback) continue;
        if (Math.abs(s.price - entry) < C.minRR * risk || (long ? s.price <= imp : s.price >= imp)) continue;
        if (long ? (tp == null || s.price < tp) : (tp == null || s.price > tp)) tp = s.price;
      }
    }
    if (tp == null || (long ? tp <= entry : tp >= entry)) { reject('no valid target'); continue; }
    if (C.minRR && Math.abs(tp - entry) / risk < C.minRR - 1e-9) { reject('target below ' + C.minRR + 'R'); continue; }
    const fibR = Math.abs(imp - entry) / Math.abs(imp - legX);
    const pd = pdAt(B[legXi].time);
    const nearLvl = (x, lvl) => long ? (x <= lvl * (1 + C.pdTol) && x >= lvl * (1 - C.pdSweep))
                                     : (x >= lvl * (1 - C.pdTol) && x <= lvl * (1 + C.pdSweep));
    setups.push({
      long, chochIdx: e.b, brokenSwingIdx: e.p, fvgIdx: fi, legXi, legX, imp, entry, stop, tp, risk,
      fvgTop: fvg.top, fvgBottom: fvg.bottom, sessEnd: sess[1],
      f: {
        fib: fibR >= 0.382 && fibR <= 0.618,
        pd: !!pd && (nearLvl(legX, long ? pd.pdl : pd.pdh) || nearLvl(legX, long ? pd.pdh : pd.pdl)),
        sd: zoneTouched(long ? zones.demand : zones.supply, legXi, legX, long),
        tl: trendlineBroken(long, legXi, fi, fi),
      },
    });
  }
  return { C, B, N, sec, setups, rejected, breaks, chochs: chochs.length };
}

// ---- execution for one filter ----
function run(P, filter) {
  const { C, B, N, breaks } = P;
  const fund = C.funding || [];
  let fq = 0;
  let eq = C.startEquity, peak = eq, maxDD = 0, fees = 0, fundingPaid = 0;
  const trades = [], curve = [[B[0].time, eq]];
  let busyUntil = -1, bi = 0;
  let ruinTime = null;
  for (const s of P.setups) {
    if (!filter(s) || s.fvgIdx < busyUntil) continue;
    // account can no longer fund the planned risk → trading stops (account depleted)
    if (C.sizing === 'usd' && eq < C.riskUsd) { ruinTime = B[s.fvgIdx].time; break; }
    while (bi < breaks.length && breaks[bi].b <= s.fvgIdx) bi++;
    let cancelAt = Infinity;
    for (let q = bi; q < breaks.length; q++) if (breaks[q].bull !== s.long) { cancelAt = breaks[q].b; break; }
    // pending limit order
    const trigger = C.fill === 'through' ? (s.long ? s.entry * (1 - C.throughPct) : s.entry * (1 + C.throughPct)) : s.entry;
    let fillIdx = -1, fillPx = 0;
    for (let j = s.fvgIdx + 1; j < N && B[j].time < s.sessEnd && j < cancelAt; j++) {
      const b = B[j];
      if (s.long ? b.low <= trigger : b.high >= trigger) {
        fillIdx = j; fillPx = s.long ? Math.min(b.open, s.entry) : Math.max(b.open, s.entry); break;
      }
      if (s.long ? b.high >= s.tp : b.low <= s.tp) break;
    }
    if (fillIdx < 0) continue;
    const riskPx = Math.abs(fillPx - s.stop);
    const base = C.sizing === 'fixed' ? C.startEquity : eq;
    const eqBefore = eq;
    const qtyRisk = C.sizing === 'usd' ? C.riskUsd / riskPx : (base * C.riskPct) / riskPx;
    const qty = Math.min(qtyRisk, (eq * C.maxLeverage) / fillPx);   // leverage cap on current equity
    let stop = s.stop, be = false, exitIdx = -1, exitPx = 0, reason = '';
    const oneR = s.long ? fillPx + riskPx : fillPx - riskPx;
    for (let j = fillIdx; j < N; j++) {
      const b = B[j];
      const atOpen = j === fillIdx && fillPx === b.open;
      if (s.long ? b.low <= stop : b.high >= stop) {
        exitIdx = j; reason = be ? 'BE' : 'SL';
        const lvl = (j > fillIdx && (s.long ? b.open < stop : b.open > stop)) ? b.open : stop;
        exitPx = s.long ? lvl * (1 - C.stopSlip) : lvl * (1 + C.stopSlip);
        break;
      }
      if ((j > fillIdx || atOpen) && (s.long ? b.high >= s.tp : b.low <= s.tp)) { exitIdx = j; reason = 'TP'; exitPx = s.tp; break; }
      if (C.breakeven && !be && (j > fillIdx || atOpen) && (s.long ? b.high >= oneR : b.low <= oneR)) {
        be = true;
        stop = !C.beFeeAdjusted ? fillPx : s.long
          ? fillPx * (1 + C.makerFee) / ((1 - C.takerFee) * (1 - C.stopSlip))
          : fillPx * (1 - C.makerFee) / ((1 + C.takerFee) * (1 + C.stopSlip));
      }
    }
    if (exitIdx < 0) { exitIdx = N - 1; exitPx = B[N - 1].close; reason = 'END'; }
    // funding: every funding timestamp strictly after the fill bar opens and up to the exit bar
    let fpay = 0;
    if (fund.length) {
      const t0 = B[fillIdx].time, t1 = B[exitIdx].time;
      while (fq < fund.length && fund[fq][0] <= t0) fq++;
      for (let q = fq; q < fund.length && fund[q][0] <= t1; q++) fpay += (s.long ? 1 : -1) * fund[q][1] * qty * fillPx;
    }
    const gross = (s.long ? exitPx - fillPx : fillPx - exitPx) * qty;
    const fee = fillPx * qty * C.makerFee + exitPx * qty * (reason === 'TP' ? C.makerFee : C.takerFee);
    const pnl = gross - fee - fpay;
    fees += fee; fundingPaid += fpay;
    const R = pnl / (riskPx * qty);
    const rawExit = reason === 'TP' || reason === 'END' ? exitPx : (s.long ? exitPx / (1 - C.stopSlip) : exitPx / (1 + C.stopSlip));
    const grossR = (s.long ? rawExit - fillPx : fillPx - rawExit) / riskPx;
    eq += pnl; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, (peak - eq) / peak);
    curve.push([B[exitIdx].time, eq]);
    trades.push({
      long: s.long, chochTime: B[s.chochIdx].time, fvgTime: B[s.fvgIdx].time,
      fillTime: B[fillIdx].time, exitTime: B[exitIdx].time, fillIdx, exitIdx,
      entry: s.entry, fillPx, stop: s.stop, tp: s.tp, exitPx, reason, qty, pnl, fee, funding: fpay,
      R, grossR, plannedRR: Math.abs(s.tp - fillPx) / riskPx, stopPct: riskPx / fillPx, capped: qty < qtyRisk,
      beMoved: be, plannedLoss: riskPx * qty, notional: fillPx * qty, eqBefore,
      f: s.f, eq,
    });
    busyUntil = exitIdx + 1;
  }
  return { ...summarize(P, trades, eq, maxDD, fees, fundingPaid), trades, curve, ruinTime };
}

function summarize(P, T, eq, maxDD, fees, fundingPaid) {
  const C = P.C, B = P.B;
  const wins = T.filter((t) => t.pnl > 0), losses = T.filter((t) => t.pnl <= 0);
  const gp = wins.reduce((a, t) => a + t.pnl, 0), gl = -losses.reduce((a, t) => a + t.pnl, 0);
  let streak = 0, maxStreak = 0;
  for (const t of T) { if (t.pnl <= 0) maxStreak = Math.max(maxStreak, ++streak); else streak = 0; }
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const days = (B[B.length - 1].time - B[0].time) / 86400;
  // fixed-risk view in R: max drawdown of the cumulative-R curve
  let cr = 0, pk = 0, ddR = 0;
  for (const t of T) { cr += t.R; pk = Math.max(pk, cr); ddR = Math.max(ddR, pk - cr); }
  return {
    n: T.length, longs: T.filter((t) => t.long).length, shorts: T.filter((t) => !t.long).length,
    tp: T.filter((t) => t.reason === 'TP').length, sl: T.filter((t) => t.reason === 'SL').length,
    be: T.filter((t) => t.reason === 'BE').length, open: T.filter((t) => t.reason === 'END').length,
    winRate: T.length ? wins.length / T.length : 0, pf: gl ? gp / gl : gp ? Infinity : 0,
    net: eq - C.startEquity, netPct: eq / C.startEquity - 1, maxDD, fees, funding: fundingPaid,
    avgR: avg(T.map((t) => t.R)), sumR: T.reduce((a, t) => a + t.R, 0), maxDDR: ddR,
    avgGrossR: avg(T.map((t) => t.grossR)), avgPlannedRR: avg(T.map((t) => t.plannedRR)),
    avgWinR: avg(wins.map((t) => t.R)), avgLossR: avg(losses.map((t) => t.R)),
    maxLosingStreak: maxStreak, avgHoldBars: avg(T.map((t) => t.exitIdx - t.fillIdx)),
    perMonth: T.length / (days / 30.44), capped: T.filter((t) => t.capped).length,
    medianStopPct: T.length ? T.map((t) => t.stopPct).sort((a, b) => a - b)[Math.floor(T.length / 2)] : 0,
  };
}

const loc = (s) => s.f.sd || s.f.pd;
const FILTERS = {
  base: () => true, fib: (s) => s.f.fib, location: loc, full: (s) => loc(s) && s.f.fib,
  sd: (s) => s.f.sd, pd: (s) => s.f.pd, tl: (s) => s.f.tl, locTl: (s) => loc(s) && s.f.tl,
};

function loadBars(file) { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', file), 'utf8')); }

module.exports = { prepare, run, FILTERS, DEFAULT_CONF, loadBars, SMC };
