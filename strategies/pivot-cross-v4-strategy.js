// pivot-cross-v4-strategy.js — "Pivot Cross V4 — CPR Regime + Level Targets".
//
// The V1/V2 family only used the central pivot P and exited on ATR multiples. V4
// upgrades the pivot system in two structural ways:
//
//   1. FULL FLOOR-TRADER LEVEL MAP (from the previous Daily/Weekly/Monthly period's
//      H/L/C, no lookahead):
//        P  = (H+L+C)/3
//        R1 = 2P − L      S1 = 2P − H
//        R2 = P + (H−L)   S2 = P − (H−L)
//        R3 = R1 + (H−L)  S3 = S1 − (H−L)
//      Stops and targets sit on REAL structure — a long off P targets R1, a long off
//      R1 targets R2, etc. The "TP basis" is the next level, not an arbitrary ATR mult.
//
//   2. CPR (Central Pivot Range) REGIME FILTER:
//        BC = (H+L)/2     TC = 2P − BC     width = |TC − BC|
//      A NARROW CPR (vs its recent average) flags a likely TRENDING period → take
//      breakout/continuation trades through levels and hold toward the next level,
//      letting a trailing stop ride. A WIDE CPR flags a RANGE period → fade the outer
//      levels (short R2/R3 / long S2/S3) back toward P. Trading the right mode for the
//      regime is where the edge comes from: pivots bleed when you fade trends or chase
//      breakouts in chop.
//
// Engine contract (strategy.js simulate / live replay): onCandle returns
// { signal, stopLoss, takeProfit } on entry and may return updated {stopLoss,...}
// each later bar to trail. Sizing/fees/slippage come from Trade Sim (single source of
// truth) — no money params here. (Markers: 🟢 long, 🔴 short, 🔵 close.)
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

  // Full floor-trader pivot map + CPR from a previous-period {high,low,close}.
  function pivotLevels(hlc) {
    const { high: H, low: L, close: C } = hlc;
    const P = (H + L + C) / 3;
    const range = H - L;
    const BC = (H + L) / 2;
    const TC = 2 * P - BC;
    return {
      P,
      R1: 2 * P - L, S1: 2 * P - H,
      R2: P + range, S2: P - range,
      R3: (2 * P - L) + range, S3: (2 * P - H) - range,
      BC: Math.min(BC, TC), TC: Math.max(BC, TC), // normalize so TC ≥ BC
      cprWidth: Math.abs(TC - BC),
    };
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
    name: 'Pivot Cross V4 — CPR Regime + Level Targets',
    description: 'Trades the full floor-trader pivot map (P, R1–R3, S1–S3) from the previous ' +
      'Daily/Weekly/Monthly period, with a CPR (Central Pivot Range) regime filter. A NARROW CPR ' +
      'flags a trending period → take breakout/continuation trades through a level, target the next ' +
      'level, and ride with an ATR trailing stop. A WIDE CPR flags a range → fade the outer levels ' +
      '(short R2/R3, long S2/S3) back toward P. Stops/targets sit on real structure (the adjacent ' +
      'level) rather than arbitrary ATR multiples. Gated by optional trend MA, volume and direction. ' +
      'Sizing/fees come from Trade Sim. "Use Heikin Ashi" makes every source read HA candles (off by ' +
      'default — HA fills aren\'t achievable live). Markers: 🟢 long, 🔴 short, 🔵 close.',
    warmUpBars: 60,

    // Draws the TradingView picture during Watch Replay: the full floor-trader level
    // map (P + R1–R3 / S1–S3 — the structure stops/targets sit on) plus the generic
    // per-trade green profit / red risk boxes + entry/exit triangles & labels. Boxes
    // follow the trailing stop on trend runners (the engine re-reads stopLoss).
    overlay: true,

    params: {
      useHA:        { label: 'Use Heikin Ashi', type: 'select', options: ['Off', 'On'], default: 'Off' },
      pivotTimeframe: { label: 'Pivot timeframe', type: 'select', options: ['Daily', 'Weekly', 'Monthly'], default: 'Daily' },
      regimeMode:   { label: 'Regime mode',   type: 'select', options: ['Auto', 'Trend only', 'Range only'], default: 'Auto' },
      cprLookback:  { label: 'CPR width lookback (periods)', type: 'number', default: 10, min: 2, max: 60 },
      cprNarrowPct: { label: 'Narrow CPR ≤ % of avg', type: 'number', default: 80, min: 10, max: 100, step: 5 },
      breakBufferATR: { label: 'Break buffer × ATR',  type: 'number', default: 0.1, min: 0, max: 2, step: 0.05 },
      fadeWickFrac: { label: 'Fade rejection wick frac', type: 'number', default: 0.4, min: 0.1, max: 0.9, step: 0.05 },
      useTrend:     { label: 'Trend filter',  type: 'select', options: ['On', 'Off'], default: 'On' },
      maType:       { label: 'MA type',       type: 'select', options: ['EMA', 'SMA', 'WMA'], default: 'EMA' },
      maLen:        { label: 'MA length',     type: 'number', default: 50,  min: 10, max: 400 },
      direction:    { label: 'Direction',     type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
      useVol:       { label: 'Volume filter (breakouts)', type: 'select', options: ['On', 'Off'], default: 'On' },
      volLen:       { label: 'Volume MA length', type: 'number', default: 20, min: 5,  max: 50 },
      volMult:      { label: 'Volume × avg',  type: 'number', default: 1.2, min: 0.5, max: 3, step: 0.1 },
      atrLen:       { label: 'ATR length',    type: 'number', default: 14,  min: 5,  max: 50 },
      stopBufferATR: { label: 'Stop buffer past level × ATR', type: 'number', default: 0.75, min: 0.1, max: 4, step: 0.05 },
      minRRtrend:   { label: 'Min reward:risk (trend)', type: 'number', default: 1.2, min: 0.3, max: 5, step: 0.1 },
      useTrail:     { label: 'Trail trend runners', type: 'select', options: ['On', 'Off'], default: 'On' },
      trailActivateATR: { label: 'Trail activates after × ATR', type: 'number', default: 1.5, min: 0.1, max: 10, step: 0.1 },
      trailATR:     { label: 'Trail distance × ATR', type: 'number', default: 2.5, min: 0.3, max: 10, step: 0.1 },
    },

    // Engine has ma/volume indicator types; the pivot levels are reflected by the
    // SL/TP/entry lines TradeSim draws during replay.
    chartIndicators(p) {
      p = p || {};
      const maType = (p.maType === 'WMA') ? 'EMA' : (p.maType || 'EMA');
      return [
        { type: 'ma',     visible: p.useTrend !== 'Off', params: { period: p.maLen || 50, maType, color: '#f59e0b', lineWidth: 1 } },
        { type: 'volume', visible: p.useVol !== 'Off', params: {} },
      ];
    },

    // Stepped full floor-trader level map for the overlay (P orange; R1–R3 red,
    // S1–S3 green) — the structure breaks/fades trigger off and targets sit on.
    overlaySeries(candles, params) {
      const tf = (params && params.pivotTimeframe) || 'Daily';
      const src = srcView(candles, params && params.useHA === 'On');
      const prev = prevPeriodSeries(candles, tf, src);
      const P = (s) => (s.hi + s.lo + s.close) / 3;
      const rng = (s) => s.hi - s.lo;
      const R1 = (s) => 2 * P(s) - s.lo, S1 = (s) => 2 * P(s) - s.hi;
      const mk = (fn) => candles.map((c, i) => ({ time: c.time, value: prev[i] ? fn(prev[i]) : null }));
      const R = 'rgba(239,83,80,', G = 'rgba(38,166,154,';
      const pivot = mk(P);
      const lines = [
        { label: 'R1', color: R + '0.55)', data: mk(R1) },
        { label: 'R2', color: R + '0.4)',  data: mk((s) => P(s) + rng(s)) },
        { label: 'R3', color: R + '0.3)',  data: mk((s) => R1(s) + rng(s)) },
        { label: 'S1', color: G + '0.55)', data: mk(S1) },
        { label: 'S2', color: G + '0.4)',  data: mk((s) => P(s) - rng(s)) },
        { label: 'S3', color: G + '0.3)',  data: mk((s) => S1(s) - rng(s)) },
      ];
      return { pivot, lines };
    },

    init(params) {
      this.p = params;
      this.prevC = null;           // previous bar's source close (for level crosses)
      this.curKey = null;          // current pivot-period key (to detect period rollover)
      this.cprHist = [];           // rolling history of completed-period CPR widths
      this.lastSeenPrevKey = null; // last previous-period key folded into cprHist
      this.peak = null;            // extreme favourable price since entry
      this.curStop = null;
      this.curTarget = null;
      this.tradeKind = null;       // 'trend' | 'fade'
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

    // The two adjacent levels that bracket `price` (for picking entry/target/stop).
    _levelArray(L) {
      return [
        { name: 'S3', v: L.S3 }, { name: 'S2', v: L.S2 }, { name: 'S1', v: L.S1 },
        { name: 'P',  v: L.P },
        { name: 'R1', v: L.R1 }, { name: 'R2', v: L.R2 }, { name: 'R3', v: L.R3 },
      ].sort((a, b) => a.v - b.v);
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
      const srcC = src.C(n - 1), srcO = src.O(n - 1), srcH = src.H(n - 1), srcL = src.L(n - 1);

      const psrc = pivotSource(candles, P_.pivotTimeframe, src);
      const L = psrc ? pivotLevels(psrc) : null;
      const A = atrFromSrc(n, P_.atrLen, src);

      // ── manage an OPEN position: trail trend runners behind the peak ──
      if (account.position) {
        const isLong = account.position === 'long';
        if (this.peak == null) this.peak = isLong ? srcH : srcL;
        else this.peak = isLong ? Math.max(this.peak, srcH) : Math.min(this.peak, srcL);

        if (this.tradeKind === 'trend' && P_.useTrail === 'On' && A != null && A > 0 && this.curStop != null) {
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
        this.reason = `holding ${account.position} (${this.tradeKind})`;
        return null;
      }

      // ── flat: clear per-trade tracking ──
      this.peak = null; this.curStop = null; this.curTarget = null; this.tradeKind = null;

      if (L == null) { this.reason = 'no prior pivot period yet'; return null; }

      // ── fold each newly-completed period's CPR width into the rolling history ──
      const prevPeriodKey = (() => {
        // key of the period just before the current one (the period that produced L)
        let i = n - 1; const cur = periodKey(candles[n - 1].time, P_.pivotTimeframe);
        while (i >= 0 && periodKey(candles[i].time, P_.pivotTimeframe) === cur) i--;
        return i >= 0 ? periodKey(candles[i].time, P_.pivotTimeframe) : null;
      })();
      if (prevPeriodKey != null && prevPeriodKey !== this.lastSeenPrevKey) {
        this.lastSeenPrevKey = prevPeriodKey;
        this.cprHist.push(L.cprWidth);
        if (this.cprHist.length > P_.cprLookback) this.cprHist.shift();
      }

      // ── classify regime via CPR width vs its recent average ──
      const avgCpr = this.cprHist.length ? this.cprHist.reduce((a, b) => a + b, 0) / this.cprHist.length : L.cprWidth;
      const narrow = avgCpr > 0 ? (L.cprWidth <= (P_.cprNarrowPct / 100) * avgCpr) : false;
      let regime; // 'trend' | 'range'
      if (P_.regimeMode === 'Trend only') regime = 'trend';
      else if (P_.regimeMode === 'Range only') regime = 'range';
      else regime = narrow ? 'trend' : 'range';

      // cross bookkeeping
      const prevC = this.prevC;
      this.prevC = srcC;
      if (prevC == null) { this.reason = 'priming'; return null; }
      if (A == null || !(A > 0)) { this.reason = 'ATR not ready'; return null; }

      // ── shared filters ──
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

      let volOK = true;
      if (P_.useVol === 'On') {
        const vols = candles.map((x) => x.volume);
        const va = indicators.sma(vols, P_.volLen);
        const avg = va[va.length - 1];
        volOK = avg != null && candle.volume >= P_.volMult * avg;
      }

      const levels = this._levelArray(L);
      const buf = P_.breakBufferATR * A;

      // ════════════════════ TREND REGIME — break a level, target the next ════════════════════
      if (regime === 'trend') {
        if (!volOK) { this.reason = 'trend: volume below filter'; return null; }
        // find a level the close just broke through (prev on one side, now beyond + buffer)
        for (let k = 0; k < levels.length; k++) {
          const lv = levels[k].v;
          const brokeUp = prevC <= lv && srcC > lv + buf;
          const brokeDn = prevC >= lv && srcC < lv - buf;
          if (brokeUp && longOK && trendUp) {
            const next = levels[k + 1]; // target = next level up
            if (!next) { this.reason = `break above ${levels[k].name} but no higher level`; return null; }
            const stop = lv - P_.stopBufferATR * A; // back below the broken level
            return this._enterTrend('long', srcC, stop, next.v, `break ${levels[k].name}→${next.name}`);
          }
          if (brokeDn && shortOK && trendDn) {
            const next = levels[k - 1]; // target = next level down
            if (!next) { this.reason = `break below ${levels[k].name} but no lower level`; return null; }
            const stop = lv + P_.stopBufferATR * A;
            return this._enterTrend('short', srcC, stop, next.v, `break ${levels[k].name}→${next.name}`);
          }
        }
        this.reason = `trend regime · no fresh level break · close ${srcC.toFixed(2)}`;
        return null;
      }

      // ════════════════════ RANGE REGIME — fade the outer levels back to P ════════════════════
      // Only fade the outer bands (R2/R3, S2/S3); require a rejection wick at the level.
      const rng = Math.max(srcH - srcL, 1e-9);
      const upWick = (srcH - Math.max(srcO, srcC)) / rng;   // upper-wick fraction (sellers rejected highs)
      const dnWick = (Math.min(srcO, srcC) - srcL) / rng;   // lower-wick fraction (buyers rejected lows)
      const tol = buf;

      const fadeShorts = [{ name: 'R2', v: L.R2 }, { name: 'R3', v: L.R3 }];
      const fadeLongs  = [{ name: 'S2', v: L.S2 }, { name: 'S3', v: L.S3 }];

      if (shortOK && (P_.useTrend === 'Off' || trendDn || true)) {
        for (const band of fadeShorts) {
          const tagged = srcH >= band.v - tol;                 // tagged the resistance band
          const rejected = srcC < band.v && upWick >= P_.fadeWickFrac;
          if (tagged && rejected) {
            const stop = band.v + P_.stopBufferATR * A;         // just beyond the band
            const target = L.P;                                  // mean-revert toward P
            if (target >= srcC) { this.reason = `fade ${band.name}: target P not below`; continue; }
            return this._enterFade('short', srcC, stop, target, `fade ${band.name}→P`);
          }
        }
      }
      if (longOK) {
        for (const band of fadeLongs) {
          const tagged = srcL <= band.v + tol;
          const rejected = srcC > band.v && dnWick >= P_.fadeWickFrac;
          if (tagged && rejected) {
            const stop = band.v - P_.stopBufferATR * A;
            const target = L.P;
            if (target <= srcC) { this.reason = `fade ${band.name}: target P not above`; continue; }
            return this._enterFade('long', srcC, stop, target, `fade ${band.name}→P`);
          }
        }
      }
      this.reason = `range regime · no fade setup · close ${srcC.toFixed(2)}`;
      return null;
    },

    // Trend entry: structure stop + next-level target, with a min reward:risk gate.
    // Trailing (if on) lets a runner exceed the target level.
    _enterTrend(dir, entry, stop, target, tag) {
      const P_ = this.p;
      const risk = Math.abs(entry - stop);
      const reward = Math.abs(target - entry);
      if (!(risk > 0)) { this.reason = `${tag}: zero risk — skip`; return null; }
      if (reward / risk < P_.minRRtrend) { this.reason = `${tag}: R:R ${(reward / risk).toFixed(2)} < ${P_.minRRtrend}`; return null; }
      this.curStop = stop; this.curTarget = target; this.peak = entry; this.tradeKind = 'trend';
      this.reason = `Trend ${dir} ${tag} @ ${entry.toFixed(2)} → stop ${stop.toFixed(2)} / target ${target.toFixed(2)} (R:R ${(reward / risk).toFixed(2)})`;
      return { signal: dir, stopLoss: stop, takeProfit: target };
    },

    // Fade entry: tight stop beyond the band, fixed target at P (no trailing — banked).
    _enterFade(dir, entry, stop, target, tag) {
      const risk = Math.abs(entry - stop);
      if (!(risk > 0)) { this.reason = `${tag}: zero risk — skip`; return null; }
      this.curStop = stop; this.curTarget = target; this.peak = entry; this.tradeKind = 'fade';
      this.reason = `Fade ${dir} ${tag} @ ${entry.toFixed(2)} → stop ${stop.toFixed(2)} / target ${target.toFixed(2)}`;
      return { signal: dir, stopLoss: stop, takeProfit: target };
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.pivotcrossv4 = Strategy;
})();
