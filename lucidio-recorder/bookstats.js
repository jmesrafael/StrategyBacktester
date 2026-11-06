// bookstats.js - what a market order of a given size costs on MEXC's order book, and the summary of many snapshots. Pure functions (no files, no network).
// A MEXC level is [price, contracts, orders]; 1 contract = spec.contractSize coins. Slippage is in basis points (1 bp = 0.01%) ADVERSE to the order, measured against the mid
// price, so it already contains half the spread: a buy that pays 100.01 when the mid is 100.00 is 1 bp.
'use strict';

const SIZES_USD = [100, 500, 1000, 5000, 20000];
const num = (v) => (v == null || !Number.isFinite(+v) ? null : +v);
const r = (v, d = 3) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(d));

// the average price of spending `usd` on one side of the book. null when the levels shown are not deep enough for it.
function walkNotional(levels, contractSize, usd) {
  let left = usd, units = 0;
  for (const l of levels || []) {
    const p = num(l[0]), q = num(l[1]);
    if (!(p > 0) || !(q > 0)) continue;
    const levelUsd = q * contractSize * p, take = Math.min(left, levelUsd);
    units += take / p; left -= take;
    if (left <= 1e-9) return usd / units;
  }
  return null;
}

// one snapshot of the book: spread, depth near the price, and the adverse slippage of a buy and a sell at each size
function snapshotOf(book, spec, nowMs, sizes = SIZES_USD) {
  if (!book || !Array.isArray(book.asks) || !Array.isArray(book.bids) || !book.asks.length || !book.bids.length) return null;
  const bid = num(book.bids[0][0]), ask = num(book.asks[0][0]), cs = num(spec && spec.contractSize);
  if (!(bid > 0) || !(ask > 0) || !(cs > 0)) return null;
  const mid = (bid + ask) / 2, buy = {}, sell = {};
  for (const usd of sizes) {
    const b = walkNotional(book.asks, cs, usd), s = walkNotional(book.bids, cs, usd);
    buy[usd] = b == null ? null : r(((b - mid) / mid) * 1e4);
    sell[usd] = s == null ? null : r(((mid - s) / mid) * 1e4);
  }
  const within = (side, pct, dir) => side.reduce((a, l) => ((dir === 1 ? +l[0] <= mid * (1 + pct) : +l[0] >= mid * (1 - pct)) ? a + +l[1] * cs * +l[0] : a), 0);
  return { t: nowMs, bid, ask, mid: r(mid, 8), sp: r(((ask - bid) / mid) * 1e4), buy, sell,
    ask_d01: Math.round(within(book.asks, 0.001, 1)), bid_d01: Math.round(within(book.bids, 0.001, -1)), ask_d05: Math.round(within(book.asks, 0.005, 1)), bid_d05: Math.round(within(book.bids, 0.005, -1)) };
}

const quantile = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null);
function dist(values) {
  const v = values.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  return { n: v.length, med: r(quantile(v, 0.5)), p90: r(quantile(v, 0.9)) };
}

// many snapshots of one coin -> the summary the paper bot and the dashboard use
function summarize(snaps, sizes = SIZES_USD) {
  const s = snaps.filter(Boolean);
  const side = (k) => Object.fromEntries(sizes.map((usd) => [String(usd), dist(s.map((x) => x[k] && x[k][usd]))]));
  return { n: s.length, spread_bp: dist(s.map((x) => x.sp)), buy: side('buy'), sell: side('sell'), ask_d05: dist(s.map((x) => x.ask_d05)).med, bid_d05: dist(s.map((x) => x.bid_d05)).med };
}

// the compact numbers the dashboard heartbeat carries per coin (every key a short lower-case name, every value a number)
function heartbeatSlip(sum) {
  const g = (side, usd, k) => (sum[side][usd] ? sum[side][usd][k] : null);
  const o = { sp: sum.spread_bp.med, spp90: sum.spread_bp.p90, b100: g('buy', 100, 'med'), b1000: g('buy', 1000, 'med'), b5000: g('buy', 5000, 'med'), b20000: g('buy', 20000, 'med'),
    s100: g('sell', 100, 'med'), s1000: g('sell', 1000, 'med'), s5000: g('sell', 5000, 'med'), s20000: g('sell', 20000, 'med'),
    b1000p90: g('buy', 1000, 'p90'), b5000p90: g('buy', 5000, 'p90'), s1000p90: g('sell', 1000, 'p90'), s5000p90: g('sell', 5000, 'p90'), n: sum.n };
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
}

module.exports = { SIZES_USD, walkNotional, snapshotOf, summarize, heartbeatSlip, dist };
