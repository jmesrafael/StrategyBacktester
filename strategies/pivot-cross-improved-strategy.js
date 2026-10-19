// pivot-cross-improved-strategy.js — "Pivot Cross — Improved (TV-style)".
//
// Full port of the pasted Pine v5 strategy("Pivot Cross — Improved"). Same core as
// the existing V1 (cross of price through the floor-trader pivot P), but adds every
// gate/exit the Pine has — cooldown, daily trade cap, session window, breakeven stop —
// AND, unlike V1, it draws the TradingView picture on the chart during Watch Replay:
// the stepped pivot-P line, per-trade green profit / red risk boxes, avg/stop/target
// segment lines, entry/exit triangles and price labels (see js/strategy-overlay.js).
//
// Engine contract (see README + js/strategy.js): export one Strategy object, register
// it on window.__STRATEGIES[id]. onCandle returns { signal, stopLoss, takeProfit } on
// entry and may return an updated { stopLoss } on a later bar (breakeven). Sizing/fees
// come from Trade Sim. (Markers: 🟢 long, 🔴 short, 🔵 close.)
//
// OVERLAY OPT-IN (additive contract used only by StrategyMode during replay):
//   • overlay: true                       → activate the StrategyOverlay canvas
//   • overlaySeries(candles, params)       → { pivot:[{time,value}] } stepped pivot-P
(function () {
  // ── period bucketing (UTC) — identical to V1 ──────────────────────────────
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

  // Session-window check (UTC). sess like "0700-2100"; wraps midnight if start > end.
  function inSession(timeSec, sess) {
    const m = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(String(sess || '').replace(/[^0-9-]/g, ''));
    if (!m) return true;
    const start = (+m[1]) * 60 + (+m[2]);
    const end = (+m[3]) * 60 + (+m[4]);
    const d = new Date(timeSec * 1000);
    const min = d.getUTCHours() * 60 + d.getUTCMinutes();
    return start <= end ? (min >= start && min < end) : (min >= start || min < end);
  }

  const Strategy = {
    name: 'Pivot Cross — Improved (TV-style)',
    description: 'Full port of the "Pivot Cross — Improved" Pine: LONG on a cross above the floor-trader ' +
      'pivot P (from the previous Daily/Weekly/Monthly period), SHORT on a cross below — gated by an ' +
      'optional trend MA, volume filter, direction, session window, post-exit cooldown and a daily trade ' +
      'cap. Exits let winners run: an ATR-or-MA TRAILING stop (Trailing only / Trailing + target) ' +
      'that ratchets behind the move, or the original fixed ATR/percent stop+target bracket, with an ' +
      'optional breakeven stop. ' +
      'Draws the TradingView picture during Watch Replay: stepped pivot-P line, per-trade green/red ' +
      'profit/risk boxes, avg/stop/target lines, entry/exit triangles and price labels. "Use Heikin ' +
      'Ashi" makes every source read internal HA candles (off by default — HA fills aren\'t achievable ' +
      'live). Markers: 🟢 long, 🔴 short, 🔵 close.',
    warmUpBars: 60,

    // The overlay (js/strategy-overlay.js) turns on only for strategies that set this.
    overlay: true,

    params: {
      useHA:        { label: 'Use Heikin Ashi', type: 'select', options: ['Off', 'On'], default: 'Off' },
      pivotTimeframe: { label: 'Pivot timeframe', type: 'select', options: ['Daily', 'Weekly', 'Monthly'], default: 'Daily' },
      useTrend:     { label: 'Trend filter',  type: 'select', options: ['On', 'Off'], default: 'On' },
      maType:       { label: 'MA type',       type: 'select', options: ['EMA', 'SMA', 'WMA'], default: 'EMA' },
      maLen:        { label: 'MA length',     type: 'number', default: 50,  min: 10, max: 400 },
      direction:    { label: 'Direction',     type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
      useVol:       { label: 'Volume filter', type: 'select', options: ['On', 'Off'], default: 'On' },
      volLen:       { label: 'Volume MA length', type: 'number', default: 20, min: 5,  max: 50 },
      volMult:      { label: 'Volume × avg',  type: 'number', default: 1.2, min: 0.5, max: 3, step: 0.1 },
      atrLen:       { label: 'ATR length',    type: 'number', default: 14,  min: 5,  max: 50 },
      exitMode:     { label: 'Exit mode',     type: 'select', options: ['ATR', 'Percent'], default: 'ATR' },
      slATR:        { label: 'Stop × ATR',    type: 'number', default: 1.5, min: 0.3, max: 5, step: 0.1 },
      tpATR:        { label: 'Target × ATR',  type: 'number', default: 3.0, min: 0.5, max: 10, step: 0.1 },
      stopPct:      { label: 'Stop % (Percent mode)',   type: 'number', default: 1.0, min: 0.1, max: 20, step: 0.1 },
      targetPct:    { label: 'Target % (Percent mode)', type: 'number', default: 2.0, min: 0.1, max: 40, step: 0.1 },
      // Exit style — let winners run. "Trailing only" drops the fixed target so a trade
      // rides the trend until a trailing stop is hit; "Trailing + target" keeps the target
      // as a far backstop; "Fixed bracket" is the original stop/target behaviour.
      exitStyle:    { label: 'Exit style',    type: 'select', options: ['Trailing only', 'Trailing + target', 'Fixed bracket'], default: 'Trailing only' },
      trailMethod:  { label: 'Trail method',  type: 'select', options: ['ATR', 'Moving average'], default: 'ATR' },
      trailActivateATR: { label: 'Trail activates after × ATR', type: 'number', default: 1.5, min: 0.1, max: 10, step: 0.1 },
      trailATR:     { label: 'Trail distance × ATR', type: 'number', default: 2.5, min: 0.3, max: 10, step: 0.1 },
      trailMaLen:   { label: 'Trail MA length (MA method)', type: 'number', default: 21, min: 5, max: 200 },
      useBE:        { label: 'Breakeven stop', type: 'select', options: ['Off', 'On'], default: 'Off' },
      beR:          { label: 'Move to BE at R', type: 'number', default: 1.0, min: 0.3, max: 3, step: 0.1 },
      cooldown:     { label: 'Cooldown bars after exit', type: 'number', default: 3, min: 0, max: 20 },
      maxPerDay:    { label: 'Max trades/day (0=∞)', type: 'number', default: 0, min: 0, max: 10 },
      useSession:   { label: 'Session filter', type: 'select', options: ['Off', 'On'], default: 'Off' },
      session:      { label: 'Active session (HHMM-HHMM UTC)', type: 'string', default: '0700-2100' },
    },

    // Shown during Watch Replay. MA in aqua to match the Pine (color.aqua); the pivot
    // line is drawn by StrategyOverlay, not IndicatorManager.
    chartIndicators(p) {
      p = p || {};
      const maType = (p.maType === 'WMA') ? 'EMA' : (p.maType || 'EMA'); // engine MA has no WMA; show EMA
      const out = [
        { type: 'ma',     visible: p.useTrend !== 'Off', params: { period: p.maLen || 50, maType, color: '#22d3ee', lineWidth: 1 } },
        { type: 'volume', visible: p.useVol !== 'Off', params: {} },
      ];
      // When the stop trails to a moving average, show that MA so the trail is visible.
      if (p.exitStyle && p.exitStyle !== 'Fixed bracket' && p.trailMethod === 'Moving average') {
        out.push({ type: 'ma', visible: true, params: { period: p.trailMaLen || 21, maType, color: '#a855f7', lineWidth: 1 } });
      }
      return out;
    },

    // Stepped pivot-P series for the overlay — one value per revealed bar (P for the
    // current period = previous completed period's (H+L+C)/3, fixed across the period).
    // Single O(n) pass; pure/stateless so the overlay can call it each render.
    overlaySeries(candles, params) {
      const tf = (params && params.pivotTimeframe) || 'Daily';
      const useHA = params && params.useHA === 'On';
      // source O/H/L/C accessors (HA built inline when requested)
      let H, L, C;
      if (useHA) {
        const o = [], h = [], l = [], c = [];
        for (let i = 0; i < candles.length; i++) {
          const s = haStep(i > 0 ? o[i - 1] : null, i > 0 ? c[i - 1] : null, candles[i]);
          o[i] = s.o; h[i] = s.h; l[i] = s.l; c[i] = s.c;
        }
        H = (i) => h[i]; L = (i) => l[i]; C = (i) => c[i];
      } else {
        H = (i) => candles[i].high; L = (i) => candles[i].low; C = (i) => candles[i].close;
      }
      const out = [];
      let curKey = null, curHi = -Infinity, curLo = Infinity, curClose = null;
      let prevHi = null, prevLo = null, prevClose = null;
      for (let i = 0; i < candles.length; i++) {
        const k = periodKey(candles[i].time, tf);
        if (curKey === null) { curKey = k; curHi = H(i); curLo = L(i); curClose = C(i); }
        else if (k !== curKey) {
          prevHi = curHi; prevLo = curLo; prevClose = curClose; // completed period → previous
          curKey = k; curHi = H(i); curLo = L(i); curClose = C(i);
        } else {
          curHi = Math.max(curHi, H(i)); curLo = Math.min(curLo, L(i)); curClose = C(i);
        }
        out.push({ time: candles[i].time, value: prevHi != null ? (prevHi + prevLo + prevClose) / 3 : null });
      }
      return { pivot: out };
    },

    init(params) {
      this.p = params;
      this.prevSrcC = null;        // previous bar's source close  (for the cross)
      this.prevP = null;           // previous bar's pivot P
      this.prevPosition = null;    // account.position last bar (to detect an exit)
      this.barsSinceExit = 999;    // cooldown counter
      this.curDayKey = null;       // calendar-day key (daily trade cap reset)
      this.tradesToday = 0;
      // open-trade tracking (breakeven + trailing)
      this.tradeEntry = null; this.tradeStop = null; this.tradeTgt = null;
      this.tradeRisk = null; this.tradeDir = 0; this.curStop = null;
      this.peak = null;            // favourable extreme since entry (for the trailing stop)
      this._ha = { len: 0, o: [], h: [], l: [], c: [] }; // incremental HA cache (append-only)
      this.reason = '';
    },

    // Extend the cached HA arrays to cover the whole slice (amortized O(1)/bar).
    _ha_extend(candles) {
      const a = this._ha;
      if (candles.length < a.len) { a.len = 0; a.o = []; a.h = []; a.l = []; a.c = []; } // slice shrank → rebuild
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
      const srcC = src.C(n - 1), srcH = src.H(n - 1), srcL = src.L(n - 1);

      // ── pivot P for the current period (previous completed period's H/L/C) ──
      const psrc = pivotSource(candles, P_.pivotTimeframe, src);
      const P = psrc ? (psrc.high + psrc.low + psrc.close) / 3 : null;

      // cross is measured against the previous source close / pivot; remember them
      const prevC = this.prevSrcC, prevP = this.prevP;
      if (P != null) { this.prevSrcC = srcC; this.prevP = P; }

      // ── cooldown + daily-cap bookkeeping (every bar) ──
      const flatNow = !account.position;
      if (this.prevPosition && flatNow) this.barsSinceExit = 0;      // just exited
      else if (flatNow) this.barsSinceExit += 1;
      this.prevPosition = account.position;
      const dayKey = periodKey(candle.time, 'Daily');
      if (this.curDayKey !== dayKey) { this.curDayKey = dayKey; this.tradesToday = 0; }

      // ── manage an OPEN position: breakeven + trailing stop (both only TIGHTEN) ──
      if (account.position) {
        const isLong = account.position === 'long';
        const entry = this.tradeEntry != null ? this.tradeEntry : account.entryPrice;

        // extend the favourable extreme since entry (peak high for longs, low for shorts)
        if (this.peak == null) this.peak = isLong ? srcH : srcL;
        else this.peak = isLong ? Math.max(this.peak, srcH) : Math.min(this.peak, srcL);

        if (this.curStop != null) {
          let newStop = this.curStop;

          // breakeven: once price has moved beR×risk in favour, lift the stop to entry
          if (P_.useBE === 'On' && this.tradeRisk != null && this.tradeRisk > 0) {
            const moved = isLong ? (srcH - entry) : (entry - srcL);
            if (moved >= P_.beR * this.tradeRisk) {
              newStop = isLong ? Math.max(newStop, entry) : Math.min(newStop, entry);
            }
          }

          // trailing: ratchet a stop behind the move (ATR distance or to a moving average)
          if (P_.exitStyle !== 'Fixed bracket') {
            let cand = null;
            if (P_.trailMethod === 'Moving average') {
              const cArr = useHA ? ha.c.slice(0, n) : indicators.closes;
              if (P_.maType === 'SMA') { const a = indicators.sma(cArr, P_.trailMaLen); cand = a[a.length - 1]; }
              else if (P_.maType === 'WMA') { cand = wmaLast(cArr, P_.trailMaLen); }
              else { const a = indicators.ema(cArr, P_.trailMaLen); cand = a[a.length - 1]; }
            } else { // ATR ratchet behind the peak, after an activation move
              const A = atrFromSrc(n, P_.atrLen, src);
              if (A != null && A > 0) {
                const moved = isLong ? (this.peak - entry) : (entry - this.peak);
                if (moved >= P_.trailActivateATR * A) {
                  cand = isLong ? this.peak - P_.trailATR * A : this.peak + P_.trailATR * A;
                }
              }
            }
            if (cand != null) newStop = isLong ? Math.max(newStop, cand) : Math.min(newStop, cand);
          }

          if (newStop !== this.curStop) {
            this.curStop = newStop; this.tradeStop = newStop;
            this.reason = `trail → stop ${newStop.toFixed(2)}` + (this.peak != null ? ` (peak ${this.peak.toFixed(2)})` : '');
            return { stopLoss: newStop, takeProfit: this.tradeTgt };
          }
        }
        this.reason = `holding ${account.position}` + (this.curStop != null ? ` · stop ${this.curStop.toFixed(2)}` : '');
        return null;
      }

      // ── flat: clear per-trade tracking ──
      this.tradeEntry = null; this.tradeStop = null; this.tradeTgt = null;
      this.tradeRisk = null; this.tradeDir = 0; this.curStop = null; this.peak = null;

      if (P == null) { this.reason = 'no prior pivot period yet'; return null; }
      if (prevC == null || prevP == null) { this.reason = 'priming cross'; return null; }

      // ── trade-control gates ──
      if (this.barsSinceExit < P_.cooldown) { this.reason = `cooldown ${this.barsSinceExit}/${P_.cooldown}`; return null; }
      if (P_.maxPerDay > 0 && this.tradesToday >= P_.maxPerDay) { this.reason = `daily cap ${this.tradesToday}/${P_.maxPerDay}`; return null; }
      if (P_.useSession === 'On' && !inSession(candle.time, P_.session)) { this.reason = 'outside session window'; return null; }

      // ── cross detection ──
      const crossUp = prevC <= prevP && srcC > P;
      const crossDn = prevC >= prevP && srcC < P;
      if (!crossUp && !crossDn) { this.reason = `no cross · close ${srcC.toFixed(2)} vs P ${P.toFixed(2)}`; return null; }

      // Volume filter
      let volOK = true;
      if (P_.useVol === 'On') {
        const vols = candles.map((x) => x.volume);
        const va = indicators.sma(vols, P_.volLen);
        const avg = va[va.length - 1];
        volOK = avg != null && candle.volume >= P_.volMult * avg;
      }
      if (!volOK) { this.reason = 'volume below filter'; return null; }

      // Trend filter
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

      if (crossUp && trendUp && longOK) return this._enter('long', srcC, src, n);
      if (crossDn && trendDn && shortOK) return this._enter('short', srcC, src, n);

      this.reason = crossUp ? 'cross up blocked by trend/direction' : 'cross down blocked by trend/direction';
      return null;
    },

    // Build the entry + stop/target bracket and remember it for breakeven tracking.
    _enter(dir, srcC, src, n) {
      const P_ = this.p;
      let stop, target;
      if (P_.exitMode === 'ATR') {
        const A = atrFromSrc(n, P_.atrLen, src);
        if (A == null || !(A > 0)) { this.reason = 'ATR not ready — skip'; return null; }
        stop   = dir === 'long' ? srcC - P_.slATR * A : srcC + P_.slATR * A;
        target = dir === 'long' ? srcC + P_.tpATR * A : srcC - P_.tpATR * A;
      } else {
        stop   = dir === 'long' ? srcC * (1 - P_.stopPct / 100)   : srcC * (1 + P_.stopPct / 100);
        target = dir === 'long' ? srcC * (1 + P_.targetPct / 100) : srcC * (1 - P_.targetPct / 100);
      }
      // "Trailing only" drops the fixed target so winners run until the trailing stop hits.
      if (P_.exitStyle === 'Trailing only') target = null;
      this.tradeEntry = srcC; this.tradeStop = stop; this.tradeTgt = target;
      this.tradeRisk = Math.abs(srcC - stop); this.tradeDir = dir === 'long' ? 1 : -1; this.curStop = stop;
      this.peak = srcC;   // seed the favourable extreme; extends on later bars
      this.tradesToday += 1;
      this.reason = `${dir === 'long' ? 'Bullish' : 'Bearish'} pivot cross @ ${srcC.toFixed(2)} → ` +
        `stop ${stop.toFixed(2)}` + (target != null ? ` / target ${target.toFixed(2)}` : ' / trailing only');
      return { signal: dir, stopLoss: stop, takeProfit: target };
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.pivotcrossimproved = Strategy;
})();
