// compound-2026.js — put START in on 1 Jan of YEAR, every NEW trade risks RISK% of the balance at the moment it opens, balance updates when a trade closes.
//   node compound-2026.js [--start 30000] [--risk 2.5] [--year 2026] [--venue mexc] [--strat two|bb|ema]
'use strict';
const { runMerged } = require('./merged.js'); const { DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const START = +opt('start', 30000), RISK = +opt('risk', 2.5) / 100, Y = +opt('year', 2026), V = opt('venue', 'mexc'), STRAT = opt('strat', 'two');
const t0 = Date.UTC(Y, 0, 1) / 1000, usd = (v) => (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US'), MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function sim(strat, risk, start = START) {
  const trades = [];
  for (const c of COINS) { const D = loadCoin(c, V); trades.push(...runMerged(D.B, strat, DEFAULTS.cost, D.funding).trades.filter((t) => t.t >= t0).map((t) => ({ ...t, coin: c }))); }
  const ev = []; trades.forEach((t, k) => { ev.push({ time: t.t, kind: 1, k }, { time: t.tExit, kind: 0, k }); });
  ev.sort((a, b) => a.time - b.time || a.kind - b.kind);                      // closes before opens at the same instant
  let bal = start, open = 0, maxOpen = 0, peak = start, maxDD = 0, maxDDpct = 0, atRisk = 0, maxRiskPct = 0; const risked = {}, curve = [[t0, start]], res = [];
  for (const e of ev) {
    if (e.kind === 1) { risked[e.k] = bal * risk; open++; atRisk += risked[e.k]; maxOpen = Math.max(maxOpen, open); maxRiskPct = Math.max(maxRiskPct, atRisk / bal); }
    else { const pnl = trades[e.k].R * risked[e.k]; bal += pnl; open--; atRisk -= risked[e.k]; peak = Math.max(peak, bal); maxDD = Math.max(maxDD, peak - bal); maxDDpct = Math.max(maxDDpct, (peak - bal) / peak); curve.push([e.time, bal]); res.push({ ...trades[e.k], pnl, bal }); }
  }
  return { bal, trades: res, curve, maxOpen, maxDD, maxDDpct, maxRiskPct, peak };
}
const r = sim(STRAT, RISK), n = r.trades.length, wins = r.trades.filter((t) => t.pnl > 0);
console.log(`# ${usd(START)} on 1 Jan ${Y}, ${(RISK * 100)}% risk per trade, compounding — ${STRAT === 'two' ? 'merged (bb-core + EMA 20/100)' : STRAT}, 5 coins, ${V.toUpperCase()} candles\n`);
console.log(`Balance on the last candle (21 Oct ${Y}): **${usd(r.bal)}**  (${r.bal >= START ? '+' : ''}${((r.bal / START - 1) * 100).toFixed(0)}%, ${(r.bal / START).toFixed(2)}×)  ·  trades closed: ${n}  ·  win rate ${(100 * wins.length / n).toFixed(0)}%  ·  most trades open at once: ${r.maxOpen}  ·  most risk open at once: ${(r.maxRiskPct * 100).toFixed(0)}% of balance\n`);
console.log(`Worst drop from a peak (closed trades): ${usd(r.maxDD)} (${(r.maxDDpct * 100).toFixed(0)}%)  ·  best peak: ${usd(r.peak)}\n`);
console.log('## Month by month\n'); console.log('| month | start | profit $ | % | end | trades closed | win% | biggest win $ | biggest loss $ |'); console.log('|---|---|---|---|---|---|---|---|---|');
let b0 = START;
for (let m = 0; m < 10; m++) { const t = r.trades.filter((x) => new Date(x.tExit * 1000).getUTCMonth() === m && new Date(x.tExit * 1000).getUTCFullYear() === Y); if (!t.length) continue;
  const p = t.reduce((a, x) => a + x.pnl, 0), b1 = b0 + p; console.log(`| ${MN[m]} | ${usd(b0)} | ${p >= 0 ? '+' : '−'}${usd(Math.abs(p)).replace('−', '')} | ${p >= 0 ? '+' : ''}${(100 * p / b0).toFixed(1)}% | ${usd(b1)} | ${t.length} | ${(100 * t.filter((x) => x.pnl > 0).length / t.length).toFixed(0)}% | ${usd(Math.max(...t.map((x) => x.pnl)))} | ${usd(Math.min(...t.map((x) => x.pnl)))} |`); b0 = b1; }
console.log('\n## Profit by coin\n'); console.log('| coin | trades | profit $ |'); console.log('|---|---|---|');
for (const c of COINS) { const t = r.trades.filter((x) => x.coin === c); console.log(`| ${c} | ${t.length} | ${usd(t.reduce((a, x) => a + x.pnl, 0))} |`); }
console.log('\n## Same money, other options\n'); console.log('| option | final balance | return | worst drop |'); console.log('|---|---|---|---|');
for (const [l, s, k] of [['Merged @ 2.5%', 'two', 0.025], ['bb-core alone @ 2.5%', 'bb', 0.025], ['EMA 20/100 alone @ 2.5%', 'ema', 0.025], ['Merged @ 1%', 'two', 0.01], ['Merged @ 1.25% (≈ bb-core risk)', 'two', 0.0125], ['Merged @ 5%', 'two', 0.05]]) { const q = sim(s, k); console.log(`| ${l} | ${usd(q.bal)} | ${((q.bal / START - 1) * 100).toFixed(0)}% | ${usd(q.maxDD)} (${(q.maxDDpct * 100).toFixed(0)}%) |`); }
