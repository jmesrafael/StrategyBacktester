// build-ledger-report.js — writes the ledger report "Live Pair vs Three-Bot Mix" as one static HTML file (inline SVG, no scripts).
//   node build-ledger-report.js <out.html>
// Inputs: dash/*.json from export-dash.js (which reads pesos-out.json / pesos-risk.json from pesos.js).
'use strict';
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'live-pair-vs-three-bot.html';
const J = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, 'dash', f), 'utf8'));
const P = J('portfolios.json'), Y = J('years.json'), M = J('months.json'), RK = J('risk-levels.json'), WF = J('walk-forward.json'), WS = J('walk-summary.json')[0];
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'pesos-out.json'), 'utf8'));
const by = Object.fromEntries(P.map((p) => [p.id, p]));
const L = by.live, S = by.three, B = by.bbc, I = by.ic;
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const C = { live: '#1d4ed8', three: '#0f766e', bbc: '#94a3b8', ic: '#c2410c' };
const SHORT = { live: 'Live now', three: 'Suggested', bbc: 'bb-core alone', ic: 'I-Core alone', 'bbc-ic73': 'bb-core + I-Core 70/30', 'bbc-tr55': 'bb-core + bb-trail 50/50', 'bbc-tr73': 'bb-core + bb-trail 70/30', 'bbc-fr55': 'bb-core + fractal 50/50', 'bbc-h73': 'bb-core + hold-192 70/30', 'bbc-1h': 'bb-core 4h + 1h 50/50', three1h: 'bb-core 4h + 1h + I-Core' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const peso = (v) => (v < 0 ? '−' : '') + '₱' + Math.abs(Math.round(v)).toLocaleString('en-US');
const pesoK = (v) => { const a = Math.abs(v); const s = a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k' : Math.round(a); return (v < 0 ? '−' : '') + '₱' + s; };
const sR = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + 'R';
const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';
const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat');
const ymOf = (id) => M.filter((m) => m.id === id);

// ---------- charts ----------
function equityChart() {
  const W = 760, H = 300, m = { t: 14, r: 120, b: 26, l: 46 };
  const ids = ['bbc', 'live', 'three'], ser = ids.map((id) => ymOf(id)), n = ser[0].length;
  const ymax = Math.max(...ser.flat().map((s) => s.cum_R)), yTop = Math.ceil(ymax / 100) * 100;
  const x = (i) => m.l + (i / (n - 1)) * (W - m.l - m.r), y = (v) => m.t + (1 - v / yTop) * (H - m.t - m.b);
  let g = '';
  ser[0].forEach((s, i) => { if (s.market === 'sideways') return; const x0 = x(Math.max(0, i - 0.5)), x1 = x(Math.min(n - 1, i + 0.5)); g += `<rect x="${x0.toFixed(1)}" y="${m.t}" width="${(x1 - x0).toFixed(1)}" height="${H - m.t - m.b}" fill="${s.market === 'bear' ? '#fecaca' : '#bbf7d0'}" opacity=".55"/>`; });
  for (let v = 0; v <= yTop; v += 100) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/><text class="ax" x="${m.l - 6}" y="${y(v) + 3}" text-anchor="end">${v}R</text>`;
  ser[0].forEach((s, i) => { if (s.month.endsWith('-01')) g += `<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${s.month.slice(0, 4)}</text><line x1="${x(i)}" x2="${x(i)}" y1="${H - m.b}" y2="${H - m.b + 4}" stroke="#94a3b8"/>`; });
  const ends = [];
  ids.forEach((id, k) => {
    const d = ser[k].map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.cum_R).toFixed(1)}`).join('');
    g += `<path d="${d}" fill="none" stroke="${C[id]}" stroke-width="${id === 'bbc' ? 1.6 : 2.4}" ${id === 'bbc' ? 'stroke-dasharray="4 3"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
    ends.push({ id, v: ser[k][n - 1].cum_R });
  });
  ends.sort((a, b) => b.v - a.v); let last = -1e9;
  for (const e of ends) { let yy = y(e.v); if (yy - last < 26) yy = last + 26; last = yy; g += `<circle cx="${x(n - 1)}" cy="${y(e.v)}" r="3.5" fill="${C[e.id]}"/><text class="lbl" x="${x(n - 1) + 8}" y="${yy}" fill="${C[e.id]}">${SHORT[e.id]}</text><text class="tiny" x="${x(n - 1) + 8}" y="${yy + 12}">${sR(e.v, 0)}</text>`; }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cumulative R by month">${g}</svg>`;
}
function yearBars() {
  const W = 760, H = 250, m = { t: 18, r: 10, b: 28, l: 52 }, ids = ['live', 'three'];
  const vals = YEARS.map((yr) => ids.map((id) => Y.find((r) => r.id === id && r.year === yr).php));
  const top = Math.ceil(Math.max(...vals.flat()) / 20000) * 20000;
  const gw = (W - m.l - m.r) / YEARS.length, bw = Math.min(30, gw / 3.2), y = (v) => m.t + (1 - v / top) * (H - m.t - m.b);
  let g = ''; for (let v = 0; v <= top; v += 20000) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/><text class="ax" x="${m.l - 6}" y="${y(v) + 3}" text-anchor="end">${pesoK(v)}</text>`;
  YEARS.forEach((yr, i) => {
    const cx = m.l + gw * (i + 0.5);
    ids.forEach((id, k) => { const v = vals[i][k], x0 = cx + (k - 1) * (bw + 3) + 1.5; g += `<rect x="${x0}" y="${y(Math.max(0, v))}" width="${bw}" height="${Math.abs(y(v) - y(0))}" rx="3" fill="${C[id]}"/><text class="tiny" x="${x0 + bw / 2}" y="${y(Math.max(0, v)) - 4}" text-anchor="middle">${pesoK(v)}</text>`; });
    g += `<text class="ax b" x="${cx}" y="${H - 9}" text-anchor="middle">${yr}${yr === 2020 || yr === 2026 ? '*' : ''}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Pesos made each year">${g}</svg>`;
}
function regimeBars() {
  const ids = ['bbc', 'ic', 'live', 'three'], regs = [['bear', 'Falling months', 'bear_month_avg_R'], ['sideways', 'Sideways months', 'sideways_month_avg_R'], ['bull', 'Rising months', 'bull_month_avg_R']];
  const cnt = Object.fromEntries(regs.map(([r]) => [r, ymOf('live').filter((m) => m.market === r).length]));
  const W = 760, H = 240, m = { t: 20, r: 10, b: 40, l: 40 }, top = 16, bot = -2;
  const gw = (W - m.l - m.r) / 3, bw = Math.min(34, gw / 6), y = (v) => m.t + ((top - v) / (top - bot)) * (H - m.t - m.b);
  let g = ''; for (let v = 0; v <= top; v += 4) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="${v ? '#e2e8f0' : '#94a3b8'}"/><text class="ax" x="${m.l - 6}" y="${y(v) + 3}" text-anchor="end">${v}R</text>`;
  regs.forEach(([r, name, f], i) => {
    const cx = m.l + gw * (i + 0.5);
    ids.forEach((id, k) => { const v = by[id][f], x0 = cx + (k - 2) * (bw + 4) + 2; g += `<rect x="${x0}" y="${y(Math.max(0, v))}" width="${bw}" height="${Math.max(1, Math.abs(y(v) - y(0)))}" rx="3" fill="${C[id]}"/><text class="tiny" x="${x0 + bw / 2}" y="${v >= 0 ? y(v) - 4 : y(v) + 11}" text-anchor="middle">${v.toFixed(1)}</text>`; });
    g += `<text class="ax b" x="${cx}" y="${H - 22}" text-anchor="middle">${name}</text><text class="ax" x="${cx}" y="${H - 9}" text-anchor="middle">${cnt[r]} months</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Average R per month by market condition">${g}</svg>`;
}
function calendar(id) {
  const rows = ymOf(id), map = Object.fromEntries(rows.map((r) => [r.month, r])), first = rows[0].month;
  const max = Math.max(...rows.map((r) => Math.abs(r.R)));
  const shade = (v) => { const a = Math.min(1, Math.abs(v) / (max * 0.6)); return v > 0 ? `rgba(21,128,61,${(0.12 + a * 0.75).toFixed(2)})` : v < 0 ? `rgba(220,38,38,${(0.12 + a * 0.75).toFixed(2)})` : '#f1f5f9'; };
  let h = `<table class="cal"><tr><th></th>${MON.map((m) => `<th>${m}</th>`).join('')}<th>Year</th></tr>`;
  for (const yr of YEARS) {
    h += `<tr><td class="yr">${yr}</td>`;
    for (let mi = 1; mi <= 12; mi++) {
      const k = `${yr}-${String(mi).padStart(2, '0')}`, r = map[k];
      if (!r || k < first) { h += '<td class="na"></td>'; continue; }
      const strong = Math.abs(r.R) > max * 0.35;
      h += `<td style="background:${shade(r.R)};${strong ? 'color:#fff;' : ''}" title="${k}: ${sR(r.R)} = ${peso(r.php)} (${r.market})">${Math.round(r.R)}</td>`;
    }
    const yR = Y.find((r) => r.id === id && r.year === yr).R;
    h += `<td class="tot ${cls(yR)}">${sR(yR, 0)}</td></tr>`;
  }
  return h + '</table>';
}

// ---------- tables ----------
function scoreTable() {
  const cols = [
    ['php_avg_per_year', 'Avg / year', peso, 1], ['php_worst_year', 'Worst year', peso, 1], ['max_dd_pct', 'Worst drop', (v) => '−' + pct(v), -1],
    ['return_to_dd', 'Return ÷ drop', (v) => v.toFixed(1), 1], ['from_2023_rdd', 'Return ÷ drop since 2023', (v) => v.toFixed(1), 1], ['without_best10_R', 'Without best 10', (v) => sR(v, 0), 1],
    ['pos_month_share', 'Green months', (v) => pct(v), 1], ['worst_month_R', 'Worst month', (v) => sR(v), 1], ['sideways_month_avg_R', 'Sideways months', (v) => sR(v, 2), 1],
    ['mc_p_dd_over_30pct', 'Chance of a 30% drop', (v) => pct(v), -1], ['mc_p_losing_year', 'Chance of a red year', (v) => pct(v, 1), -1],
  ];
  const order = [...P].sort((a, b) => b.from_2023_rdd - a.from_2023_rdd);
  const best = Object.fromEntries(cols.map(([f, , , d]) => [f, d > 0 ? Math.max(...P.map((p) => p[f])) : Math.min(...P.map((p) => p[f]))]));
  let h = `<table class="score"><tr><th>Portfolio (₱10,000 split as shown)</th>${cols.map((c) => `<th>${c[1]}</th>`).join('')}</tr>`;
  for (const p of order) h += `<tr class="${p.id === 'live' ? 'hl-live' : p.id === 'three' ? 'hl-sug' : ''}"><td>${esc(p.portfolio)}</td>${cols.map(([f, , fm]) => `<td class="${p[f] === best[f] ? 'best' : ''}">${fm(p[f])}</td>`).join('')}</tr>`;
  return h + '</table>';
}
function riskTable() {
  const rows = (id) => RK.filter((r) => r.id === id);
  let h = '<table><tr><th>Risk per trade</th><th>Live now: avg / year</th><th>worst year</th><th>worst drop</th><th>Suggested: avg / year</th><th>worst year</th><th>worst drop</th></tr>';
  for (const r of rows('live')) { const s = rows('three').find((x) => x.risk_pct === r.risk_pct); h += `<tr${r.risk_pct === 0.01 ? ' class="hl-sug"' : ''}><td>${pct(r.risk_pct, 1)} of the bot's balance</td><td>${peso(r.php_avg_per_year)}</td><td>${peso(r.php_worst_year)}</td><td class="neg">−${pct(r.max_dd_pct)}</td><td>${peso(s.php_avg_per_year)}</td><td>${peso(s.php_worst_year)}</td><td class="neg">−${pct(s.max_dd_pct)}</td></tr>`; }
  return h + '</table>';
}
function yearTable() {
  const ids = ['live', 'three', 'bbc', 'ic'];
  let h = `<table><tr><th>Year</th>${ids.map((id) => `<th style="color:${C[id]}">${SHORT[id]}</th>`).join('')}<th>Market that year</th></tr>`;
  const mk = (yr) => { const ms = ymOf('live').filter((m) => m.month.startsWith(yr + '')); const c = { bull: 0, bear: 0, sideways: 0 }; ms.forEach((m) => c[m.market]++); return `${c.bull} up · ${c.sideways} flat · ${c.bear} down`; };
  for (const yr of YEARS) h += `<tr><td>${yr}${yr === 2020 || yr === 2026 ? '*' : ''}</td>${ids.map((id) => { const v = Y.find((r) => r.id === id && r.year === yr).php; return `<td class="${cls(v)}">${peso(v)}</td>`; }).join('')}<td class="flat">${mk(yr)}</td></tr>`;
  h += `<tr class="tot"><td>Average</td>${ids.map((id) => `<td>${peso(by[id].php_avg_per_year)}</td>`).join('')}<td></td></tr>`;
  return h + '</table>';
}
function checks() {
  const ok = '<span class="chk ok">✓</span>', mid = '<span class="chk mid">~</span>';
  const rows = [
    ['Enough trades to trust it', 'Law of large numbers: hundreds of trades, not ten.', `${L.trades.toLocaleString()} trades`, `${S.trades.toLocaleString()} trades`, ok, ok],
    ['Positive expected value per trade', 'EV after fees, slippage and funding.', sR(L.ev_per_trade_R, 2), sR(S.ev_per_trade_R, 2), ok, ok],
    ['Profitable every calendar year', 'Fresh ₱10,000 each 1 January.', `${L.pos_years} of 7`, `${S.pos_years} of 7`, ok, ok],
    ['Green months', 'Months that ended with a profit.', `${L.pos_months} of ${L.months} (${pct(L.pos_month_share)})`, `${S.pos_months} of ${S.months} (${pct(S.pos_month_share)})`, ok, ok],
    ['Not built on a few lucky trades', 'Total with the 10 best trades taken out.', sR(L.without_best10_R, 0), sR(S.without_best10_R, 0), ok, ok],
    ['Holds up on data it was not picked on', 'Return ÷ drop, 2020–2022 vs 2023 onward.', `${L.before_2023_rdd} → ${L.from_2023_rdd}`, `${S.before_2023_rdd} → ${S.from_2023_rdd}`, ok, ok],
    ['Bots are truly different', 'Monthly correlation with bb-core (0 = independent).', `I-Core ${by['bbc-ic73'].monthly_corr_first_two.toFixed(2)}`, `I-Core ${by['bbc-ic73'].monthly_corr_first_two.toFixed(2)}, bb-trail ${by['bbc-tr73'].monthly_corr_first_two.toFixed(2)}`, ok, ok],
    ['Worst drop and the gain to recover it', 'A 30% drop needs a 43% gain to get back.', `−${pct(L.max_dd_pct)} → needs +${pct(L.recover_needed_pct)}`, `−${pct(S.max_dd_pct)} → needs +${pct(S.recover_needed_pct)}`, mid, mid],
    ['Monte Carlo: bad-luck drop (95th pct)', '5,000 reshuffled 7-year paths at 2% risk per trade.', `−${pct(L.mc_dd95_pct)} (${L.mc_dd95_R.toFixed(0)}R)`, `−${pct(S.mc_dd95_pct)} (${S.mc_dd95_R.toFixed(0)}R)`, mid, mid],
    ['Monte Carlo: chance of a drop over 30%', 'Same 5,000 paths.', pct(L.mc_p_dd_over_30pct), pct(S.mc_p_dd_over_30pct), mid, ok],
    ['Monte Carlo: chance of any red year', 'Same 5,000 paths.', pct(L.mc_p_losing_year, 1), pct(S.mc_p_losing_year, 1), ok, ok],
    ['Sharpe ratio (monthly, yearly basis)', 'Return per unit of swing.', L.sharpe.toFixed(2), S.sharpe.toFixed(2), ok, ok],
    ['Longest wait for a new high', 'Months in a row below the last peak.', `${L.longest_no_new_high_months} months`, `${S.longest_no_new_high_months} months`, ok, ok],
  ];
  let h = '<table class="checks"><tr><th>Check (from the trading-math notes)</th><th>Live now</th><th>Suggested</th></tr>';
  for (const [t, d, a, b, ca, cb] of rows) h += `<tr><td><b>${t}</b><div class="d">${d}</div></td><td>${ca} ${a}</td><td>${cb} ${b}</td></tr>`;
  return h + '</table>';
}
function walkTable() {
  let h = '<table><tr><th>Mix</th><th>Return ÷ drop 2020–2022</th><th>Return ÷ drop 2023 →</th><th>R made 2023 →</th></tr>';
  for (const r of WF) h += `<tr><td>${esc(r.row)}</td><td>${r.before_2023_rdd}</td><td>${r.from_2023_rdd}</td><td>${sR(r.from_2023_R, 0)}</td></tr>`;
  h += `<tr class="hl-sug"><td>Suggested: bb-core + I-Core + bb-trail P14 (50/25/25)</td><td>${S.before_2023_rdd}</td><td>${S.from_2023_rdd}</td><td>${sR(S.from_2023_R, 0)}</td></tr>`;
  return h + '</table>';
}

// ---------- page ----------
const kpi = (k, a, b, better) => `<div class="cmp"><div class="k">${k}</div><div class="row"><div><span class="dot" style="background:${C.live}"></span><span class="v">${a}</span></div><div><span class="dot" style="background:${C.three}"></span><span class="v ${better ? 'up' : ''}">${b}</span></div></div></div>`;
const foot = (n) => `<div class="foot"><span>Lucid'io · Live pair vs three-bot mix · Nov 6, 2026</span><span>A test on past prices, not a promise · page ${n}</span></div>`;
const regCount = (r) => ymOf('live').filter((m) => m.market === r).length;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="robots" content="noindex, nofollow, noarchive">
<title>Live Pair vs Three-Bot Mix · Lucid'io</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; min-height: 297mm; padding: 16mm 15mm 18mm; position: relative; page-break-after: always; overflow: hidden; background: #fff; }
.page:last-child { page-break-after: auto; }
.foot { position: absolute; bottom: 8mm; left: 15mm; right: 15mm; font-size: 8.5px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; gap: 10px; }
h1 { font-size: 34px; margin: 0 0 6px; letter-spacing: -0.5px; line-height: 1.1; text-wrap: balance; }
h2 { font-size: 21px; margin: 0 0 4px; text-wrap: balance; }
h3 { font-size: 14px; margin: 16px 0 6px; }
.sub { color: #64748b; font-size: 12.5px; margin: 0 0 14px; line-height: 1.5; }
p, li { font-size: 12px; line-height: 1.6; }
.pos { color: #15803d; } .neg { color: #dc2626; } .flat { color: #64748b; }
.ax { font-size: 10px; fill: #64748b; } .ax.b { font-weight: 700; fill: #0f172a; font-size: 11px; }
.lbl { font-size: 11.5px; font-weight: 700; } .tiny { font-size: 9.5px; fill: #334155; font-variant-numeric: tabular-nums; }
.wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th { text-align: right; font-size: 9.5px; text-transform: uppercase; letter-spacing: .3px; color: #64748b; font-weight: 600; padding: 5px 6px; border-bottom: 1.5px solid #0f172a; vertical-align: bottom; }
td { text-align: right; padding: 4.5px 6px; border-bottom: 1px solid #e2e8f0; font-variant-numeric: tabular-nums; }
th:first-child, td:first-child { text-align: left; }
tr.tot td { font-weight: 700; border-top: 1.5px solid #0f172a; border-bottom: none; }
tr.hl-live td { background: #eff6ff; } tr.hl-sug td { background: #f0fdfa; font-weight: 600; }
td.best { color: #0f766e; font-weight: 700; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
table.score { font-size: 10px; } table.score th { font-size: 8.5px; } table.score td { padding: 4px 5px; }
.card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
.note { background: #f8fafc; border-left: 3px solid #1d4ed8; padding: 9px 12px; border-radius: 6px; font-size: 11.5px; line-height: 1.55; margin: 10px 0; }
.warn { background: #fef2f2; border-left-color: #dc2626; }
.good { background: #f0fdfa; border-left-color: #0f766e; }
.cover-band { background: linear-gradient(135deg, #0f172a 0%, #12355b 55%, #0f766e 120%); color: #fff; margin: -16mm -15mm 18px; padding: 20mm 15mm 14mm; position: relative; }
.cover-band .sub { color: #cbd5e1; max-width: 150mm; }
.cover-band .tag { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #5eead4; margin-bottom: 10px; }
.vs { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: stretch; margin-top: 16px; }
.team { border-radius: 12px; padding: 12px 14px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); }
.team .nm { font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase; } .team .bots { font-size: 15px; font-weight: 700; margin-top: 4px; } .team .split { font-size: 11px; color: #cbd5e1; margin-top: 3px; }
.vs .x { align-self: center; font-size: 22px; font-weight: 800; color: #5eead4; }
.cmps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
.cmp { border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 12px; }
.cmp .k { font-size: 9.5px; color: #64748b; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 5px; }
.cmp .row { display: flex; flex-direction: column; gap: 2px; } .cmp .v { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; } .cmp .v.up { color: #0f766e; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 7px; vertical-align: 2px; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 10.5px; color: #475569; align-items: center; margin: 4px 0 8px; }
.sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 5px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cal { width: 100%; border-collapse: separate; border-spacing: 2px; }
.cal td, .cal th { text-align: center; border: none; padding: 5px 0; font-size: 9.5px; border-radius: 4px; }
.cal th { padding: 2px 0; border-bottom: none; font-size: 8.5px; }
.cal td.yr { text-align: left; font-weight: 700; font-size: 10px; padding-left: 3px; }
.cal td.tot { font-weight: 700; background: #f1f5f9; font-size: 9.5px; } .cal td.na { background: transparent; }
.checks td { vertical-align: top; text-align: left; } .checks td:nth-child(n+2) { white-space: nowrap; } .checks .d { color: #64748b; font-size: 10px; margin-top: 1px; }
.chk { display: inline-flex; width: 16px; height: 16px; border-radius: 50%; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; margin-right: 4px; vertical-align: -3px; }
.chk.ok { background: #ccfbf1; color: #0f766e; } .chk.mid { background: #fef3c7; color: #b45309; }
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0 4px; }
.step { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
.step .n { width: 22px; height: 22px; border-radius: 50%; background: #0f766e; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
.step b { font-size: 12.5px; } .step p { margin: 4px 0 0; font-size: 11px; line-height: 1.5; color: #334155; }
ul.tight { margin: 6px 0; padding-left: 18px; } ul.tight li { margin: 2px 0; }
@media screen {
  html { background: #e2e8f0; }
  body { padding: 32px 0; }
  .page { min-height: 0; max-width: 210mm; width: auto; margin: 0 auto 24px; border-radius: 10px; box-shadow: 0 4px 24px rgba(15,23,42,.12); padding-bottom: 54px; }
  .foot { bottom: 14px; }
  .cover-band { border-radius: 10px 10px 0 0; }
}
@media screen and (max-width: 760px) {
  body { padding: 0; }
  .page { padding: 16px 16px 60px; border-radius: 0; margin: 0 0 8px; }
  .cover-band { margin: -16px -16px 16px; padding: 30px 16px 20px; border-radius: 0; }
  .foot { left: 16px; right: 16px; flex-direction: column; gap: 2px; }
  .two, .steps { grid-template-columns: 1fr; } .cmps { grid-template-columns: 1fr 1fr; }
  .vs { grid-template-columns: 1fr; } .vs .x { justify-self: center; }
  h1 { font-size: 27px; }
}
</style></head><body>

<section class="page">
  <div class="cover-band">
    <div class="tag">Strategy review · 5 coins · 4-hour · 2020 → 5 Nov 2026</div>
    <h1>Live Pair vs Three-Bot Mix</h1>
    <p class="sub">The two bots running on the VPS today, judged with the checks from the trading-math notes, against the most balanced of 11 mixes built from 118 tested strategy variants. Money in Philippine pesos: ₱10,000 to start, split between the bots.</p>
    <div class="vs">
      <div class="team"><div class="nm" style="color:#93c5fd">Live now</div><div class="bots">bb-core + I-Core</div><div class="split">₱5,000 + ₱5,000</div></div>
      <div class="x">vs</div>
      <div class="team"><div class="nm" style="color:#5eead4">Suggested</div><div class="bots">bb-core + I-Core + bb-trail P14</div><div class="split">₱5,000 + ₱2,500 + ₱2,500</div></div>
    </div>
  </div>

  <h2>The answer</h2>
  <p>Your live pair is already a good, honest edge: it made money in <b>all 7 years</b> and in <b>${pct(L.pos_month_share)} of months</b>, and it earns in rising, sideways and falling markets. Nothing tested replaces it. The one change that helps is <b>adding a third bot, bb-trail P14, with a quarter of the money</b>, taken half from I-Core. It catches long trends that the other two exit early, and it moves almost independently of bb-core (correlation ${by['bbc-tr73'].monthly_corr_first_two.toFixed(2)}).</p>

  <div class="legend"><span><span class="sw" style="background:${C.live}"></span>Live now</span><span><span class="sw" style="background:${C.three}"></span>Suggested</span></div>
  <div class="cmps">
    ${kpi('Average a year on ₱10,000', peso(L.php_avg_per_year), peso(S.php_avg_per_year), S.php_avg_per_year > L.php_avg_per_year)}
    ${kpi('Worst drop (closed trades)', '−' + pct(L.max_dd_pct, 1), '−' + pct(S.max_dd_pct, 1), S.max_dd_pct < L.max_dd_pct)}
    ${kpi('Return ÷ worst drop', L.return_to_dd.toFixed(1), S.return_to_dd.toFixed(1), S.return_to_dd > L.return_to_dd)}
    ${kpi('Without the 10 best trades', sR(L.without_best10_R, 0), sR(S.without_best10_R, 0), S.without_best10_R > L.without_best10_R)}
    ${kpi('Same score after 2023?', `${L.before_2023_rdd} → ${L.from_2023_rdd}`, `${S.before_2023_rdd} → ${S.from_2023_rdd}`, S.from_2023_rdd > L.from_2023_rdd)}
    ${kpi('Chance of a 30% drop', pct(L.mc_p_dd_over_30pct), pct(S.mc_p_dd_over_30pct), S.mc_p_dd_over_30pct < L.mc_p_dd_over_30pct)}
  </div>

  <div class="note good"><b>Why the mix is more flexible.</b> bb-core makes small, steady gains and is strongest in sharp falls. I-Core rides medium trends and is the best in sideways months. bb-trail P14 holds a trade for weeks while a big move lasts. Each covers a market the others handle badly, so the bad months of one are often the good months of another. The mix's worst month was ${sR(S.worst_month_R)} against ${sR(L.worst_month_R)} for the live pair.</div>
  <div class="note warn"><b>What it costs.</b> A third bot means a third account, more positions and more margin. In 2022 and 2023 it made less than the live pair (${peso(Y.find((r) => r.id === 'three' && r.year === 2022).php)} and ${peso(Y.find((r) => r.id === 'three' && r.year === 2023).php)} against ${peso(Y.find((r) => r.id === 'live' && r.year === 2022).php)} and ${peso(Y.find((r) => r.id === 'live' && r.year === 2023).php)}), and it was picked after looking at the data. Paper-test it first.</div>
  ${foot(1)}
</section>

<section class="page">
  <h2>Seven years, month by month</h2>
  <p class="sub">Cumulative profit in R (1R = the amount risked on one trade), all bots at the same total risk. Green bands are months the 5 coins rose more than 10% on average, red bands months they fell more than 10%.</p>
  <div class="wrap">${equityChart()}</div>
  <div class="legend"><span><span class="sw" style="background:#bbf7d0"></span>Rising market (${regCount('bull')} months)</span><span><span class="sw" style="background:#fecaca"></span>Falling market (${regCount('bear')} months)</span><span>White: sideways (${regCount('sideways')} months)</span><span><span class="sw" style="background:${C.bbc}"></span>bb-core alone, for reference</span></div>

  <h3>What ₱10,000 made each year</h3>
  <p class="sub" style="margin-bottom:6px">Start every 1 January with a fresh ₱10,000, use the bots' live risk steps (2.5% a trade, 2% above ${peso(500 * raw.PHP_PER_USD)}, 1.5% above ${peso(1000 * raw.PHP_PER_USD)}), take the profit out at year end.</p>
  <div class="wrap">${yearBars()}</div>
  <div class="wrap">${yearTable()}</div>
  <p class="flat" style="font-size:10px;margin-top:6px">* 2020 starts when each coin's data starts (ZEC and ADA Jan/Feb, SOL Sep, NEAR Oct; GALA only from Sep 2021). 2026 runs to 5 November.</p>
  ${foot(2)}
</section>

<section class="page">
  <h2>Every month in colour</h2>
  <p class="sub">R made in each month (number in the box). Green = profit, red = loss, darker = bigger. At the live 2.5% risk on ₱10,000, 1R = ₱250.</p>
  <h3 style="color:${C.live}">Live now: bb-core + I-Core · ${L.pos_months} of ${L.months} months green · worst ${sR(L.worst_month_R)}</h3>
  <div class="wrap">${calendar('live')}</div>
  <h3 style="color:${C.three}">Suggested: + bb-trail P14 · ${S.pos_months} of ${S.months} months green · worst ${sR(S.worst_month_R)}</h3>
  <div class="wrap">${calendar('three')}</div>
  <div class="note">Both have ${L.months - L.pos_months} red months. The difference is at the very bottom: the mix had 1 month worse than −8R, the live pair 3. In between it is mixed, with slightly more −5R to −8R months in the suggested mix. Its longest stretch without a new high was ${S.longest_no_new_high_months} months, against ${L.longest_no_new_high_months} for the live pair.</div>
  ${foot(3)}
</section>

<section class="page">
  <h2>Does it work in any market?</h2>
  <p class="sub">Average R per month, split by what the 5 coins did that month. A strategy with a real edge should not depend on one kind of market.</p>
  <div class="legend">${['bbc', 'ic', 'live', 'three'].map((id) => `<span><span class="sw" style="background:${C[id]}"></span>${SHORT[id]}</span>`).join('')}</div>
  <div class="wrap">${regimeBars()}</div>
  <div class="two">
    <div class="card"><b>bb-core alone loses in sideways markets</b><p style="margin:4px 0 0">${sR(B.sideways_month_avg_R, 2)} a month on average when nothing moves. I-Core earns ${sR(I.sideways_month_avg_R, 2)} in those months, which is why the pair works better than either bot alone.</p></div>
    <div class="card"><b>The mix is positive in all three</b><p style="margin:4px 0 0">Falling ${sR(S.bear_month_avg_R, 2)}, sideways ${sR(S.sideways_month_avg_R, 2)}, rising ${sR(S.bull_month_avg_R, 2)} a month. The live pair: ${sR(L.bear_month_avg_R, 2)}, ${sR(L.sideways_month_avg_R, 2)} and ${sR(L.bull_month_avg_R, 2)}. The mix trades a little sideways and rising income for more income in falling markets.</p></div>
  </div>

  <h3>All 11 mixes tested, best return-for-risk since 2023 first</h3>
  <p class="sub" style="margin-bottom:6px">Each row starts with ₱10,000 split between its bots. Underlined = best in that column. "Since 2023" is the fairer test, because 2023 onward was not used to choose anything.</p>
  <div class="wrap">${scoreTable()}</div>
  <p class="flat" style="font-size:10px;margin-top:6px">The bb-core 4h + 1h mixes make the most pesos but are the same strategy twice (monthly correlation 0.94): one big bet, not two. bb-core + fractal P14 scores highest since 2023 but has an ${pct(by['bbc-fr55'].mc_p_dd_over_30pct)} chance of a 30% drop and a ${pct(by['bbc-fr55'].mc_p_losing_year, 1)} chance of a red year, against ${pct(S.mc_p_dd_over_30pct)} and ${pct(S.mc_p_losing_year, 1)} for the suggested mix, which is the only one near the top on every column.</p>
  ${foot(4)}
</section>

<section class="page">
  <h2>The survival checks</h2>
  <p class="sub">From TRADING_MATH and TRADING_SURVIVAL_EDGE: enough trades, positive EV, no luck dependence, out-of-sample, real diversification, drawdowns you can survive.</p>
  <div class="wrap">${checks()}</div>
  <div class="note warn"><b>The amber marks are about risk size, not the strategy.</b> At 2.5% a trade both mixes have had a 30% drop, and Monte Carlo says a 44–46% drop is possible with bad luck. The notes say a 50% loss needs a 100% gain to recover. The table below shows what a smaller risk does.</div>

  <h3>Risk per trade: the one setting that changes everything</h3>
  <div class="wrap">${riskTable()}</div>
  <p class="flat" style="font-size:10px;margin-top:6px">Flat risk with no steps, fresh ₱10,000 each year. "Worst drop" is over the whole 7 years with profits kept in.</p>
  ${foot(5)}
</section>

<section class="page">
  <h2>Edge or luck?</h2>
  <p class="sub">The mix was found after looking at the results. These tests check whether the idea still works when the choice is made blind.</p>
  <h3>Blind pick: choose on 2020–2022 only, then look at 2023 onward</h3>
  <div class="wrap">${walkTable()}</div>
  <ul class="tight">
    <li>Of ${WS.sleeves} possible third-strategy sleeves added at 30% to bb-core, <b>${WS.beat_bbcore_from_2023}</b> beat bb-core alone after 2023 and <b>${WS.beat_live_from_2023}</b> beat the live pair. Adding a different kind of trade is the edge, not one lucky indicator.</li>
    <li>The suggested mix scores ${S.before_2023_rdd} before 2023 and ${S.from_2023_rdd} after, the steadiest of all 11. The live pair goes ${L.before_2023_rdd} → ${L.from_2023_rdd}.</li>
    <li>Monte Carlo: in 5,000 reshuffled 7-year paths, none lost money overall. The bad-luck 5% still ended above ${sR(S.mc_total5_R, 0)} for the mix and ${sR(L.mc_total5_R, 0)} for the live pair.</li>
  </ul>

  <h3>What to do</h3>
  <div class="steps">
    <div class="step"><div class="n">1</div><b>Keep both live bots</b><p>No change on the VPS. bb-core and I-Core stay as they are.</p></div>
    <div class="step"><div class="n">2</div><b>Paper-test bb-trail P14</b><p>Same entry as bb-core, 2 ATR stop, 14 ATR trailing stop, no time limit. Run it on paper next to the live bots until the 4 December review.</p></div>
    <div class="step"><div class="n">3</div><b>Then move a quarter</b><p>If the paper results look like this test, move 25% of the money into it, taken from I-Core's share.</p></div>
  </div>

  <h3>How this was tested</h3>
  <ul class="tight">
    <li>SOL, ZEC, NEAR, ADA and GALA, Binance USDT-M 4-hour candles, real funding, 0.05% fee per side and 0.02% slippage per fill. Entry at the next candle's open, stop checked first in every candle.</li>
    <li>The engine reproduces the real bb-core trade for trade (594.2R both). No look-ahead (5,040 checks, 0 mismatches).</li>
    <li>Each bot is its own account, sized with the live risk steps at ₱${raw.PHP_PER_USD} per $1. Drops are measured on closed trades.</li>
    <li>Kept all 7 years with compounding, the mix would end near ${pesoK(S.php_7yr_compound)} and the live pair near ${pesoK(L.php_7yr_compound)}. That is not realistic: exchange size limits, leverage caps and thin markets on ZEC and GALA would stop it long before. The yearly figures are the useful ones.</li>
    <li>Not modelled: margin and leverage limits, the halt rule, and funding after 21–26 Oct 2026. The coins mostly rose from 2020 to 2025, and live trading usually does worse than a backtest.</li>
  </ul>
  ${foot(6)}
</section>
</body></html>`;
fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length / 1024).toFixed(0) + ' KB');
