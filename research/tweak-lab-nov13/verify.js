// verify.js — is the test honest about the future?
//  A. REPLAY TEST (no future sight, no repaint): cut each coin's history at random candles and rerun the bot with ONLY the candles up to the cut.
//     Every entry signal on every candle before the cut, and every trade closed before the cut (entry time, exit time, result), must be identical
//     to the full-history run. A signal that used a later candle, or that changed after the fact, shows up as a mismatch.
//  B. WALK-FORWARD (the settings do not see the future either): before each year 2023..2026, pick the setting that did best on the years BEFORE it
//     (highest profit / worst drop), trade that year with it, and stitch the four unseen years together. Compare with today's rules on the same years.
//   node verify.js  -> verify.json + console
'use strict';
const fs = require('fs'), path = require('path');
const { load, tradesOf, signalsOf, LINEUP } = require('./lab.js');
const IMPROVED = { 'BB-CORE': { bb: { sigma: 1.8 }, maxBars: 42, cooldown: 3 }, 'I-CORE': { kInit: 1.75, beR: 4, beLock: 1 }, 'T-CORE': { bb: { len: 30 }, staleBars: 48, staleR: 1 } };
const EXTRA = { 'BB-CORE': ['DOGE'], 'I-CORE': ['ETH'], 'T-CORE': ['BNB'] };
const FAMILY = {
  'BB-CORE': [{}, ...[1.75, 1.8, 1.85, 1.9, 2].flatMap((s) => [39, 42, 45, 48].flatMap((h) => [0, 2, 3, 4].map((c) => ({ bb: { sigma: s }, maxBars: h, ...(c ? { cooldown: c } : {}) }))))],
  'I-CORE': [{}, ...[1.6, 1.75, 1.9, 2].flatMap((k) => [null, [3, 1], [4, 1], [5, 1], [4, 0.5]].map((b) => ({ kInit: k, ...(b ? { beR: b[0], beLock: b[1] } : {}) })))],
  'T-CORE': [{}, ...[20, 25, 28, 30, 32].flatMap((l) => [0, 36, 42, 48, 54, 60].map((s) => ({ bb: { len: l }, ...(s ? { staleBars: s, staleR: 1 } : {}) })))],
};
let seed = 20261113; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
const out = { replay: {}, walk: {} };

// ---- A. replay test
const CUTS = 12;
console.log('================ A. REPLAY TEST: bot rerun with only the candles up to a random cut ================');
for (const bot of Object.keys(LINEUP)) for (const [label, ch] of [['today', {}], ['improved', IMPROVED[bot]]]) {
  let sigChecks = 0, sigBad = 0, trChecks = 0, trBad = 0, cuts = 0;
  for (const c of [...LINEUP[bot], ...EXTRA[bot]]) {
    const full = signalsOf(bot, c, ch), fullTr = tradesOf(bot, c, ch), n = full.x.n;
    for (let k = 0; k < CUTS; k++) {
      const cut = Math.floor(700 + rnd() * (n - 800)), part = signalsOf(bot, c, ch, cut), tCut = full.x.B[cut - 1].time; cuts++;
      for (let i = 0; i < cut; i++) { sigChecks += 2; if (part.sig.L[i] !== full.sig.L[i]) sigBad++; if (part.sig.S[i] !== full.sig.S[i]) sigBad++; }
      if (part.sig.mid) for (let i = Math.max(0, cut - 400); i < cut; i++) { const a = part.sig.mid[i], b = full.sig.mid[i]; if (a !== a && b !== b) continue; sigChecks++; if (!same(a, b)) sigBad++; }
      // trades closed strictly before the cut candle: the truncated run cannot know anything later
      const a = tradesOf(bot, c, ch, cut).filter((t) => t.t1 <= tCut), b = fullTr.filter((t) => t.t1 <= tCut);
      trChecks += Math.max(a.length, b.length);
      if (a.length !== b.length) trBad += Math.abs(a.length - b.length);
      for (let j = 0; j < Math.min(a.length, b.length); j++) if (a[j].t0 !== b[j].t0 || a[j].t1 !== b[j].t1 || a[j].d !== b[j].d || !same(a[j].R, b[j].R)) trBad++;
    }
  }
  out.replay[bot + '|' + label] = { cuts, sigChecks, sigBad, trChecks, trBad };
  console.log(`${bot.padEnd(8)} ${label.padEnd(9)} ${cuts} cuts | signals compared ${sigChecks.toLocaleString()} -> ${sigBad} different | trades compared ${trChecks.toLocaleString()} -> ${trBad} different  ${sigBad + trBad === 0 ? 'PASS' : 'FAIL'}`);
}

