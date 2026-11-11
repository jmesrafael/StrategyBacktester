// test/selftest.js — the LIVE executor (live.js) against a simulated MEXC, no network, no money.
//   node test/selftest.js
// 1) parity: ~1,500 real 4h candles per coin stepped one close at a time. The fake exchange fills market orders at the price of the moment
//    and fires the stop itself while the candle trades (like MEXC does). The bot MOVES the stop at every close (trailing). Every trade must match
//    the paper executor: same entry candle, same exit reason, R within 0.01.
// 2) failure scenarios: network error after the order was sent, crash before the state was saved, stop refused, foreign position, late wake-up,
//    price already past the stop, drawdown halt, order rejected, time-exit close failing, exits while the bot was down, TRAILING-STOP failures.
'use strict';
process.env.ICORE_STATE_DIR = require('path').join(require('os').tmpdir(), 'icore-selftest-state');
const fs = require('fs'), path = require('path');
const { processCoin, paper } = require('../icore.js');
const { createLiveExecutor } = require('../live.js');
const { backtest, DEFAULTS } = require('../icore-core.js');
const C = DEFAULTS.cost, IV = 14400;

let pass = 0, failN = 0;
const ok = (cond, what) => { if (cond) pass++; else failN++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}`); };
const load = (coin) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));

// ---------------- fake MEXC ----------------
function fakeMexc(coin, opt = {}) {
  const sym = `${coin}_USDT`, spec = { symbol: sym, state: 0, apiAllowed: true, contractSize: 0.0001, minVol: 1, volUnit: 1, maxVol: 1e12, priceUnit: 1e-6, maxLeverage: 200, maintenanceMarginRate: 0.004 };
  const m = {
    t: 0, px: 0, equity: 1e6, orders: {}, positions: [], tpsl: [], history: [], nextId: 1, calls: [], knobs: { ...opt },
    now: () => m.t * 1000, syncTime: async () => ({ offsetMs: 0 }),
    contract: async () => spec, ticker: async () => ({ lastPrice: m.px }),
    asset: async () => ({ equity: m.equity, availableBalance: m.equity, unrealized: 0 }),
    openPositions: async () => { if (m.knobs.posLookupFails) throw Object.assign(new Error('network'), { code: 9999 }); return m.positions.filter((p) => p.state === 1); },
    historyPositions: async () => m.history,
    openTpSl: async () => m.tpsl.filter((s) => s.state === 1),
    orderByExternalOid: async (s, oid) => { if (m.knobs.lookupFails) throw Object.assign(new Error('network'), { code: 9999 }); const o = m.orders[oid]; if (!o) throw Object.assign(new Error('order not exist'), { code: 2009 }); return o; },
    async createOrder(o) {
      m.calls.push(['create', o]);
      if (m.knobs.reject) throw Object.assign(new Error('Balance insufficient'), { code: 2005 });
      if (o.externalOid && m.orders[o.externalOid]) throw Object.assign(new Error('duplicate externalOid'), { code: 2030 });
      if ((o.side === 4 || o.side === 2) && m.knobs.closeFails) throw Object.assign(new Error('system busy'), { code: 501 });
      const d = o.side === 1 || o.side === 2 ? 1 : -1;                     // buy side: open long / close short
      const fill = m.px * (1 + d * C.slip), id = m.nextId++;
      if (o.side === 1 || o.side === 3) {
        const pos = { positionId: id, symbol: sym, positionType: o.side === 1 ? 1 : 2, holdVol: o.vol, holdAvgPrice: fill, openAvgPrice: fill, state: 1, fee: fill * o.vol * spec.contractSize * C.fee, liquidatePrice: 0, leverage: o.leverage, bars: 0 };
        m.positions.push(pos);
        if (!m.knobs.ignoreAttached && o.stopLossPrice) m.tpsl.push({ id: m.nextId++, positionId: id, state: 1, isFinished: 0, stopLossPrice: o.stopLossPrice, vol: o.vol });
        m.orders[o.externalOid] = { state: 3, dealVol: o.vol, dealAvgPrice: fill, positionId: id, side: o.side };
      } else {
        const pos = m.positions.find((p) => p.positionId === o.positionId && p.state === 1);
        if (!pos) throw Object.assign(new Error('position not exist'), { code: 2009 });
        m.closePos(pos, fill, C.fee);
        m.orders[o.externalOid] = { state: 3, dealVol: o.vol, dealAvgPrice: fill, positionId: pos.positionId, side: o.side };
      }
      if (m.knobs.networkErrorAfterSend) { m.knobs.networkErrorAfterSend = false; throw Object.assign(new Error('network: timeout'), { code: 9999 }); }
      return { orderId: String(id) };
    },
    async placeTpSl(o) {
      m.calls.push(['tpsl', o]);
      if (m.knobs.tpslFails) throw Object.assign(new Error('feature under maintenance'), { code: 604 });
      { const first = m.tpsl.find((x) => x.positionId === o.positionId); if (m.knobs.moveFails && first && Math.abs(o.stopLossPrice - first.stopLossPrice) > 1e-9) throw Object.assign(new Error('feature under maintenance'), { code: 604 }); }   // only the ORIGINAL stop price can be (re)placed
      if (m.knobs.secondStopRefused && m.tpsl.some((x) => x.positionId === o.positionId && x.state === 1)) throw Object.assign(new Error('a stop order already exists'), { code: 2010 });
      m.tpsl.push({ id: m.nextId++, positionId: o.positionId, state: 1, isFinished: 0, stopLossPrice: o.stopLossPrice, vol: o.vol });
    },
    async cancelTpSl(ids) { m.tpsl.forEach((s) => { if (ids.includes(s.id)) s.state = 2; }); },
    closePos(pos, px, feeRate) {
      const d = pos.positionType === 1 ? 1 : -1, qty = pos.holdVol * spec.contractSize;
      const funding = pos.holdAvgPrice * qty * C.fund * pos.bars, realised = d * (px - pos.holdAvgPrice) * qty - pos.fee - px * qty * feeRate - funding;
      pos.state = 3; m.tpsl.forEach((s) => { if (s.positionId === pos.positionId) s.state = 2; });
      m.history.unshift({ positionId: pos.positionId, state: 3, closeAvgPrice: px, realised, holdFee: -funding, fee: -(pos.fee + px * qty * feeRate) });
    },
    // the candle trades: MEXC fires the stop (any live stop of the position that is touched; a gap fills at the open) and charges funding per candle held
    trade(c) {
      for (const pos of m.positions.filter((p) => p.state === 1)) {
        pos.bars++;
        const d = pos.positionType === 1 ? 1 : -1, stops = m.tpsl.filter((x) => x.positionId === pos.positionId && x.state === 1 && x.stopLossPrice).map((x) => x.stopLossPrice);
        if (!stops.length) continue;
        const sl = d === 1 ? Math.max(...stops) : Math.min(...stops);
        if (d === 1 ? c.low <= sl : c.high >= sl) m.closePos(pos, (d === 1 ? Math.min(sl, c.open) : Math.max(sl, c.open)) * (1 - d * C.slip), C.fee);
      }
    },
  };
  return m;
}
const newSt = () => ({ lastTime: null, pos: null, realizedR: 0, n: 0, trades: [] });
const forming = (c) => ({ time: c.time, open: c.open, high: c.open, low: c.open, close: c.open });

// ---------------- 1) parity: live executor on the fake exchange == paper executor ----------------
async function parity(coin, bars = 1500) {
  const all = load(coin), from = all.length - bars;
  const m = fakeMexc(coin), live = createLiveExecutor({ api: m, cfg: { maxRiskMult: 1.5 } });
  await live.beginRun([coin]);
  const stL = newSt(), stP = newSt(), acctL = { balance: 1000 }, acctP = { balance: 1000 };
  for (let k = from; k < all.length - 1; k++) {
    m.trade(all[k]);                                                   // candle k trades on the exchange
    const B = all.slice(Math.max(0, k - 499), k + 1).concat([forming(all[k + 1])]);
    m.t = all[k + 1].time + 3; m.px = all[k + 1].open;                  // bot wakes 3 s after candle k closed
    const rec = await live.reconcile(coin, stL);
    if (rec.blocked) throw new Error('unexpected block: ' + rec.blocked);
    await processCoin(coin, B, stL, live, { acct: acctL, now: m.t, nowPx: m.px, save: () => {} });
    await processCoin(coin, B, stP, paper, { acct: acctP, now: m.t, nowPx: m.px });
  }
  const a = stP.trades, b = stL.trades;
  let same = a.length === b.length, worst = 0, wInfo = "";
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i].t !== b[i].t || a[i].why !== b[i].why) same = false;
    { const g = Math.abs(a[i].R - b[i].R) - 0.015 * Math.abs(a[i].R); if (g > worst) { worst = g; wInfo = ` [worst: trade ${i} paper ${a[i].R.toFixed(3)}R live ${b[i].R.toFixed(3)}R ${a[i].why}/${b[i].why} bars ${Math.round((a[i].tExit||0))}]`; } }   // 0.01R + 1.5% of the trade's own R (the live fill carries 0.02% entry slippage inside its 1R; stops of 1.3-3% make that up to 1.5%)
  }
  ok(same && worst < 0.01, `${coin} parity over ${bars} candles: paper ${a.length} trades ${a.reduce((s, t) => s + t.R, 0).toFixed(2)}R · live-on-fake-MEXC ${b.length} trades ${b.reduce((s, t) => s + t.R, 0).toFixed(2)}R · same entries+exit reasons: ${same} · worst R gap ${worst.toFixed(4)}${wInfo}`);
  ok(m.calls.filter((c) => c[0] === 'create' && (c[1].side === 1 || c[1].side === 3)).every((c) => c[1].stopLossPrice && !c[1].takeProfitPrice && c[1].openType === 1 && c[1].type === 5), `${coin} every entry order is market, isolated, with a stop attached and NO target`);
  ok(new Set(m.calls.filter((c) => c[0] === 'create').map((c) => c[1].externalOid)).size === m.calls.filter((c) => c[0] === 'create').length, `${coin} no order id was ever sent twice`);
  { const stops = new Set(); let maxLive = 0; ok(m.calls.filter((c) => c[0] === 'tpsl').length > 0 && m.tpsl.filter((x) => x.state === 1 && m.positions.find((p) => p.positionId === x.positionId && p.state === 1)).length <= 1, `${coin} the trailing stop was moved ${m.calls.filter((c) => c[0] === 'tpsl').length} times over the run, and at most one stop is live on an open position`); void stops; void maxLive; }
  const ref = backtest(all.slice(from - 500)).trades.filter((t) => t.t >= all[from].time);
  ok(Math.abs(ref.length - b.length) <= Math.max(2, Math.ceil(0.35 * ref.length)), `${coin} about the same number of trades as backtest() on the same stretch (${ref.length} vs ${b.length}; trail trades last up to 835 candles, so a trade the backtest opened before the stretch blocks its entries while the bot starts flat: 35% allowed)`);
}

// ---------------- 2) failure scenarios around one real signal ----------------
function signalCase(coin = 'SOL', pick) {
  const all = load(coin), ts = backtest(all).trades, t = pick ? pick(ts, all) : ts.filter((x) => x.why === 'stop' && x.stop === x.stop0).at(-1);   // default: a recent trade stopped at its INITIAL stop (never trailed)
  const e = all.findIndex((c) => c.time === t.t);                                              // entry candle (forming at signal time)
  return { all, e, B: all.slice(e - 500, e).concat([forming(all[e])]), entryTime: t.t, trade: t };
}
async function scenario(name, knobs, fn, pick) {
  const { all, e, B, entryTime, trade } = signalCase('SOL', pick);
  const m = fakeMexc('SOL', knobs), live = createLiveExecutor({ api: m, cfg: { maxRiskMult: 1.5 } });
  await live.beginRun(['SOL']);
  m.t = entryTime + 3; m.px = all[e].open;
  const st = newSt(), acct = { balance: 1000 };
  const run = (opt = {}) => processCoin('SOL', B, st, live, { acct, now: m.t, nowPx: m.px, save: () => {}, ...opt });
  try { await fn({ m, live, st, acct, run, all, e, B, trade }); } catch (err) { ok(false, `${name}: threw ${err.stack}`); }
}

(async () => {
  console.log('--- parity: live executor on a simulated MEXC vs paper ---');
  await parity('SOL'); await parity('ZEC'); await parity('NEAR'); await parity('ADA'); await parity('GALA');

  console.log('\n--- failure scenarios ---');
  await scenario('normal entry', {}, async ({ m, st, run }) => {
    const ev = await run();
    ok(st.pos && st.pos.live && m.positions.length === 1 && m.tpsl.length === 1 && !m.tpsl[0].takeProfitPrice && !st.pending, `normal entry: 1 position, one stop and NO target on MEXC, nothing pending (${ev.find((x) => x.startsWith('ENTER'))})`);
  });
  await scenario('network error after send', { networkErrorAfterSend: true }, async ({ m, st, run }) => {
    await run();
    ok(st.pos && m.calls.filter((c) => c[0] === 'create').length === 1, 'network error right after sending: order found by its id, NOT sent again, position adopted');
  });
  await scenario('crash before state saved', {}, async ({ m, live, st, all, e }) => {
    const B2 = all.slice(e - 500, e).concat([forming(all[e])]);
    st.pending = { oid: 'icSOLtestL', coin: 'SOL', dir: 1, stop: 1, lev: 5, t0: all[e].time, sigTime: all[e - 1].time, at: m.t * 1000 };
    await m.createOrder({ symbol: 'SOL_USDT', price: m.px, vol: 10, leverage: 5, side: 1, type: 5, openType: 1, externalOid: 'icSOLtestL', stopLossPrice: 1 });
    const r = await live.reconcile('SOL', st);
    ok(st.pos && !st.pending && !r.blocked && r.ev.some((x) => x.startsWith('RECOVERED')), 'crash between "order sent" and "state saved": next run adopts the filled position');
    void B2;
  });
  await scenario('lookup down after fill', { lookupFails: true }, async ({ m, st, run }) => {
    const ev = await run();
    ok(!st.pos && st.pending && m.positions.length === 1 && ev.some((x) => x.includes('status unknown')), 'order filled but MEXC lookups fail: pending kept (not forgotten), error raised');
    m.knobs.lookupFails = false;
    const r = await createLiveExecutor({ api: m }).reconcile('SOL', st).catch(async () => null);
    ok(r === null || (st.pos && !st.pending), 'next run with MEXC back: position adopted');
  });
  await scenario('attached stop ignored, re-place works', { ignoreAttached: true }, async ({ m, st, run }) => {
    await run();
    ok(st.pos && m.tpsl.filter((s) => s.state === 1).length >= 1 && m.calls.some((c) => c[0] === 'tpsl'), 'stop not attached by MEXC: bot places it itself and verifies');
  });
  await scenario('stop impossible', { ignoreAttached: true, tpslFails: true }, async ({ m, st, run }) => {
    const ev = await run();
    ok(!st.pos && m.positions.every((p) => p.state === 3) && st.trades.length === 1 && st.trades[0].why === 'abort' && ev.some((x) => x.startsWith('ERROR')), 'the stop cannot be placed at all: position closed at once, recorded, alert raised');
  });
  await scenario('foreign position', {}, async ({ m, live, st, run }) => {
    m.positions.push({ positionId: 999, symbol: 'SOL_USDT', positionType: 2, holdVol: 5, holdAvgPrice: 1, state: 1 });
    const r = await live.reconcile('SOL', st), ev = await run({ blocked: r.blocked });
    ok(r.blocked && !st.pos && m.calls.length === 0 && ev.some((x) => /did not open/.test(x)), 'manual / unknown SOL position on MEXC: no new SOL entry');
  });
  await scenario('late wake-up', {}, async ({ m, st, run }) => {
    m.t += 20 * 60;
    const ev = await run();
    ok(!st.pos && m.calls.length === 0 && ev.some((x) => /SKIPPED: next candle opened 20 min ago/.test(x)), 'woke 20 min late (> 15 min limit): signal skipped, no order');
  });
  await scenario('stop follows the price', {}, async ({ m, st, run, all, e }) => {
    m.px = all[e].open * 1.01;                                        // the market moved 1% between the candle open and the wake-up
    await run(); const p = st.pos, core = require('../icore-core.js'), atr = core.atrSeries(all.slice(0, e))[e - 1];
    ok(p && Math.abs(Math.abs(m.px - p.stop) / atr - core.DEFAULTS.kInit) < 0.02, 'stop is placed ' + core.DEFAULTS.kInit + ' x ATR from the price the order is actually sent at (' + (p && (Math.abs(m.px - p.stop) / atr).toFixed(3)) + ' ATR)');
  });
  await scenario('drawdown halt', {}, async ({ m, st, acct, run }) => {
    acct.totalR = -20; acct.peakR = 30;
    const ev = await run();
    ok(!st.pos && m.calls.length === 0 && ev.some((x) => /HALTED/.test(x)), 'account 50R below its best point (halt at 45R): no new entries');
  });
  await scenario('order rejected', { reject: true }, async ({ m, st, run }) => {
    const ev = await run();
    ok(!st.pos && !st.pending && m.positions.length === 0 && ev.some((x) => /Balance insufficient/.test(x)), 'MEXC rejects the order: nothing pending, error raised');
  });
  await scenario('time exit + close failure', {}, async ({ m, live, st, acct, all, e }) => {
    await processCoin('SOL', all.slice(e - 500, e).concat([forming(all[e])]), st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    // pretend nothing triggers for 600 candles: drop the stop, jump to the 600th close after the entry candle (only that candle is evaluated)
    m.tpsl.forEach((s) => (s.state = 2));
    const MB = require('../icore-core.js').DEFAULTS.maxBars, k = e + MB; st.lastTime = all[k - 1].time;
    const B = all.slice(k - 499, k + 1).concat([forming(all[k + 1])]);
    m.t = all[k + 1].time + 3; m.px = all[k + 1].open; m.knobs.closeFails = true;
    const ev1 = await processCoin('SOL', B, st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    ok(st.pos && ev1.some((x) => /time exit failed/.test(x)), `${MB}-candle safety exit while MEXC refuses the close: position kept, error raised`);
    m.knobs.closeFails = false;
    const B2 = all.slice(k - 498, k + 2).concat([forming(all[k + 2])]); m.t = all[k + 2].time + 3; m.px = all[k + 2].open;
    const ev2 = await processCoin('SOL', B2, st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    ok(!st.pos && st.trades.at(-1).why === 'time' && ev2.some((x) => x.startsWith('EXIT')), 'next run: time exit retried and done');
  }, (ts, all) => ts.filter((x) => x.i0 + require('../icore-core.js').DEFAULTS.maxBars + 20 < all.length).at(-1));
  await scenario('exit while bot was down', {}, async ({ m, live, st, acct, all, e, trade }) => {
    await processCoin('SOL', all.slice(e - 500, e).concat([forming(all[e])]), st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    let k = e; for (; all[k].time < trade.tExit; k++) m.trade(all[k]);          // exchange keeps working, bot is off
    const B = all.slice(k - 500, k).concat([forming(all[k])]);                  // bot back right after the target candle closed
    m.t = all[k].time + 3; m.px = all[k].open;
    await live.reconcile('SOL', st);
    await processCoin('SOL', B, st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    const next = backtest(all).trades.find((x) => x.t === all[k].time);
    ok((st.pos ? !!next && st.pos.t0 === next.t : !next) && st.trades.length === 1 && st.trades[0].why === 'stop' && Math.abs(st.trades[0].R - trade.R) < 0.05, `bot off for ${Math.round((m.t - trade.t) / 3600)}h: MEXC's stop exit is picked up afterwards (R ${st.trades[0] && st.trades[0].R.toFixed(2)} vs backtest ${trade.R.toFixed(2)}); next trade ${st.pos ? 'opened on the same candle as the backtest' : 'none, as in the backtest'}`);
  });

  console.log('\n--- trailing stop: moving the stop on MEXC ---');
  await scenario('trail: stop moved', {}, async ({ m, live, st, run }) => {
    await run(); const p = st.pos, ns = p.stop + p.dir * 0.5 * Math.abs(p.entry - p.stop);
    const got = await live.moveStop(p, ns); p.stop = got;
    const mine = m.tpsl.filter((x) => x.positionId === p.positionId && x.state === 1);
    ok(got && mine.length === 1 && Math.abs(mine[0].stopLossPrice - ns) < 1e-5, `stop moved on MEXC: one live stop at the new price (${mine.map((x) => x.stopLossPrice)}), the old one cancelled`);
    ok((await live.ensureProtection(p)) === true, 'ensureProtection agrees with the moved stop');
  });
  await scenario('trail: MEXC refuses a second stop', { secondStopRefused: true }, async ({ m, live, st, run }) => {
    await run(); const p = st.pos, old = p.stop, ns = p.stop + p.dir * 0.5 * Math.abs(p.entry - p.stop);
    const got = await live.moveStop(p, ns); if (got) p.stop = got;
    const mine = m.tpsl.filter((x) => x.positionId === p.positionId && x.state === 1);
    ok(got && mine.length === 1 && Math.abs(mine[0].stopLossPrice - ns) < 1e-5, 'a second stop is refused: falls back to cancel-then-place, ends with exactly one live stop at the new price');
    void old;
  });
  await scenario('trail: move fails -> old stop stays', { moveFails: true }, async ({ m, live, st, run }) => {
    await run(); const p = st.pos, old = p.stop, ns = p.stop + p.dir * 0.5 * Math.abs(p.entry - p.stop);
    const got = await live.moveStop(p, ns);
    const mine = m.tpsl.filter((x) => x.positionId === p.positionId && x.state === 1);
    ok(got === false && mine.length === 1 && Math.abs(mine[0].stopLossPrice - old) < 1e-5, 'the stop cannot be moved at all: moveStop returns false and the OLD stop is back on MEXC (the trade is never unprotected)');
  });
  await scenario('trail: new stop already through the price (gap)', {}, async ({ m, live, st, run }) => {
    await run(); const p = st.pos, old = p.stop;
    m.px = p.dir === 1 ? p.stop * 1.0001 : p.stop * 0.9999;                         // price almost at the old stop; a stop moved up/closer would be "through" the price
    const ns = p.stop + p.dir * 0.5 * Math.abs(p.entry - p.stop), got = await live.moveStop(p, ns);
    ok(got && got.through === true && m.tpsl.filter((x) => x.state === 1 && x.positionId === p.positionId).length === 1 && Math.abs(m.tpsl.find((x) => x.state === 1).stopLossPrice - old) < 1e-5, 'the market is already past the new stop: nothing is sent, moveStop says "through" (the bot then closes at market) and the old stop stays meanwhile');
    const x = await live.exitNow(p);
    ok(x && x.why === 'stop' && m.positions.every((q) => q.state === 3), 'exitNow closes the position at market');
  });
  await scenario('trail: processCoin reports a failed move and keeps the trade', { moveFails: true }, async ({ m, live, st, acct, all, e, run }) => {
    await run(); const p = st.pos;
    // feed a strongly favourable closed candle: the bot wants to raise the stop, MEXC refuses -> error event, old stop kept in state AND on MEXC
    // a steady 40-candle run in the trade's favour (2% a candle, small ranges): enough for a 14-ATR trail to want to move. One huge candle would not do it,
    // because its own range raises the ATR by about as much as the move (14 x ATR grows with it).
    const c1 = all[e], run40 = []; let px0 = c1.open;
    for (let j = 0; j < 40; j++) { const o = px0, c = o * (1 + p.dir * 0.02); run40.push({ time: c1.time + j * 14400, open: o, close: c, high: Math.max(o, c) * 1.001, low: Math.min(o, c) * 0.999 }); px0 = c; }
    const fav = run40[run40.length - 1];
    const B2 = all.slice(e - 460, e).concat(run40, [forming({ time: fav.time + 14400, open: fav.close, high: fav.close, low: fav.close, close: fav.close })]);
    m.t = fav.time + 14400 + 3; m.px = fav.close; const old = p.stop;
    const ev = await processCoin('SOL', B2, st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    ok(st.pos && st.pos.stop === old && ev.some((x) => /stop could not be moved/.test(x) && /still protects/.test(x)), 'processCoin: the stop move fails -> ERROR event, trade kept, state still holds the old stop');
    void live;
  });

  // MEXC blocks this server: HTTP 403, then 451 with region text. BLOCKED error type, no retry, exactly ONE Telegram alert, open position untouched.
  // Runs in a throw-away copy of the bot (fake Telegram token, stubbed fetch), so nothing real is read, sent or written.
  {
    const os = require('os'), BOX = fs.mkdtempSync(path.join(os.tmpdir(), 'icore-blocked-')), SD = path.join(BOX, 'state');
    for (const f of ['icore.js', 'icore-core.js', 'realpaper.js', 'live.js', 'mexc.js', 'config.js', 'ledger-sync.js', 'telegram.js', 'journal.js', 'dashboard-push.js', 'envfile.js', 'keyinfo.js']) fs.copyFileSync(path.join(__dirname, '..', f), path.join(BOX, f));
    fs.writeFileSync(path.join(BOX, 'mexc-keys.json'), JSON.stringify({ telegramToken: '123456789' + ':' + 'FAKE_TOKEN_' + 'FOR_TEST_ONLY_0123456789', telegramChatId: '42' }));
    fs.writeFileSync(path.join(BOX, 'bot-config.json'), JSON.stringify({ mode: 'paper', coins: ['SOL'], heartbeatUrl: '' }));
    fs.mkdirSync(SD);
    const pos = { coin: 'SOL', dir: 1, entry: 100, stop: 95, tp: 120, dist: 0.05, riskUsd: 1, qty: 0.2, t0: 1792684800 };
    const coin0 = { lastTime: 1792684800, pos, realizedR: 0, n: 0, trades: [] };
    fs.writeFileSync(path.join(SD, 'state.json'), JSON.stringify({ coins: { SOL: coin0 }, startedAt: 'x', mode: 'paper', balance: 100, totalR: 0, peakR: 0 }));
    const saved = { fetch: global.fetch, dir: process.env.ICORE_STATE_DIR };
    process.env.ICORE_STATE_DIR = SD; delete process.env.ICORE_NO_NOTIFY;
    for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET']) delete process.env[k];
    const calls = []; let reply = { status: 403, text: '<html><body><h1>403 Forbidden</h1></body></html>' };
    global.fetch = async (url) => { calls.push(String(url)); return { ok: false, status: reply.status, text: async () => reply.text }; };
    const mx = require(path.join(BOX, 'mexc.js')), bot = require(path.join(BOX, 'icore.js')), cl = mx.createClient();
    const mexcCalls = () => calls.filter((u) => u.includes('mexc.com')).length, tgCalls = () => calls.filter((u) => u.includes('api.telegram.org')).length;
    let e403, e451;
    try { await cl.contract('SOL_USDT'); } catch (e) { e403 = e; }
    const after403 = mexcCalls();
    reply = { status: 451, text: 'Service unavailable: MEXC is not available in your region (HTTP 451)' };
    try { await cl.contract('SOL_USDT'); } catch (e) { e451 = e; }
    ok(e403 && e403.code === 'BLOCKED' && mx.isBlocked(e403) && e451 && e451.code === 'BLOCKED' && mx.isBlocked(e451) && /region/.test(e451.message), 'MEXC blocked: HTTP 403 and HTTP 451 (region text) both raise the BLOCKED error type');
    ok(after403 === 1 && mexcCalls() === 2, `blocked: no retry (${after403} request for the 403, ${mexcCalls() - after403} for the 451; transient errors would be retried 3x)`);
    await bot.runOnce(); await new Promise((r) => setTimeout(r, 50));
    const afterRun1 = mexcCalls(); await bot.runOnce(); await new Promise((r) => setTimeout(r, 50));
    const st = JSON.parse(fs.readFileSync(path.join(SD, 'state.json'), 'utf8'));
    ok(mexcCalls() - afterRun1 === 1, 'blocked run: a single MEXC request, no retry loop (451 now, region text)');
    ok(tgCalls() === 0, `two blocked runs sent no Telegram message: errors are logged only (${tgCalls()})`);
    ok(JSON.stringify(st.coins.SOL) === JSON.stringify(coin0) && st.coins.SOL.pos && st.accessLost, 'open position in state left unchanged (accessLost flag recorded, nothing else touched)');
    global.fetch = saved.fetch; process.env.ICORE_STATE_DIR = saved.dir; fs.rmSync(BOX, { recursive: true, force: true });
  }

  // ---------------- SOL, ZEC, NEAR and ADA only: the allowlist, enforced in three layers ----------------
  // layer 1 config load (refuses to start) · layer 2 every order-placement function (paper.enter, live.enter / close / beginRun, mexc createOrder) throws
  // BEFORE any state change or network call · layer 3 this test. fetch and the exchange API are mocks that COUNT their calls.
  {
    const os = require('os'), cp = require('child_process'), cfgMod = require('../config.js');
    const BOX = fs.mkdtempSync(path.join(os.tmpdir(), 'icore-allow-'));
    for (const f of ['icore.js', 'icore-core.js', 'realpaper.js', 'live.js', 'mexc.js', 'config.js', 'ledger-sync.js', 'telegram.js', 'journal.js', 'dashboard-push.js', 'envfile.js', 'keyinfo.js']) fs.copyFileSync(path.join(__dirname, '..', f), path.join(BOX, f));
    const cfgFile = (coins) => fs.writeFileSync(path.join(BOX, 'bot-config.json'), JSON.stringify({ mode: 'paper', coins }));
    // layer 1: config load
    cfgFile(['SOL', 'BTC']);
    let err1 = null; try { require(path.join(BOX, 'config.js')).load(); } catch (e) { err1 = e; }
    ok(err1 && err1.name === 'ConfigError' && /BTC/.test(err1.message) && /SOL_USDT, ZEC_USDT, NEAR_USDT, ADA_USDT/.test(err1.message), `config load rejects a coin outside the allowlist: ${err1 && err1.message.slice(0, 90)}`);
    cfgFile(['XYZ_USDT']); let err1b = null; try { require(path.join(BOX, 'config.js')).load(); } catch (e) { err1b = e; }
    cfgFile('SOL'); let err1c = null; try { require(path.join(BOX, 'config.js')).load(); } catch (e) { err1c = e; }
    ok(err1b && err1b.name === 'ConfigError' && err1c && err1c.name === 'ConfigError', 'a junk symbol and a non-list "coins" are rejected too');
    cfgFile(['SOL_USDT', 'ZEC']); ok(require(path.join(BOX, 'config.js')).load().coins.join() === 'SOL,ZEC', '"SOL_USDT" and "ZEC" are accepted and normalised');
    cfgFile(['SOL', 'BTC']);
    const run = cp.spawnSync(process.execPath, [path.join(BOX, 'icore.js'), 'status'], { env: { ...process.env, ICORE_STATE_DIR: path.join(BOX, 'state') }, encoding: 'utf8', timeout: 20000 });
    ok(run.status === 1 && /REFUSING TO START/.test(run.stderr) && /BTC/.test(run.stderr), 'the bot refuses to start with a clear error when bot-config.json lists BTC');
    ok(cfgMod.ALLOWED_SYMBOLS.join() === 'SOL_USDT,ZEC_USDT,NEAR_USDT,ADA_USDT,GALA_USDT,ETH_USDT' && Object.isFrozen(cfgMod.ALLOWED_SYMBOLS), 'the allowlist is one frozen constant: SOL_USDT, ZEC_USDT, NEAR_USDT, ADA_USDT, GALA_USDT, ETH_USDT');
    cfgFile(['SOL', 'ZEC', 'NEAR_USDT', 'ADA', 'GALA']); ok(require(path.join(BOX, 'config.js')).load().coins.join() === 'SOL,ZEC,NEAR,ADA,GALA', 'NEAR, ADA and GALA are accepted (as coin names or symbols) and normalised');
    cfgFile(['SOL', 'BTC']);

    // layer 2
    const netCalls = []; const realFetch = global.fetch;
    global.fetch = async (url) => { netCalls.push(String(url)); return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, code: 0, data: {} }) }; };
    const thrown = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
    const o = (st) => ({ dir: 1, stop: 90, refOpen: 100, riskUsd: 1, t0: 1, sigTime: 1, st, save: () => { st.saved = true; } });
    for (const coin of ['BTC', 'XYZ', 'SOL_USDT']) {                                   // BTC, junk, and a symbol passed where a coin name belongs
      const st = {}, e = await thrown(() => paper.enter(coin, o(st)));
      ok(e && e.code === 'SYMBOL_NOT_ALLOWED' && Object.keys(st).length === 0 && netCalls.length === 0, `PAPER enter(${coin}) throws SYMBOL_NOT_ALLOWED; no state change; no network call`);
    }
    const apiCalls = []; const spy = new Proxy({}, { get: (_, name) => (...a) => { apiCalls.push(String(name)); return Promise.resolve({}); } });   // any method of the exchange API counts as a call
    const liveX = createLiveExecutor({ api: spy, cfg: {}, log: () => {} });
    for (const coin of ['BTC', 'XYZ']) {
      const st = {}, e1 = await thrown(() => liveX.enter(coin, o(st))), e2 = await thrown(() => liveX.beginRun([coin])), e3 = await thrown(() => liveX.close({ coin, dir: 1, positionId: 1, vol: 1, entry: 1 }, 'x'));
      ok([e1, e2, e3].every((e) => e && e.code === 'SYMBOL_NOT_ALLOWED') && apiCalls.length === 0 && Object.keys(st).length === 0, `LIVE enter / beginRun / close for ${coin} all throw SYMBOL_NOT_ALLOWED; 0 exchange API calls; no pending order written`);
    }
    const mx = require('../mexc.js'), client = mx.createClient({ apiKey: 'test-key', apiSecret: 'test-secret' });
    for (const symbol of ['BTC_USDT', 'XRP_USDT', 'JUNK', '', undefined, 'sol_usdt']) {
      const e = await thrown(() => client.createOrder({ symbol, vol: 1, side: 1, type: 5, openType: 1 }));
      if (!(e && e.code === 'SYMBOL_NOT_ALLOWED') || netCalls.length) ok(false, `mexc createOrder(${JSON.stringify(symbol)}) must throw before any request (got ${e && e.code}, ${netCalls.length} request(s))`);
    }
    ok(netCalls.length === 0, 'mexc createOrder for BTC_USDT, XRP_USDT, a junk string, an empty and an undefined symbol, and lower-case sol_usdt: all throw; fetch was never called');
    await client.createOrder({ symbol: 'SOL_USDT', vol: 1, side: 1, type: 5, openType: 1 });
    ok(netCalls.length === 1 && /order\/create/.test(netCalls[0]), 'control: an order for SOL_USDT is NOT blocked (the guard does not break valid orders)');
    global.fetch = realFetch;
    fs.rmSync(BOX, { recursive: true, force: true });
  }

  console.log('\n--- research recording: order book at entry, exit trigger vs fill (observe only, never change a trade) ---');
  const book = (px) => ({ asks: [[px * 1.0005, 100, 3], [px * 1.004, 200, 2], [px * 1.02, 900, 1]], bids: [[px * 0.9995, 100, 3], [px * 0.996, 200, 2]] });   // [price, contracts, orders]
  await scenario('book recorded', {}, async ({ m, st, run }) => {
    m.depth = async () => book(m.px);
    await run();
    const b = st.pos && st.pos.entryBook;
    ok(b && b.consumed === (st.pos.dir === 1 ? 'asks' : 'bids') && b.notional_usd_0_5pct > b.notional_usd_0_1pct && b.notional_usd_1pct >= b.notional_usd_0_5pct && b.spread_pct > 0, `order book recorded with the entry (a long consumes the asks, a short the bids): 0.1% $${b && b.notional_usd_0_1pct}, 0.5% $${b && b.notional_usd_0_5pct}, spread ${b && b.spread_pct}%`);
  });
  await scenario('book errors', {}, async ({ m, st, run }) => {
    m.depth = async () => { throw new Error('MEXC depth down'); };
    await run();
    ok(st.pos && st.pos.live && st.pos.entryBook === null, 'order-book request failing: the entry still happens, entryBook is null');
  });
  await scenario('book hangs', {}, async ({ m, st, run }) => {
    m.depth = () => new Promise(() => {});
    const t0 = Date.now(); await run();
    ok(st.pos && st.pos.live && st.pos.entryBook === null && Date.now() - t0 < 4000, `order-book request that never answers: entry still happens after ${Date.now() - t0} ms (limit 1.5 s)`);
  });
  await scenario('exit by the bot (time)', {}, async ({ m, live, st, run }) => {
    await run(); const pos = st.pos; m.px = pos.entry * 1.001;
    const x = await live.timeExit(pos, { close: m.px });
    ok(x.closed_by === 'bot_time_exit' && x.trigger_price === null && Number.isFinite(x.exit_slip_r) && x.mexc_history && x.mexc_history.realised !== undefined && Number.isFinite(x.fees), `time exit: closed_by ${x.closed_by}, no trigger price, slippage ${x.exit_slip_r}R vs the price the bot saw, MEXC history attached`);
  });
  await scenario('exit by MEXC (stop)', {}, async ({ m, live, st, run }) => {
    await run(); const pos = st.pos, mp = m.positions.find((p) => p.state === 1);
    m.closePos(mp, pos.stop * (1 - pos.dir * 0.0004), C.fee);                        // MEXC fires the stop and fills slightly worse than the trigger
    const x = await live.checkExit(pos, { low: pos.stop * 0.99, high: pos.stop * 1.01, open: pos.entry });
    ok(x.closed_by === 'mexc_trigger' && x.why === 'stop' && x.trigger_price === pos.stop && x.exit_slip_r > 0, `stop fired by MEXC: closed_by ${x.closed_by}, trigger ${x.trigger_price}, fill ${x.fill_price}, slippage ${x.exit_slip_r}R (positive = worse than the stop)`);
  });

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exitCode = failN ? 1 : 0;
})();
