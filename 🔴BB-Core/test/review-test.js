// test/review-test.js - live-review.js (the research report) and the recording helpers behind it. No network, no money.
//   node test/review-test.js
// 1) simulate(): hand-checked sizing, skips (risk cap, halt, same coin) and compounding
// 2) summarizeBook(): order-book depth within 0.1 / 0.5 / 1% for a buy and a sell
// 3) analyze() on journal events built from real MEXC candles: pairing, the R gap split into its parts, reconciliation, what-if, HTML/text
// 4) main(): files written, journal read from disk, --history works, report has no external links
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const BOX = fs.mkdtempSync(path.join(os.tmpdir(), 'lucidio-review-'));
process.env.LUCIDIO_STATE_DIR = BOX;
const journal = require('../journal.js'), review = require('../live-review.js'), { summarizeBook } = require('../live.js'), core = require('../lucidio-core.js');
const IV = 14400;
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

(async () => {
  // ---------- 1) simulate ----------
  const t = (o) => ({ id: 'x' + Math.random(), symbol: 'SOL_USDT', tEntry: 0, tExit: 10, entry: 100, stop: 99, R: 2, ...o });
  let s = review.simulate({ trades: [t()], startBalance: 1000, riskPct: 0.01 });
  ok(near(s.final, 1020) && s.trades_taken === 1 && near(s.return_pct, 2), `1% of $1000 on a 1-dollar stop: 100 contracts, risk $10, +2R = +$20 (final ${s.final})`);
  s = review.simulate({ trades: [t()], startBalance: 10, riskPct: 0.005 });
  ok(s.trades_taken === 0 && s.skipped.risk_cap === 1, 'a $10 account at 0.5%: one contract already risks more than 1.5x the target, so the signal is skipped (risk_cap)');
  s = review.simulate({ trades: [t({ tEntry: 0, tExit: 100 }), t({ tEntry: 50, tExit: 60 })], startBalance: 1000, riskPct: 0.01 });
  ok(s.trades_taken === 1 && s.skipped.position_exists === 1, 'a second signal on a coin that is still in a trade is skipped (position_exists)');
  s = review.simulate({ trades: [t({ symbol: 'SOL_USDT' }), t({ symbol: 'ZEC_USDT', tEntry: 1, tExit: 11 })], startBalance: 1000, riskPct: 0.01 });
  ok(s.trades_taken === 2, 'SOL and ZEC can be open at the same time (shared balance)');
  const losers = Array.from({ length: 41 }, (_, i) => t({ tEntry: i * 10, tExit: i * 10 + 5, R: -1 }));
  s = review.simulate({ trades: losers, startBalance: 1e6, riskPct: 0.0001 });
  ok(s.skipped.drawdown_halt === 2 && s.trades_taken === 39 && s.halted, `39 losing trades in a row halt the account: ${s.trades_taken} taken, ${s.skipped.drawdown_halt} refused`);
  const gains = [t({ R: 1 }), t({ tEntry: 20, tExit: 30, R: 1 })];
  const a = review.simulate({ trades: gains, startBalance: 1000, riskPct: 0.01 }), b = review.simulate({ trades: gains, startBalance: 1000, riskPct: 0.02 });
  ok(a.final > 1000 && b.final > a.final && a.final > 1000 + 2 * 10 - 1e-9, `compounding: the second trade is sized on the balance after the first (final ${a.final.toFixed(2)} > 1020), and 2% beats 1% on winners`);
  const cap = review.simulate({ trades: [t()], startBalance: 100000, riskPct: 0.05 });
  ok(near(cap.final, 100000 + 2 * 5000), `no $10 cap in the what-if: 5% of $100,000 risks $5,000 (final ${cap.final})`);

  // ---------- 2) order book ----------
  const bk = { asks: [[100.05, 10, 1], [100.4, 20, 1], [101, 50, 1]], bids: [[99.95, 5, 1], [99.5, 40, 1]] };   // [price, contracts, orders] like MEXC
  const buy = summarizeBook(bk, 100, 1, { contractSize: 1 }, 123), sell = summarizeBook(bk, 100, -1, { contractSize: 1 }, 123);
  ok(buy.consumed === 'asks' && near(buy.notional_usd_0_1pct, 1000.5, 0.01) && near(buy.notional_usd_0_5pct, 3008.5, 0.01) && near(buy.notional_usd_1pct, 8058.5, 0.01) && near(buy.spread_pct, 0.1, 1e-4), `a buy consumes the asks: 0.1% $${buy.notional_usd_0_1pct}, 0.5% $${buy.notional_usd_0_5pct}, 1% $${buy.notional_usd_1pct}, spread ${buy.spread_pct}%`);
  ok(sell.consumed === 'bids' && near(sell.notional_usd_0_1pct, 99.95 * 5, 0.01) && near(sell.notional_usd_0_5pct, 99.95 * 5 + 99.5 * 40, 0.01), 'a sell consumes the bids');
  const real = { asks: [[104.52, 24282, 1], [104.53, 23130, 1], [104.54, 277343, 2]], bids: [[104.51, 19304, 3]] };   // first levels of the real SOL_USDT book, 2026-10-23
  const rb = summarizeBook(real, 104.515, 1, { contractSize: 0.1 });
  ok(near(rb.notional_usd_0_1pct, (24282 * 104.52 + 23130 * 104.53 + 277343 * 104.54) * 0.1, 0.5), `real MEXC levels are [price, contracts, orders]: 3 levels = $${rb.notional_usd_0_1pct.toFixed(0)} of depth (reading the order count instead would give ~$40)`);
  ok(summarizeBook(null, 100, 1, {}) === null && summarizeBook({ asks: [], bids: [] }, 0, 1, {}) === null, 'a missing book or price gives null (never an exception)');

  // ---------- 3) analyze on real candles ----------
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'MEXC_SOL.json'), 'utf8')).slice(-1200);
  const C = raw.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const fromSig = C[500].time, candles = { SOL_USDT: C };
  const bt = review.backtestTrades(candles, fromSig, ['SOL_USDT']).filter((x) => x.tExit != null).slice(0, 3);
  ok(bt.length === 3, 'found 3 closed backtest trades in the window to build journal events from');
  const cfg = { ...core.DEFAULTS, riskPct: 0.005 }, now = C[C.length - 1].time + IV + 10, events = [];
  const sessionMs = (fromSig + IV) * 1000 + 1000;
  events.push({ ...journal.sessionEvent({ coins: ['SOL'] }, cfg, 'live', sessionMs) });
  const GAP = -0.05;                                              // every live trade came out 0.05R worse than its backtest twin
  bt.forEach((x, i) => {
    const sigSec = x.tEntry - IV, oneR = Math.abs(x.entry - x.stop), riskUsd = 0.26, qty = riskUsd / oneR;
    const sigCandle = C.find((c) => c.time === sigSec);
    events.push(journal.entryEvent({ symbol: 'SOL_USDT', dir: x.side === 'LONG' ? 1 : -1, sigTime: sigSec, sigCandle, indicators: null, decisionSec: x.tEntry + 3, intended: x.entry, fill: x.entry, nextOpenSec: x.tEntry, nextOpen: x.entry,
      delaySec: 3, slipR: 0.01, stop: x.stop, tp: x.entry + (x.side === 'LONG' ? 4 : -4) * oneR, qty, vol: 3, lev: 20, positionId: 100 + i, oid: 'o' + i, riskUsd, balance: 52, oneR, live: true,
      costs: { kind: 'actual', order_book: { notional_usd_0_5pct: qty * x.entry * 4 } } }, cfg, 'live', (x.tEntry + 3) * 1000));
    const liveR = x.R + GAP, feesUsd = -0.01;
    events.push(journal.exitEvent({ symbol: 'SOL_USDT', dir: x.side === 'LONG' ? 1 : -1, sigTime: sigSec, why: x.why, exit: x.entry, entry: x.entry, stop: x.stop, tp: x.entry, t0: x.tEntry, R: liveR, usd: liveR * riskUsd, balanceAfter: 52, exitSec: x.tExit, exitCandleOpenSec: x.tExit - IV, holdSec: x.tExit - x.tEntry,
      costs: { kind: 'actual', fees_usd: feesUsd, funding_usd: 0, slippage_r: 0.01, exit: { closed_by: 'mexc_trigger', trigger_price: x.stop, fill_price: x.stop, slippage_r: 0.02, mexc_history: null } } }, cfg, 'live', x.tExit * 1000));
  });
  const snaps = [{ type: 'snapshot', mode: 'live', ts: new Date((fromSig + IV) * 1000).toISOString(), ts_ms: (fromSig + IV) * 1000, equity: 52, unrealized: 0 }];
  const lastExit = Math.max(...bt.map((x) => x.tExit)), pnl = bt.reduce((acc, x) => acc + (x.R + GAP) * 0.26, 0);
  snaps.push({ type: 'snapshot', mode: 'live', ts: new Date((lastExit + 100) * 1000).toISOString(), ts_ms: (lastExit + 100) * 1000, equity: 52 + pnl + 0.5, unrealized: 0 });   // 0.5 USD appeared from nowhere
  const rep = review.analyze({ events, snapshots: snaps, candles, mode: 'live', now, riskLevels: [0.005, 0.05], startBalance: 52 });
  ok(!rep.error && rep.pairs.length === 3 && rep.counts.live_only === 0, `3 live trades paired with their 3 backtest twins (live-only ${rep.counts && rep.counts.live_only})`);
  ok(near(rep.gap_stats.gap.mean, GAP, 1e-9) && rep.pairs.every((p) => near(p.gap_R, GAP, 1e-9)), `the gap per trade is the 0.05R that was built in (mean ${rep.gap_stats.gap.mean})`);
  ok(rep.pairs.every((p) => near(p.components_R.entry_slip, -0.01) && near(p.components_R.exit_slip, -0.02) && near(p.components_R.fees, -0.01 / 0.26, 1e-9) && near(p.components_R.funding, 0)), 'entry slippage -0.01R, exit slippage -0.02R, fees -0.01/0.26R and funding 0 are read from the journal');
  const known = -0.01 - 0.02 - 0.01 / 0.26;
  ok(rep.pairs.every((p) => near(p.rest_R, GAP - known, 1e-9)), `the rest is gap minus the listed costs (${(GAP - known).toFixed(4)}R)`);
  ok(rep.reconciliation && near(rep.reconciliation.unexplained_usd, 0.5, 1e-6), `reconciliation finds the 0.5 USD that is in the account but not in the journal (${rep.reconciliation && rep.reconciliation.unexplained_usd})`);
  ok(rep.whatif.length === 2 && rep.whatif[0].live_trades.trades_taken + rep.whatif[0].live_trades.skipped_total === 3 && rep.whatif[1].backtest.trades_taken > 0, 'what-if at 0.5% and 5%: same 3 live trades re-sized, backtest series present');
  ok(rep.whatif[1].live_trades.max_depth_ratio != null, `the depth ratio is computed from the recorded book (5%: biggest order ${(rep.whatif[1].live_trades.max_depth_ratio * 100).toFixed(0)}% of depth)`);
  ok(rep.warnings.some((w) => /fewer than 3 matched/.test(w)) === false && rep.whatif[0].backtest_cost_adjusted, 'with 3 pairs the cost-adjusted backtest series is shown');
  const text = review.renderText(rep), html = review.renderHtml(rep);
  ok(/Average cost per matched trade/.test(text) && /What if the risk/.test(text) && /Read this carefully/.test(text), 'text report has the cost table, the what-if and the caveats');
  ok(/<svg/.test(html) && /Return on capital over time/.test(html) && !/https?:\/\//.test(html), 'HTML report has charts and no external link (self-contained)');
  ok(JSON.stringify(rep).length < 2e6, `report JSON stays small (${JSON.stringify(rep).length} bytes)`);
  const none = review.analyze({ events: [events[0]], snapshots: [], candles, mode: 'live', now });
  ok(!none.error || /no journal events|no candles/.test(none.error), 'a journal with only a bot start does not crash the analysis');
  ok(review.analyze({ events: [], snapshots: [], candles, mode: 'live', now }).error, 'no events -> a clear error');

  // ---------- 4) main(): from files on disk ----------
  const jdir = path.join(BOX, 'jd'); fs.mkdirSync(jdir);
  fs.writeFileSync(path.join(jdir, 'trades.jsonl'), events.map((e, i) => JSON.stringify({ ...e, seq: i + 1 })).join('\n') + '\n');
  fs.writeFileSync(path.join(jdir, 'snapshots.jsonl'), snaps.map((e, i) => JSON.stringify({ ...e, seq: i + 1 })).join('\n') + '\n');
  const client = { klines: async (sym, iv, a, b) => (sym === 'SOL_USDT' ? C.filter((c) => c.time >= a && c.time <= b) : []) };
  const out = path.join(BOX, 'out');
  const code = await review.main(['node', 'live-review.js', '--journal', jdir, '--out-dir', out, '--risk', '0.005,0.05', '--history', '--quiet'], { client, nowSec: now });
  const day = new Date(now * 1000).toISOString().slice(0, 10), rj = fs.existsSync(path.join(out, `live-review-${day}.json`)) ? JSON.parse(fs.readFileSync(path.join(out, `live-review-${day}.json`), 'utf8')) : null;
  ok(code === 0 && rj && fs.existsSync(path.join(out, `live-review-${day}.html`)) && fs.existsSync(path.join(out, `live-review-${day}.txt`)), 'main() reads the journal from disk and writes .json, .txt and .html');
  ok(rj && rj.history && rj.history.results.length === 2 && rj.history.trades > 100, `--history runs the what-if over the stored MEXC history (${rj && rj.history && rj.history.trades} trades, ${rj && rj.history && rj.history.from} to ${rj && rj.history && rj.history.to})`);
  ok(rj && rj.history && rj.history.results[1].return_pct > rj.history.results[0].return_pct, 'over the long history 5% grows faster than 0.5% (and its drawdown is reported next to it)');
  const miss = await review.main(['node', 'live-review.js', '--journal', path.join(BOX, 'nowhere'), '--out-dir', out, '--quiet'], { client, nowSec: now });
  ok(miss === 2, 'a missing journal exits with code 2 and a message, not a crash');

  // snapshots are append-only like the journal
  process.env.LUCIDIO_JOURNAL_DIR = path.join(BOX, 'jd2');
  const r1 = journal.appendSnapshot({ mode: 'live', equity: 50 }, cfg), r2 = journal.appendSnapshot({ mode: 'live', equity: 51 }, cfg);
  const lines = fs.readFileSync(journal.snapshotFile(), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  ok(lines.length === 2 && lines[0].seq === 1 && lines[1].seq === 2 && lines[1].equity === 51 && r1.type === 'snapshot' && lines[0].provenance && r2.event_id !== r1.event_id, 'journal.appendSnapshot appends numbered lines with provenance');
  ok(JSON.stringify(journal.pick({ a: 1, b: 2, secret: 'x' }, ['a', 'zz'])) === '{"a":1}', 'pick() keeps only whitelisted fields that exist');

  console.log(`\n${pass} passed, ${failN} failed`);
  fs.rmSync(BOX, { recursive: true, force: true });
  process.exitCode = failN ? 1 : 0;
})().catch((e) => { console.error(e.stack); process.exitCode = 1; });
