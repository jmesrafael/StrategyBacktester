// partial-test.js - owner partial close (the P button): parsing, sizing, prechecks, live reduce, whole-position result, owner mode, ledger + dashboard figures (no network, no money).
//   node test/partial-test.js
'use strict';
process.env.ICORE_STATE_DIR = require('path').join(require('os').tmpdir(), 'icore-partial-state');
const fs = require('fs'), path = require('path'), os = require('os');
const P = require('../partial.js');
const config = require('../config.js');
const { processCoin } = require('../icore.js');
const { createLiveExecutor } = require('../live.js');
const LS = require('../ledger-sync.js');
const DP = require('../dashboard-push.js');
const IV = 14400;
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };

// a fake MEXC: one open position, market orders fill at fillPx, the close history is whatever the test sets
function fakeApi({ holdVol = 4, fillPx = 110, realisedAfter = null, hist = null, positionId = 77 } = {}) {
  const a = { orders: [], held: holdVol, hist, placed: [], tp: [{ positionId, state: 1, isFinished: 0, stopLossPrice: 95 }], realisedAfter,
    now: () => 1000 * IV * 1000,
    async contract() { return { contractSize: 1, priceUnit: 0.01, state: 0 }; },
    async openPositions() { return a.held > 0 ? [{ positionId, holdVol: a.held, realised: a.realisedAfter }] : []; },
    async historyPositions() { return a.hist ? [a.hist] : []; },
    async ticker() { return { lastPrice: fillPx }; },
    async createOrder(o) { a.orders.push(o); a.held -= o.vol; },
    async orderByExternalOid(s, oid) { const o = a.orders[a.orders.length - 1]; return o ? { state: 3, dealVol: o.vol, dealAvgPrice: fillPx } : null; },
    async openTpSl() { return a.held > 0 ? a.tp : []; },
    async placeTpSl(o) { a.placed.push(o); },
    async cancelTpSl() {} };
  return a;
}
const mkPos = (o = {}) => ({ coin: 'ZEC', dir: 1, entry: 100, stop: 95, tp: null, vol: 4, qty: 4, riskUsd: 20, dist: 0.05, positionId: 77, live: true, t0: 0, sigTime: 5000, openedAt: 0, ...o });
const exOf = (api) => createLiveExecutor({ api, cfg: {}, log: () => {} });

