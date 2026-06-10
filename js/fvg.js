// fvg.js — VolHi / FVG v2  (ported from Pine Script by spacemanbtc)
// Draws Fair Value Gap boxes + Volume Highlight + NY Session lines on a
// canvas layer anchored to the chart's time/price coordinate system.

const FVGIndicator = (() => {
  let chart, series, container, canvas, ctx;
  let active = false;
  let lastCandles = [];
  let intervalSecs = 3600;
  let boxes = [];      // computed FVG boxes ready to render
  let nyTimes = [];    // Unix-second timestamps for NY open bars

  // ---- default params (mirrored in the config UI) -------------------------
  const DEFAULTS = {
    // Volume Highlight
    showVolHL: true, volPeriod: 20, volFactor: 1.25,
    volColor: '#ffffff',
    // Current-TF FVGs
    showCurTF: true,
    colorDemand: 'rgba(38,166,154,0.22)',  // bullish demand zone (price fell through)
    colorSupply: 'rgba(239,83,80,0.22)',   // bearish supply zone (price rose through)
    maxBoxes: 6, fvgLen: 50, deleteOnFill: true, fillByMid: false,
    // Higher-TF FVGs (resample current candles)
    showHTF: false, htfMult: 4,            // 4 = e.g. 4×1h → 4h
    colorHTFDemand: 'rgba(38,166,154,0.10)',
    colorHTFSupply: 'rgba(239,83,80,0.10)',
    // NY Session open line
    showNY: true, nyColor: '#4f4f4f',
    nyHour: 14, nyMin: 30,                 // 14:30 UTC = 9:30 AM ET (DST)
  };
  let P = { ...DEFAULTS };

  // ---- canvas setup -------------------------------------------------------
  function init(chartObj, candleSeries, host) {
    chart = chartObj; series = candleSeries; container = host;
    canvas = document.createElement('canvas');
    canvas.className = 'fvg-layer';
    canvas.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;';
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

  // coordinate helpers (same pattern as drawings.js)
  function tx(time)  { return chart.timeScale().timeToCoordinate(time); }
  function ty(price) { return series.priceToCoordinate(price); }
  function W()       { return container.clientWidth; }
  function H()       { return container.clientHeight; }

  // ---- candle resampling (for HTF) ----------------------------------------
  function resample(candles, groupSecs) {
    if (!candles.length) return [];
    const map = new Map();
    for (const c of candles) {
      const key = Math.floor(c.time / groupSecs) * groupSecs;
      const g = map.get(key);
      if (!g) {
        map.set(key, { time: key, open: c.open, high: c.high, low: c.low, close: c.close });
      } else {
        g.high  = Math.max(g.high, c.high);
        g.low   = Math.min(g.low,  c.low);
        g.close = c.close;
      }
    }
    return [...map.values()].sort((a, b) => a.time - b.time);
  }

  // ---- FVG detection ------------------------------------------------------
  // Returns unfilled boxes found in `candles`. Scans all bars, prunes to maxBoxes
  // most recent, then checks forward for fills to remove stale ones.
  // demand = gap created during a DOWN move → acts as future support (green)
  // supply = gap created during an UP move  → acts as future resistance (red)
  function detectFVGs(candles, maxBoxes, fvgLen, colorDemand, colorSupply) {
    const demandRaw = [];
    const supplyRaw = [];

    for (let i = 2; i < candles.length; i++) {
      const mid  = candles[i - 1];
      const ago2 = candles[i - 2];
      const cur  = candles[i];

      // Demand zone: middle bar is bearish, current high < 2-bars-ago low
      if (mid.open > mid.close && cur.high < ago2.low) {
        demandRaw.push({ top: ago2.low, bottom: cur.high,
          createIdx: i, color: colorDemand, demand: true });
      }
      // Supply zone: middle bar is bullish, current low > 2-bars-ago high
      if (mid.close >= mid.open && cur.low > ago2.high) {
        supplyRaw.push({ top: cur.low, bottom: ago2.high,
          createIdx: i, color: colorSupply, demand: false });
      }
    }

    // Keep only the most-recent maxBoxes; then check for fills in subsequent bars
    const recent = [
      ...demandRaw.slice(-maxBoxes),
      ...supplyRaw.slice(-maxBoxes),
    ];

    const result = [];
    for (const box of recent) {
      let top = box.top, bottom = box.bottom;
      let filled = false;
      const endIdx = Math.min(box.createIdx + fvgLen, candles.length - 1);

      for (let j = box.createIdx + 1; j <= endIdx; j++) {
        const c = candles[j];
        if (box.demand) {
          if (c.high >= top) { filled = true; break; }
          if (c.high > bottom && c.high < top) bottom = c.high; // partial
        } else {
          if (c.low <= bottom) { filled = true; break; }
          if (c.low < top && c.low > bottom) top = c.low; // partial
        }
      }
      if (!filled) {
        result.push({
          top, bottom,
          mid: (top + bottom) / 2,
          startTime: candles[box.createIdx].time,
          endTime:   candles[endIdx].time,
          color: box.color,
        });
      }
    }
    return result;
  }

  // ---- Volume Highlight ----------------------------------------------------
  // Returns a copy of candles with white color overrides on high-volume bars.
  // LightweightCharts uses per-bar color/borderColor/wickColor when provided.
  function applyVolColors(candles) {
    if (!active || !P.showVolHL || !candles.length) return candles;
    const vols = candles.map((c) => c.volume || 0);
    const ve   = ema(vols, P.volPeriod);
    return candles.map((c, i) => {
      if (ve[i] != null && (c.volume || 0) > ve[i] * P.volFactor) {
        return { ...c, color: P.volColor, borderColor: P.volColor, wickColor: P.volColor };
      }
      return c;
    });
  }

  // ---- NY Session open lines -----------------------------------------------
  function computeNYLines(candles) {
    if (!P.showNY || intervalSecs >= 3600) return [];
    const lines = [];
    const secOfDay = P.nyHour * 3600 + P.nyMin * 60;
    const seen = new Set();
    for (let i = 1; i < candles.length; i++) {
      const dayStart = Math.floor(candles[i].time / 86400) * 86400;
      const nyT = dayStart + secOfDay;
      if (!seen.has(nyT) && candles[i - 1].time < nyT && candles[i].time >= nyT) {
        seen.add(nyT);
        lines.push(candles[i].time); // nearest bar at or after NY open
      }
    }
    return lines;
  }

  // ---- Public compute (called from IndicatorManager.recompute) -------------
  function compute(candles, ivSecs) {
    lastCandles = candles || [];
    if (ivSecs) intervalSecs = ivSecs;
    boxes = []; nyTimes = [];
    if (!active || !lastCandles.length) { render(); return; }

    if (P.showCurTF) {
      boxes.push(...detectFVGs(lastCandles, P.maxBoxes, P.fvgLen, P.colorDemand, P.colorSupply));
    }
    if (P.showHTF && P.htfMult > 1) {
      const htf = resample(lastCandles, intervalSecs * P.htfMult);
      if (htf.length >= 3) {
        boxes.push(...detectFVGs(htf, P.maxBoxes, P.fvgLen, P.colorHTFDemand, P.colorHTFSupply));
      }
    }
    nyTimes = computeNYLines(lastCandles);
    render();
  }

  // ---- Render --------------------------------------------------------------
  function render() {
    // clear
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (!active) return;
    drawNYLines();
    drawBoxes();
  }

  function drawBoxes() {
    for (const box of boxes) {
      const x1 = tx(box.startTime);
      const x2 = tx(box.endTime);
      const y1 = ty(box.top);
      const y2 = ty(box.bottom);
      if (y1 == null || y2 == null) continue;

      const left   = x1 != null ? Math.max(0, x1) : 0;
      const right  = x2 != null ? Math.min(W(), x2) : W();
      if (right <= 0 || left >= W()) continue;

      const top    = Math.min(y1, y2);
      const bottom = Math.max(y1, y2);
      if (bottom - top < 0.5) continue;

      // filled box
      ctx.fillStyle = box.color;
      ctx.fillRect(left, top, right - left, bottom - top);

      // border (left edge only — like TradingView's FVG style)
      ctx.save();
      ctx.strokeStyle = box.color.replace(/[\d.]+\)$/, '0.7)');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(left, bottom);
      ctx.stroke();
      ctx.restore();

      // midpoint dashed line
      if (P.fillByMid) {
        const yMid = ty(box.mid);
        if (yMid != null) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(left, yMid); ctx.lineTo(right, yMid); ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function drawNYLines() {
    if (!P.showNY || intervalSecs >= 3600) return;
    ctx.save();
    ctx.strokeStyle = P.nyColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const t of nyTimes) {
      const x = tx(t);
      if (x == null || x < 0 || x > W()) continue;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H()); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Visibility & params ------------------------------------------------
  function setActive(v) {
    active = v;
    if (v) compute(lastCandles, intervalSecs);
    else   render(); // clears canvas
  }

  function updateParams(patch) {
    Object.assign(P, patch);
    compute(lastCandles, intervalSecs);
  }

  function getParams() { return { ...P }; }
  function getDefaults() { return { ...DEFAULTS }; }

  return { init, compute, render, applyVolColors, setActive, updateParams, getParams, getDefaults,
    get active() { return active; } };
})();
