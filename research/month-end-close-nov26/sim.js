// sim.js — Nov 26 2026: what if every open trade is closed at each monthly settlement (12:00am Manila on the 1st = 16:00 UTC on the
// last day of the month), against the bots as they run today? Same signals, same sizing; only the forced close is added.
// Engine = ../replace-nov25/sim.js (live rules: BB-CORE v4 x1.05, I-CORE v3, T-CORE v3), one pooled account, shared 50/25/25 sizing,
// fixed risk per trade, Binance 4h + real funding, fees 0.05% + slippage 0.02% per side, Jan 2020 -> Nov 24 2026.
// Investor money: P1,000 into the pool, 20% profit share at every monthly settlement above a high-water mark (open trades counted, as the ledger does).
//   node sim.js   -> RESULTS.md + results.json
'use strict';
const fs = require('fs'), path = require('path');
const S = require('../replace-nov25/sim');
const CFG = require('../../intel/config.json').bots;
const { IV, END, FEE, SLIP } = S;
const ts = (y, m = 0, d = 1, h = 0) => Date.UTC(y, m, d, h) / 1000, T0 = ts(2020), YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const COINS = { bb: CFG.bbcore.coins, ic: [...new Set([...CFG.icore.coins, 'ETH'])], tc: CFG.tcore.coins };   // ETH added to I-CORE live on Nov 14
const BOTS = (bbKind = 'bbT', bbMult = 1.05, coins = COINS) => [{ name: 'BB-CORE', kind: bbKind, coins: coins.bb, weight: 0.5, mult: bbMult }, { name: 'I-CORE', kind: 'ic', coins: coins.ic, weight: 0.25, mult: 1 }, { name: 'T-CORE', kind: 'tc', coins: coins.tc, weight: 0.25, mult: 1 }];

// ---------- when is the forced close ----------
const atManilaDay = (day) => (t) => { const d = new Date((t + 8 * 3600) * 1000); return d.getUTCDate() === day && d.getUTCHours() === 0; };
const atUtcMonthEnd = (t) => { const d = new Date(t * 1000); return d.getUTCDate() === 1 && d.getUTCHours() === 0; };
const SETTLE = atManilaDay(1);

