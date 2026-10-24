// test/capital-flows-test.js - capital added to / paid out of the account must never count as profit or loss on the bot dashboard.
//   node test/capital-flows-test.js     No network (the Supabase store is exercised with a fake fetch).
'use strict';
const { aggregate } = require('../dashboard/lib/aggregate.js');
const { createMemoryStore, createSupabaseStore } = require('../dashboard/lib/store.js');

let pass = 0, failN = 0;
const rows = [];
const check = (name, expected, actual, eps = 0.0051) => {
  const good = typeof expected === 'number' ? Math.abs(actual - expected) <= eps : JSON.stringify(actual) === JSON.stringify(expected);
  rows.push([good ? 'PASS' : 'FAIL', name, JSON.stringify(expected), JSON.stringify(actual)]); if (good) pass++; else failN++;
};
const T = 1.8e12;                                         // arbitrary base time (ms)
const live = (id, type, t, data, extra = {}) => ({ event_id: id, type, ts_ms: T + t, mode: 'live', symbol: 'SOL_USDT', side: 'LONG', data, ...extra });
const entry = (id, t, bal) => live('e-' + id, 'entry', t, { trade_id: id, entry: 100, sl: 95, tp: 110, risk_pct: 0.05, balance_used: bal });
const exit = (id, t, usd, r, balAfter) => live('x-' + id, 'exit', t, { trade_id: id, exit: 105, reason: usd > 0 ? 'target' : 'stop', r, usd, balance_after: balAfter });
const eq = (id, t, bal) => ({ event_id: id, type: 'equity', ts_ms: T + t, mode: 'live', data: { equity_usd: bal, total_r: 0, candle_ms: T + t } });
const flow = (id, kind, t, usdt) => ({ flow_id: id, kind, ts_ms: T + t, usdt });
const agg = (events, flows) => aggregate({ events, flows, now: T + 1e7, mode: 'live' });
const stat = (a) => JSON.stringify({ o: a.overall, p: a.per_coin, e: a.equity });

// A: profit, then a deposit, then more profit (start 1000: +100 -> 1100; +500 deposit; equity reading 1600; +50 -> 1650)
{
  const events = [entry('a', 0, 1000), exit('a', 1000, 100, 2, 1100), eq('q1', 3000, 1600), entry('b', 3500, 1600), exit('b', 4000, 50, 1, 1650)];
  const flows = [flow('d:1', 'deposit', 2000, 500)];
  const c = agg(events, flows).capital, base = agg(events, []).capital;
  check('A without the deposit the dashboard would call it profit: change', 650, base.change_usd);
  check('A change since start = 1650 - 1000 - 500', 150, c.change_usd);
  check('A change %', 15, c.change_pct);
  check('A net flows', 500, c.net_flows_usd);
  check('A performance curve (deposit removed)', [1100, 1100, 1150], c.perf_points.map((p) => p.usd));
  check('A raw balance curve keeps the deposit', [1100, 1600, 1650], c.points.map((p) => p.usd));
  check('A time-weighted return = 1.10 x 1.00 x 1.03125 - 1', 13.44, c.twr_pct);
  check('A flow step is labeled for the chart', [{ ts: T + 2000, usd: 500, kind: 'deposit' }], c.flows);
  check('A trade statistics identical with and without the flow', stat(agg(events, [])), stat(agg(events, flows)), 0);
}
// B: deposit and a LOSS in the same period (start 1000, -100 -> 900, +500 joins, reading 1400)
{
  const events = [entry('a', 0, 1000), exit('a', 1000, -100, -2, 900), eq('q1', 3000, 1400)];
  const c = agg(events, [flow('d:1', 'deposit', 2000, 500)]).capital;
  check('B change = 1400 - 1000 - 500 (a loss, not a gain)', -100, c.change_usd);
  check('B change %', -10, c.change_pct);
  check('B performance curve flat after the deposit', [900, 900], c.perf_points.map((p) => p.usd));
  check('B time-weighted return', -10, c.twr_pct);
}
// C: a payout (negative flow) after profit (start 1000 -> 1200, 400 paid out, reading 800)
{
  const events = [entry('a', 0, 1000), exit('a', 1000, 200, 4, 1200), eq('q1', 3000, 800)];
  const c = agg(events, [flow('w:1', 'payout', 2000, -400)]).capital;
  check('C change = 800 - 1000 + 400 (profit stays profit)', 200, c.change_usd);
  check('C net flows', -400, c.net_flows_usd);
  check('C performance curve', [1200, 1200], c.perf_points.map((p) => p.usd));
  check('C time-weighted return', 20, c.twr_pct);
}
// D: flows that must NOT be counted
{
  const events = [entry('a', 0, 1000), exit('a', 1000, 100, 2, 1100), eq('q1', 3000, 1100)];
  const c = agg(events, [flow('d:0', 'deposit', -5000, 700), flow('d:2', 'deposit', 9000, 300)]).capital;
  check('D a flow before the start and one after the last reading are not subtracted', 100, c.change_usd);
  check('D net flows', 0, c.net_flows_usd);
  check('D the later flow is still shown as a step', [300], c.flows.map((f) => f.usd));
  const paper = aggregate({ events: events.map((e) => ({ ...e, mode: 'paper' })), flows: [flow('d:1', 'deposit', 2000, 500)], now: T + 1e7, mode: 'paper' }).capital;
  check('D paper mode ignores real-account flows', 0, paper.net_flows_usd);
  check('D flows of zero or broken rows are dropped', 0, agg(events, [flow('x', 'deposit', 2000, 0), { flow_id: 'y', kind: 'deposit', ts_ms: 'bad', usdt: 5 }]).capital.flows.length);
  check('D no flows at all: behaves exactly as before', 100, agg(events, null).capital.change_usd);
}
// E: the activity log shows capital as capital
{
  const a = agg([entry('a', 0, 1000), exit('a', 1000, 100, 2, 1100)], [flow('d:1', 'deposit', 2000, 500), flow('w:1', 'payout', 2500, -200)]);
  const cap = a.activity.filter((x) => x.kind === 'capital');
  check('E activity lists both movements newest first', [-200, 500], cap.map((x) => x.usd));
  check('E trade rows are untouched', 1, a.activity.filter((x) => x.kind === 'exit').length);
}
(async () => {
  // F: stores
  const mem = createMemoryStore(); mem.setFlows([flow('d:1', 'deposit', 1, 5)]);
  check('F memory store returns the flows', 1, (await mem.flows()).length);
  let url = null;
  const sb = createSupabaseStore({ url: 'https://x.supabase.co', key: 'k', fetchImpl: async (u) => { url = u; return { ok: true, json: async () => [flow('d:1', 'deposit', 1, 5)] }; } });
  const out = await sb.flows();
  check('F supabase store reads the capital_flows view only', true, /rest\/v1\/capital_flows\?select=flow_id,kind,ts_ms,usdt/.test(url) && out.length === 1);
  const missing = createSupabaseStore({ url: 'https://x.supabase.co', key: 'k', fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) });
  let failed = false; await missing.flows().catch(() => { failed = true; });
  check('F a missing view makes flows() reject (the data endpoint turns that into "no flows")', true, failed);
  console.log(rows.map((r) => `${r[0]}  ${r[1]}\n        expected ${r[2]}   actual ${r[3]}`).join('\n'));
  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})();
