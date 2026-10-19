// macd-money-map-strategy.js — "MACD Money Map — Trend System" (Tier A).
//
// Strategy file contract (see README + js/strategy.js): export one Strategy object,
// register it on window.__STRATEGIES[id]. The engine calls init(params) once, then
// onCandle(candle, indicators, account) for each revealed (closed) candle.
//
//   candle:     { time, open, high, low, close, volume }
//   indicators: { ema(closes,p), sma(closes,p), rsi(closes,p), closes[], candles[] }
//   account:    { position:'long'|'short'|null, entryPrice, balance }
//   return:     'long' | 'short' | 'close' | null   OR   { signal, stopLoss, takeProfit }
//
// SOURCE METHOD — the MACD "Money Map" frames MACD as three systems. This file is
// the fully-mechanizable subset: TIER A — the TREND SYSTEM.
//   • Zero line is a directional filter:  macd > 0 → longs only,  macd < 0 → shorts only.
//   • Act only on macd/signal crossovers that occur FAR FROM ZERO (the teaching says
//     "above +0.5 / below −0.5 on most charts"); crossovers near zero are "chop".
//   • Wait a few bars after the cross before entering (confirmDelay).
//
// SCALE FIX (stated choice): a literal "+0.5 / −0.5" in raw price units is meaningless
// across instruments and price levels. We NORMALIZE the MACD line by its own rolling
// standard deviation over `stdLen` bars:  normMacd = macd / rollingStd(macd, stdLen).
// `threshold` is therefore expressed in STD UNITS (default 0.5σ), instrument-agnostic.
//
// TRADE MANAGEMENT (single, fully-specified version for R-multiples + the tester report):
//   • Stop  = recent swing low (long) / swing high (short) over `swingLookback` bars = 1R.
//   • Target = entry ± 2R. The engine auto-closes on SL/TP touch; sizing/fees come from
//     Trade Sim, so the strategy-tester report shows figures NET of commission + slippage.
//
// NO LOOKAHEAD: onCandle only ever sees history up to the current closed bar. The cross
// is detected on closed bars and the entry is realized `confirmDelay` bars LATER, filled
// at that bar's close (the engine's convention). Nothing reads beyond the current candle.
//
// EXCLUDED (so results bound the systematic version, not a discretionary trader's): the
// "gift from the market", eyeballed support/resistance, candle-pattern discretion, the
// divergence/Reversal system, the multi-timeframe Confirmation system, and the
// discretionary partial-scale-out + breakeven + trailing exit (each adds hidden degrees
// of freedom). Those belong to Tier B, tested separately. Markers: 🟢 long, 🔴 short, 🔵 close.
(function () {
  // EMA over a numeric array, SMA-seeded — identical math to js/indicators.js so the
  // chartIndicators EMA lines and the MACD here agree. Leading nulls until index p−1.
  function emaArr(values, period) {
    const out = new Array(values.length).fill(null);
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) continue;
      if (prev === null) {
        let s = 0;
        for (let j = i - period + 1; j <= i; j++) s += values[j];
        prev = s / period;
      } else {
        prev = values[i] * k + prev * (1 - k);
      }
      out[i] = prev;
    }
    return out;
  }

  // MACD line / signal / histogram as full-length arrays (null where not yet computable).
  // signal = EMA of the macd line; computed over the non-null tail then realigned.
  function macdArrays(closes, fast, slow, sig) {
    const fastE = emaArr(closes, fast);
    const slowE = emaArr(closes, slow);
    const macd = closes.map((_, i) => (fastE[i] != null && slowE[i] != null) ? fastE[i] - slowE[i] : null);
    const signal = new Array(closes.length).fill(null);
    let firstValid = -1;
    for (let i = 0; i < macd.length; i++) { if (macd[i] != null) { firstValid = i; break; } }
    if (firstValid !== -1) {
      const compact = macd.slice(firstValid);
      const sigC = emaArr(compact, sig);
      for (let j = 0; j < sigC.length; j++) if (sigC[j] != null) signal[firstValid + j] = sigC[j];
    }
    const hist = closes.map((_, i) => (macd[i] != null && signal[i] != null) ? macd[i] - signal[i] : null);
    return { macd, signal, hist };
  }

  // Population std of the last `len` non-null values of an array (the rolling MACD scale).
  function rollingStdLast(arr, len) {
    const vals = [];
    for (let i = arr.length - 1; i >= 0 && vals.length < len; i--) if (arr[i] != null) vals.push(arr[i]);
    if (vals.length < 2) return null;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const v = vals.reduce((a, b) => a + (b - m) * (b - m), 0) / vals.length;
    return Math.sqrt(v);
  }

  // Recent swing extremes over the last `lookback` closed bars (1R reference, no leak).
  function swingLow(candles, lookback) {
    let lo = Infinity;
    for (let i = Math.max(0, candles.length - lookback); i < candles.length; i++) lo = Math.min(lo, candles[i].low);
    return lo;
  }
  function swingHigh(candles, lookback) {
    let hi = -Infinity;
    for (let i = Math.max(0, candles.length - lookback); i < candles.length; i++) hi = Math.max(hi, candles[i].high);
    return hi;
  }

  const Strategy = {
    name: 'MACD Money Map — Trend System',
    description: 'Tier A of the MACD "Money Map" method. The zero line is a directional filter ' +
      '(MACD > 0 → longs only, MACD < 0 → shorts only); the strategy acts ONLY on macd/signal ' +
      'crossovers that occur far from zero — measured as a multiple of the MACD line\'s own rolling ' +
      'standard deviation (threshold in σ units, so it is instrument-agnostic, replacing the source\'s ' +
      'literal ±0.5). After a qualifying cross it waits `confirmDelay` bars, then enters at the close. ' +
      'Stop = recent swing low/high (1R); target = 2R; the engine auto-closes on touch and Trade Sim ' +
      'books commission + slippage, so the tester report is net of costs. No lookahead: the cross is ' +
      'read on closed bars and realized a few bars later. Excludes the discretionary divergence, ' +
      'multi-timeframe and trailing/scale-out pieces (Tier B). Markers: 🟢 long, 🔴 short, 🔵 close.',
    warmUpBars: 60,

    // Per-trade picture during Watch Replay: green/red risk boxes + entry/exit triangles
    // are drawn automatically from the returned stopLoss/takeProfit (js/strategy-overlay.js).
    overlay: true,

    params: {
      fastLen:       { label: 'Fast EMA (MACD)',        type: 'number', default: 12, min: 2,  max: 100 },
      slowLen:       { label: 'Slow EMA (MACD)',        type: 'number', default: 26, min: 3,  max: 200 },
      signalLen:     { label: 'Signal EMA',             type: 'number', default: 9,  min: 2,  max: 100 },
      threshold:     { label: 'Far-from-zero (σ)',      type: 'number', default: 0.5, min: 0, max: 4, step: 0.1 },
      confirmDelay:  { label: 'Confirm delay (bars)',   type: 'number', default: 2,  min: 0,  max: 5 },
      stdLen:        { label: 'MACD σ window (bars)',   type: 'number', default: 100, min: 20, max: 400 },
      swingLookback: { label: 'Swing lookback (1R, bars)', type: 'number', default: 10, min: 3, max: 60 },
      direction:     { label: 'Direction', type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
    },

    // Shown during Watch Replay: the actual MACD oscillator in its own sub-pane (line,
    // signal, histogram, zero line) PLUS the two EMAs that form the MACD line overlaid
    // on price, so the crossovers the strategy acts on are visible directly.
    chartIndicators(p) {
      p = p || {};
      return [
        { type: 'ma',   visible: true, params: { period: p.fastLen, maType: 'EMA', color: '#22c55e', lineWidth: 1 } },
        { type: 'ma',   visible: true, params: { period: p.slowLen, maType: 'EMA', color: '#f59e0b', lineWidth: 1 } },
        { type: 'macd', visible: true, params: { fast: p.fastLen, slow: p.slowLen, signal: p.signalLen,
            macdColor: '#22c55e', signalColor: '#f59e0b', lineWidth: 1 } },
      ];
    },

    init(params) {
      this.fast = params.fastLen;
      this.slow = params.slowLen;
      this.sig = params.signalLen;
      this.threshold = params.threshold;
      this.confirmDelay = params.confirmDelay;
      this.stdLen = params.stdLen;
      this.swingLookback = params.swingLookback;
      this.direction = params.direction;
      this.armDir = null;      // 'long' | 'short' | null — a cross awaiting its confirm delay
      this.armN = 0;           // bar count (closes.length) when the setup was armed
      this.armDetail = '';
      this.reason = '';
    },

    onCandle(candle, indicators, account) {
      const closes = indicators.closes;
      const candles = indicators.candles;
      const n = closes.length;
      if (n < this.slow + this.sig + this.stdLen) { this.reason = 'warming up'; return null; }

      const { macd, signal } = macdArrays(closes, this.fast, this.slow, this.sig);
      const m = macd[n - 1], s = signal[n - 1], mPrev = macd[n - 2], sPrev = signal[n - 2];
      if (m == null || s == null || mPrev == null || sPrev == null) return null;

      const std = rollingStdLast(macd, this.stdLen);
      if (std == null || std === 0) return null;
      const norm = m / std; // MACD line distance from zero, in σ units

      // --- ARM on a qualifying crossover far from zero -------------------------
      const crossUp = mPrev <= sPrev && m > s;
      const crossDown = mPrev >= sPrev && m < s;
      if (crossUp && m > 0 && norm > this.threshold) {
        this.armDir = 'long'; this.armN = n;
        this.armDetail = `MACD↑signal, +${norm.toFixed(2)}σ`;
      } else if (crossDown && m < 0 && norm < -this.threshold) {
        this.armDir = 'short'; this.armN = n;
        this.armDetail = `MACD↓signal, ${norm.toFixed(2)}σ`;
      }

      // cancel a stale arm if the zero-line bias breaks before the entry fires
      if (this.armDir === 'long' && m <= 0) this.armDir = null;
      else if (this.armDir === 'short' && m >= 0) this.armDir = null;

      // --- FIRE after confirmDelay bars ---------------------------------------
      if (this.armDir) {
        const waited = n - this.armN;
        if (waited < this.confirmDelay) {
          this.reason = `armed ${this.armDir} (${waited}/${this.confirmDelay}) · ${norm.toFixed(2)}σ`;
          return null;
        }
        const dir = this.armDir;
        const detail = this.armDetail;
        this.armDir = null;

        // direction filter (block the opposite side; do not flip an open trade against it)
        if (dir === 'long' && this.direction === 'Short only') { this.reason = 'long blocked (Short only)'; return null; }
        if (dir === 'short' && this.direction === 'Long only') { this.reason = 'short blocked (Long only)'; return null; }
        if (account.position === dir) { this.reason = `already ${dir}`; return null; }

        const entry = candle.close;
        let stop, target, risk;
        if (dir === 'long') {
          stop = swingLow(candles, this.swingLookback);
          risk = entry - stop;
          if (!(risk > 0)) { this.reason = 'invalid stop (swing low ≥ entry)'; return null; }
          target = entry + 2 * risk;
        } else {
          stop = swingHigh(candles, this.swingLookback);
          risk = stop - entry;
          if (!(risk > 0)) { this.reason = 'invalid stop (swing high ≤ entry)'; return null; }
          target = entry - 2 * risk;
        }
        this.reason = `${dir.toUpperCase()} — ${detail}; 1R=${risk.toFixed(2)}, target 2R`;
        return { signal: dir, stopLoss: stop, takeProfit: target };
      }

      this.reason = `flat · MACD ${m > 0 ? '>0' : '<0'} ${norm.toFixed(2)}σ (need ±${this.threshold}σ)`;
      return null;
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.macdmoneymap = Strategy;
})();
