'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-trades-'));
process.env.INTEL_DATA = path.join(TMP, 'data');
const spine = require('../lib/spine'), trades = require('../ingest/trades');
const { transform, botOf, download, run } = trades;
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const T = 1700000000;   // 2023-11-14 22:13:20 UTC
const ev = (o) => ({ mode: 'live', symbol: 'SOL_USDT', side: 'LONG', data: {}, ...o });
const entryA = ev({ event_id: 'evA', type: 'entry', ts_ms: T * 1000, data: { trade_id: 'T1', entry: 100, sl: 98, one_r: 2, signal_candle_open_ms: (T - 600) * 1000, risk_pct: 1, qty: 3 } });
const exitA = ev({ event_id: 'evA-x', type: 'exit', ts_ms: (T + 3600) * 1000, data: { trade_id: 'T1', exit: 104, r: 2, reason: 'tp', bars: 3, hold_sec: 3600, mfe_r: 2.5, mae_r: -0.5 } });
const entryB = ev({ event_id: 'bb1h|e3', type: 'entry', mode: 'paper', side: 'SHORT', symbol: 'ETH_USDT', ts_ms: (T + 10) * 1000, data: { entry: 50, sl: 51 } });
const entryC = ev({ event_id: 'plain-c', type: 'entry', mode: 'paper', ts_ms: (T + 20) * 1000, data: { entry: 10, sl: 9, one_r: 1 } });
const sig = ev({ event_id: 'bbtr|s1', type: 'signal', mode: 'paper', ts_ms: (T + 5) * 1000, data: { decision: 'skip', reason: 'filter', detail: 'x'.repeat(400) } });
const cmp = ev({ event_id: 'bbcore-c1', type: 'compare', ts_ms: (T + 6) * 1000, data: { match: true, matched: 4, live_only: 0, backtest_only: 1, mismatches: [1, 2], skipped_signals: 0, window_from_ms: T * 1000 - 1000, window_to_ms: T * 1000 } });
const closed = [{ wallet: 'bbcore', position_id: 77, symbol: 'SOL_USDT', side: 'LONG', closed_at: '2023-11-14T23:00:00Z', realized_usd: '10.5', fees_usd: 1, funding_usd: null, r_result: 2 }];
const base = () => ({ bot_events: [entryA, exitA, entryB, entryC, sig, cmp], closed_trades: closed,
  wallet_snapshots: [['bbcore', T, 1000, 5, 1, false], ['bbcore', T + 300, 1010, 6, 0, true]] });

