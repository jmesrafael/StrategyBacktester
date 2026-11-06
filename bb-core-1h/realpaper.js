// realpaper.js - the paper executor with real-world costs. Same three methods as the plain paper executor (enter / checkExit / timeExit), same decisions, but the money side is what
// the exchange would really do, so a paper result can be trusted as a forecast of a live one:
//
//   size       whole contracts, rounded exactly like the live bot (live.js sizeOrder): the risk is what the contracts really risk, and a coin whose one contract risks too much is skipped
//   entry      a market order walks MEXC's real order book (public depth, fetched at the moment of entry): the fill is the volume-weighted price of the levels it eats
//   fees       the coin's own taker rate from MEXC's public contract detail (market orders: entry, stop, time exit), maker for a resting target; never below minTakerFee, so a
//              promotional 0% is not counted as free
//   exit slip  a stop is a market order fired in a fast market: its slippage is the 90th percentile measured by the data recorder over the last days (the median for a calm time
//              exit); when no recorded data exists, the live book's walk at that moment
//   funding    the real settled funding rates of the hours the trade was open (MEXC's public funding history), paid by longs when positive and by shorts when negative
//
// Any data call that fails falls back to the fixed model of the plain paper executor (and says so in the costs of that trade: costs.degraded). A failed call never stops a trade.
// Public data only: this file holds no key and cannot send an order.
'use strict';
const fs = require('fs');
const { sizeOrder, leverageFor } = require('./live.js');

const HOUR = 3600e3;
const num = (v) => (v == null || !Number.isFinite(+v) ? null : +v);

// ---------------- pure helpers (tested in test/realpaper-test.js) ----------------

// Market order for `vol` contracts against one side of the book: levels = [[price, contracts, orders], ...] best first.
// Returns { avg, filled, complete }: avg = volume-weighted price of what was filled; complete = false when the book shown was too thin for the whole order.
function walkBook(levels, vol) {
  let left = vol, cost = 0, filled = 0;
  for (const l of levels || []) {
    const p = num(l[0]), q = num(l[1]);
    if (p == null || q == null || q <= 0) continue;
    const take = Math.min(left, q);
    cost += take * p; filled += take; left -= take;
    if (left <= 1e-9) break;
  }
  return { avg: filled > 0 ? cost / filled : null, filled, complete: left <= 1e-9 };
}

// What a market order of `vol` contracts costs against the book. adverse = fractional price worse than the mid (>0 = paid more / received less), halfSpread included.
function bookSlip(book, dir, vol) {
  if (!book || !Array.isArray(book.asks) || !Array.isArray(book.bids) || !book.asks.length || !book.bids.length) return null;
  const bid = num(book.bids[0][0]), ask = num(book.asks[0][0]);
  if (!(bid > 0) || !(ask > 0)) return null;
  const mid = (bid + ask) / 2, w = walkBook(dir === 1 ? book.asks : book.bids, vol);
  if (w.avg == null) return null;
  return { mid, bid, ask, avg: w.avg, adverse: (dir * (w.avg - mid)) / mid, spread_bp: ((ask - bid) / mid) * 1e4, complete: w.complete };
}

// the taker / maker rate a trade is charged: MEXC's listed rate for the coin, but never below the configured floor
function feeRates(spec, cfg = {}) {
  const floor = num(cfg.minTakerFee) ?? 0.0002, listedTaker = num(spec && spec.takerFeeRate), listedMaker = num(spec && spec.makerFeeRate);
  return { taker: Math.max(listedTaker ?? floor, floor), maker: Math.max(listedMaker ?? 0, 0), listed_taker: listedTaker, listed_maker: listedMaker, floor };
}

// funding the trade paid, as a fraction of its notional: the sum of the settled rates in (fromMs, toMs]. Positive = paid (long when rates are positive).
// history = [{ settleTime, fundingRate }]. Returns { sum, events }.
function fundingBetween(history, fromMs, toMs) {
  let sum = 0, events = 0;
  for (const h of history || []) {
    const t = num(h.settleTime), r = num(h.fundingRate);
    if (t == null || r == null || !(t > fromMs && t <= toMs)) continue;
    sum += r; events++;
  }
  return { sum, events };
}

