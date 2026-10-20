// tf-sweep.js — the frozen BB Breakout rules (BB 20/2, SMA200 trend, stop at the middle band, 3R, exit after 48 candles) on every
// timeframe from 5m to 1D, SOL / DOGE / ZEC, Binance candles 2020 → Oct 2026. Two cost cases: standard (0.04% commission + 0.02%
// slippage per side) and MEXC zero-fee (slippage only). Also a "same holding time" variant: exit after 8 days whatever the timeframe.
// usage: node tf-sweep.js -> results-tf-sweep.md
const L = require('./lib.js'), F = require('./fam.js'), fs = require('fs');
const COINS = ['SOL', 'DOGE', 'ZEC'], YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
const TFS = [[5, '5m'], [15, '15m'], [30, '30m'], [60, '1h'], [120, '2h'], [240, '4h'], [360, '6h'], [720, '12h'], [1440, '1D']];
const BASE = { n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 3, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const run = (sym, tf, cfg, comm, slip) => { L.COST.comm = comm; L.COST.slip = slip; try { return F.sq(sym, { ...BASE, tf, ...cfg }); } finally { L.COST.comm = 0.0004; L.COST.slip = 0.0002; } };
const out = []; const P = (s = '') => { out.push(s); console.log(s); };
const f2 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2), f0 = (v) => (v >= 0 ? '+$' : '−$') + Math.abs(v).toFixed(0);
const yrPos = (tr) => YEARS.filter((y) => L.sum(L.slice(tr, L.ts(y), L.ts(y + 1)).map((t) => t.R)) > 0).length;
const t0 = L.ts(2021); // every coin/timeframe has data and warm-up by then
P('# BB Breakout on every timeframe — SOL / DOGE / ZEC\n');
P('Same frozen rules on each timeframe, Binance candles, trades entered 2021-01 → 2026-10-20. R = amount risked; $ = at $1 risk per trade. Funding not included here (it was ~4% of profit on 4h). Max DD = deepest fall of the running closed-trade total.\n');
const summary = [];
for (const [label, comm, slip] of [['Standard costs (0.04% fee + 0.02% slippage per side)', 0.0004, 0.0002], ['MEXC zero-fee (0.02% slippage only)', 0, 0.0002]]) {
  P(`## ${label} — all three coins pooled\n`);
  P('| Timeframe | Trades | Trades / yr | Total R ($1 risk) | Avg R / trade | Win % | PF | Max DD (R) | Years positive (2021–26) | SOL | DOGE | ZEC |');
  P('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [tf, tn] of TFS) {
    const per = {}; let all = [];
    for (const c of COINS) { try { per[c] = L.slice(run(c, tf, {}, comm, slip), t0, L.ts(2100)); } catch (e) { per[c] = null; } if (per[c]) all = all.concat(per[c]); }
    const s = L.stats(all.sort((a, b) => a.t - b.t));
    const row = `| ${tn} | ${s.n} | ${(s.n / 5.8).toFixed(0)} | **${f2(s.sum)}** | ${f2(s.avg)} | ${(s.win * 100).toFixed(0)}% | ${s.pf.toFixed(2)} | ${s.dd.toFixed(1)} | ${yrPos(all)} of 6 | ` +
      COINS.map((c) => per[c] ? `${f2(L.sum(per[c].map((t) => t.R)))} (${yrPos(per[c])}/6)` : 'no data').join(' | ') + ' |';
    P(row);
    summary.push({ label, tn, s, yp: yrPos(all) });
  }
  P();
}
P('## Same holding time on every timeframe (exit after 8 days instead of 48 candles), standard costs, pooled\n');
P('| Timeframe | Exit after | Trades | Total R | Avg R / trade | Max DD (R) | Years positive |'); P('|---|---|---|---|---|---|---|');
for (const [tf, tn] of TFS) {
  const bars = Math.round(8 * 1440 / tf); let all = [];
  for (const c of COINS) all = all.concat(L.slice(run(c, tf, { maxBars: bars }, 0.0004, 0.0002), t0, L.ts(2100)));
  const s = L.stats(all.sort((a, b) => a.t - b.t));
  P(`| ${tn} | ${bars} candles | ${s.n} | ${f2(s.sum)} | ${f2(s.avg)} | ${s.dd.toFixed(1)} | ${yrPos(all)} of 6 |`);
}
P('\n## Year by year, standard costs, pooled (R; $ at $1 risk)\n');
P('| Timeframe | ' + YEARS.join(' | ') + ' |'); P('|---|' + YEARS.map(() => '---').join('|') + '|');
for (const [tf, tn] of TFS) {
  let all = []; for (const c of COINS) all = all.concat(run(c, tf, {}, 0.0004, 0.0002));
  P(`| ${tn} | ${YEARS.map((y) => f2(L.sum(L.slice(all, L.ts(y), L.ts(y + 1)).map((t) => t.R)))).join(' | ')} |`);
}
fs.writeFileSync(__dirname + '/results-tf-sweep.md', out.join('\n') + '\n');
