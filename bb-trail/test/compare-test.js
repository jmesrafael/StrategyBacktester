// test/compare-test.js - compare-live-vs-backtest.js end to end on REAL SOL candles:
// the bot's own processCoin (paper executor, journal hooks, wake-up fills at the candle open) is stepped through ~2,400 candles one wake-up at a time,
// exactly as the loop does on the VPS; its journal + state file are then compared with the backtest on the same candles. That must be a MATCH, open trade
// and trailing stop included. Then the journal is broken on purpose (a missing trade, a skip, a wrong exit, an R or stop that drifted) and each must be caught.
//   node test/compare-test.js        No network, no money, writes only to the OS temp folder.
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./helpers.js');
const STATE = H.tmp('compare'), JDIR = path.join(STATE, 'journal');
process.env.ICORE_STATE_DIR = STATE; process.env.ICORE_JOURNAL_DIR = JDIR; process.env.ICORE_NO_NOTIFY = '1'; process.env.ICORE_ENV_FILE = path.join(STATE, 'none.env');
for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET']) delete process.env[k];
const bot = require('../icore.js'), journal = require('../journal.js'), core = require('../icore-core.js'), cmp = require('../compare-live-vs-backtest.js');

let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const IV = 14400, clone = (x) => JSON.parse(JSON.stringify(x));

