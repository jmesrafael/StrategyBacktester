// famB.js - FAMILY B portfolio heat. node --max-old-space-size=8192 famB.js
// GRID (pre-listed before any setting was run; no setting added or changed afterwards). 14 settings.
//  ctx (from causalB.js): allOpen = open trades across ALL bots (+ orders already placed at this same close),
//  allSame = same-side open across all bots, openRisk = sum of each open trade's risk at its ORIGINAL stop / equity.
//  a new order is multiplied by f when the condition holds (f = 0 means skip the trade).
//  T6/T8/T10   : allOpen > k (k = 6, 8, 10), f = 0.5
//  S4/S6/S8    : allSame > k (k = 4, 6, 8), f = 0.5
//  R4/R6/R8/R10/R12 : openRisk > h (h = 4%, 6%, 8%, 10%, 12% of equity), f = 0.5
//  R8skip      : openRisk > 8%, f = 0 (skip)
//  T8q         : allOpen > 8, f = 0.25
//  S6q         : allSame > 6, f = 0.25
'use strict';
const fs = require('fs');
const X = require('./causalB');
const GRID = {};
for (const k of [6, 8, 10]) GRID['T' + k] = (c) => (c.allOpen > k ? 0.5 : 1);
for (const k of [4, 6, 8]) GRID['S' + k] = (c) => (c.allSame > k ? 0.5 : 1);
for (const h of [4, 6, 8, 10, 12]) GRID['R' + h] = (c) => (c.openRisk > h / 100 ? 0.5 : 1);
GRID.R8skip = (c) => (c.openRisk > 0.08 ? 0 : 1);
GRID.T8q = (c) => (c.allOpen > 8 ? 0.25 : 1);
GRID.S6q = (c) => (c.allSame > 6 ? 0.25 : 1);
const NAMES = ['BASE', ...Object.keys(GRID)];
const LIVE = { mode: 'live', start: 600, cap: 500 };
const ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, p = (v) => (100 * v).toFixed(1), usd = (v) => Math.round(v).toLocaleString('en-US');
const wins = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= X.END) wins.push([ts(y, m), ts(y + 1, m)]);
const sf = (n) => (n === 'BASE' ? {} : { sizeFn: GRID[n] });
const go = (n, extra = {}) => { const r = X.run({ ...LIVE, ...sf(n), ...extra }); return { r, s: X.stats(r) }; };
const res = {}, trades = {};
for (const n of NAMES) {
  const full = go(n), fresh = X.stats(X.run({ ...LIVE, ...sf(n), from: X.CUT })), x2 = go(n, { cost: 2 }).s;
  const w = wins.map(([a, b]) => X.stats(X.run({ ...LIVE, ...sf(n), from: a, to: b })));
  res[n] = { end: full.s.end, dd: full.s.dd, n: full.r.trades.length, fresh, x2, w, skipMin: full.r.stat.skipMin };
  trades[n] = full.r.trades.map((t) => ({ bot: t.bot, R: t.R, t: t.t, tExit: t.tExit, mult: t.mult, w: t.w }));
  console.log(n, usd(full.s.end), p(full.s.dd), full.r.trades.length);
}
const B = res.BASE;
const out = ['# Family B: portfolio heat (results)', '', `Baseline (causalB, no sizeFn, live US$600, cap US$500): end US$${usd(B.end)}, worst fall ${p(B.dd)}%, ${B.n} trades. Reproduces PLAN baseline (782,730 / 43.7).`,
  '', 'Rules: 1 = fall at least 1 pt smaller AND end >= 85% of base. 2 = fresh 2024: fall smaller AND CAGR >= 85% of base. 3 = double costs: end > 600 AND fall smaller. 4 = 71 12-month fresh starts: smaller fall in > half AND positive count >= baseline. Rule 5 (shuffle) not run here.', '',
  '| setting | end US$ | % of base | fall % | trades | R1 | fresh24 CAGR % / fall % | R2 | x2 end / fall | R3 | 12m smaller fall | 12m positive (base) | R4 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
const bpos = B.w.filter((x) => x.ret > 0).length;
for (const n of NAMES) {
  const r = res[n], r1 = r.dd <= B.dd - 0.01 && r.end >= 0.85 * B.end, r2 = r.fresh.dd < B.fresh.dd && r.fresh.cagr >= 0.85 * B.fresh.cagr, r3 = r.x2.end > 600 && r.x2.dd < B.x2.dd;
  const sm = r.w.filter((x, i) => x.dd < B.w[i].dd).length, pos = r.w.filter((x) => x.ret > 0).length, r4 = sm > r.w.length / 2 && pos >= bpos;
  r.pass = [r1, r2, r3, r4]; const y = (q) => (q ? 'y' : '.');
  out.push(`| ${n} | ${usd(r.end)} | ${p(r.end / B.end)} | ${p(r.dd)} | ${r.n} | ${y(r1)} | ${p(r.fresh.cagr)} / ${p(r.fresh.dd)} | ${y(r2)} | ${usd(r.x2.end)} / ${p(r.x2.dd)} | ${y(r3)} | ${sm}/${r.w.length} | ${pos} (${bpos}) | ${y(r4)} |`);
}
out.push('', 'Passing rules 1-4: ' + (NAMES.filter((n) => n !== 'BASE' && res[n].pass.every(Boolean)).join(', ') || 'none'));
fs.writeFileSync(__dirname + '/famB-results.md', out.join('\n') + '\n');
fs.writeFileSync(__dirname + '/famB-trades.json', JSON.stringify(trades));
console.log(out.join('\n'));
