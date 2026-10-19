// One-sweep test of fixed reward:risk targets (1R, 2R, 2.5R), breakeven on/off,
// ORIGINAL entry rules, $10 risk, 15m, 5 coins, 2023-10-18 → 2026-10-18.
const E = require('./engine-v3'), fs = require('fs');
const COINS = {
  SOL: () => [...E.loadBars('sol15-oos.json'), ...E.loadBars('sol15.json')],
  ETH: () => E.loadBars('eth15-all.json'),
  BTC: () => E.loadBars('btc15-all.json'),
  DOGE: () => E.loadBars('doge15-all.json'),
  ZEC: () => E.loadBars('zec15-all.json'),
};
const FUND = { SOL: 'funding.json', ETH: 'funding-eth.json', BTC: 'funding-btc.json', DOGE: 'funding-doge.json', ZEC: 'funding-zec.json' };
const VARIANTS = [
  ['1:1', 1, true], ['1:2 + BE', 2, true], ['1:2 no BE', 2, false], ['1:2.5 + BE', 2.5, true], ['1:2.5 no BE', 2.5, false],
];
const YEARS = [['Y1', '2023-10-18', '2024-10-18'], ['Y2', '2024-10-18', '2025-10-18'], ['Y3', '2025-10-18', '2026-10-18']];

function stats(T) {
  const beX = T.filter((t) => t.reason === 'BE'), win = T.filter((t) => t.reason !== 'BE' && t.pnl > 0), loss = T.filter((t) => t.reason !== 'BE' && t.pnl <= 0);
  const gp = T.filter((t) => t.pnl > 0).reduce((a, t) => a + t.pnl, 0), gl = -T.filter((t) => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0);
  let eq = 10000, pk = eq, dd = 0, st = 0, ms = 0;
  for (const t of T) { eq += t.pnl; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); if (t.pnl <= 0) ms = Math.max(ms, ++st); else st = 0; }
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const R = T.map((t) => t.pnl / 10), mR = avg(R), sd = Math.sqrt(avg(R.map((r) => (r - mR) ** 2)));
  return { n: T.length, wins: win.length, losses: loss.length, beExits: beX.length, beMoved: T.filter((t) => t.beMoved).length,
    winRate: T.length ? win.length / T.length : 0, net: eq - 10000, pf: gl ? gp / gl : gp ? Infinity : 0, maxDD: dd, streak: ms,
    avgWin: avg(win.map((t) => t.pnl)), avgLoss: avg(loss.map((t) => t.pnl)), avgBE: avg(beX.map((t) => t.pnl)),
    expR: mR, tStat: T.length > 1 && sd ? mR / (sd / Math.sqrt(T.length)) : 0, fees: T.reduce((a, t) => a + t.fee, 0) };
}

const res = {};
const pooled = Object.fromEntries(VARIANTS.map(([v]) => [v, []]));
for (const [coin, load] of Object.entries(COINS)) {
  const bars = load(), funding = E.loadBars(FUND[coin]);
  res[coin] = {};
  for (const tpR of [1, 2, 2.5]) {
    const P = E.prepare(bars, 900, { fill: 'through', throughPct: 0.0002, stopSlip: 0.0005, makerFee: 0.0002, takerFee: 0.00055,
      funding, sizing: 'usd', riskUsd: 10, maxLeverage: 10, tpMode: 'R', tpR });
    for (const [name, r, be] of VARIANTS.filter((v) => v[1] === tpR)) {
      P.C.breakeven = be;
      const T = E.run(P, E.FILTERS.base).trades;
      const yrs = YEARS.map(([y, a, b]) => stats(T.filter((t) => t.fillTime >= Date.parse(a) / 1000 && t.fillTime < Date.parse(b) / 1000)));
      res[coin][name] = { total: stats(T), years: yrs.map((y) => ({ n: y.n, net: y.net, pf: y.pf })) };
      pooled[name].push(...T);
    }
  }
  console.log('done', coin);
}
const pool = Object.fromEntries(Object.entries(pooled).map(([k, T]) => [k, stats(T)]));
fs.writeFileSync(__dirname + '/results/sweep-rr-15m.json', JSON.stringify({ res, pool }, null, 1));

const f = (x, d = 0) => (x >= 0 ? '+' : '') + x.toFixed(d);
console.log('\nPER COIN (3 years) — net $, PF, trades, win%, BE exits, max DD $, profitable years');
for (const [coin, vs] of Object.entries(res)) {
  console.log(coin);
  for (const [v, r] of Object.entries(vs)) {
    const s = r.total;
    console.log('  ' + v.padEnd(12), `net=${f(s.net)}`.padEnd(10), `PF=${s.pf.toFixed(2)}`.padEnd(9), `n=${s.n}`.padEnd(7), `win=${(s.winRate * 100).toFixed(0)}%`.padEnd(9),
      `W/L/BE=${s.wins}/${s.losses}/${s.beExits}`.padEnd(17), `avgW/L=${s.avgWin.toFixed(1)}/${s.avgLoss.toFixed(1)}`.padEnd(18), `DD=${s.maxDD.toFixed(0)}`.padEnd(8),
      `yrs+=${r.years.filter((y) => y.net > 0).length}/3`, ` [${r.years.map((y) => f(y.net)).join(' | ')}]`);
  }
}
console.log('\nPOOLED, all 5 coins');
for (const [v, s] of Object.entries(pool))
  console.log('  ' + v.padEnd(12), `net=${f(s.net)}`.padEnd(10), `PF=${s.pf.toFixed(2)}`.padEnd(9), `n=${s.n}`.padEnd(8), `win=${(s.winRate * 100).toFixed(1)}%`.padEnd(11),
    `BE exits=${s.beExits}`.padEnd(14), `exp=${f(s.expR, 3)}R/trade`.padEnd(18), `t=${s.tStat.toFixed(2)}`.padEnd(8), `fees=$${s.fees.toFixed(0)}`,
    ` coin-years profitable: ${Object.values(res).reduce((a, c) => a + c[v].years.filter((y) => y.net > 0).length, 0)}/15`);
