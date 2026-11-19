// study.mjs — Nov 19, 2026: how should the pool's money be shared between the three live bots over time?
// Self-compounding (split once, never moved) vs calendar rebalancing vs drift bands vs one shared pool vs fee-only rebalancing,
// plus weight variants (equal, 40/30/30, 60/20/20, inverse-volatility re-estimated walk-forward).
// Trades: the same ones as the /backtest-data page (scripts/backtest-report-data-v2.mjs: intel engine, rules v3, live coins, Jan 2020 -> last candle).
// Money: 2.5% of the bot's OWN account at risk per trade (fixed at open), result lands at close, 20% fee on new profit above the
// high-water mark at the end of every even month. Rebalancing uses realized balances (money already in the accounts), never open profit.
// Three tests: (A) full history, (B) every start month, 12- and 24-month holds, paired against self-compounding,
// (C) 1,000 block-bootstrap histories (6-month blocks of all three bots together, so their timing stays linked).
//   node research/capital-split/study.mjs  -> RESULTS.md + results.json
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../../scripts/backtest-report-data-v2.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const NAMES = ['bbcore', 'icore', 'tcore'], LBL = ['BB-CORE', 'I-CORE', 'T-CORE'];
const T0 = Date.UTC(2020, 0, 1) / 1000, END = D.END;
const base = D.run({ from: T0, until: Infinity, end: END, fee: false });
const ALL = base.closed.map((t) => ({ k: NAMES.indexOf(t.bot), t: t.t, x: t.tExit, R: t.R })).sort((a, b) => a.t - b.t);
const mStart = (y, m) => Date.UTC(y, m, 1) / 1000;
const monthEnds = (from, end) => { const o = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth(); for (;;) { const t = mStart(y, m + 1) - 1; if (t > end) break; o.push({ t, even: m % 2 === 1, y, m }); m++; if (m > 11) { m = 0; y++; } } return o; };

// ---- methods
const W50 = [0.5, 0.25, 0.25];
const M = [
  { id: 'self', name: 'Self-compounding (split once, never moved) = TODAY', w: W50 },
  { id: 'cal1', name: 'Rebalance every month', w: W50, every: 1 },
  { id: 'cal2', name: 'Rebalance every 2 months (at the fee date)', w: W50, every: 2 },
  { id: 'cal3', name: 'Rebalance every 3 months', w: W50, every: 3 },
  { id: 'cal6', name: 'Rebalance every 6 months', w: W50, every: 6 },
  { id: 'cal12', name: 'Rebalance once a year (end of Dec)', w: W50, every: 12 },
  { id: 'band5', name: 'Rebalance only if a bot is 5+ points off (checked every 2 months)', w: W50, band: 0.05 },
  { id: 'band10', name: 'Rebalance only if a bot is 10+ points off (checked every 2 months)', w: W50, band: 0.10 },
  { id: 'band15', name: 'Rebalance only if a bot is 15+ points off (checked every 2 months)', w: W50, band: 0.15 },
  { id: 'band10m', name: 'Rebalance only if 10+ points off (checked every month)', w: W50, band: 0.10, check: 1 },
  { id: 'pool', name: 'One shared pool (each trade sized from the whole pool x weight)', w: W50, pool: true },
  { id: 'feeOnly', name: 'Fee-only: take the 20% fee from the overweight bot(s), no transfers', w: W50, feeOver: true },
  { id: 'eq', name: 'Equal 1/3 each, rebalance every 2 months', w: [1 / 3, 1 / 3, 1 / 3], every: 2 },
  { id: 'w403', name: '40/30/30, rebalance every 2 months', w: [0.4, 0.3, 0.3], every: 2 },
  { id: 'w602', name: '60/20/20, rebalance every 2 months', w: [0.6, 0.2, 0.2], every: 2 },
  { id: 'eqSelf', name: 'Equal 1/3 each, self-compounding', w: [1 / 3, 1 / 3, 1 / 3] },
  { id: 'invvol', name: 'Inverse-volatility weights (past 24 months only), every 2 months', w: W50, every: 2, invvol: true },
];

