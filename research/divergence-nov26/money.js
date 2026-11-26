// Adds the compounded-money view to sim.js (same method as close-all-peak/sim4.js: TRI-CORE 50/25/25, 1,000 PHP from Apr 2020,
// risk 2.5% / 2% / 1.5% by account size, quarterly rebalance, monthly steps) and lists the trades that carry 2025.
'use strict';
const PHP = 58, TIERS = [[0, 0.025], [500, 0.02], [1000, 0.015]], W = { bbcore: 0.5, icore: 0.25, tcore: 0.25 };
const riskFor = (p) => { let r = TIERS[0][1]; for (const [b, x] of TIERS) if (p >= b) r = x; return r; };
const mkey = (T) => { const d = new Date(T * 1000); return d.getUTCFullYear() * 100 + d.getUTCMonth(); };
module.exports = function compound(lists) {   // lists: {bot: [trades]}
  const R = {}; for (const b in W) { R[b] = {}; for (const t of lists[b]) { const k = mkey(t.tExit - 1); R[b][k] = (R[b][k] || 0) + t.R; } }
  const end = Math.max(...[].concat(...Object.values(lists)).map((t) => mkey(t.tExit - 1)));
  let eq = 1000, hi = eq, worst = 0; const share = {}, peak = {}; for (const b in W) { share[b] = eq * W[b]; peak[b] = share[b] / PHP; }
  for (let k = 202003; k <= end; k = (k % 100 === 11) ? k + 89 : k + 1) {
    for (const b in W) { const r = riskFor(peak[b]); share[b] *= Math.max(0.01, 1 + r * (R[b][k] || 0)); peak[b] = Math.max(peak[b], share[b] / PHP); }
    eq = Object.values(share).reduce((a, c) => a + c, 0);
    if ((k % 100) % 3 === 2) for (const b in W) share[b] = eq * W[b];
    hi = Math.max(hi, eq); worst = Math.max(worst, 1 - eq / hi);
  }
  return { eq, worst };
};
