// build-capital-report.js — "BB Breakout - 5 Coins - 100 USD per coin, 5 USD risk" PDF: $100 starting balance per coin ($500 total), fixed $5 risk
// per trade, every cost included (fees, slippage, funding). Per coin: yearly before/after balances, every month, drawdowns, losing streaks.
// Combined: yearly totals and capital growth %, risk-preparation page, overall profitability of the $500. Trades come from ../bb-deep.js.
// usage: node build-capital-report.js [--shots]   -> ../../../PDF/<title>.pdf (+ HTML next to this script)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
process.env.BB_COINS = 'SOL,ZEC,NEAR,ADA,GALA'; process.env.BB_TAG = '-5coin';
const D = require('../bb-deep.js');
const COINS = D.COINS, RISK = D.RISK, START = 100, TOTAL0 = START * COINS.length;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PDF_DIR = path.resolve(__dirname, '../../../PDF');
const TITLE = 'BB Breakout - 5 Coins - 100 USD per coin, 5 USD risk - Backtest 2020-2026';

// ---------------------------------------------------------------- palette (same validated set as build-report.js)
const C = { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#8a897f', grid: '#e1e0d9', axis: '#c3c2b7', neutral: '#f0efec',
  SOL: '#2a78d6', ZEC: '#eb6834', NEAR: '#1baf7a', ADA: '#7a4fd1', GALA: '#c28a00', pos: '#2a78d6', neg: '#e34948', posD: '#1c5cab', negD: '#b8302f', total: '#0b0b0b' };
