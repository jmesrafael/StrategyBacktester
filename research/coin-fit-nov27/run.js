// run.js - Nov 27 2026: which coins suit each strategy, and does "positive every year so far" predict the next year? Read-only.
//   node --max-old-space-size=8192 run.js  -> results.json   (then node report.js -> RESULTS.md + report.html)
// Strategies (engines already in the repo): BB 1H WIDE (2.6σ), BB 1H (2.0σ) = ../hunt-1h-nov26 ; BB 4H v4 (x1.05), I-CORE v3, T-CORE v3 = ../replace-nov25/sim.js
// Coins: every coin in ../../candles (90). A coin can be PICKED only if MEXC lists it and trades >= US$500k a day (MEXC ticker Nov 12 2026), live coins always.
// Walk-forward: for test year Y (2022..2026) a coin passes if it was positive in EVERY earlier full year (at least 2), using only data before Y.
//   Picks = the best N passers by R per R of fall in the earlier years (N = the bot's live coin count). Judged on year Y only.
// Money: PHP 1,000 at live sizing (2.5% / 2% / 1.5% steps), MEXC minimums, hourly-marked, from Jan 1 2022, coin set re-picked every Jan 1.
'use strict';
const fs = require('fs');
const S = require('../replace-nov25/sim');
const C = require('../../candles/candles.js');
const L1 = require('../hunt-1h-nov26/lib.js'), FV = require('../hunt-1h-nov26/fam-vol.js');
const DET = require('../zec-replacement-2/detail.json'), DL = Array.isArray(DET) ? DET : DET.data || Object.values(DET);

const H = 3600, ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, T0 = ts(2020), END = S.END, PHP = 60, START = 1000, FEE = 0.0005;
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026], TEST = [2022, 2023, 2024, 2025, 2026], M0 = ts(2022);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const CJ = require('../../candles/coins.json'), ALL = [...CJ.bots, ...CJ.extra, ...CJ.history];
const LIVE = { wide: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'], bb1h: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'], bb4: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'],
  ic: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH'], tc: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'] };

// ---------- liquidity + MEXC contract ----------
const liq = {};
for (const f of ['universe.json', 'top100.json']) for (const c of require('../zec-replacement/' + f).coins) if (c.mexcUsd24h != null) liq[c.coin] = Math.max(liq[c.coin] || 0, c.mexcUsd24h);
const mexcSym = (c) => (c === 'FIL' ? 'FILECOIN' : c === '1000SHIB' ? 'SHIB' : c === '1000XEC' ? 'XEC' : c) + '_USDT';
// MEXC ticker snapshot of Nov 12 2026 (all contracts): amount24 = US$ traded in 24h
{ const TK = require('../zec-replacement-2/ticker.json'), TL = Array.isArray(TK) ? TK : TK.data || Object.values(TK);
  for (const c of ALL) { const t = TL.find((x) => x.symbol === mexcSym(c)); if (t && t.amount24) liq[c] = Math.max(liq[c] || 0, t.amount24); } }
