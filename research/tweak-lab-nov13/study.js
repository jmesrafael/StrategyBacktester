// study.js — the final comparison: each bot TODAY vs its IMPROVED rules (picked by search.js + neighbour checks), then coins tested
// on top (take one out, put one in, best lineup). Binance spot 4h, Jan 2020 -> Nov 11 2026, real fees + slippage + funding.
//   node study.js            -> study.json
//   COSTX=2 node study.js    -> study-cost2.json (doubled fees and slippage)
'use strict';
const fs = require('fs'), path = require('path');
const { load, tradesOf, measure, LINEUP, MONTHS, KX } = require('./lab.js');
const IMPROVED = {
  'BB-CORE': { ch: { bb: { sigma: 1.8 }, maxBars: 42, cooldown: 3 }, steps: [['Bands 1.8 instead of 2.0', { bb: { sigma: 1.8 } }], ['+ time exit at 42 candles (7 days) instead of 48', { bb: { sigma: 1.8 }, maxBars: 42 }], ['+ wait 3 candles (12 hours) after a losing trade', { bb: { sigma: 1.8 }, maxBars: 42, cooldown: 3 }]] },
  'I-CORE': { ch: { kInit: 1.75, beR: 4, beLock: 1 }, steps: [['First stop 1.75 ATR instead of 2', { kInit: 1.75 }], ['+ after +4R, move the stop to +1R', { kInit: 1.75, beR: 4, beLock: 1 }]] },
  'T-CORE': { ch: { bb: { len: 30 }, staleBars: 48, staleR: 1 }, steps: [['Exit if under +1R after 48 candles (8 days)', { staleBars: 48, staleR: 1 }], ['+ Bollinger length 30 instead of 20', { bb: { len: 30 }, staleBars: 48, staleR: 1 }]] },
};
// neighbours of the improved rules: does the result survive nudging each number?
const NEIGH = {
  'BB-CORE': [1.75, 1.8, 1.85].flatMap((s) => [39, 42, 45].flatMap((h) => [2, 3, 4].map((c) => ({ bb: { sigma: s }, maxBars: h, cooldown: c })))),
  'I-CORE': [1.6, 1.75, 1.9].flatMap((k) => [[3, 1], [4, 1], [5, 1], [4, 0.5]].map(([b, l]) => ({ kInit: k, beR: b, beLock: l }))),
  'T-CORE': [25, 28, 30, 32].flatMap((l) => [36, 42, 48, 54, 60].map((s) => ({ bb: { len: l }, staleBars: s, staleR: 1 }))),
};
// other ideas, one change each, for the "what did not work" table
const IDEAS = {
  'BB-CORE': [['Fixed target 2R', { tpR: 2 }], ['Fixed target 4R', { tpR: 4 }], ['Fixed target 8R', { tpR: 8 }], ['Fixed target 12R', { tpR: 12 }], ['Take half off at 2R', { partR: 2, partFrac: 0.5 }], ['Breakeven after +1R', { beR: 1 }], ['Hold 24 candles (4 days)', { maxBars: 24 }], ['Hold 72 candles (12 days)', { maxBars: 72 }], ['Hold 96 candles (16 days)', { maxBars: 96 }], ['Stop follows the middle band', { midTrail: true }], ['Longs only', { dirs: 'L' }], ['Trade only with BTC trend', { gate: 'btc' }], ['ADX above 25 only', { gate: 'adx25' }], ['Volume above 1.5x only', { gate: 'vol15' }]],
  'I-CORE': [['Fixed target 4R', { tpR: 4 }], ['Fixed target 8R', { tpR: 8 }], ['Fixed target 15R', { tpR: 15 }], ['Take half off at 3R', { partR: 3, partFrac: 0.5 }], ['Breakeven after +1R', { beR: 1 }], ['Time exit 48 candles', { maxBars: 48 }], ['Time exit 96 candles', { maxBars: 96 }], ['Trail 5 ATR (tighter)', { kTrail: 5 }], ['Trail 8 ATR (wider)', { kTrail: 8 }], ['Trail 14 ATR (much wider)', { kTrail: 14 }], ['First stop 3 ATR (wider)', { kInit: 3 }], ['Longs only', { dirs: 'L' }], ['Trade only with BTC trend', { gate: 'btc' }], ['ADX above 25 only', { gate: 'adx25' }]],
  'T-CORE': [['Fixed target 8R', { tpR: 8 }], ['Fixed target 15R', { tpR: 15 }], ['Fixed target 25R', { tpR: 25 }], ['Take half off at 3R', { partR: 3, partFrac: 0.5 }], ['Breakeven after +1R', { beR: 1 }], ['Breakeven after +3R', { beR: 3 }], ['Time exit 96 candles', { maxBars: 96 }], ['Trail 10 ATR (tighter)', { kTrail: 10 }], ['Trail 20 ATR (wider)', { kTrail: 20 }], ['First stop 1.5 ATR (tighter)', { kInit: 1.5 }], ['First stop 3 ATR (wider)', { kInit: 3 }], ['Longs only', { dirs: 'L' }], ['Trade only with BTC trend', { gate: 'btc' }], ['ADX above 25 only', { gate: 'adx25' }]],
};
// coins that could be added: on Binance since 2021 or earlier, at least $5M a day on MEXC futures, plus the short-history coins already live on another bot
const CAND = ['BTC', 'ETH', 'BNB', 'XRP', 'DOGE', 'LINK', 'AVAX', 'DOT', 'UNI', 'AAVE', 'INJ', 'XLM', 'HBAR', 'DASH', 'ICP', 'QNT', 'SUI', 'ARB'];
const slim = (M) => ({ n: M.n, wr: M.wr, R: M.R, avg: M.avg, pf: M.pf, dd: M.dd, ls: M.ls, loseM: M.loseM, is: M.is, oos: M.oos, l12: M.l12, ex10: M.ex10, yrs: M.yrs, yrsUp: M.yrsUp, worstYr: M.worstYr, avgWin: M.avgWin, avgLoss: M.avgLoss, holdD: M.holdD });
const all4 = (m, b) => m.R > b.R && m.dd < b.dd && m.ls < b.ls && m.loseM < b.loseM;
const months = (tr) => { const m = Object.fromEntries(MONTHS.map((k) => [k, 0])); for (const t of tr) m[new Date(t.t1 * 1000).toISOString().slice(0, 7)] += t.R; return MONTHS.map((k) => +m[k].toFixed(2)); };
const sumR = (tr) => tr.reduce((s, t) => s + t.R, 0);
const out = { generated: '2026-11-13', costX: KX, window: ['2020-01-01', '2026-11-11'], months: MONTHS, cand: CAND, bots: {} };

