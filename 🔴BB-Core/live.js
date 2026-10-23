// live.js — Lucid'io's MEXC executor: the same 3 methods as the paper executor (enter / checkExit / timeExit) + reconcile, but real orders.
//
//   enter      market order (isolated margin) with the backtest's stop + target ATTACHED, then verified on MEXC; if MEXC does not show
//              both, they are placed again; if that still fails the position is closed at once (never left unprotected).
//   checkExit  asks MEXC whether the position is still open. Stop / target are executed BY MEXC (trigger on last price, like the
//              backtest's candle highs/lows), so they work even while the VPS is down. Result = MEXC's realised P&L / risk.
//   timeExit   48 candles old -> market close (the only exit the bot itself has to do).
//   reconcile  every run, before deciding: finish a half-done entry (crash between "order sent" and "state saved"), refuse new entries on
//              a coin where MEXC holds a position the bot did not open (manual trade, other bot), re-place a missing stop / target.
//
// No double orders: every order carries an externalOid built from the signal candle (bbSOL1792612800L). After any error the bot looks the
// order up by that id instead of sending it again.
'use strict';
const { assertAllowedSymbol } = require('./config.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decimals = (u) => { const s = String(u); return s.includes('e-') ? +s.split('e-')[1] : (s.split('.')[1] || '').length; };
const roundTo = (v, unit) => +(Math.round(v / unit) * unit).toFixed(decimals(unit));
const same = (a, b, unit) => Math.abs(+a - +b) <= unit / 2 + 1e-12;

// contracts for a target $ risk. Rounds to the nearest contract, never more than maxRiskMult × target; null if even 1 contract is too much.
function sizeOrder({ riskUsd, px, stop, spec, maxRiskMult = 1.5 }) {
  const step = +spec.volUnit || 1, minVol = +spec.minVol || step, perC = Math.abs(px - stop) * +spec.contractSize;
  if (!(perC > 0) || !(riskUsd > 0)) return null;
  let vol = Math.round(riskUsd / perC / step) * step;
  if (vol < minVol) vol = minVol;
  while (vol >= minVol && vol * perC > maxRiskMult * riskUsd) vol -= step;
  if (vol < minVol) return null;
  if (spec.maxVol && vol > +spec.maxVol) vol = +spec.maxVol;
  return { vol: +vol.toFixed(decimals(step)), riskUsd: vol * perC, perContract: perC };
}
// leverage so the liquidation price sits about TWICE as far away as the stop (isolated margin): margin ≈ 2 × risk
function leverageFor(px, stop, spec, maxLev = 20) {
  const dist = Math.abs(px - stop) / px, mmr = +spec.maintenanceMarginRate || 0.005;
  return Math.max(1, Math.min(maxLev, +spec.maxLeverage || maxLev, Math.floor(0.5 / (dist + mmr))));
}

// How deep was the book when the order went in? Recorded only (research: lets a later review judge market impact at a bigger size).
// A BUY consumes the asks, a SELL the bids. Notional = contracts × contractSize × price, summed within 0.1% / 0.5% / 1% of the price.
// MEXC levels are [price, contracts, number of orders] (checked against the live endpoint 2026-10-23: the 2nd number is in the tens of thousands).
function summarizeBook(book, px, dir, spec, nowMs = Date.now()) {
  if (!book || !Array.isArray(book.asks) || !Array.isArray(book.bids) || !(px > 0)) return null;
  const cs = +spec.contractSize || 1, side = dir === 1 ? book.asks : book.bids;
  const within = (pct) => side.reduce((s, [p, v]) => ((dir === 1 ? +p <= px * (1 + pct) : +p >= px * (1 - pct)) ? s + (+v) * cs * (+p) : s), 0);
  const bestAsk = book.asks.length ? +book.asks[0][0] : null, bestBid = book.bids.length ? +book.bids[0][0] : null;
  return { ts_ms: nowMs, consumed: dir === 1 ? 'asks' : 'bids', best_bid: bestBid, best_ask: bestAsk,
    spread_pct: bestAsk && bestBid ? +(((bestAsk - bestBid) / px) * 100).toFixed(5) : null, levels: side.length,
    notional_usd_0_1pct: +within(0.001).toFixed(2), notional_usd_0_5pct: +within(0.005).toFixed(2), notional_usd_1pct: +within(0.01).toFixed(2) };
}
const BOOK_WAIT_MS = 1500;                // the book is research data: never hold an entry back for it
const MEXC_FIELDS = ['positionId', 'openAvgPrice', 'holdAvgPrice', 'closeAvgPrice', 'realised', 'fee', 'holdFee', 'closeVol', 'holdVol', 'leverage', 'createTime', 'updateTime', 'profitRatio'];

function createLiveExecutor({ api, cfg = {}, log = () => {} }) {
  const specs = {};
  const sym = (coin) => `${coin}_USDT`;
  const maxRiskMult = cfg.maxRiskMult ?? 1.5, maxLev = cfg.maxLeverage ?? 20;

  async function waitFill(symbol, oid, tries = 8) {         // market orders fill at once; allow MEXC a few seconds to report it
    for (let k = 0; k < tries; k++) {
      try {
        const o = await api.orderByExternalOid(symbol, oid);
        if (o && +o.state === 3 && +o.dealVol > 0) return o;
        if (o && (+o.state === 4 || +o.state === 5)) return +o.dealVol > 0 ? o : null;
      } catch (e) { if (k === tries - 1) log(`order ${oid} lookup failed: ${e.message}`); }
      await sleep(k < 3 ? 700 : 1500);
    }
    return null;
  }
  const myPositions = async (coin) => ((await api.openPositions(sym(coin))) || []).filter((p) => +p.holdVol > 0);
  async function findClosed(pos) {
    for (let k = 0; k < 4; k++) {
      const h = ((await api.historyPositions(sym(pos.coin), (pos.openedAt || 0) - 60000)) || []).find((x) => String(x.positionId) === String(pos.positionId) && +x.state === 3);
      if (h) return h;
      await sleep(1500);
    }
    return null;
  }
  // extra (research only, never read by the trading logic): closedBy = who closed it; decidedPx = the price the bot saw when it sent a market close
  function result(pos, px, why, h, extra = {}) {
    const pnl = h && h.realised != null ? +h.realised : pos.dir * (px - pos.entry) * pos.qty;
    const trigger = why === 'stop' ? pos.stop : why === 'target' ? pos.tp : null, ref = trigger ?? extra.decidedPx ?? null, oneR = Math.abs(pos.entry - pos.stop);
    const mexc = h ? Object.fromEntries(MEXC_FIELDS.filter((k) => h[k] !== undefined).map((k) => [k, h[k]])) : null;
    return { px, why, R: pnl / pos.riskUsd, usd: pnl, funding: h ? +h.holdFee || 0 : null, fees: h ? +h.fee || 0 : null,
      trigger_price: trigger, fill_price: px, closed_by: extra.closedBy || 'mexc_trigger',
      exit_slip_r: ref != null && oneR > 0 ? +((pos.dir * (ref - px)) / oneR).toFixed(4) : null,      // positive = the fill was worse than the trigger / the price the bot saw
      mexc_history: mexc };
  }
  const classify = (pos, px) => (Math.abs(px - pos.stop) <= Math.abs(px - pos.tp) ? 'stop' : 'target');

  async function ensureProtection(pos) {
    const spec = specs[pos.coin] || {}, unit = +spec.priceUnit || 1e-8;
    for (let k = 0; k < 4; k++) {
      let mine = [];
      try { mine = ((await api.openTpSl(sym(pos.coin))) || []).filter((s) => String(s.positionId) === String(pos.positionId) && +s.isFinished !== 1 && +s.state === 1); }
      catch (e) { log(`${pos.coin} TP/SL list failed: ${e.message}`); }
      const hasSL = mine.some((s) => same(s.stopLossPrice, pos.stop, unit)), hasTP = mine.some((s) => same(s.takeProfitPrice, pos.tp, unit));
      if (hasSL && hasTP) return true;
      if (k === 0) { await sleep(1500); continue; }            // the TP/SL attached to the entry order can take a moment to appear
      log(`${pos.coin} ${hasSL ? '' : 'stop '}${hasTP ? '' : 'target '}missing on MEXC — placing it (attempt ${k})`);
      try {
        await api.placeTpSl({ positionId: pos.positionId, vol: pos.vol, lossTrend: 1, profitTrend: 1, volType: 2, profitLossVolType: 'SAME', stopLossType: 0, takeProfitType: 0,
          stopLossPrice: hasSL ? undefined : pos.stop, takeProfitPrice: hasTP ? undefined : pos.tp });
      } catch (e) { log(`${pos.coin} TP/SL place failed: ${e.message}`); }
      await sleep(1500);
    }
    return false;
  }

  // market-close the whole position (time exit, or emergency). Returns the exit result, or null if MEXC still shows it open.
  async function close(pos, why) {
    const symbol = sym(pos.coin);
    assertAllowedSymbol(symbol, 'live close');
    if (!(await myPositions(pos.coin)).some((p) => String(p.positionId) === String(pos.positionId))) {   // already closed by MEXC
      const h = await findClosed(pos);
      return result(pos, h ? +h.closeAvgPrice : pos.entry, h ? classify(pos, +h.closeAvgPrice) : why, h);
    }
    const oid = `bx${pos.coin}${Math.floor((api.now ? api.now() : Date.now()) / 1000)}${why === 'time' ? 'T' : 'E'}`.slice(0, 32); // new id per attempt (the position check above prevents double closes)
    let px = pos.entry; try { px = +(await api.ticker(symbol)).lastPrice; } catch {}
    try { await api.createOrder({ symbol, price: px, vol: pos.vol, side: pos.dir === 1 ? 4 : 2, type: 5, openType: 1, positionId: pos.positionId, externalOid: oid }); }
    catch (e) { log(`${pos.coin} close order error: ${e.message} — checking MEXC`); }
    const f = await waitFill(symbol, oid);
    if (!f && (await myPositions(pos.coin)).some((p) => String(p.positionId) === String(pos.positionId))) return null;
    try {   // leftover TP/SL of a closed position
      const left = ((await api.openTpSl(symbol)) || []).filter((s) => String(s.positionId) === String(pos.positionId) && +s.isFinished !== 1);
      if (left.length) await api.cancelTpSl(left.map((s) => s.id));
    } catch (e) { log(`${pos.coin} TP/SL cleanup: ${e.message}`); }
    const h = await findClosed(pos);
    return result(pos, f ? +f.dealAvgPrice : h ? +h.closeAvgPrice : px, why, h, { closedBy: `bot_${why === 'time' ? 'time_exit' : why}`, decidedPx: px });
  }

  function buildPos(p, fill) {
    const spec = specs[p.coin], entry = +fill.dealAvgPrice, vol = +fill.dealVol, qty = vol * +spec.contractSize;
    return { coin: p.coin, dir: p.dir, entry, stop: p.stop, tp: p.tp, vol, qty, positionId: fill.positionId, lev: p.lev, oid: p.oid,
      riskUsd: qty * Math.abs(entry - p.stop), dist: Math.abs(entry - p.stop) / entry, t0: p.t0, sigTime: p.sigTime, openedAt: p.at, live: true, entryBook: p.book || null };
  }

  return {
    sizeOrder, leverageFor, ensureProtection, close,
    async beginRun(coins) { for (const c of coins) { assertAllowedSymbol(sym(c), 'live setup'); specs[c] = await api.contract(sym(c)); } },
    spec: (coin) => specs[coin],

    async reconcile(coin, st) {
      const ev = [], symbol = sym(coin);
      if (st.pending) {
        const f = await waitFill(symbol, st.pending.oid, 3);
        if (f) { st.pos = buildPos(st.pending, f); ev.push(`RECOVERED ${coin}: order ${st.pending.oid} had filled before the bot stopped — position adopted`); st.pending = null; }
        else if ((await myPositions(coin)).length) return { ev: [...ev, `WARNING ${coin}: order ${st.pending.oid} still cannot be looked up but MEXC shows a ${coin} position — retrying next run`], blocked: `unresolved order ${st.pending.oid}` };
        else { ev.push(`${coin}: unfinished order ${st.pending.oid} never filled — cleared`); st.pending = null; }
      }
      const open = await myPositions(coin);
      if (st.pos && !st.pos.live) return { ev, blocked: `${coin}: state holds a PAPER position — finish paper mode or start live with a fresh state/ folder` };
      const foreign = open.filter((p) => !st.pos || String(p.positionId) !== String(st.pos.positionId));
      if (st.pos && open.some((p) => String(p.positionId) === String(st.pos.positionId)) && !(await ensureProtection(st.pos)))
        ev.push(`WARNING ${coin}: stop / target missing on MEXC and could not be re-placed — CHECK THE APP`);
      return { ev, blocked: foreign.length ? `MEXC holds ${foreign.length} ${coin} position(s) the bot did not open — no new ${coin} entries until they are closed` : null };
    },

    async enter(coin, o) {
      assertAllowedSymbol(sym(coin), 'live entry');           // layer 2: before ANY state change or network call
      const spec = specs[coin], symbol = sym(coin), d = o.dir;
      if (!spec || +spec.state !== 0 || spec.apiAllowed === false) return { skip: `${symbol} is not tradable via API right now` };
      if ((await myPositions(coin)).length) return { skip: `MEXC already has a ${coin} position` };
      const px = +(await api.ticker(symbol)).lastPrice, unit = +spec.priceUnit;
      const stop = roundTo(o.stop, unit), tp = roundTo(o.tp, unit);
      if (d === 1 ? !(px > stop && px < tp) : !(px < stop && px > tp)) return { skip: `price ${px} is already past the stop ${stop} or target ${tp}` };
      const sz = sizeOrder({ riskUsd: o.riskUsd, px, stop, spec, maxRiskMult });
      if (!sz) return { skip: `1 contract would risk $${(Math.abs(px - stop) * spec.contractSize).toFixed(2)}, more than ${maxRiskMult}× the $${o.riskUsd.toFixed(2)} target` };
      const lev = leverageFor(px, stop, spec, maxLev), margin = (sz.vol * +spec.contractSize * px) / lev;
      const bookReq = typeof api.depth === 'function' ? api.depth(symbol).catch(() => null) : Promise.resolve(null);   // research: runs while the margin is checked
      const avail = +(await api.asset('USDT')).availableBalance;
      if (!(avail >= margin * 1.1)) return { skip: `not enough free margin: need ~$${(margin * 1.1).toFixed(2)}, have $${avail.toFixed(2)}` };
      let book = null;
      try { book = summarizeBook(await Promise.race([bookReq, sleep(BOOK_WAIT_MS).then(() => null)]), px, d, spec); } catch { book = null; }

      const oid = `bb${coin}${o.sigTime}${d === 1 ? 'L' : 'S'}`.slice(0, 32);
      o.st.pending = { oid, coin, dir: d, stop, tp, lev, t0: o.t0, sigTime: o.sigTime, at: api.now ? Math.round(api.now()) : Date.now(), book };
      o.save();                                                 // written BEFORE sending: a crash now is recovered by reconcile()
      let sendErr = null;
      try { await api.createOrder({ symbol, price: px, vol: sz.vol, leverage: lev, side: d === 1 ? 1 : 3, type: 5, openType: 1, externalOid: oid, stopLossPrice: stop, takeProfitPrice: tp, lossTrend: 1, profitTrend: 1 }); }
      catch (e) { sendErr = e; log(`${coin} order send error: ${e.message} — checking MEXC by id ${oid}`); }
      const f = await waitFill(symbol, oid, sendErr && ![9999, 500, 501, 510].includes(sendErr.code) ? 2 : 8);
      if (!f) {
        if ((await myPositions(coin).catch(() => [1])).length) return { skip: `entry order ${oid} status unknown but MEXC shows a ${coin} position — resolved on the next run`, error: true }; // keep pending
        o.st.pending = null; o.save(); return { skip: `entry order not filled${sendErr ? ': ' + sendErr.message : ''}`, error: true };
      }
      const pos = buildPos(o.st.pending, f);
      o.st.pending = null;
      if (!(await ensureProtection(pos))) {
        const x = await close(pos, 'abort');
        o.save();
        return x ? { skip: `stop/target could not be placed — position closed again at once (${x.usd >= 0 ? '+' : ''}$${x.usd.toFixed(2)})`, error: true, aborted: x, pos }
                 : { pos, warn: 'STOP / TARGET MISSING AND CLOSE FAILED — CHECK MEXC NOW' };
      }
      return { pos };
    },

    async checkExit(pos, c) {
      if ((await myPositions(pos.coin)).some((p) => String(p.positionId) === String(pos.positionId))) return null;
      const h = await findClosed(pos);
      const px = h ? +h.closeAvgPrice : (pos.dir === 1 ? (c.low <= pos.stop ? pos.stop : pos.tp) : (c.high >= pos.stop ? pos.stop : pos.tp));
      return result(pos, px, classify(pos, px), h);
    },

    async timeExit(pos) { return close(pos, 'time'); },
  };
}

module.exports = { createLiveExecutor, sizeOrder, leverageFor, roundTo, summarizeBook };
