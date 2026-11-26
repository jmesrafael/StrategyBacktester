// run.js - Nov 27 2026: TRI-CORE today (BB 4H v4 50 / I-CORE 25 / T-CORE 25) vs 4 bots (+ BB 1H WIDE, 25 each). Read-only.
//   node --max-old-space-size=8192 run.js -> results.json (then node report.js -> RESULTS.md + report.html)
// Engine and account copied from ../bb-versions-nov26/study.js lines 1-224 (= ../four-bot-nov26 basis): live rules, hourly-marked open trades,
// shared sizing across sub-accounts, quarterly rebalance, MEXC minimum orders, live risk steps (2.5% / 2% from US$500 base / 1.5% from US$1,000).
// Money: PHP 1,000 = US$16.67 at PHP 60 per US$. Coins: BB-CORE and WIDE = GALA SOL ADA NEAR ZEC ARB; I-CORE = those 5 + ETH (no ARB); T-CORE = I-CORE + SUI ARB.
'use strict';
const fs = require('fs');
const S = require('../replace-nov25/sim');
const C = require('../../candles/candles.js');
const L4 = require('../hunt-4h-nov26/lib.js'), F4 = require('../hunt-4h-nov26/fam.js');
const L2 = require('../hunt-intraday-nov26/lib.js'), F2 = require('../hunt-intraday-nov26/fam.js');
const L1 = require('../hunt-1h-nov26/lib.js'), FV = require('../hunt-1h-nov26/fam-vol.js');
const SYS = require('../strat-hunt-nov6/engine.js');
const DET = require('../zec-replacement-2/detail.json'), DL = Array.isArray(DET) ? DET : DET.data || Object.values(DET);

const H = 3600, ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, T0 = ts(2020), END = S.END, NH = Math.round((END - T0) / H), CUT = ts(2024);
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026], FEE = 0.0005, MONTHS_TOTAL = (END - T0) / (30.4375 * 86400);
const LIVE6 = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'], MAIN = L1.MAIN, HOLD = L1.HOLD;
const RUN = { bb: LIVE6, ic: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH'], tc: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'] };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------- trades, one shape: {c, dir, t, tEff, R, w, dist, entry, why, iv} ----------------
const live = (kind, mult, iv = 14400) => (coins, cost = 1) => coins.flatMap((c) => S.coinTrades(S.real(c), kind, { mult, cost }).map((x) => ({
  c, dir: x.dir, t: x.t, R: x.R, w: x.w, dist: x.dist, entry: x.entry, why: x.why, iv,
  tEff: kind.startsWith('bb') && x.why === 'time' ? x.tExit - iv : x.tExit,   // BB time exits fill at the open of the booked candle
})));
const hunt = (lib, strat, ex, iv) => (coins, cost = 1) => lib.evaluate(strat, ex, coins, cost, true).trades.map((x) => ({
  c: x.coin, dir: x.dir, t: x.t, R: x.R, w: 1, dist: x.dist, entry: x.entry, why: x.why, iv, tEff: x.why === 'sig' ? x.tExit - iv : x.tExit,
}));
const ICHI = { fam: 'ichi', p: { t: 9, k: 26, s: 52, mode: 'cross' }, trend: 0, exit: { k: 2, bars: 12 } };
const E192 = { kind: 'M', bars: 192 }, bbp = (mult) => ({ len: 80, mult, trend: 800, minStop: 0.3, filt: null });
// old BB-CORE 4H rules (2.0 sigma, 48-candle exit) = 'bb-core' in ../strat-hunt-nov6
const HUNT = require('../strat-hunt-nov6/strategies.js');
const oldBB = (coins, cost = 1) => coins.flatMap((cn) => {
  const s = HUNT.S.find((x) => x.id === 'bb-core'), B = C.load(cn, '4h').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })), c = HUNT.makeCtx(B, '4h');
  return SYS.run(B, c.atr14, s.build(c), HUNT.exitOf('BBX', c), C.funding(cn), 14400, { fee: 0.0005 * cost, slip: 0.0002 * cost }).trades
    .map((x) => ({ c: cn, dir: x.dir, t: x.t, R: x.R, w: 1, dist: x.dist, entry: x.entry, why: x.why, iv: 14400, tEff: x.why === 'sig' ? x.tExit - 14400 : x.tExit }));
});
const STRATS = [
  { id: 'bb', name: 'BB 4H v4 (live)', tf: '4h', status: 'LIVE (rules v4, x1.05)', gen: live('bbT', 1.05), own: RUN.bb },
  { id: 'bbold', name: 'BB 4H old', tf: '4h', status: 'old rules (2.0σ, 48 candles)', gen: oldBB, own: LIVE6 },
  { id: 'bb1h', name: 'BB 1H', tf: '1h', status: 'paper bot (bb1h)', gen: hunt(L1, FV.strat(bbp(2.0), E192), FV.mkEx(E192), H), own: LIVE6 },
  { id: 'wide', name: 'BB 1H WIDE', tf: '1h', status: 'new lead (2.6σ)', gen: hunt(L1, FV.strat(bbp(2.6), E192), FV.mkEx(E192), H), own: LIVE6 },
  { id: 'ic', name: 'I-CORE', tf: '4h', status: 'LIVE (rules v3)', gen: live('ic', 1), own: RUN.ic },
  { id: 'tc', name: 'T-CORE', tf: '4h', status: 'LIVE (rules v3)', gen: live('tc', 1), own: RUN.tc },
];
const BY = Object.fromEntries(STRATS.map((s) => [s.id, s]));
const inRange = (tr) => tr.filter((x) => x.t >= T0 && x.t < END && x.tEff <= END);
const cache = new Map();
function trades(id, coins, cost = 1) {
  const k = id + '|' + coins.join(',') + '|' + cost;
  if (!cache.has(k)) cache.set(k, inRange(BY[id].gen(coins, cost)).sort((a, b) => a.t - b.t || a.c.localeCompare(b.c)));
  return cache.get(k);
}

