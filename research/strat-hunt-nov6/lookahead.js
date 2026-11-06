// lookahead.js — every strategy recomputed on data TRUNCATED at a random bar must give the same entry/exit flags and stops at that bar as on the full data.
'use strict';
const { load } = require('./data.js'), { S, makeCtx } = require('./strategies.js');
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const same = (a, b) => (a !== a && b !== b) || a === b || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
let bad = 0, checks = 0;
for (const tf of ['4h', '1h']) for (const coin of ['SOL', 'ADA']) {
  const { B } = load(coin, tf), cf = makeCtx(B, tf), full = S.map((s) => s.build(cf));
  for (let t = 0; t < 6; t++) {
    const cut = Math.floor(2500 + rnd() * (B.length - 2600)), cc = makeCtx(B.slice(0, cut), tf);
    S.forEach((s, si) => {
      const tr = s.build(cc);
      for (let j = cut - 3; j < cut; j++) for (const key of ['L', 'S', 'xL', 'xS', 'stopL', 'stopS']) {
        if (!tr[key] && !full[si][key]) continue; checks++;
        if (!same(tr[key][j], full[si][key][j])) { bad++; if (bad < 15) console.log('MISMATCH', s.id, tf, coin, 'cut', cut, 'bar', j, key, tr[key][j], full[si][key][j]); }
      }
    });
  }
  console.log(tf, coin, 'done');
}
console.log(`\n${checks} comparisons, ${bad} mismatches -> ${bad === 0 ? 'NO LOOK-AHEAD' : 'LOOK-AHEAD FOUND'}`);
