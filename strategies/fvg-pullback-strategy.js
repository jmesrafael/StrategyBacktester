// fvg-pullback-strategy.js — Pullback FVG: trade a fair value gap in its own direction, entering on the retrace into the gap.
//
// Researched in research/bollinger/ (explore-fvg*.js, explore-confirm.js, test-fvg.js, README-fvg-pullback.md). Short version:
//   • A bullish FVG (candle 3's low above candle 1's high, bullish middle candle) is a displacement; the setup is long, bearish mirrors it.
//   • Three ways to enter, same stop (the impulse origin = lowest low / highest high of candles 1–2) and target (3R):
//       Pullback (limit)       a resting limit order at the near edge of the gap, cancelled after `expire` candles
//       Pullback + confirmation wait for a candle that dips into the gap and closes back with the trend, then a market order
//       Direct (market)        market order at the next open, no pullback
//   • A 4h SMA(200) trend filter (longs above, shorts below) helps on the lower timeframes.
//   • Frozen on BTC/ETH/SOL training years, tested on SOL / ZEC / DOGE: 5m and 15m lose (costs eat the small stops), 1h is about zero,
//     4h is the only timeframe with a result — and waiting for the pullback did NOT beat entering directly (4h test +0.09R limit,
//     +0.05R confirmation, +0.21R direct). The limit result also vanishes if a touch of the limit is not counted as a fill.
// Use it on the 4h chart with "Fill at: Next bar open" and the session filter OFF.
(function () {
  const PULLBACK = 'Pullback (limit)', CONFIRM = 'Pullback + confirmation (market)', DIRECT = 'Direct (market)';

  const Strategy = {
    name: 'FVG Pullback · 4h',
    special: true,
    description: 'Fair value gap with displacement, then a limit order at the gap\'s near edge (the pullback). Stop at the impulse ' +
      'origin, 3R target, order cancelled after 20 candles, longs above / shorts below the 4h SMA200. Research: only the 4h chart works, ' +
      'and entering directly beat waiting for the pullback — switch "Entry" to compare. Use "Next bar open", session filter off.',
    warmUpBars: 220,

    // Shown in the Strategy panel. Numbers: research/bollinger/README-fvg-pullback.md (R = amount risked per trade).
    track: {
      verdict: 'unproven',
      headline: 'Pullback entry is not proven; direct entry on 4h is the only thing that held up.',
      rows: [
        ['4h pullback (limit), held-out 2023–26', '+0.09R / trade · 323 trades · t 0.9'],
        ['4h pullback, fill needs 0.1 ATR trade-through', '−0.01R / trade (edge gone)'],
        ['4h pullback + confirmation, held-out', '+0.05R / trade · 234 trades'],
        ['4h direct (market), held-out', '+0.21R / trade · 246 trades · t 1.8'],
        ['1h best case (direct)', '+0.07R / trade, ~0 at 3× costs'],
        ['15m / 5m', '−0.05R / −0.17R per trade — loses'],
        ['11 other coins, 4h held-out', 'pullback −0.04R (2 profit) · direct +0.08R (8 profit)'],
      ],
      data: 'Binance USDT-M futures SOL, ZEC, DOGE on 5m / 15m / 1h / 4h (2020 → Oct 2026); settings chosen on BTC/ETH/SOL 2019–22.',
      note: 'Waiting for the pullback missed the strongest moves (they never come back) and flatters fills (a limit counts as filled on a touch). ' +
        'Treat Direct on 4h as a modest, unproven edge; ZEC was flat in the held-out years.',
      asOf: '2026-10-20',
    },

    params: {
      entry:     { label: 'Entry', type: 'select', options: [PULLBACK, CONFIRM, DIRECT], default: PULLBACK },
      minGap:    { label: 'Gap height ≥ × ATR', type: 'number', default: 0.5, min: 0, max: 5 },
      disp:      { label: 'Middle candle body ≥ × ATR (0 = off)', type: 'number', default: 0, min: 0, max: 5 },
      depth:     { label: 'Pullback depth (0 = near edge, 1 = far edge)', type: 'number', default: 0, min: 0, max: 1 },
      stopMode:  { label: 'Stop', type: 'select', options: ['Impulse origin', 'Middle candle', 'Gap edge'], default: 'Impulse origin' },
      targetR:   { label: 'Target (R)', type: 'number', default: 3, min: 0.5, max: 10 },
      expire:    { label: 'Wait for the pullback (candles)', type: 'number', default: 20, min: 1, max: 200 },
      maxHold:   { label: 'Exit after (candles in trade, 0 = off)', type: 'number', default: 0, min: 0, max: 500 },
      trend:     { label: 'Trend filter', type: 'select', options: ['4h SMA200', 'Off'], default: '4h SMA200' },
      riskPct:   { label: 'Risk % per trade', type: 'number', default: 1, min: 0.1, max: 10 },
      direction: { label: 'Direction', type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
    },

    chartIndicators() {
      const d = typeof FVGIndicator !== 'undefined' ? FVGIndicator.getDefaults() : {};
      return [{ type: 'fvg', visible: true, params: { ...d, showHTF: false } }];
    },

    init(p) {
      this.p = p;
      this.placedAt = -1;   // candle where the resting limit order was decided
      this.st = null;       // confirmation mode: the FVG waiting for its pullback
      this.reason = '';
    },

    onCandle(candle, ind, account) {
      const p = this.p, C = ind.candles, i = ind.index;
      if (account.position) {
        if (p.maxHold > 0 && account.barsInTrade >= p.maxHold) { this.reason = `Time exit (${p.maxHold} candles)`; return 'close'; }
        return null;
      }
      if (p.entry === CONFIRM) return this.confirmStep(candle, ind, C, i);
      const g = this.gap(ind, C, i);
      if (g) {
        const order = this.order(g, p.entry === DIRECT);
        if (order) { this.placedAt = i; return order; }
      }
      // a resting pullback order that was not filled in time
      if (account.limitOrder && p.expire > 0 && i - this.placedAt >= p.expire) { this.reason = `Unfilled after ${p.expire} candles`; return 'cancel'; }
      return null;
    },

    // A qualifying FVG that just formed on bar i (the 3rd candle), or null.
    gap(ind, C, i) {
      const p = this.p;
      if (i < 2) return null;
      const a = ind.atr(C, 14)[i];
      if (a == null) return null;
      const c1 = C[i - 2], c2 = C[i - 1], c3 = C[i];
      let dir = 0, top, bot;
      if (c3.low > c1.high && c2.close > c2.open) { dir = 1; top = c3.low; bot = c1.high; }
      else if (c3.high < c1.low && c2.close < c2.open) { dir = -1; top = c1.low; bot = c3.high; }
      if (!dir) return null;
      if (dir === 1 && p.direction === 'Short only') return null;
      if (dir === -1 && p.direction === 'Long only') return null;
      if (top - bot < p.minGap * a) return null;
      if (p.disp > 0 && Math.abs(c2.close - c2.open) < p.disp * a) return null;
      if (p.trend === '4h SMA200') {
        const hi = ind.htf('240'), sm = hi.sma(hi.closes, 200), t = sm[sm.length - 1];
        if (t == null || (dir === 1 ? c3.close < t : c3.close > t)) return null;
      }
      let stop;
      if (p.stopMode === 'Gap edge') stop = dir === 1 ? bot - 0.1 * a : top + 0.1 * a;
      else if (p.stopMode === 'Middle candle') stop = dir === 1 ? c2.low : c2.high;
      else stop = dir === 1 ? Math.min(c1.low, c2.low) : Math.max(c1.high, c2.high);
      return { dir, top, bot, stop, a, close: c3.close };
    },

    // Order for a fresh gap: a limit at the near edge (depth), or a market order (direct).
    order(g, direct) {
      const p = this.p, side = g.dir === 1 ? 'long' : 'short';
      const gapTxt = `${g.dir === 1 ? 'Bullish' : 'Bearish'} FVG ${g.bot.toFixed(2)}–${g.top.toFixed(2)}`;
      if (direct) {
        const dist = g.dir * (g.close - g.stop);
        if (!(dist >= 0.3 * g.a) || dist > 5 * g.a) return null;
        this.reason = `${gapTxt}, direct entry`;
        return { signal: side, stopLoss: g.stop, takeProfit: g.close + g.dir * p.targetR * dist, riskPct: p.riskPct };
      }
      const h = g.top - g.bot, limit = g.dir === 1 ? g.top - p.depth * h : g.bot + p.depth * h;
      const dist = g.dir * (limit - g.stop);
      if (!(dist >= 0.3 * g.a) || dist > 5 * g.a) return null;
      this.reason = `${gapTxt}, limit at ${limit.toFixed(2)}`;
      return { signal: side, limitPrice: limit, stopLoss: g.stop, takeProfit: limit + g.dir * p.targetR * dist, riskPct: p.riskPct };
    },

    // Confirmation mode: wait for a candle that dips into the gap and closes back with the trend, then enter at the market.
    confirmStep(candle, ind, C, i) {
      const p = this.p, c3 = C[i], a = ind.atr(C, 14)[i];
      if (a == null) return null;
      const st = this.st;
      if (st && i > st.born) {
        const h = st.top - st.bot, mid = (st.top + st.bot) / 2;
        if (i - st.born > p.expire || (st.dir === 1 ? c3.close < st.bot : c3.close > st.top)) this.st = null;
        else if (st.dir === 1
          ? (c3.low <= st.top - p.depth * h && c3.close > c3.open && c3.close > mid)
          : (c3.high >= st.bot + p.depth * h && c3.close < c3.open && c3.close < mid)) {
          this.st = null;
          const dist = st.dir * (c3.close - st.stop);
          if (!(dist >= 0.3 * a) || dist > 5 * a) return null;
          this.reason = `${st.dir === 1 ? 'Bullish' : 'Bearish'} FVG ${st.bot.toFixed(2)}–${st.top.toFixed(2)}: pullback candle closed with the trend`;
          return { signal: st.dir === 1 ? 'long' : 'short', stopLoss: st.stop, takeProfit: c3.close + st.dir * p.targetR * dist, riskPct: p.riskPct };
        }
      }
      const g = this.gap(ind, C, i);
      if (g) this.st = { dir: g.dir, top: g.top, bot: g.bot, stop: g.stop, born: i };
      return null;
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.fvgpullback = Strategy;
})();
