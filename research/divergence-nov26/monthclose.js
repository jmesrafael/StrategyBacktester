// Month-end clean-out (Nov 26 2026): close every open trade just before a month ends and start the next month flat, against no interference.
// The close is decided at the 16:00 UTC candle close of the last day and filled at 20:00; the bots then take new signals as usual.
// Same engine, data and costs as sim.js. Run from StrategyBacktester: node research/divergence-nov26/monthclose.js
'use strict';
const path = require('path'), fs = require('fs');
// reuse the data loader and the hooked engine from sim.js (everything between the requires and the parity check)
const src = fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8');
const body = src.slice(src.indexOf("const path = require('path')"), src.indexOf('// ---- parity'));
const K = new Function('require', '__dirname', 'process', body + '\nreturn { data, run, BOTS, YEARS, compound };')(require, __dirname, { argv: [] });
const { data, run, BOTS, YEARS, compound } = K;
const LABEL = { bbcore: 'BB-CORE', tcore: 'T-CORE', icore: 'I-CORE' };
const month = (y, m) => Date.UTC(y, m, 1) / 1000;                 // m = 0..11; the start of that month
const name = (T) => new Date((T - 1) * 1000).toISOString().slice(0, 7);
const END = Math.max(...BOTS.map((b) => Math.max(...data[b].map((D) => D.B[D.B.length - 1].time + 14400))));
const ENDS = []; for (let y = 2020, m = 3; month(y, m) <= END; m++) { if (m > 12) { m = 1; y++; } ENDS.push(month(y, m)); }   // ends of Mar 2020 onwards

