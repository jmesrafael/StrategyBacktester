// ema-rsi-divergence-strategy.js — EMA crossover trend filter + RSI divergence trigger.
//
// Strategy file contract (see README): export a single Strategy object and register
// it on window.__STRATEGIES[id]. The engine calls init(params) once per run, then
// onCandle(candle, indicators, account) for each revealed candle.
//
//   candle:     { time, open, high, low, close, volume }
//   indicators: { ema(closes,p), sma(closes,p), rsi(closes,p), closes[], candles[] }
//   account:    { position:'long'|'short'|null, entryPrice, balance }
//   return:     'long' | 'short' | 'close' | null
//
// Idea: a divergence between price and RSI signals exhaustion of the current move;
// the EMA cross then CONFIRMS the reversal has begun. The divergence ARMS a setup,
// the EMA cross TRIGGERS the trade (this is what "EMA cross paired with RSI
// divergence" means — divergences form at bottoms/tops where the EMAs haven't
// crossed yet, so requiring both at the same instant would never fire).
//   • Bullish divergence = price LOWER low while RSI HIGHER low, RSI in the OVERSOLD
//                          zone → arms a LONG. Fires when fastEMA crosses ABOVE slowEMA.
//   • Bearish divergence = price HIGHER high while RSI LOWER high, RSI in the OVERBOUGHT
//                          zone → arms a SHORT. Fires when fastEMA crosses BELOW slowEMA.
// An armed setup expires after `divergenceLookback` bars if no cross confirms it.
// The engine reverses automatically: a 'long' while short closes the short first.
(function () {
  // Detect confirmed swing pivots within a window. A pivot needs `k` bars on each
  // side, so the most recent confirmable pivot is k bars back from the current edge.
  function pivotLows(candles, rsiArr, k, from, to) {
    const out = [];
    for (let j = from + k; j <= to - k; j++) {
      const lo = candles[j].low;
      let ok = rsiArr[j] != null;
      for (let m = j - k; ok && m <= j + k; m++) { if (m !== j && candles[m].low < lo) ok = false; }
      if (ok) out.push({ idx: j, price: lo, rsi: rsiArr[j] });
    }
    return out;
  }
  function pivotHighs(candles, rsiArr, k, from, to) {
    const out = [];
    for (let j = from + k; j <= to - k; j++) {
      const hi = candles[j].high;
      let ok = rsiArr[j] != null;
      for (let m = j - k; ok && m <= j + k; m++) { if (m !== j && candles[m].high > hi) ok = false; }
      if (ok) out.push({ idx: j, price: hi, rsi: rsiArr[j] });
    }
    return out;
  }

  const Strategy = {
    name: 'EMA + RSI Divergence',
    description: 'Opens LONG on a bullish RSI divergence (price lower-low while RSI higher-low, in the ' +
      'oversold zone) confirmed by fast EMA ≥ slow EMA; opens SHORT on a bearish RSI divergence ' +
      '(price higher-high while RSI lower-high, in the overbought zone) confirmed by fast EMA ≤ slow ' +
      'EMA. Markers: 🟢 long entry, 🔴 short entry, 🔵 close.',
    warmUpBars: 60,

    params: {
      fastEMA:            { label: 'Fast EMA',        type: 'number', default: 9,  min: 2,  max: 200 },
      slowEMA:            { label: 'Slow EMA',        type: 'number', default: 21, min: 3,  max: 400 },
      rsiPeriod:          { label: 'RSI period',      type: 'number', default: 14, min: 2,  max: 100 },
      oversold:           { label: 'Oversold <',      type: 'number', default: 30, min: 1,  max: 49 },
      overbought:         { label: 'Overbought >',    type: 'number', default: 70, min: 51, max: 99 },
      divergenceLookback: { label: 'Divergence lookback (bars)', type: 'number', default: 20, min: 6, max: 80 },
      pivotStrength:      { label: 'Pivot strength',  type: 'number', default: 2,  min: 1,  max: 5 },
      direction:          { label: 'Direction', type: 'select',
                            options: ['Both', 'Long only', 'Short only'], default: 'Both' },
    },

    // Indicators this strategy reads — shown on the chart during Watch Replay so
    // you see exactly what drives the signals (fast/slow EMA + RSI with its bands).
    // Consumed by IndicatorManager.restoreSet (see js/strategy.js onEnterReplay).
    chartIndicators(p) {
      p = p || {};
      return [
        { type: 'ma',  visible: true, params: { period: p.fastEMA, maType: 'EMA', color: '#22c55e', lineWidth: 1 } },
        { type: 'ma',  visible: true, params: { period: p.slowEMA, maType: 'EMA', color: '#f59e0b', lineWidth: 1 } },
        { type: 'rsi', visible: true, params: { period: p.rsiPeriod, color: '#7e57c2', lineWidth: 1,
                                                overbought: p.overbought, oversold: p.oversold } },
      ];
    },

    init(params) {
      this.fast = params.fastEMA;
      this.slow = params.slowEMA;
      this.rsiP = params.rsiPeriod;
      this.oversold = params.oversold;
      this.overbought = params.overbought;
      this.lookback = params.divergenceLookback;
      this.k = params.pivotStrength;
      this.direction = params.direction;
      this.prevFastAbove = null;   // for EMA cross detection
      this.lastBullIdx = -1;       // pivot idx that last armed a long (dedupe)
      this.lastBearIdx = -1;       // pivot idx that last armed a short (dedupe)
      this.armLong = null;         // expiry bar index for an armed long setup (or null)
      this.armShort = null;        // expiry bar index for an armed short setup (or null)
      this.armLongDetail = '';
      this.armShortDetail = '';
      this.reason = '';
    },

    onCandle(candle, indicators, account) {
      const closes = indicators.closes;
      const candles = indicators.candles;
      const n = closes.length;
      if (n < this.slow + this.k + 2) return null;

      // --- fast vs slow EMA (cross is the trigger) --------------------------
      const fe = indicators.ema(closes, this.fast);
      const se = indicators.ema(closes, this.slow);
      const f = fe[fe.length - 1], s = se[se.length - 1];
      if (f == null || s == null) return null;
      const fastAbove = f > s;

      // --- RSI + divergence over the recent window: ARM a setup ------------
      const rsiArr = indicators.rsi(closes, this.rsiP);
      const to = n - 1;
      const from = Math.max(0, to - this.lookback);

      const lows = pivotLows(candles, rsiArr, this.k, from, to);
      if (lows.length >= 2) {
        const p1 = lows[lows.length - 2], p2 = lows[lows.length - 1]; // earlier, later
        if (p2.idx !== this.lastBullIdx && p2.price < p1.price && p2.rsi > p1.rsi &&
            Math.min(p1.rsi, p2.rsi) < this.oversold) {
          this.lastBullIdx = p2.idx;
          this.armLong = to + this.lookback; // expires after `lookback` more bars
          this.armLongDetail = `price LL, RSI HL ${p2.rsi.toFixed(0)}>${p1.rsi.toFixed(0)} (oversold)`;
        }
      }
      const highs = pivotHighs(candles, rsiArr, this.k, from, to);
      if (highs.length >= 2) {
        const p1 = highs[highs.length - 2], p2 = highs[highs.length - 1];
        if (p2.idx !== this.lastBearIdx && p2.price > p1.price && p2.rsi < p1.rsi &&
            Math.max(p1.rsi, p2.rsi) > this.overbought) {
          this.lastBearIdx = p2.idx;
          this.armShort = to + this.lookback;
          this.armShortDetail = `price HH, RSI LH ${p2.rsi.toFixed(0)}<${p1.rsi.toFixed(0)} (overbought)`;
        }
      }

      // expire stale armed setups
      if (this.armLong != null && to > this.armLong) this.armLong = null;
      if (this.armShort != null && to > this.armShort) this.armShort = null;

      // --- EMA cross TRIGGERS an armed setup -------------------------------
      let trigger = null, detail = '';
      if (this.prevFastAbove === false && fastAbove) {          // cross UP
        if (this.armLong != null) { trigger = 'long'; detail = this.armLongDetail; this.armLong = null; this.armShort = null; }
      } else if (this.prevFastAbove === true && !fastAbove) {   // cross DOWN
        if (this.armShort != null) { trigger = 'short'; detail = this.armShortDetail; this.armShort = null; this.armLong = null; }
      }
      this.prevFastAbove = fastAbove;

      // --- direction filter ------------------------------------------------
      let signal = null;
      if (trigger === 'long') signal = (this.direction === 'Short only') ? 'close' : 'long';
      else if (trigger === 'short') signal = (this.direction === 'Long only') ? 'close' : 'short';

      this.reason = signal
        ? `${trigger === 'long' ? 'Bullish' : 'Bearish'} divergence (${detail}) → EMA${this.fast}/${this.slow} cross ${trigger === 'long' ? 'up' : 'down'}`
        : `Waiting · armed L:${this.armLong != null ? 'yes' : 'no'} S:${this.armShort != null ? 'yes' : 'no'} · ` +
          `EMA${this.fast}${fastAbove ? '>' : '<'}EMA${this.slow} · RSI ${rsiArr[to] != null ? rsiArr[to].toFixed(0) : '-'}`;
      return signal;
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.emarsidiv = Strategy;
})();
