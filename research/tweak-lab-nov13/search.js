// search.js — for each bot: grid of rule combinations around the lab's finalists, keep only those that beat TODAY in EVERY column
// (more profit, smaller worst drop, shorter losing streak, fewer losing months) and are not worse in either half (2020-22, 2023-26).
//   node search.js  -> search.json + console
'use strict';
const fs = require('fs'), path = require('path');
const { tradesOf, measure, LINEUP } = require('./lab.js');
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d), pc = (v) => (v * 100).toFixed(0) + '%';
const cross = (dims) => dims.reduce((acc, [k, vals]) => acc.flatMap((a) => vals.map((v) => ({ ...a, [k]: v }))), [{}]);
// each dim value is a partial change object (or null = leave as today)
const GRID = {
  'BB-CORE': [['sig', [null, { bb: { sigma: 1.9 } }, { bb: { sigma: 1.8 } }]], ['tp', [null, { tpR: 10 }, { tpR: 12 }, { tpR: 15 }]], ['hold', [null, { maxBars: 42 }, { maxBars: 54 }, { maxBars: 60 }]],
    ['lock', [null, { beR: 3, beLock: 1 }, { beR: 4, beLock: 1 }]], ['cool', [null, { cooldown: 3 }, { cooldown: 6 }]], ['stale', [null, { staleBars: 24 }, { staleBars: 30 }]]],
  'I-CORE': [['trail', [null, { kTrail: 7.5 }, { kTrail: 8 }]], ['init', [null, { kInit: 1.75 }]], ['lock', [null, { beR: 2.5, beLock: 0.5 }, { beR: 3, beLock: 1 }, { beR: 4, beLock: 1 }]],
    ['stale', [null, { staleBars: 48 }, { staleBars: 48, staleR: 1 }, { staleBars: 72, staleR: 1 }]], ['gate', [null, { gate: 'far' }]], ['cool', [null, { cooldown: 3 }]]],
  'T-CORE': [['stale', [null, { staleBars: 36, staleR: 1 }, { staleBars: 48, staleR: 1 }, { staleBars: 60, staleR: 1 }, { staleBars: 48, staleR: 0.5 }]], ['len', [null, { bb: { len: 25 } }, { bb: { len: 30 } }]],
    ['trail', [null, { kTrail: 12 }, { kTrail: 17 }]], ['gate', [null, { gate: 'near' }, { gate: 'vol15' }]], ['lock', [null, { beR: 5, beLock: 2 }]]],
};
const out = {};
for (const bot of Object.keys(LINEUP)) {
  const coins = LINEUP[bot], base = measure(coins.flatMap((c) => tradesOf(bot, c))), baseC = Object.fromEntries(coins.map((c) => [c, tradesOf(bot, c).reduce((s, t) => s + t.R, 0)]));
  const rows = [];
  for (const combo of cross(GRID[bot])) {
    const parts = Object.values(combo).filter(Boolean); if (!parts.length) continue;
    const ch = Object.assign({}, ...parts), by = Object.fromEntries(coins.map((c) => [c, tradesOf(bot, c, ch)])), M = measure(Object.values(by).flat());
    const helped = coins.filter((c) => by[c].reduce((s, t) => s + t.R, 0) > baseC[c]).length;
    const all4 = M.R > base.R && M.dd < base.dd && M.ls < base.ls && M.loseM < base.loseM, halves = M.is >= base.is && M.oos >= base.oos;
    rows.push({ ch, nCh: parts.length, R: M.R, dd: M.dd, ls: M.ls, loseM: M.loseM, wr: M.wr, n: M.n, pf: M.pf, is: M.is, oos: M.oos, ex10: M.ex10, yrsUp: M.yrsUp, worstYr: M.worstYr, helped, all4, halves });
  }
  const win = rows.filter((r) => r.all4 && r.halves && r.yrsUp >= base.yrsUp && r.helped >= Math.ceil(coins.length / 2));
  // score: average relative improvement over the four columns; fewer changes preferred on ties
  for (const r of win) r.score = (r.R / base.R - 1) + (1 - r.dd / base.dd) + (1 - r.ls / base.ls) + (1 - r.loseM / base.loseM);
  win.sort((a, b) => b.score - a.score);
  out[bot] = { base: { R: base.R, dd: base.dd, ls: base.ls, loseM: base.loseM, is: base.is, oos: base.oos, ex10: base.ex10 }, tested: rows.length, all4: rows.filter((r) => r.all4).length, winners: win };
  console.log(`\n=== ${bot}: today ${f(base.R)}R, drop ${base.dd.toFixed(1)}, streak ${base.ls}, losing months ${pc(base.loseM)} | ${rows.length} combos, ${rows.filter((r) => r.all4).length} better in all 4 columns, ${win.length} also hold in both halves + most coins`);
  const byN = {}; for (const r of win) (byN[r.nCh] ||= []).push(r);
  for (const [n, list] of Object.entries(byN)) { console.log(`  -- ${n} change(s): ${list.length} winners`); for (const r of list.slice(0, 7)) console.log(`   ${JSON.stringify(r.ch).padEnd(92)} ${f(r.R).padStart(6)} drop ${r.dd.toFixed(1).padStart(5)} streak ${String(r.ls).padStart(2)} loseM ${pc(r.loseM)} win ${pc(r.wr)} | 20-22 ${f(r.is)} 23-26 ${f(r.oos)} ex10 ${f(r.ex10)} yrs ${r.yrsUp} worst ${f(r.worstYr)} helps ${r.helped} score ${r.score.toFixed(2)}`); }
}
fs.writeFileSync(path.join(__dirname, 'search.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
