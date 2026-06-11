// chart.js — Lightweight Charts wrapper for the replay surface

const ChartView = (() => {
  let chart, candle, volume, cursorSeries, closeLine;
  let container;
  let chartType = 'candlestick';
  let lastHaState = null; // { open, close } of the last permanent HA candle, for updateForming
  let onCrosshair = null;
  let onPriceChange = null;   // fired after every manual price-range update
  let candleMarkers = null;   // v5 markers primitive on the candle series

  // ---- manual price-range state -------------------------------------------
  // When the user first interacts with the price axis (wheel or drag) we capture
  // the exact visible price range and switch to "manual" mode: an
  // autoscaleInfoProvider on the candle series returns a user-controlled {min,max}
  // that the chart uses as-is (scaleMargins 0/0 so the range is pixel-exact).
  // This lets the user freely pan/zoom past the data's high/low.
  // Refreshing or exiting replay restores auto-fit mode.
  const PRICE_MARGINS_BASE = { top: 0.06, bottom: 0.18 };
  let manualRange = null;    // { min, max } or null (auto-fit)
  let mainPaneSeries = [];   // overlay indicator series on the right price scale

  function create(el) {
    container = el;
    const T = CFG.THEME;
    chart = LightweightCharts.createChart(el, {
      layout: { background: { color: T.bg }, textColor: T.text, fontSize: 10,
        fontFamily: "'Space Grotesk','Segoe UI',system-ui,sans-serif" },
      // grid is off by default (toggle in settings)
      grid: { vertLines: { color: T.grid, visible: false },
        horzLines: { color: T.grid, visible: false } },
      rightPriceScale: { borderColor: T.border, scaleMargins: { ...PRICE_MARGINS_BASE } },
      timeScale: { borderColor: T.border, timeVisible: true, secondsVisible: false,
        rightOffset: 6, minBarSpacing: 0.5 },
      // thin, subtle crosshair — TradingView-like, low-distraction
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: 'rgba(178,181,190,0.35)', width: 1, style: 3, labelBackgroundColor: T.border },
        horzLine: { color: 'rgba(178,181,190,0.35)', width: 1, style: 3, labelBackgroundColor: T.border } },
      handleScroll: true,
      // time-axis drag/zoom stays native; price scaling is wheel-only via
      // nudgePriceZoom() (axis drag disabled so the two can't fight).
      handleScale: { axisPressedMouseMove: { time: true, price: false },
        axisDoubleClickReset: { time: true, price: true }, mouseWheel: true, pinch: true },
      autoSize: true,
    });

    candle = chart.addSeries(LightweightCharts.CandlestickSeries, {
      ...CFG.CANDLE_STYLES[CFG.DEFAULTS.candleStyle], priceLineVisible: false,
    });
    volume = chart.addSeries(LightweightCharts.HistogramSeries, {
      priceScaleId: 'vol', priceFormat: { type: 'volume' }, priceLineVisible: false,
    });
    // volume fills the bottom ~18%, flush against the price area (no gap)
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    closeLine = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#d1d4dc', lineWidth: 2, priceLineVisible: false,
      lastValueVisible: false, crosshairMarkerVisible: false, visible: false,
    });

    cursorSeries = chart.addSeries(LightweightCharts.LineSeries, { color: T.cursor,
      lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false,
      // the cursor spans far past the data to read as a full-height line — keep it
      // out of auto-scaling so those extreme points don't blow up the price range.
      autoscaleInfoProvider: () => null });

    chart.subscribeCrosshairMove((param) => { if (onCrosshair) onCrosshair(param); });
    return chart;
  }

  function fmtVol(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
  }

  // ---- candle color mode (classic / mono) ----------------------------------
  // Applied to the live series, so all visible candles — including any forming
  // replay candle — recolor instantly with no data reset.
  function setCandleStyle(name) {
    const style = CFG.CANDLE_STYLES[name];
    if (style) candle.applyOptions(style);
  }

  // ---- custom candle colors (body + wick share one color per direction) ----
  // Overrides the active style so users get a single solid color each way.
  function setCandleColors(up, down) {
    candle.applyOptions({
      upColor: up, downColor: down,
      borderUpColor: up, borderDownColor: down,
      wickUpColor: up, wickDownColor: down,
    });
  }

  // ---- chart type (candlestick | heiken_ashi | line) -----------------------
  function toHeikenAshi(src) {
    const out = [];
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen  = i === 0 ? (c.open + c.close) / 2 : (out[i-1].open + out[i-1].close) / 2;
      const haHigh  = Math.max(c.high, haOpen, haClose);
      const haLow   = Math.min(c.low,  haOpen, haClose);
      out.push({ ...c, open: haOpen, high: haHigh, low: haLow, close: haClose });
    }
    return out;
  }

  function setChartType(type) {
    chartType = type;
    candle.applyOptions({ visible: type !== 'line' });
    closeLine.applyOptions({ visible: type === 'line' });
  }

  // ---- price-axis free pan / zoom -----------------------------------------
  function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Read what's currently visible (exact pixel edges of the pane).
  function readVisiblePriceRange() {
    const h = container.clientHeight;
    if (!h) return null;
    const hi = candle.coordinateToPrice(0);
    const lo = candle.coordinateToPrice(h);
    if (hi == null || lo == null || hi === lo) return null;
    return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
  }

  // Push the current manualRange to the chart via autoscaleInfoProvider.
  // We set scaleMargins 0/0 so the range is pixel-exact (no extra padding).
  // Indicator series exclusion is done once in enterManualMode, not here,
  // so this hot path only touches the candle series per frame.
  function _applyManualRange() {
    const { min, max } = manualRange;
    const provider = () => ({ priceRange: { minValue: min, maxValue: max } });
    candle.applyOptions({ autoscaleInfoProvider: provider });
    if (closeLine) closeLine.applyOptions({ autoscaleInfoProvider: provider });
    chart.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0, bottom: 0 } });
    if (onPriceChange) requestAnimationFrame(onPriceChange);
  }

  // Lazily enter manual mode on first user interaction.
  function enterManualMode() {
    if (manualRange) return;
    manualRange = readVisiblePriceRange();
    if (!manualRange) return;
    // Exclude overlay indicators once here — they never need to force-expand the range.
    mainPaneSeries.forEach((s) => s.applyOptions({ autoscaleInfoProvider: () => null }));
    _applyManualRange();
  }

  // Wheel over price axis — zoom around the center of the visible range.
  // deltaY > 0 (wheel down / scroll toward user) = zoom out (compress).
  function nudgePriceZoom(deltaY) {
    enterManualMode();
    if (!manualRange) return;
    const center   = (manualRange.min + manualRange.max) / 2;
    const halfSpan = (manualRange.max - manualRange.min) / 2;
    // each wheel "click" (~120 units) changes span by ~12%; capped so it feels natural.
    const factor = 1 + clampNum(deltaY, -120, 120) / 120 * 0.12;
    manualRange = { min: center - halfSpan * factor, max: center + halfSpan * factor };
    _applyManualRange();
  }

  // Drag price axis — pan the visible range up/down freely.
  // dy > 0 means the mouse moved down → show higher prices (shift range up).
  function panPrice(dy) {
    enterManualMode();
    if (!manualRange) return;
    const h = container.clientHeight || 1;
    const ppp = (manualRange.max - manualRange.min) / h; // price per pixel
    const shift = dy * ppp;   // drag down → candles move down (grab-and-pull)
    manualRange = { min: manualRange.min + shift, max: manualRange.max + shift };
    _applyManualRange();
  }

  // Restore auto-fit (Refresh, exit replay, etc.).
  function resetPriceZoom() {
    if (!manualRange) return; // already auto
    manualRange = null;
    candle.applyOptions({ autoscaleInfoProvider: null });
    if (closeLine) closeLine.applyOptions({ autoscaleInfoProvider: null });
    mainPaneSeries.forEach((s) => s.applyOptions({ autoscaleInfoProvider: null }));
    chart.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { ...PRICE_MARGINS_BASE } });
  }

  // ---- canvas customization (settings) -------------------------------------
  function setBackground(color) {
    chart.applyOptions({ layout: { background: { color } } });
    container.style.background = color;
  }
  function setGridVisible(on) {
    chart.applyOptions({ grid: { vertLines: { visible: on }, horzLines: { visible: on } } });
  }
  function setGridColor(color) {
    chart.applyOptions({ grid: { vertLines: { color }, horzLines: { color } } });
  }

  // Toggle the chart's native crosshair. The drawing overlay sets this to Hidden
  // while it captures pointer events (so the native crosshair can't leave trails)
  // and back to Normal when idle.
  function setCrosshairMode(on) {
    chart.applyOptions({ crosshair: { mode: on
      ? LightweightCharts.CrosshairMode.Normal
      : LightweightCharts.CrosshairMode.Hidden } });
  }

  // ---- generic line indicator (used by IndicatorManager) -------------------
  // paneIndex 0 = main price pane (overlaid on candles, e.g. MAs).
  // paneIndex >= 1 = a stacked sub-pane with its own price axis (e.g. RSI).
  function addPaneSeries(opts, paneIndex) {
    const s = chart.addSeries(LightweightCharts.LineSeries, {
      color: opts.color, lineWidth: opts.lineWidth || 1,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    }, paneIndex || 0);
    // Track overlay series on the right price scale so manual range mode can
    // exclude them from auto-scale (otherwise they'd force-expand the range).
    if (!paneIndex || paneIndex === 0) mainPaneSeries.push(s);
    return {
      series: s,
      setData: (d) => s.setData(d),
      applyOptions: (o) => s.applyOptions(o),
      setVisible: (v) => s.applyOptions({ visible: v }),
      remove: () => {
        mainPaneSeries = mainPaneSeries.filter((x) => x !== s);
        chart.removeSeries(s);
      },
    };
  }
  // back-compat alias — MAs live on the main pane
  function addLineIndicator(opts) { return addPaneSeries(opts, 0); }

  function setPaneHeight(paneIndex, px) {
    const panes = chart.panes();
    if (panes[paneIndex]) panes[paneIndex].setHeight(px);
  }

  // ---- candle markers (v5 primitive) ---------------------------------------
  function setCandleMarkers(markers) {
    const list = markers || [];
    if (candleMarkers) candleMarkers.setMarkers(list);
    else candleMarkers = LightweightCharts.createSeriesMarkers(candle, list);
  }
  function clearCandleMarkers() { if (candleMarkers) candleMarkers.setMarkers([]); }

  function toggleVolume(on) { volume.applyOptions({ visible: on }); }

  // Optional transform applied to candles before setData (e.g. volume highlight).
  let _sliceTransform = null;
  function setSliceTransform(fn) { _sliceTransform = fn; }

  // Render a slice of candles (used on cut + each replay frame).
  // MA recompute is owned by IndicatorManager — call it after setSlice.
  function setSlice(candles, formingBar) {
    const T = CFG.THEME;
    const src = _sliceTransform ? _sliceTransform(candles) : candles;

    if (chartType === 'heiken_ashi') {
      const all = formingBar ? [...src, formingBar] : src;
      const ha  = toHeikenAshi(all);
      candle.setData(ha);
      lastHaState = ha.length > (formingBar ? 1 : 0)
        ? ha[ha.length - (formingBar ? 2 : 1)]
        : null;
    } else {
      const data = src.map((c) => ({ ...c }));
      if (formingBar) data.push(formingBar);
      candle.setData(data);
    }

    if (chartType === 'line') {
      const all = formingBar ? [...src, formingBar] : src;
      closeLine.setData(all.map((c) => ({ time: c.time, value: c.close })));
    }

    volume.setData(candles.concat(formingBar ? [formingBar] : []).map((c) => ({
      time: c.time, value: c.volume || 0,
      color: c.close >= c.open ? T.volUp : T.volDown,
    })));
  }

  // lighter update path while animating one forming candle
  function updateForming(bar) {
    if (chartType === 'heiken_ashi' && lastHaState) {
      const haClose = (bar.open + bar.high + bar.low + bar.close) / 4;
      const haOpen  = (lastHaState.open + lastHaState.close) / 2;
      candle.update({ ...bar, open: haOpen, high: Math.max(bar.high, haOpen, haClose),
        low: Math.min(bar.low, haOpen, haClose), close: haClose });
    } else {
      candle.update(bar);
    }
    if (chartType === 'line') closeLine.update({ time: bar.time, value: bar.close });
    volume.update({ time: bar.time, value: bar.volume || 0,
      color: bar.close >= bar.open ? CFG.THEME.volUp : CFG.THEME.volDown });
  }

  // vertical replay cursor at a given time — drawn far past the data so it reads
  // as a full-height line (clipped to the pane); excluded from auto-scaling above.
  function setCursor(time, priceLo, priceHi) {
    if (time == null) { cursorSeries.setData([]); return; }
    const span = (priceHi - priceLo) || Math.abs(priceHi) || 1;
    const pad = span * 100;
    cursorSeries.setData([{ time, value: priceLo - pad }, { time, value: priceHi + pad }]);
  }

  function scrollToRealtime() { chart.timeScale().scrollToRealTime(); }
  function getChart() { return chart; }
  function getCandleSeries() { return candle; }
  function getVolumeSeries() { return volume; }
  function onCrosshairMove(fn) { onCrosshair = fn; }
  function onPriceRangeChange(fn) { onPriceChange = fn; }

  return { create, setSlice, setSliceTransform, updateForming, setChartType, setCandleStyle, setCandleColors, setBackground,
    setGridVisible, setGridColor, setCrosshairMode, addLineIndicator, addPaneSeries, setPaneHeight,
    setCandleMarkers, clearCandleMarkers, toggleVolume, setCursor,
    nudgePriceZoom, panPrice, resetPriceZoom,
    scrollToRealtime, getChart, getCandleSeries, getVolumeSeries,
    onCrosshairMove, onPriceRangeChange, fmtVol };
})();