// ---- one run. trades: [{k,t,x,R}], sorted by t. Returns monthly values, event values, final.
function sim(trades, o, from, end, risk = 0.025) {
  const ev = [];
  for (const tr of trades) if (tr.t >= from && tr.x <= end) { ev.push([tr.t, 2, tr]); ev.push([tr.x, 0, tr]); }
  const me = monthEnds(from, end); me.forEach((e, i) => ev.push([e.t, 1, { ...e, i }]));
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const acct = o.w.map((w) => 1000 * w), amt = new Map(), mv = [], hist = [];   // hist: per-bot R per month (for inverse-vol)
  let hwm = 1000, w = o.w.slice(), peak = 1000, dd = 0, moved = 0, nReb = 0, mR = [0, 0, 0];
  const tot = () => acct[0] + acct[1] + acct[2];
  for (const [t, typ, x] of ev) {
    if (typ === 2) { amt.set(x, (o.pool ? tot() * w[x.k] : acct[x.k]) * risk); continue; }
    if (typ === 0) { const p = x.R * amt.get(x); amt.delete(x); acct[x.k] += p; mR[x.k] += x.R; const v = tot(); peak = Math.max(peak, v); dd = Math.max(dd, 1 - v / peak); continue; }
    // month end
    hist.push(mR); mR = [0, 0, 0];
    if (x.even) { // fee
      const bal = tot();
      if (bal > hwm) { const f = 0.2 * (bal - hwm);
        if (o.feeOver) { // take the fee from the accounts above their target first
          const after = bal - f, ex = acct.map((a, j) => Math.max(0, a - after * w[j])), exS = ex[0] + ex[1] + ex[2];
          const fromEx = Math.min(f, exS); for (let j = 0; j < 3; j++) acct[j] -= exS > 0 ? fromEx * ex[j] / exS : 0;
          const rest = f - fromEx; if (rest > 0) { const s = tot(); for (let j = 0; j < 3; j++) acct[j] -= rest * acct[j] / s; }
        } else { const s = (bal - f) / bal; for (let j = 0; j < 3; j++) acct[j] *= s; }
        hwm = bal - f; }
    }
    const mIdx = x.y * 12 + x.m + 1;   // months since year 0, counted at the END of month m
    let doReb = false;
    if (o.every && mIdx % o.every === 0) doReb = true;
    if (o.band != null && mIdx % (o.check || 2) === 0) { const s = tot(); doReb = acct.some((a, j) => Math.abs(a / s - w[j]) > o.band); }
    if (o.invvol && doReb && hist.length >= 24) { const sd = [0, 1, 2].map((j) => { const v = hist.slice(-24).map((h) => h[j]), m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) || 1; }); const iv = sd.map((s) => 1 / s), S = iv[0] + iv[1] + iv[2]; w = iv.map((v) => v / S); }
    if (doReb) { const s = tot(); let mvd = 0; for (let j = 0; j < 3; j++) { mvd += Math.abs(acct[j] - s * w[j]); acct[j] = s * w[j]; } moved += mvd / 2 / s; nReb++; }
    mv.push(tot());
  }
  const fin = tot(), rets = mv.map((v, i) => v / (i ? mv[i - 1] : 1000) - 1);
  return { fin, dd, mv, rets, red: rets.filter((r) => r < 0).length, worst: Math.min(...rets), nReb, moved, wEnd: w, shareEnd: acct.map((a) => a / fin) };
}
const yrs = (from, end) => (end - from) / (365.25 * 86400);
const cagr = (r, from, end) => Math.pow(r.fin / 1000, 1 / yrs(from, end)) - 1;
const pct = (v, d = 0) => (v >= 0 ? '+' : '−') + Math.abs(100 * v).toFixed(d) + '%';
const md = [], P = (s = '') => md.push(s), out = {};
const table = (h, rows) => { P('| ' + h.join(' | ') + ' |'); P('|' + h.map(() => '---').join('|') + '|'); rows.forEach((r) => P('| ' + r.join(' | ') + ' |')); P(); };
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

P('# How to share the money between the three bots: self-compounding vs rebalancing (Nov 19, 2026)');
P(`Trades: the /backtest-data page's (${ALL.length} trades, rules v3, live coins, ${new Date(T0 * 1000).toISOString().slice(0, 10)} to ${new Date(END * 1000).toISOString().slice(0, 10)}). 2.5% of the bot's own account at risk per trade, 20% fee on new profit every 2 months. Rebalancing moves realized money only. Generated by \`node study.mjs\`.`);
P();

