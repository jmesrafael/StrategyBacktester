// stress.js - stress tests of the crowded-side sizing rule against plain TRI-CORE, on causal.js.
// Usage: node --max-old-space-size=8192 stress.js > stress.out 2>&1        (QUICK=1: tiny subset, writes nothing to disk)
'use strict';
const fs = require('fs'), path = require('path');
const X = require('./causal');
const QUICK = !!process.env.QUICK;

const VERS = { TRI: { K: 1, rule: null }, R100: { K: 1, rule: X.RULE }, R105: { K: 1.05, rule: X.RULE }, R111: { K: 1.11, rule: X.RULE } };
const ACC = { A: { mode: 'flat', start: 1000 }, B: { mode: 'live', start: 600, cap: 500 } };
const PER = { full: {}, '24-26': { from: X.CUT } };
const OUT = { generated: new Date().toISOString(), rows: [], seeds: {}, bootstrap: null, unseen: null, errors: [] };
const pc = (v) => (v * 100).toFixed(2) + '%';
const verdict = (v, t) => { const r = v.cagr > t.cagr, f = v.dd < t.dd; return r && f ? 'both better' : r ? 'return only' : f ? 'fall only' : 'neither'; };

// causal.js crashes with delayH > 0: a stop can close a trade while its delayed time exit is still pending, and the pending
// exit is not cleared. For the delay tests only, the engine is compiled IN MEMORY with that one line fixed (the file is untouched).
function patchedEngine() {
  const Module = require('module'), file = path.join(__dirname, 'causal.js'), src = fs.readFileSync(file, 'utf8');
  const a = 'if (!p.phantom) trades.push(tr); s.pos = null;';
  if (src.split(a).length !== 2) throw new Error('patch anchor not found exactly once');
  const m = new Module(file, module); m.filename = file; m.paths = Module._nodeModulePaths(__dirname);
  m._compile(src.replace(a, a + ' s.pendExit = null;'), file);
  return m.exports;
}
const XP = patchedEngine();

function one(ver, acc, per, extra = {}) {
  const { engine = X, ...ex } = extra;
  const o = { ...ACC[acc], ...PER[per], K: ver.K, rule: ver.rule, ...ex };
  const r = engine.run(o), s = engine.stats(r);
  return { cagr: s.cagr, dd: s.dd, end: s.end, trades: r.trades.length, stat: r.stat, r };
}
function emit(test, acc, per, name, m, tri) {
  const row = { test, acc, per, ver: name, cagr: m.cagr, dd: m.dd, end: m.end, trades: m.trades, verdict: tri ? verdict(m, tri) : null };
  OUT.rows.push(row);
  console.log(`${test} | ${acc} | ${per} | ${name} | cagr ${pc(m.cagr)} | fall ${pc(m.dd)} | trades ${m.trades}${row.verdict ? ' | vs TRI: ' + row.verdict : ''}`);
  return row;
}
// one stress case: every version x account x period; extraFor(ver) returns the run options of this stress
function test(label, extraFor, { accs = ['A', 'B'], pers = ['full', '24-26'], vers = Object.keys(VERS) } = {}) {
  for (const a of accs) for (const p of pers) {
    let tri = null;
    for (const v of vers) {
      const m = one(VERS[v], a, p, extraFor(VERS[v]));
      emit(label, a, p, v, m, v === 'TRI' ? null : tri);
      if (v === 'TRI') tri = m;
    }
  }
}
function guard(name, fn) {
  const t = Date.now();
  try { fn(); } catch (e) { OUT.errors.push({ name, error: String((e && e.stack) || e) }); console.log(`ERROR in ${name}: ${(e && e.stack) || e}`); }
  console.log(`# ${name} done in ${((Date.now() - t) / 1000).toFixed(1)} s`);
  if (!QUICK) fs.writeFileSync(path.join(__dirname, 'stress.json'), JSON.stringify(OUT, null, 1));
}
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

// 1-6, 8-11
const SIMPLE = [
  ['01 baseline', {}], ['02 cost x2', { cost: 2 }], ['03 cost x3', { cost: 3 }], ['04 extraSlip 0.001', { extraSlip: 0.001 }],
  ['05 delayH 1', { delayH: 1, engine: XP }], ['06 delayH 2', { delayH: 2, engine: XP }], ['08 order reverse', { order: 'reverse' }], ['09 order alpha', { order: 'alpha' }],
  ['10 countClosing', { countClosing: true }], ['11 research conventions', { hourStops: false, exitAtClose: true, phantom: true, order: 'alpha' }],
];
guard('00 patch parity', () => {
  for (const a of ['A', 'B']) for (const p of ['full', '24-26']) for (const v of ['TRI', 'R111']) {
    const x = one(VERS[v], a, p), y = one(VERS[v], a, p, { engine: XP }), same = x.cagr === y.cagr && x.dd === y.dd && x.trades === y.trades;
    console.log(`00 patch parity at delay 0 | ${a} | ${p} | ${v} | identical ${same}`);
    if (!same) OUT.errors.push({ name: `00 parity ${a} ${p} ${v}`, error: 'patched engine differs at delay 0' });
  }
});
for (const [label, ex] of QUICK ? SIMPLE.filter((x) => /^0[156]/.test(x[0])) : SIMPLE) guard(label, () => test(label, () => ex));

