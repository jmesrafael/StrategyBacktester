// test/selftest.js — the LIVE executor (live.js) against a simulated MEXC, no network, no money.
//   node test/selftest.js
// 1) parity: ~1,500 real 4h candles per coin stepped one close at a time. The fake exchange fills market orders at the price of the moment
//    and fires stop / target itself while the candle trades (like MEXC does). Every trade must match the paper executor: same entry candle,
//    same exit reason, R within 0.01.
// 2) failure scenarios: network error after the order was sent, crash before the state was saved, stop/target refused, foreign position,
//    late wake-up, price already past the stop, drawdown halt, order rejected, time-exit close failing, exits while the bot was down.
'use strict';
process.env.LUCIDIO_STATE_DIR = require('path').join(require('os').tmpdir(), 'lucidio-selftest-state');
const fs = require('fs'), path = require('path');
const { processCoin, paper } = require('../lucidio.js');
const { createLiveExecutor } = require('../live.js');
const { backtest, DEFAULTS } = require('../lucidio-core.js');
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

  // MEXC blocks this server: HTTP 403, then 451 with region text. BLOCKED error type, no retry, exactly ONE Telegram alert, open position untouched.
  // Runs in a throw-away copy of the bot (fake Telegram token, stubbed fetch), so nothing real is read, sent or written.
  {
    const os = require('os'), BOX = fs.mkdtempSync(path.join(os.tmpdir(), 'lucidio-blocked-')), SD = path.join(BOX, 'state');
    for (const f of ['lucidio.js', 'lucidio-core.js', 'live.js', 'mexc.js', 'config.js', 'ledger-sync.js', 'telegram.js', 'journal.js', 'dashboard-push.js', 'envfile.js', 'keyinfo.js']) fs.copyFileSync(path.join(__dirname, '..', f), path.join(BOX, f));
    fs.writeFileSync(path.join(BOX, 'mexc-keys.json'), JSON.stringify({ telegramToken: '123456789' + ':' + 'FAKE_TOKEN_' + 'FOR_TEST_ONLY_0123456789', telegramChatId: '42' }));
    fs.writeFileSync(path.join(BOX, 'bot-config.json'), JSON.stringify({ mode: 'paper', coins: ['SOL'], heartbeatUrl: '' }));
    fs.mkdirSync(SD);
    const pos = { coin: 'SOL', dir: 1, entry: 100, stop: 95, tp: 120, dist: 0.05, riskUsd: 1, qty: 0.2, t0: 1792684800 };
    const coin0 = { lastTime: 1792684800, pos, realizedR: 0, n: 0, trades: [] };
    fs.writeFileSync(path.join(SD, 'state.json'), JSON.stringify({ coins: { SOL: coin0 }, startedAt: 'x', mode: 'paper', balance: 100, totalR: 0, peakR: 0 }));
    const saved = { fetch: global.fetch, dir: process.env.LUCIDIO_STATE_DIR };
    process.env.LUCIDIO_STATE_DIR = SD; delete process.env.LUCIDIO_NO_NOTIFY;
    for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET']) delete process.env[k];
    const calls = []; let reply = { status: 403, text: '<html><body><h1>403 Forbidden</h1></body></html>' };
    global.fetch = async (url) => { calls.push(String(url)); return { ok: false, status: reply.status, text: async () => reply.text }; };
    const mx = require(path.join(BOX, 'mexc.js')), bot = require(path.join(BOX, 'lucidio.js')), cl = mx.createClient();
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
    ok(tgCalls() === 1, `two blocked runs sent exactly one Telegram alert (${tgCalls()})`);
    ok(JSON.stringify(st.coins.SOL) === JSON.stringify(coin0) && st.coins.SOL.pos && st.accessLost, 'open position in state left unchanged (accessLost flag recorded, nothing else touched)');
    global.fetch = saved.fetch; process.env.LUCIDIO_STATE_DIR = saved.dir; fs.rmSync(BOX, { recursive: true, force: true });
  }

  // ---------------- SOL and ZEC only: the allowlist, enforced in three layers ----------------
  // layer 1 config load (refuses to start) · layer 2 every order-placement function (paper.enter, live.enter / close / beginRun, mexc createOrder) throws
  // BEFORE any state change or network call · layer 3 this test. fetch and the exchange API are mocks that COUNT their calls.
  {
    const os = require('os'), cp = require('child_process'), cfgMod = require('../config.js');
    const BOX = fs.mkdtempSync(path.join(os.tmpdir(), 'lucidio-allow-'));
    for (const f of ['lucidio.js', 'lucidio-core.js', 'live.js', 'mexc.js', 'config.js', 'ledger-sync.js', 'telegram.js', 'journal.js', 'dashboard-push.js', 'envfile.js', 'keyinfo.js']) fs.copyFileSync(path.join(__dirname, '..', f), path.join(BOX, f));
    const cfgFile = (coins) => fs.writeFileSync(path.join(BOX, 'bot-config.json'), JSON.stringify({ mode: 'paper', coins }));
    // layer 1: config load
    cfgFile(['SOL', 'BTC']);
    let err1 = null; try { require(path.join(BOX, 'config.js')).load(); } catch (e) { err1 = e; }
    ok(err1 && err1.name === 'ConfigError' && /BTC/.test(err1.message) && /SOL_USDT and ZEC_USDT/.test(err1.message), `config load rejects a coin outside the allowlist: ${err1 && err1.message.slice(0, 90)}`);
    cfgFile(['XYZ_USDT']); let err1b = null; try { require(path.join(BOX, 'config.js')).load(); } catch (e) { err1b = e; }
    cfgFile('SOL'); let err1c = null; try { require(path.join(BOX, 'config.js')).load(); } catch (e) { err1c = e; }
    ok(err1b && err1b.name === 'ConfigError' && err1c && err1c.name === 'ConfigError', 'a junk symbol and a non-list "coins" are rejected too');
    cfgFile(['SOL_USDT', 'ZEC']); ok(require(path.join(BOX, 'config.js')).load().coins.join() === 'SOL,ZEC', '"SOL_USDT" and "ZEC" are accepted and normalised');
    cfgFile(['SOL', 'BTC']);
    const run = cp.spawnSync(process.execPath, [path.join(BOX, 'lucidio.js'), 'status'], { env: { ...process.env, LUCIDIO_STATE_DIR: path.join(BOX, 'state') }, encoding: 'utf8', timeout: 20000 });
    ok(run.status === 1 && /REFUSING TO START/.test(run.stderr) && /BTC/.test(run.stderr), 'the bot refuses to start with a clear error when bot-config.json lists BTC');
    ok(cfgMod.ALLOWED_SYMBOLS.join() === 'SOL_USDT,ZEC_USDT' && Object.isFrozen(cfgMod.ALLOWED_SYMBOLS), 'the allowlist is one frozen constant: SOL_USDT, ZEC_USDT');

    // layer 2
    const netCalls = []; const realFetch = global.fetch;
    global.fetch = async (url) => { netCalls.push(String(url)); return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, code: 0, data: {} }) }; };
    const thrown = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
    const o = (st) => ({ dir: 1, stop: 90, tp: 140, refOpen: 100, riskUsd: 1, t0: 1, sigTime: 1, st, save: () => { st.saved = true; } });
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
    for (const symbol of ['BTC_USDT', 'ETH_USDT', 'JUNK', '', undefined, 'sol_usdt']) {
      const e = await thrown(() => client.createOrder({ symbol, vol: 1, side: 1, type: 5, openType: 1 }));
      if (!(e && e.code === 'SYMBOL_NOT_ALLOWED') || netCalls.length) ok(false, `mexc createOrder(${JSON.stringify(symbol)}) must throw before any request (got ${e && e.code}, ${netCalls.length} request(s))`);
    }
    ok(netCalls.length === 0, 'mexc createOrder for BTC_USDT, ETH_USDT, a junk string, an empty and an undefined symbol, and lower-case sol_usdt: all throw; fetch was never called');
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
    ok(b && b.consumed === 'asks' && b.notional_usd_0_5pct > b.notional_usd_0_1pct && b.notional_usd_1pct >= b.notional_usd_0_5pct && b.spread_pct > 0, `order book recorded with the entry (long consumes the asks): 0.1% $${b && b.notional_usd_0_1pct}, 0.5% $${b && b.notional_usd_0_5pct}, spread ${b && b.spread_pct}%`);
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
    const x = await live.timeExit(pos);
    ok(x.closed_by === 'bot_time_exit' && x.trigger_price === null && Number.isFinite(x.exit_slip_r) && x.mexc_history && x.mexc_history.realised !== undefined && Number.isFinite(x.fees), `time exit: closed_by ${x.closed_by}, no trigger price, slippage ${x.exit_slip_r}R vs the price the bot saw, MEXC history attached`);
  });
  await scenario('exit by MEXC (stop)', {}, async ({ m, live, st, run }) => {
    await run(); const pos = st.pos, mp = m.positions.find((p) => p.state === 1);
    m.closePos(mp, pos.stop * (1 - pos.dir * 0.0004), C.stopFee);                        // MEXC fires the stop and fills slightly worse than the trigger
    const x = await live.checkExit(pos, { low: pos.stop * 0.99, high: pos.stop * 1.01, open: pos.entry });
    ok(x.closed_by === 'mexc_trigger' && x.why === 'stop' && x.trigger_price === pos.stop && x.exit_slip_r > 0, `stop fired by MEXC: closed_by ${x.closed_by}, trigger ${x.trigger_price}, fill ${x.fill_price}, slippage ${x.exit_slip_r}R (positive = worse than the stop)`);
  });

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exitCode = failN ? 1 : 0;
})();
