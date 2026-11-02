// analysis.js — the in-depth analysis page (analysis.html), opened from the 🔎 button of a setup indicator's performance calendar.
// Downloads the five coins' Binance candles (+ funding for BB-Core) once, keeps them on this device (IndexedDB), runs the bots' engines
// (js/analysis-core.js) and draws the report-style sections. Every setting lives in the URL hash, so a link reopens the same view.
(() => {
  const A = AnalysisCore, $ = (id) => document.getElementById(id);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const RISK_PRESETS = [0.5, 1, 2, 2.5, 5];
  const PARAM_UI = {
    targetR: { label: 'Target (R)', min: 0.5, max: 20, step: 0.5 },
    maxBars: { label: 'Time exit (candles)', min: 0, max: 1000, step: 1 },
    kInit: { label: 'First stop (×ATR)', min: 0.5, max: 10, step: 0.5 },
    kTrail: { label: 'Trail (×ATR)', min: 1, max: 20, step: 0.5 },
    trendLen: { label: 'Trend SMA (0 = off)', min: 0, max: 400, step: 10 },
  };

  // ---- settings (URL hash) -------------------------------------------------------------------------------------------------
  const DEF = { s: 'icore', tf: '240', coins: A.COINS.join(','), costs: 1, ...A.PARAMS, start: 10000, cur: '₱', risk: 2.5, cap: 0, from: '', to: '', view: 'total' };
  delete DEF.costs; DEF.costs = 1;
  const S = { ...DEF };
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    for (const k of Object.keys(DEF)) if (h.has(k)) S[k] = typeof DEF[k] === 'number' ? (isFinite(+h.get(k)) ? +h.get(k) : DEF[k]) : h.get(k);
    if (!A.STRATS[S.s]) S.s = DEF.s;
    if (!A.TF[S.tf]) S.tf = DEF.tf;
    if (!S.cur) S.cur = DEF.cur;
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
  const fPct = (v, d = 0) => `${sgn(v)}${Math.abs(v * 100).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })}%`;
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
    const T = [], opens = [];
    for (const c of coins) {
      if (!TR[c]) continue;
      for (const t of TR[c].trades) if (t.t >= from && t.tc < to) T.push(t);
      if (TR[c].open && !S.to) opens.push(TR[c].open);
    }
    const m = money();
    V = { T, coins, opens, m, fresh: A.analyse(T, { ...m, mode: 'fresh' }), comp: A.analyse(T, { ...m, mode: 'compound' }), fixed: A.analyse(T, { ...m, mode: 'fixed' }) };
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
    if (!V.T.length) {
      $('secSummary').innerHTML = `<h2>No closed trades</h2><p class="sub">Nothing closed with these settings. Pick at least one coin, or widen the dates.</p>`;
      ['secCoins', 'secYears', 'secMonths', 'secCalendar', 'secExp', 'secGrowth', 'secTrades', 'secMethod'].forEach((id) => { $(id).innerHTML = ''; });
      return;
    }
    renderSummary(); renderCoins(); renderYears(); renderMonths(); renderCalendar(); renderExp(); renderGrowth(); renderTrades(); renderMethod();
  }

  // ---- 1. summary ---------------------------------------------------------------------------------------------------------------
  function renderSummary() {
    const s = V.fresh.stats, comp = V.comp.curve, fy = V.fresh.years, worstY = Math.max(...fy.map((y) => y.dd));
    const sumFresh = fy.reduce((a, y) => a + y.profit, 0), endC = comp.pts[comp.pts.length - 1][1];
    const first = V.T[0], last = V.T[V.T.length - 1];
    const k = (v, key, sub) => `<div class="kpi"><div class="v">${v}</div><div class="k">${key}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
    $('secSummary').innerHTML = `
      <div class="sec-head"><div><h2>Summary</h2><p class="sub">${V.coins.length} coin${V.coins.length > 1 ? 's' : ''} together, one shared account, ${fmtDate(first.tc)} to ${fmtDate(last.tc)}. R = the amount risked on a trade.</p></div></div>
      <div class="kpis">
        ${k(s.n.toLocaleString(), 'Trades', `${s.longs} long · ${s.shorts} short`)}
        ${k(pct(s.win, 1), 'Win rate', `break-even at this payoff ${pct(s.beWin, 1)}`)}
        ${k(span(s.exp, fR(s.exp, 2)), 'Average per trade', `win ${fR(s.avgWin, 2)} · loss ${fR(s.avgLoss, 2)}`)}
        ${k(s.pf === Infinity ? '∞' : s.pf.toFixed(2), 'Profit factor', 'gross wins ÷ gross losses')}
        ${k(span(s.net, fR(s.net, 1)), 'Total R', `deepest drop ${fR(-s.ddR, 1)}`)}
        ${k(span(sumFresh, fM(sumFresh, true)), `Profit, fresh ${fM(S.start)} each January`, `sum of ${fy.length} years · worst drop in a year ${fPct(-worstY)}`)}
        ${k(fM(endC), `Compounding, ${fM(S.start)} once`, `${fPct(endC / S.start - 1)} · deepest drop ${fPct(-comp.dd)}`)}
        ${k(span(s.best, fR(s.best, 1)), 'Best trade', `ten best = ${pct(s.top10)} of all profit`)}
        ${k(s.streak, 'Longest losing streak', `worst trade ${fR(s.worst, 2)}`)}
        ${k((s.avgBars * A.TF[S.tf] / 86400).toFixed(1) + ' d', 'Average hold', `${s.avgBars.toFixed(0)} candles`)}
      </div>`;
  }

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
    const per = S.start * S.risk / 100, perTrade = S.cap > 0 ? Math.min(S.cap, per) : per;
    const row = (lbl, T) => { const s = A.stats(T); return `<tr><td>${lbl}</td><td>${s.n}</td><td>${s.n ? pct(s.win, 1) : '–'}</td><td><b>${span(s.exp, fR(s.exp, 2))}</b></td><td>${fR(s.avgWin, 2)}</td><td>${fR(s.avgLoss, 2)}</td><td>${s.pf === Infinity ? '∞' : s.pf.toFixed(2)}</td><td>${span(s.exp, fM(s.exp * perTrade, true))}</td></tr>`; };
    const head = ['', 'Trades closed', 'Win rate', 'Expectancy (avg R)', 'Average win', 'Average loss', 'Profit factor', `${S.cur} per trade at ${fM(perTrade)} risk`];
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
      <h3>Maximum drawdown by year</h3>${table(['Year', `Fresh ${fM(S.start)}`, 'Compounding', 'No compounding'], V.fresh.yearList.map((y, i) => `<tr><td>${yLabel(y)}</td><td>${fPct(-V.fresh.years[i].dd)}</td><td>${fPct(-V.comp.years[i].dd)}</td><td>${fPct(-V.fixed.years[i].dd)}</td></tr>`).concat(`<tr class="tot"><td>Whole period</td><td>${fPct(-Math.max(...V.fresh.years.map((y) => y.dd)))} (worst year)</td><td>${fPct(-V.comp.curve.dd)}</td><td>${fPct(-V.fixed.curve.dd)}</td></tr>`))}`;
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
    $('refreshBtn').onclick = () => run(true);
    $('printBtn').onclick = () => window.print();
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (V && V.T.length) { renderCoins(); renderGrowth(); } }, 200); });
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

  window.addEventListener('hashchange', () => { const before = JSON.stringify(S); readHash(); if (JSON.stringify(S) !== before) { syncControls(); run(); } });
  readHash(); buildControls(); run();
})();