for (const bot of Object.keys(LINEUP)) {
  const coins = LINEUP[bot], imp = IMPROVED[bot];
  const run = (ch, list = coins) => Object.fromEntries(list.map((c) => [c, tradesOf(bot, c, ch)]));
  const T0 = run({}), T1 = run(imp.ch), M0 = measure(Object.values(T0).flat()), M1 = measure(Object.values(T1).flat());
  const b = (out.bots[bot] = { coins, change: imp.ch, today: { ...slim(M0), months: months(Object.values(T0).flat()), byCoin: {} }, improved: { ...slim(M1), months: months(Object.values(T1).flat()), byCoin: {} } });
  for (const c of coins) { b.today.byCoin[c] = slim(measure(T0[c])); b.improved.byCoin[c] = slim(measure(T1[c])); }
  b.steps = imp.steps.map(([name, ch]) => ({ name, ...slim(measure(Object.values(run(ch)).flat())) }));
  b.neigh = NEIGH[bot].map((ch) => { const M = measure(Object.values(run(ch)).flat()); return { ch, R: M.R, dd: M.dd, ls: M.ls, loseM: M.loseM, all4: all4(M, M0) }; });
  b.ideas = IDEAS[bot].map(([name, ch]) => { const M = measure(Object.values(run(ch)).flat()); return { name, ...slim(M), all4: all4(M, M0) }; });

  // ---- coins, under today's rules and under the improved rules
  const pool = [...new Set([...coins, ...CAND])];
  b.coinTests = {};
  for (const [label, ch] of [['today', {}], ['improved', imp.ch]]) {
    const T = run(ch, pool), base = measure(coins.flatMap((c) => T[c]));
    const line = (list) => { const M = measure(list.flatMap((c) => T[c])); return { R: M.R, dd: M.dd, ls: M.ls, loseM: M.loseM, worstYr: M.worstYr, yrsUp: M.yrsUp, oos: M.oos, is: M.is, all4: all4(M, base) }; };
    const remove = coins.map((c) => ({ coin: c, ...line(coins.filter((k) => k !== c)) }));
    const add = CAND.filter((c) => !coins.includes(c)).map((c) => { const own = measure(T[c]), first = load(c).B[0].time; return { coin: c, ...line([...coins, c]), own: { R: own.R, n: own.n, wr: own.wr, pf: own.pf, dd: own.dd, yrsUp: own.yrsUp, yrsN: Object.keys(own.yrs).length, yrs: own.yrs, since: new Date(Math.max(first + 205 * 14400, Date.UTC(2020, 0, 1) / 1000) * 1000).toISOString().slice(0, 7) } }; });
    // best lineup: keep adding the coin that helps most, but only coins that (a) have at least 5 years of trades, (b) won at least 5 of 7 years alone,
    // and (c) leave the bot better in ALL four columns than before the add. Stop when nothing qualifies.
    let cur = [...coins], curM = line(cur); const path_ = [];
    for (;;) {
      const opts = add.filter((a) => !cur.includes(a.coin) && a.own.yrsN >= 6 && a.own.yrsUp >= a.own.yrsN - 2).map((a) => ({ coin: a.coin, m: line([...cur, a.coin]) }))
        .filter((o) => o.m.R > curM.R && o.m.dd < curM.dd && o.m.ls <= curM.ls && o.m.loseM <= curM.loseM + 1e-9);
      if (!opts.length) break;
      const score = (o) => (o.m.R / curM.R - 1) + (1 - o.m.dd / curM.dd) + (1 - o.m.ls / curM.ls) + (1 - o.m.loseM / curM.loseM);
      const best = opts.sort((x, y) => score(y) - score(x))[0]; cur.push(best.coin); curM = best.m; path_.push({ coin: best.coin, ...best.m });
    }
    b.coinTests[label] = { base: line(coins), remove, add, best: { coins: cur, added: path_, final: line(cur) } };
  }
}
fs.writeFileSync(path.join(__dirname, KX === 1 ? 'study.json' : `study-cost${KX}.json`), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));

