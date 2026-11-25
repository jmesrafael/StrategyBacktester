// run.js: parity check, truncation audit, then every candidate of PLAN.md against the pass mark.
//   node run.js            -> RESULTS.md + results.json
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./engine');
const E = require('../../intel/engines/backtest/engine');
const { bot } = require('../../intel/engines/backtest/strategies');
const C = require('../../candles/candles.js');

const LIVE = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'];
const WIDE = C.coins().filter((c) => !LIVE.includes(c));
const T0 = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000, END = L.END;
const WIN = { all: [T0, END], is: [T0, SPLIT], oos: [SPLIT, END] };
const { COND } = L;

const F = [
  ['F1', 'squeeze (125) in last 20', COND.squeeze(125, 20), [['k=10', COND.squeeze(125, 10)], ['k=40', COND.squeeze(125, 40)], ['6 months', COND.squeeze(1095, 20)]]],
  ['F2', 'BandWidth expanding', COND.expand(), []],
  ['F3', 'MFI(10) 80/20', COND.mfi(80), [['70/30', COND.mfi(70)], ['60/40', COND.mfi(60)]]],
  ['F4', 'Intraday Intensity(21) agrees', COND.ii(21), [['10', COND.ii(10)], ['42', COND.ii(42)]]],
  ['F5', 'Accum/Distrib(21) agrees', COND.ad(21), [['10', COND.ad(10)], ['42', COND.ad(42)]]],
  ['F6', 'RSI(10) 70/30', COND.rsi(70), [['60/40', COND.rsi(60)]]],
  ['F7', 'head fake (opposite break, 20)', COND.headfake(20), [['10', COND.headfake(10)], ['40', COND.headfake(40)]]],
];
const SAR = { start: 0.02, step: 0.02, max: 0.2 }, SLOW = { start: 0.01, step: 0.01, max: 0.1 };
const M1 = { mult: 2, trend: 0, filter: COND.squeeze(125, 20), stop: 'formation', maxBars: 0 };
const M2 = { mult: 2, trend: 0, entry: 'm2', stop: 'formation', maxBars: 0 };
const V = [
  ...F.map(([id, name, f, nb]) => [id, name, { filter: f }, nb.map(([k, g]) => [k, { filter: g }])]),
  ['E1', 'Method II entry', { entry: 'm2' }, [['MFI 70', { entry: 'm2', mfiTh: 70 }]]],
  ['E2', 'pullback entry (12)', { pullback: 12 }, [['6', { pullback: 6 }], ['24', { pullback: 24 }]]],
  ['X1', 'opposite-band tag, no time exit', { tag: true, maxBars: 0 }, []],
  ['X1t', 'opposite-band tag + time exit', { tag: true }, []],
  ['X2', 'stop AND exit at opposite band', { stop: 'opp', tag: true, maxBars: 0 }, []],
  ['X3', 'Parabolic from middle band', { sar: SAR, maxBars: 0 }, [['slow', { sar: SLOW, maxBars: 0 }]]],
  ['X3t', 'Parabolic from middle + time exit', { sar: SAR }, [['slow', { sar: SLOW }]]],
  ['X4', 'formation stop + Parabolic', { stop: 'formation', sar: SAR, maxBars: 0 }, [['slow', { stop: 'formation', sar: SLOW, maxBars: 0 }]]],
  ['X4t', 'formation stop + Parabolic + time', { stop: 'formation', sar: SAR }, [['slow', { stop: 'formation', sar: SLOW }]]],
  ['X5', 'MFI divergence exit', { div: true }, []],
  ['B1', 'bands on typical price', { src: 'typical' }, []],
  ['B2', 'bands on weighted close', { src: 'weighted' }, []],
  ['B3', 'length 50, 2.1', { len: 50, mult: 2.1 }, [['50/1.9', { len: 50, mult: 1.9 }]]],
  ['B4', 'length 10, 1.9', { len: 10, mult: 1.9 }, [['10/1.7', { len: 10, mult: 1.7 }]]],
  ['M1', 'Method I as written (Parabolic)', { ...M1, sar: SAR }, []],
  ['M1o', 'Method I as written (opposite band)', { ...M1, tag: true }, []],
  ['M2', 'Method II as written (Parabolic)', { ...M2, sar: SAR }, []],
  ['M2o', 'Method II as written (opposite band)', { ...M2, tag: true }, []],
];

