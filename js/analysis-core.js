// analysis-core.js — the numbers behind analysis.html (the in-depth analysis page opened from a setup indicator's performance calendar).
// Pure: no DOM, no fetch, so Node can check it against the admin reports (scripts/analysis-check.mjs).
//
// Trades come from the bots' own engines, never re-coded: BBCore.backtest() (js/bbcore-core.js = the BB-Core bot's lucidio-core.js) and
// ICore.backtest() (js/icore-core.js = the I-Core bot's icore-core.js). Costs as in the bots' research: fees + slippage each way, BB-Core real
// funding, I-Core flat funding per candle held.
//
// Money follows the reports (ledger/reports/icore-10k-report.html, bbcore-no-target-three-way.html):
//   - the size of a trade = risk % × the CLOSED-trade balance at the moment of entry (optionally capped), one position per coin, all coins share
//     one account, so up to five trades are open at once;
//   - a trade is credited to the day / month / year it CLOSES; drops are measured on the closed-trade balance;
//   - 'fresh'    = a new start balance every 1 January (a trade open over New Year is sized from the new start balance),
//     'compound' = one account, never restarted,
//     'fixed'    = one account, every trade risks risk % of the START balance (no compounding).
(function () {
'use strict';

const COINS = ['SOL', 'ZEC', 'ADA', 'NEAR', 'GALA'];
// app interval → seconds (the fixed timeframes the page offers; below 1h the 2020+ history is too long to download in a browser)
const TF = { '60': 3600, '120': 7200, '240': 14400, '360': 21600, '480': 28800, '720': 43200, 'D': 86400 };
const TF_LABEL = { '60': '1h', '120': '2h', '240': '4h', '360': '6h', '480': '8h', '720': '12h', 'D': '1D' };

const STRATS = {
  bbnt: { name: 'BB-Core · no target', short: 'BB-Core NT', funding: true, params: ['maxBars', 'trendLen'] },
  bbfx: { name: 'BB-Core · fixed target', short: 'BB-Core FX', funding: true, params: ['targetR', 'maxBars', 'trendLen'] },
  icore: { name: 'I-Core', short: 'I-Core', funding: false, params: ['kInit', 'kTrail', 'trendLen'] },
};
const PARAMS = { targetR: 4, maxBars: 48, kInit: 2, kTrail: 7, trendLen: 200, costs: true };

// ---- trades ------------------------------------------------------------------------------------------------------
// B = closed candles { time, open, high, low, close }, F = funding [[time, rate], …] or null. Returns { trades, open }.
// tExit = the close of the exit candle (the engines' own convention, with the chosen timeframe instead of their fixed 4h): it orders the bookings.
function coinTrades(strat, coin, B, F, p, iv) {
  p = { ...PARAMS, ...p };
  let r;
  if (strat === 'icore') {
    const IC = g().ICore, D = IC.DEFAULTS.cost;
    const cost = p.costs ? { ...D, fund: D.fund * iv / 14400 } : IC.FREE;   // flat funding is per 4h candle in the bot: scale it to the timeframe
    r = IC.backtest(B, { kInit: p.kInit, kTrail: p.kTrail, trendLen: p.trendLen, interval: iv, cost });
  } else {
    const BC = g().BBCore;
    r = BC.backtest(B, { targetR: strat === 'bbfx' ? p.targetR : 0, maxBars: p.maxBars, trendLen: p.trendLen, interval: iv, cost: p.costs ? {} : BC.FREE },
      p.costs && F && F.length ? F : null);
  }
  // tc = the day the trade is credited to: the exit candle's open (the stop is hit inside that candle; same day as the chart's calendar)
  const trades = r.trades.map((t) => ({ coin, dir: t.dir, t: B[t.i0].time, tExit: B[t.i1].time + iv, tc: B[t.i1].time, R: t.R, why: t.why, bars: t.bars, entry: t.entry, exit: t.exit }));
  let open = null;
  if (r.open) {
    const o = r.open, last = B[B.length - 1], oneR = strat === 'icore' ? Math.abs(o.entry - o.stop0) : Math.abs(o.entry - o.stop);
    open = { coin, dir: o.dir, t: B[o.i0].time, entry: o.entry, stop: o.stop, now: last.close, R: o.dir * (last.close - o.entry) / oneR, bars: B.length - o.i0 };
  }
  return { trades, open };
}
const g = () => (typeof globalThis !== 'undefined' ? globalThis : window);

// ---- R statistics --------------------------------------------------------------------------------------------------
function stats(T) {
  const n = T.length;
  const out = { n, wins: 0, losses: 0, win: 0, avgWin: 0, avgLoss: 0, exp: 0, net: 0, pf: 0, ddR: 0, best: 0, worst: 0, streak: 0, longR: 0, shortR: 0,
    longs: 0, shorts: 0, avgBars: 0, top10: 0, beWin: 0, sd: 0 };
  if (!n) return out;
  const o = [...T].sort((a, b) => a.tExit - b.tExit);
  let sw = 0, sl = 0, eq = 0, pk = 0, run = 0, bars = 0;
  for (const t of o) {
    if (t.R > 0) { out.wins++; sw += t.R; run = 0; } else { out.losses++; sl += t.R; out.streak = Math.max(out.streak, ++run); }
    eq += t.R; pk = Math.max(pk, eq); out.ddR = Math.max(out.ddR, pk - eq);
    if (t.dir === 1) { out.longs++; out.longR += t.R; } else { out.shorts++; out.shortR += t.R; }
    bars += t.bars;
  }
  out.net = sw + sl; out.exp = out.net / n; out.win = out.wins / n;
  out.avgWin = out.wins ? sw / out.wins : 0; out.avgLoss = out.losses ? sl / out.losses : 0;
  out.pf = sl ? sw / -sl : Infinity;
  const Rs = o.map((t) => t.R);
  out.best = Math.max(...Rs); out.worst = Math.min(...Rs); out.avgBars = bars / n;
  out.sd = Math.sqrt(Rs.reduce((a, r) => a + (r - out.exp) ** 2, 0) / Math.max(1, n - 1));
  const top = [...Rs].sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0);
  out.top10 = out.net > 0 ? top / out.net : 0;
  out.beWin = out.avgWin - out.avgLoss > 0 ? -out.avgLoss / (out.avgWin - out.avgLoss) : 0;
  return out;
}

// ---- money -----------------------------------------------------------------------------------------------------------
// m = { start, risk (fraction, e.g. 0.025), cap (max amount risked per trade, 0 = none), mode: 'fresh' | 'compound' | 'fixed' }
// Returns the trades in exit order, each with { risk, pnl, bal (balance after it), y } — one account for all the trades given.
const yStart = (y) => Date.UTC(y, 0, 1) / 1000;
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
function book(T, m) {
  const size = (bal) => { const r = Math.max(0, bal) * m.risk; return m.cap > 0 ? Math.min(m.cap, r) : r; };
  const groups = new Map();
  if (m.mode === 'fresh') for (const t of T) { const y = yearOf(t.tc); if (!groups.has(y)) groups.set(y, []); groups.get(y).push(t); }
  else groups.set(null, T);
  const out = [];
  for (const [y, list] of [...groups].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))) {
    const from = y == null ? -Infinity : yStart(y), ev = [], risk = new Map();
    let bal = m.start;
    for (const t of list) {
      if (t.t >= from) ev.push([t.t, 1, t]); else risk.set(t, size(m.start));
      ev.push([t.tExit, 0, t]);
    }
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);   // an exit at the same moment as an entry is booked first
    for (const [, typ, t] of ev) {
      if (typ === 1) { risk.set(t, m.mode === 'fixed' ? size(m.start) : size(bal)); continue; }
      const r = risk.get(t), pnl = t.R * r;
      bal += pnl;
      out.push({ ...t, risk: r, pnl, bal, y: yearOf(t.tc) });
    }
  }
  return out;
}

