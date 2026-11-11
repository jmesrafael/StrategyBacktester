// parity.js — proves the research engine = the live bots' own cores (the same files the VPS runs), trade for trade, at zero cost.
//   node parity.js [COIN ...]
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6'), SB = path.join(__dirname, '..', '..', '..');
const { run } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const CORES = { 'BB-CORE': [require(path.join(SB, '🔴BB-Core', 'lucidio-core.js')), 'BBX'], 'I-CORE': [require(path.join(SB, '🔴I-Core', 'icore-core.js')), 'P7'], 'T-CORE': [require(path.join(SB, '🔴StrategyBacktester', 'bb-trail', 'icore-core.js')), 'P14'] };
const ZERO = { fee: 0, slip: 0 }, coins = process.argv.slice(2).length ? process.argv.slice(2) : ['ZEC', 'ETH', 'BTC', 'DOGE', 'XRP', 'SOL'];
let bad = 0;
for (const coin of coins) {
  const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'data4h', coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const c = makeCtx(B, '4h'), bbc = S.find((s) => s.id === 'bb-core').build(c), built = { BBX: bbc, P7: S.find((s) => s.id === 'i-core').build(c), P14: { ...bbc, stopL: null, stopS: null } };
  for (const [bot, [core, p]] of Object.entries(CORES)) {
    const mine = run(B, c.atr14, built[p], exitOf(p, c), null, 14400, ZERO).trades;
    const real = (bot === 'BB-CORE' ? core.backtest(B, { cost: core.FREE }, null) : core.backtest(B, { cost: core.FREE })).trades;
    let mism = 0, maxR = 0; const n = Math.min(mine.length, real.length);
    for (let j = 0; j < n; j++) { const a = mine[j], b = real[j]; if (a.i0 !== b.i0 || a.i1 !== b.i1 || a.dir !== b.dir) mism++; else maxR = Math.max(maxR, Math.abs(a.R - b.R)); }
    const ok = mism === 0 && mine.length === real.length && maxR < 1e-6; if (!ok) bad++;
    const sm = mine.reduce((s, t) => s + t.R, 0), sr = real.reduce((s, t) => s + t.R, 0);
    console.log(`${coin.padEnd(5)} ${bot.padEnd(8)} engine ${String(mine.length).padStart(4)} trades ${sm.toFixed(1).padStart(7)}R | bot core ${String(real.length).padStart(4)} trades ${sr.toFixed(1).padStart(7)}R | mismatched ${mism}, max R diff ${maxR.toExponential(1)}  ${ok ? 'IDENTICAL' : 'DIFFERENT'}`);
  }
}
console.log(bad ? `${bad} bot/coin pairs differ` : 'all identical');
