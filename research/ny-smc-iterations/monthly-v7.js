// monthly-v7.js — v7 month by month at a fixed $10 risk per trade (1R = $10), SOL and ETH.
// Running total resets at each test-year start (Oct 18), so the last row of a year = that year's profit.
const fs = require('fs'), E = require('./ie.js');
const V7 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5, tpMode: 'R', tpR: 3, minDispATR: 1, minFvgATR: 0.2,
  chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5, maxStopATR: 4, maxFillBars: 8 };
const RISK = 10, Ys = ['Y1', 'Y2', 'Y3'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const usd = (x) => (x < 0 ? '−$' : '+$') + Math.abs(x).toFixed(0);
const res = Object.fromEntries(['SOL', 'ETH'].map((s) => [s, E.runSym(s, V7).trades]));
const out = ['# v7 month by month — $10 risk per trade', '',
  'Fees and slippage included. Each trade: target ≈ +$30, full stop ≈ −$10, tightened stop ≈ −$5, breakeven ≈ $0.',
  'Months are calendar months (UTC). October is split at the 18th where a test year starts.', ''];
const sum = { SOL: [], ETH: [] };
for (const y of Ys) {
  const [a, b] = E.Y[y];
  out.push(`## ${new Date(a * 1000).toISOString().slice(0, 10)} → ${new Date(b * 1000).toISOString().slice(0, 10)}`, '',
    '| Month | SOL trades | SOL W / L / BE | SOL month | SOL year so far | ETH trades | ETH W / L / BE | ETH month | ETH year so far | Both month |',
    '|---|---|---|---|---|---|---|---|---|---|');
  const cum = { SOL: 0, ETH: 0 };
  // month buckets inside the year window
  const d = new Date(a * 1000); let cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
  while (cur < b) {
    const nd = new Date(cur * 1000), next = Date.UTC(nd.getUTCFullYear(), nd.getUTCMonth() + 1, 1) / 1000;
    const lo = Math.max(cur, a), hi = Math.min(next, b);
    let label = `${MON[nd.getUTCMonth()]} ${nd.getUTCFullYear()}`;
    if (lo !== cur) label += ` (from ${new Date(lo * 1000).getUTCDate()}th)`;
    if (hi !== next) label += ` (to ${new Date(hi * 1000 - 1).getUTCDate()}th)`;
    const cells = [];
    let both = 0;
    for (const s of ['SOL', 'ETH']) {
      const T = res[s].filter((t) => t.t >= lo && t.t < hi);
      const m = T.reduce((x, t) => x + t.R * RISK, 0);
      const w = T.filter((t) => t.R > 0.05).length, l = T.filter((t) => t.R <= -0.3).length, be = T.length - w - l;
      cum[s] += m; both += m;
      if (T.length || true) sum[s].push(m);
      cells.push(String(T.length), `${w} / ${l} / ${be}`, T.length ? `**${usd(m)}**` : '$0', usd(cum[s]));
    }
    out.push(`| ${label} | ${cells.join(' | ')} | ${usd(both)} |`);
    cur = next;
  }
  out.push(`| **Year total** | | | | **${usd(cum.SOL)}** | | | | **${usd(cum.ETH)}** | **${usd(cum.SOL + cum.ETH)}** |`, '');
}
// summary over all months (boundary Octobers merged back into whole calendar months)
const cal = (s) => { const m = new Map(); for (const t of res[s]) { const d = new Date(t.t * 1000), k = d.getUTCFullYear() * 12 + d.getUTCMonth(); m.set(k, (m.get(k) || 0) + t.R * RISK); }
  const a0 = new Date(E.Y.Y1[0] * 1000), k0 = a0.getUTCFullYear() * 12 + a0.getUTCMonth(), a1 = new Date(E.Y.Y3[1] * 1000 - 1), k1 = a1.getUTCFullYear() * 12 + a1.getUTCMonth();
  const arr = []; for (let k = k0; k <= k1; k++) arr.push([k, m.get(k) || 0]); return arr; };
out.push('## Summary (37 calendar months, Oct 2023 – Oct 2026)', '', '| | SOL | ETH | Both |', '|---|---|---|---|');
const A = cal('SOL'), B = cal('ETH'), C = A.map(([k, v], i) => [k, v + B[i][1]]);
const nm = ([k]) => `${MON[k % 12]} ${Math.floor(k / 12)}`;
const row = (f) => [A, B, C].map(f).join(' | ');
out.push(`| Average per month | ${row((x) => usd(x.reduce((s, [, v]) => s + v, 0) / x.length))} |`);
out.push(`| Profitable months | ${row((x) => `${x.filter(([, v]) => v > 0.5).length} of ${x.length}`)} |`);
out.push(`| Losing months | ${row((x) => `${x.filter(([, v]) => v < -0.5).length}`)} |`);
out.push(`| Flat / no-trade months | ${row((x) => `${x.filter(([, v]) => Math.abs(v) <= 0.5).length}`)} |`);
out.push(`| Best month | ${row((x) => { const b = x.reduce((p, q) => (q[1] > p[1] ? q : p)); return `${usd(b[1])} (${nm(b)})`; })} |`);
out.push(`| Worst month | ${row((x) => { const b = x.reduce((p, q) => (q[1] < p[1] ? q : p)); return `${usd(b[1])} (${nm(b)})`; })} |`);
out.push(`| Longest run of losing months | ${row((x) => { let c = 0, m = 0; for (const [, v] of x) { c = v < -0.5 ? c + 1 : 0; m = Math.max(m, c); } return m; })} |`);
const txt = out.join('\n'); fs.writeFileSync(__dirname + '/results/monthly-v7.md', txt); console.log(txt);
