// drawings.js — TradingView-style drawing overlay (canvas anchored to data coords)

const Drawings = (() => {
  let chart, series, container, canvas, ctx;
  let tool = 'cursor'; // cursor | trend | hline | hray | vline | rect
  let items = [];      // {id,type,p1:{time,price},p2:{time,price},color,width}
  let selected = null;
  let draft = null;    // two-point tool in progress (p1 locked, tracking p2)
  let ghost = null;    // hover preview for single-click tools (not yet placed)
  let drag = null;     // {item, handle:'p1'|'p2'|'body', start, p1, p2}
  let hover = null;
  let idSeq = 1;
  let onToolChange = null;
  let symbol = null;   // drawings are stored per symbol (shared across timeframes)
  let undoStack = [];  // JSON snapshots of `items`, newest last (Ctrl+Z)
  let magnet = null;   // {x,y} of the candle point the cursor is snapped to (Ctrl held)
  const UNDO_MAX = 100;
  let ctrlHeld = false; // magnet key state (tracked from key events too, so it reacts without a mouse move)

  // last-used style — new drawings inherit it (updated by the right-click editor)
  let defaultColor = CFG.THEME.draw;
  let defaultWidth = CFG.DRAW_DEFAULT_WIDTH;
  let defaultStyle = "solid";   // line style of new drawings: solid | dashed | dotted
  let showLabels = true; // toggled via Settings → "Show price labels"

  const HANDLE_R = 5;
  const HIT = 7;
  let hitSlop = 0;   // extra hit radius while a finger is down

  function init(chartObj, candleSeries, host) {
    chart = chartObj; series = candleSeries; container = host;
    canvas = document.createElement('canvas');
    canvas.className = 'draw-layer';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();

    // redraw whenever the time scale moves (pan / zoom)
    chart.timeScale().subscribeVisibleLogicalRangeChange(render);
    // also re-render on every crosshair move — this fires during any mouse drag,
    // including price-axis pan, so drawings stay glued to the chart at all times.
    chart.subscribeCrosshairMove(() => {
      if (tool === 'cursor') updateHover(lastMouse);
      render();
    });

    window.addEventListener('resize', () => { resize(); render(); });

    canvas.addEventListener('mousedown', onDown);
    container.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    container.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    container.addEventListener('touchend', onTouchEnd, true);
    container.addEventListener('touchcancel', onTouchEnd, true);
    // a click anywhere else on the chart (not on a drawing / its handles, not on the
    // toolbar) leaves edit mode: the handles disappear
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !selected || tool !== 'cursor' || hover || drag) return;
      if (e.target.closest && e.target.closest('.float-toolbar')) return;
      selected = null; render();
    }, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('mousemove', trackMouse);
    canvas.addEventListener('mouseenter', () => { inside = true; });
    canvas.addEventListener('mouseleave', () => {
      inside = false; ghost = null;
      if (capturing) chart.clearCrosshairPosition();
      render();
    });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { if (ctrlHeld) { ctrlHeld = false; refreshMagnet(); } });
    // last-chance save (tab close / reload) — drawings are also saved on every edit
    window.addEventListener('pagehide', saveDrawings);

    syncPointerMode();
  }

  let lastMouse = { x: 0, y: 0 };
  let inside = false;
  function trackMouse(e) {
    const r = canvas.getBoundingClientRect();
    lastMouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    inside = true;
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // coordinate conversion (data <-> pixels) — with extrapolation past the cut
  function _barRef() {
    const ts = chart.timeScale();
    const lr = ts.getVisibleLogicalRange();
    if (!lr) return null;
    const refL = Math.max(1, Math.min(Math.floor(lr.to), Math.floor(lr.from) + 1));
    const refPx  = ts.logicalToCoordinate(refL);
    const prevPx = ts.logicalToCoordinate(refL - 1);
    if (refPx == null || prevPx == null) return null;
    const refT  = ts.coordinateToTime(refPx);
    const prevT = ts.coordinateToTime(prevPx);
    if (refT == null || prevT == null) return null;
    const dur = refT - prevT; if (!dur) return null;
    return { refPx, prevPx, refT, dur, pxPerBar: refPx - prevPx };
  }

  function x(time) {
    const px = chart.timeScale().timeToCoordinate(time);
    if (px != null) return px;
    const r = _barRef(); if (!r) return null;
    return r.refPx + ((time - r.refT) / r.dur) * r.pxPerBar;
  }
  function y(price) { return series.priceToCoordinate(price); }
  function toTime(px) {
    const t = chart.timeScale().coordinateToTime(px);
    if (t != null) return t;
    const r = _barRef(); if (!r) return null;
    return r.refT + Math.round(((px - r.refPx) / r.pxPerBar) * r.dur);
  }
  function toPrice(py) { return series.coordinateToPrice(py); }

  // ---- undo ---------------------------------------------------------------
  const snap = () => JSON.stringify(items.map(({ id, type, p1, p2, color, width, style, border, fill }) => ({ id, type, p1, p2, color, width, style, border, fill })));
  function pushUndo() { undoStack.push(snap()); if (undoStack.length > UNDO_MAX) undoStack.shift(); }
  function undo() {
    if (draft) { draft = null; render(); return; }          // cancel an in-progress drawing first
    const prev = undoStack.pop(); if (prev == null) return;
    items = JSON.parse(prev);
    selected = null; hover = null; drag = null;
    syncPointerMode(); render(); saveDrawings();
  }

  // ---- magnet (hold Ctrl): snap to the nearest open/high/low/close of the candle under the cursor
  function magnetize(mx, my, on) {
    magnet = null;
    const t = toTime(mx), p = toPrice(my);
    if (!on || t == null || p == null) return { time: t, price: p };
    let bar = null;
    try {
      const lg = chart.timeScale().coordinateToLogical(mx);
      if (lg != null) bar = series.dataByIndex(Math.round(lg), 0);
    } catch {}
    if (!bar || bar.high == null) return { time: t, price: p };
    let best = null, bestD = Infinity;
    [bar.open, bar.high, bar.low, bar.close].forEach((v) => {
      if (v == null) return;
      const yy = y(v); if (yy == null) return;
      const d = Math.abs(yy - my);
      if (d < bestD) { bestD = d; best = v; }
    });
    if (best == null) return { time: t, price: p };
    magnet = { x: x(bar.time), y: y(best) };
    return { time: bar.time, price: best };
  }

  function setTool(t) {
    tool = t; selected = null; draft = null; ghost = null;
    syncPointerMode();
    if (onToolChange) onToolChange(t);
    render();
  }
  function onTool(fn) { onToolChange = fn; }

  // When a draw tool is active we capture pointer + freeze chart pan.
  // In cursor mode the layer is transparent to events unless hovering a drawing.
  // While capturing, the chart can't see the mouse, so we drive its native
  // crosshair ourselves (syncCrosshair) — that keeps the date/time label on the
  // time axis and the price label on the price axis in every mode.
  let capturing = false;
  function syncPointerMode() {
    const cap = tool !== 'cursor' || !!hover || !!drag || !!draft;
    canvas.style.pointerEvents = cap ? 'auto' : 'none';
    if (tool === 'cursor' && !drag) chart.applyOptions({ handleScroll: true, handleScale: true });
    else chart.applyOptions({ handleScroll: false, handleScale: false });
    if (cap !== capturing) {
      capturing = cap;
      // on release the chart sees the mouse again and takes the crosshair back
      if (cap) syncCrosshair(lastMouse.x, lastMouse.y);
      else chart.clearCrosshairPosition();
    }
  }

  function syncCrosshair(mx, my, ctrl) {
    if (!capturing) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (!inside && !drag && !draft) { chart.clearCrosshairPosition(); return; }
    if (mx < 0 || my < 0 || mx > w || my > h) { chart.clearCrosshairPosition(); return; }
    // with the magnet on, the chart crosshair itself jumps to the snapped candle point
    const m = magnetize(mx, my, ctrl === undefined ? ctrlHeld : ctrl);
    if (m.time == null || m.price == null) return;
    chart.setCrosshairPosition(m.price, m.time, series);
  }

  function startDrag(hit, mx, my) {
    selected = hit.item;
    pushUndo();
    const m0 = hit.item.p2 ? { x: (x(hit.item.p1.time) + x(hit.item.p2.time)) / 2,
      y: (y(hit.item.p1.price) + y(hit.item.p2.price)) / 2 } : null;
    let fixed = 'p1', free = 'p2';
    if (hit.item.p2 && x(hit.item.p2.time) < x(hit.item.p1.time)) { fixed = 'p2'; free = 'p1'; }
    drag = { item: hit.item, handle: hit.handle, mid0: m0, fixed, free,
      start: { mx, my },
      p1: { ...hit.item.p1 }, p2: hit.item.p2 ? { ...hit.item.p2 } : null };
    syncPointerMode();
  }

  // ---- touch ---------------------------------------------------------------
  // In cursor mode the drawing canvas ignores pointer events so the chart can pan
  // and pinch freely. A finger that lands ON a drawing (or one of its handles) takes
  // that gesture over instead: the drawing is dragged and the chart stays put. A
  // finger anywhere else deselects and goes to the chart. The canvas can never get
  // "stuck" capturing touches after a drag — hover state is cleared on release.
  function touchLocal(t) {
    const r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }
  // While a draw tool is armed (or a two-point drawing is half placed) the canvas
  // captures touches so taps can place points — but a finger DRAG there must still
  // pan the chart, otherwise the chart feels frozen. Pan by hand; a plain tap is left
  // alone and becomes the usual click that places a point.
  let tpan = null;
  function onTouchStart(e) {
    if (e.touches.length !== 1) { tpan = null; return; }
    if (tool !== 'cursor' || draft) {
      const t = e.touches[0];
      tpan = { sx: t.clientX, sy: t.clientY, lx: t.clientX, ly: t.clientY, moved: false };
      return;
    }
    const m = touchLocal(e.touches[0]);
    hitSlop = 12;
    const hit = hitTest(m.x, m.y);
    hitSlop = 0;
    if (!hit) { if (selected) { selected = null; render(); } return; }
    e.stopPropagation(); e.preventDefault();
    startDrag(hit, m.x, m.y);
    render();
  }
  function panByFinger(dx, dy) {
    const ts = chart.timeScale();
    const lr = ts.getVisibleLogicalRange();
    const sp = ts.options().barSpacing || 6;
    if (lr && dx) {
      const bars = -dx / sp;
      ts.setVisibleLogicalRange({ from: lr.from + bars, to: lr.to + bars });
    }
    if (dy) ChartView.panPrice(dy);
  }
  function onTouchMove(e) {
    if (tpan && e.touches.length === 1) {
      const t = e.touches[0];
      if (!tpan.moved && Math.hypot(t.clientX - tpan.sx, t.clientY - tpan.sy) > 8) tpan.moved = true;
      if (tpan.moved) {
        panByFinger(t.clientX - tpan.lx, t.clientY - tpan.ly);
        e.preventDefault(); e.stopPropagation();
      }
      tpan.lx = t.clientX; tpan.ly = t.clientY;
      return;
    }
    if (!drag) return;
    e.stopPropagation(); e.preventDefault();
    const t = e.touches[0]; if (!t) return;
    onMove({ clientX: t.clientX, clientY: t.clientY, ctrlKey: false });
  }
  function onTouchEnd(e) {
    if (tpan) {
      if (tpan.moved && e && e.cancelable) e.preventDefault();   // a pan must not also place a point
      tpan = null;
    }
    if (drag) onUp();
    if (hover) { hover = null; syncPointerMode(); render(); }   // no stale mouse-hover on touch screens
  }

  function onDown(e) {
    if (e.button !== 0) return; // ignore right/middle click
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    // the press belongs to the drawing layer — don't let it bubble to the chart-body
    // vertical-pan handler (app.js) or start a chart drag
    e.stopPropagation();
    const snapped = magnetize(mx, my, e.ctrlKey || e.metaKey);
    const time = snapped.time, price = snapped.price;
    if (time == null || price == null) return;

    // --- cursor mode: select / start drag ---
    if (tool === 'cursor') {
      const hit = hitTest(mx, my);
      if (hit) {
        startDrag(hit, mx, my);
        e.preventDefault();
      } else { selected = null; }
      render(); return;
    }

    // --- single-click tools: place immediately at the cursor ---
    if (tool === 'hline' || tool === 'hray' || tool === 'vline') {
      ghost = null;
      const item = { id: idSeq++, type: tool, p1: { time, price },
        color: defaultColor, width: defaultWidth, style: defaultStyle };
      pushUndo(); items.push(item); selected = item; magnet = null; setTool('cursor'); render(); saveDrawings(); return;
    }

    // --- two-point tools: click-click paradigm ---
    // First click locks p1; second click finalizes p2.
    if (draft) {
      // Second click: lock p2 at this exact position and commit.
      draft.p2 = { time, price };
      pushUndo(); items.push(draft); selected = draft;
      draft = null; magnet = null; setTool('cursor'); render(); saveDrawings(); return;
    }
    // First click: lock p1, start previewing p2 on mouse move.
    draft = { id: idSeq++, type: tool, p1: { time, price }, p2: { time, price },
      color: defaultColor, width: defaultWidth, style: defaultStyle };
    e.preventDefault();
  }

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    lastMouse = { x: mx, y: my };
    ctrlHeld = e.ctrlKey || e.metaKey;
    syncCrosshair(mx, my, ctrlHeld);

    // two-point draft: update the live preview of p2
    if (draft) {
      const m = magnetize(mx, my, e.ctrlKey || e.metaKey);
      if (m.time != null && m.price != null) { draft.p2 = { time: m.time, price: m.price }; render(); }
      return;
    }

    // cursor drag (move / resize a drawing)
    if (drag) {
      const dx = mx - drag.start.mx, dy = my - drag.start.my;
      if (drag.handle === 'p1' || drag.handle === 'p2') {
        const m = magnetize(mx, my, e.ctrlKey || e.metaKey);
        if (m.time != null && m.price != null) drag.item[drag.handle] = { time: m.time, price: m.price };
      } else if (drag.handle === 'mid' && drag.mid0) {
        // middle dot: positions the midpoint while the LEFT end stays locked — only the
        // right end moves (it mirrors the left end through the midpoint). With Ctrl the
        // midpoint itself snaps to a candle point.
        magnetize(mx, my, e.ctrlKey || e.metaKey);
        const hasMag = magnet && magnet.x != null && magnet.y != null;
        const tx = hasMag ? magnet.x : drag.mid0.x + dx;
        const ty = hasMag ? magnet.y : drag.mid0.y + dy;
        const fx = x(drag[drag.fixed === 'p1' ? 'p1' : 'p2'].time), fy = y(drag[drag.fixed === 'p1' ? 'p1' : 'p2'].price);
        const t = toTime(2 * tx - fx), pr = toPrice(2 * ty - fy);
        if (t != null && pr != null) drag.item[drag.free] = { time: t, price: pr };
      } else {
        moveByPixels(drag.item, drag.p1, drag.p2, dx, dy);
      }
      render(); return;
    }

    // single-click tools: show a ghost (hover preview) while the tool is armed
    if (tool === 'hline' || tool === 'hray' || tool === 'vline') {
      const m = magnetize(mx, my, e.ctrlKey || e.metaKey);
      ghost = (m.time != null && m.price != null)
        ? { type: tool, p1: { time: m.time, price: m.price }, color: defaultColor, width: defaultWidth, style: defaultStyle }
        : null;
      render(); return;
    }

    if (tool === 'cursor') {
      updateHover({ x: mx, y: my });
      if (hover) render();
    } else if (inside) render();
  }

  function onUp() {
    // Two-point drafts are committed on the second click (onDown), NOT on mouseup.
    // mouseup only releases cursor-mode drags.
    if (drag) {
      if (undoStack.length && undoStack[undoStack.length - 1] === snap()) undoStack.pop();  // nothing moved
      saveDrawings(); drag = null; magnet = null; syncPointerMode(); render();
    }
  }

  function moveByPixels(item, p1, p2, dx, dy) {
    const nx1 = x(p1.time) + dx, ny1 = y(p1.price) + dy;
    const t1 = toTime(nx1), pr1 = toPrice(ny1);
    if (t1 != null && pr1 != null) item.p1 = { time: t1, price: pr1 };
    if (p2) {
      const nx2 = x(p2.time) + dx, ny2 = y(p2.price) + dy;
      const t2 = toTime(nx2), pr2 = toPrice(ny2);
      if (t2 != null && pr2 != null) item.p2 = { time: t2, price: pr2 };
    }
  }

  function updateHover(m) {
    if (!m) return;
    const h = hitTest(m.x, m.y);
    const newHover = h ? h.item : null;
    if (newHover !== hover) { hover = newHover; syncPointerMode(); render(); }
    canvas.style.cursor = h ? (h.handle === 'body' || h.handle === 'mid' ? 'move' : 'pointer') : 'default';
  }

  function hitTest(mx, my) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.type === 'hline' || it.type === 'hray') {
        const yy = y(it.p1.price), xx = x(it.p1.time);
        const sx = xx == null ? 0 : xx;
        if (yy != null && Math.abs(my - yy) <= HIT + hitSlop && mx >= sx - HIT - hitSlop) return { item: it, handle: 'body' };
        continue;
      }
      if (it.type === 'vline') {
        const xx = x(it.p1.time);
        if (xx != null && Math.abs(mx - xx) <= HIT + hitSlop) return { item: it, handle: 'body' };
        continue;
      }
      const x1 = x(it.p1.time), y1 = y(it.p1.price);
      const x2 = x(it.p2.time), y2 = y(it.p2.price);
      if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
      if (near(mx, my, x1, y1)) return { item: it, handle: 'p1' };
      if (near(mx, my, x2, y2)) return { item: it, handle: 'p2' };
      if (it.type === 'trend' && it === selected && near(mx, my, (x1 + x2) / 2, (y1 + y2) / 2))
        return { item: it, handle: 'mid' };
      if (it.type === 'trend' && distToSeg(mx, my, x1, y1, x2, y2) <= HIT + hitSlop)
        return { item: it, handle: 'body' };
      if (it.type === 'rect') {
        const onEdge = pointNearRect(mx, my, x1, y1, x2, y2, HIT + hitSlop);
        if (onEdge) return { item: it, handle: 'body' };
      }
    }
    return null;
  }

  function near(mx, my, px, py) { return Math.hypot(mx - px, my - py) <= HIT + 2 + hitSlop; }
  function distToSeg(px, py, x1, y1, x2, y2) {
    const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D, len = C * C + D * D;
    let t = len ? dot / len : -1; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * C), py - (y1 + t * D));
  }
  function pointNearRect(px, py, x1, y1, x2, y2, tol) {
    const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
    const insideX = px >= l - tol && px <= r + tol, insideY = py >= t - tol && py <= b + tol;
    const nearV = (Math.abs(px - l) <= tol || Math.abs(px - r) <= tol) && insideY;
    const nearH = (Math.abs(py - t) <= tol || Math.abs(py - b) <= tol) && insideX;
    return nearV || nearH;
  }

  // Ctrl pressed / released: re-evaluate the snap straight away (crosshair + preview)
  function refreshMagnet() {
    if (!capturing || !inside) { magnet = null; render(); return; }
    const r = canvas.getBoundingClientRect();
    onMove({ clientX: r.left + lastMouse.x, clientY: r.top + lastMouse.y, ctrlKey: ctrlHeld });
  }
  function onKeyUp(e) {
    if (e.key === 'Control' || e.key === 'Meta') { ctrlHeld = false; refreshMagnet(); }
  }

  function onKey(e) {
    if ((e.key === 'Control' || e.key === 'Meta') && !ctrlHeld) { ctrlHeld = true; refreshMagnet(); }
    const tag = document.activeElement && document.activeElement.tagName;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      e.preventDefault(); undo(); return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      pushUndo(); items = items.filter((d) => d !== selected); selected = null; render(); saveDrawings();
    }
    if (e.key === 'Escape') { draft = null; ghost = null; setTool('cursor'); }
  }

  function deleteSelected() { if (selected) { pushUndo(); items = items.filter((d) => d !== selected); selected = null; render(); saveDrawings(); } }
  function clearAll() { if (items.length) pushUndo(); items = []; selected = null; draft = null; ghost = null; render(); saveDrawings(); }

  // ---- right-click editor hooks --------------------------------------------
  function selectAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const hit = hitTest(clientX - r.left, clientY - r.top);
    selected = hit ? hit.item : null;
    render();
    return selected;
  }
  function getSelected() {
    return selected ? { type: selected.type, color: selected.color,
      width: selected.width || defaultWidth, style: selected.style || 'solid',
      border: selected.border !== false, fill: selected.fill !== false } : null;
  }
  function setSelectedColor(color) {
    if (!selected) return;
    pushUndo(); selected.color = color; defaultColor = color; render(); saveDrawings();
  }
  // line style ('solid' | 'dashed' | 'dotted') and, for rectangles, border / fill on-off
  function setSelectedProp(patch) {
    if (!selected) return;
    pushUndo(); Object.assign(selected, patch);
    if (patch.style) defaultStyle = patch.style;
    render(); saveDrawings();
  }
  function setSelectedWidth(width) {
    if (!selected) return;
    pushUndo(); selected.width = width; defaultWidth = width; render(); saveDrawings();
  }

  // ---- render --------------------------------------------------------------
  function render() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // committed items + active draft (two-point preview) + hover ghost (single-click preview)
    const all = items.slice();
    if (draft) all.push(draft);
    if (ghost) all.push(ghost);
    all.forEach((it) => drawItem(it, it === selected, it === ghost || it === draft));
    if (magnet && magnet.x != null && magnet.y != null) {
      ctx.save();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = defaultColor; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(magnet.x, magnet.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  function drawItem(it, sel, isPreview) {
    ctx.lineWidth = it.width || defaultWidth;
    const lw = it.width || defaultWidth, st = it.style || "solid";
    const dash = st === "dashed" ? [lw * 4 + 2, lw * 3 + 2] : st === "dotted" ? [lw, lw * 2 + 1] : [];
    ctx.strokeStyle = it.color;
    // previews (ghost / draft) look exactly like the finished drawing
    ctx.globalAlpha = 1;
    ctx.setLineDash(dash);

    if (it.type === 'hline' || it.type === 'hray') {
      const yy = y(it.p1.price); if (yy == null) { ctx.globalAlpha = 1; ctx.setLineDash([]); return; }
      const xx = x(it.p1.time); const sx = xx == null ? 0 : xx;
      ctx.beginPath(); ctx.moveTo(sx, yy); ctx.lineTo(container.clientWidth, yy); ctx.stroke();
      if (showLabels) label(container.clientWidth - 60, yy, it.p1.price);
      if (sel) handle(sx, yy);
      ctx.globalAlpha = 1; ctx.setLineDash([]); return;
    }
    if (it.type === 'vline') {
      const xx = x(it.p1.time); if (xx == null) { ctx.globalAlpha = 1; ctx.setLineDash([]); return; }
      ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, container.clientHeight); ctx.stroke();
      if (sel) handle(xx, y(it.p1.price) ?? container.clientHeight / 2);
      ctx.globalAlpha = 1; ctx.setLineDash([]); return;
    }
    const x1 = x(it.p1.time), y1 = y(it.p1.price), x2 = x(it.p2.time), y2 = y(it.p2.price);
    if (x1 == null || x2 == null || y1 == null || y2 == null) { ctx.globalAlpha = 1; ctx.setLineDash([]); return; }
    if (it.type === 'trend') {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    } else if (it.type === 'rect') {
      if (it.fill !== false) { ctx.fillStyle = hexA(it.color, 0.10); ctx.fillRect(x1, y1, x2 - x1, y2 - y1); }
      if (it.border !== false) ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }
    if (sel) { handle(x1, y1); handle(x2, y2); if (it.type === 'trend') handle((x1 + x2) / 2, (y1 + y2) / 2); }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
  }

  function handle(px, py) {
    ctx.save();
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    ctx.fillStyle = CFG.THEME.drawHandle;
    ctx.strokeStyle = CFG.THEME.drawSel;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py, HANDLE_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function label(px, py, price) {
    const dec = price < 1 ? 5 : price < 100 ? 3 : 2;
    const txt = price.toFixed(dec);
    ctx.font = '10px Inter, sans-serif';
    const w = ctx.measureText(txt).width + 8;
    ctx.fillStyle = CFG.THEME.draw;
    ctx.fillRect(px, py - 8, w, 16);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, px + 4, py + 3);
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function setShowLabels(v) { showLabels = v; render(); }

  // ---- persistence (localStorage, one key per symbol) ---------------------
  // Drawings are anchored to {time, price}, so they survive timeframe switches,
  // replay, and reloads. Each symbol keeps its own set (ETH lines don't show on SOL).
  function storeKey(sym) { return CFG.STORE.drawings + '.' + sym; }

  function saveDrawings() {
    if (!symbol) return;
    try {
      const data = items.map(({ id, type, p1, p2, color, width, style, border, fill }) =>
        ({ id, type, p1, p2, color, width, style, border, fill }));
      localStorage.setItem(storeKey(symbol), JSON.stringify(data));
    } catch {}
  }

  function readDrawings(sym) {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey(sym)));
      return Array.isArray(saved) ? saved.filter((d) => d && d.type && d.p1) : [];
    } catch { return []; }
  }

  // Switch the active symbol: persist the current set, load that symbol's set.
  function setSymbol(sym) {
    if (!sym || sym === symbol) return;
    if (symbol) saveDrawings();
    symbol = sym;
    selected = null; draft = null; ghost = null; drag = null; hover = null;
    undoStack = [];
    items = readDrawings(sym).map((d) => ({ ...d }));
    idSeq = items.reduce((m, d) => Math.max(m, d.id || 0), 0) + 1;
    syncPointerMode();
    render();
  }

  // One-time move of the old single global key into a symbol's key.
  function migrateLegacy(ownerSymbol) {
    try {
      const legacy = localStorage.getItem(CFG.STORE.drawings);
      if (legacy == null) return;
      if (localStorage.getItem(storeKey(ownerSymbol)) == null) {
        localStorage.setItem(storeKey(ownerSymbol), legacy);
      }
      localStorage.removeItem(CFG.STORE.drawings);
    } catch {}
  }

  // One-time copy of drawings made on the old Bybit symbols ("SOLUSDT") onto
  // their MEXC perpetual ("SOLUSDT.P"), unless that symbol already has its own.
  function migrateToPerp() {
    try {
      CFG.SYMBOLS.forEach((sym) => {
        const old = localStorage.getItem(storeKey(sym.replace(/\.P$/, '')));
        if (old != null && localStorage.getItem(storeKey(sym)) == null) {
          localStorage.setItem(storeKey(sym), old);
        }
      });
    } catch {}
  }

  return { init, setTool, onTool, render, deleteSelected, clearAll,
    undo, selectAt, getSelected, setSelectedColor, setSelectedWidth, setSelectedProp, setShowLabels,
    saveDrawings, setSymbol, migrateLegacy, migrateToPerp,
    get tool() { return tool; }, get count() { return items.length; },
    get hasSelection() { return !!selected; } };
})();
