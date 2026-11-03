// backtest-report-data.mjs — the numbers behind ledger/reports/backtest-data.html ("What ₱1,000 could have become"), from the two live bots' own engines.
//   node scripts/backtest-report-data.mjs            -> prints a summary
//   (imported by backtest-report.mjs, which writes the page)
//
// Same pool as the landing page (landing-data.mjs): half the money with each bot, each bot on its own account, every trade risking RISK of that account's
// balance when the trade opens (compounding on every trade), a trade's money lands when it closes. On top of that: the 20% fee on new profit above the
// investor's best level, settled at the end of every even month (Feb, Apr, Jun, Aug, Oct, Dec) and, for the last (partial) month, on the last data day.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const app = join(dirname(fileURLToPath(import.meta.url)), '..'), STRAT = join(app, '..');
const pick = (...n) => { for (const d of n) if (existsSync(join(STRAT, d))) return join(STRAT, d); throw new Error('folder not found: ' + n.join(' / ')); };
const BBDIR = pick('bb-core', '🔴BB-Core'), ICDIR = pick('i-core', '🔴I-Core');
globalThis.BBCore = require(join(BBDIR, 'lucidio-core.js'));
globalThis.ICore = require(join(ICDIR, 'icore-core.js'));
const A = require(join(app, 'js', 'analysis-core.js'));

export const RISK = 0.025, FEE = 0.2, Y0 = 2020, Y1 = 2026, START = 1000;
const load = (f) => JSON.parse(readFileSync(f)).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
let endT = Infinity;
function trades(strat, dir) {
  const T = [];
  for (const c of A.COINS) {
    const B = load(join(dir, 'data', c + '.json')), ff = join(dir, 'data', 'funding', c + '.json');
    endT = Math.min(endT, B[B.length - 1].time + 14400);
    T.push(...A.coinTrades(strat, c, B, existsSync(ff) ? JSON.parse(readFileSync(ff)) : null, {}, 14400).trades);
  }
  return T;
}
const BB = trades('bbnt', BBDIR), IC = trades('icore', ICDIR);
export const END = endT, FIRST = Math.min(...[...BB, ...IC].map((t) => t.t));
const jan1 = (y) => Date.UTC(y, 0, 1) / 1000, mStart = (y, m) => Date.UTC(y, m, 1) / 1000;
export const ymOf = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };   // month index
export const monthIdx = (y, m) => y * 12 + m;

// one pool run. from/until: the trades used (opened at/after `from`, closed before `until`); end: last moment simulated.
// Returns pts [[t, value after fee]] and fees [[t, amount]].
export function run({ from, until, end, risk = RISK, fee = true, start = START }) {
  const ev = [];
  for (const [k, T] of [[0, BB], [1, IC]]) for (const t of T) if (t.t >= from && t.tExit <= end && t.tc < until) { ev.push([t.t, 2, k, t]); ev.push([t.tExit, 0, k, t]); }
  if (fee) {
    const d0 = new Date(from * 1000), y0 = d0.getUTCFullYear();
    for (let y = y0; y <= new Date(end * 1000).getUTCFullYear(); y++) for (const m of [1, 3, 5, 7, 9, 11]) { const t = mStart(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1) - 1; if (t >= from && t <= end) ev.push([t, 1, 9, null]); }
    const e = new Date((end - 1) * 1000), em = e.getUTCMonth();
    if (em % 2 === 1 && !ev.some((x) => x[1] === 1 && x[0] === end)) ev.push([end, 1, 9, null]);   // the last, partial even month: settled on the last data day
  }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const acct = [start / 2, start / 2], amt = new Map(), pts = [[from, start]], fees = [];
  let hwm = start;
  for (const [t, typ, k, tr] of ev) {
    if (typ === 2) { amt.set(tr, acct[k] * risk); continue; }
    if (typ === 0) { acct[k] += tr.R * amt.get(tr); pts.push([t, acct[0] + acct[1]]); continue; }
    const bal = acct[0] + acct[1];
    if (bal > hwm) { const f = FEE * (bal - hwm), s = (bal - f) / bal; acct[0] *= s; acct[1] *= s; hwm = bal - f; fees.push([t, f]); pts.push([t, bal - f]); }
  }
  return { pts, fees, from, until, end, closed: ev.filter((x) => x[1] === 0).map((x) => x[3]) };
}
export const at = (pts, t) => { let lo = 0, hi = pts.length - 1; if (t < pts[0][0]) return pts[0][1]; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m][0] <= t) lo = m; else hi = m - 1; } return pts[lo][1]; };