console.log('loading', LIVE.length + WIDE.length, 'coins');
const X = Object.fromEntries([...LIVE, ...WIDE].map((c) => [c, L.load(c)]));

// ---- 1. parity with the intel engine (bbcore v3, standard costs, real funding)
let compared = 0, diff = 0;
for (const c of [...LIVE, ...WIDE]) {
  const a = L.run(X[c]), b = E.run(X[c].B, bot('bbcore', 'v3'), E.standardCost({ funding: X[c].funding })).trades;
  if (a.length !== b.length) diff += Math.abs(a.length - b.length);
  for (let i = 0; i < Math.min(a.length, b.length); i++) { compared++; if (a[i].t !== b[i].t || a[i].tExit !== b[i].tExit || a[i].dir !== b[i].dir || Math.abs(a[i].R - b[i].R) > 1e-9) diff++; }
}
console.log(`parity: ${compared} trades compared, ${diff} different`);
if (diff) process.exit(1);

// ---- 2. truncation audit: with candles cut at k, every trade closed before k must be unchanged
let aud = 0, audBad = 0;
const all = V.flatMap(([id, , o, nb]) => [[id, o], ...nb.map(([k, p]) => [id + ' ' + k, p])]);
for (const c of LIVE) for (const frac of [0.37, 0.61, 0.88]) {
  const k = Math.floor(X[c].n * frac), y = L.cut(X[c], k), lim = y.B[k - 1].time;
  for (const [id, o] of all) {
    const a = L.run(X[c], o).filter((t) => t.tExit <= lim), b = L.run(y, o).filter((t) => t.tExit <= lim);
    aud += a.length; if (a.length !== b.length || a.some((t, i) => t.t !== b[i].t || Math.abs(t.R - b[i].R) > 1e-12)) { audBad++; console.log('AUDIT FAIL', id, c, frac); }
  }
}
console.log(`truncation audit: ${aud} trades, ${audBad} failing runs`);
if (audBad) process.exit(1);

// ---- 3. measures
const monthsOf = ([a, b]) => { const out = []; for (let d = new Date(a * 1000); d.getTime() / 1000 < b; d.setUTCMonth(d.getUTCMonth() + 1, 1)) out.push(d.toISOString().slice(0, 7)); return out; };
const sum = (a) => a.reduce((s, v) => s + v, 0);
function measure(tr, win) {
  const [a, b] = WIN[win], t = tr.filter((q) => q.tExit > a && q.tExit <= b).sort((p, q) => p.tExit - q.tExit || p.t - q.t);
  const R = t.map((q) => q.R * (q.w ?? 1)); let e = 0, pk = 0, dd = 0, st = 0, ls = 0;
  for (const r of R) { e += r; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); st = r <= 0 ? st + 1 : 0; ls = Math.max(ls, st); }
  const m = Object.fromEntries(monthsOf(WIN[win]).map((k) => [k, 0]));
  t.forEach((q, i) => { const k = new Date((q.tExit - 1) * 1000).toISOString().slice(0, 7); if (k in m) m[k] += R[i]; });
  const mv = Object.values(m), mean = sum(mv) / mv.length, sd = Math.sqrt(sum(mv.map((v) => (v - mean) ** 2)) / (mv.length - 1));
  return { n: t.length, R: e, avg: t.length ? e / t.length : 0, wr: t.length ? R.filter((r) => r > 0).length / t.length : 0, dd, rdd: dd > 0 ? e / dd : 0, ls,
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(12) : 0, loseM: mv.filter((v) => v < 0).length / mv.length, ex10: e - sum([...R].sort((p, q) => q - p).slice(0, 10)) };
}
const pool = (coins, o, cost = 1) => coins.flatMap((c) => L.run(X[c], o, cost));
const full = (tr) => Object.fromEntries(Object.keys(WIN).map((w) => [w, measure(tr, w)]));
const years = (tr) => { const y = {}; for (const t of tr) if (t.tExit > T0) { const k = new Date((t.tExit - 1) * 1000).getUTCFullYear(); y[k] = (y[k] || 0) + t.R * (t.w ?? 1); } return y; };
const perCoin = (tr) => Object.fromEntries(LIVE.map((c) => [c, sum(tr.filter((t) => t.c === c && t.tExit > T0).map((t) => t.R * (t.w ?? 1)))]));