// ---------------- hourly closes and funding ----------------
const HC = {};
function hourly(c) {
  if (HC[c]) return HC[c];
  const close = new Float64Array(NH).fill(NaN), fund = new Float64Array(NH + 1);
  for (const r of C.load(c, '1h')) { const k = (r[0] - T0) / H; if (k >= 0 && k < NH) close[k] = r[4]; }
  for (let k = 1; k < NH; k++) if (Number.isNaN(close[k])) close[k] = close[k - 1];
  // fund[k] = sum of funding with time in [T0, T0 + k hours]
  for (const [ft, rate] of C.funding(c)) { const k = Math.ceil((ft - T0) / H); if (k >= 0 && k <= NH) fund[k] += rate; }
  for (let k = 1; k <= NH; k++) fund[k] += fund[k - 1];
  return (HC[c] = { close, fund });
}
// open value of a trade in raw R at the close of hour k (never worse than the stop result inside the candle that stops it)
function openR(x, k) {
  const h = hourly(x.c), k0 = (x.t - T0) / H, px = h.close[k];
  if (Number.isNaN(px)) return 0;
  const v = (x.dir * (px - x.entry) / x.entry - 2 * FEE - x.dir * (h.fund[k + 1] - h.fund[k0])) / x.dist;
  return x.why === 'stop' && T0 + (k + 1) * H > x.tEff - x.iv ? Math.max(v, x.R) : v;
}

