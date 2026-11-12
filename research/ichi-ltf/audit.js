// No-future-sight audit: rebuild everything from data cut at random moments. Every entry flag and every trade that
// finished before the cut must be identical to the full-data run.
const { build, signals, backtest } = require('./strat.js');
const cfgs = [{ entry: 'E2', exit: 'T2', htf: 'ichi4' }, { entry: 'E5', exit: 'TM24', htf: 'd1' }, { entry: 'E4', exit: 'P14', htf: 'both' }];
let bad = 0, n = 0;
for (const coin of ['SOL', 'ETH', 'GALA']) {
  const full = build(coin);
  for (const c of cfgs) {
    const fs = signals(full, c.entry, c.htf), ft = backtest(coin, c, { data: full });
    for (let k = 0; k < 5; k++) {
      const cut = full.h1[2000].time + Math.floor(Math.random() * (full.h1[full.n - 50].time - full.h1[2000].time));
      const part = build(coin, { tEnd: cut }), ps = signals(part, c.entry, c.htf);
      for (let i = 0; i < part.n; i++) if (ps.L[i] !== fs.L[i] || ps.S[i] !== fs.S[i]) { bad++; console.log('FLAG MISMATCH', coin, JSON.stringify(c), new Date(part.h1[i].time * 1e3).toISOString()); break; }
      const pt = backtest(coin, c, { data: part }).filter(t => t.tExit < cut - 3600), rt = ft.filter(t => t.tExit < cut - 3600);
      const same = pt.length === rt.length && pt.every((t, i) => t.t === rt[i].t && Math.abs(t.R - rt[i].R) < 1e-9);
      n++; if (!same) { bad++; console.log('TRADE MISMATCH', coin, JSON.stringify(c), pt.length, rt.length); }
    }
  }
}
console.log(bad ? 'FAIL ' + bad : `PASS: ${n} random cut-offs on 3 coins x 3 configs; flags and finished trades identical`);
