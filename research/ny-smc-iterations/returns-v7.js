// returns-v7.js — v7 return per year, SOL and ETH separately. $10,000 start, 1% risk per trade, compounding.
const E = require('./ie.js');
const V7 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5, tpMode: 'R', tpR: 3, minDispATR: 1, minFvgATR: 0.2,
  chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5, maxStopATR: 4, maxFillBars: 8 };
const Ys = ['Y1', 'Y2', 'Y3'], lab = { Y1: 'Oct 2023 – Oct 2024', Y2: 'Oct 2024 – Oct 2025', Y3: 'Oct 2025 – Oct 2026' };
for (const [nm, extra] of [['as tested', {}], ['fees + slippage x2', { costMult: 2 }]]) {
  console.log(`\n## v7, ${nm}`);
  for (const sym of ['SOL', 'ETH']) {
    const r = E.runSym(sym, { ...V7, ...extra });
    for (const y of Ys) { const s = r.by[y];
      console.log(`${sym} ${lab[y]}: trades ${s.n}, win ${(s.win * 100).toFixed(0)}%, R ${s.sumR.toFixed(1)}, return ${(s.netPct * 100).toFixed(1)}% ($${s.net.toFixed(0)}), max DD ${(s.maxDD * 100).toFixed(1)}%`); }
    const a = r.by.all, yrs = 3;
    console.log(`${sym} 3 years compounded: ${(a.netPct * 100).toFixed(1)}% ($10,000 → $${(10000 + a.net).toFixed(0)}), CAGR ${((Math.pow(1 + a.netPct, 1 / yrs) - 1) * 100).toFixed(1)}%, max DD ${(a.maxDD * 100).toFixed(1)}%`);
  }
}
