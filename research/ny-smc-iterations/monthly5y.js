// monthly5y.js — v7 (frozen) month by month, Oct 2021–Oct 2026, SOL+ETH, scaled to $1 risk per trade. → results/monthly-5y-1usd.md
const fs = require('fs'), T = require('./trades-windows.js');
const RISK = 1, trades = [];
for (const s of ['SOL', 'ETH']) for (const t of T.build(s).trades) trades.push({ ...t, sym: s });
trades.sort((a, b) => a.t - b.t);
const start = Date.parse('2021-10-18') / 1000, end = Date.parse('2026-10-18') / 1000;
const tr = trades.filter((t) => t.t >= start && t.t < end);
const mk = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const mo = {}; for (const t of tr) { const k = mk(t.t); (mo[k] = mo[k] || { pnl: 0, n: 0, w: 0, sol: 0, eth: 0 }); const p = t.R * RISK; mo[k].pnl += p; mo[k].n++; if (p > 0.05) mo[k].w++; mo[k][t.sym.toLowerCase()] += p; }
const months = []; for (let d = new Date('2021-10-01Z'); d < new Date('2026-11-01Z'); d.setUTCMonth(d.getUTCMonth() + 1)) months.push(d.toISOString().slice(0, 7));
const f = (x) => (x < 0 ? '−$' : '+$') + Math.abs(x).toFixed(2);
let cum = 0, peak = 0, maxDD = 0, ddEnd = '', losingStreak = 0, worstStreak = 0, ws = 0, curStreak = 0;
const L = ['# v7 month by month — $1 risk per trade, SOL + ETH combined, Oct 2021 – Oct 2026', '',
  'Rules frozen (same as the 2023–26 backtest, no re-tuning). Fees/slippage included. Oct 2021 – Oct 2023 is the period v7 was NOT built on.', '',
  '| Month | Trades | Month P&L | Cumulative | SOL | ETH |', '|---|---|---|---|---|---|'];
let prevYear = '';
for (const m of months) {
  const r = mo[m] || { pnl: 0, n: 0, sol: 0, eth: 0 }; cum += r.pnl; peak = Math.max(peak, cum); if (peak - cum > maxDD) { maxDD = peak - cum; ddEnd = m; }
  if (r.pnl < 0) { curStreak++; worstStreak = Math.max(worstStreak, curStreak); } else curStreak = 0;
  L.push(`| ${m} | ${r.n} | ${f(r.pnl)} | ${f(cum)} | ${f(r.sol)} | ${f(r.eth)} |`);
}
// yearly
const yr = [['Oct21–Oct22', '2021-10-18', '2022-10-18'], ['Oct22–Oct23', '2022-10-18', '2023-10-18'], ['Oct23–Oct24', '2023-10-18', '2024-10-18'], ['Oct24–Oct25', '2024-10-18', '2025-10-18'], ['Oct25–Oct26', '2025-10-18', '2026-10-18']];
L.push('', '## By year', '', '| Year | Trades | P&L | SOL | ETH |', '|---|---|---|---|---|');
for (const [n, a, b] of yr) { const x = tr.filter((t) => t.t >= Date.parse(a) / 1000 && t.t < Date.parse(b) / 1000); const s = (k) => x.filter((t) => t.sym === k).reduce((p, t) => p + t.R * RISK, 0);
  L.push(`| ${n} | ${x.length} | ${f(x.reduce((p, t) => p + t.R * RISK, 0))} | ${f(s('SOL'))} | ${f(s('ETH'))} |`); }
// risk stats
let c = 0, pk = 0, dd = 0, run = 0, wl = 0; for (const t of tr) { c += t.R; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); if (t.R <= 0.05) { run++; wl = Math.max(wl, run); } else run = 0; }
const stopPct = tr.map((t) => t.stopPct).sort((a, b) => a - b), q = (p) => stopPct[Math.floor(p * (stopPct.length - 1))];
// concurrent positions
let maxConc = 0; for (const t of tr) { const c2 = tr.filter((u) => u.sym !== t.sym && u.t <= t.t && u.fillIdx !== undefined && u.t + (u.exitIdx - u.fillIdx) * 900 >= t.t).length + 1; maxConc = Math.max(maxConc, c2); }
const notional = tr.map((t) => RISK / t.stopPct).sort((a, b) => a - b);
const nq = (p) => notional[Math.floor(p * (notional.length - 1))];
L.push('', '## Budget numbers', '',
  `- Trades: ${tr.length} in 5 years (${(tr.length / 60).toFixed(1)}/month). Total ${f(cum)}.`,
  `- Max drawdown (peak to trough, trade by trade): **${f(-dd * RISK).replace('−', '−')}** = ${dd.toFixed(1)}R. Worst losing/flat run in a row: ${wl} trades. Worst run of losing months: ${worstStreak}.`,
  `- Stop distance: median ${(q(0.5) * 100).toFixed(2)}% of price (10th–90th pct ${(q(0.1) * 100).toFixed(2)}%–${(q(0.9) * 100).toFixed(2)}%).`,
  `- Position size (notional) for $1 risk: median $${nq(0.5).toFixed(0)}, 90th pct $${nq(0.9).toFixed(0)}, max $${nq(1).toFixed(0)}.`,
  `- Margin at 10x leverage: median $${(nq(0.5) / 10).toFixed(0)} per position, max $${(nq(1) / 10).toFixed(0)}; at most ${maxConc} positions open at once.`);
fs.writeFileSync('results/monthly-5y-1usd.md', L.join('\n') + '\n'); console.log(L.join('\n'));