// Year rows from booked trades: { y, start, risk (at the year's start), n, wins, R, profit, ret, end, dd (deepest drop inside the year, fraction), low }
function years(rows, m, yearList) {
  const by = new Map();
  for (const r of rows) { if (!by.has(r.y)) by.set(r.y, []); by.get(r.y).push(r); }
  const out = [];
  let carry = m.start;
  for (const y of yearList) {
    const list = by.get(y) || [];
    const start = m.mode === 'fresh' ? m.start : carry;
    let pk = start, dd = 0, low = start, R = 0, wins = 0, profit = 0, bal = start;
    for (const r of list) {
      bal = r.bal; profit += r.pnl; R += r.R; if (r.R > 0) wins++;
      pk = Math.max(pk, bal); low = Math.min(low, bal); if (pk > 0) dd = Math.max(dd, 1 - bal / pk);
    }
    const end = m.mode === 'fresh' ? start + profit : (list.length ? bal : start);
    const sz = m.mode === 'fixed' ? m.start * m.risk : start * m.risk, risk = m.cap > 0 ? Math.min(m.cap, sz) : sz;
    out.push({ y, start, risk, n: list.length, wins, R, profit, ret: start ? profit / start : 0, end, dd, low });
    carry = end;
  }
  return out;
}

// whole-period drop on the closed-trade balance (one account; for 'fresh' the worst year is the meaningful number)
function curve(rows, m) {
  let pk = m.start, dd = 0, low = m.start, ddAt = null;
  const pts = [[rows.length ? rows[0].tExit : 0, m.start]];
  for (const r of rows) {
    pk = Math.max(pk, r.bal); low = Math.min(low, r.bal);
    const d = pk > 0 ? 1 - r.bal / pk : 0; if (d > dd) { dd = d; ddAt = r.tExit; }
    pts.push([r.tExit, r.bal, d]);
  }
  return { dd, ddAt, low, pts };
}

