// Divergence study (Nov 26 2026). Owner asked: when a live trade is refused, closed by hand or a coin is blocked, later entries on that
// coin change. Does that move the result much, over the whole history and year by year?
// Shared intel engine (v3 rules, live coins), standard costs + real funding, 2020 to Nov 25 2026. Open trades are marked at the last close.
// Run from StrategyBacktester: node research/divergence-nov26/sim.js [runs]
'use strict';
const path = require('path'), fs = require('fs');
const INTEL = path.join(__dirname, '..', '..', 'intel');
const E = require(path.join(INTEL, 'engines/backtest/engine'));
const S = require(path.join(INTEL, 'engines/backtest/strategies'));
const M = require(path.join(INTEL, 'lib/market'));
const cfg = require(path.join(INTEL, 'lib/config'));
const compound = require('./money');
const RUNS = +process.argv[2] || 500;
const BOTS = ['bbcore', 'tcore', 'icore'];
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
const read = (c, tf) => JSON.parse(fs.readFileSync(M.fileOf(c, tf), 'utf8'));

// ---- data, with ATR and signals computed once per coin
function prepare(bot, coin) {
  const B = read(coin, '4h').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const F = read(coin, 'funding'), St = S.bot(bot, 'v3', {});
  const atr = St.atr === 'A' ? E.atrA(B, St.atrLen || 14) : E.atrB(B, St.atrLen || 14), ctx = { B, atr };
  const sig = B.map((_, i) => (i < St.warmup || !(atr[i] > 0) ? null : St.signal(ctx, i)));
  const cum = [0]; for (const [, r] of F) cum.push(cum[cum.length - 1] + r);
  const upto = (x) => { let lo = 0, hi = F.length; while (lo < hi) { const m = (lo + hi) >> 1; if (F[m][0] <= x) lo = m + 1; else hi = m; } return lo; };
  const cost = E.standardCost({ funding: F });
  cost.R = (t) => (t.dir * (t.exit - t.entry) / t.entry - 2 * cost.fee - t.dir * (cum[upto(t.tExit)] - cum[upto(t.t)])) / t.dist;
  return { bot, coin, B, St, atr, sig, cost, plain: E.standardCost({ funding: F }), F };
}

