// pesos.js — portfolio comparison in Philippine pesos, judged with the checks from TRADING_MATH.txt and TRADING_SURVIVAL_EDGE.txt.
//   node pesos.js            -> writes pesos-out.json (read by the HTML page) and prints a summary
// Model: every strategy is its own bot/account (like the VPS: one account per bot). A portfolio splits PHP 10,000 between them.
// Risk per trade = the bots' live risk steps (riskTiers [[0,2.5%],[$500,2%],[$1000,1.5%]] by the HIGHEST balance so far), converted at PHP_PER_USD.
// Risk amount is fixed at entry from the realised balance; P/L = R x risk amount at exit. Costs/funding are already in R.
'use strict';
const fs = require('fs');
const { load, COINS } = require('./data.js');
const PHP_PER_USD = 60, START = 10000;
let TIERS = process.env.FLAT ? [[0, +process.env.FLAT]] : [[0, 0.025], [500 * PHP_PER_USD, 0.02], [1000 * PHP_PER_USD, 0.015]];
const pctFor = (peak) => { let p = TIERS[0][1]; for (const [b, r] of TIERS) if (peak >= b) p = r; return p; };

let T = {}; for (const f of ['trades.json', 'trades-hybrid.json']) Object.assign(T, JSON.parse(fs.readFileSync(f, 'utf8')));
const NAME = {
  'bb-core|BBX|4h': 'bb-core 4h (live)', 'i-core|P7|4h': 'I-Core 4h (live)', 'bb-trail|P14|4h': 'bb-trail P14 4h (new)',
  'bb-hybrid|BBX192|4h': 'bb-core hold-192 4h (new)', 'fractal|P14|4h': 'fractal P14 4h (new)', 'bb-core|BBX|1h': 'bb-core 1h (paper)',
};
const PORTS = [
  { id: 'live', name: 'LIVE NOW: bb-core + I-Core (50/50)', legs: [['bb-core|BBX|4h', 0.5], ['i-core|P7|4h', 0.5]], live: true },
  { id: 'bbc', name: 'bb-core alone', legs: [['bb-core|BBX|4h', 1]] },
  { id: 'ic', name: 'I-Core alone', legs: [['i-core|P7|4h', 1]] },
  { id: 'bbc-ic73', name: 'bb-core + I-Core (70/30)', legs: [['bb-core|BBX|4h', 0.7], ['i-core|P7|4h', 0.3]] },
  { id: 'bbc-tr55', name: 'bb-core + bb-trail P14 (50/50)', legs: [['bb-core|BBX|4h', 0.5], ['bb-trail|P14|4h', 0.5]] },
  { id: 'bbc-tr73', name: 'bb-core + bb-trail P14 (70/30)', legs: [['bb-core|BBX|4h', 0.7], ['bb-trail|P14|4h', 0.3]] },
  { id: 'bbc-fr55', name: 'bb-core + fractal P14 (50/50)', legs: [['bb-core|BBX|4h', 0.5], ['fractal|P14|4h', 0.5]] },
  { id: 'bbc-h73', name: 'bb-core + hold-192 (70/30)', legs: [['bb-core|BBX|4h', 0.7], ['bb-hybrid|BBX192|4h', 0.3]] },
  { id: 'bbc-1h', name: 'bb-core 4h + bb-core 1h (50/50)', legs: [['bb-core|BBX|4h', 0.5], ['bb-core|BBX|1h', 0.5]] },
  { id: 'three', name: 'bb-core + I-Core + bb-trail P14 (50/25/25)', legs: [['bb-core|BBX|4h', 0.5], ['i-core|P7|4h', 0.25], ['bb-trail|P14|4h', 0.25]] },
  { id: 'three1h', name: 'bb-core 4h + bb-core 1h + I-Core (40/30/30)', legs: [['bb-core|BBX|4h', 0.4], ['bb-core|BBX|1h', 0.3], ['i-core|P7|4h', 0.3]] },
];
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const mKey = (ts) => { const d = new Date(ts * 1000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
const yOf = (ts) => new Date(ts * 1000).getUTCFullYear();
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / Math.max(1, a.length - 1)); };
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

