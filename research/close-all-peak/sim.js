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

function sim(trades, N) {
  if (N == null) return trades.map((t) => ({ tExit: t.tExit, R: t.R, early: false }));
  // time grid
  const times = new Set(); trades.forEach((t) => t.path.forEach(([T]) => times.add(T)));
  const grid = [...times].sort((a, b) => a - b);
  const byT = new Map(); // time -> list of {tr, r}
  trades.forEach((t, idx) => t.path.forEach(([T, r]) => { if (!byT.has(T)) byT.set(T, []); byT.get(T).push({ idx, r }); }));
  const dead = new Set(), out = [];
  let closes = 0;
  for (const T of grid) {
    const live = (byT.get(T) || []).filter((x) => !dead.has(x.idx) && trades[x.idx].tExit > T);
    const sum = live.reduce((s, x) => s + x.r, 0);
    if (live.length > 1 && sum >= N) {
      closes++;
      for (const x of live) { dead.add(x.idx); out.push({ tExit: T, R: x.r - 0.0005 / trades[x.idx].dist, early: true }); }
    }
  }
  trades.forEach((t, idx) => { if (!dead.has(idx)) out.push({ tExit: t.tExit, R: t.R, early: false }); });
  out.closes = closes;
  return out.sort((a, b) => a.tExit - b.tExit);
}

function stats(tr) {
  let eq = 0, pk = 0, dd = 0; const yr = {};
  for (const t of tr) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); const y = new Date(t.tExit * 1000).getUTCFullYear(); yr[y] = (yr[y] || 0) + t.R; }
  const top = [...tr].sort((a, b) => b.R - a.R).slice(0, 10).reduce((s, t) => s + t.R, 0);
  return { n: tr.length, total: eq, dd, noTop10: eq - top, yr, closes: tr.closes || 0 };
}
const f = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const out = ['# Close-all-when-open-profit-is-big (account level, 4h closes)', '', 'Rule: if total open R across the bot >= N at a 4h close, close every open trade there. N=none is the bot as it runs now.', ''];
for (const bot of ['tcore', 'bbcore', 'icore']) {
  const tr = load(bot);
  out.push(`## ${cfg.bots[bot].label} (${cfg.bots[bot].coins.join(' ')}), ${tr.length} trades`, '', '| Close-all trigger | Total R | vs now | Worst drop R | Total ÷ drop | Without best 10 | Times it fired | Years better than now (of 7) |', '|---|---|---|---|---|---|---|---|');
  const base = stats(sim(tr, null));
  for (const N of [null, 20, 15, 12, 10, 8, 6, 4]) {
    const s = N == null ? base : stats(sim(tr, N));
    const better = N == null ? '—' : Object.keys(base.yr).filter((y) => (s.yr[y] || 0) > base.yr[y]).length;
    out.push(`| ${N == null ? 'never (current)' : '≥ +' + N + 'R open'} | ${f(s.total)} | ${N == null ? '—' : f(s.total - base.total)} | ${s.dd.toFixed(1)} | ${(s.total / s.dd).toFixed(1)} | ${f(s.noTop10)} | ${s.closes || '—'} | ${better} |`);
  }
  out.push('');
}
fs.writeFileSync(path.join(__dirname, 'results.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
