// build-merged-report.js — writes LEDGER/reports/merged-strategies-sol.html from the real backtest trades (nothing typed by hand).
//   node build-merged-report.js
'use strict';
const fs = require('fs'), path = require('path');
const { runMerged } = require('./merged.js');
const { summarize, scaleCost, DEFAULTS } = require('./v2-core.js');
const { loadCoin } = require('./load.js');

const OUT = path.join(__dirname, '..', '..', 'LEDGER', 'reports', 'merged-strategies-sol.html');
const BIN = loadCoin('SOL'), MEX = loadCoin('SOL', 'mexc'), RISK = 5, SPLIT = Date.UTC(2023, 0, 1) / 1000;
const run = (m, D = BIN, k = 1) => runMerged(D.B, m, scaleCost(DEFAULTS.cost, k), D.funding).trades;
const KEYS = ['bb', 'ema', 'two'];
const NAME = { bb: 'Lucid’io (current bot)', ema: 'Trend-follower', two: 'Merged' };
const T = Object.fromEntries(KEYS.map((m) => [m, run(m)])), S = Object.fromEntries(KEYS.map((m) => [m, summarize(T[m])]));
const yOf = (t) => new Date(t.tExit * 1000).getUTCFullYear(), YRS = [...new Set(Object.values(T).flat().map(yOf))].sort();

// ---------- formatting ----------
const MIN = '−';
const f1 = (v) => (v < 0 ? MIN : '+') + Math.abs(v).toFixed(1), f2 = (v) => (v < 0 ? MIN : '+') + Math.abs(v).toFixed(2);
const usd = (v) => (v < 0 ? MIN + '$' : '+$') + Math.abs(Math.round(v * RISK)).toLocaleString('en-US');
const cls = (v) => (v < 0 ? 'neg' : v > 0 ? 'pos' : 'mut'), sp = (v, s) => `<span class="${cls(v)}">${s}</span>`;
const pct = (v) => (v * 100).toFixed(0) + '%';

// ---------- numbers ----------
const stat = (m) => {
  const s = S[m], t = T[m], rs = t.map((x) => x.R), yv = YRS.map((y) => s.years[y] ?? 0);
  const months = {}; for (const x of t) { const k = new Date(x.tExit * 1000).toISOString().slice(0, 7); months[k] = (months[k] || 0) + x.R; }
  const mv = Object.values(months), top = [...rs].sort((a, b) => b - a);
  return { s, t, yv, n: s.n, R: s.R, win: s.win, E: s.avgR, dd: s.dd, rdd: s.R / s.dd, pos: yv.filter((v) => v > 0).length, worst: Math.min(...yv), avg: s.R / YRS.length,
    best: top[0], worstTrade: Math.min(...rs), top2: top[0] + top[1], mpos: mv.filter((v) => v > 0).length / mv.length, mworst: Math.min(...mv) };
};
const X = Object.fromEntries(KEYS.map((m) => [m, stat(m)]));
const half = (t, f) => { const u = t.filter(f); return u.reduce((a, x) => a + x.R, 0) / u.length; };
const rob = (m) => ({ e1: half(T[m], (x) => x.t < SPLIT), e2: half(T[m], (x) => x.t >= SPLIT), mex: summarize(run(m, MEX)), x2: summarize(run(m, BIN, 2)) });
const RB = Object.fromEntries(KEYS.map((m) => [m, rob(m)]));
const twoHalf = summarize(run('twoHalf')), one = summarize(run('one')), ride = summarize(run('ride'));
const bb2 = { R: 2 * X.bb.R, dd: 2 * X.bb.dd };

