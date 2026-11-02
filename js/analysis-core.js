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

const API = { COINS, TF, TF_LABEL, STRATS, PARAMS, coinTrades, stats, book, years, curve, months, days, analyse, yearOf };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis.AnalysisCore = API;
})();
