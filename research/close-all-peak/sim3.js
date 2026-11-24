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

// ---- yearly % and 1,000 PHP compounded monthly: bot as is vs a human closing everything at (or after) each real peak
const PHP = 58;                        // pesos per USDT, fixed (rough average)
const TIERS = [[0, 0.025], [500, 0.02], [1000, 0.015]];
const W = { bbcore: 0.5, icore: 0.25, tcore: 0.25 };
const riskFor = (peakUsd) => { let r = TIERS[0][1]; for (const [b, p] of TIERS) if (peakUsd >= b) r = p; return r; };
const mkey = (T) => { const d = new Date(T * 1000); return d.getUTCFullYear() * 100 + d.getUTCMonth(); };

function scenario(tr, ser, peaks, delay) {         // list of {tExit, R} after the human closes
  if (delay == null) return tr.map((t) => ({ tExit: t.tExit, R: t.R }));
  const repl = new Map();
  for (const p of peaks) {
    const q = ser.find((x) => x.T === p.T + delay * 14400); if (!q) continue;
    for (const [idx, r] of q.list) if (!repl.has(idx)) repl.set(idx, { tExit: q.T, R: r - 0.0005 / tr[idx].dist });
  }
  return tr.map((t, i) => repl.get(i) || { tExit: t.tExit, R: t.R });
}
// realistic human, no hindsight: once open profit has been >= 8R, close everything when it falls g (e.g. 25%) from its high
function scenarioDrop(tr, ser, g) {
  const repl = new Map(); let hi = 0;
  for (const q of ser) {
    const live = q.list.filter(([idx]) => !repl.has(idx));
    const sum = live.reduce((a, [, r]) => a + r, 0);
    if (live.length === 0) { hi = 0; continue; }
    hi = Math.max(hi, sum);
    if (hi >= 8 && sum <= (1 - g) * hi && live.length >= 2) { for (const [idx, r] of live) repl.set(idx, { tExit: q.T, R: r - 0.0005 / tr[idx].dist }); hi = 0; }
  }
  return tr.map((t, i) => repl.get(i) || { tExit: t.tExit, R: t.R });
}
const bots = {};
for (const b of Object.keys(W)) { const tr = load(b), ser = openSeries(tr); bots[b] = { tr, ser, peaks: findPeaks(ser, 8) }; }
const SC = [['Bot as is (no human)', null], ['Human closes at the exact top (impossible best case)', 0], ['Human closes 1 day after the top', 6], ['Human closes 3 days after the top', 18], ['REAL human: close all when open profit falls 25% from its high', 'd25'], ['REAL human: close all when it falls 35% from its high', 'd35']];
const start = 2020 * 100 + 3, nowK = mkey(Date.now() / 1000);  // Apr 2020: first month all three bots have data
const res = SC.map(([name, delay]) => {
  const R = {}; for (const b in W) { R[b] = {}; for (const t of (typeof delay === 'string' ? scenarioDrop(bots[b].tr, bots[b].ser, +delay.slice(1) / 100) : scenario(bots[b].tr, bots[b].ser, bots[b].peaks, delay))) { const k = mkey(t.tExit); R[b][k] = (R[b][k] || 0) + t.R; } }
  let eq = 1000; const share = {}, peak = {}; for (const b in W) { share[b] = eq * W[b]; peak[b] = share[b] / PHP; }
  const yr = {}; let worst = 0, hi = eq;
  for (let k = start; k <= nowK; k = (k % 100 === 11) ? k + 89 : k + 1) {
    const y = Math.floor(k / 100); if (!yr[y]) yr[y] = { s: eq };
    for (const b in W) { const r = riskFor(peak[b]); share[b] *= Math.max(0.01, 1 + r * (R[b][k] || 0)); peak[b] = Math.max(peak[b], share[b] / PHP); }
    eq = Object.values(share).reduce((a, c) => a + c, 0);
    if ((k % 100) % 3 === 2) { for (const b in W) share[b] = eq * W[b]; }   // rebalance every 3 months (capital-split study)
    hi = Math.max(hi, eq); worst = Math.max(worst, 1 - eq / hi);
    yr[y].e = eq;
  }
  return { name, yr, eq, worst };
});
const years = Object.keys(res[0].yr);
const pct = (a, b) => ((b / a - 1) * 100);
const fp = (x) => (x >= 0 ? '+' : '') + (Math.abs(x) >= 10000 ? Math.round(x).toLocaleString('en-US') : x.toFixed(0)) + '%';
const peso = (x) => '₱' + (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : Math.round(x).toLocaleString('en-US'));
const out = ['# TRI-CORE (50/25/25) per year: bot as is vs a human closing everything near each top', '',
 `1,000 pesos from Apr 2020, compounded monthly, live risk steps (2.5% / 2% from $500 / 1.5% from $1,000), ₱${PHP} per USDT, rebalanced every 3 months.`, '',
 '| Year | ' + res.map((r) => r.name).join(' | ') + ' |', '|---|' + res.map(() => '---|').join('')];
for (const y of years) out.push(`| ${y}${y == 2020 ? ' (from Apr)' : y == 2026 ? ' (to Nov 24)' : ''} | ` + res.map((r) => fp(pct(r.yr[y].s, r.yr[y].e))).join(' | ') + ' |');
out.push('| **₱1,000 becomes** | ' + res.map((r) => '**' + peso(r.eq) + '**').join(' | ') + ' |');
out.push('| vs bot as is | ' + res.map((r) => r === res[0] ? '—' : ((r.eq / res[0].eq - 1) * 100 >= 0 ? '+' : '') + ((r.eq / res[0].eq - 1) * 100).toFixed(0) + '%').join(' | ') + ' |');
out.push('| Worst fall from a high | ' + res.map((r) => '−' + (r.worst * 100).toFixed(0) + '%').join(' | ') + ' |');
fs.writeFileSync(path.join(__dirname, 'yearly-pesos.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
