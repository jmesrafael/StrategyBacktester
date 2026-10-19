// fixed-mtf-golden-cross-strategy.js — "Fixed-MTF Golden Cross + MACD + Weekly Pivots (SMC)".
//
// THE IDEA (ported from the pasted "⭕FIXED MTF EMA" Pine indicator): every trend
// indicator is computed on a FIXED timeframe that you set, NO MATTER which timeframe the
// chart is on. The chart candles are resampled up to that fixed TF (e.g. 4H / Daily /
// Weekly), the EMAs + MACD are computed on the resampled closes, and only the value of the
// last CLOSED higher-TF bar is used on the current chart bar (non-repainting, leak-free —
// the same `request.security(... [isrealtime?1:0])[isrealtime?0:1]` confirmed-value trick).
//
// So on a 5m or 15m or 1h chart you still trade off the SAME Daily/4H golden cross.
//
// ENTRY (long; short is the mirror), evaluated on every chart bar while flat:
//   1. Golden cross   — fixed-TF fast EMA above slow EMA  (regime, or a fresh cross only).
//   2. MACD           — fixed-TF MACD confirms momentum (line>signal / histogram>0 / fresh cross).
//   3. Weekly pivots  — chart price is on the bullish side of the floor-trader pivot P
//                       (from the previous completed week), used as the bias line + targets.
//   4. (opt) Price vs fast EMA — chart close holding above the fixed-TF fast EMA.
//   5. (opt) SMC      — a fresh directional Fair-Value-Gap (3-bar imbalance) in the last K
//                       chart bars validates that smart-money displacement is present, so we
//                       only take HIGH-QUALITY setups, not every cross.
//   The entry fires on the RISING EDGE of "all conditions true" (so one trade per setup,
//   not one per bar), gated by a post-exit cooldown + a Long/Short/Both direction switch.
//
// EXIT: ATR stop (= 1R) and an ATR target, with the winners-run options from the pivot
// strategies — "Trailing only" / "Trailing + target" / "Fixed bracket" — plus an optional
// regime-flip exit (close the moment the fixed-TF trend or MACD flips against the position).
// Sizing/fees come from Trade Sim, so the tester report is NET of commission + slippage.
//
// Engine contract (see README + js/strategy.js): export one Strategy object, register it on
// window.__STRATEGIES[id]. onCandle(candle, indicators, account) returns { signal, stopLoss,
// takeProfit } on entry, an updated { stopLoss } while trailing, 'close' on a regime flip,
// or null. indicators = { ema, sma, rsi, closes[], candles[] }. Markers: 🟢 long, 🔴 short, 🔵 close.
//
// OVERLAY (drawn during Watch Replay only — strategy declares `overlay: true`): the stepped
// weekly pivot P (orange) + R1/S1 context lines, and the two FIXED-TF EMAs as stepped lines
// so you literally see the higher-TF golden cross on whatever chart TF you're viewing.
(function () {
  // ── EMA over a numeric array, SMA-seeded — identical math to js/indicators.js. ──────────
  function emaArr(values, period) {
    const out = new Array(values.length).fill(null);
    if (period < 1) return out;
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) continue;
      if (prev === null) { let s = 0; for (let j = i - period + 1; j <= i; j++) s += values[j]; prev = s / period; }
      else prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  // ── MACD line / signal / histogram as full-length arrays (null where not computable). ──
  function macdArrays(closes, fast, slow, sig) {
    const fastE = emaArr(closes, fast), slowE = emaArr(closes, slow);
    const macd = closes.map((_, i) => (fastE[i] != null && slowE[i] != null) ? fastE[i] - slowE[i] : null);
    const signal = new Array(closes.length).fill(null);
    let firstValid = macd.findIndex((v) => v != null);
    if (firstValid !== -1) {
      const sigC = emaArr(macd.slice(firstValid), sig);
      for (let j = 0; j < sigC.length; j++) if (sigC[j] != null) signal[firstValid + j] = sigC[j];
    }
    const hist = closes.map((_, i) => (macd[i] != null && signal[i] != null) ? macd[i] - signal[i] : null);
    return { macd, signal, hist };
  }

  // ── fixed-timeframe bucket key (UTC). Weekly is Monday-aligned. ──────────────────────────
  function bucketKey(t, tf) {
    switch (tf) {
      case 'Weekly':  return Math.floor((Math.floor(t / 86400) + 4) / 7);
      case 'Monthly': { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
      case '12H':     return Math.floor(t / 43200);
      case '8H':      return Math.floor(t / 28800);
      case '4H':      return Math.floor(t / 14400);
      case '2H':      return Math.floor(t / 7200);
      case '1H':      return Math.floor(t / 3600);
      default:        return Math.floor(t / 86400); // Daily
    }
  }

  // Resample chart candles into fixed-TF OHLC buckets. Returns COMPLETED buckets only (the
  // last, still-forming bucket is dropped → confirmed/non-repainting higher-TF values).
  function htfCompleted(candles, tf) {
    const out = [];
    let cur = null;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const k = bucketKey(c.time, tf);
      if (!cur || cur.k !== k) { if (cur) out.push(cur); cur = { k, c: c.close, h: c.high, l: c.low }; }
      else { cur.h = Math.max(cur.h, c.high); cur.l = Math.min(cur.l, c.low); cur.c = c.close; }
    }
    return out; // cur (forming bucket) intentionally excluded
  }

  // Floor-trader pivot levels from the PREVIOUS completed period (no future leak).
  function pivotLevels(candles, tf) {
    const n = candles.length;
    if (!n) return null;
    const curKey = bucketKey(candles[n - 1].time, tf);
    let i = n - 1;
    while (i >= 0 && bucketKey(candles[i].time, tf) === curKey) i--; // last bar of previous period
    if (i < 0) return null;
    const prevKey = bucketKey(candles[i].time, tf);
    const close = candles[i].close;
    let hi = -Infinity, lo = Infinity, j = i;
    while (j >= 0 && bucketKey(candles[j].time, tf) === prevKey) { hi = Math.max(hi, candles[j].high); lo = Math.min(lo, candles[j].low); j--; }
    const P = (hi + lo + close) / 3;
    return { P, R1: 2 * P - lo, S1: 2 * P - hi, R2: P + (hi - lo), S2: P - (hi - lo) };
  }

  // Wilder ATR (last value) over chart candles — sizes the stop in chart-TF price units.
  function atrLast(candles, period) {
    const n = candles.length;
    if (n < period + 1) return null;
    const tr = (k) => Math.max(candles[k].high - candles[k].low, Math.abs(candles[k].high - candles[k - 1].close), Math.abs(candles[k].low - candles[k - 1].close));
    let sum = 0; for (let k = 1; k <= period; k++) sum += tr(k);
    let a = sum / period;
    for (let k = period + 1; k < n; k++) a = (a * (period - 1) + tr(k)) / period;
    return a;
  }

  // SMC — direction of the MOST RECENT 3-bar Fair Value Gap (imbalance) in the last
  // `lookback` bars: 'long' (bullish, up-displacement void), 'short' (bearish), or null.
  // Using the LATEST imbalance makes this a real filter (smart-money just pushed our way),
  // not a "some gap exists somewhere" no-op.
  function lastFVGDir(candles, lookback) {
    const n = candles.length;
    const start = Math.max(2, n - lookback);
    for (let i = n - 1; i >= start; i--) {
      if (candles[i].low > candles[i - 2].high) return 'long';   // bullish imbalance
      if (candles[i].high < candles[i - 2].low) return 'short';  // bearish imbalance
    }
    return null;
  }

  // Pullback helper: did price recently tag the fixed-TF fast EMA (confirmed) and is now
  // resuming in `dir`? long → a recent bar's low ≤ ema while the current bar closes above it.
  function pullbackReclaim(candles, emaVal, lookback, dir) {
    if (emaVal == null) return false;
    const n = candles.length;
    const cur = candles[n - 1];
    if (dir === 'long' && !(cur.close > emaVal)) return false;
    if (dir === 'short' && !(cur.close < emaVal)) return false;
    const start = Math.max(0, n - lookback);
    for (let i = start; i < n; i++) {
      if (dir === 'long' && candles[i].low <= emaVal) return true;
      if (dir === 'short' && candles[i].high >= emaVal) return true;
    }
    return false;
  }

  const Strategy = {
    name: 'Fixed-MTF Golden Cross + MACD + Weekly Pivots (SMC)',
    description: 'Trades a FIXED higher-timeframe golden cross no matter what chart TF you are on — ' +
      'the chart candles are resampled up to the chosen fixed TF (4H/Daily/Weekly) and the EMAs + MACD ' +
      'are read from the last CLOSED higher-TF bar (non-repainting, leak-free), ported from the "⭕FIXED ' +
      'MTF EMA" Pine indicator. LONG needs all of: fixed-TF fast EMA above slow EMA (golden-cross regime, ' +
      'or a fresh cross only), fixed-TF MACD bullish, chart price above the previous week\'s floor-trader ' +
      'pivot P, and (optional) a fresh bullish Fair-Value-Gap so only smart-money displacement setups ' +
      'qualify; SHORT is the mirror. Entry fires on the rising edge of the combined condition (one trade ' +
      'per setup) with a post-exit cooldown. Exit = ATR stop (1R) + ATR target with winners-run trailing ' +
      'options and an optional regime-flip close. Net of Trade Sim commission + slippage. During Watch ' +
      'Replay it draws the weekly pivot P + R1/S1 and the two fixed-TF EMAs as stepped lines. ' +
      'Markers: 🟢 long, 🔴 short, 🔵 close.',
    warmUpBars: 50,

    overlay: true,

    params: {
      // ── Fixed higher-TF: the key idea — these indicators never change with chart TF ──
      fixedTf:    { label: 'Fixed timeframe (EMA/MACD)', type: 'select', options: ['1H', '2H', '4H', '8H', '12H', 'Daily', 'Weekly'], default: 'Daily' },
      emaFastLen: { label: 'Fast EMA (golden cross)',    type: 'number', default: 50,  min: 3,  max: 200 },
      emaSlowLen: { label: 'Slow EMA (golden cross)',    type: 'number', default: 200, min: 10, max: 400 },
      crossMode:  { label: 'Cross mode', type: 'select', options: ['Regime (Fast>Slow)', 'Fresh cross only'], default: 'Regime (Fast>Slow)' },
      crossLookback: { label: 'Fresh-cross window (HTF bars)', type: 'number', default: 8, min: 1, max: 50 },

      // ── MACD on the same fixed TF ──
      useMacd:    { label: 'MACD filter', type: 'select', options: ['On', 'Off'], default: 'On' },
      macdFast:   { label: 'MACD fast',   type: 'number', default: 12, min: 2, max: 100 },
      macdSlow:   { label: 'MACD slow',   type: 'number', default: 26, min: 3, max: 200 },
      macdSignal: { label: 'MACD signal', type: 'number', default: 9,  min: 2, max: 100 },
      macdMode:   { label: 'MACD condition', type: 'select', options: ['Line > Signal', 'Histogram > 0', 'Fresh cross'], default: 'Line > Signal' },

      // ── Floor-trader pivot from previous period — chart-level bias & targets ──
      pivotRule:  { label: 'Pivot bias filter', type: 'select', options: ['Price vs P', 'Off'], default: 'Price vs P' },
      pivotTf:    { label: 'Pivot timeframe', type: 'select', options: ['Daily', 'Weekly', 'Monthly'], default: 'Weekly' },

      // ── Entry quality filters ──
      usePriceEma: { label: 'Require price > fixed fast EMA', type: 'select', options: ['On', 'Off'], default: 'Off' },
      useSmc:      { label: 'SMC: latest chart FVG aligned', type: 'select', options: ['On', 'Off'], default: 'On' },
      smcLookback: { label: 'SMC FVG lookback (chart bars)', type: 'number', default: 12, min: 3, max: 200 },
      entryMode:   { label: 'Entry trigger', type: 'select', options: ['Rising edge', 'Pullback to fast EMA'], default: 'Rising edge' },
      pullbackLookback: { label: 'Pullback lookback (chart bars)', type: 'number', default: 8, min: 2, max: 50 },

      direction:  { label: 'Direction', type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },

      // ── Risk / exit ──
      atrLen:     { label: 'ATR length', type: 'number', default: 14, min: 5, max: 50 },
      slATR:      { label: 'Stop × ATR (1R)', type: 'number', default: 2.0, min: 0.3, max: 6, step: 0.1 },
      tpATR:      { label: 'Target × ATR',    type: 'number', default: 6.0, min: 0.5, max: 12, step: 0.1 },
      exitStyle:  { label: 'Exit style', type: 'select', options: ['Trailing + target', 'Trailing only', 'Fixed bracket'], default: 'Trailing + target' },
      trailActivateATR: { label: 'Trail activates after × ATR', type: 'number', default: 1.5, min: 0.1, max: 10, step: 0.1 },
      trailATR:   { label: 'Trail distance × ATR', type: 'number', default: 3.0, min: 0.3, max: 10, step: 0.1 },
      regimeExit: { label: 'Exit on fixed-TF trend flip', type: 'select', options: ['On', 'Off'], default: 'On' },
      cooldown:   { label: 'Cooldown bars after exit', type: 'number', default: 3, min: 0, max: 30 },
    },

    // Replay pane only supports ma/rsi/volume (chart-TF). The real signal EMAs are fixed-TF
    // and drawn by the overlay, so here we surface volume only — no misleading chart-TF MAs.
    chartIndicators() {
      return [{ type: 'volume', visible: true, params: {} }];
    },

    // Overlay series: stepped weekly pivot P (+R1/S1) and the two fixed-TF EMAs (confirmed,
    // i.e. previous completed HTF bar), drawn as stepped lines over whatever chart TF is shown.
    overlaySeries(candles, params) {
      const fixedTf = (params && params.fixedTf) || '4H';
      const pivotTf = (params && params.pivotTf) || 'Weekly';
      const fastLen = (params && params.emaFastLen) || 50;
      const slowLen = (params && params.emaSlowLen) || 200;
      const n = candles.length;

      // bucket index per chart bar + completed-bucket closes for the fixed-TF EMAs
      const bIdx = new Array(n);
      const bClose = [];
      let curKey = null, bi = -1;
      for (let i = 0; i < n; i++) {
        const k = bucketKey(candles[i].time, fixedTf);
        if (k !== curKey) { curKey = k; bi++; }
        bClose[bi] = candles[i].close;
        bIdx[i] = bi;
      }
      const ef = emaArr(bClose, fastLen), es = emaArr(bClose, slowLen);
      const fastLine = new Array(n), slowLine = new Array(n);
      for (let i = 0; i < n; i++) {
        const cb = bIdx[i] - 1; // confirmed = previous completed bucket
        fastLine[i] = { time: candles[i].time, value: cb >= 0 ? ef[cb] : null };
        slowLine[i] = { time: candles[i].time, value: cb >= 0 ? es[cb] : null };
      }

      // stepped pivot P / R1 / S1 (previous completed period), single pass
      const pS = new Array(n), r1S = new Array(n), s1S = new Array(n);
      let pk = null, cH = -Infinity, cL = Infinity, cC = null, pH = null, pL = null, pC = null;
      for (let i = 0; i < n; i++) {
        const k = bucketKey(candles[i].time, pivotTf);
        if (pk === null) { pk = k; cH = candles[i].high; cL = candles[i].low; cC = candles[i].close; }
        else if (k !== pk) { pH = cH; pL = cL; pC = cC; pk = k; cH = candles[i].high; cL = candles[i].low; cC = candles[i].close; }
        else { cH = Math.max(cH, candles[i].high); cL = Math.min(cL, candles[i].low); cC = candles[i].close; }
        if (pH != null) { const P = (pH + pL + pC) / 3; pS[i] = { time: candles[i].time, value: P }; r1S[i] = { time: candles[i].time, value: 2 * P - pL }; s1S[i] = { time: candles[i].time, value: 2 * P - pH }; }
        else { pS[i] = { time: candles[i].time, value: null }; r1S[i] = { time: candles[i].time, value: null }; s1S[i] = { time: candles[i].time, value: null }; }
      }

      return {
        pivot: pS,
        lines: [
          { label: 'EMA' + fastLen, color: 'rgba(59,132,0,0.9)',  width: 1.5, data: fastLine },
          { label: 'EMA' + slowLen, color: 'rgba(185,120,9,0.95)', width: 2,   data: slowLine },
          { label: 'R1', color: 'rgba(239,83,80,0.55)', width: 1, dashed: true, data: r1S },
          { label: 'S1', color: 'rgba(38,166,154,0.55)', width: 1, dashed: true, data: s1S },
        ],
      };
    },

    init(params) {
      this.p = params;
      this.prevPosition = null;
      this.barsSinceExit = 999;
      this.prevLong = false;
      this.prevShort = false;
      this._clearTrade();
      this.reason = '';
    },

    _clearTrade() {
      this.tradeEntry = null; this.tradeStop = null; this.tradeTgt = null;
      this.tradeRisk = null; this.curStop = null; this.peak = null;
    },

    onCandle(candle, indicators, account) {
      const P_ = this.p;
      const candles = indicators.candles;
      const n = candles.length;

      // cooldown bookkeeping (every bar)
      const flatNow = !account.position;
      if (this.prevPosition && flatNow) this.barsSinceExit = 0;
      else if (flatNow) this.barsSinceExit += 1;
      this.prevPosition = account.position;

      // ── fixed-TF confirmed indicators ──
      const completed = htfCompleted(candles, P_.fixedTf);
      const need = Math.max(P_.emaSlowLen, P_.useMacd === 'On' ? (P_.macdSlow + P_.macdSignal) : 0) + 1;
      if (completed.length < need) {
        this.prevLong = false; this.prevShort = false;
        this.reason = `fixed-TF (${P_.fixedTf}) warming up · ${completed.length}/${need} bars`;
        return account.position ? this._manage(candle, indicators, account, null) : null;
      }
      const hc = completed.map((b) => b.c);
      const m = completed.length - 1;
      const ef = emaArr(hc, P_.emaFastLen), es = emaArr(hc, P_.emaSlowLen);
      const fLast = ef[m], sLast = es[m];
      if (fLast == null || sLast == null) {
        this.prevLong = false; this.prevShort = false;
        this.reason = 'fixed-TF EMA warming up';
        return account.position ? this._manage(candle, indicators, account, null) : null;
      }
      const regimeBull = fLast > sLast, regimeBear = fLast < sLast;

      // fresh golden / death cross within the HTF window
      let freshGolden = false, freshDeath = false;
      if (P_.crossMode === 'Fresh cross only') {
        for (let k = Math.max(1, completed.length - P_.crossLookback); k < completed.length; k++) {
          if (ef[k - 1] == null || es[k - 1] == null || ef[k] == null || es[k] == null) continue;
          if (ef[k - 1] <= es[k - 1] && ef[k] > es[k]) freshGolden = true;
          if (ef[k - 1] >= es[k - 1] && ef[k] < es[k]) freshDeath = true;
        }
      }

      // fixed-TF MACD
      let macdBull = true, macdBear = true;
      if (P_.useMacd === 'On') {
        const { macd, signal, hist } = macdArrays(hc, P_.macdFast, P_.macdSlow, P_.macdSignal);
        const mm = macd[m], ss = signal[m], hh = hist[m];
        if (mm == null || ss == null) { macdBull = false; macdBear = false; }
        else if (P_.macdMode === 'Histogram > 0') { macdBull = hh > 0; macdBear = hh < 0; }
        else if (P_.macdMode === 'Fresh cross') {
          macdBull = false; macdBear = false;
          for (let k = Math.max(1, macd.length - P_.crossLookback); k < macd.length; k++) {
            if (macd[k - 1] == null || signal[k - 1] == null || macd[k] == null || signal[k] == null) continue;
            if (macd[k - 1] <= signal[k - 1] && macd[k] > signal[k]) macdBull = true;
            if (macd[k - 1] >= signal[k - 1] && macd[k] < signal[k]) macdBear = true;
          }
        } else { macdBull = mm > ss; macdBear = mm < ss; }
      }

      // weekly pivot bias
      let pivBull = true, pivBear = true, piv = null;
      if (P_.pivotRule !== 'Off') {
        piv = pivotLevels(candles, P_.pivotTf);
        if (!piv) { pivBull = false; pivBear = false; }
        else { pivBull = candle.close > piv.P; pivBear = candle.close < piv.P; }
      }

      // price holding the fixed-TF fast EMA (confirmed value)
      let peBull = true, peBear = true;
      if (P_.usePriceEma === 'On') { peBull = candle.close > fLast; peBear = candle.close < fLast; }

      // SMC: the most recent imbalance must be aligned with the trade direction
      let smcBull = true, smcBear = true;
      if (P_.useSmc === 'On') { const d = lastFVGDir(candles, P_.smcLookback); smcBull = d === 'long'; smcBear = d === 'short'; }

      const goldenOK = P_.crossMode === 'Fresh cross only' ? freshGolden : regimeBull;
      const deathOK  = P_.crossMode === 'Fresh cross only' ? freshDeath  : regimeBear;

      // BIAS = the slow higher-TF context (cross + MACD + pivot + optional price/EMA + SMC).
      const longBias  = goldenOK && macdBull && pivBull && peBull && smcBull;
      const shortBias = deathOK  && macdBear && pivBear && peBear && smcBear;

      // TRIGGER = how the bias is converted into a chart-bar entry.
      let longTrig, shortTrig;
      if (P_.entryMode === 'Rising edge') {
        longTrig = longBias && !this.prevLong;
        shortTrig = shortBias && !this.prevShort;
      } else { // Pullback to fast EMA — buy the dip in the higher-TF uptrend
        longTrig = longBias && pullbackReclaim(candles, fLast, P_.pullbackLookback, 'long');
        shortTrig = shortBias && pullbackReclaim(candles, fLast, P_.pullbackLookback, 'short');
      }
      this.prevLong = longBias; this.prevShort = shortBias;

      // ── manage an open position (trailing / regime flip) ──
      if (account.position) return this._manage(candle, indicators, account, { regimeBull, regimeBear, macdBull, macdBear });

      // ── flat: try to enter ──
      this._clearTrade();
      if (this.barsSinceExit < P_.cooldown) { this.reason = `cooldown ${this.barsSinceExit}/${P_.cooldown}`; return null; }
      const longAllowed = P_.direction !== 'Short only', shortAllowed = P_.direction !== 'Long only';
      if (longTrig && longAllowed) return this._enter('long', candle, indicators, piv);
      if (shortTrig && shortAllowed) return this._enter('short', candle, indicators, piv);

      this.reason = `flat · ${regimeBull ? 'bull' : regimeBear ? 'bear' : 'flat'} regime` +
        (longBias ? ' · long bias' : '') + (shortBias ? ' · short bias' : '');
      return null;
    },

    // Build the entry + ATR bracket; remember it for trailing.
    _enter(dir, candle, indicators, piv) {
      const P_ = this.p;
      const entry = candle.close;
      const A = atrLast(indicators.candles, P_.atrLen);
      if (!A || !(A > 0)) { this.reason = 'ATR not ready — skip'; return null; }
      const stop = dir === 'long' ? entry - P_.slATR * A : entry + P_.slATR * A;
      let target = dir === 'long' ? entry + P_.tpATR * A : entry - P_.tpATR * A;
      if (P_.exitStyle === 'Trailing only') target = null;
      this.tradeEntry = entry; this.tradeStop = stop; this.tradeTgt = target;
      this.tradeRisk = Math.abs(entry - stop); this.curStop = stop; this.peak = entry;
      this.barsSinceExit = 0;
      this.reason = `${dir === 'long' ? 'LONG' : 'SHORT'} fixed-TF golden cross + MACD` +
        (piv ? ` (${dir === 'long' ? '>' : '<'}P ${piv.P.toFixed(2)})` : '') +
        ` · stop ${stop.toFixed(2)}` + (target != null ? ` / tgt ${target.toFixed(2)}` : ' / trailing');
      return { signal: dir, stopLoss: stop, takeProfit: target };
    },

    // Manage an open position: regime-flip close + ATR trailing (stop only tightens).
    _manage(candle, indicators, account, ctx) {
      const P_ = this.p;
      const candles = indicators.candles;
      const isLong = account.position === 'long';
      const entry = this.tradeEntry != null ? this.tradeEntry : account.entryPrice;

      // extend favourable extreme since entry
      if (this.peak == null) this.peak = isLong ? candle.high : candle.low;
      else this.peak = isLong ? Math.max(this.peak, candle.high) : Math.min(this.peak, candle.low);

      // regime-flip exit (only when fixed-TF context is available this bar)
      if (P_.regimeExit === 'On' && ctx) {
        if (isLong && (ctx.regimeBear || (P_.useMacd === 'On' && !ctx.macdBull))) { this.reason = 'exit · fixed-TF trend flipped against long'; return 'close'; }
        if (!isLong && (ctx.regimeBull || (P_.useMacd === 'On' && !ctx.macdBear))) { this.reason = 'exit · fixed-TF trend flipped against short'; return 'close'; }
      }

      // ATR trailing
      if (this.curStop != null && P_.exitStyle !== 'Fixed bracket') {
        const A = atrLast(candles, P_.atrLen);
        if (A && A > 0) {
          const moved = isLong ? (this.peak - entry) : (entry - this.peak);
          if (moved >= P_.trailActivateATR * A) {
            const cand = isLong ? this.peak - P_.trailATR * A : this.peak + P_.trailATR * A;
            const ns = isLong ? Math.max(this.curStop, cand) : Math.min(this.curStop, cand);
            if (ns !== this.curStop) { this.curStop = ns; this.tradeStop = ns; this.reason = `trail → stop ${ns.toFixed(2)}`; return { stopLoss: ns, takeProfit: this.tradeTgt }; }
          }
        }
      }
      this.reason = `holding ${account.position}` + (this.curStop != null ? ` · stop ${this.curStop.toFixed(2)}` : '');
      return null;
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.fixedmtfgc = Strategy;
})();
