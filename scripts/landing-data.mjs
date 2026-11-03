// landing-data.mjs — the numbers on the public landing page (ledger/reports/how-lucid-io-works-v2.html), from the two live bots' own engines.
//   node scripts/landing-data.mjs            -> prints a summary
//   node scripts/landing-data.mjs --write    -> also replaces the `const LANDING = …` line in the landing page (and its copy in LEDGER/)
//
// The pool: half the money with BB-Core (no target, the live setting since 29 Oct 2026), half with I-Core, each bot on its own account,
// every trade risking RISK of that account's balance at entry (compounding on every trade, as the bots do). Trades from the bots' data files
// (Binance 4h candles + BB-Core's real funding), every cost included. A trade's money lands when it closes (exit candle close).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const app = join(dirname(fileURLToPath(import.meta.url)), '..'), STRAT = join(app, '..');
globalThis.BBCore = require(join(STRAT, 'bb-core', 'lucidio-core.js'));
globalThis.ICore = require(join(STRAT, 'i-core', 'icore-core.js'));
const A = require(join(app, 'js', 'analysis-core.js'));
const RISK = 0.025, LOW = 0.01, Y0 = 2020, Y1 = 2026, DAY = 86400;
const PAGES = [join(STRAT, 'ledger', 'reports', 'how-lucid-io-works-v2.html'), join(app, 'LEDGER', 'reports', 'how-lucid-io-works-v2.html')];

const load = (f) => JSON.parse(readFileSync(f)).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
let endT = Infinity;
function trades(strat, dir) {
  const T = [];
  for (const c of A.COINS) {
    const B = load(join(STRAT, dir, 'data', c + '.json')), ff = join(STRAT, dir, 'data', 'funding', c + '.json');
    endT = Math.min(endT, B[B.length - 1].time + 14400);
    T.push(...A.coinTrades(strat, c, B, existsSync(ff) ? JSON.parse(readFileSync(ff)) : null, {}, 14400).trades);
  }
  return T;
}
const BB = trades('bbnt', 'bb-core'), IC = trades('icore', 'i-core');
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const jan1 = (y) => Date.UTC(y, 0, 1) / 1000;

// the pool's closed-trade balance over time from y0: [[t, value]], half the start in each bot
function pool(y0, risk, start) {
  const o = { start: start / 2, risk, cap: 0, mode: 'trade', dep: 0, depEvery: 'none', y0, y1: Y1 };
  const a = A.simulate(BB, o), b = A.simulate(IC, o);
  const ev = [...a.pts.map((p) => [p[0], 0, p[1]]), ...b.pts.map((p) => [p[0], 1, p[1]])].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let va = start / 2, vb = start / 2;
  const pts = [[jan1(y0), start]];
  for (const [t, k, v] of ev) { if (k) vb = v; else va = v; pts.push([t, va + vb]); }
  return pts;
}
const at = (pts, t) => { let lo = 0, hi = pts.length - 1; if (t < pts[0][0]) return pts[0][1]; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m][0] <= t) lo = m; else hi = m - 1; } return pts[lo][1]; };
function drop(pts, from = -Infinity, to = Infinity) {
  let pk = -Infinity, dd = 0, ddAt = null;
  for (const [t, v] of pts) { if (t < from || t >= to) continue; pk = Math.max(pk, v); const d = 1 - v / pk; if (d > dd) { dd = d; ddAt = t; } }
  return { dd, ddAt };
}
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// 1. ₱1,000 from 1 Jan 2020, compounding: per year start / end / deepest dip inside the year (2.5% and 1%)
function years(risk) {
  const pts = pool(Y0, risk, 1000), out = { bal: Math.round(pts[pts.length - 1][1]), years: {} };
  const d = drop(pts); out.dd = r4(d.dd); out.ddAt = iso(d.ddAt);
  for (let y = Y0; y <= Y1; y++) {
    const s = at(pts, jan1(y) - 1), e = y === Y1 ? pts[pts.length - 1][1] : at(pts, jan1(y + 1) - 1);
    let pk = s, dd = 0; for (const [t, v] of pts) if (t >= jan1(y) && t < jan1(y + 1)) { pk = Math.max(pk, v); dd = Math.max(dd, 1 - v / pk); }
    out.years[y] = { start: Math.round(s), end: Math.round(e), dd: r4(dd) };
  }
  return { out, pts };
}
const main = years(RISK), low = years(LOW);

// 2. "In short": money put in on 1 January of each year buys slices of the running pool (so it shares in trades already open), as in the ledger.
// Multiples of the amount: worth on 31 December of that year, worth now, the lowest point after joining and the deepest fall from a high.
const P0 = main.pts, last0 = P0[P0.length - 1][1], short = [];
for (let y = Y0; y <= Y1; y++) {
  const s = at(P0, jan1(y) - 1), endY = y === Y1 ? last0 : at(P0, jan1(y + 1) - 1), d = drop([[jan1(y), s], ...P0.filter((p) => p[0] >= jan1(y))]);
  short.push({ y, endY: r4(endY / s), now: r4(last0 / s), dd: r4(d.dd), ddAt: d.ddAt ? iso(d.ddAt) : null, low: r4(Math.min(s, ...P0.filter((p) => p[0] >= jan1(y)).map((p) => p[1])) / s) });
}