// the recorder's measured slippage (bp, adverse vs mid) for a coin, side and order size: linear between the sizes it measured, the largest one beyond them.
// summary = the recorder's summary/slippage.json. stat = 'med' | 'p90'. Returns { bp, stat, size_note } or null.
function recordedSlip(summary, symbol, dir, notionalUsd, stat = 'p90', nowMs = Date.now(), maxAgeMs = 6 * HOUR) {
  if (!summary || !summary.coins || !(nowMs - num(summary.updated_ms) <= maxAgeMs)) return null;
  const c = summary.coins[symbol], side = c && (dir === 1 ? c.buy : c.sell);
  if (!side) return null;
  const pts = Object.keys(side).map((k) => ({ usd: +k, bp: num(side[k] && side[k][stat]) })).filter((p) => Number.isFinite(p.usd) && p.bp != null).sort((a, b) => a.usd - b.usd);
  if (!pts.length) return null;
  if (notionalUsd <= pts[0].usd) return { bp: pts[0].bp, stat, size_note: 'smaller than the smallest measured size' };
  for (let i = 1; i < pts.length; i++) if (notionalUsd <= pts[i].usd) {
    const a = pts[i - 1], b = pts[i], f = (notionalUsd - a.usd) / (b.usd - a.usd);
    return { bp: a.bp + f * (b.bp - a.bp), stat, size_note: null };
  }
  return { bp: pts[pts.length - 1].bp, stat, size_note: 'larger than the largest measured size' };
}

