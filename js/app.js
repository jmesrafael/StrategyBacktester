// app.js — wires controls, data, chart, replay, indicators, and drawing tools

(function () {
  let candles = [];
  let replayMode = false;
  let draggingCut = false;
  let interval = CFG.DEFAULTS.interval;

  const $ = (id) => document.getElementById(id);

  // ---- populate controls ----
  CFG.SYMBOLS.forEach((s) => $('symbol').add(new Option(s, s)));
  $('symbol').value = CFG.DEFAULTS.symbol;

  CFG.INTERVALS.forEach(([v, l]) => {
    const b = document.createElement('button');
    b.dataset.v = v; b.textContent = l;
    if (v === interval) b.classList.add('active');
    $('intervalSeg').appendChild(b);
  });

  CFG.MAX_CANDLES.forEach((n) => $('maxCandles').add(new Option(String(n), n)));
  $('maxCandles').value = CFG.DEFAULTS.maxCandles;

  CFG.SPEEDS.forEach((s) => $('speed').add(new Option(s + 'x', s)));

  // ---- chart + indicators + drawings init ----
  ChartView.create($('chart'));
  IndicatorManager.init({
    chart: ChartView.getChart(),
    button: $('indicatorsBtn'),
    badge: $('indBadge'),
    chartHost: $('chartHost'),
    getVisibleCandles: () => replayMode ? candles.slice(0, Replay.cutIndex + 1) : candles,
  });
  Drawings.init(ChartView.getChart(), ChartView.getCandleSeries(), $('chartHost'));
  TradeSim.init({
    chart: ChartView.getChart(),
    series: ChartView.getCandleSeries(),
    chartHost: $('chartHost'),
    onPlayAgain: () => enterReplayMode(),
    onExit: () => {},
  });
  StrategyMode.init({
    chart: ChartView.getChart(),
    chartHost: $('chartHost'),
    button: $('strategyBtn'),
    replay: Replay,
    tradeSim: TradeSim,
    getFullCandles: () => candles,
    onWatchReplay: () => watchReplay(),
  });

  let tradeMode = 'game'; // 'game' | 'strategy'

  // ---- candle style (session-persisted) --------------------------------
  let candleStyle = sessionStorage.getItem(CFG.STORE.candleStyle) || CFG.DEFAULTS.candleStyle;
  function applyCandleStyle(name) {
    candleStyle = name;
    ChartView.setCandleStyle(name);
    sessionStorage.setItem(CFG.STORE.candleStyle, name);
    $('candleStyleMenu').querySelectorAll('.menu-item').forEach((b) =>
      b.classList.toggle('active', b.dataset.style === name));
  }
  $('candleStyleBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('candleStyleMenu').classList.toggle('open');
  });
  $('candleStyleMenu').addEventListener('click', (e) => {
    const b = e.target.closest('.menu-item'); if (!b) return;
    applyCandleStyle(b.dataset.style);
    $('candleStyleMenu').classList.remove('open');
  });
  document.addEventListener('click', () => $('candleStyleMenu').classList.remove('open'));

  // ---- canvas settings (grid + colors, session-persisted) --------------
  const stBg    = sessionStorage.getItem(CFG.STORE.bg);
  const stGridV = sessionStorage.getItem(CFG.STORE.grid);       // 'true' | 'false' | null
  const stGridC = sessionStorage.getItem(CFG.STORE.gridColor);
  if (stBg) ChartView.setBackground(stBg);
  if (stGridV != null) ChartView.setGridVisible(stGridV === 'true');
  if (stGridC) ChartView.setGridColor(stGridC);

  const settingsPanel = document.createElement('div');
  settingsPanel.className = 'settings-panel';
  settingsPanel.innerHTML =
    `<div class="st-title">Canvas</div>` +
    `<label class="st-row"><span>Show grid</span><input type="checkbox" id="stGrid"></label>` +
    `<label class="st-row"><span>Background</span><input type="color" id="stBg"></label>` +
    `<label class="st-row"><span>Grid color</span><input type="color" id="stGridColor"></label>`;
  document.body.appendChild(settingsPanel);
  settingsPanel.addEventListener('click', (e) => e.stopPropagation());

  $('stGrid').checked    = stGridV == null ? true : stGridV === 'true';
  $('stBg').value        = stBg    || '#131722';
  $('stGridColor').value = stGridC || '#2a2e39';

  $('stGrid').onchange = (e) => {
    ChartView.setGridVisible(e.target.checked);
    sessionStorage.setItem(CFG.STORE.grid, String(e.target.checked));
  };
  $('stBg').oninput = (e) => {
    ChartView.setBackground(e.target.value);
    sessionStorage.setItem(CFG.STORE.bg, e.target.value);
  };
  $('stGridColor').oninput = (e) => {
    ChartView.setGridColor(e.target.value);
    sessionStorage.setItem(CFG.STORE.gridColor, e.target.value);
  };

  $('settingsBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = settingsPanel.classList.toggle('open');
    if (open) {
      const r = $('settingsBtn').getBoundingClientRect();
      settingsPanel.style.left = Math.min(r.left, window.innerWidth - 210) + 'px';
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
      Replay.load(candles, cutIdx); // renderRevealed() recomputes indicators
      syncSlider();
      updateCutHandle();
    } else {
      ChartView.setSlice(candles);
      IndicatorManager.recompute(candles);
      ChartView.setCursor(null);
      ChartView.getChart().timeScale().fitContent();
    }
    applyCandleStyle(candleStyle);
    Drawings.render();
  }

  // ---- replay mode toggle ----------------------------------------------
  function enterReplayMode() {
    if (!candles.length) return;
    replayMode = true;
    document.body.classList.add('replay-mode');
    $('replayBtn').classList.add('active');
    $('replayBtn').textContent = '✕ Exit Replay';
    const cutIdx = Math.max(1, Math.min(candles.length - 2, Math.floor(candles.length * 0.55)));
    Replay.load(candles, cutIdx);
    syncSlider();
    updateCutHandle();
    TradeSim.setMode(tradeMode);
    TradeSim.start(candles[Replay.cutIndex].close);
    if (tradeMode === 'strategy') StrategyMode.onEnterReplay();
  }

  // ---- Game / Strategy mode tabs ---------------------------------------
  function setTradeMode(m) {
    tradeMode = m;
    $('modeTabs').querySelectorAll('button').forEach((x) =>
      x.classList.toggle('active', x.dataset.mode === m));
    TradeSim.setMode(m);
    StrategyMode.setModeActive(m === 'strategy');
  }
  function watchReplay() { setTradeMode('strategy'); enterReplayMode(); }

  $('modeTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const m = b.dataset.mode;
    if (m === tradeMode) return;
    if (TradeSim.getAccount().position &&
        !window.confirm('Switch mode? This closes the open position and resets the session.')) return;
    setTradeMode(m);
    if (replayMode) enterReplayMode(); // restart the session in the new mode
  });

  function exitReplayMode(showSummary) {
    Replay.pause();
    replayMode = false;
    document.body.classList.remove('replay-mode');
    $('replayBtn').classList.remove('active');
    $('replayBtn').textContent = 'Replay';
    ChartView.setSlice(candles);
    IndicatorManager.recompute(candles);
    ChartView.setCursor(null);
    ChartView.getChart().timeScale().fitContent();
    Drawings.render();
    TradeSim.stop(showSummary);
  }

  $('replayBtn').onclick = () => replayMode ? exitReplayMode(true) : enterReplayMode();

  // ---- draggable cut handle --------------------------------------------
  const cutHandle = $('cutHandle');
  const chartHost = $('chartHost');
  const lwChart   = ChartView.getChart();

  function updateCutHandle() {
    if (!replayMode || !candles[Replay.cutIndex]) { cutHandle.style.display = 'none'; return; }
    const px = lwChart.timeScale().timeToCoordinate(candles[Replay.cutIndex].time);
    if (px != null && px >= 0 && px <= chartHost.clientWidth) {
      cutHandle.style.left = px + 'px';
      cutHandle.style.display = 'flex';
    } else {
      cutHandle.style.display = 'none';
    }
  }

  lwChart.timeScale().subscribeVisibleTimeRangeChange(updateCutHandle);

  cutHandle.addEventListener('mousedown', (e) => {
    if (!replayMode) return;
    draggingCut = true; e.preventDefault(); e.stopPropagation();
  });
  window.addEventListener('mousemove', (e) => {
    if (!draggingCut) return;
    const rect = chartHost.getBoundingClientRect();
    const logical = lwChart.timeScale().coordinateToLogical(e.clientX - rect.left);
    if (logical != null) {
      Replay.jumpCutTo(Math.max(1, Math.min(candles.length - 1, Math.round(logical))));
      syncSlider(); updateCutHandle();
    }
  });
  window.addEventListener('mouseup', () => { draggingCut = false; });

  lwChart.subscribeClick((param) => {
    if (!replayMode || Replay.state().playing || param.logical == null) return;
    if (Drawings.tool !== 'cursor') return;
    Replay.jumpCutTo(Math.max(1, Math.min(candles.length - 1, Math.round(param.logical))));
    syncSlider(); updateCutHandle();
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
    syncSlider(); updateCutHandle(); Drawings.render();
    if (p && p.candle) TradeSim.onTick(p.candle.close);
    StrategyMode.onTick(p);   // no-op unless strategy mode + watching replay
  });
  Replay.on('end', () => exitReplayMode(true));

  function syncSlider() {
    const total = candles.length;
    $('cutSlider').max = total - 1;
    $('cutSlider').value = Replay.cutIndex;
    $('cutLabel').textContent = `${Replay.cutIndex + 1} / ${total}`;
  }

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

  $('cutSlider').addEventListener('input', (e) => {
    if (!replayMode) return;
    Replay.jumpCutTo(parseInt(e.target.value));
    $('cutLabel').textContent = `${Replay.cutIndex + 1} / ${candles.length}`;
    updateCutHandle();
  });

  // ---- data reload controls --------------------------------------------
  $('symbol').onchange     = () => load();
  $('maxCandles').onchange = () => load();
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
  $('delBtn').onclick   = () => Drawings.deleteSelected();
  $('toolbarToggle').onclick = () => document.body.classList.toggle('no-toolbar');

  // ---- keyboard --------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); if (replayMode) Replay.toggle(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); if (replayMode) Replay.step(); }
    if (e.key === 'Escape' && replayMode) exitReplayMode(true);
  });

  // ---- initial load ----------------------------------------------------
  load();
})();