// ---- the intel engine loop with two hooks: refuse(sigIndex) at the fill, and a hand close decided at a candle close (filled next open)
function run(D, h = {}) {
  const { B, St, atr, sig, cost } = D, n = B.length, trades = [];
  let pos = null, pend = null, pendClose = false, lastGap = -Infinity, coolUntil = -1;
  const exit = (raw, ix, why) => {
    const t = { dir: pos.dir, i0: pos.i0, i1: ix, sig: pos.sig, t: B[pos.i0].time, tExit: B[ix].time + St.interval, entry: pos.entry, exit: cost.exitFill(raw, pos.dir), dist: pos.dist, why, bars: ix - pos.i0 + 1 };
    t.R = cost.R(t); trades.push(t);
    if (t.R <= 0 && St.coolBars > 0) coolUntil = ix + St.coolBars;
    pos = null;
  };
  for (let i = 0; i < n; i++) {
    const b = B[i];
    if (i > 0 && b.time - B[i - 1].time !== St.interval) lastGap = i;
    if (pend) {
      const d = pend.dir, fill = cost.entryFill(b.open, d);
      if (!(h.refuse && h.refuse(pend.sig))) {
        if (St.stopMode === 'level') { const dist = Math.abs(fill - pend.stop) / fill; if (dist > 0 && (d === 1 ? pend.stop < fill : pend.stop > fill)) pos = { dir: d, i0: i, sig: pend.sig, entry: fill, stop0: pend.stop, stop: pend.stop, dist, ext: b.open }; }
        else { const stop = fill - d * St.kInit * pend.atr; pos = { dir: d, i0: i, sig: pend.sig, entry: fill, stop0: stop, stop, dist: St.kInit * pend.atr / fill, ext: b.open }; }
        if (pos && h.onOpen) pos.plan = h.onOpen(pos);
      }
      pend = null;
    }
    if (pos && pendClose) exit(b.open, i, 'time');
    pendClose = false;
    if (pos && pos.hand) exit(b.open, i, 'hand');
    if (pos && pos.out) exit(B[i - 1].close, i - 1, 'time');
    if (pos) {
      const long = pos.dir === 1;
      if (long ? b.low <= pos.stop : b.high >= pos.stop) exit(long ? Math.min(b.open, pos.stop) : Math.max(b.open, pos.stop), i, 'stop');
      else if (St.timeExit === 'close' && (St.maxBars > 0 || St.maxBarsAlways) && i - pos.i0 >= St.maxBars) exit(b.close, i, 'time');
      else {
        pos.ext = long ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low);
        if (St.kTrail > 0) { const ns = pos.ext - pos.dir * St.kTrail * atr[i]; if (long ? ns > pos.stop : ns < pos.stop) pos.stop = ns; }
        const oneR = Math.abs(pos.entry - pos.stop0);
        if (St.lockAtR > 0 && pos.dir * (pos.ext - pos.entry) >= St.lockAtR * oneR) { const ls = pos.entry + pos.dir * St.lockToR * oneR; if (long ? ls > pos.stop : ls < pos.stop) pos.stop = ls; }
        if (St.staleBars > 0 && i - pos.i0 >= St.staleBars && pos.dir * (b.close - pos.entry) < St.staleR * oneR) pos.out = true;
      }
    }
    if (pos) {
      if (St.timeExit === 'nextOpen' && St.maxBars > 0 && i - pos.i0 >= St.maxBars) pendClose = true;
      if (pos.plan && pos.plan(i, pos.dir * (b.close - pos.entry) / (pos.dist * pos.entry))) pos.hand = true;
      continue;
    }
    if (i < St.warmup || !(atr[i] > 0)) continue;
    if (St.gapSkip !== false && i - lastGap < St.gapLookback) continue;
    if (i < coolUntil) continue;
    const s = sig[i];
    if (s) pend = { dir: s.dir, stop: s.stop, sig: i, atr: atr[i] };
  }
  if (pos) {   // still open: marked at the last close
    const t = { dir: pos.dir, i0: pos.i0, i1: n - 1, sig: pos.sig, t: B[pos.i0].time, tExit: B[n - 1].time + St.interval, entry: pos.entry, exit: cost.exitFill(B[n - 1].close, pos.dir), dist: pos.dist, why: 'open', bars: n - pos.i0 };
    t.R = cost.R(t); trades.push(t);
  }
  return trades;
}

const data = {};
for (const b of BOTS) data[b] = cfg.bots[b].coins.map((c) => prepare(b, c));

// ---- parity: with no hooks this must equal the shared engine, trade for trade
for (const b of BOTS) for (const D of data[b]) {
  const ref = E.run(D.B, D.St, D.plain).trades, mine = run(D).filter((t) => t.why !== 'open');
  const bad = ref.length !== mine.length || ref.some((t, k) => t.t !== mine[k].t || t.tExit !== mine[k].tExit || Math.abs(t.R - mine[k].R) > 1e-9);
  if (bad) throw new Error(`parity failed ${b} ${D.coin}: ${ref.length} vs ${mine.length}`);
}
console.log('parity with the shared engine: OK on every bot and coin');

