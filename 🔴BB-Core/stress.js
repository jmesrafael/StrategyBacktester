// stress.js — SOL + ZEC, every year of data, on Binance AND MEXC candles, under heavier fee / slippage assumptions.
//   node stress.js  -> prints and writes docs/results-stress.md
// Every scenario includes real funding and a target that must trade 0.05% THROUGH the level before it counts as filled.
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, stats, DEFAULTS } = require('./bb-breakout.js');
const DATA = path.join(__dirname, 'data'), RISK = 5;
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const candles = (c) => read(c + '.json').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
function funding(c) {
  const exists = (f) => fs.existsSync(path.join(DATA, 'funding', f + '.json'));
  const own = exists(c) ? read('funding/' + c + '.json') : null;
  if (!c.startsWith('MEXC_')) return own;
  const bin = exists(c.slice(5)) ? read('funding/' + c.slice(5) + '.json') : [];
  return [...bin.filter((r) => !own || !own.length || r[0] < own[0][0]), ...(own || [])];
}
const all = (fee, slip) => ({ entryFee: fee, stopFee: fee, timeFee: fee, tpFee: fee, slip, tpSlip: slip, tpBuf: 0.0005 });
const SCEN = [
  ['Base (0.05% taker, 0.02% maker target, 0.02% slip)', DEFAULTS.cost],
  ['0.08% fee every fill, 0.02% slip', all(0.0008, 0.0002)],
  ['**0.08% fee every fill, 0.05% slip**', all(0.0008, 0.0005)],
  ['0.08% fee, 0.10% slip', all(0.0008, 0.001)],
  ['0.10% fee, 0.15% slip (very harsh)', all(0.001, 0.0015)],
];
const SETS = [['Binance candles', ['SOL', 'ZEC']], ['MEXC candles', ['MEXC_SOL', 'MEXC_ZEC']]];
const usd = (v) => (Math.abs(v) < 0.5 ? '$0' : (v < 0 ? '−$' : '+$') + Math.abs(v).toFixed(0));
const r2 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2);
const out = [];
const P = (s = '') => { out.push(s); console.log(s); };

P('# BB Breakout — SOL + ZEC fee / slippage stress test, all years');
P();
P(`Generated ${new Date().toISOString().slice(0, 10)} by \`stress.js\`. $${RISK} risk per trade, frozen rules (BB 20/2, SMA200, 1:4, 48-candle exit), real funding included,`);
P('target must trade 0.05% through. "Fee every fill" = the fee is charged on entry AND exit, including target exits (no maker discount). Slippage on every fill.');
P('Trades are counted in the year they close. 2020 is a partial year (SOL from Sep, ZEC from Feb/Jun); 2026 runs to 21 Oct.');
for (const [setName, coins] of SETS) {
  P(); P(`## ${setName}`);
  const data = Object.fromEntries(coins.map((c) => [c, { B: candles(c), F: funding(c) }]));
  const years = new Set();
  const rows = SCEN.map(([name, cost]) => {
    const per = coins.map((c) => backtest(data[c].B, { cost }, data[c].F).trades);
    const both = per.flat().sort((a, b) => a.tExit - b.tExit), s = stats(both, RISK);
    Object.keys(s.years).forEach((y) => years.add(y));
    return { name, s, per: per.map((t) => stats(t, RISK)) };
  });
  const Y = [...years].sort();
  P(); P('### SOL + ZEC together');
  P(); P(`| Scenario | ${Y.join(' | ')} | Total | Avg/trade | Max DD | Years + |`);
  P(`|---|${Y.map(() => '---').join('|')}|---|---|---|---|`);
  for (const r of rows) {
    const yv = Y.map((y) => (r.s.years[y] ? r.s.years[y].net : 0));
    P(`| ${r.name} | ${yv.map(usd).join(' | ')} | **${usd(r.s.net)}** | ${r2(r.s.avgR)}R | ${usd(-r.s.maxDD)} | ${yv.filter((v) => v > 0.5).length}/${Y.length} |`);
  }
  coins.forEach((c, k) => {
    P(); P(`### ${c.replace('MEXC_', '')} alone`);
    P(); P(`| Scenario | ${Y.join(' | ')} | Total | Trades | Win | PF | Max DD | Years + |`);
    P(`|---|${Y.map(() => '---').join('|')}|---|---|---|---|---|---|`);
    for (const r of rows) {
      const s = r.per[k], yv = Y.filter((y) => s.years[y]).map((y) => s.years[y].net);
      P(`| ${r.name} | ${Y.map((y) => (s.years[y] ? usd(s.years[y].net) : '—')).join(' | ')} | **${usd(s.net)}** | ${s.n} | ${(s.winRate * 100).toFixed(0)}% | ${s.pf.toFixed(2)} | ${usd(-s.maxDD)} | ${yv.filter((v) => v > 0.5).length}/${yv.length} |`);
    }
  });
}
fs.writeFileSync(path.join(__dirname, 'docs', 'results-stress.md'), out.join('\n') + '\n');
