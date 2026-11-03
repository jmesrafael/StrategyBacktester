// sim-check.mjs — the Simulator tab's math (AnalysisCore.simulate) against the research scripts in research/bb-core/no-target, on the BB-Core bot's data files.
//   node scripts/sim-check.mjs
// Expected (the bot's data files to late Oct 2026, 2.5% risk):
//   every trade = analyse() compounding exactly: BB 1:4 ₱93,009,286 · no target ₱178,026,250 (RESULTS.md section 9).
//   never = ₱10,000 + the flat-risk sums of section 13: BB 1:4 ₱133,305 · no target ₱160,202.
//   once a year: BB 1:4 ₱10,074,565 · no target ₱21,816,471. Section 15 says ₱10,134,554 / ₱21,953,045: its script booked by exit time and left out
//   a ZEC trade whose exit candle opened at 20:00 on 31 Dec 2024 (exit time = 1 Jan 00:00). Here, as everywhere on the page, a trade belongs
//   to the day its exit candle opens, so that loss is in the balance on 1 January 2025 and sizes 2025 a little smaller.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const BB = join(app, '..', 'bb-core');
globalThis.BBCore = require(join(BB, 'lucidio-core.js'));
const A = require(join(app, 'js', 'analysis-core.js'));
const load = (f) => JSON.parse(readFileSync(f)).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const trades = (s) => {
  const T = [];
  for (const c of A.COINS) { const ff = join(BB, 'data', 'funding', c + '.json'); T.push(...A.coinTrades(s, c, load(join(BB, 'data', c + '.json')), existsSync(ff) ? JSON.parse(readFileSync(ff)) : null, { targetR: 4 }, 14400).trades); }
  return T;
};
const fx = trades('bbfx'), nt = trades('bbnt');
const peso = (v) => '₱' + Math.round(v).toLocaleString('en-US');
const run = (label, o) => {
  for (const [n, T] of [['BB 1:4', fx], ['no target', nt]]) {
    const s = A.simulate(T, o), p = A.simPeriods(s, o);
    const sumM = p.months.reduce((a, m) => a + m.profit + m.dep, o.start);
    console.log(`${label.padEnd(34)} ${n.padEnd(9)} end ${peso(s.end).padStart(14)}  put in ${peso(s.put)}  drop ${(s.dd * 100).toFixed(1)}%  ${s.rows.length} trades  (months add up: ${Math.abs(sumM - s.end) < 0.01 ? 'yes' : 'NO ' + peso(sumM)})`);
  }
};
const base = { start: 10000, risk: 0.025, cap: 0, y0: 2020, y1: 2026, dep: 0, depEvery: 'none' };
run('₱10k, set once a year', { ...base, mode: 'year' });
run('₱10k + ₱5k each Jan, once a year', { ...base, mode: 'year', dep: 5000, depEvery: 'year' });
run('₱10k + ₱2k a month, once a year', { ...base, mode: 'year', dep: 2000, depEvery: 'month' });
run('₱30k + ₱2k a month, once a year', { ...base, start: 30000, mode: 'year', dep: 2000, depEvery: 'month' });
run('₱10k + ₱500 a week, once a year', { ...base, mode: 'year', dep: 500, depEvery: 'week' });
run('₱10k, every trade', { ...base, mode: 'trade' });
run('₱10k, once a month', { ...base, mode: 'month' });
run('₱10k, never (fixed)', { ...base, mode: 'fixed' });
// 'trade' must equal the page's existing compounding account
for (const [n, T] of [['BB 1:4', fx], ['no target', nt]]) {
  const c = A.analyse(T, { start: 10000, risk: 0.025, cap: 0, mode: 'compound' }).curve;
  console.log(`analyse() compounding ${n}: ${peso(c.pts.at(-1)[1])} (must match "every trade" above)`);
}
// the losing side: the deepest episode must be the account's deepest drop, every loss must sit in exactly one losing streak
for (const [n, T] of [['BB 1:4', fx], ['no target', nt]]) {
  const o = { ...base, mode: 'year', dep: 2000, depEvery: 'month' }, s = A.simulate(T, o), K = A.simRisk(s, A.simPeriods(s, o));
  const inStreaks = K.loss.reduce((a, x) => a + x.n, 0), L = K.longestLoss;
  console.log(`simRisk ${n}: deepest episode ${(K.deepest.depth * 100).toFixed(1)}% = account ${(s.dd * 100).toFixed(1)}% · losing trades ${K.lossTrades} = in streaks ${inStreaks} · longest losing streak ${L.n} (${(L.pct * 100).toFixed(1)}%) · longest win streak ${K.longestWin.n} · losing months ${K.lossMonths}/${K.months} · ${K.episodes.length} drawdowns`);
}
