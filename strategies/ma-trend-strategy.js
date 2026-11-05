// ma-trend-strategy.js — moving-average trend follower with an ATR stop and a wide ATR trailing stop (built for the 4h chart).
//
// Researched in research/indicator-top10/ (REPORT.md + REPORT-7COINS.md). The first 10 indicators of the list (SMA, EMA, WMA, VWMA, SMMA, HMA,
// DEMA, TEMA, KAMA, ALMA) were tested alone and then rebuilt with the same ingredients as I-Core: a 200-SMA trend filter, a 2-ATR initial stop
// and a very wide ATR trailing stop with NO profit target. What mattered was the recipe, not the moving average:
//   • trail 10–20 ATR (7 ATR is clearly worse), initial stop 2 ATR, 200-SMA filter on, long-only (best 2023→now in every setting tried).
//   • 4 coins (BTC ETH SOL ADA), 2.5% risk, 2019→Nov 2026: the VWMA/close>MA200 version made +686R vs I-Core +449R and bb-core +425R,
//     but only 20% of trades win and most profit came in two years (2021, 2024). Smoother it is not.
//
// Rules (everything is decided on a bar's CLOSE and filled at the next open — use "Fill at: Next bar open"):
//   Entry LONG  : price (or the fast MA) crosses ABOVE the MA (or the slow MA) AND close > SMA(trendLen).      (short mirror if Direction allows)
//   Stop        : entry price −/+ kInit × ATR(14) at the signal close  → that distance is 1R.
//   Trail       : after every bar that does not stop the trade: stop = best price since entry −/+ kTrail × ATR(14); it only moves in the trade's favour
//                 and is live from the NEXT bar. No profit target.
//   Skip        : signals while a 4h candle is missing in the last 200 bars (the indicators would span a hole).
// Every MA is STREAMING: it is updated once per closed bar and never looks past the current bar, so a signal cannot repaint.
(function () {
  const NAN = NaN, isn = Number.isNaN;
  // ---- streaming moving averages: push(close, volume) → value at the bar just pushed (NaN until warmed up) ---------------------------------
  const Win = (n) => ({ n, a: [], push(x) { this.a.push(x); if (this.a.length > n) this.a.shift(); return this.a.length === n; } });
  const makeSMA = (n) => { const w = Win(n); return { push(x) { return w.push(x) ? w.a.reduce((s, v) => s + v, 0) / n : NAN; } }; };
  const makeWMA = (n) => { const w = Win(n), d = n * (n + 1) / 2; return { push(x) { if (!w.push(x)) return NAN; let s = 0; for (let k = 0; k < n; k++) s += w.a[n - 1 - k] * (n - k); return s / d; } }; };
  const makeVWMA = (n) => { const w = Win(n), v = Win(n); return { push(x, vol) { const a = w.push(x), b = v.push(vol); if (!a) return NAN; let p = 0, q = 0; for (let k = 0; k < n; k++) { p += w.a[k] * v.a[k]; q += v.a[k]; } return q ? p / q : NAN; } }; };
  const makeALMA = (n, off = 0.85, sg = 6) => { const w = Win(n), m = off * (n - 1), s = n / sg, ws = []; let nm = 0; for (let k = 0; k < n; k++) { const e = Math.exp(-((k - m) ** 2) / (2 * s * s)); ws.push(e); nm += e; } return { push(x) { if (!w.push(x)) return NAN; let a = 0; for (let k = 0; k < n; k++) a += w.a[k] * ws[k]; return a / nm; } }; };
  const makeEMA = (n) => { const k = 2 / (n + 1); let cnt = 0, sum = 0, v = NAN; return { push(x) { if (isn(x)) return NAN; cnt++; if (cnt < n) { sum += x; return NAN; } if (cnt === n) { sum += x; v = sum / n; return v; } v = x * k + v * (1 - k); return v; } }; };
  const makeSMMA = (n) => { let cnt = 0, sum = 0, v = NAN; return { push(x) { if (isn(x)) return NAN; cnt++; if (cnt < n) { sum += x; return NAN; } if (cnt === n) { sum += x; v = sum / n; return v; } v = (v * (n - 1) + x) / n; return v; } }; };
  const makeDEMA = (n) => { const e1 = makeEMA(n), e2 = makeEMA(n); return { push(x) { const a = e1.push(x), b = e2.push(a); return 2 * a - b; } }; };
  const makeTEMA = (n) => { const e1 = makeEMA(n), e2 = makeEMA(n), e3 = makeEMA(n); return { push(x) { const a = e1.push(x), b = e2.push(a), c = e3.push(b); return 3 * a - 3 * b + c; } }; };
  const makeKAMA = (n) => { const w = Win(n + 1), fs = 2 / 3, ss = 2 / 31; let v = NAN; return { push(x) { const full = w.push(x); if (!full) return NAN; const a = w.a; let vol = 0; for (let k = 1; k <= n; k++) vol += Math.abs(a[k] - a[k - 1]); const er = vol ? Math.abs(a[n] - a[0]) / vol : 0, sc = (er * (fs - ss) + ss) ** 2, prev = isn(v) ? a[n - 1] : v; v = prev + sc * (x - prev); return v; } }; };
  const makeHMA = (n) => { const h = Math.max(1, Math.round(n / 2)), r = Math.max(1, Math.round(Math.sqrt(n))), a = makeWMA(h), b = makeWMA(n), c = makeWMA(r); return { push(x) { const p = a.push(x), q = b.push(x); if (isn(p) || isn(q)) return NAN; return c.push(2 * p - q); } }; };
  const FACT = { SMA: makeSMA, EMA: makeEMA, WMA: makeWMA, VWMA: makeVWMA, SMMA: makeSMMA, HMA: makeHMA, DEMA: makeDEMA, TEMA: makeTEMA, KAMA: makeKAMA, ALMA: makeALMA };

  const Strategy = {
    name: 'MA Trend · 4h ATR trail',
    special: true,
    description: 'Moving-average cross with a 200-SMA trend filter, 2-ATR stop and a wide ATR trailing stop (no target). Any of 10 MAs (SMA … ALMA). ' +
      'Long-only by default. On 4h BTC/ETH/SOL/ADA 2023→now: about +1.8R per trade, 20% win rate, profit concentrated in a few trend years. Use "Next bar open", session filter off.',
    warmUpBars: 205,

    track: {
      verdict: 'profitable',
      headline: 'Bigger than I-Core / bb-core in total R on the tested coins, but lumpy: ~20% of trades win and 2 years make most of it.',
      rows: [
        ['VWMA close×MA200, 200-SMA filter, long-only, 2/14 ATR — BTC ETH SOL ADA, 2019–26', '+2.37R / trade · 289 trades · +686R'],
        ['Same, 2023→now only (unseen part)', '+1.95R / trade · 173 trades · +338R (I-Core +167R, bb-core +190R)'],
        ['Zone median (270 settings, 10 MAs)', '+1.75R / trade · 90% beat I-Core, 84% beat bb-core on 2023→now total R'],
        ['Worst drop at 2.5% risk', '≈ -71% (I-Core -69%, bb-core -64%)'],
        ['Profitable years (4 coins)', '5 of 7 — 2021 and 2024 make ~92% of the R'],
      ],
      data: 'Binance USDT-M futures 4h; research/indicator-top10 (fees 0.05% + slippage 0.02% + 0.005% funding per bar).',
      note: 'Long-only is a bet that crypto keeps drifting up. Four coins are ~1.5 independent bets. Paper-trade first.',
      asOf: '2026-11-05',
    },

    params: {
      maType:   { label: 'Moving average', type: 'select', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'HMA', 'DEMA', 'TEMA', 'KAMA', 'ALMA'], default: 'VWMA' },
      entry:    { label: 'Entry shape', type: 'select', options: ['Price crosses MA', 'Fast MA crosses slow MA'], default: 'Price crosses MA' },
      maLen:    { label: 'MA length (price cross) / slow length', type: 'number', default: 200, min: 5, max: 400 },
      fastLen:  { label: 'Fast MA length (cross mode)', type: 'number', default: 50, min: 2, max: 200 },
      trendLen: { label: 'Trend SMA filter (0 = off)', type: 'number', default: 200, min: 0, max: 400 },
      kInit:    { label: 'Initial stop (× ATR)', type: 'number', default: 2, min: 0.5, max: 8 },
      kTrail:   { label: 'Trailing stop (× ATR)', type: 'number', default: 14, min: 2, max: 40 },
      maxBars:  { label: 'Safety exit after (bars, 0 = off)', type: 'number', default: 600, min: 0, max: 3000 },
      riskPct:  { label: 'Risk % per trade', type: 'number', default: 2.5, min: 0.1, max: 10 },
      direction:{ label: 'Direction', type: 'select', options: ['Long only', 'Both', 'Short only'], default: 'Long only' },
    },

    chartIndicators(p) {
      const list = [{ type: 'ma', visible: true, params: { period: (p && p.maLen) || 200, maType: ((p && p.maType) === 'EMA' ? 'EMA' : 'SMA'), color: '#38bdf8', lineWidth: 1 } }];
      if (p && p.trendLen > 0) list.push({ type: 'ma', visible: true, params: { period: p.trendLen, maType: 'SMA', color: '#ffb74d', lineWidth: 1 } });
      return list;
    },

    init(p) { this.p = p; this.reason = ''; this.last = -1; this.ext = null; this.wasIn = false; this.s = null; this.prevA = NAN; this.prevM = NAN; },

    // (re)build the streaming MAs from the closed bars 0..i inclusive (only on the first call or after a seek — normal replay pushes one bar at a time)
    _build(ind, i) {   // pushes bars 0..i inclusive
      const p = this.p, make = FACT[p.maType] || FACT.SMA, cross = p.entry === 'Fast MA crosses slow MA';
      this.s = { slow: make(p.maLen), fast: cross ? make(p.fastLen) : null, cross };
      this.prevA = NAN; this.prevM = NAN; this.curA = NAN; this.curM = NAN; this.last = -1;
      for (let j = 0; j <= i; j++) this._push(ind.candles[j], j);
      this.ext = null; this.wasIn = false;
    },
    _push(c, j) {
      const s = this.s; this.prevA = this.curA; this.prevM = this.curM;
      this.curM = s.slow.push(c.close, c.volume || 1);
      this.curA = s.cross ? s.fast.push(c.close, c.volume || 1) : c.close;
      this.last = j;
    },

    onCandle(candle, ind, account) {
      const p = this.p, i = ind.index, C = ind.candles;
      if (!this.s || (this.last !== i - 1 && this.last !== i)) this._build(ind, i);   // first call / seek: rebuild through bar i
      else if (this.last === i - 1) this._push(candle, i);
      const atr = ind.atr(C, 14)[i];
      if (atr == null || !(atr > 0)) return null;

      // ---- in a position: ratchet the trailing stop from the best price so far (live from the next bar) --------------------------------
      if (account.position) {
        const long = account.position === 'long';
        if (p.maxBars > 0 && account.barsInTrade >= p.maxBars) { this.reason = `Safety exit (${p.maxBars} bars)`; return 'close'; }
        if (!this.wasIn || this.ext == null) { this.wasIn = true; this.ext = account.entryPrice; }
        this.ext = long ? Math.max(this.ext, candle.high) : Math.min(this.ext, candle.low);
        const ns = this.ext - (long ? 1 : -1) * p.kTrail * atr, cur = account.stopLoss;
        if (cur == null || (long ? ns > cur : ns < cur)) { this.reason = `Trail ${p.kTrail} ATR from best ${this.ext.toFixed(4)}`; return { stopLoss: ns }; }
        return null;
      }
      this.wasIn = false; this.ext = null;

      // ---- flat: look for a cross on the closed bar ----------------------------------------------------------------------------------
      const a = this.curA, m = this.curM, pa = this.prevA, pm = this.prevM;
      if ([a, m, pa, pm].some(isn)) return null;
      let dir = null;
      if (a > m && pa <= pm) dir = 'long'; else if (a < m && pa >= pm) dir = 'short';
      if (!dir) return null;
      if (dir === 'long' && p.direction === 'Short only') return null;
      if (dir === 'short' && p.direction === 'Long only') return null;
      if (p.trendLen > 0) {
        const sm = ind.sma(ind.closes, p.trendLen), t = sm[sm.length - 1];
        if (t == null || (dir === 'long' ? candle.close <= t : candle.close >= t)) return null;
      }
      for (let j = Math.max(1, i - 199); j <= i; j++) if (C[j].time - C[j - 1].time !== 14400) { this.reason = 'Gap in the last 200 candles'; return null; }
      const stop = candle.close - (dir === 'long' ? 1 : -1) * p.kInit * atr;
      this.reason = `${p.maType} ${p.entry === 'Price crosses MA' ? 'price cross' : 'fast/slow cross'}${p.trendLen > 0 ? ', with the ' + p.trendLen + ' SMA' : ''}`;
      return { signal: dir, stopLoss: stop, riskPct: p.riskPct };
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.matrend = Strategy;
})();