// month cells: key y*100+m (0-based month) → { n, wins, R, pnl, startBal, ret }
function months(rows, m) {
  const out = new Map();
  let bal = m.start, lastY = null;
  for (const r of rows) {
    const d = new Date(r.tc * 1000), k = d.getUTCFullYear() * 100 + d.getUTCMonth();
    if (m.mode === 'fresh' && r.y !== lastY) bal = m.start;
    lastY = r.y;
    if (!out.has(k)) out.set(k, { n: 0, wins: 0, R: 0, pnl: 0, startBal: bal });
    const c = out.get(k);
    c.n++; c.R += r.R; c.pnl += r.pnl; if (r.R > 0) c.wins++;
    bal = r.bal;
  }
  out.forEach((c) => { c.ret = c.startBal > 0 ? c.pnl / c.startBal : 0; });
  return out;
}

// day cells for the calendar: 'y-m-d' (UTC, 0-based month) → { n, wins, losses, winR, lossR, R, pnl, coins: Set }
function days(rows) {
  const out = new Map();
  for (const r of rows) {
    const d = new Date(r.tc * 1000), k = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (!out.has(k)) out.set(k, { n: 0, wins: 0, losses: 0, winR: 0, lossR: 0, R: 0, pnl: 0, coins: new Set() });
    const c = out.get(k);
    c.n++; c.R += r.R; c.pnl += r.pnl || 0; c.coins.add(r.coin);
    if (r.R > 0) { c.wins++; c.winR += r.R; } else if (r.R < 0) { c.losses++; c.lossR += r.R; }
  }
  return out;
}

// Everything the page shows, from the trades of every coin (already filtered to the chosen coins / dates).
function analyse(T, m) {
  T = [...T].sort((a, b) => a.tExit - b.tExit || a.t - b.t);
  const yearList = [...new Set(T.map((t) => yearOf(t.tc)))].sort((a, b) => a - b);
  const rows = book(T, m);
  const coins = [...new Set(T.map((t) => t.coin))];
  const perCoin = {};
  for (const c of coins) {
    const Tc = T.filter((t) => t.coin === c), rc = book(Tc, m);
    perCoin[c] = { stats: stats(Tc), rows: rc, years: years(rc, m, yearList), curve: curve(rc, m) };
  }
  return { T, rows, stats: stats(T), years: years(rows, m, yearList), curve: curve(rows, m), months: months(rows, m), days: days(rows), yearList, perCoin };
}

// ---- edge, luck and survival (TRADING_MATH.txt, TRADING_SURVIVAL_EDGE.txt; the "Expectancy, statistics and probability" page of the reports) ----
// Seeded random numbers, so the page shows the same simulated numbers on every load.
function rng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const quantile = (sorted, q) => { if (!sorted.length) return 0; const k = (sorted.length - 1) * q, a = Math.floor(k), b = Math.ceil(k); return sorted[a] + (sorted[b] - sorted[a]) * (k - a); };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sdev = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };

