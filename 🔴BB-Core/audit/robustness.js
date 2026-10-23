// robustness.js — (1) frozen rules on EVERY screened coin (selection-bias check), (2) parameter sensitivity on SOL+ZEC,
// (3) walk-forward: choose params on years <= Y-1, score year Y, (4) bootstrap / sign-test of "positive every year".
//   node audit/robustness.js
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, DEFAULTS } = require('../lucidyo-core.js');
const RB = path.join(__dirname, '..', '..', 'research', 'bollinger', 'data4h'), D = path.join(__dirname, '..', 'data');
const yr = (t) => new Date(t * 1000).getUTCFullYear();
const toB = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const cost = { entryFee: 0.0005, stopFee: 0.0005, timeFee: 0.0005, tpFee: 0.0002, slip: 0.0002, tpSlip: 0, tpBuf: 0.0005 }; // no funding for the wide screen
// ---------- (1) wide screen
const files = fs.readdirSync(RB).filter((f) => f.endsWith('.json'));
const res = [];
for (const f of files) {
  let rows; try { rows = JSON.parse(fs.readFileSync(path.join(RB, f), 'utf8')); } catch { continue; }
  if (!Array.isArray(rows) || rows.length < 1500) continue;
  const t = backtest(toB(rows), { cost }).trades; if (t.length < 40) continue;
  const ys = {}; t.forEach((x) => { const y = yr(x.tExit); ys[y] = (ys[y] || 0) + x.R; });
  res.push({ c: f.slice(0, -5), n: t.length, avg: mean(t.map((x) => x.R)), pos: Object.values(ys).filter((v) => v > 0).length, yrs: Object.keys(ys).length });
}
res.sort((a, b) => b.avg - a.avg);
const pos = res.filter((r) => r.avg > 0).length, all7 = res.filter((r) => r.pos === r.yrs && r.yrs >= 6);
console.log(`(1) frozen rules on ${res.length} coins (no funding): ${pos} positive avgR, ${res.length - pos} not. median avgR=${res.map((r) => r.avg).sort((a, b) => a - b)[res.length >> 1].toFixed(3)}  coins positive in EVERY year (>=6 yrs): ${all7.length}`);
const rank = (c) => res.findIndex((r) => r.c === c) + 1;
for (const c of ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'BTC']) { const r = res.find((x) => x.c === c); if (r) console.log(`    ${c}: avgR ${r.avg.toFixed(3)} rank ${rank(c)}/${res.length} yrs+ ${r.pos}/${r.yrs}`); }
console.log('    top 8:', res.slice(0, 8).map((r) => `${r.c} ${r.avg.toFixed(2)}`).join(', '));
// ---------- (2) sensitivity SOL+ZEC (with funding), one parameter at a time and a joint grid
const load = (c) => ({ B: toB(JSON.parse(fs.readFileSync(path.join(D, c + '.json')))), F: JSON.parse(fs.readFileSync(path.join(D, 'funding', c + '.json'))) });
const data = { SOL: load('SOL'), ZEC: load('ZEC') };
const run = (cfg) => ['SOL', 'ZEC'].flatMap((c) => backtest(data[c].B, { ...cfg, cost }, data[c].F).trades);
const sum = (tr) => tr.reduce((a, t) => a + t.R, 0);
const line = (name, cfg) => { const tr = run(cfg), ys = {}; tr.forEach((t) => { const y = yr(t.tExit); ys[y] = (ys[y] || 0) + t.R; }); const yp = Object.values(ys).filter((v) => v > 0).length; console.log(`    ${name.padEnd(22)} n=${tr.length} netR=${sum(tr).toFixed(0).padStart(4)} avgR=${mean(tr.map((t) => t.R)).toFixed(2)} yrs+ ${yp}/${Object.keys(ys).length}`); };
console.log('\n(2) one-at-a-time sensitivity, SOL+ZEC, base costs + funding');
line('FROZEN (20,2,200,4R,48)', {});
for (const v of [1.5, 1.8, 2.2, 2.5]) line(`bbMult ${v}`, { bbMult: v });
for (const v of [15, 25, 30]) line(`bbLen ${v}`, { bbLen: v });
for (const v of [100, 150, 250, 300]) line(`trendLen ${v}`, { trendLen: v, warmup: Math.max(202, v + 2) });
for (const v of [2, 3, 5, 6]) line(`targetR ${v}`, { targetR: v });
for (const v of [24, 36, 72, 96]) line(`maxBars ${v}`, { maxBars: v });
for (const v of [0, 0.15, 0.5, 0.8]) line(`minStopAtr ${v}`, { minStopAtr: v });
line('no trend filter', { trendLen: 0 });
// ---------- (3) walk-forward on a modest grid (chosen on past years only, scored on next year)
const grid = []; for (const bbMult of [1.5, 2, 2.5]) for (const trendLen of [100, 200]) for (const targetR of [2, 3, 4, 5]) for (const maxBars of [24, 48, 96]) grid.push({ bbMult, trendLen, targetR, maxBars, warmup: Math.max(202, trendLen + 2) });
const cache = grid.map((g) => ({ g, tr: run(g) }));
console.log(`\n(3) walk-forward over ${grid.length} parameter sets (expanding window; pick best total R on years < Y, report year Y):`);
let wfTot = 0, frozenTot = 0;
for (let Y = 2022; Y <= 2026; Y++) {
  let best = null; for (const c of cache) { const s = sum(c.tr.filter((t) => yr(t.tExit) < Y)); if (!best || s > best.s) best = { c, s }; }
  const oos = sum(best.c.tr.filter((t) => yr(t.tExit) === Y)), fz = sum(cache.find((c) => c.g.bbMult === 2 && c.g.trendLen === 200 && c.g.targetR === 4 && c.g.maxBars === 48).tr.filter((t) => yr(t.tExit) === Y));
  wfTot += oos; frozenTot += fz; const g = best.c.g;
  console.log(`    ${Y}: picked bb${g.bbMult}/sma${g.trendLen}/${g.targetR}R/${g.maxBars}bars (train ${best.s.toFixed(0)}R) -> OOS ${oos.toFixed(1)}R   [frozen params that year: ${fz.toFixed(1)}R]`);
}
console.log(`    walk-forward OOS total 2022-26 = ${wfTot.toFixed(1)}R ; frozen = ${frozenTot.toFixed(1)}R`);
// how many of the grid are positive in every year? (landscape flatness)
let allpos = 0, pos2 = 0; for (const c of cache) { const ys = {}; c.tr.forEach((t) => { const y = yr(t.tExit); ys[y] = (ys[y] || 0) + t.R; }); if (sum(c.tr) > 0) pos2++; if (Object.values(ys).every((v) => v > 0)) allpos++; }
console.log(`    grid landscape: ${pos2}/${grid.length} sets have positive total R; ${allpos}/${grid.length} are positive in EVERY year`);
// ---------- (4) year-sign null: if true edge were 0, P(all 7 combined years > 0)
let seed = 99; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const tr = run({}), R = tr.map((t) => t.R), m = mean(R); const Rc = R.map((r) => r - m); // demeaned = zero-edge world, same shape
const yrsOf = tr.map((t) => yr(t.tExit)), cnt = {}; yrsOf.forEach((y) => (cnt[y] = (cnt[y] || 0) + 1));
let hit = 0, hit5 = 0; const N = 20000;
for (let k = 0; k < N; k++) { const s = {}; for (const y of Object.keys(cnt)) { let t = 0; for (let i = 0; i < cnt[y]; i++) t += Rc[Math.floor(rnd() * Rc.length)]; s[y] = t; } const v = Object.values(s); if (v.every((x) => x > 0)) hit++; if (v.filter((x) => x > 0).length >= 6) hit5++; }
console.log(`\n(4) zero-edge null (same trade count/R-distribution per year, mean set to 0): P(all ${Object.keys(cnt).length} years > 0) = ${(100 * hit / N).toFixed(2)}% ; P(>=6 of ${Object.keys(cnt).length}) = ${(100 * hit5 / N).toFixed(2)}%`);
