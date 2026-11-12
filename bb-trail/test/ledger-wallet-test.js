// test/ledger-wallet-test.js - ledger-sync.js postWalletSnapshot(): the per-wallet report to the investor ledger. NO network, NO exchange, NO money: fetch is a stub.
//   node test/ledger-wallet-test.js
// What this proves: what the bot WOULD send, and that it refuses to send anything it was not given. What it does NOT prove: that the real MEXC returns these fields
// (the bot reads them from MEXC's documented asset response: equity, unrealized, cashBalance, availableBalance) or that a real Supabase accepts the call (that is the
// ledger's own test, LEDGER/tests/wallet-snapshots.test.mjs, against an in-memory Postgres).
'use strict';
const ls = require('../ledger-sync.js');
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };

const NOW = Date.parse('2026-10-28T10:00:00.123Z');
const creds = { ledgerUrl: 'https://example.supabase.co/', ledgerKey: 'publishable-key', ledgerBotKey: 'SHARED-BOT-KEY-MUST-NOT-BE-SENT', ledgerWallet: 'bbcore', ledgerWalletKey: 'WALLET-SECRET-abc123' };
const account = { equity: '1234.5678916', unrealized: '-12.3456789', cashBalance: '900.1234564', availableBalance: '850', positionMargin: '100' };   // MEXC returns strings
const stub = (reply = { ok: true, status: 200, body: { ok: true, snapshot_id: 7, suspect: false } }) => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return { ok: reply.ok, status: reply.status, text: async () => JSON.stringify(reply.body) }; }; f.calls = calls; return f; };
const base = { enabled: true, account, openPositions: 2, openOrders: 0, now: NOW, creds };

