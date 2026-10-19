// Look-ahead audit for the modified rules: truncating the data must not change any finished trade.
const E = require('./engine-v3');
const [sym, tfArg, cutsArg] = process.argv.slice(2);
const tf = +tfArg, cuts = +(cutsArg || 15);
const raw = sym === 'SOL'
  ? [...E.loadBars(tf === 15 ? 'sol15-oos.json' : 'sol1-oos.json'), ...E.loadBars(tf === 15 ? 'sol15.json' : 'sol1.json')]
  : E.loadBars(tf === 15 ? 'eth15-all.json' : 'eth1-all.json');
const funding = E.loadBars(sym === 'SOL' ? 'funding.json' : 'funding-eth.json');
const EXEC = { fill: 'through', stopSlip: 0.0005, funding, sizing: 'usd', riskUsd: 10, minRR: 3, beFeeAdjusted: true };
let checked = 0, bad = 0;
for (const tp of ['swing', 'swingAtLeastMinRR', 'R3']) {
  const full = E.run(E.prepare(raw, tf * 60, { ...EXEC, tpMode: tp }), E.FILTERS.base).trades;
  for (let c = 1; c <= cuts; c++) {
    const n = Math.floor(raw.length * c / (cuts + 1)), last = raw[n - 1][0];
    const got = E.run(E.prepare(raw.slice(0, n), tf * 60, { ...EXEC, tpMode: tp }), E.FILTERS.base).trades.filter((t) => t.reason !== 'END');
    const want = full.filter((t) => t.exitTime < last);
    if (got.length !== want.length) { bad++; console.log('COUNT', tp, n, got.length, want.length); continue; }
    got.forEach((t, i) => { checked++; const w = want[i];
      if (t.fillTime !== w.fillTime || t.exitTime !== w.exitTime || t.exitPx !== w.exitPx || Math.abs(t.pnl - w.pnl) > 1e-9) { bad++; console.log('TRADE', tp, n); } });
  }
}
console.log(`${sym} ${tf}m modified rules: ${checked} finished trades compared across ${cuts} cuts x 3 target modes, ${bad} mismatches`);
