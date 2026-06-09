// chart.js — Lightweight Charts wrapper for the replay surface

const ChartView = (() => {
  let chart, candle, volume, cursorSeries;
  let container;
  let onCrosshair = null;
  let candleMarkers = null;   // v5 markers primitive on the candle series

  function create(el) {
    container = el;
    const T = CFG.THEME;
    chart = LightweightCharts.createChart(el, {
      layout: { background: { color: T.bg }, textColor: T.text, fontSize: 11,
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" },
      // grid is off by default (toggle in settings)
      grid: { vertLines: { color: T.grid, visible: false },
        horzLines: { color: T.grid, visible: false } },
      rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.06, bottom: 0.18 } },
      timeScale: { borderColor: T.border, timeVisible: true, secondsVisible: false,
        rightOffset: 6 },
      // thin, subtle crosshair — TradingView-like, low-distraction
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: 'rgba(178,181,190,0.35)', width: 1, style: 3, labelBackgroundColor: T.border },
        horzLine: { color: 'rgba(178,181,190,0.35)', width: 1, style: 3, labelBackgroundColor: T.border } },
      handleScroll: true,
      // price scaling stays enabled internally so the wheel-over-axis handler can
      // drive it; real user drags on the price axis are blocked in app.js.
      handleScale: { axisPressedMouseMove: { time: true, price: true },
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

    cursorSeries = chart.addSeries(LightweightCharts.LineSeries, { color: T.cursor,
      lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false });

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
    return {
      series: s,
      setData: (d) => s.setData(d),
      applyOptions: (o) => s.applyOptions(o),
      setVisible: (v) => s.applyOptions({ visible: v }),
      remove: () => chart.removeSeries(s),
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

  // Render a slice of candles (used on cut + each replay frame).
  // MA recompute is owned by IndicatorManager — call it after setSlice.
  function setSlice(candles, formingBar) {
    const T = CFG.THEME;
    const data = candles.map((c) => ({ ...c }));
    if (formingBar) data.push(formingBar);
    candle.setData(data);
    volume.setData(candles.concat(formingBar ? [formingBar] : []).map((c) => ({
      time: c.time, value: c.volume || 0,
      color: c.close >= c.open ? T.volUp : T.volDown,
    })));
  }

  // lighter update path while animating one forming candle
  function updateForming(bar) {
    candle.update(bar);
    volume.update({ time: bar.time, value: bar.volume || 0,
      color: bar.close >= bar.open ? CFG.THEME.volUp : CFG.THEME.volDown });
  }

  // vertical replay cursor at a given time
  function setCursor(time, priceLo, priceHi) {
    if (time == null) { cursorSeries.setData([]); return; }
    cursorSeries.setData([{ time, value: priceLo }, { time, value: priceHi }]);
  }

  function scrollToRealtime() { chart.timeScale().scrollToRealTime(); }
  function getChart() { return chart; }
  function getCandleSeries() { return candle; }
  function getVolumeSeries() { return volume; }
  function onCrosshairMove(fn) { onCrosshair = fn; }

  return { create, setSlice, updateForming, setCandleStyle, setCandleColors, setBackground,
    setGridVisible, setGridColor, setCrosshairMode, addLineIndicator, addPaneSeries, setPaneHeight,
    setCandleMarkers, clearCandleMarkers, toggleVolume, setCursor,
    scrollToRealtime, getChart, getCandleSeries, getVolumeSeries,
    onCrosshairMove, fmtVol };
})();
