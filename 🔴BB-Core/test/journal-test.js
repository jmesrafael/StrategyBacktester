// test/journal-test.js - the append-only trade journal: fields, linking, skipped signals, append-only behaviour, crash safety, write failures.
//   node test/journal-test.js        No network, no money, writes only to the OS temp folder.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const H = require('./helpers.js');
const STATE = H.tmp('journal-state'), JDIR = path.join(STATE, 'journal');
process.env.LUCIDIO_STATE_DIR = STATE; process.env.LUCIDIO_JOURNAL_DIR = JDIR; process.env.LUCIDIO_NO_NOTIFY = '1';
for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET']) delete process.env[k];
const bot = require('../lucidio.js'), journal = require('../journal.js'), core = require('../lucidio-core.js');

let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const missing = (o, paths) => paths.filter((p) => get(o, p) === undefined || get(o, p) === null);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

(async () => {
  const sc = H.scenario('SOL', 40);
  const bt = sc.trade, sigSec = sc.all[sc.i0 - 1].time;

  // ---------- 1. one trade -> one entry event + one exit event, linked ----------
  const { st, events } = await H.runTrade(bot.processCoin, bot.paper, sc, { hooks: bot.makeHooks() });
  const { events: J, bad } = journal.readAll();
  const tid = `SOL_USDT|${bt.dir === 1 ? 'LONG' : 'SHORT'}|${sigSec * 1000}`;
  const en = J.filter((e) => e.type === 'entry' && e.trade_id === tid), ex = J.filter((e) => e.type === 'exit' && e.trade_id === tid);
  ok(st.n === 1 && events.some((e) => e.startsWith('ENTER')) && events.some((e) => e.startsWith('EXIT')), `a real SOL trade ran through the bot (${st.trades[0] && st.trades[0].why}, ${st.trades[0] && st.trades[0].R.toFixed(2)}R)`);
  ok(en.length === 1 && ex.length === 1 && bad === 0, `exactly one entry and one exit event written for this trade (${en.length}/${ex.length}), no unreadable lines`);
  const e0 = en[0], x0 = ex[0];
  ok(e0.trade_id === x0.trade_id && e0.trade_id === `SOL_USDT|${bt.dir === 1 ? 'LONG' : 'SHORT'}|${sigSec * 1000}`, `entry and exit are linked by trade_id = symbol|side|signal candle open ms (${e0.trade_id})`);
  ok(e0.match_key.symbol === 'SOL_USDT' && e0.match_key.side === (bt.dir === 1 ? 'LONG' : 'SHORT') && e0.match_key.signal_candle_open_ms === sigSec * 1000, 'match key = symbol, side, signal candle open time in UTC milliseconds');

  // ---------- 2. field completeness ----------
  const entryFields = ['event_id', 'seq', 'ts', 'type', 'trade_id', 'symbol', 'side', 'mode', 'decision_ts', 'signal_candle.open_time_ms', 'signal_candle.open', 'signal_candle.high', 'signal_candle.low', 'signal_candle.close',
    'indicators.close', 'indicators.bb_upper', 'indicators.bb_mid', 'indicators.bb_lower', 'indicators.sma200', 'indicators.atr14', 'indicators.nearest_threshold_pct',
    'entry.intended_price', 'entry.fill_price', 'entry.next_candle_open_ms', 'sl', 'tp', 'position.qty', 'risk.risk_usd', 'risk.risk_pct', 'risk.one_r_price', 'risk.balance_used', 'costs.kind', 'costs.entry_fee_pct', 'costs.entry_slippage_pct',
    'provenance.mode', 'provenance.git_commit', 'provenance.code_hash', 'provenance.config_hash', 'provenance.bot_version'];
  const exitFields = ['event_id', 'seq', 'ts', 'type', 'trade_id', 'symbol', 'side', 'mode', 'exit_ts', 'exit_price', 'exit_reason', 'exit_candle_open_ms', 'r_result', 'usd_pnl', 'hold_sec', 'costs.kind', 'costs.fees_pct', 'costs.slippage_pct', 'costs.funding_r',
    'entry_summary.fill_price', 'entry_summary.sl', 'entry_summary.tp', 'provenance.mode', 'provenance.git_commit', 'provenance.code_hash', 'provenance.config_hash', 'provenance.bot_version'];
  ok(missing(e0, entryFields).length === 0, `entry event has every required field ${missing(e0, entryFields).length ? '(missing: ' + missing(e0, entryFields).join(', ') + ')' : `(${entryFields.length} checked)`}`);
  ok(missing(x0, exitFields).length === 0, `exit event has every required field ${missing(x0, exitFields).length ? '(missing: ' + missing(x0, exitFields).join(', ') + ')' : `(${exitFields.length} checked)`}`);
  ok(/estimate/.test(e0.costs.kind) && /estimate/.test(x0.costs.kind) && /not model/.test(x0.costs.funding_note), 'paper costs are labelled as estimates (and funding as not modelled)');
  ok(e0.mode === 'paper' && e0.provenance.mode === 'paper' && /^[0-9a-f]{64}$/.test(e0.provenance.code_hash) && /^[0-9a-f]{64}$/.test(e0.provenance.config_hash) && !!e0.provenance.bot_version, 'provenance: mode, code hash, config hash, bot version (and git commit)');
  const sigRes = core.signalFrom(sc.all.slice(0, sc.i0).map((c) => c.close), null, {});   // only used for the stop = middle band identity below
  const midMatches = Math.abs(e0.indicators.bb_mid - e0.sl) < 1e-6 * e0.sl;
  ok(midMatches && e0.indicators.bb_upper > e0.indicators.bb_mid && e0.indicators.bb_lower < e0.indicators.bb_mid, 'recorded indicators are the ones the decision used (stop = Bollinger middle band)');
  ok(x0.exit_reason === bt.why && x0.exit_candle_open_ms === (bt.tExit - 14400) * 1000, `exit reason and exit candle agree with the backtest (${x0.exit_reason}, ${new Date(x0.exit_candle_open_ms).toISOString()})`);
  ok(!JSON.stringify(J).match(/telegram|apiSecret|mexc-keys|password/i), 'no secret-looking field names in the journal');

  // ---------- 3. skipped signals are recorded with a reason ----------
  const v = H.viewAt(sc.all, sc.i0), fresh = () => ({ lastTime: null, pos: null, realizedR: 0, n: 0, trades: [] });
  const before = journal.readAll().events.length;
  await bot.processCoin('SOL', v.B, fresh(), bot.paper, { acct: { balance: 100 }, now: v.now, nowPx: v.nowPx, blocked: 'MEXC holds 1 SOL position the bot did not open', hooks: bot.makeHooks() });
  await bot.processCoin('SOL', v.B, fresh(), bot.paper, { acct: { balance: 100, peakR: 50, totalR: 5 }, now: v.now, nowPx: v.nowPx, hooks: bot.makeHooks() });
  await bot.processCoin('SOL', v.B, fresh(), bot.paper, { acct: { balance: 100 }, now: v.now + 3600, nowPx: v.nowPx, hooks: bot.makeHooks() });
  const sk = journal.readAll().events.slice(before).filter((e) => e.type === 'skip');
  ok(sk.length === 3 && ['blocked', 'drawdown_halt', 'late_entry'].every((r) => sk.some((e) => e.reason === r)), `skipped signals journaled with reasons: ${sk.map((e) => e.reason).join(', ')}`);
  ok(sk.every((e) => e.trade_id === e0.trade_id && e.match_key.signal_candle_open_ms === sigSec * 1000 && e.signal_candle && e.indicators && e.indicators.nearest_threshold_pct != null), 'each skip carries the match key, the signal candle and the indicators');

  // ---------- 4. append-only ----------
  const file = journal.file(), bytes0 = fs.readFileSync(file), h0 = sha(bytes0);
  journal.appendRecord({ v: 1, type: 'session', note: 'append test' }, file);
  journal.appendRecord({ v: 1, type: 'session', note: 'append test 2' }, file);
  const bytes1 = fs.readFileSync(file);
  ok(bytes1.length > bytes0.length && sha(bytes1.subarray(0, bytes0.length)) === h0, 'appending leaves every earlier byte of the journal untouched');
  ok(!Object.keys(journal).some((k) => /update|delete|remove|rewrite|truncate|edit/i.test(k)), `the journal module has no edit/delete API (exports: ${Object.keys(journal).join(', ')})`);
  const seqs = journal.readAll().events.map((e) => e.seq);
  ok(seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1), 'seq numbers increase by one per record');

  // ---------- 5. crash safety ----------
  let fsyncs = 0; const realFsync = fs.fsyncSync; fs.fsyncSync = (fd) => { fsyncs++; return realFsync(fd); };
  journal.appendRecord({ v: 1, type: 'session', note: 'fsync test' }, file);
  fs.fsyncSync = realFsync;
  ok(fsyncs >= 1, `every record is fsync'ed (${fsyncs} fsync call)`);
  fs.appendFileSync(file, '{"v":1,"type":"entry","trade_id":"SOL_USDT|LONG|torn-by-a-crash');            // power cut in the middle of a write: no newline, half a record
  const before2 = fs.readFileSync(file), r2 = journal.appendRecord({ v: 1, type: 'session', note: 'after the crash' }, file);
  const after2 = fs.readFileSync(file), rd = journal.readAll(file);
  ok(sha(after2.subarray(0, before2.length)) === sha(before2), 'after a torn write the old bytes (including the torn fragment) are untouched');
  ok(rd.bad === 1 && rd.events[rd.events.length - 1].note === 'after the crash' && r2.seq === rd.events[rd.events.length - 1].seq, 'the next record starts on its own line and parses; readers skip (and count) the one torn line');

  // ---------- 6. a journal failure raises an error alert but the trade is still managed ----------
  const blocker = path.join(STATE, 'not-a-folder'); fs.writeFileSync(blocker, 'x');
  process.env.LUCIDIO_JOURNAL_DIR = path.join(blocker, 'journal');               // mkdir under a FILE fails
  const st2 = fresh(), ev2 = await bot.processCoin('SOL', v.B, st2, bot.paper, { acct: { balance: 100 }, now: v.now, nowPx: v.nowPx, hooks: bot.makeHooks() });
  ok(ev2.some((e) => e.startsWith('ERROR') && /journal write failed/.test(e)), 'journal write failure -> an ERROR event (which alerts Telegram)');
  ok(!!st2.pos && ev2.some((e) => e.startsWith('ENTER')), 'and the position is still opened and tracked normally');
  process.env.LUCIDIO_JOURNAL_DIR = JDIR;

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
