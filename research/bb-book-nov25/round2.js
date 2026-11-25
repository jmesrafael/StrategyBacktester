// round2.js: POST-HOC follow-up. These ideas were chosen AFTER seeing round 1 (including 2024-26), so passing here is
// weaker evidence than in PLAN.md. Sizing only: every BB-CORE trade is kept, the risk per trade changes.
//   node round2.js -> ROUND2.md
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./engine');
const C = require('../../candles/candles.js');
const { COND } = L;
const LIVE = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'], WIDE = C.coins().filter((c) => !LIVE.includes(c));
const T0 = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000, END = L.END;
const WIN = { all: [T0, END], is: [T0, SPLIT], oos: [SPLIT, END] };
const X = Object.fromEntries([...LIVE, ...WIDE].map((c) => [c, L.load(c)]));
const sum = (a) => a.reduce((s, v) => s + v, 0);
const pool = (coins, cost = 1) => coins.flatMap((c) => L.run(X[c], {}, cost)).filter((t) => t.tExit > T0).sort((a, b) => a.tExit - b.tExit || a.t - b.t);
const base = { live: pool(LIVE), live2: pool(LIVE, 2), wide: pool(WIDE) };
const tag = (tr, f) => { const k = {}; return tr.map((t) => (k[t.c] ||= f(X[t.c], L.BASE))(t.sig, t.dir)); };
const monthKeys = []; for (let d = new Date(T0 * 1000); d.getTime() / 1000 < END; d.setUTCMonth(d.getUTCMonth() + 1, 1)) monthKeys.push(d.toISOString().slice(0, 7));
const monthIx = Object.fromEntries(monthKeys.map((k, i) => [k, i]));
const mix = (t) => monthIx[new Date((t.tExit - 1) * 1000).toISOString().slice(0, 7)];
const sharpeOf = (mv) => { const m = sum(mv) / mv.length, sd = Math.sqrt(sum(mv.map((v) => (v - m) ** 2)) / (mv.length - 1)); return sd > 0 ? (m / sd) * Math.sqrt(12) : 0; };
const monthly = (tr, w) => { const mv = new Array(monthKeys.length).fill(0); tr.forEach((t, i) => (mv[mix(t)] += t.R * w[i])); return mv; };
function measure(tr, w, win) {
  const [a, b] = WIN[win]; let e = 0, pk = 0, dd = 0; const R = [], mv = {};
  for (const k of monthKeys) { const t = Date.parse(k + '-01') / 1000; if (t >= a && t < b) mv[k] = 0; }
  tr.forEach((q, i) => { if (q.tExit <= a || q.tExit > b) return; const r = q.R * w[i]; R.push(r); e += r; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); mv[monthKeys[mix(q)]] += r; });
  return { n: R.length, R: e, avg: e / R.length, dd, rdd: e / dd, sharpe: sharpeOf(Object.values(mv)), ex10: e - sum([...R].sort((p, q) => q - p).slice(0, 10)) };
}
const weights = (flags, hi, lo) => { const w = flags.map((f) => (f ? hi : lo)), m = sum(w) / w.length; return w.map((v) => v / m); };
let seed = 7; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

const IDEAS = [
  ['R1', 'double risk after a 6-month squeeze', COND.squeeze(1095, 20), 2, 1, [['N=500', COND.squeeze(500, 20)], ['N=750', COND.squeeze(750, 20)], ['N=1500', COND.squeeze(1500, 20)], ['K=10', COND.squeeze(1095, 10)], ['K=40', COND.squeeze(1095, 40)]]],
  ['R2', 'half-size when RSI(10) already past 70/30 (1.5 otherwise)', COND.rsi(70), 0.5, 1.5, [['65/35', COND.rsi(65)], ['75/25', COND.rsi(75)]]],
  ['R3', 'half-size when MFI(10) already past 80/20 (1.5 otherwise)', COND.mfi(80), 0.5, 1.5, [['75/25', COND.mfi(75)], ['70/30', COND.mfi(70)]]],
];
const one = base.live.map(() => 1), one2 = base.live2.map(() => 1), oneW = base.wide.map(() => 1);
const B = { is: measure(base.live, one, 'is'), oos: measure(base.live, one, 'oos'), all: measure(base.live, one, 'all'), two: measure(base.live2, one2, 'all'),
  wis: measure(base.wide, oneW, 'is'), wos: measure(base.wide, oneW, 'oos'), wall: measure(base.wide, oneW, 'all') };