// ---------------- R statistics (risk units, weighted by the size rule) ----------------
const mean = (v) => v.reduce((s, x) => s + x, 0) / (v.length || 1);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const monthKey = (t) => new Date((t - 1) * 1000).toISOString().slice(0, 7);
const ALLMONTHS = []; for (let y = 2020; y <= 2026; y++) for (let m = 0; m < 12; m++) if (ts(y, m) < END) ALLMONTHS.push(`${y}-${String(m + 1).padStart(2, '0')}`);
function rStats(tr, a = T0, b = END) {
  const s = tr.filter((x) => x.tEff > a && x.tEff <= b).sort((p, r) => p.tEff - r.tEff || p.t - r.t);
  const mon = {}, yr = {}; for (const m of ALLMONTHS) if (Date.parse(m + '-01') / 1000 >= a && Date.parse(m + '-01') / 1000 < b) mon[m] = 0;
  let R = 0, pk = 0, dd = 0, ls = 0, cur = 0, win = 0, gw = 0, gl = 0, lg = 0, sh = 0, hold = 0; const rs = [], wins = [], losses = [];
  for (const x of s) {
    const r = x.w * x.R; rs.push(r); R += r; pk = Math.max(pk, R); dd = Math.max(dd, pk - R); hold += (x.tEff - x.t) / H;
    if (r > 0) { win++; gw += r; wins.push(r); cur = 0; } else { gl -= r; losses.push(r); ls = Math.max(ls, ++cur); }
    if (x.dir === 1) lg += r; else sh += r;
    const k = monthKey(x.tEff); mon[k] = (mon[k] || 0) + r; const y = k.slice(0, 4); yr[y] = (yr[y] || 0) + r;
  }
  // hourly marked curve
  const k0 = Math.round((a - T0) / H), k1 = Math.round((b - T0) / H), d = new Float64Array(k1 - k0 + 1);
  for (const x of tr) {
    const f = (x.t - T0) / H, e = Math.round((x.tEff - T0) / H); if (e <= k0 || f >= k1) continue;
    let prev = 0;
    for (let k = f; k < e - 1 && k < k1; k++) { const v = x.w * openR(x, k); if (k >= k0) d[k - k0] += v - prev; prev = v; }
    if (e - 1 >= k0 && e - 1 < k1) d[e - 1 - k0] += x.w * x.R - prev;
  }
  let eq = 0, mp = 0, mdd = 0, at = 0, under = 0;
  for (let i = 0; i < d.length; i++) { eq += d[i]; if (eq >= mp) { mp = eq; at = i; } mdd = Math.max(mdd, mp - eq); under = Math.max(under, i - at); }
  rs.sort((p, r) => r - p);
  const mv = Object.values(mon), months = (b - a) / (30.4375 * 86400);
  const ys = YEARS.filter((y) => ts(y) < b && ts(y + 1) > a);
  return { n: s.length, perMonth: s.length / months, win: s.length ? win / s.length : 0, avg: s.length ? R / s.length : 0, pf: gl ? gw / gl : 0,
    payoff: losses.length && wins.length ? mean(wins) / -mean(losses) : 0, R, dd, mdd, rdd: mdd ? R / mdd : 0, ls, underDays: under / 24, hold: hold / (s.length || 1),
    losingMonths: mv.length ? mv.filter((v) => v < 0).length / mv.length : 0, worstMonth: Math.min(...mv), bestMonth: Math.max(...mv),
    years: Object.fromEntries(ys.map((y) => [y, yr[y] || 0])), posYears: ys.filter((y) => (yr[y] || 0) > 0).length, nYears: ys.length,
    ex10: R - rs.slice(0, 10).reduce((p, v) => p + v, 0), longs: lg, shorts: sh, mon };
}