function simulate(closeAt) {   // closeAt: Set of month boundaries to clean out
  const out = {};
  for (const b of BOTS) out[b] = data[b].map((D) => {
    const at = (i) => closeAt.has(D.B[i].time + 28800);
    const h = closeAt.size ? { onOpen: () => (i) => at(i), refuse: (s) => at(s) } : {};
    return { D, trades: run(D, h) };
  });
  return out;
}
const flat = (S, b) => [].concat(...(b ? [b] : BOTS).map((x) => [].concat(...S[x].map((c) => c.trades.map((t) => ({ ...t, bot: x, coin: c.D.coin, D: c.D }))))));
const markR = (t, T) => { const B = t.D.B; let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].time + 14400 <= T) lo = m + 1; else hi = m; } const c = B[lo - 1].close; return t.D.cost.R({ dir: t.dir, entry: t.entry, exit: t.D.cost.exitFill(c, t.dir), dist: t.dist, t: t.t, tExit: T }); };
// account value in R at time T: closed trades booked plus open trades marked at the last close
const value = (list, T) => list.reduce((a, t) => a + (t.t >= T ? 0 : t.tExit <= T && !(t.why === 'open') ? t.R : markR(t, T)), 0);
const closedIn = (list, a, z) => list.reduce((s, t) => s + (t.tExit > a && t.tExit <= z && t.why !== 'open' ? t.R : 0), 0);
const sum = (list) => list.reduce((a, t) => a + t.R, 0);
const f = (x) => (x >= 0.05 ? '+' : x <= -0.05 ? '−' : '') + Math.abs(x).toFixed(1);
const next = (T) => { const d = new Date(T * 1000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000; };
const prev = (T) => { const d = new Date(T * 1000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1) / 1000; };

const base = simulate(new Set()), BL = flat(base);
const openAt = (T) => BL.filter((t) => t.t < T - 14400 && t.tExit > T);
const rows = ENDS.filter((T) => T < END).map((T) => { const o = openAt(T), openR = o.reduce((a, t) => a + markR(t, T), 0); const alt = flat(simulate(new Set([T]))); return { T, openR, n: o.length, later: o.reduce((a, t) => a + t.R, 0), monthR: value(BL, T) - value(BL, prev(T)), full: sum(alt) - sum(BL), after: [1, 2, 3].map((k) => { let z = T; for (let j = 0; j < k; j++) z = next(z); z = Math.min(z, END); return value(alt, z) - value(BL, z); }), alt }; });
const y25 = rows.filter((r) => name(r.T).startsWith('2025'));
const picks = [...y25].sort((a, b) => b.openR - a.openR).slice(0, 2);

const out = ['# Month-end clean-out against no interference (all three bots, live coins, v3 rules, to Nov 25 2026)', '',
  'R = the amount risked on one trade. "Value" counts closed trades plus open trades marked at the last price.', '',
  '## Every month end of 2025: clean out once, then leave the bots alone', '',
  '| Month end | Month gain (value) | Open trades | Open profit at month end | Same trades, final result if left | Clean-out vs as is: +1 month | +2 months | +3 months | Whole history |', '|---|---|---|---|---|---|---|---|---|'];
for (const r of y25) out.push(`| ${name(r.T)} | ${f(r.monthR)} | ${r.n} | ${f(r.openR)} | ${f(r.later)} | ${f(r.after[0])} | ${f(r.after[1])} | ${f(r.after[2])} | ${f(r.full)} |`);
const tot = (g) => y25.reduce((a, r) => a + g(r), 0);
out.push(`| **Total** | ${f(tot((r) => r.monthR))} | ${tot((r) => r.n)} | ${f(tot((r) => r.openR))} | ${f(tot((r) => r.later))} | ${f(tot((r) => r.after[0]))} | ${f(tot((r) => r.after[1]))} | ${f(tot((r) => r.after[2]))} | ${f(tot((r) => r.full))} |`, '');

for (const p of picks) {
  const T = p.T, open = openAt(T).sort((a, b) => markR(b, T) - markR(a, T));
  out.push(`## Example: end of ${name(T)}`, '', '### The trades that were open', '', '| Bot | Coin | Side | Opened | Closed at month end (R) | If left alone (R) | Left alone until | Difference |', '|---|---|---|---|---|---|---|---|');
  const fill = (t) => p.alt.find((x) => x.bot === t.bot && x.coin === t.coin && x.sig === t.sig).R, shut = open.reduce((a, t) => a + fill(t), 0);
  for (const t of open) { const m = fill(t); out.push(`| ${LABEL[t.bot]} | ${t.coin} | ${t.dir === 1 ? 'long' : 'short'} | ${new Date(t.t * 1000).toISOString().slice(0, 10)} | ${f(m)} | ${f(t.R)} | ${t.why === 'open' ? 'still open' : new Date(t.tExit * 1000).toISOString().slice(0, 10)} | ${f(m - t.R)} |`); }
  out.push(`| **Total** | ${open.length} trades | — | — | **${f(shut)}** | **${f(p.later)}** | — | **${f(shut - p.later)}** |`, '', `Closing these trades: ${f(shut - p.later)}R. Later entries moved by the clean-out: ${f(p.full - (shut - p.later))}R. Net over the whole history: ${f(p.full)}R.`, '', '### Month by month afterwards (change in value)', '', '| Month | As is | Clean-out | Difference | Running difference | Closed R booked: as is | Closed R booked: clean-out |', '|---|---|---|---|---|---|---|');
  let a = prev(T), A = 0, C = 0, ca = 0, cc = 0;
  for (let k = 0; k < 7 && a < END; k++) { const z = Math.min(next(a), END), x = value(BL, z) - value(BL, a), y = value(p.alt, z) - value(p.alt, a), u = closedIn(BL, a, z), v = closedIn(p.alt, a, z); A += x; C += y; ca += u; cc += v; out.push(`| ${name(z)}${k === 0 ? ' (clean-out)' : ''} | ${f(x)} | ${f(y)} | ${f(y - x)} | ${f(C - A)} | ${f(u)} | ${f(v)} |`); a = z; }
  out.push(`| **Total (${7} months)** | **${f(A)}** | **${f(C)}** | **${f(C - A)}** | **${f(C - A)}** | **${f(ca)}** | **${f(cc)}** |`, '', '### By bot, whole history', '', '| Bot | As is | With this one clean-out | Difference |', '|---|---|---|---|');
  for (const b of BOTS) { const x = sum(BL.filter((t) => t.bot === b)), y = sum(p.alt.filter((t) => t.bot === b)); out.push(`| ${LABEL[b]} | ${f(x)} | ${f(y)} | ${f(y - x)} |`); }
  out.push(`| **Total** | **${f(sum(BL))}** | **${f(sum(p.alt))}** | **${f(p.full)}** |`, '');
}

out.push('## All month ends since April 2020, one clean-out at a time', '', '| Group | Month ends | Helped over the whole history | Hurt | Average effect, R | Best | Worst | Sum |', '|---|---|---|---|---|---|---|---|');
const grp = (label, g) => out.push(`| ${label} | ${g.length} | ${g.filter((r) => r.full > 0.05).length} | ${g.filter((r) => r.full < -0.05).length} | ${g.length ? f(g.reduce((a, r) => a + r.full, 0) / g.length) : '—'} | ${g.length ? f(Math.max(...g.map((r) => r.full))) : '—'} | ${g.length ? f(Math.min(...g.map((r) => r.full))) : '—'} | ${f(g.reduce((a, r) => a + r.full, 0))} |`);
grp('Open profit under 10R', rows.filter((r) => r.openR < 10)); grp('Open profit 10R to 30R', rows.filter((r) => r.openR >= 10 && r.openR < 30)); grp('Open profit 30R or more', rows.filter((r) => r.openR >= 30)); grp('**Total**', rows);

const POL = [['As is', () => false], ['Clean out every month end', () => true], ['Only when open profit is 10R or more', (r) => r.openR >= 10], ['Only when open profit is 30R or more', (r) => r.openR >= 30]];
const res = POL.map(([label, pick], k) => {
  // the condition is judged on the policy's own open trades at the time, month by month
  const set = new Set(); if (k === 1) rows.forEach((r) => set.add(r.T));
  else if (k > 1) for (const r of rows) { const L = flat(simulate(set)), o = L.filter((t) => t.t < r.T - 14400 && t.tExit > r.T).reduce((a, t) => a + markR(t, r.T), 0); if (pick({ openR: o })) set.add(r.T); }
  const S = simulate(set), L = flat(S), yr = Object.fromEntries(YEARS.map((y) => [y, 0])); for (const t of L) { const y = new Date((t.tExit - 1) * 1000).getUTCFullYear(); if (yr[y] != null) yr[y] += t.R; }
  let pk = 0, dd = 0; for (const T of ENDS.concat(END)) { const v = value(L, Math.min(T, END)); pk = Math.max(pk, v); dd = Math.max(dd, pk - v); }
  const m = compound(Object.fromEntries(BOTS.map((b) => [b, flat(S, b)])));
  return { label, n: set.size, yr, total: sum(L), dd, money: m };
});
const peso = (x) => '₱' + (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : Math.round(x).toLocaleString('en-US'));
out.push('', '## As a standing habit, per year', '', '| Year | ' + res.map((r) => r.label).join(' | ') + ' |', '|---|' + res.map(() => '---|').join(''));
for (const y of YEARS) out.push(`| ${y} | ` + res.map((r) => f(r.yr[y])).join(' | ') + ' |');
out.push('| **Total R** | ' + res.map((r) => `**${f(r.total)}**`).join(' | ') + ' |', '| Month ends cleaned out | ' + res.map((r) => r.n).join(' | ') + ' |', '| Largest month-end drop in value, R | ' + res.map((r) => r.dd.toFixed(0)).join(' | ') + ' |', '| ₱1,000 compounded from Apr 2020 | ' + res.map((r) => peso(r.money.eq)).join(' | ') + ' |', '| Worst fall from a high (booked money) | ' + res.map((r) => Math.round(r.money.worst * 100) + '%').join(' | ') + ' |');
fs.writeFileSync(path.join(__dirname, 'monthclose.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
