// famA.js - FAMILY A: fall throttle. size x factor while equity is below its own peak (peak seen at signal times, reset per run).
// PRE-LISTED GRID (written before running; 16 settings + baseline). Name = T<depth%>_f<factor>[_r<recover-within%>]
//  plain (no hysteresis): throttled while depth below peak >= T, back to x1 as soon as depth < T:
//    T 10/15/20/25 x f 0.75/0.5/0.35  (12 settings)
//  recovery variant (hysteresis): switch on when depth >= T, stay on until equity is back within R% of peak:
//    T15 f0.5 r5 ; T15 f0.35 r5 ; T20 f0.5 r10 ; T20 f0.35 r10  (4 settings)
// Baseline: live, start 600, 50/25/25, K=1, cap 500. Tests per PLAN.md rules 1-4 (rule 5 done elsewhere).
//   node --max-old-space-size=8192 famA.js
'use strict';
const fs = require('fs'), X = require('../improve-nov27/opus-validate/causal');
const GRID = [];
for (const T of [10, 15, 20, 25]) for (const f of [0.75, 0.5, 0.35]) GRID.push({ name: `T${T}_f${f}`, T, f, r: null });
for (const [T, f, r] of [[15, 0.5, 5], [15, 0.35, 5], [20, 0.5, 10], [20, 0.35, 10]]) GRID.push({ name: `T${T}_f${f}_r${r}`, T, f, r });
const mkSize = (g) => { // fresh closure state per run
  let peak = 0, on = false;
  return ({ equity }) => {
    if (equity > peak) peak = equity;
    const d = peak > 0 ? 1 - equity / peak : 0;
    if (g.r == null) return d >= g.T / 100 ? g.f : 1;
    if (!on && d >= g.T / 100) on = true; else if (on && d <= g.r / 100) on = false;
    return on ? g.f : 1;
  };
};
const ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, p = (v) => (100 * v).toFixed(1);
const wins = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= X.END) wins.push([ts(y, m), ts(y + 1, m)]);
const base = { mode: 'live', start: 600, cap: 500 };
const go = (g, extra = {}) => { const o = { ...base, ...extra }; if (g) o.sizeFn = mkSize(g); return X.run(o); };
const evalSet = (g) => {
  const full = go(g), fs_ = X.stats(full), f24 = X.stats(go(g, { from: X.CUT })), dc = X.stats(go(g, { cost: 2 }));
  const w = wins.map(([a, b]) => X.stats(go(g, { from: a, to: b })));
  return { full, fs_, f24, dc, w };
};
const B = evalSet(null);
const rows = [{ name: 'BASELINE', ...B }];
console.log('baseline', B.fs_.end, B.fs_.dd, B.full.trades.length, 'windows', wins.length);
for (const g of GRID) { const r = evalSet(g); rows.push({ name: g.name, ...r }); console.log(g.name, Math.round(r.fs_.end), p(r.fs_.dd)); }
const trades = {};
for (const r of rows) trades[r.name] = r.full.trades.map((t) => ({ bot: t.bot, R: t.R, t: t.t, tExit: t.tExit, mult: t.mult, w: t.w }));
fs.writeFileSync(__dirname + '/famA-trades.json', JSON.stringify(trades));
const bw = B.w, n = wins.length;
let md = `# Family A - fall throttle results\n\nBaseline: live, US$600, 50/25/25, risk x1, US$500 cap. ${n} twelve-month windows. Peak equity is observed at signal times only (engine calls sizeFn only at signals).\n\n`;
md += '| setting | end US$ | worst fall | end % base | 2024 growth/yr (base) | 2024 fall (base) | 2x cost end | 2x cost fall (base) | 12m smaller fall | 12m profitable (base) | R1 | R2 | R3 | R4 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
const out = [];
for (const r of rows) {
  const sm = r.w.filter((x, i) => x.dd < bw[i].dd).length / n, pr = r.w.filter((x) => x.ret > 0).length, bpr = bw.filter((x) => x.ret > 0).length;
  const R1 = B.fs_.dd - r.fs_.dd >= 0.01 && r.fs_.end >= 0.85 * B.fs_.end, R2 = r.f24.dd < B.f24.dd && r.f24.cagr >= 0.85 * B.f24.cagr, R3 = r.dc.end > 600 && r.dc.dd < B.dc.dd, R4 = sm > 0.5 && pr >= bpr;
  const y = (v) => (v ? 'pass' : 'fail');
  if (r.name === 'BASELINE') md += `| BASELINE | ${Math.round(r.fs_.end).toLocaleString('en-US')} | ${p(r.fs_.dd)}% | 100% | ${p(r.f24.cagr)}% | ${p(r.f24.dd)}% | ${Math.round(r.dc.end).toLocaleString('en-US')} | ${p(r.dc.dd)}% | - | ${pr}/${n} | - | - | - | - |\n`;
  else { md += `| ${r.name} | ${Math.round(r.fs_.end).toLocaleString('en-US')} | ${p(r.fs_.dd)}% | ${p(r.fs_.end / B.fs_.end)}% | ${p(r.f24.cagr)}% (${p(B.f24.cagr)}%) | ${p(r.f24.dd)}% (${p(B.f24.dd)}%) | ${Math.round(r.dc.end).toLocaleString('en-US')} | ${p(r.dc.dd)}% (${p(B.dc.dd)}%) | ${p(sm)}% | ${pr}/${n} (${bpr}) | ${y(R1)} | ${y(R2)} | ${y(R3)} | ${y(R4)} |\n`; out.push({ name: r.name, R: [R1, R2, R3, R4] }); }
}
md += `\nPassing rules 1-4: ${out.filter((o) => o.R.every(Boolean)).map((o) => o.name).join(', ') || 'none'}\n`;
fs.writeFileSync(__dirname + '/famA-results.md', md);
console.log(md);