// all months in the sample
const allTr = Object.values(T).flat();
const t0 = Math.min(...T['bb-core|BBX|4h'].map((t) => t[1])), t1 = Math.max(...allTr.map((t) => t[2]));
const MONTHS = []; { const d = new Date(t0 * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth(); const e = new Date(t1 * 1000); while (y < e.getUTCFullYear() || (y === e.getUTCFullYear() && m <= e.getUTCMonth())) { MONTHS.push(y + '-' + String(m + 1).padStart(2, '0')); m++; if (m === 12) { m = 0; y++; } } }

// market regime per month: equal-weight average monthly return of the coins listed that month (4h closes)
const REG = {}; {
  const per = {};
  for (const c of COINS) { const { B } = load(c, '4h'); const last = {}; for (const b of B) last[mKey(b.time)] = b.close; const ks = Object.keys(last).sort(); for (let i = 1; i < ks.length; i++) (per[ks[i]] = per[ks[i]] || []).push(last[ks[i]] / last[ks[i - 1]] - 1); }
  for (const k of MONTHS) { const r = per[k] ? mean(per[k]) : 0; REG[k] = { ret: r, reg: r > 0.10 ? 'bull' : r < -0.10 ? 'bear' : 'sideways' }; }
}

// --- one bot account with the live risk steps; fresh=true restarts at `start` every Jan 1 (for "per year on PHP 10k")
function account(trades, start, fresh) {
  const ev = []; trades.forEach((t, i) => { ev.push([t[1], 0, i]); ev.push([t[2], 1, i]); });
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let bal = start, peak = start, year = null; const risk = {}, closed = [], yearEnd = {};
  for (const [ts, kind, i] of ev) {
    const y = yOf(ts);
    if (year === null) year = y;
    if (y !== year) { yearEnd[year] = bal; if (fresh) { const f = start / bal; for (const j in risk) risk[j] *= f; bal = start; peak = start; } year = y; } // fresh: trades still open are re-scaled to the new year's balance
    if (kind === 0) risk[i] = bal * pctFor(peak);
    else { const pnl = trades[i][3] * risk[i]; bal += pnl; peak = Math.max(peak, bal); closed.push({ ts, pnl, R: trades[i][3], bal }); }
  }
  yearEnd[year] = bal;
  return { closed, end: bal, yearEnd };
}

function analyse(P) {
  const legs = P.legs.map(([k, w]) => ({ k, w, tr: T[k] }));
  // ---- R view (fixed risk, no compounding): weight x R
  const rt = []; for (const L of legs) for (const t of L.tr) rt.push({ te: t[2], R: t[3] * L.w, raw: t[3], k: L.k });
  rt.sort((a, b) => a.te - b.te);
  let e = 0, pk = 0, dd = 0, lose = 0, maxLose = 0, uw = 0;
  for (const t of rt) { e += t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); if (t.raw <= 0) { lose++; maxLose = Math.max(maxLose, lose); } else lose = 0; }
  const totR = e, Rs = rt.map((t) => t.R);
  const best10 = sum([...Rs].sort((a, b) => b - a).slice(0, 10));
  const mR = {}; for (const k of MONTHS) mR[k] = 0; for (const t of rt) mR[mKey(t.te)] = (mR[mKey(t.te)] || 0) + t.R;
  const mArr = MONTHS.map((k) => mR[k]);
  { let ee = 0, pp = 0; for (const v of mArr) { ee += v; pp = Math.max(pp, ee); if (ee < pp - 1e-9) uw++; } }
  // longest stretch (months) without a new equity high
  let longest = 0; { let ee = 0, pp = 0, run = 0; for (const v of mArr) { ee += v; if (ee > pp + 1e-9) { pp = ee; run = 0; } else { run++; longest = Math.max(longest, run); } } }
  const yR = {}; for (const y of YEARS) yR[y] = 0; for (const t of rt) yR[yOf(t.te)] += t.R;
  const reg = { bull: [], bear: [], sideways: [] }; MONTHS.forEach((k) => reg[REG[k].reg].push(mR[k]));
  const regStat = Object.fromEntries(Object.entries(reg).map(([r, a]) => [r, { months: a.length, avgR: mean(a), pctPos: a.filter((x) => x > 0).length / a.length, totR: sum(a) }]));
  const pre = sum(rt.filter((t) => yOf(t.te) < 2023).map((t) => t.R)), post = totR - pre;
  // per-leg raw stats (EV, win rate, median)
  const legStats = legs.map((L) => { const R = L.tr.map((t) => t[3]), w = R.filter((r) => r > 0), l = R.filter((r) => r <= 0); return { k: L.k, name: NAME[L.k], w: L.w, n: R.length, ev: mean(R), win: w.length / R.length, avgWin: mean(w), avgLoss: -mean(l), median: median(R) }; });
  // correlation between legs (monthly R)
  let corr = null; if (legs.length >= 2) { const a = MONTHS.map((k) => sum(legs[0].tr.filter((t) => mKey(t[2]) === k).map((t) => t[3]))), b = MONTHS.map((k) => sum(legs[1].tr.filter((t) => mKey(t[2]) === k).map((t) => t[3]))); const ma = mean(a), mb = mean(b); let sab = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } corr = sab / Math.sqrt(sa * sb); }

  // ---- PHP view
  const accs = legs.map((L) => account(L.tr, START * L.w, false));
  const fresh = legs.map((L) => account(L.tr, START * L.w, true));
  const endPHP = sum(accs.map((a) => a.end));
  // combined PHP equity curve by month (compounding) + max drawdown %
  const pc = []; for (const a of accs) for (const c of a.closed) pc.push([c.ts, c.pnl]); pc.sort((x, y) => x[0] - y[0]);
  let bal = START, peak = START, ddPct = 0; const mPHP = {}; for (const k of MONTHS) mPHP[k] = null;
  for (const [ts, p] of pc) { bal += p; peak = Math.max(peak, bal); ddPct = Math.max(ddPct, (peak - bal) / peak); mPHP[mKey(ts)] = bal; }
  let last = START; const curve = MONTHS.map((k) => (last = mPHP[k] == null ? last : mPHP[k]));
  // year on a fresh PHP 10k (compounding within the year, live risk steps)
  const yearPHP = {}; for (const y of YEARS) yearPHP[y] = sum(fresh.map((a) => (a.yearEnd[y] != null ? a.yearEnd[y] : 0))) - START * sum(legs.filter((_, i) => fresh[i].yearEnd[y] != null).map((L) => L.w));
  // monthly PHP on the simple basis: PHP 250 per 1R (2.5% of PHP 10k), no compounding
  const PER_R = START * TIERS[0][1];
  const monthPHP = Object.fromEntries(MONTHS.map((k) => [k, mR[k] * PER_R]));
  // ---- Sharpe (monthly R, annualised, risk-free 0)
  const sharpe = sd(mArr) ? (mean(mArr) / sd(mArr)) * Math.sqrt(12) : 0;
  // ---- Monte Carlo: resample whole months (keeps the legs' same-month correlation), 7 years each, 5000 runs; risk 2% per R for the % view
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const mc = { tot: [], ddR: [], ddPct: [], negYears: [] }; const N = 5000;
  for (let s = 0; s < N; s++) {
    let ee = 0, pp = 0, d = 0, eq = 1, pq = 1, dq = 0, neg = 0, yr = 0;
    for (let i = 0; i < mArr.length; i++) { const v = mArr[Math.floor(rnd() * mArr.length)]; ee += v; pp = Math.max(pp, ee); d = Math.max(d, pp - ee); eq *= 1 + 0.02 * v; pq = Math.max(pq, eq); dq = Math.max(dq, 1 - eq / pq); yr += v; if (i % 12 === 11) { if (yr < 0) neg++; yr = 0; } }
    mc.tot.push(ee); mc.ddR.push(d); mc.ddPct.push(dq); mc.negYears.push(neg);
  }
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
  const mcOut = { tot5: q(mc.tot, 0.05), tot50: q(mc.tot, 0.5), dd50: q(mc.ddR, 0.5), dd95: q(mc.ddR, 0.95), ddPct95: q(mc.ddPct, 0.95), pLoss: mc.tot.filter((x) => x <= 0).length / N, pDD30: mc.ddPct.filter((x) => x > 0.3).length / N, pAnyNegYear: mc.negYears.filter((x) => x > 0).length / N };

  return {
    id: P.id, name: P.name, live: !!P.live, legs: legStats, corr,
    trades: rt.length, totR, evR: totR / rt.length, ddR: dd, rdd: totR / dd, exBest10: totR - best10, best10Pct: best10 / totR,
    maxLoseStreak: maxLose, sharpe, months: MONTHS.length, posMonths: mArr.filter((x) => x > 0).length, worstMonthR: Math.min(...mArr), bestMonthR: Math.max(...mArr),
    underwaterPct: uw / MONTHS.length, longestNoHighMonths: longest,
    yR, posYears: YEARS.filter((y) => yR[y] > 0).length, pre, post, regStat,
    endPHP, ddPct, recoverNeeded: ddPct / (1 - ddPct), yearPHP, monthPHP, mR, curve, mc: mcOut,
  };
}

