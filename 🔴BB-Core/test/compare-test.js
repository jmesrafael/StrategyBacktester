// test/compare-test.js - compare-live-vs-backtest.js on a small synthetic fixture built from REAL SOL candles:
// one matched trade, one live-only trade, one backtest-only trade (explained by a journal skip), one exit-reason mismatch.
//   node test/compare-test.js        No network (the candle download is a stub that only offers klines), no money.
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./helpers.js');
const TMP = H.tmp('compare');
process.env.LUCIDIO_STATE_DIR = path.join(TMP, 'state'); process.env.LUCIDIO_JOURNAL_DIR = path.join(TMP, 'journal'); process.env.LUCIDIO_ENV_FILE = path.join(TMP, 'none.env');
for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET']) delete process.env[k];
const core = require('../lucidio-core.js'), journal = require('../journal.js'), cmp = require('../compare-live-vs-backtest.js');

let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const IV = 14400, cfg = { mode: 'paper', coins: ['SOL', 'ZEC'], riskPct: 0.01 };
const all = H.load('SOL'), W = 700, END = 1500, fin = all.slice(0, END);          // finished candles; the window starts at candle W
const fromSig = all[W].time, startIdx = W - core.DEFAULTS.warmup;
const bt = core.backtest(all.slice(startIdx, END), {}, null).trades.filter((t) => t.t - IV >= fromSig);   // exactly what compare computes for the window
const tid = (t) => `SOL_USDT|${t.dir === 1 ? 'LONG' : 'SHORT'}|${(t.t - IV) * 1000}`;
const closesTo = (sec) => fin.filter((c) => c.time <= sec).map((c) => c.close);

// journal events for one backtest trade, as the bot would have written them (real builders), with optional tweaks
function tradeEvents(t, { reason, rShift = 0, entryShiftR = 0, candleClose, withExit = true } = {}) {
  const sigSec = t.t - IV, sigC = all.find((c) => c.time === sigSec), oneR = Math.abs(t.entry - t.stop), ts = (sigSec + IV + 5) * 1000;
  const entry = journal.entryEvent({ symbol: 'SOL_USDT', dir: t.dir, sigTime: sigSec, sigCandle: candleClose ? { ...sigC, close: sigC.close * (1 + candleClose) } : sigC, indicators: journal.indicators(closesTo(sigSec), 0.1), decisionSec: sigSec + IV + 5,
    intended: t.entry, fill: t.entry + t.dir * entryShiftR * oneR, nextOpenSec: t.t, nextOpen: all.find((c) => c.time === t.t).open, delaySec: 5, slipR: 0, stop: t.stop, tp: t.tp, qty: 1, riskUsd: 1, balance: 100, oneR, live: false, costs: { kind: 'estimate (paper)' } }, cfg, 'paper', ts);
  const exit = journal.exitEvent({ symbol: 'SOL_USDT', dir: t.dir, sigTime: sigSec, why: reason || t.why, exit: t.exit, entry: t.entry, stop: t.stop, tp: t.tp, t0: t.t, R: t.R + rShift, usd: t.R, balanceAfter: 100, exitSec: t.tExit, exitCandleOpenSec: t.tExit - IV, holdSec: t.tExit - t.t, costs: { kind: 'estimate (paper)' } }, cfg, 'paper', (t.tExit + 5) * 1000);
  return withExit ? [entry, exit] : [entry];
}
const sessionEv = journal.sessionEvent({ coins: ['SOL', 'ZEC'], note: 'loop started' }, cfg, 'paper', (fromSig + IV + 20) * 1000);
const report = (events, extra = {}) => cmp.buildReport({ events, candles: { SOL_USDT: fin }, tolerance: 0.05, now: all[END].time + 100, mode: 'paper', ...extra });

