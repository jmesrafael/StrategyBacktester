// Partial profit (Nov 26 2026): when open profit across the 3 bots reaches X% of the account, close a fraction f of every open trade once
// (at the next 4h open, 0.05% fee + 0.02% slippage on that part); the rest runs to the bot's own exit. Positions stay open, so later entries do not move.
'use strict';
const path = require('path'), fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8');
const body = src.slice(src.indexOf("const path = require('path')"), src.indexOf('// ---- parity'));
const { data, run, BOTS, YEARS, compound } = new Function('require', '__dirname', 'process', body + '\nreturn { data, run, BOTS, YEARS, compound };')(require, __dirname, { argv: [] });
const W = { bbcore: 0.5, tcore: 0.25, icore: 0.25 }, RISK = 0.025;
const T = {}; for (const b of BOTS) T[b] = [].concat(...data[b].map((D) => run(D).map((t) => ({ ...t, D }))));
const pct = new Map(); for (const b of BOTS) for (const t of T[b]) for (let i = t.i0; i < Math.min(t.i1, t.D.B.length); i++) { const k = t.D.B[i].time; pct.set(k, (pct.get(k) || 0) + W[b] * RISK * t.dir * (t.D.B[i].close - t.entry) / (t.dist * t.entry)); }
const trig = [...pct].sort((a, b) => a[0] - b[0]);
const res = [];
for (const [X, f] of [[0, 0], [0.3, 0.25], [0.3, 0.5], [0.2, 0.25], [0.4, 0.25], [0.4, 0.5]]) {
  const hits = X ? trig.filter(([, v]) => v >= X).map(([k]) => k) : [];
  let n = 0; const L = {};
  for (const b of BOTS) L[b] = T[b].map((t) => {
    const B = t.D.B; let R = t.R;
    if (X) for (let i = t.i0; i < t.i1; i++) { const k = B[i].time; if (hits.length && binHas(hits, k)) { if (i + 1 >= B.length) break; const px = B[i + 1].open * (1 - t.dir * 0.0002), r = (t.dir * (px - t.entry) / t.entry - 0.001) / t.dist; R = (1 - f) * t.R + f * r; n++; break; } }
    return { tExit: t.tExit, R };
  });
  const yr = Object.fromEntries(YEARS.map((y) => [y, 0])); let tot = 0;
  for (const b of BOTS) for (const t of L[b]) { tot += t.R; const y = new Date((t.tExit - 1) * 1000).getUTCFullYear(); if (yr[y] != null) yr[y] += t.R; }
  res.push({ X, f, n, yr, tot, m: compound(L) });
}
function binHas(a, x) { let lo = 0, hi = a.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] === x) return true; if (a[m] < x) lo = m + 1; else hi = m - 1; } return false; }
const f0 = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(0), peso = (x) => '₱' + (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : Math.round(x).toLocaleString('en-US'));
const lab = (r) => r.X ? `Take ${r.f * 100}% at ${r.X * 100}% open` : 'No interference';
const out = ['# Partial profit at an open-profit level (all three bots, 50/25/25, 2.5% risk, to Nov 25 2026)', '', '| Year | ' + res.map(lab).join(' | ') + ' |', '|---|' + res.map(() => '---|').join('')];
for (const y of YEARS) out.push(`| ${y} | ` + res.map((r) => f0(r.yr[y])).join(' | ') + ' |');
out.push('| **Total R** | ' + res.map((r) => `**${f0(r.tot)}**`).join(' | ') + ' |', '| vs no interference | ' + res.map((r) => r.X ? Math.round((r.tot / res[0].tot - 1) * 100) + '%' : '—').join(' | ') + ' |', '| Trades partly closed | ' + res.map((r) => r.n).join(' | ') + ' |', '| ₱1,000 compounded | ' + res.map((r) => peso(r.m.eq)).join(' | ') + ' |', '| Worst fall from a high | ' + res.map((r) => Math.round(r.m.worst * 100) + '%').join(' | ') + ' |');
fs.writeFileSync(path.join(__dirname, 'partial.md'), out.join('\n') + '\n'); console.log(out.join('\n'));
