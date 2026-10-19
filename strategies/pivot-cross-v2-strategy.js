// pivot-cross-v2-strategy.js — "Pivot Cross V2 — Break & Trail".
//
// A profitability-focused evolution of pivot-cross-strategy.js. Same floor-trader
// pivot P (previous Daily/Weekly/Monthly period's (H+L+C)/3, no lookahead), but with
// two upgrades aimed at riding trends/rallies instead of scalping the cross:
//
//   1. ENTRY STYLES
//      • Breakout — enter the instant price crosses through P (the V1 behaviour).
//      • Pullback — after a break, WAIT for price to fall back and retest P, then
//        enter only when the retest holds (closes back the right side of P on a
//        candle that closes in the trade's direction). Break→retest→go is a higher
//        quality entry: you skip the failed pokes and join the move where risk is
//        tight (stop just past the retested pivot).
//      • Both — take whichever fires first.
//
//   2. EXITS — a TRAILING STOP that lets winners run, plus an optional hard target
//      "basis" the trade banks at:
//      • Fixed bracket   — initial ATR stop + ATR target, no trailing (= V1).
//      • Trailing + target — ATR stop that RATCHETS up behind the highest high since
//        entry once you're up ≥ activate×ATR, AND a hard target. Exit = whichever
//        hits first. (default)
//      • Trailing only   — ATR stop + ratchet, NO target → ride the whole rally,
//        exit only when price pulls back trail×ATR off its peak.
//
// The engine (strategy.js simulate / live replay) re-reads any {stopLoss,takeProfit}
// returned from onCandle every bar, so we trail by returning an updated stopLoss
// while the position is open. Position sizing / fees / slippage all come from Trade
// Sim (single source of truth) — no per-strategy money params here.
// (Markers: 🟢 long, 🔴 short, 🔵 close.)
(function () {
  // ── period bucketing (UTC) ────────────────────────────────────────────────
  function periodKey(timeSec, type) {
    if (type === 'Weekly') return Math.floor((Math.floor(timeSec / 86400) + 4) / 7); // Monday-aligned
    if (type === 'Monthly') { const d = new Date(timeSec * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
    return Math.floor(timeSec / 86400); // Daily = calendar day
  }

  // Previous-completed-period high/low/close from the source view (no future leak).
  function pivotSource(candles, type, src) {
    const n = candles.length;
    if (!n) return null;
    const curKey = periodKey(candles[n - 1].time, type);
    let i = n - 1;
    while (i >= 0 && periodKey(candles[i].time, type) === curKey) i--; // last bar of previous period
    if (i < 0) return null;
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

  // Wilder ATR over the source H/L/C accessors.
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
    name: 'Pivot Cross V2 — Break & Trail',
    description: 'Trades the floor-trader pivot P (previous Daily/Weekly/Monthly period) with two ' +
      'entry styles — Breakout (enter on the cross) and Pullback (wait for a retest of P that holds, ' +
      'then go) — gated by an optional trend MA, volume filter and direction. Exits ride the move via ' +
      'an ATR trailing stop that ratchets behind the peak once in profit, with an optional hard ATR ' +
      'target. Built to capture sustained rallies/uptrends rather than scalp the cross. Sizing/fees ' +
      'come from Trade Sim. "Use Heikin Ashi" makes every source read HA candles (off by default — HA ' +
      'fills aren\'t achievable live). Markers: 🟢 long, 🔴 short, 🔵 close.',
    warmUpBars: 60,

    // Draws the TradingView picture during Watch Replay: stepped pivot-P line plus the
    // generic per-trade green profit / red risk boxes + entry/exit triangles & labels.
    // The boxes follow the trailing stop as it ratchets (the engine re-reads stopLoss).
    overlay: true,

    params: {
      useHA:        { label: 'Use Heikin Ashi', type: 'select', options: ['Off', 'On'], default: 'Off' },
      pivotTimeframe: { label: 'Pivot timeframe', type: 'select', options: ['Daily', 'Weekly', 'Monthly'], default: 'Daily' },
      entryStyle:   { label: 'Entry style',   type: 'select', options: ['Both', 'Breakout', 'Pullback'], default: 'Both' },
      pullbackBars: { label: 'Pullback window (bars)', type: 'number', default: 6, min: 1, max: 40 },
      pullbackTolATR: { label: 'Retest tolerance × ATR', type: 'number', default: 0.5, min: 0.1, max: 3, step: 0.1 },
      useTrend:     { label: 'Trend filter',  type: 'select', options: ['On', 'Off'], default: 'On' },
      maType:       { label: 'MA type',       type: 'select', options: ['EMA', 'SMA', 'WMA'], default: 'EMA' },
      maLen:        { label: 'MA length',     type: 'number', default: 50,  min: 10, max: 400 },
      direction:    { label: 'Direction',     type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
      useVol:       { label: 'Volume filter', type: 'select', options: ['On', 'Off'], default: 'On' },
      volLen:       { label: 'Volume MA length', type: 'number', default: 20, min: 5,  max: 50 },
      volMult:      { label: 'Volume × avg',  type: 'number', default: 1.2, min: 0.5, max: 3, step: 0.1 },
      atrLen:       { label: 'ATR length',    type: 'number', default: 14,  min: 5,  max: 50 },
      exitStyle:    { label: 'Exit style',    type: 'select', options: ['Trailing + target', 'Trailing only', 'Fixed bracket'], default: 'Trailing + target' },
      slATR:        { label: 'Initial stop × ATR', type: 'number', default: 1.5, min: 0.3, max: 5, step: 0.1 },
      tpATR:        { label: 'Target × ATR (basis)', type: 'number', default: 4.0, min: 0.5, max: 20, step: 0.1 },
      trailActivateATR: { label: 'Trail activates after × ATR', type: 'number', default: 1.5, min: 0.1, max: 10, step: 0.1 },
      trailATR:     { label: 'Trail distance × ATR', type: 'number', default: 2.5, min: 0.3, max: 10, step: 0.1 },
    },

    // Shown on the chart during Watch Replay (engine has ma/volume types; the pivot
    // level is reflected by the SL/TP/entry lines TradeSim draws).
    chartIndicators(p) {
      p = p || {};
      const maType = (p.maType === 'WMA') ? 'EMA' : (p.maType || 'EMA');
      return [
        { type: 'ma',     visible: p.useTrend !== 'Off', params: { period: p.maLen || 50, maType, color: '#f59e0b', lineWidth: 1 } },
        { type: 'volume', visible: p.useVol !== 'Off', params: {} },
      ];
    },

    // Stepped pivot-P series for the overlay (the level whose break arms entries).
    overlaySeries(candles, params) {
      const tf = (params && params.pivotTimeframe) || 'Daily';
      const src = srcView(candles, params && params.useHA === 'On');
      const prev = prevPeriodSeries(candles, tf, src);
      const pivot = candles.map((c, i) => ({ time: c.time, value: prev[i] ? (prev[i].hi + prev[i].lo + prev[i].close) / 3 : null }));
      return { pivot };
    },

    init(params) {
      this.p = params;
      this.prevSrcC = null;     // previous bar's source close (for the cross)
      this.prevP = null;        // previous bar's pivot P
      this.armLong = 0;         // bars remaining to look for a long pullback after a break-up
      this.armShort = 0;        // bars remaining to look for a short pullback after a break-down
      this.peak = null;         // extreme favourable price since entry (high for longs, low for shorts)
      this.curStop = null;      // current (possibly trailed) stop
      this.curTarget = null;    // hard target, or null in "Trailing only"
      this._ha = { len: 0, o: [], h: [], l: [], c: [] };
      this.reason = '';
    },

    _ha_extend(candles) {
      const a = this._ha;
      if (candles.length < a.len) { a.len = 0; a.o = []; a.h = []; a.l = []; a.c = []; }
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

      const psrc = pivotSource(candles, P_.pivotTimeframe, src);
      const P = psrc ? (psrc.high + psrc.low + psrc.close) / 3 : null;
      const A = atrFromSrc(n, P_.atrLen, src);

      // ── manage an OPEN position: trail the stop behind the peak ──
      if (account.position) {
        const isLong = account.position === 'long';
        // extend the favourable extreme since entry
        if (this.peak == null) this.peak = isLong ? src.H(n - 1) : src.L(n - 1);
        else this.peak = isLong ? Math.max(this.peak, src.H(n - 1)) : Math.min(this.peak, src.L(n - 1));

        const trailing = P_.exitStyle !== 'Fixed bracket';
        if (trailing && A != null && A > 0 && this.curStop != null) {
          const entry = account.entryPrice;
          const moved = isLong ? (this.peak - entry) : (entry - this.peak);
          if (moved >= P_.trailActivateATR * A) {
            const cand = isLong ? this.peak - P_.trailATR * A : this.peak + P_.trailATR * A;
            const newStop = isLong ? Math.max(this.curStop, cand) : Math.min(this.curStop, cand);
            if (newStop !== this.curStop) {
              this.curStop = newStop;
              this.reason = `Trail ${isLong ? '↑' : '↓'} stop → ${newStop.toFixed(2)} (peak ${this.peak.toFixed(2)})`;
              return { stopLoss: this.curStop, takeProfit: this.curTarget };
            }
          }
        }
        this.reason = `holding ${account.position} · stop ${this.curStop != null ? this.curStop.toFixed(2) : '—'}`;
        return null;
      }

      // ── flat: clear per-trade tracking ──
      this.peak = null; this.curStop = null; this.curTarget = null;

      if (P == null) { this.reason = 'no prior pivot period yet'; return null; }

      // cross is measured against the previous source close / pivot; remember them
      const prevC = this.prevSrcC, prevP = this.prevP;
      this.prevSrcC = srcC; this.prevP = P;
      if (prevC == null || prevP == null) { this.reason = 'priming cross'; return null; }

      const crossUp = prevC <= prevP && srcC > P;
      const crossDn = prevC >= prevP && srcC < P;

      // arm the pullback watch on a fresh break
      if (crossUp) { this.armLong = P_.pullbackBars; this.armShort = 0; }
      if (crossDn) { this.armShort = P_.pullbackBars; this.armLong = 0; }

      // ── filters ──
      let volOK = true;
      if (P_.useVol === 'On') {
        const vols = candles.map((x) => x.volume);
        const va = indicators.sma(vols, P_.volLen);
        const avg = va[va.length - 1];
        volOK = avg != null && candle.volume >= P_.volMult * avg;
      }

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
      const wantBreakout = P_.entryStyle === 'Breakout' || P_.entryStyle === 'Both';
      const wantPullback = P_.entryStyle === 'Pullback' || P_.entryStyle === 'Both';

      // ── breakout entry: act on the cross bar itself ──
      if (wantBreakout && volOK) {
        if (crossUp && trendUp && longOK) return this._enter('long', srcC, src, n, A, 'breakout');
        if (crossDn && trendDn && shortOK) return this._enter('short', srcC, src, n, A, 'breakout');
      }

      // ── pullback entry: after a break, take the retest that holds ──
      if (wantPullback && A != null && A > 0) {
        const tol = P_.pullbackTolATR * A;
        if (this.armLong > 0 && longOK && trendUp && volOK && !crossUp) {
          const retested = src.L(n - 1) <= P + tol;          // dipped back to the pivot
          const held = srcC > P && srcC >= src.O(n - 1);      // closed back above P, bullish bar
          if (retested && held) { this.armLong = 0; return this._enter('long', srcC, src, n, A, 'pullback'); }
        }
        if (this.armShort > 0 && shortOK && trendDn && volOK && !crossDn) {
          const retested = src.H(n - 1) >= P - tol;
          const held = srcC < P && srcC <= src.O(n - 1);
          if (retested && held) { this.armShort = 0; return this._enter('short', srcC, src, n, A, 'pullback'); }
        }
      }

      // decay the pullback windows (do this AFTER the checks so a fresh arm gets its full window)
      if (this.armLong > 0 && !crossUp) this.armLong -= 1;
      if (this.armShort > 0 && !crossDn) this.armShort -= 1;

      this.reason = `waiting · close ${srcC.toFixed(2)} vs P ${P.toFixed(2)}` +
        (this.armLong > 0 ? ` · armed long ${this.armLong}` : '') +
        (this.armShort > 0 ? ` · armed short ${this.armShort}` : '');
      return null;
    },

    // Build the entry + initial bracket. Records curStop/curTarget so onCandle can
    // trail the stop on later bars. Target is omitted in "Trailing only".
    _enter(dir, srcC, src, n, A, kind) {
      const P_ = this.p;
      if (A == null || !(A > 0)) { this.reason = 'ATR not ready — skip'; return null; }
      const stop = dir === 'long' ? srcC - P_.slATR * A : srcC + P_.slATR * A;
      let target = null;
      if (P_.exitStyle !== 'Trailing only') {
        target = dir === 'long' ? srcC + P_.tpATR * A : srcC - P_.tpATR * A;
      }
      this.curStop = stop;
      this.curTarget = target;
      this.peak = srcC; // seed the peak at the entry close; extends on later bars
      this.armLong = 0; this.armShort = 0;
      this.reason = `${dir === 'long' ? 'Bullish' : 'Bearish'} ${kind} @ ${srcC.toFixed(2)} → ` +
        `stop ${stop.toFixed(2)}` + (target != null ? ` / target ${target.toFixed(2)}` : ' / trailing only');
      return { signal: dir, stopLoss: stop, takeProfit: target };
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.pivotcrossv2 = Strategy;
})();
