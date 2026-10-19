// ny-smc-v7-strategy.js — NY morning SMC: CHoCH → first FVG → limit at the FVG midpoint.
//
// "v7" from research/ny-smc-iterations (ITERATION-LOG.md). Tuned on SOL + ETH 15m,
// Oct 2023 → Oct 2026: PF ≈ 2.7, +87.6R over 154 trades, all 6 coin-years positive.
// NOT proven elsewhere: on BTC / DOGE / ZEC / XRP it was PF 1.20 with only 6 of 12
// coin-years positive (XRP lost every year). Forward-test before trading it.
//
// Structure is detected exactly like the 📐 SMC Toolkit (js/smc.js): swing pivots with
// `swingLen` bars each side, CHoCH = candle CLOSE beyond the last swing against the
// trend, FVG = gap between candle 1's and candle 3's wicks. Everything is causal.
//
// Rules (times are New York, DST-aware; the toolkit's NY line = 09:30 ET):
//   1. CHoCH must close 08:30–09:30 or 10:30–11:30 ET (the 09:30–10:30 open hour is skipped)
//      and its candle range must be ≥ minDispATR × ATR(14).
//   2. The first same-direction FVG within `fvgWindow` candles; its height ≥ minFvgATR × ATR.
//   3. Limit order at the FVG midpoint. Stop 0.02% beyond the extreme of the CHoCH leg
//      (setup skipped if the stop is wider than maxStopATR × ATR). Target = entry ± targetR × risk.
//   4. Order cancelled if unfilled after maxFillBars candles, on an opposite structure break,
//      if price reaches the target first, or at 16:00 ET.
//   5. Stop → entry at +breakEvenR. Follow-through check: at the close of the ftBars-th candle
//      after the fill, if price never reached +ftMinR, the stop moves to −ftTightR.
//   6. Sized to risk riskPct of balance at the stop. One position at a time.
//   7. Risk mode "Less risk (Bollinger stretch)": a setup is only taken if the CHoCH leg's extreme
//      closed the gap to the outer Bollinger band (bbLen, bbMult) — long: the leg low traded below the
//      lower band; short: the leg high above the upper band. Research (ITERATION-LOG.md, Round 3,
//      Binance 15m, Oct 2019/20 – Oct 2026, SOL + ETH): ~1/3 fewer trades, max drawdown 18.4R → 8.8R,
//      total +60.5R → +68.7R, much better in 2019–23 but weaker in Oct 2025–26 (+3.7R vs +20.2R).
// Use it on 15m candles with "Fill at: Next bar open" and the session filter OFF.
(function () {
  // US daylight saving: 2nd Sunday of March 07:00 UTC → 1st Sunday of Nov 06:00 UTC (same as smc.js)
  function nthSundayUTC(y, month, n) {
    const d = new Date(Date.UTC(y, month, 1));
    return 1 + ((7 - d.getUTCDay()) % 7) + (n - 1) * 7;
  }
  function usDST(sec) {
    const y = new Date(sec * 1000).getUTCFullYear();
    return sec >= Date.UTC(y, 2, nthSundayUTC(y, 2, 2), 7) / 1000 && sec < Date.UTC(y, 10, nthSundayUTC(y, 10, 1), 6) / 1000;
  }
  // NY cash open (09:30 ET) for the UTC day containing t
  function nyOpen(t) {
    const o = Math.floor(t / 86400) * 86400 + 13.5 * 3600;
    return usDST(o) ? o : o + 3600;
  }

  const Strategy = {
    name: 'NY SMC v7 · CHoCH → FVG',
    special: true,
    description: 'NY-morning Smart Money setup, refined over 7 backtest rounds. A displacement CHoCH ' +
      '(08:30–09:30 or 10:30–11:30 ET) → limit at the first FVG\'s midpoint → stop beyond the CHoCH leg, ' +
      '3R target, breakeven at 1R, stop tightened to −0.5R if price shows no follow-through in 4 candles. ' +
      'Built for SOL / ETH 15m (PF ≈ 2.7 there, 2023–26); weak on other coins. Use "Next bar open", session filter off. ' +
      'Risk mode "Less risk" only takes setups whose CHoCH leg stretched beyond the Bollinger band (20, 2): about a third ' +
      'fewer trades and roughly half the drawdown in the 2019–26 backtest, at the cost of some winners in strong years.',
    warmUpBars: 20,

    params: {
      swingLen:    { label: 'Swing length (CHoCH)', type: 'number', default: 5, min: 1, max: 50 },
      minDispATR:  { label: 'CHoCH candle ≥ × ATR', type: 'number', default: 1, min: 0, max: 5 },
      skipOpen:    { label: 'Skip 09:30–10:30 ET CHoCHs', type: 'select', options: ['Yes', 'No'], default: 'Yes' },
      fvgWindow:   { label: 'FVG within (candles)', type: 'number', default: 10, min: 1, max: 50 },
      minFvgATR:   { label: 'FVG height ≥ × ATR (0 = v6)', type: 'number', default: 0.2, min: 0, max: 3 },
      maxStopATR:  { label: 'Max stop (× ATR)', type: 'number', default: 4, min: 0.5, max: 20 },
      maxFillBars: { label: 'Cancel unfilled after (candles)', type: 'number', default: 8, min: 1, max: 100 },
      targetR:     { label: 'Target (R)', type: 'number', default: 3, min: 0.5, max: 20 },
      breakEvenR:  { label: 'Break-even at R (0 = off)', type: 'number', default: 1, min: 0, max: 10 },
      ftBars:      { label: 'Follow-through check after (candles, 0 = off)', type: 'number', default: 4, min: 0, max: 50 },
      ftMinR:      { label: 'Follow-through needed (R)', type: 'number', default: 0.25, min: 0, max: 3 },
      ftTightR:    { label: 'No follow-through → stop at −R', type: 'number', default: 0.5, min: 0, max: 1 },
      riskPct:     { label: 'Risk % per trade', type: 'number', default: 1, min: 0.1, max: 10 },
      direction:   { label: 'Direction', type: 'select', options: ['Both', 'Long only', 'Short only'], default: 'Both' },
      riskMode:    { label: 'Risk mode', type: 'select', options: ['Standard', 'Less risk (Bollinger stretch)'], default: 'Standard' },
      bbLen:       { label: 'Less risk: Bollinger length', type: 'number', default: 20, min: 5, max: 100 },
      bbMult:      { label: 'Less risk: Bollinger σ', type: 'number', default: 2, min: 0.5, max: 4 },
    },

    // Show the SMC Toolkit's 15m layers (same swing length) while the strategy runs,
    // plus the Bollinger bands the "Less risk" mode checks.
    chartIndicators(p) {
      const d = typeof SMCIndicator !== 'undefined' ? SMCIndicator.getDefaults() : {};
      const list = [{ type: 'smc', visible: true, params: { ...d, ch1_on: false, fvg1_on: false,
        ch2_on: true, ch2_tf: '15', ch2_len: (p && p.swingLen) || 5, fvg2_on: true, fvg2_tf: '15' } }];
      if (p && p.riskMode !== 'Standard') list.push({ type: 'bb', visible: true, params: { period: p.bbLen, mult: p.bbMult } });
      return list;
    },

    init(p) {
      this.p = p;
      this.trend = 0; this.sh = null; this.sl = null;   // CHoCH detector state (as smc.js)
      this.watch = [];      // CHoCHs waiting for their first FVG
      this.order = null;    // our resting limit order
      this.trade = null;    // open trade bookkeeping (follow-through check)
      this.inPos = false;
      this.reason = '';
    },

    onCandle(candle, ind, account) {
      const p = this.p, C = ind.candles, i = ind.index, L = p.swingLen;
      const atr = ind.atr(C, 14)[i];
      const sec = i > 0 ? C[i].time - C[i - 1].time : 900;

      // ---- 1. structure: swing pivot confirmed at q = i - L, then close-breaks (exactly smc.js)
      const q = i - L;
      if (q >= L) {
        let isH = true, isL = true;
        for (let k = q - L; k <= q + L && (isH || isL); k++) {
          if (k === q) continue;
          if (C[k].high >= C[q].high) isH = false;
          if (C[k].low <= C[q].low) isL = false;
        }
        if (isH) this.sh = { price: C[q].high, idx: q, done: false };
        if (isL) this.sl = { price: C[q].low, idx: q, done: false };
      }
      const breaks = [];
      if (this.sh && !this.sh.done && candle.close > this.sh.price) {
        breaks.push({ bull: true, choch: this.trend < 0, p: this.sh.idx }); this.sh.done = true; this.trend = 1;
      }
      if (this.sl && !this.sl.done && candle.close < this.sl.price) {
        breaks.push({ bull: false, choch: this.trend > 0, p: this.sl.idx }); this.sl.done = true; this.trend = -1;
      }

      // ---- 2. position / order bookkeeping
      const hadPos = this.inPos;
      this.inPos = !!account.position;
      let busy = !!account.position || hadPos;                  // an exit this candle also blocks new setups
      if (account.position && this.order) {                      // our limit filled this candle
        const o = this.order;
        this.trade = { long: o.long, entry: account.entryPrice, risk: Math.abs(account.entryPrice - o.stop),
          fillIdx: i, atOpen: account.entryPrice === candle.open, mfe: 0, ftDone: false };
        this.order = null;
      }
      if (!account.position) this.trade = null;
      if (this.order && !account.limitOrder && this.order.placedAt < i) { this.order = null; busy = true; } // filled + stopped in one candle

      // ---- 3. session window for a CHoCH on this candle
      const t = candle.time, open = nyOpen(t), sStart = open - 3600, sEnd = open + 6.5 * 3600;
      const inWindow = t >= sStart && t < sStart + 3 * 3600 && !(p.skipOpen === 'Yes' && t >= open && t < open + 3600);
      for (const e of breaks) {
        if (!e.choch || !inWindow || atr == null) continue;
        if (candle.high - candle.low < p.minDispATR * atr) continue;
        if ((e.bull && p.direction === 'Short only') || (!e.bull && p.direction === 'Long only')) continue;
        this.watch.push({ long: e.bull, b: i, p: e.p, sessEnd: sEnd });
      }

      // ---- 4. FVG completing on this candle (c1 = i-2, c3 = i) → setups for waiting CHoCHs
      const setups = [];
      const bb = p.riskMode !== 'Standard' ? ind.bollinger(ind.closes, p.bbLen, p.bbMult) : null;
      let bbSkip = 0;
      if (i >= 2 && atr != null) {
        const c1 = C[i - 2], c3 = candle;
        const fvg = c3.low > c1.high ? { bull: true, top: c3.low, bottom: c1.high }
          : c3.high < c1.low ? { bull: false, top: c1.low, bottom: c3.high } : null;
        this.watch = this.watch.filter((w) => {
          if (i <= w.b) return true;
          if (fvg && fvg.bull === w.long) {
            const long = w.long;
            let legX = long ? Infinity : -Infinity, legXi = w.p;
            for (let j = w.p; j <= w.b; j++) { const v = long ? C[j].low : C[j].high; if (long ? v < legX : v > legX) { legX = v; legXi = j; } }
            const entry = (fvg.top + fvg.bottom) / 2;
            const stop = long ? legX * (1 - 0.0002) : legX * (1 + 0.0002);
            const risk = Math.abs(entry - stop);
            let ok = (long ? entry > stop : entry < stop) && risk <= p.maxStopATR * atr && fvg.top - fvg.bottom >= p.minFvgATR * atr;
            if (ok && bb) { // Less risk: the leg extreme must have stretched beyond the outer band
              const band = long ? bb.lower[legXi] : bb.upper[legXi];
              if (band == null || (long ? legX >= band : legX <= band)) { ok = false; bbSkip++; }
            }
            if (ok) setups.push({ long, entry, stop, risk, tp: entry + (long ? 1 : -1) * p.targetR * risk, fvgIdx: i, sessEnd: w.sessEnd });
            return false;                                       // only the FIRST same-direction FVG counts
          }
          return i < w.b + p.fvgWindow;
        });
      }

      // ---- 5. manage the open trade: follow-through check
      if (account.position && this.trade) {
        const tr = this.trade, dir = tr.long ? 1 : -1;
        if (i > tr.fillIdx || tr.atOpen) tr.mfe = Math.max(tr.mfe, (dir * ((tr.long ? candle.high : candle.low) - tr.entry)) / tr.risk);
        const beDone = account.stopLoss != null && Math.abs(account.stopLoss - tr.entry) < tr.risk * 1e-6;
        if (p.ftBars > 0 && !tr.ftDone && i === tr.fillIdx + p.ftBars) {
          tr.ftDone = true;
          const tight = tr.entry - dir * p.ftTightR * tr.risk;
          if (!beDone && tr.mfe < p.ftMinR && (tr.long ? tight > account.stopLoss : tight < account.stopLoss)) {
            this.reason = `No follow-through (best +${tr.mfe.toFixed(2)}R in ${p.ftBars} candles) → stop to −${p.ftTightR}R`;
            return { stopLoss: tight };
          }
        }
        this.reason = `In ${account.position} · best +${tr.mfe.toFixed(2)}R`;
        return null;
      }

      // ---- 6. manage our resting limit order
      if (this.order) {
        const o = this.order;
        let why = null;
        if (breaks.some((e) => e.bull !== o.long)) why = 'opposite structure break';
        else if (o.long ? candle.high >= o.tp : candle.low <= o.tp) why = 'price reached the target first';
        else if (i - o.fvgIdx >= p.maxFillBars) why = `not filled within ${p.maxFillBars} candles`;
        else if (t + sec >= o.sessEnd) why = '16:00 ET session end';
        if (!why) { this.reason = `Limit ${o.long ? 'buy' : 'sell'} resting @ ${o.entry.toPrecision(6)}`; return null; }
        this.order = null;
        this.reason = 'Cancel: ' + why;
        if (!setups.length) return 'cancel';
        // otherwise a fresh setup on this candle replaces it (falls through)
      }

      // ---- 7. place a new setup (earliest CHoCH first) while flat
      if (!setups.length) { this.reason = bbSkip ? 'Less risk: setup skipped, CHoCH leg stayed inside the Bollinger bands' : 'No setup'; return null; }
      if (busy) { this.reason = 'Setup skipped: a trade closed on this candle'; return null; }
      const s = setups[0];
      this.order = { ...s, placedAt: i };
      this.reason = `${s.long ? 'Bull' : 'Bear'} CHoCH → FVG: limit @ ${s.entry.toPrecision(6)}, SL ${s.stop.toPrecision(6)}, TP ${p.targetR}R`;
      return {
        signal: s.long ? 'long' : 'short',
        limitPrice: s.entry,
        stopLoss: s.stop,
        takeProfit: s.tp,
        breakEvenAt: p.breakEvenR > 0 ? s.entry + (s.long ? 1 : -1) * p.breakEvenR * s.risk : undefined,
        riskPct: p.riskPct,
      };
    },
  };

  window.__STRATEGIES = window.__STRATEGIES || {};
  window.__STRATEGIES.nysmcv7 = Strategy;
})();