// ---------- the pooled account ----------
// o: { risk (fixed) | tiers: true, cut(closeTime) -> bool, which: 'all' | 'win' | 'lose' | 'reopen', specs, start }
function account(bots, o) {
  const start = o.start ?? 1;
  const W = bots.map((b) => ({ ...b, bal: start * b.weight, margin: 0, peakBase: 0,
    m: b.coins.map((c) => { const x = S.real(c), p = new S.Pos(x, b.kind); let i = 0; while (i < x.n && x.T[i] < T0) i++; return { p, x, i, unit: o.specs ? o.specs[c] : null }; }) }));
  let t0 = Infinity; for (const w of W) for (const c of w.m) if (c.i < c.x.n) t0 = Math.min(t0, c.x.T[c.i]);
  const curve = [], trades = [], forced = []; let equity = start, lastQ = null, reopenCost = 0;
  const openValue = (c, i) => { const p = c.p.pos; return p ? p.size * (p.dir * (c.x.C[i] - p.entry) / p.entry - 2 * c.p.fee - p.dir * (c.x.FS[i + 1] - c.x.FS[p.i0])) : 0; };
  for (let t = t0; t + IV <= END; t += IV) {
    const d = new Date(t * 1000), q = d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3);
    if (lastQ !== null && q !== lastQ) {
      const total = W.reduce((a, w) => a + w.bal, 0), want = W.map((w) => total * w.weight - w.bal);
      const give = want.map((v, k) => (v < 0 ? Math.min(-v, Math.max(0, W[k].bal - W[k].margin)) : 0)), pot = give.reduce((a, v) => a + v, 0), need = want.reduce((a, v) => a + Math.max(0, v), 0);
      W.forEach((w, k) => { w.bal += want[k] > 0 ? (need > 0 ? (pot * want[k]) / need : 0) : -give[k]; });
    }
    lastQ = q;
    const closing = o.cut ? o.cut(t + IV) : false;
    for (const w of W) for (const c of w.m) {
      const i = c.i; if (i >= c.x.n || c.x.T[i] !== t) continue;
      const book = (tr) => { w.bal += tr.size * tr.R * tr.dist; trades.push({ ...tr, bot: w.name, wt: w.weight * tr.w }); };
      c.p.open(i, (m, o2) => {
        const base = equity * w.weight; w.peakBase = Math.max(w.peakBase, base);
        const pct = o.tiers ? (w.peakBase >= 1000 ? 0.015 : w.peakBase >= 500 ? 0.02 : 0.025) : o.risk, target = pct * base * o2.w;
        if (!(target > 0)) return null;
        let size = target / o2.dist;
        if (c.unit) { const one = c.unit.unit, per = one * o2.dist; let vol = Math.max(c.unit.minVol, Math.round(target / per)); while (vol >= c.unit.minVol && vol * per > 1.5 * target) vol--; if (vol < c.unit.minVol) return null; size = vol * one; }
        const lev = Math.max(1, Math.min(20, Math.floor(0.5 / (o2.dist + (c.unit?.mmr || 0.004))))), margin = size / lev;
        if (c.unit && !(w.bal - w.margin >= margin * 1.1)) return null;
        w.margin += margin; return { size, margin };
      }, book);
      const p = c.p.pos;
      if (closing && p) {
        const up = p.dir * (c.x.C[i] - p.entry) > 0;
        if (o.which === 'reopen') {   // close and open the same trade again at once: only one extra round of fees and slippage; same size, same stop
          const cost = 2 * (FEE + SLIP); w.bal -= p.size * cost; reopenCost += cost / p.dist * w.weight * p.w; forced.push({ bot: w.name, c: c.x.coin, i0: p.i0, up });
        } else if (o.which === 'all' || (o.which === 'win' ? up : !up)) {
          forced.push({ bot: w.name, c: c.x.coin, i0: p.i0, up }); c.p.exit(c.x.C[i], i, 'month', book);
        }
      }
    }
    let eq = 0;
    for (const w of W) {
      w.margin = 0; let open = 0;
      for (const c of w.m) { const i = c.i; if (i < c.x.n && c.x.T[i] === t) { c.p.shut(i, w.mult || 1); c.last = i; c.i++; }
        if (c.p.pos) { w.margin += c.p.pos.margin; open += openValue(c, c.last); } }
      eq += w.bal + open;
    }
    equity = Math.max(0, eq);
    curve.push([t + IV, equity]);
  }
  return { curve, trades, forced, reopenCost };
}

// ---------- investor money on top of a pool curve ----------
const BOUNDS = []; for (let y = 2020, m = 1; ; m++) { if (m === 12) { m = 0; y++; } const b = ts(y, m, 1) - 8 * 3600; if (b >= END) break; BOUNDS.push(b); }
const yStart = (y) => (y === 2020 ? T0 : ts(y, 0, 1) - 8 * 3600), yEnd = (y) => (y === 2026 ? END : ts(y + 1, 0, 1) - 8 * 3600);
function investor(curve, a, b, { fee = 0.2, adds = [] } = {}) {
  let k = 0; while (k < curve.length && curve[k][0] <= a) k++;
  let ref = k ? curve[k - 1][1] : curve[0][1], base = 1000, hwm = 1000, v = 1000, peak = 1000, fall = 0, fees = 0, paidIn = 1000, nFee = 0, prevMonth = 1000, flowIn = 0;
  const months = [], isB = new Set(BOUNDS), addAt = new Set(adds);
  for (; k < curve.length && curve[k][0] <= b; k++) {
    const [t, e] = curve[k]; v = base * e / ref;
    const last = t === b || k === curve.length - 1;
    if (isB.has(t) || last) {
      const f = fee * Math.max(0, v - hwm); if (f > 0) { v -= f; hwm = v; fees += f; nFee++; }
      months.push((v - flowIn) / prevMonth - 1); flowIn = 0; prevMonth = v; base = v; ref = e;
      if (addAt.has(t) && !last) { v += 1000; base = v; hwm += 1000; paidIn += 1000; prevMonth = v; peak += 1000; }
    }
    peak = Math.max(peak, v); fall = Math.max(fall, 1 - v / peak);
  }
  return { end: v, fees, nFee, fall, months, paidIn };
}

