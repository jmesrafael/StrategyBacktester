// draw-toolbar.js — vertical left drawing toolbar + floating favorites widget.
//
// The side toolbar (docked at the chart's left edge) is the master catalog of
// drawing tools, grouped TradingView-style. Each tool carries a favorite star;
// starred tools are mirrored into the floating widget (#ftFavs) so the trader
// can keep a compact, draggable set of go-to tools on the chart.

const DrawToolbar = (() => {
  // --- icon set (inner SVG markup, 24x24 viewBox) ------------------------------
  const ICON = {
    cursor: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 8-6 1.5L10 19 5 3z"/></svg>',
    trend:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18L20 6"/><circle cx="4" cy="18" r="2" fill="currentColor"/><circle cx="20" cy="6" r="2" fill="currentColor"/></svg>',
    ray:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18L21 5"/><circle cx="4" cy="18" r="2" fill="currentColor"/></svg>',
    hline:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18"/></svg>',
    hray:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h16"/><circle cx="5" cy="12" r="2" fill="currentColor"/></svg>',
    vline:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v16"/><circle cx="12" cy="4" r="2" fill="currentColor"/></svg>',
    fib:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h18"/><path d="M3 10h18" opacity=".75"/><path d="M3 14h18" opacity=".75"/><path d="M3 19h18"/></svg>',
    rect:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>',
    clear:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg>',
    eye:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7c2 0 3.8.6 5.3 1.5M22 12s-3.5 7-10 7c-2 0-3.8-.6-5.3-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>',
  };

  // Persisted toggle: whether the floating drawing-favorites widget is shown.
  const FAVS_HIDDEN_KEY = 'cr.hideDrawFavs';
  let favsHidden = false;
  function loadFavsHidden() { try { favsHidden = localStorage.getItem(FAVS_HIDDEN_KEY) === '1'; } catch { favsHidden = false; } }
  function applyFavsVisibility() {
    document.body.classList.toggle('hide-favs', favsHidden);
    try { localStorage.setItem(FAVS_HIDDEN_KEY, favsHidden ? '1' : '0'); } catch {}
    document.querySelectorAll('#sideToolbar .favs-eye-btn').forEach((b) => {
      b.innerHTML = favsHidden ? ICON.eyeOff : ICON.eye;
      b.classList.toggle('active', !favsHidden);
      b.title = favsHidden ? 'Show drawing favorites widget' : 'Hide drawing favorites widget';
    });
  }

  // --- tool catalog (grouped; separators drawn between groups) -----------------
  const GROUPS = [
    { id: 'cursor', tools: [
      { id: 'cursor', title: 'Cursor (Esc)', favoritable: false },
    ]},
    { id: 'lines', tools: [
      { id: 'trend', title: 'Trend line' },
      { id: 'ray',   title: 'Ray' },
      { id: 'hline', title: 'Horizontal line' },
      { id: 'hray',  title: 'Horizontal ray' },
      { id: 'vline', title: 'Vertical line' },
    ]},
    { id: 'fib', tools: [
      { id: 'fib', title: 'Fib retracement' },
    ]},
    { id: 'shapes', tools: [
      { id: 'rect', title: 'Rectangle' },
    ]},
  ];

  const DEFAULT_FAVS = ['trend', 'hline', 'fib', 'rect'];
  const ALL_TOOLS = GROUPS.flatMap((g) => g.tools);
  const STAR = '<svg viewBox="0 0 24 24" class="fav-ic"><path d="M12 3l2.6 5.6L20 9.4l-4 4 1 5.6-5-2.8-5 2.8 1-5.6-4-4 5.4-.8z"/></svg>';

  let favs = [];
  let onPick = () => {};

  function loadFavs() {
    try {
      const saved = JSON.parse(localStorage.getItem(CFG.STORE.drawFavs));
      favs = Array.isArray(saved) ? saved.filter((id) => ALL_TOOLS.some((t) => t.id === id)) : DEFAULT_FAVS.slice();
    } catch { favs = DEFAULT_FAVS.slice(); }
  }
  function saveFavs() {
    try { localStorage.setItem(CFG.STORE.drawFavs, JSON.stringify(favs)); } catch {}
  }
  function isFav(id) { return favs.includes(id); }
  function toggleFav(id) {
    const t = ALL_TOOLS.find((x) => x.id === id);
    if (!t || t.favoritable === false) return;
    if (isFav(id)) favs = favs.filter((x) => x !== id);
    else favs.push(id);
    saveFavs(); renderSide(); renderFavs();
  }

  // --- rendering ---------------------------------------------------------------
  function toolBtn(t, withStar) {
    const btn = document.createElement('button');
    btn.className = 'iconbtn tool-btn';
    btn.dataset.tool = t.id;
    btn.title = t.title;
    btn.innerHTML = ICON[t.id] || '';
    if (withStar && t.favoritable !== false) {
      const star = document.createElement('span');
      star.className = 'fav-star' + (isFav(t.id) ? ' on' : '');
      star.title = isFav(t.id) ? 'Remove from favorites' : 'Add to favorites';
      star.innerHTML = STAR;
      star.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(t.id); });
      btn.appendChild(star);
    }
    btn.addEventListener('click', () => onPick(t.id));
    return btn;
  }

  function renderSide() {
    const host = document.getElementById('sideToolbar');
    if (!host) return;
    host.innerHTML = '';
    GROUPS.forEach((g, i) => {
      if (i > 0) { const s = document.createElement('div'); s.className = 'tool-sep'; host.appendChild(s); }
      g.tools.forEach((t) => host.appendChild(toolBtn(t, true)));
    });
    // bottom actions: toggle the favorites widget, then clear all drawings
    const s = document.createElement('div'); s.className = 'tool-sep'; host.appendChild(s);
    const eye = document.createElement('button');
    eye.className = 'iconbtn tool-btn favs-eye-btn';
    eye.addEventListener('click', () => { favsHidden = !favsHidden; applyFavsVisibility(); });
    host.appendChild(eye);
    const clr = document.createElement('button');
    clr.className = 'iconbtn tool-btn'; clr.title = 'Remove all drawings';
    clr.innerHTML = ICON.clear;
    clr.addEventListener('click', () => Drawings.clearAll());
    host.appendChild(clr);
    applyFavsVisibility();
    setActive(Drawings.tool);
  }

  function renderFavs() {
    const host = document.getElementById('ftFavs');
    if (!host) return;
    host.innerHTML = '';
    // cursor is always present in the floating widget
    host.appendChild(toolBtn(ALL_TOOLS.find((t) => t.id === 'cursor'), false));
    if (favs.length) { const s = document.createElement('div'); s.className = 'ft-sep'; host.appendChild(s); }
    favs.forEach((id) => {
      const t = ALL_TOOLS.find((x) => x.id === id);
      if (t) host.appendChild(toolBtn(t, false));
    });
    setActive(Drawings.tool);
  }

  // reflect the active tool across both toolbars
  function setActive(tool) {
    document.querySelectorAll('#sideToolbar [data-tool], #ftFavs [data-tool]')
      .forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  }

  function init(pick) {
    onPick = pick || (() => {});
    loadFavs();
    loadFavsHidden();
    renderSide();
    renderFavs();
  }

  return { init, setActive };
})();
