// app.js — wires controls, data, chart, replay, indicators, and drawing tools

(function () {
  let candles = [];
  let replayMode = false;     // true once a cut point is committed
  let replayArming = false;   // true after Replay clicked, before double-click
  let firstLoad = true;       // fitContent only once — never on later UI actions
  let lastCut = null;         // remembered cut for Play Again / mode switch
  let interval = CFG.DEFAULTS.interval;
  let candlesInterval = null; // interval the current `candles` array was loaded at
  let loadedSymbol = null;    // symbol the current `candles` array belongs to
  let anchoredData = false;   // candles = a history window around the replay point, not "latest"
  let loadSeq = 0;            // newest load wins (rapid TF clicks can't apply out of order)
  let resumeReplay = false;   // replay was playing when a reload started -> resume when it lands

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
  // drawings used to live under one global key — they belong to whichever symbol
  // the app opened on before this version (saved default, else the old ETH default)
  const legacyDrawingsOwner = startupDefaults.symbol || 'ETHUSDT';
  // one-time: SOL becomes the default chart, even over a previously saved default
  if (LS.getItem(STORE.defaultSymbolV) !== '1') {
    if (startupDefaults.symbol) {
      startupDefaults.symbol = CFG.DEFAULTS.symbol;
      LS.setItem(STORE.defaults, JSON.stringify(startupDefaults));
    }
    LS.setItem(STORE.defaultSymbolV, '1');
  }

  // ---- populate controls ----
  CFG.SYMBOLS.forEach((s) => $('symbol').add(new Option(s, s)));
  $('symbol').value = startupDefaults.symbol && CFG.SYMBOLS.includes(startupDefaults.symbol)
    ? startupDefaults.symbol : CFG.DEFAULTS.symbol;

  // timeframe list is user-customizable (persisted)
  const TF_LABEL = new Map(CFG.ALL_INTERVALS);                        // value -> label
  const TF_VALUE = new Map(CFG.ALL_INTERVALS.map(([v, l]) => [l, v])); // label -> value
  let timeframes = loadTimeframes();
  if (!timeframes.includes(interval)) interval = timeframes[0];
  CandleStore.setTimeframes(timeframes); // only enabled TFs are downloaded + kept on-device
  buildIntervalSeg();

  // Enabled TF set changed: persist it, drop stored data of disabled TFs and
  // download any newly enabled one in the background.
  function saveTimeframes() {
    LS.setItem(STORE.timeframes, JSON.stringify(timeframes));
    CandleStore.setTimeframes(timeframes);
    if (loadedSymbol) schedulePrefetch(loadedSymbol, interval, parseInt($('maxCandles').value));
  }

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
        switchInterval(v);
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
        saveTimeframes();
        buildIntervalSeg();
      });
      row.addEventListener('click', () => {
        if (!timeframes.includes(v)) {
          const order = CFG.ALL_INTERVALS.map(([x]) => x);
          timeframes = order.filter((x) => timeframes.includes(x) || x === v);
          saveTimeframes();
        }
        switchInterval(v);
      });
      menu.appendChild(row);
    });
  }

  // Timeframe switch — same flow in and out of replay; load() keeps the view
  // (or the replay position) anchored in time across the swap.
  function switchInterval(v) {
    closeTfMenu();
    if (v === interval) return;
    interval = v;
    buildIntervalSeg();
    load();
  }

  function closeTfMenu() {
    $('tfMenu').classList.remove('open');
    $('tfPicker').classList.remove('open');
  }

  $('tfManageBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = $('tfMenu').classList.toggle('open');
    $('tfPicker').classList.toggle('open', open);
  });
  document.addEventListener('click', closeTfMenu);

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

  IndicatorManager.init({
    chart: lwChart,
    button: $('indicatorsBtn'),
    badge: $('indBadge'),
    chartHost: chartHost,
    getVisibleCandles: () => replayMode ? candles.slice(0, Replay.cutIndex + 1) : candles,
  });
  Drawings.init(lwChart, ChartView.getCandleSeries(), chartHost);
  Drawings.migrateLegacy(legacyDrawingsOwner);
  Drawings.migrateToPerp();
  Drawings.setSymbol($('symbol').value);
  FVGIndicator.init(lwChart, ChartView.getCandleSeries(), chartHost);
  // Volume highlight: applied in setSlice so replay frames also get colored candles.
  ChartView.setSliceTransform((c) => FVGIndicator.applyVolColors(c));
  // Re-render drawings after every price-axis pan/zoom repaint so they never lag.
  ChartView.onPriceRangeChange(() => { Drawings.render(); FVGIndicator.render(); });
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

  // ---- candle style / chart type (persisted) ----------------------------------------
  let candleStyle = startupDefaults.candleStyle ||
    LS.getItem(STORE.candleStyle) || CFG.DEFAULTS.candleStyle;
  let chartType = startupDefaults.chartType ||
    LS.getItem(STORE.chartType) || 'candlestick';
  applyChartType(chartType);
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
  function applyChartType(type) {
    chartType = type;
    ChartView.setChartType(type);
    LS.setItem(STORE.chartType, type);
    $('candleStyleMenu').querySelectorAll('.menu-item').forEach((b) =>
      b.classList.toggle('active', b.dataset.style === type));
    // Re-render current data with new transform
    if (candles && candles.length) {
      if (replayMode) Replay.rerender();   // never reveal the hidden future
      else {
        ChartView.setSlice(candles);
        IndicatorManager.recompute(candles, intervalToSeconds(candlesInterval || interval));
      }
    }
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
    applyChartType(b.dataset.style);
    $('candleStyleMenu').classList.remove('open');
  });
  document.addEventListener('click', () => $('candleStyleMenu').classList.remove('open'));

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
    `<div class="st-title">Data</div>` +
    `<label class="st-row"><span>Auto-update on open</span><input type="checkbox" id="stAutoUpdate"></label>` +
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
  $('stAutoUpdate').checked = isAutoUpdate();
  $('stAutoUpdate').onchange = (e) => { setAutoUpdate(e.target.checked); };
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
  // last index with arr[i].time <= t (-1 if none)
  function timeToIndex(arr, t) {
    let lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (arr[m].time <= t) { ans = m; lo = m + 1; } else hi = m - 1;
    }
    return ans;
  }

  // Where the user is looking, expressed in time (survives a TF / symbol swap).
  function captureView(arr, sec) {
    const lr = lwChart.timeScale().getVisibleLogicalRange();
    if (!lr || !arr.length) return null;
    const last = arr.length - 1;
    const c = Math.round((lr.from + lr.to) / 2);
    const centerTime = c < 0 ? arr[0].time + c * sec
      : c > last ? arr[last].time + (c - last) * sec : arr[c].time;
    return { bars: lr.to - lr.from, atEdge: lr.to >= last, rightPad: lr.to - last, centerTime };
  }

  // Re-apply a captured view to the current `candles`, keeping the bar count
  // (= zoom level) and clamping so there is always data on screen.
  function restoreView(v) {
    const last = candles.length - 1;
    if (last < 0) return;
    if (!v) { ChartView.resetView(last); return; }
    const bars = Math.max(10, v.bars);
    let ci = timeToIndex(candles, v.centerTime);
    if (v.atEdge || ci >= last) {
      const pad = Math.max(2, Math.min(v.rightPad, bars * 0.5));
      ChartView.setLogicalRange(last + pad - bars, last + pad);
      return;
    }
    if (ci < 0) ci = 0;
    const from = Math.max(ci - bars / 2, -bars * 0.1); // don't leave the left side empty
    ChartView.setLogicalRange(from, from + bars);
  }

  // Replay clock = close time of the newest information already revealed.
  function replayClock(arr, sec) {
    if (Replay.partial) return Replay.partial.endTime;
    const c = arr[Replay.cutIndex];
    return c ? c.time + sec : null;
  }

  // Last bar fully closed by the clock (no lookahead).
  function replayCutFor(arr, sec, clock) {
    return Math.max(1, Math.min(arr.length - 2, timeToIndex(arr, clock - sec)));
  }

  // Switching UP a timeframe mid-replay: the bar that contains the clock is still
  // forming. Rebuild it from the lower-TF candles revealed so far (TradingView-style).
  function buildPartial(newArr, newSec, cut, clock, oldArr, oldSec, oldPartial) {
    const nb = newArr[cut + 1];
    if (!nb || newSec <= oldSec || nb.time >= clock) return null;
    if (!oldArr.length || oldArr[0].time > nb.time) return null; // lower TF doesn't reach the bar's open
    const parts = [];
    for (let i = timeToIndex(oldArr, nb.time - 1) + 1; i < oldArr.length; i++) {
      const c = oldArr[i];
      if (c.time >= nb.time + newSec || c.time + oldSec > clock) break;
      parts.push(c);
    }
    if (oldPartial && oldPartial.bar.time >= nb.time && oldPartial.bar.time < nb.time + newSec) {
      parts.push(oldPartial.bar);
    }
    if (!parts.length) return null;
    let high = -Infinity, low = Infinity, volume = 0;
    parts.forEach((c) => { high = Math.max(high, c.high); low = Math.min(low, c.low); volume += c.volume || 0; });
    return { bar: { time: nb.time, open: parts[0].open, high, low,
      close: parts[parts.length - 1].close, volume }, endTime: clock };
  }

  // opts.fit — reset to the default view after loading (Refresh button)
  // Centered loading spinner over the chart while candles are being fetched.
  const busyEl = document.createElement('div');
  busyEl.className = 'chart-busy';
  busyEl.innerHTML = '<div class="chart-busy-ring"></div><div class="chart-busy-txt"></div>';
  chartHost.appendChild(busyEl);
  function setBusy(on, text) {
    busyEl.classList.toggle('on', !!on);
    if (text != null) busyEl.querySelector('.chart-busy-txt').textContent = text;
  }

  async function load(opts = {}) {
    const seq = ++loadSeq;
    const symbol = $('symbol').value;
    const max    = parseInt($('maxCandles').value);
    const iv     = interval;
    const sec    = intervalToSeconds(iv);
    const prevCandles = candles;
    const prevSec     = intervalToSeconds(candlesInterval || iv);
    const sameSymbol  = symbol === loadedSymbol;

    // Capture where we are BEFORE any await — the swap is anchored to it.
    let view = null, clock = null, prevPartial = null;
    const prevBars = ChartView.visibleBars();
    if (replayMode && prevCandles.length) {
      if (Replay.state().playing) resumeReplay = true;
      Replay.pause();                       // don't advance old-TF data while loading
      prevPartial = Replay.partial;
      clock = replayClock(prevCandles, prevSec);
    } else if (!firstLoad && prevCandles.length && !opts.fit) {
      view = captureView(prevCandles, prevSec);
    }

    // Served from memory when cached/prefetched, else from the on-device copy
    // (stale is fine — the newest bars are revalidated below).
    let data = peekCandleCache(symbol, iv, max);
    let source = 'cached';
    if (!data && await hydrateCandles(symbol, iv, max)) {
      if (seq !== loadSeq) return;
      data = peekCandleCache(symbol, iv, max);
      source = 'saved';
    }
    const stale = !!data && !isCandleCacheFresh(symbol, iv, max);
    if (!data) {
      $('status').textContent = `Loading ${symbol} ${TF_LABEL.get(iv) || iv}…`;
      setBusy(true, `Loading ${symbol} ${TF_LABEL.get(iv) || iv}…`);
      const onProgress = (page, pages) => {
        if (seq !== loadSeq) return;
        $('status').textContent = pages > 1 ? `Loading… page ${page} / ${pages}` : 'Loading…';
        setBusy(true, pages > 1 ? `Loading… page ${page} / ${pages}` : null);
      };
      try {
        data = await fetchCandles(symbol, iv, max, onProgress);
        source = dataSourceName(symbol);
      } catch {
        data = syntheticCandles(symbol, iv, max);
        source = 'offline sample';
      }
      if (seq !== loadSeq) return;          // superseded by a newer click
    }

    // Replay on a lower TF whose latest history doesn't reach back to the replay
    // point: load a window that ends a bit after the clock instead.
    let anchored = false;
    if (replayMode && clock != null && source !== 'offline sample' && data[0].time + sec * 50 > clock) {
      const nowSec = Math.floor(Date.now() / 1000);
      const endSec = Math.min(nowSec, Math.floor((clock + sec * Math.floor(max * 0.3)) / sec) * sec);
      let win = peekCandleCache(symbol, iv, max, endSec);
      if (!win) {
        $('status').textContent = `Loading ${TF_LABEL.get(iv) || iv} history at replay point…`;
        setBusy(true, `Loading ${TF_LABEL.get(iv) || iv} history…`);
        try { win = await fetchCandles(symbol, iv, max, null, { endSec }); } catch {}
        if (seq !== loadSeq) return;
      }
      if (win && win.length) { data = win; anchored = true; source = 'history window'; }
    }

    // ---- commit (synchronous from here — one repaint, no blank frame) ----
    setBusy(false);
    candles = data;
    candlesInterval = iv;
    loadedSymbol = symbol;
    anchoredData = anchored;
    $('status').textContent = `${candles.length} candles · ${source}`;
    updateDataDate();

    ChartView.resetPriceZoom();             // new data → price auto-fit, never off-screen
    lwChart.priceScale('right').applyOptions({ autoScale: true });
    ChartView.setTimeline(candles, sec, CFG.FUTURE_BARS);
    Drawings.setSymbol(symbol);

    if (replayMode) {
      let cut, partial = null;
      if (clock != null) {
        cut = replayCutFor(candles, sec, clock);
        if (sameSymbol) partial = buildPartial(candles, sec, cut, clock, prevCandles, prevSec, prevPartial);
      } else {
        cut = Math.max(1, Math.min(candles.length - 2, Math.floor(candles.length * 0.55)));
      }
      lastCut = cut;
      Replay.load(candles, cut, partial);
      ChartView.followIndex(Replay.cutIndex, prevBars);
      if (tradeMode === 'strategy') StrategyMode.onDataChanged();
    } else {
      ChartView.setSlice(candles);
      IndicatorManager.recompute(candles, sec);
      ChartView.setCursor(null);
      if (firstLoad || opts.fit) ChartView.resetView(candles.length - 1);
      else restoreView(view);
    }
    firstLoad = false;
    applyCandleStyle(candleStyle);
    applyCandleColors();
    Drawings.render();

    if (resumeReplay) { resumeReplay = false; if (replayMode) Replay.play(); }
    if (stale && !anchored) revalidate(symbol, iv, max, seq);
    schedulePrefetch(symbol, iv, max);
  }

  // Stale cache was shown instantly — pull the newest bars and swap them in
  // without moving the view (skipped if the user has moved on or is replaying).
  function revalidate(symbol, iv, max, seq) {
    refreshCandles(symbol, iv, max).then((fresh) => {
      if (seq !== loadSeq || replayMode || anchoredData || !fresh || !fresh.length) return;
      const a = fresh[fresh.length - 1], b = candles[candles.length - 1];
      if (b && a.time === b.time && a.close === b.close && fresh.length === candles.length) return;
      const sec = intervalToSeconds(iv);
      const v = captureView(candles, sec);
      candles = fresh;
      updateDataDate();
      ChartView.setTimeline(candles, sec, CFG.FUTURE_BARS);
      ChartView.setSlice(candles);
      IndicatorManager.recompute(candles, sec);
      restoreView(v);
      Drawings.render();
      $('status').textContent = `${candles.length} candles · ${dataSourceName(symbol)}`;
    }).catch(() => {});
  }

  // Live updates: every 30 s (not replaying, live data) pull the newest bars and redraw, so the forming candle
  // moves and indicators (e.g. 🎯 BB Breakout setups) see each candle the moment it closes. Keeps running in a
  // background tab (browsers slow it to about once a minute) so setup alerts still arrive.
  setInterval(() => {
    if (!isAutoUpdate() || replayMode || anchoredData || !candles.length || !loadedSymbol) return;
    const symbol = loadedSymbol, iv = candlesInterval, max = parseInt($('maxCandles').value), seq = loadSeq;
    if (symbol !== $('symbol').value || iv !== interval) return;
    pollLatestCandles(symbol, iv, max).then((fresh) => {
      if (!fresh || seq !== loadSeq || replayMode || anchoredData || !fresh.length) return;
      const a = fresh[fresh.length - 1], b = candles[candles.length - 1];
      if (b && a.time === b.time && a.close === b.close && a.high === b.high && a.low === b.low && fresh.length === candles.length) return;
      const sec = intervalToSeconds(iv), v = captureView(candles, sec), grew = !b || a.time !== b.time;
      candles = fresh;
      updateDataDate();
      if (grew) ChartView.setTimeline(candles, sec, CFG.FUTURE_BARS);
      ChartView.setSlice(candles);
      IndicatorManager.recompute(candles, sec);
      restoreView(v);
      Drawings.render();
    }).catch(() => {});
  }, 30000);

  // Quietly download the other enabled timeframes (nearest first) so the next
  // TF switch is served from memory.
  let prefetchTimer = null;
  function schedulePrefetch(symbol, iv, max) {
    if (!CFG.PREFETCH_TIMEFRAMES) return;
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(() => {
      const cur = timeframes.indexOf(iv);
      const order = timeframes.filter((v) => v !== iv)
        .sort((a, b) => Math.abs(timeframes.indexOf(a) - cur) - Math.abs(timeframes.indexOf(b) - cur));
      prefetchCandles(symbol, order, max);
    }, 800);
  }

  // Date/time of the newest candle in the data, so it's obvious whether the chart is up to date.
  function updateDataDate() {
    const el = $('dataDate'); if (!el) return;
    const last = candles[candles.length - 1];
    if (!last) { el.textContent = ''; return; }
    const d = new Date(last.time * 1000);
    el.textContent = dataSourceName().replace(/ live$/, '') + ' · ' + d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    el.title = 'Latest candle: ' + d.toLocaleString();
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
    $('recutBtn').classList.remove('active');
    setCutHint(false);
    if (replayMode) return;              // cancelling a re-cut keeps the replay running
    $('replayBtn').classList.remove('active');
    $('replayBtn').textContent = 'Replay';
  }

  // Re-cut: pick a new start point while a replay is already running (the chart is
  // already cut). Pauses playback; the next double-click / tap / 🎲 sets the new cut.
  function armRecut() {
    if (!replayMode || !candles.length) return;
    if (replayArming) { cancelArming(); return; }
    Replay.pause();
    replayArming = true;
    Drawings.setTool('cursor');
    chartHost.classList.add('cutting');
    $('recutBtn').classList.add('active');
    setCutHint(true);
  }
  function setCutHint(recut) {
    $('cutHintText').textContent = recut ? 'to re-cut the replay from there' : 'a candle to set the replay start point';
  }

  function enterReplayMode(cutIdx) {
    if (!candles.length) return;
    const recut = replayMode && replayArming;   // picked via Recut while a replay is running
    if (recut && tradeMode === 'strategy') StrategyMode.onExitReplay();
    replayArming = false;
    $('recutBtn').classList.remove('active');
    setCutHint(false);
    chartHost.classList.remove('cutting');
    replayMode = true;
    document.body.classList.add('replay-mode');
    $('replayBtn').classList.add('active');
    $('replayBtn').textContent = '✕ Exit Replay';
    const idx = (cutIdx != null)
      ? Math.max(1, Math.min(candles.length - 2, cutIdx))
      : Math.max(1, Math.min(candles.length - 2, Math.floor(candles.length * 0.55)));
    lastCut = idx;
    // Follow-the-edge view: auto-fit price to revealed candles and keep the newest
    // revealed candle pinned near the right edge so price extends past the cut line.
    // cutting must not touch the view: keep the user's current zoom, scroll and price scale
    Replay.load(candles, idx);
    TradeSim.setMode(tradeMode);
    TradeSim.start(candles[Replay.cutIndex].close);
    if (!recut) TradeSim.playReplayStartSound();
    if (tradeMode === 'strategy') StrategyMode.onEnterReplay();
  }

  function exitReplayMode(showSummary) {
    Replay.pause();
    StrategyMode.onExitReplay();   // restore the user's indicators before repainting full data
    replayMode = false;
    replayArming = false;
    resumeReplay = false;
    document.body.classList.remove('replay-mode');
    chartHost.classList.remove('cutting');
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
    // replay had pulled an older history window — go back to the latest data
    if (anchoredData) load();
  }

  $('replayBtn').onclick = () => {
    if (replayMode) exitReplayMode(true);
    else if (replayArming) cancelArming();
    else armReplay();
  };
  $('exitReplayBtn').onclick = () => exitReplayMode(true);
  $('recutBtn').onclick = () => armRecut();

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
    if (p && p.candle) TradeSim.onTick(p.candle.close, p.candle);
    StrategyMode.onTick(p);   // no-op unless strategy mode + watching replay
    // keep the newest revealed candle near the right edge (per-candle, no jitter)
    if (replayMode && p && !p.forming) ChartView.followIfOffscreen(p.index);
  });
  Replay.on('end', () => exitReplayMode(true));

  // ---- transport controls ----------------------------------------------
  $('playBtn').onclick   = () => Replay.toggle();
  $('stepBtn').onclick   = () => Replay.step();
  $('stepBackBtn').onclick = () => Replay.stepBack();
  $('rewindBtn').onclick = () => Replay.rewind();
  $('speed').onchange    = (e) => Replay.setSpeed(parseFloat(e.target.value));

  // ---- Formation dropup ---------------------------------------------------
  (function () {
    const picker = $('fmPicker');
    const btn    = $('fmBtn');
    const menu   = $('fmMenu');
    const label  = $('fmLabel');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    menu.addEventListener('click', (e) => {
      const opt = e.target.closest('.fm-opt'); if (!opt) return;
      menu.querySelectorAll('.fm-opt').forEach((x) => x.classList.toggle('fm-active', x === opt));
      label.textContent = opt.textContent.split('—')[0].trim();
      Replay.setMode(opt.dataset.v);
      menu.classList.remove('open');
    });
    document.addEventListener('click', () => menu.classList.remove('open'));
  })();

  // ---- chart refresh — repaint + reset to a clean fitted view -----------
  // Re-fits the time scale and re-enables price auto-scale so a squeezed /
  // over-stretched chart returns to normal (TradingView-style refresh).
  // In replay the position is kept (load() re-anchors to the replay clock).
  // Pulls only the newest candles and merges them onto the saved copy (no full
  // re-download), saves the result on the device, then repaints / re-fits.
  let updating = false;
  async function refreshChart() {
    if (updating) return;
    updating = true;
    const btn = $('refreshBtn');
    if (btn) btn.classList.add('spin');
    const symbol = $('symbol').value, max = parseInt($('maxCandles').value);
    try {
      await refreshCandles(symbol, interval, max, true);
    } catch {
      $('status').textContent = 'Update failed — offline? showing saved data';
    }
    updating = false;
    if (btn) btn.classList.remove('spin');
    load({ fit: !replayMode });
  }
  $('refreshBtn').onclick = refreshChart;

  // Double-click the time axis -> reset the time view (replaces the native reset,
  // which would scroll to the end of the whitespace timeline).
  chartHost.addEventListener('dblclick', (e) => {
    let h = 28;
    try { h = lwChart.timeScale().height() || h; } catch {}
    if (e.clientY < chartHost.getBoundingClientRect().bottom - h) return;
    if (replayMode) ChartView.followIndex(Replay.cutIndex, Math.round((lwChart.timeScale().width() || 800) / 6));
    else ChartView.resetView(candles.length - 1);
  });

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
          `<div class="ctx-thick">` +
            [['solid', '━━'], ['dashed', '╍╍'], ['dotted', '┈┈']].map(([k, g]) =>
              `<button class="ctx-w ctx-st${k === sel.style ? ' active' : ''}" data-st="${k}" title="${k}">${g}</button>`).join('') +
          `</div>` +
          (sel.type === 'rect'
            ? `<label class="ctx-color"><span>Border</span><input type="checkbox" id="ctxBorder"${sel.border ? ' checked' : ''}></label>` +
              `<label class="ctx-color"><span>Fill</span><input type="checkbox" id="ctxFill"${sel.fill ? ' checked' : ''}></label>`
            : '') +
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
    // rectangles: border / fill toggles (at least one stays on so the box never vanishes)
    const bi = ctxMenu.querySelector('#ctxBorder'), fi = ctxMenu.querySelector('#ctxFill');
    if (bi) bi.onchange = () => { Drawings.setSelectedProp({ border: bi.checked }); if (!bi.checked && !fi.checked) { fi.checked = true; Drawings.setSelectedProp({ fill: true }); } };
    if (fi) fi.onchange = () => { Drawings.setSelectedProp({ fill: fi.checked }); if (!fi.checked && !bi.checked) { bi.checked = true; Drawings.setSelectedProp({ border: true }); } };
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
    const st = e.target.closest('.ctx-st');
    if (st) {
      Drawings.setSelectedProp({ style: st.dataset.st });
      ctxMenu.querySelectorAll('.ctx-st').forEach((x) => x.classList.toggle('active', x === st));
      return;
    }
    const w = e.target.closest('.ctx-w');
    if (w) {
      Drawings.setSelectedWidth(parseInt(w.dataset.w));
      ctxMenu.querySelectorAll('.ctx-w:not(.ctx-st)').forEach((x) => x.classList.toggle('active', x === w));
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
    const POS_KEY = 'sb.toolbarPos';
    // keep the toolbar fully inside the chart area
    const clampPos = (nx, ny) => {
      const hr = chartHost.getBoundingClientRect();
      return [Math.max(0, Math.min(hr.width - ft.offsetWidth, nx)), Math.max(0, Math.min(hr.height - ft.offsetHeight, ny))];
    };
    const applyPos = (nx, ny) => { [nx, ny] = clampPos(nx, ny); ft.style.left = nx + 'px'; ft.style.top = ny + 'px'; };
    // restore where the user left it last time
    try {
      const sp = JSON.parse(localStorage.getItem(POS_KEY));
      if (sp && Number.isFinite(sp.x) && Number.isFinite(sp.y)) { ft.classList.add('placed'); applyPos(sp.x, sp.y); }
    } catch {}
    window.addEventListener('resize', () => {
      if (ft.style.left) applyPos(parseFloat(ft.style.left), parseFloat(ft.style.top));
    });
    // pointer events: works with mouse, touch and pen; the grip never pans the chart
    grip.style.touchAction = 'none';
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      dragging = true;
      const r = ft.getBoundingClientRect();
      offX = e.clientX - r.left; offY = e.clientY - r.top;
      // first drag: pin the toolbar where it is (drops the mobile bottom-centre default)
      ft.classList.add('placed');
      ft.style.left = (r.left - chartHost.getBoundingClientRect().left) + 'px';
      ft.style.top  = (r.top  - chartHost.getBoundingClientRect().top) + 'px';
      try { grip.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault(); e.stopPropagation();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const hr = chartHost.getBoundingClientRect();
      applyPos(e.clientX - hr.left - offX, e.clientY - hr.top - offY);
      e.preventDefault();
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      try { localStorage.setItem(POS_KEY, JSON.stringify({ x: parseFloat(ft.style.left), y: parseFloat(ft.style.top) })); } catch {}
    };
    grip.addEventListener('pointerup', endDrag);
    grip.addEventListener('pointercancel', endDrag);
  })();

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
    if (e.code === 'Space') {
      e.preventDefault();
      // a focused button would also fire a click on Space — drop focus so it can't double-toggle
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
      if (replayMode && !replayArming) Replay.toggle();   // play / pause
      else if (!replayMode && !replayArming) armReplay(); // start: pick the cut candle
    }
    if (e.key === 'ArrowRight') { e.preventDefault(); if (replayMode) Replay.step(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (replayMode) Replay.stepBack(); }
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

  // ---- hooks for the mobile layer (js/mobile.js) ------------------------
  window.App = { armReplay, cancelArming, enterReplayMode, exitReplayMode, switchInterval,
    get candles() { return candles; }, get replayMode() { return replayMode; } };

  // ---- initial load ----------------------------------------------------
  load();
})();