// ---------- trade statistics ----------
function rstats(run, a = T0, b = END) {
  const t = run.trades.filter((x) => x.tExit > a && x.tExit <= b).sort((p, q) => p.tExit - q.tExit || p.t - q.t);
  let R = 0, pk = 0, dd = 0, win = 0; const by = {};
  for (const x of t) { const r = x.wt * x.R; R += r; pk = Math.max(pk, R); dd = Math.max(dd, pk - R); if (x.R > 0) win++; by[x.bot] = (by[x.bot] || 0) + x.R; }
  const top = t.map((x) => x.wt * x.R).sort((p, q) => q - p).slice(0, 10).reduce((s, v) => s + v, 0);
  return { n: t.length, R, dd, win: win / t.length, by, ex10: R - top, forced: t.filter((x) => x.why === 'month').length };
}

// ---------- run ----------
const RISK = 0.025;
const V = {
  cur: ['Today (no forced close)', {}],
  all: ['Close ALL at settlement', { cut: SETTLE, which: 'all' }],
  win: ['Close only winners at settlement', { cut: SETTLE, which: 'win' }],
  lose: ['Close only losers at settlement', { cut: SETTLE, which: 'lose' }],
  reopen: ['Close all + re-open the same trades at once', { cut: SETTLE, which: 'reopen' }],
  utc: ['Close all at month end UTC (8h later)', { cut: atUtcMonthEnd, which: 'all' }],
  d8: ['Close all on the 8th instead', { cut: atManilaDay(8), which: 'all' }],
  d15: ['Close all on the 15th instead', { cut: atManilaDay(15), which: 'all' }],
  d22: ['Close all on the 22nd instead', { cut: atManilaDay(22), which: 'all' }],
};
const RUN = {}; for (const [k, [, o]] of Object.entries(V)) RUN[k] = account(BOTS(), { risk: RISK, ...o });

const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d), pc = (v, d = 0) => (100 * v).toFixed(d) + '%';
const int = (v) => Math.round(v).toLocaleString('en-US'), peso = (v) => '₱' + (v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : int(v));
const ret = (v) => (v >= 0 ? '+' : '') + int(v * 100) + '%';
const md = [], out = {};
const table = (head, rows) => md.push('| ' + head.join(' | ') + ' |', '|' + '---|'.repeat(head.length), ...rows.map((r) => '| ' + r.join(' | ') + ' |'), '');
md.push('# Close every open trade at the monthly settlement? (Nov 26 2026)', '', 'Today = BB-CORE v4 (x1.05), I-CORE v3, T-CORE v3, live coins, one pool sized 50/25/25, 2.5% risk per trade, Jan 2020 to Nov 24 2026. Settlement = 12:00am Manila on the 1st. Investor columns: ₱1,000 in, 20% profit share monthly above a high-water mark. Peso rate held fixed. Backtest, not live results; BB v4 rules were chosen on this same history.', '');
md.push('**Verdict: REJECTED.** Closing every open trade at settlement ends behind today over the whole history at every risk level tried, and in 5 of 7 calendar years (ahead in 2022 and 2026). It cuts the long trend trades that pay for the system. Nothing was changed on the bots.', '', 'In section 3 the R columns count a trade in the year it closes, while the peso columns value open trades at year end, so the two can point different ways for one year.', '');