// 95% range of the average R per trade: resample the trades with replacement (bootstrap). pPos = share of resamples above 0.
function bootstrapMean(R, sims = 4000, seed = 7) {
  const n = R.length, r = rng(seed), out = new Float64Array(sims);
  for (let s = 0; s < sims; s++) { let sum = 0; for (let i = 0; i < n; i++) sum += R[(r() * n) | 0]; out[s] = sum / n; }
  const sorted = Array.from(out).sort((a, b) => a - b);
  return { lo: quantile(sorted, 0.025), hi: quantile(sorted, 0.975), pPos: sorted.filter((v) => v > 0).length / sims };
}
// 95% range of the true win rate from k wins in n trades (Wilson)
function wilson(k, n, z = 1.96) {
  if (!n) return { lo: 0, hi: 0 };
  const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return { lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}
// Kelly: the simple win/loss formula (b·p − q)/b, and the fixed % that grew THIS history fastest (max of the average log growth)
function kelly(R) {
  const w = R.filter((x) => x > 0), l = R.filter((x) => x <= 0);
  const p = R.length ? w.length / R.length : 0, b = l.length && w.length ? mean(w) / -mean(l) : 0;
  const simple = b > 0 ? (b * p - (1 - p)) / b : 0;
  let best = 0, bestG = 0;
  for (let f = 0.001; f <= 0.6; f += 0.001) {
    let g = 0, ok = true;
    for (const x of R) { const v = 1 + f * x; if (v <= 0) { ok = false; break; } g += Math.log(v); }
    if (!ok) break;
    if (g > bestG) { bestG = g; best = f; }
  }
  return { simple: Math.max(0, simple), opt: best, payoff: b };
}
// Monte Carlo: the same trades in a random order (drawn with replacement), one after another, compounding at `risk` of the balance
// (capped at `cap`). Returns the spread of end balances (multiple of the start) and of the deepest drop.
function monteCarlo(R, o) {
  const { risk, trades, sims = 2000, seed = 11, cap = 0, start = 1 } = o, n = R.length, r = rng(seed);
  const ends = new Float64Array(sims), dds = new Float64Array(sims);
  for (let s = 0; s < sims; s++) {
    let bal = start, pk = start, dd = 0;
    for (let i = 0; i < trades; i++) {
      const sz = cap > 0 ? Math.min(cap, bal * risk) : bal * risk;
      bal = Math.max(0, bal + R[(r() * n) | 0] * sz);
      if (bal > pk) pk = bal; else { const d = 1 - bal / pk; if (d > dd) dd = d; }
    }
    ends[s] = bal / start; dds[s] = dd;
  }
  const E = Array.from(ends).sort((a, b) => a - b), D = Array.from(dds).sort((a, b) => a - b);
  const share = (arr, f) => arr.filter(f).length / sims;
  return { p5: quantile(E, 0.05), p50: quantile(E, 0.5), p95: quantile(E, 0.95), below: share(E, (v) => v < 1), ddMed: quantile(D, 0.5), dd95: quantile(D, 0.95),
    dd30: share(D, (v) => v >= 0.3), dd50: share(D, (v) => v >= 0.5), dd70: share(D, (v) => v >= 0.7) };
}
// how many positions were open together at most (one shared account), and when
function maxOpen(T) {
  const ev = []; for (const t of T) { ev.push([t.t, 1]); ev.push([t.tExit, -1]); }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let k = 0, max = 0, at = null; for (const [t, d] of ev) { k += d; if (k > max) { max = k; at = t; } }
  return { max, at };
}
// time spent below the previous high on the closed-trade balance (rows from book(), compounding)
function underwater(rows, start) {
  let pk = start, pkT = rows.length ? rows[0].t : 0, below = 0, longest = 0, longFrom = null, longTo = null;
  for (const r of rows) {
    if (r.bal >= pk) { const d = r.tc - pkT; if (d > longest && r.bal > pk) { longest = d; longFrom = pkT; longTo = r.tc; } pk = r.bal; pkT = r.tc; }
    else below++;
  }
  const last = rows[rows.length - 1], now = last && last.bal < pk ? { since: pkT, dd: 1 - last.bal / pk } : null;
  if (now && last.tc - pkT > longest) { longest = last.tc - pkT; longFrom = pkT; longTo = null; }
  return { share: rows.length ? below / rows.length : 0, longest, longFrom, longTo, now };
}
// Pearson correlation of two equal-length arrays
function corr(x, y) {
  const n = x.length; if (n < 3) return NaN;
  const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; }
  return b && c ? a / Math.sqrt(b * c) : NaN;
}
// month keys (y*100+m) from the first to the last month of a list of trades
function monthKeys(T) {
  if (!T.length) return [];
  const a = new Date(Math.min(...T.map((t) => t.tc)) * 1000), b = new Date(Math.max(...T.map((t) => t.tc)) * 1000), out = [];
  for (let y = a.getUTCFullYear(), m = a.getUTCMonth(); y * 12 + m <= b.getUTCFullYear() * 12 + b.getUTCMonth(); m++) { if (m > 11) { m = 0; y++; } out.push(y * 100 + m); }
  return out;
}

