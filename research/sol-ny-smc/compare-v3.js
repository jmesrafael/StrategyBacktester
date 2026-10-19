// Original rules vs modified rules ($10 fixed risk, min 3:1, fee-adjusted breakeven)
// on SOLUSDT and ETHUSDT, 15m and 1m, 2023-10-18 → 2026-10-18, realistic execution.
// usage: node compare-v3.js <SOL|ETH> <15|1>
const E = require('./engine-v3'), fs = require('fs');
const [sym, tfArg] = process.argv.slice(2);
const tf = +tfArg;
const bars = sym === 'SOL'
  ? [...E.loadBars(tf === 15 ? 'sol15-oos.json' : 'sol1-oos.json'), ...E.loadBars(tf === 15 ? 'sol15.json' : 'sol1.json')]
  : E.loadBars(tf === 15 ? 'eth15-all.json' : 'eth1-all.json');
const funding = E.loadBars(sym === 'SOL' ? 'funding.json' : 'funding-eth.json');

const EXEC = { fill: 'through', throughPct: 0.0002, stopSlip: 0.0005, makerFee: 0.0002, takerFee: 0.00055, funding,
  sizing: 'usd', riskUsd: 10, startEquity: 10000, maxLeverage: 10 };
const RULES = [
  ['Original rules', {}],
  ['Modified (swing target ≥ 3R)', { minRR: 3, beFeeAdjusted: true }],
  ['Modified alt A: nearest swing ≥ 3R', { minRR: 3, beFeeAdjusted: true, tpMode: 'swingAtLeastMinRR' }],
  ['Modified alt B: fixed 3R target', { minRR: 3, beFeeAdjusted: true, tpMode: 'R3' }],
];
const YEARS = [['Oct23–Oct24', '2023-10-18', '2024-10-18'], ['Oct24–Oct25', '2024-10-18', '2025-10-18'], ['Oct25–Oct26', '2025-10-18', '2026-10-18']];

function stats(T) {
  const win = T.filter((t) => t.reason !== 'BE' && t.pnl > 0), loss = T.filter((t) => t.reason !== 'BE' && t.pnl <= 0);
  const beExit = T.filter((t) => t.reason === 'BE');
  const gp = T.filter((t) => t.pnl > 0).reduce((a, t) => a + t.pnl, 0), gl = -T.filter((t) => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0);
  let eq = 10000, peak = eq, dd = 0, ddPct = 0, st = 0, ms = 0;
  for (const t of T) { eq += t.pnl; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); ddPct = Math.max(ddPct, (peak - eq) / peak); if (t.pnl <= 0) ms = Math.max(ms, ++st); else st = 0; }
  const sl = T.filter((t) => t.reason === 'SL');
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    n: T.length, wins: win.length, losses: loss.length, beExits: beExit.length, beMoved: T.filter((t) => t.beMoved).length,
    winRate: T.length ? win.length / T.length : 0, net: eq - 10000, pf: gl ? gp / gl : gp ? Infinity : 0,
    maxDD: dd, maxDDPct: ddPct, avgWin: avg(win.map((t) => t.pnl)), avgLoss: avg(loss.map((t) => t.pnl)),
    avgBeExit: avg(beExit.map((t) => t.pnl)), maxLosingStreak: ms, fees: T.reduce((a, t) => a + t.fee, 0),
    funding: T.reduce((a, t) => a + t.funding, 0),
    avgStopLoss: avg(sl.map((t) => t.pnl)), worstLoss: T.length ? Math.min(...T.map((t) => t.pnl)) : 0,
    avgPlannedLoss: avg(T.map((t) => t.plannedLoss)), capped: T.filter((t) => t.capped).length,
    maxLev: T.length ? Math.max(...T.map((t) => t.notional / t.eqBefore)) : 0,
    medianNotional: T.length ? T.map((t) => t.notional).sort((a, b) => a - b)[Math.floor(T.length / 2)] : 0, avgRR: avg(T.map((t) => t.plannedRR)),
  };
}

const out = { sym, tf, bars: bars.length, from: new Date(bars[0][0] * 1000).toISOString(), rules: {} };
for (const [name, conf] of RULES) {
  const P = E.prepare(bars, tf * 60, { ...EXEC, ...conf });
  const r = E.run(P, E.FILTERS.base);
  const lowRR = P.rejected.filter((x) => /below/.test(x.why)).length;
  const total = stats(r.trades);
  const years = Object.fromEntries(YEARS.map(([k, a, b]) => [k, stats(r.trades.filter((t) => t.fillTime >= Date.parse(a) / 1000 && t.fillTime < Date.parse(b) / 1000))]));
  const ruin = r.ruinTime ? new Date(r.ruinTime * 1000).toISOString().slice(0, 10) : null;
  out.rules[name] = { total, years, skippedBelow3R: lowRR, setups: P.setups.length, accountDepleted: ruin };
  const s = total;
  console.log(`${sym} ${tf}m | ${name}`);
  console.log(`   3y: n=${s.n} W/L/BE=${s.wins}/${s.losses}/${s.beExits} win=${(s.winRate * 100).toFixed(1)}% net=$${s.net.toFixed(0)} PF=${s.pf.toFixed(2)} DD=$${s.maxDD.toFixed(0)} (${(s.maxDDPct * 100).toFixed(2)}%)` +
    ` avgWin=$${s.avgWin.toFixed(2)} avgLoss=$${s.avgLoss.toFixed(2)} avgBE=$${s.avgBeExit.toFixed(2)} reachedBE=${s.beMoved} streak=${s.maxLosingStreak} RR=${s.avgRR.toFixed(2)}`);
  console.log(`   sizing: planned loss avg $${s.avgPlannedLoss.toFixed(2)} | stop-outs avg $${s.avgStopLoss.toFixed(2)} | worst trade $${s.worstLoss.toFixed(2)} | capped ${s.capped} | max leverage ${s.maxLev.toFixed(1)}x | fees $${s.fees.toFixed(0)} funding $${s.funding.toFixed(0)} | skipped <3R: ${lowRR} | median position ${s.medianNotional.toFixed(0)}${ruin ? ' | ACCOUNT DEPLETED ' + ruin : ''}`);
  for (const [k, y] of Object.entries(years)) console.log(`   ${k}: n=${y.n} win=${(y.winRate * 100).toFixed(0)}% net=$${y.net.toFixed(0)} PF=${y.pf.toFixed(2)} BE=${y.beExits}`);
}
fs.writeFileSync(__dirname + `/results/v3-${sym}-${tf}m.json`, JSON.stringify(out, null, 1));