// ---- A. full history
P('## A. Full history, ₱1,000 from 1 Jan 2020');
const A = M.map((o) => ({ o, r: sim(ALL, o, T0, END) })), selfA = A[0].r;
table(['Method', 'Final ₱', 'vs today', 'Per year', 'Deepest fall', 'Red months', 'Worst month', 'Rebalances', 'Avg moved each time', 'Split at the end'],
  A.map(({ o, r }) => [o.name, Math.round(r.fin).toLocaleString(), pct(r.fin / selfA.fin - 1), pct(cagr(r, T0, END)), pct(-r.dd), `${r.red}/${r.rets.length}`, pct(r.worst), r.nReb, r.nReb ? pct(r.moved / r.nReb, 1).slice(1) : '–', r.shareEnd.map((s) => Math.round(100 * s)).join('/')]));
out.A = A.map(({ o, r }) => ({ id: o.id, fin: r.fin, dd: r.dd, red: r.red, worst: r.worst, nReb: r.nReb }));

// same at 1% risk (ranking check: less compounding drag)
P('Same, at 1% risk per trade (does the ranking survive a smaller bet size?):');
const A1 = M.map((o) => ({ o, r: sim(ALL, o, T0, END, 0.01) })), self1 = A1[0].r;
table(['Method', 'Final ₱', 'vs today', 'Deepest fall', 'Red months'], A1.map(({ o, r }) => [o.name, Math.round(r.fin).toLocaleString(), pct(r.fin / self1.fin - 1), pct(-r.dd), `${r.red}/${r.rets.length}`]));

// ---- halves
P('## B. Each half on its own (fresh ₱1,000 at the start of each half)');
const HALF = [['2020-2022', T0, Date.UTC(2023, 0, 1) / 1000 - 1], ['2023-Nov 2026', Date.UTC(2023, 0, 1) / 1000, END]];
const hr = M.map((o) => { const row = [o.name]; for (const [, a, b] of HALF) { const s = sim(ALL, M[0], a, b), r = sim(ALL, o, a, b); row.push(`${pct(r.fin / s.fin - 1)} (fall ${pct(-r.dd)})`); } return row; });
table(['Method', ...HALF.map((h) => h[0] + ': money vs today (deepest fall)')], hr);

// ---- C. every start month
P('## C. Every possible start month (paired with self-compounding from the same day)');
P('For each start month, ₱1,000 is put in and held 12 or 24 months under each method. "Beats today" = share of start months where the method ended with more money than self-compounding.');
const starts = []; for (let y = 2020; y <= 2026; y++) for (let m = 0; m < 12; m++) starts.push(mStart(y, m));
const C = {};
for (const H of [12, 24]) {
  const S = starts.filter((s) => { const d = new Date(s * 1000); return mStart(d.getUTCFullYear(), d.getUTCMonth() + H) - 1 <= END; });
  const rows = M.map((o) => { const rel = [], fin = [], dd = []; for (const s of S) { const d = new Date(s * 1000), e = mStart(d.getUTCFullYear(), d.getUTCMonth() + H) - 1, a = sim(ALL, M[0], s, e), b = sim(ALL, o, s, e); rel.push(Math.log(b.fin / a.fin)); fin.push(b.fin / 1000 - 1); dd.push(b.dd); }
    C[o.id + H] = { beat: rel.filter((v) => v > 0).length / rel.length, med: quant(rel, 0.5) };
    return [o.name, S.length, `${Math.round(100 * rel.filter((v) => v > 1e-9).length / rel.length)}%`, pct(Math.exp(quant(rel, 0.5)) - 1), pct(Math.exp(quant(rel, 0.1)) - 1), pct(Math.exp(quant(rel, 0.9)) - 1), pct(quant(fin, 0.1)), `${Math.round(100 * fin.filter((v) => v < 0).length / fin.length)}%`, pct(-quant(dd, 0.5)), pct(-quant(dd, 0.9))]; });
  P(`### ${H}-month holds`);
  table(['Method', 'Starts', 'Beats today', 'Median vs today', 'Bad case vs today (10th pct)', 'Good case (90th)', '10th pct return', 'Windows that lose money', 'Median deepest fall', 'Bad-case fall (90th)'], rows);
}
out.C = C;

