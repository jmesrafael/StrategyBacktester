// build-report.js — BB Breakout six-year PDF report (coins from BB_COINS; default SOL / ZEC / NEAR / ADA / GALA). Every number comes from ../bb-deep.js (same bot, same costs).
// usage: node build-report.js                      -> BB-Breakout-6yr-Report.html + .pdf (headless Chrome prints the HTML)
//        node build-report.js --shots [--only=1,5]  -> also screenshots pages to ./shots for checking the layout
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
process.env.BB_COINS = process.env.BB_COINS || 'SOL,ZEC,NEAR,ADA,GALA'; process.env.BB_TAG = process.env.BB_TAG || '-5coin';
const D = require('../bb-deep.js'), L = require('../lib.js');
const { T, T3, T2x, SA, SALL, MROWS, REG, checks, FEATRES, BUCK, HYPR, THR, st, COINS, RISK, START } = D;
const OUT = __dirname, CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// ---------------------------------------------------------------- palette (dataviz reference, light mode; coin slots validated all-pairs)
const C = { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#8a897f', grid: '#e1e0d9', axis: '#c3c2b7', neutral: '#f0efec',
  SOL: '#2a78d6', ZEC: '#eb6834', NEAR: '#1baf7a', ADA: '#7a4fd1', GALA: '#c28a00', BTC: '#8a897f', pos: '#2a78d6', neg: '#e34948', posD: '#1c5cab', negD: '#b8302f', total: '#52514e' };
const NAME = { SOL: 'Solana (SOL)', ZEC: 'Zcash (ZEC)', NEAR: 'NEAR Protocol (NEAR)', ADA: 'Cardano (ADA)', GALA: 'Gala (GALA)', BTC: 'Bitcoin (BTC)' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// ---------------------------------------------------------------- formatting
const usd = (v) => (Math.abs(v) < 0.5 ? '$0' : (v < 0 ? '−$' : '+$') + Math.abs(v).toFixed(0));
const usdP = (v) => '$' + Math.round(v).toLocaleString('en-US');
const pct = (v) => (v == null || !isFinite(v) ? '—' : (v * 100).toFixed(0) + '%');
const spct = (v) => (v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '+') + Math.abs(v * 100).toLocaleString('en-US', { maximumFractionDigits: 0 }) + '%');
const r2 = (v) => (v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2) + 'R');
const pf = (v) => (v == null ? '—' : !isFinite(v) ? '∞' : v.toFixed(2));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const dm = (t) => { const d = new Date(t * 1000); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const yr = (t) => new Date(t * 1000).getUTCFullYear();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cls = (v) => (v > 0.5 ? 'pos' : v < -0.5 ? 'neg' : '');
const price = (p) => (p >= 100 ? '$' + Math.round(p).toLocaleString('en-US') : p >= 10 ? '$' + p.toFixed(1) : '$' + p.toFixed(2));

// ---------------------------------------------------------------- svg chart kit
const nice = (lo, hi, n = 5) => { if (lo === hi) { lo -= 1; hi += 1; } const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t = [];
  for (let v = a; v <= b + step / 2; v += step) t.push(+v.toFixed(10)); return t; };
const txt = (x, y, s, o = {}) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.size || 10}" fill="${o.fill || C.ink2}" text-anchor="${o.anchor || 'start'}"${o.weight ? ` font-weight="${o.weight}"` : ''}>${esc(s)}</text>`;
const svgOpen = (w, h) => `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">`;
// bar with 4px rounded far end, square at the baseline
const bar = (x, y0, w, y1, fill) => { const top = Math.min(y0, y1), h = Math.abs(y1 - y0); if (h < 0.5) return ''; const r = Math.min(4, w / 2, h);
  return y1 < y0 ? `<path d="M${x},${y0}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${y0}Z" fill="${fill}"/>`
    : `<path d="M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z" fill="${fill}"/>`; };
const hbar = (x0, y, h, x1, fill) => { const w = Math.abs(x1 - x0); if (w < 0.5) return ''; const r = Math.min(4, h / 2, w);
  return x1 > x0 ? `<path d="M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z" fill="${fill}"/>`
    : `<path d="M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z" fill="${fill}"/>`; };