const out = { START, PHP_PER_USD, TIERS, MONTHS, YEARS, REG, ports: PORTS.map(analyse) };

// ---- walk-forward check: pick the sleeve + weight on 2020-2022 only, then look at 2023+
{
  const cut = Date.UTC(2023, 0, 1) / 1000, base = T['bb-core|BBX|4h'];
  const sleeves = Object.keys(T).filter((k) => k.endsWith('|4h') && k !== 'bb-core|BBX|4h' && !/REV/.test(k));
  const evalP = (k, w, from, to) => { const all = []; for (const t of base) if (t[2] >= from && t[2] < to) all.push([t[2], t[3] * w]); for (const t of T[k]) if (t[2] >= from && t[2] < to) all.push([t[2], t[3] * (1 - w)]); all.sort((a, b) => a[0] - b[0]); let e = 0, p = 0, d = 0; for (const [, r] of all) { e += r; p = Math.max(p, e); d = Math.max(d, p - e); } return { tot: e, dd: d, rdd: d ? e / d : 0 }; };
  let best = null;
  for (const k of sleeves) for (const w of [0.5, 0.6, 0.7, 0.8]) { const r = evalP(k, w, 0, cut); if (!best || r.rdd > best.r.rdd) best = { k, w, r }; }
  const alone = (from, to) => evalP('bb-core|BBX|4h', 1, from, to);
  const live = (from, to) => { const all = []; for (const [k, w] of [['bb-core|BBX|4h', 0.5], ['i-core|P7|4h', 0.5]]) for (const t of T[k]) if (t[2] >= from && t[2] < to) all.push([t[2], t[3] * w]); all.sort((a, b) => a[0] - b[0]); let e = 0, p = 0, d = 0; for (const [, r] of all) { e += r; p = Math.max(p, e); d = Math.max(d, p - e); } return { tot: e, dd: d, rdd: d ? e / d : 0 }; };
  // how many sleeves (any weight 0.7) beat bb-core alone on R/DD after 2023
  const a2 = alone(cut, 1e12), l2 = live(cut, 1e12); let better = 0, betterLive = 0; for (const k of sleeves) { const r = evalP(k, 0.7, cut, 1e12).rdd; if (r > a2.rdd) better++; if (r > l2.rdd) betterLive++; }
  out.walk = { sleevesBetterThanLiveOut: betterLive, pick: best.k, w: best.w, inSample: best.r, outSample: evalP(best.k, best.w, cut, 1e12), aloneIn: alone(0, cut), aloneOut: a2, liveIn: live(0, cut), liveOut: live(cut, 1e12), sleevesBetterOut: better, sleeves: sleeves.length };
}

