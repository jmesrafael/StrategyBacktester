// app.js — wires controls, data, chart, replay, indicators, and drawing tools

(function () {
  let candles = [];
  let replayMode = false;     // true once a cut point is committed
  let replayArming = false;   // true after Replay clicked, before double-click
  let firstLoad = true;       // fitContent only once — never on later UI actions
  let lastCut = null;         // remembered cut for Play Again / mode switch
  let interval = CFG.DEFAULTS.interval;

  const $ = (id) => document.getElementById(id);
  const LS = window.localStorage;
  const STORE = CFG.STORE;

  // ---- one-time settings migration -------------------------------------
  // When the bundled defaults change (SCHEMA_VERSION bump) drop the now-restyled
  // persisted keys so the new no-SMA / no-grid / monochrome defaults take effect.
  if (LS.getItem(STORE.version) !== String(CFG.SCHEMA_VERSION)) {
    [STORE.indicators, STORE.grid, STORE.bg, STORE.gridColor].forEach((k) => LS.removeItem(k));
    LS.setItem(STORE.version, String(CFG.SCHEMA_VERSION));
  }

  // ---- saved startup defaults (symbol / interval / maxCandles / candleStyle) -
  let startupDefaults = {};
  try { startupDefaults = JSON.parse(LS.getItem(STORE.defaults)) || {}; } catch {}
  if (startupDefaults.interval) interval = startupDefaults.interval;

  // ---- populate controls ----
  CFG.SYMBOLS.forEach((s) => $('symbol').add(new Option(s, s)));
  $('symbol').value = startupDefaults.symbol && CFG.SYMBOLS.includes(startupDefaults.symbol)
    ? startupDefaults.symbol : CFG.DEFAULTS.symbol;

  // timeframe list is user-customizable (persisted)
  const TF_LABEL = new Map(CFG.ALL_INTERVALS);                        // value -> label
  const TF_VALUE = new Map(CFG.ALL_INTERVALS.map(([v, l]) => [l, v])); // label -> value
  let timeframes = loadTimeframes();
  if (!timeframes.includes(interval)) interval = timeframes[0];
  buildIntervalSeg();

  function loadTimeframes() {
    try {
      const saved = JSON.parse(LS.getItem(STORE.timeframes));
      if (Array.isArray(saved)) {
        const valid = saved.filter((v) => TF_LABEL.has(v));
        if (valid.length) return valid;
      }
    } catch {}
    return CFG.ALL_INTERVALS.map(([v]) => v); // default: all of them
  }

  function buildIntervalSeg() {
    const seg = $('intervalSeg');
    seg.innerHTML = '';
    timeframes.forEach((v) => {
      const b = document.createElement('button');
      b.dataset.v = v; b.textContent = TF_LABEL.get(v) || v;
      if (v === interval) b.classList.add('active');
      seg.appendChild(b);
    });
  }

  // max candles (persisted; defaults to the largest = most history)
  CFG.MAX_CANDLES.forEach((n) => $('maxCandles').add(new Option(String(n), n)));
  const savedMax = startupDefaults.maxCandles || LS.getItem(STORE.maxCandles);
  $('maxCandles').value = savedMax && CFG.MAX_CANDLES.includes(+savedMax)
    ? String(savedMax) : String(CFG.DEFAULTS.maxCandles);

  CFG.SPEEDS.forEach((s) => $('speed').add(new Option(s + 'x', s)));

  // ---- chart + indicators + drawings init ----
  ChartView.create($('chart'));
  const lwChart   = ChartView.getChart();
  const chartHost = $('chartHost');

  // ---- price-axis stretch: wheel-over-axis only (drag disabled) ---------
  // Lightweight-Charts exposes no price-zoom API, so reuse its native axis-drag
  // scaling by synthesizing a flagged mouse drag on the price-axis canvas when
  // the wheel is used over the right axis. Real user drags there are blocked.
  function priceAxisLeftX() {
    let w = 64;
    try { w = lwChart.priceScale('right').width() || w; } catch {}
    return chartHost.getBoundingClientRect().right - w;
  }
  function overPriceAxis(clientX) { return clientX >= priceAxisLeftX(); }

  chartHost.addEventListener('wheel', (e) => {
    if (!overPriceAxis(e.clientX)) return;            // only over the price axis
    const el = document.elementFromPoint(e.clientX, e.clientY);
    // bail if the drawing overlay (or anything non-chart) is on top
    if (!el || !$('chart').contains(el)) return;
    e.preventDefault(); e.stopPropagation();
    const dy = Math.max(-48, Math.min(48, e.deltaY)) * 0.6; // clamp + soften
    const x = e.clientX, y = e.clientY;
    const mk = (type, cy) => {
      const ev = new MouseEvent(type, { bubbles: true, cancelable: true,
        clientX: x, clientY: cy, button: 0, buttons: 1 });
      ev.__synthAxis = true; return ev;
    };
    el.dispatchEvent(mk('mousedown', y));
    document.dispatchEvent(mk('mousemove', y + dy));
    document.dispatchEvent(mk('mouseup', y + dy));
  }, { passive: false, capture: true });

  // block real (non-synthetic) click-drag stretch on the price axis
  chartHost.addEventListener('mousedown', (e) => {
    if (e.__synthAxis) return;
    if (overPriceAxis(e.clientX)) e.stopPropagation();
  }, { capture: true });

  IndicatorManager.init({
    chart: lwChart,
    button: $('indicatorsBtn'),
    badge: $('indBadge'),
    chartHost: chartHost,
    getVisibleCandles: () => replayMode ? candles.slice(0, Replay.cutIndex + 1) : candles,
  });
  Drawings.init(lwChart, ChartView.getCandleSeries(), chartHost);
  TradeSim.init({
    chart: lwChart,
    series: ChartView.getCandleSeries(),
    chartHost: chartHost,
    onPlayAgain: () => enterReplayMode(lastCut),
    onExit: () => {},
  });
  StrategyMode.init({
    chart: lwChart,
    chartHost: chartHost,
    button: $('strategyBtn'),
    replay: Replay,
    tradeSim: TradeSim,
    getFullCandles: () => candles,
    onWatchReplay: () => watchReplay(),
  });

  let tradeMode = 'game'; // 'game' | 'strategy'

  // ---- candle style (persisted) ----------------------------------------
  let candleStyle = startupDefaults.candleStyle ||
    LS.getItem(STORE.candleStyle) || CFG.DEFAULTS.candleStyle;
  // custom per-direction colors (override the named style when set)
  let candleUp   = LS.getItem(STORE.candleUp)   || null;
  let candleDown = LS.getItem(STORE.candleDown) || null;

  function applyCandleStyle(name) {
    candleStyle = name;
    ChartView.setCandleStyle(name);
    LS.setItem(STORE.candleStyle, name);
    $('candleStyleMenu').querySelectorAll('.menu-item').forEach((b) =>
      b.classList.toggle('active', b.dataset.style === name));
  }
  function applyCandleColors() {
    if (candleUp || candleDown) {
      ChartView.setCandleColors(candleUp || CFG.THEME.up, candleDown || CFG.THEME.down);
    }
  }

  $('candleStyleBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('candleStyleMenu').classList.toggle('open');
  });
  $('candleStyleMenu').addEventListener('click', (e) => {
    const b = e.target.closest('.menu-item'); if (!b) return;
    // picking a named style clears any custom candle colors
    candleUp = null; candleDown = null;
    LS.removeItem(STORE.candleUp); LS.removeItem(STORE.candleDown);
    if ($('stUp'))   $('stUp').value   = CFG.THEME.up;
    if ($('stDown')) $('stDown').value = CFG.THEME.down;
    applyCandleStyle(b.dataset.style);
    $('candleStyleMenu').classList.remove('open');
  });
  document.addEventListener('click', () => $('candleStyleMenu').classList.remove('open'));

  // ---- canvas settings (grid, colors, candles, timeframes, persisted) --
  const stBg    = LS.getItem(STORE.bg);
  const stGridV = LS.getItem(STORE.grid);       // 'true' | 'false' | null
  const stGridC = LS.getItem(STORE.gridColor);
  if (stBg) ChartView.setBackground(stBg);
  if (stGridV != null) ChartView.setGridVisible(stGridV === 'true');
  if (stGridC) ChartView.setGridColor(stGridC);

  const settingsPanel = document.createElement('div');
  settingsPanel.className = 'settings-panel';
  settingsPanel.innerHTML =
    `<div class="st-title">Canvas</div>` +
    `<label class="st-row"><span>Show grid</span><input type="checkbox" id="stGrid"></label>` +
    `<label class="st-row"><span>Background</span><input type="color" id="stBg"></label>` +
    `<label class="st-row"><span>Grid color</span><input type="color" id="stGridColor"></label>` +
    `<div class="st-title">Candles</div>` +
    `<label class="st-row"><span>Bullish</span><input type="color" id="stUp"></label>` +
    `<label class="st-row"><span>Bearish</span><input type="color" id="stDown"></label>` +
    `<div class="st-title">Timeframes</div>` +
    `<input class="st-tf" id="stTf" type="text" spellcheck="false" placeholder="1m, 5m, 15m, 1h, 4h, 1D">` +
    `<div class="st-hint">Comma-separated. Available: ${CFG.ALL_INTERVALS.map(([, l]) => l).join(' ')}</div>` +
    `<div class="st-sep"></div>` +
    `<button class="st-save" id="stSave">Save current as defaults</button>`;
  document.body.appendChild(settingsPanel);
  settingsPanel.addEventListener('click', (e) => e.stopPropagation());

  $('stGrid').checked    = stGridV == null ? false : stGridV === 'true';
  $('stBg').value        = stBg    || CFG.THEME.bg;
  $('stGridColor').value = stGridC || CFG.THEME.border;
  $('stUp').value        = candleUp   || CFG.THEME.up;
  $('stDown').value      = candleDown || CFG.THEME.down;
  $('stTf').value        = timeframes.map((v) => TF_LABEL.get(v)).join(', ');

  $('stGrid').onchange = (e) => {
    ChartView.setGridVisible(e.target.checked);
    LS.setItem(STORE.grid, String(e.target.checked));
  };
  $('stBg').oninput = (e) => {
    ChartView.setBackground(e.target.value);
    LS.setItem(STORE.bg, e.target.value);
  };
  $('stGridColor').oninput = (e) => {
    ChartView.setGridColor(e.target.value);
    LS.setItem(STORE.gridColor, e.target.value);
  };
  $('stUp').oninput = (e) => {
    candleUp = e.target.value; LS.setItem(STORE.candleUp, candleUp); applyCandleColors();
  };
  $('stDown').oninput = (e) => {
    candleDown = e.target.value; LS.setItem(STORE.candleDown, candleDown); applyCandleColors();
  };
  $('stTf').onchange = (e) => {
    const labels = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
    const vals = [...new Set(labels.map((l) => TF_VALUE.get(l)).filter(Boolean))];
    if (!vals.length) { e.target.value = timeframes.map((v) => TF_LABEL.get(v)).join(', '); return; }
    timeframes = vals;
    LS.setItem(STORE.timeframes, JSON.stringify(timeframes));
    const prev = interval;
    if (!timeframes.includes(interval)) interval = timeframes[0];
    buildIntervalSeg();
    e.target.value = timeframes.map((v) => TF_LABEL.get(v)).join(', ');
    if (interval !== prev) load();
  };
  $('stSave').onclick = () => {
    const blob = { symbol: $('symbol').value, interval,
      maxCandles: $('maxCandles').value, candleStyle };
    LS.setItem(STORE.defaults, JSON.stringify(blob));
    const btn = $('stSave'); const t = btn.textContent;
    btn.textContent = '✓ Saved'; setTimeout(() => { btn.textContent = t; }, 1200);
  };

  $('settingsBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = settingsPanel.classList.toggle('open');
    if (open) {
      const r = $('settingsBtn').getBoundingClientRect();
      settingsPanel.style.left = Math.min(r.left, window.innerWidth - 230) + 'px';
      settingsPanel.style.top = (r.bottom + 4) + 'px';
    }
  });
  document.addEventListener('click', () => settingsPanel.classList.remove('open'));

  // ---- bottom-bar OHLCV under cursor -----------------------------------
  ChartView.onCrosshairMove((param) => {
    const ohlcv = $('ohlcv');
    if (!param || !param.point || !param.time) { ohlcv.innerHTML = ''; return; }
    const c = param.seriesData.get(ChartView.getCandleSeries());
    const v = param.seriesData.get(ChartView.getVolumeSeries());
    if (!c) { ohlcv.innerHTML = ''; return; }
    const dec = c.close < 1 ? 5 : c.close < 100 ? 3 : 2;
    const col = c.close >= c.open ? CFG.THEME.up : CFG.THEME.down;
    ohlcv.innerHTML =
      `<span>O <b>${c.open.toFixed(dec)}</b></span>` +
      `<span>H <b>${c.high.toFixed(dec)}</b></span>` +
      `<span>L <b>${c.low.toFixed(dec)}</b></span>` +
      `<span>C <b style="color:${col}">${c.close.toFixed(dec)}</b></span>` +
      `<span>Vol <b>${v ? ChartView.fmtVol(v.value) : '—'}</b></span>`;
  });

  // ---- data load -------------------------------------------------------
  async function load(anchorTime) {
    const symbol = $('symbol').value;
    const max    = parseInt($('maxCandles').value);

    const onProgress = (page, pages) => {
      $('status').textContent = pages > 1 ? `Loading… page ${page} / ${pages}` : 'Loading…';
    };
    $('status').textContent = `Loading ${symbol} ${interval}…`;
    try {
      candles = await fetchCandles(symbol, interval, max, onProgress);
      $('status').textContent = `${candles.length} candles · Bybit live`;
    } catch {
      candles = syntheticCandles(symbol, interval, max);
      $('status').textContent = `${candles.length} candles · offline sample`;
    }

    if (replayMode) {
      let cutIdx;
      if (anchorTime != null) {
        cutIdx = 1;
        for (let i = candles.length - 1; i >= 1; i--) {
          if (candles[i].time <= anchorTime) { cutIdx = i; break; }
        }
      } else {
        cutIdx = Math.max(1, Math.min(candles.length - 2, Math.floor(candles.length * 0.55)));
      }
      lastCut = cutIdx;
      Replay.load(candles, cutIdx); // renderRevealed() recomputes indicators
    } else {
      ChartView.setSlice(candles);
      IndicatorManager.recompute(candles);
      ChartView.setCursor(null);
      // fit only on the very first load so later actions keep zoom + scroll
      if (firstLoad) lwChart.timeScale().fitContent();
    }
    firstLoad = false;
    applyCandleStyle(candleStyle);
    applyCandleColors();
    Drawings.render();
  }

  // ---- replay arming + mode ---------------------------------------------
  // 1) click Replay → scissors cursor, chart stays full + interactive
  // 2) double-click a candle → that candle becomes the replay start
  function armReplay() {
    if (!candles.length || replayMode) return;
    replayArming = true;
    Drawings.setTool('cursor');          // let the chart receive the dbl-click
    chartHost.classList.add('cutting');
    $('replayBtn').classList.add('active');
    $('replayBtn').textContent = '✕ Cancel';
  }
  function cancelArming() {
    replayArming = false;
    chartHost.classList.remove('cutting');
    $('replayBtn').classList.remove('active');
    $('replayBtn').textContent = 'Replay';
  }

  function enterReplayMode(cutIdx) {
    if (!candles.length) return;
    replayArming = false;
    chartHost.classList.remove('cutting');
    replayMode = true;
    document.body.classList.add('replay-mode');
    $('replayBtn').classList.add('active');
    $('replayBtn').textContent = '✕ Exit Replay';
    const idx = (cutIdx != null)
      ? Math.max(1, Math.min(candles.length - 2, cutIdx))
      : Math.max(1, Math.min(candles.length - 2, Math.floor(candles.length * 0.55)));
    lastCut = idx;
    Replay.load(candles, idx);
    ChartView.scrollToRealtime();        // bring the cut candle to the right edge
    TradeSim.setMode(tradeMode);
    TradeSim.start(candles[Replay.cutIndex].close);
    if (tradeMode === 'strategy') StrategyMode.onEnterReplay();
  }

  function exitReplayMode(showSummary) {
    Replay.pause();
    replayMode = false;
    replayArming = false;
    document.body.classList.remove('replay-mode');
    chartHost.classList.remove('cutting');
    $('replayBtn').classList.remove('active');
    $('replayBtn').textContent = 'Replay';
    ChartView.setSlice(candles);
    IndicatorManager.recompute(candles);
    ChartView.setCursor(null);
    applyCandleStyle(candleStyle);
    applyCandleColors();
    Drawings.render();
    TradeSim.stop(showSummary);
  }

  $('replayBtn').onclick = () => {
    if (replayMode) exitReplayMode(true);
    else if (replayArming) cancelArming();
    else armReplay();
  };

  // double-click on a candle commits the replay start point
  lwChart.subscribeDblClick((param) => {
    if (!replayArming) return;
    let idx = null;
    if (param.logical != null) idx = Math.round(param.logical);
    else if (param.time != null) {
      for (let i = candles.length - 1; i >= 0; i--) {
        if (candles[i].time <= param.time) { idx = i; break; }
      }
    }
    if (idx == null) return;
    enterReplayMode(idx);
  });

  // ---- Game / Strategy mode tabs ---------------------------------------
  function setTradeMode(m) {
    tradeMode = m;
    $('modeTabs').querySelectorAll('button').forEach((x) =>
      x.classList.toggle('active', x.dataset.mode === m));
    TradeSim.setMode(m);
    StrategyMode.setModeActive(m === 'strategy');
  }
  function watchReplay() { setTradeMode('strategy'); enterReplayMode(lastCut); }

  $('modeTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const m = b.dataset.mode;
    if (m === tradeMode) return;
    if (TradeSim.getAccount().position &&
        !window.confirm('Switch mode? This closes the open position and resets the session.')) return;
    setTradeMode(m);
    if (replayMode) enterReplayMode(lastCut); // restart the session in the new mode
  });

  // ---- replay state → UI -----------------------------------------------
  Replay.on('state', (st) => {
    $('playIcon').innerHTML = st.playing
      ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
    const pill = $('livePill');
    pill.textContent = st.atEnd ? 'end' : st.playing ? 'live' : 'paused';
    pill.classList.toggle('live', st.playing);
  });
  // re-project drawings + feed live price to the trade sim on every revealed tick
  Replay.on('tick', (p) => {
    Drawings.render();
    if (p && p.candle) TradeSim.onTick(p.candle.close);
    StrategyMode.onTick(p);   // no-op unless strategy mode + watching replay
  });
  Replay.on('end', () => exitReplayMode(true));

  // ---- transport controls ----------------------------------------------
  $('playBtn').onclick   = () => Replay.toggle();
  $('stepBtn').onclick   = () => Replay.step();
  $('rewindBtn').onclick = () => Replay.rewind();
  $('speed').onchange    = (e) => Replay.setSpeed(parseFloat(e.target.value));

  $('modeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $('modeSeg').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    Replay.setMode(b.dataset.v);
  });

  // ---- chart refresh — repaint + reset to a clean fitted view -----------
  // Re-fits the time scale and re-enables price auto-scale so a squeezed /
  // over-stretched chart returns to normal (TradingView-style refresh).
  function refreshChart() {
    if (replayMode) Replay.rerender();
    else { ChartView.setSlice(candles); IndicatorManager.recompute(candles); }
    applyCandleStyle(candleStyle);
    applyCandleColors();
    Drawings.render();
    lwChart.priceScale('right').applyOptions({ autoScale: true });
    lwChart.timeScale().fitContent();
  }
  $('refreshBtn').onclick = refreshChart;

  // ---- right-click context menu ----------------------------------------
  const ctxMenu = $('ctxMenu');
  function buildCtxMenu() {
    const sel = Drawings.hasSelection;
    ctxMenu.innerHTML =
      (sel ? `<button class="ctx-item" data-act="delSel">Delete Selected</button>` +
             `<div class="ctx-sep"></div>` : '') +
      `<button class="ctx-item" data-act="delDraw"${Drawings.count ? '' : ' disabled'}>Remove All Drawings</button>` +
      `<button class="ctx-item" data-act="delInd"${IndicatorManager.count ? '' : ' disabled'}>Remove All Indicators</button>`;
  }
  chartHost.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    buildCtxMenu();
    ctxMenu.classList.add('open');
    ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
    ctxMenu.style.top  = Math.min(e.clientY, window.innerHeight - 130) + 'px';
  });
  ctxMenu.addEventListener('click', (e) => {
    const b = e.target.closest('.ctx-item'); if (!b || b.disabled) return;
    if (b.dataset.act === 'delSel')  Drawings.deleteSelected();
    else if (b.dataset.act === 'delDraw') Drawings.clearAll();
    else if (b.dataset.act === 'delInd')  IndicatorManager.removeAll();
    ctxMenu.classList.remove('open');
  });
  document.addEventListener('click', () => ctxMenu.classList.remove('open'));
  window.addEventListener('blur', () => ctxMenu.classList.remove('open'));

  // ---- data reload controls --------------------------------------------
  $('symbol').onchange     = () => load();
  $('maxCandles').onchange = () => {
    LS.setItem(STORE.maxCandles, $('maxCandles').value);
    load();
  };
  $('intervalSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    interval = b.dataset.v;
    $('intervalSeg').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    const anchorTime = (replayMode && candles[Replay.cutIndex]) ? candles[Replay.cutIndex].time : null;
    load(anchorTime);
  });

  // ---- drawing toolbar -------------------------------------------------
  $('toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]'); if (!b) return;
    Drawings.setTool(b.dataset.tool);
  });
  Drawings.onTool((t) => {
    $('toolbar').querySelectorAll('[data-tool]').forEach((x) =>
      x.classList.toggle('active', x.dataset.tool === t));
    $('drawInfo').textContent = t === 'cursor' ? '' : `Drawing: ${t}`;
  });
  $('clearBtn').onclick = () => Drawings.clearAll();
  $('toolbarToggle').onclick = () => document.body.classList.toggle('no-toolbar');

  // ---- keyboard --------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); if (replayMode) Replay.toggle(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); if (replayMode) Replay.step(); }
    if (e.key === 'Escape') {
      if (replayArming) cancelArming();
      else if (replayMode) exitReplayMode(true);
    }
  });

  // ---- initial load ----------------------------------------------------
  load();
})();
