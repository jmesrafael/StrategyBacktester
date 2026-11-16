// report/charts.js - tiny dependency-free SVG chart helpers for the admin report. Every function returns an SVG string.
'use strict';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const C = { ink: '#0f172a', mute: '#64748b', grid: '#e2e8f0', blue: '#1d4ed8', teal: '#0f766e', green: '#15803d', red: '#dc2626', amber: '#d97706', violet: '#7c3aed', lblue: '#dbeafe', lgreen: '#dcfce7', lred: '#fee2e2', lgrey: '#f1f5f9' };
const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
function ticks(min, max, n = 5) {
  const span = max - min || 1, raw = span / n, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p, step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10)); return out;
}
const fmt = (v, d = 0) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : v.toFixed(d));
const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(label || '')}" style="max-width:${w}px;display:block;margin:0 auto" font-family="Segoe UI, Arial, sans-serif">${body}</svg>`;
const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 10}" fill="${o.fill || C.mute}" text-anchor="${o.anchor || 'start'}"${o.bold ? ' font-weight="700"' : ''}${o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : ''}>${esc(s)}</text>`;

// ---------- time-series line chart ----------
// series: [{ name, color, pts: [[x, y]], width, dash, area }]  xticks: [{ v, label }]  vlines: [{ x, label, color }]  hlines: [{ y, label, color }]  bands: [{ x0, x1, color }]  marks: [{ x, y, color, shape }]
function line({ w = 700, h = 200, series, xmin, xmax, ymin, ymax, xticks = [], vlines = [], hlines = [], bands = [], marks = [], ytitle = '', ydec = 0, legend = true, label = '' }) {
  const m = { l: 46, r: 14, t: series.length > 1 && legend ? 26 : 14, b: 26 }, all = series.flatMap((s) => s.pts);
  if (xmin == null) xmin = Math.min(...all.map((p) => p[0])); if (xmax == null) xmax = Math.max(...all.map((p) => p[0]));
  const ys = all.map((p) => p[1]).concat(hlines.map((l) => l.y)); if (ymin == null) ymin = Math.min(...ys); if (ymax == null) ymax = Math.max(...ys);
  const pad = (ymax - ymin) * 0.06 || 1; ymin -= pad; ymax += pad;
  const sx = lin(xmin, xmax, m.l, w - m.r), sy = lin(ymin, ymax, h - m.b, m.t); let b = '';
  for (const t of ticks(ymin, ymax, 4)) b += `<line x1="${m.l}" x2="${w - m.r}" y1="${sy(t)}" y2="${sy(t)}" stroke="${C.grid}"/>` + text(m.l - 5, sy(t) + 3, fmt(t, ydec), { anchor: 'end' });
  for (const bd of bands) b += `<rect x="${sx(bd.x0)}" y="${m.t}" width="${Math.max(1, sx(bd.x1) - sx(bd.x0))}" height="${h - m.b - m.t}" fill="${bd.color}" opacity=".55"/>`;
  for (const t of xticks) b += `<line x1="${sx(t.v)}" x2="${sx(t.v)}" y1="${h - m.b}" y2="${h - m.b + 4}" stroke="${C.mute}"/>` + text(sx(t.v), h - m.b + 15, t.label, { anchor: 'middle' });
  b += `<line x1="${m.l}" x2="${w - m.r}" y1="${h - m.b}" y2="${h - m.b}" stroke="${C.mute}"/>`;
  for (const l of hlines) b += `<line x1="${m.l}" x2="${w - m.r}" y1="${sy(l.y)}" y2="${sy(l.y)}" stroke="${l.color || C.mute}" stroke-dasharray="4 3"/>` + (l.label ? text(w - m.r - 2, sy(l.y) - 3, l.label, { anchor: 'end', fill: l.color || C.mute }) : '');
  for (const v of vlines) b += `<line x1="${sx(v.x)}" x2="${sx(v.x)}" y1="${m.t}" y2="${h - m.b}" stroke="${v.color || C.amber}" stroke-dasharray="3 3"/>` + (v.label ? `<circle cx="${sx(v.x)}" cy="${m.t + 7}" r="7" fill="${v.color || C.amber}"/>` + text(sx(v.x), m.t + 10.5, v.label, { anchor: 'middle', fill: '#fff', bold: true, size: 9 }) : '');
  for (const s of series) {
    const d = s.pts.map((p, i) => (i ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join('');
    if (s.area) b += `<path d="${d}L${sx(s.pts[s.pts.length - 1][0]).toFixed(1)} ${sy(0)}L${sx(s.pts[0][0]).toFixed(1)} ${sy(0)}Z" fill="${s.color}" opacity=".12"/>`;
    b += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 1.8}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round"/>`;
  }
  for (const k of marks) b += k.shape === 'tri' ? `<path d="M${sx(k.x) - 4} ${sy(k.y) + 4}L${sx(k.x) + 4} ${sy(k.y) + 4}L${sx(k.x)} ${sy(k.y) - 4}Z" fill="${k.color}"/>` : `<circle cx="${sx(k.x)}" cy="${sy(k.y)}" r="3.5" fill="${k.color}" stroke="#fff"/>`;
  if (ytitle) b += text(10, (m.t + h - m.b) / 2, ytitle, { rot: -90, anchor: 'middle' });
  if (legend && series.length > 1) series.forEach((s, i) => { b += `<rect x="${m.l + 6 + i * 130}" y="6" width="10" height="3" fill="${s.color}"/>` + text(m.l + 20 + i * 130, 10, s.name, { size: 9.5, fill: C.ink }); });
  return svg(w, h, b, label);
}
// ---------- vertical bars ----------
// bars: [{ label, value, color, sub }]  groups option: grouped bars use bars: [{ label, values: [v1, v2], colors, }]
function bars({ w = 700, h = 200, items, ymin, ymax, ydec = 1, hlines = [], labelRot = 0, series = null, label = '', valueLabels = true }) {
  const m = { l: 44, r: hlines.some((l) => l.label) ? 84 : 12, t: series ? 26 : 16, b: labelRot ? 56 : 32 }, vals = items.flatMap((i) => (i.values || [i.value])).filter((v) => v != null);
  ymin = ymin != null ? ymin : Math.min(0, ...vals); ymax = ymax != null ? ymax : Math.max(0, ...vals); const pad = (ymax - ymin) * 0.08 || 1; if (ymax > 0) ymax += pad; if (ymin < 0) ymin -= pad;
  const sy = lin(ymin, ymax, h - m.b, m.t), n = items.length, gw = (w - m.l - m.r) / n; let b = '';
  for (const t of ticks(ymin, ymax, 4)) b += `<line x1="${m.l}" x2="${w - m.r}" y1="${sy(t)}" y2="${sy(t)}" stroke="${C.grid}"/>` + text(m.l - 5, sy(t) + 3, fmt(t, ydec), { anchor: 'end' });
  b += `<line x1="${m.l}" x2="${w - m.r}" y1="${sy(0)}" y2="${sy(0)}" stroke="${C.mute}"/>`;
  for (const l of hlines) b += `<line x1="${m.l}" x2="${w - m.r}" y1="${sy(l.y)}" y2="${sy(l.y)}" stroke="${l.color || C.mute}" stroke-dasharray="4 3"/>` + (l.label ? text(w - m.r + 4, sy(l.y) + 3, l.label, { anchor: 'start', fill: l.color || C.mute }) : '');
  items.forEach((it, i) => {
    const vs = it.values || [it.value], bw = Math.min(34, (gw * 0.7) / vs.length), x0 = m.l + i * gw + gw / 2 - (bw * vs.length) / 2;
    vs.forEach((v, j) => { if (v == null) return; const y = sy(Math.max(v, 0)), hh = Math.abs(sy(v) - sy(0)); b += `<rect x="${x0 + j * bw + 0.5}" y="${y}" width="${bw - 1}" height="${Math.max(0.5, hh)}" fill="${(it.colors && it.colors[j]) || it.color || (v >= 0 ? C.green : C.red)}" rx="1.5"/>`;
      if (valueLabels && gw > 22) b += text(x0 + j * bw + bw / 2, v >= 0 ? y - 3 : y + hh + 9, v.toFixed(ydec), { anchor: 'middle', size: 8.5, fill: C.ink }); });
    const lx = m.l + i * gw + gw / 2; b += text(lx, h - m.b + 13, it.label, { anchor: labelRot ? 'end' : 'middle', size: 9, fill: C.ink, rot: labelRot });
  });
  if (series) series.forEach((s, i) => { b += `<rect x="${m.l + 6 + i * 150}" y="2" width="10" height="8" fill="${s.color}"/>` + text(m.l + 20 + i * 150, 10, s.name, { size: 9.5, fill: C.ink }); });
  return svg(w, h, b, label);
}
// ---------- horizontal range (confidence interval) plot ----------
// rows: [{ label, lo, hi, mid, color, note }]
function ranges({ w = 700, rows, xmin, xmax, label = '', xdec = 1 }) {
  const m = { l: 215, r: 40, t: 10, b: 24 }, rh = 17, h = m.t + m.b + rows.length * rh, sx = lin(xmin, xmax, m.l, w - m.r); let b = '';
  for (const t of ticks(xmin, xmax, 6)) b += `<line x1="${sx(t)}" x2="${sx(t)}" y1="${m.t}" y2="${h - m.b}" stroke="${C.grid}"/>` + text(sx(t), h - m.b + 13, fmt(t, xdec), { anchor: 'middle' });
  b += `<line x1="${sx(0)}" x2="${sx(0)}" y1="${m.t}" y2="${h - m.b}" stroke="${C.ink}"/>`;
  rows.forEach((r, i) => { const y = m.t + i * rh + rh / 2; if (i % 2) b += `<rect x="0" y="${y - rh / 2}" width="${w}" height="${rh}" fill="${C.lgrey}" opacity=".6"/>`;
    b += text(m.l - 8, y + 3.5, r.label, { anchor: 'end', size: 9.5, fill: r.color === C.mute ? C.mute : C.ink });
    b += `<line x1="${sx(Math.max(xmin, r.lo))}" x2="${sx(Math.min(xmax, r.hi))}" y1="${y}" y2="${y}" stroke="${r.color}" stroke-width="2.4"/><circle cx="${sx(Math.min(xmax, Math.max(xmin, r.mid)))}" cy="${y}" r="3.6" fill="${r.color}"/>`; });
  return svg(w, h, b, label);
}
// ---------- check matrix ----------
// rows: [{ label, cells: ['pass'|'fail'|'skip'|null], verdict }], cols: [header]
function matrix({ w = 700, cols, rows, label = '' }) {
  const m = { l: 90, t: 66, r: 110 }, cw = (w - m.l - m.r) / cols.length, rh = 26, h = m.t + rows.length * rh + 8; let b = '';
  cols.forEach((c, j) => { b += text(m.l + j * cw + cw / 2, m.t - 8, c, { anchor: 'start', size: 9, fill: C.ink, rot: -50 }); });
  rows.forEach((r, i) => { const y = m.t + i * rh; b += text(m.l - 8, y + 17, r.label, { anchor: 'end', size: 11, fill: C.ink, bold: true });
    r.cells.forEach((c, j) => { const col = c === 'pass' ? C.green : c === 'fail' ? C.red : '#cbd5e1'; b += `<rect x="${m.l + j * cw + 2}" y="${y + 2}" width="${cw - 4}" height="${rh - 4}" rx="4" fill="${col}"/>` + text(m.l + j * cw + cw / 2, y + 17, c === 'pass' ? '✓' : c === 'fail' ? '✗' : '–', { anchor: 'middle', size: 12, fill: '#fff', bold: true }); });
    const vc = r.verdict === 'REJECTED' ? C.red : r.verdict === 'WATCH' ? C.amber : C.green; b += `<rect x="${w - m.r + 8}" y="${y + 2}" width="92" height="${rh - 4}" rx="13" fill="${vc}"/>` + text(w - m.r + 54, y + 17, r.verdict, { anchor: 'middle', size: 10, fill: '#fff', bold: true }); });
  return svg(w, h, b, label);
}
// ---------- stacked horizontal bars ----------
function stacked({ w = 700, items, keys, colors, label = '' }) {
  const m = { l: 70, r: 14, t: 22, b: 8 }, rh = 30, h = m.t + items.length * rh + m.b, max = Math.max(...items.map((i) => keys.reduce((s, k) => s + (i[k] || 0), 0)), 1), sx = lin(0, max, m.l, w - m.r); let b = '';
  keys.forEach((k, i) => { b += `<rect x="${m.l + i * 140}" y="4" width="10" height="10" fill="${colors[i]}"/>` + text(m.l + 14 + i * 140, 13, k.replace(/_/g, ' '), { size: 10, fill: C.ink }); });
  items.forEach((it, i) => { let x = m.l; const y = m.t + i * rh; b += text(m.l - 8, y + 18, it.label, { anchor: 'end', size: 11, fill: C.ink, bold: true });
    keys.forEach((k, j) => { const v = it[k] || 0, ww = sx(v) - m.l; if (v) b += `<rect x="${x}" y="${y + 3}" width="${ww}" height="${rh - 8}" fill="${colors[j]}"/>` + (ww > 14 ? text(x + ww / 2, y + 19, v, { anchor: 'middle', size: 10, fill: '#fff', bold: true }) : ''); x += ww; }); });
  return svg(w, h, b, label);
}
// ---------- boxes and arrows for diagrams ----------
const box = (x, y, w, h, title, lines = [], fill = '#fff', stroke = C.blue) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` + text(x + w / 2, y + 17, title, { anchor: 'middle', size: 11.5, fill: C.ink, bold: true }) + lines.map((l, i) => text(x + w / 2, y + 33 + i * 13, l, { anchor: 'middle', size: 9.5, fill: C.mute })).join('');
const arrow = (x1, y1, x2, y2, color = C.mute) => { const a = Math.atan2(y2 - y1, x2 - x1), hx = 7; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.6"/><path d="M${x2} ${y2}L${x2 - hx * Math.cos(a - 0.45)} ${y2 - hx * Math.sin(a - 0.45)}L${x2 - hx * Math.cos(a + 0.45)} ${y2 - hx * Math.sin(a + 0.45)}Z" fill="${color}"/>`; };
module.exports = { C, esc, svg, text, line, bars, ranges, matrix, stacked, box, arrow, ticks };
