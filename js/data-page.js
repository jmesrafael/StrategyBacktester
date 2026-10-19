// data-page.js — "Data" page: displays + manages saved backtest cards.
// Each card has an "Open →" button that opens a full-screen detail modal showing the
// AI-generated summary (stored in run.note at save time) plus full params and stats.

const DataPage = (() => {
  const UP = '#26a69a', DOWN = '#ef5350';

  // ── Singleton detail modal (created once, reused for every card) ─────────────────────
  let detailOverlay = null;

  // ── Cross-comparison state ───────────────────────────────────────────────────────────
  let compareMode = false;          // selection UI active
  let compareSel = [];              // run ids picked for comparison (ordered)
  let currentRuns = [];             // last-fetched runs (so compare can look them up)
  let compareOverlay = null;        // singleton comparison modal

  // Flatten any saved run into comparable "cells": one stat block per
  // dimension (symbol×TF for matrix, TF for mtf, the single pair for single).
  function runCells(run) {
    const r = run.result || {};
    if (run.kind === 'matrix' && Array.isArray(r.cells)) {
      return r.cells.filter((c) => !c.err && c.st)
        .map((c) => ({ key: `${c.symbol}|${c.interval}`, dim: `${c.symbol.replace('USDT', '')} ${c.label}`, st: c.st }));
    }
    if (run.kind === 'mtf' && Array.isArray(r.rows)) {
      return r.rows.filter((x) => !x.err && x.st)
        .map((x) => ({ key: `${run.symbol}|${x.label}`, dim: `${run.symbol.replace('USDT', '')} ${x.label}`, st: x.st }));
    }
    // single: result IS the stats object
    if (r && r.totalTrades != null) {
      return [{ key: `${run.symbol}|${run.interval}`, dim: `${run.symbol.replace('USDT', '')} ${tfLabel(run.interval)}`, st: r }];
    }
    return [];
  }

  // raw interval key → display label (e.g. '240' → '4h'); falls back to the raw value.
  function tfLabel(iv) {
    const all = (window.CFG && (CFG.ALL_INTERVALS || CFG.INTERVALS)) || [];
    const hit = all.find(([k]) => k === iv);
    return hit ? hit[1] : (iv || '?');
  }

  // Aggregate a run's cells into headline comparison metrics. Net % and expectancy R
  // are capital-independent (fair across runs); total net $ is shown but flagged when
  // capital/size differ between the two runs being compared.
  function runAggregate(run) {
    const cells = runCells(run);
    const n = cells.length || 1;
    const sum = (f) => cells.reduce((a, c) => a + (f(c.st) || 0), 0);
    const pfList = cells.map((c) => c.st.profitFactor === Infinity ? 4 : (c.st.profitFactor || 0));
    const expList = cells.map((c) => c.st.expectancyR).filter((v) => v != null);
    const best = cells.length ? cells.reduce((a, b) => (b.st.netPct > a.st.netPct ? b : a)) : null;
    return {
      cells,
      count: cells.length,
      totalNet: sum((s) => s.netUsd),
      avgPct: sum((s) => s.netPct) / n,
      avgWin: sum((s) => s.winRate) / n,
      avgPF: pfList.reduce((a, b) => a + b, 0) / n,
      avgExpR: expList.length ? expList.reduce((a, b) => a + b, 0) / expList.length : null,
      totalTrades: sum((s) => s.totalTrades),
      posShare: cells.length ? cells.filter((c) => c.st.netUsd > 0).length / cells.length : 0,
      best,
    };
  }

  function buildDetailModal() {
    if (detailOverlay) return;
    detailOverlay = document.createElement('div');
    detailOverlay.className = 'dc-detail-overlay';
    detailOverlay.style.display = 'none';
    detailOverlay.innerHTML =
      `<div class="dc-detail-modal">` +
        `<div class="dc-detail-head">` +
          `<div class="dc-detail-meta"></div>` +
          `<button class="dc-detail-close" title="Close"><i class="fas fa-xmark"></i></button>` +
        `</div>` +
        `<div class="dc-detail-infobar"></div>` +
        `<div class="dc-detail-ai"></div>` +
        `<div class="dc-detail-body">` +
          `<div class="dc-detail-inputs"><div class="dc-section-title">Inputs</div><div class="dc-detail-params"></div></div>` +
          `<div class="dc-detail-results"><div class="dc-section-title">Results</div><div class="dc-detail-stats"></div></div>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(detailOverlay);

    detailOverlay.querySelector('.dc-detail-close').onclick = closeDetail;
    detailOverlay.addEventListener('click', (e) => { if (e.target === detailOverlay) closeDetail(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && detailOverlay.style.display !== 'none') closeDetail(); });
  }

  function closeDetail() { if (detailOverlay) detailOverlay.style.display = 'none'; }

  function openDetail(run) {
    buildDetailModal();

    // ── header meta ──
    const kindBadge = run.kind === 'matrix'
      ? `<span class="dc-badge dc-badge-matrix">MATRIX</span>`
      : run.kind === 'mtf'
        ? `<span class="dc-badge dc-badge-mtf">MTF</span>`
        : `<span class="dc-badge dc-badge-single">Single</span>`;
    detailOverlay.querySelector('.dc-detail-meta').innerHTML =
      `<span class="dc-strategy" style="font-size:12px">${run.strategy_label}</span>` +
      `<span class="dc-sym">${run.symbol}</span>` +
      `<span class="dc-tf">${run.interval}</span>` +
      kindBadge +
      `<span class="dc-date" style="margin-left:4px">${fmtDate(run.created_at)}</span>`;

    // ── test-info bar (period + capital + sim settings) ──
    const s  = run.settings || {};
    const tp = s.test_period || run.test_period;
    const infoEl = detailOverlay.querySelector('.dc-detail-infobar');
    if (infoEl) {
      const infoParts = [];
      if (tp && tp.from) infoParts.push(`<span><i class="fas fa-calendar"></i> ${fmtDay(tp.from)} → ${fmtDay(tp.to)}</span>`);
      if (tp && tp.days) infoParts.push(`<span>${tp.days.toLocaleString()} days</span>`);
      if (tp && tp.bars) infoParts.push(`<span>${tp.bars.toLocaleString()} bars</span>`);
      if (s.startBalance) infoParts.push(`<span><i class="fas fa-wallet"></i> $${Number(s.startBalance).toLocaleString()} capital</span>`);
      if (s.sizePct != null) infoParts.push(`<span>${s.sizePct}% size</span>`);
      if (s.commissionPct != null) infoParts.push(`<span>${s.commissionPct}% fee</span>`);
      if (s.slippagePct != null) infoParts.push(`<span>${s.slippagePct}% slip</span>`);
      if (run.max_candles) infoParts.push(`<span>max ${run.max_candles.toLocaleString()} candles</span>`);
      infoEl.innerHTML = infoParts.join('<span class="dc-info-sep">·</span>');
      infoEl.style.display = infoParts.length ? 'flex' : 'none';
    }

    // ── AI summary ──
    const aiEl = detailOverlay.querySelector('.dc-detail-ai');
    if (run.note) {
      aiEl.innerHTML = run.note;
      aiEl.style.display = 'block';
    } else {
      aiEl.style.display = 'none';
    }

    // ── inputs ──
    const paramsEl = detailOverlay.querySelector('.dc-detail-params');
    const paramParts = [];
    for (const [k, v] of Object.entries(run.params || {})) {
      paramParts.push(`<div class="dc-row"><span>${k}</span><b>${v}</b></div>`);
    }
    if (run.settings) {
      if (run.settings.sizePct != null)       paramParts.push(`<div class="dc-row"><span>Position size</span><b>${run.settings.sizePct}%</b></div>`);
      if (run.settings.commissionPct != null) paramParts.push(`<div class="dc-row"><span>Commission</span><b>${run.settings.commissionPct}%</b></div>`);
      if (run.settings.slippagePct != null)   paramParts.push(`<div class="dc-row"><span>Slippage</span><b>${run.settings.slippagePct}%</b></div>`);
    }
    if (run.max_candles) paramParts.push(`<div class="dc-row"><span>Max candles</span><b>${run.max_candles.toLocaleString()}</b></div>`);
    paramsEl.innerHTML = paramParts.join('');

    // ── results ──
    const statsEl = detailOverlay.querySelector('.dc-detail-stats');
    if (run.kind === 'single') {
      statsEl.innerHTML = renderSingleResult(run.result, true);
    } else if (run.kind === 'mtf') {
      statsEl.innerHTML = renderMtfResult(run.result);
    } else {
      statsEl.innerHTML = renderMatrixResult(run);
      // Make the saved heatmap interactive again: clicking a cell expands its stat card.
      if (window.MatrixView && window.MatrixView.bind) window.MatrixView.bind(statsEl, run.result);
    }

    detailOverlay.style.display = 'grid';
  }

  function fmtMoney(v) {
    const s = v < 0 ? '-' : '+';
    return `${s}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function fmtPct(v) { return `${v < 0 ? '-' : '+'}${Math.abs(v).toFixed(2)}%`; }

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  function fmtDay(ts) {
    if (!ts) return '?';
    return new Date(ts * 1000).toISOString().slice(0, 10);
  }

  // One-line test-window + capital summary for a run record.
  function periodLine(run) {
    const s  = run.settings || {};
    const tp = s.test_period || run.test_period; // run.test_period = legacy fallback
    const parts = [];
    if (tp && tp.from) parts.push(`${fmtDay(tp.from)} → ${fmtDay(tp.to)}`);
    if (tp && tp.days) parts.push(`${tp.days.toLocaleString()}d`);
    if (tp && tp.bars) parts.push(`${tp.bars.toLocaleString()} bars`);
    if (s.startBalance) parts.push(`$${Number(s.startBalance).toLocaleString()}`);
    if (s.sizePct)      parts.push(`${s.sizePct}% size`);
    return parts.join(' · ');
  }

  function row(label, val, color) {
    return `<div class="dc-row"><span>${label}</span><b${color ? ` style="color:${color}"` : ''}>${val}</b></div>`;
  }

  function renderSingleResult(st, full) {
    if (!st) return '';
    const col = st.netUsd >= 0 ? UP : DOWN;
    const pf = st.profitFactor === Infinity ? '∞' : Number(st.profitFactor).toFixed(2);
    let html = (full ? '' : `<div class="dc-section-title">Results</div>`) +
      row('Net P&L', `${fmtMoney(st.netUsd)} (${fmtPct(st.netPct)})`, col) +
      row('Total trades', st.totalTrades) +
      row('Win rate', `${Number(st.winRate).toFixed(1)}%`) +
      row('Profit factor', pf) +
      row('Max drawdown', `${Number(st.maxDrawdown).toFixed(1)}%`, DOWN) +
      row('Sharpe ratio', Number(st.sharpe).toFixed(2)) +
      row('Avg win / loss', `${fmtMoney(st.avgWin)} / ${fmtMoney(st.avgLoss)}`) +
      row('Max consec. W/L', `${st.maxConsecWins} / ${st.maxConsecLosses}`);
    if (full) {
      html +=
        row('Winners / Losers', `${st.winners} / ${st.losers}`) +
        row('Largest win', fmtMoney(st.largestWin), UP) +
        row('Largest loss', fmtMoney(st.largestLoss), DOWN) +
        (st.totalFees != null ? row('Total fees', `$${Number(st.totalFees).toFixed(2)}`) : '') +
        (st.expectancyR != null ? row('Expectancy (R)', `${Number(st.expectancyR).toFixed(3)}R`) : '');
    }
    return html;
  }

  function renderMtfResult(result) {
    if (!result || !result.rows) return '';
    const rows = result.rows.map((r) => {
      if (r.err) return `<tr><td>${r.label}</td><td colspan="5" class="dc-mtf-err">no data</td></tr>`;
      const st = r.st;
      const pf = st.profitFactor === Infinity ? '∞' : Number(st.profitFactor).toFixed(2);
      const col = st.netUsd >= 0 ? UP : DOWN;
      return `<tr><td><b>${r.label}</b></td>` +
        `<td style="color:${col}">${fmtMoney(st.netUsd)}<br><span class="dc-pct">${fmtPct(st.netPct)}</span></td>` +
        `<td>${Number(st.winRate).toFixed(0)}%</td>` +
        `<td>${pf}</td>` +
        `<td>${st.totalTrades}</td>` +
        `<td>${r.bars || '–'}</td></tr>`;
    }).join('');
    const best = result.best
      ? `<div class="dc-mtf-best">Best: <b>${result.best.label}</b> (${fmtMoney(result.best.netUsd)})</div>`
      : '';
    return `<div class="dc-section-title">Multi-Timeframe Results</div>` +
      `<table class="dc-mtf-tbl"><thead><tr>` +
      `<th>TF</th><th>Net P&L</th><th>Win%</th><th>PF</th><th>Trades</th><th>Bars</th>` +
      `</tr></thead><tbody>${rows}</tbody></table>` + best;
  }

  // Pair × timeframe matrix ("Multi TF + Pairs"). Re-draws the saved heatmap grid and
  // the "Where it works" summary using the shared renderer exposed by StrategyMode
  // (window.MatrixView), so a saved run looks just like it did in the Strategy modal.
  function renderMatrixResult(run) {
    const result = run.result || {};
    const MV = window.MatrixView || {};
    const grid = MV.gridHtml ? MV.gridHtml(result) : '';
    const summary = MV.summaryHtml ? MV.summaryHtml(result.summary, run.strategy_label) : '';
    const pairs = result.pairs || [];
    const tfs = result.tfs || [];
    const win = result.window;
    const sub = `${pairs.length} pair${pairs.length === 1 ? '' : 's'} × ${tfs.length} timeframe${tfs.length === 1 ? '' : 's'}` +
      (win ? ` · window: last ${win.num} ${win.unit}` : '');
    return `<div class="dc-section-title">Pair × Timeframe Matrix</div>` +
      `<div class="dc-matrix-sub">${sub}</div>` +
      (grid || `<div class="dc-mtf-err">grid data unavailable</div>`) +
      summary;
  }

  function renderParams(params, settings) {
    const parts = [];
    for (const [k, v] of Object.entries(params || {})) {
      parts.push(`<span class="dc-param"><b>${k}</b> ${v}</span>`);
    }
    if (settings) {
      if (settings.startBalance != null)  parts.push(`<span class="dc-param"><b>capital</b> $${Number(settings.startBalance).toLocaleString()}</span>`);
      if (settings.sizePct != null)       parts.push(`<span class="dc-param"><b>size</b> ${settings.sizePct}%</span>`);
      if (settings.commissionPct != null) parts.push(`<span class="dc-param"><b>comm</b> ${settings.commissionPct}%</span>`);
      if (settings.slippagePct != null)   parts.push(`<span class="dc-param"><b>slip</b> ${settings.slippagePct}%</span>`);
    }
    return parts.join('');
  }

  function buildCard(run) {
    const kindBadge = run.kind === 'matrix'
      ? `<span class="dc-badge dc-badge-matrix">MATRIX</span>`
      : run.kind === 'mtf'
        ? `<span class="dc-badge dc-badge-mtf">MTF</span>`
        : `<span class="dc-badge dc-badge-single">Single</span>`;

    const resultHtml = run.kind === 'matrix'
      ? renderMatrixResult(run)
      : run.kind === 'mtf'
        ? renderMtfResult(run.result)
        : renderSingleResult(run.result);

    const card = document.createElement('div');
    card.className = 'data-card';
    card.dataset.id = run.id;
    card.innerHTML =
      `<div class="dc-header">` +
        `<div class="dc-header-left">` +
          `<span class="dc-strategy">${run.strategy_label}</span>` +
          `<span class="dc-sym">${run.symbol}</span>` +
          `<span class="dc-tf">${run.interval}</span>` +
          kindBadge +
        `</div>` +
        `<div class="dc-header-right">` +
          `<span class="dc-date">${fmtDate(run.created_at)}</span>` +
          `<button class="dc-open" title="Open details">Open <i class="fas fa-arrow-right"></i></button>` +
          `<button class="dc-del" title="Delete this run"><i class="fas fa-trash"></i></button>` +
        `</div>` +
      `</div>` +
      `<div class="dc-inputs">` +
        `<div class="dc-section-title">Inputs</div>` +
        `<div class="dc-params">${renderParams(run.params, run.settings)}</div>` +
        `<div class="dc-maxc">Max candles: <b>${run.max_candles.toLocaleString()}</b></div>` +
        (periodLine(run) ? `<div class="dc-period">${periodLine(run)}</div>` : '') +
      `</div>` +
      `<div class="dc-result">${resultHtml}</div>`;

    card.querySelector('.dc-open').onclick = (e) => { e.stopPropagation(); openDetail(run); };
    card.querySelector('.dc-del').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this saved run?')) return;
      const ok = await DataStore.deleteRun(run.id);
      if (ok) { compareSel = compareSel.filter((id) => id !== run.id); card.remove(); updateCompareHint(); }
    };
    // Click anywhere on the card body (not the buttons) opens the detail view —
    // unless we're in compare mode, where a click toggles the run's selection.
    card.addEventListener('click', (e) => {
      if (e.target.closest('.dc-del') || e.target.closest('.dc-open')) return;
      if (compareMode) { toggleCompareSelect(run.id, card); return; }
      openDetail(run);
    });

    return card;
  }

  async function refresh() {
    const grid = document.getElementById('dataGrid');
    if (!grid) return;
    grid.innerHTML = `<div class="dc-loading">Loading saved runs…</div>`;
    const runs = await DataStore.listRuns();
    currentRuns = runs || [];
    grid.innerHTML = '';
    if (!currentRuns.length) {
      grid.innerHTML = `<div class="dc-empty">No saved runs yet. Run a backtest and hit <b>Save to Data</b>.</div>`;
      return;
    }
    currentRuns.forEach((r) => grid.appendChild(buildCard(r)));
    applyCompareUI();
  }

  // ── Compare-mode controller ──────────────────────────────────────────────────────────
  function setCompareMode(on) {
    compareMode = on;
    compareSel = [];
    document.body.classList.toggle('compare-mode', on);
    const bar = document.getElementById('dataCompareBar');
    if (bar) bar.style.display = on ? 'flex' : 'none';
    const btn = document.getElementById('dataCompareBtn');
    if (btn) btn.classList.toggle('active', on);
    applyCompareUI();
  }

  function toggleCompareSelect(id, card) {
    const i = compareSel.indexOf(id);
    if (i >= 0) compareSel.splice(i, 1);
    else {
      if (compareSel.length >= 2) {
        // keep the most-recent two: drop the oldest selection
        const dropped = compareSel.shift();
        const dc = document.querySelector(`.data-card[data-id="${dropped}"]`);
        if (dc) dc.classList.remove('dc-selected');
      }
      compareSel.push(id);
    }
    card.classList.toggle('dc-selected', compareSel.includes(id));
    updateCompareHint();
  }

  function updateCompareHint() {
    const hint = document.getElementById('dataCompareHint');
    const go = document.getElementById('dataCompareGo');
    if (hint) hint.textContent = compareSel.length === 0
      ? 'Pick 2 saved runs to compare'
      : `${compareSel.length}/2 selected`;
    if (go) go.disabled = compareSel.length !== 2;
  }

  // Re-sync card visuals to the current selection (after a refresh).
  function applyCompareUI() {
    document.querySelectorAll('.data-card').forEach((c) => {
      c.classList.toggle('dc-selected', compareMode && compareSel.includes(c.dataset.id));
    });
    updateCompareHint();
  }

  // ── Comparison modal ─────────────────────────────────────────────────────────────────
  function buildCompareModal() {
    if (compareOverlay) return;
    compareOverlay = document.createElement('div');
    compareOverlay.className = 'dc-detail-overlay dc-compare-overlay';
    compareOverlay.style.display = 'none';
    compareOverlay.innerHTML =
      `<div class="dc-detail-modal dc-compare-modal">` +
        `<div class="dc-detail-head">` +
          `<div class="dc-compare-title"><i class="fas fa-scale-balanced"></i> Compare runs</div>` +
          `<button class="dc-detail-close" title="Close"><i class="fas fa-xmark"></i></button>` +
        `</div>` +
        `<div class="dc-compare-body"></div>` +
      `</div>`;
    document.body.appendChild(compareOverlay);
    compareOverlay.querySelector('.dc-detail-close').onclick = () => { compareOverlay.style.display = 'none'; };
    compareOverlay.addEventListener('click', (e) => { if (e.target === compareOverlay) compareOverlay.style.display = 'none'; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && compareOverlay.style.display !== 'none') compareOverlay.style.display = 'none'; });
  }

  function openCompare() {
    if (compareSel.length !== 2) return;
    const A = currentRuns.find((r) => r.id === compareSel[0]);
    const B = currentRuns.find((r) => r.id === compareSel[1]);
    if (!A || !B) return;
    buildCompareModal();
    compareOverlay.querySelector('.dc-compare-body').innerHTML = renderComparison(A, B);
    compareOverlay.style.display = 'grid';
  }

  // Side-by-side scorecard + per-dimension breakdown of which run is more profitable.
  function renderComparison(A, B) {
    const aggA = runAggregate(A), aggB = runAggregate(B);
    const id = (run) => `${run.strategy_label} · ${run.symbol} · ${run.kind.toUpperCase()}`;

    // Header columns
    const col = (run, agg, side) =>
      `<div class="dccmp-col dccmp-${side}">` +
        `<div class="dccmp-tag">${side === 'a' ? 'A' : 'B'}</div>` +
        `<div class="dccmp-name">${run.strategy_label}</div>` +
        `<div class="dccmp-meta">${run.symbol} · ${run.kind.toUpperCase()} · ${fmtDate(run.created_at)}</div>` +
        `<div class="dccmp-meta">${agg.count} cell${agg.count === 1 ? '' : 's'}${periodLine(run) ? ' · ' + periodLine(run) : ''}</div>` +
      `</div>`;

    // Scorecard rows. `better`: +1 → A wins, -1 → B wins, 0 → tie/neutral.
    const rows = [
      { label: 'Avg net %', a: aggA.avgPct, b: aggB.avgPct, fmt: (v) => fmtPct(v), hi: 1 },
      { label: 'Total net P&L', a: aggA.totalNet, b: aggB.totalNet, fmt: (v) => fmtMoney(v), hi: 1 },
      { label: 'Avg expectancy R', a: aggA.avgExpR, b: aggB.avgExpR, fmt: (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`, hi: 1 },
      { label: 'Avg profit factor', a: aggA.avgPF, b: aggB.avgPF, fmt: (v) => v.toFixed(2), hi: 1 },
      { label: 'Avg win rate', a: aggA.avgWin, b: aggB.avgWin, fmt: (v) => `${v.toFixed(1)}%`, hi: 1 },
      { label: 'Positive cells', a: aggA.posShare, b: aggB.posShare, fmt: (v) => `${Math.round(v * 100)}%`, hi: 1 },
      { label: 'Total trades', a: aggA.totalTrades, b: aggB.totalTrades, fmt: (v) => String(v), hi: 0 },
    ];
    const scoreRows = rows.map((r) => {
      const av = r.a, bv = r.b;
      let aWin = false, bWin = false;
      if (r.hi && av != null && bv != null && av !== bv) { aWin = av > bv; bWin = bv > av; }
      return `<tr>` +
        `<td class="dccmp-rl">${r.label}</td>` +
        `<td class="dccmp-rv${aWin ? ' dccmp-win' : ''}">${r.fmt(av)}</td>` +
        `<td class="dccmp-rv${bWin ? ' dccmp-win' : ''}">${r.fmt(bv)}</td>` +
      `</tr>`;
    }).join('');

    // Verdict — lead with net % (capital-independent), note caveats.
    const caveats = [];
    const sA = A.settings || {}, sB = B.settings || {};
    if (sA.startBalance !== sB.startBalance || sA.sizePct !== sB.sizePct)
      caveats.push('different capital/size — compare on <b>net %</b>, not $');
    if ((sA.commissionPct !== sB.commissionPct) || (sA.slippagePct !== sB.slippagePct))
      caveats.push('different fees/slippage');
    let verdict, vcls;
    if (Math.abs(aggA.avgPct - aggB.avgPct) < 0.01) { verdict = 'Too close to call on average return.'; vcls = 'warn'; }
    else if (aggA.avgPct > aggB.avgPct) { verdict = `<b>A · ${id(A)}</b> is more profitable on average (${fmtPct(aggA.avgPct)} vs ${fmtPct(aggB.avgPct)}).`; vcls = 'good'; }
    else { verdict = `<b>B · ${id(B)}</b> is more profitable on average (${fmtPct(aggB.avgPct)} vs ${fmtPct(aggA.avgPct)}).`; vcls = 'good'; }

    // Overlap breakdown — dimensions present in BOTH runs.
    const mapB = new Map(aggB.cells.map((c) => [c.key, c]));
    const overlap = aggA.cells.filter((c) => mapB.has(c.key))
      .map((c) => ({ dim: c.dim, a: c.st.netPct, b: mapB.get(c.key).st.netPct }))
      .sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b));
    let aWins = 0, bWins = 0;
    const ovRows = overlap.map((o) => {
      const aw = o.a > o.b, bw = o.b > o.a;
      if (aw) aWins++; else if (bw) bWins++;
      return `<tr>` +
        `<td class="dccmp-rl">${o.dim}</td>` +
        `<td class="dccmp-rv${aw ? ' dccmp-win' : ''}">${fmtPct(o.a)}</td>` +
        `<td class="dccmp-rv${bw ? ' dccmp-win' : ''}">${fmtPct(o.b)}</td>` +
        `<td class="dccmp-rv">${(o.a - o.b) >= 0 ? '+' : ''}${(o.a - o.b).toFixed(1)}%</td>` +
      `</tr>`;
    }).join('');
    const overlapBlock = overlap.length
      ? `<div class="dc-section-title">Head-to-head on shared setups (${overlap.length})</div>` +
        `<div class="dccmp-winline">A wins <b>${aWins}</b> · B wins <b>${bWins}</b>${aWins + bWins < overlap.length ? ` · ${overlap.length - aWins - bWins} tie` : ''}</div>` +
        `<table class="dccmp-table"><thead><tr><th>Setup</th><th>A net%</th><th>B net%</th><th>Δ</th></tr></thead><tbody>${ovRows}</tbody></table>`
      : `<div class="dccmp-noov">No shared pair×timeframe setups to line up directly — compare the scorecard above.</div>`;

    return `<div class="dccmp-cols">${col(A, aggA, 'a')}${col(B, aggB, 'b')}</div>` +
      `<div class="sg-mtf-ai-verdict sg-ai-${vcls}" style="margin:4px 0 10px"><span class="sg-mtf-ai-badge">Verdict</span><span>${verdict}</span></div>` +
      (caveats.length ? `<div class="dccmp-caveat"><i class="fas fa-circle-info"></i> Note: ${caveats.join('; ')}.</div>` : '') +
      `<table class="dccmp-table dccmp-score"><thead><tr><th>Metric</th><th>A</th><th>B</th></tr></thead><tbody>${scoreRows}</tbody></table>` +
      overlapBlock;
  }

  function wireCompareUI() {
    const btn = document.getElementById('dataCompareBtn');
    const go = document.getElementById('dataCompareGo');
    const cancel = document.getElementById('dataCompareCancel');
    if (btn) btn.onclick = () => setCompareMode(!compareMode);
    if (go) go.onclick = openCompare;
    if (cancel) cancel.onclick = () => setCompareMode(false);
  }

  // Called from index.html nav: show the data page and refresh.
  function show() {
    document.body.classList.add('data-mode');
    setCompareMode(false);
    refresh();
  }

  function hide() {
    document.body.classList.remove('data-mode');
  }

  wireCompareUI();

  return { show, hide, refresh };
})();
