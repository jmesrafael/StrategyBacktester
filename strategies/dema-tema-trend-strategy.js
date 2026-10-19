// dema-tema-trend-strategy.js — "DEMA/TEMA Trend Cross".
//
// Built from a Double/Triple Exponential Moving Average tutorial. DEMA/TEMA allocate
// more weight to recent data than a plain EMA, so they hug price with less lag — good
// for spotting reversals faster, at the cost of more whipsaws in chop. This strategy
// turns the video's three methods into one system:
//   1. Trend analysis     — only go with the slow line's direction (price above a rising
//                           line = up; below a falling line = down; flat line = stand aside).
//   2. Entry trigger      — a FAST DEMA/TEMA crossing a SLOW one (the classic 10/50 cross).
//   3. Volume + slope     — crosses on light volume / a flat line tend to fail, so we
//                           require above-average volume and a confirming slope.
// Reduced lag is also exploited on the way OUT: an ATR trailing stop rides winners and
// exits fast when price reverses.
//
// Engine contract (see README + js/strategy.js): export one Strategy object, register
// it on window.__STRATEGIES[id]. onCandle returns { signal, stopLoss, takeProfit } on
// entry and may return an updated { stopLoss } on a later bar (trailing/breakeven).
// indicators = { ema(cl,p), sma(cl,p), rsi(cl,p), closes[], candles[] }. Sizing/fees
// come from Trade Sim. (Markers: 🟢 long, 🔴 short, 🔵 close.)
(function () {
  // Null-free EMA over `values`. Seeds at the first full window with that window's SMA,
  // then carries the recursive EMA forward AND back-fills the seed window with the same
  // first value so the output has no leading nulls — that lets us chain EMA-of-EMA
  // (the engine's ema() returns leading nulls, which can't be re-fed into ema()).
  function emaFull(values, period) {
    const n = values.length;
    const out = new Array(n);
    if (n === 0) return out;
    const k = 2 / (period + 1);
    const p = Math.min(period, n);
    let sum = 0;
    for (let i = 0; i < p; i++) sum += values[i];
    let prev = sum / p;                       // seed = SMA of the first window
    for (let i = 0; i < p; i++) out[i] = prev; // back-fill so there are no nulls
    for (let i = p; i < n; i++) { prev = values[i] * k + prev * (1 - k); out[i] = prev; }
    return out;
  }

  // DEMA = 2·EMA − EMA(EMA). Full-length, null-free.
  function demaSeries(values, period) {
    const e1 = emaFull(values, period);
    const e2 = emaFull(e1, period);
    const out = new Array(values.length);
    for (let i = 0; i < out.length; i++) out[i] = 2 * e1[i] - e2[i];
    return out;
  }

  // TEMA = 3·EMA − 3·EMA(EMA) + EMA(EMA(EMA)). Full-length, null-free.
  function temaSeries(values, period) {
    const e1 = emaFull(values, period);
    const e2 = emaFull(e1, period);
    const e3 = emaFull(e2, period);
    const out = new Array(values.length);
    for (let i = 0; i < out.length; i++) out[i] = 3 * e1[i] - 3 * e2[i] + e3[i];
    return out;
  }

  // DEMA or TEMA depending on method.
  function maSeries(values, period, method) {
    return method === 'DEMA' ? demaSeries(values, period) : temaSeries(values, period);
  }

  // Wilder ATR over the candle slice (real OHLC). Returns last value or null.
  function atrLast(candles, period) {
    const n = candles.length;
    if (n < period + 1) return null;
    const tr = (k) => Math.max(
      candles[k].high - candles[k].low,
      Math.abs(candles[k].high - candles[k - 1].close),
      Math.abs(candles[k].low - candles[k - 1].close)
    );
    let sum = 0;
    for (let k = 1; k <= period; k++) sum += tr(k);
    let a = sum / period;
    for (let k = period + 1; k < n; k++) a = (a * (period - 1) + tr(k)) / period;
    return a;
  }

  const Strategy = {
    name: 'DEMA/TEMA Trend Cross',
    description: 'Double/Triple EMA trend system. LONG when the fast DEMA/TEMA crosses ABOVE the slow ' +
      'one, SHORT on a cross below — gated by trend (price the right side of the slow line), the slow ' +
      'line\'s slope, above-average volume, direction and a post-exit cooldown. Because DEMA/TEMA lag ' +
      'less than a plain EMA, an ATR trailing stop rides winners and exits quickly on a reversal. ' +
      'Optional fixed ATR target and breakeven stop. Markers: 🟢 long, 🔴 short, 🔵 close.',
    warmUpBars: 80,
    overlay: true,   // draw the green profit / red risk boxes + entry/exit marks during replay

    params: {
      maMethod:   { label: 'MA method',    type: 'select', options: ['TEMA', 'DEMA'], default: 'TEMA' },
      fastLen:    { label: 'Fast length',  type: 'number', default: 10, min: 3,  max: 100 },
      slowLen:    { label: 'Slow length',  type: 'number', default: 50, min: 10, max: 400 },
      useTrend:   { label: 'Trend filter (price vs slow)', type: 'select', options: ['On', 'Off'], default: 'On' },
      useSlope:   { label: 'Slope filter', type: 'select', options: ['On', 'Off'], default: 'On' },
      slopeLookback: { label: 'Slope lookback (bars)', type: 'number', default: 3, min: 1, max: 20 },
      useVol:     { label: 'Volume filter', type: 'select', options: ['On', 'Off'], default: 'On' },
      volLen:     { label: 'Volume MA length', type: 'number', default: 20, min: 5, max: 50 },
      volMult:    { label: 'Volume × avg',  type: 'number', default: 1.2, min: 0.5, max: 3, step: 0.1 },
      direction:  { label: 'Direction',     type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
      atrLen:     { label: 'ATR length',    type: 'number', default: 14, min: 5, max: 50 },
      slATR:      { label: 'Stop × ATR',    type: 'number', default: 1.5, min: 0.3, max: 5,  step: 0.1 },
      tpATR:      { label: 'Target × ATR',  type: 'number', default: 3.0, min: 0.5, max: 10, step: 0.1 },
      exitStyle:  { label: 'Exit style',    type: 'select', options: ['Trailing only', 'Trailing + target', 'Fixed bracket'], default: 'Trailing only' },
      trailActivateATR: { label: 'Trail activates after × ATR', type: 'number', default: 1.5, min: 0.1, max: 10, step: 0.1 },
      trailATR:   { label: 'Trail distance × ATR', type: 'number', default: 2.5, min: 0.3, max: 10, step: 0.1 },
      useBE:      { label: 'Breakeven stop', type: 'select', options: ['Off', 'On'], default: 'Off' },
      beR:        { label: 'Move to BE at R', type: 'number', default: 1.0, min: 0.3, max: 3, step: 0.1 },
      cooldown:   { label: 'Cooldown bars after exit', type: 'number', default: 2, min: 0, max: 20 },
    },

    // Shown during Watch Replay. The chart has no native DEMA/TEMA type, so the fast/slow
    // lines are drawn as EMAs of the same length (close visual proxy; same display fallback
    // pivot-cross-improved uses for WMA→EMA). Volume pane shows the volume filter.
    chartIndicators(p) {
      p = p || {};
      return [
        { type: 'ma',     visible: true, params: { period: p.fastLen || 10, maType: 'EMA', color: '#22c55e', lineWidth: 1 } },
        { type: 'ma',     visible: true, params: { period: p.slowLen || 50, maType: 'EMA', color: '#f59e0b', lineWidth: 1 } },
        { type: 'volume', visible: p.useVol !== 'Off', params: {} },
      ];
    },

    init(params) {
      this.p = params;
      this.prevFastAbove = null;   // fast-vs-slow last bar (for cross detection)
      this.prevPosition = null;    // account.position last bar (to detect an exit)
      this.barsSinceExit = 999;    // cooldown counter
      // open-trade tracking (breakeven + trailing)
      this.tradeEntry = null; this.tradeStop = null; this.tradeTgt = null;
      this.tradeRisk = null; this.curStop = null; this.peak = null;
      this.reason = '';
    },

    onCandle(candle, indicators, account) {
      const P_ = this.p;
      const closes = indicators.closes;
      const candles = indicators.candles;
      const n = closes.length;
      // Need enough bars for the slow TEMA (3 chained EMAs) + ATR + slope.
      const need = Math.max(P_.slowLen * 3, P_.atrLen + 2, P_.slopeLookback + 1) + 2;
      if (n < need) { this.reason = 'warming up'; return null; }

      // ── DEMA/TEMA fast & slow lines ──
      const fastArr = maSeries(closes, P_.fastLen, P_.maMethod);
      const slowArr = maSeries(closes, P_.slowLen, P_.maMethod);
      const fast = fastArr[n - 1], slow = slowArr[n - 1];
      const fastAbove = fast > slow;
      const prevFastAbove = this.prevFastAbove;
      this.prevFastAbove = fastAbove;

      const close = candle.close;

      // ── cooldown bookkeeping (every bar) ──
      const flatNow = !account.position;
      if (this.prevPosition && flatNow) this.barsSinceExit = 0;   // just exited
      else if (flatNow) this.barsSinceExit += 1;
      this.prevPosition = account.position;

      // ── manage an OPEN position: breakeven + ATR trailing (both only TIGHTEN) ──
      if (account.position) {
        const isLong = account.position === 'long';
        const entry = this.tradeEntry != null ? this.tradeEntry : account.entryPrice;

        // extend the favourable extreme since entry (peak high for longs, low for shorts)
        if (this.peak == null) this.peak = isLong ? candle.high : candle.low;
        else this.peak = isLong ? Math.max(this.peak, candle.high) : Math.min(this.peak, candle.low);

        if (this.curStop != null) {
          let newStop = this.curStop;

          // breakeven: once price has moved beR×risk in favour, lift the stop to entry
          if (P_.useBE === 'On' && this.tradeRisk != null && this.tradeRisk > 0) {
            const moved = isLong ? (candle.high - entry) : (entry - candle.low);
            if (moved >= P_.beR * this.tradeRisk) {
              newStop = isLong ? Math.max(newStop, entry) : Math.min(newStop, entry);
            }
          }

          // trailing: ratchet an ATR distance behind the peak, after an activation move
          if (P_.exitStyle !== 'Fixed bracket') {
            const A = atrLast(candles, P_.atrLen);
            if (A != null && A > 0) {
              const moved = isLong ? (this.peak - entry) : (entry - this.peak);
              if (moved >= P_.trailActivateATR * A) {
                const cand = isLong ? this.peak - P_.trailATR * A : this.peak + P_.trailATR * A;
                newStop = isLong ? Math.max(newStop, cand) : Math.min(newStop, cand);
              }
            }
          }

          if (newStop !== this.curStop) {
            this.curStop = newStop; this.tradeStop = newStop;
            this.reason = `trail → stop ${newStop.toFixed(2)} (peak ${this.peak.toFixed(2)})`;
            return { stopLoss: newStop, takeProfit: this.tradeTgt };
          }
        }
        this.reason = `holding ${account.position}` + (this.curStop != null ? ` · stop ${this.curStop.toFixed(2)}` : '');
        return null;
      }

      // ── flat: clear per-trade tracking ──
      this.tradeEntry = null; this.tradeStop = null; this.tradeTgt = null;
      this.tradeRisk = null; this.curStop = null; this.peak = null;

      if (prevFastAbove == null) { this.reason = 'priming cross'; return null; }
      if (this.barsSinceExit < P_.cooldown) { this.reason = `cooldown ${this.barsSinceExit}/${P_.cooldown}`; return null; }

      // ── cross detection (fast through slow) ──
      const crossUp = prevFastAbove === false && fastAbove;
      const crossDn = prevFastAbove === true && !fastAbove;
      if (!crossUp && !crossDn) {
        this.reason = `no cross · fast ${fast.toFixed(2)} ${fastAbove ? '>' : '<'} slow ${slow.toFixed(2)}`;
        return null;
      }

      // ── trend filter: price the right side of the slow line ──
      if (P_.useTrend === 'On') {
        if (crossUp && !(close > slow)) { this.reason = 'cross up below slow line'; return null; }
        if (crossDn && !(close < slow)) { this.reason = 'cross down above slow line'; return null; }
      }

      // ── slope filter: slow line angled the trade's way ──
      if (P_.useSlope === 'On') {
        const slowPrev = slowArr[n - 1 - P_.slopeLookback];
        if (slowPrev == null) { this.reason = 'slope warming up'; return null; }
        if (crossUp && !(slow > slowPrev)) { this.reason = 'slow line not rising'; return null; }
        if (crossDn && !(slow < slowPrev)) { this.reason = 'slow line not falling'; return null; }
      }

      // ── volume filter: above-average volume ──
      if (P_.useVol === 'On') {
        const vols = candles.map((x) => x.volume);
        const va = indicators.sma(vols, P_.volLen);
        const avg = va[va.length - 1];
        if (!(avg != null && candle.volume >= P_.volMult * avg)) {
          this.reason = 'volume below filter';
          return null;
        }
      }

      // ── direction filter ──
      const longOK = P_.direction !== 'Short only';
      const shortOK = P_.direction !== 'Long only';
      if (crossUp && longOK) return this._enter('long', close, candles, n);
      if (crossDn && shortOK) return this._enter('short', close, candles, n);

      this.reason = crossUp ? 'cross up blocked by direction' : 'cross down blocked by direction';
      return null;
    },

    // Build the entry + ATR stop/target bracket and remember it for trailing/breakeven.
    _enter(dir, close, candles, n) {
      const P_ = this.p;
      const A = atrLast(candles, P_.atrLen);
      if (A == null || !(A > 0)) { this.reason = 'ATR not ready — skip'; return null; }
      const isLong = dir === 'long';
      const stop = isLong ? close - P_.slATR * A : close + P_.slATR * A;
      let target = isLong ? close + P_.tpATR * A : close - P_.tpATR * A;
      // "Trailing only" drops the fixed target so winners run until the trailing stop hits.
      if (P_.exitStyle === 'Trailing only') target = null;

      this.tradeEntry = close; this.tradeStop = stop; this.tradeTgt = target;
      this.tradeRisk = Math.abs(close - stop); this.curStop = stop;
      this.peak = close;  // seed favourable extreme; extends on later bars

      this.reason = `${isLong ? 'Bullish' : 'Bearish'} ${P_.maMethod} ${P_.fastLen}/${P_.slowLen} cross @ ` +
        `${close.toFixed(2)} → stop ${stop.toFixed(2)}` + (target != null ? ` / target ${target.toFixed(2)}` : ' / trailing only');
      return { signal: dir, stopLoss: stop, takeProfit: target };
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.dematematrend = Strategy;
})();
