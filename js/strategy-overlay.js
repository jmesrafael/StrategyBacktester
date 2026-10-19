// strategy-overlay.js — canvas overlay that reproduces a Pine strategy's on-chart
// "drawings" during Watch Replay: the stepped pivot-P line, per-trade green profit /
// red risk boxes, avg/stop/target segment lines, entry/exit triangles and price labels.
//
// Same anchoring pattern as fvg.js: a transparent, click-through canvas pinned over the
// chart that maps data → pixels via chart.timeScale().timeToCoordinate(time) and
// series.priceToCoordinate(price), re-rendering on pan/zoom/crosshair. Driven entirely
// by StrategyMode (js/strategy.js): it is activated only while replaying a strategy that
// declares `overlay: true`, and cleared on exit so nothing leaks onto the normal chart.

const StrategyOverlay = (() => {
  let chart, series, container, canvas, ctx;
  let active = false;
  let pivot = [];     // [{time, value|null}] stepped pivot-P series (primary orange line)
  let lines = [];     // [{label, color, width?, dashed?, data:[{time,value|null}]}] extra context levels
  let trades = [];    // [{entryTime, entryPrice, dir:'long'|'short', stop, target, exitTime|null, exitPrice|null}]
  let lastTime = null; // latest revealed bar time (open trades extend to here)

  // palette (mirrors the Pine: pivot orange, green target zone, red stop zone)
  const PIVOT   = 'rgba(255,153,0,0.85)';
  const GREEN   = 'rgba(38,166,154,0.18)';
  const RED     = 'rgba(239,83,80,0.18)';
  const GREEN_L = 'rgba(38,166,154,0.95)';
  const RED_L   = 'rgba(239,83,80,0.95)';
  const AVG_L   = 'rgba(255,255,255,0.9)';
  const LIME    = '#7bff5a';

  // ---- canvas setup (same as fvg.js) --------------------------------------
  function init(chartObj, candleSeries, host) {
    chart = chartObj; series = candleSeries; container = host;
    canvas = document.createElement('canvas');
    canvas.className = 'strat-overlay-layer';
    canvas.style.cssText = 'position:absolute;inset:0;z-index:3;pointer-events:none;display:none;';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', () => { resize(); if (active) render(); });
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => { if (active) render(); });
    chart.subscribeCrosshairMove(() => { if (active) render(); });
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = container.clientWidth  * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width  = container.clientWidth  + 'px';
    canvas.style.height = container.clientHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // coordinate helpers
  function tx(time)  { return chart.timeScale().timeToCoordinate(time); }
  function ty(price) { return series.priceToCoordinate(price); }
  function W()       { return container.clientWidth; }
  function H()       { return container.clientHeight; }
  function fmt(p)    { return p >= 1000 ? p.toFixed(1) : p.toFixed(2); }

  // ---- data feed ----------------------------------------------------------
  function setData(d) {
    d = d || {};
    pivot = d.pivot || [];
    lines = d.lines || [];
    trades = d.trades || [];
    lastTime = d.lastTime != null ? d.lastTime : lastTime;
    if (active) render();
  }

  function setActive(v) {
    active = v;
    canvas.style.display = v ? 'block' : 'none';
    if (!v) { pivot = []; lines = []; trades = []; lastTime = null; }
    render();
  }

  // ---- render -------------------------------------------------------------
  function render() {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (!active) return;
    drawTradeBoxes();   // boxes under the pivot line
    drawLines();        // extra context levels (R1/S1/… etc.) beneath the pivot
    drawPivot();
    drawTradeMarks();   // triangles + labels on top
  }

  // Horizontal segments at each pivot level — no vertical connectors between levels.
  // Shared by the primary pivot line and every extra context level.
  function drawStepped(data, color, width, dashed) {
    if (!data || !data.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dashed) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    let started = false, prevY = null, prevV = null;
    for (const pt of data) {
      if (pt.value == null) { started = false; prevV = null; continue; }
      const x = tx(pt.time), y = ty(pt.value);
      if (x == null || y == null) { continue; }
      if (!started) { ctx.moveTo(x, y); started = true; }
      else if (pt.value === prevV) { ctx.lineTo(x, y); }
      else { ctx.lineTo(x, prevY); ctx.moveTo(x, y); } // jump to new level — no vertical connector
      prevY = y; prevV = pt.value;
    }
    ctx.stroke();
    ctx.restore();
  }

  // Primary pivot-P polyline (orange), like the Pine plot(P), with a 'P' tag.
  function drawPivot() {
    drawStepped(pivot, PIVOT, 1.5, false);
    levelLabel(pivot, 'P', PIVOT);
  }

  // Extra context levels (resistance/support lines) under the pivot, each labelled.
  function drawLines() {
    for (const ln of lines) {
      if (!ln || !ln.data) continue;
      drawStepped(ln.data, ln.color || PIVOT, ln.width || 1, ln.dashed);
      levelLabel(ln.data, ln.label, ln.color || PIVOT);
    }
  }

  // Small tag drawn at the right edge next to a level's most-recent value.
  function levelLabel(data, label, color) {
    if (!data || !data.length || !label) return;
    let last = null;
    for (let i = data.length - 1; i >= 0; i--) { if (data[i].value != null) { last = data[i]; break; } }
    if (!last) return;
    const y = ty(last.value);
    if (y == null || y < 6 || y > H() - 4) return;
    const lx = tx(last.time);
    const x = Math.min(W() - 22, (lx != null ? lx : W()) + 4);
    ctx.save();
    ctx.font = '9px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.fillText(label, x, y - 2);
    ctx.restore();
  }

  // Per-trade green (avg→target) / red (avg→stop) zones + avg/stop/target lines.
  function drawTradeBoxes() {
    for (const t of trades) {
      const endT = t.exitTime != null ? t.exitTime : lastTime;
      if (endT == null) continue;
      let x1 = tx(t.entryTime), x2 = tx(endT);
      if (x1 == null && x2 == null) continue;
      x1 = x1 != null ? x1 : 0;
      x2 = x2 != null ? x2 : W();
      const left = Math.max(0, Math.min(x1, x2));
      const right = Math.min(W(), Math.max(x1, x2));
      if (right <= 0 || left >= W() || right - left < 1) continue;

      const avgY = ty(t.entryPrice), tgtY = ty(t.target), stopY = ty(t.stop);
      if (avgY == null) continue;

      // green profit zone (avg → target) — clamped to the visible area so a target that
      // sits off-screen (or a trailing-only trade with no fixed target) never paints an
      // "infinite", full-height band. The zone simply caps at the TP level / chart edge.
      if (tgtY != null) {
        ctx.fillStyle = GREEN;
        fillBand(left, right, avgY, tgtY);
      }
      // red risk zone (avg → stop)
      if (stopY != null) {
        ctx.fillStyle = RED;
        fillBand(left, right, avgY, stopY);
      }
      // segment lines across the trade span (Pine style_linebr avg/stop/target)
      hLine(left, right, tgtY, GREEN_L);
      hLine(left, right, stopY, RED_L);
      hLine(left, right, avgY, AVG_L);
    }
  }

  // Fill a price band [yA..yB] across [left..right], clamped to the canvas height so an
  // off-screen level can't blow the box up to full height. Skips if nothing's visible.
  function fillBand(left, right, yA, yB) {
    const top = Math.max(0, Math.min(yA, yB));
    const bot = Math.min(H(), Math.max(yA, yB));
    if (bot - top < 0.5) return;
    ctx.fillRect(left, top, right - left, bot - top);
  }

  function hLine(left, right, y, color) {
    if (y == null) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.restore();
  }

  // Entry/exit triangles + price + Long/Short / XL|XS labels.
  function drawTradeMarks() {
    ctx.save();
    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const t of trades) {
      const isLong = t.dir === 'long';
      // ── entry ──
      const ex = tx(t.entryTime), ey = ty(t.entryPrice);
      if (ex != null && ey != null && ex >= -20 && ex <= W() + 20) {
        if (isLong) {
          triangle(ex, ey + 16, 6, true, LIME);
          label(ex, ey + 40, fmt(t.entryPrice), '#e5e7eb');
          label(ex, ey + 52, 'Long', LIME);
        } else {
          triangle(ex, ey - 16, 6, false, RED_L);
          label(ex, ey - 44, fmt(t.entryPrice), '#e5e7eb');
          label(ex, ey - 32, 'Short', RED_L);
        }
      }
      // ── exit ──
      if (t.exitTime != null && t.exitPrice != null) {
        const xx = tx(t.exitTime), xy = ty(t.exitPrice);
        if (xx != null && xy != null && xx >= -20 && xx <= W() + 20) {
          const tag = isLong ? 'XL' : 'XS';
          label(xx, isLong ? xy + 28 : xy - 22, tag, '#e879f9');
          label(xx, isLong ? xy + 40 : xy - 10, fmt(t.exitPrice), '#9ca3af');
        }
      }
    }
    ctx.restore();
  }

  function triangle(x, y, r, up, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    if (up) { ctx.moveTo(x, y - r); ctx.lineTo(x - r, y + r); ctx.lineTo(x + r, y + r); }
    else    { ctx.moveTo(x, y + r); ctx.lineTo(x - r, y - r); ctx.lineTo(x + r, y - r); }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function label(x, y, text, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  return { init, setActive, setData, render, get active() { return active; } };
})();
