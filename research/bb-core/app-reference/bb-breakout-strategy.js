// bb-breakout-strategy.js — Bollinger band breakout in the direction of the trend (built for the 4h chart).
//
// Researched in research/bollinger/ (see results-*.md there). Findings, in the order they were found:
//   • Mean reversion (fade a close outside the bands) loses: 17 of 576 settings profitable, median -0.15R per trade.
//   • The squeeze breakout (bands pinch, then expand) works, but a control run showed the squeeze itself adds
//     nothing — plain "close beyond a band" is as good or better. What is left is a momentum breakout.
//   • 4h was clearly best (every one-factor change stayed positive); 1h marginal, 15m/2h not worth trading.
//   • A 200-SMA trend filter (longs above, shorts below) lifted avg R per trade from +0.22 to +0.33 in training.
// Settings were chosen on 2019–2022 BTC / ETH / SOL only, then run ONCE on 2023→now and on 10 coins never tuned on:
//   tuned coins, test years: +0.13R/trade (train +0.29R); 10 fresh coins, test years: +0.09R/trade, 8 of 10 profitable;
//   pooled 13 coins +0.10R/trade over ~2,800 trades. It decays after 2022 (+0.26R/yr 2021 → ~+0.10R 2025–26), and with
//   costs tripled almost nothing is left (+0.03R). Treat it as a modest, broad edge — not a big one. Funding not included.
//
// Rules (everything is decided on a bar's CLOSE and filled at the next open):
//   1. Long when the close is above the upper Bollinger band (bbLen, bbMult) and above the trend SMA (trendLen);
//      short when it closes below the lower band and below the SMA. One position at a time.
//   2. Stop at the middle band (the Bollinger basis). Skipped if the stop is closer than 0.3 × ATR(14).
//   3. Target = entry ± targetR × the stop distance (default 3R). Exit at the next open after maxBars bars in the trade.
//   4. Optional "Require squeeze": the band width must have been in its lowest squeezePct of the last 100 bars
//      within the last 10 bars (research says it does not help; kept to reproduce the squeeze-breakout version).
//   5. Sized to risk riskPct of the balance at the stop.
// Use it on the 4h chart with "Fill at: Next bar open" and the session filter OFF.
(function () {
  const Strategy = {
    name: 'BB Breakout · 4h trend',
    special: true,
    description: 'Closes beyond a Bollinger band in the direction of the 200 SMA, stop at the middle band, 3R target, ' +
      'exit after 48 bars. Built on 4h SOL / ETH / BTC and many other coins; held-out 2023–26 average about +0.1R per trade ' +
      '(weaker than the 2019–22 training years, thin after costs). Use "Next bar open", session filter off.',
    warmUpBars: 202,

    // Shown in the Strategy panel. Numbers: research/bollinger/README-bb-breakout.md (R = amount risked per trade).
    track: {
      verdict: 'profitable',
      headline: 'Modest edge on held-out years, fading and thin after costs.',
      rows: [
        ['Tuning 2019–22 (BTC/ETH/SOL)', '+0.29R / trade · 459 trades'],
        ['Held-out 2023–26 (same 3 coins)', '+0.13R / trade · 616 trades'],
        ['Held-out, 10 coins never tuned', '+0.09R / trade · 8 of 10 profit'],
        ['SOL + ETH at $5 risk, held-out', '≈ +$6 / month · max DD $129'],
        ['SOL + ZEC + DOGE, held-out (ZEC/DOGE untuned)', '+0.21R / trade · 620 trades · ≈ +$14 / month at $5'],
        ['Costs ×3 (fees + slippage)', '+0.03R / trade on 13 coins (≈ break-even)'],
        ['SOL + DOGE + ZEC with real funding, 2020–26', 'positive in 7 of 7 years · +$1,294 at $5 risk · funding cost only $58'],
        ['…same, costs ×3 + funding', 'still 7 of 7 years positive (+$1,034); 2026 only +$11'],
        ['Per coin years positive', 'SOL 7/7 · ZEC 7/7 · DOGE 5/7 (lost 2023, 2026)'],
        ['243 nearby settings, funding in', 'all profitable · 62% positive every year · 92% in ≥6 of 7'],
      ],
      data: 'Binance USDT-M futures, 4h; BTC/ETH/SOL 2019–26 plus BNB XRP DOGE ADA AVAX LINK LTC DOT TRX BCH.',
      note: 'Decays: +0.26R/trade in 2021 → ~+0.10R in 2025–26. ETH was flat in 2023. Squeeze filter added nothing; mean reversion lost. ' +
        'Paper-trade before real money. Funding not included.',
      asOf: '2026-10-20',
    },

    params: {
      bbLen:       { label: 'Bollinger length', type: 'number', default: 20, min: 5, max: 100 },
      bbMult:      { label: 'Bollinger σ', type: 'number', default: 2, min: 0.5, max: 4 },
      trendLen:    { label: 'Trend SMA length (0 = off)', type: 'number', default: 200, min: 0, max: 400 },
      targetR:     { label: 'Target (R)', type: 'number', default: 3, min: 0.5, max: 10 },
      maxBars:     { label: 'Exit after (bars, 0 = off)', type: 'number', default: 48, min: 0, max: 500 },
      squeeze:     { label: 'Require squeeze', type: 'select', options: ['No', 'Yes'], default: 'No' },
      squeezePct:  { label: 'Squeeze: width in lowest (fraction of last 100)', type: 'number', default: 0.25, min: 0.05, max: 1 },
      riskPct:     { label: 'Risk % per trade', type: 'number', default: 1, min: 0.1, max: 10 },
      direction:   { label: 'Direction', type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
    },

    chartIndicators(p) {
      const list = [{ type: 'bb', visible: true, params: { period: (p && p.bbLen) || 20, mult: (p && p.bbMult) || 2 } }];
      if (p && p.trendLen > 0) list.push({ type: 'ma', visible: true, params: { period: p.trendLen, maType: 'SMA', color: '#ffb74d' } });
      return list;
    },

    init(p) {
      this.p = p;
      this.reason = '';
    },

    onCandle(candle, ind, account) {
      const p = this.p, C = ind.candles, i = ind.index;
      // time exit: the close order fills at the next open
      if (account.position) {
        if (p.maxBars > 0 && account.barsInTrade >= p.maxBars) { this.reason = `Time exit (${p.maxBars} bars)`; return 'close'; }
        return null;
      }
      const bb = ind.bollinger(ind.closes, p.bbLen, p.bbMult);
      const k = bb.upper.length - 1;
      const up = bb.upper[k], lo = bb.lower[k], mid = bb.middle[k];
      const atr = ind.atr(C, 14)[i];
      if (up == null || lo == null || atr == null) return null;
      const close = candle.close;
      const dir = close > up ? 'long' : close < lo ? 'short' : null;
      if (!dir) return null;
      if (dir === 'long' && p.direction === 'Short only') return null;
      if (dir === 'short' && p.direction === 'Long only') return null;

      if (p.trendLen > 0) {
        const sma = ind.sma(ind.closes, p.trendLen);
        const t = sma[sma.length - 1];
        if (t == null || (dir === 'long' ? close < t : close > t)) return null;
      }
      if (p.squeeze === 'Yes') {
        const w = bb.width, look = 100, recent = 10;
        let seen = false;
        for (let j = k - recent; j < k && !seen; j++) {
          if (j - look + 1 < 0 || w[j] == null) continue;
          let below = 0;
          for (let m = j - look + 1; m < j; m++) if (w[m] < w[j]) below++;
          if (below <= p.squeezePct * look) seen = true;
        }
        if (!seen) { this.reason = 'Breakout without a recent squeeze'; return null; }
      }

      const stop = mid, dist = Math.abs(close - stop);
      if (!(dist > 0) || dist < 0.3 * atr) { this.reason = 'Stop too tight'; return null; }
      const sign = dir === 'long' ? 1 : -1;
      this.reason = `Close ${close.toFixed(2)} beyond ${dir === 'long' ? 'upper' : 'lower'} band${p.trendLen > 0 ? ', with the trend' : ''}`;
      return { signal: dir, stopLoss: stop, takeProfit: close + sign * p.targetR * dist, riskPct: p.riskPct };
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.bbbreakout = Strategy;
})();
