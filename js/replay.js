// replay.js — TradingView-style replay engine

const Replay = (() => {
  let full = [];          // all candles ascending
  let cutIndex = 0;       // last fully-revealed completed candle index
  let startCut = 0;       // remembered cut for rewind
  let playing = false;
  let speed = 1;
  let mode = 'candle'; // 'realistic' | 'candle'
  let timer = null;

  // realistic-mode forming state
  let forming = false;
  let path = [];
  let pathPos = 0;
  let runHi = 0, runLo = 0, formOpen = 0;

  // Partially-formed bar shown after switching UP a timeframe mid-replay:
  // { bar, endTime } — bar = aggregate of the lower-TF candles revealed so far
  // inside full[cutIndex + 1], endTime = replay clock (no lookahead). It is
  // replaced by the real bar as soon as playback advances.
  let partial = null;

  let listeners = { tick: [], end: [], state: [] };
  function on(ev, fn) { listeners[ev].push(fn); }
  function emit(ev, payload) { listeners[ev].forEach((f) => f(payload)); }

  function load(candles, cut, partialBar) {
    full = candles;
    setCut(cut != null ? cut : Math.min(full.length - 1, Math.floor(full.length * 0.45)), partialBar);
  }

  function setCut(idx, partialBar) {
    stop();
    cutIndex = Math.max(1, Math.min(full.length - 1, idx));
    startCut = cutIndex;
    forming = false; path = []; pathPos = 0;
    const nxt = full[cutIndex + 1];
    partial = (partialBar && nxt && partialBar.bar && partialBar.bar.time === nxt.time) ? partialBar : null;
    renderRevealed();
    emit('state', stateObj());
  }

  function revealed() { return full.slice(0, cutIndex + 1); }

  function renderRevealed() {
    const vis = revealed();
    ChartView.setSlice(vis, partial ? partial.bar : undefined);
    IndicatorManager.recompute(vis);
    if (partial) {
      drawCursorAt(partial.bar.time);
      emit('tick', { index: cutIndex, candle: partial.bar, forming: true });
    } else {
      drawCursorAt(full[cutIndex].time);
      emit('tick', { index: cutIndex, candle: full[cutIndex], forming: false });
    }
  }

  function drawCursorAt(time) { ChartView.setCursor(time); }

  // ---- playback loop -------------------------------------------------------
  function scheduleNext() {
    if (!playing) return;
    const ms = mode === 'realistic'
      ? Math.max(CFG.MIN_FRAME_MS, Math.round(CFG.REALISTIC_FRAME_MS / speed))
      : Math.max(CFG.MIN_FRAME_MS, Math.round(CFG.CANDLE_STEP_MS / speed));
    timer = setTimeout(loop, ms);
  }

  function loop() {
    if (!playing) return;
    if (mode === 'candle') {
      advanceCandle();
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

  // candle-by-candle: drop the next finished candle in whole
  function advanceCandle() {
    if (cutIndex >= full.length - 1) return;
    partial = null;
    cutIndex++;
    const c = full[cutIndex];
    ChartView.updateForming(c);
    IndicatorManager.recompute(revealed());
    drawCursorAt(c.time);
    emit('tick', { index: cutIndex, candle: c, forming: false });
  }

  // realistic: animate the next candle tick by tick
  function advanceFrame() {
    if (!forming) {
      if (cutIndex >= full.length - 1) return;
      const next = full[cutIndex + 1];
      pathPos = 0;
      formOpen = next.open;
      if (partial) {
        // continue forming from where the partial bar left off (no visual reset)
        const pb = partial.bar;
        path = intrabarPath({ ...next, open: pb.close }, CFG.FRAMES_PER_CANDLE);
        runHi = pb.high; runLo = pb.low;
      } else {
        path = intrabarPath(next, CFG.FRAMES_PER_CANDLE);
        runHi = next.open; runLo = next.open;
      }
      partial = null;
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
    get full() { return full; }, get cutIndex() { return cutIndex; },
    get partial() { return partial; } };
})();