// ---------------- the executor ----------------
// deps: client (mexc.client: contract, depth, fundingHistory), cfgFn() -> bot config, cost (the fixed fallback model: DEFAULTS.cost), interval (candle seconds), log(msg),
// summaryFile (the recorder's slippage summary; optional), clock() -> ms
function createRealisticPaper({ client, cfgFn, cost, interval, log = () => {}, summaryFile = process.env.LUCIDIO_RECORDER_SUMMARY || '/var/lib/lucidio-recorder/summary/slippage.json', clock = Date.now }) {
  const specs = new Map(), funding = new Map(), warned = new Map();
  const warnOnce = (k, msg) => { if (clock() - (warned.get(k) || 0) > 6 * HOUR) { warned.set(k, clock()); try { log(msg); } catch {} } };

  async function specFor(symbol) {
    const hit = specs.get(symbol);
    if (hit && clock() - hit.at < 6 * HOUR) return hit.spec;
    try { const spec = await client.contract(symbol); specs.set(symbol, { at: clock(), spec }); return spec; }
    catch (e) { warnOnce(`spec:${symbol}`, `realistic paper: contract detail for ${symbol} failed (${e.message})${hit ? ', using the last known' : ''}`); return hit ? hit.spec : null; }
  }
  async function fundingFor(symbol) {
    const hit = funding.get(symbol);
    if (hit && clock() - hit.at < 10 * 60e3) return hit.rows;
    try { const d = await client.fundingHistory(symbol, 60); const rows = (d && d.resultList) || []; funding.set(symbol, { at: clock(), rows }); return rows; }
    catch (e) { warnOnce(`fund:${symbol}`, `realistic paper: funding history for ${symbol} failed (${e.message})${hit ? ', using the last known' : ''}`); return hit ? hit.rows : null; }
  }
  const readSummary = () => { try { return JSON.parse(fs.readFileSync(summaryFile, 'utf8')); } catch { return null; } };

  // the slippage (fraction, adverse) of closing `vol` contracts now or at a stop: recorded p90 / median first, then the live book, then the fixed model
  async function exitSlip(symbol, dir, vol, spec, why, refPx) {
    if (!(vol > 0) || !spec || !(+spec.contractSize > 0)) return { frac: cost.slip, source: 'fixed model (fallback)', note: null, degraded: true };
    const exitDir = -dir, stat = why === 'stop' ? 'p90' : 'med';
    const rec = recordedSlip(readSummary(), symbol, exitDir, vol * +spec.contractSize * refPx, stat, clock());
    if (rec) return { frac: rec.bp / 1e4, source: `recorded ${stat}`, note: rec.size_note };
    try {
      const book = await client.depth(symbol, 100), s = bookSlip(book, exitDir, vol);
      if (s) return { frac: Math.max(0, s.adverse), source: 'live book now', note: s.complete ? null : 'book too thin for the whole order' };
    } catch (e) { warnOnce(`depth:${symbol}`, `realistic paper: order book for ${symbol} failed (${e.message})`); }
    return { frac: cost.slip, source: 'fixed model (fallback)', note: null, degraded: true };
  }

  async function close(pos, px, why, tMs, exitSlipInfo) {
    const spec = pos.spec || null, fee = pos.fees || { taker: cost.entryFee, maker: cost.tpFee };
    const exitFee = why === 'target' ? fee.maker : fee.taker;
    let fr = 0, events = 0, fundSource = 'none', degraded = !!pos.degraded && pos.degraded.length ? [...pos.degraded] : [];
    const rows = await fundingFor(pos.symbol);
    if (rows) { const f = fundingBetween(rows, pos.entryMs, tMs); fr = f.sum; events = f.events; fundSource = 'MEXC settled history'; }
    else { degraded.push('funding unknown: counted as 0'); fundSource = 'unavailable'; }
    const dirRet = pos.dir * (px - pos.entry) / pos.entry, R = (dirRet - fee.taker - exitFee - pos.dir * fr) / pos.dist;
    const entrySlip = pos.entrySlipFrac ?? 0, exitSlip = exitSlipInfo ? exitSlipInfo.frac : 0;
    if (exitSlipInfo && exitSlipInfo.degraded) degraded.push('exit slippage: fixed model');
    return { px, why, R, costs: {
      kind: 'modelled (paper)', fees_pct: (fee.taker + exitFee) * 100, fees_r: (fee.taker + exitFee) / pos.dist, slippage_pct: (entrySlip + exitSlip) * 100,
      funding_r: -pos.dir * fr / pos.dist, funding_events: events, funding_source: fundSource, fee_taker: fee.taker, fee_listed_taker: fee.listed_taker,
      entry_slip_source: pos.entrySlipSource || null, exit_slip_source: exitSlipInfo ? exitSlipInfo.source : null, exit_slip_bp: exitSlip * 1e4, ...(degraded.length ? { degraded } : {}) } };
  }

  return {
    async enter(coin, o) {
      const symbol = `${coin}_USDT`, d = o.dir, ref = o.refOpen, c = cfgFn(), degraded = [];
      const spec = await specFor(symbol);
      let vol = null, riskUsd = o.riskUsd, qty = o.riskUsd / Math.abs(ref - o.stop), lev = null;
      if (spec) {
        const sz = sizeOrder({ riskUsd: o.riskUsd, px: ref, stop: o.stop, spec, maxRiskMult: c.maxRiskMult ?? 1.5 });
        if (!sz) return { skip: `1 contract would risk $${(Math.abs(ref - o.stop) * spec.contractSize).toFixed(2)}, more than ${c.maxRiskMult ?? 1.5}× the $${o.riskUsd.toFixed(2)} target` };
        vol = sz.vol; qty = vol * +spec.contractSize; lev = leverageFor(ref, o.stop, spec, c.maxLeverage ?? 20);
      } else degraded.push('contract detail unavailable: size not rounded to contracts');
      // the fill: walk the real book for the order's size
      let fill = ref * (1 + d * cost.slip), entrySlipFrac = cost.slip, entrySlipSource = 'fixed model (fallback)', book = null;
      if (vol != null) {
        try {
          const b = await client.depth(symbol, 100), s = bookSlip(b, d, vol);
          if (s) { fill = s.avg; entrySlipFrac = Math.max(0, s.adverse); entrySlipSource = s.complete ? 'live book walk' : 'live book walk (book too thin: last level)'; book = { mid: s.mid, spread_bp: +s.spread_bp.toFixed(3), slip_bp: +(s.adverse * 1e4).toFixed(3) }; }
          else degraded.push('order book empty: fixed slippage');
        } catch (e) { degraded.push('order book unavailable: fixed slippage'); warnOnce(`depth:${symbol}`, `realistic paper: order book for ${symbol} failed (${e.message})`); }
      } else degraded.push('order book skipped (no contract size)');
      const dist = Math.abs(fill - o.stop) / fill;
      if (!(dist > 0) || !(o.riskUsd > 0) || !(d === 1 ? o.stop < fill : o.stop > fill)) return null;
      if (vol != null) riskUsd = vol * +spec.contractSize * Math.abs(fill - o.stop);
      else qty = o.riskUsd / Math.abs(fill - o.stop);
      const fees = feeRates(spec, c);
      return { coin, symbol, dir: d, entry: fill, stop: o.stop, tp: o.tp, dist, riskUsd, qty, vol, lev, t0: o.t0, entryMs: clock(), fees, spec: spec ? { contractSize: spec.contractSize, takerFeeRate: spec.takerFeeRate, makerFeeRate: spec.makerFeeRate } : null,
        entrySlipFrac, entrySlipSource, entryBook: book, ...(degraded.length ? { degraded } : {}) };
    },
    async checkExit(pos, c) {
      const d = pos.dir, symbol = pos.symbol || `${pos.coin}_USDT`, mid = (c.time + interval / 2) * 1000;
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) {
        const level = d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open);      // a gap through the stop fills at the open
        const slip = await exitSlip(symbol, d, pos.vol || 0, pos.spec, 'stop', level);
        return close({ ...pos, symbol }, level * (1 - d * slip.frac), 'stop', mid, slip);
      }
      if (pos.tp != null && (d === 1 ? c.high >= pos.tp * (1 + cost.tpBuf) : c.low <= pos.tp * (1 - cost.tpBuf)))
        return close({ ...pos, symbol }, d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open), 'target', mid, { frac: 0, source: 'resting limit order (no slippage)' });
      return null;
    },
    async timeExit(pos, px) {
      const symbol = pos.symbol || `${pos.coin}_USDT`, d = pos.dir;
      const slip = await exitSlip(symbol, d, pos.vol || 0, pos.spec, 'time', px);
      return close({ ...pos, symbol }, px * (1 - d * slip.frac), 'time', clock(), slip);
    },
  };
}

module.exports = { createRealisticPaper, walkBook, bookSlip, feeRates, fundingBetween, recordedSlip };
