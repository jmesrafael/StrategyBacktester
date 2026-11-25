// validate.js: independent check of the two candidates against the live bots, with randomness tests over the 7 years,
// plus one honest new search for T-CORE (chosen on 2020-23 only, judged on 2024-26).
//   node validate.js -> VALIDATE.md
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./engine');
const E = require('../../intel/engines/backtest/engine');
const { bot } = require('../../intel/engines/backtest/strategies');
const C = require('../../candles/candles.js');
const cfgI = require('../../intel/config.json').bots;
const { END } = require('./check');
const K = require('./locked.json');
const ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, T0 = ts(2020), CUT = ts(2024), IV = L.IV, YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const TCOINS = cfgI.tcore.coins;
const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), pc = (v) => (100 * v).toFixed(0) + '%';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- trade lists ----------
const hash = (seed, c, t) => { let h = (seed * 2654435761) >>> 0; for (let k = 0; k < c.length; k++) h = Math.imul(h ^ c.charCodeAt(k), 16777619); h = Math.imul(h ^ Math.floor(t / IV), 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const skipper = (seed, p) => (seed == null ? null : (c, t) => hash(seed, c, t) < p);
function fromIntel(extra = {}, skip = null, coins = TCOINS, scale = 1) {
  return coins.flatMap((c) => { const x = L.load(c, END), S = bot('tcore', 'v3', extra);
    if (skip) { const sig = S.signal; S.signal = (ctx, i) => { const r = sig(ctx, i); return r && skip(c, ctx.B[i].time) ? null : r; }; }
    return E.run(x.bars, S, E.standardCost({ funding: x.funding, scale })).trades.map((q) => ({ c, dir: q.dir, t: q.t, tExit: q.tExit, R: q.R, entry: q.entry, dist: q.dist, w: 1 })); });
}
function fromReplay(cfg, k, skip = null, coins = L.LIVE, cost = 1) {
  return L.replay(cfg, { endT: END, skip, coins, cost }).trades.map((q) => { const x = L.load(q.c, END); let a = 0, b = x.n - 1; while (a < b) { const m = (a + b) >> 1; if (x.T[m] < q.t) a = m + 1; else b = m; }
    let s = 0; for (let j = q.sig - 19; j <= q.sig; j++) s += x.Cl[j]; const entry = x.O[a] * (1 + q.dir * 0.0002); return { ...q, entry, dist: Math.abs(entry - s / 20) / entry, w: q.w * k }; });
}
function build(trades) { // equity in R at every 4h close, open trades valued at the close
  trades = [...trades].sort((a, b) => a.tExit - b.tExit || a.t - b.t);
  const ev = new Map(), add = (t, v) => ev.set(t, (ev.get(t) || 0) + v);
  for (const q of trades) { const x = L.load(q.c, END); let prev = 0, a = 0, b = x.n - 1; while (a < b) { const m = (a + b) >> 1; if (x.T[m] < q.t) a = m + 1; else b = m; }
    for (let i = a; i < x.n && x.T[i] + IV < q.tExit; i++) { const v = q.w * (q.dir * (x.Cl[i] - q.entry) / q.entry - 0.001 - q.dir * x.fund(q.t, x.T[i] + IV)) / q.dist; add(x.T[i] + IV, v - prev); prev = v; }
    add(q.tExit, q.w * q.R - prev); }
  const curveT = [], curveE = []; let e = 0; for (let t = T0 - 400 * 86400; t <= END; t += IV) { e += ev.get(t) || 0; curveT.push(t); curveE.push(e); }
  return { trades, curveT, curveE };
}
const M = (r, a = T0, b = END) => L.measure(r, a, b);
const greens = (r) => YEARS.filter((y) => M(r, ts(y), Math.min(ts(y + 1), END)).R > 0).length;

const PAIRS = [
  { id: 'BB', live: 'BB-CORE live', cand: 'BB tweak 1.05x', mk: (live, skip, cost = 1) => (live ? fromReplay({}, 1, skip, L.LIVE, cost) : fromReplay(K.iiCombo.cfg, 1.05, skip, L.LIVE, cost)) },
  { id: 'T', live: 'T-CORE live (trail 14)', cand: 'T-CORE trail 12', mk: (live, skip, cost = 1) => fromIntel(live ? {} : { kTrail: 12 }, skip, TCOINS, cost) },
];
const md = ['# Validation of the two candidates (Nov 25, 2026)', '', 'Same basis as COMPARE.md: live coins, 4h, v3 rules, 0.05% fee + 0.02% slippage per side, real funding, to Nov 24 2026. "Drop closed" = worst fall on closed trades; "drop open" = including open trades. A paired test always gives both versions the same random draw.', ''];

for (const P of PAIRS) {
  log('pair', P.id);
  const A = build(P.mk(true)), B = build(P.mk(false)), a = M(A), b = M(B);
  md.push(`## ${P.cand} against ${P.live}`, '', '### 1. Base numbers', '', '| Version | Total R | Drop closed | Drop open | Longest losing run | Without best 10 | Green years |', '|---|---|---|---|---|---|---|');
  for (const [n, r, m] of [[P.live, A, a], [P.cand, B, b]]) md.push(`| ${n} | ${f(m.R)} | ${m.dd.toFixed(1)} | ${m.mdd.toFixed(1)} | ${m.ls} | ${f(m.ex10)} | ${greens(r)}/7 |`);
  // long / short split
  md.push('', '| Side | ' + P.live + ' R (trades) | ' + P.cand + ' R (trades) |', '|---|---|---|');
  for (const [side, d] of [['Longs', 1], ['Shorts', -1]]) { const s = (r) => { const t = r.trades.filter((q) => q.dir === d && q.tExit > T0); return `${f(t.reduce((x, q) => x + q.w * q.R, 0))} (${t.length})`; }; md.push(`| ${side} | ${s(A)} | ${s(B)} |`); }

  // 2. month-block bootstrap
  const months = []; for (let y = 2020; y <= 2026; y++) for (let m = 0; m < 12; m++) if (ts(y, m) < END) months.push(ts(y, m));
  const mser = (r) => { const v = new Array(months.length).fill(0); for (const q of r.trades) { if (q.tExit <= T0) continue; let i = months.length - 1; while (i > 0 && months[i] >= q.tExit) i--; v[i] += q.w * q.R; } return v; };
  const ma = mser(A), mb = mser(B); let seed = 11; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const st = (v) => { let e = 0, p = 0, d = 0; for (const x of v) { e += x; p = Math.max(p, e); d = Math.max(d, p - e); } return { R: e, dd: d }; };
  const N = 10000; let w1 = 0, w2 = 0, w3 = 0, w4 = 0;
  for (let n = 0; n < N; n++) { const xa = [], xb = []; while (xa.length < months.length) { const s0 = Math.floor(rnd() * (months.length - 2)); for (let k = 0; k < 3 && xa.length < months.length; k++) { xa.push(ma[s0 + k]); xb.push(mb[s0 + k]); } }
    const sa = st(xa), sb = st(xb); if (sb.R > sa.R) w1++; if (sb.dd < sa.dd) w2++; if (sb.R / sb.dd > sa.R / sa.dd) w3++; if (sb.R > sa.R && sb.dd <= sa.dd) w4++; }
  md.push('', `### 2. Reshuffled histories (${N.toLocaleString()} draws of 3-month blocks, same months for both)`, '', '| Candidate has more R | smaller drop (monthly) | better R / drop | more R AND drop not bigger |', '|---|---|---|---|', `| ${pc(w1 / N)} | ${pc(w2 / N)} | ${pc(w3 / N)} | ${pc(w4 / N)} |`);

  // 3. random start dates and rolling 12-month windows
  const starts = months.filter((t) => t < ts(2026));
  const cmp = (fn) => { let r = 0, dd = 0, od = 0, all = 0, negA = 0, negB = 0; for (const [s, e] of fn) { const x = M(A, s, e), y = M(B, s, e); if (y.R > x.R) r++; if (y.dd <= x.dd) dd++; if (y.mdd <= x.mdd) od++; if (y.R > x.R && y.dd <= x.dd && y.mdd <= x.mdd) all++; if (x.R < 0) negA++; if (y.R < 0) negB++; } return { n: fn.length, r, dd, od, all, negA, negB }; };
  const rowC = (label, c) => `| ${label} | ${c.n} | ${pc(c.r / c.n)} | ${pc(c.dd / c.n)} | ${pc(c.od / c.n)} | ${pc(c.all / c.n)} | ${c.negA} / ${c.negB} |`;
  md.push('', '### 3. Random start dates and rolling windows', '', '| Windows | Count | Candidate more R | drop closed not bigger | drop open not bigger | all three | losing windows live / candidate |', '|---|---|---|---|---|---|---|',
    rowC('Start any month 2020-2025, run to Nov 2026', cmp(starts.map((s) => [s, END]))), rowC('Any 12 months in a row', cmp(starts.filter((s) => s + 365 * 86400 <= END).map((s) => [s, s + 365 * 86400]))),
    rowC('Any 24 months in a row', cmp(starts.filter((s) => s + 730 * 86400 <= END).map((s) => [s, s + 730 * 86400]))));

  // 4. random missed signals
  const SEEDS = 120, res = { r: 0, dd: 0, od: 0, all: 0, gA: 0, gB: 0, dR: [] };
  for (const p of [0.2]) for (let s = 1; s <= SEEDS; s++) {
    const sk = skipper(s, p), x = build(P.mk(true, sk)), y = build(P.mk(false, sk)), mx = M(x), my = M(y);
    if (my.R > mx.R) res.r++; if (my.dd <= mx.dd) res.dd++; if (my.mdd <= mx.mdd) res.od++; if (my.R > mx.R && my.dd <= mx.dd && my.mdd <= mx.mdd) res.all++;
    if (greens(x) === 7) res.gA++; if (greens(y) === 7) res.gB++; res.dR.push(my.R - mx.R);
  }
  res.dR.sort((p, q) => p - q);
  md.push('', `### 4. Randomly miss 20% of signals (${SEEDS} runs; the same signals missed by both)`, '', '| Candidate more R | drop closed not bigger | drop open not bigger | all three | R difference: worst / median / best | runs with 7/7 green years: live / candidate |', '|---|---|---|---|---|---|',
    `| ${pc(res.r / SEEDS)} | ${pc(res.dd / SEEDS)} | ${pc(res.od / SEEDS)} | ${pc(res.all / SEEDS)} | ${f(res.dR[0])} / ${f(res.dR[SEEDS >> 1])} / ${f(res.dR[SEEDS - 1])} | ${res.gA}/${SEEDS} / ${res.gB}/${SEEDS} |`);
  log('skip done', P.id);

  // 5. costs
  md.push('', '### 5. Higher costs', '', '| Fees and slippage | Live R / drop closed / drop open | Candidate R / drop closed / drop open | Green years live / candidate |', '|---|---|---|---|');
  for (const k of [2, 3]) { const x = build(P.mk(true, null, k)), y = build(P.mk(false, null, k)), mx = M(x), my = M(y); md.push(`| ${k}x | ${f(mx.R)} / ${mx.dd.toFixed(1)} / ${mx.mdd.toFixed(1)} | ${f(my.R)} / ${my.dd.toFixed(1)} / ${my.mdd.toFixed(1)} | ${greens(x)} / ${greens(y)} |`); }

  // 6. year by year, both
  md.push('', '### 6. Each year: R / drop closed / drop open', '', `| Version | ${YEARS.join(' | ')} |`, '|' + '---|'.repeat(8));
  for (const [n, r] of [[P.live, A], [P.cand, B]]) md.push(`| ${n} | ${YEARS.map((y) => { const m = M(r, ts(y), Math.min(ts(y + 1), END)); return `${f(m.R)} / ${m.dd.toFixed(0)} / ${m.mdd.toFixed(0)}`; }).join(' | ')} |`);
  md.push('');
}

// ---------- T-CORE extra: neighbours, walk-forward, other coins ----------
log('T extras');
const TR = {}; const tr = (k) => (TR[k] ||= build(fromIntel({ kTrail: k })));
md.push('## T-CORE trail: neighbours and walk-forward', '', '| Trail (ATR) | Total R | Drop closed | Drop open | 2020-23 R / drop closed | 2024-26 R / drop closed | Green years |', '|---|---|---|---|---|---|---|');
for (const k of [8, 9, 10, 11, 12, 13, 14, 16]) { const r = tr(k), m = M(r), i = M(r, T0, CUT), o = M(r, CUT, END); md.push(`| ${k}${k === 14 ? ' (live)' : ''} | ${f(m.R)} | ${m.dd.toFixed(1)} | ${m.mdd.toFixed(1)} | ${f(i.R)} / ${i.dd.toFixed(1)} | ${f(o.R)} / ${o.dd.toFixed(1)} | ${greens(r)}/7 |`); }
const wf = [], picks = [];
for (let y = 2022; y <= 2026; y++) { let best = null; for (const k of [8, 9, 10, 11, 12, 13, 14, 16]) { const m = M(tr(k), T0, ts(y)), sc = m.R / m.dd; if (!best || sc > best.sc) best = { k, sc }; }
  picks.push(`${y}: trail ${best.k}`); wf.push(...tr(best.k).trades.filter((q) => q.t >= ts(y) && q.t < ts(y + 1))); }
const wfr = build(wf), w14 = build(tr(14).trades.filter((q) => q.t >= ts(2022))), w12 = build(tr(12).trades.filter((q) => q.t >= ts(2022)));
md.push('', `Walk-forward: every 1 January the trail with the best R / closed drop on past data only is used for that year (${picks.join(', ')}).`, '', '| 2022 to Nov 2026 | Total R | Drop closed | Drop open | ' + [2022, 2023, 2024, 2025, 2026].join(' | ') + ' |', '|' + '---|'.repeat(9));
for (const [n, r] of [['Live trail 14', w14], ['Fixed trail 12', w12], ['Walk-forward pick', wfr]]) { const m = M(r, ts(2022), END); md.push(`| ${n} | ${f(m.R)} | ${m.dd.toFixed(1)} | ${m.mdd.toFixed(1)} | ${[2022, 2023, 2024, 2025, 2026].map((y) => f(M(r, ts(y), Math.min(ts(y + 1), END)).R)).join(' | ')} |`); }

// other coins: closed-trade stats only
const closed = (t, a, b) => { t = t.filter((q) => q.tExit > a && q.tExit <= b).sort((p, q) => p.tExit - q.tExit); let e = 0, p = 0, d = 0; for (const q of t) { e += q.w * q.R; p = Math.max(p, e); d = Math.max(d, p - e); } return { R: e, dd: d }; };
const others = C.coins().filter((c) => !TCOINS.includes(c) && !L.LIVE.includes(c) && c !== 'BTC'); let s9 = 77; const rnd9 = () => (s9 = (Math.imul(s9, 1664525) + 1013904223) >>> 0) / 4294967296;
const pick = (n) => { const a = others.slice(); for (let i = 0; i < n; i++) { const j = i + Math.floor(rnd9() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
const tradesByCoin = {}; const coinT = (c, extra, key) => (tradesByCoin[c + key] ||= fromIntel(extra, null, [c]));
md.push('', '## Other coins (never used for any choice): 150 random baskets', '', '| Pair | Window | Candidate more R | drop closed not bigger | better R / drop | more R AND drop not bigger |', '|---|---|---|---|---|---|');
const bbBy = {}; const bbT = (c, live) => (bbBy[c + live] ||= live ? fromReplay({}, 1, null, [c]) : fromReplay(K.iiCombo.cfg, 1.05, null, [c]));
for (const [label, size, get] of [['T trail 12 vs 14 (8 coins)', 8, (c, live) => coinT(c, live ? {} : { kTrail: 12 }, live ? 'L' : 'C')], ['BB 1.05x vs live (6 coins)', 6, (c, live) => bbT(c, live)]]) {
  const sets = Array.from({ length: 150 }, () => pick(size));
  for (const [w, a, b] of [['all years', T0, END], ['2024-26', CUT, END]]) { let r = 0, d = 0, q = 0, both = 0;
    for (const s of sets) { const x = closed(s.flatMap((c) => get(c, true)), a, b), y = closed(s.flatMap((c) => get(c, false)), a, b); if (y.R > x.R) r++; if (y.dd <= x.dd) d++; if (y.R / y.dd > x.R / x.dd) q++; if (y.R > x.R && y.dd <= x.dd) both++; }
    md.push(`| ${label} | ${w} | ${pc(r / 150)} | ${pc(d / 150)} | ${pc(q / 150)} | ${pc(both / 150)} |`); }
}

// ---------- honest new search for T-CORE: chosen on 2020-23 only ----------
log('T search');
const live = tr(14), li = M(live, T0, CUT), lh1 = M(live, T0, ts(2022)), lh2 = M(live, ts(2022), CUT), cands = [];
for (const kTrail of [10, 11, 12, 13, 14]) for (const kInit of [1.5, 2, 2.5]) for (const staleBars of [36, 48, 60]) for (const staleR of [0.5, 1]) {
  const cfg = { kTrail, kInit, staleBars, staleR }, r = build(fromIntel(cfg)), i = M(r, T0, CUT), h1 = M(r, T0, ts(2022)), h2 = M(r, ts(2022), CUT);
  const ok = i.R > li.R && i.dd <= li.dd && i.mdd <= li.mdd && h1.R / h1.dd >= lh1.R / lh1.dd && h2.R / h2.dd >= lh2.R / lh2.dd;
  cands.push({ cfg, r, i, ok, score: i.R / i.mdd });
}
const q = cands.filter((c) => c.ok).sort((a, b) => b.score - a.score);
md.push('', '## New T-CORE search (chosen on 2020-23 only, then judged on 2024-26)', '', `${cands.length} settings (trail 10-14, first stop 1.5/2/2.5 ATR, stale exit 36/48/60 candles below +0.5/+1R). Qualify on 2020-23: more R, both drops not bigger, R / drop not lower in either half. ${q.length} qualify; ranked by R / open drop on 2020-23.`, '',
  '| Setting | 2020-23 R / closed / open | 2024-26 R / closed / open | All R / closed / open | Green years |', '|---|---|---|---|---|');
const lo = M(live, CUT, END), la = M(live);
md.push(`| LIVE (trail 14, stop 2, stale 48 / +1R) | ${f(li.R)} / ${li.dd.toFixed(1)} / ${li.mdd.toFixed(1)} | ${f(lo.R)} / ${lo.dd.toFixed(1)} / ${lo.mdd.toFixed(1)} | ${f(la.R)} / ${la.dd.toFixed(1)} / ${la.mdd.toFixed(1)} | ${greens(live)}/7 |`);
for (const c of q.slice(0, 8)) { const o = M(c.r, CUT, END), a = M(c.r); md.push(`| trail ${c.cfg.kTrail}, stop ${c.cfg.kInit}, stale ${c.cfg.staleBars} / +${c.cfg.staleR}R | ${f(c.i.R)} / ${c.i.dd.toFixed(1)} / ${c.i.mdd.toFixed(1)} | ${f(o.R)} / ${o.dd.toFixed(1)} / ${o.mdd.toFixed(1)} | ${f(a.R)} / ${a.dd.toFixed(1)} / ${a.mdd.toFixed(1)} | ${greens(c.r)}/7 |`); }
const winOOS = q.length ? (() => { const o = M(q[0].r, CUT, END); return o.R > lo.R && o.dd <= lo.dd && o.mdd <= lo.mdd; })() : false;
md.push('', `The 2020-23 winner ${q.length ? (winOOS ? 'BEATS' : 'does NOT beat') : '(none)'} live on all three numbers in 2024-26.`);
fs.writeFileSync(path.join(__dirname, 'VALIDATE.md'), md.join('\n') + '\n'); log('written VALIDATE.md');