function evaluate(trLive, trLive2, trWide) {
  return { live: full(trLive), live2: measure(trLive2, 'all'), wide: full(trWide), years: years(trLive), coins: perCoin(trLive) };
}
const base = evaluate(pool(LIVE, {}), pool(LIVE, {}, 2), pool(WIDE, {}));
const rule1 = (m) => ['is', 'oos'].every((w) => m[w].rdd > base.live[w].rdd);
function judge(r, nb) {
  const p = [rule1(r.live), ['is', 'oos'].every((w) => r.live[w].sharpe > base.live[w].sharpe), ['is', 'oos'].every((w) => r.live[w].R >= 0.8 * base.live[w].R),
    r.live2.rdd > base.live2.rdd, ['is', 'oos'].every((w) => r.wide[w].avg > base.wide[w].avg), nb.length ? nb.filter((x) => rule1(x.res.live)).length * 2 > nb.length : null];
  return { rules: p, pass: p.every((v) => v !== false) };
}
// share of random subsets (same size) of the baseline trades whose average R is at least as good
function luck(baseTr, k, avg, N = 4000) {
  const R = baseTr.filter((t) => t.tExit > T0).map((t) => t.R); if (k >= R.length || k < 1) return null; let s = 12345, hit = 0;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let q = 0; q < N; q++) { const a = R.slice(); let tot = 0; for (let i = 0; i < k; i++) { const j = i + Math.floor(rnd() * (a.length - i)); const v = a[j]; a[j] = a[i]; tot += v; } if (tot / k >= avg) hit++; }
  return hit / N;
}

const baseLiveTr = pool(LIVE, {}), results = [];
for (const [id, name, o, nb] of V) {
  const tr = pool(LIVE, o), r = evaluate(tr, pool(LIVE, o, 2), pool(WIDE, o));
  const nbr = nb.map(([k, p]) => ({ k, res: evaluate(pool(LIVE, p), pool(LIVE, p, 2), pool(WIDE, p)) }));
  results.push({ id, name, ...r, nb: nbr, ...judge(r, nbr), luck: o.filter && Object.keys(o).length === 1 ? luck(baseLiveTr, r.live.all.n, r.live.all.avg) : null });
  console.log('done', id);
}

// ---- 4. information test and size tilt for the confirmations (baseline trades, tagged at the signal candle)
const info = [], tilt = [];
const baseTr = { live: pool(LIVE, {}), wide: pool(WIDE, {}) };
const tag = (tr, f) => { const cache = {}; return tr.map((t) => { const g = (cache[t.c] ||= f(X[t.c], L.BASE)); return { ...t, ok: g(t.sig, t.dir) }; }); };
for (const [id, name, f, nb] of F) {
  for (const [label, g] of [['', f], ...nb]) {
    const tagged = { live: tag(baseTr.live, g), wide: tag(baseTr.wide, g) }, row = { id: label ? `${id} ${label}` : id, name };
    for (const set of ['live', 'wide']) for (const w of ['is', 'oos']) { const yes = measure(tagged[set].filter((t) => t.ok), w), no = measure(tagged[set].filter((t) => !t.ok), w); row[`${set}_${w}`] = { yn: yes.n, y: yes.avg, nn: no.n, no: no.avg }; }
    info.push(row);
  }
  const size = (tr) => { const w = tr.map((t) => (t.ok ? 1.5 : 0.5)), m = sum(w) / w.length; return tr.map((t, i) => ({ ...t, w: w[i] / m })); };
  const sl = size(tag(baseTr.live, f)), r = evaluate(sl, size(tag(pool(LIVE, {}, 2), f)), size(tag(baseTr.wide, f)));
  tilt.push({ id: 'S' + id.slice(1), name: 'size 1.5/0.5 by ' + name, ...r, nb: [], ...judge(r, []) });
}

fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ end: END, live: LIVE, wide: WIDE, base, results, tilt, info }, null, 1));

// ---- 5. report
const f0 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2), f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3), pc = (v) => (v * 100).toFixed(0) + '%';
const md = [];
md.push('# Results: book ideas against BB-CORE v3', '', `Generated by \`node run.js\`. Candles to ${new Date(END * 1000).toISOString().slice(0, 10)}. LIVE = ${LIVE.join(' ')}; WIDE = ${WIDE.length} other coins.`,
  `Parity with the intel engine: ${compared} trades, ${diff} different. Truncation audit: ${aud} trades, ${audBad} failing runs.`, '',
  'Rules (PLAN.md): 1 R/DD better IS+OOS · 2 Sharpe better IS+OOS · 3 R >= 80% IS+OOS · 4 R/DD better at 2x cost · 5 WIDE avg R better IS+OOS · 6 neighbours pass rule 1. `y` pass, `.` fail, `-` no neighbour.', '');
