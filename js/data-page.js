// data-page.js — "Data" page: displays + manages saved backtest cards.

const DataPage = (() => {
  const UP = '#26a69a', DOWN = '#ef5350';

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

  function row(label, val, color) {
    return `<div class="dc-row"><span>${label}</span><b${color ? ` style="color:${color}"` : ''}>${val}</b></div>`;
  }

  function renderSingleResult(st) {
    if (!st) return '';
    const col = st.netUsd >= 0 ? UP : DOWN;
    const pf = st.profitFactor === Infinity ? '∞' : Number(st.profitFactor).toFixed(2);
    return `<div class="dc-section-title">Results</div>` +
      row('Net P&L', `${fmtMoney(st.netUsd)} (${fmtPct(st.netPct)})`, col) +
      row('Total trades', st.totalTrades) +
      row('Win rate', `${Number(st.winRate).toFixed(1)}%`) +
      row('Profit factor', pf) +
      row('Max drawdown', `${Number(st.maxDrawdown).toFixed(1)}%`, DOWN) +
      row('Sharpe ratio', Number(st.sharpe).toFixed(2)) +
      row('Avg win / loss', `${fmtMoney(st.avgWin)} / ${fmtMoney(st.avgLoss)}`) +
      row('Max consec. W/L', `${st.maxConsecWins} / ${st.maxConsecLosses}`);
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

  function renderParams(params, settings) {
    const parts = [];
    for (const [k, v] of Object.entries(params || {})) {
      parts.push(`<span class="dc-param"><b>${k}</b> ${v}</span>`);
    }
    if (settings) {
      if (settings.sizePct != null)       parts.push(`<span class="dc-param"><b>size</b> ${settings.sizePct}%</span>`);
      if (settings.commissionPct != null) parts.push(`<span class="dc-param"><b>comm</b> ${settings.commissionPct}%</span>`);
      if (settings.slippagePct != null)   parts.push(`<span class="dc-param"><b>slip</b> ${settings.slippagePct}%</span>`);
    }
    return parts.join('');
  }

  function buildCard(run) {
    const kindBadge = run.kind === 'mtf'
      ? `<span class="dc-badge dc-badge-mtf">MTF</span>`
      : `<span class="dc-badge dc-badge-single">Single</span>`;

    const resultHtml = run.kind === 'mtf'
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
          `<button class="dc-del" title="Delete this run"><i class="fas fa-trash"></i></button>` +
        `</div>` +
      `</div>` +
      `<div class="dc-inputs">` +
        `<div class="dc-section-title">Inputs</div>` +
        `<div class="dc-params">${renderParams(run.params, run.settings)}</div>` +
        `<div class="dc-maxc">Max candles: <b>${run.max_candles.toLocaleString()}</b></div>` +
      `</div>` +
      `<div class="dc-result">${resultHtml}</div>`;

    card.querySelector('.dc-del').onclick = async () => {
      if (!confirm('Delete this saved run?')) return;
      const ok = await DataStore.deleteRun(run.id);
      if (ok) card.remove();
    };

    return card;
  }

  async function refresh() {
    const grid = document.getElementById('dataGrid');
    if (!grid) return;
    grid.innerHTML = `<div class="dc-loading">Loading saved runs…</div>`;
    const runs = await DataStore.listRuns();
    grid.innerHTML = '';
    if (!runs.length) {
      grid.innerHTML = `<div class="dc-empty">No saved runs yet. Run a backtest and hit <b>Save to Data</b>.</div>`;
      return;
    }
    runs.forEach((r) => grid.appendChild(buildCard(r)));
  }

  // Called from index.html nav: show the data page and refresh.
  function show() {
    document.body.classList.add('data-mode');
    refresh();
  }

  function hide() {
    document.body.classList.remove('data-mode');
  }

  return { show, hide, refresh };
})();