test('botOf: data.bot wins, then id prefix, then live => bbcore, else unknown', () => {
  assert.equal(botOf(ev({ event_id: 'x', data: { bot: 'icore' } })), 'icore');
  assert.equal(botOf(ev({ event_id: 'bb1h|abc' })), 'bb1h');
  assert.equal(botOf(ev({ event_id: 'plain', mode: 'live' })), 'bbcore');
  assert.equal(botOf(ev({ event_id: 'plain', mode: 'paper' })), 'unknown');
  assert.equal(botOf(ev({ event_id: 'bb1h|abc', data: { bot: 'tcore' } })), 'tcore');
});
test('transform golden: entry joined to its exit by bot|mode|trade_id', () => {
  const r = transform(base()), a = r.trades.find((t) => t.trade_key === 'bbcore|live|T1');
  assert.equal(r.trades.length, 3);
  assert.deepEqual(a, { trade_key: 'bbcore|live|T1', mode: 'live', bot: 'bbcore', coin: 'SOL', symbol: 'SOL_USDT', side: 'LONG', dir: 1, signal_candle_s: T - 600, entry_s: T, entry_price: 100, stop_price: 98, one_r: 2,
    risk_pct: 1, qty: 3, intended_price: null, entry_slippage_r: null, entry_delay_s: null, costs_kind: null, status: 'closed', exit_s: T + 3600, exit_price: 104, r: 2, reason: 'tp', mfe_r: 2.5, mae_r: -0.5, bars: 3,
    hold_s: 3600, stop_at_exit_r: null, entry_event_id: 'evA', exit_event_id: 'evA-x' });
  assert.deepEqual(r.dup, []); assert.deepEqual(r.orphanExits, []);
});
test('untagged live event -> bbcore; bb1h| prefix -> bb1h; paper untagged -> unknown', () => {
  const r = transform(base());
  assert.equal(r.trades.find((t) => t.entry_event_id === 'evA').bot, 'bbcore');
  assert.equal(r.trades.find((t) => t.entry_event_id === 'bb1h|e3').bot, 'bb1h');
  assert.equal(r.trades.find((t) => t.entry_event_id === 'plain-c').bot, 'unknown');
});
test('open trade has status open and null exit fields; SHORT dir -1; key falls back to event_id', () => {
  const b = transform(base()).trades.find((t) => t.entry_event_id === 'bb1h|e3');
  assert.equal(b.status, 'open'); assert.equal(b.dir, -1); assert.equal(b.coin, 'ETH');
  assert.equal(b.trade_key, 'bb1h|paper|bb1h|e3');
  for (const k of ['exit_s', 'exit_price', 'r', 'reason', 'mfe_r', 'mae_r', 'bars', 'hold_s', 'stop_at_exit_r', 'exit_event_id']) assert.equal(b[k], null, k);
});
test('one_r falls back to |entry - sl| when data.one_r is missing', () => {
  const t = transform(base()).trades;
  assert.equal(t.find((x) => x.entry_event_id === 'bb1h|e3').one_r, 1);
  assert.equal(t.find((x) => x.entry_event_id === 'plain-c').one_r, 1);
  const x = transform({ bot_events: [ev({ event_id: 'q', type: 'entry', ts_ms: 1000, data: { entry: 200, sl: 190.5 } })] });
  assert.equal(x.trades[0].one_r, 9.5);
});
test('duplicate entry is reported in dup and not duplicated', () => {
  const dupEntry = { ...entryA, event_id: 'evA2', ts_ms: (T + 50) * 1000 };
  const r = transform({ bot_events: [entryA, dupEntry, exitA] });
  assert.equal(r.trades.length, 1);
  assert.deepEqual(r.dup, ['bbcore|live|T1']);
  assert.equal(r.trades[0].entry_event_id, 'evA');   // earliest kept
});
test('exit without entry is reported in orphanExits', () => {
  const ghost = ev({ event_id: 'bb1h|ghost', type: 'exit', mode: 'paper', ts_ms: T * 1000, data: { trade_id: 'GHOST' } });
  const r = transform({ bot_events: [entryA, exitA, ghost] });
  assert.deepEqual(r.orphanExits, ['bb1h|paper|GHOST']);
  assert.equal(r.trades.length, 1);
});
test('signals, compares and exchange_closed are mapped', () => {
  const r = transform(base());
  assert.equal(r.signals.length, 1);
  assert.equal(r.signals[0].bot, 'bbtr'); assert.equal(r.signals[0].decision, 'skip'); assert.equal(r.signals[0].detail.length, 300); assert.equal(r.signals[0].ts_s, T + 5);
  assert.deepEqual(r.compares[0], { event_id: 'bbcore-c1', ts_s: T + 6, mode: 'live', bot: 'bbcore', match: true, matched: 4, live_only: 0, backtest_only: 1, mismatches: 2, skipped_signals: 0, window_from_s: T - 1, window_to_s: T });
  assert.deepEqual(r.exchange_closed[0], { wallet: 'bbcore', position_id: '77', symbol: 'SOL_USDT', coin: 'SOL', side: 'LONG', closed_s: 1700002800, realized_usd: 10.5, fees_usd: 1, funding_usd: null, r_result: 2 });
});
test('wallet snapshots: array form with default columns, custom columns, and object form', () => {
  const arr = transform({ wallet_snapshots: [['w1', T, '1000.5', 12, 2, 0], ['w1', T + 60, 1001, null, null, 1]] }).wallets;
  assert.deepEqual(arr[0], { wallet: 'w1', t: T, equity_usdt: 1000.5, unrealized_usdt: 12, open_positions: 2, suspect: false });
  assert.deepEqual(arr[1], { wallet: 'w1', t: T + 60, equity_usdt: 1001, unrealized_usdt: null, open_positions: null, suspect: true });
  const cust = transform({ wallet_snapshot_columns: ['equity_usdt', 'wallet', 'suspect', 'reported_at_s', 'open_positions', 'unrealized_usdt'], wallet_snapshots: [[900, 'w2', true, T, 1, -3]] }).wallets;
  assert.deepEqual(cust[0], { wallet: 'w2', t: T, equity_usdt: 900, unrealized_usdt: -3, open_positions: 1, suspect: true });
  const obj = transform({ wallet_snapshots: [{ wallet: 'w3', reported_at: '2023-11-14T22:13:20Z', equity_usdt: 5, unrealized_usdt: 0, open_positions: 0, suspect: false }] }).wallets;
  assert.deepEqual(obj[0], { wallet: 'w3', t: T, equity_usdt: 5, unrealized_usdt: 0, open_positions: 0, suspect: false });
});
test('transform of an empty export gives empty lists', () => {
  const r = transform({});
  assert.deepEqual([r.trades, r.signals, r.compares, r.exchange_closed, r.wallets, r.dup, r.orphanExits], [[], [], [], [], [], [], []]);
});

