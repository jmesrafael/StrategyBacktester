// test/fixes-test.js — audit fixes C3 (gap -> no signal) and C4 (new candle missing -> retry, then alert). No network, no money.
//   node test/fixes-test.js
'use strict';
process.env.LUCIDIO_STATE_DIR = require('path').join(require('os').tmpdir(), 'lucidio-fixes-state');
process.env.LUCIDIO_NO_NOTIFY = '1';
const fs = require('fs'), path = require('path');
const mexc = require('../mexc.js');
const bot = require('../lucidio.js');
const { backtest, gapInWindow } = require('../lucidio-core.js');
const IV = 14400;
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));

(async () => {
  // ---------- C3 ----------
  const z = load('MEXC_ZEC'), s = load('SOL');
  const old = backtest(z, { gapSkip: false }).trades, fixed = backtest(z).trades;
  let g = -1; for (let i = 1; i < z.length; i++) if (z[i].time - z[i - 1].time !== IV) g = i;
  const spanning = (t) => t.i0 - 1 >= g && t.i0 - 1 - g < 200;
  ok(old.filter(spanning).length > 0 && fixed.filter(spanning).length === 0, `C3 MEXC_ZEC: signals within 200 candles after the 63-day hole: ${old.filter(spanning).length} before the fix, ${fixed.filter(spanning).length} after`);
  ok(JSON.stringify(backtest(s).trades) === JSON.stringify(backtest(s, { gapSkip: false }).trades), 'C3 Binance SOL (no gaps): trade list identical with and without the rule');
  ok(gapInWindow(z, g + 199, 200) && !gapInWindow(z, g + 200, 200), 'C3 gapInWindow: hole is inside the 200-candle window for 200 candles (g..g+199), outside from g+200');
  // bot side: the same candles through processCoin with the paper executor
  const st = { lastTime: 0, pos: null, realizedR: 0, n: 0, trades: [] }, acct = { balance: 100 };
  const ev = await bot.processCoin('ZEC', z, st, bot.paper, { replay: true, acct });
  const ref = fixed;
  let diff = 0; for (let k = 0; k < Math.max(ref.length, st.trades.length); k++) if (!ref[k] || !st.trades[k] || ref[k].t !== st.trades[k].t || Math.abs(ref[k].R - st.trades[k].R) > 0.2) diff++;
  ok(st.trades.length === ref.length, `C3 bot (processCoin) vs fixed backtest on MEXC_ZEC: ${st.trades.length} vs ${ref.length} trades (bot has no funding, so R differs slightly)`);
  ok(ev.some((e) => /SKIPPED: gap in the last 200 candles/.test(e)), `C3 bot raises "signal SKIPPED: gap" warnings (${ev.filter((e) => /SKIPPED: gap/.test(e)).length} of them)`);

  // ---------- C4 ----------
  const B = load('SOL').slice(-500), last = B[B.length - 1];
  const nowMs = (t) => t * 1000;
  let calls = 0, clock = last.time + IV + 2;                       // 2 s after the close of `last`... newest candle in the feed is `last` (closed): the NEW one is missing
  mexc.client.now = () => nowMs(clock);
  const mk = (withNew) => B.concat(withNew ? [{ time: last.time + IV, open: last.close, high: last.close, low: last.close, close: last.close }] : []);
  // (a) the new candle appears on the 4th poll -> returned, not stale
  mexc.klines = async () => { calls++; clock += 1.5; return { data: calls >= 4 ? mk(true) : mk(false), ms: 1 }; };
  const a = await bot.fetchCandles('SOL', { pollMs: 1 });
  ok(!a.stale && a.B[a.B.length - 1].time === last.time + IV && a.polls === 4, `C4 candle appears late: polled ${a.polls}x until the new candle was there, stale=${!!a.stale}`);
  // (b) never appears -> stale after maxWait, with the info the caller needs (no silent success)
  calls = 0; clock = last.time + IV + 2; mexc.klines = async () => { calls++; clock += 30; return { data: mk(false), ms: 1 }; };
  const b = await bot.fetchCandles('SOL', { pollMs: 1, maxWaitSec: 600 });
  ok(b.stale === true && b.waitedSec > 600 && calls > 15, `C4 candle never appears: kept polling ${calls}x for ${b.waitedSec}s (> 10 min), then returned stale=true (old code gave up after 120 s and went on as if nothing was wrong)`);
  // (c) runOnce flags it as an error, makes no decision, and does not advance the coin's state
  const events = fs.existsSync(path.join(process.env.LUCIDIO_STATE_DIR, 'events.jsonl')) ? fs.readFileSync(path.join(process.env.LUCIDIO_STATE_DIR, 'events.jsonl'), 'utf8').split('\n').length : 0;
  clock = last.time + IV + 2; calls = 0;
  mexc.klines = async () => { calls++; clock += 40; return { data: mk(false), ms: 1 }; };
  mexc.serverTime = async () => ({ data: nowMs(clock), ms: 1 });
  mexc.hasKeys = () => false;
  await bot.runOnce({ fetch: { pollMs: 1 } });
  const evs = fs.readFileSync(path.join(process.env.LUCIDIO_STATE_DIR, 'events.jsonl'), 'utf8').trim().split('\n').slice(events > 0 ? events - 1 : 0).map((l) => JSON.parse(l));
  const runs = fs.readFileSync(path.join(process.env.LUCIDIO_STATE_DIR, 'runs.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)), r = runs[runs.length - 1];
  ok(r.stale.length === 2 && r.errors.length === 2 && evs.filter((e) => e.type === 'error' && /has not published the new 4h candle/.test(e.msg)).length === 2, `C4 runOnce: stale coins [${r.stale}] -> ${r.errors.length} error alerts (error events go to Telegram), run record has stale list`);
  const state = JSON.parse(fs.readFileSync(path.join(process.env.LUCIDIO_STATE_DIR, 'state.json'), 'utf8'));
  ok(!Object.values(state.coins || {}).some((c) => c.lastTime), 'C4 runOnce: no coin state was advanced (no decision on a half-fetched feed)');
  console.log(`\n${pass} passed, ${failN} failed`); process.exitCode = failN ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