// Everything the "Risk & edge" tab and the verdict need, from the trades (T), the booked accounts (fresh / compounding) and the money settings.
function edge(T, fresh, comp, m) {
  const R = T.map((t) => t.R), s = stats(T), sorted = [...R].sort((a, b) => a - b), n = R.length;
  const bySize = [...R].sort((a, b) => b - a), net = s.net;
  const without = (k) => (n > k ? (net - bySize.slice(0, k).reduce((a, b) => a + b, 0)) / (n - k) : 0);
  const yR = fresh.years.map((y) => y.R), bestY = fresh.years.reduce((a, y) => (!a || y.R > a.R ? y : a), null);
  const skew = (() => { const sd = sdev(R), mu = mean(R); return sd ? R.reduce((a, x) => a + ((x - mu) / sd) ** 3, 0) / n : 0; })();
  const q = 1 - s.win;
  const ky = kelly(R), kyNoTop = kelly(bySize.slice(10));
  // months: compounding returns (0 for a month with no closed trade), for Sharpe and monthly VaR
  const keys = monthKeys(T), mret = keys.map((k) => (comp.months.get(k) ? comp.months.get(k).ret : 0));
  const mSorted = [...mret].sort((a, b) => a - b), msd = sdev(mret);
  const span = T.length ? (Math.max(...T.map((t) => t.tc)) - Math.min(...T.map((t) => t.t))) / (365.25 * 86400) : 1;
  const perYear = n / Math.max(0.25, span);
  // coins together: correlation of their monthly R
  const coins = [...new Set(T.map((t) => t.coin))].sort((a, b) => COINS.indexOf(a) - COINS.indexOf(b)), cm = {};
  for (const c of coins) { const mm = new Map(); for (const t of T) if (t.coin === c) { const d = new Date(t.tc * 1000), k = d.getUTCFullYear() * 100 + d.getUTCMonth(); mm.set(k, (mm.get(k) || 0) + t.R); } cm[c] = keys.map((k) => mm.get(k) || 0); }
  const corrM = coins.map((a) => coins.map((b) => corr(cm[a], cm[b])));
  const pairs = []; for (let i = 0; i < coins.length; i++) for (let j = i + 1; j < coins.length; j++) pairs.push(corrM[i][j]);
  // the distribution of results
  const buckets = [[-Infinity, -1.2, 'Worse than −1.2R (gap past the stop)'], [-1.2, -0.8, '−1.2R to −0.8R (stopped out)'], [-0.8, 0, '−0.8R to 0 (small loss)'], [0, 1, '0 to +1R'], [1, 3, '+1R to +3R'], [3, 10, '+3R to +10R'], [10, 30, '+10R to +30R'], [30, Infinity, 'More than +30R']]
    .map(([lo, hi, label]) => { const x = R.filter((v) => v > lo && v <= hi); return { label, n: x.length, R: x.reduce((a, b) => a + b, 0) }; });
  const risks = [...new Set([0.005, 0.01, 0.02, 0.025, 0.05, m.risk])].sort((a, b) => a - b);
  const mc = risks.map((rk) => ({ risk: rk, all: monteCarlo(R, { risk: rk, trades: n, cap: m.cap, start: m.start }), year: monteCarlo(R, { risk: rk, trades: Math.max(1, Math.round(perYear)), cap: m.cap, start: m.start, seed: 23 }) }));
  return {
    s, n, median: quantile(sorted, 0.5), sd: sdev(R), skew, t: s.sd ? s.exp / (s.sd / Math.sqrt(n)) : 0,
    boot: bootstrapMean(R), winCI: wilson(s.wins, n), need: s.exp > 0 ? Math.ceil((1.96 * s.sd / s.exp) ** 2) : Infinity,
    exp10: without(10), exp20: without(20), noBestYear: bestY ? { y: bestY.y, R: net - bestY.R, exp: (net - bestY.R) / Math.max(1, n - bestY.n) } : null,
    posYears: yR.filter((v) => v > 0).length, years: yR.length, posMonths: mret.filter((v) => v > 0).length, months: keys.length,
    longs: { n: s.longs, R: s.longR, win: T.filter((t) => t.dir === 1 && t.R > 0).length / Math.max(1, s.longs) },
    shorts: { n: s.shorts, R: s.shortR, win: T.filter((t) => t.dir === -1 && t.R > 0).length / Math.max(1, s.shorts) },
    streakExp: q > 0 && q < 1 ? Math.log(n * (1 - q)) / Math.log(1 / q) : 0,
    kelly: ky, kellyNoTop: kyNoTop, perYear, span,
    sharpe: msd ? mean(mret) / msd * Math.sqrt(12) : 0, var95: quantile(mSorted, 0.05), worstMonth: mSorted[0] || 0, bestMonth: mSorted[mSorted.length - 1] || 0,
    under: underwater(comp.rows, m.start), open: maxOpen(T), gaps: R.filter((v) => v < -1.2), buckets,
    coins, corrM, corrAvg: pairs.length ? mean(pairs.filter((v) => isFinite(v))) : NaN, mc,
  };
}

