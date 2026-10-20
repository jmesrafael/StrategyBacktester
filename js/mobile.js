// mobile.js — compact phone layout + installable app (PWA)
//
// On small screens the same replay game runs with a Trading Grounds-style layout:
//   • secondary top-bar controls move into a "⋮" overflow sheet
//   • the trade widget docks under the chart (beside it in landscape) instead of floating
//   • tap a candle (or 🎲 Random) to start replay — no double-click needed
// Nothing here changes replay / trading mechanics; it only re-homes existing DOM
// and restores it when the viewport grows back to desktop size.

(function () {
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const MQ = window.matchMedia('(max-width: 820px), (pointer: coarse) and (max-height: 520px)');

  const sheet = $('moreSheet');
  const dock = $('mDock');
  const chartHost = $('chartHost');

  // Secondary controls collected into the overflow sheet on mobile.
  // Each gets a placeholder comment so it can be put back on desktop.
  const SHEET_ITEMS = [
    document.querySelector('.topbar .picker'),   // chart type
    $('indicatorsBtn'), $('strategyBtn'), $('dataBtn'),
    $('maxCandles') && $('maxCandles').closest('.field-inline'),
    $('toolbarToggle'), $('settingsBtn'),
  ].filter(Boolean);
  const placeholders = new Map();

  // install entry (shown only when the browser offers it, or on iOS as a hint)
  const installBtn = document.createElement('button');
  installBtn.className = 'tb-btn sheet-install';
  installBtn.innerHTML = '<i class="fas fa-mobile-screen-button"></i> Install app';
  installBtn.style.display = 'none';

  let mobile = false;

  function relocate(toMobile) {
    if (toMobile) {
      SHEET_ITEMS.forEach((el) => {
        if (!placeholders.has(el)) {
          const ph = document.createComment('m-slot');
          el.parentNode.insertBefore(ph, el);
          placeholders.set(el, ph);
        }
        sheet.appendChild(el);
      });
      sheet.appendChild(installBtn);
    } else {
      placeholders.forEach((ph, el) => { ph.parentNode.insertBefore(el, ph); });
      closeSheet();
    }
  }

  function apply() {
    const want = MQ.matches;
    if (want === mobile) return;
    mobile = want;
    body.classList.toggle('mobile', mobile);
    relocate(mobile);
    // drawing toolbar starts hidden on phones (still available from the ⋮ sheet)
    if (mobile && !sessionStorage.getItem('cr.m.toolbarSeen')) {
      body.classList.add('no-toolbar');
      sessionStorage.setItem('cr.m.toolbarSeen', '1');
    }
  }

  // ---- overflow sheet -------------------------------------------------------
  function closeSheet() { sheet.classList.remove('open'); $('moreBtn').classList.remove('active'); }
  $('moreBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = sheet.classList.toggle('open');
    $('moreBtn').classList.toggle('active', open);
  });
  // Clicks on sheet items open their own panels; close the sheet so the panel
  // has the screen — except the chart-type picker, whose menu lives inside it.
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('.picker, .field-inline, select')) return;
    if (e.target.closest('button')) setTimeout(closeSheet, 0);
  });
  document.addEventListener('click', (e) => {
    if (!sheet.contains(e.target) && e.target !== $('moreBtn')) closeSheet();
  });

  // ---- replay start: tap on mobile, 🎲 random everywhere --------------------
  function app() { return window.App || null; }

  // A short, stationary tap on the chart picks the start candle. Detected from raw
  // pointer events (not the chart's own click/double-tap logic, which can swallow
  // a tap that follows another one) so a pan or pinch never starts the replay.
  const chart = ChartView.getChart();
  let tapStart = null;
  chartHost.addEventListener('pointerdown', (e) => {
    tapStart = (e.isPrimary && !e.target.closest('.cut-hint'))
      ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null;
  }, true);
  chartHost.addEventListener('pointerup', (e) => {
    const s = tapStart; tapStart = null;
    if (!s || !mobile || !chartHost.classList.contains('cutting') || !app()) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10 || e.timeStamp - s.t > 600) return;
    const x = e.clientX - chartHost.getBoundingClientRect().left;
    const logical = chart.timeScale().coordinateToLogical(x);
    if (logical == null) return;
    const last = app().candles.length - 1;
    app().enterReplayMode(Math.max(0, Math.min(last, Math.round(logical))));
  }, true);

  $('randomStartBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const a = app(); if (!a) return;
    const n = a.candles.length; if (n < 50) return;
    // leave history to read before the start and room to play after it
    const lo = Math.floor(n * 0.15), hi = Math.floor(n * 0.85);
    a.enterReplayMode(lo + Math.floor(Math.random() * (hi - lo)));
  });

  // ---- PWA: service worker + install prompt --------------------------------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
  let deferredPrompt = null;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = '';
  });
  if (isIOS && !standalone) installBtn.style.display = '';
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => {});
      deferredPrompt = null;
      installBtn.style.display = 'none';
    } else if (isIOS) {
      alert('To install: tap the Share button, then "Add to Home Screen".');
    }
  });
  window.addEventListener('appinstalled', () => { installBtn.style.display = 'none'; });
  if (standalone) body.classList.add('standalone');

  // ---- boot -----------------------------------------------------------------
  apply();
  MQ.addEventListener('change', apply);
  // the Random button needs the app hook; hide it until it exists
  if (!app()) $('randomStartBtn').style.display = 'none';
})();
