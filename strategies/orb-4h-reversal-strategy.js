// orb-4h-reversal-strategy.js — 4H Opening Range Breakout-Reversal.
//
// Strategy file contract (see registry.js / emacross-strategy.js):
//   candle:     { time, open, high, low, close, volume }
//   indicators: { ema(closes,p), sma(closes,p), rsi(closes,p), closes[], candles[] }
//   account:    { position:'long'|'short'|null, entryPrice, balance }
//   onCandle return: 'long' | 'short' | 'close' | { signal, stopLoss, takeProfit } | null
//
// THE IDEA (counter-trend reversal):
//   • The first N-hour window of each trading day defines a "4H Range" (high/low).
//   • Once that window closes, watch lower-TF candles for a CLOSE beyond the range.
//   • After such a breakout, watch for the first candle that CLOSES back inside the
//     range — that re-entry is the signal, traded AGAINST the breakout:
//        bullish breakout → re-entry  ⇒ SHORT
//        bearish breakout → re-entry  ⇒ LONG
//   • Stop = the most extreme price reached between breakout and re-entry (with an
//     ATR-bounded fallback). Target = rrRatio × stop distance.
//
// IMPORTANT — like Pivot Cross, this evaluates STATELESSLY from history:
//   onCandle() reconstructs the current trading day's range + breakout state from
//   indicators.candles every bar, so it trades correctly no matter where Watch Replay
//   starts (it doesn't need to have "seen" the opening-range window live). The engine
//   indexes into the full candle array (no per-bar slicing) to keep that cheap.
//
// TWO EXECUTION PATHS share ONE engine (makeOrbEngine):
//   1. onCandle()  — app's live replay + overlay + standard Results modal. The app fills
//                    at candle close, so entries land at the re-entry candle's close
//                    regardless of entry mode (a visual approximation).
//   2. runStats()  — a precise batch backtest used by the Statistical Report. It honors
//                    entry_mode exactly, simulates worst-case (stop-first) fills, and
//                    returns every trade in R-multiples with the full Part-2 trade log.
(function () {
  'use strict';

  // Fixed UTC offsets per timezone (DST is ignored — documented in the report Guide).
  const TZ_OFFSET = {
    'America/New_York': -5,
    'Europe/London': 0,
    'Asia/Tokyo': 9,
    'UTC': 0,
  };

  // ---- small math helpers (index into the full candle array, no slicing) ----
  // ATR at absolute index `idx` (Wilder-style simple mean of TR over `period` bars).
  function atrAt(candles, idx, period) {
    if (idx < period) return null;
    let sum = 0;
    for (let i = idx - period + 1; i <= idx; i++) {
      const c = candles[i], p = candles[i - 1];
      sum += Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    }
    return sum / period;
  }

  // Nearest confirmed swing beyond `entry` that is CLOSER than `rawStop`, searching the
  // ~120 bars before `idx`.
  //   side 'short' → stop sits ABOVE entry, look for a swing HIGH in (entry, rawStop)
  //   side 'long'  → stop sits BELOW entry, look for a swing LOW  in (rawStop, entry)
  // A swing point is a local extreme with `k` lower/higher neighbours on each side.
  function nearestSwing(candles, idx, side, entry, rawStop, k) {
    let best = null;
    const lo = Math.max(k, idx - 120);
    for (let i = idx - 1 - k; i >= lo; i--) {
      const c = candles[i];
      let isSwing = true;
      if (side === 'short') {
        for (let j = i - k; j <= i + k; j++) { if (j !== i && candles[j].high >= c.high) { isSwing = false; break; } }
        if (isSwing && c.high > entry && c.high < rawStop) {
          if (best == null || c.high < best) best = c.high; // closest to entry = smallest level
        }
      } else {
        for (let j = i - k; j <= i + k; j++) { if (j !== i && candles[j].low <= c.low) { isSwing = false; break; } }
        if (isSwing && c.low < entry && c.low > rawStop) {
          if (best == null || c.low > best) best = c.low;   // closest to entry = largest level
        }
      }
    }
    return best;
  }

  // ---- the shared engine ---------------------------------------------------
  // Stateful machine. Call step(candles, idx) once per candle in time order, where
  // candles is the full array and idx is the current bar.
  // Returns an `entry` event on the exact candle a trade should be entered, else null:
  //   { dir, entryPrice, stop, target, stopMethod, rangeHigh, rangeLow,
  //     breakoutTime, breakoutClose, reentryTime, reentryClose }
  function makeOrbEngine(p) {
    const tzOff = (TZ_OFFSET[p.timezone] != null ? TZ_OFFSET[p.timezone] : 0) * 3600;
    const rangeSecs = Math.max(1, p.rangeHours) * 3600;
    const startOff = (p.rangeStartHour || 0) * 3600;
    const rr = p.rrRatio > 0 ? p.rrRatio : 2;
    const atrP = p.atrPeriod || 14;
    const maxMult = p.maxStopAtrMult > 0 ? p.maxStopAtrMult : 1.5;

    let dayIdx = null;        // current trading-day index
    let rangeHigh = null, rangeLow = null, sawWindow = false;
    let rangeValid = false;   // window closed & range captured
    let dir = null;           // active breakout direction: 'up' | 'down' | null
    let extreme = null;       // most extreme price since breakout (stop candidate)
    let boTime = null, boClose = null;       // breakout candle
    let pending = null;       // deferred entry for entry_mode = next_candle_open

    function localSec(t) { return t + tzOff; }
    function dayOf(t) { return Math.floor((localSec(t) - startOff) / 86400); }

    function resetDay() {
      rangeHigh = rangeLow = null; sawWindow = false; rangeValid = false;
      dir = null; extreme = null; boTime = boClose = null; pending = null;
    }

    // Build the concrete entry event from a captured re-entry (ATR/swing read at idx).
    function buildEntry(side, entryPrice, candles, idx) {
      const rawStop = extreme;
      let stop = rawStop, method = 'extreme';
      let stopDist = Math.abs(entryPrice - rawStop);
      const atr = atrAt(candles, idx, atrP);
      const maxStop = atr != null ? maxMult * atr : null;

      if (maxStop != null && stopDist > maxStop) {
        if (p.stopFallback === 'skip') {
          return { skip: true };
        } else if (p.stopFallback === 'volatility') {
          stop = side === 'short' ? entryPrice + maxStop : entryPrice - maxStop;
          method = 'volatility';
        } else { // 'swing' (default)
          const sw = nearestSwing(candles, idx, side, entryPrice, rawStop, 2);
          if (sw != null) { stop = sw; method = 'swing'; }
          else if (atr != null) { stop = side === 'short' ? entryPrice + maxStop : entryPrice - maxStop; method = 'volatility'; }
        }
        stopDist = Math.abs(entryPrice - stop);
      }
      if (!(stopDist > 0)) return { skip: true }; // degenerate stop
      const target = side === 'short' ? entryPrice - rr * stopDist : entryPrice + rr * stopDist;
      return {
        dir: side, entryPrice, stop, target, stopMethod: method,
        rangeHigh, rangeLow, breakoutTime: boTime, breakoutClose: boClose,
      };
    }

    function step(candles, idx) {
      const c = candles[idx];
      const d = dayOf(c.time);
      if (dayIdx === null || d !== dayIdx) { dayIdx = d; resetDay(); }

      // resolve a deferred (next-candle-open) entry first, on THIS candle's open
      if (pending) {
        const side = pending.side;
        pending = null;
        const ev = buildEntry(side, c.open, candles, idx);
        dir = null; extreme = null; // reset breakout state after taking the setup
        if (!ev.skip) { ev.reentryTime = c.time; ev.reentryClose = c.close; return ev; }
        return null;
      }

      const startLocal = dayIdx * 86400 + startOff;          // local sec
      const endLocal = startLocal + rangeSecs;
      const lt = localSec(c.time);

      // Phase A — accumulate the opening-range window
      if (lt < endLocal) {
        rangeHigh = rangeHigh == null ? c.high : Math.max(rangeHigh, c.high);
        rangeLow = rangeLow == null ? c.low : Math.min(rangeLow, c.low);
        sawWindow = true;
        return null;
      }

      // Phase B — range valid (only if we actually saw window candles)
      if (!sawWindow || rangeHigh == null) { rangeValid = false; return null; }
      rangeValid = true;

      // breakout detection (on CLOSE)
      if (dir === null) {
        if (c.close > rangeHigh) { dir = 'up'; extreme = c.high; boTime = c.time; boClose = c.close; }
        else if (c.close < rangeLow) { dir = 'down'; extreme = c.low; boTime = c.time; boClose = c.close; }
        return null;
      }

      // tracking an active breakout → update extreme, watch for re-entry
      if (dir === 'up') {
        extreme = Math.max(extreme, c.high);
        if (c.close <= rangeHigh) {           // re-entry → SHORT
          if (p.entryMode === 'next_candle_open') { pending = { side: 'short' }; dir = null; return null; }
          const ev = buildEntry('short', c.close, candles, idx);
          dir = null; extreme = null;
          if (!ev.skip) { ev.reentryTime = c.time; ev.reentryClose = c.close; return ev; }
        }
      } else if (dir === 'down') {
        extreme = Math.min(extreme, c.low);
        if (c.close >= rangeLow) {            // re-entry → LONG
          if (p.entryMode === 'next_candle_open') { pending = { side: 'long' }; dir = null; return null; }
          const ev = buildEntry('long', c.close, candles, idx);
          dir = null; extreme = null;
          if (!ev.skip) { ev.reentryTime = c.time; ev.reentryClose = c.close; return ev; }
        }
      }
      return null;
    }

    return { step, isRangeValid: () => rangeValid, range: () => ({ high: rangeHigh, low: rangeLow }) };
  }

  // First index of the trading day that `candles[idx]` belongs to.
  function dayStartIndex(candles, idx, p) {
    const tzOff = (TZ_OFFSET[p.timezone] != null ? TZ_OFFSET[p.timezone] : 0) * 3600;
    const startOff = (p.rangeStartHour || 0) * 3600;
    const t = candles[idx].time;
    const day = Math.floor((t + tzOff - startOff) / 86400);
    const dayStartUTC = day * 86400 + startOff - tzOff;
    let j = idx;
    while (j > 0 && candles[j - 1].time >= dayStartUTC) j--;
    return j;
  }

  // ---- precise batch backtest (Statistical Report path) --------------------
  // Returns { trades, config }. Each trade carries the full Part-2 trade log,
  // with R_result = signed price move ÷ stop distance (gross, pre-cost).
  function runStats(candles, prms) {
    const p = normalizeParams(prms);
    const eng = makeOrbEngine(p);
    const trades = [];
    let open = null; // { dir, entry, stop, target, entryIndex, stopMethod, meta }

    const sign = (r) => (r > 0 ? 1 : r < 0 ? -1 : 0);
    function streakAtEntry() {
      if (!trades.length) return 0;
      const lastSign = sign(trades[trades.length - 1].R_result);
      if (lastSign === 0) return 0;
      let n = 0;
      for (let i = trades.length - 1; i >= 0; i--) {
        if (sign(trades[i].R_result) === lastSign) n++; else break;
      }
      return lastSign * n;
    }
    function closeTrade(exitPrice, reason, exitTime) {
      const dist = Math.abs(open.entry - open.stop);
      const move = open.dir === 'long' ? (exitPrice - open.entry) : (open.entry - exitPrice);
      const R = dist > 0 ? move / dist : 0;
      trades.push({
        date: new Date(open.meta.reentryTime * 1000).toISOString().slice(0, 10),
        direction: open.dir,
        range_high: open.meta.rangeHigh,
        range_low: open.meta.rangeLow,
        breakout_candle_time: open.meta.breakoutTime,
        breakout_candle_close: open.meta.breakoutClose,
        reentry_candle_time: open.meta.reentryTime,
        reentry_candle_close: open.meta.reentryClose,
        entry_price: open.entry,
        stop_price: open.stop,
        target_price: open.target,
        stop_method_used: open.stopMethod,
        streak_at_entry: open.streakAtEntry,
        exit_reason: reason,
        exit_time: exitTime,
        R_result: R,
      });
      open = null;
    }

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];

      // 1) manage an open position FIRST (worst case: stop checked before target)
      if (open && i > open.entryIndex) {
        const isLong = open.dir === 'long';
        const hitSL = isLong ? c.low <= open.stop : c.high >= open.stop;
        const hitTP = isLong ? c.high >= open.target : c.low <= open.target;
        if (hitSL) { closeTrade(open.stop, 'Stop loss', c.time); }
        else if (hitTP) { closeTrade(open.target, 'Take profit', c.time); }
      }

      // 2) advance the engine (keeps day/range state in sync every candle)
      let ev = null;
      try { ev = eng.step(candles, i); } catch (_) { ev = null; }

      // 3) take a new entry only when flat (single position at a time)
      if (ev && !ev.skip && !open) {
        open = {
          dir: ev.dir, entry: ev.entryPrice, stop: ev.stop, target: ev.target,
          entryIndex: i, stopMethod: ev.stopMethod, streakAtEntry: streakAtEntry(), meta: ev,
        };
      }
    }
    if (open) closeTrade(candles[candles.length - 1].close, 'Session end', candles[candles.length - 1].time);

    return { trades, config: p };
  }

  function normalizeParams(prms) {
    const p = Object.assign({}, prms);
    p.rangeHours = +p.rangeHours || 4;
    p.rangeStartHour = +p.rangeStartHour || 0;
    p.rrRatio = +p.rrRatio || 2;
    p.maxStopAtrMult = +p.maxStopAtrMult || 1.5;
    p.atrPeriod = +p.atrPeriod || 14;
    p.riskPerTradePct = +p.riskPerTradePct || 1;
    p.startingCapital = +p.startingCapital || 10000;
    p.spreadCostR = +p.spreadCostR || 0;
    p.commissionCostR = +p.commissionCostR || 0;
    p.slippageCostR = +p.slippageCostR || 0;
    return p;
  }

  // ---- the Strategy object (live replay + standard backtest) ---------------
  const Strategy = {
    name: '4H Opening Range Breakout-Reversal',
    description:
      'Counter-trend reversal. The first N-hour window of each trading day sets a range; ' +
      'after price CLOSES beyond it and then CLOSES back inside, fade the breakout ' +
      '(bull breakout→short, bear breakout→long). Stop = extreme reached during the ' +
      'excursion (ATR-bounded fallback); target = RR × stop. Run on a low timeframe ' +
      '(e.g. 5m/15m). Click "Full Statistical Report" after a backtest for expectancy, ' +
      'confidence intervals, variance, gambler\'s-fallacy and risk-of-ruin analysis.',
    warmUpBars: 20,
    overlay: true,

    params: {
      timezone: { label: 'Timezone', type: 'select',
        options: ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'UTC'], default: 'America/New_York' },
      rangeStartHour: { label: 'Range start hour (local)', type: 'number', default: 0, min: 0, max: 23 },
      rangeHours: { label: 'Range length (hours)', type: 'number', default: 4, min: 1, max: 12 },
      rrRatio: { label: 'Reward : Risk', type: 'number', default: 2, min: 0.5, max: 10, step: 0.5 },
      entryMode: { label: 'Entry fill', type: 'select',
        options: ['reentry_close', 'next_candle_open'], default: 'reentry_close' },
      maxStopAtrMult: { label: 'Max stop (× ATR)', type: 'number', default: 1.5, min: 0.5, max: 10, step: 0.5 },
      stopFallback: { label: 'Stop fallback', type: 'select',
        options: ['swing', 'volatility', 'skip'], default: 'swing' },
      atrPeriod: { label: 'ATR period', type: 'number', default: 14, min: 2, max: 100 },
      riskPerTradePct: { label: 'Risk per trade (%)', type: 'number', default: 1, min: 0.1, max: 10, step: 0.1 },
      startingCapital: { label: 'Starting capital ($)', type: 'number', default: 10000, min: 100 },
      spreadCostR: { label: 'Spread cost (R)', type: 'number', default: 0.05, min: 0, max: 1, step: 0.01 },
      commissionCostR: { label: 'Commission cost (R)', type: 'number', default: 0.03, min: 0, max: 1, step: 0.01 },
      slippageCostR: { label: 'Slippage cost (R)', type: 'number', default: 0.02, min: 0, max: 1, step: 0.01 },
    },

    init(params) {
      this._p = normalizeParams(params);
      this.reason = '';
    },

    // Stateless evaluation: rebuild the current day's range + breakout state from
    // history, return the signal for the CURRENT (last) candle. Works no matter where
    // replay starts, exactly like Pivot Cross recomputes its pivot each bar.
    onCandle(candle, indicators) {
      const p = this._p;
      const candles = indicators.candles;
      const idx = candles.length - 1;
      if (idx < 1) { this.reason = 'Waiting for data'; return null; }

      const eng = makeOrbEngine(p);
      const start = dayStartIndex(candles, idx, p);
      let ev = null;
      try { for (let j = start; j <= idx; j++) ev = eng.step(candles, j); }
      catch (_) { ev = null; }

      const r = eng.range();
      if (!ev || ev.skip) {
        this.reason = r.high != null
          ? `Range ${fmt(r.low)}–${fmt(r.high)}${eng.isRangeValid() ? ' · watching for breakout/re-entry' : ' · forming'}`
          : 'Waiting for opening range';
        return null;
      }
      this.reason = `${ev.dir.toUpperCase()} reversal · range ${fmt(ev.rangeLow)}–${fmt(ev.rangeHigh)} · ` +
        `stop ${fmt(ev.stop)} (${ev.stopMethod}) · target ${fmt(ev.target)}`;
      return { signal: ev.dir, stopLoss: ev.stop, takeProfit: ev.target };
    },

    // Opening-range reference line for the overlay (stepped range high while valid).
    overlaySeries(candles, params) {
      const eng = makeOrbEngine(normalizeParams(params));
      const pivot = [];
      for (let i = 0; i < candles.length; i++) {
        try { eng.step(candles, i); } catch (_) {}
        const r = eng.range();
        pivot.push({ time: candles[i].time, value: eng.isRangeValid() && r.high != null ? r.high : null });
      }
      return { pivot };
    },

    // exposed for the Statistical Report
    runStats,
  };

  function fmt(v) { return v == null ? '–' : (v >= 1000 ? v.toFixed(1) : v.toFixed(2)); }

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.orb4h = Strategy;
})();
