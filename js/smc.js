// smc.js — SMC Toolkit indicator: NY session open line, previous-day high/low,
// two fixed-timeframe FVG layers (with retention) and two fixed-timeframe
// CHoCH / BOS layers. Drawn on a canvas overlay anchored to chart time/price.
//
// Fixed timeframes: each layer analyses candles of ITS OWN timeframe regardless of
// the chart's. Source, in order of preference:
//   1. the exact-TF dataset from the candle cache (the app prefetches enabled TFs)
//   2. the chart's own candles resampled up (when the layer TF is a multiple)
// Only bars fully CLOSED by the "clock" (end of the newest chart candle) are used,
// so in replay nothing leaks from the future and nothing repaints.

const SMCIndicator = (() => {
  let chart, series, container, canvas, ctx;
  let active = false;
  let lastCandles = [];       // chart candles (replay: revealed slice only)
  let chartSec = 3600;
  let out = { ny: [], pd: [], fvg: [[], []], choch: [[], []] };
  const pending = new Set();  // cache keys being fetched
  const failed = new Set();   // cache keys that failed (don't hammer the API)

  // ---- defaults (flat so persisted params merge cleanly) -------------------
  const DEFAULTS = {
    tz: 8,                       // your UTC offset (PH = +8); times below are in this zone
    // NY session open
    showNY: true, nyTime: '21:30', nyAutoDST: true, nyColor: '#ffb74d',
    // previous day high / low
    showPD: true, dayStart: '08:00', pdDays: 3, pdhColor: '#ef9a9a', pdlColor: '#80cbc4',
    // FVG layers (fixed TF)
    fvg1_on: true, fvg1_tf: '60', fvg1_bull: '#26a69a', fvg1_bear: '#ef5350', fvg1_max: 10,
    fvg2_on: true, fvg2_tf: '15', fvg2_bull: '#42a5f5', fvg2_bear: '#ffa726', fvg2_max: 10,
    fvgRetain: true,             // keep filled FVGs on the chart (faded, stopped at the fill bar)
    fvgFill: 'wick',             // 'wick' = traded fully through · 'close' = closed beyond
    fvgOpacity: 0.18,
    // CHoCH layers (fixed TF)
    ch1_on: true, ch1_tf: '60', ch1_len: 5, ch1_bull: '#26a69a', ch1_bear: '#ef5350', ch1_max: 8,
    ch2_on: true, ch2_tf: '15', ch2_len: 5, ch2_bull: '#42a5f5', ch2_bear: '#ffa726', ch2_max: 8,
    chBOS: false,                // also show BOS (trend continuation) breaks
    chBreak: 'close',            // 'close' = candle close beyond the swing · 'wick'
  };
  let P = { ...DEFAULTS };

  // ---- setup --------------------------------------------------------------
  // Initialised lazily on first use (the chart exists by then), so app.js needs no wiring.
  function ensureInit() {
    if (!canvas) init(ChartView.getChart(), ChartView.getCandleSeries(), document.getElementById('chartHost'));
  }
  function init(chartObj, candleSeries, host) {
    chart = chartObj; series = candleSeries; container = host;
    canvas = document.createElement('canvas');
    canvas.className = 'smc-layer';
    canvas.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    new ResizeObserver(() => { resize(); render(); }).observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(render);
    chart.subscribeCrosshairMove(render);
    // price-axis wheel zoom / drag pans don't always move the crosshair — repaint on them too
    container.addEventListener('wheel', render, { passive: true, capture: true });
    window.addEventListener('pointermove', (e) => { if (e.buttons) render(); }, { passive: true });
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- helpers --------------------------------------------------------------
  const TF_LABEL = new Map(CFG.ALL_INTERVALS);
  const tfLabel = (tf) => TF_LABEL.get(tf) || tf;
  function hhmmToSec(s) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
    return m ? (+m[1] % 24) * 3600 + Math.min(59, +m[2]) * 60 : 0;
  }
  function hexA(hex, a) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  // last index i with arr[i].time <= t (or -1)
  function upperIdx(arr, t) {
    let lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid].time <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }
  function clock() {
    const c = lastCandles;
    return c.length ? c[c.length - 1].time + chartSec : 0;
  }
  // bucket start for resampling (weeks start Monday 00:00 UTC, like the exchange)
  function bucketOf(t, sec) {
    if (sec === 604800) { const MON = 4 * 86400; return Math.floor((t - MON) / sec) * sec + MON; }
    return Math.floor(t / sec) * sec;
  }
  function resample(candles, sec) {
    const outArr = [];
    let cur = null;
    for (const c of candles) {
      const k = bucketOf(c.time, sec);
      if (!cur || cur.time !== k) {
        cur = { time: k, open: c.open, high: c.high, low: c.low, close: c.close };
        outArr.push(cur);
      } else {
        if (c.high > cur.high) cur.high = c.high;
        if (c.low < cur.low) cur.low = c.low;
        cur.close = c.close;
      }
    }
    return outArr;
  }

  // ---- fixed-TF data source -------------------------------------------------
  function closedBy(bars, sec, clk) {
    const n = upperIdx(bars, clk - sec) + 1;   // bars whose close time <= clock
    return n === bars.length ? bars : bars.slice(0, n);
  }

  function requestData(symbol, tf, target, endSec) {
    const key = `${symbol}|${tf}|${target}|${endSec || 'now'}`;
    if (pending.has(key) || failed.has(key)) return;
    pending.add(key);
    fetchCandles(symbol, tf, target, null, endSec ? { endSec } : undefined)
      .then(() => { pending.delete(key); if (active) compute(lastCandles, chartSec); })
      .catch(() => { pending.delete(key); failed.add(key); });
  }

  function barsFor(tf) {
    const sec = intervalToSeconds(tf);
    const clk = clock();
    if (!lastCandles.length) return { bars: [], sec };
    if (sec === chartSec) return { bars: lastCandles, sec };

    const symbol = document.getElementById('symbol').value;
    const max = parseInt(document.getElementById('maxCandles').value) || 5000;
    const first = lastCandles[0].time;

    // 1) exact-TF dataset (latest window) that reaches back to the clock
    const ds = peekCandleCache(symbol, tf, max);
    if (ds && ds.length && ds[0].time <= clk - sec) {
      const clipped = closedBy(ds, sec, clk);
      if (clipped.length >= 3) return { bars: clipped, sec };
    }
    // 2) historical window around the clock (replay far in the past)
    const WIN = 3000;
    const span = sec * WIN;
    const endSec = Math.min(Math.floor(Date.now() / 1000), Math.ceil((clk + span * 0.3) / span) * span);
    const latestCovers = Date.now() / 1000 - clk < sec * max * 0.9;
    const wds = latestCovers ? null : peekCandleCache(symbol, tf, WIN, endSec);
    if (wds && wds.length && wds[0].time <= clk - sec) {
      const clipped = closedBy(wds, sec, clk);
      if (clipped.length >= 3) return { bars: clipped, sec };
    }
    // not cached yet → fetch it in the background (recompute when it lands)
    if (latestCovers) requestData(symbol, tf, max); else requestData(symbol, tf, WIN, endSec);

    // 3) meanwhile: build it from the chart's candles when it's a higher multiple
    if (sec > chartSec && sec % chartSec === 0) {
      const rs = resample(lastCandles, sec);
      // drop the still-forming bucket (and a partial first one)
      if (rs.length && rs[rs.length - 1].time + sec > clk) rs.pop();
      if (rs.length && rs[0].time < first) rs.shift();
      return { bars: rs, sec };
    }
    return { bars: [], sec };   // lower TF not loaded yet
  }

  // ---- FVG (tip-to-tip of the wicks) ---------------------------------------
  // Bullish: candle 3's LOW above candle 1's HIGH → zone [c1.high, c3.low]
  // Bearish: candle 3's HIGH below candle 1's LOW → zone [c3.high, c1.low]
  // The zone is only the untouched gap between the two wick tips; no wick or body
  // of candles 1 / 3 is inside it.
  function detectFVG(bars, sec, maxN) {
    const list = [];
    for (let i = 2; i < bars.length; i++) {
      const c1 = bars[i - 2], c3 = bars[i];
      if (c3.low > c1.high) list.push({ bull: true, top: c3.low, bottom: c1.high, t1: c1.time, i });
      else if (c3.high < c1.low) list.push({ bull: false, top: c1.low, bottom: c3.high, t1: c1.time, i });
    }
    for (const g of list) {
      g.filledAt = null; g.touched = false;
      for (let j = g.i + 1; j < bars.length; j++) {
        const b = bars[j];
        if (g.bull) {
          if (b.low < g.top) g.touched = true;
          const px = P.fvgFill === 'close' ? b.close : b.low;
          if (px <= g.bottom) { g.filledAt = b.time + sec; break; }
        } else {
          if (b.high > g.bottom) g.touched = true;
          const px = P.fvgFill === 'close' ? b.close : b.high;
          if (px >= g.top) { g.filledAt = b.time + sec; break; }
        }
      }
    }
    const shown = P.fvgRetain ? list : list.filter((g) => g.filledAt == null);
    return shown.slice(-maxN);
  }

  // ---- CHoCH / BOS (swing structure) ----------------------------------------
  // Swing high/low = pivot with `len` bars each side (confirmed `len` bars later).
  // A break of the last swing against the current trend = CHoCH; with it = BOS.
  function detectCHoCH(bars, len, maxN) {
    const ev = [];
    let trend = 0, sh = null, sl = null;
    for (let i = 0; i < bars.length; i++) {
      const p = i - len;
      if (p >= len) {
        let isH = true, isL = true;
        for (let k = p - len; k <= p + len && (isH || isL); k++) {
          if (k === p) continue;
          if (bars[k].high >= bars[p].high) isH = false;
          if (bars[k].low <= bars[p].low) isL = false;
        }
        if (isH) sh = { price: bars[p].high, time: bars[p].time, done: false };
        if (isL) sl = { price: bars[p].low, time: bars[p].time, done: false };
      }
      const b = bars[i];
      const up = P.chBreak === 'wick' ? b.high : b.close;
      const dn = P.chBreak === 'wick' ? b.low : b.close;
      if (sh && !sh.done && up > sh.price) {
        ev.push({ bull: true, type: trend < 0 ? 'CHoCH' : 'BOS', price: sh.price, t1: sh.time, t2: b.time });
        sh.done = true; trend = 1;
      }
      if (sl && !sl.done && dn < sl.price) {
        ev.push({ bull: false, type: trend > 0 ? 'CHoCH' : 'BOS', price: sl.price, t1: sl.time, t2: b.time });
        sl.done = true; trend = -1;
      }
    }
    const shown = P.chBOS ? ev : ev.filter((e) => e.type === 'CHoCH');
    return shown.slice(-maxN);
  }

  // ---- previous day high / low ---------------------------------------------
  function computePD() {
    if (!lastCandles.length || chartSec >= 604800) return [];
    const off = P.tz * 3600 - hhmmToSec(P.dayStart);
    const days = new Map();   // dayKey -> {hi, lo}
    for (const c of lastCandles) {
      const k = Math.floor((c.time + off) / 86400);
      const d = days.get(k);
      if (!d) days.set(k, { hi: c.high, lo: c.low });
      else { if (c.high > d.hi) d.hi = c.high; if (c.low < d.lo) d.lo = c.low; }
    }
    const keys = [...days.keys()];
    const res = [];
    for (let n = keys.length - 1; n >= 2 && res.length < P.pdDays; n--) {  // n-1 > first (partial) day
      const k = keys[n], prev = days.get(k - 1);
      if (!prev) continue;
      res.push({ t1: k * 86400 - off, t2: (k + 1) * 86400 - off, pdh: prev.hi, pdl: prev.lo, current: n === keys.length - 1 });
    }
    return res;
  }

  // ---- NY session open lines -----------------------------------------------
  function nthSundayUTC(y, month, n) {
    const d = new Date(Date.UTC(y, month, 1));
    return 1 + ((7 - d.getUTCDay()) % 7) + (n - 1) * 7;
  }
  // US daylight saving: 2nd Sunday of March 07:00 UTC → 1st Sunday of Nov 06:00 UTC
  function usDST(sec) {
    const y = new Date(sec * 1000).getUTCFullYear();
    const start = Date.UTC(y, 2, nthSundayUTC(y, 2, 2), 7) / 1000;
    const end = Date.UTC(y, 10, nthSundayUTC(y, 10, 1), 6) / 1000;
    return sec >= start && sec < end;
  }
  function computeNY() {
    if (!lastCandles.length || chartSec >= 86400) return [];
    const tzs = P.tz * 3600, at = hhmmToSec(P.nyTime);
    const d0 = Math.floor((lastCandles[0].time + tzs) / 86400);
    const d1 = Math.floor((clock() + tzs) / 86400) + 1;   // include today's (upcoming) open
    const res = [];
    for (let d = d0; d <= d1; d++) {
      let t = d * 86400 + at - tzs;
      if (P.nyAutoDST && !usDST(t)) t += 3600;   // NY on standard time → one hour later
      if (t >= lastCandles[0].time) res.push(t);
    }
    return res;
  }

  // ---- compute (called from IndicatorManager.recompute) ---------------------
  function compute(candles, ivSecs) {
    ensureInit();
    lastCandles = candles || [];
    if (ivSecs) chartSec = ivSecs;
    out = { ny: [], pd: [], fvg: [[], []], choch: [[], []] };
    if (active && lastCandles.length) {
      if (P.showNY) out.ny = computeNY();
      if (P.showPD) out.pd = computePD();
      [1, 2].forEach((n) => {
        if (P[`fvg${n}_on`]) {
          const { bars, sec } = barsFor(P[`fvg${n}_tf`]);
          out.fvg[n - 1] = detectFVG(bars, sec, Math.max(1, +P[`fvg${n}_max`] || 10));
        }
        if (P[`ch${n}_on`]) {
          const { bars } = barsFor(P[`ch${n}_tf`]);
          out.choch[n - 1] = detectCHoCH(bars, Math.max(1, +P[`ch${n}_len`] || 5), Math.max(1, +P[`ch${n}_max`] || 8));
        }
      });
    }
    render();
  }

  // ---- rendering --------------------------------------------------------------
  // time → x for ANY time (also times between chart bars, e.g. a 15m FVG on a 1h
  // chart, or the NY open inside a 1h candle): interpolate between bar centres.
  function X(t) {
    const c = lastCandles; if (!c.length) return null;
    const ts = chart.timeScale();
    const sp = ts.options().barSpacing;
    if (t < c[0].time) {
      const x0 = ts.timeToCoordinate(c[0].time);
      return x0 == null ? null : x0 - ((c[0].time - t) / chartSec) * sp;
    }
    const i = upperIdx(c, t);
    const x = ts.timeToCoordinate(c[i].time); if (x == null) return null;
    if (i + 1 < c.length) {
      const nx = ts.timeToCoordinate(c[i + 1].time);
      if (nx != null) return x + ((t - c[i].time) / (c[i + 1].time - c[i].time)) * (nx - x);
    }
    return x + ((t - c[i].time) / chartSec) * sp;
  }
  const Y = (p) => series.priceToCoordinate(p);

  // text labels with collision avoidance: a label that would overlap one already
  // drawn this frame is skipped (two layers often mark the same level)
  // Labels are queued while shapes draw, then placed last in priority order
  // (NY → PDH/PDL → CHoCH → FVG) so the most important ones win a collision.
  let queue = [];
  function label(text, x, y, align, color, prio) { queue.push({ text, x, y, align, color, prio }); }
  function flushLabels() {
    const placed = [];
    queue.sort((a, b) => a.prio - b.prio).forEach(({ text, x, y, align, color }) => {
      const w = ctx.measureText(text).width, h = 10;
      const l = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      const r = { l: l - 2, r: l + w + 2, t: y - h / 2 - 1, b: y + h / 2 + 1 };
      if (placed.some((q) => r.l < q.r && r.r > q.l && r.t < q.b && r.b > q.t)) return;
      placed.push(r);
      ctx.fillStyle = color; ctx.textAlign = align;
      ctx.fillText(text, x, y);
    });
    queue = [];
  }

  let raf = 0;
  function render() {
    if (raf || !canvas) return;
    raf = requestAnimationFrame(() => { raf = 0; draw(); });
  }

  function draw() {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (!active || !lastCandles.length) return;

    const pw = chart.timeScale().width();
    let ph = container.clientHeight - chart.timeScale().height();
    try { const pane = chart.panes()[0]; if (pane && pane.getHeight) ph = pane.getHeight(); } catch {}
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, pw, ph); ctx.clip();
    ctx.font = "600 9px 'Space Grotesk','Segoe UI',sans-serif";
    queue = [];
    ctx.textBaseline = 'middle';

    drawPD(pw);
    drawFVG(out.fvg[0], P.fvg1_tf, P.fvg1_bull, P.fvg1_bear, pw);
    drawFVG(out.fvg[1], P.fvg2_tf, P.fvg2_bull, P.fvg2_bear, pw);
    drawCHoCH(out.choch[0], P.ch1_tf, P.ch1_bull, P.ch1_bear, [], 1.5);
    drawCHoCH(out.choch[1], P.ch2_tf, P.ch2_bull, P.ch2_bear, [4, 3], 1);
    drawNY(ph);
    flushLabels();
    ctx.restore();
  }

  function drawFVG(list, tf, bullC, bearC, pw) {
    const a = P.fvgOpacity;
    for (const g of list) {
      let x1 = X(g.t1); if (x1 == null) continue;
      let x2 = g.filledAt != null ? X(g.filledAt) : pw;
      if (x2 == null) x2 = pw;
      if (x2 < 0 || x1 > pw) continue;
      const ya = Y(g.top), yb = Y(g.bottom); if (ya == null || yb == null) continue;
      // snap to whole pixels so the fill never bleeds over the wick tips
      const top = Math.round(Math.min(ya, yb)), bot = Math.round(Math.max(ya, yb));
      if (bot - top < 1) continue;
      x1 = Math.round(x1); x2 = Math.round(x2);
      const col = g.bull ? bullC : bearC;
      const filled = g.filledAt != null;
      ctx.fillStyle = hexA(col, filled ? a * 0.4 : (g.touched ? a * 0.75 : a));
      ctx.fillRect(x1, top, x2 - x1, bot - top);
      // crisp edges exactly at the two wick tips
      ctx.strokeStyle = hexA(col, filled ? 0.35 : 0.7);
      ctx.lineWidth = 1;
      ctx.setLineDash(filled ? [3, 3] : []);
      ctx.beginPath();
      ctx.moveTo(x1, top + 0.5); ctx.lineTo(x2, top + 0.5);
      ctx.moveTo(x1, bot - 0.5); ctx.lineTo(x2, bot - 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      if (bot - top >= 11 && x2 - x1 > 40) {
        label(`${tfLabel(tf)} FVG`, Math.max(x1, 0) + 4, top + 6.5, 'left', hexA(col, filled ? 0.5 : 0.95), 3);
      }
    }
  }

  function drawCHoCH(list, tf, bullC, bearC, dash, width) {
    for (const e of list) {
      const x1 = X(e.t1), x2 = X(e.t2), y = Y(e.price);
      if (x1 == null || x2 == null || y == null) continue;
      const col = e.bull ? bullC : bearC;
      const yy = Math.round(y) + 0.5;
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x2, yy); ctx.stroke();
      ctx.setLineDash([]);
      label(`${e.type} ${tfLabel(tf)}`, (x1 + x2) / 2, yy + (e.bull ? -7 : 8), 'center', col, 2);
    }
  }

  function drawPD(pw) {
    if (!P.showPD) return;
    for (const d of out.pd) {
      const x1 = X(d.t1); let x2 = d.current ? pw : X(d.t2);
      if (x1 == null || x2 == null || x2 < 0 || x1 > pw) continue;
      [[d.pdh, P.pdhColor, 'PDH'], [d.pdl, P.pdlColor, 'PDL']].forEach(([price, col, name]) => {
        const y = Y(price); if (y == null) return;
        const yy = Math.round(y) + 0.5;
        ctx.strokeStyle = hexA(col, d.current ? 0.9 : 0.45); ctx.lineWidth = 1;
        ctx.setLineDash(d.current ? [6, 3] : [2, 3]);
        ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x2, yy); ctx.stroke();
        ctx.setLineDash([]);
        if (d.current) {
          label(`${name} ${price.toFixed(price < 1 ? 5 : price < 100 ? 3 : 2)}`, pw - 6, yy - 7, 'right', col, 1);
        }
      });
    }
  }

  function drawNY(ph) {
    if (!P.showNY) return;
    ctx.strokeStyle = hexA(P.nyColor, 0.75); ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.fillStyle = P.nyColor; ctx.textAlign = 'left';
    for (const t of out.ny) {
      const x = X(t); if (x == null) continue;
      const xx = Math.round(x) + 0.5;
      ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, ph); ctx.stroke();
      label('NY', xx + 3, 10, 'left', P.nyColor, 0);
    }
    ctx.setLineDash([]);
  }

  // ---- public ---------------------------------------------------------------
  function setActive(v) { ensureInit(); active = v; if (v) compute(lastCandles, chartSec); else render(); }
  function updateParams(patch) { ensureInit(); Object.assign(P, patch); compute(lastCandles, chartSec); }
  function getDefaults() { return { ...DEFAULTS }; }

  // settings form (used by IndicatorManager); onChange(patch) persists + recomputes
  function buildConfigEl(p, onChange) {
    const el = document.createElement('div');
    el.className = 'ind-config smc-config';
    const tfOpts = (sel) => CFG.ALL_INTERVALS.filter(([v]) => v !== 'W')
      .map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('');
    const chk = (k, label) => `<label class="smc-chk"><input type="checkbox" data-k="${k}"${p[k] ? ' checked' : ''}> ${label}</label>`;
    const col = (k, label) => `<label>${label} <input type="color" data-k="${k}" value="${p[k]}"></label>`;
    const num = (k, label, min, max) => `<label>${label} <input type="number" data-k="${k}" min="${min}" max="${max}" value="${p[k]}"></label>`;
    const sel = (k, label, opts) => `<label>${label} <select data-k="${k}">${opts}</select></label>`;
    const txt = (k, label) => `<label>${label} <input type="time" data-k="${k}" value="${p[k]}"></label>`;
    const head = (t) => `<div class="smc-head">${t}</div>`;
    const choice = (k, pairs) => pairs.map(([v, l]) => `<option value="${v}"${p[k] === v ? ' selected' : ''}>${l}</option>`).join('');

    el.innerHTML =
      head('Time zone') +
      num('tz', 'UTC offset (PH = 8)', -12, 14) + '<span></span>' +
      head('NY session open') +
      chk('showNY', 'Show NY open line') + col('nyColor', 'Color') +
      txt('nyTime', 'Open (your time)') + chk('nyAutoDST', 'Follow US DST (+1h in winter)') +
      head('Previous day high / low') +
      chk('showPD', 'Show PDH / PDL') + num('pdDays', 'Days shown', 1, 30) +
      txt('dayStart', 'Day starts at') + '<span></span>' +
      col('pdhColor', 'PDH color') + col('pdlColor', 'PDL color') +
      head('FVG layer 1 (fixed TF)') +
      chk('fvg1_on', 'Show') + sel('fvg1_tf', 'Timeframe', tfOpts(p.fvg1_tf)) +
      col('fvg1_bull', 'Bullish') + col('fvg1_bear', 'Bearish') + num('fvg1_max', 'Max shown', 1, 50) + '<span></span>' +
      head('FVG layer 2 (fixed TF)') +
      chk('fvg2_on', 'Show') + sel('fvg2_tf', 'Timeframe', tfOpts(p.fvg2_tf)) +
      col('fvg2_bull', 'Bullish') + col('fvg2_bear', 'Bearish') + num('fvg2_max', 'Max shown', 1, 50) + '<span></span>' +
      head('FVG options') +
      chk('fvgRetain', 'Keep filled FVGs (faded)') +
      sel('fvgFill', 'Filled when', choice('fvgFill', [['wick', 'wick trades through'], ['close', 'candle closes through']])) +
      head('CHoCH layer 1 (fixed TF)') +
      chk('ch1_on', 'Show') + sel('ch1_tf', 'Timeframe', tfOpts(p.ch1_tf)) +
      num('ch1_len', 'Swing length', 1, 50) + num('ch1_max', 'Max shown', 1, 50) +
      col('ch1_bull', 'Bullish') + col('ch1_bear', 'Bearish') +
      head('CHoCH layer 2 (fixed TF)') +
      chk('ch2_on', 'Show') + sel('ch2_tf', 'Timeframe', tfOpts(p.ch2_tf)) +
      num('ch2_len', 'Swing length', 1, 50) + num('ch2_max', 'Max shown', 1, 50) +
      col('ch2_bull', 'Bullish') + col('ch2_bear', 'Bearish') +
      head('Structure options') +
      chk('chBOS', 'Also show BOS') +
      sel('chBreak', 'Break on', choice('chBreak', [['close', 'candle close'], ['wick', 'wick']]));

    el.addEventListener('change', (e) => {
      const k = e.target.dataset.k; if (!k) return;
      let v;
      if (e.target.type === 'checkbox') v = e.target.checked;
      else if (e.target.type === 'number') v = parseFloat(e.target.value);
      else v = e.target.value;
      if (typeof v === 'number' && !isFinite(v)) return;
      onChange({ [k]: v });
    });
    el.addEventListener('input', (e) => {      // live color preview
      if (e.target.type === 'color' && e.target.dataset.k) onChange({ [e.target.dataset.k]: e.target.value });
    });
    return el;
  }

  function legendLabel(p) {
    const parts = [];
    if (p.fvg1_on || p.fvg2_on) parts.push('FVG ' + [p.fvg1_on && tfLabel(p.fvg1_tf), p.fvg2_on && tfLabel(p.fvg2_tf)].filter(Boolean).join('/'));
    if (p.ch1_on || p.ch2_on) parts.push('CHoCH ' + [p.ch1_on && tfLabel(p.ch1_tf), p.ch2_on && tfLabel(p.ch2_tf)].filter(Boolean).join('/'));
    return 'SMC' + (parts.length ? ' · ' + parts.join(' · ') : '');
  }

  // Swing pivots exactly as the CHoCH detector defines them: `len` bars each side,
  // known (confirmed) only at index p + len.
  function swings(bars, len) {
    const hi = [], lo = [];
    for (let p = len; p + len < bars.length; p++) {
      let isH = true, isL = true;
      for (let k = p - len; k <= p + len && (isH || isL); k++) {
        if (k === p) continue;
        if (bars[k].high >= bars[p].high) isH = false;
        if (bars[k].low <= bars[p].low) isL = false;
      }
      if (isH) hi.push({ idx: p, price: bars[p].high, confirmIdx: p + len });
      if (isL) lo.push({ idx: p, price: bars[p].low, confirmIdx: p + len });
    }
    return { hi, lo };
  }

  // Headless analysis for backtests (no chart needed): runs the same detectors the
  // overlay draws, over ALL bars, with every FVG / break / day kept.
  function analyze(bars, sec, params) {
    const saved = { P, lastCandles, chartSec };
    P = { ...DEFAULTS, ...params, fvgRetain: true, chBOS: true, pdDays: 1e9 };
    lastCandles = bars; chartSec = sec;
    try {
      const len = Math.max(1, +P.ch1_len || 5);
      return { fvg: detectFVG(bars, sec, Infinity), structure: detectCHoCH(bars, len, Infinity),
        pd: computePD(), ny: computeNY(), swings: swings(bars, len), params: { ...P } };
    } finally { P = saved.P; lastCandles = saved.lastCandles; chartSec = saved.chartSec; }
  }

  return { init, compute, render, setActive, updateParams, getDefaults, buildConfigEl, label: legendLabel, analyze,
    get active() { return active; }, get output() { return out; } };
})();
