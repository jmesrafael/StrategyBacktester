// walkforward.js - (1) walk-forward choice of the crowding rule "as if the future never happened"; (2) placebo search: how good
// does the same 2020-23 search look on 2024-26 when the crowding count N is randomly permuted within each bot?
// node --max-old-space-size=8192 walkforward.js > walkforward.out 2>&1
// env: TINY=1 (small smoke test), OUT=<json path>, WORKERS=<n>, WORLDS=<placebo worlds, default 40>
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const X = require('./causal');

const TINY = !!process.env.TINY;
const ts = (y) => Date.UTC(y, 0, 1) / 1000;
const YEARS = TINY ? [2022, 2023] : [2022, 2023, 2024, 2025, 2026];
const STEPS1 = TINY ? 3 : 14, STEPS2 = TINY ? 3 : 10, KLO = 0.3, KHI = 3;
const WORLDS = TINY ? 2 : +(process.env.WORLDS || 40);

// ------------------------------------------------------------------ candidates --------------------------------------------
const CAND = [];
for (const a of [1, 2, 3]) for (const len of [3, 5]) for (const f of [0.25, 0.5]) CAND.push({ name: `ramp a=${a} len=${len} f=${f}`, fam: 'ramp', rule: X.ruleOf(a, len, f) });
for (const n of [3, 4, 5, 6]) for (const m of [0, 0.25, 0.5, 0.75]) CAND.push({ name: `step N>=${n} -> ${m}`, fam: 'step', rule: (N) => (N >= n ? m : 1) });
for (const c of [0.1, 0.2, 0.3, 0.45, 0.6, 0.9]) CAND.push({ name: `smooth 1/(1+${c}N)`, fam: 'smooth', rule: (N) => 1 / (1 + c * N) });
const USE = TINY ? [CAND.findIndex((c) => c.name === 'ramp a=2 len=3 f=0.25'), 12, 28] : CAND.map((_, i) => i);
const NONE = -1;
const nameOf = (i) => (i === NONE ? 'no rule' : CAND[i].name);

// ------------------------------------------------------------------ helpers ------------------------------------------------
const flat = (o) => X.run({ mode: 'flat', start: 1000, ...o });
const brief = (s) => ({ ret: s.ret, cagr: s.cagr, dd: s.dd, end: s.end });
// largest K in [KLO, KHI] (bisection) whose worst fall over [from, to] is <= target; null if even KLO falls further
function fitK(opts, target, steps) {
  let lo = KLO, hi = KHI, best = null;
  for (let i = 0; i < steps; i++) { const m = (lo + hi) / 2, s = X.stats(flat({ ...opts, K: m })); if (s.dd <= target) { lo = m; best = { K: m, ...brief(s) }; } else hi = m; }
  if (!best) { const s = X.stats(flat({ ...opts, K: KLO })); if (s.dd <= target) best = { K: KLO, ...brief(s) }; }
  return best;
}
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

