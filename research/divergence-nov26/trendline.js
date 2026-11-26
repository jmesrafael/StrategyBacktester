// BTC higher-timeframe trendline exit (Nov 26 2026). Owner: "it hit the BTC high-TF trendline, which really does turn it up" (Nov 21 2026).
// Rule: rising support line through two confirmed BTC swing lows (daily or weekly), unbroken by any close since the first low.
// When a BTC 4h candle's low comes within `tol` of the line, close every open SHORT of all three bots at the next 4h open.
// Optional mirror: a falling resistance line through two swing highs closes every open LONG. Bots otherwise run as usual.
// No look-ahead: a swing low counts only after k candles on its right have closed; the line uses completed candles only.
// Run from StrategyBacktester: node research/divergence-nov26/trendline.js
'use strict';
const path = require('path'), fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8');
const body = src.slice(src.indexOf("const path = require('path')"), src.indexOf('// ---- parity'));
const K = new Function('require', '__dirname', 'process', body + '\nreturn { data, run, BOTS, YEARS, compound, M, read };')(require, __dirname, { argv: [] });
const { data, run, BOTS, YEARS, compound, read } = K;
const BTC = read('BTC', '4h').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));

// group 4h candles into days (UTC) or weeks (Monday UTC)
function group(span) {
  const out = []; const key = (t) => span === 'D' ? Math.floor(t / 86400) : Math.floor((t / 86400 + 3) / 7);
  for (const b of BTC) { const k = key(b.time), g = out[out.length - 1];
    if (!g || g.k !== k) out.push({ k, start: b.time, end: b.time + 14400, open: b.open, high: b.high, low: b.low, close: b.close });
    else { g.high = Math.max(g.high, b.high); g.low = Math.min(g.low, b.low); g.close = b.close; g.end = b.time + 14400; } }
  return out;
}
// events: Map(4h candle open time -> 'support' | 'resist') at which the touch happened (acted on at the next open)
function events({ span, k, tol, minGap, side }) {
  const G = group(span), ev = new Map(), used = new Set(), piv = { lo: [], hi: [] };
  let gi = 0, lastFire = { support: -1e18, resist: -1e18 };
  const lineAt = (a, b, t) => Math.exp(Math.log(a.p) + (Math.log(b.p) - Math.log(a.p)) * (t - a.t) / (b.t - a.t));
  for (const c of BTC) {
    // completed higher-TF candles up to this 4h candle; confirm swing points k candles after them
    while (gi < G.length && G[gi].end <= c.time) {
      const j = gi - k;
      if (j >= k) {
        const w = G.slice(j - k, j + k + 1);
        if (w.every((x, q) => q === k || x.low > G[j].low)) piv.lo.push({ i: j, t: G[j].start, p: G[j].low });
        if (w.every((x, q) => q === k || x.high < G[j].high)) piv.hi.push({ i: j, t: G[j].start, p: G[j].high });
      }
      gi++;
    }
    const done = gi;                                // G[0..done-1] are completed
    for (const [kind, list, rising] of [['support', piv.lo, true], ['resist', piv.hi, false]]) {
      if (kind === 'resist' && side !== 'both') continue;
      if (c.time - lastFire[kind] < 5 * 86400) continue;
      let hit = null;
      for (let bi = list.length - 1; bi >= 1 && !hit; bi--) for (let ai = bi - 1; ai >= 0 && !hit; ai--) {
        const a = list[ai], b = list[bi];
        if (b.i - a.i < minGap || (rising ? !(b.p > a.p) : !(b.p < a.p))) continue;
        if (done - 1 - b.i < k) continue;
        // unbroken: no completed close beyond the line from the first swing point on
        let ok = true; for (let q = a.i + 1; q < done && ok; q++) { const L = lineAt(a, b, G[q].start); if (rising ? G[q].close < L : G[q].close > L) ok = false; }
        if (!ok) continue;
        const L = lineAt(a, b, c.time), id = `${kind}|${a.t}|${b.t}`;
        if (used.has(id)) continue;
        if (rising ? c.low <= L * (1 + tol) && c.close >= L * (1 - 3 * tol) : c.high >= L * (1 - tol) && c.close <= L * (1 + 3 * tol)) hit = { id, L, a, b };
      }
      if (hit) { used.add(hit.id); lastFire[kind] = c.time; ev.set(c.time, (ev.get(c.time) ? 'both' : kind)); (events.log = events.log || []).push({ kind, t: c.time, L: hit.L, a: hit.a, b: hit.b }); }
    }
  }
  return ev;
}
function simulate(ev) {
  const S = {};
  for (const b of BOTS) S[b] = data[b].map((D) => run(D, ev.size ? { onOpen: (pos) => (i) => { const e = ev.get(D.B[i].time); return e && (e === 'both' || (e === 'support' ? pos.dir === -1 : pos.dir === 1)); } } : {}).map((t) => ({ ...t, bot: b, coin: D.coin })));
  return S;
}
const all = (S) => [].concat(...BOTS.map((b) => [].concat(...S[b])));
const tot = (L) => L.reduce((a, t) => a + t.R, 0);
const yrs = (L) => { const y = Object.fromEntries(YEARS.map((x) => [x, 0])); for (const t of L) { const k = new Date((t.tExit - 1) * 1000).getUTCFullYear(); if (y[k] != null) y[k] += t.R; } return y; };
const money = (S) => compound(Object.fromEntries(BOTS.map((b) => [b, [].concat(...S[b])])));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const f = (x) => (x >= 0.05 ? '+' : x <= -0.05 ? '−' : '') + Math.abs(x).toFixed(1);
const peso = (x) => '₱' + (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : Math.round(x).toLocaleString('en-US'));
const idxOf = (t) => BTC.findIndex((b) => b.time === t);
const fwd = (t, d) => { const i = idxOf(t); const j = i + 1, z = Math.min(BTC.length - 1, j + d * 6); return BTC[z].close / BTC[j].open - 1; };