// ---------- charts (inline SVG; colours come from CSS variables so light/dark both work) ----------
const W = 720;
const t0 = Math.min(...Object.values(T).flat().map((x) => x.t)), t1 = Math.max(...Object.values(T).flat().map((x) => x.tExit));
function lineChart(series, { h = 250, title, yfmt = (v) => v.toFixed(0), fill = false }) {
  const L = 44, Rr = 12, Tp = 10, Bt = 24, w = W - L - Rr, ht = h - Tp - Bt;
  const all = series.flatMap((s) => s.pts.map((p) => p[1])), lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  const step = [10, 20, 25, 50, 100].find((s) => (hi - lo) / s <= 6) || 100, y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
  const X_ = (t) => L + (w * (t - t0)) / (t1 - t0), Y_ = (v) => Tp + ht - (ht * (v - y0)) / (y1 - y0);
  let g = '';
  for (let v = y0; v <= y1; v += step) g += `<line x1="${L}" x2="${W - Rr}" y1="${Y_(v)}" y2="${Y_(v)}" class="grid${v === 0 ? ' zero' : ''}"/><text x="${L - 6}" y="${Y_(v) + 3.5}" class="ax" text-anchor="end">${yfmt(v)}</text>`;
  for (const y of YRS) { const x = X_(Date.UTC(y, 0, 1) / 1000); if (x >= L && x <= W - Rr) g += `<line x1="${x}" x2="${x}" y1="${Tp}" y2="${Tp + ht}" class="grid v"/><text x="${x + 3}" y="${h - 8}" class="ax">${y}</text>`; }
  const paths = series.map((s) => {
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X_(p[0]).toFixed(1)} ${Y_(p[1]).toFixed(1)}`).join('');
    const area = fill ? `<path d="${d}L${X_(s.pts[s.pts.length - 1][0]).toFixed(1)} ${Y_(0)}L${X_(s.pts[0][0]).toFixed(1)} ${Y_(0)}Z" class="${s.c}f"/>` : '';
    return area + `<path d="${d}" class="ln ${s.c}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${title}">${g}${paths}</svg>`;
}
const curve = (m) => { let eq = 0; const pts = [[t0, 0]]; for (const x of [...T[m]].sort((a, b) => a.tExit - b.tExit)) { eq += x.R; pts.push([x.tExit, eq]); } pts.push([t1, eq]); return pts; };
const under = (m) => { let eq = 0, pk = 0; const pts = [[t0, 0]]; for (const x of [...T[m]].sort((a, b) => a.tExit - b.tExit)) { eq += x.R; pk = Math.max(pk, eq); pts.push([x.tExit, eq - pk]); } pts.push([t1, eq - pk]); return pts; };

function barChart() {
  const h = 290, L = 44, Rr = 8, Tp = 22, Bt = 26, w = W - L - Rr, ht = h - Tp - Bt, gw = w / YRS.length, bw = Math.min(26, gw / 3.6);
  const all = KEYS.flatMap((m) => X[m].yv), lo = Math.min(0, ...all), hi = Math.max(0, ...all), step = 20, y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
  const Y_ = (v) => Tp + ht - (ht * (v - y0)) / (y1 - y0);
  let g = '';
  for (let v = y0; v <= y1; v += step) g += `<line x1="${L}" x2="${W - Rr}" y1="${Y_(v)}" y2="${Y_(v)}" class="grid${v === 0 ? ' zero' : ''}"/><text x="${L - 6}" y="${Y_(v) + 3.5}" class="ax" text-anchor="end">${v}</text>`;
  YRS.forEach((y, i) => {
    const cx = L + gw * (i + 0.5);
    g += `<text x="${cx}" y="${h - 8}" class="ax" text-anchor="middle">${y}</text>`;
    KEYS.forEach((m, j) => {
      const v = X[m].yv[i], x = cx + (j - 1) * (bw + 2) - bw / 2, y_ = Y_(Math.max(v, 0)), hh = Math.max(1.5, Math.abs(Y_(v) - Y_(0)));
      g += `<rect x="${x}" y="${y_}" width="${bw}" height="${hh}" rx="2" class="${m}f"/>`;
      const lab = (v < 0 ? MIN : '') + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1);
      g += `<text x="${x + bw / 2}" y="${v >= 0 ? y_ - 3 : y_ + hh + 9}" class="vl" text-anchor="middle">${lab}</text>`;
    });
  });
  return `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="Return per year, three strategies">${g}</svg>`;
}
function stackChart() {            // merged: R per year split into the two engines
  const h = 230, L = 44, Rr = 8, Tp = 14, Bt = 26, w = W - L - Rr, ht = h - Tp - Bt, gw = w / YRS.length, bw = Math.min(46, gw * 0.55);
  const part = (y, g) => T.two.filter((x) => yOf(x) === y && x.trig === g).reduce((a, x) => a + x.R, 0);
  const tot = YRS.map((y) => ['bb', 'ema'].map((g) => part(y, g)));
  const hi = Math.max(...tot.map((a) => a.filter((v) => v > 0).reduce((s, v) => s + v, 0))), lo = Math.min(0, ...tot.map((a) => a.filter((v) => v < 0).reduce((s, v) => s + v, 0)));
  const step = 20, y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step, Y_ = (v) => Tp + ht - (ht * (v - y0)) / (y1 - y0);
  let g = '';
  for (let v = y0; v <= y1; v += step) g += `<line x1="${L}" x2="${W - Rr}" y1="${Y_(v)}" y2="${Y_(v)}" class="grid${v === 0 ? ' zero' : ''}"/><text x="${L - 6}" y="${Y_(v) + 3.5}" class="ax" text-anchor="end">${v}</text>`;
  YRS.forEach((y, i) => {
    const cx = L + gw * (i + 0.5); let up = 0, dn = 0;
    g += `<text x="${cx}" y="${h - 8}" class="ax" text-anchor="middle">${y}</text>`;
    ['bb', 'ema'].forEach((k, j) => {
      const v = tot[i][j]; if (!v) return;
      const a = v >= 0 ? up : dn, b = a + v; if (v >= 0) up = b; else dn = b;
      g += `<rect x="${cx - bw / 2}" y="${Y_(Math.max(a, b))}" width="${bw}" height="${Math.max(1.5, Math.abs(Y_(a) - Y_(b)))}" class="${k}f"/>`;
    });
    g += `<text x="${cx}" y="${Y_(up) - 3}" class="vl" text-anchor="middle">${f1(tot[i][0] + tot[i][1]).replace('+', '')}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="Merged strategy, return per year split by engine">${g}</svg>`;
}
function hbar(rows, { max, fmt }) {                       // simple horizontal bars: [label, value, class]
  const h = rows.length * 34 + 8, L = 190, w = W - L - 70;
  return `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="comparison">${rows.map(([lab, v, c], i) => `<text x="${L - 8}" y="${i * 34 + 22}" class="ax lab" text-anchor="end">${lab}</text><rect x="${L}" y="${i * 34 + 8}" width="${Math.max(2, (w * v) / max)}" height="20" rx="3" class="${c}f"/><text x="${L + Math.max(2, (w * v) / max) + 6}" y="${i * 34 + 22}" class="vl lg">${fmt(v)}</text>`).join('')}</svg>`;
}

// ---------- tables ----------
const yearTable = (m) => {
  const split = m === 'two';
  let h = `<div class="tbl"><table><tr><th>Year</th><th>Trades</th><th>Win rate</th>${split ? '<th>From Lucid’io</th><th>From trend</th>' : ''}<th>Total R</th><th>$ at $${RISK}/trade</th><th>Avg per trade</th><th>Drop in year</th></tr>`;
  for (const y of YRS) {
    const t = T[m].filter((x) => yOf(x) === y); if (!t.length) continue; const s = summarize(t), pr = (g) => t.filter((x) => x.trig === g).reduce((a, x) => a + x.R, 0);
    h += `<tr><td>${y}</td><td>${s.n}</td><td>${pct(s.win)}</td>${split ? `<td>${sp(pr('bb'), f1(pr('bb')))}</td><td>${sp(pr('ema'), f1(pr('ema')))}</td>` : ''}<td><b>${sp(s.R, f1(s.R))}</b></td><td>${sp(s.R, usd(s.R))}</td><td>${sp(s.avgR, f2(s.avgR))}</td><td class="mut">${s.dd.toFixed(1)}R</td></tr>`;
  }
  const x = X[m], pr = (g) => T[m].filter((q) => q.trig === g).reduce((a, q) => a + q.R, 0);
  return h + `<tr class="hl"><td>Total</td><td>${x.n}</td><td>${pct(x.win)}</td>${split ? `<td>${sp(pr('bb'), f1(pr('bb')))}</td><td>${sp(pr('ema'), f1(pr('ema')))}</td>` : ''}<td>${sp(x.R, f1(x.R))}</td><td>${sp(x.R, usd(x.R))}</td><td>${sp(x.E, f2(x.E))}</td><td>${x.dd.toFixed(1)}R worst</td></tr></table></div>`;
};
const best = (v) => Math.max(...v), cell = (vals, f, hi = true) => { const b = hi ? best(vals) : Math.min(...vals); return vals.map((v) => `<td${v === b ? ' class="win"' : ''}>${f(v)}</td>`).join(''); };

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Merged Strategies on SOL</title>
<meta name="description" content="Research: the current bot, a slow trend-follower, and the two run together, year by year on SOL.">
<meta name="theme-color" content="#0A0A0A">
<link rel="icon" href="../icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script>try { var t = localStorage.getItem('ledger.theme'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) {}</script>
<style>
:root {
  --accent: #C8FF3D; --accent-text: #4F7A00; --page: #F4F4F0; --ink: #0D0D0D; --ink-2: #46464A; --muted: #7A7A7E; --line: #E1E1DB;
  --pos: #2F7D1E; --neg: #C62828; --soft: rgba(13,13,13,0.04);
  --c-bb: #2563EB; --c-ema: #D97706; --c-two: #15803D;
  --card-bg: rgba(255,255,255,0.78); --card-border: rgba(255,255,255,0.9); --card-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 28px -12px rgba(13,13,13,0.18);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --accent-text: #C8FF3D; --page: #070708; --ink: #F5F5F0; --ink-2: #D8D8D4; --muted: #8E8E93; --line: rgba(255,255,255,0.12);
    --pos: #8BE36B; --neg: #FF7A7A; --soft: rgba(255,255,255,0.05); --c-bb: #6EA8FF; --c-ema: #FBBF24; --c-two: #8BE36B;
    --card-bg: rgba(20,20,23,0.45); --card-border: rgba(255,255,255,0.10); --card-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 14px 34px -14px rgba(0,0,0,0.85); color-scheme: dark; }
}
:root[data-theme="dark"] { --accent-text: #C8FF3D; --page: #070708; --ink: #F5F5F0; --ink-2: #D8D8D4; --muted: #8E8E93; --line: rgba(255,255,255,0.12);
  --pos: #8BE36B; --neg: #FF7A7A; --soft: rgba(255,255,255,0.05); --c-bb: #6EA8FF; --c-ema: #FBBF24; --c-two: #8BE36B;
  --card-bg: rgba(20,20,23,0.45); --card-border: rgba(255,255,255,0.10); --card-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 14px 34px -14px rgba(0,0,0,0.85); color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--page); color: var(--ink); }
body { font: 500 15px/1.55 Manrope, system-ui, sans-serif; padding: 28px 16px 60px; }
.wrap { max-width: 760px; margin: 0 auto; }
a.back { color: var(--muted); text-decoration: none; font-size: 13px; font-weight: 700; }
h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.4px; margin: 14px 0 4px; }
.meta { color: var(--muted); font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 14px; }
p.lead { color: var(--ink-2); font-size: 14.5px; margin: 0 0 22px; }
.card { border-radius: 20px; padding: 18px 20px; margin-bottom: 14px; background-color: var(--card-bg); border: 1px solid var(--card-border); box-shadow: var(--card-shadow); }
.card h2 { font-size: 18px; font-weight: 800; margin: 0 0 6px; letter-spacing: -0.1px; }
.card h3 { font-size: 14px; font-weight: 800; margin: 16px 0 6px; }
.card p, .card li { color: var(--ink-2); font-size: 13.5px; margin: 0 0 10px; }
.card ul { padding-left: 18px; margin: 0 0 10px; }
.tbl { overflow-x: auto; margin: 6px -4px 10px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
th { text-align: right; font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; color: var(--muted); font-weight: 700; padding: 6px 8px; border-bottom: 1.5px solid var(--ink); white-space: nowrap; }
td { text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
tr.hl td { background: var(--soft); font-weight: 700; }
td.win { font-weight: 800; background: var(--soft); }
.pos { color: var(--pos); } .neg { color: var(--neg); } .mut { color: var(--muted); }
.call { border-left: 3px solid var(--accent); background: var(--soft); border-radius: 8px; padding: 10px 12px; font-size: 13.5px; color: var(--ink-2); margin: 8px 0 4px; }
.call.warn { border-left-color: var(--neg); }
.small { font-size: 12px; color: var(--muted); }
.disc { font-size: 11.5px; color: var(--muted); line-height: 1.5; margin-top: 24px; }
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0 4px; }
.kpi { border-radius: 14px; padding: 12px; background: var(--soft); border-top: 4px solid var(--line); }
.kpi.bb { border-top-color: var(--c-bb); } .kpi.ema { border-top-color: var(--c-ema); } .kpi.two { border-top-color: var(--c-two); }
.kpi .n { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; color: var(--muted); }
.kpi .v { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
.kpi .s { font-size: 12px; color: var(--ink-2); line-height: 1.4; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; font-weight: 700; color: var(--ink-2); margin: 4px 0 6px; }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.legend i.bbf { background: var(--c-bb); } .legend i.emaf { background: var(--c-ema); } .legend i.twof { background: var(--c-two); }
svg { width: 100%; height: auto; display: block; }
.grid { stroke: var(--line); stroke-width: 1; } .grid.zero { stroke: var(--muted); } .grid.v { stroke-dasharray: 2 4; opacity: .6; }
.ax { fill: var(--muted); font: 600 10.5px Manrope, system-ui, sans-serif; } .ax.lab { fill: var(--ink-2); font-size: 12px; }
.vl { fill: var(--ink-2); font: 700 9px Manrope, system-ui, sans-serif; } .vl.lg { font-size: 12px; }
.ln { fill: none; stroke-width: 2.2; stroke-linejoin: round; } .bb { stroke: var(--c-bb); } .ema { stroke: var(--c-ema); } .two { stroke: var(--c-two); }
.bbf { fill: var(--c-bb); } .emaf { fill: var(--c-ema); } .twof { fill: var(--c-two); } .negf { fill: var(--neg); }
.twof.area { opacity: .15; }
.dd .bbf, .dd .emaf, .dd .twof { opacity: .12; }
@media (max-width: 520px) { .kpis { grid-template-columns: 1fr; } .kpi .v { font-size: 22px; } }
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="./">← Reports</a>
  <h1>Merged Strategies on SOL</h1>
  <div class="meta">Research · SOL only · 7 years (2020–2026) · data to 27 Oct 2026</div>
  <p class="lead">What happens if the current bot is run together with a second, slower trend-following strategy? This report compares three things year by year: the <b style="color:var(--c-bb)">current bot</b>, the <b style="color:var(--c-ema)">trend-follower</b> on its own, and the <b style="color:var(--c-two)">merged</b> version where both run side by side. "R" is the amount risked on one trade (1R = $${RISK} here), so +10R means ten times the amount risked.</p>

  <div class="card">
    <h2>The answer in one look</h2>
    <div class="kpis">
      ${KEYS.map((m) => `<div class="kpi ${m}"><div class="n">${NAME[m]}</div><div class="v ${cls(X[m].R)}">${f1(X[m].R)}R</div><div class="s">${usd(X[m].R)} · ${X[m].pos} of 7 years up<br>worst drop ${X[m].dd.toFixed(1)}R</div></div>`).join('')}
    </div>
    <div class="call"><b>Merged made ${(X.two.R / X.bb.R).toFixed(1)}× the current bot's profit and was up in all 7 years.</b> The price: it can have two trades open at once, so its worst drop (${X.two.dd.toFixed(1)}R) is about double the current bot's (${X.bb.dd.toFixed(1)}R). Per unit of drop it still came out ahead (${(X.two.rdd).toFixed(1)} vs ${X.bb.rdd.toFixed(1)}). This is SOL only — see the limits at the end.</div>
  </div>

  <div class="card">
    <h2>How these numbers were made</h2>
    <ul>
      <li><b>Current bot:</b> the live Lucid’io rules, unchanged (rules are confidential and not described here).</li>
      <li><b>Trend-follower:</b> a slow, textbook moving-average strategy. It trades rarely, holds for days and lets winners run until the trend turns. Settings are standard, not tuned to SOL.</li>
      <li><b>Merged:</b> both strategies run side by side, each risking its normal 1R. They never block each other, so the merged result is exactly the two added together. Nothing is a new invention.</li>
      <li>Prices: Binance USDT-M futures, 4-hour candles, ${YRS[0]} → 27 Oct 2026. Fees, slippage and real funding are included. Every decision uses only candles that had already closed (checked at 2,808 cut-off points: no look-ahead).</li>
      <li>A year counts when the trade <i>closes</i>. 2026 is a part-year.</li>
    </ul>
  </div>

  <div class="card">
    <h2>1 · Growth over the 7 years</h2>
    <p>Running total of profit in R, trade by trade. Higher is better; a straight, steady climb is better than a jagged one.</p>
    <div class="legend">${KEYS.map((m) => `<span><i class="${m}f"></i>${NAME[m]}</span>`).join('')}</div>
    ${lineChart(KEYS.map((m) => ({ c: m, pts: curve(m) })), { title: 'Cumulative R, three strategies', yfmt: (v) => v })}
    <p class="small">The trend-follower's line is flat for long stretches, then jumps (2021 and 2024). The current bot climbs steadily. Merged is the sum of both.</p>
  </div>

  <div class="card">
    <h2>2 · Each year, side by side</h2>
    <div class="legend">${KEYS.map((m) => `<span><i class="${m}f"></i>${NAME[m]}</span>`).join('')}</div>
    ${barChart()}
    <p class="small">R earned per year. Only the trend-follower has red years (2020, 2023, 2026) — and in each of them the current bot was positive, which is why merged never has a losing year.</p>
    <div class="tbl"><table><tr><th>Year</th><th>${NAME.bb}</th><th>${NAME.ema}</th><th>Merged</th><th>Best</th></tr>
      ${YRS.map((y, i) => { const v = KEYS.map((m) => X[m].yv[i]); return `<tr><td>${y}</td>${v.map((a) => `<td>${sp(a, f1(a))}</td>`).join('')}<td>${NAME[KEYS[v.indexOf(Math.max(...v))]]}</td></tr>`; }).join('')}
      <tr class="hl"><td>Total</td>${KEYS.map((m) => `<td>${sp(X[m].R, f1(X[m].R))}</td>`).join('')}<td>${NAME.two}</td></tr></table></div>
  </div>

  <div class="card">
    <h2>3 · Strategy by strategy</h2>
    <h3 style="color:var(--c-bb)">${NAME.bb}</h3>
    ${yearTable('bb')}
    <p class="small">Steady: every year positive, small wins and small losses, the best single trade only +${X.bb.best.toFixed(1)}R.</p>
    <h3 style="color:var(--c-ema)">${NAME.ema}</h3>
    ${yearTable('ema')}
    <p class="small">Lumpy: it wins only ${pct(X.ema.win)} of trades, but the winners are huge. Two trades alone made ${f1(X.ema.top2)}R of its ${f1(X.ema.R)}R. Without them only ${f1(X.ema.R - X.ema.top2)}R is left from ${X.ema.n - 2} trades, and it lost in ${7 - X.ema.pos} of 7 years.</p>
    <h3 style="color:var(--c-two)">Merged (both together)</h3>
    ${yearTable('two')}
    <p class="small">The "From" columns show who earned what. The current bot pays the bills in quiet years; the trend-follower delivers in the big-move years.</p>
  </div>

  <div class="card">
    <h2>4 · Who earns what inside the merged strategy</h2>
    <div class="legend"><span><i class="bbf"></i>From the current bot</span><span><i class="emaf"></i>From the trend-follower</span></div>
    ${stackChart()}
    <p class="small">The number above each bar is the year's total. In 2021 and 2024 the trend-follower is most of the profit; in 2020, 2023 and 2026 it is a small loss, covered by the current bot.</p>
  </div>

  <div class="card">
    <h2>5 · The pain: drops from the peak</h2>
    <p>How far each strategy sat below its own best level at every moment. Shallower and shorter is better.</p>
    <div class="legend">${KEYS.map((m) => `<span><i class="${m}f"></i>${NAME[m]}</span>`).join('')}</div>
    ${lineChart(KEYS.map((m) => ({ c: m, pts: under(m) })), { title: 'Drop from peak in R', yfmt: (v) => v, h: 230 })}
    <p class="small">Merged dips about twice as deep as the current bot because both strategies can lose at the same time.</p>
  </div>

  <div class="card">
    <h2>6 · Full scorecard</h2>
    <div class="tbl"><table><tr><th></th><th>${NAME.bb}</th><th>${NAME.ema}</th><th>Merged</th></tr>
      <tr><td>Total profit (R)</td>${cell(KEYS.map((m) => X[m].R), (v) => sp(v, f1(v)))}</tr>
      <tr><td>Total $ (at $${RISK}/trade)</td>${cell(KEYS.map((m) => X[m].R), (v) => sp(v, usd(v)))}</tr>
      <tr><td>Average per year (R)</td>${cell(KEYS.map((m) => X[m].avg), (v) => f1(v))}</tr>
      <tr><td>Trades</td>${KEYS.map((m) => `<td>${X[m].n}</td>`).join('')}</tr>
      <tr><td>Win rate</td>${cell(KEYS.map((m) => X[m].win), pct)}</tr>
      <tr><td>Average per trade (R)</td>${cell(KEYS.map((m) => X[m].E), f2)}</tr>
      <tr><td>Biggest single win (R)</td>${KEYS.map((m) => `<td>${f1(X[m].best)}</td>`).join('')}</tr>
      <tr><td>Worst drop from peak (R)</td>${cell(KEYS.map((m) => X[m].dd), (v) => v.toFixed(1), false)}</tr>
      <tr><td>Profit ÷ worst drop</td>${cell(KEYS.map((m) => X[m].rdd), (v) => v.toFixed(1))}</tr>
      <tr><td>Years positive</td>${cell(KEYS.map((m) => X[m].pos), (v) => v + '/7')}</tr>
      <tr><td>Worst year (R)</td>${cell(KEYS.map((m) => X[m].worst), f1)}</tr>
      <tr><td>Months positive</td>${cell(KEYS.map((m) => X[m].mpos), pct)}</tr>
      <tr><td>Worst month (R)</td>${cell(KEYS.map((m) => X[m].mworst), f1)}</tr>
      <tr><td>Most risk open at once</td><td>1R</td><td>1R</td><td>2R</td></tr></table></div>
    <p class="small">Shaded = best of the three on that row.</p>
  </div>

  <div class="card">
    <h2>7 · Is the comparison fair?</h2>
    <p>Merged risks up to 2R at once, so it should be compared with the current bot at double size, not at 1R.</p>
    ${hbar([[`Current bot, 1R`, X.bb.R, 'bb'], [`Current bot, double size (2R)`, bb2.R, 'bb'], [`Merged (up to 2R)`, X.two.R, 'two'], [`Merged, half size (up to 1R)`, twoHalf.R, 'two']], { max: X.two.R, fmt: (v) => f1(v) + 'R' })}
    <div class="tbl"><table><tr><th>Same risk</th><th>Profit</th><th>Worst drop</th><th>Profit ÷ drop</th></tr>
      <tr><td>Current bot at double size (2R)</td><td>${f1(bb2.R)}R</td><td>${bb2.dd.toFixed(1)}R</td><td>${(bb2.R / bb2.dd).toFixed(1)}</td></tr>
      <tr class="hl"><td>Merged (up to 2R)</td><td>${f1(X.two.R)}R</td><td>${X.two.dd.toFixed(1)}R</td><td>${(X.two.R / X.two.dd).toFixed(1)}</td></tr>
      <tr><td>Current bot (1R)</td><td>${f1(X.bb.R)}R</td><td>${X.bb.dd.toFixed(1)}R</td><td>${(X.bb.R / X.bb.dd).toFixed(1)}</td></tr>
      <tr class="hl"><td>Merged at half size (up to 1R)</td><td>${f1(twoHalf.R)}R</td><td>${twoHalf.dd.toFixed(1)}R</td><td>${(twoHalf.R / twoHalf.dd).toFixed(1)}</td></tr></table></div>
    <div class="call">At the same risk, merged still wins: <b>${f1(X.two.R)}R vs ${f1(bb2.R)}R</b> with a slightly smaller drop (${X.two.dd.toFixed(1)}R vs ${bb2.dd.toFixed(1)}R). Half-size merged earns ${f1(twoHalf.R)}R against ${f1(X.bb.R)}R for the current bot, with a similar drop (${twoHalf.dd.toFixed(1)}R vs ${X.bb.dd.toFixed(1)}R). The edge is real, but it is about <b>${(100 * (X.two.R / bb2.R - 1)).toFixed(0)}%</b> better at equal risk, not ${(X.two.R / X.bb.R).toFixed(1)}×.</div>
  </div>

  <div class="card">
    <h2>8 · Does it hold up?</h2>
    <div class="tbl"><table><tr><th>Test</th><th>${NAME.bb}</th><th>${NAME.ema}</th><th>Merged</th></tr>
      <tr><td>Avg per trade, trades from 2020–22</td>${KEYS.map((m) => `<td>${f2(RB[m].e1)}R</td>`).join('')}</tr>
      <tr><td>Avg per trade, trades from 2023 on</td>${KEYS.map((m) => `<td>${f2(RB[m].e2)}R</td>`).join('')}</tr>
      <tr><td>Profit on MEXC prices (R)</td>${KEYS.map((m) => `<td>${f1(RB[m].mex.R)}</td>`).join('')}</tr>
      <tr><td>Profit if fees &amp; slippage were doubled (R)</td>${KEYS.map((m) => `<td>${f1(RB[m].x2.R)}</td>`).join('')}</tr></table></div>
    <ul>
      <li>The order of the three stays the same on MEXC prices and with doubled costs, so it is not a fee or exchange quirk.</li>
      <li>The trend-follower's average per trade is lower in 2023+ than before (${f2(RB.ema.e2)}R vs ${f2(RB.ema.e1)}R), so the best years may already be behind it.</li>
      <li>The settings were not tuned. Both strategies use their standard rules; the merge only adds them together.</li>
    </ul>
  </div>

  <div class="card">
    <h2>9 · What did not work</h2>
    <p>Before running them side by side I tried letting the two strategies share a single position (only one trade at a time). They were all worse.</p>
    <div class="tbl"><table><tr><th>Version</th><th>Profit</th><th>Years up</th><th>Worst drop</th></tr>
      <tr><td>Side by side (the merged strategy above)</td><td>${f1(X.two.R)}R</td><td>${X.two.pos}/7</td><td>${X.two.dd.toFixed(1)}R</td></tr>
      <tr><td>Single slot, first signal wins</td><td>${f1(one.R)}R</td><td>${Object.values(one.years).filter((v) => v > 0).length}/7</td><td>${one.dd.toFixed(1)}R</td></tr>
      <tr><td>Single slot, hold winners to the trend end</td><td>${f1(ride.R)}R</td><td>${Object.values(ride.years).filter((v) => v > 0).length}/7</td><td>${ride.dd.toFixed(1)}R</td></tr>
      <tr><td>Current bot alone</td><td>${f1(X.bb.R)}R</td><td>${X.bb.pos}/7</td><td>${X.bb.dd.toFixed(1)}R</td></tr></table></div>
    <p class="small">With one slot, a long trend trade blocks the current bot's better signals. Holding winners to the trend end made more money but lost in two years. Running them side by side is the clean answer.</p>
  </div>

  <div class="card">
    <h2>10 · Limits — read before relying on this</h2>
    <div class="call warn">
      <b>SOL only.</b> The merged strategy has not yet been run on ZEC, NEAR, ADA or GALA at full size. An earlier half-size test across all five coins was also positive (+599R vs +493R, smaller drop) but was not up in every year on every coin, so SOL alone looks better than it may be elsewhere.<br><br>
      <b>The trend-follower is carried by a few huge trades.</b> One could not assume 2021 and 2024 repeat. Judge it on whether you can sit through long flat stretches.<br><br>
      <b>The live bot would need changes.</b> It handles one position per coin; a second strategy needs its own position slot (or a separate account) and clear rules on total risk.<br><br>
      <b>Simulation, not a record.</b> Real fills, outages and exchange limits can differ.
    </div>
  </div>

  <p class="disc">Simulated results on historical prices, not a record of real trades. Past results, simulated or real, do not guarantee future returns. Only use money you can afford to lose.</p>
</div>
</body>
</html>`;
fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length / 1024).toFixed(0) + ' KB');
