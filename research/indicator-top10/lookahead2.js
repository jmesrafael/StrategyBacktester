// lookahead2.js — every batch2 indicator: events computed on a truncated history must equal events on the full history for all bars before the cut.
const { IND2, CFG } = require('./batch2.js'); const { D } = require('./rstrat.js');
let bad = 0, chk = 0;
for (const c of ['BTC', 'SOL']) { const d = D[c], N = d.C.length;
  for (const cut of [N - 7000, N - 3001, N - 777]) { const t = { b: d.b.slice(0, cut), C: d.C.slice(0, cut), V: d.V.slice(0, cut) };
    for (const [ind, lab, args] of CFG) { const a = IND2[ind](d, ...args), b = IND2[ind](t, ...args);
      for (let i = 0; i < cut; i++) { chk++; if (a[i] !== b[i]) { bad++; if (bad < 10) console.log('MISMATCH', c, ind, lab, cut, i); break; } } } } }
console.log('checked', chk, 'bars-configs; mismatches', bad);
