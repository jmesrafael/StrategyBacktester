// live-before-after.js — the LIVE bot cores themselves, old rules (LEGACY) vs rules v3, on the research candles (Binance 4h, Jan 2020 -> Nov 11 2026).
// This is what the deployed code does, measured with the same columns as the study (profit, worst drop, losing streak, losing months).
//   node live-before-after.js
'use strict';
const path = require('path');
const { load, measure, LINEUP, START, END } = require('./lab.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const BOTS = {
  'BB-CORE': { core: require(path.join(ROOT, '🔴BB-Core', 'lucidio-core.js')), add: [], run: (core, B, cfg) => core.backtest(B, cfg, null).trades },
  'I-CORE': { core: require(path.join(ROOT, '🔴I-Core', 'icore-core.js')), add: ['ETH'], run: (core, B, cfg) => core.backtest(B, cfg).trades },
  'T-CORE': { core: require(path.join(ROOT, '🔴StrategyBacktester', 'bb-trail', 'icore-core.js')), add: ['BNB'], run: (core, B, cfg) => core.backtest(B, cfg).trades },
};
const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), pc = (v) => (v * 100).toFixed(0) + '%';
const L = (m) => `${f(m.R).padStart(6)}R  drop ${m.dd.toFixed(1).padStart(5)}R  streak ${String(m.ls).padStart(2)}  losing months ${pc(m.loseM)}  win ${pc(m.wr)}  yrs ${m.yrsUp}/7 worst ${f(m.worstYr)}`;
const out = {};
for (const [bot, b] of Object.entries(BOTS)) {
  const tr = (coins, cfg) => coins.flatMap((c) => b.run(b.core, load(c).B, cfg).filter((t) => t.tExit > START && t.tExit <= END).map((t) => ({ c, d: t.dir, t0: t.t, t1: t.tExit, R: t.R, bars: t.bars })));
  const old = measure(tr(LINEUP[bot], b.core.LEGACY)), v3 = measure(tr(LINEUP[bot], {})), plus = b.add.length ? measure(tr([...LINEUP[bot], ...b.add], {})) : null;
  out[bot] = { old, v3, plus };
  console.log(`\n=== ${bot} (live core)\n  old rules  ${L(old)}\n  rules v3   ${L(v3)}${plus ? `\n  v3 + ${b.add.join('+').padEnd(5)} ${L(plus)}` : ''}`);
  const cols = [['R', 1], ['dd', -1], ['ls', -1], ['loseM', -1]].map(([k, s]) => (s * (v3[k] - old[k]) > 0 ? '✓' : s * (v3[k] - old[k]) < 0 ? '✗' : '='));
  console.log(`  v3 vs old: profit ${cols[0]} drop ${cols[1]} streak ${cols[2]} losing months ${cols[3]}`);
}
require('fs').writeFileSync(path.join(__dirname, 'live-before-after.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
