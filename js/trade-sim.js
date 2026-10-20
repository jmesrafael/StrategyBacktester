// trade-sim.js — replay trading simulator: draggable widget, mock positions,
// live P&L, on-chart entry line + label, trade log, and session summary.
// Inspired by Investagrams TradingGrounds.

const TradeSim = (() => {
  const UP = '#26a69a', DOWN = '#ef5350';

  let chartHost, series, chart;
  let onPlayAgain = null, onExit = null;

  // session state
  let active = false;
  let startBalance = CFG.START_BALANCE;
  let balance = startBalance;
  let sizePct = CFG.DEFAULT_SIZE_PCT;
  let commissionPct = CFG.DEFAULT_COMMISSION_PCT; // per side, on entry and exit
  let slippagePct = CFG.DEFAULT_SLIPPAGE_PCT;     // worsens entry/exit fill
  let totalFees = 0;     // accumulated commission across the session
  let sessionPnl = 0;   // running total of all closed-trade net P&L
  let position = null;   // {side, entryPrice, size, entryTime, entryCandleIndex}
  let trades = [];       // closed trades
  let currentPrice = 0;
  let hasTraded = false; // locks the balance + sim-settings inputs once a trade opens
  let mode = 'game';     // 'game' (manual buttons) | 'strategy' (read-only status)

  // DOM
  let widget, elBalance, elPrice, elPnl, elSessionPnl, elLogList, elSizes, elLong, elShort, elClose;
  let elComm, elSlip, elStatus, elActions;
  let pnlLabel, toast, summary;
  let entryLine = null;

  // pending limit order + stop order (replay game mode)
  let orderType = 'market';     // 'market' | 'limit'
  let pending = null;           // {side, price} - fills automatically when price trades through it
  let stopPrice = null;         // closes the open position when hit
  let pendingLine = null, stopLine = null;
  let lastTickTime = null;      // so stepping BACK never re-triggers orders
  let elOType, elLimitRow, elLimit, elPendRow, elPendTxt, elStopRow, elStopPx;

  // ---- helpers -------------------------------------------------------------
  function dec(p) { p = Math.abs(p); return p < 1 ? 5 : p < 100 ? 3 : 2; }
  function fmtPrice(p) { return p.toLocaleString('en-US', { minimumFractionDigits: dec(p), maximumFractionDigits: dec(p) }); }
  function fmtMoney(v) {
    const s = v < 0 ? '-' : '+';
    return `${s}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function fmtBal(v) { return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  function fmtPct(v) { return `${v < 0 ? '-' : '+'}${Math.abs(v).toFixed(2)}%`; }
  function pnlOf(price) {
    if (!position) return { pct: 0, usd: 0 };
    const pct = position.side === 'long'
      ? ((price - position.entryPrice) / position.entryPrice) * 100
      : ((position.entryPrice - price) / position.entryPrice) * 100;
    return { pct, usd: position.size * (pct / 100) };
  }

  // ---- init (build DOM once) ----------------------------------------------
  function init(opts) {
    chart = opts.chart; series = opts.series; chartHost = opts.chartHost;
    onPlayAgain = opts.onPlayAgain; onExit = opts.onExit;
    buildWidget();
    buildExtras();
    chart.timeScale().subscribeVisibleLogicalRangeChange(positionPnlLabel);
  }

  function buildWidget() {
    widget = document.createElement('div');
    widget.className = 'trade-widget';
    widget.style.display = 'none';
    widget.innerHTML =
      `<div class="tw-head"><span class="tw-grip">⠿</span><span class="tw-title">TRADE SIM</span>` +
        `<button type="button" class="tw-compact-btn" title="Compact / full"><i class="fas fa-compress"></i></button></div>` +
      `<div class="tw-stats">` +
        `<div class="tw-stat">Balance <span class="tw-bwrap">$<input class="tw-balance" type="number" min="1" step="100"></span></div>` +
        `<div class="tw-stat">Price <b class="tw-price">—</b></div>` +
      `</div>` +
      `<div class="tw-simwrap">` +
        `<button class="tw-simtoggle" type="button">⚙ Sim Settings</button>` +
        `<div class="tw-sim" style="display:none">` +
          `<label>Commission % <input class="tw-comm" type="number" min="0" step="0.001"></label>` +
          `<label>Slippage % <input class="tw-slip" type="number" min="0" step="0.001"></label>` +
        `</div>` +
      `</div>` +
      `<div class="tw-sizes"></div>` +
      `<div class="tw-order">` +
        `<div class="tw-otabs"><button type="button" class="tw-otab active" data-t="market">Market</button>` +
        `<button type="button" class="tw-otab" data-t="limit">Limit</button></div>` +
        `<label class="tw-limit-row" style="display:none">Limit price <input class="tw-limit" type="number" step="any" min="0"></label>` +
        `<div class="tw-pend-row" style="display:none"><span class="tw-pend-txt"></span><button type="button" class="tw-mini tw-pend-x" title="Cancel order">✕</button></div>` +
      `</div>` +
      `<div class="tw-actions-wrap">` +
        `<div class="tw-actions">` +
          `<button class="tw-btn tw-long">LONG ▲</button>` +
          `<button class="tw-btn tw-short">SHORT ▼</button>` +
        `</div>` +
        `<div class="tw-actions"><button class="tw-btn tw-close">CLOSE ■</button></div>` +
      `</div>` +
      `<div class="tw-stop-row" style="display:none">` +
        `<label>Stop <input class="tw-stop-px" type="number" step="any" min="0" placeholder="price"></label>` +
        `<button type="button" class="tw-mini tw-stop-set">SET</button>` +
        `<button type="button" class="tw-mini tw-stop-clear" title="Remove stop">✕</button>` +
      `</div>` +
      `<div class="tw-status" style="display:none">No position</div>` +
      `<div class="tw-pnl" style="display:none">P&amp;L <b class="tw-pnl-val">+$0.00 (+0.00%)</b></div>` +
      `<div class="tw-session-pnl">Session P&amp;L <b class="tw-session-pnl-val">$0.00</b></div>` +
      `<div class="tw-log"><div class="tw-log-title">TRADE LOG</div><div class="tw-log-list"></div></div>`;
    chartHost.appendChild(widget);

    elBalance    = widget.querySelector('.tw-balance');
    elPrice      = widget.querySelector('.tw-price');
    elPnl        = widget.querySelector('.tw-pnl');
    elSessionPnl = widget.querySelector('.tw-session-pnl-val');
    elLogList = widget.querySelector('.tw-log-list');
    elSizes   = widget.querySelector('.tw-sizes');
    elLong    = widget.querySelector('.tw-long');
    elShort   = widget.querySelector('.tw-short');
    elClose   = widget.querySelector('.tw-close');
    elComm    = widget.querySelector('.tw-comm');
    elSlip    = widget.querySelector('.tw-slip');
    elStatus  = widget.querySelector('.tw-status');
    elActions = widget.querySelector('.tw-actions-wrap');
    elOType    = widget.querySelector('.tw-otabs');
    elLimitRow = widget.querySelector('.tw-limit-row');
    elLimit    = widget.querySelector('.tw-limit');
    elPendRow  = widget.querySelector('.tw-pend-row');
    elPendTxt  = widget.querySelector('.tw-pend-txt');
    elStopRow  = widget.querySelector('.tw-stop-row');
    elStopPx   = widget.querySelector('.tw-stop-px');

    elComm.value = commissionPct;
    elSlip.value = slippagePct;
    widget.querySelector('.tw-simtoggle').onclick = () => {
      const s = widget.querySelector('.tw-sim');
      s.style.display = s.style.display === 'none' ? 'block' : 'none';
    };
    elComm.addEventListener('change', () => {
      if (hasTraded) { elComm.value = commissionPct; return; }
      const v = parseFloat(elComm.value);
      if (v >= 0) commissionPct = v; else elComm.value = commissionPct;
    });
    elSlip.addEventListener('change', () => {
      if (hasTraded) { elSlip.value = slippagePct; return; }
      const v = parseFloat(elSlip.value);
      if (v >= 0) slippagePct = v; else elSlip.value = slippagePct;
    });

    CFG.SIZE_PCTS.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'tw-size'; b.dataset.pct = p; b.textContent = p + '%';
      if (p === sizePct) b.classList.add('active');
      elSizes.appendChild(b);
    });
    elSizes.addEventListener('click', (e) => {
      const b = e.target.closest('.tw-size'); if (!b) return;
      sizePct = parseInt(b.dataset.pct);
      elSizes.querySelectorAll('.tw-size').forEach((x) => x.classList.toggle('active', x === b));
    });

    elBalance.addEventListener('change', () => {
      if (hasTraded) return;
      const v = parseFloat(elBalance.value);
      if (v > 0) { startBalance = v; balance = v; }
      elBalance.value = balance.toFixed(2);
    });

    elLong.onclick  = () => place('long');
    elShort.onclick = () => place('short');
    elClose.onclick = () => close();

    elOType.addEventListener('click', (e) => {
      const b = e.target.closest('.tw-otab'); if (!b) return;
      setOrderType(b.dataset.t);
    });
    widget.querySelector('.tw-pend-x').onclick = () => cancelPending();
    widget.querySelector('.tw-stop-set').onclick = () => setStop(parseFloat(elStopPx.value));
    elStopPx.addEventListener('keydown', (e) => { if (e.key === 'Enter') setStop(parseFloat(elStopPx.value)); });
    widget.querySelector('.tw-stop-clear').onclick = () => clearStop();

    widget.querySelector('.tw-compact-btn').onclick = () => setCompact(!compact);
    makeDraggable(widget);
    window.addEventListener('resize', () => { if (active) keepOnScreen(); });
  }

  function buildExtras() {
    pnlLabel = document.createElement('div');
    pnlLabel.className = 'trade-pnl-label';
    pnlLabel.style.display = 'none';
    chartHost.appendChild(pnlLabel);

    toast = document.createElement('div');
    toast.className = 'trade-toast';
    toast.style.display = 'none';
    chartHost.appendChild(toast);

    summary = document.createElement('div');
    summary.className = 'trade-summary';
    summary.style.display = 'none';
    chartHost.appendChild(summary);
  }

  // ---- drag (pointer events: mouse, touch, pen) ------------------------------
  // The widget lives inside chartHost; presses on it never reach the chart's own
  // handlers. Drag it from anywhere that isn't a control; the spot is remembered.
  const POS_KEY = 'sb.twPos', COMPACT_KEY = 'sb.twCompact';
  let compact = false;

  function keepOnScreen() {
    const w = widget.offsetWidth, h = widget.offsetHeight;
    const x = Math.max(0, Math.min(window.innerWidth - w, parseFloat(widget.style.left) || 0));
    const y = Math.max(0, Math.min(window.innerHeight - h, parseFloat(widget.style.top) || 0));
    widget.style.left = x + 'px'; widget.style.top = y + 'px'; widget.style.right = 'auto';
  }
  function savePos() {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x: parseFloat(widget.style.left), y: parseFloat(widget.style.top) })); } catch {}
  }

  function makeDraggable(box) {
    let id = null, offX = 0, offY = 0;
    box.style.touchAction = 'none';   // a finger drags the widget instead of scrolling the page
    box.addEventListener('mousedown', (e) => e.stopPropagation());
    box.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    box.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('button, input, select, textarea, label, a, .tw-log-list')) return;
      id = e.pointerId;
      const r = box.getBoundingClientRect();
      offX = e.clientX - r.left; offY = e.clientY - r.top;
      try { box.setPointerCapture(id); } catch {}
      e.preventDefault();
    });
    box.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const nx = Math.max(0, Math.min(window.innerWidth - box.offsetWidth, e.clientX - offX));
      const ny = Math.max(0, Math.min(window.innerHeight - box.offsetHeight, e.clientY - offY));
      box.style.left = nx + 'px'; box.style.top = ny + 'px'; box.style.right = 'auto';
      e.preventDefault();
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      try { box.releasePointerCapture(e.pointerId); } catch {}
      savePos();
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  }

  // Compact mode: just floating LONG / SHORT / CLOSE buttons (+ live P&L). Market
  // orders only; the full panel (balance, sizes, limit, stop, log) is one tap away.
  function setCompact(v) {
    compact = !!v;
    widget.classList.toggle('tw-compact', compact);
    const ic = widget.querySelector('.tw-compact-btn i');
    if (ic) ic.className = compact ? 'fas fa-expand' : 'fas fa-compress';
    try { localStorage.setItem(COMPACT_KEY, compact ? '1' : '0'); } catch {}
    if (compact && orderType !== 'market') setOrderType('market');
    if (active) keepOnScreen();
  }

  // ---- session lifecycle ---------------------------------------------------
  function start(initialPrice) {
    active = true;
    balance = startBalance;
    trades = [];
    position = null;
    hasTraded = false;
    totalFees = 0;
    sessionPnl = 0;
    currentPrice = initialPrice || 0;
    pending = null; stopPrice = null; lastTickTime = null;
    clearOrderLines();
    elStopPx.value = '';

    elLogList.innerHTML = '';
    elBalance.readOnly = false;
    elBalance.value = balance.toFixed(2);
    lockSimInputs(false);
    elComm.value = commissionPct;
    elSlip.value = slippagePct;
    elPrice.textContent = currentPrice ? fmtPrice(currentPrice) : '—';
    elPnl.style.display = 'none';
    summary.style.display = 'none';
    updateSessionPnl();
    clearChartMarks();
    setMode(mode);
    setOrderType('market');
    updatePendingUI();
    refreshButtons();

    // compact by default on phones; the user's choice is remembered
    let saved = null;
    try { saved = localStorage.getItem(COMPACT_KEY); } catch {}
    setCompact(saved != null ? saved === '1' : document.body.classList.contains('mobile'));
    widget.style.display = 'block';
    let sp = null;
    try { sp = JSON.parse(localStorage.getItem(POS_KEY)); } catch {}
    const r = chartHost.getBoundingClientRect();
    if (sp && Number.isFinite(sp.x) && Number.isFinite(sp.y)) {
      widget.style.left = sp.x + 'px'; widget.style.top = sp.y + 'px';
    } else if (document.body.classList.contains('mobile')) {
      // bottom-centre of the chart, clear of the replay bar
      widget.style.left = (r.left + (r.width - widget.offsetWidth) / 2) + 'px';
      widget.style.top  = (r.bottom - widget.offsetHeight - 14) + 'px';
    } else {
      widget.style.left = (r.left + 16) + 'px';
      widget.style.top  = (r.bottom - widget.offsetHeight - 16) + 'px';
    }
    keepOnScreen();
  }

  // called on every replay tick with the latest price
  // `candle` (optional, {time,open,high,low,close}) lets pending limit / stop orders
  // trigger on the candle's wick, not just its close.
  function onTick(price, candle) {
    if (!active || price == null) return;
    currentPrice = price;
    elPrice.textContent = fmtPrice(price);
    // stepping back re-emits older candles - never trigger orders on those
    const forward = !candle || lastTickTime == null || candle.time >= lastTickTime;
    if (candle) lastTickTime = candle.time;
    if (forward && candle) checkOrders(candle);
    if (position) updatePnl();
  }

  // A stop that existed before this candle closes the position at the stop (or the
  // gap open if price jumped past it). A pending limit fills at the limit (or better).
  function checkOrders(c) {
    if (position && stopPrice != null) {
      const long = position.side === 'long';
      const hit = long ? c.low <= stopPrice : c.high >= stopPrice;
      if (hit) {
        const gap = long ? Math.min(stopPrice, c.open) : Math.max(stopPrice, c.open);
        close(gap, 'STOP');
        return;
      }
    }
    if (!position && pending) {
      const long = pending.side === 'long';
      const hit = long ? c.low <= pending.price : c.high >= pending.price;
      if (hit) {
        const fill = long ? Math.min(pending.price, c.open) : Math.max(pending.price, c.open);
        const side = pending.side;
        pending = null; clearPendingLine(); updatePendingUI();
        open(side, fill, undefined, { noSlip: true });
        note(`${side.toUpperCase()} LIMIT FILLED @ ${fmtPrice(fill)}`, side === 'long' ? UP : DOWN);
      }
    }
  }

  // ---- limit / stop orders --------------------------------------------------
  function setOrderType(t) {
    orderType = t;
    elOType.querySelectorAll('.tw-otab').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
    elLimitRow.style.display = t === 'limit' ? '' : 'none';
    if (t === 'limit' && !elLimit.value && currentPrice) elLimit.value = String(+currentPrice.toFixed(dec(currentPrice)));
    elLong.textContent = t === 'limit' ? 'BUY LIMIT ▲' : 'LONG ▲';
    elShort.textContent = t === 'limit' ? 'SELL LIMIT ▼' : 'SHORT ▼';
  }

  // LONG / SHORT button: market -> open now; limit -> queue a pending order
  function place(side) {
    if (orderType === 'market' || compact) { open(side); return; }
    if (!active || position || pending) return;
    const px = parseFloat(elLimit.value);
    if (!(px > 0)) { note('Enter a limit price', '#8a8d93'); return; }
    if (side === 'long' && px >= currentPrice) { note('Buy limit must be below the current price', DOWN); return; }
    if (side === 'short' && px <= currentPrice) { note('Sell limit must be above the current price', DOWN); return; }
    pending = { side, price: px };
    drawPendingLine();
    updatePendingUI();
    refreshButtons();
    note(`${side === 'long' ? 'BUY' : 'SELL'} LIMIT placed @ ${fmtPrice(px)}`, '#8a8d93');
  }
  function cancelPending() {
    if (!pending) return;
    pending = null; clearPendingLine(); updatePendingUI(); refreshButtons();
  }
  function updatePendingUI() {
    if (!elPendRow) return;
    elPendRow.style.display = pending ? '' : 'none';
    if (pending) elPendTxt.textContent = `${pending.side === 'long' ? 'BUY' : 'SELL'} LIMIT @ ${fmtPrice(pending.price)}`;
  }

  function setStop(px) {
    if (!position) return;
    if (!(px > 0)) { note('Enter a stop price', '#8a8d93'); return; }
    if (position.side === 'long' && px >= currentPrice) { note('Stop for a long must be below the current price', DOWN); return; }
    if (position.side === 'short' && px <= currentPrice) { note('Stop for a short must be above the current price', DOWN); return; }
    stopPrice = px;
    if (position.initStop == null) position.initStop = px;   // first stop = the 1R risk, for the R multiple in the log
    drawStopLine();
    note(`STOP set @ ${fmtPrice(px)}`, '#8a8d93');
  }
  function clearStop() {
    stopPrice = null; clearStopLine();
    if (elStopPx) elStopPx.value = '';
  }

  function drawPendingLine() {
    clearPendingLine();
    pendingLine = series.createPriceLine({ price: pending.price, color: '#f0b90b', lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true,
      title: `${pending.side === 'long' ? 'BUY' : 'SELL'} LIMIT` });
  }
  function drawStopLine() {
    clearStopLine();
    stopLine = series.createPriceLine({ price: stopPrice, color: '#ff7043', lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dotted, axisLabelVisible: true, title: 'STOP' });
  }
  function clearPendingLine() { if (pendingLine) { series.removePriceLine(pendingLine); pendingLine = null; } }
  function clearStopLine() { if (stopLine) { series.removePriceLine(stopLine); stopLine = null; } }
  function clearOrderLines() { clearPendingLine(); clearStopLine(); }

  // `price` (optional) fills at a specific price instead of the current tick —
  // Strategy Mode uses it for next-bar-open entries and SL/TP level exits.
  // `size` (optional) — notional to open (per-trade / risk-based sizing); omitted →
  // the widget's size % of balance.
  // `opts.noSlip` — limit-order fill at an exact price (no slippage).
  function open(side, price, size, opts) {
    if (!active || position) return;
    const slip = opts && opts.noSlip ? 0 : slippagePct / 100;
    const px = price != null ? price : currentPrice;
    // slippage worsens the entry fill (pay up for longs, sell lower for shorts)
    const fill = side === 'long' ? px * (1 + slip) : px * (1 - slip);
    const notional = size > 0 ? size : balance * (sizePct / 100);
    position = { side, entryPrice: fill, size: notional, entryTime: Date.now(),
      entryCandleIndex: (typeof Replay !== 'undefined' ? Replay.cutIndex : null) };
    hasTraded = true;
    elBalance.readOnly = true;
    lockSimInputs(true);
    drawEntryLine();
    elPnl.style.display = '';
    updatePnl();
    updateStatus();
    refreshButtons();
    playOpenSound(side);
  }

  function close(price, reason) {
    if (!position) return;
    const slip = slippagePct / 100;
    const px = price != null ? price : currentPrice;
    const exitFill = position.side === 'long' ? px * (1 - slip) : px * (1 + slip);
    const grossPct = position.side === 'long'
      ? ((exitFill - position.entryPrice) / position.entryPrice) * 100
      : ((position.entryPrice - exitFill) / position.entryPrice) * 100;
    const grossUsd = position.size * (grossPct / 100);
    const fees = position.size * (commissionPct / 100) * 2; // entry + exit commission
    totalFees += fees;
    const usd = grossUsd - fees;
    balance += usd;
    sessionPnl += usd;
    const riskPct = position.initStop != null ? Math.abs(position.entryPrice - position.initStop) / position.entryPrice * 100 : 0;
    const r = riskPct > 0 ? grossPct / riskPct : null;
    trades.push({ side: position.side, entry: position.entryPrice, exit: exitFill,
      pct: grossPct, usd, fees, r });
    addLogRow(trades[trades.length - 1]);
    updateSessionPnl();
    playCloseSound(usd >= 0);
    showToast(position.side, usd, grossPct, reason);

    position = null;
    clearStop();
    clearChartMarks();
    elPnl.style.display = 'none';
    elBalance.value = balance.toFixed(2);
    updateStatus();
    refreshButtons();
  }

  function lockSimInputs(lock) {
    if (elComm) elComm.readOnly = lock;
    if (elSlip) elSlip.readOnly = lock;
  }

  function updateStatus() {
    if (!elStatus) return;
    if (!position) { elStatus.textContent = 'No position'; elStatus.className = 'tw-status'; }
    else {
      elStatus.textContent = `${position.side.toUpperCase()} since ${fmtPrice(position.entryPrice)}`;
      elStatus.className = 'tw-status ' + position.side;
    }
  }

  // 'game' = manual LONG/SHORT/CLOSE buttons; 'strategy' = read-only status label
  function setMode(m) {
    mode = m;
    if (!widget) return;
    const strat = m === 'strategy';
    elActions.style.display = strat ? 'none' : 'block';
    elStatus.style.display = strat ? 'block' : 'none';
    updateStatus();
  }

  function refreshButtons() {
    elLong.disabled = !!position || !!pending;
    elShort.disabled = !!position || !!pending;
    elClose.disabled = !position;
    if (elStopRow) elStopRow.style.display = position && mode !== 'strategy' ? '' : 'none';
  }

  // ---- live P&L ------------------------------------------------------------
  function updatePnl() {
    const { pct, usd } = pnlOf(currentPrice);
    const col = usd >= 0 ? UP : DOWN;
    const txt = `${fmtMoney(usd)} (${fmtPct(pct)})`;
    const valEl = widget.querySelector('.tw-pnl-val');
    valEl.textContent = txt; valEl.style.color = col;

    pnlLabel.textContent = `${fmtPct(pct)} · ${fmtMoney(usd)}`;
    pnlLabel.style.color = col;
    pnlLabel.style.borderColor = col;
    pnlLabel.style.display = 'block';
    positionPnlLabel();
  }

  function positionPnlLabel() {
    if (!position || pnlLabel.style.display === 'none') return;
    const yy = series.priceToCoordinate(position.entryPrice);
    if (yy == null) { pnlLabel.style.display = 'none'; return; }
    pnlLabel.style.display = 'block';
    pnlLabel.style.top = (yy - 26) + 'px';
    pnlLabel.style.right = '78px';
  }

  // ---- on-chart entry line -------------------------------------------------
  function drawEntryLine() {
    clearChartMarks();
    const col = position.side === 'long' ? UP : DOWN;
    entryLine = series.createPriceLine({
      price: position.entryPrice,
      color: col, lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: `${position.side.toUpperCase()} @ ${fmtPrice(position.entryPrice)}`,
    });
  }
  function clearChartMarks() {
    if (entryLine) { series.removePriceLine(entryLine); entryLine = null; }
    pnlLabel.style.display = 'none';
  }

  // ---- trade log -----------------------------------------------------------
  function addLogRow(t) {
    const row = document.createElement('div');
    row.className = 'tw-log-row ' + (t.usd >= 0 ? 'win' : 'loss');
    row.innerHTML =
      `<span class="lg-side">${t.side.toUpperCase()}</span>` +
      `<span class="lg-px">${fmtPrice(t.entry)} → ${fmtPrice(t.exit)}</span>` +
      `<span class="lg-usd">${fmtMoney(t.usd)}</span>` +
      `<span class="lg-pct">${fmtPct(t.pct)}</span>` +
      `<span class="lg-r">${t.r == null ? '' : (t.r >= 0 ? '+' : '') + t.r.toFixed(2) + 'R'}</span>`;
    elLogList.prepend(row);
  }

  function updateSessionPnl() {
    if (!elSessionPnl) return;
    const abs = Math.abs(sessionPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sign = sessionPnl > 0 ? '+' : sessionPnl < 0 ? '-' : '';
    elSessionPnl.textContent = `${sign}$${abs}`;
    elSessionPnl.style.color = sessionPnl > 0 ? UP : sessionPnl < 0 ? DOWN : '#8a8d93';
  }

  // ---- sounds --------------------------------------------------------------
  let _audioCtx = null;
  function _ac() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  }

  function _tone(ac, freq, startT, dur, gainPeak, type = 'sine') {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startT);
    gain.gain.linearRampToValueAtTime(gainPeak, startT + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startT + dur);
    osc.start(startT); osc.stop(startT + dur);
  }

  // Short confirmatory blip when opening a position
  function playOpenSound(side) {
    try {
      const ac = _ac();
      const freq = side === 'long' ? 660 : 440; // higher pitch for long, lower for short
      _tone(ac, freq,       ac.currentTime,        0.12, 0.55);
      _tone(ac, freq * 1.5, ac.currentTime + 0.10, 0.10, 0.35);
    } catch {}
  }

  // Two-note jingle when closing — ascending = win, descending = loss
  function playCloseSound(win) {
    try {
      const ac = _ac();
      const notes = win ? [784, 1047] : [523, 370]; // G5→C6 win  /  C5→F#4 loss
      notes.forEach((freq, i) => {
        _tone(ac, freq, ac.currentTime + i * 0.15, 0.28, 0.6);
      });
    } catch {}
  }

  // Cinematic "tape start" whoosh when entering replay
  function playReplayStartSound() {
    try {
      const ac = _ac();
      // Rising sweep: sine gliding from 200→600 Hz
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ac.currentTime);
      osc.frequency.linearRampToValueAtTime(600, ac.currentTime + 0.25);
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0.45, ac.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.35);
      // Short accent click on top
      _tone(ac, 880, ac.currentTime + 0.18, 0.12, 0.3);
    } catch {}
  }

  // Short downward whoosh when exiting / ending replay
  function playReplayExitSound() {
    try {
      const ac = _ac();
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, ac.currentTime);
      osc.frequency.linearRampToValueAtTime(180, ac.currentTime + 0.28);
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, ac.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.32);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.32);
    } catch {}
  }

  // ---- toast ---------------------------------------------------------------
  let toastTimer = null;
  function showToast(side, usd, pct, reason) {
    toast.textContent = `${reason === 'STOP' ? 'STOPPED OUT' : 'CLOSED'} ${side.toUpperCase()} · ${fmtMoney(usd)} (${fmtPct(pct)})`;
    toast.style.color = usd >= 0 ? UP : DOWN;
    toast.style.borderColor = usd >= 0 ? UP : DOWN;
    toast.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  // short neutral/coloured message (order placed, filled, rejected...)
  function note(text, col) {
    toast.textContent = text;
    toast.style.color = col; toast.style.borderColor = col;
    toast.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2500);
  }

  // ---- stop session + summary ---------------------------------------------
  function stop(showSummary) {
    if (!active) return;
    // settle any open position at the last price before ending
    if (position) close();
    active = false;
    pending = null; stopPrice = null;
    clearOrderLines();
    widget.style.display = 'none';
    clearChartMarks();
    if (showSummary) renderSummary();
  }

  function renderSummary() {
    const final = balance;
    const ret = ((final - startBalance) / startBalance) * 100;
    const wins = trades.filter((t) => t.usd > 0).length;
    const winRate = trades.length ? Math.round((wins / trades.length) * 100) : 0;
    const best  = trades.length ? Math.max(...trades.map((t) => t.usd)) : 0;
    const worst = trades.length ? Math.min(...trades.map((t) => t.usd)) : 0;
    const retCol = ret >= 0 ? UP : DOWN;
    const pnlCol = sessionPnl >= 0 ? UP : DOWN;

    summary.innerHTML =
      `<div class="ts-title">SESSION SUMMARY</div>` +
      `<div class="ts-pnl-banner" style="color:${pnlCol};border-color:${pnlCol}">` +
        `<span class="ts-pnl-label">Total P&amp;L</span>` +
        `<span class="ts-pnl-val">${fmtMoney(sessionPnl)}</span>` +
      `</div>` +
      `<div class="ts-row"><span>Starting balance</span><b>${fmtBal(startBalance)}</b></div>` +
      `<div class="ts-row"><span>Final balance</span><b>${fmtBal(final)}</b></div>` +
      `<div class="ts-row"><span>Total return</span><b style="color:${retCol}">${fmtPct(ret)}</b></div>` +
      `<div class="ts-row"><span>Total trades</span><b>${trades.length}</b></div>` +
      `<div class="ts-row"><span>Win rate</span><b>${winRate}%</b></div>` +
      `<div class="ts-row"><span>Best trade</span><b style="color:${UP}">${fmtMoney(best)}</b></div>` +
      `<div class="ts-row"><span>Worst trade</span><b style="color:${DOWN}">${fmtMoney(worst)}</b></div>` +
      `<div class="ts-row"><span>Total fees paid</span><b>${fmtBal(totalFees)}</b></div>` +
      `<div class="ts-actions"><button class="tw-btn ts-again">Play Again</button>` +
      `<button class="tw-btn ts-exit">Exit</button></div>`;
    summary.querySelector('.ts-again').onclick = () => { summary.style.display = 'none'; if (onPlayAgain) onPlayAgain(); };
    summary.querySelector('.ts-exit').onclick  = () => { summary.style.display = 'none'; if (onExit) onExit(); };
    summary.style.display = 'block';
  }

  function getAccount() {
    return { position: position ? position.side : null,
      entryPrice: position ? position.entryPrice : null,
      size: position ? position.size : 0, balance };
  }

  return { init, start, stop, onTick, open, close, setMode, getAccount,
    playReplayStartSound, playReplayExitSound,
    get active() { return active; }, get mode() { return mode; } };
})();
