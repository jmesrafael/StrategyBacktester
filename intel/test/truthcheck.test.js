'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { check, FIND } = require('../integrity/truthcheck');

const at = (h, m = 0) => Date.UTC(2026, 10, 10, h, m) / 1000;
const trade = (o = {}) => ({ trade_key: 'bbcore|live|T1', mode: 'live', bot: 'bbcore', coin: 'SOL', side: 'LONG', status: 'closed', entry_s: at(10), exit_s: at(16), r: 1.5, ...o });
const close = (o = {}) => ({ wallet: 'bbcore', position_id: 'p1', coin: 'SOL', side: 'LONG', closed_s: at(14, 36), r_result: 1.5, ...o });
const snaps = (list) => list.map(([t, open]) => ({ wallet: 'bbcore', t, open_positions: open, suspect: false }));
const rows = (out, c) => out.filter((r) => r.check === c);

test('exit at 16:00 matched to exchange close at 14:36: lag reported as an info row (golden 84 min)', () => {
  const out = check({ trades: [trade()], exchange: [close()], wallets: snaps([[at(11), 1], [at(13), 1], [at(15), 0], [at(17), 0]]) });
  const lag = rows(out, 'exit reporting lag');
  assert.equal(lag.length, 1);
  assert.equal(lag[0].status, 'info');
  assert.match(lag[0].detail, /median 84 min after the exchange close \(longest 84 min\)/);
  assert.equal(rows(out, 'closed trades reconciled')[0].status, 'ok');
  assert.match(rows(out, 'closed trades reconciled')[0].detail, /1 matched; 1 exit events; 1 exchange closes/);
});
test('all consistent: no review rows', () => {
  const out = check({ trades: [trade()], exchange: [close()], wallets: snaps([[at(11), 1], [at(13), 1], [at(15), 0], [at(17), 0]]) });
  assert.deepEqual(out.filter((r) => r.status === 'review'), []);
  assert.equal(rows(out, 'open positions now')[0].status, 'ok');
});
test('findings follow the FIND schema', () => {
  const out = check({ trades: [trade()], exchange: [close()], wallets: snaps([[at(11), 1]]) });
  for (const r of out) {
    assert.deepEqual(Object.keys(r).sort(), Object.keys(FIND).sort());
    assert.equal(typeof r.bot, 'string'); assert.equal(typeof r.check, 'string'); assert.equal(typeof r.detail, 'string');
    assert.ok(['ok', 'review', 'info', 'no_data'].includes(r.status));
    assert.ok(r.at_s === null || Number.isInteger(r.at_s));
  }
});
test('exchange close with no exit event -> review', () => {
  const out = check({ trades: [], exchange: [close()], wallets: snaps([[at(15), 0]]) });
  const r = rows(out, 'exchange close has an exit event');
  assert.equal(r.length, 1); assert.equal(r[0].status, 'review'); assert.equal(r[0].bot, 'bbcore');
  assert.match(r[0].detail, /SOL LONG closed 2026-11-10 14:36 \(position p1/);
  assert.equal(rows(out, 'closed trades reconciled')[0].status, 'review');
});
test('exit event with no exchange close -> review', () => {
  const out = check({ trades: [trade()], exchange: [], wallets: snaps([[at(17), 0]]) });
  const r = rows(out, 'exit event has an exchange close');
  assert.equal(r.length, 1); assert.equal(r[0].status, 'review'); assert.equal(r[0].at_s, at(16));
  assert.deepEqual(rows(out, 'exit reporting lag'), []);
});
test('exchange close more than 4h (+15 min) before the exit is not matched', () => {
  const out = check({ trades: [trade()], exchange: [close({ closed_s: at(16) - 4 * 3600 - 901 })], wallets: [] });
  assert.equal(rows(out, 'exit event has an exchange close').length, 1);
  const ok = check({ trades: [trade()], exchange: [close({ closed_s: at(16) - 4 * 3600 - 900 })], wallets: [] });
  assert.equal(rows(ok, 'exit event has an exchange close').length, 0);
});
test('R disagreeing by more than 0.1 is a review row', () => {
  const out = check({ trades: [trade()], exchange: [close({ r_result: 1.0 })], wallets: [] });
  const r = rows(out, 'R agrees');
  assert.equal(r.length, 1); assert.equal(r[0].status, 'review'); assert.match(r[0].detail, /event R 1.5, exchange R 1/);
  assert.equal(rows(check({ trades: [trade()], exchange: [close({ r_result: 1.45 })], wallets: [] }), 'R agrees').length, 0);
});
test('wallet reports one more open position than the events from some time on -> review with "has 1 more"', () => {
  const t = trade({ entry_s: at(10), exit_s: at(12) }), c = close({ closed_s: at(12) });
  const out = check({ trades: [t], exchange: [c], wallets: snaps([[at(11), 1], [at(13), 1], [at(14), 1], [at(15), 1]]) });
  const r = rows(out, 'open positions agree');
  assert.equal(r.length, 1);
  assert.equal(r[0].status, 'review');
  assert.equal(r[0].at_s, at(13));
  assert.match(r[0].detail, /has 1 more/);
  assert.match(r[0].detail, /wallet 1 open, events imply 0/);
  assert.match(r[0].detail, /to now/);
  assert.equal(rows(out, 'open positions now')[0].status, 'review');
});
test('wallet reports one fewer: "has 1 fewer"; a short blip under 30 minutes is ignored', () => {
  const t = trade({ status: 'open', exit_s: null, r: null }), few = check({ trades: [t], exchange: [], wallets: snaps([[at(11), 1], [at(12), 0], [at(13), 0]]) });
  assert.match(rows(few, 'open positions agree')[0].detail, /has 1 fewer/);
  const blip = check({ trades: [t], exchange: [], wallets: snaps([[at(11), 1], [at(12), 0], [at(12, 10), 1], [at(13), 1]]) });
  assert.deepEqual(rows(blip, 'open positions agree'), []);
});
test('suspect snapshots are ignored; no snapshots -> no_data; only live trades are checked', () => {
  const out = check({ trades: [trade()], exchange: [close()], wallets: [{ wallet: 'bbcore', t: at(15), open_positions: 5, suspect: true }] });
  assert.equal(rows(out, 'open positions agree')[0].status, 'no_data');
  const paper = check({ trades: [trade({ mode: 'paper', bot: 'bb1h' })], exchange: [], wallets: [] });
  assert.deepEqual(paper, []);
});
test('bots are handled separately', () => {
  const t2 = trade({ bot: 'tcore', trade_key: 'tcore|live|T9', coin: 'ETH' }), c2 = close({ wallet: 'tcore', coin: 'ETH', position_id: 'p9' });
  const out = check({ trades: [trade(), t2], exchange: [close(), c2], wallets: [] });
  assert.deepEqual([...new Set(out.map((r) => r.bot))], ['bbcore', 'tcore']);
  assert.equal(out.filter((r) => r.status === 'review').length, 0);
});