const f0 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2), f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3), pc = (v) => (v * 100).toFixed(0) + '%';
const md = ['# Round 2 (post-hoc): sizing ideas suggested by round 1', '',
  'Chosen after seeing round 1, **including 2024-26**, so this is weaker evidence than a pre-registered test. Same trades as BB-CORE v3; only the risk per trade changes, rescaled to the same average risk.', ''];
const head = ['| Version | Total R | Max DD | R/DD | R/DD IS / OOS | Sharpe IS / OOS | ex-top10 | 2x R/DD | WIDE R/DD IS / OOS | WIDE Sharpe IS / OOS | Rules 1245 |', '|' + '---|'.repeat(11)];
const line = (name, live, live2, wide, rules) => `| ${name} | ${f0(live.all.R)} | ${f1(live.all.dd)} | ${f1(live.all.rdd)} | ${f1(live.is.rdd)} / ${f1(live.oos.rdd)} | ${f2(live.is.sharpe)} / ${f2(live.oos.sharpe)} | ${f0(live.all.ex10)} | ${f1(live2.rdd)} | ${f1(wide.is.rdd)} / ${f1(wide.oos.rdd)} | ${f2(wide.is.sharpe)} / ${f2(wide.oos.sharpe)} | ${rules} |`;
const baseRow = line('BB-CORE v3', B, B.two, { is: B.wis, oos: B.wos }, '');

