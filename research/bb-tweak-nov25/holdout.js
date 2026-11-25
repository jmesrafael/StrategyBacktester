// holdout.js: the locked tweaks on the years the selection never saw, a year-by-year walk-forward, and stress tests.
//   node holdout.js  -> RESULTS.md + results.json
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./engine');
const C = require('../../candles/candles.js');
const { select, T0 } = require('./select');
const { parity, noFuture, END } = require('./check');
const K = JSON.parse(fs.readFileSync(path.join(__dirname, 'locked.json'), 'utf8'));
const ts = (y) => Date.UTC(y, 0, 1) / 1000, CUT = K.cut, IV = L.IV;
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026], yr = (y) => [ts(y), Math.min(ts(y + 1), END)];
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d), pc = (v, d = 0) => (v * 100).toFixed(d) + '%';
const md = [];

const p = parity(), nf = noFuture([{}, K.champion.cfg, K.iiCombo.cfg]);
console.log('parity', p, 'noFuture', nf); if (p.bad || nf.bad) process.exit(1);

// the four versions. k = risk rescale fixed from pre-2024 data (1 for versions that only skip trades or are shown raw)
const V = [
  { id: 'A', name: 'BB-CORE today', cfg: {}, k: 1 },
  { id: 'B', name: 'Intensity filter alone', cfg: { ii: { len: 21, th: 0, lo: 0 } }, k: 1 },
  { id: 'C', name: `${K.champion.label} (picked by the procedure)`, cfg: K.champion.cfg, k: K.champion.k },
  { id: 'D', name: `${K.iiCombo.label} (best with Intensity)`, cfg: K.iiCombo.cfg, k: K.iiCombo.k },
  { id: 'C1', name: `C without raising risk (never above today's risk)`, cfg: K.champion.cfg, k: 1 },
  { id: 'D1', name: `D without raising risk`, cfg: K.iiCombo.cfg, k: 1 },
];
for (const v of V) v.res = L.replay(v.cfg, { endT: END });