// ---- summaries of one full run
function summarise(lists) {   // lists: [trades] of every coin of the chosen bots
  const all = [].concat(...lists).sort((a, b) => a.tExit - b.tExit), yr = Object.fromEntries(YEARS.map((y) => [y, 0])); let eq = 0, pk = 0, dd = 0;
  for (const t of all) { const y = yearOf(t.tExit - 1); if (yr[y] != null) yr[y] += t.R; eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { total: eq, yr, dd, n: all.length };
}
const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const refuse = (p) => (R) => ({ refuse: () => R() < p });
const randomClose = (p) => (R, bot) => ({ onOpen: (pos) => { if (R() >= p) return null; const k = 1 + Math.floor(R() * (bot === 'bbcore' ? 42 : 60)); return (i) => i - pos.i0 + 1 >= k; } });
const takeProfit = (p) => (R) => ({ onOpen: () => { if (R() >= p) return null; const x = 2 + 4 * R(); return (i, openR) => openR >= x; } });
const SCN = [
  ['refuse5', 'Entry refused, 5% of entries', refuse(0.05)],
  ['refuse20', 'Entry refused, 20% of entries', refuse(0.20)],
  ['close10', 'Hand close at a random time, 10% of trades', randomClose(0.10)],
  ['tp10', 'Hand take-profit at +2R to +6R, 10% of trades', takeProfit(0.10)],
  ['tp25', 'Hand take-profit at +2R to +6R, 25% of trades', takeProfit(0.25)],
];
const base = {}; for (const b of BOTS) base[b] = summarise(data[b].map((D) => run(D)));
base.all = summarise([].concat(...BOTS.map((b) => data[b].map((D) => run(D)))));
const baseMoney = compound(Object.fromEntries(BOTS.map((b) => [b, [].concat(...data[b].map((D) => run(D)))])));
const money = {};
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
const results = {};
SCN.forEach(([key, , make], si) => {
  const acc = {}; for (const k of [...BOTS, 'all']) acc[k] = [];
  for (let r = 0; r < RUNS; r++) {
    const R = rng(1000003 * (si + 1) + r), flat = [], per = {};
    for (const b of BOTS) { const lists = data[b].map((D) => run(D, make(R, b))); acc[b].push(summarise(lists)); flat.push(...lists); per[b] = [].concat(...lists); }
    (money[key] = money[key] || []).push(compound(per));
    acc.all.push(summarise(flat));
  }
  results[key] = {};
  for (const k of Object.keys(acc)) {
    const band = (f, bv) => { const v = acc[k].map(f); return { med: q(v, 0.5), p5: q(v, 0.05), p95: q(v, 0.95), worse: v.filter((x) => x < bv).length / v.length }; };
    results[key][k] = { total: band((s) => s.total, base[k].total), dd: band((s) => s.dd, base[k].dd), n: band((s) => s.n, base[k].n), yr: Object.fromEntries(YEARS.map((y) => [y, band((s) => s.yr[y], base[k].yr[y])])) };
  }
  console.log('done', key);
});

// ---- one change at a time: how much of the effect is the changed trade itself, and how much comes from the later entries it moves
const days = (s) => s / 86400;
function single(bot, kind) {
  const rows = [];
  for (const D of data[bot]) {
    const T = run(D), total = T.reduce((a, t) => a + t.R, 0);
    for (const t of T) {
      if (t.why === 'open') continue;
      let h;
      if (kind === 'refuse') h = { refuse: (s) => s === t.sig };
      else { let hit = false; for (let i = t.i0; i < t.i1; i++) if (t.dir * (D.B[i].close - t.entry) / (t.dist * t.entry) >= 3) { hit = true; break; } if (!hit) continue; h = { onOpen: (pos) => (pos.sig === t.sig ? (i, r) => r >= 3 : null) }; }
      const U = run(D, h), delta = U.reduce((a, x) => a + x.R, 0) - total;
      const mine = kind === 'refuse' ? null : U.find((x) => x.sig === t.sig);
      const direct = kind === 'refuse' ? -t.R : mine.R - t.R;
      const key = (x) => `${x.sig}|${x.tExit}`, a = new Set(T.map(key)), c = new Set(U.map(key));
      const diff = [...T.filter((x) => !c.has(key(x))), ...U.filter((x) => !a.has(key(x)))].filter((x) => x.sig !== t.sig);
      rows.push({ coin: D.coin, year: yearOf(t.tExit - 1), direct, knock: delta - direct, changed: diff.length > 0, days: diff.length ? days(Math.max(...diff.map((x) => x.tExit)) - t.t) : 0 });
    }
  }
  return rows;
}
const singles = {}; for (const b of BOTS) singles[b] = { refuse: single(b, 'refuse'), tp3: single(b, 'tp3') };

// ---- T-CORE with SOL blocked (the old I-CORE short sitting in its account)
const sol = data.tcore.find((D) => D.coin === 'SOL'), solYears = summarise([run(sol)]);
const LIVE_SIG = Date.UTC(2026, 10, 8, 20) / 1000;   // first SOL signal candle the live T-CORE skipped as blocked
const old = { ...sol, St: S.bot('tcore', 'legacy') };
old.sig = old.B.map((_, i) => (i < old.St.warmup ? null : old.St.signal({ B: old.B, atr: old.atr }, i)));
const missed = run(old, { refuse: (s) => old.B[s].time < LIVE_SIG }).filter((t) => old.B[t.sig].time >= LIVE_SIG).map((t) => ({ signal: new Date(old.B[t.sig].time * 1000).toISOString(), dir: t.dir, R: t.R, why: t.why, exit: new Date(t.tExit * 1000).toISOString() }));

// ---- report
const f = (x) => (Math.round(x) >= 0 ? '+' : '−') + Math.abs(Math.round(x)).toLocaleString('en-US');
const f2 = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
const pc = (x) => Math.round(100 * x) + '%';
const LABEL = { bbcore: 'BB-CORE', tcore: 'T-CORE', icore: 'I-CORE', all: 'All three bots' };
const out = ['# Divergence study: refused entries, hand closes and a blocked coin (Nov 26 2026)', '',
  `Shared engine, v3 rules, live coins, standard costs + funding, 2020 to Nov 25 2026, open trades marked at the last close. ${RUNS} random runs per scenario. Results in R (1R = the amount risked on one trade), not compounded. Cells: middle run (5th to 95th percentile).`, ''];
for (const k of ['all', ...BOTS]) {
  out.push(`## ${LABEL[k]}`, '', '| Year | Bot as is | ' + SCN.map((s) => s[1]).join(' | ') + ' |', '|---|' + '---|'.repeat(SCN.length + 1));
  const cell = (b) => `${f(b.med)} (${f(b.p5)} to ${f(b.p95)})`;
  for (const y of YEARS) out.push(`| ${y}${y === 2026 ? ' (to Nov 25)' : ''} | ${f(base[k].yr[y])} | ` + SCN.map(([s]) => cell(results[s][k].yr[y])).join(' | ') + ' |');
  out.push(`| **Total** | **${f(base[k].total)}** | ` + SCN.map(([s]) => `**${cell(results[s][k].total)}**`).join(' | ') + ' |');
  out.push(`| Change vs as is (middle run) | — | ` + SCN.map(([s]) => pc(results[s][k].total.med / base[k].total - 1)).join(' | ') + ' |');
  out.push(`| Runs that ended below as is | — | ` + SCN.map(([s]) => pc(results[s][k].total.worse)).join(' | ') + ' |');
  out.push(`| Largest closed drop, R | ${base[k].dd.toFixed(0)} | ` + SCN.map(([s]) => `${results[s][k].dd.med.toFixed(0)} (${results[s][k].dd.p5.toFixed(0)} to ${results[s][k].dd.p95.toFixed(0)})`).join(' | ') + ' |');
  out.push(`| Trades | ${base[k].n} | ` + SCN.map(([s]) => `${results[s][k].n.med}`).join(' | ') + ' |', '');
}
const peso = (x) => '₱' + (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : Math.round(x).toLocaleString('en-US'));
out.push('## Money view: TRI-CORE 50/25/25, ₱1,000 from Apr 2020, compounded monthly', '', '| Scenario | Middle run | Bad luck (5th pct) | Good luck (95th pct) | Middle run vs as is | Worst fall from a high (middle) |', '|---|---|---|---|---|---|');
out.push(`| Bot as is | ${peso(baseMoney.eq)} | — | — | — | ${pc(baseMoney.worst)} |`);
for (const [s, name] of SCN) { const e = money[s].map((m) => m.eq); out.push(`| ${name} | ${peso(q(e, 0.5))} | ${peso(q(e, 0.05))} | ${peso(q(e, 0.95))} | ${pc(q(e, 0.5) / baseMoney.eq - 1)} | ${pc(q(money[s].map((m) => m.worst), 0.5))} |`); }
out.push('', '## Biggest trades of 2025 (what the wide ranges depend on)', '', '| Bot | Coin | Entry (UTC) | R | Share of that bot 2025 |', '|---|---|---|---|---|');
let topSum = 0, yrSum = 0;
for (const b of BOTS) { const t = [].concat(...data[b].map((D) => run(D).filter((x) => yearOf(x.tExit - 1) === 2025).map((x) => ({ ...x, coin: D.coin })))).sort((x, y) => y.R - x.R).slice(0, 3); yrSum += base[b].yr[2025];
  for (const x of t) { topSum += x.R; out.push(`| ${LABEL[b]} | ${x.coin} | ${new Date(x.t * 1000).toISOString().slice(0, 10)} | ${f2(x.R)} | ${pc(x.R / base[b].yr[2025])} |`); } }
out.push(`| **Total** | — | 9 trades | **${f2(topSum)}** | **${pc(topSum / yrSum)}** |`, '');
out.push('## One change at a time (every historical trade, changed alone)', '', '"Own effect" = the changed trade itself. "Later entries" = what the moved entries afterwards added or removed.', '');
for (const [kind, title] of [['refuse', 'The entry is refused'], ['tp3', 'The trade is closed by hand at +3R (only trades that reached +3R)']]) {
  out.push(`### ${title}`, '', '| Bot | Changes tested | Own effect, avg R | Later entries, avg R | Later entries, 5th to 95th pct | No later entry moved | Days until back in step (middle / 90th pct) |', '|---|---|---|---|---|---|---|');
  const line = (name, r) => { const mv = r.filter((x) => x.changed); out.push(`| ${name} | ${r.length} | ${f2(r.reduce((a, x) => a + x.direct, 0) / r.length)} | ${f2(r.reduce((a, x) => a + x.knock, 0) / r.length)} | ${f2(q(r.map((x) => x.knock), 0.05))} to ${f2(q(r.map((x) => x.knock), 0.95))} | ${pc(1 - mv.length / r.length)} | ${q(mv.map((x) => x.days), 0.5).toFixed(0)} / ${q(mv.map((x) => x.days), 0.9).toFixed(0)} |`); };
  for (const b of BOTS) line(LABEL[b], singles[b][kind]);
  line('**Total**', [].concat(...BOTS.map((b) => singles[b][kind])));
  out.push('', '| Year | ' + BOTS.map((b) => `${LABEL[b]} own / later`).join(' | ') + ' | All own / later |', '|---|---|---|---|---|');
  const pair = (r) => (r.length ? `${f2(r.reduce((a, x) => a + x.direct, 0) / r.length)} / ${f2(r.reduce((a, x) => a + x.knock, 0) / r.length)}` : '—');
  for (const y of YEARS) out.push(`| ${y} | ` + BOTS.map((b) => pair(singles[b][kind].filter((x) => x.year === y))).join(' | ') + ` | ${pair([].concat(...BOTS.map((b) => singles[b][kind])).filter((x) => x.year === y))} |`);
  out.push(`| **Total** | ` + BOTS.map((b) => pair(singles[b][kind])).join(' | ') + ` | ${pair([].concat(...BOTS.map((b) => singles[b][kind])))} |`, '');
}
out.push('## T-CORE with SOL blocked', '', '| Year | T-CORE as is | T-CORE without SOL | SOL part | SOL part per 30 days |', '|---|---|---|---|---|');
const span = (y) => { const B = sol.B, a = Math.max(Date.UTC(y, 0, 1) / 1000, B[sol.St.warmup].time), z = Math.min(Date.UTC(y + 1, 0, 1) / 1000, B[B.length - 1].time); return Math.max(0, days(z - a)); };
let sd = 0;
for (const y of YEARS) { const d = span(y); sd += d; out.push(`| ${y} | ${f(base.tcore.yr[y])} | ${f(base.tcore.yr[y] - solYears.yr[y])} | ${f(solYears.yr[y])} | ${d > 20 ? f2(solYears.yr[y] / d * 30) : '—'} |`); }
out.push(`| **Total** | **${f(base.tcore.total)}** | **${f(base.tcore.total - solYears.total)}** | **${f(solYears.total)}** | **${f2(solYears.total / sd * 30)}** |`, '', 'SOL trades a flat T-CORE would have taken since the first blocked signal:', '', '| Signal candle (UTC) | Side | Result R | State |', '|---|---|---|---|');
for (const m of missed) out.push(`| ${m.signal.slice(0, 16)} | ${m.dir === 1 ? 'long' : 'short'} | ${f2(m.R)} | ${m.why === 'open' ? 'still open, marked at last close' : m.why + ' ' + m.exit.slice(0, 16)} |`);
out.push(`| **Total** | ${missed.length} trade(s) | **${f2(missed.reduce((a, m) => a + m.R, 0))}** | — |`);
fs.writeFileSync(path.join(__dirname, 'results.md'), out.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ runs: RUNS, base, results, missed }, null, 1));
console.log(out.join('\n'));