// 1. summary
md.push('## 1. Whole history', '');
table(['Version', 'Trades', 'Closed by the rule', 'Win rate', 'Total R (weighted)', 'Without best 10', 'Worst drop (R, closed)', 'BB / I / T raw R'], Object.keys(V).map((k) => {
  const s = rstats(RUN[k]), R = s.R - RUN[k].reopenCost;
  return [V[k][0], int(s.n), int(RUN[k].forced.length), pc(s.win, 1), f(R), f(s.ex10 - RUN[k].reopenCost), s.dd.toFixed(1) + (k === 'reopen' ? ' (before extra fees)' : ''), k === 'reopen' ? 'as today, minus fees' : ['BB-CORE', 'I-CORE', 'T-CORE'].map((n) => f(s.by[n])).join(' / ')];
}));

// 2. full compounding
md.push('## 2. One ₱1,000, left in from Jan 2020 (full compounding)', '');
for (const k of Object.keys(V)) { const g = investor(RUN[k].curve, T0, END, { fee: 0 }), n = investor(RUN[k].curve, T0, END); out[k] = { label: V[k][0], gross: g, net: n }; }
table(['Version', 'Before profit share', 'Investor after 20%', 'vs today', 'Profit share paid', 'Deepest fall (after fee)', 'Months up / down', 'Worst month'], Object.keys(V).map((k) => {
  const { gross: g, net: n } = out[k];
  return [V[k][0], peso(g.end), '**' + peso(n.end) + '**', k === 'cur' ? '—' : f((n.end / out.cur.net.end - 1) * 100) + '%', peso(n.fees), pc(n.fall), `${n.months.filter((v) => v > 1e-12).length} / ${n.months.filter((v) => v < -1e-12).length}`, pc(Math.min(...n.months), 1)];
}));

// risk sensitivity
md.push('### Same, at lower risk per trade (investor after 20%)', '');
const sens = {};
table(['Risk per trade', 'Today', 'Close all', 'Close all + re-open', 'Close-all vs today', 'Deepest fall today / close all'], [0.005, 0.01, 0.015, 0.025].map((r) => {
  const x = {}; for (const k of ['cur', 'all', 'reopen']) x[k] = investor((r === RISK ? RUN[k] : account(BOTS(), { risk: r, ...V[k][1] })).curve, T0, END);
  sens[r] = x; return [pc(r, 1), peso(x.cur.end), peso(x.all.end), peso(x.reopen.end), f((x.all.end / x.cur.end - 1) * 100) + '%', pc(x.cur.fall) + ' / ' + pc(x.all.fall)];
}));

// 3. each year fresh
md.push('## 3. ₱1,000 put in fresh at the start of each year (2.5% risk)', '');
const yrs = {};
for (const [title, r] of [['2.5% risk', RISK], ['1% risk', 0.01]]) {
  const runs = {}; for (const k of ['cur', 'all', 'reopen']) runs[k] = r === RISK ? RUN[k] : account(BOTS(), { risk: r, ...V[k][1] });
  if (r !== RISK) md.push('### The same at 1% risk', '');
  yrs[r] = YEARS.map((y) => { const o = { y }; for (const k of ['cur', 'all', 'reopen']) { o[k] = investor(runs[k].curve, yStart(y), yEnd(y)); o[k + 'G'] = investor(runs[k].curve, yStart(y), yEnd(y), { fee: 0 }); } o.sc = rstats(runs.cur, yStart(y), yEnd(y)); o.sa = rstats(runs.all, yStart(y), yEnd(y)); return o; });
  table(['Year', 'Today: ₱1,000 becomes', 'Close all: becomes', 'Difference', 'Close all + re-open', 'Before fee: today / close all', 'Profit share paid: today / close all', 'Deepest fall: today / close all', 'Months up: today / close all', 'R: today / close all'], yrs[r].map((o) => [
    o.y + (o.y === 2026 ? ' (to Nov 24)' : ''), peso(o.cur.end), peso(o.all.end), (o.all.end >= o.cur.end ? '+' : '−') + peso(Math.abs(o.all.end - o.cur.end)), peso(o.reopen.end), peso(o.curG.end) + ' / ' + peso(o.allG.end), peso(o.cur.fees) + ' / ' + peso(o.all.fees), pc(o.cur.fall) + ' / ' + pc(o.all.fall), `${o.cur.months.filter((v) => v > 1e-12).length} / ${o.all.months.filter((v) => v > 1e-12).length} of ${o.cur.months.length}`, f(o.sc.R) + ' / ' + f(o.sa.R)]));
  const tot = (k) => yrs[r].reduce((s, o) => s + o[k].end, 0);
  md.push(`Seven separate ₱1,000 (₱7,000 in): today ${peso(tot('cur'))}, close all ${peso(tot('all'))}, close + re-open ${peso(tot('reopen'))}.`, '');
}