// 7. random missed signals. 7a = the engine's miss option; 7b = same idea, but the miss is a hash of (seed, signal), so every
// version misses exactly the same signals even when their trade paths differ (the engine draws in query order, which can drift in B).
const hash01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function missTest(label, extraFor) {
  const seeds = Array.from({ length: QUICK ? 2 : 20 }, (_, k) => 1009 + 7919 * k);
  for (const a of ['A', 'B']) for (const p of ['full', '24-26']) {
    const res = {}; for (const v in VERS) res[v] = [];
    for (const seed of seeds) for (const v in VERS) {
      const m = one(VERS[v], a, p, extraFor(VERS[v], seed));
      res[v].push({ seed, cagr: m.cagr, dd: m.dd, trades: m.trades, missed: m.stat.missed });
      console.log(`${label} seed ${seed} | ${a} | ${p} | ${v} | cagr ${pc(m.cagr)} | fall ${pc(m.dd)} | trades ${m.trades}${v === 'TRI' ? '' : ' | vs TRI: ' + verdict(m, res.TRI[res.TRI.length - 1])}`);
    }
    const med = {}; for (const v in VERS) med[v] = { cagr: median(res[v].map((x) => x.cagr)), dd: median(res[v].map((x) => x.dd)), trades: median(res[v].map((x) => x.trades)) };
    for (const v in VERS) {
      const row = emit(`${label} median`, a, p, v, med[v], v === 'TRI' ? null : med.TRI);
      if (v !== 'TRI') {
        const vd = res[v].map((x, i) => verdict(x, res.TRI[i])), share = {};
        for (const k of ['both better', 'return only', 'fall only', 'neither']) share[k] = vd.filter((x) => x === k).length / vd.length;
        row.seedShare = share;
        console.log(`${label} share | ${a} | ${p} | ${v} | both ${pc(share['both better'])} | return only ${pc(share['return only'])} | fall only ${pc(share['fall only'])} | neither ${pc(share.neither)}`);
      }
    }
    OUT.seeds[`${label}|${a}|${p}`] = res;
  }
}
guard('07 miss 0.1', () => missTest('07 miss 0.1', (ver, seed) => ({ miss: 0.1, seed })));
guard('07b miss 0.1 paired', () => missTest('07b miss 0.1 paired', (ver, seed) => ({
  sizeFn: ({ bot, coin, t, N }) => (hash01(`${seed}|${bot}|${coin}|${t}`) < 0.1 ? 0 : ver.rule ? ver.rule(N) : 1),
})));

// 12. threshold neighbours
guard('12 neighbours', () => {
  const NB = [[1, 3, 0.25], [3, 3, 0.25], [2, 5, 0.25], [2, 3, 0.5], [2, 2, 0.25], [2, 4, 0.25]];
  for (const a of ['A', 'B']) for (const p of ['full', '24-26']) {
    const tri = one(VERS.TRI, a, p); emit('12 neighbours', a, p, 'TRI', tri);
    for (const nb of QUICK ? NB.slice(0, 1) : NB) for (const K of [1.11, 1.05]) {
      const m = one({ K, rule: X.ruleOf(...nb) }, a, p);
      emit('12 neighbours', a, p, `ruleOf(${nb.join(',')}) K${K}`, m, tri);
    }
  }
});

// 13. drop each coin
guard('13 drop coin', () => {
  for (const coin of QUICK ? ['SOL'] : ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB', 'ETH', 'SUI']) {
    const coins = {}; for (const b in X.COINS) coins[b] = X.COINS[b].filter((c) => c !== coin);
    test(`13 drop ${coin}`, () => ({ coins }), { pers: ['full'], vers: ['TRI', 'R105', 'R111'] });
  }
});

