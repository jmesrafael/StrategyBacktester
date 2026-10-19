// replay.js — TradingView-style replay engine

const Replay = (() => {
  let full = [];          // all candles ascending
  let cutIndex = 0;       // last fully-revealed completed candle index
  let startCut = 0;       // remembered cut for rewind
  let playing = false;
  let speed = parseFloat(localStorage.getItem('cr.replaySpeed')) || 1;
  let mode  = localStorage.getItem('cr.replayMode') || 'candle';
  let timer = null;

  // realistic-mode forming state
  let forming = false;
  let path = [];
  let pathPos = 0;
  let runHi = 0, runLo = 0, formOpen = 0;

  let listeners = { tick: [], end: [], state: [] };
  function on(ev, fn) { listeners[ev].push(fn); }
  function emit(ev, payload) { listeners[ev].forEach((f) => f(payload)); }

  function load(candles, cut) {
    full = candles;
    setCut(cut != null ? cut : Math.min(full.length - 1, Math.floor(full.length * 0.45)));
  }

  function setCut(idx) {
    stop();
    cutIndex = Math.max(1, Math.min(full.length - 1, idx));
    startCut = cutIndex;
    forming = false; path = []; pathPos = 0;
    renderRevealed();
    emit('state', stateObj());
  }

  function revealed() { return full.slice(0, cutIndex + 1); }

  function renderRevealed() {
    const vis = revealed();
    ChartView.setSlice(vis);
    IndicatorManager.recompute(vis);
    drawCursorAt(full[cutIndex].time);
    emit('tick', { index: cutIndex, candle: full[cutIndex], forming: false });
  }

  function drawCursorAt(time) {
    const vis = revealed();
    const lo = Math.min(...vis.map((c) => c.low));
    const hi = Math.max(...vis.map((c) => c.high));
    ChartView.setCursor(time, lo, hi);
  }

  // ---- playback loop -------------------------------------------------------
  // Candle mode at high speed reveals MULTIPLE candles per timer frame instead of
  // chasing an impossibly small setTimeout interval (which the per-frame work would
  // overrun anyway, so the clock never actually sped up). We hold a steady ~60fps
  // cadence and grow the per-frame batch with the speed — and recompute indicators
  // only ONCE per frame rather than once per candle, so 100x is genuinely ~100x.
  const FRAME_MS = 16;
  function candleFrame() {
    const idealMs = CFG.CANDLE_STEP_MS / speed;   // ms a single candle "should" take
    if (idealMs >= FRAME_MS) return { ms: Math.round(idealMs), steps: 1 };
    return { ms: FRAME_MS, steps: Math.max(1, Math.round(FRAME_MS / idealMs)) };
  }

  function scheduleNext() {
    if (!playing) return;
    const ms = mode === 'realistic'
      ? Math.max(CFG.MIN_FRAME_MS, Math.round(CFG.REALISTIC_FRAME_MS / speed))
      : candleFrame().ms;
    timer = setTimeout(loop, ms);
  }

  function loop() {
    if (!playing) return;
    if (mode === 'candle') {
      advanceCandle(candleFrame().steps);
    } else {
      advanceFrame();
    }
    if (cutIndex >= full.length - 1 && !forming) {
      stop();
      emit('end', stateObj());
      return;
    }
    scheduleNext();
  }

  // candle-by-candle: drop the next `steps` finished candles in whole. Each bar is
  // appended to the chart (so none are skipped visually), but indicators, the cursor
  // and the 'tick' event fire just once for the batch — StrategyMode.onTick replays
  // every intermediate index internally, so trades aren't missed.
  function advanceCandle(steps) {
    steps = Math.max(1, steps || 1);
    if (cutIndex >= full.length - 1) return;
    const target = Math.min(full.length - 1, cutIndex + steps);
    for (let i = cutIndex + 1; i <= target; i++) ChartView.updateForming(full[i]);
    cutIndex = target;
    const c = full[cutIndex];
    IndicatorManager.recompute(revealed());
    drawCursorAt(c.time);
    emit('tick', { index: cutIndex, candle: c, forming: false });
  }

  // realistic: animate the next candle tick by tick
  function advanceFrame() {
    if (!forming) {
      if (cutIndex >= full.length - 1) return;
      const next = full[cutIndex + 1];
      path = intrabarPath(next, CFG.FRAMES_PER_CANDLE);
      pathPos = 0;
      formOpen = next.open;
      runHi = next.open; runLo = next.open;
      forming = true;
    }
    const next = full[cutIndex + 1];
    const price = path[pathPos];
    runHi = Math.max(runHi, price);
    runLo = Math.min(runLo, price);
    const bar = { time: next.time, open: formOpen, high: runHi, low: runLo,
      close: price, volume: next.volume * (pathPos + 1) / path.length };
    ChartView.updateForming(bar);
    drawCursorAt(next.time);
    emit('tick', { index: cutIndex, candle: bar, forming: true });

    pathPos++;
    if (pathPos >= path.length) {
      // finalize to exact OHLC
      ChartView.updateForming(next);
      cutIndex++;
      forming = false; path = [];
      IndicatorManager.recompute(revealed());
      emit('tick', { index: cutIndex, candle: next, forming: false });
    }
  }

  // ---- controls ------------------------------------------------------------
  function play() {
    if (playing) return;
    if (cutIndex >= full.length - 1 && !forming) return;
    playing = true; emit('state', stateObj()); scheduleNext();
  }
  function pause() { playing = false; if (timer) clearTimeout(timer); timer = null; emit('state', stateObj()); }
  function stop() { playing = false; if (timer) clearTimeout(timer); timer = null; }
  function toggle() { playing ? pause() : play(); }

  function step() {
    if (playing) pause();
    if (mode === 'candle') {
      advanceCandle();
    } else {
      // finish the current forming candle in one click, else reveal one whole
      if (forming) { while (forming) advanceFrame(); }
      else advanceCandle();
    }
    if (cutIndex >= full.length - 1 && !forming) emit('end', stateObj());
  }

  function rewind() { setCut(startCut); }

  function setSpeed(s) {
    speed = s;
    if (playing) { if (timer) clearTimeout(timer); scheduleNext(); } // immediate, no restart
    emit('state', stateObj());
  }

  function setMode(m) {
    if (m === mode) return;
    const wasPlaying = playing;
    pause();
    if (forming) { while (forming) advanceFrame(); } // settle current candle
    mode = m;
    emit('state', stateObj());
    if (wasPlaying) play();
  }

  // timeframe change: keep cut proportional, no blank
  function reload(candles) {
    const newCut = proportionalCut(cutIndex, full.length, candles.length);
    const wasPlaying = playing;
    pause();
    full = candles;
    setCut(newCut);
    if (wasPlaying) play();
  }

  function stateObj() {
    return { playing, speed, mode, index: cutIndex, total: full.length,
      atEnd: cutIndex >= full.length - 1 && !forming };
  }

  // jump cut to a logical index from a chart click / slider
  function jumpCutTo(idx) { setCut(idx); }

  // repaint the current revealed slice without changing the cut (Refresh button)
  function rerender() { if (full.length) renderRevealed(); }

  return { load, setCut, jumpCutTo, play, pause, toggle, step, rewind,
    setSpeed, setMode, reload, rerender, on, state: stateObj,
    get full() { return full; }, get cutIndex() { return cutIndex; } };
})();