md.push('### One ₱1,000 from 2020, balance at the end of each year (after fee, 2.5% risk)', '');
table(['End of year', 'Today', 'Close all'], YEARS.map((y) => [y + (y === 2026 ? ' (Nov 24)' : ''), peso(investor(RUN.cur.curve, T0, yEnd(y)).end), peso(investor(RUN.all.curve, T0, yEnd(y)).end)]));

// 4. add 1k every year
md.push('## 4. Add ₱1,000 at the start of every year and never withdraw (₱7,000 in total)', '');
const adds = YEARS.slice(1).map(yStart), add = {};
table(['Risk per trade', 'Today', 'Close all', 'Close all + re-open'], [0.005, 0.01, 0.015, 0.025].map((r) => { add[r] = {}; for (const k of ['cur', 'all', 'reopen']) add[r][k] = investor((r === RISK ? RUN[k] : account(BOTS(), { risk: r, ...V[k][1] })).curve, T0, END, { adds }); return [pc(r, 1), peso(add[r].cur.end), peso(add[r].all.end), peso(add[r].reopen.end)]; }));

// 5. every start month
md.push('## 5. Every possible start month (investor after fee, 2.5% risk)', '');
const roll = {};
table(['Time in the pool', 'Start months tried', 'Close all beats today', 'Median ₱1,000: today / close all', 'Worst: today / close all', 'Ended below ₱1,000: today / close all', 'Close all + re-open beats today'], [1, 3, 6, 12, 24, 36].map((h) => {
  const rows = []; for (let s = 0; s + h < BOUNDS.length; s++) rows.push(Object.fromEntries(['cur', 'all', 'reopen'].map((k) => [k, investor(RUN[k].curve, BOUNDS[s], BOUNDS[s + h]).end])));
  const med = (k) => rows.map((r) => r[k]).sort((a, b) => a - b)[rows.length >> 1], min = (k) => Math.min(...rows.map((r) => r[k])), sh = (fn) => rows.filter(fn).length / rows.length;
  roll[h] = { n: rows.length, beat: sh((r) => r.all > r.cur), med: [med('cur'), med('all')] };
  return [h + (h === 1 ? ' month' : ' months'), rows.length, pc(roll[h].beat), peso(med('cur')) + ' / ' + peso(med('all')), peso(min('cur')) + ' / ' + peso(min('all')), pc(sh((r) => r.cur < 1000)) + ' / ' + pc(sh((r) => r.all < 1000)), pc(sh((r) => r.reopen > r.cur))];
}));

