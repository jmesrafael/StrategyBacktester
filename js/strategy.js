// strategy.js — Strategy Mode: strategy picker panel, silent backtest engine,
// automated replay execution, signal log + tooltip. Drives TradeSim for the actual
// account mechanics (fees/slippage live in trade-sim.js), so Game and Strategy mode
// share one account layer. Strategy files register on window.__STRATEGIES (see
// strategies/registry.js + the README contract).

const StrategyMode = (() => {
  const UP = '#26a69a', DOWN = '#ef5350', DIM = '#b2b5be';

  let chart, chartHost, button, replay, tradeSim, getFullCandles, onWatchReplay;

  // panel DOM
  let panel, elSelect, elDesc, elParams, elSize, elComm, elSlip,
      elRun, elWatch, elResults, elLog, elLogToggle, elError;
  let tooltip, banner;

  // current selection + run state
  let stratId = null;          // registry id
  let params = {};             // resolved param values for the active strategy
  let lastResult = null;       // last backtest result (signals/stats)
  let signalsByTime = new Map();// time -> signal record (for the marker tooltip)

  // live replay-execution state
  let modeActive = false;      // Strategy tab selected
  let live = null;             // fresh strategy instance for replay
  let lastProcessedIndex = -1;
  let liveSL = null, liveTP = null;

  // ---- formatters ----------------------------------------------------------
  function fmtMoney(v) {
    const s = v < 0 ? '-' : '+';
    return `${s}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function fmtPct(v) { return `${v < 0 ? '-' : '+'}${Math.abs(v).toFixed(2)}%`; }
  function fmtNum(v) { const a = Math.abs(v); const d = a < 1 ? 5 : a < 100 ? 3 : 2; return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  // ---- init ----------------------------------------------------------------
  function init(opts) {
    chart = opts.chart; chartHost = opts.chartHost; button = opts.button;
    replay = opts.replay; tradeSim = opts.tradeSim;
    getFullCandles = opts.getFullCandles; onWatchReplay = opts.onWatchReplay;

    buildPanel();
    buildExtras();

    button.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(); });
    document.addEventListener('click', (e) => {
      if (panel.style.display === 'block' && !panel.contains(e.target) &&
          e.target !== button && !button.contains(e.target)) panel.style.display = 'none';
    });

    chart.subscribeCrosshairMove((param) => updateTooltip(param));

    // default selection
    if (window.STRATEGY_REGISTRY && window.STRATEGY_REGISTRY.length) {
      selectStrategy(window.STRATEGY_REGISTRY[0].id);
    }
  }

  function getStrategy(id) { return (window.__STRATEGIES || {})[id] || null; }

  // ---- panel ---------------------------------------------------------------
  function buildPanel() {
    panel = document.createElement('div');
    panel.className = 'sg-panel';
    panel.style.display = 'none';
    panel.innerHTML =
      `<div class="sg-title">Strategy</div>` +
      `<select class="sg-select"></select>` +
      `<div class="sg-desc"></div>` +
      `<div class="sg-params"></div>` +
      `<div class="sg-sep"></div>` +
      `<div class="sg-globals">` +
        `<label>Position size % <input class="sg-size" type="number" min="1" max="100" step="1"></label>` +
        `<label>Commission % <input class="sg-comm" type="number" min="0" step="0.001"></label>` +
        `<label>Slippage % <input class="sg-slip" type="number" min="0" step="0.001"></label>` +
      `</div>` +
      `<div class="sg-actions">` +
        `<button class="sg-run">▶ Run Backtest</button>` +
        `<button class="sg-watch" disabled>👁 Watch Replay</button>` +
      `</div>` +
      `<div class="sg-error" style="display:none"></div>` +
      `<div class="sg-results"></div>` +
      `<div class="sg-logwrap"><button class="sg-logtoggle">▸ Signal Log</button>` +
        `<div class="sg-log" style="display:none"></div></div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', (e) => e.stopPropagation());

    elSelect = panel.querySelector('.sg-select');
    elDesc = panel.querySelector('.sg-desc');
    elParams = panel.querySelector('.sg-params');
    elSize = panel.querySelector('.sg-size');
    elComm = panel.querySelector('.sg-comm');
    elSlip = panel.querySelector('.sg-slip');
    elRun = panel.querySelector('.sg-run');
    elWatch = panel.querySelector('.sg-watch');
    elResults = panel.querySelector('.sg-results');
    elLog = panel.querySelector('.sg-log');
    elLogToggle = panel.querySelector('.sg-logtoggle');
    elError = panel.querySelector('.sg-error');

    (window.STRATEGY_REGISTRY || []).forEach((s) => elSelect.add(new Option(s.label, s.id)));
    elSize.value = CFG.DEFAULT_SIZE_PCT;
    elComm.value = CFG.DEFAULT_COMMISSION_PCT;
    elSlip.value = CFG.DEFAULT_SLIPPAGE_PCT;

    elSelect.onchange = () => selectStrategy(elSelect.value);
    elRun.onclick = runBacktestClicked;
    elWatch.onclick = () => { if (onWatchReplay) onWatchReplay(); };
    elLogToggle.onclick = () => {
      const open = elLog.style.display === 'none';
      elLog.style.display = open ? 'block' : 'none';
      elLogToggle.textContent = (open ? '▾' : '▸') + ' Signal Log';
    };
    [elSize, elComm, elSlip].forEach((el) => el.addEventListener('change', onGlobalsChanged));
  }

  function buildExtras() {
    tooltip = document.createElement('div');
    tooltip.className = 'sg-tooltip';
    tooltip.style.display = 'none';
    chartHost.appendChild(tooltip);

    banner = document.createElement('div');
    banner.className = 'sg-banner';
    banner.style.display = 'none';
    chartHost.appendChild(banner);
  }

  function togglePanel() {
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    const r = button.getBoundingClientRect();
    panel.style.left = Math.min(r.left, window.innerWidth - 320) + 'px';
    panel.style.top = (r.bottom + 4) + 'px';
    panel.style.display = 'block';
  }

  // ---- strategy selection + params ----------------------------------------
  function selectStrategy(id) {
    const strat = getStrategy(id);
    if (!strat) return;
    stratId = id;
    elSelect.value = id;
    elDesc.textContent = strat.description || '';
    params = {};
    Object.entries(strat.params || {}).forEach(([key, def]) => { params[key] = def.default; });
    renderParams(strat);
    lastResult = null;
    elWatch.disabled = true;
    elResults.innerHTML = '';
    clearError();
  }

  function renderParams(strat) {
    elParams.innerHTML = '';
    Object.entries(strat.params || {}).forEach(([key, def]) => {
      const wrap = document.createElement('label');
      wrap.className = 'sg-param';
      if (def.type === 'select') {
        wrap.innerHTML = `<span>${def.label}</span>`;
        const sel = document.createElement('select');
        (def.options || []).forEach((o) => sel.add(new Option(o, o)));
        sel.value = params[key];
        sel.onchange = () => { params[key] = sel.value; onParamChanged(); };
        wrap.appendChild(sel);
      } else {
        wrap.innerHTML = `<span>${def.label}</span>`;
        const inp = document.createElement('input');
        inp.type = 'number';
        if (def.min != null) inp.min = def.min;
        if (def.max != null) inp.max = def.max;
        inp.value = params[key];
        inp.onchange = () => {
          let v = parseFloat(inp.value);
          if (isNaN(v)) v = def.default;
          if (def.min != null) v = Math.max(def.min, v);
          if (def.max != null) v = Math.min(def.max, v);
          inp.value = v; params[key] = v; onParamChanged();
        };
        wrap.appendChild(inp);
      }
      elParams.appendChild(wrap);
    });
  }

  function settings() {
    return {
      startBalance: CFG.START_BALANCE,
      sizePct: parseFloat(elSize.value) || CFG.DEFAULT_SIZE_PCT,
      commissionPct: parseFloat(elComm.value) || 0,
      slippagePct: parseFloat(elSlip.value) || 0,
    };
  }

  function onGlobalsChanged() { onParamChanged(); }

  // Param/settings change: if watching a live replay, re-sync per spec §4F
  // (pause, re-run silent backtest, refresh markers, resume from current candle).
  function onParamChanged() {
    if (modeActive && isReplaying()) {
      const wasPlaying = replay.state().playing;
      replay.pause();
      runBacktest();           // refresh faded markers + stats
      rebuildLiveState();      // re-seed the live strategy to current candle
      if (wasPlaying) replay.play();
    }
  }

  function isReplaying() { return document.body.classList.contains('replay-mode'); }

  // ---- silent backtest engine (§4E) ---------------------------------------
  function runBacktestClicked() {
    const r = runBacktest();
    if (r) elWatch.disabled = false;
  }

  function runBacktest() {
    const strat = getStrategy(stratId);
    const candles = getFullCandles();
    if (!strat || !candles || !candles.length) return null;
    clearError();
    let result;
    try {
      result = simulate(strat, params, candles, settings());
    } catch (e) {
      showError(`Backtest error in "${strat.name}": ${e.message}`);
      return null;
    }
    lastResult = result;
    indexSignals(result.signals);
    renderResults(result.stats);
    drawFadedMarkers(result.signals);
    return result;
  }

  // Pure simulation over ALL candles. Returns { trades, signals, stats, finalBalance }.
  function simulate(strat, prms, candles, cfg) {
    const s = Object.create(strat);
    s.init(prms);
    const warm = strat.warmUpBars || 0;
    const comm = cfg.commissionPct / 100, slip = cfg.slippagePct / 100, sizeFrac = cfg.sizePct / 100;
    const closesAll = candles.map((c) => c.close);

    let balance = cfg.startBalance, totalFees = 0;
    let pos = null, sl = null, tp = null;
    const trades = [], signals = [];

    function openPos(side, price, i, reason) {
      const fill = side === 'long' ? price * (1 + slip) : price * (1 - slip);
      pos = { side, entry: fill, size: balance * sizeFrac, entryIndex: i };
      signals.push({ index: i, time: candles[i].time, type: side, price: fill, reason });
    }
    function closePos(price, i, reason) {
      if (!pos) return;
      const exitFill = pos.side === 'long' ? price * (1 - slip) : price * (1 + slip);
      const grossPct = pos.side === 'long'
        ? (exitFill - pos.entry) / pos.entry * 100 : (pos.entry - exitFill) / pos.entry * 100;
      const fees = pos.size * comm * 2;
      const usd = pos.size * (grossPct / 100) - fees;
      totalFees += fees; balance += usd;
      trades.push({ side: pos.side, entry: pos.entry, exit: exitFill, pct: grossPct, usd });
      signals.push({ index: i, time: candles[i].time, type: 'close', price: exitFill, reason });
      pos = null; sl = null; tp = null;
    }

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      // stop-loss / take-profit touch before evaluating a new signal
      if (pos && (sl != null || tp != null)) {
        const hitSL = pos.side === 'long' ? (sl != null && c.low <= sl) : (sl != null && c.high >= sl);
        const hitTP = pos.side === 'long' ? (tp != null && c.high >= tp) : (tp != null && c.low <= tp);
        if (hitSL) { closePos(sl, i, 'Stop loss'); continue; }
        if (hitTP) { closePos(tp, i, 'Take profit'); continue; }
      }
      if (i < warm) continue;
      const closes = closesAll.slice(0, i + 1);
      const indicators = makeIndicators(closes, candles.slice(0, i + 1));
      const account = { position: pos ? pos.side : null, entryPrice: pos ? pos.entry : null, balance };
      const res = s.onCandle(c, indicators, account);
      const signal = typeof res === 'string' ? res : (res && res.signal) || null;
      if (res && typeof res === 'object') {
        if (res.stopLoss != null) sl = res.stopLoss;
        if (res.takeProfit != null) tp = res.takeProfit;
      }
      const reason = s.reason || '';
      if (signal === 'long') { if (pos && pos.side === 'short') closePos(c.close, i, reason); if (!pos) openPos('long', c.close, i, reason); }
      else if (signal === 'short') { if (pos && pos.side === 'long') closePos(c.close, i, reason); if (!pos) openPos('short', c.close, i, reason); }
      else if (signal === 'close') { if (pos) closePos(c.close, i, reason); }
    }
    if (pos) closePos(candles[candles.length - 1].close, candles.length - 1, 'Session end');

    return { trades, signals, stats: computeStats(trades, cfg.startBalance, balance, totalFees), finalBalance: balance };
  }

  function makeIndicators(closes, candleSlice) {
    return {
      ema: (cl, p) => ema(cl, p),
      sma: (cl, p) => sma(cl, p),
      rsi: (cl, p) => rsi(cl, p),
      closes, candles: candleSlice,
    };
  }

  function computeStats(trades, startBalance, finalBalance, totalFees) {
    const n = trades.length;
    const netUsd = finalBalance - startBalance;
    const wins = trades.filter((t) => t.usd > 0);
    const losses = trades.filter((t) => t.usd < 0);
    const grossProfit = wins.reduce((a, t) => a + t.usd, 0);
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.usd, 0));
    const avgWin = wins.length ? grossProfit / wins.length : 0;
    const avgLoss = losses.length ? -grossLoss / losses.length : 0;
    const largestWin = n ? Math.max(...trades.map((t) => t.usd)) : 0;
    const largestLoss = n ? Math.min(...trades.map((t) => t.usd)) : 0;

    // consecutive win/loss streaks
    let cw = 0, cl = 0, maxCW = 0, maxCL = 0;
    trades.forEach((t) => {
      if (t.usd > 0) { cw++; cl = 0; maxCW = Math.max(maxCW, cw); }
      else if (t.usd < 0) { cl++; cw = 0; maxCL = Math.max(maxCL, cl); }
    });

    // max drawdown over the closed-trade equity curve
    let eq = startBalance, peak = startBalance, maxDD = 0;
    trades.forEach((t) => {
      eq += t.usd; peak = Math.max(peak, eq);
      maxDD = Math.max(maxDD, (peak - eq) / peak);
    });

    // Sharpe of per-trade % returns (not annualized)
    const rets = trades.map((t) => t.pct);
    const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
    const variance = rets.length ? rets.reduce((a, r) => a + (r - mean) * (r - mean), 0) / rets.length : 0;
    const sd = Math.sqrt(variance);
    const sharpe = sd ? mean / sd : 0;

    return {
      netUsd, netPct: (netUsd / startBalance) * 100, totalTrades: n,
      winRate: n ? (wins.length / n) * 100 : 0,
      profitFactor: grossLoss ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0),
      maxDrawdown: -maxDD * 100, sharpe, avgWin, avgLoss, largestWin, largestLoss,
      maxConsecWins: maxCW, maxConsecLosses: maxCL, totalFees,
    };
  }

  function renderResults(st) {
    const pf = st.profitFactor === Infinity ? '∞' : st.profitFactor.toFixed(2);
    const col = st.netUsd >= 0 ? UP : DOWN;
    const row = (label, val, color) =>
      `<div class="ts-row"><span>${label}</span><b${color ? ` style="color:${color}"` : ''}>${val}</b></div>`;
    elResults.innerHTML =
      `<div class="sg-results-title">BACKTEST RESULTS</div>` +
      row('Net P&L', `${fmtMoney(st.netUsd)} (${fmtPct(st.netPct)})`, col) +
      row('Total trades', st.totalTrades) +
      row('Win rate', `${st.winRate.toFixed(1)}%`) +
      row('Profit factor', pf) +
      row('Max drawdown', `${st.maxDrawdown.toFixed(1)}%`, DOWN) +
      row('Sharpe ratio', st.sharpe.toFixed(2)) +
      row('Avg win / loss', `${fmtMoney(st.avgWin)} / ${fmtMoney(st.avgLoss)}`) +
      row('Largest win / loss', `${fmtMoney(st.largestWin)} / ${fmtMoney(st.largestLoss)}`) +
      row('Max consec. W / L', `${st.maxConsecWins} / ${st.maxConsecLosses}`) +
      row('Total fees paid', `$${st.totalFees.toFixed(2)}`);
  }

  // ---- faded markers + tooltip (§4E / §4H) --------------------------------
  function indexSignals(signals) {
    signalsByTime = new Map();
    signals.forEach((s) => signalsByTime.set(s.time, s));
  }

  function drawFadedMarkers(signals) {
    const markers = signals.map((s) => {
      if (s.type === 'long') return { time: s.time, position: 'belowBar', color: 'rgba(38,166,154,0.55)', shape: 'arrowUp', text: 'L' };
      if (s.type === 'short') return { time: s.time, position: 'aboveBar', color: 'rgba(239,83,80,0.55)', shape: 'arrowDown', text: 'S' };
      return { time: s.time, position: 'aboveBar', color: 'rgba(178,181,190,0.6)', shape: 'square', text: 'C' };
    });
    ChartView.setCandleMarkers(markers);
  }

  function clearMarkers() { ChartView.clearCandleMarkers(); }

  function updateTooltip(param) {
    if (!param || !param.time || !param.point || !signalsByTime.size) { tooltip.style.display = 'none'; return; }
    const sig = signalsByTime.get(param.time);
    if (!sig) { tooltip.style.display = 'none'; return; }
    const label = sig.type === 'close' ? 'CLOSE' : sig.type.toUpperCase();
    const dt = new Date(sig.time * 1000).toISOString().slice(0, 16).replace('T', ' ');
    tooltip.innerHTML =
      `<b>${label} signal</b><br>${sig.reason || ''}<br>` +
      `<span class="sg-tt-dim">price ${fmtNum(sig.price)} · candle ${sig.index} · ${dt} UTC</span>`;
    tooltip.style.display = 'block';
    const x = Math.min(param.point.x + 14, chartHost.clientWidth - 220);
    const y = Math.max(8, param.point.y - 10);
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  // ---- live replay execution (§4F / §4G) ----------------------------------
  function setModeActive(on) {
    modeActive = on;
    if (!on) { clearMarkers(); tooltip.style.display = 'none'; clearSLTPLines(); }
  }

  // called from app when (re)entering replay while in strategy mode
  function onEnterReplay() {
    const strat = getStrategy(stratId);
    if (!strat) return;
    live = Object.create(strat);
    live.init(params);
    lastProcessedIndex = replay.cutIndex; // skip already-revealed history
    liveSL = null; liveTP = null;
    clearError();
    elLog.innerHTML = '';
    appendLog('—', `Watching ${strat.name} from candle ${replay.cutIndex + 1}`);
  }

  // re-seed live strategy internal state over revealed history without trading
  function rebuildLiveState() {
    const strat = getStrategy(stratId);
    const candles = getFullCandles();
    if (!strat || !candles.length) return;
    live = Object.create(strat);
    live.init(params);
    const closesAll = candles.map((c) => c.close);
    const cut = replay.cutIndex;
    const warm = strat.warmUpBars || 0;
    for (let i = warm; i <= cut; i++) {
      const closes = closesAll.slice(0, i + 1);
      try { live.onCandle(candles[i], makeIndicators(closes, candles.slice(0, i + 1)),
        { position: null, entryPrice: null, balance: CFG.START_BALANCE }); } catch (e) { /* ignore during reseed */ }
    }
    lastProcessedIndex = cut;
  }

  // called from app on every Replay 'tick'
  function onTick(payload) {
    if (!modeActive || !live || !payload || payload.forming) return;
    const idx = payload.index;
    if (idx <= lastProcessedIndex) return;
    const candles = getFullCandles();
    for (let i = lastProcessedIndex + 1; i <= idx; i++) processCandle(i, candles);
  }

  function processCandle(i, candles) {
    lastProcessedIndex = i;
    const strat = getStrategy(stratId);
    const c = candles[i];
    const acct = tradeSim.getAccount();

    // SL/TP auto-close
    if (acct.position && (liveSL != null || liveTP != null)) {
      const isLong = acct.position === 'long';
      const hitSL = isLong ? (liveSL != null && c.low <= liveSL) : (liveSL != null && c.high >= liveSL);
      const hitTP = isLong ? (liveTP != null && c.high >= liveTP) : (liveTP != null && c.low <= liveTP);
      if (hitSL || hitTP) {
        tradeSim.close(); clearSLTPLines();
        appendLog('■', `Candle ${i} — ${hitSL ? 'STOP' : 'TARGET'} hit`);
        return;
      }
    }

    if (i < (strat.warmUpBars || 0)) { appendLog('✗', `Candle ${i} — Warming up (${i}/${strat.warmUpBars})`); return; }

    const closes = candles.slice(0, i + 1).map((x) => x.close);
    const indicators = makeIndicators(closes, candles.slice(0, i + 1));
    let res;
    try {
      res = live.onCandle(c, indicators, acct);
    } catch (e) {
      replay.pause();
      showError(`${strat.name}.onCandle() threw at candle ${i}: ${e.message}`);
      appendLog('⚠', `Candle ${i} — ERROR: ${e.message}`);
      return;
    }
    const signal = typeof res === 'string' ? res : (res && res.signal) || null;
    const reason = live.reason || '';

    if (signal === 'long') { if (acct.position === 'short') { tradeSim.close(); clearSLTPLines(); } tradeSim.open('long'); appendLog('▲', `Candle ${i} — LONG · ${reason}`); }
    else if (signal === 'short') { if (acct.position === 'long') { tradeSim.close(); clearSLTPLines(); } tradeSim.open('short'); appendLog('▼', `Candle ${i} — SHORT · ${reason}`); }
    else if (signal === 'close') { if (acct.position) { tradeSim.close(); clearSLTPLines(); appendLog('■', `Candle ${i} — CLOSE · ${reason}`); } else appendLog('·', `Candle ${i} — No signal · ${reason}`); }
    else appendLog('·', `Candle ${i} — No signal · ${reason}`);

    // apply any stop-loss / take-profit returned for the (possibly new) position
    if (!tradeSim.getAccount().position) {
      clearSLTPLines();
    } else if (res && typeof res === 'object') {
      if (res.stopLoss != null) liveSL = res.stopLoss;
      if (res.takeProfit != null) liveTP = res.takeProfit;
      drawSLTPLines();
    }
  }

  // ---- SL/TP lines ---------------------------------------------------------
  let slLine = null, tpLine = null;
  function drawSLTPLines() {
    const series = ChartView.getCandleSeries();
    removeSLTPGraphics();
    const dashed = LightweightCharts.LineStyle.Dashed;
    if (liveSL != null) slLine = series.createPriceLine({ price: liveSL, color: DOWN, lineWidth: 1, lineStyle: dashed, axisLabelVisible: true, title: 'SL' });
    if (liveTP != null) tpLine = series.createPriceLine({ price: liveTP, color: UP, lineWidth: 1, lineStyle: dashed, axisLabelVisible: true, title: 'TP' });
  }
  function removeSLTPGraphics() {
    const series = ChartView.getCandleSeries();
    if (slLine) { series.removePriceLine(slLine); slLine = null; }
    if (tpLine) { series.removePriceLine(tpLine); tpLine = null; }
  }
  function clearSLTPLines() { removeSLTPGraphics(); liveSL = null; liveTP = null; }

  // ---- signal log ----------------------------------------------------------
  function appendLog(icon, text) {
    const row = document.createElement('div');
    row.className = 'sg-log-row';
    row.innerHTML = `<span class="sg-log-ic">${icon}</span><span>${text}</span>`;
    // hover → highlight that candle via the replay cursor
    const m = text.match(/Candle (\d+)/);
    if (m) {
      const idx = parseInt(m[1]);
      row.onmouseenter = () => {
        const candles = getFullCandles();
        if (candles[idx]) {
          const lo = Math.min(...candles.slice(0, idx + 1).map((c) => c.low));
          const hi = Math.max(...candles.slice(0, idx + 1).map((c) => c.high));
          ChartView.setCursor(candles[idx].time, lo, hi);
        }
      };
    }
    elLog.appendChild(row);
    elLog.scrollTop = elLog.scrollHeight;
  }

  // ---- error banner --------------------------------------------------------
  function showError(msg) {
    elError.textContent = '⚠ ' + msg;
    elError.style.display = 'block';
    banner.textContent = '⚠ ' + msg;
    banner.style.display = 'block';
    if (panel.style.display !== 'block') togglePanel();
  }
  function clearError() {
    elError.style.display = 'none';
    banner.style.display = 'none';
  }

  return { init, setModeActive, onEnterReplay, onTick, clearMarkers,
    get active() { return modeActive; } };
})();
