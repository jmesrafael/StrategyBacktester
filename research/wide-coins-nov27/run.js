// run.js - Nov 27 2026: is it worth adding DOT, LINK, ONE, XTZ (and ARB) to BB 1H WIDE on GALA SOL ADA NEAR ZEC? Read-only.
//   node --max-old-space-size=8192 run.js -> results.json (then node report.js -> RESULTS.md + report.html)
// Engine, account and costs copied from ../coin-fit-nov27/run.js (lines 8-116): BB 1H WIDE 2.6σ, PHP 1,000, live sizing, MEXC minimums, hourly-marked.
// Two money views: same risk per trade (more coins = more total risk) and same total risk (risk x 5 / number of coins, as in capital-race-nov26).
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
const WIDE = STRATS.find((s) => s.id === 'wide');
const BASE = ['GALA', 'SOL', 'ADA', 'NEAR', 'ZEC'], CAND = ['DOT', 'LINK', 'ONE', 'XTZ', 'ARB'];
const TR = {}; for (const c of [...BASE, ...CAND]) TR[c] = WIDE.gen(c).filter((x) => x.t >= T0 && x.tExit <= END);
const LINEUPS = [
  ['base', 'Your 5', BASE],
  ...CAND.map((c) => ['+' + c, '5 + ' + c, [...BASE, c]]),
  ['+DOT+LINK', '5 + DOT + LINK', [...BASE, 'DOT', 'LINK']],
  ['+ONE+XTZ', '5 + ONE + XTZ', [...BASE, 'ONE', 'XTZ']],
  ['+4', '5 + DOT + LINK + ONE + XTZ', [...BASE, 'DOT', 'LINK', 'ONE', 'XTZ']],
  ['live6', 'Live 6 (5 + ARB)', [...BASE, 'ARB']],
  ['live6+DOT+LINK', 'Live 6 + DOT + LINK', [...BASE, 'ARB', 'DOT', 'LINK']],
];
const MONTHS = []; for (let y = 2020; y <= 2026; y++) for (let m = 0; m < 12; m++) if (ts(y, m) < END) MONTHS.push(`${y}-${String(m + 1).padStart(2, '0')}`);
const mk = (t) => new Date((t - 1) * 1000).toISOString().slice(0, 7);
// R view (risk units, trade by trade): total, worst fall, losing months, worst month, years, per period
function rView(tr, a = T0, b = END) {
  const s = tr.filter((x) => x.tExit > a && x.tExit <= b).sort((p, q) => p.tExit - q.tExit);
  let R = 0, pk = 0, dd = 0; const mon = {}, yr = {};
  for (const m of MONTHS) { const t = Date.parse(m + '-01') / 1000; if (t >= a && t < b) mon[m] = 0; }
  for (const x of s) { R += x.R; pk = Math.max(pk, R); dd = Math.max(dd, pk - R); const k = mk(x.tExit); if (k in mon) mon[k] += x.R; const y = k.slice(0, 4); yr[y] = (yr[y] || 0) + x.R; }
  const mv = Object.values(mon);
  return { n: s.length, R, dd, rdd: dd ? R / dd : 0, losing: mv.filter((v) => v < 0).length / mv.length, worstMonth: Math.min(...mv), yr, mon };
}
const corr = (a, b) => { const m = (v) => v.reduce((p, x) => p + x, 0) / v.length, ma = m(a), mb = m(b); let s = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { s += (a[i] - ma) * (b[i] - mb); x += (a[i] - ma) ** 2; y += (b[i] - mb) ** 2; } return s / Math.sqrt(x * y); };
const OUT = { meta: { base: BASE, cand: CAND, liq: Object.fromEntries([...BASE, ...CAND].map((c) => [c, R0(c)])) }, lineups: {}, coins: {} };
function R0(c) { return liq[c] || 0; }
const baseMon = rView(BASE.flatMap((c) => TR[c])).mon;
for (const c of [...BASE, ...CAND]) {
  const v = rView(TR[c]), early = rView(TR[c], T0, ts(2024)), late = rView(TR[c], ts(2024), END);
  const ms = MONTHS.filter((m) => m in v.mon && Date.parse(m + '-01') / 1000 >= FIRST[c] + 40 * 86400);
  OUT.coins[c] = { R: v.R, dd: v.dd, n: v.n, yr: v.yr, early: early.R, late: late.R, corrBase: corr(ms.map((m) => v.mon[m]), ms.map((m) => baseMon[m] - (BASE.includes(c) ? v.mon[m] : 0))),
    helpsInBadMonths: ms.filter((m) => baseMon[m] < 0).length ? ms.filter((m) => baseMon[m] < 0 && v.mon[m] > 0).length + ' of ' + ms.filter((m) => baseMon[m] < 0).length : '-' };
}
for (const [key, name, coins] of LINEUPS) {
  const tr = coins.flatMap((c) => TR[c]).sort((a, b) => a.t - b.t || a.coin.localeCompare(b.coin));
  const r = rView(tr), e = rView(tr, T0, ts(2024)), l = rView(tr, ts(2024), END);
  const same = account(tr, {}), scaled = account(tr, { scale: 5 / coins.length }), f40 = sameFall(tr, T0);
  const late = account(tr, { from: ts(2024), scale: 5 / coins.length });
  delete r.mon; delete e.mon; delete l.mon;
  OUT.lineups[key] = { name, coins, r, e, l, same: { end: same.end, mdd: same.mdd, skipped: same.skipped }, scaled: { end: scaled.end, mdd: scaled.mdd, skipped: scaled.skipped, yrs: scaled.yrs }, f40, late: { end: late.end, mdd: late.mdd } };
  log(key.padEnd(16), 'R', r.R.toFixed(0), 'dd', r.dd.toFixed(1), 'r/dd', r.rdd.toFixed(1), 'losing', (100 * r.losing).toFixed(0) + '%', 'worstM', r.worstMonth.toFixed(1),
    '| 24+ R', l.R.toFixed(0), 'dd', l.dd.toFixed(1), '| same-risk', Math.round(same.end), (100 * same.mdd).toFixed(0) + '%', '| scaled', Math.round(scaled.end), (100 * scaled.mdd).toFixed(0) + '%', '| 40%', Math.round(f40.end), '| 2024+ scaled', Math.round(late.end), (100 * late.mdd).toFixed(0) + '%');
}
for (const c of CAND) log(c, 'R', OUT.coins[c].R.toFixed(0), 'early', OUT.coins[c].early.toFixed(0), 'late', OUT.coins[c].late.toFixed(0), 'corr with base', OUT.coins[c].corrBase.toFixed(2), 'base losing months it won', OUT.coins[c].helpsInBadMonths, 'liq', Math.round(liq[c] / 1e5) / 10 + 'M');
fs.writeFileSync(__dirname + '/results.json', JSON.stringify(OUT));
