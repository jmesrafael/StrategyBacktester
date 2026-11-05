// split250-php.js — start capital $250 split equally across bb-core / I-Core / MA Trend, in pesos (FX env, default 63 PHP per USD); 7 coins, 4h.
// Risk per trade = the live bot's tiers (2.5% under $500, 2% under $1,000, 1.5% above, thresholds converted to pesos) of each strategy's own balance,
// optionally capped at $50 in TOTAL per trade slot (each of n strategies capped at cap/n so splitting gets no extra dollar risk).
process.env.COINS = 'SOL,ZEC,NEAR,ADA,GALA,BTC,ETH';
const fs = require('fs'); const { cfgRun, COINS } = require('./rstrat.js');
const BB = require('../../../bb-core/lucidio-core.js'), IC = require('../../js/icore-core.js');
const bots = core => { const all = []; for (const c of COINS) { const B = JSON.parse(fs.readFileSync(`data4h/${c}.json`)).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })); all.push(...core.backtest(B).trades.map(t => ({ ...t, coin: c }))); } return all; };
const S = { 'bb-core': bots(BB), 'I-Core': bots(IC), 'MA Trend': cfgRun('SMA', 'P', [200], true, true, 2, 14, 'close', 'nextOpen').trades };
const FX = +(process.env.FX || 63), START = 250 * FX, CAP = 50 * FX;
const tier = e => e >= 1000 * FX ? .015 : e >= 500 * FX ? .02 : .025;
const P = x => '₱' + Math.round(x).toLocaleString('en-US'), N = x => Math.round(x).toLocaleString('en-US');
const Y20 = Date.UTC(2020, 0, 1) / 1000, Y23 = Date.UTC(2023, 0, 1) / 1000, Y26 = Date.UTC(2026, 0, 1) / 1000, END = Date.UTC(2027, 0, 1) / 1000;
function sim(names, from, capPeso) {
  const n = names.length, subs = names.map(k => ({ k, e: START / n, tr: S[k].filter(t => t.tExit >= from) }));
  const ev = []; subs.forEach((s, i) => s.tr.forEach(t => ev.push([t.tExit, i, t.R]))); ev.sort((a, b) => a[0] - b[0]);
  const y0 = new Date(from * 1000).getUTCFullYear(), marks = []; for (let m = 1; m <= 12; m++) marks.push(Date.UTC(y0, m, 1) / 1000);
  const bal = () => subs.reduce((s, x) => s + x.e, 0), months = [], ye = {}; let pk = START, dd = 0, mi = 0, trades = 0;
  for (const [tm, i, R] of ev) {
    while (mi < marks.length && tm >= marks[mi]) { months.push(bal()); mi++; }
    const e = subs[i].e; subs[i].e *= 1 + (capPeso ? Math.min(tier(e), capPeso / n / e) : tier(e)) * R; trades++;
    const t = bal(); pk = Math.max(pk, t); dd = Math.min(dd, t / pk - 1); ye[new Date(tm * 1000).getUTCFullYear()] = t;
  }
  while (mi < marks.length) { months.push(bal()); mi++; }
  return { end: bal(), dd, months, trades, ye };
}
const C = [['bb-core'], ['I-Core'], ['MA Trend'], ['bb-core', 'I-Core', 'MA Trend'], ['bb-core', 'MA Trend'], ['bb-core', 'I-Core'], ['I-Core', 'MA Trend']];
const lab = c => c.length === 3 ? '**Equal 3-way split**' : c.length === 2 ? c.join(' + ') + ' (half each)' : 'All in ' + c[0];
const L = s => console.log(s);
L(`Rate ₱${FX}/$ · start $250 = ${P(START)} · risk cap $50 = ${P(CAP)} per trade slot\n`);
L(`### A. Summary by period, capped at ${P(CAP)} total risk per trade\n| | 2020-2026 ends | x | worst drop | 2023-2026 ends | worst drop | 2026 only ends | worst drop |\n|---|---|---|---|---|---|---|---|`);
for (const c of C) { const a = sim(c, Y20, CAP), b = sim(c, Y23, CAP), d = sim(c, Y26, CAP); L(`| ${lab(c)} | ${P(a.end)} | ${(a.end / START).toFixed(0)} | ${(a.dd * 100).toFixed(0)}% | ${P(b.end)} | ${(b.dd * 100).toFixed(0)}% | ${P(d.end)} | ${(d.dd * 100).toFixed(0)}% |`); }
L(`\n### A2. Same, no cap (compounding only: unrealistic sizes)\n| | 2020-2026 ends | worst drop | 2023-2026 ends | worst drop | 2026 only ends | worst drop |\n|---|---|---|---|---|---|---|`);
for (const c of C) { const a = sim(c, Y20, 0), b = sim(c, Y23, 0), d = sim(c, Y26, 0); L(`| ${lab(c)} | ${P(a.end)} | ${(a.dd * 100).toFixed(0)}% | ${P(b.end)} | ${(b.dd * 100).toFixed(0)}% | ${P(d.end)} | ${(d.dd * 100).toFixed(0)}% |`); }
L(`\n### B. Year-end balance, one account from 1 Jan 2020 (capped), never rebalanced\n| | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 (Nov 5) |\n|---|---|---|---|---|---|---|---|`);
for (const c of C) { const y = sim(c, Y20, CAP).ye; L(`| ${lab(c)} | ${[2020, 2021, 2022, 2023, 2024, 2025, 2026].map(k => N(y[k])).join(' | ')} |`); }
for (const [cap, l] of [[CAP, 'capped at ' + P(CAP)], [0, 'no cap']]) {
  L(`\n### C. 2026 only: fresh ${P(START)} on 1 Jan 2026, ${l}: balance at the end of each month\n| | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov 5 | Gain | Worst drop | Trades |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const c of C) { const r = sim(c, Y26, cap); L(`| ${lab(c)} | ${r.months.slice(0, 11).map(N).join(' | ')} | ${((r.end / START - 1) * 100).toFixed(0)}% | ${(r.dd * 100).toFixed(0)}% | ${r.trades} |`); }
}