// 6. why: what happened to the trades that the rule cut
md.push('## 6. Why: the trades that were open at a settlement', '', 'Each forced close is matched with the same trade (same bot, coin, entry candle) left alone in today\'s run. Raw R, unweighted.', '');
const keyOf = (x) => x.bot + '|' + x.c + '|' + x.i0, curMap = new Map(RUN.cur.trades.map((t) => [keyOf(t), t]));
const matched = RUN.all.trades.filter((t) => t.why === 'month').map((t) => ({ t, c: curMap.get(keyOf(t)) })).filter((x) => x.c);
const grp = (name, list) => { const a = list.reduce((s, x) => s + x.t.R, 0), b = list.reduce((s, x) => s + x.c.R, 0); return [name, int(list.length), f(a), f(b), f(a - b), pc(list.filter((x) => x.c.R > x.t.R).length / list.length)]; };
table(['Open at settlement', 'Trades', 'R if closed there', 'R if left alone', 'Closing gains / loses', 'Better left alone'], [grp('All', matched), grp('In profit at the close', matched.filter((x) => x.t.R > 0)), grp('In loss at the close', matched.filter((x) => x.t.R <= 0)), ...['BB-CORE', 'I-CORE', 'T-CORE'].map((n) => grp(n, matched.filter((x) => x.t.bot === n)))]);
const open = RUN.cur.curve.length; const counts = BOUNDS.map((b) => RUN.cur.trades.filter((t) => t.t < b && t.tExit > b).length);
md.push(`Trades open at a settlement (today's run, closed trades only): average ${(counts.reduce((s, v) => s + v, 0) / counts.length).toFixed(1)}, most ${Math.max(...counts)}; settlements with nothing open: ${counts.filter((v) => !v).length} of ${counts.length}.`, '');

// 7. month by month, current year
md.push('## 7. 2026 month by month, ₱1,000 from Jan 1 (after fee, 2.5% risk)', '');
const m26c = investor(RUN.cur.curve, yStart(2026), END).months, m26a = investor(RUN.all.curve, yStart(2026), END).months;
let vc = 1000, va = 1000; table(['Month', 'Today', 'value', 'Close all', 'value'], m26c.map((r, i) => { vc *= 1 + r; va *= 1 + m26a[i]; return [['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov 1-24'][i], f(r * 100, 1) + '%', peso(vc), f(m26a[i] * 100, 1) + '%', peso(va)]; }));

// 8. checks
md.push('## 8. Checks', '');
const D = require('../zec-replacement-2/detail.json'), list = Array.isArray(D) ? D : D.data || Object.values(D), SPECS = {};
const OLD = { bb: CFG.bbcore.coins, ic: CFG.icore.coins, tc: CFG.tcore.coins };
for (const c of new Set(Object.values(OLD).flat())) { const d = list.find((s) => s.symbol === c + '_USDT'), x = S.real(c); SPECS[c] = { unit: d.contractSize * x.C[x.n - 1], minVol: d.minVol || 1, mmr: d.maintenanceMarginRate }; }
const par = account(BOTS('bb', 1, OLD), { tiers: true, specs: SPECS, start: 1000 / 58 }), parEnd = par.curve[par.curve.length - 1][1] * 58;
md.push(`- Engine parity: with the earlier study's settings this loop gives ₱${int(parEnd)}; replace-nov25/TRICORE-7Y.md says ₱26,768,963.`);
const s3 = account(BOTS('bb', 1), { risk: RISK }), s3a = account(BOTS('bb', 1), { risk: RISK, ...V.all[1] });
const e3 = investor(s3.curve, T0, END).end, e3a = investor(s3a.curve, T0, END).end;
md.push(`- Without the new BB-CORE v4 rules (v3): today ${peso(e3)} (${f(rstats(s3).R)}R), close all ${peso(e3a)} (${f(rstats(s3a).R)}R), close all vs today ${f((e3a / e3 - 1) * 100)}%.`);
const bad = RUN.all.trades.filter((t) => t.why === 'month' && !SETTLE(t.tExit)).length, across = RUN.all.trades.filter((t) => BOUNDS.some((b) => t.t < b && t.tExit > b)).length;
md.push(`- Close-all run: forced closes at a wrong time ${bad}; trades still held across a settlement ${across} (should be 0, apart from missing candles).`);

fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ full: out, sens, yrs, add, roll }, (k, v) => (k === 'months' ? undefined : typeof v === 'number' ? +v.toFixed(4) : v), 1));
console.log(md.join('\n'));
