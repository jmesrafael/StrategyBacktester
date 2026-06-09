// emacross-strategy.js — fast/slow EMA crossover.
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
// The engine reverses automatically: a 'long' while short closes the short first.
(function () {
  const Strategy = {
    name: 'EMA Crossover',
    description: 'Long when the fast EMA crosses above the slow EMA; close on the cross ' +
      'back down. In "Both" mode it also flips short on the down-cross and back long on ' +
      'the up-cross.',
    warmUpBars: 50,

    params: {
      fastPeriod: { label: 'Fast EMA', type: 'number', default: 9, min: 2, max: 200 },
      slowPeriod: { label: 'Slow EMA', type: 'number', default: 21, min: 3, max: 400 },
      direction:  { label: 'Direction', type: 'select',
                    options: ['Long only', 'Short only', 'Both'], default: 'Long only' },
    },

    init(params) {
      this.fast = params.fastPeriod;
      this.slow = params.slowPeriod;
      this.direction = params.direction;
      this.prevFastAbove = null;
      this.reason = '';
    },

    onCandle(candle, indicators, account) {
      const closes = indicators.closes;
      if (closes.length < this.slow) return null;
      const fe = indicators.ema(closes, this.fast);
      const se = indicators.ema(closes, this.slow);
      const f = fe[fe.length - 1], s = se[se.length - 1];
      if (f == null || s == null) return null;

      const fastAbove = f > s;
      let signal = null;
      if (this.prevFastAbove === false && fastAbove) {
        // cross up
        signal = this.direction === 'Short only' ? 'close' : 'long';
      } else if (this.prevFastAbove === true && !fastAbove) {
        // cross down
        signal = this.direction === 'Long only' ? 'close' : 'short';
      }
      this.prevFastAbove = fastAbove;
      this.reason = `EMA${this.fast} ${f.toFixed(2)} ${fastAbove ? 'above' : 'below'} ` +
        `EMA${this.slow} ${s.toFixed(2)}`;
      return signal;
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.emacross = Strategy;
})();
