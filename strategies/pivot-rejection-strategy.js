// pivot-rejection-strategy.js — "Pivot Rejection (v3)": a mean-reversion sibling of
// the profitable "Pivot Cross — Improved" strategy. Where the base trades a CROSS
// THROUGH the central pivot P, this one FADES the full floor-trader pivot set
// (P, R1, R2, S1, S2): it waits for price to tag a level and get REJECTED with a
// candlestick wick, then trades back toward the middle.
//
// Strategy file contract (see README): export a single Strategy object and register
// it on window.__STRATEGIES[id]. The engine calls init(params) once per run, then
// onCandle(candle, indicators, account) for each revealed candle.
//
//   candle:     { time, open, high, low, close, volume }
//   indicators: { ema(closes,p), sma(closes,p), rsi(closes,p), closes[], candles[] }
//   account:    { position:'long'|'short'|null, entryPrice, balance }
//   return:     'long' | 'short' | 'close' | null
//           or: { signal, stopLoss, takeProfit }   ← the engine then manages the bracket
//
// Idea (mean reversion / rejection):
//   • LONG  when a candle wicks DOWN to/through a SUPPORT level (S2/S1/P) and closes
//     back ABOVE it as a hammer/pin bar (long lower wick ≥ wickRatio × body) — i.e. a
//     bullish rejection of the line — confirmed by RSI in the oversold zone.
//   • SHORT when a candle wicks UP to/through a RESISTANCE level (R2/R1/P) and closes
//     back BELOW it as a shooting star (long upper wick) — a bearish rejection —
//     confirmed by RSI in the overbought zone.
//   A `tol = tolATR × ATR` band lets a near-miss (rejected just shy of the line) count.
//   • EXIT  default targets the ADJACENT pivot level toward the middle (bounce off S1
//     → target P), stop a fraction of ATR beyond the tested line (a clean break of the
//     line invalidates the fade). ATR and Percent brackets are also available.
//
// Pivot levels are derived without lookahead from the PREVIOUS COMPLETED Daily/Weekly/
// Monthly period's high/low/close, so they're fixed for the whole current period.
//
// "Use Heikin Ashi" mirrors the base toggle: when on, all source prices read this
// symbol's internal HA candles (off by default — HA fills aren't achievable live).
// (Markers: 🟢 long, 🔴 short, 🔵 close.)
(function () {
  // ── period bucketing (UTC) ── copied from pivot-cross-strategy.js (files are standalone) ──
  function periodKey(timeSec, type) {
    if (type === 'Weekly') return Math.floor((Math.floor(timeSec / 86400) + 4) / 7); // Monday-aligned
    if (type === 'Monthly') { const d = new Date(timeSec * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
    return Math.floor(timeSec / 86400); // Daily = calendar day
  }

  // Previous-completed-period high/low/close from the source view. Walks back only
  // across the current + previous period → no future leak. `src` exposes O/H/L/C by index.
  function pivotSource(candles, type, src) {
    const n = candles.length;
    if (!n) return null;
    const curKey = periodKey(candles[n - 1].time, type);
    let i = n - 1;
    while (i >= 0 && periodKey(candles[i].time, type) === curKey) i--; // i = last bar of previous period
    if (i < 0) return null;                                            // no completed prior period yet
    const prevKey = periodKey(candles[i].time, type);
    let hi = -Infinity, lo = Infinity;
    const close = src.C(i);
    let j = i;
    while (j >= 0 && periodKey(candles[j].time, type) === prevKey) {
      if (src.H(j) > hi) hi = src.H(j);
      if (src.L(j) < lo) lo = src.L(j);
      j--;
    }
    return { high: hi, low: lo, close };
  }

  // Standard floor-trader pivot set from the previous period's H/L/C.
  function pivotLevels(s) {
    const P = (s.high + s.low + s.close) / 3;
    const range = s.high - s.low;
    return {
      P,
      R1: 2 * P - s.low,
      S1: 2 * P - s.high,
      R2: P + range,
      S2: P - range,
    };
  }

  // Wilder ATR over the source H/L/C accessors (engine ships only SMA/EMA/RSI).
  function atrFromSrc(n, period, src) {
    if (n < period + 1) return null;
    const tr = (k) => Math.max(src.H(k) - src.L(k), Math.abs(src.H(k) - src.C(k - 1)), Math.abs(src.L(k) - src.C(k - 1)));
    let sum = 0;
    for (let k = 1; k <= period; k++) sum += tr(k);
    let a = sum / period;
    for (let k = period + 1; k < n; k++) a = (a * (period - 1) + tr(k)) / period;
    return a;
  }

  // One Heikin-Ashi step from the previous HA open/close and the raw candle.
  function haStep(prevO, prevC, c) {
    const haC = (c.open + c.high + c.low + c.close) / 4;
    const haO = prevO == null ? (c.open + c.close) / 2 : (prevO + prevC) / 2;
    return { o: haO, h: Math.max(c.high, haO, haC), l: Math.min(c.low, haO, haC), c: haC };
  }

  // O/H/L/C accessor view over raw or Heikin-Ashi candles (for the overlay series).
  function srcView(candles, useHA) {
    if (!useHA) return { H: (i) => candles[i].high, L: (i) => candles[i].low, C: (i) => candles[i].close };
    const o = [], h = [], l = [], c = [];
    for (let i = 0; i < candles.length; i++) {
      const s = haStep(i > 0 ? o[i - 1] : null, i > 0 ? c[i - 1] : null, candles[i]);
      o[i] = s.o; h[i] = s.h; l[i] = s.l; c[i] = s.c;
    }
    return { H: (i) => h[i], L: (i) => l[i], C: (i) => c[i] };
  }

  // For each bar, the previous COMPLETED period's {hi,lo,close} (null while priming).
  function prevPeriodSeries(candles, tf, src) {
    const out = [];
    let curKey = null, curHi = -Infinity, curLo = Infinity, curClose = null;
    let pHi = null, pLo = null, pClose = null;
    for (let i = 0; i < candles.length; i++) {
      const k = periodKey(candles[i].time, tf);
      const H = src.H(i), L = src.L(i), C = src.C(i);
      if (curKey === null) { curKey = k; curHi = H; curLo = L; curClose = C; }
      else if (k !== curKey) { pHi = curHi; pLo = curLo; pClose = curClose; curKey = k; curHi = H; curLo = L; curClose = C; }
      else { curHi = Math.max(curHi, H); curLo = Math.min(curLo, L); curClose = C; }
      out.push(pHi != null ? { hi: pHi, lo: pLo, close: pClose } : null);
    }
    return out;
  }

  const Strategy = {
    name: 'Pivot Cross V3 — Rejection',
    description: 'Mean-reversion sibling of Pivot Cross: FADES the full floor-trader pivot set ' +
      '(P, R1/R2, S1/S2) from the previous Daily/Weekly/Monthly period. LONG when a candle wicks ' +
      'down to a support level and closes back above it as a hammer/pin (bullish rejection) with RSI ' +
      'oversold; SHORT on a shooting-star rejection of a resistance level with RSI overbought. ' +
      'Optional volume-climax gate. Exit targets the adjacent pivot toward the middle (or an ATR / ' +
      'percent bracket); stop sits just beyond the tested line. "Use Heikin Ashi" makes every source ' +
      'read internal HA candles (off by default — HA fills aren\'t achievable live). ' +
      'Markers: 🟢 long, 🔴 short, 🔵 close.',
    warmUpBars: 60,

    // Draws the TradingView picture during Watch Replay: the full floor-trader level
    // set it fades (P + R1/R2 resistance, S1/S2 support) plus the generic per-trade
    // green profit / red risk boxes + entry/exit triangles & labels.
    overlay: true,

    params: {
      useHA:          { label: 'Use Heikin Ashi', type: 'select', options: ['Off', 'On'], default: 'Off' },
      pivotTimeframe: { label: 'Pivot timeframe', type: 'select', options: ['Daily', 'Weekly', 'Monthly'], default: 'Daily' },
      useR2S2:        { label: 'Include R2/S2',  type: 'select', options: ['On', 'Off'], default: 'On' },
      direction:      { label: 'Direction',      type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
      wickRatio:      { label: 'Rejection wick ÷ body', type: 'number', default: 1.5, min: 0.5, max: 5, step: 0.1 },
      tolATR:         { label: 'Level tolerance × ATR',  type: 'number', default: 0.1, min: 0, max: 1, step: 0.05 },
      useRSI:         { label: 'RSI filter',     type: 'select', options: ['On', 'Off'], default: 'On' },
      rsiPeriod:      { label: 'RSI period',     type: 'number', default: 14, min: 2,  max: 100 },
      oversold:       { label: 'Oversold ≤',     type: 'number', default: 35, min: 1,  max: 49 },
      overbought:     { label: 'Overbought ≥',   type: 'number', default: 65, min: 51, max: 99 },
      useVol:         { label: 'Volume filter',  type: 'select', options: ['On', 'Off'], default: 'Off' },
      volLen:         { label: 'Volume MA length', type: 'number', default: 20, min: 5, max: 50 },
      volMult:        { label: 'Volume × avg',   type: 'number', default: 1.2, min: 0.5, max: 3, step: 0.1 },
      atrLen:         { label: 'ATR length',     type: 'number', default: 14, min: 5,  max: 50 },
      exitMode:       { label: 'Exit mode',      type: 'select', options: ['Pivot', 'ATR', 'Percent'], default: 'Pivot' },
      slATR:          { label: 'Stop beyond line × ATR', type: 'number', default: 0.75, min: 0.1, max: 5, step: 0.05 },
      tpATR:          { label: 'Target × ATR (ATR mode)', type: 'number', default: 2.0, min: 0.5, max: 10, step: 0.1 },
      stopPct:        { label: 'Stop % (Percent mode)',   type: 'number', default: 1.0, min: 0.1, max: 20, step: 0.1 },
      targetPct:      { label: 'Target % (Percent mode)', type: 'number', default: 2.0, min: 0.1, max: 40, step: 0.1 },
    },

    // Shown on the chart during Watch Replay so you see what drives the signals.
    // (Engine has no pivot-line indicator type — the levels are reflected via the
    // SL/TP/entry lines TradeSim already draws; same limitation as the base.)
    chartIndicators(p) {
      p = p || {};
      return [
        { type: 'rsi',    visible: p.useRSI !== 'Off', params: { period: p.rsiPeriod || 14, color: '#7e57c2', lineWidth: 1,
                                                                 overbought: p.overbought || 65, oversold: p.oversold || 35 } },
        { type: 'volume', visible: p.useVol === 'On', params: {} },
      ];
    },

    // Stepped floor-trader level set for the overlay (P orange; R1/R2 red resistance,
    // S1/S2 green support) — the lines this strategy fades on a rejection wick.
    overlaySeries(candles, params) {
      const tf = (params && params.pivotTimeframe) || 'Daily';
      const useR2S2 = !params || params.useR2S2 !== 'Off';
      const src = srcView(candles, params && params.useHA === 'On');
      const prev = prevPeriodSeries(candles, tf, src);
      const P = (s) => (s.hi + s.lo + s.close) / 3;
      const mk = (fn) => candles.map((c, i) => ({ time: c.time, value: prev[i] ? fn(prev[i]) : null }));
      const pivot = mk(P);
      const lines = [
        { label: 'R1', color: 'rgba(239,83,80,0.55)', data: mk((s) => 2 * P(s) - s.lo) },
        { label: 'S1', color: 'rgba(38,166,154,0.55)', data: mk((s) => 2 * P(s) - s.hi) },
      ];
      if (useR2S2) {
        lines.push({ label: 'R2', color: 'rgba(239,83,80,0.4)', data: mk((s) => P(s) + (s.hi - s.lo)) });
        lines.push({ label: 'S2', color: 'rgba(38,166,154,0.4)', data: mk((s) => P(s) - (s.hi - s.lo)) });
      }
      return { pivot, lines };
    },

    init(params) {
      this.p = params;
      this._ha = { len: 0, o: [], h: [], l: [], c: [] }; // incremental HA cache (append-only)
      this.reason = '';
    },

    // Extend the cached HA arrays to cover the whole slice (amortized O(1)/bar).
    _ha_extend(candles) {
      const a = this._ha;
      if (candles.length < a.len) { a.len = 0; a.o = []; a.h = []; a.l = []; a.c = []; } // slice shrank → rebuild
      for (let i = a.len; i < candles.length; i++) {
        const s = haStep(i > 0 ? a.o[i - 1] : null, i > 0 ? a.c[i - 1] : null, candles[i]);
        a.o[i] = s.o; a.h[i] = s.h; a.l[i] = s.l; a.c[i] = s.c;
      }
      a.len = candles.length;
      return a;
    },

    onCandle(candle, indicators, account) {
      const P_ = this.p;
      const candles = indicators.candles;
      const n = candles.length;
      if (n < P_.atrLen + 3) return null;

      // ── source view: Heikin Ashi or real OHLC ──
      const useHA = P_.useHA === 'On';
      const ha = useHA ? this._ha_extend(candles) : null;
      const src = useHA
        ? { O: (i) => ha.o[i], H: (i) => ha.h[i], L: (i) => ha.l[i], C: (i) => ha.c[i] }
        : { O: (i) => candles[i].open, H: (i) => candles[i].high, L: (i) => candles[i].low, C: (i) => candles[i].close };

      const last = n - 1;
      const o = src.O(last), h = src.H(last), l = src.L(last), c = src.C(last);

      // ── only act when flat (mirror the base) ──
      if (account.position) { this.reason = `holding ${account.position}`; return null; }

      // ── pivot levels for the current period (previous completed period's H/L/C) ──
      const psrc = pivotSource(candles, P_.pivotTimeframe, src);
      if (!psrc) { this.reason = 'no prior pivot period yet'; return null; }
      const lv = pivotLevels(psrc);

      // ── ATR (for the tolerance band + exits) ──
      const A = atrFromSrc(n, P_.atrLen, src);
      if (A == null || !(A > 0)) { this.reason = 'ATR not ready'; return null; }
      const tol = P_.tolATR * A;

      // ── candle geometry ──
      const body = Math.abs(c - o);
      const upperWick = h - Math.max(o, c);
      const lowerWick = Math.min(o, c) - l;
      const range = h - l;
      const eps = body > 0 ? body : (range > 0 ? range * 0.01 : 1e-9); // avoid /0 on doji bodies
      const lowerRatio = lowerWick / eps;
      const upperRatio = upperWick / eps;
      const closeUpperHalf = range > 0 ? (c - l) / range >= 0.5 : false; // hammer: close in upper half
      const closeLowerHalf = range > 0 ? (h - c) / range >= 0.5 : false; // star:   close in lower half

      // ── candidate levels, ordered so we can pick the one nearest the close ──
      const support    = P_.useR2S2 === 'Off' ? [['S1', lv.S1], ['P', lv.P]] : [['S2', lv.S2], ['S1', lv.S1], ['P', lv.P]];
      const resistance = P_.useR2S2 === 'Off' ? [['R1', lv.R1], ['P', lv.P]] : [['R2', lv.R2], ['R1', lv.R1], ['P', lv.P]];

      const longOK  = P_.direction !== 'Short only';
      const shortOK = P_.direction !== 'Long only';

      // ── bullish rejection at a support level: wick to/through L, close back above ──
      let bull = null;
      if (longOK && lowerRatio >= P_.wickRatio && closeUpperHalf) {
        for (const [name, L] of support) {
          if (l <= L + tol && c > L) {
            if (!bull || Math.abs(c - L) < Math.abs(c - bull.L)) bull = { name, L };
          }
        }
      }
      // ── bearish rejection at a resistance level: wick to/through L, close back below ──
      let bear = null;
      if (shortOK && upperRatio >= P_.wickRatio && closeLowerHalf) {
        for (const [name, L] of resistance) {
          if (h >= L - tol && c < L) {
            if (!bear || Math.abs(c - L) < Math.abs(c - bear.L)) bear = { name, L };
          }
        }
      }

      if (!bull && !bear) {
        this.reason = `no rejection · close ${c.toFixed(2)} · P ${lv.P.toFixed(2)}`;
        return null;
      }
      // If a bar somehow qualifies both ways, take the nearer level.
      let dir, hit;
      if (bull && bear) { if (Math.abs(c - bull.L) <= Math.abs(c - bear.L)) { dir = 'long'; hit = bull; } else { dir = 'short'; hit = bear; } }
      else if (bull) { dir = 'long'; hit = bull; }
      else { dir = 'short'; hit = bear; }

      // ── RSI confirmation ──
      let rsiVal = null;
      if (P_.useRSI === 'On') {
        const rArr = indicators.rsi(indicators.closes, P_.rsiPeriod);
        rsiVal = rArr[rArr.length - 1];
        if (rsiVal == null) { this.reason = 'RSI warming up'; return null; }
        if (dir === 'long' && !(rsiVal <= P_.oversold)) { this.reason = `rejection @ ${hit.name} but RSI ${rsiVal.toFixed(0)} > oversold`; return null; }
        if (dir === 'short' && !(rsiVal >= P_.overbought)) { this.reason = `rejection @ ${hit.name} but RSI ${rsiVal.toFixed(0)} < overbought`; return null; }
      }

      // ── volume confirmation ──
      if (P_.useVol === 'On') {
        const vols = candles.map((x) => x.volume);
        const va = indicators.sma(vols, P_.volLen);
        const avg = va[va.length - 1];
        if (!(avg != null && candle.volume >= P_.volMult * avg)) { this.reason = `rejection @ ${hit.name} but volume below filter`; return null; }
      }

      return this._enter(dir, c, hit, lv, A, rsiVal);
    },

    // Build the entry + stop/target bracket. Pivot mode targets the adjacent level
    // toward the middle; the stop sits a fraction of ATR beyond the tested line.
    _enter(dir, price, hit, lv, A, rsiVal) {
      const P_ = this.p;
      let stop, target;
      if (P_.exitMode === 'Pivot') {
        target = this._adjacentTarget(dir, hit.name, lv, price);
        stop = dir === 'long' ? hit.L - P_.slATR * A : hit.L + P_.slATR * A;
        // Degenerate geometry guard: ensure target is the right side of entry.
        if (dir === 'long' && !(target > price)) target = price + P_.slATR * A * 2;
        if (dir === 'short' && !(target < price)) target = price - P_.slATR * A * 2;
      } else if (P_.exitMode === 'ATR') {
        stop   = dir === 'long' ? price - P_.slATR * A : price + P_.slATR * A;
        target = dir === 'long' ? price + P_.tpATR * A : price - P_.tpATR * A;
      } else {
        stop   = dir === 'long' ? price * (1 - P_.stopPct / 100)   : price * (1 + P_.stopPct / 100);
        target = dir === 'long' ? price * (1 + P_.targetPct / 100) : price * (1 - P_.targetPct / 100);
      }
      const rsiTxt = rsiVal != null ? ` · RSI ${rsiVal.toFixed(0)}` : '';
      this.reason = `${dir === 'long' ? 'Bullish' : 'Bearish'} rejection @ ${hit.name} ${hit.L.toFixed(2)} → ` +
        `entry ${price.toFixed(2)} · stop ${stop.toFixed(2)} / target ${target.toFixed(2)}${rsiTxt}`;
      return { signal: dir, stopLoss: stop, takeProfit: target };
    },

    // Next pivot level toward the middle from the tested one (in the trade direction).
    _adjacentTarget(dir, name, lv, price) {
      const upChain = { S2: lv.S1, S1: lv.P, P: lv.R1 };  // long: target the level above
      const dnChain = { R2: lv.R1, R1: lv.P, P: lv.S1 };  // short: target the level below
      let t = dir === 'long' ? upChain[name] : dnChain[name];
      if (t == null) t = dir === 'long' ? lv.R1 : lv.S1;  // fallback
      return t;
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.pivotreject = Strategy;
})();
