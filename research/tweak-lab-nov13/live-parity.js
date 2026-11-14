// live-parity.js — do the LIVE bot cores (as changed for rules v3) take the same trades as the research's improved rules?
// Runs each bot's own core backtest() on the research candles (Binance 4h, Jan 2020 -> Nov 11 2026) and compares it, trade by trade,
// with lab.js's improved rules: same entry candle, same side, same exit candle; R within a small tolerance (the cores use slightly different cost models).
//   node live-parity.js [BB-CORE|I-CORE|T-CORE]
'use strict';
const path = require('path');
const { load, tradesOf, LINEUP, START, END } = require('./lab.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const BOTS = {
  'BB-CORE': { core: path.join(ROOT, '🔴BB-Core', 'lucidio-core.js'), ch: { bb: { sigma: 1.8 }, maxBars: 42, cooldown: 3 }, extra: [], run: (core, B, F) => core.backtest(B, {}, F).trades },
  'I-CORE': { core: path.join(ROOT, '🔴I-Core', 'icore-core.js'), ch: { kInit: 1.75, beR: 4, beLock: 1 }, extra: ['ETH'], run: (core, B) => core.backtest(B, {}).trades },
  'T-CORE': { core: path.join(ROOT, '🔴StrategyBacktester', 'bb-trail', 'icore-core.js'), ch: { bb: { len: 30 }, staleBars: 48, staleR: 1 }, extra: ['BNB'], run: (core, B) => core.backtest(B, {}).trades },
};
let bad = 0;
for (const bot of process.argv[2] ? [process.argv[2]] : Object.keys(BOTS)) {
  const b = BOTS[bot], core = require(b.core);
  console.log(`\n=== ${bot}: live core ${path.basename(b.core)} vs the research's improved rules`);
  for (const c of [...LINEUP[bot], ...b.extra]) {
    const x = load(c), B = x.B, live = b.run(core, B, null).filter((t) => t.tExit > START && t.tExit <= END), lab = tradesOf(bot, c, b.ch);
    const key = (t0, d) => t0 + '|' + d, L = new Map(lab.map((t) => [key(t.t0, t.d), t])), V = new Map(live.map((t) => [key(t.t, t.dir), t]));
    let same = 0, exitDiff = 0, rDiff = 0, maxR = 0; const onlyLab = [], onlyLive = [];
    for (const [k, t] of L) { const v = V.get(k); if (!v) { onlyLab.push(t); continue; } same++; if (Math.abs(v.tExit - t.t1) > 14400) exitDiff++; const d = Math.abs(v.R - t.R); maxR = Math.max(maxR, d); if (d > 0.35) rDiff++; }
    for (const [k, t] of V) if (!L.has(k)) onlyLive.push(t);
    const sum = (a, f) => a.reduce((s, t) => s + f(t), 0), ok = onlyLab.length + onlyLive.length <= Math.max(2, lab.length * 0.01) && exitDiff <= Math.max(2, lab.length * 0.01);
    if (!ok) bad++;
    console.log(`  ${c.padEnd(5)} research ${String(lab.length).padStart(4)} trades ${sum(lab, (t) => t.R).toFixed(1).padStart(7)}R | live core ${String(live.length).padStart(4)} trades ${sum(live, (t) => t.R).toFixed(1).padStart(7)}R | same entry ${same}, exit differs ${exitDiff}, only research ${onlyLab.length}, only live ${onlyLive.length}, biggest R gap ${maxR.toFixed(2)} (${rDiff} over 0.35R)  ${ok ? 'OK' : 'CHECK'}`);
    for (const t of onlyLab.slice(0, 3)) console.log('        only research:', new Date(t.t0 * 1000).toISOString().slice(0, 16), t.d, t.R.toFixed(2));
    for (const t of onlyLive.slice(0, 3)) console.log('        only live    :', new Date(t.t * 1000).toISOString().slice(0, 16), t.dir, t.R.toFixed(2));
  }
}
console.log(bad ? `\n${bad} coin(s) need a look` : '\nall coins match');
process.exitCode = bad ? 1 : 0;