(async () => {
  // ---------- parseCommand ----------
  for (const p of [10, 25, 50, 75, 100]) ok(P.parseCommand({ coin: 'ZEC', pct: p }).ok, `pct ${p} is accepted`);
  ok(!P.parseCommand({ coin: 'ZEC', pct: 5 }).ok && !P.parseCommand({ coin: 'ZEC', pct: 60 }).ok && !P.parseCommand({ coin: 'ZEC', pct: 'x' }).ok && !P.parseCommand({ coin: 'ZEC' }).ok && !P.parseCommand({ coin: 'ZEC', pct: 110 }).ok, 'other pcts are refused');
  ok(P.parseCommand({ coin: 'zec_usdt', pct: '50' }).cmd.coin === 'ZEC', '"zec_usdt" is read as ZEC, a numeric string pct works');
  ok(!P.parseCommand({ coin: '', pct: 50 }).ok && !P.parseCommand({ coin: '../etc', pct: 50 }).ok && !P.parseCommand({ coin: 'A', pct: 50 }).ok, 'an empty or non-ticker coin is refused');
  ok(P.parseCommand({ coin: 'ZEC', pct: 50, sigMs: 5000000 }).cmd.sigMs === 5000000 && P.parseCommand({ coin: 'ZEC', pct: 50 }).cmd.sigMs === undefined && P.parseCommand({ coin: 'ZEC', pct: 50, sigMs: 'zz' }).cmd.sigMs === undefined, 'sigMs is kept only when it is a positive number');
  ok(P.parseCommand({ id: 'x1', coin: 'ZEC', pct: 50 }).cmd.id === 'x1' && P.parseCommand({ coin: 'ZEC', pct: 50 }).cmd.id.length > 0, 'a request keeps its id, or gets one');

  // ---------- planVol ----------
  const pv = (v, p) => P.planVol(v, p);
  ok(pv(4, 25).vol === 1 && pv(4, 50).vol === 2 && pv(4, 75).vol === 3 && pv(4, 100).full === true, 'vol 4: 25% -> 1, 50% -> 2, 75% -> 3, 100% -> full');
  ok(pv(3, 50).vol === 1 && pv(3, 75).vol === 2, 'vol 3: 50% -> 1, 75% -> 2');
  ok(!!pv(1, 50).error && pv(1, 100).full === true, 'vol 1: 50% is an error, 100% closes it');
  ok(pv(2, 75).vol === 1, 'vol 2: 75% -> 1');
  ok(!!pv(4, 10).error && pv(10, 10).vol === 1 && pv(2, 50).vol === 1, 'less than one contract is an error; 10% of 10 is 1');
  ok(!!pv(0, 50).error && !!pv(null, 50).error, 'no contract count -> error');

  // ---------- precheck ----------
  const stx = () => ({ coins: { ZEC: { pos: mkPos(), pending: null }, SOL: { pos: null }, ARB: { pos: mkPos({ live: false }) }, SUI: { pos: mkPos(), pending: { oid: 'a' } } } });
  const sx = stx(), c1 = P.parseCommand({ id: 'k1', coin: 'ZEC', pct: 50 }).cmd;
  ok(P.precheck(sx, c1) === null, 'precheck: a normal request goes');
  ok(P.precheck(sx, c1).dup === true, 'precheck: the same id is refused (dup)');
  ok(/no open trade/.test(P.precheck(sx, P.parseCommand({ id: 'k2', coin: 'SOL', pct: 50 }).cmd).msg), 'precheck: no trade');
  ok(/LIVE/.test(P.precheck(sx, P.parseCommand({ id: 'k3', coin: 'ARB', pct: 50 }).cmd).msg), 'precheck: paper trade refused');
  ok(/unfinished/.test(P.precheck(sx, P.parseCommand({ id: 'k4', coin: 'SUI', pct: 50 }).cmd).msg), 'precheck: pending order refused');
  ok(/different trade/.test(P.precheck(sx, P.parseCommand({ id: 'k5', coin: 'ZEC', pct: 50, sigMs: 9999000 }).cmd).msg), 'precheck: wrong sigMs refused');
  ok(P.precheck(sx, P.parseCommand({ id: 'k6', coin: 'ZEC', pct: 50, sigMs: 5000000 }).cmd) === null, 'precheck: matching sigMs goes');

  // ---------- inbox ----------
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'partial-inbox-'));
  ok(P.queue(dir, [c1]) === 1 && P.queue(dir, [c1]) === 0, 'queue ignores a repeated id');
  P.queue(dir, [{ id: 'bad', coin: 'ZEC', pct: 33 }]);
  const took = P.takeInbox(dir);
  ok(took.length === 2 && took[0].coin === 'ZEC' && took[1].invalid === true && P.readInbox(dir).length === 0, 'takeInbox returns valid + invalid requests and empties the inbox');
  fs.writeFileSync(path.join(dir, 'partial-inbox.json'), '{not json');
  ok(P.takeInbox(dir).length === 0, 'a corrupt inbox file is ignored');

  // ---------- live reduce ----------
  let api = fakeApi({ holdVol: 3 }), ex = exOf(api), pos = mkPos();
  let r = await ex.reduce(pos, 50, { id: 'r0' });
  ok(r.error && /holds 3/.test(r.error) && api.orders.length === 0 && pos.vol === 4 && !pos.partials, 'reduce refuses when MEXC holdVol != pos.vol: no order sent, state untouched');
  api = fakeApi({ holdVol: 4, fillPx: 110, realisedAfter: 20 }); ex = exOf(api); pos = mkPos();
  r = await ex.reduce(pos, 50, { id: 'r1', source: 'dashboard' });
  const o = api.orders[0];
  ok(r.ok && api.orders.length === 1 && o.side === 4 && o.vol === 2 && o.positionId === 77 && o.type === 5, 'reduce sends one market close: long -> side 4, 2 contracts, with positionId');
  ok(pos.vol === 2 && pos.qty === 2 && pos.vol0 === 4 && pos.partials.length === 1 && pos.partials[0].vol === 2 && pos.partials[0].px === 110 && pos.partials[0].realised === 20 && pos.partials[0].id === 'r1', 'reduce updates vol / qty / vol0 / partials from the size read back');
  ok(pos.riskUsd === 20 && pos.entry === 100 && pos.stop === 95, 'riskUsd (and entry/stop) are unchanged');
  ok(r.protected === true && api.placed.length === 0, 'ensureProtection ran and found the stop (nothing re-placed)');
  ok(P.info(pos).vol === 2 && P.info(pos).vol0 === 4 && P.info(pos).n === 1 && P.info(pos).usd === 20 && P.info(mkPos()) === null, 'info() gives vol / vol0 / n / usd, null without partials');
  // short: buy to close
  api = fakeApi({ holdVol: 4, fillPx: 90 }); ex = exOf(api); pos = mkPos({ dir: -1, entry: 100, stop: 105 }); api.tp = [{ positionId: 77, state: 1, isFinished: 0, stopLossPrice: 105 }];
  r = await ex.reduce(pos, 25, {});
  ok(r.ok && api.orders[0].side === 2 && api.orders[0].vol === 1 && pos.vol === 3 && r.usd === 10, 'short: side 2 (buy to close), 25% of 4 = 1 contract, +$10');
  // stop dropped by MEXC -> placed again for the new size
  api = fakeApi({ holdVol: 4 }); ex = exOf(api); pos = mkPos(); api.tp = [];
  r = await ex.reduce(pos, 50, {});
  ok(api.placed.length >= 1 && api.placed[0].vol === 2 && api.placed[0].stopLossPrice === 95, 'a missing stop is placed again for the size that is left');
  // 100% -> reduce says full, sends nothing
  api = fakeApi({ holdVol: 4 }); ex = exOf(api); pos = mkPos();
  r = await ex.reduce(pos, 100, {});
  ok(r.full === true && api.orders.length === 0, 'reduce with 100% sends nothing and says full');

  // ---------- result after a partial ----------
  const after = () => mkPos({ vol: 2, qty: 2, vol0: 4, partials: [{ ts: 1, vol: 2, px: 110, pct: 50, usd: 20, realised: 20 }] });
  const mkEx = (h) => exOf({ async openPositions() { return []; }, async historyPositions() { return [h]; }, now: () => 0 });
  // MEXC record covers ALL closes: closeVol 4, avg price 102.5, realised 10 (20 - 10)
  let x = await mkEx({ positionId: 77, state: 3, closeVol: 4, closeAvgPrice: 102.5, realised: 10, fee: 0.1, holdFee: 0 }).checkExit(after(), { low: 1, high: 1 });
  ok(Math.abs(x.R - 0.5) < 1e-9 && x.usd === 10 && x.px === 95, 'history covers the original size: R = h.realised / riskUsd, last leg price recovered (95)');
  ok(x.why === 'stop' && x.closed_by === 'mexc_trigger', 'a stop after a partial is still classified stop (not hidden by the averaged price)');
  ok(x.realised_total === 10 && x.partials.length === 1, 'result carries realised_total and partials');
  // MEXC record covers only the remaining 2: closeVol 2, price 95, realised -10 -> 10 total with the partial's 20
  x = await mkEx({ positionId: 77, state: 3, closeVol: 2, closeAvgPrice: 95, realised: -10, fee: 0.1, holdFee: 0 }).checkExit(after(), { low: 1, high: 1 });
  ok(Math.abs(x.usd - 10) < 1e-9 && Math.abs(x.R - 0.5) < 1e-9 && x.why === 'stop', 'history covers only the remaining part: the partial realised is added (-10 + 20 = +10), R of the original risk');
  ok(P.historyCoversAll(after(), { closeVol: 4 }) === true && P.historyCoversAll(after(), { closeVol: 2 }) === false && P.historyCoversAll(mkPos(), { closeVol: 2 }) === true, 'historyCoversAll');
  x = await mkEx({ positionId: 77, state: 3, closeVol: 4, closeAvgPrice: 120, realised: 40, fee: 0, holdFee: 0 }).checkExit(after(), { low: 1, high: 1 });
  ok(x.why === 'stop' && x.px > 120 && x.usd === 40, 'I-Core has no target: a profitable close after a partial still books as stop (the trailing stop), at the last leg price (above the averaged one)');

  // ---------- processCoin owner mode ----------
  const acct = { balance: 100, totalR: 0, peakR: 0 };
  // 100%: closes the whole trade, one exit, closed_by owner_close
  api = fakeApi({ holdVol: 4, fillPx: 110 });
  api.createOrder = async (o) => { api.orders.push(o); api.held = 0; api.hist = { positionId: 77, state: 3, closeVol: 4, closeAvgPrice: 110, realised: 40, fee: 0.2, holdFee: 0 }; };
  ex = exOf(api);
  let st = { lastTime: 5, pos: mkPos(), realizedR: 0, n: 0, trades: [] }, events = [];
  const hooks = { exit: (i) => events.push(['exit', i]), partial: (i) => events.push(['partial', i]) };
  let ev = await processCoin('ZEC', [], st, ex, { acct, now: 1000 * IV, hooks, save: () => {}, owner: P.parseCommand({ id: 'o1', coin: 'ZEC', pct: 100 }).cmd });
  ok(!st.pos && st.n === 1 && events.filter((e) => e[0] === 'exit').length === 1 && events[0][1].why === 'manual' && events[0][1].costs.exit.closed_by === 'owner_close' && st.trades[0].usd === 40, 'owner 100%: the whole trade is closed and booked once, why manual, closed_by owner_close');
  ok(ev.some((l) => /EXIT/.test(l)) && api.orders.length === 1 && api.orders[0].vol === 4, 'owner 100%: one close order for all 4 contracts, an EXIT line');
  // partial: hook + position stays open with fewer contracts
  api = fakeApi({ holdVol: 4, fillPx: 110, realisedAfter: 20 }); ex = exOf(api);
  st = { lastTime: 5, pos: mkPos(), realizedR: 0, n: 0, trades: [] }; events = [];
  ev = await processCoin('ZEC', [], st, ex, { acct, now: 1000 * IV, hooks, save: () => {}, owner: P.parseCommand({ id: 'o2', coin: 'ZEC', pct: 50, source: 'dashboard' }).cmd });
  ok(st.pos && st.pos.vol === 2 && st.n === 0 && st.trades.length === 0 && events.length === 1 && events[0][0] === 'partial' && events[0][1].left === 2 && events[0][1].vol === 2 && events[0][1].pct === 50, 'owner partial: a partial hook, the trade stays open with the smaller size, nothing booked');
  ok(ev.some((l) => /^PARTIAL/.test(l)), 'owner partial: a PARTIAL line');
  // refused: no trade
  st = { lastTime: 5, pos: null, realizedR: 0, n: 0, trades: [] };
  ev = await processCoin('ZEC', [], st, ex, { acct, now: 1000 * IV, hooks, save: () => {}, owner: P.parseCommand({ id: 'o3', coin: 'ZEC', pct: 50 }).cmd });
  ok(ev.some((l) => /refused/.test(l)), 'owner mode with no trade is refused');
  // then the final close of a trade that had a partial: one exit carrying part data into the journal-shaped costs
  api = fakeApi({ holdVol: 2, fillPx: 95, hist: { positionId: 77, state: 3, closeVol: 4, closeAvgPrice: 102.5, realised: 10, fee: 0.1, holdFee: 0 } }); ex = exOf(api);
  api.createOrder = async (o) => { api.orders.push(o); api.held = 0; };
  st = { lastTime: 5, pos: after(), realizedR: 0, n: 0, trades: [] }; events = [];
  await processCoin('ZEC', [], st, ex, { acct, now: 1000 * IV, hooks, save: () => {}, owner: P.parseCommand({ id: 'o4', coin: 'ZEC', pct: 100 }).cmd });
  const cx = events[0] && events[0][1].costs.exit;
  ok(cx && cx.realised_total === 10 && cx.partials.length === 1 && cx.vol0 === 4, 'final close after a partial: exit costs carry realised_total, partials and vol0');

  // ---------- ledger-sync closedTradeReport ----------
  const creds = { ledgerWallet: 'tcore', ledgerWalletKey: 'k' };
  const mexcH = { positionId: 77, realised: 10, fee: 0.1, holdFee: 0, updateTime: 1700000000000 };
  const base = { symbol: 'ZEC_USDT', side: 'LONG', mode: 'live', r_result: 0.5, exit_ts: '2026-11-26T00:00:00Z' };
  let rep = LS.closedTradeReport({ ...base, costs: { exit: { mexc_history: mexcH, realised_total: 12.3456789 } } }, creds);
  ok(rep.body && rep.body.p_realized === 12.345679, 'ledger: p_realized = realised_total (rounded to 6 decimals) when it is a number');
  rep = LS.closedTradeReport({ ...base, costs: { exit: { mexc_history: mexcH } } }, creds);
  ok(rep.body && rep.body.p_realized === 10, 'ledger: no realised_total -> MEXC history realised as before');
  rep = LS.closedTradeReport({ ...base, costs: { exit: { mexc_history: mexcH, realised_total: 'x' } } }, creds);
  ok(rep.body && rep.body.p_realized === 10, 'ledger: a non-numeric realised_total is ignored');
  rep = LS.closedTradeReport({ ...base, costs: { exit: { realised_total: 12 } } }, creds);
  ok(!!rep.error, 'ledger: realised_total alone is not enough, MEXC history with positionId is still required');
  rep = LS.closedTradeReport({ ...base, costs: { exit: { mexc_history: { ...mexcH, positionId: null }, realised_total: 12 } } }, creds);
  ok(!!rep.error, 'ledger: history without positionId is refused');

  // ---------- dashboard events ----------
  const sym = config.ALLOWED_SYMBOLS[0];
  const hb = DP.heartbeatEvent({ mode: 'live', part: { [sym]: { vol: 2, vol0: 4, n: 1, usd: 20, evil: 'x' }, 'EVIL_USDT': { vol: 1 } } }, 1e12);
  ok(hb.data.part && hb.data.part[sym] && JSON.stringify(hb.data.part[sym]) === JSON.stringify({ vol: 2, vol0: 4, n: 1, usd: 20 }) && !hb.data.part.EVIL_USDT, 'heartbeat: part carries numbers only, allowed symbols only');
  ok(!('part' in DP.heartbeatEvent({ mode: 'live', part: {} }, 1e12).data), 'heartbeat: no part key when there is none');
  const exitRec = (costs) => ({ type: 'exit', event_id: 'x1', ts_ms: 1e12, mode: 'live', symbol: sym, side: 'LONG', trade_id: 't1', exit_reason: 'stop', exit_price: 95, r_result: 0.5, hold_sec: 100, costs, entry_summary: { fill_price: 100 }, usd_pnl: 10, balance_after: 110 });
  let evs = DP.fromJournal(exitRec({ kind: 'live', exit: { closed_by: 'mexc_trigger', realised_total: 10, partials: [{ vol: 2, usd: 19, realised: 20 }] } }));
  ok(evs[0].data.part_n === 1 && evs[0].data.part_usd === 20, 'exit event: part_n and part_usd (the last partial\'s realised) when there were partials');
  evs = DP.fromJournal(exitRec({ kind: 'live', exit: { partials: [{ vol: 1, usd: 5 }, { vol: 1, usd: 7.5 }] } }));
  ok(evs[0].data.part_n === 2 && evs[0].data.part_usd === 12.5, 'exit event: no MEXC figure on the last partial -> sum of the price estimates');
  evs = DP.fromJournal(exitRec({ kind: 'live', exit: { closed_by: 'mexc_trigger' } }));
  ok(!('part_n' in evs[0].data) && !('part_usd' in evs[0].data), 'exit event: nothing added when there were no partials');

  // ---------- the poll asks for THIS bot's commands (tag read from the same place as the event tag) ----------
  process.env.DASHBOARD_URL = 'https://dash.example'; process.env.DASHBOARD_PUSH_SECRET = 'testsecret123';
  const urls = [], got = [], fakeFetch = (cmds) => async (u) => { urls.push(String(u)); return { ok: true, json: async () => ({ ask: false, commands: cmds }) }; };
  await DP.pollOnce({ fetchImpl: fakeFetch([{ kind: 'partial_close', coin: 'ZEC', pct: 50 }]), onCommands: (c) => got.push(...c) });
  await DP.pollOnce({ fetchImpl: fakeFetch([]) });
  const tag = DP.heartbeatEvent({ mode: 'live' }, 1e12).bot;
  ok(urls[0].endsWith('/api/poll?cmds=' + tag) && got.length === 1 && got[0].kind === 'partial_close', `poll with onCommands asks ?cmds=${tag} (the bot tag its own events carry) and hands the commands over`);
  ok(tag === 'bbtr', 'the paper lab asks for ?cmds=bbtr');
  ok(urls[1].endsWith('/api/poll'), 'poll without onCommands is unchanged (plain /api/poll)');
  delete process.env.DASHBOARD_URL; delete process.env.DASHBOARD_PUSH_SECRET;

  console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
