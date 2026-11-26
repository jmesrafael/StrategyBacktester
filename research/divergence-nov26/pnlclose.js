// "Close everything when open profit reaches X% of the account" (Nov 26 2026; Nov 21 peak was ~30%: $266 open on $867).
// Open profit % = sum over bots of weight x risk (2.5%) x open R at each 4h close. Trigger -> close every trade at the next open, bots restart as usual.
'use strict';
const path = require('path'), fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8');
const body = src.slice(src.indexOf("const path = require('path')"), src.indexOf('// ---- parity'));
const { data, run, BOTS, YEARS, compound } = new Function('require', '__dirname', 'process', body + '\nreturn { data, run, BOTS, YEARS, compound };')(require, __dirname, { argv: [] });
const W = { bbcore: 0.5, tcore: 0.25, icore: 0.25 }, RISK = 0.025;
function sim(set) { const S = {}; for (const b of BOTS) S[b] = data[b].map((D) => ({ D, T: run(D, set.size ? { onOpen: () => (i) => set.has(D.B[i].time) } : {}) })); return S; }
function openPct(S) {   // Map(candle open time -> open profit as % of account)
  const m = new Map();
  for (const b of BOTS) for (const { D, T } of S[b]) for (const t of T) for (let i = t.i0; i < Math.min(t.i1, D.B.length); i++) {
    const k = D.B[i].time; m.set(k, (m.get(k) || 0) + W[b] * RISK * t.dir * (D.B[i].close - t.entry) / (t.dist * t.entry));
  }
  return m;
}
const flat = (S, b) => [].concat(...S[b].map((c) => c.T));
const res = [];
for (const X of [null, 0.2, 0.3, 0.4, 0.5]) {
  const set = new Set(); let S = sim(set);
  if (X) for (let after = -1; ;) { const hit = [...openPct(S)].filter(([k, v]) => k > after && v >= X).sort((a, b) => a[0] - b[0])[0]; if (!hit) break; set.add(hit[0]); after = hit[0]; S = sim(set); }
  const L = [].concat(...BOTS.map((b) => flat(S, b))), yr = Object.fromEntries(YEARS.map((y) => [y, 0]));
  for (const t of L) { const y = new Date((t.tExit - 1) * 1000).getUTCFullYear(); if (yr[y] != null) yr[y] += t.R; }
  const m = compound(Object.fromEntries(BOTS.map((b) => [b, flat(S, b)])));
  res.push({ X, n: set.size, dates: [...set].sort().map((k) => new Date(k * 1000).toISOString().slice(0, 10)), yr, tot: L.reduce((a, t) => a + t.R, 0), m });
}
const f = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(0), peso = (x) => '₱' + (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : Math.round(x).toLocaleString('en-US'));
const lab = (r) => r.X ? `Close all at ${r.X * 100}% open profit` : 'No interference';
const out = ['# Close everything when open profit reaches X% of the account (all three bots, 50/25/25, 2.5% risk, to Nov 25 2026)', '', '| Year | ' + res.map(lab).join(' | ') + ' |', '|---|' + res.map(() => '---|').join('')];
for (const y of YEARS) out.push(`| ${y} | ` + res.map((r) => f(r.yr[y])).join(' | ') + ' |');
out.push('| **Total R** | ' + res.map((r) => `**${f(r.tot)}**`).join(' | ') + ' |', '| Times it closed everything | ' + res.map((r) => r.n).join(' | ') + ' |', '| ₱1,000 compounded | ' + res.map((r) => peso(r.m.eq)).join(' | ') + ' |', '| Worst fall from a high | ' + res.map((r) => Math.round(r.m.worst * 100) + '%').join(' | ') + ' |', '');
for (const r of res.filter((r) => r.X)) out.push(`- ${r.X * 100}%: ${r.dates.join(', ')}`);
fs.writeFileSync(path.join(__dirname, 'pnlclose.md'), out.join('\n') + '\n'); console.log(out.join('\n'));