// ---------------- the account: sub-account per bot, shared sizing, quarterly rebalance of free cash (as live) ----------------
const SPEC = {};
for (const c of new Set([...LIVE6, ...RUN.ic, ...RUN.tc])) { const d = DL.find((s) => s.symbol === c + '_USDT'); SPEC[c] = { cs: d.contractSize, minVol: d.minVol || 1, mmr: d.maintenanceMarginRate || 0.004 }; }
// bots: [{ id, weight, trades }]. o: { start (USD), from, to, mexc, k (risk multiplier), flat (fixed 2.5%, no size steps) }
function account(bots, o = {}) {
  const start = o.start ?? 750, from = o.from ?? T0, to = o.to ?? END, mexc = o.mexc !== false, K = o.k ?? 1;
  const k0 = Math.round((from - T0) / H), k1 = Math.round((to - T0) / H);
  const W = bots.map((b) => { const q0 = b.trades; let i = 0; while (i < q0.length && q0[i].t < from) i++; return { ...b, i, q: q0, bal: start * b.weight, margin: 0, peakBase: 0, open: [] }; });
  const curve = new Float64Array(k1 - k0); let equity = start, taken = 0, skipped = 0, lastQ = null, wins = 0, closed = 0, gw = 0, gl = 0;
  for (let k = k0; k < k1; k++) {
    const t = T0 + k * H;
    if (t % 86400 === 0) {
      const d = new Date(t * 1000), qq = d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3);
      if (lastQ !== null && qq !== lastQ) {
        const total = W.reduce((a, w) => a + w.bal, 0), want = W.map((w) => total * w.weight - w.bal);
        const give = want.map((v, j) => (v < 0 ? Math.min(-v, Math.max(0, W[j].bal - W[j].margin)) : 0)), pot = give.reduce((a, v) => a + v, 0), need = want.reduce((a, v) => a + Math.max(0, v), 0);
        W.forEach((w, j) => { w.bal += want[j] > 0 ? (need > 0 ? (pot * want[j]) / need : 0) : -give[j]; });
      }
      lastQ = qq;
    }
    for (const w of W) while (w.i < w.q.length && w.q[w.i].t === t) {
      const x = w.q[w.i++], base = equity * w.weight; w.peakBase = Math.max(w.peakBase, base);
      const pct = o.flat ? 0.025 : w.peakBase >= 1000 ? 0.015 : w.peakBase >= 500 ? 0.02 : 0.025, target = pct * K * base * x.w;
      if (!(target > 0)) { skipped++; continue; }
      let size = target / x.dist, margin = 0;
      if (mexc) {
        const sp = SPEC[x.c], one = sp.cs * x.entry, per = one * x.dist;
        let vol = Math.max(sp.minVol, Math.round(target / per)); while (vol >= sp.minVol && vol * per > 1.5 * target) vol--;
        if (vol < sp.minVol) { skipped++; continue; }
        size = vol * one;
        const lev = Math.max(1, Math.min(20, Math.floor(0.5 / (x.dist + sp.mmr))));
        margin = size / lev;
        if (!(w.bal - w.margin >= margin * 1.1)) { skipped++; continue; }
      }
      w.margin += margin; taken++; w.open.push({ x, size, margin, end: Math.round((x.tEff - T0) / H) });
    }
    let eq = 0;
    for (const w of W) {
      let open = 0;
      for (let j = w.open.length - 1; j >= 0; j--) {
        const p = w.open[j];
        if (p.end <= k + 1) { const pl = p.size * p.x.R * p.x.dist; w.bal += pl; w.margin -= p.margin; w.open.splice(j, 1); closed++; if (pl > 0) { wins++; gw += pl; } else gl -= pl; }
        else open += p.size * p.x.dist * openR(p.x, k);
      }
      eq += w.bal + open;
    }
    equity = Math.max(0, eq); curve[k - k0] = equity;
  }
  return { curve, start, from, taken, skipped, win: closed ? wins / closed : 0, pf: gl ? gw / gl : 0, closed };
}
function cStats(r) {
  const { curve, start, from } = r, n = curve.length;
  let pk = start, dd = 0, at = 0, under = 0, ul = 0;
  const days = [], daily = [], mon = []; let prevD = start, prevM = start;
  for (let i = 0; i < n; i++) {
    const v = curve[i]; if (v >= pk) { pk = v; at = i; } const x = 1 - v / pk; dd = Math.max(dd, x); under = Math.max(under, i - at); ul += x * x;
    const t = from + (i + 1) * H;
    if (t % 86400 === 0 || i === n - 1) { days.push([t, v]); daily.push(prevD > 0 ? v / prevD - 1 : 0); prevD = v; }
    const d = new Date(t * 1000);
    if ((t % 86400 === 0 && d.getUTCDate() === 1) || i === n - 1) { mon.push([monthKey(t), prevM > 0 ? v / prevM - 1 : 0]); prevM = v; }
  }
  const m = mean(daily), sd = Math.sqrt(mean(daily.map((v) => (v - m) ** 2))), dsd = Math.sqrt(mean(daily.map((v) => Math.min(0, v) ** 2)));
  const yrs = (n * H) / (365.25 * 86400), end = curve[n - 1], cagr = end > 0 ? (end / start) ** (1 / yrs) - 1 : -1;
  const mv = mon.map((x) => x[1]);
  const years = {};
  for (const y of YEARS) {
    const a = Math.max(0, Math.round((ts(y) - from) / H)), b = Math.min(n, Math.round((ts(y + 1) - from) / H)); if (b <= a) continue;
    const s0 = a === 0 ? start : curve[a - 1]; let p = s0, mdd = 0; for (let i = a; i < b; i++) { p = Math.max(p, curve[i]); mdd = Math.max(mdd, 1 - curve[i] / p); }
    years[y] = { ret: curve[b - 1] / s0 - 1, dd: mdd };
  }
  return { end, ret: end / start - 1, cagr, dd, calmar: dd ? cagr / dd : 0, sharpe: sd ? (m / sd) * Math.sqrt(365) : 0, sortino: dsd ? (m / dsd) * Math.sqrt(365) : 0,
    ulcer: Math.sqrt(ul / n), underDays: under / 24, losingMonths: mv.filter((v) => v < 0).length / mv.length, worstMonth: Math.min(...mv), bestMonth: Math.max(...mv),
    medMonth: q(mv, 0.5), years, mon, taken: r.taken, skipped: r.skipped, win: r.win, pf: r.pf, days: days.map(([t, v]) => [t, +v.toFixed(2)]) };
}
// every start month, 12 months each, fresh money
const STARTS = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= END) STARTS.push([ts(y, m), ts(y + 1, m)]);
function windows(bots, o = {}) {
  return STARTS.map(([a, b]) => { const c = cStats(account(bots, { ...o, from: a, to: b })); return { a, ret: c.ret, dd: c.dd }; });
}
function winSum(w, base) {
  const r = w.map((x) => x.ret), d = w.map((x) => x.dd);
  const o = { n: w.length, medRet: q(r, 0.5), p10Ret: q(r, 0.1), worstRet: Math.min(...r), profitable: r.filter((v) => v > 0).length / r.length,
    medDD: q(d, 0.5), p90DD: q(d, 0.9), worstDD: Math.max(...d), dd40: d.filter((v) => v > 0.4).length / d.length, dd50: d.filter((v) => v > 0.5).length / d.length };
  if (base) { o.beatRet = w.filter((x, i) => x.ret > base[i].ret).length / w.length; o.beatDD = w.filter((x, i) => x.dd < base[i].dd).length / w.length; }
  return o;
}
// the risk multiplier that gives a chosen worst fall (ideal sizing, flat 2.5%): "same pain, who earns more"
function riskMatched(bots, targetDD) {
  let lo = 0.05, hi = 4, best = null;
  for (let it = 0; it < 22; it++) { const k = (lo + hi) / 2, c = cStats(account(bots, { mexc: false, flat: true, k })); if (c.dd > targetDD) hi = k; else { lo = k; best = { k, cagr: c.cagr, dd: c.dd, calmar: c.calmar, worstMonth: c.worstMonth }; } }
  return best;
}
// second same-pain test: the risk multiplier that gives the same TYPICAL (median) worst fall across all 12-month runs
function typicalMatched(bots, targetDD) {
  let lo = 0.05, hi = 4, best = null;
  for (let it = 0; it < 14; it++) { const k = (lo + hi) / 2, w = windows(bots, { mexc: false, flat: true, k }), s = winSum(w); if (s.medDD > targetDD) hi = k; else { lo = k; best = { k, medDD: s.medDD, medRet: s.medRet, p10Ret: s.p10Ret, worstRet: s.worstRet, p90DD: s.p90DD, worstDD: s.worstDD }; } }
  return best;
}
// paired 3-month block reshuffle of monthly returns: the same months drawn for every version
function reshuffle(series, baseKey, N = 5000) {
  const keys = Object.keys(series), len = series[baseKey].length, out = Object.fromEntries(keys.map((k) => [k, { ret: [], dd: [], beatRet: 0, beatDD: 0 }]));
  let seed = 12345; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let s = 0; s < N; s++) {
    const idx = []; while (idx.length < 24) { const a = Math.floor(rnd() * len); for (let j = 0; j < 3 && idx.length < 24; j++) idx.push((a + j) % len); }
    const res = {};
    for (const k of keys) { let v = 1, p = 1, d = 0; for (const i of idx) { v *= 1 + series[k][i]; p = Math.max(p, v); d = Math.max(d, 1 - v / p); } res[k] = { ret: v - 1, dd: d }; }
    for (const k of keys) { out[k].ret.push(res[k].ret); out[k].dd.push(res[k].dd); if (res[k].ret > res[baseKey].ret) out[k].beatRet++; if (res[k].dd < res[baseKey].dd) out[k].beatDD++; }
  }
  return Object.fromEntries(keys.map((k) => [k, { medRet: q(out[k].ret, 0.5), p5Ret: q(out[k].ret, 0.05), loss: out[k].ret.filter((v) => v < 0).length / N, medDD: q(out[k].dd, 0.5), p95DD: q(out[k].dd, 0.95), beatRet: out[k].beatRet / N, beatDD: out[k].beatDD / N }]));
}

