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
    volume: { name: 'Volume', label: () => 'Volume', defaults: () => ({}) },
  };

  const RSI_PANE = 1;   // stacked sub-pane below the main price/volume pane

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

    restore();
  }

  // ---- persistence ---------------------------------------------------------
  function persist() {
    const slim = instances.map(({ id, type, visible, params }) => ({ id, type, visible, params }));
    try { localStorage.setItem(CFG.STORE.indicators, JSON.stringify(slim)); } catch {}
  }
  function restore() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(CFG.STORE.indicators)); } catch {}
    if (saved && saved.length) {
      saved.forEach((s) => materialize(s.type, s.params, s.visible, s.id));
      idSeq = Math.max(idSeq, ...saved.map((s) => s.id + 1));
    } else {
      // default: Volume only (no SMA indicators)
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
      const h = ChartView.addPaneSeries({ color: inst.params.color, lineWidth: inst.params.lineWidth }, RSI_PANE);
      h.setVisible(inst.visible);
      addRsiLevelLines(h, inst.params);
      handles.set(inst.id, h);
      ChartView.setPaneHeight(RSI_PANE, 120);
    } else if (type === 'volume') {
      ChartView.toggleVolume(inst.visible);
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
    } else if (inst.type === 'volume') ChartView.toggleVolume(false);
    instances = instances.filter((i) => i.id !== id);
    renderPanel(); refreshBadge(); updateLegend(null); persist();
  }

  // remove every active indicator (right-click → Remove All Indicators)
  function removeAll() {
    instances.slice().forEach((i) => remove(i.id));
  }

  function setVisible(id, v) {
    const inst = instances.find((i) => i.id === id); if (!inst) return;
    inst.visible = v;
    if (inst.type === 'ma' || inst.type === 'rsi') handles.get(id).setVisible(v);
    else if (inst.type === 'volume') ChartView.toggleVolume(v);
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
    }
    recompute(lastCandles);
    renderPanel(); persist();
  }

  // ---- recompute (called by replay + on data load) -------------------------
  function recompute(candles) {
    lastCandles = candles || [];
    instances.forEach((inst) => {
      if (inst.type === 'ma') {
        const h = handles.get(inst.id);
        h.setData(inst.visible ? maLineData(lastCandles, inst.params.period, inst.params.maType) : []);
      } else if (inst.type === 'rsi') {
        const h = handles.get(inst.id);
        h.setData(inst.visible ? rsiLineData(lastCandles, inst.params.period) : []);
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
    });
  }

  function dec(v) { v = Math.abs(v); return v < 1 ? 5 : v < 100 ? 3 : 2; }

  function updateLegend(param) {
    const rows = instances.map((inst) => {
      let valTxt = '', name, color;
      if (inst.type === 'ma') {
        let val = null;
        if (inst.visible && param && param.seriesData) {
          const d = param.seriesData.get(handles.get(inst.id).series);
          if (d) val = d.value;
        }
        if (val == null && inst.visible) {
          const arr = maLineData(lastCandles, inst.params.period, inst.params.maType);
          if (arr.length) val = arr[arr.length - 1].value;
        }
        if (val != null) valTxt = ' · ' + val.toFixed(dec(val));
        name = REGISTRY.ma.label(inst.params);
        color = inst.params.color;
      } else if (inst.type === 'rsi') {
        let val = null;
        if (inst.visible && param && param.seriesData) {
          const d = param.seriesData.get(handles.get(inst.id).series);
          if (d) val = d.value;
        }
        if (val == null && inst.visible) {
          const arr = rsiLineData(lastCandles, inst.params.period);
          if (arr.length) val = arr[arr.length - 1].value;
        }
        if (val != null) valTxt = ' · ' + val.toFixed(1);
        name = REGISTRY.rsi.label(inst.params);
        color = inst.params.color;
      } else {
        let v = null;
        if (inst.visible && param && param.seriesData) {
          const d = param.seriesData.get(ChartView.getVolumeSeries());
          if (d) v = d.value;
        }
        if (v != null) valTxt = ' · ' + ChartView.fmtVol(v);
        name = 'Vol'; color = 'var(--text-dim)';
      }
      const gear = (inst.type === 'ma' || inst.type === 'rsi')
        ? `<button class="lg-ic" data-act="gear" data-id="${inst.id}" title="Settings">⚙</button>` : '';
      return `<div class="lg-row${inst.visible ? '' : ' lg-off'}">` +
        `<span class="lg-name" style="color:${color}">${name}${valTxt}</span>` +
        `<span class="lg-ctrls">` +
        `<button class="lg-ic" data-act="eye" data-id="${inst.id}" title="Show/Hide">${inst.visible ? '👁' : '🚫'}</button>` +
        gear +
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
      row.innerHTML = `<span>${def.name}</span><button class="ind-plus">＋</button>`;
      row.querySelector('.ind-plus').onclick = () => add(type, {});
      addEl.appendChild(row);
    });

    // active instances
    const actEl = panel.querySelector('.ind-active');
    actEl.innerHTML = instances.length ? '' : '<div class="ind-empty">No active indicators</div>';
    instances.forEach((inst) => {
      const def = REGISTRY[inst.type];
      const row = document.createElement('div');
      row.className = 'ind-row';
      const hasColor = inst.type === 'ma' || inst.type === 'rsi';
      row.innerHTML =
        `<span class="ind-name" style="${hasColor ? 'color:' + inst.params.color : ''}">${def.label(inst.params)}</span>` +
        `<span class="ind-actions">` +
        (hasColor ? `<button class="ind-ic ind-gear" title="Settings">⚙</button>` : '') +
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

  return { init, recompute, updateLegend, removeAll,
    get count() { return instances.length; } };
})();
