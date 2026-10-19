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
  // Current pair + timeframe persist on every change (STORE.symbol/interval, synced
  // to the DB via SettingsSync); the explicit "Save as defaults" blob is the fallback.
  let startupDefaults = {};
  try { startupDefaults = JSON.parse(LS.getItem(STORE.defaults)) || {}; } catch {}
  const savedInterval = LS.getItem(STORE.interval) || startupDefaults.interval;
  if (savedInterval) interval = savedInterval;

  // ---- populate controls ----
  CFG.SYMBOLS.forEach((s) => $('symbol').add(new Option(s, s)));
  const savedSymbol = LS.getItem(STORE.symbol) || startupDefaults.symbol;
  $('symbol').value = savedSymbol && CFG.SYMBOLS.includes(savedSymbol)
    ? savedSymbol : CFG.DEFAULTS.symbol;

  // timeframe list is user-customizable (persisted)
  const TF_LABEL = new Map(CFG.ALL_INTERVALS);                        // value -> label
  const TF_VALUE = new Map(CFG.ALL_INTERVALS.map(([v, l]) => [l, v])); // label -> value
  let timeframes = loadTimeframes();
  if (!timeframes.includes(interval)) interval = timeframes[0];
  buildIntervalSeg();

  function loadTimeframes() {
    const canonical = CFG.ALL_INTERVALS.map(([v]) => v);
    try {
      const saved = JSON.parse(LS.getItem(STORE.timeframes));
      if (Array.isArray(saved)) {
        // Re-sort by canonical order so 1m is always first regardless of how
        // items were added/removed or what order was persisted.
        const valid = canonical.filter((v) => saved.includes(v) && TF_LABEL.has(v));
        if (valid.length) return valid;
      }
    } catch {}
    return canonical; // default: all of them
  }

  // ---- TF tabs + manage dropdown -------------------------------------------
  // Tab row shows all enabled TFs. Clicking a tab switches interval.
  // The chevron button opens the manage dropdown (all TFs with enable/disable checks).
  function buildIntervalSeg() {
    // Rebuild tab row
    const tabs = $('tfTabs');
    tabs.innerHTML = '';
    timeframes.forEach((v) => {
      const btn = document.createElement('button');
      btn.className = 'tf-tab tb-btn' + (v === interval ? ' active' : '');
      btn.textContent = TF_LABEL.get(v) || v;
      btn.dataset.v = v;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prev = interval;
        interval = v;
        buildIntervalSeg();
        closeTfMenu();
        if (interval !== prev) {
          const anchorTime = (replayMode && candles[Replay.cutIndex]) ? candles[Replay.cutIndex].time : null;
          load(anchorTime);
        }
      });
      tabs.appendChild(btn);
    });

    // Rebuild manage dropdown (checklist of all possible TFs)
    const menu = $('tfMenu');
    menu.innerHTML = '';
    CFG.ALL_INTERVALS.forEach(([v, label]) => {
      const enabled = timeframes.includes(v);
      const active  = v === interval;
      const row = document.createElement('div');
      row.className = 'tf-row' + (enabled ? ' tf-enabled' : '') + (active ? ' tf-current' : '');
      row.dataset.v = v;
      row.innerHTML =
        `<span class="tf-check"><i class="fas fa-check"></i></span>` +
        `<span class="tf-row-label">${label}</span>` +
        (active ? `<i class="fas fa-circle tf-active-dot"></i>` : '');
      row.querySelector('.tf-check').addEventListener('click', (e) => {
        e.stopPropagation();
        if (enabled && timeframes.length > 1) {
          timeframes = timeframes.filter((x) => x !== v);
          if (interval === v) interval = timeframes[0];
        } else if (!enabled) {
          const order = CFG.ALL_INTERVALS.map(([x]) => x);
          timeframes = order.filter((x) => timeframes.includes(x) || x === v);
        }
        LS.setItem(STORE.timeframes, JSON.stringify(timeframes));
        buildIntervalSeg();
      });
      row.addEventListener('click', () => {
        if (!timeframes.includes(v)) {
          const order = CFG.ALL_INTERVALS.map(([x]) => x);
          timeframes = order.filter((x) => timeframes.includes(x) || x === v);
          LS.setItem(STORE.timeframes, JSON.stringify(timeframes));
        }
        const prev = interval;
        interval = v;
        buildIntervalSeg();
        closeTfMenu();
        if (interval !== prev) {
          const anchorTime = (replayMode && candles[Replay.cutIndex]) ? candles[Replay.cutIndex].time : null;
          load(anchorTime);
        }
      });
      menu.appendChild(row);
    });
  }

  function closeTfMenu() {
    $('tfMenu').classList.remove('open');
    $('tfPicker').classList.remove('open');
  }

  $('tfManageBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = $('tfMenu').classList.toggle('open');
    $('tfPicker').classList.toggle('open', open);
    if (open) document.dispatchEvent(new CustomEvent('cr:menu-open', { detail: 'tf' }));
  });
  document.addEventListener('click', closeTfMenu);
  document.addEventListener('cr:menu-open', (e) => { if (e.detail !== 'tf') closeTfMenu(); });

  // max candles (persisted; defaults to the largest = most history)
  CFG.MAX_CANDLES.forEach((n) => $('maxCandles').add(new Option(String(n), n)));
  const savedMax = startupDefaults.maxCandles || LS.getItem(STORE.maxCandles);
  $('maxCandles').value = savedMax && CFG.MAX_CANDLES.includes(+savedMax)
    ? String(savedMax) : String(CFG.DEFAULTS.maxCandles);

  CFG.SPEEDS.forEach((s) => $('speed').add(new Option(s + 'x', s)));
  // Restore saved replay speed
  const savedSpeed = LS.getItem(STORE.replaySpeed);
  if (savedSpeed && CFG.SPEEDS.includes(+savedSpeed)) {
    $('speed').value = savedSpeed;
    Replay.setSpeed(+savedSpeed);
  }
  // Restore saved formation mode
  const savedMode = LS.getItem(STORE.replayMode);
  if (savedMode) {
    const opt = $('fmMenu').querySelector(`[data-v="${savedMode}"]`);
    if (opt) {
      $('fmMenu').querySelectorAll('.fm-opt').forEach((x) => x.classList.toggle('fm-active', x === opt));
      $('fmLabel').textContent = opt.textContent.split('—')[0].trim();
      Replay.setMode(savedMode);
    }
  }

  // ---- chart + indicators + drawings init ----
  ChartView.create($('chart'));
  const lwChart   = ChartView.getChart();
  const chartHost = $('chartHost');

  // ---- price-axis zoom: wheel-over-axis only ---------------------------
  // Scales the right price scale (via ChartView.nudgePriceZoom) when the wheel is
  // used over the price axis; over the chart body the native time-zoom runs.
  function priceAxisLeftX() {
    let w = 64;
    try { w = lwChart.priceScale('right').width() || w; } catch {}
    return chartHost.getBoundingClientRect().right - w;
  }
  function overPriceAxis(clientX) { return clientX >= priceAxisLeftX(); }

  chartHost.addEventListener('wheel', (e) => {
    if (!overPriceAxis(e.clientX)) return;            // only over the price axis
    e.preventDefault(); e.stopPropagation();
    ChartView.nudgePriceZoom(e.deltaY);
  }, { passive: false, capture: true });

  // Price-axis drag — vertical pan (drag the right axis up/down).
  // axisPressedMouseMove.price is disabled so the native stretch can't fight us.
  let priceAxisDragging = false;
  let lastPriceDragY = 0;
  chartHost.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !overPriceAxis(e.clientX)) return;
    // Ignore mousedowns that originate on a floating widget/overlay (trade sim,
    // toolbar, legend, etc.) — those are siblings of #chart inside #chartHost and
    // must never pan the chart while being dragged/clicked.
    if (!e.target.closest('#chart')) return;
    priceAxisDragging = true;
    lastPriceDragY = e.clientY;
    e.preventDefault(); e.stopPropagation();
    chartHost.style.cursor = 'ns-resize';
  }, { capture: true });

  // Chart-body drag — vertical pan while dragging anywhere on the chart area.
  // We DON'T preventDefault so LightweightCharts' native horizontal scroll still
  // works; we just layer vertical price pan on top of it.
  // The drawing overlay captures events when a tool is active or a drawing is
  // hovered, so this handler won't fire during drawing interactions (no conflict).
  let chartBodyDragging = false;
  let lastBodyDragY = 0;
  chartHost.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || overPriceAxis(e.clientX)) return; // axis handled above
    if (!e.target.closest('#chart')) return; // widget/overlay drags must not pan the chart
    chartBodyDragging = true;
    lastBodyDragY = e.clientY;
    // no preventDefault — let native horizontal time-scroll run in parallel
  });

  window.addEventListener('mousemove', (e) => {
    if (priceAxisDragging) {
      const dy = e.clientY - lastPriceDragY;
      lastPriceDragY = e.clientY;
      if (dy !== 0) ChartView.panPrice(dy);
    }
    if (chartBodyDragging) {
      const dy = e.clientY - lastBodyDragY;
      lastBodyDragY = e.clientY;
      if (dy !== 0) ChartView.panPrice(dy);
    }
  });
  window.addEventListener('mouseup', () => {
    if (priceAxisDragging) { priceAxisDragging = false; chartHost.style.cursor = ''; }
    chartBodyDragging = false;
  });

  // FVG must init before IndicatorManager: restoring a saved indicator set can
  // activate the FVG layer, which renders to FVGIndicator's canvas — so its
  // context has to exist first, or render() throws and aborts the rest of init.
  FVGIndicator.init(lwChart, ChartView.getCandleSeries(), chartHost);
  StrategyOverlay.init(lwChart, ChartView.getCandleSeries(), chartHost);
  IndicatorManager.init({
    chart: lwChart,
    button: $('indicatorsBtn'),
    badge: $('indBadge'),
    chartHost: chartHost,
    getVisibleCandles: () => replayMode ? candles.slice(0, Replay.cutIndex + 1) : candles,
  });
  Drawings.init(lwChart, ChartView.getCandleSeries(), chartHost);
  Drawings.loadDrawings();
  // Volume highlight: applied in setSlice so replay frames also get colored candles.
  ChartView.setSliceTransform((c) => FVGIndicator.applyVolColors(c));
  // Re-render drawings after every price-axis pan/zoom repaint so they never lag.
  ChartView.onPriceRangeChange(() => { Drawings.render(); FVGIndicator.render(); StrategyOverlay.render(); });
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
    onWatchReplay: (spec) => watchReplay(spec),
  });

  let tradeMode = 'game'; // 'game' | 'strategy'

  // ---- candle style / chart type (persisted) ----------------------------------------
  // Live last-used value wins; the saved-defaults blob is only a fallback, so the
  // candle type you pick (e.g. Heikin Ashi) persists across reloads and to the cloud.
  let candleStyle = LS.getItem(STORE.candleStyle) ||
    startupDefaults.candleStyle || CFG.DEFAULTS.candleStyle;
  let chartType = LS.getItem(STORE.chartType) ||
    startupDefaults.chartType || 'candlestick';
  applyChartType(chartType);   // sets the chart type + matching button icon + active menu item
  // custom per-direction colors (override the named style when set)
  let candleUp   = LS.getItem(STORE.candleUp)   || null;
  let candleDown = LS.getItem(STORE.candleDown) || null;

  function applyCandleStyle(name) {
    candleStyle = name;
    ChartView.setCandleStyle(name);
    LS.setItem(STORE.candleStyle, name);
    // update theme buttons in settings panel (built later; guard with ?.)
    settingsPanel.querySelectorAll('.st-theme-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.style === name));
  }
  // Icon shown on the chart-type button — swapped to match the active type so the
  // current view (Candlestick / Heikin Ashi / Line) is obvious at a glance.
  function candleStyleIconSVG(type) {
    if (type === 'line') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<path d="M3 16l5-5 4 3 6-8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (type === 'heiken_ashi') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
        '<rect x="5" y="7" width="4" height="10" rx="1" fill="currentColor"/><path d="M7 4v3M7 17v3"/>' +
        '<rect x="15" y="5" width="4" height="9" rx="1" fill="currentColor"/><path d="M17 2v3M17 14v3"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
      '<rect x="5" y="7" width="4" height="10" rx="1"/><path d="M7 4v3M7 17v3"/>' +
      '<rect x="15" y="5" width="4" height="9" rx="1"/><path d="M17 2v3M17 14v3"/></svg>';
  }
  function applyChartType(type) {
    chartType = type;
    ChartView.setChartType(type);
    LS.setItem(STORE.chartType, type);
    $('candleStyleBtn').innerHTML = candleStyleIconSVG(type);
    $('candleStyleMenu').querySelectorAll('.menu-item').forEach((b) =>
      b.classList.toggle('active', b.dataset.style === type));
    // Re-render current data with new transform
    if (candles && candles.length) {
      ChartView.setSlice(candles);
      IndicatorManager.recompute(candles, intervalToSeconds(interval));
    }
  }
  function applyCandleColors() {
    if (candleUp || candleDown) {
      ChartView.setCandleColors(candleUp || CFG.THEME.up, candleDown || CFG.THEME.down);
    }
  }

  $('candleStyleBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = $('candleStyleMenu').classList.toggle('open');
    if (open) document.dispatchEvent(new CustomEvent('cr:menu-open', { detail: 'candle' }));
  });
  $('candleStyleMenu').addEventListener('click', (e) => {
    const b = e.target.closest('.menu-item'); if (!b) return;
    applyChartType(b.dataset.style);
    $('candleStyleMenu').classList.remove('open');
  });
  document.addEventListener('click', () => $('candleStyleMenu').classList.remove('open'));
  document.addEventListener('cr:menu-open', (e) => { if (e.detail !== 'candle') $('candleStyleMenu').classList.remove('open'); });

  // ---- canvas settings (grid, colors, candles, timeframes, persisted) --
  const stBg      = LS.getItem(STORE.bg);
  const stGridV   = LS.getItem(STORE.grid);       // 'true' | 'false' | null
  const stGridC   = LS.getItem(STORE.gridColor);
  const stDLabels = LS.getItem(STORE.drawLabels); // 'true' | 'false' | null (default true)
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
    `<div class="st-title">Candle theme</div>` +
    `<div class="st-row st-theme-row">` +
      `<button class="st-theme-btn" data-style="mono">Monochrome</button>` +
      `<button class="st-theme-btn" data-style="classic">Classic</button>` +
    `</div>` +
    `<div class="st-title">Candle colors</div>` +
    `<label class="st-row"><span>Bullish</span><input type="color" id="stUp"></label>` +
    `<label class="st-row"><span>Bearish</span><input type="color" id="stDown"></label>` +
    `<div class="st-title">Drawings</div>` +
    `<label class="st-row"><span>Show price labels</span><input type="checkbox" id="stDrawLabels"></label>` +
    `<div class="st-sep"></div>` +
    `<button class="st-save" id="stSave">Save current as defaults</button>`;
  document.body.appendChild(settingsPanel);
  settingsPanel.addEventListener('click', (e) => e.stopPropagation());

  const initDrawLabels = stDLabels == null ? true : stDLabels === 'true';
  $('stGrid').checked       = stGridV == null ? false : stGridV === 'true';
  $('stBg').value           = stBg    || CFG.THEME.bg;
  $('stGridColor').value    = stGridC || CFG.THEME.border;
  $('stUp').value           = candleUp   || CFG.THEME.up;
  $('stDown').value         = candleDown || CFG.THEME.down;
  $('stDrawLabels').checked = initDrawLabels;
  Drawings.setShowLabels(initDrawLabels);

  // init candle theme buttons
  settingsPanel.querySelectorAll('.st-theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.style === candleStyle);
    btn.onclick = () => {
      candleUp = null; candleDown = null;
      LS.removeItem(STORE.candleUp); LS.removeItem(STORE.candleDown);
      $('stUp').value   = CFG.THEME.up;
      $('stDown').value = CFG.THEME.down;
      applyCandleStyle(btn.dataset.style);
    };
  });

  $('stGrid').onchange = (e) => {
    ChartView.setGridVisible(e.target.checked);
    LS.setItem(STORE.grid, String(e.target.checked));
  };
  $('stDrawLabels').onchange = (e) => {
    Drawings.setShowLabels(e.target.checked);
    LS.setItem(STORE.drawLabels, String(e.target.checked));
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
  $('stSave').onclick = () => {
    const blob = { symbol: $('symbol').value, interval,
      maxCandles: $('maxCandles').value, candleStyle, chartType };
    LS.setItem(STORE.defaults, JSON.stringify(blob));
    const btn = $('stSave'); const t = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Saved'; setTimeout(() => { btn.innerHTML = t; }, 1200);
  };

  $('settingsBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = settingsPanel.classList.toggle('open');
    if (open) {
      document.dispatchEvent(new CustomEvent('cr:menu-open', { detail: 'settings' }));
      const r = $('settingsBtn').getBoundingClientRect();
      settingsPanel.style.left = Math.min(r.left, window.innerWidth - 230) + 'px';
      settingsPanel.style.top = (r.bottom + 4) + 'px';
    }
  });
  document.addEventListener('click', () => settingsPanel.classList.remove('open'));
  document.addEventListener('cr:menu-open', (e) => { if (e.detail !== 'settings') settingsPanel.classList.remove('open'); });

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
  // ---- chart loading overlay -------------------------------------------
  function showLoader(text) {
    const el = $('chartLoader'); if (!el) return;
    setLoaderText(text);
    el.hidden = false;
    chartHost.classList.add('loading');
  }
  function setLoaderText(text) {
    const t = $('chartLoaderText'); if (t && text) t.textContent = text;
  }
  function hideLoader() {
    const el = $('chartLoader'); if (!el) return;
    el.hidden = true;
    chartHost.classList.remove('loading');
  }

  // Center the replay view on a play-head logical index, showing a readable
  // window of recent candles with a little breathing room on the right.
  function recenterReplay(head, span = 160) {
    lwChart.priceScale('right').applyOptions({ autoScale: true });
    lwChart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, head - span),
      to: head + 8,
    });
  }

  async function load(anchorTime) {
    const symbol = $('symbol').value;
    const max    = parseInt($('maxCandles').value);

    // Remember the current pair + timeframe (SettingsSync mirrors these to the DB),
    // so returning to the app restores the same chart.
    LS.setItem(STORE.symbol, symbol);
    LS.setItem(STORE.interval, interval);

    // Synchronous cache peek: if data is already in memory we never show a
    // loading indicator and the chart swap is imperceptible to the user.
    const hot = peekCandleCache(symbol, interval, max);

    // Save the currently visible time range so we can restore it after the
    // data swap — this keeps the chart anchored to the same price history
    // across timeframe changes (TradingView-style smooth switching).
    const savedRange = (!firstLoad && !replayMode)
      ? lwChart.timeScale().getVisibleRange()
      : null;

    // Only surface the loading overlay for a real fetch — a hot cache hit swaps
    // instantly and any flash of a spinner would just be noise.
    if (!hot) showLoader(`Loading ${symbol} ${interval}…`);

    const onProgress = (page, pages) => {
      const msg = pages > 1 ? `Loading… page ${page} / ${pages}` : 'Loading…';
      $('status').textContent = msg; setLoaderText(msg);
    };

    try {
      candles = hot || await fetchCandles(symbol, interval, max, onProgress);
      $('status').textContent = `${candles.length} candles · ${hot ? 'cached' : 'Bybit live'}`;
    } catch {
      candles = syntheticCandles(symbol, interval, max);
      $('status').textContent = `${candles.length} candles · offline sample`;
    } finally {
      hideLoader();
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
      Replay.load(candles, cutIdx);
      // Re-anchor the view on the current play head. Without this the time scale
      // keeps the old timeframe's logical range and the freshly-sliced data lands
      // off-screen — the chart looks "missing" after a TF change or refresh.
      recenterReplay(Replay.cutIndex);
    } else {
      ChartView.setSlice(candles);
      IndicatorManager.recompute(candles, intervalToSeconds(interval));
      ChartView.setCursor(null);
      if (firstLoad) {
        lwChart.timeScale().fitContent();
      } else if (savedRange) {
        // Restore the exact time window the user was looking at.
        // LightweightCharts clips to available data automatically so we never
        // end up with a blank chart even if the range is partially out of bounds.
        lwChart.timeScale().setVisibleRange(savedRange);
      }
    }
    firstLoad = false;
    applyCandleStyle(candleStyle);
    applyCandleColors();
    Drawings.render();
  }

  // ---- replay arming + mode ---------------------------------------------
  // 1) click Replay → scissors cursor, chart stays full + interactive
  // 2) double-click a candle → that candle becomes the replay start
  function armReplay(forStrategy) {
    if (!candles.length || replayMode) return;
    setTradeMode(forStrategy ? 'strategy' : 'game'); // top-bar Replay = Game; Chart Backtest = Strategy
    replayArming = true;
    Drawings.setTool('cursor');          // let the chart receive the dbl-click
    chartHost.classList.add('cutting');
    $('strategyBtn').style.display = 'none';
    $('replayBtn').classList.add('active');
    $('replayBtn').textContent = '✕ Cancel';
  }
  function cancelArming() {
    replayArming = false;
    chartHost.classList.remove('cutting');
    $('strategyBtn').style.display = '';
    $('replayBtn').classList.remove('active');
    $('replayBtn').textContent = 'Replay';
  }

  function enterReplayMode(cutIdx) {
    if (!candles.length) return;
    replayArming = false;
    chartHost.classList.remove('cutting');
    replayMode = true;
    document.body.classList.add('replay-mode');
    $('strategyBtn').style.display = 'none';
    $('replayBtn').classList.add('active');
    $('replayBtn').textContent = '✕ Exit Replay';
    const idx = (cutIdx != null)
      ? Math.max(1, Math.min(candles.length - 2, cutIdx))
      : Math.max(1, Math.min(candles.length - 2, Math.floor(candles.length * 0.55)));
    lastCut = idx;
    // Keep the user's current pan/zoom on entry — don't snap the view. Price stays
    // on auto-fit unless the user set a manual range (preserved by the candle
    // series autoscaleInfoProvider); Replay.load → setSlice keeps bar spacing.
    lwChart.priceScale('right').applyOptions({ autoScale: true });
    Replay.load(candles, idx);
    TradeSim.setMode(tradeMode);
    TradeSim.start(candles[Replay.cutIndex].close);
    TradeSim.playReplayStartSound();
    if (tradeMode === 'strategy') {
      StrategyMode.onEnterReplay();
      // Focus a readable candle window near the start so revealed candles render as
      // candlesticks (not a compressed, graph-like blob). Applies to both the preset
      // and manual-cut Chart Backtest paths.
      const from = Math.max(0, Replay.cutIndex - 160);
      lwChart.timeScale().setVisibleLogicalRange({ from, to: Replay.cutIndex + 8 });
    }
  }

  function exitReplayMode(showSummary) {
    Replay.pause();
    StrategyMode.onExitReplay();   // restore the user's indicators before repainting full data
    replayMode = false;
    replayArming = false;
    document.body.classList.remove('replay-mode');
    chartHost.classList.remove('cutting');
    $('strategyBtn').style.display = '';
    $('replayBtn').classList.remove('active');
    $('replayBtn').textContent = 'Replay';
    // un-freeze the price scale (cut had locked it) and return to auto-fit
    lwChart.priceScale('right').applyOptions({ autoScale: true });
    ChartView.resetPriceZoom(); // clears manual range + restores base margins
    ChartView.setSlice(candles);
    IndicatorManager.recompute(candles, intervalToSeconds(interval));
    ChartView.setCursor(null);
    applyCandleStyle(candleStyle);
    applyCandleColors();
    Drawings.render();
    TradeSim.playReplayExitSound();
    TradeSim.stop(showSummary);
  }

  $('replayBtn').onclick = () => {
    if (replayMode) exitReplayMode(true);
    else if (replayArming) cancelArming();
    else armReplay();
  };
  $('exitReplayBtn').onclick = () => exitReplayMode(true);

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
  // Chart Backtest (Strategy → select → Chart Backtest) is always pure Strategy mode.
  // The strategy runs live over the revealed candles — no prior backtest required.
  // `spec`: { type:'preset', range:'1w'|'1m'|'3m'|'1y' } | { type:'manual' }.
  // The readable candle window is applied inside enterReplayMode for strategy mode.
  const RANGE_SECS = { '1w': 7 * 86400, '1m': 30 * 86400, '3m': 90 * 86400, '1y': 365 * 86400 };
  function cutForRange(rangeSecs) {
    if (!candles.length) return 1;
    const target = candles[candles.length - 1].time - rangeSecs;
    let idx = 1;
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].time >= target) { idx = i; break; }
    }
    return Math.max(1, Math.min(candles.length - 2, idx));
  }
  function watchReplay(spec) {
    spec = spec || { type: 'preset', range: '3m' };
    if (spec.type === 'manual') {
      armReplay(true);   // arm for a strategy-mode manual cut (double-click the chart)
      return;
    }
    setTradeMode('strategy');
    const secs = spec.rangeSecs || RANGE_SECS[spec.range] || RANGE_SECS['3m'];
    enterReplayMode(cutForRange(secs));
  }

  // ---- replay state → UI -----------------------------------------------
  Replay.on('state', (st) => {
    $('playIcon').innerHTML = st.playing
      ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
    const pill = $('livePill');
    pill.textContent = st.atEnd ? 'end' : st.playing ? 'live' : 'paused';
    pill.classList.toggle('live', st.playing);
  });
  // True when the newest revealed candle sits right at the leading edge of the
  // viewport (within the chart's fixed rightOffset gap), i.e. the user is watching
  // the tape. Both bounds matter: the lower bound excludes panning left into
  // history; the upper bound excludes a zoomed-out / blank-future view where the
  // newest candle is still far from the right edge. Bar-spacing-independent.
  function atRightEdge() {
    const r = lwChart.timeScale().getVisibleLogicalRange();
    if (!r) return true;
    const cut = Replay.cutIndex;
    return r.to >= cut - 1 && r.to <= cut + 20;   // newest bar parked at the right (rightOffset ≈ 6)
  }

  // re-project drawings + feed live price to the trade sim on every revealed tick
  Replay.on('tick', (p) => {
    Drawings.render();
    if (p && p.candle) TradeSim.onTick(p.candle.close);
    StrategyMode.onTick(p);   // no-op unless strategy mode + watching replay
    // follow the leading edge only if the user is already viewing it — otherwise
    // leave their pan/zoom exactly where they put it (no edge-snapping)
    if (replayMode && p && !p.forming && atRightEdge()) ChartView.scrollToRealtime();
  });
  Replay.on('end', () => exitReplayMode(true));

  // ---- transport controls ----------------------------------------------
  $('playBtn').onclick   = () => Replay.toggle();
  $('stepBtn').onclick   = () => Replay.step();
  $('rewindBtn').onclick = () => Replay.rewind();
  $('speed').onchange    = (e) => { Replay.setSpeed(parseFloat(e.target.value)); LS.setItem(STORE.replaySpeed, e.target.value); };

  // ---- Formation dropup ---------------------------------------------------
  (function () {
    const picker = $('fmPicker');
    const btn    = $('fmBtn');
    const menu   = $('fmMenu');
    const label  = $('fmLabel');

    // Position the fixed dropup above the button, right-aligned (flips below if there
    // isn't room above). Runs after .open makes it measurable.
    function positionMenu() {
      const r = btn.getBoundingClientRect();
      const mh = menu.offsetHeight, mw = menu.offsetWidth;
      let left = Math.max(8, r.right - mw);
      let top = r.top - mh - 4;
      if (top < 8) top = r.bottom + 4; // no room above → drop down instead
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('open');
      if (open) { positionMenu(); document.dispatchEvent(new CustomEvent('cr:menu-open', { detail: 'formation' })); }
    });
    window.addEventListener('resize', () => { if (menu.classList.contains('open')) positionMenu(); });
    menu.addEventListener('click', (e) => {
      const opt = e.target.closest('.fm-opt'); if (!opt) return;
      menu.querySelectorAll('.fm-opt').forEach((x) => x.classList.toggle('fm-active', x === opt));
      label.textContent = opt.textContent.split('—')[0].trim();
      Replay.setMode(opt.dataset.v);
      LS.setItem(STORE.replayMode, opt.dataset.v);
      menu.classList.remove('open');
    });
    document.addEventListener('click', () => menu.classList.remove('open'));
    document.addEventListener('cr:menu-open', (e) => { if (e.detail !== 'formation') menu.classList.remove('open'); });
  })();

  // ---- chart refresh — repaint + reset to a clean fitted view -----------
  // Re-fits the time scale and re-enables price auto-scale so a squeezed /
  // over-stretched chart returns to normal (TradingView-style refresh).
  function refreshChart() {
    clearCandleCache($('symbol').value, interval, parseInt($('maxCandles').value));
    if (replayMode) {
      // full reload for fresh data, but keep the current play head centered
      const anchorTime = candles[Replay.cutIndex] ? candles[Replay.cutIndex].time : null;
      load(anchorTime);
      return;
    }
    ChartView.setSlice(candles); IndicatorManager.recompute(candles, intervalToSeconds(interval));
    applyCandleStyle(candleStyle);
    applyCandleColors();
    Drawings.render();
    ChartView.resetPriceZoom();
    lwChart.priceScale('right').applyOptions({ autoScale: true });
    lwChart.timeScale().fitContent();
  }
  $('refreshBtn').onclick = refreshChart;

  // ---- right-click context menu ----------------------------------------
  // Right-clicking a drawing selects it and shows an edit section (color +
  // thickness); right-clicking empty space shows the global remove-all actions.
  const ctxMenu = $('ctxMenu');
  function buildCtxMenu() {
    const sel = Drawings.getSelected();
    let html = '';
    if (sel) {
      html +=
        `<div class="ctx-edit">` +
          `<label class="ctx-color"><span>Color</span>` +
            `<input type="color" id="ctxColor" value="${sel.color}"></label>` +
          `<div class="ctx-thick">` +
            CFG.DRAW_WIDTHS.map((w) =>
              `<button class="ctx-w${w === sel.width ? ' active' : ''}" data-w="${w}">${w}px</button>`).join('') +
          `</div>` +
        `</div>` +
        `<div class="ctx-sep"></div>` +
        `<button class="ctx-item" data-act="delSel">Delete Selected</button>` +
        `<div class="ctx-sep"></div>`;
    }
    html +=
      `<button class="ctx-item" data-act="delDraw"${Drawings.count ? '' : ' disabled'}>Remove All Drawings</button>` +
      `<button class="ctx-item" data-act="delInd"${IndicatorManager.count ? '' : ' disabled'}>Remove All Indicators</button>`;
    ctxMenu.innerHTML = html;
    const colorInput = ctxMenu.querySelector('#ctxColor');
    if (colorInput) colorInput.oninput = (ev) => Drawings.setSelectedColor(ev.target.value);
  }
  chartHost.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    Drawings.selectAt(e.clientX, e.clientY);   // select the drawing under the cursor (if any)
    buildCtxMenu();
    ctxMenu.classList.add('open');
    ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
    ctxMenu.style.top  = Math.min(e.clientY, window.innerHeight - 200) + 'px';
  });
  ctxMenu.addEventListener('click', (e) => {
    e.stopPropagation();                       // keep the menu open while editing
    const w = e.target.closest('.ctx-w');
    if (w) {
      Drawings.setSelectedWidth(parseInt(w.dataset.w));
      ctxMenu.querySelectorAll('.ctx-w').forEach((x) => x.classList.toggle('active', x === w));
      return;
    }
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

  // ---- floating toolbar drag -------------------------------------------
  (function () {
    const ft = $('toolbar');
    const grip = $('ftGrip');
    let dragging = false, offX = 0, offY = 0;
    grip.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      const r = ft.getBoundingClientRect();
      offX = e.clientX - r.left; offY = e.clientY - r.top;
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const hr = chartHost.getBoundingClientRect();
      let nx = e.clientX - hr.left - offX;
      let ny = e.clientY - hr.top  - offY;
      nx = Math.max(0, Math.min(hr.width  - ft.offsetWidth,  nx));
      ny = Math.max(0, Math.min(hr.height - ft.offsetHeight, ny));
      ft.style.left = nx + 'px'; ft.style.top = ny + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  })();

  // ---- drawing toolbar (side dock + floating favorites widget) ---------
  DrawToolbar.init((tool) => Drawings.setTool(tool));
  Drawings.onTool((t) => {
    DrawToolbar.setActive(t);
    $('drawInfo').textContent = t === 'cursor' ? '' : `Drawing: ${t}`;
  });
  $('clearBtn').onclick = () => Drawings.clearAll();
  function toggleToolbar() {
    document.body.classList.toggle('no-toolbar');
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
  $('toolbarCollapseBtn').onclick = toggleToolbar;
  $('toolbarExpandBtn').onclick   = toggleToolbar;

  // ---- cloud save indicator --------------------------------------------
  // Reflects SettingsSync state (workspace mirrored to Supabase): green outline when
  // saved, dim/amber while unsaved/syncing. Clicking forces an immediate save.
  (function () {
    const btn = $('cloudStatus');
    if (!btn || !window.SettingsSync) { if (btn) btn.style.display = 'none'; return; }
    const TITLES = { saved: 'Saved to cloud', dirty: 'Unsaved changes — click to save',
      saving: 'Saving…', error: 'Save failed — click to retry' };
    // SVG variants: cloud shape with a badge (checkmark, X, or plain for saving).
    const CLOUD_BASE = 'M7 16a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.6-1.4A4 4 0 0 1 17 16H7z';
    // Badge sits at upper-right of the cloud (circle centred at 19,5 r=4).
    const BADGE_CHECK = `<circle cx="19" cy="5" r="4" fill="#22c55e" stroke="none"/><path d="M17 5l1.5 1.5 3-3" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    const BADGE_X     = `<circle cx="19" cy="5" r="4" fill="#ef5350" stroke="none"/><path d="M17.5 3.5l3 3M20.5 3.5l-3 3" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`;
    const SVGS = {
      saved:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${CLOUD_BASE}"/>${BADGE_CHECK}</svg>`,
      dirty:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${CLOUD_BASE}"/>${BADGE_X}</svg>`,
      saving: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${CLOUD_BASE}"/></svg>`,
      error:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${CLOUD_BASE}"/>${BADGE_X}</svg>`,
    };
    SettingsSync.onStatus((s) => {
      btn.classList.remove('cs-saved', 'cs-dirty', 'cs-saving', 'cs-error');
      btn.classList.add('cs-' + s);
      btn.title = TITLES[s] || 'Cloud save';
      btn.innerHTML = SVGS[s] || SVGS.saving;
    });
    btn.onclick = () => SettingsSync.saveNow();
  })();

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

  // ---- Data page nav ---------------------------------------------------
  $('dataBtn').onclick = () => {
    if (replayMode) exitReplayMode(false);
    DataPage.show();
  };
  $('dataBackBtn').onclick = () => DataPage.hide();

  // ---- initial load ----------------------------------------------------
  load();
})();