// 14. drop the best trades
guard('14 drop best', () => {
  const base = X.run({ ...ACC.A });
  const ranked = [...base.trades].sort((a, b) => b.pnl / b.target - a.pnl / a.target);
  OUT.dropped = ranked.slice(0, 25).map((t) => ({ bot: t.bot, coin: t.coin, sigT: t.sigT, date: new Date(t.sigT * 1000).toISOString(), dir: t.dir, N: t.N, pnlOverTarget: t.pnl / t.target }));
  OUT.dropped.forEach((d, i) => console.log(`14 best #${i + 1} | ${d.bot} ${d.coin} ${d.date} dir ${d.dir} N ${d.N} | pnl/target ${d.pnlOverTarget.toFixed(2)}`));
  for (const n of QUICK ? [10] : [10, 25]) {
    const keys = new Set(ranked.slice(0, n).map((t) => `${t.bot}|${t.coin}|${t.sigT}`));
    const hit = {};
    test(`14 drop best ${n}`, (ver) => ({
      K: 1, rule: null,
      sizeFn: ({ bot, coin, t, N }) => { const k = `${bot}|${coin}|${t - 14400}`; if (keys.has(k)) { hit[k] = 1; return 0; } return ver.rule ? ver.K * ver.rule(N) : 1; },
    }));
    console.log(`14 drop best ${n}: keys matched in the reruns ${Object.keys(hit).length}/${keys.size}`);
    if (Object.keys(hit).length !== keys.size) OUT.errors.push({ name: `14 drop best ${n}`, error: `only ${Object.keys(hit).length}/${keys.size} keys matched` });
  }
  // check: the sizeFn route with nothing dropped must equal the plain rule/K route
  for (const a of ['A', 'B']) {
    const p = one(VERS.R111, a, 'full'), q = one(VERS.R111, a, 'full', { K: 1, rule: null, sizeFn: ({ N }) => 1.11 * X.RULE(N) });
    console.log(`14 check sizeFn parity | ${a} | rule route cagr ${pc(p.cagr)} fall ${pc(p.dd)} | sizeFn route cagr ${pc(q.cagr)} fall ${pc(q.dd)}`);
    if (Math.abs(p.cagr - q.cagr) > 1e-9 || Math.abs(p.dd - q.dd) > 1e-9) OUT.errors.push({ name: '14 parity ' + a, error: 'sizeFn route differs from rule route' });
  }
});

// 15. block bootstrap on monthly log returns, account A, full period
guard('15 bootstrap', () => {
  const monthly = (r) => { // month-end marks: the last curve value at or before 00:00 of the next month (the last month is partial)
    const ends = new Map();
    for (let k = 0; k < r.curve.length; k += 2) { const d = new Date((r.curve[k] - 1) * 1000), m = d.getUTCFullYear() * 12 + d.getUTCMonth(); if (r.curve[k] > r.from) ends.set(m, r.curve[k + 1]); }
    let prev = r.start; const keys = [...ends.keys()].sort((a, b) => a - b);
    return { keys, ret: keys.map((m) => { const v = ends.get(m), x = Math.log(v / prev); prev = v; return x; }) };
  };
  const M = {}, runs = {};
  for (const v of ['TRI', 'R105', 'R111']) { runs[v] = one(VERS[v], 'A', 'full').r; M[v] = monthly(runs[v]); }
  const n = M.TRI.ret.length;
  for (const v in M) if (M[v].keys.join() !== M.TRI.keys.join() || M[v].ret.some((x) => !Number.isFinite(x))) throw new Error('months differ or non-finite return for ' + v);
  const years = (X.END - X.T0) / (365.25 * 86400);
  let s = 20261127; const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const path_ = (ret, idx) => { let l = 0, pk = 0, dd = 0; for (const i of idx) { l += ret[i]; if (l > pk) pk = l; else dd = Math.max(dd, 1 - Math.exp(l - pk)); } return { end: Math.exp(l), cagr: Math.exp(l / years) - 1, dd }; };
  const draws = [];
  for (let k = 0; k < 1000; k++) {
    const idx = []; while (idx.length < n) { const b = Math.floor(rnd() * (n - 2)); idx.push(b, b + 1, b + 2); } idx.length = n;
    draws.push({ TRI: path_(M.TRI.ret, idx), R105: path_(M.R105.ret, idx), R111: path_(M.R111.ret, idx) });
  }
  OUT.bootstrap = { months: n, years, draws: draws.length, versions: {} };
  const all = Array.from({ length: n }, (_, i) => i);
  for (const v of ['TRI', 'R105', 'R111']) { const p = path_(M[v].ret, all); console.log(`15 actual monthly path | ${v} | cagr ${pc(p.cagr)} | monthly worst fall ${pc(p.dd)}`); }
  for (const v of ['R105', 'R111']) {
    const share = (f) => draws.filter(f).length / draws.length;
    const b = {
      both: share((d) => d[v].end > d.TRI.end && d[v].dd < d.TRI.dd),
      higherEnd: share((d) => d[v].end > d.TRI.end), smallerFall: share((d) => d[v].dd < d.TRI.dd),
      neither: share((d) => !(d[v].end > d.TRI.end) && !(d[v].dd < d.TRI.dd)),
      medCagrDiff: median(draws.map((d) => d[v].cagr - d.TRI.cagr)), medDdDiff: median(draws.map((d) => d[v].dd - d.TRI.dd)),
      medEndRatio: median(draws.map((d) => d[v].end / d.TRI.end)),
      medCagr: median(draws.map((d) => d[v].cagr)), medCagrTRI: median(draws.map((d) => d.TRI.cagr)),
      medDd: median(draws.map((d) => d[v].dd)), medDdTRI: median(draws.map((d) => d.TRI.dd)),
    };
    OUT.bootstrap.versions[v] = b;
    console.log(`15 bootstrap | ${v} | months ${n} | both ${pc(b.both)} | higher end ${pc(b.higherEnd)} | smaller fall ${pc(b.smallerFall)} | neither ${pc(b.neither)} | median cagr diff ${pc(b.medCagrDiff)} | median fall diff ${pc(b.medDdDiff)} | median end ratio ${b.medEndRatio.toFixed(3)}`);
  }
});