// ------------------------------------------------------------------ worker tasks -------------------------------------------
const TASKS = {
  train({ Y, c }) { // part 1: fit candidate c on [T0, Jan 1 Y] so its worst fall is no larger than no-rule's
    const per = { from: X.T0, to: ts(Y) }, base = brief(X.stats(flat(per)));
    if (c === NONE) return { Y, c, K: 1, ...base, baseDd: base.dd };
    const b = fitK({ ...per, rule: CAND[c].rule }, base.dd, STEPS1);
    return b ? { Y, c, ...b, baseDd: base.dd } : { Y, c, K: null, baseDd: base.dd };
  },
  oos({ acc, variant, picks }) { // one continuous run 2022 -> END
    const ao = acc === 'flat' ? { mode: 'flat', start: 1000 } : { mode: 'live', start: 600, cap: 500 };
    let vo = {};
    if (variant === 'walk-forward') {
      const by = new Map(picks.map((p) => [p.Y, p]));
      vo = { sizeFn: (ctx) => { const p = by.get(new Date(ctx.t * 1000).getUTCFullYear()) || (TINY ? picks[picks.length - 1] : null); if (!p) throw new Error('no pick for decision at ' + ctx.t); return p.c === NONE ? p.K : p.K * CAND[p.c].rule(ctx.N); } };
    } else if (variant === 'fixed x1.11') vo = { rule: X.RULE, K: 1.11 };
    else if (variant === 'fixed x1.05') vo = { rule: X.RULE, K: 1.05 };
    const r = X.run({ ...ao, ...vo, from: ts(2022), to: X.END });
    const years = [2022, 2023, 2024, 2025, 2026].map((y) => ({ y, ...brief(X.stats(r, ts(y), Math.min(ts(y + 1), r.to))) }));
    return { acc, variant, total: brief(X.stats(r)), years, trades: r.trades.length, stat: r.stat };
  },
  record() { // real N of every decision (no rule, so every signal is taken); the fresh 2024-26 run adds its own extra keys
    const rec = new Map(); let extra = 0;
    flat({ from: X.T0, to: X.END, sizeFn: (c) => { rec.set(`${c.bot}|${c.coin}|${c.t}`, [c.bot, c.N]); return 1; } });
    const full = rec.size;
    flat({ from: X.CUT, to: X.END, sizeFn: (c) => { const k = `${c.bot}|${c.coin}|${c.t}`; if (!rec.has(k)) { rec.set(k, [c.bot, c.N]); extra++; } return 1; } });
    return { rows: [...rec].map(([k, [bot, N]]) => [k, bot, N]), full, extra };
  },
  baseline() { // no-rule references for part 2
    const is = brief(X.stats(flat({ from: X.T0, to: X.CUT }))), oos = brief(X.stats(flat({ from: X.CUT, to: X.END })));
    const target = is.dd - 0.02, e = fitK({ from: X.T0, to: X.CUT }, target, STEPS2);
    return { is, oos, target, evenCut: e && { is: e, oos: brief(X.stats(flat({ from: X.CUT, to: X.END, K: e.K }))) } };
  },
  world({ w, target, rows }) { // part 2: the whole search in one world (w = -1: the real N)
    const look = { n: 0, miss: 0 };
    let opt = (rule) => ({ rule });
    if (w >= 0) {
      const rnd = mulberry(hash('placebo-world-' + w)), map = new Map(), pool = {};
      for (const bot of ['bb', 'ic', 'tc']) {
        const L = rows.filter((r) => r[1] === bot), v = L.map((r) => r[2]);
        for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; }
        L.forEach((r, i) => map.set(r[0], v[i])); pool[bot] = v;
      }
      // a decision that did not exist in the record (only after a size-0 rule skipped a trade) draws from the same bot's N values
      opt = (rule) => ({ sizeFn: (c) => { const k = `${c.bot}|${c.coin}|${c.t}`; let N = map.get(k); look.n++; if (N === undefined) { look.miss++; N = pool[c.bot][hash(w + '#' + k) % pool[c.bot].length]; } return rule(N); } });
    }
    const all = [];
    for (const c of USE) { const b = fitK({ ...opt(CAND[c].rule), from: X.T0, to: X.CUT }, target, STEPS2); all.push(b ? { c, ...b } : { c, K: null }); }
    const ok = all.filter((a) => a.K != null);
    if (!ok.length) throw new Error('no candidate reached the target in world ' + w);
    const best = ok.reduce((a, b) => (b.cagr > a.cagr ? b : a));
    const oos = brief(X.stats(flat({ ...opt(CAND[best.c].rule), K: best.K, from: X.CUT, to: X.END })));
    return { w, pick: best.c, name: nameOf(best.c), K: best.K, is: { cagr: best.cagr, dd: best.dd }, oos, eligible: ok.length, atUpperK: ok.filter((a) => a.K > KHI - 0.01).length, look, all: w < 0 ? all : undefined };
  },
};

if (!isMainThread) {
  parentPort.on('message', ({ id, type, args }) => parentPort.postMessage({ id, res: TASKS[type](args) }));
} else main().catch((e) => { console.error('FAILED', e && e.stack ? e.stack : e); process.exit(1); });

// ------------------------------------------------------------------ main ----------------------------------------------------
function makePool(n) {
  const queue = [], idle = [], waiting = new Map(); let seq = 0;
  const pump = () => { while (idle.length && queue.length) { const wk = idle.pop(), job = queue.shift(); waiting.set(job.id, job); wk.postMessage({ id: job.id, type: job.type, args: job.args }); } };
  const workers = Array.from({ length: n }, () => {
    const wk = new Worker(__filename, { resourceLimits: { maxOldGenerationSizeMb: 2048 } });
    wk.on('message', ({ id, res }) => { const job = waiting.get(id); waiting.delete(id); idle.push(wk); job.resolve(res); pump(); });
    wk.on('error', (e) => { console.error('WORKER ERROR', e.stack || e); process.exit(1); });
    wk.on('exit', (code) => { if (code && !wk.closing) { console.error('WORKER EXIT', code); process.exit(1); } });
    idle.push(wk); return wk;
  });
  return { exec: (type, args = {}) => new Promise((resolve) => { queue.push({ id: ++seq, type, args, resolve }); pump(); }), close: () => workers.forEach((w) => { w.closing = true; w.terminate(); }) };
}

