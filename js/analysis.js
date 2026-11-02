// analysis.js — the in-depth analysis page (analysis.html), opened from the 🔎 button of a setup indicator's performance calendar.
// Downloads the five coins' Binance candles (+ funding for BB-Core) once, keeps them on this device (IndexedDB), runs the bots' engines
// (js/analysis-core.js) and draws the report-style sections. Every setting lives in the URL hash, so a link reopens the same view.
(() => {
  const A = AnalysisCore, $ = (id) => document.getElementById(id);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const RISK_PRESETS = [0.5, 1, 2, 2.5, 5];
  const TAB_LIST = ['overview', 'periods', 'risk', 'trades'];
  const PARAM_UI = {
    targetR: { label: 'Target (R)', min: 0.5, max: 20, step: 0.5 },
    maxBars: { label: 'Time exit (candles)', min: 0, max: 1000, step: 1 },
    kInit: { label: 'First stop (×ATR)', min: 0.5, max: 10, step: 0.5 },
    kTrail: { label: 'Trail (×ATR)', min: 1, max: 20, step: 0.5 },
    trendLen: { label: 'Trend SMA (0 = off)', min: 0, max: 400, step: 10 },
  };

  // ---- settings (URL hash) -------------------------------------------------------------------------------------------------
  const DEF = { s: 'icore', tf: '240', coins: A.COINS.join(','), costs: 1, ...A.PARAMS, start: 10000, cur: '₱', risk: 2.5, cap: 0, from: '', to: '', view: 'total', tab: 'overview', tg: '1.5,2,3,4,5,6,8' };
  delete DEF.costs; DEF.costs = 1;
  const S = { ...DEF };
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    for (const k of Object.keys(DEF)) if (h.has(k)) S[k] = typeof DEF[k] === 'number' ? (isFinite(+h.get(k)) ? +h.get(k) : DEF[k]) : h.get(k);
    if (!A.STRATS[S.s]) S.s = DEF.s;
    if (!A.TF[S.tf]) S.tf = DEF.tf;
    if (!S.cur) S.cur = DEF.cur;
    if (!TAB_LIST.includes(S.tab)) S.tab = DEF.tab;
  }
  function writeHash() {
    const h = new URLSearchParams();
    for (const k of Object.keys(DEF)) if (String(S[k]) !== String(DEF[k])) h.set(k, S[k]);
    history.replaceState(null, '', '#' + h.toString());
  }
  const coinsOn = () => S.coins.split(',').filter((c) => A.COINS.includes(c));
  const params = () => ({ targetR: S.targetR, maxBars: S.maxBars, kInit: S.kInit, kTrail: S.kTrail, trendLen: S.trendLen, costs: !!S.costs });
  const money = () => ({ start: Math.max(1, S.start), risk: Math.max(0, S.risk) / 100, cap: Math.max(0, S.cap) });

  // ---- data: Binance USDT-M futures (CORS-open), cached in IndexedDB ------------------------------------------------------------
  const API = 'https://fapi.binance.com/fapi/v1', NATIVE = { '60': '1h', '120': '2h', '240': '4h', '360': '6h', '480': '8h', '720': '12h', 'D': '1d' };
  const FIRST = Date.UTC(2019, 8, 1), FRESH_MS = 15 * 60 * 1000;
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res) => {
      try { const r = indexedDB.open('cr-analysis', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = r.onblocked = () => res(null); }
      catch { res(null); }
    });
    return dbp;
  }
  async function idb(mode, fn) {
    const d = await db(); if (!d) return null;
    return new Promise((res) => { try { const t = d.transaction('kv', mode), r = fn(t.objectStore('kv')); t.oncomplete = () => res(r ? r.result : null); t.onerror = t.onabort = () => res(null); } catch { res(null); } });
  }
  const idbGet = (k) => idb('readonly', (s) => s.get(k)), idbPut = (k, v) => idb('readwrite', (s) => s.put(v, k));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function getJSON(url) {
    let last;
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(url), j = await r.json();
        if (Array.isArray(j)) return j;
        last = new Error((j && j.msg) || 'Binance error');
        if (r.status === 400) break;
        if (r.status === 429 || r.status === 418) { await sleep(Math.min(120, +r.headers.get('retry-after') || 30) * 1000); continue; }
      } catch (e) { last = e; }
      await sleep(500 * (i + 1));
    }
    throw last;
  }
  // rows [[time, open, high, low, close]], closed candles only
  async function candles(coin, tf, force, onPage) {
    const key = `C|${coin}|${tf}`, iv = A.TF[tf], have = await idbGet(key);
    const rows = have ? have.rows : [];
    if (have && !force && Date.now() - have.savedAt < FRESH_MS) return rows;
    let start = rows.length ? (rows[rows.length - 1][0] + iv) * 1000 : FIRST, page = 0;
    for (;;) {
      onPage(++page);
      const j = await getJSON(`${API}/klines?symbol=${coin}USDT&interval=${NATIVE[tf]}&limit=1500&startTime=${start}`);
      for (const k of j) rows.push([k[0] / 1000, +k[1], +k[2], +k[3], +k[4]]);
      if (j.length < 1500) break;
      start = j[j.length - 1][0] + 1;
      await sleep(80);
    }
    const now = Date.now() / 1000;
    while (rows.length && rows[rows.length - 1][0] + iv > now) rows.pop();   // the still-forming candle
    await idbPut(key, { rows, savedAt: Date.now() });
    return rows;
  }
  // [[time, rate]]: BB-Core charges the real funding (as in its research)
  async function funding(coin, force, onPage) {
    const key = `F|${coin}`, have = await idbGet(key), rows = have ? have.rows : [];
    if (have && !force && Date.now() - have.savedAt < FRESH_MS) return rows;
    let start = rows.length ? (rows[rows.length - 1][0] + 1) * 1000 : FIRST, page = 0;
    for (;;) {
      onPage(++page);
      const j = await getJSON(`${API}/fundingRate?symbol=${coin}USDT&startTime=${start}&limit=1000`);
      for (const k of j) rows.push([Math.round(k.fundingTime / 1000), +k.fundingRate]);
      if (j.length < 1000) break;
      start = j[j.length - 1].fundingTime + 1;
      await sleep(80);
    }
    await idbPut(key, { rows, savedAt: Date.now() });
    return rows;
  }

  // ---- pipeline: data → trades (engine) → analysis → sections ------------------------------------------------------------------
  const DATA = {};          // `${coin}|${tf}` → { B, F }
  let TR = null, trKey = '', lastCandle = 0, firstCandle = 0, loading = false;
  function status(msg, err, frac) {
    const el = $('status');
    el.className = 'status' + (err ? ' err' : '');
    el.innerHTML = msg + (frac != null ? `<div class="bar"><i style="width:${Math.round(frac * 100)}%"></i></div>` : '');
  }
  async function ensureData(force) {
    const need = A.STRATS[S.s].funding && S.costs;
    for (let k = 0; k < A.COINS.length; k++) {
      const c = A.COINS[k], key = `${c}|${S.tf}`;
      if (DATA[key] && !force && (!need || DATA[key].F)) continue;
      const tag = `${c} ${A.TF_LABEL[S.tf]}`;
      const rows = await candles(c, S.tf, force, (p) => status(`Downloading ${tag} candles · page ${p}…`, false, k / A.COINS.length));
      const F = need ? await funding(c, force, (p) => status(`Downloading ${c} funding · page ${p}…`, false, (k + 0.8) / A.COINS.length)) : (DATA[key] && DATA[key].F) || null;
      DATA[key] = { B: rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })), F };
    }
  }
  function computeTrades() {
    const key = [S.s, S.tf, S.targetR, S.maxBars, S.kInit, S.kTrail, S.trendLen, S.costs].join('|');
    if (TR && key === trKey) return;
    const iv = A.TF[S.tf], out = {};
    lastCandle = 0; firstCandle = Infinity;
    for (const c of A.COINS) {
      const d = DATA[`${c}|${S.tf}`];
      if (!d || d.B.length < 300) { out[c] = { trades: [], open: null }; continue; }
      out[c] = A.coinTrades(S.s, c, d.B, d.F, params(), iv);
      if (S.costs) out[c].free = A.coinTrades(S.s, c, d.B, d.F, { ...params(), costs: false }, iv).trades;   // what the costs take
      lastCandle = Math.max(lastCandle, d.B[d.B.length - 1].time); firstCandle = Math.min(firstCandle, d.B[0].time);
    }
    TR = out; trKey = key;
  }
  async function run(force) {
    if (loading) return;
    loading = true; $('refreshBtn').disabled = true;
    try {
      await ensureData(force);
      status('Running the engine on every coin…');
      await sleep(20);
      computeTrades();
      render();
      const iv = A.TF[S.tf];
      status(`Data to ${fmtDate(lastCandle + iv, true)} UTC (last closed ${A.TF_LABEL[S.tf]} candle) · kept on this device; ↻ Update data pulls the newest candles.`);
    } catch (e) {
      console.error(e);
      status(`Could not download the candles from Binance (${e.message || e}). Check the connection and press ↻ Update data.`, true);
    } finally { loading = false; $('refreshBtn').disabled = false; }
  }

  // ---- formatting --------------------------------------------------------------------------------------------------------------
  const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');
  const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'mut');
  const fR = (v, d = 1) => `${sgn(v)}${Math.abs(v).toFixed(d)}R`;
  const fPct = (v, d = 0) => `${sgn(+(v * 100).toFixed(d))}${Math.abs(v * 100).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })}%`;
  const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
  function fM(v, signed) {
    const a = Math.abs(v), s = signed ? sgn(v) : v < 0 ? '−' : '';
    const body = a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e7 ? (a / 1e6).toFixed(1) + 'M' : Math.round(a).toLocaleString('en-US');
    return `${s}${S.cur}${body}`;
  }
  function fK(v) {   // compact, for the grid cells
    const a = Math.abs(v), s = sgn(v);
    if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return s + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
    return s + Math.round(a);
  }
  const span = (v, txt) => `<span class="${cls(v)}">${txt}</span>`;
  const fmtDate = (t, time) => { const d = new Date(t * 1000); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` + (time ? ` ${String(d.getUTCHours()).padStart(2, '0')}:00` : ''); };
  const dot = (c) => `<span class="dot" style="background:var(--c-${c})"></span>`;
  const coinName = (c) => `${dot(c)}${c}`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const table = (head, rows, opts = {}) => `<div class="tw"><table class="data"${opts.id ? ` id="${opts.id}"` : ''}><thead><tr>${head.map((h) => `<th${h.cls ? ` class="${h.cls}"` : ''}${h.k ? ` data-k="${h.k}"` : ''}>${h.t ?? h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const yLabel = (y) => `${y}${y === partFirst ? '*' : ''}${y === partLast ? '†' : ''}`;
  let partFirst = null, partLast = null;

  // ---- the current selection ----------------------------------------------------------------------------------------------------
  let V = null;   // { T, fresh, comp, fixed, opens, coins }
  function select() {
    const coins = coinsOn(), from = S.from ? Date.parse(S.from) / 1000 : -Infinity, to = S.to ? Date.parse(S.to) / 1000 + 86400 : Infinity;
    const T = [], opens = [], free = [];
    for (const c of coins) {
      if (!TR[c]) continue;
      for (const t of TR[c].trades) if (t.t >= from && t.tc < to) T.push(t);
      if (TR[c].free) for (const t of TR[c].free) if (t.t >= from && t.tc < to) free.push(t);
      if (TR[c].open && !S.to) opens.push(TR[c].open);
    }
    T.sort((x, y) => x.tExit - y.tExit || x.t - y.t);   // coin by coin → by close, so V.T[0] / V.T[last] are the first / last closed trade
    const m = money();
    V = { T, coins, opens, m, free: S.costs ? free : null, E: null, fresh: A.analyse(T, { ...m, mode: 'fresh' }), comp: A.analyse(T, { ...m, mode: 'compound' }), fixed: A.analyse(T, { ...m, mode: 'fixed' }) };
    const ys = V.fresh.yearList, startT = Math.max(firstCandle + 205 * A.TF[S.tf], from), endT = Math.min(lastCandle, to);
    partFirst = ys.length && startT > Date.UTC(ys[0], 0, 8) / 1000 ? ys[0] : null;
    partLast = ys.length && endT < Date.UTC(ys[ys.length - 1], 11, 24) / 1000 ? ys[ys.length - 1] : null;
  }

  function render() {
    hideTip();
    select();
    const st = A.STRATS[S.s];
    $('title').textContent = `${st.name}: in-depth analysis`;
    $('subtitle').textContent = `The bot's own engine on Binance ${A.TF_LABEL[S.tf]} candles · ${V.coins.join(', ') || 'no coin selected'} · ${S.costs ? 'fees, slippage and funding included' : 'before costs'} · ${S.risk}% risk per trade from ${fM(S.start)}${S.cap > 0 ? `, at most ${fM(S.cap)} a trade` : ''}.`;
    document.title = `${st.short} analysis`;
    const empty = !V.T.length;
    $('secEmpty').hidden = !empty; $('tabs').hidden = empty;
    if (empty) {
      $('secEmpty').innerHTML = `<h2>No closed trades</h2><p class="sub">Nothing closed with these settings. Pick at least one coin, or widen the dates.</p>`;
      document.querySelectorAll('main section[data-tab]').forEach((el) => el.classList.add('off'));
      return;
    }
    dirty = new Set(TAB_LIST);
    showTab();
  }
  // four tabs; a tab's sections are drawn when it is shown (the simulations of "Risk & edge" only run when it is opened)
  const TABS = {
    overview: () => { renderVerdict(); renderSummary(); renderCoins(); },
    periods: () => { renderYears(); renderMonths(); renderCalendar(); },
    risk: () => { renderEdge(); renderRisk(); renderTargets().catch(console.error); renderGrowth(); renderTogether(); },
    trades: () => { renderExp(); renderDist(); renderTrades(); renderMethod(); },
  };
  let dirty = new Set();
  function showTab() {
    document.querySelectorAll('#tabs button').forEach((b) => { b.classList.toggle('on', b.dataset.tab === S.tab); b.setAttribute('aria-selected', b.dataset.tab === S.tab); });
    document.querySelectorAll('main section[data-tab]').forEach((el) => el.classList.toggle('off', el.dataset.tab !== S.tab));
    if (V && V.T.length && dirty.has(S.tab)) { dirty.delete(S.tab); TABS[S.tab](); }
  }
  const getE = () => V.E || (V.E = A.edge(V.T, V.fresh, V.comp, V.m));

  // ---- 1. summary ---------------------------------------------------------------------------------------------------------------
  function renderSummary() {
    const s = V.fresh.stats, comp = V.comp.curve, fy = V.fresh.years, worstY = Math.max(...fy.map((y) => y.dd));
    const sumFresh = fy.reduce((a, y) => a + y.profit, 0), endC = comp.pts[comp.pts.length - 1][1];
    const first = V.T[0], last = V.T[V.T.length - 1], per = perTrade();
    const winR = s.avgWin * s.wins, lossR = s.avgLoss * s.losses;
    const k = (v, key, sub) => `<div class="kpi"><div class="v">${v}</div><div class="k">${key}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
    $('secSummary').innerHTML = `
      <div class="sec-head"><div><h2>Summary</h2><p class="sub">${V.coins.length} coin${V.coins.length > 1 ? 's' : ''} together, one shared account, ${fmtDate(first.tc)} to ${fmtDate(last.tc)}. R = the amount risked on a trade.</p></div></div>
      <div class="kpis">
        ${k(s.n.toLocaleString(), 'Trades', `${s.longs} long · ${s.shorts} short · about ${Math.round(getE().perYear)} a year`)}
        ${k(`<span class="pos">${s.wins.toLocaleString()}</span>`, 'Wins', `${fR(winR, 1)} in total · average ${fR(s.avgWin, 2)}`)}
        ${k(`<span class="neg">${s.losses.toLocaleString()}</span>`, 'Losses', `${fR(lossR, 1)} in total · average ${fR(s.avgLoss, 2)}`)}
        ${k(pct(s.win, 1), 'Win rate', `break-even at this payoff: ${pct(s.beWin, 1)}`)}
        ${k(span(s.exp, fR(s.exp, 2)), 'Expectancy (per trade)', `${pct(s.win)} × ${fR(s.avgWin, 2)} − ${pct(1 - s.win)} × ${fR(-s.avgLoss, 2).replace('+', '')} · ≈ ${fM(s.exp * per, true)} at ${fM(per)} risk`)}
        ${k(s.avgLoss ? (s.avgWin / -s.avgLoss).toFixed(2) + ' : 1' : '–', 'Payoff ratio', 'average win ÷ average loss')}
        ${k(s.pf === Infinity ? '∞' : s.pf.toFixed(2), 'Profit factor', 'gross wins ÷ gross losses')}
        ${k(span(s.net, fR(s.net, 1)), 'Total R', `deepest drop ${fR(-s.ddR, 1)} · best trade ${fR(s.best, 1)}`)}
        ${k(span(sumFresh, fM(sumFresh, true)), `Fresh ${fM(S.start)} each January`, `sum of ${fy.length} years · worst drop in a year ${fPct(-worstY)}`)}
        ${k(fM(endC), `Compounding, ${fM(S.start)} once`, `${fPct(endC / S.start - 1)} · deepest drop ${fPct(-comp.dd)}`)}
      </div>`;
  }
  const perTrade = () => { const p = S.start * S.risk / 100; return S.cap > 0 ? Math.min(S.cap, p) : p; };

  // ---- 2. by coin ---------------------------------------------------------------------------------------------------------------
  function renderCoins() {
    const rows = V.coins.map((c) => {
      const f = V.fresh.perCoin[c], p = V.comp.perCoin[c];
      if (!f) return `<tr><td>${coinName(c)}</td><td colspan="12" class="l mut">no closed trade</td></tr>`;
      const s = f.stats, fresh = f.years.reduce((a, y) => a + y.profit, 0), end = p.curve.pts[p.curve.pts.length - 1][1];
      return `<tr><td>${coinName(c)}</td><td>${s.n}</td><td>${pct(s.win)}</td><td>${span(s.exp, fR(s.exp, 2))}</td><td>${fR(s.avgWin, 2)}</td><td>${fR(s.avgLoss, 2)}</td>
        <td>${s.pf === Infinity ? '∞' : s.pf.toFixed(2)}</td><td><b>${span(s.net, fR(s.net))}</b></td><td>${fR(-s.ddR)}</td><td>${fR(s.best)}</td>
        <td>${span(fresh, fM(fresh, true))}</td><td>${fM(end)}</td><td>${fPct(-p.curve.dd)}</td></tr>`;
    });
    const s = V.fresh.stats, fresh = V.fresh.years.reduce((a, y) => a + y.profit, 0), c = V.comp.curve;
    rows.push(`<tr class="tot"><td>All ${V.coins.length} (one account)</td><td>${s.n}</td><td>${pct(s.win)}</td><td>${span(s.exp, fR(s.exp, 2))}</td><td>${fR(s.avgWin, 2)}</td><td>${fR(s.avgLoss, 2)}</td>
      <td>${s.pf === Infinity ? '∞' : s.pf.toFixed(2)}</td><td>${span(s.net, fR(s.net))}</td><td>${fR(-s.ddR)}</td><td>${fR(s.best)}</td><td>${span(fresh, fM(fresh, true))}</td><td>${fM(c.pts[c.pts.length - 1][1])}</td><td>${fPct(-c.dd)}</td></tr>`);
    const head = ['Coin', 'Trades', 'Win', 'Avg / trade', 'Avg win', 'Avg loss', 'Profit factor', 'Total R', 'Deepest drop', 'Best', `Fresh ${fM(S.start)} / yr`, 'Compounding end', 'Max drop'];
    // cumulative R per coin (the same R for any balance: the cleanest way to compare coins)
    const series = V.coins.filter((c) => V.fresh.perCoin[c]).map((c) => {
      let r = 0; const pts = [[V.T[0].t, 0]];
      for (const t of V.fresh.perCoin[c].rows) { r += t.R; pts.push([t.tc, r]); }
      return { name: c, color: `var(--c-${c})`, pts };
    });
    $('secCoins').innerHTML = `
      <div class="sec-head"><div><h2>By coin</h2><p class="sub">Each coin's trades on their own. The money columns give each coin its own ${fM(S.start)} account at ${S.risk}% risk; the total row is the shared account.</p></div></div>
      ${table(head, rows)}
      <h3>Total R over time, by coin</h3>
      <div class="ch-legend">${series.map((s) => `<span>${dot(s.name)}${s.name}</span>`).join('')}</div>
      <div class="chart" id="chCoins"></div>`;
    lineChart($('chCoins'), series, { yFmt: (v) => fR(v, 0), tipFmt: (v) => fR(v, 1), endLabels: true, zero: true });
  }

  // ---- 3. year by year -----------------------------------------------------------------------------------------------------------
  function yearTable(ys, mode) {
    const totN = ys.reduce((a, y) => a + y.n, 0), totW = ys.reduce((a, y) => a + y.wins, 0), totR = ys.reduce((a, y) => a + y.R, 0), totP = ys.reduce((a, y) => a + y.profit, 0);
    const worst = Math.max(0, ...ys.map((y) => y.dd)), low = Math.min(...ys.map((y) => y.low));
    if (mode === 'fresh') {
      const rows = ys.map((y) => `<tr><td>${yLabel(y.y)}</td><td>${fM(y.start)}</td><td>${fM(y.risk)}</td><td>${y.n}</td><td>${y.n ? pct(y.wins / y.n) : '–'}</td><td>${fR(y.R)}</td>
        <td>${span(y.profit, fM(y.profit, true))}</td><td>${span(y.ret, fPct(y.ret))}</td><td>${fM(y.end)}</td><td>${fPct(-y.dd)}</td><td>${fM(y.low)}</td></tr>`);
      rows.push(`<tr class="tot"><td>Total</td><td></td><td></td><td>${totN}</td><td>${totN ? pct(totW / totN) : '–'}</td><td>${fR(totR)}</td><td>${span(totP, fM(totP, true))}</td><td></td><td></td><td>${fPct(-worst)}</td><td>${fM(low)}</td></tr>`);
      return table(['Year', 'Starts at', 'Risk / trade', 'Trades', 'Win', 'R', 'Profit', 'Return', 'Ends at', 'Max drop', 'Lowest'], rows);
    }
    const end = ys.length ? ys[ys.length - 1].end : S.start;
    const rows = ys.map((y) => `<tr><td>${yLabel(y.y)}</td><td>${fM(y.start)}</td><td>${fM(y.risk)}</td><td>${y.n}</td><td>${fR(y.R)}</td><td>${span(y.profit, fM(y.profit, true))}</td>
      <td>${span(y.ret, fPct(y.ret))}</td><td><b>${fM(y.end)}</b></td><td>${fPct(-y.dd)}</td><td>${fM(y.low)}</td></tr>`);
    rows.push(`<tr class="tot"><td>Total</td><td>${fM(S.start)}</td><td></td><td>${totN}</td><td>${fR(totR)}</td><td>${span(totP, fM(totP, true))}</td><td>${span(end / S.start - 1, fPct(end / S.start - 1))}</td><td>${fM(end)}</td><td>${fPct(-worst)}</td><td>${fM(low)}</td></tr>`);
    return table(['Year', 'Starts at', mode === 'fixed' ? 'Risk / trade' : 'Risk / trade (Jan 1)', 'Trades', 'R', 'Profit', 'Return', 'Ends at', 'Max drop in year', 'Lowest'], rows);
  }
  function renderYears() {
    const cap = S.cap > 0 ? `, never more than ${fM(S.cap)} a trade` : '';
    const foot = `<p class="foot">${partFirst ? `* ${partFirst} is a part year (the first signals need about ${S.s === 'icore' ? '205' : '202'} candles of history${S.from ? ', or the From date' : ''}). ` : ''}${partLast ? `† ${partLast} runs to ${fmtDate(Math.min(lastCandle, S.to ? Date.parse(S.to) / 1000 : Infinity))}. ` : ''}In the fresh version a trade open over New Year is sized from the new ${fM(S.start)}. "Max drop" is the deepest fall from that year's high, on closed trades.</p>`;
    let html = `<div class="sec-head"><div><h2>Year by year at ${S.risk}% risk, from ${fM(S.start)}</h2>
      <p class="sub">Same trades, same signals: the only difference is how big each trade is. Each year is credited with the trades that <i>closed</i> in it; drops are measured on the closed-trade balance (not minute by minute).</p></div></div>`;
    if (S.view === 'coin') {
      html += coinYearMatrices();
      html += `<h3>Each coin on its own: fresh ${fM(S.start)} every January</h3>` + V.coins.filter((c) => V.fresh.perCoin[c]).map((c) => {
        const f = V.fresh.perCoin[c], tot = f.years.reduce((a, y) => a + y.profit, 0);
        return `<details class="coin-card"><summary>${coinName(c)} <span class="s">${f.stats.n} trades · ${fR(f.stats.net)} · ${span(tot, fM(tot, true))} over ${f.years.length} years</span></summary>
          ${yearTable(f.years, 'fresh')}<h3>Compounding, ${fM(S.start)} once</h3>${yearTable(V.comp.perCoin[c].years, 'compound')}</details>`;
      }).join('');
    } else {
      html += `<h3>Version 1: fresh ${fM(S.start)} every January (${fM(V.fresh.years[0] ? V.fresh.years[0].risk : 0)} risked per trade at the start${cap})</h3>${yearTable(V.fresh.years, 'fresh')}`;
      html += `<h3>Version 2: compounding, ${fM(S.start)} once, everything kept in${cap}</h3>${yearTable(V.comp.years, 'compound')}`;
      html += `<h3>Version 3: no compounding, ${fM(S.start * S.risk / 100 > S.cap && S.cap > 0 ? S.cap : S.start * S.risk / 100)} risked on every trade</h3>${yearTable(V.fixed.years, 'fixed')}`;
    }
    $('secYears').innerHTML = html + foot;
  }
  // year × coin matrices (R, win rate, trades, fresh profit)
  function coinYearMatrices() {
    const cs = V.coins.filter((c) => V.fresh.perCoin[c]), ys = V.fresh.yearList;
    const cell = (c, y, f) => { const r = V.fresh.perCoin[c].years.find((x) => x.y === y); return r && r.n ? f(r) : '<span class="mut">·</span>'; };
    const all = (y, f) => { const r = V.fresh.years.find((x) => x.y === y); return r && r.n ? f(r) : '·'; };
    const mk = (title, f, tot, totAll) => {
      const head = ['Year', ...cs.map((c) => ({ t: coinName(c) })), `All ${cs.length}`];
      const rows = ys.map((y) => `<tr><td>${yLabel(y)}</td>${cs.map((c) => `<td>${cell(c, y, f)}</td>`).join('')}<td><b>${all(y, f)}</b></td></tr>`);
      rows.push(`<tr class="tot"><td>All years</td>${cs.map((c) => `<td>${tot(V.fresh.perCoin[c])}</td>`).join('')}<td>${totAll}</td></tr>`);
      return `<h3>${title}</h3>${table(head, rows)}`;
    };
    const sumP = (yrs) => yrs.reduce((a, y) => a + y.profit, 0);
    return mk('Total R by year', (r) => span(r.R, fR(r.R)), (p) => span(p.stats.net, fR(p.stats.net)), span(V.fresh.stats.net, fR(V.fresh.stats.net)))
      + mk('Trades closed and win rate', (r) => `${r.n} · ${pct(r.wins / r.n)}`, (p) => `${p.stats.n} · ${pct(p.stats.win)}`, `${V.fresh.stats.n} · ${pct(V.fresh.stats.win)}`)
      + mk('Average per trade (expectancy)', (r) => span(r.R / r.n, fR(r.R / r.n, 2)), (p) => span(p.stats.exp, fR(p.stats.exp, 2)), span(V.fresh.stats.exp, fR(V.fresh.stats.exp, 2)))
      + mk(`Profit from a fresh ${fM(S.start)} each January (each coin its own account; "All" is the shared account)`, (r) => span(r.profit, fM(r.profit, true)), (p) => span(sumP(p.years), fM(sumP(p.years), true)), span(sumP(V.fresh.years), fM(sumP(V.fresh.years), true)))
      + mk('Deepest drop inside the year (fresh)', (r) => fPct(-r.dd), (p) => fPct(-Math.max(...p.years.map((y) => y.dd))), fPct(-Math.max(...V.fresh.years.map((y) => y.dd))));
  }

  // ---- 4. month by month -------------------------------------------------------------------------------------------------------
  const MS = { measure: 'pf', coin: 'all' };   // pf = ₱ fresh, pc = ₱ compounding, rc = % compounding, r = R
  function monthSource(mode) {
    const an = mode === 'comp' ? V.comp : V.fresh;
    if (MS.coin === 'all' || !an.perCoin[MS.coin]) return { rows: an.rows, m: { ...V.m, mode: mode === 'comp' ? 'compound' : 'fresh' } };
    return { rows: an.perCoin[MS.coin].rows, m: { ...V.m, mode: mode === 'comp' ? 'compound' : 'fresh' } };
  }
  function renderMonths() {
    if (MS.coin !== 'all' && !V.coins.includes(MS.coin)) MS.coin = 'all';
    const src = monthSource(MS.measure === 'pc' || MS.measure === 'rc' ? 'comp' : 'fresh');
    const cells = A.months(src.rows, src.m), ys = V.fresh.yearList;
    const val = (c) => (MS.measure === 'r' ? c.R : MS.measure === 'rc' ? c.ret : c.pnl);
    const show = (v) => (MS.measure === 'r' ? `${sgn(v)}${Math.abs(v).toFixed(1)}` : MS.measure === 'rc' ? fPct(v, Math.abs(v) < 0.1 ? 1 : 0) : fK(v));
    let max = 0; cells.forEach((c) => { max = Math.max(max, Math.abs(val(c))); });
    const bg = (v) => { const a = (0.10 + 0.55 * Math.min(1, Math.abs(v) / (max || 1))).toFixed(2); return v > 0 ? `rgba(var(--pos-bg),${a})` : v < 0 ? `rgba(var(--neg-bg),${a})` : 'var(--surface-3)'; };
    const rowsHtml = ys.map((y) => {
      let yt = 0, any = false;
      const tds = MONTHS.map((_, m) => {
        const c = cells.get(y * 100 + m);
        if (!c) return `<td class="none">·</td>`;
        any = true; const v = val(c); yt += MS.measure === 'rc' ? 0 : v;
        return `<td style="background:${bg(v)}" data-tip="${esc(`<b>${MONTH_NAMES[m]} ${y}</b><div class='r'><span>Trades</span><span>${c.n} (${c.wins} won)</span></div><div class='r'><span>R</span><span>${fR(c.R, 2)}</span></div><div class='r'><span>Profit</span><span>${fM(c.pnl, true)}</span></div><div class='r'><span>Return on month start</span><span>${fPct(c.ret, 1)}</span></div>`)}">${show(v)}</td>`;
      }).join('');
      const yr = V[MS.measure === 'pc' || MS.measure === 'rc' ? 'comp' : 'fresh'];
      const yrow = MS.coin === 'all' ? yr.years.find((r) => r.y === y) : (yr.perCoin[MS.coin] && yr.perCoin[MS.coin].years.find((r) => r.y === y));
      const yv = MS.measure === 'rc' ? (yrow ? yrow.ret : 0) : yt;
      return `<tr><td class="yr">${yLabel(y)}</td>${tds}<td class="tot ${cls(yv)}">${any ? show(yv) : '·'}</td></tr>`;
    }).join('');
    // calendar-month hit rate and average, all years together
    const hit = MONTHS.map((_, m) => { let up = 0, n = 0, r = 0, tn = 0; ys.forEach((y) => { const c = cells.get(y * 100 + m); if (c) { n++; if (c.pnl > 0 || (MS.measure === 'r' && c.R > 0)) up++; r += c.R; tn += c.n; } }); return { up, n, r, tn }; });
    const hitRow = `<tr class="foot"><td class="yr">Up</td>${hit.map((h) => `<td>${h.n ? `${h.up}/${h.n}` : '·'}</td>`).join('')}<td></td></tr>`;
    const expRow = `<tr class="foot"><td class="yr">R/trade</td>${hit.map((h) => `<td class="${cls(h.r)}">${h.tn ? fR(h.r / h.tn, 2) : '·'}</td>`).join('')}<td></td></tr>`;
    // best and worst months
    const list = [...cells].map(([k, c]) => ({ y: Math.floor(k / 100), m: k % 100, c, v: val(c) }));
    const top = [...list].sort((a, b) => b.v - a.v).slice(0, 5), bot = [...list].sort((a, b) => a.v - b.v).slice(0, 5);
    const mini = (arr) => table(['Month', 'Trades', 'Won', 'R', 'Profit', 'Return'], arr.map((x) => `<tr><td>${MONTHS[x.m]} ${x.y}</td><td>${x.c.n}</td><td>${x.c.wins}</td><td>${span(x.c.R, fR(x.c.R))}</td><td>${span(x.c.pnl, fM(x.c.pnl, true))}</td><td>${fPct(x.c.ret, 1)}</td></tr>`));
    const coinSeg = `<div class="seg mini" id="mCoin"><button data-v="all">All</button>${V.coins.map((c) => `<button data-v="${c}">${coinName(c)}</button>`).join('')}</div>`;
    const measSeg = `<div class="seg mini" id="mMeas"><button data-v="pf">${S.cur} fresh each Jan</button><button data-v="pc">${S.cur} compounding</button><button data-v="rc">% compounding</button><button data-v="r">R</button></div>`;
    const what = { pf: `${S.cur} earned per month, fresh ${fM(S.start)} each January`, pc: `${S.cur} earned per month, compounding from ${fM(S.start)}`, rc: 'monthly return on the balance at the start of the month (compounding)', r: 'R per month (the same for any balance)' }[MS.measure];
    $('secMonths').innerHTML = `
      <div class="sec-head"><div><h2>Month by month at ${S.risk}% risk</h2><p class="sub">${what}${MS.coin === 'all' ? '' : ` · ${MS.coin} on its own account`}. A month with no closed trade is a dot. Hover a month for its details.</p></div>
        <div class="sec-tools">${measSeg}${coinSeg}</div></div>
      <div class="tw"><table class="cal"><thead><tr><th></th>${MONTHS.map((m) => `<th>${m}</th>`).join('')}<th>Year</th></tr></thead><tbody>${rowsHtml}${hitRow}${expRow}</tbody></table></div>
      <div class="legend"><span><span class="sw" style="background:rgba(var(--pos-bg),.45)"></span>profit</span><span><span class="sw" style="background:rgba(var(--neg-bg),.45)"></span>loss</span><span>· no trade closed</span><span>"Up" = months that ended up / months with a closed trade</span></div>
      <div class="two"><div><h3>Best five months</h3>${mini(top)}</div><div><h3>Worst five months</h3>${mini(bot)}</div></div>`;
    segWire('mMeas', MS.measure, (v) => { MS.measure = v; renderMonths(); });
    segWire('mCoin', MS.coin, (v) => { MS.coin = v; renderMonths(); });
  }

  // ---- 5. day calendar (the chart's performance calendar, full size) ---------------------------------------------------------
  const CS = { coin: 'all', y: null, m: null, sel: null };
  function renderCalendar() {
    if (CS.coin !== 'all' && !V.coins.includes(CS.coin)) CS.coin = 'all';
    const rows = CS.coin === 'all' ? V.fresh.rows : (V.fresh.perCoin[CS.coin] ? V.fresh.perCoin[CS.coin].rows : []);
    const days = A.days(rows);
    if (CS.y == null || !V.fresh.yearList.includes(CS.y)) { const l = rows[rows.length - 1] || V.fresh.rows[V.fresh.rows.length - 1]; const d = new Date(l.tc * 1000); CS.y = d.getUTCFullYear(); CS.m = d.getUTCMonth(); }
    const tot = (pred) => { const o = { n: 0, w: 0, l: 0, wR: 0, lR: 0, R: 0, p: 0 }; days.forEach((d, k) => { if (!pred(k.split('-').map(Number))) return; o.n += d.n; o.w += d.wins; o.l += d.losses; o.wR += d.winR; o.lR += d.lossR; o.R += d.R; o.p += d.pnl; }); return o; };
    const stat = (o) => `<div class="dcal-totals">
      <div class="dcal-stat"><div class="v">${o.n}</div><div class="k">Trades</div></div>
      <div class="dcal-stat"><div class="v pos">${fR(o.wR, 2)}</div><div class="k">Positive R (${o.w})</div></div>
      <div class="dcal-stat"><div class="v neg">${fR(o.lR, 2)}</div><div class="k">Negative R (${o.l})</div></div>
      <div class="dcal-stat"><div class="v ${cls(o.R)}">${fR(o.R, 2)}</div><div class="k">Total R</div></div>
      <div class="dcal-stat"><div class="v ${cls(o.p)}">${fM(o.p, true)}</div><div class="k">Profit (fresh ${fM(S.start)}/yr)</div></div></div>`;
    const firstDow = new Date(Date.UTC(CS.y, CS.m, 1)).getUTCDay(), dim = new Date(Date.UTC(CS.y, CS.m + 1, 0)).getUTCDate();
    let grid = '';
    for (let i = 0; i < firstDow; i++) grid += '<div class="dcal-cell blank"></div>';
    for (let day = 1; day <= dim; day++) {
      const key = `${CS.y}-${CS.m}-${day}`, d = days.get(key);
      grid += `<div class="dcal-cell${d ? (d.R >= 0 ? ' win' : ' lose') : ''}${CS.sel === key ? ' sel' : ''}" ${d ? `data-day="${key}"` : ''}><span class="dn">${day}</span>` +
        (d ? `<span class="r ${cls(d.R)}">${fR(d.R, 2)}</span><span class="p">${fM(d.pnl, true)}</span><span class="c">${[...d.coins].map((c) => `<span class="dot" style="background:var(--c-${c})" title="${c}"></span>`).join('')} ${d.n} · ${d.wins}W/${d.losses}L</span>` : '') + '</div>';
    }
    for (let i = firstDow + dim; i < 42; i++) grid += '<div class="dcal-cell blank"></div>';
    let dayList = '';
    if (CS.sel && days.get(CS.sel)) {
      const [y, m, d] = CS.sel.split('-').map(Number), list = rows.filter((r) => { const x = new Date(r.tc * 1000); return x.getUTCFullYear() === y && x.getUTCMonth() === m && x.getUTCDate() === d; });
      dayList = `<div class="dcal-day"><h3>Trades closed on ${d} ${MONTH_NAMES[m]} ${y}</h3>${tradeTable(list)}</div>`;
    }
    const coinSeg = `<div class="seg mini" id="cCoin"><button data-v="all">All</button>${V.coins.map((c) => `<button data-v="${c}">${coinName(c)}</button>`).join('')}</div>`;
    $('secCalendar').innerHTML = `
      <div class="sec-head"><div><h2>Performance calendar</h2><p class="sub">Every closed trade on the day it closed (UTC), as in the chart's 📅 calendar, with the profit in ${S.cur} from a fresh ${fM(S.start)} each January${CS.coin === 'all' ? '' : ` (${CS.coin} on its own account)`}. Click a day for its trades.</p></div>
        <div class="sec-tools">${coinSeg}</div></div>
      <div class="dcal-lbl">All time</div>${stat(tot(() => true))}
      <div class="dcal-lbl">Year <select id="cYear">${V.fresh.yearList.map((y) => `<option${y === CS.y ? ' selected' : ''}>${y}</option>`).join('')}</select></div>${stat(tot(([y]) => y === CS.y))}
      <div class="dcal-nav"><button id="cPrev" aria-label="Previous month">‹</button><span>${MONTH_NAMES[CS.m]} ${CS.y}</span><button id="cNext" aria-label="Next month">›</button></div>
      ${stat(tot(([y, m]) => y === CS.y && m === CS.m))}
      <div class="dcal-dow">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="dcal-grid" id="cGrid">${grid}</div>${dayList}`;
    segWire('cCoin', CS.coin, (v) => { CS.coin = v; CS.sel = null; renderCalendar(); });
    $('cYear').onchange = (e) => { CS.y = +e.target.value; CS.sel = null; renderCalendar(); };
    const step = (k) => { CS.m += k; if (CS.m < 0) { CS.m = 11; CS.y--; } if (CS.m > 11) { CS.m = 0; CS.y++; } CS.sel = null; renderCalendar(); };
    $('cPrev').onclick = () => step(-1); $('cNext').onclick = () => step(1);
    $('cGrid').onclick = (e) => { const c = e.target.closest('[data-day]'); if (!c) return; CS.sel = CS.sel === c.dataset.day ? null : c.dataset.day; renderCalendar(); };
  }

  // ---- 6. win rate and expectancy -----------------------------------------------------------------------------------------------
  function renderExp() {
    const pt = perTrade();
    const row = (lbl, T) => { const s = A.stats(T); return `<tr><td>${lbl}</td><td>${s.n}</td><td>${s.n ? pct(s.win, 1) : '–'}</td><td><b>${span(s.exp, fR(s.exp, 2))}</b></td><td>${fR(s.avgWin, 2)}</td><td>${fR(s.avgLoss, 2)}</td><td>${s.pf === Infinity ? '∞' : s.pf.toFixed(2)}</td><td>${span(s.exp, fM(s.exp * pt, true))}</td></tr>`; };
    const head = ['', 'Trades closed', 'Win rate', 'Expectancy (avg R)', 'Average win', 'Average loss', 'Profit factor', `${S.cur} per trade at ${fM(pt)} risk`];
    const ys = V.fresh.yearList, T = V.fresh.rows;
    const byY = ys.map((y) => row(yLabel(y), T.filter((t) => t.y === y)));
    byY.push(row('<b>All years</b>', T).replace('<tr>', '<tr class="tot">'));
    const byM = MONTHS.map((m, i) => row(MONTH_NAMES[i], T.filter((t) => new Date(t.tc * 1000).getUTCMonth() === i)));
    const s = V.fresh.stats;
    $('secExp').innerHTML = `
      <div class="sec-head"><div><h2>Win rate and expectancy</h2><p class="sub">Expectancy is the average result of one trade in R${S.costs ? ', after fees, slippage and funding' : ''}: what a trade is worth on average, whatever the balance. Trades are counted in the year they closed.</p></div></div>
      <h3>By year</h3>${table(head, byY)}<h3>By calendar month (all years together)</h3>${table(head, byM)}
      <div class="note">Longs ${s.longs} trades, ${fR(s.longR)} · shorts ${s.shorts} trades, ${fR(s.shortR)}. Spread of one trade: ${s.sd.toFixed(2)}R (t-statistic ${(s.exp / (s.sd / Math.sqrt(s.n))).toFixed(1)}). The ten best trades make ${pct(s.top10)} of all profit${s.top10 > 0.5 ? ': the edge leans on rare big winners' : ''}.</div>`;
  }

  // ---- 7. growth and drawdown ----------------------------------------------------------------------------------------------------
  const GS = { log: true };
  function renderGrowth() {
    const pts = V.comp.curve.pts, eq = pts.map((p) => [p[0], p[1]]), dd = pts.map((p) => [p[0], -(p[2] || 0) * 100]);
    $('secGrowth').innerHTML = `
      <div class="sec-head"><div><h2>Growth and drawdowns</h2><p class="sub">Compounding at ${S.risk}% risk from ${fM(S.start)}, one shared account, booked as each trade closes. A drawdown is the fall from the highest balance so far.</p></div>
        <div class="sec-tools"><div class="seg mini" id="gScale"><button data-v="log">Log scale</button><button data-v="lin">Linear</button></div></div></div>
      <h3>Growth of ${fM(S.start)}</h3><div class="chart" id="chEq"></div>
      <h3>Drop from the previous high</h3><div class="chart" id="chDD"></div>
      <h3>Maximum drawdown by year</h3>${table(['Year', `Fresh ${fM(S.start)}`, 'Compounding', 'No compounding'], V.fresh.yearList.map((y, i) => `<tr><td>${yLabel(y)}</td><td>${fPct(-V.fresh.years[i].dd)}</td><td>${fPct(-V.comp.years[i].dd)}</td><td>${fPct(-V.fixed.years[i].dd)}</td></tr>`).concat(`<tr class="tot"><td>Whole period</td><td>${fPct(-Math.max(...V.fresh.years.map((y) => y.dd)))} (worst year)</td><td>${fPct(-V.comp.curve.dd)}</td><td>${fPct(-V.fixed.curve.dd)}</td></tr>`))}${survivalHtml()}`;
    segWire('gScale', GS.log ? 'log' : 'lin', (v) => { GS.log = v === 'log'; renderGrowth(); });
    lineChart($('chEq'), [{ name: 'Balance', color: 'var(--c-SOL)', pts: eq }], { log: GS.log, yFmt: (v) => fM(v), tipFmt: (v) => fM(v) });
    lineChart($('chDD'), [{ name: 'Drop', color: 'var(--neg)', pts: dd }], { yFmt: (v) => `${Math.round(v)}%`, tipFmt: (v) => `${v.toFixed(1)}%`, area: true, height: 160 });
  }

  // ---- 8. trades -----------------------------------------------------------------------------------------------------------------
  const TS = { coin: 'all', sort: 'tc', dir: -1, all: false };
  function tradeTable(list, sortable) {
    const iv = A.TF[S.tf];
    const head = [{ t: 'Coin', k: 'coin' }, { t: 'Side', k: 'dir' }, { t: 'Entry (UTC)', k: 't' }, { t: 'Closed (UTC)', k: 'tc' }, { t: 'Held', k: 'bars' }, { t: 'Entry price', k: 'entry' }, { t: 'Exit price', k: 'exit' }, { t: 'Exit', k: 'why' }, { t: 'R', k: 'R' }, { t: `Risked`, k: 'risk' }, { t: 'Profit', k: 'pnl' }, { t: 'Balance after', k: 'bal' }]
      .map((h) => (sortable ? { ...h, cls: 'sortable' } : h));
    const dec = (v) => (v < 1 ? 5 : v < 100 ? 3 : 2);
    return table(head, list.map((t) => `<tr><td>${coinName(t.coin)}</td><td>${t.dir === 1 ? 'Long' : 'Short'}</td><td>${fmtDate(t.t, true)}</td><td>${fmtDate(t.tc, true)}</td><td>${(t.bars * iv / 86400).toFixed(1)} d</td>
      <td>${t.entry.toFixed(dec(t.entry))}</td><td>${t.exit.toFixed(dec(t.exit))}</td><td>${{ stop: 'stop', target: 'target', time: 'time', end: 'end' }[t.why] || t.why}</td><td><b>${span(t.R, fR(t.R, 2))}</b></td><td>${fM(t.risk)}</td><td>${span(t.pnl, fM(t.pnl, true))}</td><td>${fM(t.bal)}</td></tr>`), sortable ? { id: 'tTable' } : {});
  }
  function renderTrades() {
    if (TS.coin !== 'all' && !V.coins.includes(TS.coin)) TS.coin = 'all';
    const rows = (TS.coin === 'all' ? V.fresh.rows : V.fresh.rows.filter((r) => r.coin === TS.coin)).slice();
    rows.sort((a, b) => { const x = a[TS.sort], y = b[TS.sort]; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * TS.dir; });
    const shown = TS.all ? rows : rows.slice(0, 100);
    const opens = V.opens.length ? `<h3>Open now</h3>${table(['Coin', 'Side', 'Entry (UTC)', 'Held', 'Entry price', 'Stop now', 'Last close', 'R now'], V.opens.map((o) => `<tr><td>${coinName(o.coin)}</td><td>${o.dir === 1 ? 'Long' : 'Short'}</td><td>${fmtDate(o.t, true)}</td><td>${o.bars} candles</td><td>${o.entry.toPrecision(6)}</td><td>${o.stop.toPrecision(6)}</td><td>${o.now.toPrecision(6)}</td><td>${span(o.R, fR(o.R, 2))}</td></tr>`))}<p class="foot">Open trades are not counted in any number above until they close.</p>` : '';
    const coinSeg = `<div class="seg mini" id="tCoin"><button data-v="all">All</button>${V.coins.map((c) => `<button data-v="${c}">${coinName(c)}</button>`).join('')}</div>`;
    $('secTrades').innerHTML = `
      <div class="sec-head"><div><h2>Every trade</h2><p class="sub">${rows.length} closed trades. Money columns: fresh ${fM(S.start)} each January (the Version 1 account). Click a column to sort.</p></div><div class="sec-tools">${coinSeg}</div></div>
      ${opens}${tradeTable(shown, true)}${rows.length > shown.length ? `<button class="more" id="tMore">Show all ${rows.length} trades</button>` : ''}`;
    segWire('tCoin', TS.coin, (v) => { TS.coin = v; renderTrades(); });
    if ($('tMore')) $('tMore').onclick = () => { TS.all = true; renderTrades(); };
    $('tTable').querySelectorAll('th[data-k]').forEach((th) => {
      if (th.dataset.k === TS.sort) th.textContent += TS.dir === 1 ? ' ▲' : ' ▼';
      th.onclick = () => { if (TS.sort === th.dataset.k) TS.dir = -TS.dir; else { TS.sort = th.dataset.k; TS.dir = -1; } renderTrades(); };
    });
  }

  // ---- 9. method -----------------------------------------------------------------------------------------------------------------
  function renderMethod() {
    const ic = S.s === 'icore';
    $('secMethod').innerHTML = `<h2>How the numbers were made</h2>
      <p><b>Trades.</b> The bot's own engine, not a copy of its rules: ${ic ? '<code>ICore.backtest()</code> from the I-Core bot (js/icore-core.js)' : '<code>BBCore.backtest()</code> from the BB-Core bot (js/bbcore-core.js)'}, on Binance USDT-M ${A.TF_LABEL[S.tf]} candles from the start of each coin's history. ${A.TF[S.tf] !== 14400 ? '<b>The bots are built for 4h</b>: other timeframes use the same rules with every length counted in candles of that timeframe. ' : ''}Signals use closed candles only and fill at the next candle's open.</p>
      <p><b>Costs.</b> ${S.costs ? (ic ? 'Fee 0.05% + slippage 0.02% each way and 0.005% funding per 4 hours held, in both directions (pessimistic).' : 'Fee 0.05% + slippage 0.02% on entry and exit, and the real Binance funding rates the trade was open through.') : 'Switched off: results are before fees, slippage and funding.'}</p>
      <p><b>Size.</b> ${S.risk}% of the closed-trade balance at the moment of entry${S.cap > 0 ? `, never more than ${fM(S.cap)}` : ''}; one position per coin, so up to ${V.coins.length} at once in the shared account. Trades are credited to the day, month and year they close. "Fresh" restarts the account at ${fM(S.start)} every 1 January; "compounding" never restarts it; "no compounding" risks ${S.risk}% of the start balance on every trade.</p>
      <p><b>Limits.</b> A test on past prices: the coins and settings were chosen with hindsight. Real fills (gaps, thin books, contract-size limits on small accounts) can be worse than the assumed costs. Not included: the Lucid'io fee, deposits and withdrawals, taxes. Past performance does not guarantee future results.</p>
      <p class="foot">With the default settings this page reproduces the admin reports (I-Core: 760 trades, +658R to late Oct 2026; Version 1 2021 = +₱109,790). Newer candles add the trades closed since.</p>`;
  }

  // ---- verdict: a rule-based read of the numbers (not a model): checks from TRADING_MATH / TRADING_SURVIVAL_EDGE, each good / so-so / bad ----
  function checks() {
    const E = getE(), s = E.s, out = [], r = S.risk / 100, comp = V.comp.curve;
    const add = (st, title, brief, detail) => out.push({ st, title, brief, detail });
    const mcY = E.mc.find((x) => Math.abs(x.risk - r) < 1e-9);
    // 1. is there an edge at all, and is it more than luck?
    if (s.exp <= 0) add('bad', 'No edge', 'it loses money on average', `Average ${fR(s.exp, 2)} a trade: over many trades it loses.`);
    else if (E.boot.lo > 0) add('good', 'A real edge', `${fR(s.exp, 2)} a trade, very unlikely to be luck`, `${fR(s.exp, 2)} a trade. The 95% range is ${fR(E.boot.lo, 2)} to ${fR(E.boot.hi, 2)}, positive in ${pct(E.boot.pPos, 1)} of 4,000 resamples (t = ${E.t.toFixed(1)}; above 2 is unlikely to be luck).`);
    else add('ok', 'Edge not proven', 'positive, but it could still be luck', `${fR(s.exp, 2)} a trade, but the 95% range ${fR(E.boot.lo, 2)} to ${fR(E.boot.hi, 2)} includes zero (t = ${E.t.toFixed(1)}).`);
    // 2. enough trades to tell edge from noise
    if (s.exp > 0) add(s.n >= E.need ? 'good' : s.n >= E.need / 2 ? 'ok' : 'bad', 'Sample size', s.n >= E.need ? 'enough trades to judge it' : 'too few trades to be sure',
      `${s.n} trades. An edge of this size with this much spread needs about ${E.need.toLocaleString()} trades to stand out from chance: (1.96 × ${E.sd.toFixed(2)}R ÷ ${s.exp.toFixed(2)}R)².`);
    // 3. payoff: does a win pay for the losses?
    add(s.pf >= 1.5 ? 'good' : s.pf >= 1.15 ? 'ok' : 'bad', 'Wins pay for the losses', `profit factor ${s.pf === Infinity ? '∞' : s.pf.toFixed(2)}`,
      `Profit factor ${s.pf === Infinity ? '∞' : s.pf.toFixed(2)}: the average win (${fR(s.avgWin, 2)}) is ${E.kelly.payoff.toFixed(1)}× the average loss (${fR(s.avgLoss, 2)}). It needs to win ${pct(s.beWin, 1)} of trades to break even and wins ${pct(s.win, 1)}.`);
    // 4. how much it leans on a few huge winners
    add(E.exp10 <= 0 ? 'bad' : s.top10 >= 0.5 ? 'ok' : 'good', 'Not only a few big winners', E.exp10 <= 0 ? 'the edge is only the 10 best trades' : s.top10 >= 0.5 ? `the 10 best trades are ${pct(s.top10)} of the profit` : 'profit is spread over many trades',
      `The ten best trades make ${pct(s.top10)} of all profit. Without them: ${fR(E.exp10, 2)} a trade; without the 20 best: ${fR(E.exp20, 2)}. Missing one of them live would cost a lot.`);
    // 5. consistency over time
    const py = E.years ? E.posYears / E.years : 0;
    add(py >= 0.8 ? 'good' : py >= 0.6 ? 'ok' : 'bad', 'Consistent over time', `${E.posYears} of ${E.years} years up`,
      `${E.posYears} of ${E.years} years and ${E.posMonths} of ${E.months} months ended up (${pct(E.posMonths / Math.max(1, E.months))}).` + (E.noBestYear ? ` Without its best year (${E.noBestYear.y}) it still makes ${fR(E.noBestYear.R)} (${fR(E.noBestYear.exp, 2)} a trade).` : ''));
    // 6. every coin, not one lucky coin
    if (V.coins.length > 1) {
      const cs = V.coins.filter((c) => V.fresh.perCoin[c]), pos = cs.filter((c) => V.fresh.perCoin[c].stats.net > 0);
      add(pos.length === cs.length ? 'good' : pos.length * 2 > cs.length ? 'ok' : 'bad', 'Works on every coin', `${pos.length} of ${cs.length} coins positive`,
        `Positive on ${pos.length} of ${cs.length} coins: ${cs.map((c) => `${c} ${fR(V.fresh.perCoin[c].stats.net, 0)}`).join(', ')}.`);
    }
    // 7. the drop at the chosen risk, and the gain needed to recover from it
    const dd = comp.dd;
    add(dd < 0.25 ? 'good' : dd < 0.45 ? 'ok' : 'bad', `Drawdown at ${S.risk}% risk`, `deepest drop ${fPct(-dd)}`,
      `Deepest drop ${fPct(-dd)}; getting back from it needs ${fPct(dd / (1 - dd))} (a 50% loss needs +100%). In random orders the typical worst drop is ${pct(mcY.all.ddMed)}, and 1 in 20 is ${pct(mcY.all.dd95)} or worse.`);
    // 8. sizing against Kelly
    const half = E.kellyNoTop.opt / 2;
    add(r <= half + 1e-9 ? 'good' : r <= E.kellyNoTop.opt ? 'ok' : 'bad', 'Risk per trade', r <= half + 1e-9 ? `${S.risk}% is within half-Kelly` : `${S.risk}% is above half-Kelly (${(half * 100).toFixed(1)}%)`,
      `The fixed % that grew this history fastest is ${(E.kelly.opt * 100).toFixed(1)}% (${(E.kellyNoTop.opt * 100).toFixed(1)}% without the 10 best trades). Half of that, ${(half * 100).toFixed(1)}%, is the usual ceiling; more risk adds drawdown faster than growth.`);
    // 9. a single year from the start
    add(mcY.year.below < 0.15 ? 'good' : mcY.year.below < 0.3 ? 'ok' : 'bad', 'Odds over one year', `${pct(mcY.year.below)} of years end below the start`,
      `Re-shuffling one year of about ${Math.round(E.perYear)} trades 2,000 times at ${S.risk}%: ${pct(mcY.year.below)} end below the start, the median ends at ×${mcY.year.p50.toFixed(2)}, the bad 1-in-20 at ×${mcY.year.p5.toFixed(2)}.`);
    // 10. costs
    if (V.free && V.free.length) {
      const f = A.stats(V.free), share = f.exp > 0 ? (f.exp - s.exp) / f.exp : 1;
      add(share < 0.25 ? 'good' : share < 0.5 ? 'ok' : 'bad', 'Survives the costs', `costs take ${pct(Math.max(0, share))} of the edge`,
        `Before costs ${fR(f.exp, 2)} a trade, after fees, slippage and funding ${fR(s.exp, 2)}: costs take ${pct(Math.max(0, share))} of the edge. Worse fills live would take more.`);
    }
    return out;
  }
  function renderVerdict() {
    const E = getE(), s = E.s, cs = checks(), pts = cs.reduce((a, c) => a + (c.st === 'good' ? 2 : c.st === 'ok' ? 1 : 0), 0), score = pts / (2 * cs.length);
    const noEdge = cs[0].st === 'bad';
    const label = noEdge ? 'Weak: no edge' : score >= 0.8 ? 'Strong' : score >= 0.6 ? 'Good, with caveats' : score >= 0.4 ? 'Mixed' : 'Weak';
    const tone = noEdge || score < 0.45 ? 'bad' : score < 0.7 ? 'ok' : 'good';
    const st = A.STRATS[S.s], per = perTrade(), first = V.T[0], last = V.T[V.T.length - 1], r = S.risk / 100;
    const good = cs.filter((c) => c.st === 'good'), weak = cs.filter((c) => c.st !== 'good'), bad = cs.filter((c) => c.st === 'bad');
    const head = {
      good: `Overall a <b>good strategy on this history</b>: the edge is real${weak.length ? `, with ${weak.length} thing${weak.length > 1 ? 's' : ''} to watch` : ' and every check passes'}.`,
      ok: `Overall <b>promising but not clean</b>: there is an edge, but ${weak.length} of ${cs.length} checks are not good.`,
      bad: noEdge ? 'Overall <b>a bad strategy on this history</b>: on average a trade loses money.' : `Overall <b>weak on this history</b>: ${bad.length} check${bad.length === 1 ? '' : 's'} fail.`,
    }[tone];
    const profile = s.win < 0.45 && E.kelly.payoff > 2
      ? `It is a <b>trend-follower</b>: it loses ${pct(1 - s.win)} of its trades, small and close to −1R each, and makes its money from a few big winners (best ${fR(s.best)}). The typical (median) trade is ${fR(E.median, 2)}, so most weeks feel like losing; long flat stretches between winners are normal, not a sign that it broke.`
      : s.win >= 0.55 && E.kelly.payoff < 1.2
        ? `It is a <b>high win-rate</b> strategy: it wins ${pct(s.win)} of trades, but a win (${fR(s.avgWin, 2)}) is not much bigger than a loss (${fR(s.avgLoss, 2)}), so a few bad losses can erase many wins.`
        : `It wins ${pct(s.win)} of trades and a win is ${E.kelly.payoff.toFixed(1)}× a loss: a balanced profile.`;
    const yrs = V.fresh.years.map((y) => y.ret).sort((a, b) => a - b), streak = Math.max(s.streak, Math.round(E.streakExp));
    $('secVerdict').innerHTML = `
      <div class="sec-head"><div><h2>Verdict: is it a good strategy?</h2><p class="sub">A plain-language read of the numbers, from fixed rules (not a model): ${cs.length} checks, each good, so-so or bad. Change any setting and it is judged again.</p></div></div>
      <div class="verdict">
        <div class="grade ${tone}"><div class="g">${label}</div><div class="meter"><i style="width:${Math.round(score * 100)}%"></i></div>
          <div class="sc">${good.length} good · ${cs.length - good.length - bad.length} so-so · ${bad.length} bad</div></div>
        <div class="story">
          <p>${head}</p>
          <p>${st.name} on ${V.coins.join(', ')} (${A.TF_LABEL[S.tf]}), ${fmtDate(first.tc)} to ${fmtDate(last.tc)}: <b>${s.n} trades, ${s.wins} wins and ${s.losses} losses</b> (${pct(s.win, 1)}). Expectancy <b>${fR(s.exp, 2)} a trade</b> = ${pct(s.win)} × ${fR(s.avgWin, 2)} − ${pct(1 - s.win)} × ${fR(-s.avgLoss, 2).replace('+', '')}; at ${fM(per)} risked that is about <b>${fM(s.exp * per, true)} a trade</b>, before the Lucid'io fee.</p>
          <p>${profile}</p>
          <p><b>What to expect at ${S.risk}% risk.</b> A fresh ${fM(S.start)} year: median ${fPct(A.quantile(yrs, 0.5))}, worst ${fPct(yrs[0])}, best ${fPct(yrs[yrs.length - 1])}. Plan for a losing streak of about ${streak} trades: on its own that takes ${fPct(-(1 - (1 - r) ** streak))} off the account. Up to ${E.open.max} trades are open at once, so ${(S.risk * E.open.max).toFixed(1)}% of the account can be at risk together.</p>
          ${good.length ? `<p><b>Good:</b> ${good.map((c) => c.brief).join('; ')}.</p>` : ''}
          ${weak.length ? `<p><b>Watch:</b> ${weak.map((c) => c.brief).join('; ')}.</p>` : ''}
          <p class="foot">A test on past prices, with settings and coins chosen in hindsight. It describes this history and does not promise the future: paper-trade before trusting it with more money.</p>
        </div>
      </div>
      <div class="checks">${cs.map((c) => `<div class="chk-i ${c.st}"><span class="ic">${c.st === 'good' ? '✓' : c.st === 'ok' ? '!' : '✕'}</span><div><b>${c.title}</b><span class="st">${{ good: 'good', ok: 'so-so', bad: 'bad' }[c.st]}</span><p>${c.detail}</p></div></div>`).join('')}</div>`;
  }

  // ---- risk & edge: edge or luck? --------------------------------------------------------------------------------------------
  function kv(rows) { return `<div class="tw"><table class="data kv"><thead><tr><th>Statistic</th><th>Value</th><th class="l">What it means</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table></div>`; }
  function renderEdge() {
    const E = getE(), s = E.s, f = V.free && V.free.length ? A.stats(V.free) : null;
    const rows = [
      ['Trades', s.n.toLocaleString(), `about ${Math.round(E.perYear)} a year across ${V.coins.length} coin${V.coins.length > 1 ? 's' : ''}; average hold ${(s.avgBars * A.TF[S.tf] / 86400).toFixed(1)} days`],
      ['Wins / losses', `<span class="pos">${s.wins}</span> / <span class="neg">${s.losses}</span>`, `${fR(s.avgWin * s.wins, 1)} won, ${fR(s.avgLoss * s.losses, 1)} lost`],
      ['Win rate', pct(s.win, 1), `95% range of the true rate ${pct(E.winCI.lo, 1)} to ${pct(E.winCI.hi, 1)} (Wilson); break-even at this payoff is ${pct(s.beWin, 1)}`],
      ['Average win / average loss', `${fR(s.avgWin, 2)} / ${fR(s.avgLoss, 2)}`, `payoff ratio ${E.kelly.payoff.toFixed(2)} to 1`],
      ['Expectancy (mean)', span(s.exp, fR(s.exp, 3)), `win rate × average win − loss rate × average loss = ${pct(s.win, 1)} × ${s.avgWin.toFixed(2)} − ${pct(1 - s.win, 1)} × ${(-s.avgLoss).toFixed(2)}`],
      ['Median trade', span(E.median, fR(E.median, 2)), 'the typical trade: half the trades do better, half worse' + (E.median < 0 && s.exp > 0 ? '. Below zero while the mean is above: the average is carried by rare big wins' : '')],
      ['Spread of one trade', `${E.sd.toFixed(2)}R`, `standard deviation; skew ${E.skew >= 0 ? '+' : ''}${E.skew.toFixed(1)} (${E.skew > 1 ? 'a long tail of big winners' : E.skew < -1 ? 'a long tail of big losers' : 'roughly balanced'})`],
      ['t-statistic', E.t.toFixed(1), 'expectancy ÷ (spread ÷ √trades): above 2 is unlikely to be luck'],
      ['95% range for expectancy', `${fR(E.boot.lo, 2)} to ${fR(E.boot.hi, 2)}`, `bootstrap, 4,000 resamples of the ${s.n} trades; positive in ${pct(E.boot.pPos, 1)}`],
      ['Trades needed to prove the edge', E.need === Infinity ? '–' : E.need.toLocaleString(), E.need === Infinity ? 'no positive edge to prove' : `(1.96 × spread ÷ expectancy)²; there are ${s.n}${s.n >= E.need ? ': enough' : ': not yet enough'}`],
      ['Expectancy without the 10 best trades', span(E.exp10, fR(E.exp10, 3)), `without the 20 best: ${fR(E.exp20, 3)}. The ten best are ${pct(s.top10)} of all profit`],
      ['Without the best year', E.noBestYear ? span(E.noBestYear.R, fR(E.noBestYear.R)) : '–', E.noBestYear ? `${E.noBestYear.y} removed: ${fR(E.noBestYear.exp, 2)} a trade` : ''],
      ['Longs vs shorts', `${fR(E.longs.R)} / ${fR(E.shorts.R)}`, `${E.longs.n} longs win ${pct(E.longs.win)}, ${E.shorts.n} shorts win ${pct(E.shorts.win)}`],
      ['Longest losing streak', `${s.streak}`, `with ${pct(1 - s.win)} losers, the longest streak expected in ${s.n} trades is about ${Math.round(E.streakExp)}`],
      ['Growth-optimal risk (Kelly)', `${(E.kelly.opt * 100).toFixed(1)}%`, `the fixed % that grew this history fastest; ${(E.kellyNoTop.opt * 100).toFixed(1)}% without the 10 best trades; simple formula (b·p − q) ÷ b = ${(E.kelly.simple * 100).toFixed(1)}%. People usually use half or less`],
      ['Sharpe ratio (monthly, in yearly terms)', E.sharpe.toFixed(2), `average monthly return ÷ its spread × √12, compounding at ${S.risk}%, no risk-free rate`],
      ['Monthly 95% VaR', fPct(E.var95, 1), `1 month in 20 is worse than this at ${S.risk}% risk; worst month ${fPct(E.worstMonth, 1)}, best ${fPct(E.bestMonth, 1)}`],
    ];
    if (f) rows.push(['Costs', `${fR(f.exp, 3)} → ${fR(s.exp, 3)}`, `per trade, before → after fees, slippage and funding: costs take ${pct(Math.max(0, (f.exp - s.exp) / Math.max(1e-9, f.exp)))} of the edge`]);
    $('secEdge').innerHTML = `<div class="sec-head"><div><h2>Edge or luck?</h2><p class="sub">How much one trade is worth, how sure we can be of it, and what it leans on: the reports' "Expectancy, statistics and probability" page.</p></div></div>${kv(rows)}`;
  }

  // ---- risk & edge: the same trades at other risk levels ---------------------------------------------------------------------
  const mult = (v) => (v >= 1000 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(0) : v.toFixed(2));
  function renderRisk() {
    const E = getE(), r = S.risk / 100;
    const hist = E.mc.map(({ risk }) => {
      const m = { ...V.m, risk }, c = A.curve(A.book(V.T, { ...m, mode: 'compound' }), m);
      const fy = A.years(A.book(V.T, { ...m, mode: 'fresh' }), { ...m, mode: 'fresh' }, V.fresh.yearList);
      return { risk, end: c.pts[c.pts.length - 1][1], dd: c.dd, fresh: fy.reduce((a, y) => a + y.profit, 0), worstY: Math.max(...fy.map((y) => y.dd)) };
    });
    const mark = (rk) => (Math.abs(rk - r) < 1e-9 ? ' class="tot"' : '');
    const lab = (rk) => `${+(rk * 100).toFixed(2)}%${Math.abs(rk - r) < 1e-9 ? ' (yours)' : ''}`;
    const t1 = table(['Risk per trade', `Fresh ${fM(S.start)} / yr (sum)`, 'Worst drop in a year', 'Compounding end', 'Deepest drop'],
      hist.map((h) => `<tr${mark(h.risk)}><td>${lab(h.risk)}</td><td>${span(h.fresh, fM(h.fresh, true))}</td><td>${fPct(-h.worstY)}</td><td>${fM(h.end)}</td><td>${fPct(-h.dd)}</td></tr>`));
    const t2 = table(['Risk per trade', 'Bad case (1 in 20)', 'Median', 'Ends below start', 'Typical worst drop', 'Worst drop, 1 in 20', 'Chance of −30%', 'Chance of −50%', 'Chance of −70%'],
      E.mc.map(({ risk, all }) => `<tr${mark(risk)}><td>${lab(risk)}</td><td>×${mult(all.p5)}</td><td>×${mult(all.p50)}</td><td>${pct(all.below, 1)}</td><td>${fPct(-all.ddMed)}</td><td>${fPct(-all.dd95)}</td><td>${pct(all.dd30)}</td><td>${pct(all.dd50)}</td><td>${pct(all.dd70)}</td></tr>`));
    const t3 = table(['Risk per trade', 'Ends below start', 'Bad case (1 in 20)', 'Median', 'Good case (1 in 20)', 'Typical worst drop', 'Chance of −30%'],
      E.mc.map(({ risk, year }) => `<tr${mark(risk)}><td>${lab(risk)}</td><td>${pct(year.below, 1)}</td><td>${fPct(year.p5 - 1)}</td><td>${fPct(year.p50 - 1)}</td><td>${fPct(year.p95 - 1)}</td><td>${fPct(-year.ddMed)}</td><td>${pct(year.dd30)}</td></tr>`));
    $('secRisk').innerHTML = `<div class="sec-head"><div><h2>Same trades, other risk levels</h2><p class="sub">Only the size of each trade changes. More risk grows the account faster until the drops start to eat the growth (the Kelly point here is ${(E.kelly.opt * 100).toFixed(1)}%).</p></div></div>
      <h3>In the order they really happened</h3>${t1}
      <h3>What could have happened: the ${E.n} trades re-shuffled at random, 2,000 times (compounding${S.cap > 0 ? `, capped at ${fM(S.cap)}` : ''})</h3>${t2}
      <h3>One year of about ${Math.round(E.perYear)} trades, re-shuffled, from a fresh ${fM(S.start)}</h3>${t3}
      <p class="foot">Re-shuffling keeps every trade's result and changes only the order (drawn with replacement), so it shows how much of the real path was luck of the order. It takes the trades one after another, while live up to ${E.open.max} are open at once, so real drops can be somewhat deeper.</p>`;
  }

  // ---- risk & edge: which fixed profit target? (BB-Core only; the time exit stays what Settings says, 48 = the bot's) ----------------------
  const TGC = { key: '', by: new Map(), busy: 0 };
  const parseTargets = () => [...new Set(String(S.tg).split(',').map((x) => parseFloat(x)).filter((x) => isFinite(x) && x > 0 && x <= 30))].sort((a, b) => a - b).slice(0, 10);
  function pickFrom(per) {
    const from = S.from ? Date.parse(S.from) / 1000 : -Infinity, to = S.to ? Date.parse(S.to) / 1000 + 86400 : Infinity, T = [];
    for (const c of coinsOn()) for (const t of per[c] || []) if (t.t >= from && t.tc < to) T.push(t);
    return T.sort((x, y) => x.tExit - y.tExit || x.t - y.t);
  }
  async function renderTargets() {
    const el = $('secTargets');
    if (S.s === 'icore') {
      el.innerHTML = `<h2>Profit target</h2><p class="sub">I-Core has no profit target: a winner runs until its trailing stop (${S.kTrail}×ATR) catches it. Pick a BB-Core strategy above to compare targets.</p>`;
      return;
    }
    const targets = [...parseTargets(), 0], iv = A.TF[S.tf], token = ++TGC.busy, key = [S.tf, S.maxBars, S.trendLen, S.costs].join('|');
    if (TGC.key !== key) { TGC.key = key; TGC.by = new Map(); }
    const head = (body) => `<div class="sec-head"><div><h2>Profit target: 2R, 3R, 4R, 5R … or none</h2>
      <p class="sub">The same BB-Core entries and stop, with a fixed take-profit at N × the stop distance (the old bot used 4R; since 29 Oct 2026 it has none). Time exit: ${S.maxBars} candles${S.maxBars === 48 ? " (the bot's setting, the most robust one in research/bb-core/hold-time)" : " (changed from the bot's 48 in Settings)"}. <b>Click a row to switch this whole page to that target.</b></p></div>
      <div class="sec-tools"><label class="ctl"><span class="ctl-l">Targets to compare (R, comma-separated)</span><input type="text" id="tgIn" value="${esc(S.tg)}" style="width:190px"></label></div></div>${body}`;
    for (const t of targets) {
      if (TGC.by.has(t)) continue;
      el.innerHTML = head(`<p class="sub">Running the bot's engine for ${t ? t + 'R' : 'no target'} on ${A.COINS.length} coins…</p>`);
      await sleep(15);
      if (token !== TGC.busy) return;
      const per = {};
      for (const c of A.COINS) { const d = DATA[`${c}|${S.tf}`]; per[c] = d && d.B.length >= 300 ? A.coinTrades(t ? 'bbfx' : 'bbnt', c, d.B, d.F, { ...params(), targetR: t }, iv).trades : []; }
      TGC.by.set(t, per);
    }
    if (token !== TGC.busy || !V) return;
    const cur = S.s === 'bbfx' ? S.targetR : 0, lab = (t) => (t ? `${t}R` : 'none (today)');
    const rows = targets.map((t) => {
      const T = pickFrom(TGC.by.get(t)); if (!T.length) return null;
      const an = A.analyse(T, { ...V.m, mode: 'fresh' }), s = an.stats, hit = T.filter((x) => x.why === 'target').length, stop = T.filter((x) => x.why === 'stop').length;
      return { t, T, an, s, hit, stop, time: T.length - hit - stop, noTop: s.net * (1 - s.top10), fresh: an.years.reduce((a, y) => a + y.profit, 0), worst: Math.max(0, ...an.years.map((y) => y.dd)),
        yrsUp: an.years.filter((y) => y.R > 0).length, coinsUp: V.coins.filter((c) => an.perCoin[c] && an.perCoin[c].stats.net > 0).length };
    }).filter(Boolean);
    if (!rows.length) { el.innerHTML = head('<p class="sub">No closed trades with these settings.</p>'); wireTargets(); return; }
    const tr = (r, cells) => `<tr data-t="${r.t}" style="cursor:pointer"${r.t === cur ? ' class="tot"' : ''}><td>${lab(r.t)}${r.t === cur ? ' ◀ now' : ''}</td>${cells}</tr>`;
    const t1 = table(['Target', 'Trades', 'Hit target', 'Stopped', 'Time exit', 'Win rate', 'Avg win', 'Avg loss', 'Expectancy', 'Total R', 'Profit factor', 'Deepest drop', 'Top 10 = % of profit', 'Profit w/o 10 best', 'Worst drop in a year', `Fresh ${fM(S.start)} / yr (sum)`, 'Years up', 'Coins up'],
      rows.map((r) => tr(r, `<td>${r.s.n}</td><td>${r.t ? pct(r.hit / r.s.n) : '–'}</td><td>${pct(r.stop / r.s.n)}</td><td>${pct(r.time / r.s.n)}</td><td>${pct(r.s.win, 1)}</td><td>${fR(r.s.avgWin, 2)}</td><td>${fR(r.s.avgLoss, 2)}</td>
        <td>${span(r.s.exp, fR(r.s.exp, 3))}</td><td><b>${span(r.s.net, fR(r.s.net))}</b></td><td>${r.s.pf === Infinity ? '∞' : r.s.pf.toFixed(2)}</td><td>${fR(-r.s.ddR)}</td><td>${pct(r.s.top10)}</td><td>${span(r.noTop, fR(r.noTop))}</td>
        <td>${fPct(-r.worst)}</td><td>${span(r.fresh, fM(r.fresh, true))}</td><td>${r.yrsUp}/${r.an.years.length}</td><td>${r.coinsUp}/${V.coins.length}`) + '</td>'));
    const cs = V.coins, t2 = table(['Total R by coin', ...cs.map((c) => ({ t: coinName(c) }))],
      rows.map((r) => tr(r, cs.map((c) => `<td>${r.an.perCoin[c] ? span(r.an.perCoin[c].stats.net, fR(r.an.perCoin[c].stats.net, 0)) : '·'}</td>`).join(''))));
    const ys = rows[0].an.yearList, t3 = table(['Total R by year', ...ys.map((y) => yLabel(y))],
      rows.map((r) => tr(r, ys.map((y) => { const x = r.an.years.find((q) => q.y === y); return `<td>${x && x.n ? span(x.R, fR(x.R, 0)) : '·'}</td>`; }).join(''))));
    const best = [...rows].sort((a, b) => b.s.net - a.s.net)[0], bestRob = [...rows].sort((a, b) => b.noTop - a.noTop)[0];
    el.innerHTML = head(`${t1}<div class="two"><div>${t2}</div><div>${t3}</div></div>
      <div class="note">Most total R: <b>${lab(best.t)}</b> (${fR(best.s.net)}). Most profit without the 10 best trades: <b>${lab(bestRob.t)}</b> (${fR(bestRob.noTop)}). A target caps every win, so a lower target wins more often but earns less per win; "none" keeps the huge winners and leans on them (top 10 = ${pct(rows[rows.length - 1].s.top10)} of its profit, against ${pct(rows[Math.min(3, rows.length - 1)].s.top10)} at ${lab(rows[Math.min(3, rows.length - 1)].t)}).</div>
      <p class="foot">Hit target = closed at the take-profit; Stopped = closed at the stop; Time exit = closed by the ${S.maxBars}-candle limit. A target fills only when price trades 0.05% through it (maker fee 0.02%), as in the bot's research. Settings above (coins, dates, costs, risk, start balance) apply.</p>`);
    wireTargets();
  }
  function wireTargets() {
    const el = $('secTargets'), inp = el.querySelector('#tgIn');
    if (inp) inp.onchange = () => { S.tg = inp.value; writeHash(); renderTargets(); };
    el.onclick = (e) => {
      const row = e.target.closest('tr[data-t]'); if (!row) return;
      const t = +row.dataset.t; if (t) { S.s = 'bbfx'; S.targetR = t; } else S.s = 'bbnt';
      writeHash(); syncControls(); run();
    };
  }

  // ---- risk & edge: survival (under the growth charts) -----------------------------------------------------------------------
  function survivalHtml() {
    const E = getE(), dd = V.comp.curve.dd, r = S.risk / 100, u = E.under, days = (sec) => Math.round(sec / 86400);
    const rows = [
      ['Deepest drop', fPct(-dd), `getting back needs ${fPct(dd / (1 - dd))}: a loss of L needs a gain of L ÷ (1 − L)`],
      ['Time below a previous high', pct(u.share), 'share of closed trades that left the balance below its best so far (normal for a winning strategy too)'],
      ['Longest time to a new high', `${days(u.longest)} days`, u.longFrom ? `from ${fmtDate(u.longFrom)} to ${u.longTo ? fmtDate(u.longTo) : 'now (not back yet)'}` : ''],
      ['Now', u.now ? fPct(-u.now.dd) : 'at a high', u.now ? `below the high of ${fmtDate(u.now.since)}` : 'the balance is at its best so far'],
      ['Gaps past the stop', `${E.gaps.length} trade${E.gaps.length === 1 ? '' : 's'}`, E.gaps.length ? `lost more than 1.2R (worst ${fR(Math.min(...E.gaps), 2)}): a stop is an order, not a guaranteed price` : 'no trade lost more than 1.2R'],
    ];
    const cols = [0.01, 0.025, 0.05, r].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const streaks = [5, 10, 15, 20].map((k) => `<tr><td>${k} losses in a row</td>${cols.map((rk) => `<td>${fPct(-(1 - (1 - rk) ** k))}</td>`).join('')}</tr>`);
    return `<h3>Survival</h3>${kv(rows)}
      <h3>What a losing streak costs: balance × (1 − risk)<sup>n</sup></h3>${table(['Streak', ...cols.map((rk) => `At ${+(rk * 100).toFixed(2)}%${Math.abs(rk - r) < 1e-9 ? ' (yours)' : ''}`)], streaks)}
      <p class="foot">Longest streak seen: ${E.s.streak}. Expected for this loss rate in ${E.n} trades: about ${Math.round(E.streakExp)}. The worst one may still be ahead.</p>`;
  }

  // ---- risk & edge: coins together ---------------------------------------------------------------------------------------------
  function renderTogether() {
    const E = getE(), cs = E.coins;
    if (cs.length < 2) { $('secTogether').innerHTML = `<h2>Coins together</h2><p class="sub">Pick two or more coins to see how they move together.</p>`; return; }
    const bg = (v) => (!isFinite(v) ? 'transparent' : `rgba(var(--${v >= 0 ? 'neg' : 'pos'}-bg),${(Math.abs(v) * 0.5).toFixed(2)})`);
    const rows = cs.map((a, i) => `<tr><td>${coinName(a)}</td>${cs.map((b, j) => `<td style="background:${i === j ? 'var(--surface-3)' : bg(E.corrM[i][j])}">${i === j ? '–' : isFinite(E.corrM[i][j]) ? E.corrM[i][j].toFixed(2) : '·'}</td>`).join('')}</tr>`);
    const avg = E.corrAvg, word = avg < 0.2 ? 'move mostly on their own: real diversification' : avg < 0.5 ? 'move together somewhat: partly diversified' : 'move together a lot: several trades can act like one big trade';
    $('secTogether').innerHTML = `<div class="sec-head"><div><h2>Coins together</h2><p class="sub">Correlation of each pair's monthly R (+1 = good and bad in the same months, 0 = unrelated). Five trades at ${S.risk}% are five separate risks only when the coins do not move together.</p></div></div>
      ${table(['', ...cs.map((c) => ({ t: coinName(c) }))], rows)}
      <div class="note">Average correlation <b>${isFinite(avg) ? avg.toFixed(2) : '–'}</b>: the coins ${word}. At most <b>${E.open.max} positions were open at once</b> (${fmtDate(E.open.at)}), so up to ${(S.risk * E.open.max).toFixed(1)}% of the account was at risk together.</div>`;
  }

  // ---- trades: how the results are spread ---------------------------------------------------------------------------------------
  function renderDist() {
    const E = getE(), max = Math.max(...E.buckets.map((b) => b.n));
    const rows = E.buckets.map((b) => `<tr><td>${b.label}</td><td>${b.n}</td><td>${pct(b.n / E.n, 1)}</td><td class="l" style="min-width:160px"><span style="display:inline-block;height:10px;border-radius:0 4px 4px 0;width:${Math.round(b.n / (max || 1) * 150)}px;background:var(--c-SOL)"></span></td><td>${span(b.R, fR(b.R))}</td></tr>`);
    $('secDist').innerHTML = `<div class="sec-head"><div><h2>How the results are spread</h2><p class="sub">Every closed trade by its result. Mean ${fR(E.s.exp, 2)}, median ${fR(E.median, 2)}, spread ${E.sd.toFixed(2)}R.</p></div></div>
      ${table(['Result', 'Trades', 'Share', { t: '', cls: 'l' }, 'Total R'], rows)}
      <p class="foot">${E.median < 0 && E.s.exp > 0 ? 'Most trades lose a little and a small group of large winners pays for them: judge it over many trades, never over a few.' : 'The middle trade is positive: most of the profit comes from ordinary trades.'}</p>`;
  }

  // ---- charts: one y-axis, recessive grid, crosshair tooltip -------------------------------------------------------------------
  function lineChart(host, series, o = {}) {
    const W = Math.max(320, host.clientWidth || 900), H = o.height || 260, ml = 64, mr = o.endLabels ? 52 : 14, mt = 10, mb = 24;
    const all = series.flatMap((s) => s.pts);
    if (!all.length) { host.innerHTML = ''; return; }
    const x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0]));
    let y0 = Math.min(...all.map((p) => p[1])), y1 = Math.max(...all.map((p) => p[1]));
    if (o.zero || o.area) { y0 = Math.min(0, y0); y1 = Math.max(0, y1); }
    const log = o.log && y0 > 0;
    const f = (v) => (log ? Math.log10(v) : v);
    let a = f(y0), b = f(y1); if (a === b) { a -= 1; b += 1; }
    const pad = (b - a) * 0.04; if (!o.area) { a -= pad; } b += pad;
    const X = (t) => ml + (t - x0) / ((x1 - x0) || 1) * (W - ml - mr), Y = (v) => mt + (b - f(v)) / (b - a) * (H - mt - mb);
    // y ticks
    let ticks = [];
    if (log) { for (let e = Math.floor(a); e <= Math.ceil(b); e++) if (e >= a && e <= b) ticks.push(10 ** e); if (ticks.length < 3) for (let e = Math.floor(a); e <= Math.ceil(b); e++) [2, 5].forEach((k) => { const v = k * 10 ** e; if (f(v) >= a && f(v) <= b) ticks.push(v); }); ticks.sort((p, q) => p - q); }
    else { const span_ = b - a, raw = span_ / 5, mag = 10 ** Math.floor(Math.log10(raw)), st = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => span_ / k <= 6); for (let v = Math.ceil(a / st) * st; v <= b; v += st) ticks.push(+v.toFixed(10)); }
    // x ticks: years
    const xt = []; for (let y = new Date(x0 * 1000).getUTCFullYear() + 1; Date.UTC(y, 0, 1) / 1000 <= x1; y++) xt.push([Date.UTC(y, 0, 1) / 1000, y]);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => s.name).join(', '))}">`;
    svg += ticks.map((v) => `<line class="gl" x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${ml - 6}" y="${Y(v) + 3}" text-anchor="end">${esc(o.yFmt(v))}</text>`).join('');
    svg += xt.map(([t, y]) => `<text class="ax" x="${X(t)}" y="${H - 6}" text-anchor="middle">${y}</text>`).join('');
    if (!log && a < 0 && b > 0) svg += `<line class="base" x1="${ml}" x2="${W - mr}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    for (const s of series) {
      const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
      if (o.area) svg += `<path d="${d}L${X(s.pts[s.pts.length - 1][0]).toFixed(1)},${Y(0)}L${X(s.pts[0][0]).toFixed(1)},${Y(0)}Z" style="fill:${s.color};opacity:.18"/>`;
      svg += `<path class="ln" d="${d}" style="stroke:${s.color}"/>`;
    }
    if (o.endLabels) {   // direct labels at the line ends, nudged apart
      const ends = series.map((s) => ({ name: s.name, y: Y(s.pts[s.pts.length - 1][1]) })).sort((p, q) => p.y - q.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
      svg += ends.map((e) => `<text class="el" x="${W - mr + 6}" y="${e.y + 4}">${e.name}</text>`).join('');
    }
    svg += `<g class="hov" style="visibility:hidden"><line class="xh" id="${host.id}X" y1="${mt}" y2="${H - mb}"/>`;
    svg += series.map((s, i) => `<circle class="mk" id="${host.id}M${i}" r="4" style="fill:${s.color}"/>`).join('') + '</g>';
    svg += `<rect class="hit" x="${ml}" y="${mt}" width="${W - ml - mr}" height="${H - mt - mb}"/></svg>`;
    host.innerHTML = svg;
    const el = host.querySelector('svg'), xh = host.querySelector(`#${host.id}X`), hov = host.querySelector('.hov');
    const at = (pts, t) => { let lo = 0, hi = pts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (pts[mid][0] <= t) lo = mid; else hi = mid - 1; } return pts[lo]; };
    el.onpointermove = (e) => {
      const r = el.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W;
      if (sx < ml || sx > W - mr) { hov.style.visibility = 'hidden'; return hideTip(); }
      hov.style.visibility = 'visible';
      const t = x0 + (sx - ml) / (W - ml - mr) * (x1 - x0);
      xh.setAttribute('x1', sx); xh.setAttribute('x2', sx);
      const vals = series.map((s, i) => { const p = at(s.pts, t), m = host.querySelector(`#${host.id}M${i}`); m.setAttribute('cx', X(p[0])); m.setAttribute('cy', Y(p[1])); return { s, v: p[1] }; });
      vals.sort((p, q) => q.v - p.v);
      showTip(e, `<b>${fmtDate(t)}</b>` + vals.map(({ s, v }) => `<div class="r"><span>${series.length > 1 ? `<span class="dot" style="background:${s.color}"></span>` : ''}${s.name}</span><span>${o.tipFmt(v)}</span></div>`).join(''));
    };
    el.onpointerleave = () => { hideTip(); hov.style.visibility = 'hidden'; };
  }
  function showTip(e, html) {
    const t = $('tip'); t.innerHTML = html; t.hidden = false;
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 14) + 'px';
    t.style.top = Math.max(8, e.clientY - h - 12) + 'px';
  }
  function hideTip() { $('tip').hidden = true; }
  // month cells carry their tooltip in data-tip
  document.addEventListener('pointerover', (e) => { const c = e.target.closest && e.target.closest('[data-tip]'); if (c) showTip(e, c.dataset.tip); });
  document.addEventListener('pointerout', (e) => { if (e.target.closest && e.target.closest('[data-tip]')) hideTip(); });

  function segWire(id, value, on) {
    const seg = $(id); if (!seg) return;
    seg.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b.dataset.v === value); b.onclick = () => on(b.dataset.v); });
  }

  // ---- settings UI -----------------------------------------------------------------------------------------------------------------
  function buildControls() {
    $('stratSeg').innerHTML = Object.entries(A.STRATS).map(([k, s]) => `<button data-v="${k}">${s.name}</button>`).join('');
    $('tfSeg').innerHTML = Object.keys(A.TF).sort((p, q) => A.TF[p] - A.TF[q]).map((k) => `<button data-v="${k}">${A.TF_LABEL[k]}${k === '240' ? ' ★' : ''}</button>`).join('');
    $('coinSeg').innerHTML = A.COINS.map((c) => `<button data-v="${c}">${coinName(c)}</button>`).join('') + `<button data-v="*">All</button>`;
    $('riskSeg').innerHTML = RISK_PRESETS.map((v) => `<button data-v="${v}">${v}%</button>`).join('');
    syncControls();
    const recompute = () => { writeHash(); syncControls(); if (TR) { computeTrades(); render(); } };
    $('stratSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.s = b.dataset.v; writeHash(); syncControls(); run(); };
    $('tfSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.tf = b.dataset.v; CS.y = null; writeHash(); syncControls(); run(); };
    $('coinSeg').onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      let on = coinsOn();
      if (b.dataset.v === '*') on = on.length === A.COINS.length ? [A.COINS[0]] : [...A.COINS];
      else on = on.includes(b.dataset.v) ? on.filter((c) => c !== b.dataset.v) : A.COINS.filter((c) => on.includes(c) || c === b.dataset.v);
      S.coins = on.join(','); recompute();
    };
    $('viewSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.view = b.dataset.v; recompute(); };
    $('riskSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.risk = +b.dataset.v; recompute(); };
    $('costs').onchange = (e) => { S.costs = e.target.checked ? 1 : 0; writeHash(); run(); };
    $('cur').onchange = (e) => { S.cur = e.target.value; recompute(); };
    const num = (id, key, min) => { $(id).onchange = (e) => { const v = parseFloat(e.target.value); S[key] = isFinite(v) ? Math.max(min, v) : DEF[key]; recompute(); }; };
    num('start', 'start', 1); num('risk', 'risk', 0.01); num('cap', 'cap', 0);
    $('from').onchange = (e) => { S.from = e.target.value; recompute(); };
    $('to').onchange = (e) => { S.to = e.target.value; recompute(); };
    $('paramBox').onchange = (e) => { const k = e.target.dataset.k; if (!k) return; const u = PARAM_UI[k], v = parseFloat(e.target.value); S[k] = isFinite(v) ? Math.min(u.max, Math.max(u.min, v)) : A.PARAMS[k]; recompute(); };
    $('paramBox').onclick = (e) => { const b = e.target.closest('button[data-reset]'); if (!b) return; for (const k of A.STRATS[S.s].params) S[k] = A.PARAMS[k]; recompute(); };
    $('tabs').onclick = (e) => { const b = e.target.closest('button[data-tab]'); if (!b || b.dataset.tab === S.tab) return; S.tab = b.dataset.tab; writeHash(); showTab(); };
    $('refreshBtn').onclick = () => run(true);
    $('printBtn').onclick = () => window.print();
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (V && V.T.length) { dirty.add(S.tab); showTab(); } }, 200); });
  }
  function syncControls() {
    const on = (id, v) => $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(v)));
    on('stratSeg', S.s); on('tfSeg', S.tf); on('viewSeg', S.view); on('riskSeg', S.risk);
    const cs = coinsOn();
    $('coinSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === '*' ? cs.length === A.COINS.length : cs.includes(b.dataset.v)));
    $('costs').checked = !!S.costs; $('cur').value = S.cur; $('start').value = S.start; $('risk').value = S.risk; $('cap').value = S.cap; $('from').value = S.from; $('to').value = S.to;
    const ps = A.STRATS[S.s].params, dflt = ps.every((k) => S[k] === A.PARAMS[k]);
    $('paramBox').innerHTML = ps.map((k) => { const u = PARAM_UI[k]; return `<label class="ctl"><span class="ctl-l">${u.label}</span><input type="number" data-k="${k}" min="${u.min}" max="${u.max}" step="${u.step}" value="${S[k]}"></label>`; }).join('') +
      `<div class="ctl"><span class="ctl-l">&nbsp;</span><button class="more" style="margin:0" data-reset="1" ${dflt ? 'disabled' : ''}>${dflt ? 'Bot defaults' : 'Reset to the bot'}</button></div>`;
  }

  const toTop = $('toTop');
  window.addEventListener('scroll', () => toTop.classList.toggle('show', window.scrollY > 500), { passive: true });
  toTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  window.addEventListener('hashchange', () => { const before = JSON.stringify(S); readHash(); if (JSON.stringify(S) !== before) { syncControls(); showTab(); run(); } });
  readHash(); buildControls(); run();
})();