fs.writeFileSync(process.env.FLAT ? 'pesos-flat-' + process.env.FLAT + '.json' : 'pesos-out.json', JSON.stringify(out));
const P = (v) => 'PHP ' + Math.round(v).toLocaleString('en-US');
for (const p of out.ports) console.log(`${p.name.padEnd(46)} R ${p.totR.toFixed(0).padStart(4)} ddR ${p.ddR.toFixed(1).padStart(5)} R/DD ${p.rdd.toFixed(1).padStart(5)} ex10 ${p.exBest10.toFixed(0).padStart(4)} sharpe ${p.sharpe.toFixed(2)} +mo ${p.posMonths}/${p.months} +yr ${p.posYears}/7 worstMo ${p.worstMonthR.toFixed(1)} streak ${p.maxLoseStreak} bear ${p.regStat.bear.avgR.toFixed(2)} side ${p.regStat.sideways.avgR.toFixed(2)} bull ${p.regStat.bull.avgR.toFixed(2)} | end ${P(p.endPHP)} ddPct ${(p.ddPct * 100).toFixed(1)}% | MC dd95 ${p.mc.dd95.toFixed(0)}R ddPct95 ${(p.mc.ddPct95 * 100).toFixed(0)}% pNegYr ${(p.mc.pAnyNegYear * 100).toFixed(0)}% | yr ${YEARS.map((y) => P(p.yearPHP[y])).join(' ')}`);
console.log(JSON.stringify(out.walk));
