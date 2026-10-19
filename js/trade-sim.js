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
  let commissionPct = CFG.DEFAULT_COMMISSION_PCT;
  let slippagePct = CFG.DEFAULT_SLIPPAGE_PCT;
  let customSizePcts = [...CFG.SIZE_PCTS]; // editable size preset buttons
  let totalFees = 0;     // accumulated commission across the session
  let sessionPnl = 0;   // running total of all closed-trade net P&L
  let position = null;   // {side, entryPrice, size, entryTime, entryCandleIndex}
  let trades = [];       // closed trades
  let currentPrice = 0;
  let hasTraded = false; // locks the balance + sim-settings inputs once a trade opens
  let mode = 'game';     // 'game' (manual buttons) | 'strategy' (read-only status)

  // DOM
  let widget, elBalance, elPrice, elPnl, elSessionPnl, elTradesVal, elLogList, elSizes, elLong, elShort, elClose;
  let elComm, elSlip, elStatus, elActions;
  let pnlLabel, toast, summary;
  let entryLine = null;

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

  // ---- sim settings persistence -------------------------------------------
  function loadSimSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(CFG.STORE.tradeSim) || 'null');
      if (!saved) return;
      if (saved.startBalance > 0) { startBalance = saved.startBalance; balance = saved.startBalance; }
      if (Array.isArray(saved.sizePcts) && saved.sizePcts.length) customSizePcts = saved.sizePcts;
      if (typeof saved.sizePct === 'number') sizePct = saved.sizePct;
      if (typeof saved.commissionPct === 'number' && saved.commissionPct >= 0) commissionPct = saved.commissionPct;
      if (typeof saved.slippagePct === 'number' && saved.slippagePct >= 0) slippagePct = saved.slippagePct;
    } catch {}
  }
  function saveSimSettings() {
    try {
      localStorage.setItem(CFG.STORE.tradeSim, JSON.stringify({
        startBalance, sizePcts: customSizePcts.slice(), sizePct, commissionPct, slippagePct,
      }));
    } catch {}
  }

  // ---- init (build DOM once) ----------------------------------------------
  function init(opts) {
    chart = opts.chart; series = opts.series; chartHost = opts.chartHost;
    onPlayAgain = opts.onPlayAgain; onExit = opts.onExit;
    loadSimSettings();
    buildWidget();
    buildExtras();
    chart.timeScale().subscribeVisibleLogicalRangeChange(positionPnlLabel);
  }

  function buildWidget() {
    widget = document.createElement('div');
    widget.className = 'trade-widget';
    widget.style.display = 'none';
    widget.innerHTML =
      `<div class="tw-head"><span class="tw-grip">⠿</span> TRADE SIM</div>` +
      `<div class="tw-stats">` +
        `<div class="tw-stat">Capital $<input class="tw-balance" type="number" min="1" step="100"></div>` +
        `<div class="tw-stat">Price <b class="tw-price">—</b></div>` +
      `</div>` +
      `<div class="tw-simwrap">` +
        `<button class="tw-simtoggle" type="button">⚙ Sim Settings</button>` +
        `<div class="tw-sim" style="display:none">` +
          `<div class="tw-sim-grid">` +
            `<label>Fee %<input class="tw-comm" type="number" min="0" step="0.001"></label>` +
            `<label>Slippage %<input class="tw-slip" type="number" min="0" step="0.001"></label>` +
          `</div>` +
          `<div class="tw-sim-presets">` +
            `<span class="tw-sim-label">Size presets (%)</span>` +
            `<div class="tw-sz-row"></div>` +
          `</div>` +
        `</div>` +
      `</div>` +
      `<div class="tw-sizes"></div>` +
      `<div class="tw-actions-wrap">` +
        `<div class="tw-actions">` +
          `<button class="tw-btn tw-long">LONG ▲</button>` +
          `<button class="tw-btn tw-short">SHORT ▼</button>` +
        `</div>` +
        `<div class="tw-actions"><button class="tw-btn tw-close">CLOSE ■</button></div>` +
      `</div>` +
      `<div class="tw-status" style="display:none">No position</div>` +
      `<div class="tw-pnl" style="display:none">P&amp;L <b class="tw-pnl-val">+$0.00 (+0.00%)</b></div>` +
      `<div class="tw-session-pnl">Session P&amp;L <b class="tw-session-pnl-val">$0.00</b></div>` +
      `<div class="tw-trades">Trades <b class="tw-trades-val">0</b></div>` +
      `<div class="tw-log">` +
        `<button class="tw-log-toggle" type="button">` +
          `<span class="tw-log-title">TRADE LOG</span>` +
          `<span class="tw-log-caret">▸</span>` +
        `</button>` +
        `<div class="tw-log-list" style="display:none"></div>` +
      `</div>`;
    chartHost.appendChild(widget);

    elBalance    = widget.querySelector('.tw-balance');
    elPrice      = widget.querySelector('.tw-price');
    elPnl        = widget.querySelector('.tw-pnl');
    elSessionPnl = widget.querySelector('.tw-session-pnl-val');
    elTradesVal = widget.querySelector('.tw-trades-val');
    elLogList = widget.querySelector('.tw-log-list');
    elSizes   = widget.querySelector('.tw-sizes');
    elLong    = widget.querySelector('.tw-long');
    elShort   = widget.querySelector('.tw-short');
    elClose   = widget.querySelector('.tw-close');
    elComm    = widget.querySelector('.tw-comm');
    elSlip    = widget.querySelector('.tw-slip');
    elStatus  = widget.querySelector('.tw-status');
    elActions = widget.querySelector('.tw-actions-wrap');

    elBalance.value = startBalance.toFixed(2);
    elComm.value = commissionPct;
    elSlip.value = slippagePct;

    widget.querySelector('.tw-simtoggle').onclick = () => {
      const s = widget.querySelector('.tw-sim');
      s.style.display = s.style.display === 'none' ? 'block' : 'none';
    };
    elComm.addEventListener('change', () => {
      if (hasTraded) { elComm.value = commissionPct; return; }
      const v = parseFloat(elComm.value);
      if (v >= 0) { commissionPct = v; saveSimSettings(); } else elComm.value = commissionPct;
    });
    elSlip.addEventListener('change', () => {
      if (hasTraded) { elSlip.value = slippagePct; return; }
      const v = parseFloat(elSlip.value);
      if (v >= 0) { slippagePct = v; saveSimSettings(); } else elSlip.value = slippagePct;
    });

    // Size preset inputs in Sim Settings — editable values for each button
    const szRow = widget.querySelector('.tw-sz-row');
    customSizePcts.forEach((pct, i) => {
      const lbl = document.createElement('label');
      lbl.className = 'tw-sz-lbl';
      const inp = document.createElement('input');
      inp.className = 'tw-sz-inp'; inp.type = 'number'; inp.min = '1'; inp.max = '100'; inp.step = '1';
      inp.value = pct;
      inp.addEventListener('change', () => {
        let v = parseInt(inp.value);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 100) v = 100;
        inp.value = v;
        customSizePcts[i] = v;
        rebuildSizeButtons();
        saveSimSettings();
      });
      lbl.appendChild(inp);
      lbl.appendChild(document.createTextNode('%'));
      szRow.appendChild(lbl);
    });

    // Size button click delegation (survives rebuildSizeButtons innerHTML clears)
    elSizes.addEventListener('click', (e) => {
      const b = e.target.closest('.tw-size'); if (!b) return;
      sizePct = parseInt(b.dataset.pct);
      elSizes.querySelectorAll('.tw-size').forEach((x) => x.classList.toggle('active', x === b));
      saveSimSettings();
    });
    rebuildSizeButtons();

    elBalance.addEventListener('change', () => {
      if (hasTraded) return;
      const v = parseFloat(elBalance.value);
      if (v > 0) { startBalance = v; balance = v; saveSimSettings(); }
      elBalance.value = balance.toFixed(2);
    });

    elLong.onclick  = () => open('long');
    elShort.onclick = () => open('short');
    elClose.onclick = () => close();

    // Trade log is collapsed by default (not needed for most sessions). The toggle
    // shows/hides the per-trade rows; the trade COUNT stays visible either way.
    const logToggle = widget.querySelector('.tw-log-toggle');
    const caret = widget.querySelector('.tw-log-caret');
    logToggle.onclick = () => {
      const hidden = elLogList.style.display === 'none';
      elLogList.style.display = hidden ? 'flex' : 'none';
      caret.textContent = hidden ? '▾' : '▸';
    };

    makeDraggable(widget, widget.querySelector('.tw-head'));
  }

  function updateTradeCount() {
    if (elTradesVal) elTradesVal.textContent = trades.length;
  }

  function rebuildSizeButtons() {
    elSizes.innerHTML = '';
    customSizePcts.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'tw-size'; b.dataset.pct = p; b.textContent = p + '%';
      if (p === sizePct) b.classList.add('active');
      elSizes.appendChild(b);
    });
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

  // ---- drag ----------------------------------------------------------------
  function makeDraggable(box, handle) {
    let dragging = false, offX = 0, offY = 0;
    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      const r = box.getBoundingClientRect();
      // Normalize to left/top so drag math always works regardless of initial anchor
      box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
      box.style.right = 'auto'; box.style.bottom = 'auto';
      offX = e.clientX - r.left; offY = e.clientY - r.top;
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      let nx = e.clientX - offX, ny = e.clientY - offY;
      nx = Math.max(0, Math.min(window.innerWidth - box.offsetWidth, nx));
      ny = Math.max(0, Math.min(window.innerHeight - box.offsetHeight, ny));
      box.style.left = nx + 'px'; box.style.top = ny + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
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

    elLogList.innerHTML = '';
    updateTradeCount();
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
    refreshButtons();

    widget.style.display = 'block';
    // default position: bottom-right of the chart host
    const r = chartHost.getBoundingClientRect();
    widget.style.right  = (window.innerWidth - r.right + 16) + 'px';
    widget.style.top    = (r.bottom - widget.offsetHeight - 16) + 'px';
    widget.style.left   = 'auto';
  }

  // called on every replay tick with the latest price
  function onTick(price) {
    if (!active || price == null) return;
    currentPrice = price;
    elPrice.textContent = fmtPrice(price);
    if (position) updatePnl();
  }

  function open(side) {
    if (!active || position) return;
    const slip = slippagePct / 100;
    // slippage worsens the entry fill (pay up for longs, sell lower for shorts)
    const fill = side === 'long' ? currentPrice * (1 + slip) : currentPrice * (1 - slip);
    const size = balance * (sizePct / 100);
    position = { side, entryPrice: fill, size, entryTime: Date.now(),
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

  // exitPriceOverride: when an automated strategy closes on a stop/target, the fill price
  // is the stop/target LEVEL — not the candle close. Passing it here makes replay P&L match
  // the backtest engine (js/strategy.js simulate()). Manual/market closes omit it.
  function close(exitPriceOverride) {
    if (!position) return;
    const slip = slippagePct / 100;
    const px = (exitPriceOverride != null && isFinite(exitPriceOverride)) ? exitPriceOverride : currentPrice;
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
    trades.push({ side: position.side, entry: position.entryPrice, exit: exitFill,
      pct: grossPct, usd, fees });
    addLogRow(trades[trades.length - 1]);
    updateTradeCount();
    updateSessionPnl();
    playCloseSound(usd >= 0);
    showToast(position.side, usd, grossPct);

    position = null;
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
    elLong.disabled = !!position;
    elShort.disabled = !!position;
    elClose.disabled = !position;
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
      `<span class="lg-pct">${fmtPct(t.pct)}</span>`;
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
  function showToast(side, usd, pct) {
    toast.textContent = `CLOSED ${side.toUpperCase()} · ${fmtMoney(usd)} (${fmtPct(pct)})`;
    toast.style.color = usd >= 0 ? UP : DOWN;
    toast.style.borderColor = usd >= 0 ? UP : DOWN;
    toast.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  // ---- stop session + summary ---------------------------------------------
  function stop(showSummary) {
    if (!active) return;
    // settle any open position at the last price before ending
    if (position) close();
    active = false;
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
    // longest consecutive win / loss streaks over the session (chronological order)
    let cw = 0, cl = 0, maxCW = 0, maxCL = 0;
    trades.forEach((t) => {
      if (t.usd > 0) { cw++; cl = 0; maxCW = Math.max(maxCW, cw); }
      else if (t.usd < 0) { cl++; cw = 0; maxCL = Math.max(maxCL, cl); }
    });
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
      `<div class="ts-row"><span>Win streak</span><b style="color:${UP}">${maxCW}</b></div>` +
      `<div class="ts-row"><span>Loss streak</span><b style="color:${DOWN}">${maxCL}</b></div>` +
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
      entryPrice: position ? position.entryPrice : null, balance };
  }

  function applySettings(cfg) {
    if (hasTraded) return;
    if (cfg.startBalance > 0) {
      startBalance = cfg.startBalance; balance = cfg.startBalance;
      if (elBalance) elBalance.value = cfg.startBalance.toFixed(2);
    }
    if (typeof cfg.sizePct === 'number' && cfg.sizePct > 0) { sizePct = cfg.sizePct; rebuildSizeButtons(); }
    if (typeof cfg.commissionPct === 'number' && cfg.commissionPct >= 0) { commissionPct = cfg.commissionPct; if (elComm) elComm.value = cfg.commissionPct; }
    if (typeof cfg.slippagePct === 'number' && cfg.slippagePct >= 0) { slippagePct = cfg.slippagePct; if (elSlip) elSlip.value = cfg.slippagePct; }
    saveSimSettings();
  }

  return { init, start, stop, onTick, open, close, setMode, getAccount, applySettings,
    playReplayStartSound, playReplayExitSound,
    get active() { return active; }, get mode() { return mode; } };
})();