(async () => {
  // disabled: nothing happens, nothing is built
  let f = stub(); let r = await ls.postWalletSnapshot({ ...base, enabled: false, fetchImpl: f });
  ok(r.status === 'off' && f.calls.length === 0, 'disabled (the default): status off, no request');

  // anything missing means NOTHING is sent, and nothing is invented
  for (const [why, over] of [
    ['no cashBalance (not replaced by availableBalance or equity)', { account: { ...account, cashBalance: undefined } }],
    ['cashBalance empty string', { account: { ...account, cashBalance: '' } }],
    ['cashBalance not a number', { account: { ...account, cashBalance: 'abc' } }],
    ['cashBalance negative', { account: { ...account, cashBalance: '-1' } }],
    ['no equity', { account: { ...account, equity: undefined } }],
    ['equity NaN', { account: { ...account, equity: NaN } }],
    ['no account at all (MEXC read failed: an error is not a zero balance)', { account: null }],
    ['open positions unknown', { openPositions: undefined }],
    ['open orders unknown', { openOrders: undefined }],
    ['open positions a fraction', { openPositions: 1.5 }],
    ['open orders negative', { openOrders: -1 }],
    ['no wallet name', { creds: { ...creds, ledgerWallet: undefined } }],
    ['invalid wallet name', { creds: { ...creds, ledgerWallet: 'BB Core!' } }],
    ['no wallet key', { creds: { ...creds, ledgerWalletKey: '' } }],
  ]) { f = stub(); r = await ls.postWalletSnapshot({ ...base, ...over, fetchImpl: f }); ok(r.status === 'incomplete' && f.calls.length === 0 && !!r.detail, `incomplete, nothing sent: ${why}`); }

  // optional fields may be missing: they are sent as null, never as zero
  f = stub(); r = await ls.postWalletSnapshot({ ...base, account: { equity: 100, cashBalance: 80 }, fetchImpl: f });
  const b0 = JSON.parse(f.calls[0].init.body);
  ok(r.status === 'sent' && b0.p_unrealized === null && b0.p_available === null, 'unrealized and availableBalance missing -> null, not 0');

  // dry run: shows the report, sends nothing
  f = stub(); r = await ls.postWalletSnapshot({ ...base, dry: true, fetchImpl: f });
  ok(r.status === 'dry' && f.calls.length === 0 && r.report.p_equity === 1234.567892, 'dry run: the report is shown and nothing is sent');

  // the real call
  f = stub(); r = await ls.postWalletSnapshot({ ...base, fetchImpl: f });
  const c = f.calls[0], body = JSON.parse(c.init.body);
  ok(f.calls.length === 1 && c.url === 'https://example.supabase.co/rest/v1/rpc/bot_post_wallet_snapshot', 'one POST to /rest/v1/rpc/bot_post_wallet_snapshot (trailing slash handled)');
  ok(c.init.headers.apikey === 'publishable-key' && c.init.headers.Authorization === 'Bearer publishable-key', 'the publishable key is the transport key, as in the existing sync');
  ok(body.p_key === 'WALLET-SECRET-abc123' && body.p_wallet === 'bbcore', "the wallet's own secret and name are sent");
  ok(!JSON.stringify(body).includes('SHARED-BOT-KEY') && !JSON.stringify(c.init.headers).includes('SHARED-BOT-KEY'), 'the shared bot key (ledgerBotKey) is never sent on this path');
  ok(body.p_seq === Math.floor(NOW) && body.p_reported_at === '2026-10-28T10:00:00.123Z', 'sequence = the clock in ms; reported_at = the same instant');
  ok(body.p_equity === 1234.567892 && body.p_unrealized === -12.345679 && body.p_withdrawable === 900.123456 && body.p_available === 850, 'MEXC strings become numbers rounded to 6 decimals (the ledger refuses more)');
  ok(body.p_open_positions === 2 && body.p_open_orders === 0, 'counts are the real counts passed in');
  ok(Object.keys(body).sort().join() === 'p_available,p_equity,p_key,p_open_orders,p_open_positions,p_reported_at,p_seq,p_unrealized,p_wallet,p_withdrawable', 'exactly these fields, no extras');
  ok(r.status === 'sent' && r.snapshotId === 7 && r.replayed === false && r.suspect === false, 'a sent report comes back with the snapshot id');

  // the sequence only goes up
  const fa = stub(), fb = stub();
  await ls.postWalletSnapshot({ ...base, now: NOW, fetchImpl: fa }); await ls.postWalletSnapshot({ ...base, now: NOW + 1000, fetchImpl: fb });
  ok(JSON.parse(fb.calls[0].init.body).p_seq > JSON.parse(fa.calls[0].init.body).p_seq, 'a later report has a higher sequence number');

  // what the ledger says is passed on; secrets never appear in what the bot logs
  f = stub({ ok: true, status: 200, body: { ok: true, replayed: true, snapshot_id: 7 } }); r = await ls.postWalletSnapshot({ ...base, fetchImpl: f });
  ok(r.status === 'sent' && r.replayed === true, 'a replayed retry is reported as such');
  f = stub({ ok: true, status: 200, body: { ok: true, snapshot_id: 8, suspect: true } }); r = await ls.postWalletSnapshot({ ...base, fetchImpl: f });
  ok(r.status === 'sent' && r.suspect === true, 'a suspect (big jump) report is flagged so the bot can warn');
  f = stub({ ok: false, status: 400, body: { message: 'sequence 5 is older than the last accepted one (9): replay refused' } }); r = await ls.postWalletSnapshot({ ...base, fetchImpl: f });
  ok(r.status === 'error' && /replay refused/.test(r.detail) && !JSON.stringify(r).includes('WALLET-SECRET'), 'a refusal from the ledger is an error with its message and no secret');
  f = stub({ ok: false, status: 400, body: { message: 'not allowed' } }); r = await ls.postWalletSnapshot({ ...base, fetchImpl: f });
  ok(r.status === 'error' && /not allowed/.test(r.detail), 'a wrong key reads "not allowed"');
  const boom = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
  r = await ls.postWalletSnapshot({ ...base, fetchImpl: boom }); ok(r.status === 'error' && r.detail === 'ledger timeout', 'a timeout is an error, never a crash');
  r = await ls.postWalletSnapshot({ ...base, creds: { ...creds, ledgerUrl: '' }, fetchImpl: stub() }); ok(r.status === 'error' && /ledgerUrl/.test(r.detail), 'no ledger URL: an error, nothing sent');

  // ---- closed trades: only MEXC's booked realised P&L, never an estimate; resend-safe
  const exitEv = { type: 'exit', mode: 'live', ts_ms: NOW - 1000, symbol: 'SOL_USDT', side: 'SHORT', r_result: -1.0123456, costs: { exit: { mexc_history: { positionId: 998877, realised: '-4.1234567', fee: '0.05', holdFee: '-0.01', updateTime: NOW - 5000 } } } };
  let rep = ls.closedTradeReport(exitEv, creds);
  ok(rep.body && rep.body.p_position_id === '998877' && rep.body.p_realized === -4.123457 && rep.body.p_side === 'SHORT' && rep.body.p_closed_at === new Date(NOW - 5000).toISOString() && rep.body.p_fees === 0.05 && rep.body.p_funding === -0.01 && rep.body.p_r === -1.0123, 'closed trade report carries MEXC position id, realised P&L, fees, funding, close time');
  ok(ls.closedTradeReport({ ...exitEv, costs: { exit: { mexc_history: null } } }, creds).error, 'no MEXC history: nothing is sent (no estimate)');
  ok(ls.closedTradeReport({ ...exitEv, costs: { exit: { mexc_history: { positionId: 1, realised: '' } } } }, creds).error, 'empty realised P&L: nothing is sent');
  ok(ls.closedTradeReport({ ...exitEv, mode: 'paper' }, creds).error, 'a paper trade is never sent');
  ok(ls.closedTradeReport(exitEv, { ...creds, ledgerWalletKey: '' }).error, 'no wallet key: nothing is sent');
  f = stub({ ok: true, status: 200, body: { ok: true, replayed: false, trade_id: 3 } }); r = await ls.postClosedTrade({ enabled: true, trade: exitEv, creds, fetchImpl: f });
  ok(r.status === 'sent' && f.calls[0].url.endsWith('/rpc/bot_post_closed_trade') && JSON.parse(f.calls[0].init.body).p_key === 'WALLET-SECRET-abc123' && !f.calls[0].init.body.includes('SHARED-BOT-KEY'), 'closed trade is posted to its own function with the wallet key only');
  r = await ls.postClosedTrade({ enabled: false, trade: exitEv, creds, fetchImpl: stub() }); ok(r.status === 'off', 'disabled: nothing sent');
  f = stub(); r = await ls.flushClosedTrades({ enabled: true, creds, fetchImpl: f, sinceMs: NOW - 60000, events: [exitEv, { ...exitEv, ts_ms: NOW - 9e9 }, { ...exitEv, type: 'entry' }, { ...exitEv, mode: 'paper' }, { type: 'exit', mode: 'live', ts_ms: NOW, costs: {} }] });
  ok(f.calls.length === 1 && r.sent === 1 && r.skipped === 1, 'flush sends recent live exits with MEXC history only (old, entry, paper and history-less ones are not)');


  // ---- an exit saved without MEXC history (NEAR short, Nov 10, 2026: MEXC had not returned the closed position yet): read it afterwards, read-only, only when unambiguous
  const near = { type: 'exit', mode: 'live', ts_ms: Date.parse('2026-11-10T16:00:17.559Z'), exit_ts: '2026-11-10T16:00:09.000Z', symbol: 'NEAR_USDT', side: 'SHORT', r_result: 2.9737,
    match_key: { signal_candle_open_ms: 1793606400000 }, entry_summary: { fill_price: 4.13 }, costs: { exit: { closed_by: 'bot_time_exit', mexc_history: null } } };
  const hist = { positionId: 1531343295, state: 3, positionType: 2, openAvgPrice: 4.13, closeAvgPrice: 3.565, realised: 13.6125, fee: -0.1477, holdFee: 0.2003, updateTime: Date.parse('2026-11-10T16:00:10Z') };
  const asked = []; const history = async (s, ms) => { asked.push([s, ms]); return [hist, { ...hist, positionId: 1, positionType: 1 }, { ...hist, positionId: 2, updateTime: hist.updateTime - 86400000 }]; };
  const h = await ls.recoverHistory(near, history);
  ok(h && h.positionId === 1531343295 && h.realised === 13.6125 && asked[0][0] === 'NEAR_USDT', 'missing history: the ONE closed NEAR short that matches the exit is found (other side and other days ignored)');
  ok(await ls.recoverHistory(near, async () => [hist, { ...hist, positionId: 9 }]) === null, 'two candidates: nothing is chosen');
  ok(await ls.recoverHistory(near, async () => [{ ...hist, openAvgPrice: 4.5 }]) === null, 'a different entry price: not this trade');
  ok(await ls.recoverHistory(near, async () => [{ ...hist, state: 1 }]) === null, 'a position not closed yet: nothing');
  f = stub({ ok: true, status: 200, body: { ok: true, replayed: false, trade_id: 17 } });
  r = await ls.flushClosedTrades({ enabled: true, creds, fetchImpl: f, sinceMs: Date.now(), recoverSinceMs: near.ts_ms - 1000, history, events: [near] });
  ok(r.recovered === 1 && r.sent === 1 && JSON.parse(f.calls[0].init.body).p_realized === 13.6125 && JSON.parse(f.calls[0].init.body).p_position_id === '1531343295', 'flush sends it with the realised P&L MEXC booked, even after the 3-day resend window');
  f = stub(); r = await ls.flushClosedTrades({ enabled: true, creds, fetchImpl: f, sinceMs: Date.now(), recoverSinceMs: near.ts_ms - 1000, history: async () => [], events: [near] });
  ok(f.calls.length === 0 && r.skipped === 1, 'MEXC has no matching position: still nothing sent');
  console.log(`\n${pass} passed, ${failN} failed`); process.exitCode = failN ? 1 : 0;
})().catch((e) => { console.log('FAIL  test crashed: ' + e.stack); process.exitCode = 1; });