// ---- B. walk-forward
const yrStart = (y) => Date.UTC(y, 0, 1) / 1000, END = Date.UTC(2026, 10, 12) / 1000, S0 = yrStart(2020);
function measureP(tr, from, to) {
  tr = tr.filter((t) => t.t1 > from && t.t1 <= to).sort((a, b) => a.t1 - b.t1);
  let e = 0, p = 0, dd = 0, ls = 0, cur = 0; for (const t of tr) { e += t.R; p = Math.max(p, e); dd = Math.max(dd, p - e); cur = t.R <= 0 ? cur + 1 : 0; ls = Math.max(ls, cur); }
  const m = {}; for (let d = new Date(from * 1000); d.getTime() / 1000 < to; d.setUTCMonth(d.getUTCMonth() + 1, 1)) m[d.toISOString().slice(0, 7)] = 0;
  const y = {}; for (const t of tr) { const k = new Date(t.t1 * 1000).toISOString(); if (k.slice(0, 7) in m) m[k.slice(0, 7)] += t.R; y[k.slice(0, 4)] = (y[k.slice(0, 4)] || 0) + t.R; }
  const mv = Object.values(m);
  return { n: tr.length, R: e, dd, ls, loseM: mv.filter((v) => v < 0).length / mv.length, wr: tr.length ? tr.filter((t) => t.R > 0).length / tr.length : 0, yrs: y };
}
const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), pc = (v) => (v * 100).toFixed(0) + '%';
console.log('\n================ B. WALK-FORWARD: settings chosen on past years only, then traded on the next unseen year ================');
for (const bot of Object.keys(LINEUP)) {
  const runs = FAMILY[bot].map((ch) => ({ ch, tr: LINEUP[bot].flatMap((c) => tradesOf(bot, c, ch)) }));
  const stitched = [], picks = [];
  for (const Y of [2023, 2024, 2025, 2026]) {
    const best = runs.map((r) => { const m = measureP(r.tr, S0, yrStart(Y)); return { r, score: m.dd > 0 ? m.R / m.dd : 0 }; }).sort((a, b) => b.score - a.score)[0].r;
    const to = Y === 2026 ? END : yrStart(Y + 1); stitched.push(...best.tr.filter((t) => t.t1 > yrStart(Y) && t.t1 <= to)); picks.push({ year: Y, ch: best.ch });
  }
  const A = yrStart(2023), today = measureP(runs[0].tr, A, END), wf = measureP(stitched, A, END), fixed = measureP(LINEUP[bot].flatMap((c) => tradesOf(bot, c, IMPROVED[bot])), A, END);
  // simplest version of the same question: rank the family on 2020-22 only, take its winner, trade 2023-26 untouched
  const bestIS = runs.map((r) => { const m = measureP(r.tr, S0, A); return { r, score: m.dd > 0 ? m.R / m.dd : 0 }; }).sort((a, b) => b.score - a.score)[0].r, once = measureP(bestIS.tr, A, END);
  out.walk[bot] = { family: FAMILY[bot].length, picks, today, walk: wf, once: { ch: bestIS.ch, ...once }, improvedFixed: fixed };
  const L = (m) => `${f(m.R).padStart(5)}R drop ${m.dd.toFixed(1).padStart(5)} streak ${String(m.ls).padStart(2)} loseM ${pc(m.loseM)} win ${pc(m.wr)} | ${Object.entries(m.yrs).map(([y, v]) => y.slice(2) + ':' + f(v)).join(' ')}`;
  console.log(`\n--- ${bot} on 2023 -> Nov 2026 (${FAMILY[bot].length} settings in the family)`);
  console.log(`  today's rules                         ${L(today)}`);
  console.log(`  walk-forward (re-picked every year)   ${L(wf)}`);
  console.log(`  picked once on 2020-22 only           ${L(once)}   ${JSON.stringify(bestIS.ch)}`);
  console.log(`  the improved rules of the report      ${L(fixed)}`);
  console.log('  picks: ' + picks.map((p) => p.year + ' ' + JSON.stringify(p.ch)).join(' | '));
}
fs.writeFileSync(path.join(__dirname, 'verify.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
