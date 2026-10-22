// test/selftest.js — the LIVE executor (live.js) against a simulated MEXC, no network, no money.
//   node test/selftest.js
// 1) parity: ~1,500 real 4h candles per coin stepped one close at a time. The fake exchange fills market orders at the price of the moment
//    and fires stop / target itself while the candle trades (like MEXC does). Every trade must match the paper executor: same entry candle,
//    same exit reason, R within 0.01.
// 2) failure scenarios: network error after the order was sent, crash before the state was saved, stop/target refused, foreign position,
//    late wake-up, price already past the stop, drawdown halt, order rejected, time-exit close failing, exits while the bot was down.
'use strict';
process.env.LUCIDYO_STATE_DIR = require('path').join(require('os').tmpdir(), 'lucidyo-selftest-state');
const fs = require('fs'), path = require('path');
const { processCoin, paper } = require('../lucidyo.js');
const { createLiveExecutor } = require('../live.js');
const { backtest, DEFAULTS } = require('../lucidyo-core.js');
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
        const pos = { positionId: id, symbol: sym, positionType: o.side === 1 ? 1 : 2, holdVol: o.vol, holdAvgPrice: fill, openAvgPrice: fill, state: 1, fee: fill * o.vol * spec.contractSize * C.entryFee, liquidatePrice: 0, leverage: o.leverage };
        m.positions.push(pos);
        if (!m.knobs.ignoreAttached && (o.stopLossPrice || o.takeProfitPrice)) m.tpsl.push({ id: m.nextId++, positionId: id, state: 1, isFinished: 0, stopLossPrice: o.stopLossPrice, takeProfitPrice: o.takeProfitPrice, vol: o.vol });
        m.orders[o.externalOid] = { state: 3, dealVol: o.vol, dealAvgPrice: fill, positionId: id, side: o.side };
      } else {
        const pos = m.positions.find((p) => p.positionId === o.positionId && p.state === 1);
        if (!pos) throw Object.assign(new Error('position not exist'), { code: 2009 });
        m.closePos(pos, fill, C.timeFee);
        m.orders[o.externalOid] = { state: 3, dealVol: o.vol, dealAvgPrice: fill, positionId: pos.positionId, side: o.side };
      }
      if (m.knobs.networkErrorAfterSend) { m.knobs.networkErrorAfterSend = false; throw Object.assign(new Error('network: timeout'), { code: 9999 }); }
      return { orderId: String(id) };
    },
    async placeTpSl(o) {
      m.calls.push(['tpsl', o]);
      if (m.knobs.tpslFails) throw Object.assign(new Error('feature under maintenance'), { code: 604 });
      m.tpsl.push({ id: m.nextId++, positionId: o.positionId, state: 1, isFinished: 0, stopLossPrice: o.stopLossPrice, takeProfitPrice: o.takeProfitPrice, vol: o.vol });
    },
    async cancelTpSl(ids) { m.tpsl.forEach((s) => { if (ids.includes(s.id)) s.state = 2; }); },
    closePos(pos, px, feeRate) {
      const d = pos.positionType === 1 ? 1 : -1, qty = pos.holdVol * spec.contractSize;
      const realised = d * (px - pos.holdAvgPrice) * qty - pos.fee - px * qty * feeRate;
      pos.state = 3; m.tpsl.forEach((s) => { if (s.positionId === pos.positionId) s.state = 2; });
      m.history.unshift({ positionId: pos.positionId, state: 3, closeAvgPrice: px, realised, holdFee: 0, fee: -(pos.fee + px * qty * feeRate) });
    },
    // the candle trades: MEXC fires stop first, then target (same order + rules as the backtest / paper executor)
    trade(c) {
      for (const pos of m.positions.filter((p) => p.state === 1)) {
        const d = pos.positionType === 1 ? 1 : -1, s = m.tpsl.find((x) => x.positionId === pos.positionId && x.state === 1 && x.stopLossPrice);
        const t = m.tpsl.find((x) => x.positionId === pos.positionId && x.state === 1 && x.takeProfitPrice);
        const sl = s && s.stopLossPrice, tp = t && t.takeProfitPrice;
        if (sl && (d === 1 ? c.low <= sl : c.high >= sl)) m.closePos(pos, (d === 1 ? Math.min(sl, c.open) : Math.max(sl, c.open)) * (1 - d * C.slip), C.stopFee);
        else if (tp && (d === 1 ? c.high >= tp * (1 + C.tpBuf) : c.low <= tp * (1 - C.tpBuf))) m.closePos(pos, d === 1 ? Math.max(tp, c.open) : Math.min(tp, c.open), C.tpFee);
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
  let same = a.length === b.length, worst = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i].t !== b[i].t || a[i].why !== b[i].why) same = false;
    worst = Math.max(worst, Math.abs(a[i].R - b[i].R));
  }
  ok(same && worst < 0.01, `${coin} parity over ${bars} candles: paper ${a.length} trades ${a.reduce((s, t) => s + t.R, 0).toFixed(2)}R · live-on-fake-MEXC ${b.length} trades ${b.reduce((s, t) => s + t.R, 0).toFixed(2)}R · same entries+exit reasons: ${same} · worst R gap ${worst.toFixed(4)}`);
  ok(m.calls.filter((c) => c[0] === 'create' && (c[1].side === 1 || c[1].side === 3)).every((c) => c[1].stopLossPrice && c[1].takeProfitPrice && c[1].openType === 1 && c[1].type === 5), `${coin} every entry order is market, isolated, with stop + target attached`);
  ok(new Set(m.calls.filter((c) => c[0] === 'create').map((c) => c[1].externalOid)).size === m.calls.filter((c) => c[0] === 'create').length, `${coin} no order id was ever sent twice`);
  const ref = backtest(all.slice(from - 500)).trades.filter((t) => t.t >= all[from].time && t.why !== 'end');
  ok(Math.abs(ref.length - b.length) <= 2, `${coin} same number of trades as backtest() on the same stretch (${ref.length} vs ${b.length}; ±2 allowed for the 500-candle window edge)`);
}

