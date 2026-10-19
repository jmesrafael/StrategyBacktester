// strategy.js — Strategy Mode: strategy picker panel, silent backtest engine,
// automated replay execution, signal log + tooltip. Drives TradeSim for the actual
// account mechanics (fees/slippage live in trade-sim.js), so Game and Strategy mode
// share one account layer. Strategy files register on window.__STRATEGIES (see
// strategies/registry.js + the README contract).

const StrategyMode = (() => {
  const UP = '#26a69a', DOWN = '#ef5350', DIM = '#b2b5be';

  let chart, chartHost, button, replay, tradeSim, getFullCandles, onWatchReplay;

  // panel DOM
  let panel, elSelect, elDesc, elParams, elSize, elComm, elSlip, elFill,
      elSizing, elRisk, elMaxSize, elSess, elSessFrom, elSessTo, elSessTz, elSessDays, elSessClose,
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
  let liveStops = newStops();   // live SL / TP / trailing / break-even state (see newStops)
  let livePending = null;      // order decided on bar i, filled at bar i+1's open (fillMode 'nextOpen')
  let liveResting = null;      // resting limit order (order.limitPrice), filled when a bar trades through it
  let liveCache = null;        // indicator series cache for the live strategy
  let liveMarkers = [];        // entry/exit dots drawn live as trades execute
  let savedIndicators = null;  // user's indicator set, restored when replay ends
  let eqChart = null;          // equity/drawdown mini chart in the results block

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
        `<label title="Fixed: every trade uses Position size % of balance. Risk: size each trade so hitting its stop-loss loses Risk % of balance">Sizing <select class="sg-sizing">` +
          `<option value="fixed">Fixed % of balance</option><option value="risk">Risk % per trade</option></select></label>` +
        `<label class="sg-fixed-only">Position size % <input class="sg-size" type="number" min="1" max="100" step="1"></label>` +
        `<label class="sg-risk-only" title="Loss at the stop-loss, as % of balance">Risk per trade % <input class="sg-risk" type="number" min="0.05" max="100" step="0.05"></label>` +
        `<label class="sg-risk-only" title="Cap on position size (100 = no leverage). Trades without a stop-loss fall back to Position size %">Max size % <input class="sg-maxsize" type="number" min="1" max="10000" step="1"></label>` +
        `<label>Commission % <input class="sg-comm" type="number" min="0" step="0.001"></label>` +
        `<label>Slippage % <input class="sg-slip" type="number" min="0" step="0.001"></label>` +
        `<label title="When a signal fires on a candle's close, the earliest real fill is the next candle's open">Fill at <select class="sg-fill">` +
          `<option value="nextOpen">Next bar open</option><option value="close">Signal bar close</option></select></label>` +
        `<label class="sg-check" title="Only open new trades inside these hours / days (exits always allowed)"><span>Session filter</span><input class="sg-sess" type="checkbox"></label>` +
        `<div class="sg-sess-box">` +
          `<label>Hours <span class="sg-sess-hours"><input class="sg-sess-from" type="time" step="900"> – <input class="sg-sess-to" type="time" step="900"></span></label>` +
          `<label>Time zone <select class="sg-sess-tz"></select></label>` +
          `<div class="sg-sess-days"></div>` +
          `<label class="sg-check" title="Flatten any open position when a candle closes outside the session"><span>Close outside session</span><input class="sg-sess-close" type="checkbox"></label>` +
        `</div>` +
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
    elFill = panel.querySelector('.sg-fill');
    elSizing = panel.querySelector('.sg-sizing');
    elRisk = panel.querySelector('.sg-risk');
    elMaxSize = panel.querySelector('.sg-maxsize');
    elSess = panel.querySelector('.sg-sess');
    elSessFrom = panel.querySelector('.sg-sess-from');
    elSessTo = panel.querySelector('.sg-sess-to');
    elSessTz = panel.querySelector('.sg-sess-tz');
    elSessDays = panel.querySelector('.sg-sess-days');
    elSessClose = panel.querySelector('.sg-sess-close');
    for (let h = -12; h <= 14; h++) elSessTz.add(new Option(`UTC${h >= 0 ? '+' : '−'}${Math.abs(h)}`, h));
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sg-day'; b.textContent = d.slice(0, 2); b.dataset.d = k; b.title = d;
      b.onclick = () => { b.classList.toggle('on'); onGlobalsChanged(); };
      elSessDays.appendChild(b);
    });
    elRun = panel.querySelector('.sg-run');
    elWatch = panel.querySelector('.sg-watch');
    elResults = panel.querySelector('.sg-results');
    elLog = panel.querySelector('.sg-log');
    elLogToggle = panel.querySelector('.sg-logtoggle');
    elError = panel.querySelector('.sg-error');
    elMtfBtn = panel.querySelector('.sg-mtf-btn');
    elMtf = panel.querySelector('.sg-mtf');
    elDirtySave = panel.querySelector('.sg-dirty-save');

    (window.STRATEGY_REGISTRY || []).forEach((s) => {
      const opt = new Option(s.label, s.id);
      if (s.special) opt.className = 'sg-special';   // research-backed strategy → green
      elSelect.add(opt);
    });
    elSize.value = CFG.DEFAULT_SIZE_PCT;
    elComm.value = CFG.DEFAULT_COMMISSION_PCT;
    elSlip.value = CFG.DEFAULT_SLIPPAGE_PCT;
    elFill.value = 'nextOpen';
    applyGlobals(DEFAULT_GLOBALS);

    elSelect.onchange = () => selectStrategy(elSelect.value);
    elRun.onclick = runBacktestClicked;
    elWatch.onclick = () => { if (onWatchReplay) onWatchReplay(); };
    elMtfBtn.onclick = runMultiTimeframe;
    elLogToggle.onclick = () => {
      const open = elLog.style.display === 'none';
      elLog.style.display = open ? 'block' : 'none';
      elLogToggle.innerHTML = `<i class="fas fa-chevron-${open ? 'down' : 'right'} sg-log-caret"></i> Signal Log`;
    };
    [elSize, elComm, elSlip, elFill, elSizing, elRisk, elMaxSize, elSess, elSessFrom, elSessTo, elSessTz, elSessClose]
      .forEach((el) => el.addEventListener('change', onGlobalsChanged));
    elSizing.addEventListener('change', syncGlobalsUi);
    elSess.addEventListener('change', syncGlobalsUi);
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
      fillMode: elFill.value,
      ...readGlobals(),
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
      if (saved.fillMode)              elFill.value = saved.fillMode;
      applyGlobals(saved);
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
  // ---- sizing + session globals ------------------------------------------
  const DEFAULT_GLOBALS = { sizing: 'fixed', riskPct: 1, maxSizePct: 100,
    session: { enabled: false, start: '08:00', end: '16:00', tz: 0,
      days: [false, true, true, true, true, true, false], closeOutside: false } };

  function readGlobals() {
    return {
      sizing: elSizing.value === 'risk' ? 'risk' : 'fixed',
      riskPct: parseFloat(elRisk.value) || DEFAULT_GLOBALS.riskPct,
      maxSizePct: parseFloat(elMaxSize.value) || DEFAULT_GLOBALS.maxSizePct,
      session: {
        enabled: elSess.checked,
        start: elSessFrom.value || DEFAULT_GLOBALS.session.start,
        end: elSessTo.value || DEFAULT_GLOBALS.session.end,
        tz: parseInt(elSessTz.value, 10) || 0,
        days: [...elSessDays.children].map((b) => b.classList.contains('on')),
        closeOutside: elSessClose.checked,
      },
    };
  }

  function applyGlobals(g) {
    const d = DEFAULT_GLOBALS, ss = { ...d.session, ...(g && g.session) };
    elSizing.value = (g && g.sizing) || d.sizing;
    elRisk.value = (g && g.riskPct != null) ? g.riskPct : d.riskPct;
    elMaxSize.value = (g && g.maxSizePct != null) ? g.maxSizePct : d.maxSizePct;
    elSess.checked = !!ss.enabled;
    elSessFrom.value = ss.start; elSessTo.value = ss.end; elSessTz.value = String(ss.tz || 0);
    [...elSessDays.children].forEach((b, k) => b.classList.toggle('on', !!(ss.days || d.session.days)[k]));
    elSessClose.checked = !!ss.closeOutside;
    syncGlobalsUi();
  }

  function syncGlobalsUi() {
    panel.classList.toggle('sg-sizing-risk', elSizing.value === 'risk');
    panel.classList.toggle('sg-sess-on', elSess.checked);
  }

  function selectStrategy(id) {
    const strat = getStrategy(id);
    if (!strat) return;
    stratId = id;
    elSelect.value = id;
    localStorage.setItem(CFG.STORE.lastStrategy, id);
    elDesc.textContent = strat.description || '';
    const special = !!((window.STRATEGY_REGISTRY || []).find((s) => s.id === id) || {}).special || !!strat.special;
    elSelect.classList.toggle('sg-special', special);
    elDesc.classList.toggle('sg-special-desc', special);
    params = {};
    Object.entries(strat.params || {}).forEach(([key, def]) => { params[key] = def.default; });
    applyGlobals(DEFAULT_GLOBALS);
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
      fillMode: elFill.value === 'close' ? 'close' : 'nextOpen',
      ...readGlobals(),
    };
  }

  // Where the candles come from — lets indicators.htf() reuse downloaded data.
  function dataEnv(interval) {
    const v = (id) => (document.getElementById(id) || {}).value;
    return {
      symbol: v('symbol') || '',
      interval: interval || (document.querySelector('#tfTabs .active') || {}).dataset?.v || '',
      max: parseInt(v('maxCandles')) || 0,
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

  // Candle data swapped under a running replay (timeframe / symbol switch):
  // indexes changed, so re-run the silent backtest and re-seed the live strategy
  // at the new cut. The app pauses/resumes playback around this.
  function onDataChanged() {
    if (!modeActive || !isReplaying()) return;
    liveMarkers = []; clearMarkers();
    runBacktest();
    rebuildLiveState();
  }

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
      const cfg = settings();
      const env = dataEnv();
      result = simulate(strat, params, candles, cfg, env);
      // Bars where SL and TP were both touched are resolved stop-first. Re-run with
      // target-first so the panel shows how much the result leans on that guess.
      if (result.stats.ambiguousBars > 0) {
        result.stats.netUsdIfTpFirst = simulate(strat, params, candles, { ...cfg, ambiguous: 'tp' }, env).stats.netUsd;
      }
    } catch (e) {
      showError(`Backtest error in "${strat.name}": ${e.message}`);
      return null;
    }
    lastResult = result;
    indexSignals(result.signals);
    renderResults(result.stats, result.equity);
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
      try { rows.push({ label, st: simulate(strat, params, candles, cfg, dataEnv(interval)).stats, bars: candles.length }); }
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
      settings: savedSettings(cfg),
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

  // What a run's saved record shows under "settings" (Data page).
  function savedSettings(cfg) {
    const out = { sizePct: cfg.sizePct, commissionPct: cfg.commissionPct, slippagePct: cfg.slippagePct,
      fillMode: cfg.fillMode, sizing: cfg.sizing };
    if (cfg.sizing === 'risk') { out.riskPct = cfg.riskPct; out.maxSizePct = cfg.maxSizePct; }
    if (cfg.session && cfg.session.enabled) out.session = cfg.session;
    return out;
  }

  // Normalize an onCandle() return into an order, or null when it asks for nothing.
  // Strings ('long' | 'short' | 'close') are the simple form; the object form adds
  // trade management:
  //   stopLoss / takeProfit  absolute price levels
  //   trailingStop           trail distance in PRICE units (e.g. 2 * atr), or
  //   trailingStopPct        trail distance in % of price
  //   breakEvenAt            once price touches this level, the stop moves to entry
  //   sizePct                this trade's size as % of balance (overrides the panel)
  //   riskPct                risk this % of balance at the stop (overrides the panel)
  //   limitPrice             with signal 'long'/'short' while flat: a resting LIMIT order instead of a
  //                          market fill. It fills on a later bar that trades through the price (at the
  //                          limit, or the open if the bar gapped past it; no slippage) and stays until
  //                          filled, replaced by another limit order, or cancelled with signal 'cancel'.
  const ORDER_FIELDS = ['stopLoss', 'takeProfit', 'trailingStop', 'trailingStopPct', 'breakEvenAt', 'sizePct', 'riskPct', 'limitPrice'];
  function toOrder(res, reason) {
    const signal = typeof res === 'string' ? res : (res && res.signal) || null;
    const o = { signal, reason: reason || '' };
    let any = !!signal;
    ORDER_FIELDS.forEach((k) => {
      const v = res && typeof res === 'object' ? res[k] : null;
      o[k] = (v != null && isFinite(v)) ? +v : null;
      if (o[k] != null) any = true;
    });
    return any ? o : null;
  }

  // ---- resting limit orders (shared by simulate() and live replay) ---------
  // Returns the fill price if bar `c` trades through the resting limit `r`, else null.
  function limitFill(r, c) {
    if (r.signal === 'long') return c.low <= r.limitPrice ? Math.min(c.open, r.limitPrice) : null;
    return c.high >= r.limitPrice ? Math.max(c.open, r.limitPrice) : null;
  }

  // ---- trade management shared by simulate() and live replay ---------------
  // One stop state per open position: the active stop (`sl`, plus what put it
  // there for the exit reason), target, trailing distance, break-even trigger and
  // the best price reached since entry (the trail's anchor).
  function newStops() {
    return { sl: null, slKind: 'Stop loss', tp: null, trail: null, trailPct: null,
      be: null, beDone: false, ext: null };
  }
  function trailLevel(side, st) {
    const d = st.trail != null ? st.trail : st.ext * st.trailPct / 100;
    return side === 'long' ? st.ext - d : st.ext + d;
  }
  // Apply an order's levels to the position it arrives with (`fresh` = just opened).
  function applyOrderStops(st, o, side, entry, fresh) {
    if (fresh) { Object.assign(st, newStops()); st.ext = entry; }
    if (o.stopLoss != null) { st.sl = o.stopLoss; st.slKind = 'Stop loss'; }
    if (o.takeProfit != null) st.tp = o.takeProfit;
    if (o.trailingStop != null) { st.trail = o.trailingStop > 0 ? o.trailingStop : null; st.trailPct = null; }
    if (o.trailingStopPct != null) { st.trailPct = o.trailingStopPct > 0 ? o.trailingStopPct : null; st.trail = null; }
    if (o.breakEvenAt != null) { st.be = o.breakEvenAt; st.beDone = false; }
    // a trailing stop with no initial stop starts trailing from the entry
    if (st.sl == null && (st.trail != null || st.trailPct != null) && st.ext != null) {
      st.sl = trailLevel(side, st); st.slKind = 'Trailing stop';
    }
  }
  // After a bar survives the exit check: ratchet the trailing stop from the best
  // price so far and arm break-even. Uses the finished bar's range, so the new stop
  // only applies from the NEXT bar (no same-bar look-back). Returns true if moved.
  function advanceStops(st, side, entry, c) {
    const long = side === 'long';
    const before = st.sl;
    st.ext = st.ext == null ? (long ? c.high : c.low) : (long ? Math.max(st.ext, c.high) : Math.min(st.ext, c.low));
    if (st.trail != null || st.trailPct != null) {
      const lvl = trailLevel(side, st);
      if (st.sl == null || (long ? lvl > st.sl : lvl < st.sl)) { st.sl = lvl; st.slKind = 'Trailing stop'; }
    }
    if (st.be != null && !st.beDone && (long ? c.high >= st.be : c.low <= st.be)) {
      st.beDone = true;
      if (st.sl == null || (long ? entry > st.sl : entry < st.sl)) { st.sl = entry; st.slKind = 'Break-even stop'; }
    }
    return st.sl !== before;
  }

  // Position size (notional, quote currency) for a new trade filled at `fill`.
  //   fixed: sizePct of balance (order.sizePct overrides the panel)
  //   risk:  balance × risk% ÷ stop distance%, so the stop loses exactly risk% —
  //          capped at maxSizePct. Needs a stop (stopLoss, or a trailing stop's
  //          starting level); without one it falls back to the fixed size.
  function orderSize(o, side, fill, balance, cfg) {
    const fixed = balance * ((o.sizePct != null ? o.sizePct : cfg.sizePct) / 100);
    const riskPct = o.riskPct != null ? o.riskPct : (cfg.sizing === 'risk' ? cfg.riskPct : null);
    if (riskPct == null || o.sizePct != null) return { size: fixed, mode: 'fixed' };
    let stop = o.stopLoss;
    if (stop == null && (o.trailingStop > 0 || o.trailingStopPct > 0)) {
      const d = o.trailingStop > 0 ? o.trailingStop : fill * o.trailingStopPct / 100;
      stop = side === 'long' ? fill - d : fill + d;
    }
    const dist = stop == null ? 0 : (side === 'long' ? fill - stop : stop - fill) / fill;
    if (!(dist > 0)) return { size: fixed, mode: 'fixed (no valid stop)' };
    const cap = balance * ((cfg.maxSizePct || 100) / 100);
    return { size: Math.min(balance * (riskPct / 100) / dist, cap), mode: 'risk' };
  }

  // ---- session / time filter -------------------------------------------------
  // cfg.session = { enabled, start:'HH:MM', end:'HH:MM', tz: UTC offset hours,
  //                 days: [Sun..Sat] booleans, closeOutside }
  // A decision is "in session" when the moment it is made (the bar's CLOSE) falls
  // inside the hours on an enabled day. end < start wraps past midnight.
  function sessionClock(cfg) {
    const ss = cfg && cfg.session;
    const toMin = (hm) => { const [h, m] = String(hm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const tz = ss ? (+ss.tz || 0) * 3600 : 0;
    const from = ss ? toMin(ss.start) : 0, to = ss ? toMin(ss.end) : 0;
    const local = (t) => { const d = new Date((t + tz) * 1000); return { dow: d.getUTCDay(), hour: d.getUTCHours(), minute: d.getUTCMinutes() }; };
    return {
      enabled: !!(ss && ss.enabled),
      closeOutside: !!(ss && ss.enabled && ss.closeOutside),
      local,
      inSession(t) {
        if (!ss || !ss.enabled) return true;
        const l = local(t), m = l.hour * 60 + l.minute;
        if (ss.days && !ss.days[l.dow]) return false;
        if (from === to) return true;                    // whole day
        return from < to ? (m >= from && m < to) : (m >= from || m < to);
      },
    };
  }

  // Seconds per bar of a candle series (from the data itself, so it also works in
  // tests / for any interval label).
  function barSeconds(candles) {
    let best = Infinity;
    for (let i = 1; i < Math.min(candles.length, 50); i++) {
      const d = candles[i].time - candles[i - 1].time;
      if (d > 0 && d < best) best = d;
    }
    return isFinite(best) ? best : 60;
  }

  // ---- higher-timeframe data ---------------------------------------------------
  // htfSource(iv) → { candles, sec, cache, source }. Prefers the real series the app
  // already downloaded (background prefetch) when it covers the backtest and agrees
  // with the base prices; otherwise builds the HTF bars from the base candles.
  const HTF_SEC = { '1': 60, '3': 180, '5': 300, '15': 900, '30': 1800, '60': 3600, '120': 7200,
    '240': 14400, '360': 21600, '720': 43200, 'D': 86400, 'W': 604800 };
  function htfBucket(t, sec) {
    return sec === 604800 ? Math.floor((t - 345600) / sec) * sec + 345600 : Math.floor(t / sec) * sec; // weeks start Monday
  }
  function aggregateCandles(candles, sec) {
    const out = [];
    let cur = null;
    for (const c of candles) {
      const b = htfBucket(c.time, sec);
      if (!cur || cur.time !== b) {
        cur = { time: b, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 };
        out.push(cur);
      } else {
        cur.high = Math.max(cur.high, c.high); cur.low = Math.min(cur.low, c.low);
        cur.close = c.close; cur.volume += c.volume || 0;
      }
    }
    if (out.length && candles.length && candles[0].time > out[0].time) out.shift(); // first bucket incomplete
    return out;
  }
  function makeHtfProvider(candles, baseSec, env) {
    const memo = new Map();
    return function (iv) {
      iv = String(iv);
      if (memo.has(iv)) return memo.get(iv);
      const sec = HTF_SEC[iv] || (typeof intervalToSeconds === 'function' ? intervalToSeconds(iv) : 0);
      let out;
      if (!sec || sec <= baseSec) {
        out = { candles, sec: baseSec, source: 'base (not a higher timeframe)' };
      } else {
        let real = null;
        if (env && env.symbol && env.max && typeof peekCandleCache === 'function') {
          try { real = peekCandleCache(env.symbol, iv, env.max); } catch (_) { real = null; }
        }
        if (real && real.length && candles.length && real[0].time <= candles[0].time && htfAgrees(real, candles, sec)) {
          out = { candles: real, sec, source: 'downloaded' };
        } else {
          out = { candles: aggregateCandles(candles, sec), sec, source: 'built from base candles' };
        }
      }
      out.cache = makeSeriesCache(out.candles);
      memo.set(iv, out);
      return out;
    };
  }
  // Spot-check that a downloaded HTF series is the same market as the base candles
  // (guards against e.g. offline sample base data vs real HTF data).
  function htfAgrees(htf, base, sec) {
    for (const f of [0.25, 0.5, 0.75]) {
      const c = base[Math.floor(base.length * f)];
      const k = htfFind(htf, htfBucket(c.time, sec));
      if (k < 0) return false;
      const h = htf[k], tol = (h.high - h.low) * 0.02 + h.close * 1e-6;
      if (c.high > h.high + tol || c.low < h.low - tol) return false;
    }
    return true;
  }
  function htfFind(arr, t) { // index of the bar with time === t, else -1
    let lo = 0, hi = arr.length - 1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m].time === t) return m; if (arr[m].time < t) lo = m + 1; else hi = m - 1; }
    return -1;
  }
  // Number of HTF bars fully CLOSED by time t (bar.time + sec <= t).
  function htfClosedCount(arr, sec, t) {
    let lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m].time + sec <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans + 1;
  }

  // Price a stop/target exit on bar `c`. If the bar OPENED beyond the level (a gap),
  // the order fills at the open: worse than the stop, better than the target.
  function levelFill(side, kind, level, c) {
    if (side === 'long') return kind === 'sl' ? Math.min(level, c.open) : Math.max(level, c.open);
    return kind === 'sl' ? Math.max(level, c.open) : Math.min(level, c.open);
  }

  // Pure simulation over ALL candles. Returns { trades, signals, stats, equity, finalBalance }.
  //   cfg.fillMode  'nextOpen' (default): a signal decided on bar i's close fills at
  //                 bar i+1's open — the earliest price you could really trade at.
  //                 'close': fills at bar i's own close (optimistic).
  //   cfg.ambiguous 'sl' (default): when one bar touches both SL and TP, assume the
  //                 stop hit first. 'tp': assume the target did (best case).
  function simulate(strat, prms, candles, cfg, env) {
    const s = Object.create(strat);
    s.init(prms);
    const warm = strat.warmUpBars || 0;
    const nextOpen = cfg.fillMode !== 'close';
    const tpFirst = cfg.ambiguous === 'tp';
    const comm = cfg.commissionPct / 100, slip = cfg.slippagePct / 100;
    const cache = makeSeriesCache(candles);
    const baseSec = barSeconds(candles);
    const sess = sessionClock(cfg);
    const ienv = { baseSec, sess, htf: makeHtfProvider(candles, baseSec, env) };

    let balance = cfg.startBalance, totalFees = 0, ambiguousBars = 0, sessionBlocked = 0;
    let pos = null, pending = null, resting = null;   // resting = open limit order
    const st = newStops();
    const trades = [], signals = [], equity = [];

    function openPos(side, price, i, reason, o, noSlip) {
      const fill = noSlip ? price : side === 'long' ? price * (1 + slip) : price * (1 - slip);
      const { size, mode } = orderSize(o, side, fill, balance, cfg);
      if (!(size > 0)) return;
      pos = { side, entry: fill, size, entryIndex: i, sizeMode: mode };
      signals.push({ index: i, time: candles[i].time, type: side, price: fill, reason, size });
    }
    function closePos(price, i, reason) {
      if (!pos) return;
      const exitFill = pos.side === 'long' ? price * (1 - slip) : price * (1 + slip);
      const grossPct = pos.side === 'long'
        ? (exitFill - pos.entry) / pos.entry * 100 : (pos.entry - exitFill) / pos.entry * 100;
      const fees = pos.size * comm * 2;
      const usd = pos.size * (grossPct / 100) - fees;
      totalFees += fees; balance += usd;
      trades.push({ side: pos.side, entry: pos.entry, exit: exitFill, pct: grossPct, usd,
        size: pos.size, entryIndex: pos.entryIndex, exitIndex: i });
      signals.push({ index: i, time: candles[i].time, type: 'close', price: exitFill, reason });
      pos = null; Object.assign(st, newStops());
    }
    // Act on an order at `price` on bar i. The engine auto-reverses: 'long' while
    // short closes the short first. Stop levels attach to the position they arrive with.
    function execute(o, price, i) {
      let fresh = false;
      if (o.signal === 'cancel') { resting = null; return; }
      if ((o.signal === 'long' || o.signal === 'short') && o.limitPrice != null) {
        if (!pos) resting = { ...o, placedIndex: i };    // fills on a later bar (see the loop)
        return;
      }
      if (o.signal === 'long' || o.signal === 'short') {
        if (pos && pos.side !== o.signal) closePos(price, i, o.reason);
        if (!pos) { openPos(o.signal, price, i, o.reason, o); fresh = !!pos; }
      } else if (o.signal === 'close') {
        closePos(price, i, o.reason);
      }
      if (pos) applyOrderStops(st, o, pos.side, pos.entry, fresh);
    }

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const closeT = c.time + baseSec;
      if (pending) { execute(pending, c.open, i); pending = null; }

      // resting limit order: fills if this bar trades through it
      let limitBar = false;     // filled during this bar, after its open (its high/low may predate the fill)
      if (resting && !pos) {
        const fill = limitFill(resting, c);
        if (fill != null) {
          const o = resting; resting = null;
          openPos(o.signal, fill, i, o.reason + ' (limit fill)', o, true);
          if (pos) { applyOrderStops(st, o, pos.side, pos.entry, true); limitBar = fill !== c.open; }
        }
      }

      // stop-loss / take-profit touch during the bar
      if (pos && (st.sl != null || st.tp != null)) {
        const isLong = pos.side === 'long';
        const hitSL = st.sl != null && (isLong ? c.low <= st.sl : c.high >= st.sl);
        // on a mid-bar limit fill only the stop counts (worst case): the bar's best price may have come first
        const hitTP = !limitBar && st.tp != null && (isLong ? c.high >= st.tp : c.low <= st.tp);
        if (hitSL && hitTP) ambiguousBars++;
        if (hitSL && !(hitTP && tpFirst)) closePos(levelFill(pos.side, 'sl', st.sl, c), i, st.slKind);
        else if (hitTP) closePos(levelFill(pos.side, 'tp', st.tp, c), i, 'Take profit');
      }
      // survived the bar: ratchet trailing stop / arm break-even for the next bar
      if (pos && !limitBar) advanceStops(st, pos.side, pos.entry, c);

      const inSess = sess.inSession(closeT);
      if (pos && sess.closeOutside && !inSess) closePos(c.close, i, 'Outside session');

      // the strategy still sees every bar after warm-up (even one that stopped out)
      // so stateful logic like "previous EMA side" never skips a candle
      if (i >= warm) {
        const account = accountView(pos, st, balance, i, resting);
        const res = s.onCandle(c, makeIndicators(cache, i, ienv), account);
        let order = toOrder(res, s.reason);
        if (order && !inSess && (order.signal === 'long' || order.signal === 'short')) {
          // outside the session: no new entries; a reversal still exits the old side
          sessionBlocked++;
          order = pos && pos.side !== order.signal
            ? { ...order, signal: 'close', reason: order.reason + ' (entry blocked: outside session)' } : null;
        }
        if (order) {
          if (nextOpen) pending = order;
          else execute(order, c.close, i);
        }
      }

      // mark-to-market equity at this bar's close
      let open = 0;
      if (pos) open = pos.size * (pos.side === 'long' ? c.close - pos.entry : pos.entry - c.close) / pos.entry;
      equity.push({ time: c.time, value: balance + open });
    }
    if (pos) closePos(candles[candles.length - 1].close, candles.length - 1, 'Session end');
    if (equity.length) equity[equity.length - 1].value = balance;

    const stats = computeStats(trades, cfg.startBalance, balance, totalFees, equity);
    stats.ambiguousBars = ambiguousBars;
    stats.sessionBlocked = sessionBlocked;
    stats.avgSizePct = trades.length
      ? trades.reduce((a, t) => a + t.size, 0) / trades.length / cfg.startBalance * 100 : 0;
    Object.assign(stats, buyAndHold(candles, cfg));
    return { trades, signals, stats, equity, finalBalance: balance };
  }

  // What onCandle sees as `account` (third argument).
  function accountView(pos, st, balance, i, resting) {
    return {
      limitOrder: resting ? { side: resting.signal, price: resting.limitPrice } : null,
      position: pos ? pos.side : null, entryPrice: pos ? pos.entry : null, balance,
      size: pos ? pos.size : 0,
      stopLoss: pos ? st.sl : null, takeProfit: pos ? st.tp : null,
      barsInTrade: pos && pos.entryIndex != null ? i - pos.entryIndex : 0,
    };
  }

  // Buy at the first candle's open, sell at the last close, using the SAME position
  // size, fees and slippage as the strategy so the two numbers are comparable.
  function buyAndHold(candles, cfg) {
    if (!candles.length) return { marketPct: 0, buyHoldPct: 0 };
    const first = candles[0].open, last = candles[candles.length - 1].close;
    const slip = cfg.slippagePct / 100, comm = cfg.commissionPct / 100;
    const size = cfg.startBalance * (cfg.sizePct / 100);
    const usd = size * ((last * (1 - slip)) / (first * (1 + slip)) - 1) - size * comm * 2;
    return { marketPct: (last / first - 1) * 100, buyHoldPct: (usd / cfg.startBalance) * 100 };
  }

  // ---- indicator series cache ------------------------------------------------
  // ema / sma / rsi are causal (the value at bar i only uses bars 0..i), so each one
  // is computed ONCE over the whole series and the strategy gets a view that ends at
  // the current bar. Same numbers as recomputing on a prefix every bar, but O(n)
  // total instead of O(n²).
  function makeSeriesCache(candles) {
    return { candles, closes: candles.map((c) => c.close), series: new Map() };
  }

  // Read-only-looking array view of full[0..n-1]: length/index reads are O(1) and
  // never see past bar n-1. Anything else (slice, map, for…of, writes) runs on a
  // real copy made on first use, so strategies can treat it as a plain array.
  function prefixView(full, n) {
    let copy = null;
    const real = () => copy || (copy = full.slice(0, n));
    return new Proxy(full, {
      get(t, k) {
        if (copy) { const v = copy[k]; return typeof v === 'function' ? v.bind(copy) : v; }
        if (k === 'length') return n;
        if (typeof k === 'string') {
          const ch = k.charCodeAt(0);
          if (ch >= 48 && ch <= 57) { const idx = +k; return idx < n ? t[idx] : undefined; }
        }
        const arr = real(), v = arr[k];
        return typeof v === 'function' ? v.bind(arr) : v;
      },
      set(t, k, v) { real()[k] = v; return true; },
      has(t, k) { return k in real(); },
    });
  }

  // The `indicators` object passed to onCandle at bar i. Calling an indicator on the
  // provided `closes` / `candles` hits the cache (computed once over the full series,
  // returned as a view ending at bar i); any other input array is computed directly.
  //   env (optional) = { baseSec, sess, htf } from simulate()/live replay — enables
  //   indicators.htf(), .time and .inSession.
  function makeIndicators(cache, i, env) {
    const n = i + 1;
    const closes = prefixView(cache.closes, n);
    const candles = prefixView(cache.candles, n);
    const view = (full) => {
      if (Array.isArray(full)) return prefixView(full, n);
      const o = {};
      Object.keys(full).forEach((k) => { o[k] = prefixView(full[k], n); });
      return o;
    };
    // calc(src, ...args) over `closes` (srcKind 'closes') or `candles` ('candles')
    const cachedOn = (srcKind, name, calc) => (src, ...args) => {
      const mine = srcKind === 'closes' ? closes : candles;
      if (src !== mine) return calc(src, ...args);
      const key = name + ':' + args.join(',');
      let full = cache.series.get(key);
      if (!full) { full = calc(srcKind === 'closes' ? cache.closes : cache.candles, ...args); cache.series.set(key, full); }
      return view(full);
    };
    const cached = (name, calc) => cachedOn('closes', name, calc);

    const ind = {
      // closes-based → array
      ema: cached('ema', ema),
      sma: cached('sma', sma),
      rsi: cached('rsi', rsi),
      highest: cached('highest', highest),
      lowest: cached('lowest', lowest),
      macd: cached('macd', macd),             // (closes, fast=12, slow=26, signal=9) → { macd, signal, hist }
      bollinger: cached('bb', bollinger),     // (closes, period=20, mult=2) → { middle, upper, lower, width }
      // candle-based
      atr: cachedOn('candles', 'atr', atr),               // (candles, period=14) → array
      vwap: cachedOn('candles', 'vwap', vwap),            // (candles, 'D'|'W'|'none') → array
      stochastic: cachedOn('candles', 'stoch', stochastic), // (candles, k=14, smooth=3, d=3) → { k, d }
      adx: cachedOn('candles', 'adx', adx),               // (candles, period=14) → { adx, plusDI, minusDI }
      closes, candles, index: i,
    };

    if (env) {
      const c = cache.candles[i];
      const l = env.sess.local(c.time);
      ind.time = { open: c.time, close: c.time + env.baseSec, hour: l.hour, minute: l.minute, dow: l.dow };
      ind.inSession = env.sess.inSession(c.time + env.baseSec);
      // Higher-timeframe view: only HTF bars that have CLOSED by this bar's close.
      // Same API as `indicators` (ema/atr/... on h.closes / h.candles).
      ind.htf = (iv) => {
        const h = env.htf(iv);
        const cnt = htfClosedCount(h.candles, h.sec, c.time + env.baseSec);
        const hi = makeIndicators(h.cache, cnt - 1, null);
        hi.source = h.source;
        return hi;
      };
    }
    return ind;
  }

  // live replay: reuse one cache while the candle array is unchanged
  function liveSeriesCache(candles) {
    if (!liveCache || liveCache.candles !== candles || liveCache.closes.length !== candles.length) {
      liveCache = makeSeriesCache(candles);
    }
    return liveCache;
  }

  function computeStats(trades, startBalance, finalBalance, totalFees, equity) {
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

    // max drawdown over the per-bar mark-to-market equity curve (includes losses
    // while a trade is still open); falls back to closed trades if none is given
    const curve = equity && equity.length ? equity.map((e) => e.value)
      : trades.reduce((a, t) => { a.push(a[a.length - 1] + t.usd); return a; }, [startBalance]);
    let peak = startBalance, maxDD = 0;
    curve.forEach((eq) => {
      peak = Math.max(peak, eq);
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

  function renderResults(st, equity) {
    lastStats = st;
    const pf = st.profitFactor === Infinity ? '∞' : st.profitFactor.toFixed(2);
    const col = st.netUsd >= 0 ? UP : DOWN;
    const row = (label, val, color, title) =>
      `<div class="ts-row"${title ? ` title="${title}"` : ''}><span>${label}</span><b${color ? ` style="color:${color}"` : ''}>${val}</b></div>`;
    const vsBH = st.netPct - st.buyHoldPct;
    const amb = st.ambiguousBars || 0;
    if (eqChart) { eqChart.remove(); eqChart = null; }
    elResults.innerHTML =
      `<div class="sg-results-title">BACKTEST RESULTS</div>` +
      row('Net P&L', `${fmtMoney(st.netUsd)} (${fmtPct(st.netPct)})`, col) +
      row('Buy & hold', fmtPct(st.buyHoldPct), null,
        `Buy the first candle's open, sell the last close, at the same position size, fees and slippage. Price moved ${fmtPct(st.marketPct)}.`) +
      row('Strategy vs B&H', `${fmtPct(vsBH)} pts`, vsBH >= 0 ? UP : DOWN) +
      row('Same-bar SL + TP', amb ? `${amb} bar${amb === 1 ? '' : 's'} (stop assumed first)` : '0', amb ? '#f59e0b' : null,
        'Candles that touched both the stop-loss and the take-profit. OHLC data cannot say which came first, so the stop is assumed.') +
      (amb ? row('Net if target first', fmtMoney(st.netUsdIfTpFirst), null, 'Same backtest, but those bars hit the take-profit first (best case).') : '') +
      `<div class="sg-equity"></div>` +
      row('Total trades', st.totalTrades) +
      row('Win rate', `${st.winRate.toFixed(1)}%`) +
      row('Profit factor', pf) +
      row('Max drawdown', `${st.maxDrawdown.toFixed(1)}%`, DOWN) +
      row('Sharpe ratio', st.sharpe.toFixed(2)) +
      row('Avg win / loss', `${fmtMoney(st.avgWin)} / ${fmtMoney(st.avgLoss)}`) +
      row('Largest win / loss', `${fmtMoney(st.largestWin)} / ${fmtMoney(st.largestLoss)}`) +
      row('Max consec. W / L', `${st.maxConsecWins} / ${st.maxConsecLosses}`) +
      row('Total fees paid', `$${st.totalFees.toFixed(2)}`) +
      (st.totalTrades ? row('Avg position size', `${(st.avgSizePct || 0).toFixed(1)}% of start balance`, null,
        'Average notional per trade. With "Risk % per trade" this varies with each trade\'s stop distance.') : '') +
      (st.sessionBlocked ? row('Entries blocked', `${st.sessionBlocked} (outside session)`, '#f59e0b',
        'Entry signals ignored because the candle closed outside the session filter.') : '');

    if (equity && equity.length) drawEquityChart(elResults.querySelector('.sg-equity'), equity);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'sg-save-btn';
    saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save to Data';
    saveBtn.onclick = () => saveSingleRun(saveBtn);
    elResults.appendChild(saveBtn);
  }

  // Account balance (marked to market each bar) on top, drawdown % from the running
  // peak underneath, in two panes of one small Lightweight Charts instance.
  function drawEquityChart(host, equity) {
    const css = getComputedStyle(document.documentElement);
    const dim = css.getPropertyValue('--text-dim').trim() || '#787b86';
    const border = css.getPropertyValue('--border').trim() || '#2a2e39';
    eqChart = LightweightCharts.createChart(host, {
      autoSize: true,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: dim, fontSize: 9,
        attributionLogo: false, panes: { separatorColor: border } },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false },
      // minBarSpacing defaults to 0.5px, which would crop a 5000-bar run to its
      // last ~500 bars in this narrow pane; allow sub-pixel spacing so it all fits
      timeScale: { borderVisible: false, visible: false, minBarSpacing: 0.001 },
      handleScroll: false, handleScale: false,
      crosshair: { horzLine: { visible: false } },
    });
    const eqSeries = eqChart.addSeries(LightweightCharts.LineSeries,
      { color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: true }, 0);
    const ddSeries = eqChart.addSeries(LightweightCharts.AreaSeries,
      { lineColor: DOWN, topColor: 'rgba(239,83,80,0.05)', bottomColor: 'rgba(239,83,80,0.35)',
        lineWidth: 1, priceLineVisible: false, invertFilledArea: true,
        priceFormat: { type: 'custom', formatter: (v) => v.toFixed(1) + '%' } }, 1);
    let peak = -Infinity;
    eqSeries.setData(equity);
    ddSeries.setData(equity.map((e) => {
      peak = Math.max(peak, e.value);
      return { time: e.time, value: (e.value / peak - 1) * 100 };
    }));
    try { eqChart.panes()[1].setHeight(45); } catch (_) { /* older builds: default split */ }
    eqChart.timeScale().fitContent();
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
      interval: (document.querySelector('#tfTabs .active') || {}).dataset?.v || '',
      max_candles: parseInt((document.getElementById('maxCandles') || {}).value) || 0,
      params: { ...params },
      settings: savedSettings(cfg),
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
    IndicatorManager.restoreSet(strat.chartIndicators(params), { skipPersist: true });
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
    clearSLTPLines(); livePending = null; setLiveResting(null); liveCache = null; liveHtf = null; liveEntryIndex = null;
    clearError();
    elLog.innerHTML = '';
    appendLog('<i class="fas fa-eye"></i>', `Watching ${strat.name} from candle ${replay.cutIndex + 1}`);
  }

  // called from app when leaving replay — restore the user's indicators + clean up
  function onExitReplay() {
    restoreIndicators();
    liveMarkers = []; clearMarkers();
    clearSLTPLines();
    livePending = null; setLiveResting(null);
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

  // indicator env for live replay (same as simulate's): bar length, session clock
  // (re-read from the panel each bar so edits apply immediately) and HTF data.
  let liveHtf = null, liveEntryIndex = null;
  function liveEnv(candles) {
    if (!liveHtf || liveHtf.candles !== candles) {
      const baseSec = barSeconds(candles);
      liveHtf = { candles, baseSec, htf: makeHtfProvider(candles, baseSec, dataEnv()) };
    }
    return { baseSec: liveHtf.baseSec, sess: sessionClock(settings()), htf: liveHtf.htf };
  }

  // re-seed live strategy internal state over revealed history without trading
  function rebuildLiveState() {
    const strat = getStrategy(stratId);
    const candles = getFullCandles();
    if (!strat || !candles.length) return;
    live = Object.create(strat);
    live.init(params);
    livePending = null; setLiveResting(null);
    const cache = liveSeriesCache(candles);
    const env = liveEnv(candles);
    const cut = replay.cutIndex;
    const warm = strat.warmUpBars || 0;
    for (let i = warm; i <= cut; i++) {
      try { live.onCandle(candles[i], makeIndicators(cache, i, env),
        accountView(null, newStops(), CFG.START_BALANCE, i)); } catch (e) { /* ignore during reseed */ }
    }
    lastProcessedIndex = cut;
  }

  // called from app on every Replay 'tick'
  function onTick(payload) {
    if (!modeActive || !live || !payload) return;
    if (payload.forming) {
      // realistic formation: fill a next-open order on the first tick of the new
      // candle (payload.index is still the decision bar), not after it completes
      if (livePending && payload.index === livePending.index) {
        const o = livePending; livePending = null;
        executeLive(o, payload.candle.open, payload.candle.time, payload.index + 1);
      }
      return;
    }
    const idx = payload.index;
    if (idx <= lastProcessedIndex) return;
    const candles = getFullCandles();
    for (let i = lastProcessedIndex + 1; i <= idx; i++) processCandle(i, candles);
  }

  function liveAccount(i) {
    const a = tradeSim.getAccount();
    const pos = a.position ? { side: a.position, entry: a.entryPrice, size: a.size, entryIndex: liveEntryIndex } : null;
    return accountView(pos, liveStops, a.balance, i, liveResting);
  }

  function processCandle(i, candles) {
    lastProcessedIndex = i;
    const strat = getStrategy(stratId);
    const c = candles[i];
    const cfg = settings();
    const nextOpen = cfg.fillMode !== 'close';
    const env = liveEnv(candles);

    // a next-open order decided on the previous candle (candle-mode replay, or a
    // step that skipped the forming ticks) fills at this candle's open
    if (livePending) { const o = livePending; livePending = null; executeLive(o, c.open, c.time, i); }

    // resting limit order: fills if this candle traded through it (no slippage)
    let limitBar = false;
    if (liveResting && !tradeSim.getAccount().position) {
      const fill = limitFill(liveResting, c);
      if (fill != null) {
        const o = liveResting; setLiveResting(null);
        appendLog('<i class="fas fa-bullseye"></i>', `Candle ${i} — LIMIT ${o.signal.toUpperCase()} filled at ${fmtNum(fill)}`);
        executeLive({ ...o, limitPrice: null }, fill, c.time, i, true);
        limitBar = fill !== c.open;
      }
    }

    // SL/TP auto-close at the level (or the open, if the candle gapped past it)
    let acct = tradeSim.getAccount();
    const ls = liveStops;
    if (acct.position && (ls.sl != null || ls.tp != null)) {
      const isLong = acct.position === 'long';
      const hitSL = ls.sl != null && (isLong ? c.low <= ls.sl : c.high >= ls.sl);
      const hitTP = !limitBar && ls.tp != null && (isLong ? c.high >= ls.tp : c.low <= ls.tp);
      if (hitSL || hitTP) {
        const kind = ls.slKind;
        tradeSim.close(levelFill(acct.position, hitSL ? 'sl' : 'tp', hitSL ? ls.sl : ls.tp, c));
        clearSLTPLines(); pushLiveMarker(c.time, 'close');
        appendLog('<i class="fas fa-square-xmark"></i>', `Candle ${i} — ${hitSL ? kind.toUpperCase() : 'TARGET'} hit` +
          (hitSL && hitTP ? ' (candle also touched the target; stop assumed first)' : ''));
      }
    }
    // survived the bar: trail the stop / arm break-even (applies from the next bar)
    acct = tradeSim.getAccount();
    if (acct.position && !limitBar && advanceStops(liveStops, acct.position, acct.entryPrice, c)) {
      drawSLTPLines();
      appendLog('<i class="fas fa-shield-halved"></i>', `Candle ${i} — ${liveStops.slKind} moved to ${fmtNum(liveStops.sl)}`);
    }
    const inSess = env.sess.inSession(c.time + env.baseSec);
    if (acct.position && env.sess.closeOutside && !inSess) {
      tradeSim.close(c.close); clearSLTPLines(); pushLiveMarker(c.time, 'close');
      appendLog('<i class="fas fa-clock"></i>', `Candle ${i} — CLOSE · outside session`);
    }

    if (i < (strat.warmUpBars || 0)) { appendLog('<i class="fas fa-hourglass-half"></i>', `Candle ${i} — Warming up (${i}/${strat.warmUpBars})`); return; }

    acct = tradeSim.getAccount();
    let res;
    try {
      res = live.onCandle(c, makeIndicators(liveSeriesCache(candles), i, env), liveAccount(i));
    } catch (e) {
      replay.pause();
      showError(`${strat.name}.onCandle() threw at candle ${i}: ${e.message}`);
      appendLog('<i class="fas fa-triangle-exclamation"></i>', `Candle ${i} — ERROR: ${e.message}`);
      return;
    }
    let order = toOrder(res, live.reason);
    const reason = live.reason || '';
    if (order && !inSess && (order.signal === 'long' || order.signal === 'short')) {
      appendLog('<i class="fas fa-clock"></i>', `Candle ${i} — ${order.signal.toUpperCase()} blocked (outside session) · ${reason}`);
      order = acct.position && acct.position !== order.signal ? { ...order, signal: 'close' } : null;
      if (!order) return;
    }
    const sig = order && order.signal;
    const when = nextOpen ? ' → fills next open' : '';
    if ((sig === 'long' || sig === 'short') && order.limitPrice != null) appendLog('<i class="fas fa-bullseye"></i>', `Candle ${i} — LIMIT ${sig.toUpperCase()} @ ${fmtNum(order.limitPrice)} · ${reason}`);
    else if (sig === 'cancel') appendLog('<i class="fas fa-ban"></i>', `Candle ${i} — limit order cancelled · ${reason}`);
    else if (sig === 'long') appendLog('<i class="fas fa-arrow-up"></i>', `Candle ${i} — LONG · ${reason}${when}`);
    else if (sig === 'short') appendLog('<i class="fas fa-arrow-down"></i>', `Candle ${i} — SHORT · ${reason}${when}`);
    else if (sig === 'close' && acct.position) appendLog('<i class="fas fa-xmark"></i>', `Candle ${i} — CLOSE · ${reason}${when}`);
    else appendLog('<i class="fas fa-minus"></i>', `Candle ${i} — No signal · ${reason}`);

    if (!order) return;
    if (nextOpen) livePending = { ...order, index: i };
    else executeLive(order, c.close, c.time, i);
  }

  // Live mirror of simulate()'s execute(): act on an order at `price` on the
  // candle at `time` (index i), auto-reversing, sizing new trades like the backtest,
  // then attach the order's stop levels to the open position.
  function executeLive(o, price, time, i, noSlip) {
    const pos = tradeSim.getAccount().position;
    let fresh = false;
    if (o.signal === 'cancel') { setLiveResting(null); return; }
    if ((o.signal === 'long' || o.signal === 'short') && o.limitPrice != null) {
      if (!pos) setLiveResting({ ...o, placedIndex: i });
      return;
    }
    if (o.signal === 'long' || o.signal === 'short') {
      if (pos && pos !== o.signal) { tradeSim.close(price); clearSLTPLines(); pushLiveMarker(time, 'close'); }
      if (!tradeSim.getAccount().position) {
        const cfg = settings(), slip = noSlip ? 0 : cfg.slippagePct / 100;
        const fill = o.signal === 'long' ? price * (1 + slip) : price * (1 - slip);
        const { size, mode } = orderSize(o, o.signal, fill, tradeSim.getAccount().balance, cfg);
        tradeSim.open(o.signal, price, size, { noSlip: !!noSlip });
        if (tradeSim.getAccount().position) {
          fresh = true; liveEntryIndex = i;
          pushLiveMarker(time, o.signal);
          appendLog('<i class="fas fa-scale-balanced"></i>', `Candle ${i} — size $${size.toFixed(2)} (${mode === 'risk' ? `risk ${o.riskPct != null ? o.riskPct : cfg.riskPct}% at stop` : mode})`);
        }
      }
    } else if (o.signal === 'close' && pos) {
      tradeSim.close(price); clearSLTPLines(); pushLiveMarker(time, 'close');
    }
    const acct = tradeSim.getAccount();
    if (!acct.position) { clearSLTPLines(); return; }
    applyOrderStops(liveStops, o, acct.position, acct.entryPrice, fresh);
    drawSLTPLines();
  }

  // ---- SL/TP lines ---------------------------------------------------------
  let slLine = null, tpLine = null, beLine = null, limitLine = null;
  // resting limit order + its dotted price line on the chart
  function setLiveResting(r) {
    liveResting = r;
    const series = typeof ChartView !== 'undefined' && ChartView.getCandleSeries ? ChartView.getCandleSeries() : null;
    if (!series) return;
    if (limitLine) { series.removePriceLine(limitLine); limitLine = null; }
    if (r) limitLine = series.createPriceLine({ price: r.limitPrice, color: '#22c55e', lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dotted, axisLabelVisible: true, title: 'LIMIT ' + (r.signal === 'long' ? 'BUY' : 'SELL') });
  }
  function drawSLTPLines() {
    const series = ChartView.getCandleSeries();
    removeSLTPGraphics();
    const dashed = LightweightCharts.LineStyle.Dashed, dotted = LightweightCharts.LineStyle.Dotted;
    const ls = liveStops;
    const slTitle = ls.slKind === 'Trailing stop' ? 'TRAIL' : ls.slKind === 'Break-even stop' ? 'BE' : 'SL';
    if (ls.sl != null) slLine = series.createPriceLine({ price: ls.sl, color: DOWN, lineWidth: 1, lineStyle: dashed, axisLabelVisible: true, title: slTitle });
    if (ls.tp != null) tpLine = series.createPriceLine({ price: ls.tp, color: UP, lineWidth: 1, lineStyle: dashed, axisLabelVisible: true, title: 'TP' });
    if (ls.be != null && !ls.beDone) beLine = series.createPriceLine({ price: ls.be, color: DIM, lineWidth: 1, lineStyle: dotted, axisLabelVisible: false, title: 'BE trigger' });
  }
  function removeSLTPGraphics() {
    const series = ChartView.getCandleSeries();
    if (slLine) { series.removePriceLine(slLine); slLine = null; }
    if (tpLine) { series.removePriceLine(tpLine); tpLine = null; }
    if (beLine) { series.removePriceLine(beLine); beLine = null; }
  }
  function clearSLTPLines() { removeSLTPGraphics(); liveStops = newStops(); liveEntryIndex = null; }

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
        if (candles[idx]) ChartView.setCursor(candles[idx].time);
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

  return { init, setModeActive, onEnterReplay, onExitReplay, onTick, onDataChanged, clearMarkers,
    simulate, makeIndicators,
    get active() { return modeActive; } };
})();
