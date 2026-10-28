// icx.js — 🧭 I-Core setups: the I-Core bot's trades drawn as an indicator (the twin of bbx.js, the BB Breakout one).
// Ichimoku cloud + SMA(200) lines, every past trade as an entry / stop box with its result, the trade that is open now with its trailing
// stop, and a NEW SETUP the moment a candle closes with a signal (entry = next candle's open).
//
// 1:1 with the bot: the trades are not re-coded here. They come from ICore.backtest() in js/icore-core.js, which is the bot's own
// icore-core.js copied unchanged (scripts/sync-icore-core.mjs; `--check` proves it). Rules, from that file: a CLOSED candle crosses out of
// the cloud (close beyond it, previous close not), on the same side of the SMA(200) → enter at the next open, stop kInit (2) × ATR(14)
// away (that is 1R), then after every candle the stop trails to the best price since entry ∓ kTrail (7) × ATR — it only moves in the
// trade's favour. There is NO profit target: a winner runs until the trail catches it (safety exit after 600 candles).
// So the boxes differ from BB Breakout's in one way: red = entry → first stop (the 1R risked), green = entry → the best price the trade
// reached; the dotted line is the trailing stop candle by candle. Signals use closed candles only. Results in R, costs included
// (fees, slippage, funding — as in the bot's research); untick "Include costs" for R before costs.
const ICXIndicator = (() => {
  let chart, series, container, canvas, ctx;
  let active = false;
  let lastCandles = [], ivSecs = 14400;
  let res = null;               // last scan() result
  let priceLines = [];          // axis labels for the open trade / new setup
  let lines = null;             // { top, bot, sma } line handles
  let lastAlertKey = null, toastEl = null, toastTimer = null;
  let calBackdrop = null, calMonth = null;   // performance calendar modal state (calMonth: {y, m} 0-based month)

  const DEFAULTS = { kInit: 2, kTrail: 7, trendLen: 200, costs: true, history: true, notify: true };
  let P = { ...DEFAULTS };
  const C = { long: '#22c55e', short: '#ef5350', tp: 'rgba(34,197,94,', sl: 'rgba(239,83,80,', cloud: '#9575cd', cloudFill: 'rgba(149,117,205,0.08)', sma: '#ffb74d', trail: '#fbbf24' };

  // ---- the rules: the bot's engine ---------------------------------------------
  // candles: closed candles only. Returns { trades, open, setup } as ICore.backtest does, plus each trade's trailing-stop path for drawing.
  function scan(B, p, iv) {
    const cfg = { kInit: p.kInit, kTrail: p.kTrail, trendLen: p.trendLen, interval: iv || 14400, cost: p.costs ? ICore.DEFAULTS.cost : ICore.FREE };
    const r = ICore.backtest(B, cfg), atr = ICore.atrSeries(B);
    // The stop that was in force during each candle, replayed with the engine's own formula (stop set at a close is live from the next candle).
    const path = (dir, i0, i1, entry, stop0) => {
      const out = []; let stop = stop0, ext = entry, best = entry;
      for (let i = i0; i <= i1 && i < B.length; i++) {
        out.push(stop);
        best = dir === 1 ? Math.max(best, B[i].high) : Math.min(best, B[i].low);
        if (i === i1) break;
        ext = dir === 1 ? Math.max(ext, B[i].high) : Math.min(ext, B[i].low);
        const ns = ext - dir * p.kTrail * atr[i];
        if (dir === 1 ? ns > stop : ns < stop) stop = ns;
      }
      return { stops: out, best };
    };
    const trades = r.trades.map((t) => { const pp = path(t.dir, t.i0, t.i1, t.entry, t.stop0); return { ...t, stops: pp.stops, best: pp.best }; });
    let open = null;
    if (r.open) {
      const o = r.open, last = B.length - 1, pp = path(o.dir, o.i0, last, o.entry, o.stop0), oneR = Math.abs(o.entry - o.stop0);
      open = { ...o, stops: pp.stops, best: pp.best, next: o.stop, now: B[last].close, R: o.dir * (B[last].close - o.entry) / oneR, bars: last - o.i0 + 1 };
    }
    const setup = r.setup ? { ...r.setup, close: r.setup.sigClose, stop: r.setup.sigClose - r.setup.dir * p.kInit * r.setup.atr, sig: B.length - 1 } : null;
    return { trades, open, setup };
  }

  // ---- setup --------------------------------------------------------------
  function ensureInit() {
    if (canvas) return;
    chart = ChartView.getChart(); series = ChartView.getCandleSeries(); container = document.getElementById('chartHost');
    canvas = document.createElement('canvas');
    canvas.className = 'icx-layer';
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
    lines = { top: mk(C.cloud), bot: mk(C.cloud), sma: mk(C.sma) };
  }
  function dropLines() { if (!lines) return; Object.values(lines).forEach((h) => h.remove()); lines = null; }
  function clearPriceLines() { priceLines.forEach((l) => { try { series.removePriceLine(l); } catch {} }); priceLines = []; }

  // the cloud and the trend line, with the engine's own formulas (cloud at candle i = spans of candle i − 26)
  function cloudLines(B, trendLen) {
    const D = ICore.DEFAULTS, top = [], bot = [], sma = [];
    let sum = 0;
    for (let i = 0; i < B.length; i++) {
      sum += B[i].close; if (i >= trendLen) sum -= B[i - trendLen].close;
      if (trendLen > 0 && i >= trendLen - 1) sma.push({ time: B[i].time, value: sum / trendLen });
      if (i < D.senkouB + D.kijun - 1) continue;
      const c = ICore.cloudAt(B, i);
      if (isFinite(c.top) && isFinite(c.bot)) { top.push({ time: B[i].time, value: c.top }); bot.push({ time: B[i].time, value: c.bot }); }
    }
    return { top, bot, sma };
  }

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
    res = closed.length > 1 ? scan(closed, P, ivSecs) : { trades: [], open: null, setup: null };
    res.closed = closed; res.formingLast = closedN < lastCandles.length;
    // lines
    const L = cloudLines(lastCandles, P.trendLen);
    res.cloud = L;
    lines.top.setData(L.top); lines.bot.setData(L.bot); lines.sma.setData(P.trendLen > 0 ? L.sma : []);
    // axis labels for what matters now
    clearPriceLines();
    const pl = (price, color, title, style) => priceLines.push(series.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title }));
    const dashed = LightweightCharts.LineStyle.Dashed;
    if (res.open) { const o = res.open; pl(o.entry, o.dir === 1 ? C.long : C.short, 'IC entry', LightweightCharts.LineStyle.Solid); pl(o.next, C.trail, 'IC trail SL', dashed); }
    else if (res.setup) { const s = res.setup; pl(s.close, s.dir === 1 ? C.long : C.short, 'IC SETUP ~entry', dashed); pl(s.stop, C.short, 'IC SETUP SL', dashed); }
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
    const msg = `I-Core ${s.dir === 1 ? 'LONG' : 'SHORT'} setup — enter at the next open (≈ ${s.close.toFixed(d)}), SL ${s.stop.toFixed(d)}, no target: trails ${P.kTrail}×ATR`;
    toast(msg);
    if (!first && typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification('🧭 ' + msg); } catch {} }
  }
  function toast(msg) {
    ensureInit();
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:absolute;top:34px;left:50%;transform:translateX(-50%);z-index:5;max-width:90%;padding:6px 10px;border-radius:4px;' +
        'background:rgba(20,20,24,0.92);border:1px solid #9575cd;color:#e5e7eb;font-size:11px;pointer-events:none;';
      container.appendChild(toastEl);
    }
    toastEl.textContent = '🧭 ' + msg; toastEl.style.display = 'block';
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
    cloudFill();
    if (P.history) for (const t of res.trades) {
      const x0 = xAt(t.i0), x1 = xAt(t.i1, true);
      if (x0 == null || x1 == null || x1 < 0 || x0 > W) continue;
      box(x0, x1, t.entry, t.best, t.stop0, 0.10, false);
      trail(t.i0, t.stops, xAt, false);
      const won = t.R > 0, y = ty(t.exit);
      if (y != null) label(x1 + 3, y, `${t.R >= 0 ? '+' : ''}${t.R.toFixed(1)}R${t.why === 'time' ? ' ⏱' : ''}`, won ? C.long : C.short, false);
      arrow(x0 + bw / 2, ty(t.entry), t.dir);
    }
    if (res.open) {
      const o = res.open, x0 = xAt(o.i0), x1 = xAt(B.length - 1 + 6, true);
      if (x0 != null && x1 != null) {
        box(x0, x1, o.entry, o.best, o.stop0, 0.22, true); arrow(x0 + bw / 2, ty(o.entry), o.dir);
        trail(o.i0, o.stops.concat([o.next]), xAt, true);
        const d = dec(o.entry);
        label(x1 + 3, ty(o.entry), `${o.dir === 1 ? 'LONG' : 'SHORT'} open · ${o.R >= 0 ? '+' : ''}${o.R.toFixed(2)}R · candle ${o.bars}`, o.dir === 1 ? C.long : C.short, true);
        label(x1 + 3, ty(o.next), `trail SL ${o.next.toFixed(d)} (next candle)`, C.trail, false);
        label(x1 + 3, ty(o.best), `best ${o.best.toFixed(d)}`, C.long, false);
      }
    } else if (res.setup) {
      const s = res.setup, x0 = xAt(B.length), x1 = xAt(B.length + 8, true);
      if (x0 != null && x1 != null) {
        box(x0, x1, s.close, s.close, s.stop, 0.22, true, true);
        const d = dec(s.close);
        label(x1 + 3, ty(s.close), `NEW SETUP ${s.dir === 1 ? 'LONG' : 'SHORT'} · enter next open ≈ ${s.close.toFixed(d)} · no TP, trails ${P.kTrail}×ATR`, s.dir === 1 ? C.long : C.short, true);
        label(x1 + 3, ty(s.stop), `SL ${s.stop.toFixed(d)} (${P.kInit}×ATR = 1R)`, C.short, false);
      }
    }
  }
  // a light fill between the cloud's top and bottom lines over the visible candles
  function cloudFill() {
    const L = res.cloud; if (!L || !L.top.length) return;
    const pts = [];
    for (let k = 0; k < L.top.length; k++) { const x = tx(L.top[k].time); if (x == null) continue; const y1 = ty(L.top[k].value), y2 = ty(L.bot[k].value); if (y1 != null && y2 != null) pts.push([x, y1, y2]); }
    if (pts.length < 2) return;
    ctx.save(); ctx.fillStyle = C.cloudFill; ctx.beginPath();
    pts.forEach(([x, y1], k) => (k ? ctx.lineTo(x, y1) : ctx.moveTo(x, y1)));
    for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k][0], pts[k][2]);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // the trailing stop, candle by candle (a step line), from the entry candle on
  function trail(i0, stops, xAt, strong) {
    ctx.save(); ctx.strokeStyle = C.trail; ctx.globalAlpha = strong ? 0.95 : 0.55; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.beginPath();
    let started = false;
    stops.forEach((s, k) => {
      const xa = xAt(i0 + k), xb = xAt(i0 + k, true), y = ty(s);
      if (xa == null || xb == null || y == null) return;
      if (!started) { ctx.moveTo(xa, y); started = true; } else ctx.lineTo(xa, y);
      ctx.lineTo(xb, y);
    });
    ctx.stroke(); ctx.restore();
  }
  function box(x0, x1, entry, best, stop, alpha, strong, dashed) {
    const ye = ty(entry), yb = ty(best), ys = ty(stop);
    if (ye == null || yb == null || ys == null) return;
    const w = Math.max(2, x1 - x0);
    ctx.fillStyle = C.tp + alpha + ')'; ctx.fillRect(x0, Math.min(ye, yb), w, Math.abs(yb - ye));
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
  function label_(p) { return `🧭 I-Core ${p.kInit}/${p.kTrail}×ATR${p.trendLen > 0 ? ' · SMA' + p.trendLen : ''}`; }
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
      `<label>First stop (×ATR) <input type="number" class="ic-i" min="0.5" max="10" step="0.5" value="${p.kInit}"></label>` +
      `<label>Trail (×ATR) <input type="number" class="ic-t" min="1" max="20" step="0.5" value="${p.kTrail}"></label>` +
      `<div style="grid-column:1/-1" class="bx-rpresets">` +
        TRAIL_PRESETS.map((v) => `<button type="button" class="bx-rp${p.kTrail === v ? ' active' : ''}" data-k="${v}">${v}×</button>`).join('') +
      `</div>` +
      `<label style="grid-column:1/-1">Trend SMA (0=off) <input type="number" class="ic-s" min="0" max="400" value="${p.trendLen}"></label>` +
      `<label style="grid-column:1/-1" class="st-row"><span>Include costs (fees · slippage · funding)</span><input type="checkbox" class="ic-c" ${p.costs ? 'checked' : ''}></label>` +
      `<label style="grid-column:1/-1" class="st-row"><span>Show past trades</span><input type="checkbox" class="ic-h" ${p.history ? 'checked' : ''}></label>` +
      `<label style="grid-column:1/-1" class="st-row"><span>Alert on a new setup</span><input type="checkbox" class="ic-a" ${p.notify ? 'checked' : ''}></label>` +
      `<div style="grid-column:1/-1;font-size:9px;opacity:.75">Defaults = the I-Core bot exactly (Ichimoku 9/26/52, SMA200, stop 2×ATR, trail 7×ATR, no target, 600-candle exit), run by the bot's own engine. Built for the 4h chart. Results in R${p.costs ? ' after costs' : ' before costs'}.</div>`;
    const num = (sel, key, min) => { cfg.querySelector(sel).onchange = (e) => { const v = parseFloat(e.target.value); onChange({ [key]: isFinite(v) ? Math.max(min, v) : p[key] }); }; };
    num('.ic-i', 'kInit', 0.5); num('.ic-s', 'trendLen', 0);
    cfg.querySelector('.ic-t').onchange = (e) => {
      const v = parseFloat(e.target.value), kTrail = isFinite(v) ? Math.max(1, v) : p.kTrail;
      cfg.querySelectorAll('.bx-rp').forEach((b) => b.classList.toggle('active', parseFloat(b.dataset.k) === kTrail));
      onChange({ kTrail });
    };
    cfg.querySelectorAll('.bx-rp').forEach((btn) => btn.onclick = () => {
      const v = parseFloat(btn.dataset.k);
      cfg.querySelector('.ic-t').value = v;
      cfg.querySelectorAll('.bx-rp').forEach((b) => b.classList.toggle('active', b === btn));
      onChange({ kTrail: v });
    });
    cfg.querySelector('.ic-c').onchange = (e) => onChange({ costs: e.target.checked });
    cfg.querySelector('.ic-h').onchange = (e) => onChange({ history: e.target.checked });
    cfg.querySelector('.ic-a').onchange = (e) => { onChange({ notify: e.target.checked }); if (e.target.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') { try { Notification.requestPermission(); } catch {} } };
    return cfg;
  }

  // ---- performance calendar (per-day R from closed trades, exit date in UTC) — the same modal as the BB Breakout one ----
  function dayKey(t) { const d = new Date(t * 1000); return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`; }
  function calendarDays() {
    if (!res || !res.closed) return new Map();
    const days = new Map();
    for (const t of res.trades) {
      const c = res.closed[t.i1]; if (!c) continue;
      const k = dayKey(c.time);
      if (!days.has(k)) days.set(k, { count: 0, win: 0, loss: 0, winR: 0, lossR: 0, R: 0 });
      const d = days.get(k);
      d.count++; d.R += t.R;
      if (t.R > 0) { d.win++; d.winR += t.R; } else if (t.R < 0) { d.loss++; d.lossR += t.R; }
    }
    return days;
  }
  function fmtR(v) { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`; }
  const TRAIL_PRESETS = [3, 4, 5, 6, 7, 8, 9, 10, 12];   // I-Core has no target R: the footer picks the trailing stop instead

  function openCalendar() {
    if (!res || !res.trades.length) { toast('No closed I-Core trades yet to show in the calendar.'); return; }
    if (!calBackdrop) {
      calBackdrop = document.createElement('div');
      calBackdrop.className = 'bbx-cal-backdrop';
      calBackdrop.innerHTML = `<div class="bbx-cal-modal">
        <div class="bbx-cal-head">
          <span class="bbx-cal-title">🧭 I-Core — Performance Calendar</span>
          <button class="bbx-cal-close" title="Close">✕</button>
        </div>
        <div class="bbx-cal-seclbl">All-time</div>
        <div class="bbx-cal-totals bbx-cal-alltimetotals"></div>
        <div class="bbx-cal-seclbl bbx-cal-yearlbl">
          <span>Year</span>
          <select class="bbx-cal-year"></select>
        </div>
        <div class="bbx-cal-totals bbx-cal-yeartotals"></div>
        <div class="bbx-cal-nav">
          <button class="bbx-cal-prev">‹</button>
          <span class="bbx-cal-mlabel"></span>
          <button class="bbx-cal-next">›</button>
        </div>
        <div class="bbx-cal-totals bbx-cal-monthtotals"></div>
        <div class="bbx-cal-dow"></div>
        <div class="bbx-cal-grid"></div>
        <div class="bbx-cal-seclbl bbx-cal-rfootlbl">Trailing stop (× ATR)</div>
        <div class="bbx-cal-rfoot"></div>
      </div>`;
      document.body.appendChild(calBackdrop);
      calBackdrop.addEventListener('click', (e) => { if (e.target === calBackdrop) closeCalendar(); });
      calBackdrop.querySelector('.bbx-cal-close').onclick = closeCalendar;
      calBackdrop.querySelector('.bbx-cal-prev').onclick = () => { stepMonth(-1); renderCalendar(); };
      calBackdrop.querySelector('.bbx-cal-next').onclick = () => { stepMonth(1); renderCalendar(); };
      calBackdrop.querySelector('.bbx-cal-year').onchange = (e) => { calMonth.y = parseInt(e.target.value); renderCalendar(); };
      const dow = calBackdrop.querySelector('.bbx-cal-dow');
      dow.innerHTML = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => `<span>${d}</span>`).join('');
      const rfoot = calBackdrop.querySelector('.bbx-cal-rfoot');
      rfoot.innerHTML = TRAIL_PRESETS.map((v) => `<button type="button" class="bx-rp" data-k="${v}">${v}×</button>`).join('');
      rfoot.addEventListener('click', (e) => {
        const btn = e.target.closest('.bx-rp'); if (!btn) return;
        updateParams({ kTrail: parseFloat(btn.dataset.k) });
        renderCalendar();
      });
    }
    if (!calMonth) {
      const last = res.closed[res.trades[res.trades.length - 1].i1];
      const d = new Date(last.time * 1000);
      calMonth = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    }
    calBackdrop.style.display = 'flex';
    renderCalendar();
  }
  function closeCalendar() { if (calBackdrop) calBackdrop.style.display = 'none'; }
  function stepMonth(delta) {
    let m = calMonth.m + delta, y = calMonth.y;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    calMonth = { y, m };
  }
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function renderCalendar() {
    const days = calendarDays();
    // overall totals (all history)
    let totCount = 0, totWin = 0, totLoss = 0, totWinR = 0, totLossR = 0, totR = 0;
    days.forEach((d) => { totCount += d.count; totWin += d.win; totLoss += d.loss; totWinR += d.winR; totLossR += d.lossR; totR += d.R; });
    const statsHtml = (count, win, loss, winR, lossR, R) =>
      `<div class="bbx-cal-stat"><span class="bbx-cal-statval">${count}</span><span class="bbx-cal-statlbl">Total Trades</span></div>` +
      `<div class="bbx-cal-stat"><span class="bbx-cal-statval" style="color:${C.long}">${fmtR(winR)}</span><span class="bbx-cal-statlbl">Positive R (${win})</span></div>` +
      `<div class="bbx-cal-stat"><span class="bbx-cal-statval" style="color:${C.short}">${fmtR(lossR)}</span><span class="bbx-cal-statlbl">Negative R (${loss})</span></div>` +
      `<div class="bbx-cal-stat"><span class="bbx-cal-statval" style="color:${R >= 0 ? C.long : C.short}">${fmtR(R)}</span><span class="bbx-cal-statlbl">Total R</span></div>`;
    calBackdrop.querySelector('.bbx-cal-alltimetotals').innerHTML = statsHtml(totCount, totWin, totLoss, totWinR, totLossR, totR);

    // years present in the trade history, for the year picker
    const years = new Set();
    days.forEach((d, k) => years.add(parseInt(k.split('-')[0])));
    const yearList = [...years].sort((a, b) => a - b);
    const yearSel = calBackdrop.querySelector('.bbx-cal-year');
    if (yearSel.dataset.built !== yearList.join(',')) {
      yearSel.innerHTML = yearList.map((y) => `<option value="${y}">${y}</option>`).join('');
      yearSel.dataset.built = yearList.join(',');
    }
    yearSel.value = calMonth.y;

    // yearly totals (the year currently selected / navigated into)
    let yCount = 0, yWin = 0, yLoss = 0, yWinR = 0, yLossR = 0, yR = 0;
    days.forEach((d, k) => {
      if (parseInt(k.split('-')[0]) !== calMonth.y) return;
      yCount += d.count; yWin += d.win; yLoss += d.loss; yWinR += d.winR; yLossR += d.lossR; yR += d.R;
    });
    calBackdrop.querySelector('.bbx-cal-yeartotals').innerHTML = statsHtml(yCount, yWin, yLoss, yWinR, yLossR, yR);

    calBackdrop.querySelector('.bbx-cal-mlabel').textContent = `${MONTH_NAMES[calMonth.m]} ${calMonth.y}`;

    const grid = calBackdrop.querySelector('.bbx-cal-grid');
    grid.innerHTML = '';
    const firstDow = new Date(Date.UTC(calMonth.y, calMonth.m, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(calMonth.y, calMonth.m + 1, 0)).getUTCDate();
    // monthly totals (just the days in this month)
    let mCount = 0, mWin = 0, mLoss = 0, mWinR = 0, mLossR = 0, mR = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = days.get(`${calMonth.y}-${calMonth.m}-${day}`);
      if (d) { mCount += d.count; mWin += d.win; mLoss += d.loss; mWinR += d.winR; mLossR += d.lossR; mR += d.R; }
    }
    calBackdrop.querySelector('.bbx-cal-monthtotals').innerHTML = statsHtml(mCount, mWin, mLoss, mWinR, mLossR, mR);

    // fixed 6x7 grid (42 cells) so the modal's height never shifts between months
    const TOTAL_CELLS = 42;
    for (let i = 0; i < firstDow; i++) grid.appendChild(document.createElement('div')).className = 'bbx-cal-cell bbx-cal-blank';
    for (let day = 1; day <= daysInMonth; day++) {
      const d = days.get(`${calMonth.y}-${calMonth.m}-${day}`);
      const cell = document.createElement('div');
      cell.className = 'bbx-cal-cell' + (d ? (d.R >= 0 ? ' bbx-cal-win' : ' bbx-cal-lose') : '');
      cell.innerHTML = `<span class="bbx-cal-daynum">${day}</span>` +
        (d ? `<span class="bbx-cal-dayr" style="color:${d.R >= 0 ? C.long : C.short}">${fmtR(d.R)}</span>` +
             `<span class="bbx-cal-daycount">${d.count} trade${d.count > 1 ? 's' : ''}${d.win || d.loss ? ` · ${d.win}W/${d.loss}L` : ''}</span>` : '');
      grid.appendChild(cell);
    }
    const used = firstDow + daysInMonth;
    for (let i = used; i < TOTAL_CELLS; i++) grid.appendChild(document.createElement('div')).className = 'bbx-cal-cell bbx-cal-blank';

    calBackdrop.querySelectorAll('.bbx-cal-rfoot .bx-rp').forEach((b) =>
      b.classList.toggle('active', parseFloat(b.dataset.k) === P.kTrail));
  }

  return { scan, compute, render, setActive, updateParams, getDefaults, label: label_, status, statusColor, buildConfigEl, openCalendar, get active() { return active; } };
})();