// compounding return when 1 R = 1% of the account, booked when the trade closes
const money = (trades, k, a, b) => { let e = 1, pk = 1, dd = 0; for (const t of trades) { if (t.tExit <= a || t.tExit > b) continue; e *= 1 + 0.01 * k * t.w * t.R; pk = Math.max(pk, e); dd = Math.max(dd, 1 - e / pk); } return { ret: e - 1, dd }; };
const table = (title, a, b, list) => {
  md.push(`## ${title}`, '', '| Version | Trades | Total R | Max drawdown R (closed) | Max drawdown R (with open trades) | R / drawdown | Longest losing run | Without best 10 | Return at 1% risk | Worst fall at 1% risk |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const v of list) { const m = L.measure(v.res, a, b, v.k), q = money(v.res.trades, v.k, a, b); md.push(`| ${v.id} ${v.name} | ${m.n} | ${f(m.R)} | ${m.dd.toFixed(1)} | ${m.mdd.toFixed(1)} | ${m.rdd.toFixed(1)} | ${m.ls} | ${f(m.ex10)} | ${f(q.ret * 100)}% | ${pc(q.dd)} |`); }
  md.push('');
};
md.push('# Results: tweaks to BB-CORE (candles to 2026-11-24, live coins SOL ZEC NEAR ADA GALA ARB)', '',
  `Replay equals the project engine on ${p.n} trades (${p.bad} different). No-future-sight check: ${nf.trades} trades and ${nf.points} equity points identical when the data is cut at 8 dates (${nf.bad} failures).`,
  `Tweaks locked ${K.lockedAt.slice(0, 16)}Z from data before 2024 only (${K.tested} tested, ${K.passed} passed every check).`, '');
table('Years used to choose (2020-2023)', T0, CUT, V);
table('UNSEEN years (2024 to Nov 2026)', CUT, END, V);
table('Everything (2020 to Nov 2026)', T0, END, V);

md.push('## Year by year', '', 'Years 2020-2023 were used to choose; 2024-2026 were not. 2020 starts with the data; 2026 ends Nov 24.', '');
for (const [title, fn] of [['Total R', (v, a, b) => f(L.measure(v.res, a, b, v.k).R)], ['Max drawdown R inside the year, with open trades', (v, a, b) => L.measure(v.res, a, b, v.k).mdd.toFixed(1)],
  ['Max drawdown R inside the year, closed trades', (v, a, b) => L.measure(v.res, a, b, v.k).dd.toFixed(1)], ['Return at 1% risk per trade (compounded inside the year)', (v, a, b) => f(money(v.res.trades, v.k, a, b).ret * 100) + '%'],
  ['Worst fall inside the year at 1% risk', (v, a, b) => pc(money(v.res.trades, v.k, a, b).dd)], ['Trades', (v, a, b) => String(L.measure(v.res, a, b, v.k).n)]]) {
  md.push(`### ${title}`, '', `| Version | ${YEARS.join(' | ')} |`, '|' + '---|'.repeat(YEARS.length + 1));
  for (const v of V) md.push(`| ${v.id} | ${YEARS.map((y) => fn(v, ...yr(y))).join(' | ')} |`);
  md.push('');
}

// ---------- walk-forward: every 1 January, rerun the whole selection on the past only, then trade that year ----------
function curveFrom(trades) { // equity in R at every 4h close, including open trades, from a list of trades
  const ev = new Map(), add = (t, v) => ev.set(t, (ev.get(t) || 0) + v);
  for (const t of trades) { const x = L.load(t.c, END); let prev = 0;
    for (let i = t.i0; x.T[i] + IV < t.tExit; i++) { const v = t.w * (t.dir * (x.Cl[i] - t.entry) / t.entry - 0.001 - t.dir * x.fund(x.T[t.i0], x.T[i] + IV)) / t.dist; add(x.T[i] + IV, v - prev); prev = v; }
    add(t.tExit, t.w * t.R - prev); }
  const T = []; for (let t = T0; t <= END; t += IV) T.push(t);
  let e = 0; return { trades, curveT: T, curveE: T.map((t) => (e += ev.get(t) || 0)) };
}
// trades from a replay with entry price, stop distance and entry index attached (needed to mark them)
const enrich = (res, cfg) => res.trades.map((t) => { const x = L.load(t.c, END); let i0 = 0, hi = x.n - 1; while (i0 < hi) { const m = (i0 + hi) >> 1; if (x.T[m] < t.t) i0 = m + 1; else hi = m; }
  const len = cfg.len || 20; let s = 0; for (let j = t.sig - len + 1; j <= t.sig; j++) s += x.Cl[j]; const entry = x.O[i0] * (1 + t.dir * 0.0002); return { ...t, i0, entry, dist: Math.abs(entry - s / len) / entry }; });
const WF = [2022, 2023, 2024, 2025, 2026], picks = [], lines = { A: [], C: [], D: [] };
const iiSingles = require('./select').singles().filter((s) => s.fam === 'ii');
for (const y of WF) {
  const cut = ts(y), s = select(cut), champ = s.ranked[0] || null;
  const baseCfg = champ ? champ.cfg : {};
  const combos = iiSingles.map((q) => { const cfg = { ...baseCfg, ...q.cfg }, r = L.replay(cfg, { endT: cut }), k = 1 / L.meanW(r, T0, cut); return { label: q.label + (champ ? ' + ' + champ.label : ''), cfg, k, m: L.measure(r, T0, cut, k) }; }).sort((a, b) => b.m.rdd - a.m.rdd);
  const chosen = { A: { cfg: {}, k: 1 }, C: champ ? { cfg: champ.cfg, k: champ.k } : { cfg: {}, k: 1 }, D: { cfg: combos[0].cfg, k: combos[0].k } };
  picks.push({ y, C: champ ? champ.label : '(nothing qualified: today\'s rules)', D: combos[0].label, passed: s.ranked.length });
  for (const id of ['A', 'C', 'D']) { const c = chosen[id], res = L.replay(c.cfg, { endT: END }); lines[id].push(...enrich(res, c.cfg).filter((t) => t.t >= cut && t.t < ts(y + 1)).map((t) => ({ ...t, w: t.w * c.k }))); }
  console.log('walk-forward', y, picks.at(-1).C, '|', picks.at(-1).D);
}
md.push('## Walk-forward (the most realistic test)', '', 'On every 1 January the whole selection is run again on past data only, and the winner is traded for that year. "C" = procedure winner, "D" = winner joined with the best Intensity setting of that date. Years are by entry date.', '', '| Year | C used | D used |', '|---|---|---|');
for (const q of picks) md.push(`| ${q.y} | ${q.C} | ${q.D} |`);
const wf = Object.fromEntries(Object.entries(lines).map(([id, tr]) => [id, curveFrom(tr.sort((a, b) => a.tExit - b.tExit || a.t - b.t))]));
const wfName = { A: 'BB-CORE today', C: 'walk-forward C', D: 'walk-forward D (with Intensity)' };
md.push('', '| Version | Total R 2022-26 | Max drawdown closed | Max drawdown with open trades | R / drawdown | Return at 1% risk | Worst fall at 1% risk | ' + WF.map((y) => y + ' R').join(' | ') + ' | ' + WF.map((y) => y + ' DD').join(' | ') + ' |', '|' + '---|'.repeat(7 + 2 * WF.length));
for (const id of ['A', 'C', 'D']) { const r = wf[id], m = L.measure(r, ts(2022), END), q = money(r.trades, 1, ts(2022), END); md.push(`| ${wfName[id]} | ${f(m.R)} | ${m.dd.toFixed(1)} | ${m.mdd.toFixed(1)} | ${m.rdd.toFixed(1)} | ${f(q.ret * 100)}% | ${pc(q.dd)} | ${WF.map((y) => f(L.measure(r, ...yr(y)).R)).join(' | ')} | ${WF.map((y) => L.measure(r, ...yr(y)).mdd.toFixed(1)).join(' | ')} |`); }

// ---------- stress tests on the unseen years ----------
md.push('', '## Stress tests, unseen years only (2024 to Nov 2026)', '');
const row = (label, res, k) => { const m = L.measure(res, CUT, END, k); return `| ${label} | ${f(m.R)} | ${m.dd.toFixed(1)} | ${m.mdd.toFixed(1)} | ${m.rdd.toFixed(1)} |`; };
const hdr = ['| Case | Total R | DD closed | DD with open trades | R / drawdown |', '|---|---|---|---|---|'];
md.push('### Double fees and slippage', '', ...hdr);
for (const v of V.slice(0, 4)) md.push(row(v.id, L.replay(v.cfg, { endT: END, cost: 2 }), v.k));
// late fill: take the price 2 minutes after the 4h close from the 1-minute candles
const late = {}; for (const c of L.LIVE) { const m = new Map(); for (const r of JSON.parse(fs.readFileSync(path.join(C.ROOT, '1m', c + '.json')))) if (r[0] % IV === 120) m.set(r[0] - 120, r[1]); late[c] = m; }
let asked = 0, got = 0; const delayFill = (c, t) => { asked++; const v = late[c].get(t); if (v != null) got++; return v ?? null; };
md.push('', '### Orders filled 2 minutes late (real 1-minute prices)', '', ...hdr);
for (const v of V.slice(0, 4)) md.push(row(v.id, L.replay(v.cfg, { endT: END, delayFill }), v.k));
md.push('', `1-minute price found for ${pc(got / asked, 1)} of entries.`);
md.push('', '### Neighbour settings (shown for stability, not used to choose)', '', ...hdr, row('A today', V[0].res, 1));
for (const max of [22, 25, 27, 30, 35, 40]) { const r = L.replay({ adx: { max, lo: 0.5 } }, { endT: END }); md.push(row(`ADX>${max} half`, r, 1 / L.meanW(r, T0, CUT))); }
for (const len of [10, 14, 21, 28, 35]) { const cfg = { ...K.iiCombo.cfg, ii: { ...K.iiCombo.cfg.ii, len } }, r = L.replay(cfg, { endT: END }); md.push(row(`D with Intensity length ${len}`, r, 1 / L.meanW(r, T0, CUT))); }
md.push('', '### Leave one coin out', '', '| Without | A: R / DDopen | C: R / DDopen | D: R / DDopen |', '|---|---|---|---|');
for (const c of L.LIVE) { const coins = L.LIVE.filter((x) => x !== c); md.push(`| ${c} | ${[V[0], V[2], V[3]].map((v) => { const m = L.measure(L.replay(v.cfg, { coins, endT: END }), CUT, END, v.k); return `${f(m.R)} / ${m.mdd.toFixed(1)}`; }).join(' | ')} |`); }
// other coins: random 6-coin baskets in the unseen years
const poolC = C.coins().filter((c) => !L.LIVE.includes(c) && c !== 'BTC'); let s = 4242; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
const N = 300, sets = Array.from({ length: N }, () => { const a = poolC.slice(); for (let i = 0; i < 6; i++) { const j = i + Math.floor(rnd() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 6); });
for (const [label, a, b] of [['unseen years 2024-26, other coins', CUT, END], ['all years, other coins', T0, END]]) {
  const bm = sets.map((coins) => L.measure(L.replay({}, { coins, endT: END }), a, b));
  md.push('', `### ${N} random baskets of 6 other coins (${label})`, '', '| Version | More R than today | Smaller drawdown (open) | Better R / drawdown | Both more R and smaller drawdown | Median R | Median drawdown (open) |', '|---|---|---|---|---|---|---|');
  const med = (x) => [...x].sort((p, q) => p - q)[x.length >> 1];
  md.push(`| A today | | | | | ${f(med(bm.map((m) => m.R)))} | ${med(bm.map((m) => m.mdd)).toFixed(1)} |`);
  for (const v of V.slice(1, 4)) { const m = sets.map((coins) => L.measure(L.replay(v.cfg, { coins, endT: END }), a, b, v.k)), share = (fn) => pc(m.filter((x, i) => fn(x, bm[i])).length / N);
    md.push(`| ${v.id} | ${share((x, y) => x.R > y.R)} | ${share((x, y) => x.mdd < y.mdd)} | ${share((x, y) => x.rdd > y.rdd)} | ${share((x, y) => x.R > y.R && x.mdd < y.mdd)} | ${f(med(m.map((x) => x.R)))} | ${med(m.map((x) => x.mdd)).toFixed(1)} |`); }
}
// how much risk a version really uses
md.push('', '## Risk actually used (all years)', '', '| Version | Average risk per trade | Largest risk per trade | Trades at reduced risk |', '|---|---|---|---|');
for (const v of V) { const w = v.res.trades.map((t) => t.w * v.k), mx = Math.max(...w); md.push(`| ${v.id} | ${(w.reduce((a, x) => a + x, 0) / w.length).toFixed(2)}x | ${mx.toFixed(2)}x | ${pc(w.filter((x) => x < mx - 1e-9).length / w.length)} |`); }
fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ picks, versions: V.map((v) => ({ id: v.id, name: v.name, cfg: v.cfg, k: v.k })) }, null, 1));
console.log('written RESULTS.md');
