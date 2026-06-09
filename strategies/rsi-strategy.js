// rsi-strategy.js — RSI mean-reversion. Buy oversold dips, exit on overbought.
// See emacross-strategy.js / README for the Strategy file contract.
(function () {
  const Strategy = {
    name: 'RSI Reversal',
    description: 'Long when RSI crosses down through the oversold level; close when RSI ' +
      'crosses up through the overbought level.',
    warmUpBars: 30,

    params: {
      rsiPeriod:  { label: 'RSI Period', type: 'number', default: 14, min: 2, max: 100 },
      oversold:   { label: 'Oversold',   type: 'number', default: 30, min: 1, max: 50 },
      overbought: { label: 'Overbought', type: 'number', default: 70, min: 50, max: 99 },
    },

    init(params) {
      this.period = params.rsiPeriod;
      this.oversold = params.oversold;
      this.overbought = params.overbought;
      this.reason = '';
    },

    onCandle(candle, indicators, account) {
      const closes = indicators.closes;
      if (closes.length < this.period + 2) return null;
      const r = indicators.rsi(closes, this.period);
      const cur = r[r.length - 1], prev = r[r.length - 2];
      if (cur == null || prev == null) return null;

      let signal = null;
      if (prev >= this.oversold && cur < this.oversold) signal = 'long';
      else if (prev <= this.overbought && cur > this.overbought) signal = 'close';

      this.reason = `RSI ${cur.toFixed(1)} (prev ${prev.toFixed(1)})`;
      return signal;
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.rsi = Strategy;
})();