// 3. 2026 unit prices for the example investors: every Sunday, every month end and the last data day (the pool's value, 1.0 on 1 January 2026)
const s26 = at(P0, jan1(Y1) - 1), p26 = P0.map(([t, v]) => [t, v / s26]), days = new Set();
for (let t = Date.UTC(2026, 0, 4) / 1000; t < endT; t += 7 * DAY) days.add(iso(t));
for (let m = 0; m < 12; m++) { const t = Date.UTC(2026, m + 1, 0) / 1000; if (t < endT) days.add(iso(t)); }
days.add(iso(endT - 1));
const w26 = [...days].sort().map((d) => ({ d, p: r4(at(p26, Date.parse(d) / 1000 + DAY - 1)) }));

// 4. risk facts: starting at any month for 12 months, the worst 3 months, the last 12 months
const P = main.pts, firstT = Math.min(...[...BB, ...IC].map((t) => t.t)), roll = [];
for (let y = Y0, m = new Date(firstT * 1000).getUTCMonth() + 1; ; m++) {
  if (m > 11) { m = 0; y++; }
  const s = Date.UTC(y, m, 1) / 1000, e = Date.UTC(y, m + 12, 1) / 1000;
  if (e > endT) break;
  roll.push({ from: iso(s), g: at(P, e) / at(P, s) - 1 });
}
const gs = roll.map((x) => x.g).sort((a, b) => a - b), worstRoll = roll.reduce((a, x) => (!a || x.g < a.g ? x : a), null);
let worst3 = null;
for (const [t, v] of P) { if (t + 91 * DAY > endT) break; const g = at(P, t + 91 * DAY) / v; if (!worst3 || g < worst3.g) worst3 = { g, from: iso(t), to: iso(t + 91 * DAY) }; }
const last12 = (pts) => pts[pts.length - 1][1] / at(pts, endT - 365 * DAY) - 1;
const yrs = Object.entries(main.out.years), dips = yrs.map(([, x]) => x.dd), growth = yrs.map(([y, x]) => [y, x.end / x.start - 1]);
const facts = {
  end: iso(endT - 1), first: iso(firstT), trades: { bb: BB.length, ic: IC.length },
  dd: main.out.dd, ddAt: main.out.ddAt, dd1: low.out.dd, dipMin: r4(Math.min(...dips)), dipMax: r4(Math.max(...dips)),
  rollN: roll.length, rollMed: r4(A.quantile(gs, 0.5)), rollLoss: roll.filter((x) => x.g < 0).length, rollWorst: r4(worstRoll.g), rollWorstFrom: worstRoll.from,
  worst3: r4(worst3.g), worst3From: worst3.from, worst3To: worst3.to, last12: r4(last12(P)), last12low: r4(last12(low.pts)),
  allUp: growth.every(([, g]) => g > 0), best: growth.reduce((a, x) => (x[1] > a[1] ? x : a)), weakest: growth.filter(([y]) => +y > Y0 && +y < Y1).sort((a, b) => a[1] - b[1]).slice(0, 2).map((x) => x[0]),   // full years only
};
const LANDING = { risk: RISK, low: LOW, years: { [RISK]: main.out, [LOW]: low.out }, short, w26, facts };

console.log(`data to ${facts.end} · trades BB-Core ${BB.length}, I-Core ${IC.length}`);
console.log(`₱1,000 from 2020 at ${RISK * 100}%: ${main.out.bal.toLocaleString()} (drop ${(main.out.dd * 100).toFixed(1)}% on ${main.out.ddAt}); at 1%: ${low.out.bal.toLocaleString()} (drop ${(low.out.dd * 100).toFixed(1)}%)`);
for (const [y, x] of yrs) console.log(`  ${y}: ${x.start} -> ${x.end} (${((x.end / x.start - 1) * 100).toFixed(0)}%), dip ${(x.dd * 100).toFixed(0)}%   at 1%: ${((low.out.years[y].end / low.out.years[y].start - 1) * 100).toFixed(0)}%`);
console.log('In short (₱5,000 on 1 Jan):'); for (const s of short) console.log(`  ${s.y}: end of year ₱${Math.round(5000 * s.endY).toLocaleString()} · now ₱${Math.round(5000 * s.now).toLocaleString()} · deepest drop ${(s.dd * 100).toFixed(0)}% · lowest ₱${Math.round(5000 * s.low).toLocaleString()}`);
console.log('facts', JSON.stringify(facts));
console.log(`2026 weekly points: ${w26.length}, last ${JSON.stringify(w26[w26.length - 1])}`);

if (process.argv.includes('--write')) {
  const line = `const LANDING = ${JSON.stringify(LANDING)};   // generated by StrategyBacktester/scripts/landing-data.mjs — re-run it, do not edit by hand`;
  for (const f of PAGES) {
    if (!existsSync(f)) continue;
    const html = readFileSync(f, 'utf8'), re = /^const LANDING = .*$/m;
    if (!re.test(html)) { console.log(`no "const LANDING = " line in ${f}`); continue; }
    writeFileSync(f, html.replace(re, () => line));
    console.log(`wrote ${f}`);
  }
}
