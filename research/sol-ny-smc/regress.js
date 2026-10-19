const E = require('./engine');
const v1 = { '15': require('./results/result-15m.json'), '1': require('./results/result-1m.json') };
const keys = { base: 'A.', fib: 'B.', location: 'C.', full: 'D.', sd: 'E.', pd: 'F.', tl: 'G.', locTl: 'H.' };
for (const tf of ['15', '1']) {
  const P = E.prepare(E.loadBars(tf === '15' ? 'sol15.json' : 'sol1.json'), +tf * 60, {});
  let ok = 0, all = 0;
  for (const [f, pre] of Object.entries(keys)) {
    const r = E.run(P, E.FILTERS[f]);
    const o = Object.entries(v1[tf].results).find(([k]) => k.startsWith(pre))[1];
    const same = r.n === o.trades && Math.abs(r.net - o.net) < 1e-6 && Math.abs(r.maxDD - o.maxDD) < 1e-12;
    all++; if (same) ok++; else console.log('DIFF', tf, f, r.n, o.trades, r.net, o.net);
  }
  console.log(`${tf}m: v2 reproduces v1 exactly for ${ok}/${all} variants`);
}
