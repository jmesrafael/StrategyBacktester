// walkforward.js — would ranking on 2019-11..2022 data alone have picked the coins that did well in 2023..2026? (all 7-year coins, TRI-weighted R per trade)
'use strict';
const fs = require('fs'), path = require('path');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'results.json'), 'utf8')), T = JSON.parse(fs.readFileSync(path.join(__dirname, 'trades.json'), 'utf8'));
const W = { 'BB-CORE': 0.5, 'I-CORE': 0.25, 'T-CORE': 0.25 }, SPLIT = Date.UTC(2023, 0, 1) / 1000, YRS_POST = (Date.now() / 1000 - SPLIT) / (365.25 * 86400);
const rows = Object.entries(R.coins).filter(([, r]) => r.full7y).map(([c]) => {
  const tr = Object.entries(W).flatMap(([b, w]) => T[c][b].map((t) => ({ tExit: t[1], R: t[2] * w })));
  const pre = tr.filter((t) => t.tExit <= SPLIT), post = tr.filter((t) => t.tExit > SPLIT).sort((a, b) => a.tExit - b.tExit);
  let eq = 0, pk = 0, dd = 0; for (const t of post) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { c, pre: pre.reduce((s, t) => s + t.R, 0) / 3.14, post: eq / YRS_POST, postDD: dd };
});
const rank = (k) => Object.fromEntries([...rows].sort((a, b) => b[k] - a[k]).map((r, i) => [r.c, i + 1]));
const rp = rank('pre'), rq = rank('post'), n = rows.length;
const rho = 1 - 6 * rows.reduce((s, r) => s + (rp[r.c] - rq[r.c]) ** 2, 0) / (n * (n * n - 1));
console.log(`${n} coins with 7 full years. Spearman rank correlation pre-2023 vs post-2023 (R per year): ${rho.toFixed(2)}`);
console.log('rank by 2019-22 -> 2023-26 rank   coin   R/yr pre   R/yr post   post DD');
for (const r of [...rows].sort((a, b) => rp[a.c] - rp[b.c])) console.log(`${String(rp[r.c]).padStart(3)} -> ${String(rq[r.c]).padStart(3)}       ${r.c.padEnd(6)} ${r.pre.toFixed(1).padStart(7)}  ${r.post.toFixed(1).padStart(9)}  ${r.postDD.toFixed(1).padStart(7)}`);
const top = [...rows].sort((a, b) => rp[a.c] - rp[b.c]).slice(0, 10), med = [...rows].map((r) => r.post).sort((a, b) => a - b)[n >> 1];
console.log(`top-10 by 2019-22: average post R/yr ${(top.reduce((s, r) => s + r.post, 0) / 10).toFixed(1)}  vs all-coin median ${med.toFixed(1)}`);
