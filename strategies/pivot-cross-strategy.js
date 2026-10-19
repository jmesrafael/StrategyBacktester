// pivot-cross-strategy.js — port of the "Pivot Cross — Improved" Pine strategy.
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
// Idea (from the Pine): trade the cross of price through the floor-trader pivot P.
//   • LONG  when close crosses ABOVE P, SHORT when it crosses BELOW — but only
//     while FLAT, and only after a stack of optional filters all agree:
//       Trend filter (price the right side of an MA), Volume filter (cross bar on
//       above-average volume), Direction (Long/Short/Both), Session window,
//       Cooldown after an exit, and a daily trade cap.
//   • EXIT  via an ATR stop/target bracket (or a fixed-percent bracket) handed to
//     the engine, which then watches each later candle's high/low for the touch.
//
// Pivot P is derived without lookahead: bucket candles into Daily/Weekly/Monthly
// periods and use the PREVIOUS COMPLETED period's high/low/close →  P=(H+L+C)/3,
// so the level is fixed and known for the whole current period.
//
// "Use Heikin Ashi data" mirrors the Pine toggle: when on, all source prices
// (entry cross, MA, ATR, pivot) read this symbol's internal HA candles. NOTE: HA
// prices are synthetic — backtest fills at them are not achievable live, so the
// param defaults OFF. (Markers: 🟢 long, 🔴 short, 🔵 close.)
(function () {
  // ── period bucketing (UTC) ────────────────────────────────────────────────
  function periodKey(timeSec, type) {
    if (type === 'Weekly') return Math.floor((Math.floor(timeSec / 86400) + 4) / 7); // Monday-aligned
    if (type === 'Monthly') { const d = new Date(timeSec * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
    return Math.floor(timeSec / 86400); // Daily = calendar day
  }

  // Previous-completed-period high/low/close from the source view. Walks back only
  // across the current + previous period, so it can never see past the previous
  // period boundary → no future leak. `src` exposes O/H/L/C accessors by index.
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

  // Weighted MA (engine ships SMA/EMA only). Returns last value or null.
  function wmaLast(arr, p) {
    const n = arr.length;
    if (n < p) return null;
    let s = 0; const denom = p * (p + 1) / 2;
    for (let k = 0; k < p; k++) s += arr[n - 1 - k] * (p - k);
    return s / denom;
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
  // Single O(n) pass — pure/stateless so the overlay can recompute it each render.
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
    name: 'Pivot Cross V1 — Improved',
    description: 'Trades the cross of price through the floor-trader pivot P (from the previous ' +
      'Daily/Weekly/Monthly period): LONG on a cross above P, SHORT on a cross below — gated by an ' +
      'optional trend MA, volume filter, direction, session window, post-exit cooldown and a daily ' +
      'trade cap. Exits via an ATR stop/target bracket (or fixed-percent). "Use Heikin Ashi" makes ' +
      'every source read internal HA candles (off by default — HA fills aren\'t achievable live). ' +
      'Markers: 🟢 long, 🔴 short, 🔵 close.',
    warmUpBars: 60,

    // Draws the TradingView picture during Watch Replay: stepped pivot-P line plus the
    // generic per-trade green profit / red risk boxes + entry/exit triangles & labels.
    overlay: true,

    params: {
      useHA:        { label: 'Use Heikin Ashi', type: 'select', options: ['Off', 'On'], default: 'Off' },
      pivotTimeframe: { label: 'Pivot timeframe', type: 'select', options: ['Daily', 'Weekly', 'Monthly'], default: 'Daily' },
      useTrend:     { label: 'Trend filter',  type: 'select', options: ['On', 'Off'], default: 'On' },
      maType:       { label: 'MA type',       type: 'select', options: ['EMA', 'SMA', 'WMA'], default: 'EMA' },
      maLen:        { label: 'MA length',     type: 'number', default: 50,  min: 10, max: 400 },
      direction:    { label: 'Direction',     type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
      useVol:       { label: 'Volume filter', type: 'select', options: ['On', 'Off'], default: 'On' },
      volLen:       { label: 'Volume MA length', type: 'number', default: 20, min: 5,  max: 50 },
      volMult:      { label: 'Volume × avg',  type: 'number', default: 1.2, min: 0.5, max: 3, step: 0.1 },
      atrLen:       { label: 'ATR length',    type: 'number', default: 14,  min: 5,  max: 50 },
      exitMode:     { label: 'Exit mode',     type: 'select', options: ['ATR', 'Percent'], default: 'ATR' },
      slATR:        { label: 'Stop × ATR',    type: 'number', default: 1.5, min: 0.3, max: 5, step: 0.1 },
      tpATR:        { label: 'Target × ATR',  type: 'number', default: 3.0, min: 0.5, max: 10, step: 0.1 },
      stopPct:      { label: 'Stop % (Percent mode)',   type: 'number', default: 1.0, min: 0.1, max: 20, step: 0.1 },
      targetPct:    { label: 'Target % (Percent mode)', type: 'number', default: 2.0, min: 0.1, max: 40, step: 0.1 },
    },

    // Shown on the chart during Watch Replay so you see what drives the signals.
    // (Engine supports ma/volume indicator types — there is no pivot-line type, so
    // the P level is reflected by the SL/TP/entry lines TradeSim already draws.)
    chartIndicators(p) {
      p = p || {};
      const maType = (p.maType === 'WMA') ? 'EMA' : (p.maType || 'EMA'); // engine MA has no WMA; show EMA
      return [
        { type: 'ma',     visible: p.useTrend !== 'Off', params: { period: p.maLen || 50, maType, color: '#f59e0b', lineWidth: 1 } },
        { type: 'volume', visible: p.useVol !== 'Off', params: {} },
      ];
    },

    // Stepped pivot-P series for the overlay (previous completed period's (H+L+C)/3,
    // fixed across the current period — the line whose cross fires the trade).
    overlaySeries(candles, params) {
      const tf = (params && params.pivotTimeframe) || 'Daily';
      const src = srcView(candles, params && params.useHA === 'On');
      const prev = prevPeriodSeries(candles, tf, src);
      const pivot = candles.map((c, i) => ({ time: c.time, value: prev[i] ? (prev[i].hi + prev[i].lo + prev[i].close) / 3 : null }));
      return { pivot };
    },

    init(params) {
      this.p = params;
      this.prevSrcC = null;        // previous bar's source close  (for the cross)
      this.prevP = null;           // previous bar's pivot P
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
      const srcC = src.C(n - 1);

      // ── pivot P for the current period (previous completed period's H/L/C) ──
      const psrc = pivotSource(candles, P_.pivotTimeframe, src);
      const P = psrc ? (psrc.high + psrc.low + psrc.close) / 3 : null;

      // cross is measured against the previous source close / pivot; remember them
      const prevC = this.prevSrcC, prevP = this.prevP;
      if (P != null) { this.prevSrcC = srcC; this.prevP = P; }

      // ── only act when flat (the Pine gates entries on a flat position) ──
      if (account.position) { this.reason = `holding ${account.position}`; return null; }
      if (P == null) { this.reason = 'no prior pivot period yet'; return null; }
      if (prevC == null || prevP == null) { this.reason = 'priming cross'; return null; }

      // ── cross detection ──
      const crossUp = prevC <= prevP && srcC > P;
      const crossDn = prevC >= prevP && srcC < P;
      if (!crossUp && !crossDn) { this.reason = `no cross · close ${srcC.toFixed(2)} vs P ${P.toFixed(2)}`; return null; }

      // Volume filter
      let volOK = true;
      if (P_.useVol === 'On') {
        const vols = candles.map((x) => x.volume);
        const va = indicators.sma(vols, P_.volLen);
        const avg = va[va.length - 1];
        volOK = avg != null && candle.volume >= P_.volMult * avg;
      }
      if (!volOK) { this.reason = 'volume below filter'; return null; }

      // Trend filter
      let trendUp = true, trendDn = true;
      if (P_.useTrend === 'On') {
        const cArr = useHA ? ha.c.slice(0, n) : indicators.closes;
        let m;
        if (P_.maType === 'SMA') { const a = indicators.sma(cArr, P_.maLen); m = a[a.length - 1]; }
        else if (P_.maType === 'WMA') { m = wmaLast(cArr, P_.maLen); }
        else { const a = indicators.ema(cArr, P_.maLen); m = a[a.length - 1]; }
        if (m == null) { this.reason = 'MA warming up'; return null; }
        trendUp = srcC > m; trendDn = srcC < m;
      }

      const longOK = P_.direction !== 'Short only';
      const shortOK = P_.direction !== 'Long only';

      if (crossUp && trendUp && longOK) return this._enter('long', srcC, src, n);
      if (crossDn && trendDn && shortOK) return this._enter('short', srcC, src, n);

      this.reason = crossUp ? 'cross up blocked by trend/direction' : 'cross down blocked by trend/direction';
      return null;
    },

    // Build the entry + stop/target bracket; the engine fills at close then watches
    // later candles' high/low for the stop or target touch.
    _enter(dir, srcC, src, n) {
      const P_ = this.p;
      let stop, target;
      if (P_.exitMode === 'ATR') {
        const A = atrFromSrc(n, P_.atrLen, src);
        if (A == null || !(A > 0)) { this.reason = 'ATR not ready — skip'; return null; }
        stop   = dir === 'long' ? srcC - P_.slATR * A : srcC + P_.slATR * A;
        target = dir === 'long' ? srcC + P_.tpATR * A : srcC - P_.tpATR * A;
      } else {
        stop   = dir === 'long' ? srcC * (1 - P_.stopPct / 100)   : srcC * (1 + P_.stopPct / 100);
        target = dir === 'long' ? srcC * (1 + P_.targetPct / 100) : srcC * (1 - P_.targetPct / 100);
      }
      this.reason = `${dir === 'long' ? 'Bullish' : 'Bearish'} pivot cross @ ${srcC.toFixed(2)} → ` +
        `stop ${stop.toFixed(2)} / target ${target.toFixed(2)}`;
      return { signal: dir, stopLoss: stop, takeProfit: target };
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.pivotcross = Strategy;
})();