// 16. the window after the research end
guard('16 unseen', () => {
  const from = Date.UTC(2026, 10, 24) / 1000, to = Date.UTC(2026, 10, 25, 6) / 1000, iso = (t) => new Date(t * 1000).toISOString();
  const data = {};
  for (const c of [...new Set(Object.values(X.COINS).flat())]) {
    const R = X.raw(c), e = (a, tf) => a[a.length - 1][0] + tf;
    data[c] = { last1hClose: iso(e(R.h1, 3600)), last4hClose: iso(e(R.h4, 14400)), lastFunding: iso(R.f[R.f.length - 1][0]), h1After: R.h1.filter((x) => x[0] >= from && x[0] + 3600 <= to).length, h4After: R.h4.filter((x) => x[0] >= from && x[0] + 14400 <= to).length, t1: e(R.h1, 3600), t4: e(R.h4, 14400) };
    console.log(`16 data | ${c} | last 1h close ${data[c].last1hClose} | last 4h close ${data[c].last4hClose} | 1h bars in window ${data[c].h1After} | 4h bars in window ${data[c].h4After}`);
  }
  const covered = Math.max(0, (Math.min(to, Math.max(...Object.values(data).map((d) => d.t1))) - from) / 3600);
  OUT.unseen = { from: iso(from), to: iso(to), windowHours: (to - from) / 3600, hoursWithData: covered, data, runs: {} };
  console.log(`16 window ${iso(from)} -> ${iso(to)} = ${(to - from) / 3600} h; hours with any 1h data: ${covered}`);
  for (const v of ['TRI', 'R111']) {
    const log = [], r = X.run({ ...ACC.B, from, to, K: VERS[v].K, rule: VERS[v].rule, log });
    const events = log.filter((l) => { const a = l.split(' '); return +a[0] >= from && a[1] !== 'E'; }).map((l) => { const a = l.split(' '); return iso(+a[0]) + ' ' + a.slice(1).join(' '); });
    const s = X.stats(r);
    OUT.unseen.runs[v] = { stat: r.stat, trades: r.trades, open: r.open, events, start: r.start, end: s.end, dd: s.dd };
    console.log(`16 ${v} | B | closed trades ${r.trades.length} | open ${r.open.length} | stat ${JSON.stringify(r.stat)} | end ${s.end} | fall ${pc(s.dd || 0)}`);
    events.forEach((e) => console.log(`16 ${v} event | ${e}`));
    r.trades.forEach((t) => console.log(`16 ${v} trade | ${JSON.stringify(t)}`));
    r.open.forEach((t) => console.log(`16 ${v} open | ${JSON.stringify(t)}`));
  }
});

// summary table: verdicts of R100 / R105 / R111 against TRI
console.log('\n# SUMMARY (verdict vs TRI)');
const S = new Map();
for (const r of OUT.rows) { if (!r.verdict || r.test.startsWith('12')) continue; const k = `${r.test} | ${r.acc} | ${r.per}`; if (!S.has(k)) S.set(k, {}); S.get(k)[r.ver] = r.verdict; }
for (const [k, v] of S) console.log(`SUM | ${k} | ${Object.entries(v).map(([a, b]) => a + ': ' + b).join(' | ')}`);
console.log(`errors: ${OUT.errors.length}`);
if (!QUICK) fs.writeFileSync(path.join(__dirname, 'stress.json'), JSON.stringify(OUT, null, 1));
