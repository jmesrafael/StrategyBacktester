// strategy.js — Strategy Mode: strategy picker panel, silent backtest engine,
// automated replay execution, signal log + tooltip. Drives TradeSim for the actual
// account mechanics (fees/slippage live in trade-sim.js), so Game and Strategy mode
// share one account layer. Strategy files register on window.__STRATEGIES (see
// strategies/registry.js + the README contract).

const StrategyMode = (() => {
  const UP = '#26a69a', DOWN = '#ef5350', DIM = '#b2b5be';

  let chart, chartHost, button, replay, tradeSim, getFullCandles, onWatchReplay;

  // panel DOM
  let panel, elStratList, elDesc, elParams,
      elRun, elResults, elLog, elLogToggle, elError, elMtfRun, elMtf,
      elMatrixRun, elMatrixOut;
  let elAutoSave;    // passive "auto-saves as you edit" status (flashes on save)
  let autoSaveTimer = null;
  let modalOverlay, modalEl, elModalTitle;   // centered settings modal
  let tooltip, banner, nameLabel;

  // current selection + run state
  let stratId = null;          // registry id
  let params = {};             // resolved param values for the active strategy
  let lastResult = null;       // last backtest result (signals/stats)
  let lastStats = null;        // stats from the most recent single backtest (for Save button)
  let lastCandleRange = null;  // { from, to, bars, days } of the candle slice most recently tested
  let signalsByTime = new Map();// time -> signal record (for the marker tooltip)

  // live replay-execution state
  let modeActive = false;      // Strategy tab selected
  let live = null;             // fresh strategy instance for replay
  let lastProcessedIndex = -1;
  let liveSL = null, liveTP = null;
  let liveMarkers = [];        // entry/exit dots drawn live as trades execute
  let overlayOn = false;       // StrategyOverlay active for the current strategy (opt-in)
  let liveTrades = [];         // executed trades fed to StrategyOverlay { entryTime, entryPrice, dir, stop, target, exitTime, exitPrice }
  let openTrade = null;        // the currently-open trade record (or null)
  let savedIndicators = null;  // user's indicator set, restored when replay ends
  let startRange = '3m';
  let mtfSelectedTfs = ['1', '5', '60', '240', 'D'];
  let mtfSelectedPairs = null;   // pairs for the matrix run; defaults to the current symbol below
  let replayRangeNum = 3, replayRangeUnit = 'months';
  let mtfRangeNum = 6, mtfRangeUnit = 'months';
  let lastReplayRangeLabel = '';   // lookback label of the most recent replay launch (for the on-chart badge)
  try {
    const _ms = JSON.parse(localStorage.getItem('cr.mtfTfs') || 'null');
    if (Array.isArray(_ms)) mtfSelectedTfs = _ms;
    else if (_ms && _ms.tfs) { mtfSelectedTfs = _ms.tfs; mtfRangeNum = _ms.rangeNum || 6; mtfRangeUnit = _ms.rangeUnit || 'months'; }
    const _mp = JSON.parse(localStorage.getItem('cr.mtfPairs') || 'null');
    if (Array.isArray(_mp) && _mp.length) mtfSelectedPairs = _mp;
    const _rr = JSON.parse(localStorage.getItem('cr.replayRange') || 'null');
    if (_rr) { replayRangeNum = _rr.n || 3; replayRangeUnit = _rr.unit || 'months'; }
  } catch {}
  // Fall back to the symbol currently loaded in the top bar (single-pair default).
  if (!mtfSelectedPairs) {
    const _sym = (typeof localStorage !== 'undefined' && localStorage.getItem(CFG.STORE.symbol)) || CFG.DEFAULTS.symbol;
    mtfSelectedPairs = [_sym];
  }

  // ---- formatters ----------------------------------------------------------
  function fmtMoney(v) {
    const s = v < 0 ? '-' : '+';
    return `${s}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function fmtPct(v) { return `${v < 0 ? '-' : '+'}${Math.abs(v).toFixed(2)}%`; }
  function fmtNum(v) { const a = Math.abs(v); const d = a < 1 ? 5 : a < 100 ? 3 : 2; return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  // Compact signed money for tight grid cells: +$1.2k / -$3.42 / +$340 / +$12.3k.
  // Small magnitudes keep 2 decimals so a +$3.42 cell isn't flattened to "+$3".
  function fmtMoneyShort(v) {
    const s = v < 0 ? '-' : '+';
    const a = Math.abs(v);
    if (a >= 1000) return `${s}$${(a / 1000).toFixed(a >= 100000 ? 0 : 1)}k`;
    return `${s}$${a.toFixed(a < 100 ? 2 : 0)}`;
  }

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
    // When any OTHER toolbar dropdown opens, close this one (no stacking).
    document.addEventListener('cr:menu-open', (e) => {
      if (e.detail !== 'strategy') panel.style.display = 'none';
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
    // ── anchored dropdown: just the strategy LIST (each row → opens the modal) ──
    panel = document.createElement('div');
    panel.className = 'sg-panel';
    panel.style.display = 'none';
    panel.innerHTML =
      `<div class="sg-title">Strategy</div>` +
      `<div class="sg-strat-list"></div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', (e) => e.stopPropagation());
    elStratList = panel.querySelector('.sg-strat-list');

    // Build MTF TF picker chips from ALL_INTERVALS (saved selection pre-checked)
    const mtfTfGrid = (CFG.ALL_INTERVALS || []).map(([k, l]) =>
      `<button class="sg-mtf-tf${mtfSelectedTfs.includes(k) ? ' active' : ''}" data-tf="${k}">${l}</button>`
    ).join('');
    // Build MTF pair picker chips from CFG.SYMBOLS (saved selection pre-checked)
    const mtfPairGrid = (CFG.SYMBOLS || []).map((sym) =>
      `<button class="sg-mtf-pair${mtfSelectedPairs.includes(sym) ? ' active' : ''}" data-pair="${sym}">${sym.replace('USDT', '')}</button>`
    ).join('');

    // ── centered modal: tabbed UI (Inputs / Replay / Results) ──
    modalOverlay = document.createElement('div');
    modalOverlay.className = 'sg-modal-overlay';
    modalOverlay.style.display = 'none';
    modalOverlay.innerHTML =
      `<div class="sg-modal">` +
        `<div class="sg-modal-head">` +
          `<span class="sg-modal-title"></span>` +
          `<button class="sg-modal-close" title="Close"><i class="fas fa-xmark"></i></button>` +
        `</div>` +
        // Two-column body: Inputs are ALWAYS visible on the left so params can be tweaked
        // without leaving the Replay/Backtest tab on the right.
        `<div class="sg-modal-body">` +
        // INPUTS sidebar — strategy-specific params only (capital/fee/size live in Trade Sim).
        // Auto-saves on every change; no manual save button.
        `<div class="sg-side-inputs">` +
          `<div class="sg-side-title">Inputs</div>` +
          `<div class="sg-desc"></div>` +
          `<div class="sg-params"></div>` +
          `<div class="sg-autosave"><i class="fas fa-cloud"></i> Auto-saves as you edit</div>` +
        `</div>` +
        // MAIN column — Replay / Backtest tabs
        `<div class="sg-main">` +
        `<div class="sg-tab-nav">` +
          `<button class="sg-tab-btn active" data-tab="replay">Replay</button>` +
          `<button class="sg-tab-btn" data-tab="backtest">Backtest</button>` +
        `</div>` +
        // REPLAY pane — custom range picker (number + unit) + quick presets
        `<div class="sg-tab-pane active" data-pane="replay">` +
          `<div class="sg-start-title">Replay start — set range then click Start</div>` +
          `<div class="sg-range-row">` +
            `<input class="sg-range-num" type="number" min="1" max="999">` +
            `<select class="sg-range-unit">` +
              `<option value="days">Day/s</option>` +
              `<option value="weeks">Week/s</option>` +
              `<option value="months">Month/s</option>` +
              `<option value="years">Year/s</option>` +
            `</select>` +
            `<button class="sg-start-btn"><i class="fas fa-play"></i> Start Replay</button>` +
          `</div>` +
          `<div class="sg-range-presets">` +
            `<button class="sg-rp" data-n="7" data-u="days">1W</button>` +
            `<button class="sg-rp" data-n="1" data-u="months">1M</button>` +
            `<button class="sg-rp" data-n="3" data-u="months">3M</button>` +
            `<button class="sg-rp" data-n="6" data-u="months">6M</button>` +
            `<button class="sg-rp" data-n="1" data-u="years">1Y</button>` +
          `</div>` +
          `<button class="sg-start-manual"><i class="fas fa-scissors"></i> Manual cut on chart</button>` +
        `</div>` +
        // BACKTEST pane — shared sim settings (incl. period) on top, then sub-tabs:
        //   • Run Backtest (current TF)   • Multi TF Backtest   + a shared signal log
        `<div class="sg-tab-pane" data-pane="backtest">` +
          `<div class="sg-sim-cfg">` +
            `<div class="sg-sim-cfg-title">Trade Sim Settings</div>` +
            `<div class="sg-sim-cfg-edit">` +
              `<label>Capital ($)<input class="sg-cfg-capital" type="number" min="1"></label>` +
              `<label>Size %<input class="sg-cfg-size" type="number" min="0.1" max="100" step="0.1"></label>` +
              `<label>Fee %<input class="sg-cfg-fee" type="number" min="0" step="0.01"></label>` +
              `<label>Slippage %<input class="sg-cfg-slip" type="number" min="0" step="0.001"></label>` +
              `<label class="sg-cfg-period">Period (lookback)` +
                `<span class="sg-cfg-period-row">` +
                  `<input class="sg-mtf-rnum" type="number" min="1" max="999">` +
                  `<select class="sg-mtf-runit">` +
                    `<option value="days">Day/s</option>` +
                    `<option value="weeks">Week/s</option>` +
                    `<option value="months">Month/s</option>` +
                    `<option value="years">Year/s</option>` +
                  `</select>` +
                `</span>` +
              `</label>` +
            `</div>` +
          `</div>` +
          `<div class="sg-error" style="display:none"></div>` +
          // sub-tabs: single-TF / multi-TF (current pair) / multi-TF across pairs — kept separate
          `<div class="sg-sub-nav">` +
            `<button class="sg-sub-btn active" data-sub="single">Run Backtest</button>` +
            `<button class="sg-sub-btn" data-sub="multi">Multi TF</button>` +
            `<button class="sg-sub-btn" data-sub="multipairs">Multi TF + Pairs</button>` +
          `</div>` +
          // SINGLE sub-pane — current timeframe backtest
          `<div class="sg-sub-pane active" data-subpane="single">` +
            `<div class="sg-run-row">` +
              `<button class="sg-run"><i class="fas fa-play"></i> Run Backtest</button>` +
              `<button class="sg-run-replay" title="Replay this backtest on the chart"><i class="fas fa-fast-forward"></i> Replay</button>` +
            `</div>` +
            `<div class="sg-results-hdr" style="display:none">` +
              `<span>BACKTEST RESULTS</span>` +
              `<button class="sg-clear-results" title="Clear">✕</button>` +
            `</div>` +
            `<div class="sg-results"></div>` +
          `</div>` +
          // MULTI sub-pane — current pair across the selected timeframes (per-TF cards)
          `<div class="sg-sub-pane" data-subpane="multi">` +
            `<div class="sg-mtf-pick-label">Timeframes <span class="sg-mtf-pick-hint">· current pair</span></div>` +
            `<div class="sg-mtf-tf-grid">${mtfTfGrid}</div>` +
            `<button class="sg-mtf-run"><i class="fas fa-play"></i> Run Multi TF</button>` +
            `<div class="sg-mtf-hdr" style="display:none">` +
              `<span>MULTI-TF RESULTS</span>` +
              `<button class="sg-clear-mtf" title="Clear">✕</button>` +
            `</div>` +
            `<div class="sg-mtf"></div>` +
          `</div>` +
          // MULTIPAIRS sub-pane — pairs × timeframes heatmap matrix
          `<div class="sg-sub-pane" data-subpane="multipairs">` +
            `<div class="sg-mtf-pick-label">Pairs</div>` +
            `<div class="sg-mtf-pair-grid">${mtfPairGrid}</div>` +
            `<div class="sg-mtf-pick-label">Timeframes</div>` +
            `<div class="sg-mtf-tf-grid">${mtfTfGrid}</div>` +
            `<button class="sg-matrix-run"><i class="fas fa-play"></i> Run matrix</button>` +
            `<div class="sg-matrix-hdr" style="display:none">` +
              `<span>MATRIX RESULTS</span>` +
              `<button class="sg-clear-matrix" title="Clear">✕</button>` +
            `</div>` +
            `<div class="sg-matrix-out"></div>` +
          `</div>` +
        `</div>` +   // end .sg-tab-pane[backtest]
        `</div>` +   // end .sg-main
        `</div>` +   // end .sg-modal-body
      `</div>`;
    document.body.appendChild(modalOverlay);

    modalEl = modalOverlay.querySelector('.sg-modal');
    elModalTitle = modalOverlay.querySelector('.sg-modal-title');
    elDesc = modalOverlay.querySelector('.sg-desc');
    elParams = modalOverlay.querySelector('.sg-params');
    elRun = modalOverlay.querySelector('.sg-run');
    elResults = modalOverlay.querySelector('.sg-results');
    elError = modalOverlay.querySelector('.sg-error');
    elMtfRun = modalOverlay.querySelector('.sg-mtf-run');
    elMtf = modalOverlay.querySelector('.sg-mtf');
    elMatrixRun = modalOverlay.querySelector('.sg-matrix-run');
    elMatrixOut = modalOverlay.querySelector('.sg-matrix-out');
    elAutoSave = modalOverlay.querySelector('.sg-autosave');

    renderStratList();
    elRun.onclick = runBacktestClicked;

    // Shortcut: launch replay straight from the Run Backtest pane, using the same
    // lookback period as the backtest, so we don't have to switch to the Replay tab.
    const elRunReplay = modalOverlay.querySelector('.sg-run-replay');
    if (elRunReplay) elRunReplay.onclick = () => {
      closeStratModal();
      lastReplayRangeLabel = formatRangeLabel(mtfRangeNum, mtfRangeUnit);
      if (onWatchReplay) onWatchReplay({ type: 'preset', rangeSecs: calcRangeSecs(mtfRangeNum, mtfRangeUnit) });
    };

    // Top-level tab switching (Inputs / Replay / Backtest)
    modalOverlay.querySelectorAll('.sg-tab-btn').forEach((btn) => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        modalOverlay.querySelectorAll('.sg-tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
        modalOverlay.querySelectorAll('.sg-tab-pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === tab));
      };
    });

    // Backtest sub-tab switching (Run Backtest current-TF / Multi TF)
    modalOverlay.querySelectorAll('.sg-sub-btn').forEach((btn) => {
      btn.onclick = () => {
        const sub = btn.dataset.sub;
        modalOverlay.querySelectorAll('.sg-sub-btn').forEach((b) => b.classList.toggle('active', b === btn));
        modalOverlay.querySelectorAll('.sg-sub-pane').forEach((p) => p.classList.toggle('active', p.dataset.subpane === sub));
      };
    });

    // Replay range picker: number + unit inputs
    const elRangeNum = modalOverlay.querySelector('.sg-range-num');
    const elRangeUnit = modalOverlay.querySelector('.sg-range-unit');
    elRangeNum.value = replayRangeNum;
    elRangeUnit.value = replayRangeUnit;
    const saveReplayRange = () => {
      replayRangeNum = Math.max(1, parseInt(elRangeNum.value) || 3);
      replayRangeUnit = elRangeUnit.value || 'months';
      try { localStorage.setItem('cr.replayRange', JSON.stringify({ n: replayRangeNum, unit: replayRangeUnit })); } catch {}
    };
    elRangeNum.oninput = saveReplayRange;
    elRangeUnit.oninput = saveReplayRange;
    modalOverlay.querySelector('.sg-start-btn').onclick = () => {
      closeStratModal();
      lastReplayRangeLabel = formatRangeLabel(replayRangeNum, replayRangeUnit);
      if (onWatchReplay) onWatchReplay({ type: 'preset', rangeSecs: calcRangeSecs(replayRangeNum, replayRangeUnit) });
    };
    // Quick preset chips: fill the inputs and launch immediately
    modalOverlay.querySelectorAll('.sg-rp').forEach((b) => {
      b.onclick = () => {
        replayRangeNum = parseInt(b.dataset.n);
        replayRangeUnit = b.dataset.u;
        elRangeNum.value = replayRangeNum;
        elRangeUnit.value = replayRangeUnit;
        try { localStorage.setItem('cr.replayRange', JSON.stringify({ n: replayRangeNum, unit: replayRangeUnit })); } catch {}
        closeStratModal();
        lastReplayRangeLabel = formatRangeLabel(replayRangeNum, replayRangeUnit);
        if (onWatchReplay) onWatchReplay({ type: 'preset', rangeSecs: calcRangeSecs(replayRangeNum, replayRangeUnit) });
      };
    });
    // Manual cut: close modal, arm strategy replay, user double-clicks chart to set start
    modalOverlay.querySelector('.sg-start-manual').onclick = () => {
      closeStratModal(); lastReplayRangeLabel = 'manual cut'; if (onWatchReplay) onWatchReplay({ type: 'manual' });
    };

    // Sim cfg editable inputs (Period inputs in the same block are wired separately below)
    modalOverlay.querySelectorAll('.sg-cfg-capital, .sg-cfg-size, .sg-cfg-fee, .sg-cfg-slip')
      .forEach((inp) => { inp.oninput = onSimCfgChange; });

    // Clear results buttons
    modalOverlay.querySelector('.sg-clear-results').onclick = () => {
      elResults.innerHTML = '';
      modalOverlay.querySelector('.sg-results-hdr').style.display = 'none';
    };
    modalOverlay.querySelector('.sg-clear-mtf').onclick = () => {
      modalOverlay.querySelector('.sg-mtf').innerHTML = '';
      modalOverlay.querySelector('.sg-mtf-hdr').style.display = 'none';
    };
    modalOverlay.querySelector('.sg-clear-matrix').onclick = () => {
      modalOverlay.querySelector('.sg-matrix-out').innerHTML = '';
      modalOverlay.querySelector('.sg-matrix-hdr').style.display = 'none';
    };

    // Shared backtest Period (lookback) — lives in Trade Sim Settings, drives BOTH
    // the single-TF Run Backtest and the Multi-TF run.
    const elMtfRnum = modalOverlay.querySelector('.sg-mtf-rnum');
    const elMtfRunit = modalOverlay.querySelector('.sg-mtf-runit');
    elMtfRnum.value = mtfRangeNum;
    elMtfRunit.value = mtfRangeUnit;
    const saveMtfSettings = () => {
      mtfRangeNum = Math.max(1, parseInt(elMtfRnum.value) || 6);
      mtfRangeUnit = elMtfRunit.value || 'months';
      try { localStorage.setItem('cr.mtfTfs', JSON.stringify({ tfs: mtfSelectedTfs, rangeNum: mtfRangeNum, rangeUnit: mtfRangeUnit })); } catch {}
    };
    elMtfRnum.oninput = saveMtfSettings;
    elMtfRunit.oninput = saveMtfSettings;

    // MTF TF chips — both the Multi-TF and Multi-TF+Pairs panes render their own
    // `.sg-mtf-tf` grid bound to the SAME mtfSelectedTfs. Toggling syncs the active
    // class on every matching chip across both panes (one source of truth).
    modalOverlay.querySelectorAll('.sg-mtf-tf').forEach((chip) => {
      chip.onclick = () => {
        const tf = chip.dataset.tf;
        const idx = mtfSelectedTfs.indexOf(tf);
        if (idx >= 0) mtfSelectedTfs.splice(idx, 1); else mtfSelectedTfs.push(tf);
        const on = mtfSelectedTfs.includes(tf);
        modalOverlay.querySelectorAll(`.sg-mtf-tf[data-tf="${tf}"]`).forEach((c) => c.classList.toggle('active', on));
        try { localStorage.setItem('cr.mtfTfs', JSON.stringify({ tfs: mtfSelectedTfs, rangeNum: mtfRangeNum, rangeUnit: mtfRangeUnit })); } catch {};
      };
    });

    // MTF pair chips: toggle selection (keep ≥1 pair selected), persist
    modalOverlay.querySelectorAll('.sg-mtf-pair').forEach((chip) => {
      chip.onclick = () => {
        const sym = chip.dataset.pair;
        const idx = mtfSelectedPairs.indexOf(sym);
        if (idx >= 0) { if (mtfSelectedPairs.length > 1) mtfSelectedPairs.splice(idx, 1); }
        else mtfSelectedPairs.push(sym);
        chip.classList.toggle('active', mtfSelectedPairs.includes(sym));
        try { localStorage.setItem('cr.mtfPairs', JSON.stringify(mtfSelectedPairs)); } catch {};
      };
    });

    // Run buttons: Multi-TF (current pair) vs Multi-TF + Pairs (matrix)
    elMtfRun.onclick = () => runMultiTimeframe(false);
    elMatrixRun.onclick = () => runMultiTimeframe(true);

    // modal close: ✕ button, backdrop click, Esc
    modalOverlay.querySelector('.sg-modal-close').onclick = closeStratModal;
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeStratModal(); });
    modalEl.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay.style.display !== 'none') { e.stopPropagation(); closeStratModal(); }
    });
  }

  // List of strategies in the dropdown — each row opens the settings modal.
  function renderStratList() {
    if (!elStratList) return;
    elStratList.innerHTML = '';
    (window.STRATEGY_REGISTRY || []).forEach((s) => {
      const row = document.createElement('button');
      row.className = 'sg-strat-row' + (s.id === stratId ? ' active' : '');
      row.dataset.id = s.id;
      row.innerHTML = `<span class="sg-strat-name">${s.label}</span>` +
        `<i class="fas fa-chevron-right sg-strat-chevron"></i>`;
      row.onclick = () => { selectStrategy(s.id); panel.style.display = 'none'; openStratModal(); };
      elStratList.appendChild(row);
    });
  }

  function getCurrentTfLabel() {
    const v = localStorage.getItem(CFG.STORE.interval);
    const pair = (CFG.ALL_INTERVALS || []).find(([k]) => k === v);
    return pair ? pair[1] : (v || '?');
  }

  function openStratModal() {
    if (!modalOverlay) return;
    if (elRun) elRun.innerHTML = `<i class="fas fa-play"></i> Run Backtest (${getCurrentTfLabel()})`;
    const elRN = modalOverlay.querySelector('.sg-range-num');
    const elRU = modalOverlay.querySelector('.sg-range-unit');
    if (elRN) elRN.value = replayRangeNum;
    if (elRU) elRU.value = replayRangeUnit;
    const elMRN = modalOverlay.querySelector('.sg-mtf-rnum');
    const elMRU = modalOverlay.querySelector('.sg-mtf-runit');
    if (elMRN) elMRN.value = mtfRangeNum;
    if (elMRU) elMRU.value = mtfRangeUnit;
    refreshSimConfig();
    modalOverlay.style.display = 'grid';
  }
  function closeStratModal() {
    if (modalOverlay) modalOverlay.style.display = 'none';
  }

  // ---- input auto-save ----------------------------------------------------

  // Persist the current params for the active strategy. Consolidated key →
  // SettingsSync shim picks it up and syncs to Supabase.
  function persistInputs() {
    if (!stratId) return;
    const allInputs = JSON.parse(localStorage.getItem(CFG.STORE.stratInputs) || '{}');
    allInputs[stratId] = { params: { ...params } };
    localStorage.setItem(CFG.STORE.stratInputs, JSON.stringify(allInputs));
    localStorage.setItem(CFG.STORE.lastStrategy, stratId);
  }

  // Called on every param change: persist immediately + flash the "Saved" status.
  function autoSave() {
    persistInputs();
    if (!elAutoSave) return;
    elAutoSave.innerHTML = '<i class="fas fa-check"></i> Saved';
    elAutoSave.classList.add('is-saved');
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      elAutoSave.classList.remove('is-saved');
      elAutoSave.innerHTML = '<i class="fas fa-cloud"></i> Auto-saves as you edit';
    }, 1400);
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

    // On-chart strategy-name badge, shown lower-center during replay so it's clear which
    // strategy is being tested. Draggable (like the Trade Sim widget) so it can be moved
    // anywhere — it's never pinned to a side.
    nameLabel = document.createElement('div');
    nameLabel.className = 'sg-name-label';
    nameLabel.style.display = 'none';
    chartHost.appendChild(nameLabel);
    makeDraggable(nameLabel);
  }

  // Drag a chart-host child by px left/top (same approach as TradeSim's widget). The
  // element starts anchored via CSS (left:50% + translateX); on first grab we convert to
  // absolute left/top relative to the chart host so it can be dragged to the center too.
  function makeDraggable(box) {
    let dragging = false, offX = 0, offY = 0;
    box.addEventListener('mousedown', (e) => {
      dragging = true;
      const host = chartHost.getBoundingClientRect();
      const r = box.getBoundingClientRect();
      box.style.left = (r.left - host.left) + 'px';
      box.style.top = (r.top - host.top) + 'px';
      box.style.bottom = 'auto'; box.style.transform = 'none';
      offX = e.clientX - r.left; offY = e.clientY - r.top;
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const host = chartHost.getBoundingClientRect();
      let nx = e.clientX - offX - host.left, ny = e.clientY - offY - host.top;
      nx = Math.max(0, Math.min(host.width - box.offsetWidth, nx));
      ny = Math.max(0, Math.min(host.height - box.offsetHeight, ny));
      box.style.left = nx + 'px'; box.style.top = ny + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  }

  function togglePanel() {
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    // Opening this dropdown closes every other toolbar dropdown so they never stack.
    document.dispatchEvent(new CustomEvent('cr:menu-open', { detail: 'strategy' }));
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
    if (elModalTitle) elModalTitle.textContent = strat.name || strat.label || id;
    renderStratList();   // refresh active highlight in the dropdown list
    localStorage.setItem(CFG.STORE.lastStrategy, id);
    elDesc.textContent = strat.description || '';
    params = {};
    Object.entries(strat.params || {}).forEach(([key, def]) => { params[key] = def.default; });
    restoreSavedInputs(id);   // overlay with user's saved values if any
    renderParams(strat);
    lastResult = null;
    lastStats = null;
    // Wipe any prior strategy's results so they don't bleed into this one's modal.
    elResults.innerHTML = '';
    if (modalOverlay) {
      modalOverlay.querySelectorAll('.sg-mtf, .sg-matrix-out').forEach((el) => { el.innerHTML = ''; });
      modalOverlay.querySelectorAll('.sg-results-hdr, .sg-mtf-hdr, .sg-matrix-hdr')
        .forEach((el) => { el.style.display = 'none'; });
    }
    if (elAutoSave) { elAutoSave.classList.remove('is-saved'); elAutoSave.innerHTML = '<i class="fas fa-cloud"></i> Auto-saves as you edit'; }
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
        sel.onchange = () => { params[key] = sel.value; autoSave(); onParamChanged(); };
        wrap.appendChild(sel);
      } else if (def.type === 'string') {
        wrap.innerHTML = `<span>${def.label}</span>`;
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = params[key];
        inp.onchange = () => {
          params[key] = (inp.value || '').trim() || def.default;
          inp.value = params[key]; autoSave(); onParamChanged();
        };
        wrap.appendChild(inp);
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
          inp.value = v; params[key] = v; autoSave(); onParamChanged();
        };
        wrap.appendChild(inp);
      }
      elParams.appendChild(wrap);
    });
  }

  const UNIT_SECS = { days: 86400, weeks: 604800, months: 2592000, years: 31536000 };
  function calcRangeSecs(n, unit) { return n * (UNIT_SECS[unit] || UNIT_SECS.months); }
  // Human label for a lookback range, e.g. (6,'months') → "6 months", (1,'years') → "1 year".
  function formatRangeLabel(n, unit) {
    const u = (unit || 'months').replace(/s$/, '');
    return `${n} ${u}${n === 1 ? '' : 's'}`;
  }

  function onSimCfgChange() {
    const el = modalOverlay && modalOverlay.querySelector('.sg-sim-cfg-edit');
    if (!el) return;
    const capital = parseFloat(el.querySelector('.sg-cfg-capital').value);
    const sz      = parseFloat(el.querySelector('.sg-cfg-size').value);
    const fee     = parseFloat(el.querySelector('.sg-cfg-fee').value);
    const slip    = parseFloat(el.querySelector('.sg-cfg-slip').value);
    if (!isFinite(capital) || !isFinite(sz) || !isFinite(fee) || !isFinite(slip)) return;
    let ts = {};
    try { ts = JSON.parse(localStorage.getItem(CFG.STORE.tradeSim) || '{}') || {}; } catch {}
    ts.startBalance = capital; ts.sizePct = sz; ts.commissionPct = fee; ts.slippagePct = slip;
    try { localStorage.setItem(CFG.STORE.tradeSim, JSON.stringify(ts)); } catch {}
    if (typeof TradeSim !== 'undefined' && TradeSim.applySettings) TradeSim.applySettings(ts);
  }

  function settings() {
    let ts = {};
    try { ts = JSON.parse(localStorage.getItem(CFG.STORE.tradeSim) || '{}') || {}; } catch {}
    return {
      startBalance: ts.startBalance > 0 ? ts.startBalance : CFG.START_BALANCE,
      sizePct: ts.sizePct > 0 ? ts.sizePct : CFG.DEFAULT_SIZE_PCT,
      commissionPct: typeof ts.commissionPct === 'number' ? ts.commissionPct : CFG.DEFAULT_COMMISSION_PCT,
      slippagePct: typeof ts.slippagePct === 'number' ? ts.slippagePct : CFG.DEFAULT_SLIPPAGE_PCT,
    };
  }

  function refreshSimConfig() {
    const el = modalOverlay && modalOverlay.querySelector('.sg-sim-cfg-edit');
    if (!el) return;
    const cfg = settings();
    el.querySelector('.sg-cfg-capital').value = cfg.startBalance;
    el.querySelector('.sg-cfg-size').value = cfg.sizePct;
    el.querySelector('.sg-cfg-fee').value = cfg.commissionPct;
    el.querySelector('.sg-cfg-slip').value = cfg.slippagePct;
  }

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
  // User-clicked runs honor the shared Period (lookback); the live-replay refresh
  // path (onParamChanged) calls runBacktest() with no slice so faded markers cover
  // the full revealed history.
  function runBacktestClicked() {
    runBacktest(true);
  }

  function runBacktest(usePeriod) {
    const strat = getStrategy(stratId);
    let candles = getFullCandles();
    if (!strat || !candles || !candles.length) return null;
    if (usePeriod) {
      const cutTime = candles[candles.length - 1].time - calcRangeSecs(mtfRangeNum, mtfRangeUnit);
      const sliced = candles.filter((c) => c.time >= cutTime);
      if (sliced.length) candles = sliced;
    }
    clearError();
    // Re-clicking the trigger starts fresh: wipe the prior single-backtest output + log.
    elResults.innerHTML = '';
    const rhdr = modalOverlay && modalOverlay.querySelector('.sg-results-hdr');
    if (rhdr) rhdr.style.display = 'none';
    if (elLog) elLog.innerHTML = '';
    let result;
    try {
      result = simulate(strat, params, candles, settings());
    } catch (e) {
      showError(`Backtest error in "${strat.name}": ${e.message}`);
      return null;
    }
    lastResult = result;
    lastCandleRange = candles.length ? {
      from: candles[0].time,
      to:   candles[candles.length - 1].time,
      bars: candles.length,
      days: Math.round((candles[candles.length - 1].time - candles[0].time) / 86400),
    } : null;
    indexSignals(result.signals);
    renderResults(result.stats);
    drawFadedMarkers(result.signals);
    // 4H ORB strategy: offer the full statistical/probabilistic report (expectancy,
    // confidence intervals, variance, gambler's-fallacy, risk-of-ruin) on its own
    // precise R-multiple backtest of the same loaded candles.
    if (stratId === 'orb4h' && window.StatsReport) {
      const repBtn = document.createElement('button');
      repBtn.className = 'sg-save-btn sg-report-btn';
      repBtn.innerHTML = '<i class="fas fa-chart-column"></i> Full Statistical Report';
      repBtn.onclick = () => window.StatsReport.open(candles, params);
      elResults.appendChild(repBtn);
    }
    return result;
  }

  // ---- pair × timeframe matrix --------------------------------------------
  // Runs the CURRENT strategy + params through the same `simulate()` engine across
  // every selected pair × timeframe, so you can see WHERE the strategy has an edge.
  // One pair → the classic per-TF card view; multiple pairs → an Expectancy-R heatmap.
  function tfMinutes(k) {
    if (k === 'W') return 10080;
    if (k === 'D') return 1440;
    return parseInt(k) || 0;
  }
  // withPairs=false → current pair across selected TFs (per-TF cards, "Multi TF" pane).
  // withPairs=true  → selected pairs × TFs heatmap matrix ("Multi TF + Pairs" pane).
  async function runMultiTimeframe(withPairs) {
    const strat = getStrategy(stratId);
    if (!strat) return;
    const target = parseInt((document.getElementById('maxCandles') || {}).value) || CFG.DEFAULTS.maxCandles;
    const cfg = settings();
    const tfMap = Object.fromEntries((CFG.ALL_INTERVALS || []).map(([k, l]) => [k, l]));
    const selectedTfs = mtfSelectedTfs.length ? mtfSelectedTfs : ['1', '5', '60', '240', 'D'];
    // Sort lowest TF first (minutes-based; D=1440, W=10080)
    const tfs = selectedTfs.slice().sort((a, b) => tfMinutes(a) - tfMinutes(b)).map((k) => [tfMap[k] || k, k]);
    const currentSymbol = (document.getElementById('symbol') || {}).value || CFG.DEFAULTS.symbol;
    const pairs = withPairs
      ? ((mtfSelectedPairs && mtfSelectedPairs.length) ? mtfSelectedPairs.slice() : [currentSymbol])
      : [currentSymbol];

    // Point the shared progress/render targets at the ACTIVE pane so output is visible.
    elMtfRun = withPairs ? elMatrixRun : modalOverlay.querySelector('.sg-mtf-run');
    elMtf = withPairs ? elMatrixOut : modalOverlay.querySelector('.sg-mtf');
    const hdrSel = withPairs ? '.sg-matrix-hdr' : '.sg-mtf-hdr';

    const rangeSecs = calcRangeSecs(mtfRangeNum, mtfRangeUnit);
    const origHtml = elMtfRun.innerHTML;
    // Re-clicking starts fresh: hide the previous results header, wipe the old cards,
    // and show a loading state so it's obvious new data is being computed.
    const mtfHdr = modalOverlay && modalOverlay.querySelector(hdrSel);
    if (mtfHdr) mtfHdr.style.display = 'none';
    elMtfRun.disabled = true;
    elMtfRun.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Running…`;
    const totalCells = pairs.length * tfs.length;

    // Build the progress UI ONCE, then update only the bar/labels in place so the
    // fill animates smoothly and the spinner doesn't restart on every tick.
    elMtf.innerHTML =
      `<div class="sg-mtf-progress">` +
        `<div class="sg-mtf-prog-head">` +
          `<span class="sg-mtf-prog-title"><i class="fas fa-spinner fa-spin"></i> Computing ${strat.name}</span>` +
          `<span class="sg-mtf-prog-count">0 / ${totalCells}</span>` +
        `</div>` +
        `<div class="sg-mtf-prog-track"><div class="sg-mtf-prog-bar" style="width:0%"></div></div>` +
        `<div class="sg-mtf-prog-now">Preparing ${pairs.length} pair${pairs.length > 1 ? 's' : ''} × ${tfs.length} TF · last ${mtfRangeNum} ${mtfRangeUnit}…</div>` +
      `</div>`;
    const elBar = elMtf.querySelector('.sg-mtf-prog-bar');
    const elCount = elMtf.querySelector('.sg-mtf-prog-count');
    const elNow = elMtf.querySelector('.sg-mtf-prog-now');
    const setProgress = (count, nowText) => {
      if (elBar) elBar.style.width = `${Math.round((count / totalCells) * 100)}%`;
      if (elCount) elCount.textContent = `${count} / ${totalCells}`;
      if (elNow && nowText != null) elNow.innerHTML = nowText;
    };
    const paint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await paint();   // render the empty bar before the (often blocking) compute loop starts

    // cells: { symbol, label (TF), interval, st, bars, from, to, err }
    const cells = [];
    let done = 0;
    for (const symbol of pairs) {
      const symShort = symbol.replace('USDT', '');
      for (const [label, interval] of tfs) {
        // Announce the item BEFORE fetching (the slow part) so the user sees what's loading.
        setProgress(done, `<i class="fas fa-download"></i> Loading <b>${symShort}</b> · ${label}…`);
        await paint();
        let candles = null;
        try { candles = await fetchCandles(symbol, interval, target); }
        catch (e) { try { candles = syntheticCandles(symbol, interval, target); } catch (_) { candles = null; } }
        if (!candles || !candles.length) { cells.push({ symbol, label, interval, err: true }); done++; setProgress(done, `<span class="sg-mtf-prog-skip">No data · ${symShort} ${label}</span>`); continue; }
        const cutTime = candles[candles.length - 1].time - rangeSecs;
        candles = candles.filter((c) => c.time >= cutTime);
        if (!candles.length) { cells.push({ symbol, label, interval, err: true }); done++; setProgress(done, `<span class="sg-mtf-prog-skip">No data · ${symShort} ${label}</span>`); continue; }
        const from = candles[0].time, to = candles[candles.length - 1].time;
        let nTrades = 0;
        try { const st = simulate(strat, params, candles, cfg).stats; nTrades = st.totalTrades; cells.push({ symbol, label, interval, st, bars: candles.length, from, to }); }
        catch (e) { cells.push({ symbol, label, interval, err: true }); }
        done++;
        setProgress(done, `<i class="fas fa-check"></i> ${symShort} · ${label} — ${nTrades} trades`);
      }
    }
    setProgress(totalCells, `<i class="fas fa-check-double"></i> ${withPairs ? 'Rendering matrix' : 'Rendering results'}…`);
    await paint();

    if (withPairs) {
      renderMatrix(strat.name, cells, pairs, tfs);
    } else {
      // Current pair across TFs → rich per-TF card view.
      renderMtf(pairs[0], strat.name, cells);
    }
    elMtfRun.innerHTML = origHtml;
    elMtfRun.disabled = false;
  }

  // One rich card per timeframe: trades-distribution donut + the headline stats
  // (win/loss streaks, best/worst P&L, win%, PF, net P&L).
  function mtfCard(r) {
    if (r.err) {
      return `<div class="sg-mtf-card sg-mtf-card-err">` +
        `<div class="sg-mtf-card-hdr"><b>${r.label}</b></div>` +
        `<div class="sg-mtf-err">no data</div></div>`;
    }
    const st = r.st;
    const pf = st.profitFactor === Infinity ? '∞' : st.profitFactor.toFixed(2);
    const col = st.netUsd >= 0 ? UP : DOWN;
    const pnlClass = st.netUsd > 0 ? ' sg-mtf-card-win' : (st.netUsd < 0 ? ' sg-mtf-card-loss' : '');
    const row = (label, val, color) =>
      `<div class="ts-row"><span>${label}</span><b${color ? ` style="color:${color}"` : ''}>${val}</b></div>`;
    return `<div class="sg-mtf-card${pnlClass}">` +
        `<div class="sg-mtf-card-hdr">` +
          `<b>${r.label}</b>` +
          `<span class="sg-mtf-card-net" style="color:${col}">${fmtMoney(st.netUsd)} <span class="sg-mtf-pct">(${fmtPct(st.netPct)})</span></span>` +
        `</div>` +
        donutChart(st, `${r.label} · Trades distribution`) +
        `<div class="sg-mtf-card-stats">` +
          row('Win rate', `${st.winRate.toFixed(1)}%`) +
          row('Profit factor', pf) +
          row('Trades / Bars', `${st.totalTrades} / ${r.bars}`) +
          row('Max consec. W / L', `${st.maxConsecWins} / ${st.maxConsecLosses}`) +
          row('Best / Worst P&L', `${fmtMoney(st.largestWin)} / ${fmtMoney(st.largestLoss)}`,
            st.largestWin + st.largestLoss >= 0 ? UP : DOWN) +
        `</div>` +
      `</div>`;
  }

  function renderMtf(symbol, name, rows) {
    const hdr = modalOverlay && modalOverlay.querySelector('.sg-mtf-hdr');
    if (hdr) {
      hdr.querySelector('span').textContent = `MULTI-TF · ${symbol}`;
      hdr.style.display = 'flex';
    }
    // Duration line: actual date span tested + the configured window.
    const okSpan = rows.filter((r) => !r.err && r.from != null && r.to != null);
    let periodLine = '';
    if (okSpan.length) {
      const from = Math.min(...okSpan.map((r) => r.from));
      const to = Math.max(...okSpan.map((r) => r.to));
      const days = Math.max(1, Math.round((to - from) / 86400));
      const fmtD = (t) => new Date(t * 1000).toISOString().slice(0, 10);
      periodLine = `<div class="sg-mtf-period"><i class="fas fa-clock"></i> ${fmtD(from)} → ${fmtD(to)} · ${days}d ` +
        `<span class="sg-mtf-pct">(window: last ${mtfRangeNum} ${mtfRangeUnit})</span></div>`;
    } else {
      periodLine = `<div class="sg-mtf-period"><i class="fas fa-clock"></i> window: last ${mtfRangeNum} ${mtfRangeUnit}</div>`;
    }
    const head = `<div class="sg-mtf-sub">${name}</div>` + periodLine;
    const grid = `<div class="sg-mtf-grid">` + rows.map(mtfCard).join('') + `</div>`;
    // highlight the best timeframe by net P&L
    const ok = rows.filter((r) => !r.err);
    let bestLine = '';
    if (ok.length) {
      const best = ok.reduce((a, b) => (b.st.netUsd > a.st.netUsd ? b : a));
      bestLine = `<div class="sg-mtf-best">Best by Net P&L: <b>${best.label}</b> (${fmtMoney(best.st.netUsd)})</div>`;
    }
    // Rich AI-style read of the whole run (verdict + tweaks). Falls back to the
    // one-line "best TF" when there aren't enough timeframes to compare.
    const overview = mtfOverview(name, rows);
    elMtf.innerHTML = head + grid + (overview || bestLine);

    const actions = document.createElement('div');
    actions.className = 'sg-mtf-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'sg-save-btn';
    saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save to Data';
    saveBtn.onclick = () => saveMtfRun(saveBtn, symbol, name, rows);
    actions.appendChild(saveBtn);

    elMtf.appendChild(actions);
  }

  // ---- pair × timeframe heatmap matrix ------------------------------------
  const MATRIX_MIN_TRADES = 10;          // below this a cell is "thin" — marked, never "best"
  const MATRIX_R_SCALE = 0.5;            // |expectancyR| that saturates the color
  const MATRIX_PCT_SCALE = 20;           // |net %| that saturates the fallback color
  const MATRIX_PNL_SCALE = 20;           // |net %| that saturates the P&L cell color

  // Diverging heat: green for positive, red for negative, intensity by magnitude.
  function heatColor(v, scale) {
    if (v == null || !isFinite(v)) return '';
    const t = Math.max(0, Math.min(1, Math.abs(v) / scale));
    const a = (0.10 + 0.55 * t).toFixed(2);
    const rgb = v >= 0 ? '38,166,154' : '239,83,80';
    return `background:rgba(${rgb},${a})`;
  }

  // Cell background is driven STRICTLY by realized profit: green only when the cell's
  // net P&L is positive, red when negative, and the deeper green the bigger the gain.
  // (The displayed headline can still be expectancy R, which can disagree in sign once
  // fees are taken out — the user wants the colour to track money, not R.)
  function pnlColor(st) {
    if (!st || st.netPct == null) return '';
    return heatColor(st.netPct, MATRIX_PNL_SCALE);
  }

  function renderMatrix(name, cells, pairs, tfs) {
    const hdr = modalOverlay && modalOverlay.querySelector('.sg-matrix-hdr');
    if (hdr) { hdr.querySelector('span').textContent = `MATRIX · ${pairs.length}×${tfs.length}`; hdr.style.display = 'flex'; }

    // Headline metric = Expectancy R when ANY cell produced an R; else fall back to net %.
    const useR = cells.some((c) => !c.err && c.st && c.st.expectancyR != null);
    const scale = useR ? MATRIX_R_SCALE : MATRIX_PCT_SCALE;
    const metricVal = (st) => useR ? st.expectancyR : st.netPct;
    const valText = (st) => {
      if (useR) return st.expectancyR != null ? `${st.expectancyR >= 0 ? '+' : ''}${st.expectancyR.toFixed(2)}R` : 'n/a';
      return `${st.netPct >= 0 ? '+' : ''}${st.netPct.toFixed(1)}%`;
    };

    // Lookup + best (non-error, non-thin) cell by the headline metric.
    const map = new Map();
    cells.forEach((c) => map.set(`${c.symbol}|${c.interval}`, c));
    const scored = cells.filter((c) => !c.err && c.st && c.st.totalTrades >= MATRIX_MIN_TRADES && metricVal(c.st) != null);
    const best = scored.length ? scored.reduce((a, b) => (metricVal(b.st) > metricVal(a.st) ? b : a)) : null;
    const bestKey = best ? `${best.symbol}|${best.interval}` : null;

    // Period line (actual span across all ok cells).
    const okSpan = cells.filter((c) => !c.err && c.from != null && c.to != null);
    const fmtD = (t) => new Date(t * 1000).toISOString().slice(0, 10);
    let periodLine;
    if (okSpan.length) {
      const from = Math.min(...okSpan.map((c) => c.from)), to = Math.max(...okSpan.map((c) => c.to));
      const days = Math.max(1, Math.round((to - from) / 86400));
      periodLine = `<div class="sg-mtf-period"><i class="fas fa-clock"></i> ${fmtD(from)} → ${fmtD(to)} · ${days}d ` +
        `<span class="sg-mtf-pct">(window: last ${mtfRangeNum} ${mtfRangeUnit})</span></div>`;
    } else {
      periodLine = `<div class="sg-mtf-period"><i class="fas fa-clock"></i> window: last ${mtfRangeNum} ${mtfRangeUnit}</div>`;
    }

    const metricBadge = useR
      ? `<span class="sg-matrix-badge">value = Expectancy (R) · color = Net P&L</span>`
      : `<span class="sg-matrix-badge sg-matrix-badge-warn">value = net % · color = Net P&L</span>`;

    // Build the table: header row of TFs, then one row per pair.
    const headCells = tfs.map(([l]) => `<th class="sg-matrix-th">${l}</th>`).join('');
    const bodyRows = pairs.map((sym) => {
      const cellsHtml = tfs.map(([, interval]) => {
        const key = `${sym}|${interval}`;
        const c = map.get(key);
        if (!c || c.err) return `<td class="sg-matrix-cell sg-matrix-err" data-key="${key}"><span class="sg-matrix-na">—</span></td>`;
        const st = c.st;
        const thin = st.totalTrades < MATRIX_MIN_TRADES;
        let cls = 'sg-matrix-cell';
        let style = pnlColor(st);   // colour every cell (incl. low-TF/thin ones) by net P&L
        if (thin) cls += ' sg-matrix-thin';
        if (key === bestKey) cls += ' sg-matrix-best';
        const pnlCls = st.netUsd > 0 ? ' sg-matrix-pnl-up' : (st.netUsd < 0 ? ' sg-matrix-pnl-down' : '');
        return `<td class="${cls}" style="${style}" data-key="${key}" title="${sym} ${c.label} · ${fmtMoney(st.netUsd)}">` +
          `<span class="sg-matrix-val">${valText(st)}</span>` +
          `<span class="sg-matrix-pnl${pnlCls}">${fmtMoneyShort(st.netUsd)}</span>` +
          `<span class="sg-matrix-sub">${st.totalTrades}t</span></td>`;
      }).join('');
      return `<tr><th class="sg-matrix-rowh">${sym.replace('USDT', '')}</th>${cellsHtml}</tr>`;
    }).join('');

    const table =
      `<table class="sg-matrix-table"><thead><tr><th class="sg-matrix-corner">${useR ? 'R' : 'net%'}</th>${headCells}</tr></thead>` +
      `<tbody>${bodyRows}</tbody></table>`;

    const head = `<div class="sg-mtf-sub">${name} ${metricBadge}</div>` + periodLine;
    const overview = matrixOverview(name, cells, pairs, tfs, useR);
    elMtf.innerHTML = head + `<div class="sg-matrix-wrap">${table}</div>` +
      `<div class="sg-matrix-detail" style="display:none"></div>` + overview;

    // Click a cell → expand its rich card (donut + headline stats) below the grid.
    const detail = elMtf.querySelector('.sg-matrix-detail');
    elMtf.querySelectorAll('.sg-matrix-cell').forEach((td) => {
      td.onclick = () => {
        const c = map.get(td.dataset.key);
        if (!c) return;
        if (c.err) { detail.style.display = 'none'; return; }
        detail.innerHTML = mtfCard({ label: `${c.symbol} · ${c.label}`, st: c.st, bars: c.bars });
        detail.style.display = 'block';
        elMtf.querySelectorAll('.sg-matrix-cell').forEach((x) => x.classList.remove('sg-matrix-sel'));
        td.classList.add('sg-matrix-sel');
      };
    });

    const actions = document.createElement('div');
    actions.className = 'sg-mtf-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'sg-save-btn';
    saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save to Data';
    saveBtn.onclick = () => saveMatrixRun(saveBtn, name, cells, pairs, tfs);
    actions.appendChild(saveBtn);
    elMtf.appendChild(actions);
  }

  // Heuristic read of the matrix: overall edge, best pair×TF, which pairs and which
  // timeframes carry the edge — answering "where is this strategy effective?".
  // Split into a pure, serializable summary (saved to Data so a run can be re-read
  // later) and a renderer (matrixSummaryHtml) shared by the live modal AND the Data
  // page. computeMatrixSummary returns null when there are <2 comparable cells.
  function computeMatrixSummary(cells, useR) {
    const ok = cells.filter((c) => !c.err && c.st);
    if (ok.length < 2) return null;
    const metricVal = (st) => useR ? (st.expectancyR != null ? st.expectancyR : 0) : st.netPct;

    const total = ok.length;
    const winners = ok.filter((c) => c.st.netUsd > 0).length;
    const share = winners / total;
    const totalNet = ok.reduce((a, c) => a + c.st.netUsd, 0);
    const avgPF = ok.reduce((a, c) => a + (c.st.profitFactor === Infinity ? 4 : (c.st.profitFactor || 0)), 0) / total;

    // best/worst cell among non-thin cells (fall back to all ok if all thin)
    const robust = ok.filter((c) => c.st.totalTrades >= MATRIX_MIN_TRADES);
    const pool = robust.length ? robust : ok;
    const bestC = pool.reduce((a, b) => (metricVal(b.st) > metricVal(a.st) ? b : a));
    const worstC = pool.reduce((a, b) => (metricVal(b.st) < metricVal(a.st) ? b : a));

    // average metric per pair and per TF (which axis carries the edge). Also count
    // how many cells in that group came out net positive ("where it works").
    const avgBy = (keyFn) => {
      const m = new Map();
      pool.forEach((c) => {
        const k = keyFn(c);
        const e = m.get(k) || { sum: 0, n: 0, wins: 0 };
        e.sum += metricVal(c.st); e.n++; if (c.st.netUsd > 0) e.wins++;
        m.set(k, e);
      });
      return [...m.entries()]
        .map(([k, e]) => ({ k, avg: e.sum / e.n, wins: e.wins, n: e.n }))
        .sort((a, b) => b.avg - a.avg);
    };
    const byPair = avgBy((c) => c.symbol.replace('USDT', ''));
    const byTf = avgBy((c) => c.label);
    // Full ranking of timeframes by average outcome — the strategy's best TFs first.
    const tfRanked = byTf.filter((t) => t.avg > 0);

    let rating, cls;
    if (share >= 0.6 && avgPF >= 1.3 && totalNet > 0) { rating = 'Profitable edge'; cls = 'good'; }
    else if (share >= 0.5 && avgPF >= 1.1 && totalNet > 0) { rating = 'Promising'; cls = 'ok'; }
    else if (totalNet > 0 || share >= 0.4) { rating = 'Marginal / mixed'; cls = 'warn'; }
    else { rating = 'No edge yet'; cls = 'bad'; }

    const thinCount = ok.filter((c) => c.st.totalTrades < MATRIX_MIN_TRADES).length;

    return {
      metric: useR ? 'expectancyR' : 'netPct',
      total, winners, share, totalNet, avgPF, rating, cls, thinCount,
      byPair, byTf, tfRanked,
      best: { sym: bestC.symbol.replace('USDT', ''), label: bestC.label, val: metricVal(bestC.st),
              trades: bestC.st.totalTrades, pf: bestC.st.profitFactor === Infinity ? null : bestC.st.profitFactor },
      worst: { sym: worstC.symbol.replace('USDT', ''), label: worstC.label, val: metricVal(worstC.st), net: worstC.st.netUsd },
    };
  }

  // Render the "Where it works" block from a saved/just-computed summary. Pure — takes
  // the structured object so the Data page can reproduce the exact same narrative.
  function matrixSummaryHtml(s, name) {
    if (!s) return '';
    const useR = s.metric === 'expectancyR';
    const metricTxt = (v) => useR ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}R` : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

    // small card builder: title (+ optional badge) over a bullet list
    const card = (title, items, opts) => {
      opts = opts || {};
      const lis = items.filter(Boolean).map((t) => `<li>${t}</li>`).join('');
      if (!lis) return '';
      const badge = opts.badge ? `<span class="sg-mtf-cx-badge cx-badge-${opts.cls || 'ok'}">${opts.badge}</span>` : '';
      return `<div class="sg-mtf-cx${opts.cls ? ` sg-ai-${opts.cls}` : ''}">` +
        `<div class="sg-mtf-cx-title">${opts.icon || ''} ${title}${badge}</div>` +
        `<ul class="sg-mtf-cx-list">${lis}</ul></div>`;
    };

    // 1) Verdict
    const verdictCard = card('Verdict', [
      `<b>${s.winners}/${s.total}</b> cells net positive <span class="sg-mtf-pct">(${Math.round(s.share * 100)}%)</span>`,
      `Avg profit factor <b>${s.avgPF.toFixed(2)}</b>`,
      `Combined net <b class="${s.totalNet >= 0 ? 'sg-cx-pos' : 'sg-cx-neg'}">${fmtMoney(s.totalNet)}</b>`,
    ], { icon: '<i class="fas fa-gauge-high"></i>', badge: s.rating, cls: s.cls });

    // 2) Best setup
    const bestCard = card('Best setup', [
      `<b>${s.best.sym} ${s.best.label}</b> — ${metricTxt(s.best.val)}`,
      `${s.best.trades} trades · PF ${s.best.pf == null ? '∞' : s.best.pf.toFixed(2)}`,
      `Optimize &amp; forward-test here first`,
    ], { icon: '<i class="fas fa-star"></i>' });

    // 3) Best timeframes (ranked)
    const tfItems = s.tfRanked.length
      ? s.tfRanked.map((t, i) => `<b>${i + 1}. ${t.k}</b> — ${metricTxt(t.avg)} <span class="sg-mtf-pct">(${t.wins}/${t.n} pairs +)</span>`)
      : [`No timeframe is net positive on this window yet`];
    const tfCard = card('Best timeframes', tfItems, { icon: '<i class="fas fa-clock"></i>' });

    // 4) Pairs (strongest / weakest)
    const pairItems = [];
    if (s.byPair.length) {
      pairItems.push(`Strongest: ${s.byPair.slice(0, 3).map((p) => `<b>${p.k}</b> (${metricTxt(p.avg)})`).join(', ')}`);
      if (s.byPair.length > 1) {
        const w = s.byPair[s.byPair.length - 1];
        pairItems.push(`Weakest: <b>${w.k}</b> (${metricTxt(w.avg)})`);
      }
    }
    const pairCard = card('Pairs', pairItems, { icon: '<i class="fas fa-coins"></i>' });

    // 5) Suggested focus / caveats
    const tips = [];
    if (s.worst.net < 0) tips.push(`Avoid <b>${s.worst.sym} ${s.worst.label}</b> (${metricTxt(s.worst.val)}) — edge breaks down there`);
    if (s.thinCount) tips.push(`${s.thinCount} cell${s.thinCount > 1 ? 's' : ''} had &lt;${MATRIX_MIN_TRADES} trades (hatched) — widen the lookback for those`);
    tips.push(`Re-test the sweet spot live before committing real size`);
    const tipsCard = card('Suggested focus', tips.slice(0, 3), { icon: '<i class="fas fa-lightbulb"></i>' });

    return `<div class="sg-mtf-ai">` +
        `<div class="sg-mtf-ai-hdr"><i class="fas fa-robot"></i> Where it works · ${name}</div>` +
        `<div class="sg-mtf-cards">${verdictCard}${bestCard}${tfCard}${pairCard}${tipsCard}</div>` +
        `<div class="sg-mtf-ai-note">Heuristic read of the tested window only — not financial advice. Cells &lt;${MATRIX_MIN_TRADES} trades are too thin to trust.</div>` +
      `</div>`;
  }

  function matrixOverview(name, cells, pairs, tfs, useR) {
    return matrixSummaryHtml(computeMatrixSummary(cells, useR), name);
  }

  // Static (non-interactive) heatmap table from a saved matrix result — used by the
  // Data page to re-draw the grid exactly as it appeared in the modal. Reuses the same
  // sg-matrix-* classes and heatColor so the colours match.
  function matrixGridHtml(result) {
    if (!result || !Array.isArray(result.cells)) return '';
    const pairs = result.pairs || [];
    const tfs = result.tfs || [];
    const useR = result.metric === 'expectancyR';
    const scale = useR ? MATRIX_R_SCALE : MATRIX_PCT_SCALE;
    const metricVal = (st) => useR ? st.expectancyR : st.netPct;
    const valText = (st) => useR
      ? (st.expectancyR != null ? `${st.expectancyR >= 0 ? '+' : ''}${st.expectancyR.toFixed(2)}R` : 'n/a')
      : `${st.netPct >= 0 ? '+' : ''}${st.netPct.toFixed(1)}%`;

    const map = new Map();
    result.cells.forEach((c) => map.set(`${c.symbol}|${c.interval}`, c));
    const headCells = tfs.map((t) => `<th class="sg-matrix-th">${t.label}</th>`).join('');
    const bodyRows = pairs.map((sym) => {
      const cellsHtml = tfs.map((t) => {
        const key = `${sym}|${t.interval}`;
        const c = map.get(key);
        if (!c || c.err) return `<td class="sg-matrix-cell sg-matrix-err" data-key="${key}"><span class="sg-matrix-na">—</span></td>`;
        const st = c.st;
        const thin = st.totalTrades < MATRIX_MIN_TRADES;
        const style = pnlColor(st);   // colour by net P&L (matches the live modal)
        const cls = 'sg-matrix-cell' + (thin ? ' sg-matrix-thin' : '');
        const pnlCls = st.netUsd > 0 ? ' sg-matrix-pnl-up' : (st.netUsd < 0 ? ' sg-matrix-pnl-down' : '');
        return `<td class="${cls}" style="${style}" data-key="${key}" title="${sym} ${c.label} · ${fmtMoney(st.netUsd)}">` +
          `<span class="sg-matrix-val">${valText(st)}</span>` +
          `<span class="sg-matrix-pnl${pnlCls}">${fmtMoneyShort(st.netUsd)}</span>` +
          `<span class="sg-matrix-sub">${st.totalTrades}t</span></td>`;
      }).join('');
      return `<tr><th class="sg-matrix-rowh">${sym.replace('USDT', '')}</th>${cellsHtml}</tr>`;
    }).join('');

    return `<div class="sg-matrix-wrap"><table class="sg-matrix-table">` +
      `<thead><tr><th class="sg-matrix-corner">${useR ? 'R' : 'net%'}</th>${headCells}</tr></thead>` +
      `<tbody>${bodyRows}</tbody></table></div>` +
      `<div class="sg-matrix-detail" style="display:none"></div>`;
  }

  // Wire click-to-expand on a saved/static matrix grid (Data page). Mirrors the live
  // modal: clicking a cell renders its full stat card into the grid's detail slot.
  function bindMatrix(root, result) {
    if (!root || !result || !Array.isArray(result.cells)) return;
    const map = new Map();
    result.cells.forEach((c) => map.set(`${c.symbol}|${c.interval}`, c));
    const detail = root.querySelector('.sg-matrix-detail');
    root.querySelectorAll('.sg-matrix-cell[data-key]').forEach((td) => {
      td.onclick = (e) => {
        e.stopPropagation();   // don't bubble to the Data card's open-detail handler
        const c = map.get(td.dataset.key);
        if (!c || c.err) { if (detail) detail.style.display = 'none'; return; }
        if (detail) {
          detail.innerHTML = mtfCard({ label: `${c.symbol} · ${c.label}`, st: c.st, bars: c.bars });
          detail.style.display = 'block';
        }
        root.querySelectorAll('.sg-matrix-cell').forEach((x) => x.classList.remove('sg-matrix-sel'));
        td.classList.add('sg-matrix-sel');
      };
    });
  }

  // Shared with the Data page (js/data-page.js) so a saved matrix run re-renders with
  // the same grid + "Where it works" summary it had in the Strategy modal.
  window.MatrixView = { gridHtml: matrixGridHtml, summaryHtml: matrixSummaryHtml, bind: bindMatrix };

  async function saveMatrixRun(btn, stratName, cells, pairs, tfs) {
    const cfg = settings();
    const useR = cells.some((c) => !c.err && c.st && c.st.expectancyR != null);
    const metricVal = (st) => useR ? (st.expectancyR != null ? st.expectancyR : -Infinity) : st.netPct;
    const scored = cells.filter((c) => !c.err && c.st && c.st.totalTrades >= MATRIX_MIN_TRADES);
    const best = scored.length ? scored.reduce((a, b) => (metricVal(b.st) > metricVal(a.st) ? b : a)) : null;
    const record = {
      kind: 'matrix',
      strategy_id: stratId,
      strategy_label: stratName,
      symbol: pairs.join(','),
      interval: 'matrix',
      max_candles: parseInt((document.getElementById('maxCandles') || {}).value) || 0,
      params: { ...params },
      settings: {
        startBalance:  cfg.startBalance,
        sizePct:       cfg.sizePct,
        commissionPct: cfg.commissionPct,
        slippagePct:   cfg.slippagePct,
        test_period: (() => {
          const ok = cells.filter((c) => !c.err && c.from != null && c.to != null);
          if (!ok.length) return null;
          const from = Math.min(...ok.map((c) => c.from));
          const to   = Math.max(...ok.map((c) => c.to));
          return { from, to, days: Math.round((to - from) / 86400) };
        })(),
      },
      result: {
        pairs,
        tfs: tfs.map(([l, k]) => ({ label: l, interval: k })),
        metric: useR ? 'expectancyR' : 'netPct',
        window: { num: mtfRangeNum, unit: mtfRangeUnit },
        cells: cells.map((c) => c.err
          ? { symbol: c.symbol, label: c.label, interval: c.interval, err: true }
          : { symbol: c.symbol, label: c.label, interval: c.interval, bars: c.bars, st: c.st }),
        best: best ? { symbol: best.symbol, label: best.label, metric: metricVal(best.st) } : null,
        // Structured "Where it works" summary so the saved run re-renders the grid +
        // narrative on the Data page without recomputing (see js/data-page.js).
        summary: computeMatrixSummary(cells, useR),
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

  // Heuristic "AI analysis" of a single-TF backtest: verdict badge, win-rate-vs-breakeven,
  // drawdown commentary, and up to 4 concrete suggestions. Uses the sg-mtf-ai-* CSS classes
  // so it renders identically to the MTF AI overview. Stored in `note` at save time so the
  // Data page can show it without re-computing.
  function singleOverview(stats, stratLabel, symbol, interval, cfg, testPeriod) {
    const st = stats;
    if (!st || !st.totalTrades) return '';
    const fm = (v) => { const s = v < 0 ? '-' : '+'; return `${s}$${Math.abs(v).toFixed(2)}`; };
    const fp = (v) => `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
    const fmtD = (t) => t ? new Date(t * 1000).toISOString().slice(0, 10) : '?';
    const pf = st.profitFactor === Infinity ? '∞' : Number(st.profitFactor).toFixed(2);
    const maxDD = Math.abs(st.maxDrawdown || 0);

    let rating, cls;
    if (Number(st.profitFactor) >= 2.0 && maxDD < 15 && st.totalTrades >= 20) { rating = 'Strong edge'; cls = 'good'; }
    else if (Number(st.profitFactor) >= 1.5 && maxDD < 20 && st.totalTrades >= 15) { rating = 'Solid'; cls = 'ok'; }
    else if (Number(st.profitFactor) >= 1.1 && st.netUsd > 0) { rating = 'Marginal'; cls = 'warn'; }
    else { rating = 'No edge yet'; cls = 'bad'; }

    const verdict = `<b>${stratLabel}</b> on <b>${symbol} ${interval}</b> returned ` +
      `<b>${fp(st.netPct)}</b> net (${fm(st.netUsd)}) across <b>${st.totalTrades}</b> trades ` +
      `with a profit factor of <b>${pf}</b>.`;

    const rr = st.avgWin && st.avgLoss ? Math.abs(st.avgWin / st.avgLoss) : null;
    const beWR = rr ? (1 / (1 + rr) * 100) : null;
    let winLine;
    if (beWR != null) {
      const gap = Number(st.winRate) - beWR;
      if (gap >= 10) winLine = `Win rate <b>${Number(st.winRate).toFixed(1)}%</b> clears the ${beWR.toFixed(1)}% break-even by ${gap.toFixed(1)}pp for this ${rr.toFixed(2)}:1 R:R — the statistical edge holds up.`;
      else if (gap >= 0) winLine = `Win rate <b>${Number(st.winRate).toFixed(1)}%</b> just clears the ${beWR.toFixed(1)}% break-even for ${rr.toFixed(2)}:1 R:R — a thin margin that could narrow under live friction.`;
      else winLine = `Win rate <b>${Number(st.winRate).toFixed(1)}%</b> is ${Math.abs(gap).toFixed(1)}pp below the ${beWR.toFixed(1)}% break-even for ${rr.toFixed(2)}:1 R:R — exit sizing doesn't offset the hit rate yet.`;
    } else {
      winLine = `Win rate <b>${Number(st.winRate).toFixed(1)}%</b> — avg win ${fm(st.avgWin)}, avg loss ${fm(st.avgLoss)}.`;
    }

    const recovery = maxDD > 0 ? (maxDD / (100 - maxDD) * 100) : 0;
    let ddLine;
    if (maxDD < 10) ddLine = `Max drawdown <b>${fp(-maxDD)}</b> is well-controlled — healthy equity curve even at ${(cfg && cfg.sizePct) || '?'}% position size.`;
    else if (maxDD < 20) ddLine = `Max drawdown <b>${fp(-maxDD)}</b> requires a <b>${recovery.toFixed(1)}%</b> recovery to reach new highs. Worst losing streak: ${st.maxConsecLosses} consecutive.`;
    else ddLine = `Max drawdown <b>${fp(-maxDD)}</b> is deep — needs <b>${recovery.toFixed(1)}%</b> recovery. Reduce position size before going live, or tighten the stop multiple.`;

    const tips = [];
    if (st.totalTrades < 20) tips.push(`Only <b>${st.totalTrades}</b> trades — sample too small for reliable conclusions. Extend the backtest window or loosen entry filters.`);
    if (st.maxConsecLosses >= 5) tips.push(`Losing streak reached <b>${st.maxConsecLosses}</b> in a row — plan for this emotionally and size so you can stay in the game through it.`);
    if (rr && rr < 1.5) tips.push(`Reward/risk ratio of <b>${rr.toFixed(2)}:1</b> is tight. Widening the target multiplier would lift expectancy without changing signal quality.`);
    if (Number(st.winRate) > 60 && Number(st.profitFactor) < 1.5) tips.push(`High win rate (${Number(st.winRate).toFixed(0)}%) but moderate PF — exits are likely closing winners too early. Loosen the trailing stop or raise the target multiple.`);
    if (maxDD > 20 && cfg && cfg.sizePct > 25) tips.push(`Running at ${cfg.sizePct}% size with a ${maxDD.toFixed(0)}% drawdown is aggressive — paper-test at 10–15% first.`);
    if (Number(st.profitFactor) >= 1.5 && maxDD < 15 && st.totalTrades >= 20) tips.push(`Core logic is working — prioritize stability over tuning. Run a second symbol or extend the window before sizing up.`);
    const tipsHtml = tips.slice(0, 4).map((t) => `<li>${t}</li>`).join('');

    const periodLine = testPeriod
      ? `<div class="sg-mtf-ai-line"><b>Test window:</b> ${fmtD(testPeriod.from)} → ${fmtD(testPeriod.to)} · ` +
        `${testPeriod.days.toLocaleString()} days · ${testPeriod.bars.toLocaleString()} bars · ` +
        `${symbol} ${interval}` +
        (cfg && cfg.startBalance ? ` · Capital $${Number(cfg.startBalance).toLocaleString()} @ ${cfg.sizePct}% size` : '') +
        `</div>`
      : '';

    return `<div class="sg-mtf-ai-hdr"><i class="fas fa-robot"></i> AI Analysis</div>` +
      `<div class="sg-mtf-ai-verdict sg-ai-${cls}"><span class="sg-mtf-ai-badge">${rating}</span><span>${verdict}</span></div>` +
      periodLine +
      `<div class="sg-mtf-ai-line">${winLine}</div>` +
      `<div class="sg-mtf-ai-line">${ddLine}</div>` +
      (tipsHtml ? `<div class="sg-mtf-ai-sub">Suggestions</div><ul class="sg-mtf-ai-tips">${tipsHtml}</ul>` : '') +
      `<div class="sg-mtf-ai-note">Heuristic analysis of the tested window — not financial advice.</div>`;
  }

  // Heuristic "AI overview" of a multi-TF run: a profitability verdict, the best/worst
  // timeframe, whether the edge lives on low or high timeframes, and concrete input
  // tweaks. Pure rule-based — it only reads the standard per-TF stats, so it works for
  // every strategy, and it names the *current* strategy's real param labels in the tips.
  function mtfOverview(name, rows) {
    const ok = rows.filter((r) => !r.err && r.st);
    if (ok.length < 2) return ''; // need ≥2 timeframes to compare

    // label ("1m"/"4h"/"1D"/"1W") → minutes, for the low/high-TF split
    const lblMin = (lbl) => {
      const s = String(lbl).trim().toLowerCase();
      if (s.includes('w')) return 10080;
      if (s.includes('d')) return 1440;
      const h = s.match(/(\d+)\s*h/); if (h) return parseInt(h[1]) * 60;
      const m = s.match(/(\d+)/); return m ? parseInt(m[1]) : 0;
    };
    // cap ∞ profit factor so averages stay finite
    const capPF = (st) => st.profitFactor === Infinity ? 4 : (st.profitFactor || 0);
    const fmtPF = (st) => st.profitFactor === Infinity ? '∞' : (st.profitFactor || 0).toFixed(2);

    const total = ok.length;
    const winners = ok.filter((r) => r.st.netUsd > 0);
    const share = winners.length / total;
    const totalNet = ok.reduce((a, r) => a + r.st.netUsd, 0);
    const avgPF = ok.reduce((a, r) => a + capPF(r.st), 0) / total;
    const avgWinRate = ok.reduce((a, r) => a + r.st.winRate, 0) / total;
    const avgDD = ok.reduce((a, r) => a + Math.abs(r.st.maxDrawdown || 0), 0) / total;
    const avgTrades = ok.reduce((a, r) => a + r.st.totalTrades, 0) / total;
    const avgStreakL = ok.reduce((a, r) => a + (r.st.maxConsecLosses || 0), 0) / total;

    const best = ok.reduce((a, b) => (b.st.netUsd > a.st.netUsd ? b : a));
    const worst = ok.reduce((a, b) => (b.st.netUsd < a.st.netUsd ? b : a));

    const low = ok.filter((r) => { const mn = lblMin(r.label); return mn > 0 && mn < 60; });
    const high = ok.filter((r) => lblMin(r.label) >= 60);
    const avgPct = (arr) => arr.length ? arr.reduce((a, r) => a + r.st.netPct, 0) / arr.length : null;
    const lowPct = avgPct(low), highPct = avgPct(high);

    // ---- verdict rating -----------------------------------------------------
    let rating, cls;
    if (share >= 0.6 && avgPF >= 1.3 && totalNet > 0) { rating = 'Profitable edge'; cls = 'good'; }
    else if (share >= 0.5 && avgPF >= 1.1 && totalNet > 0) { rating = 'Promising'; cls = 'ok'; }
    else if (totalNet > 0 || share >= 0.4) { rating = 'Marginal / mixed'; cls = 'warn'; }
    else { rating = 'No edge yet'; cls = 'bad'; }

    const verdict =
      `<b>${winners.length}/${total}</b> timeframes net positive (${Math.round(share * 100)}%), ` +
      `avg profit factor <b>${avgPF.toFixed(2)}</b>, avg win rate <b>${avgWinRate.toFixed(0)}%</b>. ` +
      `Combined net across tested timeframes is <b>${fmtMoney(totalNet)}</b>.`;

    // ---- low- vs high-TF tendency ------------------------------------------
    let regime;
    if (lowPct != null && highPct != null) {
      const diff = lowPct - highPct;
      if (Math.abs(diff) < 0.5)
        regime = `Behaves about evenly across timeframes (sub-1h ${fmtPct(lowPct)} vs 1h+ ${fmtPct(highPct)} avg net).`;
      else if (diff > 0)
        regime = `Edge leans to <b>lower timeframes</b> — sub-1h averages ${fmtPct(lowPct)} vs ${fmtPct(highPct)} on 1h+. Favor the faster charts.`;
      else
        regime = `Edge leans to <b>higher timeframes</b> — 1h+ averages ${fmtPct(highPct)} vs ${fmtPct(lowPct)} sub-1h. The fast charts are mostly intrabar noise here.`;
    } else {
      regime = `Add timeframes on both sides of 1h to compare low- vs high-TF behavior.`;
    }

    // ---- suggested tweaks (name the strategy's real inputs where we can) -----
    const strat = getStrategy(stratId);
    const pdefs = (strat && strat.params) || {};
    const findP = (re) => {
      for (const k in pdefs) { const lbl = pdefs[k].label || k; if (re.test(k) || re.test(lbl)) return lbl; }
      return null;
    };
    const filterP = findP(/thresh|filter|sigma|σ|deviat|sensit|confirm|delay/i);
    const riskP = findP(/stop|target|risk|\bsl\b|\btp\b|atr|swing|reward|\bR\b/i);

    const tips = [];
    if (avgTrades < 12)
      tips.push(`Only ~${avgTrades.toFixed(0)} trades per timeframe — too few to trust. Widen the window or loosen the entry filter${filterP ? ` (<b>${filterP}</b>)` : ''} for more signals.`);
    if (avgWinRate < 40 && avgPF >= 1)
      tips.push(`Low win rate (${avgWinRate.toFixed(0)}%) but PF ≥ 1 — a let-winners-run profile. Push the reward/target multiple${riskP ? ` (<b>${riskP}</b>)` : ''} higher rather than tightening entries.`);
    if (avgWinRate < 40 && avgPF < 1)
      tips.push(`Low win rate <i>and</i> PF < 1 — signals are noisy. Raise the entry filter${filterP ? ` (<b>${filterP}</b>)` : ''} or add a higher-TF trend bias so only cleaner setups fire.`);
    if (avgStreakL >= 5)
      tips.push(`Losing streaks reach ~${avgStreakL.toFixed(0)} in a row — add a regime/volatility filter, or cut size after consecutive losses to ride out cold runs.`);
    if (avgDD > 20)
      tips.push(`Average drawdown ${avgDD.toFixed(0)}% is steep — trim position size in Trade Sim so one bad timeframe can't sink the account.`);
    if (worst.st.netUsd < 0)
      tips.push(`Worst TF <b>${worst.label}</b> loses ${fmtMoney(worst.st.netUsd)} — drop it from rotation, or restrict it to one direction if its bias is one-sided.`);
    if (best.st.netUsd > 0)
      tips.push(`Best TF <b>${best.label}</b> (${fmtMoney(best.st.netUsd)}, PF ${fmtPF(best.st)}) — optimize here first and re-test any param change against it.`);
    if (!tips.length)
      tips.push('Stats look balanced — nudge one input at a time and re-run to confirm the edge before sizing up.');

    const tipsHtml = tips.slice(0, 5).map((t) => `<li>${t}</li>`).join('');

    return `<div class="sg-mtf-ai">` +
        `<div class="sg-mtf-ai-hdr"><i class="fas fa-robot"></i> AI Overview · ${name}</div>` +
        `<div class="sg-mtf-ai-verdict sg-ai-${cls}">` +
          `<span class="sg-mtf-ai-badge">${rating}</span>` +
          `<span>${verdict}</span>` +
        `</div>` +
        `<div class="sg-mtf-ai-line"><b>Best:</b> ${best.label} (${fmtMoney(best.st.netUsd)}, PF ${fmtPF(best.st)}) · ` +
          `<b>Worst:</b> ${worst.label} (${fmtMoney(worst.st.netUsd)})</div>` +
        `<div class="sg-mtf-ai-line">${regime}</div>` +
        `<div class="sg-mtf-ai-sub">Suggested tweaks</div>` +
        `<ul class="sg-mtf-ai-tips">${tipsHtml}</ul>` +
        `<div class="sg-mtf-ai-note">Heuristic read of the tested window only — not financial advice. Re-run after each change.</div>` +
      `</div>`;
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
      settings: {
        startBalance:  cfg.startBalance,
        sizePct:       cfg.sizePct,
        commissionPct: cfg.commissionPct,
        slippagePct:   cfg.slippagePct,
        test_period: (() => {
          const ok = rows.filter((r) => !r.err && r.from != null && r.to != null);
          if (!ok.length) return null;
          const from = Math.min(...ok.map((r) => r.from));
          const to   = Math.max(...ok.map((r) => r.to));
          return { from, to, days: Math.round((to - from) / 86400), bars: Math.round(ok.reduce((a, r) => a + (r.bars || 0), 0) / ok.length) };
        })(),
      },
      result: {
        rows: rows.map((r) => r.err
          ? { label: r.label, err: true }
          : { label: r.label, bars: r.bars, from: r.from, to: r.to, st: r.st }),
        best: best ? { label: best.label, netUsd: best.st.netUsd } : null,
      },
      note: mtfOverview(stratName, rows),
    };
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    const saved = window.DataStore ? await window.DataStore.saveRun(record) : false;
    btn.innerHTML = saved ? '<i class="fas fa-check"></i> Saved' : '<i class="fas fa-triangle-exclamation"></i> Failed';
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
  }

  // SHARED per-candle evaluation — the SINGLE source of truth for SL/TP-touch detection,
  // warm-up skipping, the onCandle call, and signal/stop extraction. BOTH the backtest
  // (simulate, below) and the live replay (processCandle) route through this, so the two
  // execution paths can never silently drift apart. Pure: reads only its inputs, mutates
  // nothing — the caller applies the result to its own account layer.
  //   posSide: 'long'|'short'|null   sl/tp: the position's active stop/target (or null)
  // Returns exactly one of:
  //   { exit: { price, reason } }                 SL/TP hit this bar → close at `price`, skip onCandle
  //   { warming: true }                           still in warm-up → take no action
  //   { signal, reason, stopLoss, takeProfit }    the strategy's decision for this bar
  function evalStrategyCandle(stratInstance, candlesArr, i, warm, posSide, sl, tp, account) {
    const c = candlesArr[i];
    if (posSide && (sl != null || tp != null)) {
      const isLong = posSide === 'long';
      const hitSL = isLong ? (sl != null && c.low <= sl) : (sl != null && c.high >= sl);
      const hitTP = isLong ? (tp != null && c.high >= tp) : (tp != null && c.low <= tp);
      if (hitSL) return { exit: { price: sl, reason: 'Stop loss' } };
      if (hitTP) return { exit: { price: tp, reason: 'Take profit' } };
    }
    if (i < warm) return { warming: true };
    const closes = candlesArr.slice(0, i + 1).map((x) => x.close);
    const indicators = makeIndicators(closes, candlesArr.slice(0, i + 1));
    const res = stratInstance.onCandle(c, indicators, account);
    const signal = typeof res === 'string' ? res : (res && res.signal) || null;
    const obj = res && typeof res === 'object';
    return {
      signal,
      reason: stratInstance.reason || '',
      stopLoss: obj && res.stopLoss != null ? res.stopLoss : null,
      takeProfit: obj && res.takeProfit != null ? res.takeProfit : null,
    };
  }

  // Pure simulation over ALL candles. Returns { trades, signals, stats, finalBalance }.
  function simulate(strat, prms, candles, cfg) {
    const s = Object.create(strat);
    s.init(prms);
    const warm = strat.warmUpBars || 0;
    const comm = cfg.commissionPct / 100, slip = cfg.slippagePct / 100, sizeFrac = cfg.sizePct / 100;

    let balance = cfg.startBalance, totalFees = 0;
    let pos = null, sl = null, tp = null;
    const trades = [], signals = [];

    function openPos(side, price, i, reason) {
      const fill = side === 'long' ? price * (1 + slip) : price * (1 - slip);
      // Snapshot the stop set for THIS entry bar so closePos can express P&L in R-multiples.
      pos = { side, entry: fill, size: balance * sizeFrac, entryIndex: i, entryStop: sl };
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
      // R = gross return / initial risk (stop distance). Null when the strategy set no stop.
      let R = null;
      if (pos.entryStop != null) {
        const riskPct = Math.abs(pos.entry - pos.entryStop) / pos.entry * 100;
        if (riskPct > 0) R = grossPct / riskPct;
      }
      trades.push({ side: pos.side, entry: pos.entry, exit: exitFill, pct: grossPct, usd, R });
      signals.push({ index: i, time: candles[i].time, type: 'close', price: exitFill, reason });
      pos = null; sl = null; tp = null;
    }

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const account = { position: pos ? pos.side : null, entryPrice: pos ? pos.entry : null, balance };
      const ev = evalStrategyCandle(s, candles, i, warm, pos ? pos.side : null, sl, tp, account);
      if (ev.exit) { closePos(ev.exit.price, i, ev.exit.reason); continue; }
      if (ev.warming) continue;
      if (ev.stopLoss != null) sl = ev.stopLoss;
      if (ev.takeProfit != null) tp = ev.takeProfit;
      const reason = ev.reason;
      if (ev.signal === 'long') { if (pos && pos.side === 'short') closePos(c.close, i, reason); if (!pos) openPos('long', c.close, i, reason); }
      else if (ev.signal === 'short') { if (pos && pos.side === 'long') closePos(c.close, i, reason); if (!pos) openPos('short', c.close, i, reason); }
      else if (ev.signal === 'close') { if (pos) closePos(c.close, i, reason); }
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

    // R-multiple expectancy: mean of per-trade R (gross return / initial risk). Null when no
    // trade recorded an R (strategy never set a stop), so the matrix can fall back to net%.
    const Rs = trades.filter((t) => t.R != null).map((t) => t.R);
    const expectancyR = Rs.length ? Rs.reduce((a, b) => a + b, 0) / Rs.length : null;

    return {
      netUsd, netPct: (netUsd / startBalance) * 100, totalTrades: n,
      winners: wins.length, losers: losses.length, breakevens: n - wins.length - losses.length,
      winRate: n ? (wins.length / n) * 100 : 0,
      profitFactor: grossLoss ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0),
      maxDrawdown: -maxDD * 100, sharpe, avgWin, avgLoss, largestWin, largestLoss,
      maxConsecWins: maxCW, maxConsecLosses: maxCL, totalFees, expectancyR,
    };
  }

  function donutChart(st, title) {
    const n = st.totalTrades;
    const win = st.winners || 0, loss = st.losers || 0, be = st.breakevens || 0;
    const circ = 2 * Math.PI * 30;
    const winArc  = n ? (win  / n) * circ : 0;
    const lossArc = n ? (loss / n) * circ : 0;
    const beArc   = n ? (be   / n) * circ : 0;
    const seg = (arc, color, offset) => arc > 0.1
      ? `<circle cx="40" cy="40" r="30" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="butt"` +
        ` stroke-dasharray="${arc.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"` +
        ` transform="rotate(-90 40 40)"/>`
      : '';
    const pct = (v) => n ? `${((v / n) * 100).toFixed(2)}%` : '0.00%';
    const leg = (color, label, count, p) =>
      `<div class="td-leg-row">` +
        `<span class="td-dot" style="background:${color}"></span>` +
        `<span class="td-leg-label">${label}</span>` +
        `<span class="td-leg-count">${count} trades</span>` +
        `<span class="td-leg-pct">${p}</span>` +
      `</div>`;
    return `<div class="td-wrap">` +
        `<div class="td-title">${title || 'Trades distribution'}</div>` +
        `<div class="td-body">` +
          `<svg class="td-donut" viewBox="0 0 80 80" width="84" height="84">` +
            `<circle cx="40" cy="40" r="30" fill="none" stroke="var(--border)" stroke-width="9"/>` +
            seg(winArc,  '#26a69a', 0) +
            seg(lossArc, '#ef5350', winArc) +
            seg(beArc,   '#8a8d93', winArc + lossArc) +
            `<text x="40" y="37" text-anchor="middle" fill="#fff" font-size="13" font-weight="700" font-family="Space Grotesk,sans-serif">${n}</text>` +
            `<text x="40" y="49" text-anchor="middle" fill="#8a8d93" font-size="7" font-family="Space Grotesk,sans-serif">Total trades</text>` +
          `</svg>` +
          `<div class="td-legend">` +
            leg('#26a69a', 'Winners',    win,  pct(win))  +
            leg('#ef5350', 'Losers',     loss, pct(loss)) +
            leg('#8a8d93', 'Breakevens', be,   pct(be))   +
          `</div>` +
        `</div>` +
      `</div>`;
  }

  function renderResults(st) {
    lastStats = st;
    const pf = st.profitFactor === Infinity ? '∞' : st.profitFactor.toFixed(2);
    const col = st.netUsd >= 0 ? UP : DOWN;
    const row = (label, val, color) =>
      `<div class="ts-row"><span>${label}</span><b${color ? ` style="color:${color}"` : ''}>${val}</b></div>`;
    const hdr = modalOverlay && modalOverlay.querySelector('.sg-results-hdr');
    if (hdr) hdr.style.display = 'flex';
    elResults.innerHTML =
      donutChart(st) +
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
    const sym = (document.getElementById('symbol') || {}).value || '';
    const iv  = (document.querySelector('#tfTabs .active') || {}).dataset?.v || '';
    const stratLabel = strat ? strat.name || stratId : stratId;
    const record = {
      kind: 'single',
      strategy_id: stratId,
      strategy_label: stratLabel,
      symbol: sym,
      interval: iv,
      max_candles: parseInt((document.getElementById('maxCandles') || {}).value) || 0,
      params: { ...params },
      settings: {
        startBalance:  cfg.startBalance,
        sizePct:       cfg.sizePct,
        commissionPct: cfg.commissionPct,
        slippagePct:   cfg.slippagePct,
        test_period:   lastCandleRange || null,
      },
      result: { ...lastStats },
      note: singleOverview(lastStats, stratLabel, sym, iv, cfg, lastCandleRange),
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
      if (s.type === 'long') return { time: s.time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: '' };
      if (s.type === 'short') return { time: s.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: '' };
      return { time: s.time, position: 'aboveBar', color: '#3b82f6', shape: 'square', text: '' }; // close (LWC has no diamond)
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
    if (!on) { restoreIndicators(); clearMarkers(); tooltip.style.display = 'none'; clearSLTPLines(); deactivateOverlay(); if (nameLabel) nameLabel.style.display = 'none'; }
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
    liveSL = null; liveTP = null;
    // Opt-in chart drawings (pivot line + trade boxes/labels): only for strategies
    // that declare `overlay: true`, only during their replay.
    overlayOn = !!strat.overlay && typeof StrategyOverlay !== 'undefined';
    liveTrades = []; openTrade = null;
    if (overlayOn) { StrategyOverlay.setActive(true); feedOverlay(); }
    clearError();
    showNameLabel(strat.name);
    if (elLog) elLog.innerHTML = '';
    appendLog('<i class="fas fa-eye"></i>', `Watching ${strat.name} from candle ${replay.cutIndex + 1}`);
  }

  // Reset the badge to its lower-center default and reveal it with the strategy name,
  // the lookback range it's being tested over, and the chart's current timeframe.
  function showNameLabel(name) {
    if (!nameLabel) return;
    const range = lastReplayRangeLabel || formatRangeLabel(replayRangeNum, replayRangeUnit);
    const tf = getCurrentTfLabel();
    nameLabel.innerHTML =
      `<i class="fas fa-flask"></i> <span class="sg-nl-name">${name}</span>` +
      `<span class="sg-nl-meta">· ${range} · ${tf}</span>`;
    nameLabel.style.left = '50%';
    nameLabel.style.top = 'auto';
    nameLabel.style.bottom = '18px';
    nameLabel.style.transform = 'translateX(-50%)';
    nameLabel.style.display = 'flex';
  }

  // called from app when leaving replay — restore the user's indicators + clean up
  function onExitReplay() {
    restoreIndicators();
    liveMarkers = []; clearMarkers();
    clearSLTPLines();
    deactivateOverlay();
    if (nameLabel) nameLabel.style.display = 'none';
  }

  // Clear + hide the strategy overlay so its drawings never leak onto the normal chart.
  function deactivateOverlay() {
    overlayOn = false; liveTrades = []; openTrade = null;
    if (typeof StrategyOverlay !== 'undefined') StrategyOverlay.setActive(false);
  }

  // Push the current pivot series + executed trades to the overlay (no-op unless on).
  function feedOverlay() {
    if (!overlayOn || typeof StrategyOverlay === 'undefined') return;
    const candles = getFullCandles();
    const revealed = candles.slice(0, lastProcessedIndex + 1);
    let pivot = [], lines = [];
    try {
      if (live && typeof live.overlaySeries === 'function') {
        const s = live.overlaySeries(revealed, params);
        pivot = (s && s.pivot) || [];
        lines = (s && s.lines) || [];
      }
    } catch (e) { /* drawing must never break replay */ }
    const lastTime = revealed.length ? revealed[revealed.length - 1].time : null;
    StrategyOverlay.setData({ pivot, lines, trades: liveTrades, lastTime });
  }

  // Record a freshly-opened trade for the overlay (entry avg from TradeSim).
  function recordOpen(dir, c) {
    if (!overlayOn) return;
    openTrade = { entryTime: c.time, entryPrice: tradeSim.getAccount().entryPrice,
      dir, stop: null, target: null, exitTime: null, exitPrice: null };
    liveTrades.push(openTrade);
  }
  // Finalize the open trade's exit (stops its box from extending further).
  function recordClose(time, price) {
    if (!overlayOn || !openTrade) return;
    openTrade.exitTime = time; openTrade.exitPrice = price; openTrade = null;
  }
  // Live entry/exit dots — suppressed when the overlay draws its own triangles.
  function liveMark(time, type) { if (!overlayOn) pushLiveMarker(time, type); }

  // a live entry/exit dot on the price chart at the trade candle
  function pushLiveMarker(time, type) {
    const m = type === 'long'  ? { time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: '' }
            : type === 'short' ? { time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: '' }
            :                    { time, position: 'aboveBar', color: '#3b82f6', shape: 'square', text: '' }; // close (LWC has no diamond)
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

    // SAME decision core as the backtest — guarantees replay can't diverge from simulate().
    let ev;
    try {
      ev = evalStrategyCandle(live, candles, i, (strat.warmUpBars || 0), acct.position, liveSL, liveTP, acct);
    } catch (e) {
      replay.pause();
      showError(`${strat.name}.onCandle() threw at candle ${i}: ${e.message}`);
      appendLog('<i class="fas fa-triangle-exclamation"></i>', `Candle ${i} — ERROR: ${e.message}`);
      return;
    }

    // SL/TP auto-close (close at the exact stop/target level, matching simulate()).
    if (ev.exit) {
      const isStop = ev.exit.reason === 'Stop loss';
      tradeSim.close(ev.exit.price); recordClose(c.time, ev.exit.price); clearSLTPLines(); liveMark(c.time, 'close');
      appendLog('<i class="fas fa-square-xmark"></i>', `Candle ${i} — ${isStop ? 'STOP' : 'TARGET'} hit`);
      feedOverlay();
      return;
    }
    if (ev.warming) {
      appendLog('<i class="fas fa-hourglass-half"></i>', `Candle ${i} — Warming up (${i}/${strat.warmUpBars})`);
      feedOverlay();
      return;
    }

    const signal = ev.signal, reason = ev.reason;
    if (signal === 'long') { if (acct.position === 'short') { tradeSim.close(); recordClose(c.time, c.close); clearSLTPLines(); liveMark(c.time, 'close'); } tradeSim.open('long'); recordOpen('long', c); liveMark(c.time, 'long'); appendLog('<i class="fas fa-arrow-up"></i>', `Candle ${i} — LONG · ${reason}`); }
    else if (signal === 'short') { if (acct.position === 'long') { tradeSim.close(); recordClose(c.time, c.close); clearSLTPLines(); liveMark(c.time, 'close'); } tradeSim.open('short'); recordOpen('short', c); liveMark(c.time, 'short'); appendLog('<i class="fas fa-arrow-down"></i>', `Candle ${i} — SHORT · ${reason}`); }
    else if (signal === 'close') { if (acct.position) { tradeSim.close(); recordClose(c.time, c.close); clearSLTPLines(); liveMark(c.time, 'close'); appendLog('<i class="fas fa-xmark"></i>', `Candle ${i} — CLOSE · ${reason}`); } else appendLog('<i class="fas fa-minus"></i>', `Candle ${i} — No signal · ${reason}`); }
    else appendLog('<i class="fas fa-minus"></i>', `Candle ${i} — No signal · ${reason}`);

    // apply any stop-loss / take-profit returned for the (possibly new) position
    if (!tradeSim.getAccount().position) {
      clearSLTPLines();
    } else {
      if (ev.stopLoss != null) liveSL = ev.stopLoss;
      if (ev.takeProfit != null) liveTP = ev.takeProfit;
      if (openTrade) { openTrade.stop = liveSL; openTrade.target = liveTP; }
      if (!overlayOn) drawSLTPLines();
    }
    feedOverlay();
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
    if (!elLog) return; // signal log UI removed
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
    openStratModal();   // surface the error in the settings modal (banner shows over chart too)
  }
  function clearError() {
    elError.style.display = 'none';
    banner.style.display = 'none';
  }

  return { init, setModeActive, onEnterReplay, onExitReplay, onTick, clearMarkers,
    simulate, makeIndicators,
    get active() { return modeActive; } };
})();
