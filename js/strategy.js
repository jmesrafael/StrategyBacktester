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
      elRun, elWatch, elResults, elLog, elLogToggle, elError, elMtfBtn, elMtf;
  let elDirtySave;   // appears when inputs change
  let tooltip, banner;

  // current selection + run state
  let stratId = null;          // registry id
  let params = {};             // resolved param values for the active strategy
  let lastResult = null;       // last backtest result (signals/stats)
  let lastStats = null;        // stats from the most recent single backtest (for Save button)
  let signalsByTime = new Map();// time -> signal record (for the marker tooltip)

  // live replay-execution state
  let modeActive = false;      // Strategy tab selected
  let live = null;             // fresh strategy instance for replay
  let lastProcessedIndex = -1;
  let liveSL = null, liveTP = null;
  let liveMarkers = [];        // entry/exit dots drawn live as trades execute
  let savedIndicators = null;  // user's indicator set, restored when replay ends

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

    // restore last selected strategy (falls back to first in registry)
    const _savedStrat = localStorage.getItem(CFG.STORE.lastStrategy);
    const _initialId = (_savedStrat && window.__STRATEGIES && window.__STRATEGIES[_savedStrat])
      ? _savedStrat
      : (window.STRATEGY_REGISTRY && window.STRATEGY_REGISTRY.length ? window.STRATEGY_REGISTRY[0].id : null);
    if (_initialId) selectStrategy(_initialId);
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
      `<button class="sg-dirty-save" style="display:none"><i class="fas fa-floppy-disk"></i> Save inputs</button>` +
      `<div class="sg-actions">` +
        `<button class="sg-run"><i class="fas fa-play"></i> Run Backtest</button>` +
        `<button class="sg-watch" disabled><i class="fas fa-eye"></i> Watch Replay</button>` +
      `</div>` +
      `<button class="sg-mtf-btn"><i class="fas fa-flask"></i> Test 1m / 5m / 1h / 4h / 1D</button>` +
      `<div class="sg-error" style="display:none"></div>` +
      `<div class="sg-results"></div>` +
      `<div class="sg-mtf"></div>` +
      `<div class="sg-logwrap"><button class="sg-logtoggle"><i class="fas fa-chevron-right sg-log-caret"></i> Signal Log</button>` +
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
    elMtfBtn = panel.querySelector('.sg-mtf-btn');
    elMtf = panel.querySelector('.sg-mtf');
    elDirtySave = panel.querySelector('.sg-dirty-save');

    (window.STRATEGY_REGISTRY || []).forEach((s) => elSelect.add(new Option(s.label, s.id)));
    elSize.value = CFG.DEFAULT_SIZE_PCT;
    elComm.value = CFG.DEFAULT_COMMISSION_PCT;
    elSlip.value = CFG.DEFAULT_SLIPPAGE_PCT;

    elSelect.onchange = () => selectStrategy(elSelect.value);
    elRun.onclick = runBacktestClicked;
    elWatch.onclick = () => { if (onWatchReplay) onWatchReplay(); };
    elMtfBtn.onclick = runMultiTimeframe;
    elLogToggle.onclick = () => {
      const open = elLog.style.display === 'none';
      elLog.style.display = open ? 'block' : 'none';
      elLogToggle.innerHTML = `<i class="fas fa-chevron-${open ? 'down' : 'right'} sg-log-caret"></i> Signal Log`;
    };
    [elSize, elComm, elSlip].forEach((el) => el.addEventListener('change', onGlobalsChanged));
    elDirtySave.onclick = saveInputs;
  }

  // ---- input dirty tracking -----------------------------------------------

  function markDirty() {
    elDirtySave.innerHTML = '<i class="fas fa-floppy-disk"></i> Save inputs';
    elDirtySave.disabled = false;
    elDirtySave.style.display = 'block';
  }

  function saveInputs() {
    if (!stratId) return;
    const blob = {
      params: { ...params },
      sizePct: parseFloat(elSize.value),
      commissionPct: parseFloat(elComm.value),
      slippagePct: parseFloat(elSlip.value),
    };
    // Consolidated key → SettingsSync shim picks it up and syncs to Supabase
    const allInputs = JSON.parse(localStorage.getItem(CFG.STORE.stratInputs) || '{}');
    allInputs[stratId] = blob;
    localStorage.setItem(CFG.STORE.stratInputs, JSON.stringify(allInputs));
    localStorage.setItem(CFG.STORE.lastStrategy, stratId);
    elDirtySave.innerHTML = '<i class="fas fa-check"></i> Saved';
    elDirtySave.disabled = true;
    setTimeout(() => { elDirtySave.style.display = 'none'; elDirtySave.disabled = false; }, 1400);
  }

  function restoreSavedInputs(id) {
    try {
      const allInputs = JSON.parse(localStorage.getItem(CFG.STORE.stratInputs) || '{}');
      let saved = allInputs[id];
      // migrate from old per-strategy key (cr.strat.<id>)
      if (!saved) {
        const legacy = JSON.parse(localStorage.getItem('cr.strat.' + id));
        if (legacy) {
          allInputs[id] = legacy;
          localStorage.setItem(CFG.STORE.stratInputs, JSON.stringify(allInputs));
          saved = legacy;
        }
      }
      if (!saved) return false;
      const strat = getStrategy(id);
      if (saved.params && strat) {
        Object.keys(strat.params || {}).forEach((k) => {
          if (saved.params[k] != null) params[k] = saved.params[k];
        });
      }
      if (saved.sizePct != null)       elSize.value = saved.sizePct;
      if (saved.commissionPct != null) elComm.value = saved.commissionPct;
      if (saved.slippagePct != null)   elSlip.value = saved.slippagePct;
      return true;
    } catch { return false; }
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
    localStorage.setItem(CFG.STORE.lastStrategy, id);
    elDesc.textContent = strat.description || '';
    params = {};
    Object.entries(strat.params || {}).forEach(([key, def]) => { params[key] = def.default; });
    restoreSavedInputs(id);   // overlay with user's saved values if any
    renderParams(strat);
    lastResult = null;
    lastStats = null;
    elWatch.disabled = true;
    elResults.innerHTML = '';
    if (elDirtySave) elDirtySave.style.display = 'none';
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
        sel.onchange = () => { params[key] = sel.value; markDirty(); onParamChanged(); };
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
          inp.value = v; params[key] = v; markDirty(); onParamChanged();
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

  function onGlobalsChanged() { markDirty(); onParamChanged(); }

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

  // ---- multi-timeframe test (5m / 1h / 4h) --------------------------------
  // Runs the CURRENT strategy + params through the same `simulate()` engine on
  // three timeframes so you can verify how it performs across them at a glance.
  async function runMultiTimeframe() {
    const strat = getStrategy(stratId);
    if (!strat) return;
    const symbol = (document.getElementById('symbol') || {}).value || CFG.DEFAULTS.symbol;
    const target = parseInt((document.getElementById('maxCandles') || {}).value) || CFG.DEFAULTS.maxCandles;
    const cfg = settings();
    const tfs = [['1m', '1'], ['5m', '5'], ['1h', '60'], ['4h', '240'], ['1D', 'D']];

    elMtfBtn.disabled = true;
    elMtf.innerHTML = `<div class="sg-mtf-title">MULTI-TIMEFRAME TEST · ${symbol}</div>` +
      `<div class="sg-mtf-loading">Running ${strat.name} on 1m / 5m / 1h / 4h / 1D…</div>`;

    const rows = [];
    for (const [label, interval] of tfs) {
      let candles = null;
      try { candles = await fetchCandles(symbol, interval, target); }
      catch (e) { try { candles = syntheticCandles(symbol, interval, target); } catch (_) { candles = null; } }
      if (!candles || !candles.length) { rows.push({ label, err: true }); continue; }
      try { rows.push({ label, st: simulate(strat, params, candles, cfg).stats, bars: candles.length }); }
      catch (e) { rows.push({ label, err: true }); }
    }
    renderMtf(symbol, strat.name, rows);
    elMtfBtn.disabled = false;
  }

  function renderMtf(symbol, name, rows) {
    const head = `<div class="sg-mtf-title">MULTI-TIMEFRAME TEST · ${symbol}</div>` +
      `<div class="sg-mtf-sub">${name}</div>` +
      `<table class="sg-mtf-tbl"><thead><tr>` +
      `<th>TF</th><th>Net P&L</th><th>Win%</th><th>PF</th><th>Trades</th><th>Bars</th>` +
      `</tr></thead><tbody>`;
    const body = rows.map((r) => {
      if (r.err) return `<tr><td>${r.label}</td><td colspan="5" class="sg-mtf-err">no data</td></tr>`;
      const st = r.st;
      const pf = st.profitFactor === Infinity ? '∞' : st.profitFactor.toFixed(2);
      const col = st.netUsd >= 0 ? UP : DOWN;
      return `<tr><td><b>${r.label}</b></td>` +
        `<td style="color:${col}">${fmtMoney(st.netUsd)}<br><span class="sg-mtf-pct">${fmtPct(st.netPct)}</span></td>` +
        `<td>${st.winRate.toFixed(0)}%</td>` +
        `<td>${pf}</td>` +
        `<td>${st.totalTrades}</td>` +
        `<td>${r.bars}</td></tr>`;
    }).join('');
    // highlight the best timeframe by net P&L
    const ok = rows.filter((r) => !r.err);
    let bestLine = '';
    if (ok.length) {
      const best = ok.reduce((a, b) => (b.st.netUsd > a.st.netUsd ? b : a));
      bestLine = `<div class="sg-mtf-best">Best by Net P&L: <b>${best.label}</b> (${fmtMoney(best.st.netUsd)})</div>`;
    }
    elMtf.innerHTML = head + body + `</tbody></table>` + bestLine;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'sg-save-btn';
    saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save to Data';
    saveBtn.onclick = () => saveMtfRun(saveBtn, symbol, name, rows);
    elMtf.appendChild(saveBtn);
  }

  async function saveMtfRun(btn, symbol, stratName, rows) {
    const strat = getStrategy(stratId);
    const cfg = settings();
    const ok_rows = rows.filter((r) => !r.err);
    const best = ok_rows.length
      ? ok_rows.reduce((a, b) => (b.st.netUsd > a.st.netUsd ? b : a))
      : null;
    const record = {
      kind: 'mtf',
      strategy_id: stratId,
      strategy_label: stratName,
      symbol,
      interval: 'multi',
      max_candles: parseInt((document.getElementById('maxCandles') || {}).value) || 0,
      params: { ...params },
      settings: { sizePct: cfg.sizePct, commissionPct: cfg.commissionPct, slippagePct: cfg.slippagePct },
      result: {
        rows: rows.map((r) => r.err ? { label: r.label, err: true } : { label: r.label, bars: r.bars, st: r.st }),
        best: best ? { label: best.label, netUsd: best.st.netUsd } : null,
      },
      note: '',
    };
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    const saved = window.DataStore ? await window.DataStore.saveRun(record) : false;
    btn.innerHTML = saved ? '<i class="fas fa-check"></i> Saved' : '<i class="fas fa-triangle-exclamation"></i> Failed';
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
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
    lastStats = st;
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

    const saveBtn = document.createElement('button');
    saveBtn.className = 'sg-save-btn';
    saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save to Data';
    saveBtn.onclick = () => saveSingleRun(saveBtn);
    elResults.appendChild(saveBtn);
  }

  async function saveSingleRun(btn) {
    if (!lastStats || !stratId) return;
    const strat = getStrategy(stratId);
    const cfg = settings();
    const record = {
      kind: 'single',
      strategy_id: stratId,
      strategy_label: strat ? strat.name || stratId : stratId,
      symbol: (document.getElementById('symbol') || {}).value || '',
      interval: (document.querySelector('#intervalSeg .active') || {}).dataset?.v || '',
      max_candles: parseInt((document.getElementById('maxCandles') || {}).value) || 0,
      params: { ...params },
      settings: { sizePct: cfg.sizePct, commissionPct: cfg.commissionPct, slippagePct: cfg.slippagePct },
      result: { ...lastStats },
      note: '',
    };
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    const ok = window.DataStore ? await window.DataStore.saveRun(record) : false;
    btn.innerHTML = ok ? '<i class="fas fa-check"></i> Saved' : '<i class="fas fa-triangle-exclamation"></i> Failed';
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
  }

  // ---- faded markers + tooltip (§4E / §4H) --------------------------------
  function indexSignals(signals) {
    signalsByTime = new Map();
    signals.forEach((s) => signalsByTime.set(s.time, s));
  }

  // Dots on the MAIN PRICE CHART at the candle where each trade happens:
  //   green dot  = long entry, red dot = short entry, blue dot = trade closed.
  // (ChartView.setCandleMarkers attaches to the candlestick series, not the RSI pane.)
  function drawFadedMarkers(signals) {
    const markers = signals.map((s) => {
      if (s.type === 'long') return { time: s.time, position: 'belowBar', color: '#22c55e', shape: 'circle', text: '' };
      if (s.type === 'short') return { time: s.time, position: 'aboveBar', color: '#ef4444', shape: 'circle', text: '' };
      return { time: s.time, position: 'aboveBar', color: '#3b82f6', shape: 'circle', text: '' };
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
    if (!on) { restoreIndicators(); clearMarkers(); tooltip.style.display = 'none'; clearSLTPLines(); }
  }

  // Show the strategy's own indicators during replay; remember the user's set.
  function swapInStrategyIndicators() {
    const strat = getStrategy(stratId);
    if (!strat || typeof strat.chartIndicators !== 'function') return;
    if (typeof IndicatorManager === 'undefined') return;
    savedIndicators = IndicatorManager.snapshot();
    IndicatorManager.restoreSet(strat.chartIndicators(params));
  }
  // Put the user's indicators back (no-op if we never swapped).
  function restoreIndicators() {
    if (savedIndicators == null || typeof IndicatorManager === 'undefined') return;
    IndicatorManager.restoreSet(savedIndicators);
    savedIndicators = null;
  }

  // called from app when (re)entering replay while in strategy mode
  function onEnterReplay() {
    const strat = getStrategy(stratId);
    if (!strat) return;
    swapInStrategyIndicators();
    liveMarkers = []; clearMarkers();
    live = Object.create(strat);
    live.init(params);
    lastProcessedIndex = replay.cutIndex; // skip already-revealed history
    liveSL = null; liveTP = null;
    clearError();
    elLog.innerHTML = '';
    appendLog('<i class="fas fa-eye"></i>', `Watching ${strat.name} from candle ${replay.cutIndex + 1}`);
  }

  // called from app when leaving replay — restore the user's indicators + clean up
  function onExitReplay() {
    restoreIndicators();
    liveMarkers = []; clearMarkers();
    clearSLTPLines();
  }

  // a live entry/exit dot on the price chart at the trade candle
  function pushLiveMarker(time, type) {
    const m = type === 'long'  ? { time, position: 'belowBar', color: '#22c55e', shape: 'circle', text: '' }
            : type === 'short' ? { time, position: 'aboveBar', color: '#ef4444', shape: 'circle', text: '' }
            :                    { time, position: 'aboveBar', color: '#3b82f6', shape: 'circle', text: '' };
    liveMarkers.push(m);
    liveMarkers.sort((a, b) => a.time - b.time);   // LWC requires ascending time
    ChartView.setCandleMarkers(liveMarkers);
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
        tradeSim.close(); clearSLTPLines(); pushLiveMarker(c.time, 'close');
        appendLog('<i class="fas fa-square-xmark"></i>', `Candle ${i} — ${hitSL ? 'STOP' : 'TARGET'} hit`);
        return;
      }
    }

    if (i < (strat.warmUpBars || 0)) { appendLog('<i class="fas fa-hourglass-half"></i>', `Candle ${i} — Warming up (${i}/${strat.warmUpBars})`); return; }

    const closes = candles.slice(0, i + 1).map((x) => x.close);
    const indicators = makeIndicators(closes, candles.slice(0, i + 1));
    let res;
    try {
      res = live.onCandle(c, indicators, acct);
    } catch (e) {
      replay.pause();
      showError(`${strat.name}.onCandle() threw at candle ${i}: ${e.message}`);
      appendLog('<i class="fas fa-triangle-exclamation"></i>', `Candle ${i} — ERROR: ${e.message}`);
      return;
    }
    const signal = typeof res === 'string' ? res : (res && res.signal) || null;
    const reason = live.reason || '';

    if (signal === 'long') { if (acct.position === 'short') { tradeSim.close(); clearSLTPLines(); pushLiveMarker(c.time, 'close'); } tradeSim.open('long'); pushLiveMarker(c.time, 'long'); appendLog('<i class="fas fa-arrow-up"></i>', `Candle ${i} — LONG · ${reason}`); }
    else if (signal === 'short') { if (acct.position === 'long') { tradeSim.close(); clearSLTPLines(); pushLiveMarker(c.time, 'close'); } tradeSim.open('short'); pushLiveMarker(c.time, 'short'); appendLog('<i class="fas fa-arrow-down"></i>', `Candle ${i} — SHORT · ${reason}`); }
    else if (signal === 'close') { if (acct.position) { tradeSim.close(); clearSLTPLines(); pushLiveMarker(c.time, 'close'); appendLog('<i class="fas fa-xmark"></i>', `Candle ${i} — CLOSE · ${reason}`); } else appendLog('<i class="fas fa-minus"></i>', `Candle ${i} — No signal · ${reason}`); }
    else appendLog('<i class="fas fa-minus"></i>', `Candle ${i} — No signal · ${reason}`);

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
    elError.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + msg;
    elError.style.display = 'block';
    banner.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + msg;
    banner.style.display = 'block';
    if (panel.style.display !== 'block') togglePanel();
  }
  function clearError() {
    elError.style.display = 'none';
    banner.style.display = 'none';
  }

  return { init, setModeActive, onEnterReplay, onExitReplay, onTick, clearMarkers,
    simulate, makeIndicators,
    get active() { return modeActive; } };
})();