const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), pc = (v) => (v * 100).toFixed(0) + '%', L = (m) => `${f(m.R).padStart(6)} drop ${m.dd.toFixed(1).padStart(5)} streak ${String(m.ls).padStart(2)} loseM ${pc(m.loseM)}`;
for (const [bot, b] of Object.entries(out.bots)) {
  console.log(`\n=== ${bot} (costs x${KX})\n  today    ${L(b.today)} win ${pc(b.today.wr)} | ${Object.entries(b.today.yrs).map(([y, v]) => y.slice(2) + ':' + f(v)).join(' ')}\n  improved ${L(b.improved)} win ${pc(b.improved.wr)} | ${Object.entries(b.improved.yrs).map(([y, v]) => y.slice(2) + ':' + f(v)).join(' ')}`);
  console.log(`  neighbours better in all 4: ${b.neigh.filter((n) => n.all4).length}/${b.neigh.length}; more profit ${b.neigh.filter((n) => n.R > b.today.R).length}, smaller drop ${b.neigh.filter((n) => n.dd < b.today.dd).length}, shorter streak ${b.neigh.filter((n) => n.ls < b.today.ls).length}, fewer losing months ${b.neigh.filter((n) => n.loseM < b.today.loseM).length}`);
  for (const k of ['today', 'improved']) { const t = b.coinTests[k]; console.log(`  -- coins under ${k} rules: base ${L(t.base)} worstYr ${f(t.base.worstYr)}`);
    for (const r of t.remove) console.log(`     without ${r.coin.padEnd(5)} ${L(r)} worstYr ${f(r.worstYr)}${r.all4 ? '  ALL4' : ''}`);
    for (const r of t.add) console.log(`     with    ${r.coin.padEnd(5)} ${L(r)} worstYr ${f(r.worstYr)}${r.all4 ? '  ALL4' : ''} | alone ${f(r.own.R)}R ${r.own.yrsUp}/${r.own.yrsN} yrs PF ${r.own.pf.toFixed(2)} since ${r.own.since}`);
    console.log(`     BEST LINEUP: ${t.best.coins.join(' ')} -> ${L(t.best.final)} (added ${t.best.added.map((a) => a.coin).join(', ') || 'none'})`); }
}