// ---- download ----
const resp = (rows, ok = true, status = 200) => ({ ok, status, json: async () => rows });
test('download pages with Range headers: 1000 rows then fewer', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push({ url, range: opts.headers.Range, h: opts.headers });
    if (url.includes('/bot_events?')) return resp(opts.headers.Range === '0-999' ? Array.from({ length: 1000 }, (_, i) => ({ i })) : Array.from({ length: 5 }, (_, i) => ({ i })));
    if (url.includes('/closed_trades?')) return resp([{ a: 1 }]);
    return resp([]);
  };
  const exp = await download('https://x.test', 'KEY', fetchFn);
  assert.equal(exp.bot_events.length, 1005);
  assert.deepEqual(exp.closed_trades, [{ a: 1 }]);
  assert.deepEqual(exp.wallet_snapshots, []);
  assert.deepEqual(calls.map((c) => c.range), ['0-999', '1000-1999', '0-999', '0-999']);
  assert.ok(calls[0].url.startsWith('https://x.test/rest/v1/bot_events?'));
  assert.equal(calls[0].h.apikey, 'KEY'); assert.equal(calls[0].h.Authorization, 'Bearer KEY'); assert.equal(calls[0].h['Range-Unit'], 'items');
  assert.match(exp.source, /read-only key/);
});
test('download: exactly 1000 rows requests one more page', async () => {
  let n = 0;
  const fetchFn = async (url, opts) => { if (url.includes('/bot_events?')) { n++; return resp(opts.headers.Range === '0-999' ? new Array(1000).fill({}) : []); } return resp([]); };
  const exp = await download('u', 'k', fetchFn);
  assert.equal(exp.bot_events.length, 1000); assert.equal(n, 2);
});
test('download throws on a non-ok response, naming the table', async () => {
  await assert.rejects(download('u', 'k', async () => resp([], false, 401)), /bot_events: HTTP 401/);
  const f = async (url) => (url.includes('/closed_trades?') ? resp([], false, 500) : resp([]));
  await assert.rejects(download('u', 'k', f), /closed_trades: HTTP 500/);
});

// ---- run end to end ----
const writeExport = (exp, name = 'export.json') => { const f = path.join(TMP, name); fs.writeFileSync(f, JSON.stringify(exp)); return f; };
test('run({file}) end to end: manifest, checks and schema round trip through spine.load', async () => {
  const m = await run({ file: writeExport(base()) });
  assert.equal(m.status, 'ok', JSON.stringify(m.checks));
  assert.deepEqual(Object.keys(m.files).sort(), ['compares.csv', 'exchange_closed.csv', 'signals.csv', 'trades.csv', 'wallets.csv']);
  assert.equal(m.files['trades.csv'].rows, 3);
  assert.equal(m.source.export_file.length > 0, true);
  const rows = spine.load('trades', 'trades.csv');
  assert.equal(rows.length, 3);
  const a = rows.find((r) => r.trade_key === 'bbcore|live|T1');
  assert.equal(a.entry_s, T); assert.equal(a.r, 2); assert.equal(a.status, 'closed'); assert.equal(typeof a.dir, 'number');
  assert.equal(rows.find((r) => r.entry_event_id === 'bb1h|e3').exit_s, null);
  const w = spine.load('trades', 'wallets.csv');
  assert.deepEqual(w.map((x) => x.suspect), [false, true]);
  assert.equal(spine.load('trades', 'exchange_closed.csv')[0].position_id, '77');
  assert.equal(spine.load('trades', 'signals.csv').length, 1);
  assert.equal(spine.load('trades', 'compares.csv')[0].match, true);
  assert.deepEqual(spine.verify('trades'), []);
  assert.ok(m.checks.every((c) => c.ok));
});
test('run({file}) with a duplicate entry or orphan exit fails the dataset', async () => {
  const exp = base(); exp.bot_events.push({ ...entryA, event_id: 'evA2', ts_ms: (T + 50) * 1000 });
  const m = await run({ file: writeExport(exp, 'dup.json') });
  assert.equal(m.status, 'failed');
  assert.equal(m.checks.find((c) => c.name === 'no duplicate trades').ok, false);
  assert.throws(() => spine.load('trades', 'trades.csv'), /FAILED/);
  const exp2 = base(); exp2.bot_events.push(ev({ event_id: 'bb1h|g', type: 'exit', mode: 'paper', ts_ms: T * 1000, data: { trade_id: 'G' } }));
  const m2 = await run({ file: writeExport(exp2, 'orph.json') });
  assert.equal(m2.checks.find((c) => c.name === 'every exit has an entry').ok, false);
});
test('run: a stop on the wrong side fails the price check; counts mismatch fails', async () => {
  const exp = base(); exp.bot_events[0] = { ...entryA, data: { ...entryA.data, sl: 105, one_r: 5 } };
  const m = await run({ file: writeExport(exp, 'wrong.json') });
  assert.equal(m.checks.find((c) => c.name === 'prices and stops valid').ok, false);
  const exp2 = base(); exp2.counts = { bot_events_exported: 99, closed_trades: 1, wallet_snapshots: 2 };
  const m2 = await run({ file: writeExport(exp2, 'counts.json') });
  assert.equal(m2.checks.find((c) => c.name === 'row counts match the database').ok, false);
  const exp3 = base(); exp3.counts = { bot_events_exported: 6, closed_trades: 1, wallet_snapshots: 2 };
  assert.equal((await run({ file: writeExport(exp3, 'counts-ok.json') })).status, 'ok');
});
