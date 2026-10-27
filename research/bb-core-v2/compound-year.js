// compound-year.js — put START (USD) in on 1 Jan of YEAR. Either every new trade risks RISK% of the balance when it opens (compounding), or a FIXED USD amount.
//   node compound-year.js --year 2025 --start-php 30000 --fx 63 [--risk 2.5] [--venue mexc]
'use strict';
const { runMerged } = require('./merged.js'); const { DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const STRAT = opt('strat', 'two'), FX = +opt('fx', 63), START = +opt('start-php', 30000) / FX, Y = +opt('year', 2025), V = opt('venue', 'mexc'), RISK = +opt('risk', 2.5) / 100;
const FROM = opt('from', Y + '-01-01'), TO = opt('to', (Y + 1) + '-01-01'), t0 = Date.parse(FROM) / 1000, t1 = Date.parse(TO) / 1000, usd = (v) => (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const php = (v) => (v < 0 ? '−₱' : '₱') + Math.abs(Math.round(v * FX)).toLocaleString('en-US'), MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const money = (v) => `${usd(v)} (${php(v)})`;
const ALL = {}; const get = (s) => ALL[s] || (ALL[s] = COINS.flatMap((c) => { const D = loadCoin(c, V); return runMerged(D.B, s, DEFAULTS.cost, D.funding).trades.filter((t) => t.t >= t0 && t.tExit < t1).map((t) => ({ ...t, coin: c })); }));

// mode: {pct} = compounding % of balance at open; {fixed} = fixed USD risk per trade (balance can't fund a loss bigger than itself)
function sim(strat, mode, start = START) {
  const trades = get(strat), ev = []; trades.forEach((t, k) => ev.push({ time: t.t, kind: 1, k }, { time: t.tExit, kind: 0, k }));
  ev.sort((a, b) => a.time - b.time || a.kind - b.kind);
  let bal = start, open = 0, maxOpen = 0, peak = start, maxDD = 0, maxDDpct = 0, atRisk = 0, maxRiskPct = 0, low = start; const risked = {}, res = [];
  for (const e of ev) {
    if (e.kind === 1) { risked[e.k] = mode.pct ? bal * mode.pct : mode.fixed; open++; atRisk += risked[e.k]; maxOpen = Math.max(maxOpen, open); maxRiskPct = Math.max(maxRiskPct, atRisk / Math.max(bal, 1e-9)); }
    else { const pnl = trades[e.k].R * risked[e.k]; bal += pnl; open--; atRisk -= risked[e.k]; peak = Math.max(peak, bal); low = Math.min(low, bal); maxDD = Math.max(maxDD, peak - bal); maxDDpct = Math.max(maxDDpct, (peak - bal) / peak); res.push({ ...trades[e.k], pnl, bal }); }
  }
  return { bal, trades: res, maxOpen, maxDD, maxDDpct, maxRiskPct, peak, low };
}
const months = []; for (let d = new Date(t0 * 1000); d < new Date(t1 * 1000); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) months.push([d.getUTCFullYear(), d.getUTCMonth()]);
const show = (title, strat, mode) => {
  const r = sim(strat, mode), n = r.trades.length;
  console.log(`## ${title}\n`);
  console.log(`Final balance at the end date: **${money(r.bal)}** (${r.bal >= START ? '+' : ''}${((r.bal / START - 1) * 100).toFixed(0)}%, ${(r.bal / START).toFixed(2)}×) · trades ${n} · win ${(100 * r.trades.filter((t) => t.pnl > 0).length / n).toFixed(0)}% · lowest balance ${money(r.low)} · worst drop from a peak ${money(r.maxDD)} (${(r.maxDDpct * 100).toFixed(0)}%) · best peak ${money(r.peak)} · most open at once ${r.maxOpen}, most risk open ${(r.maxRiskPct * 100).toFixed(0)}% of balance\n`);
  console.log('| month | start | profit | % | end | trades | win% |'); console.log('|---|---|---|---|---|---|---|');
  let b0 = START;
  for (const [yy, m] of months) { const t = r.trades.filter((x) => new Date(x.tExit * 1000).getUTCMonth() === m && new Date(x.tExit * 1000).getUTCFullYear() === yy); if (!t.length) continue; const p = t.reduce((a, x) => a + x.pnl, 0), b1 = b0 + p;
    console.log(`| ${MN[m]} ${yy} | ${usd(b0)} | ${p >= 0 ? '+' : '−'}${usd(Math.abs(p)).replace('−', '')} | ${p >= 0 ? '+' : ''}${(100 * p / b0).toFixed(1)}% | ${usd(b1)} | ${t.length} | ${(100 * t.filter((x) => x.pnl > 0).length / t.length).toFixed(0)}% |`); b0 = b1; }
  console.log('\n| coin | trades | profit |'); console.log('|---|---|---|');
  for (const c of COINS) { const t = r.trades.filter((x) => x.coin === c); console.log(`| ${c} | ${t.length} | ${usd(t.reduce((a, x) => a + x.pnl, 0))} |`); }
  console.log(); return r;
};
console.log(`# ₱${(START * FX).toLocaleString('en-US')} (= ${usd(START)} at ₱${FX}/$) in on ${FROM} — merged strategy (bb-core + EMA 20/100), 5 coins, ${V.toUpperCase()} candles, trades closed by the last candle (21 Oct for 2026)\n`);
const A = show(`A. Compounding ${RISK * 100}% of the balance per trade`, STRAT, { pct: RISK });
const Bf = show('B. Fixed $5 risk per trade (no compounding)', STRAT, { fixed: 5 });
console.log('## Other settings, same money\n'); console.log('| option | final balance | return | lowest balance | worst drop |'); console.log('|---|---|---|---|---|');
for (const [l, s, m] of [['Merged, compounding 2.5%', STRAT, { pct: 0.025 }], ['Merged, fixed $5', STRAT, { fixed: 5 }], ['Merged, fixed $2.50', STRAT, { fixed: 2.5 }], ['Merged, compounding 1%', STRAT, { pct: 0.01 }], ['Merged, compounding 1.25%', STRAT, { pct: 0.0125 }], ['Merged, compounding 5%', STRAT, { pct: 0.05 }], ['bb-core alone, compounding 2.5%', 'bb', { pct: 0.025 }], ['bb-core alone, fixed $5', 'bb', { fixed: 5 }]]) {
  const q = sim(s, m); console.log(`| ${l} | ${money(q.bal)} | ${((q.bal / START - 1) * 100).toFixed(0)}% | ${money(q.low)} | ${money(q.maxDD)} (${(q.maxDDpct * 100).toFixed(0)}%) |`); }
console.log(`\n$5 on a ${usd(START)} account is ${(500 / START).toFixed(2)}% risk per trade at the start.`);
