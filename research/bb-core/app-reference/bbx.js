// bbx.js — 🎯 BB Breakout setups: the BB Breakout strategy's rules drawn as an indicator.
// Bollinger(20, 2) + SMA(200) lines, every past trade as an entry / stop / target box with its result, the trade that is open now,
// and a NEW SETUP the moment a candle closes with a signal (entry = next candle's open).
//
// Same rules as strategies/bb-breakout-strategy.js (research/bollinger/live-parity.js checked this exact loop trade-for-trade
// against the app's backtest): a CLOSED candle beyond a band, in the direction of the trend SMA → enter at the next open, stop at the
// middle band, target = close ± targetR × (close − middle), exit at the next open after maxBars candles. One position at a time.
// Signals use closed candles only — the still-forming last candle is ignored (it would repaint) — so a live setup never disappears.
// Results here are in R before fees.
const BBXIndicator = (() => {
  let chart, series, container, canvas, ctx;
  let active = false;
  let lastCandles = [], ivSecs = 14400;
  let res = null;               // last scan() result
  let priceLines = [];          // axis labels for the open trade / new setup
  let lines = null;             // { up, mid, lo, sma } line handles
  let lastAlertKey = null, toastEl = null, toastTimer = null;

  const DEFAULTS = { period: 20, mult: 2, trendLen: 200, targetR: 3, maxBars: 48, history: true, notify: true };
  let P = { ...DEFAULTS };
  const C = { long: '#22c55e', short: '#ef5350', tp: 'rgba(34,197,94,', sl: 'rgba(239,83,80,', band: '#42a5f5', sma: '#ffb74d' };

  // ---- the rules (pure; also used for testing) ----------------------------
  // candles: closed candles only. Returns { trades, open, setup }.
  function scan(B, p) {
    const n = B.length, trades = [];
    let atr = null, trPrev = 0, pos = null, pend = null, pendClose = false, sum20 = 0, sum200 = 0;
    const closes = [], trs = [];
    let open = null, setup = null;
    for (let i = 0; i < n; i++) {
      const c = B[i];
      if (pend) {
        const d = pend.dir, fill = c.open;
        if (d === 1 ? pend.stop < fill : pend.stop > fill) pos = { dir: d, entry: fill, stop: pend.stop, tp: pend.tp, i0: i, sig: pend.sig };
        pend = null;
      }
      if (pendClose && pos) close(c.open, i, 'time');
      pendClose = false;
      if (pos) {
        const d = pos.dir;
        if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) close(d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open), i, 'stop');
        else if (d === 1 ? c.high >= pos.tp : c.low <= pos.tp) close(d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open), i, 'target');
      }
      closes.push(c.close);
      trs.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - B[i - 1].close), Math.abs(c.low - B[i - 1].close)));
      if (i === 13) atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14; else if (i > 13) atr = (atr * 13 + trs[i]) / 14;
      if (pos) { if (p.maxBars > 0 && i - pos.i0 >= p.maxBars) pendClose = true; continue; }
      if (i < 202 || i < p.period - 1 || (p.trendLen > 0 && i < p.trendLen - 1)) continue;
      const w = closes.slice(-p.period), mid = w.reduce((a, b) => a + b, 0) / p.period;
      const sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / p.period);
      const up = mid + p.mult * sd, lo = mid - p.mult * sd;
      const dir = c.close > up ? 1 : c.close < lo ? -1 : 0;
      if (!dir) continue;
      if (p.trendLen > 0) { const sma = closes.slice(-p.trendLen).reduce((a, b) => a + b, 0) / p.trendLen; if (dir === 1 ? c.close < sma : c.close > sma) continue; }
      const dist = Math.abs(c.close - mid);
      if (!(dist > 0) || atr == null || dist < 0.3 * atr) continue;
      pend = { dir, stop: mid, tp: c.close + dir * p.targetR * dist, sig: i, close: c.close };
    }
    if (pos) open = { ...pos, bars: n - 1 - pos.i0, exitNext: pendClose, now: B[n - 1].close, R: pos.dir * (B[n - 1].close - pos.entry) / Math.abs(pos.entry - pos.stop) };
    if (pend) setup = pend;
    return { trades, open, setup };
    function close(px, i, why) {
      trades.push({ dir: pos.dir, i0: pos.i0, i1: i, sig: pos.sig, entry: pos.entry, stop: pos.stop, tp: pos.tp, exit: px, why,
        R: pos.dir * (px - pos.entry) / Math.abs(pos.entry - pos.stop) });
      pos = null;
    }
  }

  // ---- setup --------------------------------------------------------------
  function ensureInit() {
    if (canvas) return;
    chart = ChartView.getChart(); series = ChartView.getCandleSeries(); container = document.getElementById('chartHost');
    canvas = document.createElement('canvas');
    canvas.className = 'bbx-layer';
    canvas.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    new ResizeObserver(() => { resize(); render(); }).observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(render);
    chart.subscribeCrosshairMove(render);
    container.addEventListener('wheel', render, { passive: true, capture: true });
    window.addEventListener('pointermove', (e) => { if (e.buttons) render(); }, { passive: true });
  }
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr; canvas.height = container.clientHeight * dpr;
    canvas.style.width = container.clientWidth + 'px'; canvas.style.height = container.clientHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function ensureLines() {
    if (lines) return;
    const mk = (color, style) => { const h = ChartView.addLineIndicator({ color, lineWidth: 1 }); if (style != null) h.applyOptions({ lineStyle: style }); return h; };
    lines = { up: mk(C.band), mid: mk(C.band, LightweightCharts.LineStyle.Dotted), lo: mk(C.band), sma: mk(C.sma) };
  }
  function dropLines() { if (!lines) return; Object.values(lines).forEach((h) => h.remove()); lines = null; }
  function clearPriceLines() { priceLines.forEach((l) => { try { series.removePriceLine(l); } catch {} }); priceLines = []; }

  // ---- compute (called by IndicatorManager.recompute: data load, live refresh, every replay step) ----
  function compute(candles, iv) {
    lastCandles = candles || [];
    if (iv) ivSecs = iv;
    if (!active) return;
    ensureInit(); ensureLines();
    // the newest candle may still be forming (live data): lines include it, signals never use it
    const now = Date.now() / 1000, last = lastCandles[lastCandles.length - 1];
    const closedN = last && last.time + ivSecs > now ? lastCandles.length - 1 : lastCandles.length;
    const closed = closedN === lastCandles.length ? lastCandles : lastCandles.slice(0, closedN);
    res = scan(closed, P);
    res.closed = closed; res.formingLast = closedN < lastCandles.length;
    // lines
    const cl = lastCandles.map((c) => c.close), bb = bollinger(cl, P.period, P.mult), sm = P.trendLen > 0 ? sma(cl, P.trendLen) : null;
    const pts = (arr) => { const o = []; for (let i = 0; i < arr.length; i++) if (arr[i] != null) o.push({ time: lastCandles[i].time, value: arr[i] }); return o; };
    lines.up.setData(pts(bb.upper)); lines.mid.setData(pts(bb.middle)); lines.lo.setData(pts(bb.lower)); lines.sma.setData(sm ? pts(sm) : []);
    // axis labels for what matters now
    clearPriceLines();
    const pl = (price, color, title, style) => priceLines.push(series.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title }));
    const dashed = LightweightCharts.LineStyle.Dashed;
    if (res.open) { const o = res.open; pl(o.entry, o.dir === 1 ? C.long : C.short, 'BB entry', LightweightCharts.LineStyle.Solid); pl(o.stop, C.short, 'BB SL', dashed); pl(o.tp, C.long, 'BB TP', dashed); }
    else if (res.setup) { const s = res.setup; pl(s.close, s.dir === 1 ? C.long : C.short, 'SETUP ~entry', dashed); pl(s.stop, C.short, 'SETUP SL', dashed); pl(s.tp, C.long, 'SETUP TP', dashed); }
    maybeAlert(closed);
    render();
  }

  // A brand-new setup on the candle that just closed, on live data → toast (+ browser notification if allowed).
  function maybeAlert(closed) {
    if (!res.setup || !P.notify || !closed.length) return;
    const sigBar = closed[res.setup.sig], key = `${sigBar.time}|${res.setup.dir}`;
    const fresh = sigBar.time + 2 * ivSecs > Date.now() / 1000;  // the signal candle closed within the last candle period → live, not history/replay
    if (!fresh || key === lastAlertKey) return;
    const first = lastAlertKey === null; lastAlertKey = key;
    const s = res.setup, d = dec(s.close);
    const msg = `BB Breakout ${s.dir === 1 ? 'LONG' : 'SHORT'} setup — enter at the next open (≈ ${s.close.toFixed(d)}), SL ${s.stop.toFixed(d)}, TP ${s.tp.toFixed(d)}`;
    toast(msg);
    if (!first && typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification('🎯 ' + msg); } catch {} }
  }
  function toast(msg) {
    ensureInit();
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:5;max-width:90%;padding:6px 10px;border-radius:4px;' +
        'background:rgba(20,20,24,0.92);border:1px solid #22c55e;color:#e5e7eb;font-size:11px;pointer-events:none;';
      container.appendChild(toastEl);
    }
    toastEl.textContent = '🎯 ' + msg; toastEl.style.display = 'block';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 20000);
  }

  // ---- render -------------------------------------------------------------
  const tx = (t) => chart.timeScale().timeToCoordinate(t);
  const ty = (p) => series.priceToCoordinate(p);
  function dec(v) { v = Math.abs(v); return v < 1 ? 5 : v < 100 ? 3 : 2; }
  function render() {
    if (!ctx) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
    if (!active || !res) return;
    const W = container.clientWidth, B = res.closed;
    if (!B.length) return;
    const xc = (i) => { const t = i < B.length ? B[i].time : B[B.length - 1].time + (i - B.length + 1) * ivSecs; const x = tx(t); return x == null ? (i >= B.length ? W : null) : x; };
    const n = B.length, bw = n > 1 && xc(n - 1) != null && xc(n - 2) != null ? Math.max(1, xc(n - 1) - xc(n - 2)) : 6;
    // boxes span whole candles: from the left edge of the entry candle to the right edge of the exit candle
    const xAt = (i, right) => { const x = xc(i); return x == null ? null : x + (right ? bw / 2 : -bw / 2); };
    if (P.history) for (const t of res.trades) {
      const x0 = xAt(t.i0), x1 = xAt(t.i1, true);
      if (x0 == null || x1 == null || x1 < 0 || x0 > W) continue;
      box(x0, x1, t.entry, t.tp, t.stop, 0.10, false);
      const won = t.R > 0, y = ty(t.why === 'target' ? t.tp : t.why === 'stop' ? t.stop : t.exit);
      if (y != null) label(x1 + 3, y, `${t.R >= 0 ? '+' : ''}${t.R.toFixed(1)}R${t.why === 'time' ? ' ⏱' : ''}`, won ? C.long : C.short, false);
      arrow(x0 + bw / 2, ty(t.entry), t.dir);
    }
    if (res.open) {
      const o = res.open, x0 = xAt(o.i0), x1 = xAt(B.length - 1 + 6, true);
      if (x0 != null && x1 != null) {
        box(x0, x1, o.entry, o.tp, o.stop, 0.22, true); arrow(x0 + bw / 2, ty(o.entry), o.dir);
        const d = dec(o.entry);
        label(x1 + 3, ty(o.entry), `${o.dir === 1 ? 'LONG' : 'SHORT'} open · ${o.R >= 0 ? '+' : ''}${o.R.toFixed(2)}R · candle ${o.bars}/${P.maxBars || '∞'}${o.exitNext ? ' · exits next open' : ''}`, o.dir === 1 ? C.long : C.short, true);
        label(x1 + 3, ty(o.tp), `TP ${o.tp.toFixed(d)}`, C.long, false); label(x1 + 3, ty(o.stop), `SL ${o.stop.toFixed(d)}`, C.short, false);
      }
    } else if (res.setup) {
      const s = res.setup, x0 = xAt(B.length), x1 = xAt(B.length + 8, true);
      if (x0 != null && x1 != null) {
        box(x0, x1, s.close, s.tp, s.stop, 0.22, true, true);
        const d = dec(s.close);
        label(x1 + 3, ty(s.close), `NEW SETUP ${s.dir === 1 ? 'LONG' : 'SHORT'} · enter next open ≈ ${s.close.toFixed(d)}`, s.dir === 1 ? C.long : C.short, true);
        label(x1 + 3, ty(s.tp), `TP ${s.tp.toFixed(d)} (${P.targetR}R)`, C.long, false); label(x1 + 3, ty(s.stop), `SL ${s.stop.toFixed(d)}`, C.short, false);
      }
    }
  }
  function box(x0, x1, entry, tp, stop, alpha, strong, dashed) {
    const ye = ty(entry), yt = ty(tp), ys = ty(stop);
    if (ye == null || yt == null || ys == null) return;
    const w = Math.max(2, x1 - x0);
    ctx.fillStyle = C.tp + alpha + ')'; ctx.fillRect(x0, Math.min(ye, yt), w, Math.abs(yt - ye));
    ctx.fillStyle = C.sl + alpha + ')'; ctx.fillRect(x0, Math.min(ye, ys), w, Math.abs(ys - ye));
    ctx.save();
    ctx.strokeStyle = strong ? 'rgba(229,231,235,0.85)' : 'rgba(229,231,235,0.35)'; ctx.lineWidth = 1;
    if (dashed) ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x0, ye); ctx.lineTo(x0 + w, ye); ctx.stroke();
    ctx.restore();
  }
  function arrow(x, y, dir) {
    if (y == null) return;
    ctx.save(); ctx.fillStyle = dir === 1 ? C.long : C.short; ctx.beginPath();
    if (dir === 1) { ctx.moveTo(x, y + 2); ctx.lineTo(x - 4, y + 9); ctx.lineTo(x + 4, y + 9); } else { ctx.moveTo(x, y - 2); ctx.lineTo(x - 4, y - 9); ctx.lineTo(x + 4, y - 9); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function label(x, y, text, color, bold) {
    if (y == null) return;
    ctx.save(); ctx.font = `${bold ? '600 ' : ''}10px 'Space Grotesk','Segoe UI',sans-serif`;
    const w = ctx.measureText(text).width, X = Math.min(x, container.clientWidth - w - 62);
    ctx.fillStyle = 'rgba(11,11,13,0.75)'; ctx.fillRect(X - 2, y - 7, w + 4, 13);
    ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, X, y); ctx.restore();
  }

  // ---- visibility / params / UI --------------------------------------------
  function setActive(v) {
    active = v;
    if (v) {
      if (P.notify && typeof Notification !== 'undefined' && Notification.permission === 'default') { try { Notification.requestPermission(); } catch {} }
      compute(lastCandles, ivSecs);
    } else { clearPriceLines(); dropLines(); res = null; if (toastEl) toastEl.style.display = 'none'; render(); }
  }
  function updateParams(patch) { Object.assign(P, patch); if (active) compute(lastCandles, ivSecs); }
  function getDefaults() { return { ...DEFAULTS }; }
  function label_(p) { return `🎯 BB Breakout ${p.period}/${p.mult}${p.trendLen > 0 ? ' · SMA' + p.trendLen : ''}`; }
  // short status for the legend: what is happening on the last closed candle
  function status() {
    if (!active || !res) return '';
    if (res.open) return ` · ${res.open.dir === 1 ? 'LONG' : 'SHORT'} open ${res.open.R >= 0 ? '+' : ''}${res.open.R.toFixed(2)}R`;
    if (res.setup) return ` · NEW ${res.setup.dir === 1 ? 'LONG' : 'SHORT'} setup`;
    const t = res.trades[res.trades.length - 1];
    return ' · flat' + (t ? ` · last ${t.R >= 0 ? '+' : ''}${t.R.toFixed(1)}R` : '') + (ivSecs !== 14400 ? ' · (built for 4h)' : '');
  }
  function statusColor() { return !res ? 'var(--text-dim)' : res.open ? (res.open.dir === 1 ? C.long : C.short) : res.setup ? (res.setup.dir === 1 ? C.long : C.short) : 'var(--text-dim)'; }
  function buildConfigEl(p, onChange) {
    const cfg = document.createElement('div');
    cfg.className = 'ind-config';
    cfg.style.gridTemplateColumns = '1fr 1fr';
    cfg.innerHTML =
      `<label>BB length <input type="number" class="bx-n" min="5" max="100" value="${p.period}"></label>` +
      `<label>BB σ <input type="number" class="bx-k" min="0.5" max="4" step="0.1" value="${p.mult}"></label>` +
      `<label>Trend SMA (0=off) <input type="number" class="bx-t" min="0" max="400" value="${p.trendLen}"></label>` +
      `<label>Target R <input type="number" class="bx-r" min="0.5" max="10" step="0.5" value="${p.targetR}"></label>` +
      `<label style="grid-column:1/-1">Exit after (candles, 0=off) <input type="number" class="bx-m" min="0" max="500" value="${p.maxBars}"></label>` +
      `<label style="grid-column:1/-1" class="st-row"><span>Show past trades</span><input type="checkbox" class="bx-h" ${p.history ? 'checked' : ''}></label>` +
      `<label style="grid-column:1/-1" class="st-row"><span>Alert on a new setup</span><input type="checkbox" class="bx-a" ${p.notify ? 'checked' : ''}></label>` +
      `<div style="grid-column:1/-1;font-size:9px;opacity:.75">Defaults = the tested BB Breakout (20 / 2, SMA200, 3R, 48 candles), built for the 4h chart. Results in R before fees.</div>`;
    const num = (sel, key, min) => { cfg.querySelector(sel).onchange = (e) => { const v = parseFloat(e.target.value); onChange({ [key]: isFinite(v) ? Math.max(min, v) : p[key] }); }; };
    num('.bx-n', 'period', 5); num('.bx-k', 'mult', 0.5); num('.bx-t', 'trendLen', 0); num('.bx-r', 'targetR', 0.5); num('.bx-m', 'maxBars', 0);
    cfg.querySelector('.bx-h').onchange = (e) => onChange({ history: e.target.checked });
    cfg.querySelector('.bx-a').onchange = (e) => { onChange({ notify: e.target.checked }); if (e.target.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') { try { Notification.requestPermission(); } catch {} } };
    return cfg;
  }

  return { scan, compute, render, setActive, updateParams, getDefaults, label: label_, status, statusColor, buildConfigEl, get active() { return active; } };
})();