const LIQ_MIN = 5e5, LIVEALL = new Set(Object.values({ a: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB', 'ETH', 'SUI'] }).flat());
const SPEC = {};
for (const c of ALL) { const d = DL.find((s) => s.symbol === mexcSym(c)); if (d) SPEC[c] = { cs: d.contractSize, minVol: d.minVol || 1, mmr: d.maintenanceMarginRate || 0.004 }; }
// 1000SHIB / 1000XEC are priced per 1,000 on Binance; MEXC SHIB/XEC are per coin, so their contract maths does not line up: never pick them.
const pickable = (c) => !!SPEC[c] && !c.startsWith('1000') && (LIVEALL.has(c) || (liq[c] || 0) >= LIQ_MIN);

// ---------- trades ----------
const E192 = { kind: 'M', bars: 192 }, bbp = (mult) => ({ len: 80, mult, trend: 800, minStop: 0.3, filt: null });
const hunt = (strat, ex) => (c) => L1.evaluate(strat, ex, [c], 1, true).trades.map((x) => ({ coin: c, dir: x.dir, t: x.t, tExit: x.why === 'sig' ? x.tExit - H : x.tExit, R: x.R, w: 1, dist: x.dist, entry: x.entry, why: x.why, iv: H }));
const live = (kind, mult) => (c) => S.coinTrades(S.real(c), kind, { mult, cost: 1 }).map((x) => ({ coin: c, dir: x.dir, t: x.t, tExit: kind.startsWith('bb') && x.why === 'time' ? x.tExit - 14400 : x.tExit, R: x.R, w: x.w, dist: x.dist, entry: x.entry, why: x.why, iv: 14400 }));
const STRATS = [
  { id: 'wide', name: 'BB 1H WIDE', gen: hunt(FV.strat(bbp(2.6), E192), FV.mkEx(E192)) },
  { id: 'bb1h', name: 'BB 1H', gen: hunt(FV.strat(bbp(2.0), E192), FV.mkEx(E192)) },
  { id: 'bb4', name: 'BB 4H v4 (live)', gen: live('bbT', 1.05) },
  { id: 'ic', name: 'I-CORE (live)', gen: live('ic', 1) },
  { id: 'tc', name: 'T-CORE (live)', gen: live('tc', 1) },
];

// first candle of each coin; a year counts for a coin if the coin was listed by Feb 15 of that year (most perps of the 2020 batch list Jan-Feb 2020)
const FIRST = {}; for (const c of ALL) { const r = C.load(c, '1h'); FIRST[c] = r.length ? r[0][0] : Infinity; }
const full = (c, y) => FIRST[c] <= ts(y) + 45 * 86400;
const yearOf = (t) => new Date((t - 1) * 1000).getUTCFullYear();

// per coin: R per year, trades per year, closed-trade worst fall in R per year range
function coinStats(tr, c) {
  const yr = {}, n = {}; for (const y of YEARS) { yr[y] = 0; n[y] = 0; }
  for (const x of tr) { const y = yearOf(x.tExit); if (y in yr) { yr[y] += x.w * x.R; n[y]++; } }
  return { coin: c, yr, n, years: YEARS.filter((y) => full(c, y)) };
}
function ddR(tr, a, b) { let R = 0, pk = 0, dd = 0; for (const x of tr) if (x.tExit > a && x.tExit <= b) { R += x.w * x.R; pk = Math.max(pk, R); dd = Math.max(dd, pk - R); } return { R, dd }; }

// ---------- hourly closes + funding, PHP account (copied from ../capital-race-nov26/run.js) ----------
const TIERS = [[0, 0.025], [500 * PHP, 0.02], [1000 * PHP, 0.015]], pctFor = (pk) => { let p = TIERS[0][1]; for (const [b, r] of TIERS) if (pk >= b) p = r; return p; };
const HC = {};
function hourly(c) {
  if (HC[c]) return HC[c];
  const NH = Math.round((Date.UTC(2026, 10, 26) / 1000 - T0) / H), close = new Float64Array(NH).fill(NaN), fund = new Float64Array(NH + 1);
  for (const r of C.load(c, '1h')) { const k = (r[0] - T0) / H; if (k >= 0 && k < NH) close[k] = r[4]; }
  for (let k = 1; k < NH; k++) if (Number.isNaN(close[k])) close[k] = close[k - 1];
  for (const [ft, rate] of C.funding(c)) { const k = Math.ceil((ft - T0) / H); if (k >= 0 && k <= NH) fund[k] += rate; }
  for (let k = 1; k <= NH; k++) fund[k] += fund[k - 1];
  return (HC[c] = { close, fund });
}
function openR(t, k) {
  const h = hourly(t.coin), k0 = Math.max(0, (t.t - T0) / H), px = h.close[k];
  if (Number.isNaN(px)) return 0;
  const v = (t.dir * (px - t.entry) / t.entry - 2 * FEE - t.dir * (h.fund[k + 1] - h.fund[k0])) / t.dist;
  return t.why === 'stop' && T0 + (k + 1) * H > t.tExit - (t.iv || H) ? Math.max(v, t.R) : v;
}
function account(trades, o = {}) {
  const from = o.from ?? T0, to = o.to ?? END, k0 = Math.round((from - T0) / H), k1 = Math.round((to - T0) / H), K = (o.scale ?? 1) * (o.k ?? 1), mexc = o.mexc !== false;
  let i = 0; while (i < trades.length && trades[i].t < from) i++;
  let bal = START, peak = START, margin = 0, equity = START, eqPk = START, mdd = 0, skipped = 0, taken = 0, gw = 0, gl = 0, wins = 0, closed = 0;
  const open = [], curve = new Float64Array(k1 - k0);
  for (let k = k0; k < k1; k++) {
    const t0 = T0 + k * H;
    while (i < trades.length && trades[i].t <= t0) {
      const t = trades[i++]; if (t.tExit > to) continue;
      const target = bal * (o.flat ? 0.025 : pctFor(peak)) * K * t.w;
      if (!(target > 0)) { skipped++; continue; }
      let risk = target, mg = 0;
      if (mexc) {
        const sp = SPEC[t.coin], one = sp.cs * t.entry, per = one * t.dist;
        let vol = Math.max(sp.minVol, Math.round(target / PHP / per)); while (vol >= sp.minVol && vol * per * PHP > 1.5 * target) vol--;
        if (vol < sp.minVol) { skipped++; continue; }
        risk = vol * per * PHP; const lev = Math.max(1, Math.min(20, Math.floor(0.5 / (t.dist + sp.mmr)))); mg = vol * one * PHP / lev;
        if (!(bal - margin >= mg * 1.1)) { skipped++; continue; }
        margin += mg;
      }
      taken++; open.push({ t, risk, mg });
    }
    let value = 0;
    for (let j = open.length - 1; j >= 0; j--) {
      const p = open[j];
      if (p.t.tExit <= t0 + H) { const pl = p.risk * p.t.R; bal += pl; margin -= p.mg; open.splice(j, 1); closed++; if (pl > 0) { wins++; gw += pl; } else gl -= pl; peak = Math.max(peak, bal); }
      else value += p.risk * openR(p.t, k);
    }
    equity = Math.max(0, bal + value); curve[k - k0] = equity;
    if (equity >= eqPk) eqPk = equity; mdd = Math.max(mdd, 1 - equity / eqPk);
  }
  const yrs = {}; for (const y of TEST) { const a = Math.max(0, Math.round((ts(y) - from) / H)), b = Math.min(curve.length, Math.round((ts(y + 1) - from) / H)); if (b > a) { const s0 = a ? curve[a - 1] : START; let p = s0, d = 0; for (let x = a; x < b; x++) { p = Math.max(p, curve[x]); d = Math.max(d, 1 - curve[x] / p); } yrs[y] = { ret: curve[b - 1] / s0 - 1, dd: d, end: curve[b - 1] }; } }
  return { end: curve[curve.length - 1], mdd, taken, skipped, win: closed ? wins / closed : 0, pf: gl ? gw / gl : 0, yrs };
}
function sameFall(trades, from, target = 0.4) {
  let lo = 0.02, hi = 6, best = null;
  for (let it = 0; it < 22; it++) { const k = (lo + hi) / 2, s = account(trades, { from, k, mexc: false, flat: true }); if (s.mdd > target) hi = k; else { lo = k; best = { k, end: s.end, mdd: s.mdd }; } }
  return best;
}

// ======================= run =======================
const OUT = { meta: { end: new Date(END * 1000).toISOString(), coins: ALL.length, live: LIVE, pickable: ALL.filter(pickable), liq, first: FIRST }, strats: {} };
log('coins', ALL.length, 'pickable', OUT.meta.pickable.length);
for (const s of STRATS) {
  const TR = {}, CS = {};
  for (const c of ALL) {
    let tr = [];
    try { tr = s.gen(c).filter((x) => x.t >= T0 && x.tExit <= END).sort((a, b) => a.tExit - b.tExit); } catch (e) { log('skip', s.id, c, e.message); }
    TR[c] = tr; CS[c] = coinStats(tr, c);
    const all = ddR(tr, T0, END); CS[c].R = all.R; CS[c].dd = all.dd; CS[c].trades = tr.length; CS[c].avg = tr.length ? all.R / tr.length : 0;
    CS[c].pos = CS[c].years.filter((y) => CS[c].yr[y] > 0).length;
  }
  const N = LIVE[s.id].length;
  // ---- walk-forward: each test year, pick with earlier years only ----
  const wf = [], picks = {};
  for (const Y of TEST) {
    const rows = [];
    for (const c of ALL) {
      if (!full(c, Y)) continue;
      const prior = CS[c].years.filter((y) => y < Y); if (prior.length < 2) continue;
      const pr = ddR(TR[c], T0, ts(Y)), passed = prior.every((y) => CS[c].yr[y] > 0);
      rows.push({ c, passed, pickable: pickable(c), priorRdd: pr.dd > 0 ? pr.R / pr.dd : pr.R > 0 ? 99 : 0, priorR: pr.R, next: CS[c].yr[Y], nextN: CS[c].n[Y] });
    }
    const pool = rows.filter((r) => r.pickable), top = pool.filter((r) => r.passed).sort((a, b) => b.priorRdd - a.priorRdd).slice(0, N);
    const topR = [...pool].sort((a, b) => b.priorR - a.priorR).slice(0, N);       // same count, best total so far, no every-year filter
    picks[Y] = top.map((r) => r.c);
    const avg = (a) => (a.length ? a.reduce((p, r) => p + r.next, 0) / a.length : 0), posShare = (a) => (a.length ? a.filter((r) => r.next > 0).length / a.length : 0);
    const liveRows = rows.filter((r) => LIVE[s.id].includes(r.c));
    wf.push({ Y, nPool: pool.length, nPassed: pool.filter((r) => r.passed).length,
      passed: { n: pool.filter((r) => r.passed).length, avg: avg(pool.filter((r) => r.passed)), pos: posShare(pool.filter((r) => r.passed)) },
      failed: { n: pool.filter((r) => !r.passed).length, avg: avg(pool.filter((r) => !r.passed)), pos: posShare(pool.filter((r) => !r.passed)) },
      top: { coins: top.map((r) => r.c), avg: avg(top), pos: posShare(top), each: top.map((r) => [r.c, +r.next.toFixed(1)]) },
      topR: { coins: topR.map((r) => r.c), avg: avg(topR), pos: posShare(topR) },
      live: { avg: avg(liveRows), pos: posShare(liveRows), each: liveRows.map((r) => [r.c, +r.next.toFixed(1)]) },
      all: { avg: avg(pool), pos: posShare(pool) } });
  }
  // ---- one split: pick on 2020-2023, judge 2024 - Nov 2026 ----
  const split = (() => {
    const rows = ALL.filter((c) => pickable(c) && full(c, 2022)).map((c) => {
      const prior = CS[c].years.filter((y) => y < 2024), pr = ddR(TR[c], T0, ts(2024)), after = ddR(TR[c], ts(2024), END);
      return { c, passed: prior.length >= 2 && prior.every((y) => CS[c].yr[y] > 0), priorRdd: pr.dd > 0 ? pr.R / pr.dd : 99, after: after.R, afterYears: [2024, 2025, 2026].map((y) => +CS[c].yr[y].toFixed(1)) };
    });
    const top = rows.filter((r) => r.passed).sort((a, b) => b.priorRdd - a.priorRdd).slice(0, N);
    return { n: rows.length, nPassed: rows.filter((r) => r.passed).length, top, avgAfterTop: top.reduce((p, r) => p + r.after, 0) / (top.length || 1),
      avgAfterLive: LIVE[s.id].reduce((p, c) => p + ddR(TR[c], ts(2024), END).R, 0) / N, avgAfterAll: rows.reduce((p, r) => p + r.after, 0) / rows.length,
      top3of3: top.filter((r) => r.afterYears.every((v) => v > 0)).length };
  })();
  // ---- hindsight: positive every full year 2020-2026 (at least 5 years), best N by R per R of fall over all years ----
  const hind = ALL.filter((c) => pickable(c) && CS[c].years.length >= 5 && CS[c].pos === CS[c].years.length).sort((a, b) => CS[b].R / (CS[b].dd || 1) - CS[a].R / (CS[a].dd || 1));
  // ---- money from Jan 1 2022: live coins, yearly walk-forward picks, hindsight picks ----
  const pickTrades = (setFor) => ALL.flatMap((c) => TR[c].filter((x) => x.t >= M0 && setFor(yearOf(x.t + 1)).includes(c))).sort((a, b) => a.t - b.t || a.coin.localeCompare(b.coin));
  const scaled = (set) => N / set.length;
  const mLive = pickTrades(() => LIVE[s.id]), mWF = pickTrades((y) => picks[y] || []), mHind = pickTrades(() => hind.slice(0, N));
  const money = {};
  for (const [k, tr, sc] of [['live', mLive, 1], ['wf', mWF, 1], ['hind', mHind, 1]]) {
    const a = account(tr, { from: M0, scale: sc }), f = sameFall(tr, M0);
    money[k] = { end: a.end, mdd: a.mdd, taken: a.taken, skipped: a.skipped, win: a.win, pf: a.pf, yrs: a.yrs, fall40: f };
  }
  // luck baseline: 200 random coin sets of the same size, re-drawn every Jan 1 from the same pool the rule picks from
  let seed = 777; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pool = (y) => ALL.filter((c) => pickable(c) && full(c, y - 2) && full(c, y - 1));
  const rs = [];
  for (let n = 0; n < 200; n++) {
    const set = {}; for (const Y of TEST) { const p = pool(Y).slice(); for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } set[Y] = p.slice(0, N); }
    const a = account(pickTrades((y) => set[y] || []), { from: M0 }); rs.push({ end: a.end, mdd: a.mdd });
  }
  const qq = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  money.rand = { medEnd: qq(rs.map((r) => r.end), 0.5), p10: qq(rs.map((r) => r.end), 0.1), p90: qq(rs.map((r) => r.end), 0.9), medDD: qq(rs.map((r) => r.mdd), 0.5),
    wfRank: rs.filter((r) => r.end < money.wf.end).length / rs.length, liveRank: rs.filter((r) => r.end < money.live.end).length / rs.length };
  OUT.strats[s.id] = { name: s.name, N, coins: Object.fromEntries(Object.entries(CS).map(([c, v]) => [c, { yr: Object.fromEntries(YEARS.map((y) => [y, +v.yr[y].toFixed(1)])), years: v.years, pos: v.pos, R: +v.R.toFixed(1), dd: +v.dd.toFixed(1), trades: v.trades, avg: +v.avg.toFixed(3) }])),
    wf, picks, split, hind: hind.slice(0, 12), hindCount: hind.length, money };
  const agg = (k) => wf.reduce((p, w) => p + w[k].pos * w[k].n, 0) / wf.reduce((p, w) => p + w[k].n, 0);
  log(s.id, 'passed->positive next year', (100 * agg('passed')).toFixed(0) + '%', 'failed->positive', (100 * agg('failed')).toFixed(0) + '%',
    '| money 2022+: live', Math.round(money.live.end), 'wf', Math.round(money.wf.end), 'hind', Math.round(money.hind.end), '| hindsight 7/7 coins', hind.length);
}
fs.writeFileSync(__dirname + '/results.json', JSON.stringify(OUT));
log('written results.json');