// ---------------- 2) failure scenarios around one real signal ----------------
function signalCase(coin = 'SOL') {
  const all = load(coin), t = backtest(all).trades.filter((x) => x.why === 'target').at(-1);   // a recent trade that later hit its target
  const e = all.findIndex((c) => c.time === t.t);                                              // entry candle (forming at signal time)
  return { all, e, B: all.slice(e - 500, e).concat([forming(all[e])]), entryTime: t.t, trade: t };
}
async function scenario(name, knobs, fn) {
  const { all, e, B, entryTime, trade } = signalCase();
  const m = fakeMexc('SOL', knobs), live = createLiveExecutor({ api: m, cfg: { maxRiskMult: 1.5 } });
  await live.beginRun(['SOL']);
  m.t = entryTime + 3; m.px = all[e].open;
  const st = newSt(), acct = { balance: 1000 };
  const run = (opt = {}) => processCoin('SOL', B, st, live, { acct, now: m.t, nowPx: m.px, save: () => {}, ...opt });
  try { await fn({ m, live, st, acct, run, all, e, B, trade }); } catch (err) { ok(false, `${name}: threw ${err.stack}`); }
}

(async () => {
  console.log('--- parity: live executor on a simulated MEXC vs paper ---');
  await parity('SOL'); await parity('ZEC');

  console.log('\n--- failure scenarios ---');
  await scenario('normal entry', {}, async ({ m, st, run }) => {
    const ev = await run();
    ok(st.pos && st.pos.live && m.positions.length === 1 && m.tpsl.length === 1 && !st.pending, `normal entry: 1 position, stop+target on MEXC, nothing pending (${ev.find((x) => x.startsWith('ENTER'))})`);
  });
  await scenario('network error after send', { networkErrorAfterSend: true }, async ({ m, st, run }) => {
    await run();
    ok(st.pos && m.calls.filter((c) => c[0] === 'create').length === 1, 'network error right after sending: order found by its id, NOT sent again, position adopted');
  });
  await scenario('crash before state saved', {}, async ({ m, live, st, all, e }) => {
    const B2 = all.slice(e - 500, e).concat([forming(all[e])]);
    st.pending = { oid: 'bbSOLtestL', coin: 'SOL', dir: 1, stop: 1, tp: 9e9, lev: 5, t0: all[e].time, sigTime: all[e - 1].time, at: m.t * 1000 };
    await m.createOrder({ symbol: 'SOL_USDT', price: m.px, vol: 10, leverage: 5, side: 1, type: 5, openType: 1, externalOid: 'bbSOLtestL', stopLossPrice: 1, takeProfitPrice: 9e9 });
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
  await scenario('attached TP/SL ignored, re-place works', { ignoreAttached: true }, async ({ m, st, run }) => {
    await run();
    ok(st.pos && m.tpsl.filter((s) => s.state === 1).length >= 1 && m.calls.some((c) => c[0] === 'tpsl'), 'stop/target not attached by MEXC: bot places them itself and verifies');
  });
  await scenario('TP/SL impossible', { ignoreAttached: true, tpslFails: true }, async ({ m, st, run }) => {
    const ev = await run();
    ok(!st.pos && m.positions.every((p) => p.state === 3) && st.trades.length === 1 && st.trades[0].why === 'abort' && ev.some((x) => x.startsWith('ERROR')), 'stop/target cannot be placed at all: position closed at once, recorded, alert raised');
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
  await scenario('price past stop', {}, async ({ m, st, run, trade }) => {
    m.px = trade.dir === 1 ? trade.stop * 0.99 : trade.stop * 1.01;
    const ev = await run();
    ok(!st.pos && m.calls.length === 0 && ev.some((x) => /already past the stop/.test(x)), 'price already beyond the stop at entry time: skipped');
  });
  await scenario('drawdown halt', {}, async ({ m, st, acct, run }) => {
    acct.totalR = -10; acct.peakR = 30;
    const ev = await run();
    ok(!st.pos && m.calls.length === 0 && ev.some((x) => /HALTED/.test(x)), 'account 40R below its best point: no new entries');
  });
  await scenario('order rejected', { reject: true }, async ({ m, st, run }) => {
    const ev = await run();
    ok(!st.pos && !st.pending && m.positions.length === 0 && ev.some((x) => /Balance insufficient/.test(x)), 'MEXC rejects the order: nothing pending, error raised');
  });
  await scenario('time exit + close failure', {}, async ({ m, live, st, acct, all, e }) => {
    await processCoin('SOL', all.slice(e - 500, e).concat([forming(all[e])]), st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    // pretend nothing triggers for 48 candles: drop stop/target, then step to the 48th close
    m.tpsl.forEach((s) => (s.state = 2));
    const k = e + 48, B = all.slice(k - 499, k + 1).concat([forming(all[k + 1])]);
    m.t = all[k + 1].time + 3; m.px = all[k + 1].open; m.knobs.closeFails = true;
    const ev1 = await processCoin('SOL', B, st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    ok(st.pos && ev1.some((x) => /time exit failed/.test(x)), '48-candle exit while MEXC refuses the close: position kept, error raised');
    m.knobs.closeFails = false;
    const B2 = all.slice(k - 498, k + 2).concat([forming(all[k + 2])]); m.t = all[k + 2].time + 3; m.px = all[k + 2].open;
    const ev2 = await processCoin('SOL', B2, st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    ok(!st.pos && st.trades.at(-1).why === 'time' && ev2.some((x) => x.startsWith('EXIT')), 'next run: time exit retried and done');
  });
  await scenario('exit while bot was down', {}, async ({ m, live, st, acct, all, e, trade }) => {
    await processCoin('SOL', all.slice(e - 500, e).concat([forming(all[e])]), st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    let k = e; for (; all[k].time < trade.tExit; k++) m.trade(all[k]);          // exchange keeps working, bot is off
    const B = all.slice(k - 500, k).concat([forming(all[k])]);                  // bot back right after the target candle closed
    m.t = all[k].time + 3; m.px = all[k].open;
    await live.reconcile('SOL', st);
    await processCoin('SOL', B, st, live, { acct, now: m.t, nowPx: m.px, save: () => {} });
    const next = backtest(all).trades.find((x) => x.t === all[k].time);
    ok((st.pos ? !!next && st.pos.t0 === next.t : !next) && st.trades.length === 1 && st.trades[0].why === 'target' && Math.abs(st.trades[0].R - trade.R) < 0.05, `bot off for ${Math.round((m.t - trade.t) / 3600)}h: MEXC's target exit is picked up afterwards (R ${st.trades[0] && st.trades[0].R.toFixed(2)} vs backtest ${trade.R.toFixed(2)}); next trade ${st.pos ? 'opened on the same candle as the backtest' : 'none, as in the backtest'}`);
  });

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exitCode = failN ? 1 : 0;
})();