const base = simulate(new Map()), BL = all(base), bm = money(base);
const VAR = [];
for (const [span, k, minGap, label] of [['D', 5, 20, 'Daily, swing = 5 days each side'], ['D', 10, 30, 'Daily, swing = 10 days each side'], ['W', 3, 8, 'Weekly, swing = 3 weeks each side']])
  for (const tol of [0.01, 0.02]) for (const side of ['shorts', 'both']) VAR.push({ span, k, minGap, tol, side, label: `${label}, within ${tol * 100}%${side === 'both' ? ', both sides' : ''}` });

const out = ['# BTC higher-timeframe trendline exit vs no interference (all three bots, live coins, v3 rules, to Nov 25 2026)', '',
  'Rule: when BTC touches a rising support trendline (two confirmed swing lows, unbroken), close every open short at the next 4h open. "Both sides" also closes every open long when BTC touches a falling resistance line. R = the amount risked on one trade.', '',
  '| Version | Touches | Total R | vs as is | ₱1,000 compounded | Worst fall from a high | Fired Nov 14-25 2026? | BTC up 7 days after a support touch | BTC up 14 days after |', '|---|---|---|---|---|---|---|---|---|',
  `| No interference | 0 | ${f(tot(BL))} | — | ${peso(bm.eq)} | ${Math.round(bm.worst * 100)}% | — | — | — |`];
const keep = [];
let any7 = 0, n7 = 0; for (let i = 0; i + 1 + 42 < BTC.length; i += 6) { n7++; if (BTC[i + 1 + 42].close > BTC[i + 1].open) any7++; }
for (const v of VAR) {
  events.log = []; const ev = events(v), log = events.log, S = simulate(ev), L = all(S), m = money(S);
  const sup = log.filter((e) => e.kind === 'support'), up7 = sup.filter((e) => fwd(e.t, 7) > 0).length, up14 = sup.filter((e) => fwd(e.t, 14) > 0).length;
  const nov = log.filter((e) => e.t >= Date.UTC(2026, 10, 14) / 1000).map((e) => `${e.kind === 'support' ? 'support' : 'resistance'} ${iso(e.t)}`).join('; ') || 'no';
  keep.push({ v, L, log, S, m });
  out.push(`| ${v.label} | ${log.length} | ${f(tot(L))} | ${Math.round((tot(L) / tot(BL) - 1) * 100)}% | ${peso(m.eq)} | ${Math.round(m.worst * 100)}% | ${nov} | ${sup.length ? Math.round(100 * up7 / sup.length) + '%' : '—'} | ${sup.length ? Math.round(100 * up14 / sup.length) + '%' : '—'} |`);
}
out.push('', `Any random 4h candle: BTC higher 7 days later ${Math.round(100 * any7 / n7)}% of the time.`, '');
// per-year view for every shorts-only version
const so = keep.filter((x) => x.v.side === 'shorts');
out.push('## Per year (shorts-only versions)', '', '| Year | No interference | ' + so.map((x) => x.v.label.replace(', within', ',')).join(' | ') + ' |', '|---|---|' + so.map(() => '---|').join(''));
const by = yrs(BL), yk = so.map((x) => yrs(x.L));
for (const y of YEARS) out.push(`| ${y} | ${f(by[y])} | ` + yk.map((z) => f(z[y])).join(' | ') + ' |');
out.push(`| **Total** | **${f(tot(BL))}** | ` + so.map((x) => `**${f(tot(x.L))}**`).join(' | ') + ' |', '');
// every touch of one version with its effect on the shorts it closed
const pick = so.find((x) => x.v.span === 'W' && x.v.tol === 0.02) || so[0];
const keyOf = (t) => `${t.bot}|${t.coin}|${t.sig}`, baseBy = new Map(BL.map((t) => [keyOf(t), t]));
out.push(`## Every touch: ${pick.v.label}`, '', '| Touch (UTC) | BTC low | Line | Line from (swing lows) | BTC 7 days later | Shorts closed | Their R at the close | If left alone | Difference |', '|---|---|---|---|---|---|---|---|---|');
let s1 = 0, s2 = 0, sn = 0;
for (const e of pick.log) {
  const at = e.t + 14400, closed = all(pick.S).filter((t) => t.why === 'hand' && t.tExit === at + 14400 || (t.why === 'hand' && Math.abs(t.tExit - (at + 14400)) < 1));
  const got = closed.reduce((a, t) => a + t.R, 0), left = closed.reduce((a, t) => a + (baseBy.get(keyOf(t)) || { R: t.R }).R, 0);
  s1 += got; s2 += left; sn += closed.length;
  const b = BTC[idxOf(e.t)];
  out.push(`| ${iso(e.t)} | ${Math.round(b.low).toLocaleString('en-US')} | ${Math.round(e.L).toLocaleString('en-US')} | ${iso(e.a.t).slice(0, 10)} → ${iso(e.b.t).slice(0, 10)} | ${f(100 * fwd(e.t, 7))}% | ${closed.length} | ${f(got)} | ${f(left)} | ${f(got - left)} |`);
}
out.push(`| **Total** | — | — | — | — | ${sn} | **${f(s1)}** | **${f(s2)}** | **${f(s1 - s2)}** |`);
fs.writeFileSync(path.join(__dirname, 'trendline.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