// time-series line chart, one y axis. series: [{name, color, pts:[[t,v]], width?, dash?}]
function lineChart({ w, h, series, yFmt = (v) => v, log = false, zero = false, xFmt = 'year', area = null, markers = [], label = true, padR = 64 }) {
  const m = { l: 52, r: label ? padR : 12, t: 10, b: 22 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])), ys = series.flatMap((s) => s.pts.map((p) => p[1])).concat(area ? area.pts.map((p) => p[1]) : []).concat(markers.map((k) => k.y));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys); if (zero) { y0 = Math.min(0, y0); y1 = Math.max(0, y1); }
  const tf = log ? (v) => Math.log10(v) : (v) => v;
  let ticks;
  if (log) { const a = Math.floor(Math.log10(y0)), b = Math.ceil(Math.log10(y1)); ticks = []; for (let e = a; e <= b; e++) for (const k of [1, 2, 5]) { const v = k * 10 ** e; if (v >= y0 * 0.8 && v <= y1 * 1.25) ticks.push(v); } if (ticks.length > 7) ticks = ticks.filter((v) => String(v).startsWith('1')); y0 = Math.min(y0, ticks[0]); y1 = Math.max(y1, ticks[ticks.length - 1]); }
  else { ticks = nice(y0, y1, 4); y0 = Math.min(y0, ticks[0]); y1 = Math.max(y1, ticks[ticks.length - 1]); }
  const X = (t) => m.l + (t - x0) / (x1 - x0 || 1) * iw, Y = (v) => m.t + ih - (tf(v) - tf(y0)) / (tf(y1) - tf(y0) || 1) * ih;
  let g = svgOpen(w, h);
  for (const v of ticks) g += `<line x1="${m.l}" x2="${m.l + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 && !log ? C.axis : C.grid}" stroke-width="1"/>` + txt(m.l - 6, Y(v) + 3.5, yFmt(v), { anchor: 'end', size: 9, fill: C.muted });
  if (xFmt === 'year') { for (let y = yr(x0); y <= yr(x1) + 1; y++) { const t = Date.UTC(y, 0, 1) / 1000; if (t < x0 || t > x1) continue; g += `<line x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${m.t + ih}" stroke="${C.grid}" stroke-dasharray="2 3"/>` + txt(X(t) + 3, m.t + ih + 14, String(y), { size: 9, fill: C.muted }); } }
  else { const y = yr(x0); for (let mo = 0; mo < 12; mo++) { const t = Date.UTC(y, mo, 1) / 1000, t2 = Date.UTC(y, mo + 1, 1) / 1000; if (t2 < x0 || t > x1) continue; if (t >= x0) g += `<line x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${m.t + ih}" stroke="${C.grid}" stroke-dasharray="2 3"/>`; g += txt(X(Math.max(t, x0)) + 3, m.t + ih + 14, MON[mo], { size: 9, fill: C.muted }); } }
  if (area) { const p = area.pts; g += `<path d="M${X(p[0][0])},${Y(0)}${p.map((q) => `L${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join('')}L${X(p[p.length - 1][0])},${Y(0)}Z" fill="${area.fill}" opacity="${area.opacity || 0.35}"/>`; }
  for (const s of series) g += `<path d="${s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('')}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linejoin="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`;
  for (const k of markers) { const x = X(k.t), y = Y(k.y), s = 4.6;
    g += k.dir === 1 ? `<path d="M${x},${y - s}L${x + s},${y + s * 0.8}L${x - s},${y + s * 0.8}Z" fill="${k.fill}" stroke="${C.surface}" stroke-width="1.5"/>` : `<path d="M${x},${y + s}L${x + s},${y - s * 0.8}L${x - s},${y - s * 0.8}Z" fill="${k.fill}" stroke="${C.surface}" stroke-width="1.5"/>`; }
  if (label) { // direct labels at the right end, nudged apart
    const ends = series.filter((s) => s.name).map((s) => ({ s, y: Y(s.pts[s.pts.length - 1][1]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
    for (const e of ends) g += txt(m.l + iw + 6, e.y + 3.5, e.s.name, { size: 10, fill: C.ink, weight: 600 }) + `<circle cx="${m.l + iw}" cy="${Y(e.s.pts[e.s.pts.length - 1][1])}" r="3" fill="${e.s.color}" stroke="${C.surface}" stroke-width="1.5"/>`;
  }
  return g + '</svg>';
}
// vertical bars, diverging colours by sign, value labels
function barChart({ w, h, items, yFmt = usd, showVals = true }) {
  const m = { l: 44, r: 8, t: 14, b: 20 }, iw = w - m.l - m.r, ih = h - m.t - m.b, vs = items.map((d) => d.v);
  const ticks = nice(Math.min(0, ...vs), Math.max(0, ...vs), 4), y1 = ticks[ticks.length - 1];
  const y0 = Math.min(...vs) < 0 ? ticks[0] - (y1 - ticks[0]) * 0.1 : ticks[0]; // headroom below so negative value labels clear the month labels
  const Y = (v) => m.t + ih - (v - y0) / (y1 - y0) * ih, bw = iw / items.length;
  let g = svgOpen(w, h);
  for (const v of ticks) g += `<line x1="${m.l}" x2="${m.l + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? C.axis : C.grid}"/>` + txt(m.l - 6, Y(v) + 3.5, yFmt(v), { anchor: 'end', size: 9, fill: C.muted });
  items.forEach((d, i) => { const x = m.l + i * bw + bw * 0.18, ww = bw * 0.64;
    g += bar(x, Y(0), ww, Y(d.v), d.v >= 0 ? C.pos : C.neg);
    if (d.n === 0) g += txt(x + ww / 2, Y(0) - 3, '·', { anchor: 'middle', size: 9, fill: C.muted });
    else if (showVals && Math.abs(d.v) >= 0.05) g += txt(x + ww / 2, d.v >= 0 ? Y(d.v) - 3 : Y(d.v) + 10, yFmt(d.v).replace('+', ''), { anchor: 'middle', size: 8.5, fill: C.ink2 });
    g += txt(x + ww / 2, m.t + ih + 13, d.label, { anchor: 'middle', size: 9, fill: C.muted }); });
  return g + '</svg>';
}
// grouped bars: groups [{label, vals:[{key, v}]}]
function groupedBars({ w, h, groups, keys, colors, yFmt = usd }) {
  const m = { l: 48, r: 8, t: 16, b: 22 }, iw = w - m.l - m.r, ih = h - m.t - m.b, vs = groups.flatMap((g) => g.vals.map((v) => v.v).filter((v) => v != null));
  const ticks = nice(Math.min(0, ...vs), Math.max(0, ...vs), 4), y0 = ticks[0], y1 = ticks[ticks.length - 1], Y = (v) => m.t + ih - (v - y0) / (y1 - y0) * ih, gw = iw / groups.length;
  let g = svgOpen(w, h);
  for (const v of ticks) g += `<line x1="${m.l}" x2="${m.l + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? C.axis : C.grid}"/>` + txt(m.l - 6, Y(v) + 3.5, yFmt(v), { anchor: 'end', size: 9, fill: C.muted });
  groups.forEach((gr, i) => { const bw = gw * 0.78 / keys.length; keys.forEach((k, j) => { const d = gr.vals.find((v) => v.key === k); if (!d || d.v == null) return;
    const x = m.l + i * gw + gw * 0.11 + j * bw; g += bar(x + 1, Y(0), bw - 2, Y(d.v), colors[k]);
    g += txt(x + bw / 2, d.v >= 0 ? Y(d.v) - 3 : Y(d.v) + 10, Math.round(d.v).toString().replace('-', '−'), { anchor: 'middle', size: 8, fill: C.ink2 }); });
    g += txt(m.l + i * gw + gw / 2, m.t + ih + 14, gr.label, { anchor: 'middle', size: 9.5, fill: C.ink2 }); });
  return g + '</svg>';
}
// horizontal bars (bucket analysis); optional side note in its own right-hand column
function hbars({ w, items, fmt = r2, rowH = 22, labelW = 170 }) {
  const subW = items.some((d) => d.sub) ? 150 : 0, h = items.length * rowH + 24, m = { l: labelW, r: 58 + subW, t: 6, b: 18 }, iw = w - m.l - m.r, vs = items.map((d) => d.v);
  const ticks = nice(Math.min(0, ...vs), Math.max(0, ...vs), 3), x0 = ticks[0], x1 = ticks[ticks.length - 1], X = (v) => m.l + (v - x0) / (x1 - x0) * iw;
  let g = svgOpen(w, h);
  for (const v of ticks) g += `<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${h - m.b}" stroke="${v === 0 ? C.axis : C.grid}"/>` + txt(X(v), h - 5, fmt(v).replace('+', ''), { anchor: 'middle', size: 8.5, fill: C.muted });
  items.forEach((d, i) => { const y = m.t + i * rowH + 4, bh = rowH - 8; g += txt(m.l - 8, y + bh / 2 + 3.5, d.label, { anchor: 'end', size: 9.5, fill: C.ink2 });
    // value label always sits right of the bar's outer end (or right of zero for negatives) so it never collides with the row label
    g += hbar(X(0), y, bh, X(d.v), d.v >= 0 ? C.pos : C.neg) + txt((d.v >= 0 ? X(d.v) : X(0)) + 5, y + bh / 2 + 3.5, fmt(d.v), { size: 9, fill: d.v >= 0 ? C.ink : C.negD, weight: 600 });
    if (d.sub) g += txt(w - subW + 6, y + bh / 2 + 3.5, d.sub, { size: 9, fill: C.ink2 }); });
  return g + '</svg>';
}
// diverging colour for heatmap cells
const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const heatCol = (v, max) => { const t = Math.min(1, Math.abs(v) / max) ** 0.8; return v >= 0 ? mix(C.neutral, C.posD, t) : mix(C.neutral, C.negD, t); };
const lum = (hex) => { const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; };
function heatmap({ w, sym, max }) {
  const rows = [...new Set(MROWS.filter((r) => r.sym === sym).map((r) => r.y))], cw = (w - 40 - 46) / 12, ch = COINS.length > 3 ? 14 : 19, h = rows.length * ch + 20;
  let g = svgOpen(w, h);
  MON.forEach((mn, i) => (g += txt(40 + i * cw + cw / 2, 10, mn[0], { anchor: 'middle', size: 8.5, fill: C.muted })));
  g += txt(40 + 12 * cw + 23, 10, 'Year', { anchor: 'middle', size: 8.5, fill: C.muted });
  rows.forEach((y, j) => { const yy = 16 + j * ch; g += txt(34, yy + ch / 2 + 3, String(y), { anchor: 'end', size: 9, fill: C.ink2 });
    for (let mo = 0; mo < 12; mo++) { const r = MROWS.find((q) => q.sym === sym && q.key === `${y}-${String(mo + 1).padStart(2, '0')}`); const x = 40 + mo * cw;
      if (!r) { g += `<rect x="${x + 1}" y="${yy + 1}" width="${cw - 2}" height="${ch - 2}" rx="3" fill="none" stroke="${C.grid}" stroke-dasharray="2 2"/>`; continue; }
      const v = r.n ? r.z.net : null, col = v == null ? C.neutral : heatCol(v, max);
      g += `<rect x="${x + 1}" y="${yy + 1}" width="${cw - 2}" height="${ch - 2}" rx="3" fill="${col}"/>`;
      g += txt(x + cw / 2, yy + ch / 2 + 3.2, v == null ? '·' : Math.round(v).toString().replace('-', '−'), { anchor: 'middle', size: 8.5, fill: lum(col) < 0.45 ? '#ffffff' : C.ink }); }
    const ys = MROWS.filter((q) => q.sym === sym && q.y === y).reduce((a, q) => a + q.z.net, 0);
    g += txt(40 + 12 * cw + 23, yy + ch / 2 + 3.2, usd(ys), { anchor: 'middle', size: 9, fill: ys >= 0 ? C.posD : C.negD, weight: 700 }); });
  return g + '</svg>';
}
function histogram({ w, h, vals, marks, bins = 30, xFmt }) {
  const m = { l: 36, r: 12, t: 26, b: 22 }, iw = w - m.l - m.r, ih = h - m.t - m.b, lo = 0, hi = Math.max(...vals) * 1.02, bwid = (hi - lo) / bins, cnt = new Array(bins).fill(0);
  for (const v of vals) cnt[Math.min(bins - 1, Math.floor((v - lo) / bwid))]++;
  const ymax = Math.max(...cnt), X = (v) => m.l + (v - lo) / (hi - lo) * iw, Y = (c) => m.t + ih - c / ymax * ih;
  let g = svgOpen(w, h) + `<line x1="${m.l}" x2="${m.l + iw}" y1="${Y(0)}" y2="${Y(0)}" stroke="${C.axis}"/>`;
  cnt.forEach((c, i) => (g += bar(X(lo + i * bwid) + 1, Y(0), iw / bins - 2, Y(c), '#86b6ef')));
  for (const t of nice(lo, hi, 6)) if (t <= hi) g += txt(X(t), m.t + ih + 14, xFmt(t), { anchor: 'middle', size: 9, fill: C.muted });
  marks.forEach((k, i) => { g += `<line x1="${X(k.v)}" x2="${X(k.v)}" y1="${m.t - 4}" y2="${m.t + ih}" stroke="${k.color}" stroke-width="2"${k.dash ? ' stroke-dasharray="4 3"' : ''}/>` + txt(X(k.v) + (k.left ? -4 : 4), m.t - 14 + (i % 2) * 10, k.label, { size: 9, fill: C.ink, anchor: k.left ? 'end' : 'start', weight: 600 }); });
  return g + '</svg>';
}
// schematic of one breakout trade: synthetic prices, real Bollinger maths on them
function ruleDiagram(w = 480, h = 240) {
  const n = 52, cl = [];
  for (let i = 0; i < n; i++) cl.push(i < 26 ? 150 + Math.sin(i * 1.3) * 3 + Math.sin(i * 0.4) * 2 : i === 26 ? 132 : 132 - (i - 26) * 3.6 + Math.sin(i * 1.1) * 3);
  const X = (i) => 18 + i * 6.1, up = [], lo = [], mid = [];
  for (let i = 0; i < n; i++) { const a = cl.slice(Math.max(0, i - 9), i + 1), m = a.reduce((p, q) => p + q, 0) / a.length, sd = Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / a.length); mid.push(m); up.push(m - 2 * sd - 4); lo.push(m + 2 * sd + 4); }
  const pth = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${v.toFixed(1)}`).join('');
  const si = 26, ey = cl[si] - 1, stop = mid[si], R = stop - ey, tp = ey - 4 * R, x0 = X(si);
  let g = svgOpen(w, h);
  g += `<path d="${pth(up)}${lo.map((v, i) => [X(i), v]).reverse().map(([x, v]) => `L${x.toFixed(1)},${v.toFixed(1)}`).join('')}Z" fill="#cde2fb" opacity="0.6"/>`;
  g += `<path d="${pth(up)}" stroke="#5598e7" fill="none" stroke-width="1.3"/><path d="${pth(lo)}" stroke="#5598e7" fill="none" stroke-width="1.3"/><path d="${pth(mid)}" stroke="#5598e7" fill="none" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  g += `<path d="${pth(cl)}" stroke="${C.ink}" fill="none" stroke-width="1.8"/>`;
  g += `<path d="M18,214 L${X(n - 1)},196" stroke="${C.ink2}" stroke-width="1.4" stroke-dasharray="7 4" fill="none"/>` + txt(22, 232, '200-candle SMA — longs only above it, shorts only below', { size: 9.5, fill: C.ink2 });
  g += txt(22, 186, 'Bollinger bands (20, 2σ), middle band dashed', { size: 9, fill: '#1c5cab' });
  g += `<line x1="${x0}" x2="${w - 8}" y1="${tp}" y2="${tp}" stroke="${C.posD}" stroke-width="1.6"/>` + txt(w - 10, tp - 4, 'Target = 4 × stop distance (+4R)', { anchor: 'end', size: 9.5, fill: C.posD, weight: 700 });
  g += `<line x1="${x0}" x2="${w - 8}" y1="${ey}" y2="${ey}" stroke="${C.ink}" stroke-width="1"/>` + txt(w - 10, ey + 12, 'Entry at the next candle’s open', { anchor: 'end', size: 9.5, fill: C.ink, weight: 700 });
  g += `<line x1="${x0}" x2="${w - 8}" y1="${stop}" y2="${stop}" stroke="${C.neg}" stroke-width="1.6"/>` + txt(w - 10, stop + 12, 'Stop = middle band at the signal (−1R)', { anchor: 'end', size: 9.5, fill: C.negD, weight: 700 });
  g += `<circle cx="${x0}" cy="${cl[si]}" r="5" fill="${C.pos}" stroke="${C.surface}" stroke-width="2"/>`;
  g += `<line x1="${x0 - 4}" y1="${cl[si] - 6}" x2="${x0 - 30}" y2="${cl[si] - 44}" stroke="${C.ink2}" stroke-width="1"/>` + txt(x0 - 30, cl[si] - 48, 'Signal: a 4h close above the upper band', { anchor: 'middle', size: 9.5, fill: C.ink, weight: 700 });
  return g + '</svg>';
}

// ---------------------------------------------------------------- data helpers
const B4 = Object.fromEntries(COINS.map((s) => [s, L.bars(s, 240)])), SMA4 = Object.fromEntries(COINS.map((s) => [s, L.ind(s, 240).sma(200)]));
const mrows = (s, y) => MROWS.filter((r) => r.sym === s && (y == null || r.y === y));
const yearsOf = (s) => [...new Set(mrows(s).map((r) => r.y))];
const tradesY = (s, y) => T[s].filter((t) => yr(t.x) === y);
const sumUsd = (a) => a.reduce((p, t) => p + t.usd, 0);
const streakInfo = (tr) => { let best = { k: 0 }, k = 0, s0 = null, lost = 0; for (const t of tr) { if (t.R <= 0) { if (!k) s0 = t.t; k++; lost += t.usd; if (k > best.k) best = { k, s0, e: t.x, lost }; } else { k = 0; lost = 0; } } return best; };
function equitySeries(tr, start = 0) { let e = start; const pts = [[tr[0].t, start]]; for (const t of tr) { e += t.usd; pts.push([t.x, e]); } return pts; }
function underwater(tr) { let e = 0, pk = 0; const pts = [[tr[0].t, 0]]; for (const t of tr) { e += t.usd; pk = Math.max(pk, e); pts.push([t.x, e - pk]); } return pts; }
function ddPhases(tr) { const ph = []; let e = 0, pk = 0, pkT = tr[0].t, cur = null; for (const t of tr) { e += t.usd; if (e >= pk) { if (cur) { cur.rec = t.x; ph.push(cur); cur = null; } pk = e; pkT = t.x; } else { if (!cur) cur = { peak: pkT, depth: 0, n: 0, trough: t.x }; cur.n++; if (pk - e > cur.depth) { cur.depth = pk - e; cur.trough = t.x; } } } if (cur) ph.push(cur); return ph.sort((a, b) => b.depth - a.depth); }
const allStreaks = (tr) => { const out = []; let k = 0, s0 = null, lost = 0; for (const t of tr) { if (t.R <= 0) { if (!k) s0 = t.t; k++; lost += t.usd; } else { if (k) out.push({ k, s0, e: t.t, lost }); k = 0; lost = 0; } } if (k) out.push({ k, s0, e: tr[tr.length - 1].x, lost, open: true }); return out; };
// daily closes (the 20:00 UTC 4h candle's close) + the 4h SMA200 at the same timestamps
function dailyPrice(s, lo, hi) { const B = B4[s], sm = SMA4[s], p = [], q = []; for (let i = 0; i < B.length; i++) { const b = B[i]; if (b.time < lo || b.time >= hi || b.time % 86400 !== 72000) continue; p.push([b.time, b.close]); if (sm[i] != null) q.push([b.time, sm[i]]); } return { p, q }; }

// market regime wording, from measured numbers
function yearRegime(g, volMed) {
  const v = g.vol > volMed * 1.25 ? ' · high volatility' : g.vol < volMed * 0.8 ? ' · quiet' : '';
  let k;
  if (g.ret >= 0.5 && g.er >= 0.3) k = 'Strong uptrend'; else if (g.ret >= 0.2) k = g.er >= 0.25 ? 'Uptrend' : 'Up, but choppy';
  else if (g.ret <= -0.4 && g.er >= 0.3) k = 'Strong downtrend'; else if (g.ret <= -0.2) k = g.er >= 0.25 ? 'Downtrend' : 'Down, but choppy';
  else k = g.er < 0.15 ? 'Sideways / choppy' : 'Range-bound';
  return k + v;
}
const effWord = (er) => er >= 0.4 ? 'a clean, persistent trend' : er >= 0.25 ? 'a fairly directional path' : er >= 0.12 ? 'a lot of back-and-forth for the distance covered' : 'mostly a round trip — very choppy';
// broad backdrop per year (well-documented events only; 2025–26 described from the price data alone)
const BACKDROP = {
  2019: 'BTC slid from about $10k to $7k after the mid-2019 rally (only Sep–Dec is in the data).',
  2020: 'COVID crash in March (BTC fell ~50% in two days), the May halving, then an institution-led rally from October into year-end.',
  2021: 'Bull-market peak year: a run to April highs, a violent May crash (leverage flush, China mining ban), a summer range, a new BTC high in November, then decline. Altcoins (SOL especially) went parabolic.',
  2022: 'Bear market: aggressive Fed rate hikes, the LUNA/UST collapse in May, Celsius/3AC in June, and the FTX collapse in November — which hit SOL hardest because FTX/Alameda were major backers.',
  2023: 'Recovery: March banking stress, then a grinding rally, accelerating in Oct–Dec on spot-ETF expectations. SOL rebounded from its post-FTX low.',
  2024: 'US spot BTC ETFs launched in January; BTC made a new high in March, halved in April, ranged through the summer (sharp August sell-off), then rallied on the November US election.',
  2025: 'Described from the price data only.', 2026: 'Described from the price data only (to mid-October).',
};
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------- page building blocks
const pages = [];
const page = (html, cl = '') => pages.push(`<section class="page ${cl}">${html}<div class="foot"><span>BB Breakout (4h) · ${COINS.join(' / ')} · backtest 2020–2026</span><span class="pn"></span></div></section>`);
const tiles = (arr) => `<div class="tiles">${arr.map((t) => `<div class="tile"><div class="tl">${t.l}</div><div class="tv">${t.v}</div>${t.s ? `<div class="ts">${t.s}</div>` : ''}</div>`).join('')}</div>`;
const table = (head, rows, o = {}) => `<table class="${o.cls || ''}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${(r.c || r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const legend = (items) => `<div class="legend">${items.map(([n, c, k]) => `<span>${c ? `<i style="background:${c}${k === 'line' ? ';height:3px;border-radius:2px' : ''}"></i>` : ''}${n}</span>`).join('')}</div>`;
const money = (v) => `<span class="${cls(v)}">${usd(v)}</span>`;
const ALL = COINS.flatMap((s) => T[s]).sort((a, b) => a.x - b.x);
const held = ALL.filter((t) => t.x >= L.ts(2023));
const YALL = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const BTCREG = (y) => D.regime('BTC', L.ts(y), L.ts(y + 1), 7);
const yNet = (s, y) => { const t = tradesY(s, y); return t.length ? sumUsd(t) : null; };
const CY = (() => { const a = []; for (const s of COINS) for (const y of yearsOf(s)) { const v = yNet(s, y); if (v != null) a.push({ s, y, v }); } const pos = a.filter((q) => q.v > 0.5).length, neg = a.filter((q) => q.v < -0.5); return { tot: a.length, pos, flat: a.length - pos - neg.length, neg }; })();
const CYneg = CY.neg.length ? CY.neg.map((q) => q.s + ' ' + q.y).join(', ') : 'none';
const SMIN = Math.min(...COINS.map((c) => SA[c].maxStreak)), SMAX = Math.max(...COINS.map((c) => SA[c].maxStreak));
const TPMIN = Math.min(...COINS.map((c) => SA[c].tp / SA[c].n)), TPMAX = Math.max(...COINS.map((c) => SA[c].tp / SA[c].n));
const W50 = (() => { let w = 0; for (let i = 0; i + 50 <= ALL.length; i++) w = Math.min(w, ALL.slice(i, i + 50).reduce((a, t) => a + t.R, 0)); return w; })();
const YPOS = YALL.filter((y) => sumUsd(ALL.filter((t) => yr(t.x) === y)) > 0).length;
const UNTUNED = COINS.filter((c) => !['BTC', 'ETH', 'SOL'].includes(c)), CNAME = COINS.slice(0, -1).join(', ') + ' and ' + COINS[COINS.length - 1];
const startTxt = (c) => c + ' from ' + MON[new Date(B4[c][0].time * 1000).getUTCMonth()] + ' ' + new Date(B4[c][0].time * 1000).getUTCFullYear();
// risk numbers (needed on the cover and later pages)
let seed = 4242; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const ddOf = (a) => { let c = 0, p = 0, d = 0; for (const v of a) { c += v; p = Math.max(p, c); d = Math.max(d, p - c); } return d; };
const mc = (R) => { const sims = []; for (let k = 0; k < 3000; k++) { const a = R.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } sims.push(ddOf(a)); } return sims.sort((a, b) => a - b); };
const MC = Object.fromEntries([...COINS, 'ALL'].map((s) => { const R = (s === 'ALL' ? ALL : T[s]).map((t) => t.R), sims = mc(R); return [s, { hist: ddOf(R), sims, med: sims[1500], p95: sims[2850], p99: sims[2970] }]; }));
const perYearTrades = ALL.length / ((ALL[ALL.length - 1].x - ALL[0].t) / 31557600), heldR = held.reduce((a, t) => a + t.R, 0);
const heldYrs = (ALL[ALL.length - 1].x - L.ts(2023)) / 31557600, perMonth1 = heldR / heldYrs / 12;

// ================================================================= 1. COVER
page(`
<div class="cover-top"><div class="kicker">Backtest report · October 2026</div>
<h1>BB Breakout on ${CNAME}</h1>
<div class="sub">A 2020–2026, month-by-month look at one 4-hour Bollinger-band trend strategy — how it made and lost money in every market regime since 2020, and whether it is worth trading.</div></div>
${tiles([
  { l: 'Net profit, 2020–26', v: usd(SALL.net), s: `at $${RISK} risk per trade · all ${COINS.length} coins` },
  { l: 'Trades', v: SALL.n.toLocaleString(), s: `${pct(SALL.wr)} winners` },
  { l: 'Average trade', v: r2(SALL.avgR), s: `profit factor ${pf(SALL.pf)}` },
  { l: 'Worst drawdown', v: usd(-SALL.dd), s: `all ${COINS.length} coins combined` },
  { l: 'Held-out 2023 → 2026', v: usd(sumUsd(held)), s: 'years never used for tuning' },
  { l: 'Profitable coin-years', v: `${CY.pos} of ${CY.tot}`, s: `${CY.flat} flat, ${CY.neg.length} losing (${CYneg})` },
])}
<div class="grid2 cover-grid"><div class="card"><h3>Cumulative profit at $${RISK} risk per trade</h3>
${lineChart({ w: 640, h: 340, series: [...COINS.map((s) => ({ name: s, color: C[s], pts: equitySeries(T[s]) })), { name: 'All ' + COINS.length, color: C.total, pts: equitySeries(ALL), width: 2.4, dash: '6 3' }], yFmt: (v) => '$' + v, zero: true, padR: 70 })}
<div class="note">Closed-trade profit, booked when each trade exits. Fixed $${RISK} risk per trade (no compounding). Binance fees, slippage and real funding included.</div></div>
<div><div class="card verdict"><h3>The short answer</h3>
<p><b>Recommended — with modest expectations.</b> The strategy made money on all ${COINS.length} coins over 2020–2026 after realistic costs, including on ${UNTUNED.join(', ')} (never used for tuning) and in 2023–26 (never used for tuning).</p>
<p>It wins by catching a few large, clean moves — up <i>or</i> down — and loses slowly in sideways markets. It does not adapt to regimes; it survives them because losses are small and capped.</p>
<p><b>Start all ${COINS.length} at equal size, GALA smaller.</b> GALA has a strong edge on paper but the shortest history (from ${MON[new Date(B4.GALA[0].time * 1000).getUTCMonth()]} ${new Date(B4.GALA[0].time * 1000).getUTCFullYear()}), a thin market, and all of its profit comes from short trades. NEAR has the smallest edge per trade.</p>
<p class="muted">Expect long losing streaks (${SMIN}–${SMAX} trades per coin, ${SALL.maxStreak} across all ${COINS.length}), only ~${pct(SALL.wr)} winners, and roughly $${perMonth1.toFixed(1)} a month at $1 risk across the ${COINS.length} coins.</p></div>
<div class="card"><h3>Net profit each year, all ${COINS.length} coins ($)</h3>${barChart({ w: 420, h: 140, items: YALL.map((y) => ({ label: y === 2026 ? '2026*' : String(y), v: sumUsd(ALL.filter((t) => yr(t.x) === y)) })) })}
<div class="note">*2026 to mid-October. ${YPOS} of ${YALL.length} years were profitable.</div></div></div></div>
`, 'cover');

// ================================================================= 2. METHOD
page(`<h2>1 · How the strategy works and how it was tested</h2>
<div class="grid2"><div class="card"><h3>The rules (frozen — not changed for this report)</h3>${ruleDiagram()}
<ul class="tight"><li><b>Long:</b> a 4h candle closes above the upper Bollinger band (20 candles, 2σ) <i>and</i> above the 200-candle SMA.</li>
<li><b>Short:</b> a close below the lower band <i>and</i> below the SMA.</li>
<li><b>Stop</b> = the middle band at the signal close · <b>Target</b> = 4× the stop distance · <b>Time exit</b> after 48 candles (8 days).</li>
<li>One trade at a time per coin; no pyramiding; no discretion.</li></ul></div>
<div><div class="card"><h3>Realism: what the backtest charges and assumes</h3>
${table(['Item', 'Assumption'], [
  ['Data', `Binance USDT-M perpetual futures, 4h candles. ${COINS.map(startTxt).join(', ')} (listing dates), all to 17–20 Oct 2026.`],
  ['Decision', 'Only at a candle’s close, using only candles already closed. The bot never sees the next candle.'],
  ['Entry fill', 'Next candle’s open + 0.02% slippage + 0.05% taker fee.'],
  ['Stop / time exit', 'Market order: 0.02% slippage + 0.05% taker fee. Gaps through the stop fill at the worse open price.'],
  ['Target', 'Resting limit (0.02% maker fee) — fills only if price trades 0.05% <i>through</i> it.'],
  ['Same-candle stop & target', `Counted as a stop (worse case). Happened ${checks.reduce((a, c) => a + c.amb, 0)} time(s) in ${ALL.length.toLocaleString()} trades.`],
  ['Funding', 'Real Binance funding paid or received at every 8h event the trade was open through.'],
  ['Sizing', `Fixed $${RISK} risk per trade on a notional $${START.toLocaleString()} account per coin. Equity = $${START.toLocaleString()} + cumulative profit.`],
], { cls: 'kv' })}</div>
<div class="card"><h3>No look-ahead, no repainting — checked</h3>
${table(['Coin', 'Truncation cuts', 'Orders compared', 'Mismatches', 'Bot vs app engine'], checks.map((c) => [c.sym, c.cuts, c.compared.toLocaleString(), `<b class="pos">${c.bad}</b>`, `${c.same} / ${c.app} identical`]))}
<div class="note">The engine was re-run on data cut at 100 random points per coin; every decision before each cut matched the full-history run, so no future candle is ever used. A second, independently written bot matches the app engine trade for trade.</div></div>
<div class="card slim"><b>Tuning status.</b> Bollinger / SMA / stop / time-exit settings were chosen on 2019–22 BTC, ETH and SOL and then frozen. <b>2023→2026 and every coin except SOL (${UNTUNED.join(', ')}) are out-of-sample.</b> The 4R target was chosen after comparing 3R/4R/5R on all years, so it is mildly in-sample. <b>Coin choice is also hindsight:</b> these ${COINS.length} were picked from roughly 100 coins screened because they did best (BTC, in the earlier version of this report, was dropped for its weaker, less consistent results), so treat the totals as an optimistic estimate.</div></div></div>`);

// ================================================================= 3. OVERVIEW
const maxCell = Math.max(...MROWS.filter((r) => r.n).map((r) => Math.abs(r.z.net)));
page(`<h2>2 · 2020–2026 at a glance</h2>
<div class="grid2"><div class="card"><h3>Net profit by year and coin ($, at $${RISK} risk)</h3>${legend(COINS.map((s) => [s, C[s]]))}
${groupedBars({ w: 600, h: 250, groups: YALL.map((y) => ({ label: y === 2026 ? '2026*' : String(y), vals: COINS.map((s) => ({ key: s, v: yNet(s, y) })) })), keys: COINS, colors: C })}
<div class="note">*2026 to mid-October. Trades are counted in the year they close. ${startTxt('GALA')}.</div>
${table(['Year', ...COINS, 'All ' + COINS.length, 'BTC buy-and-hold'], [...YALL.map((y) => { const a = ALL.filter((t) => yr(t.x) === y); return [y, ...COINS.map((s) => yNet(s, y) == null ? '·' : money(yNet(s, y))), `<b>${money(sumUsd(a))}</b>`, spct(BTCREG(y).ret)]; }),
  { c: ['<b>Total</b>', ...COINS.map((s) => `<b>${money(SA[s].net)}</b>`), `<b>${money(SALL.net)}</b>`, ''], cls: 'tot' }], { cls: 'num' })}</div>
<div class="card"><h3>Every month, every coin (net $)</h3>
${COINS.map((s) => `<div class="hm-title"><i style="background:${C[s]}"></i>${NAME[s]}</div>${heatmap({ w: 560, sym: s, max: maxCell * 0.7 })}`).join('')}
<div class="note">Blue = profitable month, red = losing month, darker = larger. “·” = no trade closed that month. Dashed = before listing / after the data ends.</div></div></div>`);

// ================================================================= 3b. RISK BY YEAR
{
  const ddy = (tr) => { let c = 0, p = 0, d = 0; for (const t of tr) { c += t.usd; p = Math.max(p, c); d = Math.max(d, p - c); } return d; };
  const sk = (tr) => { let k = 0, m = 0, lost = 0, ml = 0; for (const t of tr) { if (t.R <= 0) { k++; lost += t.usd; if (k > m) { m = k; ml = lost; } } else { k = 0; lost = 0; } } return [m, -ml]; };
  const inY = (a, y) => a.filter((t) => yr(t.x) === y);
  const ddRows = YALL.map((y) => [y === 2026 ? '2026*' : y, ...COINS.map((c) => { const t = inY(T[c], y); return t.length ? '<span class="neg">−$' + ddy(t).toFixed(0) + '</span>' : '·'; }), '<b class="neg">−$' + ddy(inY(ALL, y)).toFixed(0) + '</b>']);
  ddRows.push({ c: ['<b>Whole period</b>', ...COINS.map((c) => '<b>−$' + ddy(T[c]).toFixed(0) + '</b>'), '<b>−$' + ddy(ALL).toFixed(0) + '</b>'], cls: 'tot' });
  const skc = (tr) => { if (!tr.length) return '·'; const [k, l] = sk(tr); return '<b>' + k + '</b> <span class="muted">(−$' + l.toFixed(0) + ')</span>'; };
  const skRows = YALL.map((y) => [y === 2026 ? '2026*' : y, ...COINS.map((c) => skc(inY(T[c], y))), skc(inY(ALL, y))]);
  skRows.push({ c: ['<b>Whole period</b>', ...COINS.map((c) => skc(T[c])), skc(ALL)], cls: 'tot' });
  page(`<h2>2b · Risk by year — drawdown and losing streaks</h2>
<p class="lead">How bad did it get, year by year? Both tables use the same trades as the rest of the report ($${RISK} risk per trade; at $1 risk divide every dollar figure by ${RISK}).</p>
<div class="grid2"><div class="card"><h3>Max drawdown inside each year ($)</h3>${table(['Year', ...COINS, 'All ' + COINS.length], ddRows, { cls: 'num' })}
<div class="note">Peak-to-trough on closed-trade profit, counted within the calendar year (trades by exit date). *2026 to mid-October. The combined column is deeper than any single coin because the coins sometimes lose together.</div></div>
<div class="card"><h3>Longest losing streak in each year (trades in a row, and $ lost)</h3>${table(['Year', ...COINS, 'All ' + COINS.length], skRows, { cls: 'num' })}
<div class="note">A losing trade is any trade that closed at or below zero. The combined column counts consecutive losses across all coins in the order trades closed. *2026 to mid-October.</div></div></div>
<div class="grid2"><div class="card"><h3>The 5 deepest drawdowns, all ${COINS.length} coins combined</h3>${table(['Peak → trough', 'Depth', 'Trades down', 'Recovered'], ddPhases(ALL).slice(0, 5).map((p) => [`${iso(p.peak)} → ${iso(p.trough)}`, `<span class="neg">${usd(-p.depth)}</span>`, p.n, p.rec ? `${iso(p.rec)} (${Math.round((p.rec - p.peak) / 86400)} d)` : '<b>not yet</b>']), { cls: 'small' })}
<div class="note">Closed-trade profit from a peak to the lowest point before a new peak. At $1 risk divide the dollars by ${RISK}.</div></div>
<div class="card"><h3>The 5 longest losing streaks, all ${COINS.length} coins combined</h3>${table(['Losses in a row', 'From → to', 'Cost'], allStreaks(ALL).slice().sort((a, b) => b.k - a.k).slice(0, 5).map((q) => [q.k, `${iso(q.s0)} → ${iso(q.e)}`, `<span class="neg">${usd(q.lost)}</span>`]), { cls: 'small' })}
<div class="note">Counts consecutive losing trades across all coins in the order they closed. Several coins can lose in the same few days, so a combined streak is longer than any single coin's.</div></div></div>`);
}

// ================================================================= 4. PER COIN
for (const s of COINS) {
  const tr = T[s], x = SA[s], ph = ddPhases(tr), strk = allStreaks(tr), top3 = strk.slice().sort((a, b) => b.k - a.k).slice(0, 3);
  const mm = mrows(s).filter((r) => r.n), best = mm.slice().sort((a, b) => b.R - a.R).slice(0, 4), worst = mm.slice().sort((a, b) => a.R - b.R).slice(0, 4);
  const pr = dailyPrice(s, 0, 2e9);
  const yrows = yearsOf(s).map((y) => { const t = tradesY(s, y), z = st(t, mrows(s, y)[0].z.start), g = REG[s].years[y];
    return [y === 2026 ? '2026*' : y, z.n, pct(z.wr), `<b>${money(z.net)}</b>`, r2(z.avgR), pf(z.pf), usd(-z.dd), z.maxStreak, usdP(z.start), usdP(z.end), spct(g.ret), yearRegime(g, REG[s].volMed)]; });
  page(`<h2>3 · ${NAME[s]} — 2020–2026 overview</h2>
${tiles([{ l: 'Net profit', v: usd(x.net), s: `${spct(x.net / START)} on $${START.toLocaleString()}` }, { l: 'Trades / win rate', v: `${x.n} · ${pct(x.wr)}`, s: `${x.w} wins, ${x.l} losses` }, { l: 'Average trade', v: r2(x.avgR), s: `win ${r2(x.avgW)} · loss ${r2(x.avgL)}` },
  { l: 'Profit factor', v: pf(x.pf), s: 'gross profit ÷ gross loss' }, { l: 'Max drawdown', v: usd(-x.dd), s: `${pct(x.ddPct)} of peak equity` }, { l: 'Longest losing streak', v: `${x.maxStreak} trades`, s: `${strk.filter((q) => q.k >= 5).length} streaks of 5+` }])}
<div class="grid2"><div class="card"><h3>Price (log scale, daily close) and the 200-candle SMA</h3>${lineChart({ w: 600, h: 150, series: [{ name: s, color: C[s], pts: pr.p, width: 1.6 }, { name: 'SMA200', color: C.muted, pts: pr.q, width: 1.2, dash: '4 3' }], log: true, yFmt: price, padR: 58 })}
<h3 style="margin-top:6px">Account equity ($${START.toLocaleString()} start) and drawdown</h3>${lineChart({ w: 600, h: 150, series: [{ name: 'Equity', color: C[s], pts: equitySeries(tr, START) }], yFmt: (v) => '$' + v.toLocaleString(), padR: 58 })}
${lineChart({ w: 600, h: 74, series: [{ name: 'Drawdown', color: C.neg, pts: underwater(tr), width: 1.2 }], area: { pts: underwater(tr), fill: C.neg, opacity: 0.25 }, yFmt: (v) => usd(v), padR: 58 })}</div>
<div class="card"><h3>Year by year</h3>${table(['Year', 'Trades', 'Win %', 'Net', 'Avg', 'PF', 'Max DD', 'Streak', 'Start', 'End', 'Coin', 'Market regime'], [...yrows, { c: ['<b>All</b>', x.n, pct(x.wr), `<b>${money(x.net)}</b>`, r2(x.avgR), pf(x.pf), usd(-x.dd), x.maxStreak, usdP(START), usdP(x.end), '', ''], cls: 'tot' }], { cls: 'num small lastL' })}
<div class="grid2 inner"><div><h4>Deepest drawdowns</h4>${table(['Peak → trough', 'Depth', 'Recovered'], ph.slice(0, 3).map((p) => [`${iso(p.peak)} → ${iso(p.trough)}`, `<span class="neg">${usd(-p.depth)}</span>`, p.rec ? `${iso(p.rec)} (${Math.round((p.rec - p.peak) / 86400)} d)` : '<b>not yet</b>']), { cls: 'small' })}
<h4>Longest losing streaks</h4>${table(['Losses', 'From → to', 'Cost'], top3.map((q) => [q.k, `${iso(q.s0)} → ${iso(q.e)}`, `<span class="neg">${usd(q.lost)}</span>`]), { cls: 'small' })}</div>
<div><h4>Best months</h4>${table(['Month', 'Net', 'Coin', 'Regime'], best.map((r) => [`${MON[+r.key.slice(5) - 1]} ${r.y}`, money(r.z.net), spct(r.g.ret), r.lab]), { cls: 'small' })}
<h4>Worst months</h4>${table(['Month', 'Net', 'Coin', 'Regime'], worst.map((r) => [`${MON[+r.key.slice(5) - 1]} ${r.y}`, money(r.z.net), spct(r.g.ret), r.lab]), { cls: 'small' })}</div></div>
<div class="note">*2026 to mid-October. ${mm.filter((r) => r.R > 0).length} of ${mrows(s).length} months profitable. Regime labels are measured from the candles: trend efficiency = net move ÷ distance travelled (1 = straight line).</div></div></div>`);

  // ---------- one page per year
  for (const y of yearsOf(s)) {
    const t = tradesY(s, y), ms = mrows(s, y), z = st(t, ms[0].z.start), g = REG[s].years[y], reg = yearRegime(g, REG[s].volMed), sk = streakInfo(t);
    const lo = L.ts(y), hi = L.ts(y + 1), dp = dailyPrice(s, lo, hi), entT = T[s].filter((q) => q.t >= lo && q.t < hi);
    const mk = entT.map((q) => ({ t: B4[s][q.i0].time, y: B4[s][q.i0].open, dir: q.dir, fill: q.R > 0 ? C.pos : C.neg }));
    const mTr = ms.filter((r) => r.n), bm = mTr.slice().sort((a, b) => b.R - a.R)[0], wm = mTr.slice().sort((a, b) => a.R - b.R)[0];
    const big = ms.filter((r) => r.g && Math.abs(r.g.ret) >= 0.15), flat = ms.filter((r) => r.g && Math.abs(r.g.ret) < 0.1);
    const bigNet = big.reduce((a, r) => a + r.z.net, 0), flatNet = flat.reduce((a, r) => a + r.z.net, 0);
    const longN = sumUsd(t.filter((q) => q.dir === 1)), shortN = sumUsd(t.filter((q) => q.dir === -1)), tx = t.filter((q) => q.why === 'time');
    const withG = ms.filter((q) => q.g), up = withG.slice().sort((a, b) => b.g.ret - a.g.ret)[0], dn = withG.slice().sort((a, b) => a.g.ret - b.g.ret)[0];
    const first = dp.p[0], last = dp.p[dp.p.length - 1];
    const marketTxt = `<p><b>${reg}.</b> ${s} went from ${price(first[1])} to ${price(last[1])} (${spct(g.ret)}) with annualised volatility of ${pct(g.vol)} (its typical month: ${pct(REG[s].volMed)}). Trend efficiency of ${g.er.toFixed(2)} means ${effWord(g.er)}. Price was above its 200-candle SMA ${pct(g.above)} of the time and crossed it ${g.crosses} times; the deepest peak-to-trough fall inside the year was −${pct(g.ddP)}.</p>
<p>Biggest month up: <b>${MON[+up.key.slice(5) - 1]}</b> (${spct(up.g.ret)}); biggest month down: <b>${MON[+dn.key.slice(5) - 1]}</b> (${spct(dn.g.ret)}).</p><p class="muted"><b>Backdrop:</b> ${BACKDROP[y]}</p>`;
    let why;
    if (z.net > 0 && bigNet > 0 && flat.length === 0) why = `Every month moved at least 10%, and the ${plural(big.length, 'month')} with a 15%+ move made ${usd(bigNet)} — plenty of movement for a breakout strategy.`;
    else if (z.net > 0 && bigNet > 0 && flatNet <= 0) why = `Textbook behaviour: the ${plural(big.length, 'month')} where ${s} moved 15% or more made ${usd(bigNet)}, and the ${plural(flat.length, 'near-flat month')} (under 10%) cost ${usd(flatNet)}. The big moves paid for the chop.`;
    else if (z.net > 0 && flatNet > 0) why = `A good year even in quiet months: the ${plural(big.length, 'big-move month')} made ${usd(bigNet)} and the ${plural(flat.length, 'near-flat month')} still added ${usd(flatNet)}.`;
    else if (z.net > 0) why = `Profitable even though the big-move months netted ${usd(bigNet)} — the gains came from moderate trending months; near-flat months made ${usd(flatNet)}.`;
    else if (big.length === 0) why = `No month moved 15% or more, so there was nothing large to catch; the ${plural(flat.length, 'near-flat month')} cost ${usd(flatNet)}. This is the strategy’s known weak spot.`;
    else why = `The year never produced enough clean follow-through: big-move months made ${usd(bigNet)}, but the ${plural(flat.length, 'near-flat month')} cost ${usd(flatNet)}. Breakouts kept reversing back into the range.`;
    const stratTxt = `<p>${z.n} trades, ${z.w} winners (${pct(z.wr)}), net <b class="${cls(z.net)}">${usd(z.net)}</b> — ${r2(z.avgR)} per trade, profit factor ${pf(z.pf)}. ${mTr.filter((r) => r.R > 0).length} of ${mTr.length} trading months were profitable.</p>
<p>${why}</p>
<p>Best month <b>${MON[+bm.key.slice(5) - 1]}</b> (${usd(bm.z.net)}); worst <b>${MON[+wm.key.slice(5) - 1]}</b> (${usd(wm.z.net)}). Longest losing streak: <b>${sk.k}</b>${sk.k ? ` (${dm(sk.s0)} → ${dm(sk.e)}, ${usd(sk.lost)})` : ''}. Max drawdown ${usd(-z.dd)}.</p>
<p>Longs ${money(longN)} · shorts ${money(shortN)}. Exits: ${z.tp} targets, ${z.sl} stops, ${z.tx} time exits${tx.length ? ` (averaging ${r2(tx.reduce((a, q) => a + q.R, 0) / tx.length)})` : ''}.</p>`;
    const mrowsHtml = ms.map((r) => { const q = r.z; return [MON[+r.key.slice(5) - 1], r.g ? spct(r.g.ret) : '—', r.lab, q.n || '·', q.n ? `${q.w}/${q.l}` : '', q.n ? pct(q.wr) : '', q.n ? `<b>${money(q.net)}</b>` : '·', q.n ? r2(q.avgR) : '', q.n ? pf(q.pf) : '', q.n ? usd(-q.dd) : '', q.n ? q.maxStreak : '', usdP(q.start), usdP(q.end)]; });
    mrowsHtml.push({ c: ['<b>Year</b>', spct(g.ret), '', z.n, `${z.w}/${z.l}`, pct(z.wr), `<b>${money(z.net)}</b>`, r2(z.avgR), pf(z.pf), usd(-z.dd), z.maxStreak, usdP(z.start), usdP(z.end)], cls: 'tot' });
    const f0 = new Date(B4[s][0].time * 1000), sub = y === 2026 ? ' (to mid-October)' : y === f0.getUTCFullYear() && f0.getUTCMonth() > 0 ? ' (from listing in ' + MON[f0.getUTCMonth()] + ')' : '';
    const range = Math.max(...dp.p.map((p) => p[1])) / Math.min(...dp.p.map((p) => p[1]));
    page(`<div class="yhead"><div><div class="kicker" style="color:${C[s]}">${NAME[s]}</div><h2>${y}${sub}</h2></div><div class="badge">${reg}</div></div>
${tiles([{ l: 'Net', v: `<span class="${cls(z.net)}">${usd(z.net)}</span>`, s: `${usdP(z.start)} → ${usdP(z.end)}` }, { l: 'Trades', v: z.n, s: `${z.w} W · ${z.l} L` }, { l: 'Win rate', v: pct(z.wr), s: `${z.tp} hit the 4R target` }, { l: 'Avg trade', v: r2(z.avgR), s: `PF ${pf(z.pf)}` }, { l: 'Max drawdown', v: usd(-z.dd), s: 'within the year' }, { l: 'Losing streak', v: sk.k, s: 'longest, in trades' }, { l: 'Coin move', v: spct(g.ret), s: `volatility ${pct(g.vol)}` }])}
<div class="grid-y"><div class="card"><h3>${s} price${range > 4 ? ' (log scale)' : ''} with every trade entry</h3>${legend([['Winning trade', C.pos], ['Losing trade', C.neg], ['▲ long · ▼ short', null], ['200-candle SMA', C.muted, 'line']])}
${lineChart({ w: 640, h: 205, series: [{ name: '', color: C.ink2, pts: dp.p, width: 1.4 }, { name: '', color: C.muted, pts: dp.q.length ? dp.q : dp.p.slice(0, 1), width: 1.1, dash: '4 3' }], markers: mk, yFmt: price, xFmt: 'month', label: false, log: range > 4 })}</div>
<div class="card"><h3>How the market behaved</h3>${marketTxt}</div>
<div class="card"><h3>Month by month</h3>${table(['Month', 'Coin', 'Regime', 'Trades', 'W/L', 'Win %', 'Net', 'Avg', 'PF', 'Max DD', 'Streak', 'Start eq.', 'End eq.'], mrowsHtml, { cls: 'num small mt' })}</div>
<div class="card"><h3>Monthly net ($)</h3>${barChart({ w: 360, h: 128, items: ms.map((r) => ({ label: MON[+r.key.slice(5) - 1][0], v: r.n ? r.z.net : 0, n: r.n })) })}<h3 style="margin-top:4px">How the strategy did — and why</h3>${stratTxt}</div></div>`, 'yp');
  }
}

// ================================================================= 5. REGIME EVIDENCE
const bR = (i, j) => BUCK[i].rows[j].R / BUCK[i].rows[j].n, bP = (i, j) => BUCK[i].rows[j].pos;
const bk = (i) => BUCK[i].rows.map((r) => ({ label: r.label, v: r.n ? r.R / r.n : 0, sub: `${pct(r.pos)} of ${r.months} months positive` }));
page(`<h2>4 · What kind of market does it need?</h2>
<p class="lead">Every month of every coin (${MROWS.filter((r) => r.n).length} coin-months with trades), grouped by how the coin behaved that month. Bars show the average result per trade in those months.</p>
<div class="grid2"><div class="card"><h3>Trend efficiency of the month</h3>${hbars({ w: 520, items: bk(0) })}<div class="note">Efficiency = net move ÷ total distance travelled by daily closes. Choppy months (&lt; 0.15) average ${r2(bR(0, 0))} per trade; clean trends (≥ 0.50) average ${r2(bR(0, 3))}.</div></div>
<div class="card"><h3>Size of the coin’s move in the month</h3>${hbars({ w: 520, items: bk(1) })}<div class="note">The clearest pattern: months where the coin moved under 5% average ${r2(bR(1, 0))} per trade; 30%+ months average ${r2(bR(1, 3))}.</div></div>
<div class="card"><h3>Direction of the month</h3>${hbars({ w: 520, items: bk(2) })}<div class="note">Direction matters little — down months (${r2(bR(2, 0))}) and up months (${r2(bR(2, 2))}) both pay. Only the flat middle loses (${r2(bR(2, 1))}). The SMA filter lets the strategy trade both ways.</div></div>
<div class="card"><h3>How often price crossed the 200-candle SMA</h3>${hbars({ w: 520, items: bk(4) })}<div class="note">Months that stayed on one side of the SMA made ${r2(bR(4, 0))} per trade (${pct(bP(4, 0))} profitable). Whipsaw months (9+ crosses) average ${r2(bR(4, 3))}.</div></div>
<div class="card"><h3>Volatility vs the coin’s own typical month</h3>${hbars({ w: 520, items: bk(3) })}<div class="note">Higher volatility helps: high-volatility months average ${r2(bR(3, 3))} per trade vs ${r2(bR(3, 0))} in quiet months.</div></div>
<div class="card verdict"><h3>In one sentence</h3><p>The strategy needs the coin to <b>travel a long way in one direction within a few weeks</b> — up or down. It is hurt most by months that go nowhere: flat, choppy months crossing the trend line again and again, when breakouts fail, reverse and hit the stop at the middle band.</p>
<p class="muted">Important: these conditions are measured <i>after</i> each month is over. They explain when the strategy makes money, but nobody knows in advance which month will be choppy — section 6 tests whether any of it can be detected at entry.</p></div></div>`);

// ================================================================= 6. COIN COMPARISON
const exitAgg = (s, why) => T[s].filter((t) => t.why === why);
const corrOf = (a, b) => { const ma = Object.fromEntries(mrows(a).map((r) => [r.key, r.R])), mb = Object.fromEntries(mrows(b).map((r) => [r.key, r.R])); const k = Object.keys(ma).filter((q) => q in mb); const xa = k.map((q) => ma[q]), xb = k.map((q) => mb[q]); const A = xa.reduce((p, q) => p + q, 0) / k.length, Bm = xb.reduce((p, q) => p + q, 0) / k.length; let s1 = 0, s2 = 0, s3 = 0; for (let i = 0; i < k.length; i++) { s1 += (xa[i] - A) * (xb[i] - Bm); s2 += (xa[i] - A) ** 2; s3 += (xb[i] - Bm) ** 2; } return s1 / Math.sqrt(s2 * s3); };
const costLoss = (s) => 1 - sumUsd(T2x[s]) / SA[s].net;
const EX = (why) => { const a = ALL.filter((t) => t.why === why); return a.reduce((p, t) => p + t.R, 0) / a.length; };
const MAEW = (() => { const w = ALL.filter((t) => t.R > 0); return w.reduce((a, t) => a + t.mae, 0) / w.length; })();
const CP = []; for (let i = 0; i < COINS.length; i++) for (let j = i + 1; j < COINS.length; j++) CP.push(corrOf(COINS[i], COINS[j]));
const CMIN = Math.min(...CP), CMAX = Math.max(...CP);
const lop = COINS.filter((c) => Math.min(sumUsd(T[c].filter((t) => t.dir === 1)), sumUsd(T[c].filter((t) => t.dir === -1))) < 0.1 * SA[c].net);
const lsTxt = lop.length ? lop.map((c) => c + ' made essentially all of its profit on one side (long ' + usd(sumUsd(T[c].filter((t) => t.dir === 1))) + ' / short ' + usd(sumUsd(T[c].filter((t) => t.dir === -1))) + ') — a caution, not a feature.').join(' ') + ' The other coins earn on both sides.' : 'Both sides contribute on every coin.';
const byEdge = COINS.slice().sort((a, b) => SA[a].avgR - SA[b].avgR), EMIN = byEdge[0], EMAX = byEdge[byEdge.length - 1];
const DC = COINS.slice().sort((a, b) => SA[b].dd - SA[a].dd)[0], DP = ddPhases(T[DC])[0], DCtxt = DP.rec ? 'took ' + Math.round((DP.rec - DP.peak) / 86400) + ' days to recover' : 'has not fully recovered yet';
const vd = (i) => { const a = HYPR[i].a, b = HYPR[i].b, A = HYPR[0].a, B = HYPR[0].b; const up = a.avgR > A.avgR && b.avgR > B.avgR, dn = a.avgR < A.avgR && b.avgR < B.avgR;
  return up ? (b.net < B.net ? '<b>Better per trade in both halves</b>, less total profit' : '<b>Better in both halves</b>') : dn ? '<span class="neg">Rejected</span> — worse in both' : 'Mixed — helped in one half only'; };
const THRv = THR[1].net23 < THR[0].net23 && THR[1].dd23 >= THR[0].dd23 * 0.99 ? '<span class="neg">Rejected</span> — less profit, no less drawdown' : `Mixed — all-years DD ${usd(-THR[1].dd)} vs ${usd(-THR[0].dd)}`;
page(`<h2>5 · The ${COINS.length} coins side by side — why results differ</h2>
<div class="grid2"><div class="card"><h3>Key metrics side by side</h3>${table(['', ...COINS], [
  ['Net profit (2020–26)', ...COINS.map((s) => `<b>${money(SA[s].net)}</b>`)], ['Held-out 2023→', ...COINS.map((s) => money(sumUsd(T[s].filter((t) => t.x >= L.ts(2023)))))],
  ['Average trade', ...COINS.map((s) => r2(SA[s].avgR))], ['Profit factor', ...COINS.map((s) => pf(SA[s].pf))], ['Win rate', ...COINS.map((s) => pct(SA[s].wr))],
  ['4R target-hit rate', ...COINS.map((s) => pct(SA[s].tp / SA[s].n))], ['Average win / loss', ...COINS.map((s) => `${r2(SA[s].avgW)} / ${r2(SA[s].avgL)}`)],
  ['Typical monthly volatility', ...COINS.map((s) => pct(REG[s].volMed))], ['Band half-width at entry (≈ stop)', ...COINS.map((s) => (T[s].reduce((a, t) => a + t.f.bandSd, 0) / T[s].length * 100).toFixed(1) + '%')],
  ['Profit lost if costs double', ...COINS.map((s) => '−' + pct(costLoss(s)))], ['Same with a 3R target', ...COINS.map((s) => money(sumUsd(T3[s])))],
  ['Long avg / short avg', ...COINS.map((s) => `${r2(st(SA[s].long).avgR)} / ${r2(st(SA[s].short).avgR)}`)], ['Funding paid', ...COINS.map((s) => money(SA[s].fund))],
  ['Profitable months', ...COINS.map((s) => `${mrows(s).filter((r) => r.R > 0).length} of ${mrows(s).length}`)], ['Max drawdown', ...COINS.map((s) => usd(-SA[s].dd))],
], { cls: 'num' })}</div>
<div><div class="card"><h3>Where the money comes from (total $, by exit type)</h3>${legend(COINS.map((s) => [s, C[s]]))}
${groupedBars({ w: 520, h: 190, groups: [['target', '4R target hit'], ['time', 'Time exit (8 days)'], ['stop', 'Stopped out']].map(([k, lab]) => ({ label: lab, vals: COINS.map((s) => ({ key: s, v: sumUsd(exitAgg(s, k)) })) })), keys: COINS, colors: C })}
<div class="note">Only ${pct(TPMIN)}–${pct(TPMAX)} of trades reach the target, but they earn ≈ ${r2(EX('target'))} each. Time exits average ≈ ${r2(EX('time'))} — trades still open after 8 days are usually still moving the right way. Stops cost ≈ ${r2(EX('stop'))} each.</div></div>
<div class="card"><h3>What explains the gap</h3><ul class="tight">
<li><b>Same payoff shape on every coin</b> — wins ≈ ${r2(Math.min(...COINS.map((c) => SA[c].avgW)))} to ${r2(Math.max(...COINS.map((c) => SA[c].avgW)))}, losses ≈ ${r2(Math.max(...COINS.map((c) => SA[c].avgL)))} to ${r2(Math.min(...COINS.map((c) => SA[c].avgL)))}. The difference is <b>how often breakouts follow through</b>: win rates run ${pct(Math.min(...COINS.map((c) => SA[c].wr)))}–${pct(Math.max(...COINS.map((c) => SA[c].wr)))}.</li>
<li><b>Volatility and costs:</b> typical monthly volatility runs from ${pct(Math.min(...COINS.map((c) => REG[c].volMed)))} to ${pct(Math.max(...COINS.map((c) => REG[c].volMed)))}, and doubling costs removes only ${pct(Math.min(...COINS.map(costLoss)))}–${pct(Math.max(...COINS.map(costLoss)))} of profit on any coin — none is cost-fragile.</li>
<li><b>Long vs short:</b> ${lsTxt}</li>
<li><b>Diversification is real:</b> monthly results barely move together (pairwise correlation ${CMIN.toFixed(2)} to ${CMAX.toFixed(2)}). Combined, the worst drawdown was ${usd(-SALL.dd)} vs ${usd(-COINS.reduce((a, s) => a + SA[s].dd, 0))} if each coin’s worst had hit at once.</li>
<li class="muted"><b>Caution:</b> NEAR has the smallest edge per trade; GALA has the shortest history and the thinnest market (about $13M a day on Binance when checked in Oct 2026).</li></ul></div></div></div>`);

// ================================================================= 7. IMPROVEMENTS
const shortName = (n) => n.replace(/ \(.*\)/, '').replace('Baseline (as tested above)', 'Baseline (no change)').replace('Only trade when ATR% is in the bottom third of its 90-day range', 'Only trade in low volatility')
  .replace('Skip if the last 10 days already trended hard', 'Skip if already trending hard').replace(/Skip if price crossed the SMA200 ≥ \d+ times in the last 30 days/, 'Skip after recent whipsaw').replace('Break-even stop once', 'Break-even at').replace(' is reached', '');
const hrow = (i, name, verdict) => [name, `${r2(HYPR[i].a.avgR)} · ${usd(HYPR[i].a.net)}`, `${r2(HYPR[i].b.avgR)} · ${usd(HYPR[i].b.net)}`, usd(-HYPR[i].b.dd), verdict];
page(`<h2>6 · What could improve it — ideas tested properly</h2>
<p class="lead">Each idea was run inside the bot (a skipped signal frees the slot for the next one). Thresholds were set on trades <b>before 2023</b> and applied unchanged to <b>2023→2026, the fair test</b>.</p>
<div class="grid2"><div class="card"><h3>2023→2026 net profit for each idea (all ${COINS.length} coins)</h3>${hbars({ w: 540, items: HYPR.map((h) => ({ label: shortName(h.name), v: h.b.net, sub: `${r2(h.b.avgR)} per trade` })), fmt: usd, labelW: 170, rowH: 26 })}
${table(['Idea', 'Before 2023 (avg · net)', '2023→ (avg · net)', '2023→ max DD', 'Verdict'], [
  hrow(0, 'Baseline', '—'),
  hrow(1, 'Skip if the last 10 days already trended hard', vd(1)),
  hrow(2, 'Skip after recent whipsaw (many SMA crosses)', vd(2)),
  hrow(3, 'Only trade in low volatility (bottom third)', vd(3)),
  hrow(4, 'Break-even stop at +1R', vd(4)),
  hrow(5, 'Break-even stop at +2R', vd(5)),
  ['Halve risk after 5 losses (sizing)', '—', usd(THR[1].net23), usd(-THR[1].dd23), THRv],
], { cls: 'small' })}</div>
<div><div class="card"><h3>Facts known at entry vs trade result (low / middle / high third)</h3>${table(['Condition at the signal', 'Before 2023', '2023→', 'Same pattern?'], FEATRES.map((f) => [f.name.replace(', in trade direction', ''), f.res.map((q) => r2(q[0])).join(' / '), f.res.map((q) => r2(q[1])).join(' / '), f.bestA === f.bestB && f.worstA === f.worstB ? '<b class="pos">Yes</b>' : f.bestA === f.bestB || f.worstA === f.worstB ? 'Partly' : 'No']), { cls: 'small' })}
<div class="note">The most consistent signal: the best breakouts start <b>from compression</b> — low recent volatility and narrow bands — and the worst come after volatility has already expanded. Five conditions were tried, so one pass could partly be luck.</div></div>
<div class="card"><h3>What this means</h3><ul class="tight"><li><b>No filter beat the plain strategy on total profit.</b> The chop that hurts it is only visible after the fact; trailing proxies remove good trades along with bad ones.</li>
<li><b>Break-even stops hurt</b> because winners typically dip about ${r2(MAEW)} before working; moving the stop early kills them.</li>
<li><b>Keep the rules frozen.</b> Two ideas (skip breakouts after a strong 10-day trend; trade only from low volatility) raise the average trade in both halves but cut total profit — “fewer, better trades” options worth paper-trading alongside, not replacing, the baseline.</li>
<li class="muted"><b>Not yet tested:</b> letting winners run past 8 days (time exits average ${r2(EX('time'))}), a portfolio-level size brake.</li></ul></div></div></div>`);

// ================================================================= 8. RISK PLANNING
page(`<h2>7 · Risk planning — what to expect when trading it</h2>
<div class="grid2"><div class="card"><h3>How deep could the combined drawdown get? (all ${COINS.length} coins, in R)</h3>
${histogram({ w: 560, h: 240, vals: MC.ALL.sims, xFmt: (v) => v.toFixed(0) + 'R', marks: [{ v: MC.ALL.hist, label: `Actual ${MC.ALL.hist.toFixed(0)}R`, color: C.ink, left: true }, { v: MC.ALL.p95, label: `95%: ${MC.ALL.p95.toFixed(0)}R`, color: C.neg, dash: true }, { v: MC.ALL.p99, label: `99%: ${MC.ALL.p99.toFixed(0)}R`, color: C.negD }] })}
<div class="note">The same ${ALL.length.toLocaleString()} trades reshuffled into 3,000 random orders. The real history (${MC.ALL.hist.toFixed(0)}R) was on the lucky side of the median (${MC.ALL.med.toFixed(0)}R) — plan for the 95th percentile. 1R = your risk per trade.</div>
${table(['', 'Actual max DD', 'Typical (median)', '95% worst case', '99% worst case', 'At $1 risk (95%)'], [...COINS, 'ALL'].map((s) => [s === 'ALL' ? '<b>All ' + COINS.length + '</b>' : s, MC[s].hist.toFixed(1) + 'R', MC[s].med.toFixed(1) + 'R', `<b>${MC[s].p95.toFixed(1)}R</b>`, MC[s].p99.toFixed(1) + 'R', '$' + MC[s].p95.toFixed(0)]), { cls: 'num' })}</div>
<div><div class="card"><h3>Expectations at your planned $1 risk per trade</h3>${tiles([{ l: 'Trades per month', v: (perYearTrades / 12).toFixed(0), s: `all ${COINS.length} coins` }, { l: 'Expected per month', v: '$' + perMonth1.toFixed(1), s: 'average, based on 2023→' }, { l: 'Plan for drawdown', v: '$' + MC.ALL.p95.toFixed(0), s: '95% worst case' }, { l: 'Win rate', v: pct(SALL.wr), s: 'most trades lose' }])}
<ul class="tight"><li>Scale is linear: at $5 risk multiply every dollar figure by 5 (drawdown plan ≈ $${(MC.ALL.p95 * 5).toFixed(0)}).</li>
<li>A losing streak of ${SMIN}–${SMAX} trades on one coin is <b>normal</b> — it happened ${COINS.map((s) => `${s} ${allStreaks(T[s]).filter((q) => q.k >= 8).length}×`).join(', ')} in six years.</li>
<li>Recoveries can be slow: ${DC}’s worst drawdown ${DCtxt}.</li>
<li>Many individual months lose money (${MROWS.filter((r) => r.R < 0).length} of ${MROWS.length} coin-months); judge it over quarters, not weeks.</li></ul></div>
<div class="card"><h3>Stop-and-review triggers (set from this history, not tuned)</h3><ul class="tight">
<li><b>Drawdown deeper than ${MC.ALL.p99.toFixed(0)}R</b> across the ${COINS.length} coins (beyond the 99% case) → stop and re-examine.</li>
<li><b>Rolling 50-trade result below −${Math.abs(W50).toFixed(0)}R</b> (worse than the worst 50-trade stretch ever seen) → stop.</li>
<li><b>4R target-hit rate below ~10% over 60+ trades</b> (history: ${pct(TPMIN)}–${pct(TPMAX)}) → the follow-through the edge depends on has gone.</li>
<li>Otherwise <b>do not change the rules</b> mid-drawdown — every losing stretch in this report recovered without changes.</li></ul></div></div></div>`);

// ================================================================= 9. VERDICT
const yAvg = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => { const a = ALL.filter((t) => yr(t.x) === y); return { label: y === 2026 ? '2026*' : String(y), v: a.reduce((p, t) => p + t.R, 0) / a.length }; });
const YBEST = yAvg.slice().sort((a, b) => b.v - a.v)[0], YWORST = yAvg.slice().sort((a, b) => a.v - b.v)[0], FADE = HYPR[0].b.avgR >= HYPR[0].a.avgR * 0.9 ? 'no clear fade' : 'some of the early edge has faded';
page(`<h2>8 · My take: is this strategy recommended?</h2>
<div class="grid2"><div><div class="card verdict big"><h3>Verdict</h3><p><b>Yes, as a small, rules-only strategy — not as an income source.</b> Across 2020–2026 and ${SALL.n.toLocaleString()} trades it earned ${r2(SALL.avgR)} per trade after realistic Binance costs and funding, made money on all ${COINS.length} coins, held up in 2023–26 (never used for tuning), and worked on ${UNTUNED.length} coins (${UNTUNED.join(', ')}) it had never been tuned on.</p>
<p>It is a classic trend-following breakout: <b>it does not predict or adapt to the market — it waits for big, clean moves and keeps losses small in between.</b> That is why it survived the 2021 mania, the 2022 crash and the 2024–26 ranges ${CY.neg.length ? 'with only ' + CY.neg.length + ' losing coin-year' + (CY.neg.length === 1 ? '' : 's') + ' (' + CYneg + ').' : 'without a single losing coin-year.'}</p></div>
<div class="card"><h3>Scorecard</h3>${table(['Question', 'Answer', 'Evidence'], [
  ['Profitable after realistic costs?', '<b class="pos">Yes</b>', `${usd(SALL.net)} over 2020–26; still ${usd(COINS.reduce((a, s) => a + sumUsd(T2x[s]), 0))} with double costs`],
  ['Works outside its tuning data?', '<b class="pos">Yes</b>', `${usd(sumUsd(held))} in 2023→; ${UNTUNED.join(', ')} never tuned: ${usd(UNTUNED.reduce((a, c) => a + SA[c].net, 0))}`],
  ['Free of look-ahead / repainting?', '<b class="pos">Yes</b>', `0 mismatches in ${checks.reduce((a, c) => a + c.cuts, 0)} truncation tests`],
  ['Consistent across regimes?', '<b>Mostly</b>', `${CY.pos + CY.flat} of ${CY.tot} coin-years positive or flat; chop costs money`],
  ['Adapts to changing markets?', '<b class="neg">No</b>', 'No filter tested improved total profit'],
  ['Edge decaying?', HYPR[0].b.avgR >= HYPR[0].a.avgR * 0.9 ? '<b>Not yet</b>' : '<b>Somewhat</b>', `${r2(HYPR[0].a.avgR)} per trade before 2023 vs ${r2(HYPR[0].b.avgR)} after`],
  ['Easy to sit through?', '<b class="neg">No</b>', `${pct(SALL.wr)} win rate, ${SMIN}–${SMAX} loss streaks, long recoveries`],
], { cls: 'small' })}</div>
<div class="card"><h3>Is the edge holding up? Average result per trade, by year (all ${COINS.length} coins)</h3>${barChart({ w: 520, h: 130, yFmt: (v) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(2) + 'R', items: yAvg })}<div class="note">*2026 to mid-October. ${YBEST.label} was the strongest year (${r2(YBEST.v)} per trade) and ${YWORST.label} the weakest (${r2(YWORST.v)}). Before 2023 the average trade was ${r2(HYPR[0].a.avgR)} vs ${r2(HYPR[0].b.avgR)} after — ${FADE}.</div></div></div>
<div><div class="card"><h3>Recommended setup</h3><ul class="tight">
<li><b>Coins:</b> all ${COINS.length} at equal size to start, GALA at half size until it has live results — shortest history, thinnest market, and all its profit comes from shorts.</li>
<li><b>Rules:</b> exactly as tested — Bollinger 20/2σ, SMA200 filter, stop at the middle band, <b>4R target</b>, 48-candle time exit.</li>
<li><b>Risk:</b> start at <b>$1 per trade</b>. Plan for a ≈$${MC.ALL.p95.toFixed(0)} drawdown; expect about $${perMonth1.toFixed(1)} a month on average (many single months will be negative).</li>
<li><b>Execution:</b> place the target as a resting limit order (maker fee) and the stop at entry; never move the stop early.</li>
<li><b>Review:</b> log every trade and compare with this report each month; use the stop triggers on the previous page.</li></ul></div>
<div class="card"><h3>Proven vs still a hypothesis</h3><div class="grid2 inner"><div><h4 class="pos">Supported by the data</h4><ul class="tight small">
<li>Profitable on ${COINS.join(', ')} after costs and funding</li><li>Big clean moves (either direction) pay; flat months lose</li><li>Edge per trade ranges from ${r2(SA[EMIN].avgR)} (${EMIN}) to ${r2(SA[EMAX].avgR)} (${EMAX})</li><li>Coins are only weakly correlated — combined drawdown ${usd(-SALL.dd)} vs ${usd(-COINS.reduce((a, c) => a + SA[c].dd, 0))} if each coin’s worst hit together</li><li>Break-even stops and whipsaw filters make it worse</li></ul></div>
<div><h4>Needs more testing</h4><ul class="tight small"><li>That the edge continues — the 4R target was picked with hindsight</li><li>Coin choice: these ${COINS.length} were picked from ~100 screened because they did best</li><li>Skipping breakouts after a strong 10-day trend (better per trade, less total)</li><li>Low-volatility-only trading (better per trade in both halves, but ${pct(1 - HYPR[3].b.net / HYPR[0].b.net)} less profit)</li><li>Letting winners run past 8 days</li><li>Why GALA works only on the short side</li></ul></div></div></div>
<div class="card slim muted">Backtests describe the past. Past results — even carefully tested, out-of-sample ones — do not guarantee future returns. Trade only money you can afford to lose.</div></div></div>`);

// ---------------------------------------------------------------- assemble
const css = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
:root { color-scheme: light; }
body { margin: 0; background: #e7e6e1; font-family: "Segoe UI", Arial, sans-serif; color: ${C.ink}; font-size: 10.5px; line-height: 1.38; -webkit-print-color-adjust: exact; print-color-adjust: exact; counter-reset: pg; }
.page { width: 297mm; height: 210mm; padding: 10mm 11mm 9mm; background: ${C.surface}; position: relative; overflow: hidden; page-break-after: always; break-after: page; margin: 0 auto 12px; counter-increment: pg; }
@media print { body { background: ${C.surface}; } .page { margin: 0; } }
.foot { position: absolute; left: 11mm; right: 11mm; bottom: 4.5mm; display: flex; justify-content: space-between; font-size: 8.5px; color: ${C.muted}; border-top: 1px solid ${C.grid}; padding-top: 3px; }
.pn::after { content: "Page " counter(pg); }
h1 { font-size: 30px; line-height: 1.12; margin: 4px 0 8px; letter-spacing: -0.5px; }
h2 { font-size: 19px; margin: 0 0 7px; letter-spacing: -0.2px; }
h3 { font-size: 11.5px; margin: 0 0 5px; color: ${C.ink}; }
h4 { font-size: 10.5px; margin: 6px 0 3px; }
p { margin: 0 0 6px; }
.kicker { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: ${C.ink2}; font-weight: 700; }
.sub { font-size: 13px; color: ${C.ink2}; max-width: 230mm; }
.lead { font-size: 11.5px; color: ${C.ink2}; margin-bottom: 8px; }
.muted { color: ${C.ink2}; }
.pos { color: ${C.posD}; } .neg { color: ${C.negD}; }
.tiles { display: flex; gap: 6px; margin: 6px 0 8px; }
.tile { flex: 1; background: #fff; border: 1px solid ${C.grid}; border-radius: 8px; padding: 6px 9px; }
.tl { font-size: 9px; color: ${C.ink2}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
.tv { font-size: 19px; font-weight: 700; margin-top: 1px; font-variant-numeric: tabular-nums; }
.ts { font-size: 9px; color: ${C.muted}; }
.card { background: #fff; border: 1px solid ${C.grid}; border-radius: 9px; padding: 8px 10px; margin-bottom: 7px; }
.card.slim { padding: 6px 10px; font-size: 10px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: start; }
.grid2.inner { gap: 10px; }
.cover-grid { grid-template-columns: 1.45fr 1fr; }
.cover-top { padding: 6mm 0 2mm; }
.cover .tiles .tv { font-size: 21px; }
.verdict { border-left: 4px solid ${C.pos}; }
.verdict p { font-size: 11px; }
.verdict.big p { font-size: 11.5px; }
.note { font-size: 9px; color: ${C.muted}; margin-top: 3px; }
table { width: 100%; border-collapse: collapse; font-size: 9.6px; font-variant-numeric: tabular-nums; }
th { text-align: left; font-weight: 600; color: ${C.ink2}; border-bottom: 1px solid ${C.axis}; padding: 3px 4px; font-size: 9px; }
td { border-bottom: 1px solid ${C.grid}; padding: 2.6px 4px; vertical-align: top; }
table.num td:not(:first-child), table.num th:not(:first-child) { text-align: right; }
table.small { font-size: 9px; } table.small td { padding: 2px 4px; }
table.lastL td:last-child, table.lastL th:last-child { text-align: left; padding-left: 8px; }
table.mt td:nth-child(3), table.mt th:nth-child(3) { text-align: left; }
table.kv td:first-child { width: 33%; font-weight: 600; color: ${C.ink2}; }
tr.tot td { border-top: 1px solid ${C.axis}; border-bottom: none; background: #f7f6f3; }
ul.tight { margin: 4px 0 2px; padding-left: 16px; } ul.tight li { margin-bottom: 3px; }
ul.small { font-size: 9.6px; }
.legend { display: flex; gap: 12px; font-size: 9.5px; color: ${C.ink2}; margin: 0 0 3px; flex-wrap: wrap; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
.hm-title { font-size: 10px; font-weight: 700; margin: 4px 0 1px; } .hm-title i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
.yhead { display: flex; justify-content: space-between; align-items: flex-end; }
.yhead h2 { margin: 0; font-size: 22px; }
.badge { font-size: 11px; font-weight: 700; background: ${C.neutral}; border: 1px solid ${C.axis}; border-radius: 99px; padding: 3px 11px; color: ${C.ink}; }
.yp .tiles .tv { font-size: 16px; }
.grid-y { display: grid; grid-template-columns: 1.6fr 1fr; gap: 0 8px; }
.grid-y .card p { font-size: 10px; margin-bottom: 4px; }
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BB Breakout Backtest Report</title><style>${css}</style>
<script>addEventListener('DOMContentLoaded',()=>{const m=location.hash.match(/p(\\d+)/);if(m){const n=+m[1];document.querySelectorAll('.page').forEach((p,i)=>{if(i!==n-1)p.style.display='none';else{p.style.counterReset='pg '+(n-1);p.style.margin='0';}});document.body.style.background='#fff';}});</script></head>
<body>${pages.join('\n')}</body></html>`;
const htmlPath = path.join(OUT, 'BB-Breakout-6yr-Report.html'), pdfPath = path.resolve(OUT, '../../../PDF', 'BB Breakout - 5 Coins - Strategy Deep Dive 2020-2026.pdf');
fs.writeFileSync(htmlPath, html);
const url = 'file:///' + htmlPath.replace(/\\/g, '/');
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', `--print-to-pdf=${pdfPath}`, url], { stdio: 'ignore' });
console.error('pages:', pages.length, '→', pdfPath);
if (process.argv.includes('--shots')) {
  const dir = path.join(OUT, 'shots'); fs.mkdirSync(dir, { recursive: true });
  const which = process.argv.find((a) => /^--only=/.test(a)); const list = which ? which.slice(7).split(',').map(Number) : pages.map((_, i) => i + 1);
  for (const n of list) execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1123,794', `--screenshot=${path.join(dir, `p${n}.png`)}`, `${url}#p${n}`], { stdio: 'ignore' });
  console.error('shots in', dir);
}
