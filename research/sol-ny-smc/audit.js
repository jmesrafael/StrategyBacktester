// Whole-pipeline look-ahead audit (prefix invariance): truncating the data must not
// change any trade that had already finished before the truncation point.
const E = require('./engine');
for (const [file, tf, cuts] of [['sol15.json', 15, 20], ['sol1.json', 1, 8]]) {
  const raw = E.loadBars(file);
  const fullP = E.prepare(raw, tf * 60, {});
  const full = {}; for (const f of ['base', 'location']) full[f] = E.run(fullP, E.FILTERS[f]).trades;
  let checked = 0, mismatches = 0, cutsDone = 0;
  for (let c = 1; c <= cuts; c++) {
    const n = Math.floor(raw.length * c / (cuts + 1));
    const P = E.prepare(raw.slice(0, n), tf * 60, {});
    const lastT = raw[n - 1][0];
    for (const f of ['base', 'location']) {
      const got = E.run(P, E.FILTERS[f]).trades.filter((t) => t.reason !== 'END');
      const want = full[f].filter((t) => t.exitTime < lastT);
      const same = (a, b) => a.fillTime === b.fillTime && a.exitTime === b.exitTime && a.fillPx === b.fillPx &&
        a.exitPx === b.exitPx && a.reason === b.reason && Math.abs(a.pnl - b.pnl) < 1e-9;
      if (got.length !== want.length) { mismatches++; console.log('COUNT MISMATCH', tf, f, n, got.length, want.length); continue; }
      got.forEach((t, i) => { checked++; if (!same(t, want[i])) { mismatches++; console.log('TRADE MISMATCH', tf, f, n, t, want[i]); } });
    }
    cutsDone++;
  }
  console.log(`${tf}m: ${cutsDone} truncation points, ${checked} completed trades compared, ${mismatches} mismatches`);
}