const NAME = { SOL: 'Solana (SOL)', ZEC: 'Zcash (ZEC)', NEAR: 'NEAR Protocol (NEAR)', ADA: 'Cardano (ADA)', GALA: 'Gala (GALA)' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------------------------------------------------------- formatting
const m2 = (v) => (v < 0 ? '−$' : '+$') + Math.abs(v).toFixed(2);
const m0 = (v) => (Math.abs(v) < 0.5 ? '$0' : (v < 0 ? '−$' : '+$') + Math.abs(v).toFixed(0));
const bal = (v) => '$' + v.toFixed(2);
const pc = (v, d = 1) => (v < 0 ? '−' : '+') + Math.abs(v * 100).toFixed(d) + '%';
const pcu = (v, d = 1) => (v * 100).toFixed(d) + '%';
const dm = (t) => { const d = new Date(t * 1000); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const mo = (t) => { const d = new Date(t * 1000); return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const yr = (t) => new Date(t * 1000).getUTCFullYear();
const mk = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const cls = (v) => (v > 0.005 ? 'pos' : v < -0.005 ? 'neg' : '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const days = (a, b) => Math.round((b - a) / 86400);

// ---------------------------------------------------------------- money per trade ($5 risk)
const TR = {};
for (const s of COINS) TR[s] = D.T[s].map((t) => ({ ...t, sym: s, net: t.R * RISK, fee: -t.feeR * RISK, slip: -t.slipR * RISK, fund: t.fundR * RISK,
  gross: (t.R + t.feeR + t.slipR - t.fundR) * RISK })).sort((a, b) => a.x - b.x);
const ALLT = COINS.flatMap((s) => TR[s]).sort((a, b) => a.x - b.x);
const END_T = Math.max(...ALLT.map((t) => t.x));

// statistics over trades in exit order, starting from a balance
function stats(T, start) {
  let b = start, pk = start, pkT = T.length ? T[0].t : 0, dd = 0, ddPct = 0, ddPeakT = 0, ddLowT = 0, low = start, lowT = null, s = 0, sLoss = 0, ms = 0, msLoss = 0, msA = 0, msB = 0, sA = 0;
  const eq = [], eps = []; let cur = null;
  for (const t of T) {
    b += t.net; eq.push([t.x, b]);
    if (b < low) { low = b; lowT = t.x; }
    if (b >= pk) { if (cur) { cur.recT = t.x; eps.push(cur); cur = null; } pk = b; pkT = t.x; }
    else { const d = pk - b; if (!cur) cur = { peak: pk, peakT: pkT, depth: 0, lowT: t.x, recT: null }; if (d > cur.depth) { cur.depth = d; cur.lowT = t.x; cur.pct = d / pk; }
      if (d > dd) { dd = d; ddPct = d / pk; ddPeakT = pkT; ddLowT = t.x; } }
    if (t.net < 0) { if (!s) sA = t.x; s++; sLoss += t.net; if (s > ms) { ms = s; msLoss = sLoss; msA = sA; msB = t.x; } } else { s = 0; sLoss = 0; }
  }
  if (cur) eps.push(cur);
  const w = T.filter((t) => t.net > 0), sum = (k) => T.reduce((a, t) => a + t[k], 0);
  return { n: T.length, w: w.length, wr: T.length ? w.length / T.length : 0, start, end: b, net: b - start, gross: sum('gross'), fee: sum('fee'), slip: sum('slip'), fund: sum('fund'),
    dd, ddPct, ddPeakT, ddLowT, low, lowT, ms, msLoss, msA, msB, eq, eps, tp: T.filter((t) => t.why === 'target').length,
    best: T.length ? Math.max(...T.map((t) => t.net)) : 0, worst: T.length ? Math.min(...T.map((t) => t.net)) : 0 };
}
const streakCounts = (T, ns) => { const out = Object.fromEntries(ns.map((n) => [n, 0])); let s = 0;
  const close = () => { for (const n of ns) if (s >= n) out[n]++; }; for (const t of T) { if (t.net < 0) s++; else { close(); s = 0; } } close(); return out; };
const years = (T) => [...new Set(T.map((t) => yr(t.x)))].sort();
function yearRows(T, start) {
  let b = start; return years(T).map((y) => { const ty = T.filter((t) => yr(t.x) === y), S = stats(ty, b); const r = { y, ...S, startBal: b, endBal: S.end }; b = S.end; return r; });
}
function monthMap(T) { const m = {}; for (const t of T) { const k = mk(t.x); (m[k] = m[k] || { net: 0, n: 0 }); m[k].net += t.net; m[k].n++; } return m; }

const CS = Object.fromEntries(COINS.map((s) => [s, stats(TR[s], START)]));
const CY = Object.fromEntries(COINS.map((s) => [s, yearRows(TR[s], START)]));
const CM = Object.fromEntries(COINS.map((s) => [s, monthMap(TR[s])]));
const AS = stats(ALLT, TOTAL0), AY = yearRows(ALLT, TOTAL0), AM = monthMap(ALLT);
const YEARS = years(ALLT);
const FIRST = Object.fromEntries(COINS.map((s) => [s, TR[s][0].t]));
const spanYears = (END_T - Math.min(...Object.values(FIRST))) / 31557600;
const SC = Object.fromEntries([...COINS, 'ALL'].map((s) => [s, streakCounts(s === 'ALL' ? ALLT : TR[s], [5, 8, 10, 15])]));
const endOpen = ALLT.filter((t) => t.why === 'end');

// ---------------------------------------------------------------- svg kit
const nice = (lo, hi, n = 5) => { if (lo === hi) { lo -= 1; hi += 1; } const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t = [];
  for (let v = a; v <= b + step / 2; v += step) t.push(+v.toFixed(10)); return t; };
const txt = (x, y, s, o = {}) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.size || 10}" fill="${o.fill || C.ink2}" text-anchor="${o.anchor || 'start'}"${o.weight ? ` font-weight="${o.weight}"` : ''}>${esc(s)}</text>`;
const svgOpen = (w, h) => `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">`;
const bar = (x, y0, w, y1, fill) => { const top = Math.min(y0, y1), h = Math.abs(y1 - y0); if (h < 0.5) return ''; const r = Math.min(3, w / 2, h);
  return y1 < y0 ? `<path d="M${x},${y0}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${y0}Z" fill="${fill}"/>`
    : `<path d="M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z" fill="${fill}"/>`; };
const hbar = (x0, y, h, x1, fill) => { const w = Math.abs(x1 - x0); if (w < 0.5) return ''; const r = Math.min(3, h / 2, w);
  return `<path d="M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z" fill="${fill}"/>`; };
const T0 = Math.min(...ALLT.map((t) => t.t)), T1 = END_T;
function timeAxis(xs, top, bottom, x0, x1) { let g = ''; for (let y = yr(T0); y <= yr(T1) + 1; y++) { const t = Date.UTC(y, 0, 1) / 1000; if (t < T0 || t > T1) continue; const x = xs(t);
  g += `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${C.grid}" stroke-width="1"/>` + txt(x + 3, bottom + 12, String(y), { size: 9, fill: C.muted }); } return g; }
// balance lines: series = [{pts:[[t,v]], color, w, label, start}]
function lineChart(series, { w = 1000, h = 260, money = true, base = null, ylabel = '' } = {}) {
  const L = 46, R = 70, Tp = 10, B = 22, vals = series.flatMap((s) => s.pts.map((p) => p[1])).concat(base != null ? [base] : []);
  const ticks = nice(Math.min(...vals), Math.max(...vals)), lo = ticks[0], hi = ticks[ticks.length - 1];
  const xs = (t) => L + (t - T0) / (T1 - T0) * (w - L - R), ys = (v) => Tp + (hi - v) / (hi - lo) * (h - Tp - B);
  let g = svgOpen(w, h) + timeAxis(xs, Tp, h - B, L, w - R);
  for (const v of ticks) g += `<line x1="${L}" y1="${ys(v)}" x2="${w - R}" y2="${ys(v)}" stroke="${C.grid}"/>` + txt(L - 5, ys(v) + 3, (money ? '$' : '') + v.toLocaleString('en-US'), { size: 9, anchor: 'end', fill: C.muted });
  if (base != null) g += `<line x1="${L}" y1="${ys(base)}" x2="${w - R}" y2="${ys(base)}" stroke="${C.ink2}" stroke-dasharray="4 3"/>` + txt(L + 4, ys(base) - 4, `start $${base}`, { size: 9, fill: C.ink2 });
  const labels = [];
  for (const s of series) { const pts = [[s.t0 || s.pts[0][0], s.start], ...s.pts]; g += `<polyline fill="none" stroke="${s.color}" stroke-width="${s.w || 1.6}" stroke-linejoin="round" points="${pts.map((p) => xs(p[0]).toFixed(1) + ',' + ys(p[1]).toFixed(1)).join(' ')}"/>`;
    const lp = pts[pts.length - 1]; labels.push({ y: ys(lp[1]), x: xs(lp[0]), s }); }
  labels.sort((a, b) => a.y - b.y); for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 11) labels[i].y = labels[i - 1].y + 11;
  for (const l of labels) g += txt(w - R + 5, l.y + 3, `${l.s.label} $${l.s.pts[l.s.pts.length - 1][1].toFixed(0)}`, { size: 9, fill: l.s.color, weight: 600 });
  return g + '</svg>';
}
// drawdown below the running peak (underwater), in $
function underwater(eq, start, { w = 1000, h = 120, color = C.neg } = {}) {
  const L = 46, R = 70, Tp = 8, B = 20; let pk = start; const pts = [[T0, 0]]; for (const [t, v] of eq) { pk = Math.max(pk, v); pts.push([t, v - pk]); }
  const mn = Math.min(...pts.map((p) => p[1])), ticks = nice(mn, 0, 3), lo = ticks[0];
  const xs = (t) => L + (t - T0) / (T1 - T0) * (w - L - R), ys = (v) => Tp + (0 - v) / (0 - lo) * (h - Tp - B);
  let g = svgOpen(w, h) + timeAxis(xs, Tp, h - B, L, w - R);
  for (const v of ticks) g += `<line x1="${L}" y1="${ys(v)}" x2="${w - R}" y2="${ys(v)}" stroke="${C.grid}"/>` + txt(L - 5, ys(v) + 3, v === 0 ? '$0' : '−$' + Math.abs(v), { size: 9, anchor: 'end', fill: C.muted });
  let d = `M${xs(pts[0][0])},${ys(0)}`; for (let i = 1; i < pts.length; i++) d += `L${xs(pts[i][0]).toFixed(1)},${ys(pts[i - 1][1]).toFixed(1)}L${xs(pts[i][0]).toFixed(1)},${ys(pts[i][1]).toFixed(1)}`;
  d += `L${xs(T1)},${ys(pts[pts.length - 1][1])}L${xs(T1)},${ys(0)}Z`;
  g += `<path d="${d}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="1"/>`;
  const iMin = pts.findIndex((p) => p[1] === mn); g += txt(xs(pts[iMin][0]) + 4, ys(mn) + 3, `worst −$${Math.abs(mn).toFixed(2)}`, { size: 9, fill: C.negD, weight: 600 });
  return g + '</svg>';
}
// grouped yearly bars per coin
function yearBars({ w = 1000, h = 240 } = {}) {
  const L = 46, R = 10, Tp = 10, B = 24, vals = []; for (const s of COINS) for (const r of CY[s]) vals.push(r.net); vals.push(0);
  const ticks = nice(Math.min(...vals), Math.max(...vals)), lo = ticks[0], hi = ticks[ticks.length - 1], ys = (v) => Tp + (hi - v) / (hi - lo) * (h - Tp - B);
  const gw = (w - L - R) / YEARS.length, bw = Math.min(18, (gw - 16) / COINS.length);
  let g = svgOpen(w, h); for (const v of ticks) g += `<line x1="${L}" y1="${ys(v)}" x2="${w - R}" y2="${ys(v)}" stroke="${v === 0 ? C.axis : C.grid}"/>` + txt(L - 5, ys(v) + 3, '$' + v, { size: 9, anchor: 'end', fill: C.muted });
  YEARS.forEach((y, i) => { const x0 = L + i * gw + (gw - bw * COINS.length - 2 * (COINS.length - 1)) / 2;
    COINS.forEach((s, j) => { const r = CY[s].find((q) => q.y === y); if (!r) return; const x = x0 + j * (bw + 2); g += bar(x, ys(0), bw, ys(r.net), C[s]); });
    g += txt(L + i * gw + gw / 2, h - 8, y + (y === yr(T1) ? '*' : ''), { size: 10, anchor: 'middle', fill: C.ink2, weight: 600 }); });
  return g + '</svg>';
}
// horizontal bars for coin comparison
function coinHBars(vals, fmt, { w = 480, h = 150 } = {}) {
  const L = 96, R = 70, rowH = (h - 10) / vals.length, mx = Math.max(...vals.map((v) => Math.abs(v.v)));
  let g = svgOpen(w, h); vals.forEach((v, i) => { const y = 5 + i * rowH; g += txt(L - 6, y + rowH / 2 + 3, v.label, { size: 10, anchor: 'end', fill: C.ink, weight: 600 });
    const x1 = L + Math.abs(v.v) / mx * (w - L - R); g += hbar(L, y + rowH * 0.18, rowH * 0.64, x1, v.color); g += txt(x1 + 5, y + rowH / 2 + 3, fmt(v.v), { size: 10, fill: C.ink, weight: 600 }); });
  return g + '</svg>';
}
// monthly heat-map table (rows = years, cols = months)
function heat(m, ys, scale) {
  const tint = (v) => { const a = Math.min(1, Math.abs(v) / scale); const c = v >= 0 ? [42, 120, 214] : [227, 73, 72]; const mix = (k) => Math.round(255 - (255 - c[k]) * (0.12 + 0.6 * a)); return `rgb(${mix(0)},${mix(1)},${mix(2)})`; };
  let h = `<table class="heat"><tr><th>Year</th>${MON.map((x) => `<th>${x}</th>`).join('')}<th>Year total</th><th>Losing months</th></tr>`;
  for (const y of ys) { let row = `<td class="yl">${y}</td>`, tot = 0, neg = 0, cnt = 0;
    for (let i = 0; i < 12; i++) { const k = `${y}-${String(i + 1).padStart(2, '0')}`, c = m[k];
      if (!c) { row += `<td class="na">·</td>`; continue; } tot += c.net; cnt++; if (c.net < 0) neg++;
      row += `<td style="background:${tint(c.net)}" class="${Math.abs(c.net) / scale > 0.7 ? 'strong' : ''}">${m0(c.net)}<span>${c.n}t</span></td>`; }
    h += `<tr>${row}<td class="tot ${cls(tot)}">${m2(tot)}</td><td class="tot">${neg} of ${cnt}</td></tr>`; }
  return h + '</table>';
}

// ---------------------------------------------------------------- page builders
const pages = []; let pageNo = 0;
const page = (body, cls = '') => { pageNo++; pages.push(`<section class="page ${cls}">${body}<div class="foot"><span>${esc(TITLE)}</span><span>Page ${pageNo}</span></div></section>`); };
const tile = (label, value, sub = '', tone = '') => `<div class="tile ${tone}"><div class="tl">${label}</div><div class="tv">${value}</div>${sub ? `<div class="ts">${sub}</div>` : ''}</div>`;
const legend = () => `<div class="legend">${COINS.map((s) => `<span><i style="background:${C[s]}"></i>${s}</span>`).join('')}</div>`;

// 1. cover
page(`<div class="cover">
<div class="kicker">Backtest report · ${dm(T0)} → ${dm(T1)}</div>
<h1>BB Breakout strategy on 5 coins<br><span>$100 per coin · $5 risk per trade · all costs included</span></h1>
<p class="lead">If you had put <b>$100 on each of SOL, ZEC, NEAR, ADA and GALA ($500 total)</b> and let the bot risk <b>$5 on every trade</b>, this is what the last ${spanYears.toFixed(1)} years would have looked like — after paying every trading fee, slippage and funding fee.</p>
<div class="tiles big">
${tile('Start → End', `$${TOTAL0} → $${AS.end.toFixed(2)}`, 'all 5 coins combined')}
${tile('Total profit', m2(AS.net), `${pc(AS.net / TOTAL0, 0)} on $${TOTAL0}`, 'good')}
${tile('Average per year', m2(AS.net / spanYears), `${pc(AS.net / TOTAL0 / spanYears, 0)} of $${TOTAL0} a year`, 'good')}
${tile('Worst drop (max drawdown)', '−$' + AS.dd.toFixed(2), `${pcu(AS.ddPct)} from the peak · ${mo(AS.ddPeakT)} → ${mo(AS.ddLowT)}`, 'bad')}
${tile('Longest losing streak', AS.ms + ' trades in a row', `cost −$${Math.abs(AS.msLoss).toFixed(2)} · ${dm(AS.msA)} → ${dm(AS.msB)}`, 'bad')}
${tile('All costs paid', m2(AS.fee + AS.slip + AS.fund), `${pcu(-(AS.fee + AS.slip + AS.fund) / AS.gross)} of the gross profit`)}
</div>
<div class="cols2">
<div class="card"><h3>The rules in plain words</h3><ul class="tight">
<li>Looks at the <b>4-hour chart</b> only. A trade starts when a candle <b>closes outside the Bollinger Band</b> (20, 2) in the direction of the <b>200 average</b> (above it = long, below it = short).</li>
<li><b>Stop-loss</b> = the middle band. <b>Take-profit</b> = 4 × that distance (1:4). Both are fixed at entry and never moved.</li>
<li>If neither is hit within <b>48 candles (8 days)</b>, the trade is closed at market.</li>
<li>One trade at a time per coin. Size is set so hitting the stop loses about <b>$5</b>.</li></ul></div>
<div class="card"><h3>What is included</h3><ul class="tight">
<li><b>Trading fees</b>: 0.05% on market entry, stop and time exit; 0.02% on the take-profit limit order (Binance standard tier).</li>
<li><b>Slippage</b>: 0.02% worse price on every market fill. The take-profit only counts as hit if price goes 0.05% <i>through</i> it.</li>
<li><b>Funding</b>: the real Binance funding rate for every 8-hour payment the trade was open through.</li>
<li>Binance USDT-M 4h candles. No compounding: the risk stays $5 even as balances grow. Server / API costs are not included (API use itself is free).</li></ul></div>
</div>
<p class="note">How to read this report: page 2 shows all coins together, pages 3–12 show each coin (yearly before/after balances, then every month), page 13 is the year-by-year total of all coins, page 14 is every month of all coins, page 15 is what to be prepared for, and page 16 is the overall result on the $500. 2026 = 1 Jan to ${dm(T1)} only.</p>
</div>`, 'cover-page');

// 2. overview
{
  const rows = COINS.map((s) => { const x = CS[s]; return `<tr><td><i class="dot" style="background:${C[s]}"></i><b>${s}</b></td><td>${dm(FIRST[s])}</td><td>${x.n}</td><td>${pcu(x.wr, 0)}</td><td>${bal(START)}</td><td><b>${bal(x.end)}</b></td><td class="${cls(x.net)}"><b>${m2(x.net)}</b></td><td class="${cls(x.net)}">${pc(x.net / START, 0)}</td><td class="neg">−$${x.dd.toFixed(2)}</td><td>${pcu(x.ddPct)}</td><td>${bal(x.low)}</td><td>${x.ms}</td><td class="neg">${m2(x.fee + x.slip + x.fund)}</td></tr>`; }).join('');
  page(`<h2>All 5 coins at a glance</h2>
<p class="sub">Each coin starts with $100. Balance lines below are after every cost. The dashed line is the starting $100.</p>
${legend()}
${lineChart(COINS.map((s) => ({ pts: CS[s].eq, color: C[s], label: s, start: START, t0: FIRST[s] })), { h: 330, base: START })}
<table class="t"><tr><th>Coin</th><th>First trade</th><th>Trades</th><th>Win rate</th><th>Start</th><th>End</th><th>Profit</th><th>Growth</th><th>Max drawdown</th><th>DD % of peak</th><th>Lowest balance</th><th>Longest losing streak</th><th>Costs paid</th></tr>
${rows}<tr class="tot"><td><b>All 5</b></td><td>${dm(T0)}</td><td>${AS.n}</td><td>${pcu(AS.wr, 0)}</td><td>${bal(TOTAL0)}</td><td><b>${bal(AS.end)}</b></td><td class="pos"><b>${m2(AS.net)}</b></td><td class="pos">${pc(AS.net / TOTAL0, 0)}</td><td class="neg">−$${AS.dd.toFixed(2)}</td><td>${pcu(AS.ddPct)}</td><td>${bal(AS.low)}</td><td>${AS.ms}</td><td class="neg">${m2(AS.fee + AS.slip + AS.fund)}</td></tr></table>
<p class="note">"Max drawdown" = the biggest fall from a high point to a later low. "Lowest balance" = the lowest the balance ever got from the $100 start. Win rate is low on purpose: most trades lose about $5, a few win about $20.</p>`);
}

// 3–12. two pages per coin
for (const s of COINS) {
  const x = CS[s], Y = CY[s], sc = SC[s];
  const yrow = (r) => `<tr><td><b>${r.y}${r.y === yr(T1) ? '*' : ''}</b></td><td>${bal(r.startBal)}</td><td><b>${bal(r.endBal)}</b></td><td class="${cls(r.net)}"><b>${m2(r.net)}</b></td><td class="${cls(r.net)}">${pc(r.net / r.startBal)}</td><td>${r.n}</td><td>${pcu(r.wr, 0)}</td><td>${r.tp}</td><td>${m2(r.gross)}</td><td class="neg">${m2(r.fee)}</td><td class="neg">${m2(r.slip)}</td><td class="${cls(r.fund)}">${m2(r.fund)}</td><td class="neg">−$${r.dd.toFixed(2)}</td><td>${r.ms}</td></tr>`;
  page(`<div class="yhead"><h2><i class="dot big" style="background:${C[s]}"></i>${NAME[s]} — year by year</h2><span class="badge">$100 start · $5 risk</span></div>
<div class="tiles">
${tile('Start → End', `${bal(START)} → ${bal(x.end)}`, `${dm(FIRST[s])} → ${dm(T1)}`)}
${tile('Profit', m2(x.net), pc(x.net / START, 0) + ' growth', 'good')}
${tile('Max drawdown', '−$' + x.dd.toFixed(2), `${pcu(x.ddPct)} of peak · ${mo(x.ddPeakT)} → ${mo(x.ddLowT)}`, 'bad')}
${tile('Longest losing streak', `${x.ms} trades`, `−$${Math.abs(x.msLoss).toFixed(2)} · ${dm(x.msA)} → ${dm(x.msB)}`, 'bad')}
${tile('Lowest balance', bal(x.low), x.lowT ? dm(x.lowT) : 'never below $100')}
${tile('Trades / win rate', `${x.n} / ${pcu(x.wr, 0)}`, `${x.tp} hit the 4R target`)}
</div>
<table class="t yt"><tr><th>Year</th><th>Balance before</th><th>Balance after</th><th>Profit</th><th>Growth that year</th><th>Trades</th><th>Win rate</th><th>Hit target</th><th>Gross (before costs)</th><th>Fees</th><th>Slippage</th><th>Funding</th><th>Max drawdown in year</th><th>Losing streak in year</th></tr>
${Y.map(yrow).join('')}<tr class="tot"><td><b>Total</b></td><td>${bal(START)}</td><td><b>${bal(x.end)}</b></td><td class="${cls(x.net)}"><b>${m2(x.net)}</b></td><td class="${cls(x.net)}">${pc(x.net / START)}</td><td>${x.n}</td><td>${pcu(x.wr, 0)}</td><td>${x.tp}</td><td>${m2(x.gross)}</td><td class="neg">${m2(x.fee)}</td><td class="neg">${m2(x.slip)}</td><td class="${cls(x.fund)}">${m2(x.fund)}</td><td class="neg">−$${x.dd.toFixed(2)}</td><td>${x.ms}</td></tr></table>
<div class="cols2 charts"><div><div class="ct">Balance after every trade</div>${lineChart([{ pts: x.eq, color: C[s], label: s, start: START, t0: FIRST[s] }], { h: 290, base: START, w: 640 })}</div>
<div><div class="ct">Drop below the previous high (drawdown)</div>${underwater(x.eq, START, { h: 290, w: 640 })}</div></div>
<p class="note">"Growth that year" = profit ÷ balance at the start of that year. Funding: minus = paid, plus = received. * 2026 is 1 Jan → ${dm(T1)}.${s === 'ADA' && endOpen.length ? ' One ADA trade was still open on the last candle and is valued at that close.' : ''}</p>`);
  const mv = Object.values(CM[s]).map((c) => c.net), scale = Math.max(...mv.map(Math.abs));
  const top = [...x.eps].sort((a, b) => b.depth - a.depth).slice(0, 3);
  page(`<div class="yhead"><h2><i class="dot big" style="background:${C[s]}"></i>${NAME[s]} — every month</h2><span class="badge">profit per month · t = trades closed</span></div>
${heat(CM[s], years(TR[s]), scale)}
<div class="cols3">
<div class="card"><h3>Months</h3><ul class="tight">
<li>Losing months: <b>${mv.filter((v) => v < 0).length} of ${mv.length}</b> (${pcu(mv.filter((v) => v < 0).length / mv.length, 0)})</li>
<li>Best month: <b class="pos">${m2(Math.max(...mv))}</b> (${Object.entries(CM[s]).find((e) => e[1].net === Math.max(...mv))[0]})</li>
<li>Worst month: <b class="neg">${m2(Math.min(...mv))}</b> (${Object.entries(CM[s]).find((e) => e[1].net === Math.min(...mv))[0]})</li>
<li>Average month: <b>${m2(mv.reduce((a, b) => a + b, 0) / mv.length)}</b></li></ul></div>
<div class="card"><h3>3 deepest drawdowns</h3><table class="t mini"><tr><th>From high</th><th>To low</th><th>Drop</th><th>Back to high</th></tr>
${top.map((e) => `<tr><td>${dm(e.peakT)}</td><td>${dm(e.lowT)}</td><td class="neg">−$${e.depth.toFixed(2)} (${pcu(e.pct)})</td><td>${e.recT ? days(e.peakT, e.recT) + ' days' : 'not yet'}</td></tr>`).join('')}</table></div>
<div class="card"><h3>Losing streaks (how often)</h3><table class="t mini"><tr><th>Streak of</th><th>Happened</th><th>Costs about</th></tr>
${[5, 8, 10, 15].map((n) => `<tr><td>${n}+ losses in a row</td><td><b>${sc[n]}×</b></td><td class="neg">−$${(n * 5.1).toFixed(0)}+</td></tr>`).join('')}</table>
<p class="note">Longest: <b>${x.ms}</b> in a row (${dm(x.msA)} → ${dm(x.msB)}).</p></div>
</div>`);
}

// 13. combined years
{
  const yrow = (r) => `<tr><td><b>${r.y}${r.y === yr(T1) ? '*' : ''}</b></td>${COINS.map((s) => { const q = CY[s].find((z) => z.y === r.y); return q ? `<td class="${cls(q.net)}">${m2(q.net)}</td>` : '<td class="na">—</td>'; }).join('')}
<td>${bal(r.startBal)}</td><td><b>${bal(r.endBal)}</b></td><td class="${cls(r.net)}"><b>${m2(r.net)}</b></td><td class="${cls(r.net)}"><b>${pc(r.net / r.startBal)}</b></td><td class="${cls(r.net)}">${pc(r.net / TOTAL0)}</td><td>${r.n}</td><td class="neg">${m2(r.fee + r.slip + r.fund)}</td><td class="neg">−$${r.dd.toFixed(2)}</td><td>${r.ms}</td></tr>`;
  page(`<h2>All 5 coins combined — year by year ($500 account)</h2>
<p class="sub">Balance before and after each year for the whole $500, and how much the capital grew. Coin columns show each coin's profit that year.</p>
<table class="t yt"><tr><th>Year</th>${COINS.map((s) => `<th><i class="dot" style="background:${C[s]}"></i>${s}</th>`).join('')}<th>Balance before</th><th>Balance after</th><th>Profit</th><th>Growth that year</th><th>Growth on the $500</th><th>Trades</th><th>All costs</th><th>Max drawdown in year</th><th>Losing streak in year</th></tr>
${AY.map(yrow).join('')}<tr class="tot"><td><b>Total</b></td>${COINS.map((s) => `<td class="${cls(CS[s].net)}"><b>${m2(CS[s].net)}</b></td>`).join('')}<td>${bal(TOTAL0)}</td><td><b>${bal(AS.end)}</b></td><td class="pos"><b>${m2(AS.net)}</b></td><td class="pos"><b>${pc(AS.net / TOTAL0)}</b></td><td class="pos">${pc(AS.net / TOTAL0)}</td><td>${AS.n}</td><td class="neg">${m2(AS.fee + AS.slip + AS.fund)}</td><td class="neg">−$${AS.dd.toFixed(2)}</td><td>${AS.ms}</td></tr></table>
<div class="cols2 charts"><div><div class="ct">Profit per year, per coin</div>${legend()}${yearBars({ w: 640, h: 300 })}</div>
<div><div class="ct">Combined $500 account balance</div>${lineChart([{ pts: AS.eq, color: C.total, label: 'All 5', start: TOTAL0, w: 2 }], { h: 318, base: TOTAL0, w: 640 })}</div></div>
<p class="note">"Growth that year" = profit ÷ balance at the start of the year. "Growth on the $500" = profit ÷ the original $500 (comparable across years because the risk stays $5). 2020 and 2021 are partial for some coins (SOL from Sep 2020, NEAR from Oct 2020, GALA from Sep 2021). * 2026 = 1 Jan → ${dm(T1)}.</p>`);
}

// 14. combined months
{
  const mv = Object.values(AM).map((c) => c.net), scale = Math.max(...mv.map(Math.abs));
  page(`<h2>All 5 coins combined — every month</h2>
<p class="sub">Profit of the whole $500 account per month, after all costs. t = trades closed that month.</p>
${heat(AM, YEARS, scale)}
<div class="cols3"><div class="card"><h3>Months</h3><ul class="tight"><li>Losing months: <b>${mv.filter((v) => v < 0).length} of ${mv.length}</b> (${pcu(mv.filter((v) => v < 0).length / mv.length, 0)})</li>
<li>Best: <b class="pos">${m2(Math.max(...mv))}</b> (${Object.entries(AM).find((e) => e[1].net === Math.max(...mv))[0]})</li><li>Worst: <b class="neg">${m2(Math.min(...mv))}</b> (${Object.entries(AM).find((e) => e[1].net === Math.min(...mv))[0]})</li>
<li>Average month: <b>${m2(mv.reduce((a, b) => a + b, 0) / mv.length)}</b> (${pc(mv.reduce((a, b) => a + b, 0) / mv.length / TOTAL0)} of $500)</li></ul></div>
<div class="card"><h3>Losing months in a row</h3><p>${(() => { let s = 0, m = 0; for (const k of Object.keys(AM).sort()) { if (AM[k].net < 0) { s++; m = Math.max(m, s); } else s = 0; } return `Longest run of losing months for the whole account: <b>${m}</b>.`; })()}</p></div>
<div class="card"><h3>Why mixing coins helps</h3><p>Single coins lose about 1 month in 3. Because coins rarely all lose in the same month, the combined account has fewer and smaller losing months.</p></div></div>`);
}

// 15. be prepared
{
  const top = [...AS.eps].sort((a, b) => b.depth - a.depth).slice(0, 5);
  const worstMonth = Math.min(...Object.values(AM).map((c) => c.net)), worstYear = Math.min(...AY.map((r) => r.net));
  const longestUnder = Math.max(...AS.eps.map((e) => days(e.peakT, e.recT || T1)));
  page(`<h2>Be prepared — the bad stretches</h2>
<p class="sub">These all happened in the backtest and will happen again live. Knowing them in advance is what stops you from switching the bot off at the worst moment.</p>
<div class="tiles">
${tile('Worst drawdown (all 5)', '−$' + AS.dd.toFixed(2), pcu(AS.ddPct) + ' of the peak balance', 'bad')}
${tile('Longest losing streak (all 5)', AS.ms + ' trades', '−$' + Math.abs(AS.msLoss).toFixed(2), 'bad')}
${tile('Worst month (all 5)', m2(worstMonth), pc(worstMonth / TOTAL0) + ' of $500', 'bad')}
${tile('Worst year (all 5)', m2(worstYear), AY.find((r) => r.net === worstYear).y + (AY.find((r) => r.net === worstYear).y === yr(T0) ? ' (partial year)' : '') + (worstYear > 0 ? ' · still positive' : ''), worstYear > 0 ? 'good' : 'bad')}
${tile('Longest time below a high', longestUnder + ' days', 'before a new high balance')}
${tile('Each losing trade', '≈ −$5', '5% of a fresh $100 coin balance')}
</div>
<div class="cols2"><div class="card"><h3>5 deepest drawdowns of the $500 account</h3><table class="t mini"><tr><th>#</th><th>From high</th><th>To low</th><th>Drop</th><th>% of peak</th><th>Back to a new high</th></tr>
${top.map((e, i) => `<tr><td>${i + 1}</td><td>${dm(e.peakT)} (${bal(e.peak)})</td><td>${dm(e.lowT)}</td><td class="neg">−$${e.depth.toFixed(2)}</td><td>${pcu(e.pct)}</td><td>${e.recT ? days(e.peakT, e.recT) + ' days' : 'not yet'}</td></tr>`).join('')}</table></div>
<div class="card"><h3>Worst case per coin if you start at the worst moment</h3><table class="t mini"><tr><th>Coin</th><th>Max drawdown</th><th>$100 would drop to</th><th>Longest streak</th><th>Streaks of 8+</th></tr>
${COINS.map((s) => `<tr><td><i class="dot" style="background:${C[s]}"></i>${s}</td><td class="neg">−$${CS[s].dd.toFixed(2)}</td><td><b>${bal(START - CS[s].dd)}</b></td><td>${CS[s].ms}</td><td>${SC[s][8]}×</td></tr>`).join('')}
<tr class="tot"><td>All 5</td><td class="neg">−$${AS.dd.toFixed(2)}</td><td><b>${bal(TOTAL0 - AS.dd)}</b> of $500</td><td>${AS.ms}</td><td>${SC.ALL[8]}×</td></tr></table></div></div>
<div class="card warn"><h3>Rules to set before going live</h3><ul class="tight">
<li><b>Expect</b> a ${AS.ms}-trade losing streak and a −$${AS.dd.toFixed(0)} drop on the $500 account at some point. Both are normal for this strategy.</li>
<li><b>Kill switch</b>: stop the bot if the $500 account falls about <b>2× the worst drawdown</b> from its high (≈ −$${(2 * AS.dd).toFixed(0)}). That would mean something changed.</li>
<li><b>$5 risk = 5% of each $100</b>. A single coin can lose ${Math.min(...COINS.map((s) => CS[s].dd)).toFixed(0)}–${Math.max(...COINS.map((s) => CS[s].dd)).toFixed(0)}% of its starting $100 in its worst stretch — only run it with money you can leave alone for months.</li>
<li><b>Judge it on 6–12 months</b>, not weeks. Roughly 1 month in 3 is a loss even when everything works.</li></ul></div>`);
}

// 16. overall profitability
{
  const contrib = COINS.map((s) => ({ label: s, v: CS[s].net, color: C[s] }));
  const growth = COINS.map((s) => ({ label: s, v: CS[s].net / START, color: C[s] }));
  const costs = AS.fee + AS.slip + AS.fund;
  page(`<h2>Overall result on the $500 capital</h2>
<div class="hero"><div><div class="tl">Starting capital</div><div class="hv">$${TOTAL0.toFixed(2)}</div></div><div class="arrow">→</div><div><div class="tl">Ending capital</div><div class="hv">$${AS.end.toFixed(2)}</div></div>
<div class="sep"></div><div><div class="tl">Total profit</div><div class="hv pos">${m2(AS.net)}</div></div><div><div class="tl">Total return on $500</div><div class="hv pos">${pc(AS.net / TOTAL0, 1)}</div></div><div><div class="tl">Average per year</div><div class="hv pos">${pc(AS.net / TOTAL0 / spanYears, 1)}</div></div></div>
<div class="cols2 charts"><div><div class="ct">Profit by coin</div>${coinHBars(contrib, (v) => m2(v), { w: 640, h: 250 })}</div><div><div class="ct">Growth of each coin's $100</div>${coinHBars(growth, (v) => pc(v, 0), { w: 640, h: 250 })}</div></div>
<div class="cols3">
<div class="card"><h3>Where the money went</h3><table class="t mini"><tr><td>Gross profit (before costs)</td><td class="pos">${m2(AS.gross)}</td></tr><tr><td>Trading fees</td><td class="neg">${m2(AS.fee)}</td></tr><tr><td>Slippage</td><td class="neg">${m2(AS.slip)}</td></tr><tr><td>Funding</td><td class="${cls(AS.fund)}">${m2(AS.fund)}</td></tr><tr class="tot"><td><b>Net profit</b></td><td class="pos"><b>${m2(AS.net)}</b></td></tr></table>
<p class="note">Costs took ${pcu(-costs / AS.gross)} of the gross profit (≈ $${(-costs / AS.n).toFixed(2)} per trade).</p></div>
<div class="card"><h3>In numbers</h3><ul class="tight"><li><b>${AS.n}</b> trades over ${spanYears.toFixed(1)} years (≈ ${(AS.n / spanYears).toFixed(0)} a year, ≈ ${(AS.n / spanYears / 52).toFixed(1)} a week)</li>
<li>Win rate <b>${pcu(AS.wr, 0)}</b>; ${AS.tp} trades hit the 4R target</li><li>Every year profitable for the combined account (worst ${m2(Math.min(...AY.map((r) => r.net)))})</li>
<li>Max drawdown <b>−$${AS.dd.toFixed(2)}</b> (${pcu(AS.ddPct)}), longest losing streak <b>${AS.ms}</b></li></ul></div>
<div class="card warn"><h3>Before you trust these numbers</h3><ul class="tight small"><li>This is a backtest, not live trading. Real fills and bot downtime can make results worse.</li>
<li>These 5 coins were picked <i>because</i> they did well. Across ~90 coins the average result since 2023 was about a third of these coins'. Expect live results to be lower.</li>
<li>Profit is not compounded: risk stays $5 the whole time.</li><li>Not included: server cost (~$5/month if you rent one), deposit/withdrawal fees, taxes.</li></ul></div></div>`);
}

// ---------------------------------------------------------------- html → pdf
const css = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; } html, body { margin: 0; background: #e9e8e4; color: ${C.ink}; font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 297mm; height: 210mm; padding: 11mm 13mm 12mm; background: ${C.surface}; margin: 8px auto; position: relative; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 30px; margin: 4px 0 10px; line-height: 1.15; } h1 span { font-size: 17px; font-weight: 500; color: ${C.ink2}; }
h2 { font-size: 20px; margin: 0 0 3px; } h3 { font-size: 11.5px; margin: 0 0 5px; }
.kicker { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: ${C.muted}; font-weight: 700; }
.lead { font-size: 13px; line-height: 1.5; max-width: 900px; color: ${C.ink2}; margin: 0 0 12px; }
.sub { font-size: 10.5px; color: ${C.ink2}; margin: 0 0 6px; } p { font-size: 10px; line-height: 1.45; margin: 0 0 4px; }
.note { font-size: 9px; color: ${C.muted}; margin-top: 5px; }
.tiles { display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px; margin: 6px 0 8px; } .tiles.big { grid-template-columns: repeat(3, 1fr); gap: 9px; }
.tile { background: #fff; border: 1px solid ${C.grid}; border-radius: 8px; padding: 7px 10px; } .tile .tl { font-size: 9px; color: ${C.muted}; text-transform: uppercase; letter-spacing: .04em; font-weight: 700; }
.tile .tv { font-size: 16px; font-weight: 700; margin: 2px 0 1px; } .tiles.big .tv { font-size: 21px; } .tile .ts { font-size: 9px; color: ${C.ink2}; }
.tile.good .tv { color: ${C.posD}; } .tile.bad .tv { color: ${C.negD}; }
.card { background: #fff; border: 1px solid ${C.grid}; border-radius: 8px; padding: 8px 11px; } .card.warn { border-color: #f0c9c8; background: #fff8f7; margin-top: 8px; }
.cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 6px; } .cols3 { display: grid; grid-template-columns: 1fr 1.25fr 1fr; gap: 9px; margin-top: 8px; }
.charts > div { background: #fff; border: 1px solid ${C.grid}; border-radius: 8px; padding: 6px 8px 2px; } .ct { font-size: 10.5px; font-weight: 700; margin-bottom: 2px; }
ul.tight { margin: 2px 0; padding-left: 15px; font-size: 10px; line-height: 1.45; } ul.tight li { margin-bottom: 2px; } ul.small { font-size: 9.3px; }
table.t { width: 100%; border-collapse: collapse; font-size: 9.6px; margin-top: 6px; } table.t th { font-size: 8.6px; color: ${C.ink2}; text-align: right; font-weight: 700; padding: 4px 5px; border-bottom: 1px solid ${C.axis}; vertical-align: bottom; }
table.t td { text-align: right; padding: 3.5px 5px; border-bottom: 1px solid ${C.grid}; white-space: nowrap; } table.t td:first-child, table.t th:first-child { text-align: left; }
table.mini { font-size: 9.3px; margin-top: 2px; } table.mini td { padding: 2.5px 4px; }
tr.tot td { background: #f4f3ef; border-top: 1px solid ${C.axis}; }
.pos { color: ${C.posD}; } .neg { color: ${C.negD}; } .na { color: ${C.muted}; text-align: center !important; }
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; vertical-align: 0; } .dot.big { width: 13px; height: 13px; margin-right: 8px; }
.legend { display: flex; gap: 12px; font-size: 9.5px; color: ${C.ink2}; margin: 2px 0; } .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
.yhead { display: flex; justify-content: space-between; align-items: center; } .badge { font-size: 10px; font-weight: 700; background: ${C.neutral}; border: 1px solid ${C.axis}; border-radius: 99px; padding: 3px 11px; }
table.heat { width: 100%; border-collapse: separate; border-spacing: 2px; font-size: 10px; margin-top: 6px; } table.heat th { font-size: 9px; color: ${C.ink2}; padding: 3px; }
table.heat td { text-align: center; padding: 9px 2px 8px; border-radius: 4px; font-weight: 600; } table.heat td span { display: block; font-size: 7.5px; font-weight: 500; color: ${C.ink2}; }
table.heat td.strong { color: #fff; } table.heat td.strong span { color: #f2f2f2; } table.heat td.na { background: ${C.neutral}; color: ${C.axis}; }
table.heat td.yl { font-weight: 700; text-align: left; padding-left: 6px; } table.heat td.tot { background: #f4f3ef; font-weight: 700; }
.hero { display: flex; align-items: center; gap: 22px; background: #fff; border: 1px solid ${C.grid}; border-radius: 10px; padding: 12px 18px; margin: 8px 0 4px; }
.hero .tl { font-size: 9.5px; color: ${C.muted}; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; } .hero .hv { font-size: 26px; font-weight: 800; } .hero .arrow { font-size: 24px; color: ${C.muted}; } .hero .sep { width: 1px; align-self: stretch; background: ${C.grid}; }
.cover .cols2 .card { min-height: 0; }
.foot { position: absolute; bottom: 5mm; left: 13mm; right: 13mm; display: flex; justify-content: space-between; font-size: 8.5px; color: ${C.muted}; }
@media print { body { background: #fff; } .page { margin: 0; } }`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(TITLE)}</title><style>${css}</style>
<script>addEventListener('DOMContentLoaded',()=>{const m=location.hash.match(/p(\\d+)/);if(m){const n=+m[1];document.querySelectorAll('.page').forEach((p,i)=>{if(i!==n-1)p.style.display='none';else p.style.margin='0';});document.body.style.background='#fff';}});</script></head>
<body>${pages.join('\n')}</body></html>`;
fs.mkdirSync(PDF_DIR, { recursive: true });
const htmlPath = path.join(__dirname, 'capital-report-5coin.html'), pdfPath = path.join(PDF_DIR, TITLE + '.pdf');
fs.writeFileSync(htmlPath, html);
const url = 'file:///' + htmlPath.replace(/\\/g, '/');
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', `--print-to-pdf=${pdfPath}`, url], { stdio: 'ignore' });
console.error('pages:', pages.length, '→', pdfPath);
if (process.argv.includes('--shots')) {
  const dir = process.env.SHOTS_DIR || path.join(__dirname, 'shots-capital'); fs.mkdirSync(dir, { recursive: true });
  for (let n = 1; n <= pages.length; n++) execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1123,794', `--screenshot=${path.join(dir, `p${n}.png`)}`, `${url}#p${n}`], { stdio: 'ignore' });
  console.error('shots in', dir);
}