(async () => {
  ok(bt.length >= 4, `fixture: the backtest takes ${bt.length} trades in the window (need >= 4)`);
  const [t0, t1, t2, ...rest] = bt;

  // a signal candle that is NOT a backtest trade: for the live-only trade (same side as the next candle's direction, any candle without a trade)
  const used = new Set(bt.map((t) => t.t - IV));
  const fake = all.slice(W + 10, W + 80).find((c) => !used.has(c.time));
  const liveOnlyTrade = { dir: 1, t: fake.time + IV, entry: fake.close, stop: fake.close * 0.98, tp: fake.close * 1.08, exit: fake.close * 1.08, R: 4, why: 'target', tExit: fake.time + 6 * IV };

  const events = [sessionEv, ...tradeEvents(t0), ...tradeEvents(t1, { reason: t1.why === 'time' ? 'stop' : 'time' }), ...tradeEvents(liveOnlyTrade), ...rest.flatMap((t) => tradeEvents(t))];
  // t2 is missing from the journal; the bot skipped that signal (journal skip), which explains the backtest-only trade
  const skipEv = journal.skipEvent({ symbol: 'SOL_USDT', dir: t2.dir, sigTime: t2.t - IV, sigCandle: all.find((c) => c.time === t2.t - IV), indicators: journal.indicators(closesTo(t2.t - IV), 0.1), reason: 'late_entry', detail: '35 min after the open' }, cfg, 'paper', (t2.t + 2100) * 1000);
  events.push(skipEv);
  const r = report(events);
  ok(!r.error && r.counts.live_only === 1 && r.counts.backtest_only === 1 && r.counts.differs === 1 && r.counts.matched === bt.length - 2, `counts: ${r.counts.matched} matched, ${r.counts.live_only} live-only, ${r.counts.backtest_only} backtest-only, ${r.counts.differs} differ (1 matched trade per untouched backtest trade)`);
  ok(r.match === false && r.investigation.length === 3, `not a match: ${r.investigation.length} investigation items (live-only, backtest-only, exit-reason mismatch)`);
  const byKind = (k) => r.investigation.find((i) => i.kind === k);
  ok(byKind('differs') && /exit reason: live \w+, backtest \w+/.test(byKind('differs').why) && byKind('differs').signal_candle_open_ms === (t1.t - IV) * 1000, 'the exit-reason mismatch names both reasons and the trade');
  ok(byKind('backtest-only') && /skipped the signal \(late_entry/.test(byKind('backtest-only').why) && r.trades.find((x) => x.status === 'backtest-only').explained_by === 'journal skip: late_entry', 'the backtest-only trade is explained by the journal skip (reason late_entry)');
  ok(byKind('live-only') && /backtest on the final candles has no such trade/.test(byKind('live-only').why), 'the live-only trade is flagged');
  ok(r.investigation.every((i) => typeof i.nearest_threshold_pct === 'number' && i.nearest_threshold_pct >= 0 && 'candle_differs' in i), `every investigation item carries the nearest threshold distance in % (${r.investigation.map((i) => i.nearest_threshold_pct.toFixed(3) + '%').join(', ')}) and whether the recorded candle differs`);
  ok(r.counts.skipped_signals === 1 && r.skipped[0].reason === 'late_entry' && r.skipped[0].in_backtest === true, 'the skipped signal is listed with its reason and the fact that the backtest takes that trade');

  // all matched -> MATCH
  const clean = [sessionEv, ...bt.flatMap((t) => tradeEvents(t))];
  const rc = report(clean);
  ok(rc.match === true && rc.counts.matched === bt.length && rc.investigation.length === 0 && rc.counts.live_only === 0 && rc.counts.backtest_only === 0, `a journal with the same trades, exit reasons and R = MATCH (${rc.counts.matched}/${bt.length})`);

  // tolerance on R and on the entry price
  const rShifted = [sessionEv, ...bt.flatMap((t, i) => tradeEvents(t, i === 0 ? { rShift: 0.2 } : {}))];
  ok(report(rShifted).counts.differs === 1 && /R differs by \+0\.200/.test(report(rShifted).investigation[0].why), 'R off by 0.2R with tolerance 0.05R: flagged');
  ok(cmp.buildReport({ events: rShifted, candles: { SOL_USDT: fin }, tolerance: 0.5, now: all[END].time + 100, mode: 'paper' }).match === true, 'the same journal with --tolerance 0.5 is a match (tolerance is configurable)');
  const eShifted = [sessionEv, ...bt.flatMap((t, i) => tradeEvents(t, i === 1 ? { entryShiftR: 0.3 } : {}))];
  ok(/entry price differs by 0\.3\d\dR/.test(report(eShifted).investigation[0].why), 'entry price 0.3R away from the backtest entry: flagged');

  // recorded candles vs the final download: journal candle and shadow recorder candle
  const withBadCandle = [sessionEv, ...bt.flatMap((t, i) => tradeEvents(t, i === 0 ? { candleClose: 0.01 } : {}))];
  const shadow = new Map([[`SOL_USDT|${all[W + 3].time}`, { open: all[W + 3].open, high: all[W + 3].high * 1.001, low: all[W + 3].low, close: all[W + 3].close, src: 'shadow recorder' }]]);
  const rd = report(withBadCandle, { shadow });
  ok(rd.counts.candle_diffs === 2 && rd.candle_diffs.some((d) => d.source === 'journal' && d.differs.includes('close')) && rd.candle_diffs.some((d) => d.source === 'shadow recorder' && d.differs.includes('high')), `recorded candles that differ from the final ones are listed (${rd.candle_diffs.map((d) => d.source + ':' + d.differs).join(', ')})`);
  ok(rd.match === true, 'a candle difference alone does not change the match verdict (match = trade set, exit reasons, R); it is reported as evidence');

  // forming candle dropped; only klines (public GET) is used
  const asked = [], stub = new Proxy({ klines: async (s, iv, a, b) => { asked.push(s); if (s !== 'SOL_USDT') return []; return fin.concat([{ time: all[END].time, open: 1, high: 1, low: 1, close: 1 }]).filter((c) => c.time >= a && c.time <= b); } }, { get: (t, k) => { if (k in t) return t[k]; throw new Error(`compare tried to use client.${String(k)}: it must only read public data`); } });
  const dl = await cmp.downloadCandles(stub, 'SOL_USDT', all[W].time, all[END].time, all[END].time + 100);
  ok(dl[dl.length - 1].time === all[END - 1].time && dl.every((c) => c.time + IV <= all[END].time + 100), 'the still-forming candle is dropped from the download');

  // main(): files, summary, exit codes, no orders (the client stub throws on anything but klines)
  const jfile = path.join(TMP, 'trades.jsonl'), outDir = path.join(TMP, 'out');
  for (const e of events) journal.appendRecord(e, jfile);
  const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' '));
  let code = await cmp.main(['node', 'x', '--journal', jfile, '--out-dir', outDir, '--quiet', '--mode', 'paper'], { client: stub, nowSec: all[END].time + 100 });
  console.log = ol;
  const day = new Date((all[END].time + 100) * 1000).toISOString().slice(0, 10);
  const jsonF = path.join(outDir, `compare-${day}.json`), txtF = path.join(outDir, `compare-${day}.txt`);
  ok(code === 1 && fs.existsSync(jsonF) && fs.existsSync(txtF), `main(): exit code 1 on a mismatch; wrote audit/out/compare-${day}.json and .txt`);
  const js = JSON.parse(fs.readFileSync(jsonF, 'utf8')), txt = fs.readFileSync(txtF, 'utf8'); if (process.env.DBG) { console.log(JSON.stringify(js.counts), js.match, js.warnings); console.log(txt.slice(0, 1800)); }
  ok(js.match === false && js.counts.live_only === 1 && /NOT A MATCH/.test(txt) && /INVESTIGATE \(3\)/.test(txt) && /nearest threshold at the signal close/.test(txt), 'the .json is machine readable and the .txt is a human summary with the investigation items');
  fs.rmSync(journalDir(), { recursive: true, force: true });
  const jclean = path.join(TMP, 'clean.jsonl'); for (const e of clean) journal.appendRecord(e, jclean);
  const logs2 = []; console.log = (...a) => logs2.push(a.join(' '));
  code = await cmp.main(['node', 'x', '--journal', jclean, '--out-dir', outDir, '--quiet', '--mode', 'paper'], { client: stub, nowSec: all[END].time + 100 });
  console.log = ol;
  ok(code === 0, 'main(): exit code 0 when the journal matches the backtest');

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
  function journalDir() { return process.env.LUCIDIO_JOURNAL_DIR; }
})().catch((e) => { console.error(e); process.exit(1); });
