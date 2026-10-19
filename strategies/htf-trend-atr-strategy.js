// htf-trend-atr-strategy.js — higher-timeframe trend + MACD trigger + ATR risk.
//
// Example of the full strategy toolkit (see README "Strategy contract"):
//   • indicators.htf(iv)  — higher-timeframe bars that have CLOSED by this bar
//   • indicators.adx / macd / atr — building-block indicators
//   • return object       — { signal, stopLoss, takeProfit, trailingStop, breakEvenAt }
// Position size comes from the panel (fixed % or "risk % per trade", which sizes the
// trade so that hitting the ATR stop loses exactly that % of balance).
//
// Rules
//   Trend   = HTF close above/below its EMA (e.g. trade 15m in the 4h direction)
//   Filter  = ADX ≥ threshold (only trade when the base timeframe is trending)
//   Trigger = MACD histogram crosses zero in the trend direction
//   Risk    = stop at entry ∓ stopATR × ATR, target at tpR × risk (R multiple),
//             optional ATR trailing stop, stop moves to entry once breakEvenR is reached
//   Exit    = also closes if the HTF trend flips against the position
(function () {
  const HTF = { '1h': '60', '4h': '240', '1D': 'D' };

  const Strategy = {
    name: 'HTF Trend + ATR Risk',
    description: 'Trades MACD-histogram zero-crosses only in the direction of the higher-timeframe ' +
      'EMA trend and when ADX shows a trending market. Stop = ATR multiple, target = R multiple, ' +
      'optional ATR trailing stop and break-even. Pair it with "Risk % per trade" sizing.',
    warmUpBars: 60,

    params: {
      htf:        { label: 'Trend timeframe', type: 'select', options: ['1h', '4h', '1D'], default: '4h' },
      htfEMA:     { label: 'Trend EMA (HTF)', type: 'number', default: 50, min: 5, max: 400 },
      adxMin:     { label: 'Min ADX',         type: 'number', default: 20, min: 0, max: 60 },
      atrPeriod:  { label: 'ATR period',      type: 'number', default: 14, min: 2, max: 100 },
      stopATR:    { label: 'Stop (× ATR)',    type: 'number', default: 1.5, min: 0.2, max: 10 },
      tpR:        { label: 'Target (R, 0=off)', type: 'number', default: 2, min: 0, max: 20 },
      trailATR:   { label: 'Trail (× ATR, 0=off)', type: 'number', default: 0, min: 0, max: 10 },
      breakEvenR: { label: 'Break-even at R (0=off)', type: 'number', default: 1, min: 0, max: 10 },
      direction:  { label: 'Direction', type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
    },

    chartIndicators() {
      return [{ type: 'ma', visible: true, params: { period: 50, maType: 'EMA', color: '#f59e0b', lineWidth: 1 } }];
    },

    init(p) {
      this.p = p;
      this.prevHist = null;
      this.reason = '';
    },

    onCandle(candle, ind, account) {
      const p = this.p;
      const n = ind.closes.length;

      // --- higher-timeframe trend (closed HTF bars only — no lookahead) ---------
      const h = ind.htf(HTF[p.htf] || '240');
      const he = h.ema(h.closes, p.htfEMA);
      const hEma = he[he.length - 1], hClose = h.closes[h.closes.length - 1];
      if (hEma == null || hClose == null) { this.reason = `Waiting for ${p.htf} history`; return null; }
      const trend = hClose > hEma ? 'up' : 'down';

      // --- base-timeframe building blocks ---------------------------------------
      const a = ind.atr(ind.candles, p.atrPeriod)[n - 1];
      const dx = ind.adx(ind.candles, 14).adx[n - 1];
      const hist = ind.macd(ind.closes, 12, 26, 9).hist[n - 1];
      if (a == null || dx == null || hist == null) return null;

      const crossUp = this.prevHist != null && this.prevHist <= 0 && hist > 0;
      const crossDn = this.prevHist != null && this.prevHist >= 0 && hist < 0;
      this.prevHist = hist;
      const trending = dx >= p.adxMin;
      const ctx = `${p.htf} ${trend} · ADX ${dx.toFixed(0)} · ATR ${a.toFixed(4)}`;

      // exit when the HTF trend turns against the open position
      if (account.position === 'long' && trend === 'down') { this.reason = `${p.htf} trend flipped down`; return 'close'; }
      if (account.position === 'short' && trend === 'up') { this.reason = `${p.htf} trend flipped up`; return 'close'; }
      if (account.position) { this.reason = `In ${account.position} · ${ctx}`; return null; }

      let side = null;
      if (crossUp && trend === 'up' && trending && p.direction !== 'Short only') side = 'long';
      if (crossDn && trend === 'down' && trending && p.direction !== 'Long only') side = 'short';
      if (!side) { this.reason = `No setup · ${ctx}`; return null; }

      const c = candle.close, risk = p.stopATR * a, dir = side === 'long' ? 1 : -1;
      this.reason = `MACD hist cross ${side === 'long' ? 'up' : 'down'} with ${ctx}`;
      return {
        signal: side,
        stopLoss: c - dir * risk,
        takeProfit: p.tpR > 0 ? c + dir * risk * p.tpR : undefined,
        trailingStop: p.trailATR > 0 ? p.trailATR * a : undefined,
        breakEvenAt: p.breakEvenR > 0 ? c + dir * risk * p.breakEvenR : undefined,
      };
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.htftrend = Strategy;
})();