const head = '| Id | Change | Trades | Total R | Max DD | R/DD | R/DD IS / OOS | Sharpe IS / OOS | R IS / OOS | ex-top10 | 2x R/DD | WIDE avg R IS / OOS | Rules 123456 | luck p |';
const row = (id, name, r, rules, p) => `| ${id} | ${name} | ${r.live.all.n} | ${f0(r.live.all.R)} | ${f1(r.live.all.dd)} | ${f1(r.live.all.rdd)} | ${f1(r.live.is.rdd)} / ${f1(r.live.oos.rdd)} | ${f2(r.live.is.sharpe)} / ${f2(r.live.oos.sharpe)} | ${f0(r.live.is.R)} / ${f0(r.live.oos.R)} | ${f0(r.live.all.ex10)} | ${f1(r.live2.rdd)} | ${f3(r.wide.is.avg)} / ${f3(r.wide.oos.avg)} | ${rules} | ${p == null ? '' : f3(p).slice(1)} |`;
const rs = (a) => (a ? a.map((v) => (v === null ? '-' : v ? 'y' : '.')).join('') : '');
const table = (title, list) => { md.push(`## ${title}`, '', head, '|' + '---|'.repeat(14), row('BASE', 'BB-CORE v3', base, '', null)); for (const r of list) md.push(row(r.id, r.name, r, rs(r.rules) + (r.pass ? ' **PASS**' : ''), r.luck)); md.push(''); };
table('Candidates', results);
table('Size tilt (same trades, more risk when confirmed)', tilt);
md.push('## Neighbour settings', '', head, '|' + '---|'.repeat(14));
for (const r of results) for (const x of r.nb) md.push(row(r.id + ' ' + x.k, r.name, x.res, rule1(x.res.live) ? 'rule 1 y' : 'rule 1 .', null));
md.push('', '## Does the condition separate good trades from bad? (baseline trades, avg R: condition true / false)', '', '| Id | Condition | LIVE IS | LIVE OOS | WIDE IS | WIDE OOS |', '|---|---|---|---|---|---|');
const cell = (c) => `${f2(c.y)} (${c.yn}) / ${f2(c.no)} (${c.nn})`;
for (const r of info) md.push(`| ${r.id} | ${r.name} | ${cell(r.live_is)} | ${cell(r.live_oos)} | ${cell(r.wide_is)} | ${cell(r.wide_oos)} |`);
const yrs = Object.keys(base.years);
md.push('', '## Per year, LIVE total R', '', `| Id | ${yrs.join(' | ')} |`, '|' + '---|'.repeat(yrs.length + 1));
for (const r of [{ id: 'BASE', years: base.years }, ...results, ...tilt]) md.push(`| ${r.id} | ${yrs.map((y) => f0(r.years[y] || 0)).join(' | ')} |`);
md.push('', '## Per coin, LIVE total R', '', `| Id | ${LIVE.join(' | ')} |`, '|' + '---|'.repeat(LIVE.length + 1));
for (const r of [{ id: 'BASE', coins: base.coins }, ...results, ...tilt]) md.push(`| ${r.id} | ${LIVE.map((c) => f0(r.coins[c])).join(' | ')} |`);
md.push('', '## Baseline detail', '', '| Set / window | Trades | Total R | Avg R | Win | Max DD | R/DD | Sharpe | Losing months | Longest losing run |', '|---|---|---|---|---|---|---|---|---|---|');
for (const s of ['live', 'wide']) for (const w of Object.keys(WIN)) { const m = base[s][w]; md.push(`| ${s} ${w} | ${m.n} | ${f0(m.R)} | ${f3(m.avg)} | ${pc(m.wr)} | ${f1(m.dd)} | ${f1(m.rdd)} | ${f2(m.sharpe)} | ${pc(m.loseM)} | ${m.ls} |`); }
fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), md.join('\n') + '\n');
console.log('passes:', [...results, ...tilt].filter((r) => r.pass).map((r) => r.id).join(' ') || 'none');