// ======================= run =======================
const PHP = 60, START_USD = 1000 / PHP;
const MIX = {
  tri: { name: 'TRI-CORE today (BB 50 / I 25 / T 25)', bots: [['bb', 0.5], ['ic', 0.25], ['tc', 0.25]] },
  four: { name: '4 bots (BB / I / T / WIDE 25 each)', bots: [['bb', 0.25], ['ic', 0.25], ['tc', 0.25], ['wide', 0.25]] },
};
const OUT = { meta: { end: new Date(END * 1000).toISOString(), run: { ...RUN, wide: LIVE6 }, php: PHP }, bots: {}, mix: {} };
const OWN = { bb: RUN.bb, ic: RUN.ic, tc: RUN.tc, wide: LIVE6 };
for (const id of ['bb', 'ic', 'tc', 'wide']) { const s = rStats(trades(id, OWN[id])); delete s.mon; OUT.bots[id] = { name: BY[id].name, coins: OWN[id], ...s }; log(id, 'R', s.R.toFixed(0), 'dd', s.mdd.toFixed(1)); }
// balances at each year end (PHP) from the hourly curve
function yearEnds(r) { const out = {}; for (const y of YEARS) { const k = Math.min(r.curve.length, Math.round((ts(y + 1) - r.from) / H)) - 1; if (k >= 0) out[y] = r.curve[k] * PHP; } return out; }
for (const [key, m] of Object.entries(MIX)) {
  const bots = m.bots.map(([id, w]) => ({ id, weight: w, trades: trades(id, OWN[id]) }));
  const real = account(bots, { start: START_USD }), cs = cStats(real);
  const free = account(bots, { start: START_USD, mexc: false }), cf = cStats(free);
  const big = cStats(account(bots, { start: 750 }));     // the four-bot-nov26 start, for the check
  // portfolio R: every trade's R x its bot's share (1R = the whole account's risk on one trade)
  const wtr = m.bots.flatMap(([id, w]) => trades(id, OWN[id]).map((x) => ({ ...x, w: x.w * w })));
  const pr = rStats(wtr); delete pr.mon;
  const w12 = winSum(windows(bots, { start: START_USD }));
  const matched = riskMatched(bots, 0.4);
  for (const c of [cs, cf, big]) { delete c.days; delete c.mon; }
  OUT.mix[key] = { name: m.name, bots: m.bots, real: cs, ends: yearEnds(real), free: cf, freeEnds: yearEnds(free), big, pr, w12, matched,
    botR: m.bots.map(([id, w]) => ({ id, w, R: OUT.bots[id].R, years: OUT.bots[id].years })) };
  log(key, 'PHP end', Math.round(cs.end * PHP), 'fall', (100 * cs.dd).toFixed(1), 'skipped', cs.skipped, '| no minimums', Math.round(cf.end * PHP), (100 * cf.dd).toFixed(1), '| $750 cagr', (100 * big.cagr).toFixed(0), 'fall', (100 * big.dd).toFixed(0), '| R', pr.R.toFixed(0), 'Rdd', pr.mdd.toFixed(1), '| 40% fall cagr', (100 * matched.cagr).toFixed(0));
}
fs.writeFileSync(__dirname + '/results.json', JSON.stringify(OUT));
log('written');
