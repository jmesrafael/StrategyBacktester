// dump-core-trades.js — writes the engine's trade ledger to audit/out/core-<COIN>-<scenario>.json so recon.py can compare it.
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, DEFAULTS, FREE } = require('../../../🔴BB-Core/lucidio-core.js');
const D = path.join(__dirname, '..', '..', '..', '🔴BB-Core', 'data'), OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const harsh = { entryFee: 0.0008, stopFee: 0.0008, timeFee: 0.0008, tpFee: 0.0008, slip: 0.0005, tpSlip: 0.0005, tpBuf: 0.0005 };
const SCEN = { free: FREE, base: DEFAULTS.cost, harsh };
for (const c of ['SOL', 'ZEC', 'MEXC_SOL', 'MEXC_ZEC']) {
  const B = rd(c + '.json').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  let F = fs.existsSync(path.join(D, 'funding', c + '.json')) ? rd('funding/' + c + '.json') : null;
  if (c.startsWith('MEXC_')) { const bin = rd('funding/' + c.slice(5) + '.json'); F = [...bin.filter((r) => r[0] < F[0][0]), ...F]; }
  for (const [s, cost] of Object.entries(SCEN)) {
    const r = backtest(B, { cost }, s === 'free' ? null : F);
    fs.writeFileSync(path.join(OUT, `core-${c}-${s}.json`), JSON.stringify(r.trades));
    console.log(c, s, r.trades.length, 'trades');
  }
}
