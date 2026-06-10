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

  // last-used style — new drawings inherit it (updated by the right-click editor)
  let defaultColor = CFG.THEME.draw;
  let defaultWidth = CFG.DRAW_DEFAULT_WIDTH;
  let showLabels = true; // toggled via Settings → "Show price labels"

  const HANDLE_R = 5;
  const HIT = 7;

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
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('mousemove', trackMouse);
    canvas.addEventListener('mouseenter', () => { inside = true; });
    canvas.addEventListener('mouseleave', () => { inside = false; ghost = null; render(); });
    window.addEventListener('keydown', onKey);

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

  function setTool(t) {
    tool = t; selected = null; draft = null; ghost = null;
    syncPointerMode();
    if (onToolChange) onToolChange(t);
    render();
  }
  function onTool(fn) { onToolChange = fn; }

  // When a draw tool is active we capture pointer + freeze chart pan.
  // In cursor mode the layer is transparent to events unless hovering a drawing.
  let nativeCrosshairOn = true;
  function syncPointerMode() {
    const capturing = tool !== 'cursor' || !!hover;
    canvas.style.pointerEvents = capturing ? 'auto' : 'none';
    if (tool === 'cursor') chart.applyOptions({ handleScroll: true, handleScale: true });
    else chart.applyOptions({ handleScroll: false, handleScale: false });
    if (capturing === nativeCrosshairOn) {
      nativeCrosshairOn = !capturing;
      ChartView.setCrosshairMode(nativeCrosshairOn);
    }
  }

  function onDown(e) {
    if (e.button !== 0) return; // ignore right/middle click
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const time = toTime(mx), price = toPrice(my);
    if (time == null || price == null) return;

    // --- cursor mode: select / start drag ---
    if (tool === 'cursor') {
      const hit = hitTest(mx, my);
      if (hit) {
        selected = hit.item;
        drag = { item: hit.item, handle: hit.handle,
          start: { mx, my },
          p1: { ...hit.item.p1 }, p2: hit.item.p2 ? { ...hit.item.p2 } : null };
        e.preventDefault();
      } else { selected = null; }
      render(); return;
    }

    // --- single-click tools: place immediately at the cursor ---
    if (tool === 'hline' || tool === 'hray' || tool === 'vline') {
      ghost = null;
      const item = { id: idSeq++, type: tool, p1: { time, price },
        color: defaultColor, width: defaultWidth };
      items.push(item); selected = item; setTool('cursor'); render(); return;
    }

    // --- two-point tools: click-click paradigm ---
    // First click locks p1; second click finalizes p2.
    if (draft) {
      // Second click: lock p2 at this exact position and commit.
      draft.p2 = { time, price };
      items.push(draft); selected = draft;
      draft = null; setTool('cursor'); render(); return;
    }
    // First click: lock p1, start previewing p2 on mouse move.
    draft = { id: idSeq++, type: tool, p1: { time, price }, p2: { time, price },
      color: defaultColor, width: defaultWidth };
    e.preventDefault();
  }

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    lastMouse = { x: mx, y: my };

    // two-point draft: update the live preview of p2
    if (draft) {
      const t = toTime(mx), p = toPrice(my);
      if (t != null && p != null) { draft.p2 = { time: t, price: p }; render(); }
      return;
    }

    // cursor drag (move / resize a drawing)
    if (drag) {
      const dx = mx - drag.start.mx, dy = my - drag.start.my;
      if (drag.handle === 'p1' || drag.handle === 'p2') {
        const t = toTime(mx), p = toPrice(my);
        if (t != null && p != null) drag.item[drag.handle] = { time: t, price: p };
      } else {
        moveByPixels(drag.item, drag.p1, drag.p2, dx, dy);
      }
      render(); return;
    }

    // single-click tools: show a ghost (hover preview) while the tool is armed
    if (tool === 'hline' || tool === 'hray' || tool === 'vline') {
      const t = toTime(mx), p = toPrice(my);
      ghost = (t != null && p != null)
        ? { type: tool, p1: { time: t, price: p }, color: defaultColor, width: defaultWidth }
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
    drag = null;
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
    canvas.style.cursor = h ? (h.handle === 'body' ? 'move' : 'pointer') : 'default';
  }

  function hitTest(mx, my) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.type === 'hline' || it.type === 'hray') {
        const yy = y(it.p1.price), xx = x(it.p1.time);
        const sx = xx == null ? 0 : xx;
        if (yy != null && Math.abs(my - yy) <= HIT && mx >= sx - HIT) return { item: it, handle: 'body' };
        continue;
      }
      if (it.type === 'vline') {
        const xx = x(it.p1.time);
        if (xx != null && Math.abs(mx - xx) <= HIT) return { item: it, handle: 'body' };
        continue;
      }
      const x1 = x(it.p1.time), y1 = y(it.p1.price);
      const x2 = x(it.p2.time), y2 = y(it.p2.price);
      if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
      if (near(mx, my, x1, y1)) return { item: it, handle: 'p1' };
      if (near(mx, my, x2, y2)) return { item: it, handle: 'p2' };
      if (it.type === 'trend' && distToSeg(mx, my, x1, y1, x2, y2) <= HIT)
        return { item: it, handle: 'body' };
      if (it.type === 'rect') {
        const onEdge = pointNearRect(mx, my, x1, y1, x2, y2, HIT);
        if (onEdge) return { item: it, handle: 'body' };
      }
    }
    return null;
  }

  function near(mx, my, px, py) { return Math.hypot(mx - px, my - py) <= HIT + 2; }
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

  function onKey(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      items = items.filter((d) => d !== selected); selected = null; render();
    }
    if (e.key === 'Escape') { draft = null; ghost = null; setTool('cursor'); }
  }

  function deleteSelected() { if (selected) { items = items.filter((d) => d !== selected); selected = null; render(); } }
  function clearAll() { items = []; selected = null; draft = null; ghost = null; render(); }

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
      width: selected.width || defaultWidth } : null;
  }
  function setSelectedColor(color) {
    if (!selected) return;
    selected.color = color; defaultColor = color; render();
  }
  function setSelectedWidth(width) {
    if (!selected) return;
    selected.width = width; defaultWidth = width; render();
  }

  // ---- render --------------------------------------------------------------
  function render() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    drawCrosshair();

    // committed items + active draft (two-point preview) + hover ghost (single-click preview)
    const all = items.slice();
    if (draft) all.push(draft);
    if (ghost) all.push(ghost);
    all.forEach((it) => drawItem(it, it === selected, it === ghost || it === draft));
  }

  function drawCrosshair() {
    if (!inside) return;
    if (tool === 'cursor' && !draft && !drag && !hover) return;
    const { x: mx, y: my } = lastMouse;
    ctx.save();
    ctx.strokeStyle = 'rgba(178,181,190,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(mx, 0); ctx.lineTo(mx, container.clientHeight);
    ctx.moveTo(0, my); ctx.lineTo(container.clientWidth, my);
    ctx.stroke();
    ctx.restore();
  }

  function drawItem(it, sel, isPreview) {
    ctx.lineWidth = it.width || defaultWidth;
    ctx.strokeStyle = it.color;
    // previews (ghost / draft) are drawn slightly transparent + dashed
    ctx.globalAlpha = isPreview ? 0.6 : 1;
    ctx.setLineDash(isPreview ? [5, 4] : []);

    if (it.type === 'hline' || it.type === 'hray') {
      const yy = y(it.p1.price); if (yy == null) { ctx.globalAlpha = 1; ctx.setLineDash([]); return; }
      const xx = x(it.p1.time); const sx = xx == null ? 0 : xx;
      ctx.beginPath(); ctx.moveTo(sx, yy); ctx.lineTo(container.clientWidth, yy); ctx.stroke();
      if (!isPreview && showLabels) label(container.clientWidth - 60, yy, it.p1.price);
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
      if (isPreview) { handle(x1, y1); } // show locked p1 while placing p2
    } else if (it.type === 'rect') {
      ctx.fillStyle = hexA(it.color, isPreview ? 0.05 : 0.10);
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }
    if (sel) { handle(x1, y1); handle(x2, y2); }
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

  return { init, setTool, onTool, render, deleteSelected, clearAll,
    selectAt, getSelected, setSelectedColor, setSelectedWidth, setShowLabels,
    get tool() { return tool; }, get count() { return items.length; },
    get hasSelection() { return !!selected; } };
})();