for (const [id, name, f, hi, lo, nbs] of IDEAS) {
  const ev = (g) => {
    const fl = tag(base.live, g), fl2 = tag(base.live2, g), flW = tag(base.wide, g), w = weights(fl, hi, lo), w2 = weights(fl2, hi, lo), wW = weights(flW, hi, lo);
    const live = Object.fromEntries(Object.keys(WIN).map((k) => [k, measure(base.live, w, k)])), live2 = measure(base.live2, w2, 'all'), wide = Object.fromEntries(Object.keys(WIN).map((k) => [k, measure(base.wide, wW, k)]));
    const r = [live.is.rdd > B.is.rdd && live.oos.rdd > B.oos.rdd, live.is.sharpe > B.is.sharpe && live.oos.sharpe > B.oos.sharpe, live2.rdd > B.two.rdd,
      wide.is.avg > B.wis.avg && wide.oos.avg > B.wos.avg];
    return { fl, flW, w, wW, live, live2, wide, r: r.map((v) => (v ? 'y' : '.')).join('') };
  };
  const m = ev(f);
  md.push(`## ${id}: ${name}`, '', ...head, baseRow, line(id, m.live, m.live2, m.wide, m.r));
  for (const [k, g] of nbs) { const n = ev(g); md.push(line(`${id} ${k}`, n.live, n.live2, n.wide, n.r)); }
  // luck control: the same number of flagged trades, picked at random
  const flagged = m.fl.filter(Boolean).length; let bR = 0, bS = 0; const N = 4000;
  for (let q = 0; q < N; q++) { const ix = base.live.map((_, i) => i); const fl = new Array(ix.length).fill(false); for (let i = 0; i < flagged; i++) { const j = i + Math.floor(rnd() * (ix.length - i)); const v = ix[j]; ix[j] = ix[i]; ix[i] = v; fl[v] = true; } const w = weights(fl, hi, lo), x = measure(base.live, w, 'all'); if (x.rdd >= m.live.all.rdd) bR++; if (x.sharpe >= m.live.all.sharpe) bS++; }
  // 3-month block bootstrap of the months: how often is the tilted version's Sharpe higher than the baseline's?
  const a = monthly(base.live, m.w), b = monthly(base.live, one); let win = 0;
  for (let q = 0; q < N; q++) { const A = [], Bm = []; while (A.length < a.length) { const s = Math.floor(rnd() * (a.length - 2)); for (let k = 0; k < 3; k++) { A.push(a[s + k]); Bm.push(b[s + k]); } } if (sharpeOf(A) > sharpeOf(Bm)) win++; }
  md.push('', `Flagged trades: ${flagged} of ${base.live.length} (LIVE), ${m.flW.filter(Boolean).length} of ${base.wide.length} (WIDE).`,
    `Random control (same number of trades flagged at random, ${N} draws): R/DD at least this good ${pc(bR / N)} of the time, Sharpe ${pc(bS / N)}.`,
    `Month-block bootstrap: Sharpe beats BB-CORE in ${pc(win / N)} of resampled histories (50% = coin toss).`, '');
  // detail of the flag itself on LIVE and WIDE
  md.push('| Set | Group | Trades | Avg R | Win | Avg R without its best 1% | Median stop distance |', '|---|---|---|---|---|---|---|');
  for (const [set, tr, fl] of [['LIVE', base.live, m.fl], ['WIDE', base.wide, m.flW]]) for (const yes of [true, false]) {
    const t = tr.filter((_, i) => fl[i] === yes), R = t.map((q) => q.R).sort((p, q) => q - p), k = Math.ceil(R.length * 0.01);
    const dist = t.map((q) => { const x = X[q.c]; let s = 0; for (let j = q.sig - 19; j <= q.sig; j++) s += x.B[j].close; return Math.abs(x.B[q.sig].close - s / 20) / x.B[q.sig].close; }).sort((p, q) => p - q);
    md.push(`| ${set} | ${yes ? 'flagged' : 'rest'} | ${t.length} | ${f3(sum(R) / R.length)} | ${pc(R.filter((r) => r > 0).length / R.length)} | ${f3(sum(R.slice(k)) / (R.length - k))} | ${pc(dist[dist.length >> 1])} |`);
  }
  let better = 0, counted = 0; for (const c of WIDE) { const y = base.wide.filter((t, i) => t.c === c && m.flW[i]), n = base.wide.filter((t, i) => t.c === c && !m.flW[i]); if (y.length < 5 || n.length < 5) continue; counted++; if (sum(y.map((t) => t.R)) / y.length > sum(n.map((t) => t.R)) / n.length) better++; }
  md.push('', `WIDE coins where flagged trades average more R than the rest: ${better} of ${counted} (coins with 5+ trades in each group).`, '');
  const yr = (tr, w) => { const y = {}; tr.forEach((t, i) => { const k = new Date((t.tExit - 1) * 1000).getUTCFullYear(); y[k] = (y[k] || 0) + t.R * w[i]; }); return y; };
  const ya = yr(base.live, m.w), yb = yr(base.live, one);
  md.push('| LIVE R by year | ' + Object.keys(yb).join(' | ') + ' |', '|' + '---|'.repeat(Object.keys(yb).length + 1), '| BB-CORE v3 | ' + Object.values(yb).map(f0).join(' | ') + ' |', `| ${id} | ` + Object.keys(yb).map((k) => f0(ya[k] || 0)).join(' | ') + ' |', '');
  md.push('| Leave one coin out (R/DD all) | ' + LIVE.join(' | ') + ' |', '|' + '---|'.repeat(LIVE.length + 1));
  const loo = (w) => LIVE.map((c) => { const ix = base.live.map((t, i) => (t.c !== c ? i : -1)).filter((i) => i >= 0), t = ix.map((i) => base.live[i]), v = ix.map((i) => w[i]), mm = sum(v) / v.length; return f1(measure(t, v.map((q) => q / mm), 'all').rdd); });
  md.push('| BB-CORE v3 | ' + loo(one).join(' | ') + ' |', `| ${id} | ` + loo(m.w).join(' | ') + ' |', '');
}
fs.writeFileSync(path.join(__dirname, 'ROUND2.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
