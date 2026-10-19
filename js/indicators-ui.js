// indicators-ui.js — IndicatorManager: registry + dropdown panel + legend + badge
// Math lives in indicators.js (sma / ema / maLineData). This module owns the
// indicator instances, their chart series handles, the Indicators dropdown UI,
// the top-left legend watermark, and sessionStorage persistence.

const IndicatorManager = (() => {
  let chart, button, badgeEl, chartHost, getCandles;
  let panel, legendEl, cfgPopup;
  let instances = [];            // [{id,type,visible,params}]
  const handles = new Map();     // id -> ChartView line handle (ma only)
  let idSeq = 1;
  let lastCandles = [];

  // registry of indicator types (extend here to add more)
  const REGISTRY = {
    ma: {
      name: 'Moving Average',
      label: (p) => `${p.maType} ${p.period}`,
      defaults: (n) => ({ period: 14, maType: 'SMA',
        color: CFG.MA_COLORS[n % CFG.MA_COLORS.length], lineWidth: 1 }),
    },
    rsi: {
      name: 'RSI',
      label: (p) => `RSI ${p.period}`,
      defaults: () => ({ period: 14, color: '#7e57c2', lineWidth: 1,
        overbought: 70, oversold: 30 }),
    },
    macd: {
      name: 'MACD',
      label: (p) => `MACD ${p.fast},${p.slow},${p.signal}`,
      defaults: () => ({ fast: 12, slow: 26, signal: 9, lineWidth: 1,
        macdColor: '#2196f3', signalColor: '#ff9800' }),
    },
    volume: { name: 'Volume', label: () => 'Volume', defaults: () => ({}) },
    fvg: {
      name: '⚡ VolHi / FVG',
      label: () => '⚡ VolHi/FVG',
      defaults: () => ({ ...FVGIndicator.getDefaults() }),
    },
  };

  const SUB_PANE_H = 120;   // height of each stacked oscillator sub-pane (RSI / MACD)

  // Oscillators (RSI, MACD) each get their own stacked sub-pane below the price
  // pane. Allocate the lowest free index ≥ 1 so a lone oscillator sits in pane 1
  // (no empty pane), and freed indices get reused after a removal.
  function allocPane() {
    const used = new Set(instances.filter((i) => i.pane != null).map((i) => i.pane));
    let p = 1;
    while (used.has(p)) p++;
    return p;
  }

  // ---- init ----------------------------------------------------------------
  function init(opts) {
    chart = opts.chart; button = opts.button; badgeEl = opts.badge;
    chartHost = opts.chartHost; getCandles = opts.getVisibleCandles;

    buildPanel();
    buildLegend();

    chart.subscribeCrosshairMove((param) => updateLegend(param));
    document.addEventListener('click', (e) => {
      if (panel.style.display === 'block' &&
          !panel.contains(e.target) && e.target !== button && !button.contains(e.target)) {
        panel.style.display = 'none';
      }
      if (cfgPopup && cfgPopup.style.display === 'block' && !cfgPopup.contains(e.target)) {
        cfgPopup.style.display = 'none';
      }
    });
    button.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(); });
    // When any OTHER toolbar dropdown opens, close this one + its config popup (no stacking).
    document.addEventListener('cr:menu-open', (e) => {
      if (e.detail !== 'indicators') {
        panel.style.display = 'none';
        if (cfgPopup) cfgPopup.style.display = 'none';
      }
    });

    restore();
  }

  // ---- persistence ---------------------------------------------------------
  // Suppressed during a Watch Replay indicator swap so the strategy's temporary
  // set never overwrites the user's saved indicators locally or in Supabase.
  let suspendPersist = false;
  function persist() {
    if (suspendPersist) return;
    const slim = instances.map(({ id, type, visible, params }) => ({ id, type, visible, params }));
    try { localStorage.setItem(CFG.STORE.indicators, JSON.stringify(slim)); } catch {}
  }
  function restore() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(CFG.STORE.indicators)); } catch {}
    if (Array.isArray(saved)) {
      // User had explicitly saved state — respect it even when empty (user removed all indicators)
      saved.forEach((s) => materialize(s.type, s.params, s.visible, s.id));
      if (saved.length) idSeq = Math.max(idSeq, ...saved.map((s) => s.id + 1));
    } else {
      // null / corrupt — first launch, apply default (Volume only)
      add('volume', {});
    }
    renderPanel(); refreshBadge();
  }

  // ---- instance lifecycle --------------------------------------------------
  function materialize(type, params, visible, id) {
    const inst = { id: id != null ? id : idSeq++, type, visible: visible !== false,
      params: { ...REGISTRY[type].defaults(instances.length), ...params } };
    if (type === 'ma') {
      const h = ChartView.addLineIndicator({ color: inst.params.color, lineWidth: inst.params.lineWidth });
      h.setVisible(inst.visible);
      handles.set(inst.id, h);
    } else if (type === 'rsi') {
      inst.pane = allocPane();
      const h = ChartView.addPaneSeries({ color: inst.params.color, lineWidth: inst.params.lineWidth }, inst.pane);
      h.setVisible(inst.visible);
      addRsiLevelLines(h, inst.params);
      handles.set(inst.id, h);
      ChartView.setPaneHeight(inst.pane, SUB_PANE_H);
    } else if (type === 'macd') {
      inst.pane = allocPane();
      const h = makeMacdHandle(inst.pane, inst.params);
      h.setVisible(inst.visible);
      handles.set(inst.id, h);
      ChartView.setPaneHeight(inst.pane, SUB_PANE_H);
    } else if (type === 'volume') {
      ChartView.toggleVolume(inst.visible);
    } else if (type === 'fvg') {
      FVGIndicator.setActive(inst.visible);
    }
    instances.push(inst);
    return inst;
  }

  // overbought / oversold dashed reference lines on an RSI pane series
  function addRsiLevelLines(h, params) {
    const dashed = LightweightCharts.LineStyle.Dashed;
    h.obLine = h.series.createPriceLine({ price: params.overbought, color: '#ef5350',
      lineWidth: 1, lineStyle: dashed, axisLabelVisible: true, title: 'OB' });
    h.osLine = h.series.createPriceLine({ price: params.oversold, color: '#26a69a',
      lineWidth: 1, lineStyle: dashed, axisLabelVisible: true, title: 'OS' });
  }
  function removeRsiLevelLines(h) {
    if (h.obLine) { h.series.removePriceLine(h.obLine); h.obLine = null; }
    if (h.osLine) { h.series.removePriceLine(h.osLine); h.osLine = null; }
  }

  // Composite MACD pane handle: histogram (drawn first → behind), then the MACD
  // and signal lines, plus a dashed zero reference. Exposes the same handle API
  // the manager uses for other indicators (setData/applyOptions/setVisible/remove).
  // setData expects { macd, signal, hist } arrays from macdLineData().
  function makeMacdHandle(pane, params) {
    const hist = ChartView.addPaneHistogram({}, pane);
    const macd = ChartView.addPaneSeries({ color: params.macdColor, lineWidth: params.lineWidth }, pane);
    const signal = ChartView.addPaneSeries({ color: params.signalColor, lineWidth: params.lineWidth }, pane);
    const zero = macd.series.createPriceLine({ price: 0, color: 'rgba(120,120,120,0.6)',
      lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: false });
    return {
      series: macd.series,
      setData: (d) => {
        d = d || {};
        hist.setData(d.hist || []);
        macd.setData(d.macd || []);
        signal.setData(d.signal || []);
      },
      applyOptions: (o) => {
        if (o.macdColor != null || o.lineWidth != null)
          macd.applyOptions({ color: o.macdColor, lineWidth: o.lineWidth });
        if (o.signalColor != null || o.lineWidth != null)
          signal.applyOptions({ color: o.signalColor, lineWidth: o.lineWidth });
      },
      setVisible: (v) => { hist.setVisible(v); macd.setVisible(v); signal.setVisible(v); },
      remove: () => { macd.series.removePriceLine(zero); hist.remove(); macd.remove(); signal.remove(); },
    };
  }

  function add(type, params) {
    if (type === 'volume' && instances.some((i) => i.type === 'volume')) return;
    materialize(type, params || {});
    recompute(lastCandles);
    renderPanel(); refreshBadge(); persist();
  }

  function remove(id) {
    const inst = instances.find((i) => i.id === id); if (!inst) return;
    if (inst.type === 'ma') { handles.get(id).remove(); handles.delete(id); }
    else if (inst.type === 'rsi') {
      const h = handles.get(id); removeRsiLevelLines(h); h.remove(); handles.delete(id);
    } else if (inst.type === 'macd') {
      handles.get(id).remove(); handles.delete(id);
    } else if (inst.type === 'volume') {
      ChartView.toggleVolume(false);
    } else if (inst.type === 'fvg') {
      FVGIndicator.setActive(false);
    }
    instances = instances.filter((i) => i.id !== id);
    renderPanel(); refreshBadge(); updateLegend(null); persist();
  }

  // remove every active indicator (right-click → Remove All Indicators)
  function removeAll() {
    instances.slice().forEach((i) => remove(i.id));
  }

  // ---- snapshot / restore (used by Strategy Watch Replay) ------------------
  // snapshot() captures the current active set; restoreSet(list) replaces the
  // active set with `list` (each {type, visible, params}). Together they let the
  // strategy temporarily show its own indicators during replay, then put the
  // user's set back on exit.
  function snapshot() {
    return instances.map(({ type, visible, params }) => ({ type, visible, params: { ...params } }));
  }
  function restoreSet(list, opts) {
    const skipPersist = !!(opts && opts.skipPersist);
    if (skipPersist) suspendPersist = true;
    removeAll();
    (list || []).forEach((s) => materialize(s.type, { ...s.params }, s.visible !== false));
    recompute(lastCandles);
    renderPanel(); refreshBadge();
    if (skipPersist) suspendPersist = false; else persist();
  }

  function setVisible(id, v) {
    const inst = instances.find((i) => i.id === id); if (!inst) return;
    inst.visible = v;
    if (inst.type === 'ma' || inst.type === 'rsi' || inst.type === 'macd') handles.get(id).setVisible(v);
    else if (inst.type === 'volume') ChartView.toggleVolume(v);
    else if (inst.type === 'fvg') FVGIndicator.setActive(v);
    recompute(lastCandles);
    renderPanel(); refreshBadge(); updateLegend(null); persist();
  }

  function updateParams(id, patch) {
    const inst = instances.find((i) => i.id === id); if (!inst) return;
    Object.assign(inst.params, patch);
    if (inst.type === 'ma') {
      handles.get(id).applyOptions({ color: inst.params.color, lineWidth: inst.params.lineWidth });
    } else if (inst.type === 'rsi') {
      const h = handles.get(id);
      h.applyOptions({ color: inst.params.color, lineWidth: inst.params.lineWidth });
      removeRsiLevelLines(h); addRsiLevelLines(h, inst.params);
    } else if (inst.type === 'macd') {
      handles.get(id).applyOptions({ macdColor: inst.params.macdColor,
        signalColor: inst.params.signalColor, lineWidth: inst.params.lineWidth });
    } else if (inst.type === 'fvg') {
      FVGIndicator.updateParams(inst.params);
    }
    recompute(lastCandles);
    renderPanel(); persist();
  }

  // ---- recompute (called by replay + on data load) -------------------------
  function recompute(candles, ivSecs) {
    lastCandles = candles || [];
    instances.forEach((inst) => {
      if (inst.type === 'ma') {
        const h = handles.get(inst.id);
        h.setData(inst.visible ? maLineData(lastCandles, inst.params.period, inst.params.maType) : []);
      } else if (inst.type === 'rsi') {
        const h = handles.get(inst.id);
        h.setData(inst.visible ? rsiLineData(lastCandles, inst.params.period) : []);
      } else if (inst.type === 'macd') {
        const h = handles.get(inst.id);
        h.setData(inst.visible
          ? macdLineData(lastCandles, inst.params.fast, inst.params.slow, inst.params.signal)
          : { macd: [], signal: [], hist: [] });
      } else if (inst.type === 'fvg' && inst.visible) {
        FVGIndicator.compute(lastCandles, ivSecs);
      }
    });
    updateLegend(null);
  }

  // ---- badge ---------------------------------------------------------------
  function refreshBadge() {
    const n = instances.length;
    badgeEl.textContent = n ? `(${n})` : '';
  }

  // ---- legend watermark (top-left of chart pane) — interactive -------------
  // Each row shows the indicator name + live value plus an eye (toggle on the
  // chart) and, for MAs, a gear that opens the settings popup. Like TradingView.
  function buildLegend() {
    legendEl = document.createElement('div');
    legendEl.className = 'chart-legend';
    chartHost.appendChild(legendEl);
    legendEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]'); if (!btn) return;
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const inst = instances.find((i) => i.id === id); if (!inst) return;
      if (btn.dataset.act === 'eye') setVisible(id, !inst.visible);
      else if (btn.dataset.act === 'gear') openConfigPopup(inst, btn);
      else if (btn.dataset.act === 'remove') remove(id);
    });
  }

  // Legend rows show only the indicator NAME + controls — no live crosshair value.
  // (Live values made the row width change on every mouse move, so the ✕/eye/gear
  // buttons kept shifting and were hard to click. Names are static → buttons stay put.)
  function updateLegend() {
    const rows = instances.map((inst) => {
      let name, color;
      if (inst.type === 'ma') { name = REGISTRY.ma.label(inst.params); color = inst.params.color; }
      else if (inst.type === 'rsi') { name = REGISTRY.rsi.label(inst.params); color = inst.params.color; }
      else if (inst.type === 'macd') { name = REGISTRY.macd.label(inst.params); color = inst.params.macdColor; }
      else if (inst.type === 'fvg') { name = REGISTRY.fvg.label(); color = 'var(--text-dim)'; }
      else { name = 'Vol'; color = 'var(--text-dim)'; }
      const gear = (inst.type === 'ma' || inst.type === 'rsi' || inst.type === 'macd' || inst.type === 'fvg')
        ? `<button class="lg-ic" data-act="gear" data-id="${inst.id}" title="Settings">⚙</button>` : '';
      return `<div class="lg-row${inst.visible ? '' : ' lg-off'}">` +
        `<span class="lg-name" style="color:${color}">${name}</span>` +
        `<span class="lg-ctrls">` +
        `<button class="lg-ic" data-act="eye" data-id="${inst.id}" title="Show/Hide">${inst.visible ? '👁' : '🚫'}</button>` +
        gear +
        `<button class="lg-ic" data-act="remove" data-id="${inst.id}" title="Remove">✕</button>` +
        `</span></div>`;
    });
    legendEl.innerHTML = rows.join('');
  }

  // ---- dropdown panel ------------------------------------------------------
  function buildPanel() {
    panel = document.createElement('div');
    panel.className = 'ind-panel';
    panel.style.display = 'none';
    panel.innerHTML =
      `<input class="ind-search" type="text" placeholder="Search indicators…" />` +
      `<div class="ind-add"></div>` +
      `<div class="ind-sep"></div>` +
      `<div class="ind-active"></div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.querySelector('.ind-search').addEventListener('input', renderPanel);
  }

  function togglePanel() {
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    // Opening this dropdown closes every other toolbar dropdown so they never stack.
    document.dispatchEvent(new CustomEvent('cr:menu-open', { detail: 'indicators' }));
    const r = button.getBoundingClientRect();
    panel.style.left = r.left + 'px';
    panel.style.top = (r.bottom + 4) + 'px';
    panel.style.display = 'block';
    renderPanel();
  }

  function renderPanel() {
    if (!panel || panel.style.display === 'none') { return; }
    const q = panel.querySelector('.ind-search').value.trim().toLowerCase();

    // available types to add
    const addEl = panel.querySelector('.ind-add');
    addEl.innerHTML = '';
    Object.entries(REGISTRY).forEach(([type, def]) => {
      if (q && !def.name.toLowerCase().includes(q)) return;
      const row = document.createElement('div');
      row.className = 'ind-addrow';
      row.innerHTML = `<span>${def.name}</span><span class="ind-plus">＋</span>`;
      row.onclick = () => add(type, {});
      addEl.appendChild(row);
    });

    // active instances
    const actEl = panel.querySelector('.ind-active');
    actEl.innerHTML = instances.length ? '' : '<div class="ind-empty">No active indicators</div>';
    instances.forEach((inst) => {
      const def = REGISTRY[inst.type];
      const row = document.createElement('div');
      row.className = 'ind-row';
      const nameColor = (inst.type === 'ma' || inst.type === 'rsi') ? inst.params.color
        : (inst.type === 'macd' ? inst.params.macdColor : '');
      const hasGear  = nameColor || inst.type === 'fvg';
      row.innerHTML =
        `<span class="ind-name" style="${nameColor ? 'color:' + nameColor : ''}">${def.label(inst.params)}</span>` +
        `<span class="ind-actions">` +
        (hasGear ? `<button class="ind-ic ind-gear" title="Settings">⚙</button>` : '') +
        `<button class="ind-ic ind-eye" title="Toggle">${inst.visible ? '👁' : '🚫'}</button>` +
        `<button class="ind-ic ind-x" title="Remove">✕</button>` +
        `</span>`;
      const gear = row.querySelector('.ind-gear');
      if (gear) gear.onclick = () => toggleConfig(inst, row);
      row.querySelector('.ind-eye').onclick = () => setVisible(inst.id, !inst.visible);
      row.querySelector('.ind-x').onclick = () => remove(inst.id);
      actEl.appendChild(row);
    });
  }

  // builds a wired settings panel for an indicator instance
  function buildConfigEl(inst) {
    if (inst.type === 'rsi') return buildRsiConfigEl(inst);
    if (inst.type === 'macd') return buildMacdConfigEl(inst);
    if (inst.type === 'fvg') return buildFvgConfigEl(inst);
    const cfg = document.createElement('div');
    cfg.className = 'ind-config';
    cfg.innerHTML =
      `<label>Period <input type="number" class="cf-period" min="2" max="400" value="${inst.params.period}"></label>` +
      `<label>Type <select class="cf-type">` +
        `<option value="SMA" ${inst.params.maType === 'SMA' ? 'selected' : ''}>SMA</option>` +
        `<option value="EMA" ${inst.params.maType === 'EMA' ? 'selected' : ''}>EMA</option>` +
      `</select></label>` +
      `<label>Color <input type="color" class="cf-color" value="${inst.params.color}"></label>` +
      `<label>Width <input type="number" class="cf-width" min="1" max="5" value="${inst.params.lineWidth}"></label>`;
    cfg.querySelector('.cf-period').onchange = (e) =>
      updateParams(inst.id, { period: Math.max(2, parseInt(e.target.value) || inst.params.period) });
    cfg.querySelector('.cf-type').onchange = (e) => updateParams(inst.id, { maType: e.target.value });
    cfg.querySelector('.cf-color').oninput = (e) => updateParams(inst.id, { color: e.target.value });
    cfg.querySelector('.cf-width').onchange = (e) =>
      updateParams(inst.id, { lineWidth: Math.max(1, parseInt(e.target.value) || 1) });
    return cfg;
  }

  // settings panel for an RSI instance (period / color / overbought / oversold)
  function buildRsiConfigEl(inst) {
    const cfg = document.createElement('div');
    cfg.className = 'ind-config';
    cfg.innerHTML =
      `<label>Period <input type="number" class="cf-period" min="2" max="100" value="${inst.params.period}"></label>` +
      `<label>Color <input type="color" class="cf-color" value="${inst.params.color}"></label>` +
      `<label>Overbought <input type="number" class="cf-ob" min="50" max="100" value="${inst.params.overbought}"></label>` +
      `<label>Oversold <input type="number" class="cf-os" min="0" max="50" value="${inst.params.oversold}"></label>`;
    cfg.querySelector('.cf-period').onchange = (e) =>
      updateParams(inst.id, { period: Math.max(2, parseInt(e.target.value) || inst.params.period) });
    cfg.querySelector('.cf-color').oninput = (e) => updateParams(inst.id, { color: e.target.value });
    cfg.querySelector('.cf-ob').onchange = (e) =>
      updateParams(inst.id, { overbought: parseFloat(e.target.value) || inst.params.overbought });
    cfg.querySelector('.cf-os').onchange = (e) =>
      updateParams(inst.id, { oversold: parseFloat(e.target.value) || inst.params.oversold });
    return cfg;
  }

  // settings panel for a MACD instance (fast / slow / signal periods + line colors)
  function buildMacdConfigEl(inst) {
    const p = inst.params;
    const cfg = document.createElement('div');
    cfg.className = 'ind-config';
    cfg.innerHTML =
      `<label>Fast <input type="number" class="cf-fast" min="2" max="200" value="${p.fast}"></label>` +
      `<label>Slow <input type="number" class="cf-slow" min="3" max="400" value="${p.slow}"></label>` +
      `<label>Signal <input type="number" class="cf-sig" min="2" max="100" value="${p.signal}"></label>` +
      `<label>MACD <input type="color" class="cf-mc" value="${p.macdColor}"></label>` +
      `<label>Signal Color <input type="color" class="cf-sc" value="${p.signalColor}"></label>`;
    cfg.querySelector('.cf-fast').onchange = (e) =>
      updateParams(inst.id, { fast: Math.max(2, parseInt(e.target.value) || p.fast) });
    cfg.querySelector('.cf-slow').onchange = (e) =>
      updateParams(inst.id, { slow: Math.max(3, parseInt(e.target.value) || p.slow) });
    cfg.querySelector('.cf-sig').onchange = (e) =>
      updateParams(inst.id, { signal: Math.max(2, parseInt(e.target.value) || p.signal) });
    cfg.querySelector('.cf-mc').oninput = (e) => updateParams(inst.id, { macdColor: e.target.value });
    cfg.querySelector('.cf-sc').oninput = (e) => updateParams(inst.id, { signalColor: e.target.value });
    return cfg;
  }

  function buildFvgConfigEl(inst) {
    const p = inst.params;
    const cfg = document.createElement('div');
    cfg.className = 'ind-config';
    cfg.style.gridTemplateColumns = '1fr 1fr';
    cfg.innerHTML =
      `<label>Vol Period <input type="number" class="fvg-vp" min="2" max="200" value="${p.volPeriod}"></label>` +
      `<label>Vol Mult <input type="number" class="fvg-vf" min="0.1" step="0.05" value="${p.volFactor}"></label>` +
      `<label>Max Boxes <input type="number" class="fvg-mb" min="1" max="20" value="${p.maxBoxes}"></label>` +
      `<label>FVG Length <input type="number" class="fvg-fl" min="1" max="500" value="${p.fvgLen}"></label>` +
      `<label>Demand Color <input type="color" class="fvg-cd" value="${p.colorDemand.startsWith('#') ? p.colorDemand : '#26a69a'}"></label>` +
      `<label>Supply Color <input type="color" class="fvg-cs" value="${p.colorSupply.startsWith('#') ? p.colorSupply : '#ef5350'}"></label>` +
      `<label style="grid-column:1/-1">HTF Multiplier (0=off) <input type="number" class="fvg-hm" min="0" max="24" value="${p.htfMult}"></label>` +
      `<label style="grid-column:1/-1" class="st-row"><span>Show Vol Highlight</span><input type="checkbox" class="fvg-sv" ${p.showVolHL ? 'checked' : ''}></label>` +
      `<label style="grid-column:1/-1" class="st-row"><span>Show NY Session Line</span><input type="checkbox" class="fvg-sn" ${p.showNY ? 'checked' : ''}></label>`;
    const up = (patch) => updateParams(inst.id, patch);
    cfg.querySelector('.fvg-vp').onchange = (e) => up({ volPeriod: Math.max(2, +e.target.value || 20) });
    cfg.querySelector('.fvg-vf').onchange = (e) => up({ volFactor: Math.max(0.1, +e.target.value || 1.25) });
    cfg.querySelector('.fvg-mb').onchange = (e) => up({ maxBoxes:  Math.max(1,  +e.target.value || 6) });
    cfg.querySelector('.fvg-fl').onchange = (e) => up({ fvgLen:    Math.max(1,  +e.target.value || 50) });
    cfg.querySelector('.fvg-cd').oninput  = (e) => up({ colorDemand: hexToRgba(e.target.value, 0.22) });
    cfg.querySelector('.fvg-cs').oninput  = (e) => up({ colorSupply: hexToRgba(e.target.value, 0.22) });
    cfg.querySelector('.fvg-hm').onchange = (e) => {
      const v = Math.max(0, +e.target.value || 0);
      up({ htfMult: v, showHTF: v > 0 });
    };
    cfg.querySelector('.fvg-sv').onchange = (e) => up({ showVolHL: e.target.checked });
    cfg.querySelector('.fvg-sn').onchange = (e) => up({ showNY: e.target.checked });
    return cfg;
  }

  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.replace('#',''), 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
  }

  // inline config inside the dropdown panel row
  function toggleConfig(inst, row) {
    const existing = row.nextElementSibling;
    if (existing && existing.classList.contains('ind-config')) { existing.remove(); return; }
    row.after(buildConfigEl(inst));
  }

  // floating config popup anchored to the legend gear
  function openConfigPopup(inst, anchorEl) {
    if (!cfgPopup) {
      cfgPopup = document.createElement('div');
      cfgPopup.className = 'cfg-popup';
      document.body.appendChild(cfgPopup);
      cfgPopup.addEventListener('click', (e) => e.stopPropagation());
    }
    cfgPopup.innerHTML = `<div class="cfg-head">${REGISTRY[inst.type].label(inst.params)}</div>`;
    cfgPopup.appendChild(buildConfigEl(inst));
    const r = anchorEl.getBoundingClientRect();
    cfgPopup.style.display = 'block';
    cfgPopup.style.left = Math.min(r.left, window.innerWidth - 240) + 'px';
    cfgPopup.style.top = (r.bottom + 4) + 'px';
  }

  return { init, recompute, updateLegend, removeAll, snapshot, restoreSet,
    get count() { return instances.length; } };
})();