// ---- capital simulator (the "Simulator" tab; research/bb-core/no-target RESULTS.md sections 13-15) -------------------------------------
// One account over a chosen span of years, with optional deposits, and a choice of WHEN the size of a trade is re-set from the balance:
//   'trade' = every trade: risk % × the balance at the moment of entry (same as book() 'compound')
//   'month' = once a month: risk % × the balance on the 1st of the entry's month (00:00 UTC), fixed for that month
//   'year'  = once a year: risk % × the balance on 1 January of the entry's year, fixed for that year
//   'fixed' = never: risk % × the money put in so far (start + deposits), so profit is never re-risked
// o = { start, risk (fraction), cap (0 = none), mode, dep (amount per deposit), depEvery: 'none' | 'month' | 'year', y0, y1 (inclusive years) }
// Trades: entered on/after 1 Jan y0 and closed before 1 Jan y1+1. Deposits ('week' = every Monday 00:00 UTC, 'month' = the 1st of each month,
// 'year' = each 1 January) after the start, up to the
// last closed trade. A deposit lands before anything else at that moment; an exit at the same moment as an entry is booked first.
// Drops are measured on the closed-trade balance with every deposit added to the peak too, so money put in never hides a loss.
const monthStart = (y, m) => Date.UTC(y, m, 1) / 1000;
function simulate(T, o) {
  const from = yStart(o.y0), until = yStart(o.y1 + 1);
  const list = T.filter((t) => t.t >= from && t.tc < until).sort((a, b) => a.t - b.t || a.tExit - b.tExit);
  const end = list.length ? Math.max(...list.map((t) => t.tExit)) : from;
  const deps = [];
  if (o.dep > 0 && o.depEvery === 'week') {
    // every Monday 00:00 UTC after the start (1 Jan 1970 was a Thursday: the first Monday is 4 Jan 1970)
    const W = 7 * 86400, first = Math.floor((from - 4 * 86400) / W + 1) * W + 4 * 86400;
    for (let t = first <= from ? first + W : first; t <= end && t < until; t += W) deps.push(t);
  } else if (o.dep > 0 && o.depEvery !== 'none') {
    for (let y = o.y0; y <= o.y1; y++) for (let m = 0; m < 12; m++) {
      if (o.depEvery === 'year' && m) continue;
      const t = monthStart(y, m);
      if (t > from && t <= end) deps.push(t);
    }
  }
  // every period start inside the span: where 'month' / 'year' read the balance to size the next trades
  const periods = [];
  for (let y = o.y0; y <= o.y1; y++) for (let m = 0; m < 12; m++) { const t = monthStart(y, m); if (t <= end) periods.push([t, y, m]); }
  // order at one moment: deposit (0), exit (1), period snapshot (2), entry (3)
  const ev = [...deps.map((t) => [t, 0, null]), ...periods.map(([t, y, m]) => [t, 2, { y, m }])];
  for (const t of list) { ev.push([t.t, 3, t]); ev.push([t.tExit, 1, t]); }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const size = (base) => { const r = Math.max(0, base) * o.risk; return o.cap > 0 ? Math.min(o.cap, r) : r; };
  let bal = o.start, put = o.start, pk = o.start, dd = 0, ddAt = null, mBase = o.start, yBase = o.start;
  const risk = new Map(), rows = [], depRows = [], snaps = new Map(), pts = [[from, o.start, o.start, 0]];
  for (const [t, typ, x] of ev) {
    if (typ === 0) { bal += o.dep; put += o.dep; pk += o.dep; depRows.push({ t, amt: o.dep, bal }); pts.push([t, bal, put, pk > 0 ? 1 - bal / pk : 0]); continue; }
    if (typ === 2) {
      mBase = bal; if (x.m === 0) yBase = bal;
      const sz = o.mode === 'fixed' ? size(put) : o.mode === 'year' ? size(yBase) : size(bal);
      snaps.set(x.y * 100 + x.m, { bal, put, risk: sz });
      continue;
    }
    if (typ === 3) { risk.set(x, size(o.mode === 'trade' ? bal : o.mode === 'month' ? mBase : o.mode === 'year' ? yBase : put)); continue; }
    const r = risk.get(x), pnl = x.R * r;
    bal += pnl; pk = Math.max(pk, bal);
    const d = pk > 0 ? 1 - bal / pk : 0; if (d > dd) { dd = d; ddAt = x.tExit; }
    rows.push({ ...x, risk: r, pnl, bal, put, y: yearOf(x.tc) });
    pts.push([x.tExit, bal, put, d]);
  }
  return { rows, deps: depRows, snaps, pts, end: bal, put, dd, ddAt, from, until: Math.min(until, end) };
}
// Month rows of one simulated account: [{ k (y*100+m), y, m, start (balance on the 1st, before its deposit), dep, risk (size of a trade entered on
// the 1st), n, wins, losses, won, lost (₱ of the winners / losers), R, profit, end, dd (deepest drop inside the month), coins { coin: trades } }]
// Trades are credited to the month they CLOSE. Year rows add up the months.
function simPeriods(sim, o) {
  const byM = new Map();
  const cell = (k) => {
    if (!byM.has(k)) byM.set(k, { k, y: Math.floor(k / 100), m: k % 100, dep: 0, n: 0, wins: 0, losses: 0, won: 0, lost: 0, R: 0, profit: 0, coins: {}, ev: [] });
    return byM.get(k);
  };
  const keyOf = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 100 + d.getUTCMonth(); };
  for (const d of sim.deps) { const c = cell(keyOf(d.t)); c.dep += d.amt; c.ev.push([d.t, 0, d.amt]); }
  for (const r of sim.rows) {
    const c = cell(keyOf(r.tc));
    c.n++; c.R += r.R; c.profit += r.pnl; c.coins[r.coin] = (c.coins[r.coin] || 0) + 1;
    if (r.pnl > 0) { c.wins++; c.won += r.pnl; } else { c.losses++; c.lost += r.pnl; }
    c.ev.push([r.tExit, 1, r.pnl]);
  }
  // every month of the span, also the quiet ones, so the balance column reads straight down
  const keys = [...sim.snaps.keys()].sort((a, b) => a - b);
  let bal = o.start, pk = o.start;
  const months = keys.map((k) => {
    const c = cell(k), snap = sim.snaps.get(k), start = bal;
    let dd = 0; c.ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [, typ, v] of c.ev) { bal += v; if (typ === 0) pk += v; pk = Math.max(pk, bal); if (pk > 0) dd = Math.max(dd, 1 - bal / pk); }
    return { k, y: c.y, m: c.m, start, dep: c.dep, risk: snap ? snap.risk : 0, n: c.n, wins: c.wins, losses: c.losses, won: c.won, lost: c.lost, R: c.R, profit: c.profit, end: bal, dd, coins: c.coins };
  });
  const years = [];
  for (const mo of months) {
    let y = years[years.length - 1];
    if (!y || y.y !== mo.y) { y = { y: mo.y, start: mo.start, risk: mo.risk, dep: 0, n: 0, wins: 0, losses: 0, won: 0, lost: 0, R: 0, profit: 0, end: mo.start, dd: 0, coins: {} }; years.push(y); }
    y.dep += mo.dep; y.n += mo.n; y.wins += mo.wins; y.losses += mo.losses; y.won += mo.won; y.lost += mo.lost; y.R += mo.R; y.profit += mo.profit; y.end = mo.end;
    for (const [c, n] of Object.entries(mo.coins)) y.coins[c] = (y.coins[c] || 0) + n;
  }
  // a year's drop: deepest fall from the peak inside the year (deposits added to the peak), from the account's running peak at 1 January
  let rp = o.start;
  for (const y of years) {
    let b = y.start, p = Math.max(rp, y.start), dd = 0;
    const ev = [...sim.deps.filter((d) => yearOf(d.t) === y.y).map((d) => [d.t, 0, d.amt]), ...sim.rows.filter((r) => r.y === y.y).map((r) => [r.tExit, 1, r.pnl])].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [, typ, v] of ev) { b += v; if (typ === 0) p += v; p = Math.max(p, b); if (p > 0) dd = Math.max(dd, 1 - b / p); }
    y.dd = dd; y.ret = y.start + y.dep > 0 ? y.profit / (y.start + y.dep) : 0; rp = p;
  }
  return { months, years };
}

