// trail-parity.js — proves icore-core.js (BB-TRAIL) reproduces the research engine (StrategyBacktester/research/strat-hunt-nov6, strategy bb-trail, exit P14, 4h)
// trade for trade on the five coins, costs off. Needs the research folder next to this bot (on the PC); skipped elsewhere (the VPS bundle has no research code).
'use strict';
const fs = require('fs'), path = require('path');
const core = require('../icore-core.js');
// this folder lives in the StrategyBacktester repo (research/ is its sibling); the old location was next to it
const RES = [path.join(__dirname, '..', '..', 'research', 'strat-hunt-nov6'), path.join(__dirname, '..', '..', 'StrategyBacktester', 'research', 'strat-hunt-nov6')].find((p) => fs.existsSync(path.join(p, 'engine.js'))) || path.join(__dirname, '..', '..', 'research', 'strat-hunt-nov6');
if (!fs.existsSync(path.join(RES, 'engine.js'))) { console.log('trail-parity: research folder not found, skipped'); process.exit(0); }
const { load, COINS } = require(path.join(RES, 'data.js')), { run } = require(path.join(RES, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(RES, 'strategies.js'));
const strat = S.find((s) => s.id === 'bb-trail');
let total = 0, bad = 0, maxDiff = 0;
for (const coin of COINS) {
  const d = load(coin, '4h'), c = makeCtx(d.B, '4h'), st = strat.build(c);
  const ref = run(d.B, c.atr14, st, exitOf('P14', c), null, d.iv, { fee: 0, slip: 0 }).trades;
  const mine = core.backtest(d.B, { cost: core.FREE, maxBars: 0 }).trades;
  const n = Math.max(ref.length, mine.length); let coinBad = 0;
  for (let k = 0; k < n; k++) {
    const a = ref[k], b = mine[k];
    if (!a || !b || a.t !== b.t || a.dir !== b.dir || a.i1 !== b.i1 || Math.abs(a.R - b.R) > 1e-9) { coinBad++; if (coinBad <= 3) console.log(`  ${coin} #${k} research ${a ? `${a.t} ${a.dir} R${a.R.toFixed(4)} i1 ${a.i1}` : '-'} | bot core ${b ? `${b.t} ${b.dir} R${b.R.toFixed(4)} i1 ${b.i1}` : '-'}`); }
    else maxDiff = Math.max(maxDiff, Math.abs(a.R - b.R));
  }
  console.log(`${coin}: research ${ref.length} trades, bot core ${mine.length}, mismatches ${coinBad}`);
  total += n; bad += coinBad;
}
console.log(bad ? `FAIL: ${bad} of ${total} trades differ` : `OK: ${total} trades identical (max R difference ${maxDiff.toExponential(1)})`);
process.exit(bad ? 1 : 0);
