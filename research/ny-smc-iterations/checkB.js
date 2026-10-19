// checkB.js — Validation Check B: random-entry control for frozen v7. See "Check B design notes" in ITERATION-LOG.md.
// v7's exits / costs / sizing come from ie.js execute() unchanged; only the entry trigger is replaced by random signals.
// usage: node checkB.js [seeds=1000]   → results/validation_B.md, results/validation_B.json
const fs = require('fs'), path = require('path'), E = require('./ie.js');
const SEEDS = +process.argv[2] || 1000, POOL = 8;
const DATA = path.resolve(__dirname, '../sol-ny-smc/data');
const V7 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5, tpMode: 'R', tpR: 3, minDispATR: 1, minFvgATR: 0.2,
  chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5, maxStopATR: 4, maxFillBars: 8 };
const C = { ...E.BASE, ...V7 };
const SERIES = { SOL: ['data/sol15-pre.json', DATA + '/sol15-oos.json', DATA + '/sol15.json'], ETH: ['data/eth15-pre.json', DATA + '/eth15-all.json'] };
const D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const YEARS = { A2: [D0('2021-10-18'), D0('2022-10-18')], A1: [D0('2022-10-18'), D0('2023-10-18')], Y1: E.Y.Y1, Y2: E.Y.Y2, Y3: E.Y.Y3 };
const PERIODS = [['IS', 'Oct23–Oct26 (in-sample)', ['Y1', 'Y2', 'Y3']], ['A', 'Oct21–Oct23 (Check A years)', ['A2', 'A1']]];
const sha = require('crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'ie.js'))).digest('hex');
if (!sha.startsWith('6539c98f')) throw new Error('ie.js changed since the v7 freeze: ' + sha);

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const q = (a, p) => { const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const usd = (x) => (x < 0 ? '−$' : '+$') + Math.abs(x).toFixed(0);

const out = ['# Validation Check B — random-entry control for v7', '',
  `Run ${new Date().toISOString().slice(0, 16)}Z · ${SEEDS} seeds per coin per period · $10 per R · v7 frozen (ie.js sha256 ${sha.slice(0, 8)}…). ` +
  'Design and interpretation choices were logged in ITERATION-LOG.md before this run. A random setup = random signal candle + random direction + limit offset / stop distance ' +
  'drawn as a pair from one of that coin\'s real v7 trades (in ATR); all exits, costs and sizing are the unchanged v7 engine.', ''];
const json = {};
const verdict = {};

for (const mode of ['v7win', 'fullwin']) {
  out.push(`## ${mode === 'v7win' ? 'Primary control — signal candles in v7\'s own windows (08:30–09:30 and 10:30–11:30 ET)' : 'Sensitivity — literal 08:30–11:30 ET window (includes the 09:30–10:30 open hour v7 skips)'}`, '');
  for (const sym of ['SOL', 'ETH']) {
    const raw = SERIES[sym].flatMap((f) => JSON.parse(fs.readFileSync(path.resolve(__dirname, f), 'utf8')));
    const D = E.analyze(sym + '-full', raw, C.swingLen), { B, N, atr } = D;
    const v7 = E.execute(D, C, E.setupsFor(D, C));
    // candidate signal candles: inside the window of each NY session
    const sessions = D.A.ny.map((t) => ({ start: t + C.sessOffsetH * 3600, open: t, end: t + (C.sessOffsetH + C.sessionHours) * 3600 }));
    const cand = []; // [idx, session]
    { let si = 0;
      for (let i = 20; i < N - 20; i++) {
        const t = B[i].time;
        while (si < sessions.length && sessions[si].end <= t) si++;
        const s = sessions[si]; if (!s || t < s.start || t >= s.start + 3 * 3600) continue;
        if (mode === 'v7win' && t >= s.open && t < s.open + 3600) continue;
        cand.push([i, s]);
      } }
    for (const [pid, plabel, yrs] of PERIODS) {
      const lo = YEARS[yrs[yrs.length - 1]][0] < YEARS[yrs[0]][0] ? YEARS[yrs[yrs.length - 1]][0] : YEARS[yrs[0]][0];
      const hi = Math.max(...yrs.map((y) => YEARS[y][1]));
      const pv7 = v7.filter((t) => t.t >= lo && t.t < hi);
      const nPer = Object.fromEntries(yrs.map((y) => [y, pv7.filter((t) => t.t >= YEARS[y][0] && t.t < YEARS[y][1]).length]));
      const v7R = pv7.reduce((a, t) => a + t.R * 10, 0);
      // geometry pairs from this coin's v7 trades in the period
      const pairs = pv7.map((t) => { const s = t.s, a = atr[s.fvgIdx], dir = s.long ? 1 : -1;
        return { off: dir * (B[s.fvgIdx].close - s.entry) / a, stop: s.risk / a }; });
      const candBy = Object.fromEntries(yrs.map((y) => [y, cand.filter(([i]) => B[i].time >= YEARS[y][0] && B[i].time < YEARS[y][1])]));
      const totals = [], perYearTotals = Object.fromEntries(yrs.map((y) => [y, []])), shortfall = [], execCounts = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const rnd = mulberry32(seed * 7919 + (sym === 'ETH' ? 101 : 0) + (pid === 'A' ? 5003 : 0) + (mode === 'fullwin' ? 31 : 0));
        const setups = [];
        for (const y of yrs) {
          const want = Math.min(nPer[y] * POOL, candBy[y].length), used = new Set();
          while (used.size < want) used.add(Math.floor(rnd() * candBy[y].length));
          for (const k of used) {
            const [i, s] = candBy[y][k], g = pairs[Math.floor(rnd() * pairs.length)], long = rnd() < 0.5, dir = long ? 1 : -1, a = atr[i];
            const entry = B[i].close - dir * g.off * a, risk = g.stop * a, stop = entry - dir * risk;
            setups.push({ long, chochIdx: i, fvgIdx: i, legXi: i, entry, stop, tp: entry + dir * C.tpR * risk, risk, sessStart: s.start, sessEnd: s.end, f: {} });
          }
        }
        setups.sort((x, y) => x.fvgIdx - y.fvgIdx);
        const tr = E.execute(D, C, setups);
        let tot = 0;
        for (const y of yrs) {
          const ex = tr.filter((t) => t.t >= YEARS[y][0] && t.t < YEARS[y][1]);
          for (let i = ex.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ex[i], ex[j]] = [ex[j], ex[i]]; }
          const pick = ex.slice(0, nPer[y]); if (pick.length < nPer[y]) shortfall.push(nPer[y] - pick.length);
          const s = pick.reduce((a2, t) => a2 + t.R * 10, 0); perYearTotals[y].push(s); tot += s;
        }
        totals.push(tot); execCounts.push(tr.length);
      }
      const sorted = [...totals].sort((a, b) => a - b), mean = totals.reduce((a, b) => a + b, 0) / totals.length;
      const pct = sorted.filter((x) => x < v7R).length / sorted.length * 100, nYears = yrs.length;
      const r = { v7R, trades: pv7.length, perYearTrades: nPer, mean, median: q(sorted, 0.5), p5: q(sorted, 0.05), p95: q(sorted, 0.95), p99: q(sorted, 0.99), pct,
        meanPerYear: mean / nYears, shortfallSeeds: shortfall.length, avgExecuted: execCounts.reduce((a, b) => a + b, 0) / execCounts.length,
        perYear: Object.fromEntries(yrs.map((y) => { const s = [...perYearTotals[y]].sort((a, b) => a - b); return [y, { v7: pv7.filter((t) => t.t >= YEARS[y][0] && t.t < YEARS[y][1]).reduce((a, t) => a + t.R * 10, 0), mean: perYearTotals[y].reduce((a, b) => a + b, 0) / s.length, p5: q(s, 0.05), p95: q(s, 0.95) }]; })) };
      // histogram
      const lo2 = Math.min(sorted[0], v7R), hi2 = Math.max(sorted[sorted.length - 1], v7R), bins = 24, w = (hi2 - lo2) / bins || 1, h = new Array(bins).fill(0);
      totals.forEach((x) => h[Math.min(bins - 1, Math.floor((x - lo2) / w))]++);
      r.hist = h.map((c, i) => `${usd(lo2 + i * w).padStart(6)} ${'█'.repeat(Math.round(c / Math.max(...h) * 40))} ${c}${v7R >= lo2 + i * w && v7R < lo2 + (i + 1) * w + 1e-9 ? '  ◀ v7 actual' : ''}`);
      json[`${mode}/${sym}/${pid}`] = r;
      if (mode === 'v7win') verdict[`${sym}/${pid}`] = r;
    }
  }
  // summary tables
  out.push('| Coin | Period | v7 trades | **v7 actual** | Random mean | Random median | 5th pct | 95th pct | 99th pct | v7 percentile | Random mean per year | Seeds short of v7 count |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const sym of ['SOL', 'ETH']) for (const [pid] of PERIODS) { const r = json[`${mode}/${sym}/${pid}`];
    out.push(`| ${sym} | ${pid === 'IS' ? 'Oct23–Oct26' : 'Oct21–Oct23 (A2+A1)'} | ${r.trades} | **${usd(r.v7R)}** | ${usd(r.mean)} | ${usd(r.median)} | ${usd(r.p5)} | ${usd(r.p95)} | ${usd(r.p99)} | **${r.pct.toFixed(1)}%** | ${usd(r.meanPerYear)} | ${r.shortfallSeeds}/${SEEDS} |`); }
  out.push('', 'Per year (random mean · 5th–95th percentile range vs v7 actual):', '', '| Coin | Year | v7 actual | Random mean | 5th – 95th |', '|---|---|---|---|---|');
  for (const sym of ['SOL', 'ETH']) for (const [pid] of PERIODS) { const r = json[`${mode}/${sym}/${pid}`];
    for (const [y, v] of Object.entries(r.perYear)) out.push(`| ${sym} | ${y} | ${usd(v.v7)} | ${usd(v.mean)} | ${usd(v.p5)} … ${usd(v.p95)} |`); }
  out.push('');
  if (mode === 'v7win') for (const sym of ['SOL', 'ETH']) { const r = json[`${mode}/${sym}/IS`]; out.push(`Histogram — ${sym}, Oct23–Oct26, ${SEEDS} random runs (total $ profit):`, '', '```', ...r.hist, '```', ''); }
}
// verdict
out.push('## Verdict (pre-registered criteria + the interpretation notes logged before the run)', '', '| Coin | v7 above 95th pct (Oct23–Oct26) | Random mean ≤ +$30/yr (all periods, both windows) | **Check B** |', '|---|---|---|---|');
const verdicts = {};
for (const sym of ['SOL', 'ETH']) {
  const above = verdict[`${sym}/IS`].v7R > verdict[`${sym}/IS`].p95;
  const meanOK = Object.entries(json).filter(([k]) => k.includes(`/${sym}/`)).every(([, r]) => r.meanPerYear <= 30);
  const bias = !meanOK;
  verdicts[sym] = bias ? 'BIAS DETECTED' : above ? 'PASS' : 'FAIL';
  out.push(`| ${sym} | ${above ? '✅' : '❌'} v7 ${usd(verdict[`${sym}/IS`].v7R)} vs p95 ${usd(verdict[`${sym}/IS`].p95)} (percentile ${verdict[`${sym}/IS`].pct.toFixed(1)}) | ${meanOK ? '✅' : '❌'} worst random mean ${usd(Math.max(...Object.entries(json).filter(([k]) => k.includes(`/${sym}/`)).map(([, r]) => r.meanPerYear)))}/yr | **${verdicts[sym]}** |`);
}
fs.writeFileSync(path.join(__dirname, 'results/validation_B.md'), out.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'results/validation_B.json'), JSON.stringify({ verdicts, json: Object.fromEntries(Object.entries(json).map(([k, v]) => { const { hist, ...r } = v; return [k, r]; })) }, null, 1));
console.log(out.join('\n'));