// months (UTC) from the first trade's month to the last data day: start, end, fee, n trades, dd (deepest fall inside the month)
export function monthTable(r) {
  const out = [], f = new Date(FIRST * 1000);
  let y = f.getUTCFullYear(), m = f.getUTCMonth();
  for (;; m++) {
    if (m > 11) { m = 0; y++; }
    const a = mStart(y, m), b = mStart(y, m + 1);
    if (a >= r.end) break;
    const s = at(r.pts, a - 1), e = at(r.pts, Math.min(b, r.end + 1) - 1);
    let pk = s, dd = 0; for (const [t, v] of r.pts) if (t >= a && t < b) { pk = Math.max(pk, v); dd = Math.max(dd, 1 - v / pk); }
    out.push({ y, m, k: monthIdx(y, m), start: s, end: e, fee: r.fees.filter(([t]) => t >= a && t < b).reduce((q, x) => q + x[1], 0), n: r.closed.filter((t) => t.tExit >= a && t.tExit < b).length,
      wins: r.closed.filter((t) => t.tExit >= a && t.tExit < b && t.R > 0).length, ret: e / s - 1, profit: e - s, dd, partial: b > r.end });
  }
  return out;
}
export function underwater(pts) { let pk = -Infinity, dd = 0, peakAt = null, ddPeak = null, ddAt = null; const u = [];
  for (const [t, v] of pts) { if (v > pk) { pk = v; peakAt = t; } const d = 1 - v / pk; u.push([t, d]); if (d > dd) { dd = d; ddPeak = peakAt; ddAt = t; } }
  return { dd, ddPeak, ddAt, u, peakVal: null }; }

export function build() {
  const all = run({ from: jan1(Y0), until: Infinity, end: END });
  const nofee = run({ from: jan1(Y0), until: Infinity, end: END, fee: false });
  const months = monthTable(all), monthsNoFee = monthTable(nofee);
  const uw = underwater(all.pts);
  // years (compounded)
  const years = [];
  for (let y = Y0; y <= Y1; y++) {
    const a = jan1(y), b = jan1(y + 1), s = at(all.pts, a - 1), e = y === Y1 ? at(all.pts, END) : at(all.pts, b - 1);
    const ms = months.filter((m) => m.y === y);
    years.push({ y, start: s, end: e, ret: e / s - 1, fee: all.fees.filter(([t]) => t >= a && t < b).reduce((q, x) => q + x[1], 0), profit: e - s, n: all.closed.filter((t) => t.tExit >= a && t.tExit < b).length,
      green: ms.filter((m) => m.ret > 0).length, red: ms.filter((m) => m.ret <= 0).length, months: ms, risk: null, partial: y === Y1, first: y === Y0 });
  }
  // fresh ₱1,000 each year (not compounded)
  const fresh = [];
  for (let y = Y0; y <= Y1; y++) { const r = run({ from: jan1(y), until: jan1(y + 1), end: y === Y1 ? END : jan1(y + 1) }); fresh.push({ y, end: r.pts[r.pts.length - 1][1] }); }
  // risk comparison, after the fee
  const riskRows = [0.025, 0.01, 0.005].map((rk) => { const r = run({ from: jan1(Y0), until: Infinity, end: END, risk: rk }), ms = monthTable(r), u = underwater(r.pts);
    return { risk: rk, final: r.pts[r.pts.length - 1][1], dd: u.dd, worstMonth: Math.min(...ms.map((m) => m.ret)), green: ms.filter((m) => m.ret > 0).length, months: ms.length,
      yearsUp: [...Array(Y1 - Y0 + 1)].map((_, i) => { const y = Y0 + i; return at(r.pts, y === Y1 ? END : jan1(y + 1) - 1) > at(r.pts, jan1(y) - 1); }).filter(Boolean).length }; });
  // trades
  const closed = [...all.closed].sort((a, b) => a.tExit - b.tExit);
  let streak = 0, maxLoss = 0; for (const t of closed) { if (t.R <= 0) { streak++; maxLoss = Math.max(maxLoss, streak); } else streak = 0; }
  const stat = { n: closed.length, wins: closed.filter((t) => t.R > 0).length, maxLoss, bb: closed.filter((t) => BB.includes(t)).length };
  return { all, nofee, months, monthsNoFee, uw, years, fresh, riskRows, stat };
}

if (process.argv[1] && process.argv[1].endsWith('backtest-report-data.mjs')) {
  const d = build(), iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  console.log(`first trade ${iso(FIRST)} · data to ${iso(END - 1)} · trades closed ${d.stat.n} (win ${(100 * d.stat.wins / d.stat.n).toFixed(1)}%) · max losing run ${d.stat.maxLoss}`);
  console.log('final after fee', Math.round(d.all.pts.at(-1)[1]), 'before fee', Math.round(d.nofee.pts.at(-1)[1]), 'fees', Math.round(d.all.fees.reduce((q, x) => q + x[1], 0)));
  console.log('worst drop', (d.uw.dd * 100).toFixed(1) + '%', iso(d.uw.ddPeak), '->', iso(d.uw.ddAt));
  for (const y of d.years) console.log(y.y, Math.round(y.start), '->', Math.round(y.end), (y.ret * 100).toFixed(0) + '%', 'fee', Math.round(y.fee), 'n', y.n, `${y.green}/${y.red}`);
  console.log('fresh', d.fresh.map((x) => x.y + ':' + Math.round(x.end)).join(' '));
  console.log('months', d.months.length, 'green', d.months.filter((m) => m.ret > 0).length, 'worst', Math.min(...d.months.map((m) => m.ret)).toFixed(3), 'best', Math.max(...d.months.map((m) => m.ret)).toFixed(3));
  for (const r of d.riskRows) console.log('risk', r.risk, Math.round(r.final), (r.dd * 100).toFixed(1) + '%', r.worstMonth.toFixed(3), `${r.green}/${r.months}`, r.yearsUp);
}