(async () => {
  const all = H.load('SOL'), W = 3000;
  // pick an end where the backtest is still IN a trade, so the trailing stop of an open position is checked too
  let END = 5400;
  while (!core.backtest(all.slice(W - cmp.WARM, END), { warmup: cmp.WARM }).open) END++;
  const fin = all.slice(0, END), fromSig = all[W].time;

  // the bot, one wake-up per 4h close: view idx = 500 closed candles + the forming candle idx; the first run judges only the newest closed candle (all[W])
  const st = { lastTime: null, pos: null, realizedR: 0, n: 0, trades: [] }, acct = { balance: 100, totalR: 0, peakR: 0 }, hooks = bot.makeHooks();
  hooks.session({ coins: ['SOL'], note: 'loop started' });
  for (let idx = W + 1; idx <= END; idx++) {
    const v = H.viewAt(all, idx);
    await bot.processCoin('SOL', v.B, st, bot.paper, { acct, now: v.now, nowPx: v.nowPx, hooks, save: () => {} });
  }
  fs.writeFileSync(path.join(STATE, 'state.json'), JSON.stringify({ mode: 'paper', coins: { SOL: st } }));
  const events = journal.readAll().events, open = cmp.openFromState(path.join(STATE, 'state.json'));
  const report = (evs, extra = {}) => cmp.buildReport({ events: evs, candles: { SOL_USDT: fin }, open, tolerance: 0.05, relTolerance: 0.02, mode: 'paper', fromSec: fromSig, now: all[END].time + 600, ...extra });

  const r = report(events);
  const nTrades = r.counts.backtest_trades;
  ok(!r.error && st.trades.length >= 8 && st.pos, `fixture: the bot closed ${st.trades.length} trades over ${END - W} candles and is still in one (${st.pos && (st.pos.dir === 1 ? 'LONG' : 'SHORT')})`);
  ok(r.match === true && r.counts.matched === nTrades && r.counts.live_only === 0 && r.counts.backtest_only === 0 && r.investigation.length === 0, `the bot's own journal vs the backtest on the same candles = MATCH (${r.counts.matched}/${nTrades} trades, open one included)`);
  ok(Math.abs(r.totals.drift_R) < 1e-9 && r.totals.closed_both === st.trades.length, `closed trades: live ${r.totals.live_R.toFixed(2)}R = backtest ${r.totals.backtest_R.toFixed(2)}R (drift ${r.totals.drift_R.toExponential(1)})`);
  const os_ = r.open_stops[0];
  ok(r.open_stops.length === 1 && os_.status === 'same' && os_.diff_r < 1e-9, `open trade: the bot's trailing stop ${os_ && os_.live_stop.toPrecision(6)} = the backtest's ${os_ && os_.backtest_stop.toPrecision(6)}`);
  ok(/RESULT: MATCH/.test(cmp.renderText(r)) && /OPEN TRADES, trailing stop/.test(cmp.renderText(r)), 'the text report says MATCH and lists the open trade\'s stop');

  // ---- broken on purpose ----
  const entries = events.filter((e) => e.type === 'entry'), exitOf = (id) => events.find((e) => e.type === 'exit' && e.trade_id === id);
  const closed = entries.filter((e) => exitOf(e.trade_id));
  const small = closed.find((e) => Math.abs(exitOf(e.trade_id).r_result) < 2), big = closed.reduce((a, e) => (Math.abs(exitOf(e.trade_id).r_result) > Math.abs(exitOf(a.trade_id).r_result) ? e : a));

  // 1) a trade missing from the journal: backtest-only, unexplained; with a skip event it is explained by the skip
  const gone = closed[1].trade_id, noTrade = events.filter((e) => e.trade_id !== gone);
  const r1 = report(noTrade);
  ok(!r1.match && r1.counts.backtest_only === 1 && /no entry and no skip/.test(r1.investigation[0].why) && typeof r1.investigation[0].nearest_threshold_pct === 'number', 'a trade the bot never took = backtest-only, with the threshold distance as evidence');
  const en = closed[1], skip = journal.skipEvent({ symbol: 'SOL_USDT', dir: en.side === 'LONG' ? 1 : -1, sigTime: en.match_key.signal_candle_open_ms / 1000, sigCandle: en.signal_candle && { open: en.signal_candle.open, high: en.signal_candle.high, low: en.signal_candle.low, close: en.signal_candle.close }, reason: 'late_entry', detail: '20 min after the open' }, { mode: 'paper' }, 'paper');
  const r1b = report([...noTrade, skip]);
  ok(r1b.counts.backtest_only === 1 && r1b.trades.find((t) => t.status === 'backtest-only').explained_by === 'journal skip: late_entry' && r1b.skipped[0].in_backtest, 'the same trade with a journal skip is explained by it (late_entry)');

  // 2) a trade the backtest does not have: live-only
  const fake = clone(closed[2]); fake.trade_id = fake.trade_id.replace(/\|\d+$/, `|${(fake.match_key.signal_candle_open_ms / 1000 + 3 * IV) * 1000}`); fake.match_key.signal_candle_open_ms += 3 * IV * 1000; fake.event_id = 'fake';
  const r2 = report([...events, fake]);
  ok(r2.counts.live_only === 1 && r2.investigation.some((i) => i.kind === 'live-only'), 'a trade only the bot took = live-only');

  // 3) wrong exit reason, wrong exit candle
  const swap = (id, f) => events.map((e) => (e.type === 'exit' && e.trade_id === id ? f(clone(e)) : e));
  const r3 = report(swap(small.trade_id, (e) => ({ ...e, exit_reason: 'time' })));
  ok(r3.counts.differs === 1 && /exit reason: live time, backtest stop/.test(r3.investigation[0].why), 'a different exit reason is caught and names both');
  const r3b = report(swap(small.trade_id, (e) => ({ ...e, exit_candle_open_ms: e.exit_candle_open_ms + IV * 1000 })));
  ok(r3b.counts.differs === 1 && /exit candle: live/.test(r3b.investigation[0].why), 'a stop hit one candle later is caught');

  // 4) R tolerance: absolute on small trades, relative on big ones (real funding over hundreds of candles)
  const rSmall = report(swap(small.trade_id, (e) => ({ ...e, r_result: e.r_result + 0.2 })));
  ok(rSmall.counts.differs === 1 && /R differs by \+0\.200/.test(rSmall.investigation[0].why), `a +0.2R gap on a ${exitOf(small.trade_id).r_result.toFixed(2)}R trade is flagged`);
  const bigR = exitOf(big.trade_id).r_result, rBig = report(swap(big.trade_id, (e) => ({ ...e, r_result: e.r_result * 1.01 })));
  ok(rBig.match === true, `a 1% gap on the ${bigR.toFixed(1)}R trade is inside the 2% relative tolerance`);
  const rBig2 = report(swap(big.trade_id, (e) => ({ ...e, r_result: e.r_result * 1.05 })));
  ok(rBig2.counts.differs === 1, 'a 5% gap on it is flagged');

  // 5) entry fill: a few hundredths of R late is fine, a quarter R is not
  const shiftEntry = (dR) => events.map((e) => { if (e.type !== 'entry' || e.trade_id !== small.trade_id) return e; const x = clone(e); x.entry.fill_price += dR * x.risk.one_r_price; return x; });
  ok(report(shiftEntry(0.02)).match === true, 'an entry 0.02R away from the candle open is inside the tolerance');
  ok(report(shiftEntry(0.25)).counts.differs === 1, 'an entry 0.25R away is flagged');

  // 6) the open trade's trailing stop drifted (a stop move MEXC refused, say), or the bot has not processed the last candle yet
  const key = [...open.keys()][0], o1 = open.get(key), oneR = Math.abs(o1.entry - o1.stop0);
  const r6 = report(events, { open: new Map([[key, { ...o1, stop: o1.stop - (st.pos.dir) * 0.3 * oneR }]]) });
  ok(!r6.match && r6.open_stops[0].status === 'differs' && /trailing stop differs by 0\.300R/.test(r6.investigation[0].why), 'a trailing stop 0.3R behind the backtest is flagged');
  const r6b = report(events, { open: new Map([[key, { ...o1, lastTime: o1.lastTime - IV }]]) });
  ok(r6b.open_stops[0].status === 'not comparable' && r6b.match === true, 'a bot one candle behind is reported as "not comparable", not as a mismatch');
  const r6c = report(events, { open: new Map() });
  ok(r6c.open_stops[0].status === 'no state', 'no state file: the stop check says so');

  // 7) a recorded signal candle that differs from the final download
  const rc = events.map((e) => (e.trade_id === small.trade_id && e.type === 'entry' ? { ...clone(e), signal_candle: { ...e.signal_candle, close: e.signal_candle.close * 1.001 } } : e));
  ok(report(rc).counts.candle_diffs === 1, 'a recorded signal candle that differs from the final one is listed');

  // 8) no events / mode filter
  ok(report([]).error && report(events, { mode: 'live' }).error, 'no events (or none in the requested mode) = an error, not a match');

  // 9) main(): stubbed MEXC client, files written, exit code 0 on a match
  const client = { klines: async (symbol, iv, s, e) => (symbol === 'SOL_USDT' ? all.filter((c) => c.time >= s && c.time <= e) : []) };
  const out = path.join(STATE, 'out');
  const code = await cmp.main(['node', 'x', '--from', String(fromSig), '--out-dir', out, '--quiet', '--mode', 'paper'], { client, nowSec: all[END].time + 600 });
  const files = fs.existsSync(out) ? fs.readdirSync(out) : [];
  ok(code === 0 && files.some((f) => /^compare-.*\.json$/.test(f)) && files.some((f) => /^compare-.*\.txt$/.test(f)), `main(): exit ${code}, wrote ${files.join(', ')}`);

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exitCode = failN ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