// ---- D. bootstrap
P('## D. 1,000 reshuffled histories (6-month blocks, all three bots together)');
P('Real history is one path. Here the 6-month blocks of trades are drawn at random (with replacement) to build 1,000 alternative 7-year histories with the same bots and the same bot-to-bot timing inside each block. Each method runs on every history.');
const BL = 6, nBlocks = Math.floor(((END - T0) / 86400) / 30.44 / BL);
const blocks = []; for (let b = 0; b < nBlocks; b++) { const a = mStart(2020, b * BL), z = mStart(2020, (b + 1) * BL); blocks.push({ a, tr: ALL.filter((t) => t.t >= a && t.t < z) }); }
let seed = 20261119; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const NB = 1000, bootEnd = mStart(2020, nBlocks * BL) + 365 * 86400; // room for the last trades to close
const BS = M.map(() => ({ rel: [], dd: [], fin: [] }));
for (let n = 0; n < NB; n++) {
  const path = []; for (let b = 0; b < nBlocks; b++) { const src = blocks[Math.floor(rnd() * nBlocks)], sh = mStart(2020, b * BL) - src.a; for (const t of src.tr) path.push({ k: t.k, t: t.t + sh, x: t.x + sh, R: t.R }); }
  path.sort((a, b) => a.t - b.t);
  const e = mStart(2020, nBlocks * BL) - 1, tr = path.filter((t) => t.x <= e);
  const s0 = sim(tr, M[0], T0, e);
  M.forEach((o, i) => { const r = i ? sim(tr, o, T0, e) : s0; BS[i].rel.push(Math.log(r.fin / s0.fin)); BS[i].dd.push(r.dd); BS[i].fin.push(Math.log(r.fin / 1000)); });
}
table(['Method', 'Beats today', 'Median vs today', 'Bad case vs today (10th pct)', 'Good case (90th)', 'Median deepest fall', 'Bad-case fall (90th pct)', 'Histories with a 60%+ fall'],
  M.map((o, i) => { const b = BS[i]; return [o.name, `${Math.round(100 * b.rel.filter((v) => v > 1e-9).length / NB)}%`, pct(Math.exp(quant(b.rel, 0.5)) - 1), pct(Math.exp(quant(b.rel, 0.1)) - 1), pct(Math.exp(quant(b.rel, 0.9)) - 1), pct(-quant(b.dd, 0.5)), pct(-quant(b.dd, 0.9)), `${Math.round(100 * b.dd.filter((d) => d >= 0.6).length / NB)}%`]; }));
out.D = M.map((o, i) => ({ id: o.id, beat: BS[i].rel.filter((v) => v > 1e-9).length / NB, med: quant(BS[i].rel, 0.5), ddMed: quant(BS[i].dd, 0.5), dd90: quant(BS[i].dd, 0.9) }));

// ---- E. why: correlation and each bot's swings
P('## E. Why rebalancing helps or hurts here');
const mon = []; for (const e of monthEnds(T0, END)) { const a = mStart(e.y, e.m); mon.push([0, 1, 2].map((k) => ALL.filter((t) => t.k === k && t.x >= a && t.x <= e.t).reduce((s, t) => s + t.R, 0))); }
const col = (k) => mon.map((r) => r[k]), mean = (a) => a.reduce((s, v) => s + v, 0) / a.length, sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const cor = (a, b) => { const ma = mean(a), mb = mean(b); return a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0) * b.reduce((s, v) => s + (v - mb) ** 2, 0)); };
table(['Bot', 'Avg R / month', 'Swing (sd of monthly R)', 'Corr with BB-CORE', 'Corr with I-CORE', 'Corr with T-CORE', 'Months with a loss'], [0, 1, 2].map((k) => [LBL[k], mean(col(k)).toFixed(1), sd(col(k)).toFixed(1), ...[0, 1, 2].map((j) => cor(col(k), col(j)).toFixed(2)), `${col(k).filter((v) => v < 0).length}/${mon.length}`]));
writeFileSync(join(HERE, 'RESULTS.md'), md.join('\n'));
writeFileSync(join(HERE, 'results.json'), JSON.stringify(out, null, 1));
console.log(md.join('\n'));