// The losing side of one simulated account: drawdown episodes, streaks, worst trades / days / months. sim from simulate(), P from simPeriods().
//   episodes : every fall below a high until the balance is back above it (deposits raise the high too, as in simulate()):
//              { peakT, troughT, rec (time back at the high, null = not yet), depth (fraction), below (₱ under the high at the bottom), n (trades to the bottom) }
//   streaks  : runs of losing / winning trades in the order they closed: { n, from, to, pnl, R, pct (of the balance when the run started) }
//   byYear   : y → longest losing streak of trades that closed in that year
function simRisk(sim, P) {
  const pts = sim.pts, rows = sim.rows, eps = [];
  let cur = null, pkT = pts.length ? pts[0][0] : 0;
  for (const [t, bal, , d] of pts) {
    if (!(d > 1e-12)) { if (cur) { cur.rec = t; eps.push(cur); cur = null; } pkT = t; continue; }
    if (!cur) cur = { peakT: pkT, troughT: t, depth: 0, below: 0, rec: null };
    if (d > cur.depth) { cur.depth = d; cur.troughT = t; cur.below = bal / (1 - d) - bal; }
  }
  if (cur) eps.push(cur);
  for (const e of eps) e.n = rows.filter((r) => r.tExit > e.peakT && r.tExit <= e.troughT).length;
  const lastT = pts.length ? pts[pts.length - 1][0] : 0;
  const under = eps.reduce((a, e) => { const d = (e.rec ?? lastT) - e.peakT; return d > a.d ? { d, e } : a; }, { d: 0, e: null });
  // streaks
  const loss = [], win = [], byYear = {};
  let s = null;
  for (const r of rows) {
    const w = r.pnl > 0;
    if (!s || s.win !== w) { if (s) (s.win ? win : loss).push(s); s = { win: w, n: 0, from: r.tc, to: r.tc, pnl: 0, R: 0, before: r.bal - r.pnl }; }
    s.n++; s.to = r.tc; s.pnl += r.pnl; s.R += r.R;
  }
  if (s) (s.win ? win : loss).push(s);
  for (const x of [...loss, ...win]) x.pct = x.before > 0 ? x.pnl / x.before : 0;
  let run = 0, ry = null;
  for (const r of rows) {
    if (r.y !== ry) { run = 0; ry = r.y; }
    run = r.pnl > 0 ? 0 : run + 1;
    byYear[r.y] = Math.max(byYear[r.y] || 0, run);
  }
  // worst single trades and days (UTC), as a share of the balance just before them
  const trades = rows.filter((r) => r.pnl < 0).map((r) => ({ ...r, pct: r.bal - r.pnl > 0 ? r.pnl / (r.bal - r.pnl) : 0 })).sort((a, b) => a.pct - b.pct);
  const dayM = new Map();
  for (const r of rows) {
    const d = new Date(r.tc * 1000), k = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (!dayM.has(k)) dayM.set(k, { t: r.tc, n: 0, losses: 0, pnl: 0, before: r.bal - r.pnl });
    const c = dayM.get(k); c.n++; c.pnl += r.pnl; if (r.pnl <= 0) c.losses++;
  }
  const daysL = [...dayM.values()].filter((d) => d.pnl < 0).map((d) => ({ ...d, pct: d.before > 0 ? d.pnl / d.before : 0 })).sort((a, b) => a.pct - b.pct);
  // months: losing months, the longest run of them (months without a closed trade do not break or extend a run), the worst ones
  const mons = P.months.filter((m) => m.n), mpct = (m) => (m.start + m.dep > 0 ? m.profit / (m.start + m.dep) : 0);
  let mr = null, mBest = null;
  for (const m of mons) {
    if (m.profit < 0) { if (!mr) mr = { n: 0, from: m.k, to: m.k, pnl: 0 }; mr.n++; mr.to = m.k; mr.pnl += m.profit; if (!mBest || mr.n > mBest.n || (mr.n === mBest.n && mr.pnl < mBest.pnl)) mBest = { ...mr }; }
    else mr = null;
  }
  const monthsL = mons.filter((m) => m.profit < 0).map((m) => ({ ...m, pct: mpct(m) })).sort((a, b) => a.pct - b.pct);
  const bucket = (lo, hi) => loss.filter((x) => x.n >= lo && x.n <= hi).length;
  return {
    episodes: eps, deepest: eps.reduce((a, e) => (!a || e.depth > a.depth ? e : a), null), under, now: cur,
    loss, win, cur: s, byYear, longestLoss: loss.reduce((a, x) => (!a || x.n > a.n || (x.n === a.n && x.pnl < a.pnl) ? x : a), null),
    longestWin: win.reduce((a, x) => (!a || x.n > a.n || (x.n === a.n && x.pnl > a.pnl) ? x : a), null),
    costliest: loss.reduce((a, x) => (!a || x.pct < a.pct ? x : a), null),
    streakDist: [['1–2', bucket(1, 2)], ['3–5', bucket(3, 5)], ['6–9', bucket(6, 9)], ['10–14', bucket(10, 14)], ['15+', bucket(15, Infinity)]],
    worstTrades: trades.slice(0, 8), worstDays: daysL.slice(0, 8), worstMonths: monthsL.slice(0, 8),
    lossMonths: monthsL.length, months: mons.length, monthRun: mBest, lossTrades: rows.filter((r) => r.pnl <= 0).length,
  };
}

const API = { COINS, TF, TF_LABEL, STRATS, PARAMS, coinTrades, stats, book, years, curve, months, days, analyse, yearOf,
  rng, quantile, bootstrapMean, wilson, kelly, monteCarlo, maxOpen, underwater, corr, edge, simulate, simPeriods, simRisk };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis.AnalysisCore = API;
})();