async function main() {
  const t0 = Date.now(), el = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';
  const p = (v) => (100 * v).toFixed(1), sg = (v) => (v >= 0 ? '+' : '') + (100 * v).toFixed(1);
  const outFile = process.env.OUT || path.join(__dirname, TINY ? 'walkforward-tiny.json' : 'walkforward.json');
  const nW = +(process.env.WORKERS || Math.max(1, Math.min(4, os.cpus().length - 2, Math.floor(os.freemem() / 4.5e8))));
  console.log(`walkforward.js | ${TINY ? 'TINY TEST | ' : ''}workers ${nW} | candidates: ${USE.length} distinct rules + no rule (families: ramp 12, step 16, smooth 6; the picked rule X.RULE is ramp a=2 len=3 f=0.25)`);
  const pool = makePool(nW);
  const out = { settings: { YEARS, STEPS1, STEPS2, KLO, KHI, WORLDS, rules: USE.map(nameOf), TINY }, part1: {}, part2: {} };
  const save = () => fs.writeFileSync(outFile, JSON.stringify(out, null, 1));

  // PART 1
  const cands = [NONE, ...USE];
  out.part1.picks = []; out.part1.training = {};
  for (const Y of YEARS) {
    const res = await Promise.all(cands.map((c) => pool.exec('train', { Y, c })));
    const ok = res.filter((r) => r.K != null), ranked = [...ok].sort((a, b) => b.cagr - a.cagr), best = ranked[0];
    const none = res.find((r) => r.c === NONE), fixed = CAND.findIndex((c) => c.name === 'ramp a=2 len=3 f=0.25'), rk = ranked.findIndex((r) => r.c === fixed);
    const pick = { Y, c: best.c, name: nameOf(best.c), K: best.K, trainCagr: best.cagr, trainDd: best.dd, noRuleCagr: none.cagr, noRuleDd: none.dd, eligible: ok.length, atUpperK: ok.filter((r) => r.K > KHI - 0.01).length, xruleRank: rk + 1, xruleK: rk >= 0 ? ranked[rk].K : null, xruleCagr: rk >= 0 ? ranked[rk].cagr : null, runnersUp: ranked.slice(1, 4).map((r) => ({ name: nameOf(r.c), K: r.K, cagr: r.cagr })) };
    out.part1.picks.push(pick); out.part1.training[Y] = res.map((r) => ({ ...r, name: nameOf(r.c) })); save();
    console.log(`[${el()}] test ${Y} | train 2020-${Y - 1} | pick ${pick.name} K ${pick.K.toFixed(3)} | train ${p(pick.trainCagr)}%/yr fall ${p(pick.trainDd)} vs no rule ${p(none.cagr)}%/yr fall ${p(none.dd)} | eligible ${ok.length}/${cands.length} | X.RULE rank ${pick.xruleRank} (K ${pick.xruleK && pick.xruleK.toFixed(3)})`);
  }
  const picks = out.part1.picks.map(({ Y, c, K }) => ({ Y, c, K }));
  const VARS = ['no rule', 'walk-forward', 'fixed x1.11', 'fixed x1.05'];
  const oos = await Promise.all(['flat', 'live'].flatMap((acc) => VARS.map((variant) => pool.exec('oos', { acc, variant, picks }))));
  out.part1.oos = oos; save();
  for (const acc of ['flat', 'live']) {
    console.log(`\nOUT OF SAMPLE 2022-01-01 -> 2026-11-24, ${acc === 'flat' ? 'flat account (US$1,000, 2.5% risk)' : 'live account (US$600, US$500 risk cap)'}`);
    for (const r of oos.filter((x) => x.acc === acc)) console.log(`  ${r.variant.padEnd(13)} total ${p(r.total.ret).padStart(11)}% | cagr ${p(r.total.cagr).padStart(6)}% | worst fall ${p(r.total.dd)} | end US$ ${Math.round(r.total.end).toLocaleString('en-US')} | trades ${r.trades} skipped min/margin ${r.stat.skipMin}/${r.stat.skipMargin} | years (return/fall) ${r.years.map((y) => `${y.y} ${p(y.ret)}/${p(y.dd)}`).join('  ')}`);
  }

  // PART 2
  console.log(`\n[${el()}] part 2: recording decisions`);
  const rec = await pool.exec('record'), base = await pool.exec('baseline');
  const hist = {}; for (const [, bot, N] of rec.rows) { (hist[bot] || (hist[bot] = {}))[N] = (hist[bot][N] || 0) + 1; }
  out.part2.record = { decisions: rec.rows.length, fromFullRun: rec.full, extraFromFresh2024: rec.extra, nHistogram: hist }; out.part2.baseline = base; save();
  console.log(`[${el()}] decisions ${rec.rows.length} (full run ${rec.full}, extra keys from the fresh 2024-26 run ${rec.extra}) N histogram ${JSON.stringify(hist)}`);
  console.log(`no rule 2020-23 ${p(base.is.cagr)}%/yr fall ${p(base.is.dd)} -> target fall ${p(base.target)} | no rule 2024-26 ${p(base.oos.cagr)}%/yr fall ${p(base.oos.dd)}`);
  let done = 0;
  const job = (w) => pool.exec('world', { w, target: base.target, rows: w >= 0 ? rec.rows : null }).then((r) => {
    r.dCagr = r.oos.cagr - base.oos.cagr; r.dDd = r.oos.dd - base.oos.dd; done++;
    console.log(`[${el()}] ${done}/${WORLDS + 1} ${w < 0 ? 'REAL    ' : 'placebo ' + String(w).padStart(2)} pick ${r.name.padEnd(22)} K ${r.K.toFixed(3)} | 2020-23 ${p(r.is.cagr)}%/yr fall ${p(r.is.dd)} | 2024-26 ${p(r.oos.cagr)}%/yr fall ${p(r.oos.dd)} | vs no rule cagr ${sg(r.dCagr)} dd ${sg(r.dDd)} pts | fallback ${r.look.miss}/${r.look.n}`);
    if (w < 0) out.part2.real = r; else (out.part2.placebo || (out.part2.placebo = [])).push(r);
    save(); return r;
  });
  const res = await Promise.all([-1, ...Array.from({ length: WORLDS }, (_, i) => i)].map(job));
  const real = res[0], pl = res.slice(1); out.part2.placebo = pl;
  const q = (a, f) => { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * f, lo = Math.floor(h); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo); };
  const dist = (a) => ({ min: q(a, 0), p10: q(a, 0.1), p25: q(a, 0.25), median: q(a, 0.5), p75: q(a, 0.75), p90: q(a, 0.9), max: q(a, 1), mean: a.reduce((x, y) => x + y, 0) / a.length });
  const share = (f) => pl.filter(f).length / pl.length;
  const score = (r) => Math.log(1 + r.oos.cagr) / r.oos.dd;
  const fam = {}; for (const r of pl) { const k = CAND[r.pick].fam; fam[k] = (fam[k] || 0) + 1; }
  out.part2.summary = {
    worlds: pl.length, dCagr: dist(pl.map((r) => r.dCagr)), dDd: dist(pl.map((r) => r.dDd)),
    shareBeatBoth: share((r) => r.dCagr > 0 && r.dDd < 0), shareBeatCagr: share((r) => r.dCagr > 0), shareBeatDd: share((r) => r.dDd < 0),
    realBeatsBoth: real.dCagr > 0 && real.dDd < 0,
    realPctCagr: share((r) => r.dCagr < real.dCagr), realPctDd: share((r) => r.dDd > real.dDd), realPctScore: share((r) => score(r) < score(real)),
    shareAtLeastAsGoodBoth: share((r) => r.dCagr >= real.dCagr && r.dDd <= real.dDd), pickFamilies: fam,
  };
  save();
  const s = out.part2.summary, d = (x) => `min ${sg(x.min)} p10 ${sg(x.p10)} p25 ${sg(x.p25)} median ${sg(x.median)} p75 ${sg(x.p75)} p90 ${sg(x.p90)} max ${sg(x.max)} mean ${sg(x.mean)}`;
  console.log(`\nPLACEBO SUMMARY (${s.worlds} worlds)`);
  console.log(`real pick ${real.name} K ${real.K.toFixed(3)} | 2024-26 ${p(real.oos.cagr)}%/yr fall ${p(real.oos.dd)} | no rule ${p(base.oos.cagr)}%/yr fall ${p(base.oos.dd)} | diff cagr ${sg(real.dCagr)} dd ${sg(real.dDd)}`);
  console.log(`placebo cagr diff (pts/yr): ${d(s.dCagr)}`);
  console.log(`placebo dd diff (pts, negative = smaller fall): ${d(s.dDd)}`);
  console.log(`placebo beats no rule: both ${p(s.shareBeatBoth)}% | cagr ${p(s.shareBeatCagr)}% | smaller fall ${p(s.shareBeatDd)}%`);
  console.log(`real percentile among placebo: cagr diff ${p(s.realPctCagr)} | fall (higher = better) ${p(s.realPctDd)} | log-growth/fall ${p(s.realPctScore)} | placebo at least as good as real on both: ${p(s.shareAtLeastAsGoodBoth)}%`);
  console.log(`placebo pick families ${JSON.stringify(s.pickFamilies)}`);
  if (base.evenCut) console.log(`reference: no rule x${base.evenCut.is.K.toFixed(3)} (same 2020-23 target fall) 2020-23 ${p(base.evenCut.is.cagr)}%/yr | 2024-26 ${p(base.evenCut.oos.cagr)}%/yr fall ${p(base.evenCut.oos.dd)}`);
  console.log(`[${el()}] DONE -> ${outFile}`);
  pool.close();
}
