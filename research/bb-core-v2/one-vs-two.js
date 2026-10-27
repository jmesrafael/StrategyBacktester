// one-vs-two.js — can the EMA strategy share the account with bb-core (ONE position per coin, first trigger wins) or does it need its own sub-account (TWO slots)?
//   bb       bb-core alone                                  (one position per coin)
//   one      single account: whichever trigger fires first takes the coin; the other trigger is ignored while that trade is open; bb-core wins a tie
//   two      sub-account: both run at the same time, each its own position, 1R each (up to 2R per coin)
//   twoHalf  sub-account, ½R each (up to 1R per coin, the same maximum as bb-core alone)
//   node one-vs-two.js [binance|mexc]
'use strict';
const { runMerged } = require('./merged.js'); const { summarize, DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const V = process.argv[2] || 'binance', f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1), f2 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2), B = (v) => (v < 0 ? `**${f1(v)}**` : f1(v));
const MODES = [['bb', 'bb-core alone'], ['one', 'ONE account, one position per coin (first trigger wins)'], ['two', 'SUB-ACCOUNT, both run (1R each, up to 2R per coin)'], ['twoHalf', 'SUB-ACCOUNT, ½R each (up to 1R per coin)']];
const T = Object.fromEntries(MODES.map(([m]) => [m, COINS.flatMap((c) => { const D = loadCoin(c, V); return runMerged(D.B, m, DEFAULTS.cost, D.funding).trades.map((t) => ({ ...t, coin: c })); })]));
const par = { bb: T.bb.length, ema: COINS.flatMap((c) => { const D = loadCoin(c, V); return runMerged(D.B, 'ema', DEFAULTS.cost, D.funding).trades; }).length };
const S = Object.fromEntries(MODES.map(([m]) => [m, summarize(T[m])])), YRS = Object.keys(S.two.years).sort();
console.log(`# EMA 20/100 + bb-core: one account vs sub-account — ${V.toUpperCase()}, 5 coins pooled, fees + slippage + funding\n`);
console.log('## Per year (R)\n\n| setup | ' + YRS.join(' | ') + ' | total R | trades | win% | E | max DD | R÷DD | yrs+ |\n|---|' + YRS.map(() => '---').join('|') + '|---|---|---|---|---|---|---|');
for (const [m, l] of MODES) { const s = S[m], yv = YRS.map((y) => s.years[y] ?? 0); console.log(`| ${l} | ${yv.map(B).join(' | ')} | **${f1(s.R)}** | ${s.n} | ${(s.win * 100).toFixed(0)}% | ${f2(s.avgR)} | ${s.dd.toFixed(1)} | ${(s.R / s.dd).toFixed(1)} | ${yv.filter((v) => v > 0).length}/${yv.length} |`); }
console.log('\n## What the single account gives up\n');
const one = T.one, ob = one.filter((t) => t.trig === 'bb'), oe = one.filter((t) => t.trig === 'ema'), sum = (a) => a.reduce((x, t) => x + t.R, 0);
console.log(`| | taken in ONE account | taken when running alone | share kept |\n|---|---|---|---|\n| bb-core trades | ${ob.length} | ${par.bb} | ${(100 * ob.length / par.bb).toFixed(0)}% |\n| EMA trades | ${oe.length} | ${par.ema} | ${(100 * oe.length / par.ema).toFixed(0)}% |`);
console.log(`\nR earned by each side inside the ONE account: bb-core ${f1(sum(ob))}R over ${ob.length} trades (${f2(sum(ob) / ob.length)}R each), EMA ${f1(sum(oe))}R over ${oe.length} trades (${f2(sum(oe) / oe.length)}R each).`);
console.log(`Inside the SUB-ACCOUNT setup the same strategies earn bb-core ${f1(sum(T.two.filter((t) => t.trig === 'bb')))}R and EMA ${f1(sum(T.two.filter((t) => t.trig === 'ema')))}R.`);
// how long are positions open: share of candles a coin is occupied
const bars = (t) => t.reduce((a, x) => a + x.bars, 0), cand = COINS.reduce((a, c) => a + loadCoin(c, V).B.length - 202, 0);
console.log(`\nShare of the time a coin has an open position: bb-core alone ${(100 * bars(T.bb) / cand).toFixed(0)}%, ONE account ${(100 * bars(T.one) / cand).toFixed(0)}%, sub-account (counting both) ${(100 * bars(T.two) / cand).toFixed(0)}%.`);
console.log('\n## Per coin, total R\n\n| coin | bb-core alone | ONE account | SUB-ACCOUNT 1R each | SUB-ACCOUNT ½R each |\n|---|---|---|---|---|');
for (const c of COINS) console.log(`| ${c} | ${MODES.map(([m]) => f1(sum(T[m].filter((t) => t.coin === c)))).join(' | ')} |`);
