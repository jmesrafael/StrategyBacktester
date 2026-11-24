// "Close everything when open profit is big" study (Nov 24 2026). Owner asked after open profit peaked at +269 USDT (Nov 21) and gave back ~177.
// Rule tested: at each 4h close, if the SUM of open R across the bot's open trades >= N, close all of them at that close.
// Uses the intel engine (same as sell-too-soon/run.js), live coins, standard costs. Extra exit fee 0.05%/dist per trade closed early.
// Caveat: signals that would have fired in the slots freed by an early close are NOT added (slightly understates the rule).
// Run from StrategyBacktester: node research/close-all-peak/sim.js
'use strict';
const path = require('path'), fs = require('fs');
const INTEL = path.join(__dirname, '..', '..', 'intel');
const E = require(path.join(INTEL, 'engines/backtest/engine'));
const S = require(path.join(INTEL, 'engines/backtest/strategies'));
const M0 = require(path.join(INTEL, 'lib/market'));
// read-only loader that skips intel's size registry (candles were refreshed after it registered them)
const _c = {};
const rows = (coin, tf) => { const k = coin + tf; return _c[k] || (_c[k] = JSON.parse(fs.readFileSync(M0.fileOf(coin, tf), 'utf8'))); };
const M = {
  has: (c, tf) => { try { return fs.existsSync(M0.fileOf(c, tf)); } catch (e) { return false; } },
  bars: rows,
  candles: (c, tf) => rows(c, tf).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })),
};
const cfg = require(path.join(INTEL, 'lib/config'));

function load(botKey) {
  const def = cfg.bots[botKey], all = [];
  for (const coin of def.coins) {
    if (!M.has(coin, '4h')) continue;
    const B = M.candles(coin, '4h'), F = M.has(coin, 'funding') ? M.bars(coin, 'funding') : null;
    const strat = S.bot(def.strategy, 'v3', {});
    const tr = E.run(B, strat, E.standardCost({ funding: F })).trades;
    for (const t of tr) {
      const path = [];                       // open R at each 4h close while the trade is alive
      for (let i = t.i0; i < t.i1; i++) path.push([B[i].time + 14400, t.dir * (B[i].close - t.entry) / (t.dist * t.entry)]);
      all.push({ ...t, coin, path });
    }
  }
  return all.sort((a, b) => a.tExit - b.tExit);
}

function stats(tr) {
  let eq = 0; const yr = {};
  for (const t of tr) { eq += t.R; const y = new Date(t.tExit * 1000).getUTCFullYear(); yr[y] = (yr[y] || 0) + t.R; }
  return { total: eq, yr };
}

// ---- peak episodes: biggest open-R peaks per bot, then close everything at / just after the peak
function openSeries(trades) {
  const m = new Map();
  trades.forEach((t, idx) => t.path.forEach(([T, r]) => { if (t.tExit > T) { const a = m.get(T) || { sum: 0, n: 0, idx: [] }; a.sum += r; a.n++; a.idx.push([idx, r]); m.set(T, a); } }));
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([T, a]) => ({ T, sum: a.sum, n: a.n, list: a.idx }));
}
function findPeaks(ser, minR) {   // real local tops: highest within +-10 days, >= minR, then gives back >= 35% within 7 days (like Nov 21: -65%)
  const D = 86400, keep = [];
  for (let i = 0; i < ser.length; i++) {
    const p = ser[i]; if (p.sum < minR || p.n < 3) continue;
    let ok = true, low = p.sum;
    for (let j = i - 1; j >= 0 && p.T - ser[j].T <= 10 * D; j--) if (ser[j].sum > p.sum) { ok = false; break; }
    for (let j = i + 1; ok && j < ser.length && ser[j].T - p.T <= 10 * D; j++) { if (ser[j].sum > p.sum) ok = false; if (ser[j].T - p.T <= 7 * D) low = Math.min(low, ser[j].sum); }
    if (ok && low <= 0.65 * p.sum) keep.push(p);
  }
  return keep;
}
function closeAt(trades, ser, T0, delayBars) {   // returns {dR, openR, n} for closing all at the bar delayBars after T0
  const T = T0 + delayBars * 14400, p = ser.find((x) => x.T === T);
  if (!p) return null;
  let dR = 0;
  for (const [idx, r] of p.list) dR += (r - 0.0005 / trades[idx].dist) - trades[idx].R;
  return { dR, openR: p.sum, n: p.n };
}
const f = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const out = ['# Close-all near the open-profit peak, every year since 2020', '',
  'For each bot: the biggest open-profit peaks (sum of open R >= 8, a true local top within +-10 days that then gave back 35%+ within 7 days, like your Nov 21). At each peak we close every open trade (a) at the exact peak (perfect hindsight), (b) 1 day later, (c) 3 days later. "Change" = R gained or lost versus letting those same trades run by the bot rules. Trades opened after the close are untouched, so later years only change through the closed trades themselves.', ''];
const yearTot = {};
for (const bot of ['tcore', 'bbcore', 'icore']) {
  const tr = load(bot), ser = openSeries(tr), peaks = findPeaks(ser, 8);
  const base = stats(tr.map((t) => ({ tExit: t.tExit, R: t.R })));
  out.push(`## ${cfg.bots[bot].label}: ${peaks.length} peaks, bot total today ${f(base.total)}R`, '', '| Peak date | Positions | Open R at peak | Change if closed at peak | +1 day | +3 days |', '|---|---|---|---|---|---|');
  const sums = [0, 0, 0], win = [0, 0, 0], perYear = {};
  for (const p of peaks) {
    const d = [0, 6, 18].map((b) => closeAt(tr, ser, p.T, b));
    const y = new Date(p.T * 1000).getUTCFullYear();
    perYear[y] = perYear[y] || [0, 0, 0];
    d.forEach((x, i) => { if (x) { sums[i] += x.dR; if (x.dR > 0) win[i]++; perYear[y][i] += x.dR; } });
    out.push(`| ${new Date(p.T * 1000).toISOString().slice(0, 10)} | ${p.n} | ${f(p.sum)} | ${d[0] ? f(d[0].dR) : '-'} | ${d[1] ? f(d[1].dR) : '-'} | ${d[2] ? f(d[2].dR) : '-'} |`);
  }
  out.push(`| **All ${peaks.length} peaks** | | | **${f(sums[0])}R** (better in ${win[0]}) | **${f(sums[1])}R** (better in ${win[1]}) | **${f(sums[2])}R** (better in ${win[2]}) |`, '');
  out.push('| Year | Peaks | Change at peak | +1 day | +3 days | Bot R that year (as is) |', '|---|---|---|---|---|---|');
  for (const y of Object.keys(base.yr).sort()) { const n = peaks.filter((p) => new Date(p.T * 1000).getUTCFullYear() == y).length; const a = perYear[y] || [0, 0, 0]; out.push(`| ${y} | ${n} | ${f(a[0])} | ${f(a[1])} | ${f(a[2])} | ${f(base.yr[y])} |`); }
  out.push('');
}
fs.writeFileSync(path.join(__dirname, 'peaks.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
