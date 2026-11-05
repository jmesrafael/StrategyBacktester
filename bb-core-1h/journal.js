// journal.js - the append-only trade journal: journal/trades.jsonl, one JSON object per line, NEVER edited or rewritten.
//
// Why: so the live results can later be compared, trade by trade, against the backtester run on freshly downloaded candles
// (compare-live-vs-backtest.js). Every event carries what is needed to explain a mismatch: the signal candle, the indicator values the decision
// used, intended vs real fill, costs, and provenance (git commit, code hash, config hash, version).
//
// Event types   entry | exit | skip       Linked by trade_id = "SYMBOL|SIDE|signal-candle-open-ms"   (the match key: symbol, side, signal candle open, UTC ms)
// Durability    each record is ONE write() in O_APPEND mode followed by fsync. A crash can at worst leave a torn LAST line; the next append first
//               seals it with a newline (appending, never rewriting) and readers skip lines that do not parse (and count them).
// Failures      append() throws; the caller (lucidio.js hook wrapper) turns that into an ERROR alert and keeps managing the trade.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const { DEFAULTS } = require('./lucidio-core.js');

const BOT_VERSION = '1.1.0';
const SCHEMA = 1;

// journal/ next to the bot code; tests that set LUCIDIO_STATE_DIR get their journal inside it (never in the real folder)
const dir = () => process.env.LUCIDIO_JOURNAL_DIR || (process.env.LUCIDIO_STATE_DIR ? path.join(process.env.LUCIDIO_STATE_DIR, 'journal') : path.join(__dirname, 'journal'));
const file = () => path.join(dir(), 'trades.jsonl');

const sideName = (dir) => (dir === 1 || dir === 'LONG' ? 'LONG' : 'SHORT');
const tradeId = (symbol, side, sigTimeSec) => `${symbol}|${sideName(side)}|${Math.round(sigTimeSec) * 1000}`;
const isoOf = (ms) => new Date(ms).toISOString();

// ---------------- low level: append-only, fsync, torn-tail sealing ----------------
let seqMemo = { file: null, n: 0 };
function nextSeq(f) {
  if (seqMemo.file !== f) {                         // first append in this process: count the lines already there
    let n = 0; try { for (const ch of fs.readFileSync(f)) if (ch === 10) n++; } catch {}
    seqMemo = { file: f, n };
  }
  return ++seqMemo.n;
}
function appendRecord(rec, f = file()) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const seq = nextSeq(f);
  const line = JSON.stringify({ ...rec, seq });
  const fd = fs.openSync(f, 'a+');                  // O_APPEND: every write lands at the end, whatever else happens
  try {
    let prefix = '';
    const size = fs.fstatSync(fd).size;
    if (size > 0) { const b = Buffer.alloc(1); fs.readSync(fd, b, 0, 1, size - 1); if (b[0] !== 10) prefix = '\n'; }   // torn tail from a crash: seal it, never rewrite it
    fs.writeSync(fd, Buffer.from(prefix + line + '\n'));
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  return { ...rec, seq };
}
function readAll(f = file()) {
  let text = ''; try { text = fs.readFileSync(f, 'utf8'); } catch { return { events: [], bad: 0 }; }
  const events = []; let bad = 0;
  for (const l of text.split('\n')) { if (!l.trim()) continue; try { events.push(JSON.parse(l)); } catch { bad++; } }
  return { events, bad };
}

// ---------------- indicators used for a decision (same formulas as lucidio-core signalFrom; see test) ----------------
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
function indicators(closes, atr, cfg = DEFAULTS) {
  const n = closes.length, close = closes[n - 1];
  if (n < cfg.bbLen) return null;
  const w = closes.slice(-cfg.bbLen), mid = avg(w), sd = Math.sqrt(avg(w.map((v) => (v - mid) ** 2)));
  const up = mid + cfg.bbMult * sd, lo = mid - cfg.bbMult * sd, sma = n >= cfg.trendLen ? avg(closes.slice(-cfg.trendLen)) : null;
  const d = (v) => (v == null ? null : ((close - v) / v) * 100);
  const dists = [d(up), d(lo), d(sma)].filter((v) => v != null).map(Math.abs);
  return { close, bb_upper: up, bb_mid: mid, bb_lower: lo, sma200: sma, atr14: atr, dist_upper_pct: d(up), dist_lower_pct: d(lo), dist_sma_pct: d(sma), nearest_threshold_pct: dists.length ? Math.min(...dists) : null };
}

// ---------------- provenance ----------------
const CODE_FILES = ['lucidio.js', 'lucidio-core.js', 'live.js', 'mexc.js', 'config.js', 'telegram.js', 'journal.js', 'dashboard-push.js', 'ledger-sync.js'];
let provMemo = null;
function gitInfo() {
  try { const b = JSON.parse(fs.readFileSync(path.join(__dirname, 'BUILD_INFO.json'), 'utf8')); return { commit: b.commit || 'unknown', dirty: !!b.dirty, built_at: b.built_at }; } catch {}
  try {
    const run = (args) => cp.execFileSync('git', args, { cwd: __dirname, timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return { commit: run(['rev-parse', 'HEAD']), dirty: run(['status', '--porcelain', '--', '.']).length > 0 };
  } catch { return { commit: 'unknown', dirty: null }; }
}
const codeHash = () => {
  const h = crypto.createHash('sha256');
  for (const f of CODE_FILES) { try { h.update(f + '\0').update(fs.readFileSync(path.join(__dirname, f))); } catch {} }
  return h.digest('hex');
};
// the config the decision ran under, without secrets (heartbeatUrl is a secret ping URL)
const configHash = (cfg) => {
  const c = { ...cfg }; delete c.heartbeatUrl; delete c.riskPctClamped;
  const canon = JSON.stringify(Object.keys(c).sort().map((k) => [k, c[k]]));
  return crypto.createHash('sha256').update(canon).digest('hex');
};
function provenance(cfg, mode) {
  if (!provMemo) { const g = gitInfo(); provMemo = { git_commit: g.commit, git_dirty: g.dirty, code_hash: codeHash(), bot_version: BOT_VERSION }; }
  return { mode, ...provMemo, config_hash: configHash(cfg) };
}

// ---------------- event builders ----------------
// Info objects come from the hooks in lucidio.js processCoin. Everything is plain numbers/strings (no secrets, no paths).
function base(type, info, cfg, mode, nowMs) {
  const symbol = info.symbol, side = info.dir ? sideName(info.dir) : null;
  return {
    v: SCHEMA, type, event_id: crypto.randomUUID(), ts: isoOf(nowMs), ts_ms: nowMs,
    trade_id: side && info.sigTime != null ? tradeId(symbol, side, info.sigTime) : null,
    symbol, side, match_key: { symbol, side, signal_candle_open_ms: info.sigTime != null ? Math.round(info.sigTime) * 1000 : null },
    mode, provenance: provenance(cfg, mode),
  };
}
function entryEvent(i, cfg, mode, nowMs = Date.now()) {
  return {
    ...base('entry', i, cfg, mode, nowMs),
    decision_ts: isoOf(Math.round(i.decisionSec * 1000)),
    signal_candle: { open_time_ms: Math.round(i.sigTime) * 1000, open: i.sigCandle.open, high: i.sigCandle.high, low: i.sigCandle.low, close: i.sigCandle.close },
    indicators: i.indicators,
    entry: { intended_price: i.intended, fill_price: i.fill, fill_kind: i.live ? 'real (MEXC)' : 'paper (simulated at the price of the wake-up)', next_candle_open_ms: Math.round(i.nextOpenSec) * 1000, next_candle_open_price: i.nextOpen, delay_sec: i.delaySec ?? null, slippage_r: i.slipR ?? null },
    sl: i.stop, tp: i.tp,
    position: { qty: i.qty, contracts: i.vol ?? null, leverage: i.lev ?? null, position_id: i.positionId ?? null, order_id: i.oid ?? null },
    risk: { risk_usd: i.riskUsd, risk_pct: i.balance > 0 ? i.riskUsd / i.balance : null, one_r_price: i.oneR, balance_used: i.balance },
    costs: i.costs,
  };
}
function exitEvent(i, cfg, mode, nowMs = Date.now()) {
  return {
    ...base('exit', i, cfg, mode, nowMs),
    exit_ts: isoOf(Math.round(i.exitSec * 1000)),
    exit_price: i.exit, exit_reason: i.why, exit_candle_open_ms: Math.round(i.exitCandleOpenSec) * 1000,
    r_result: i.R, usd_pnl: i.usd, balance_after: i.balanceAfter, hold_sec: i.holdSec,
    entry_summary: { fill_price: i.entry, sl: i.stop, tp: i.tp, entry_candle_open_ms: Math.round(i.t0) * 1000 },
    costs: i.costs,
  };
}
function skipEvent(i, cfg, mode, nowMs = Date.now()) {
  return {
    ...base('skip', i, cfg, mode, nowMs),
    reason: i.reason, detail: i.detail || null,
    signal_candle: i.sigCandle ? { open_time_ms: Math.round(i.sigTime) * 1000, open: i.sigCandle.open, high: i.sigCandle.high, low: i.sigCandle.low, close: i.sigCandle.close } : null,
    indicators: i.indicators || null,
  };
}

// a bot start: lets compare-live-vs-backtest.js know from when the bot was watching (candles with no signal write nothing else)
function sessionEvent(i, cfg, mode, nowMs = Date.now()) {
  return { ...base('session', { symbol: null }, cfg, mode, nowMs), coins: i.coins || [], note: i.note || null };
}

// account snapshots (research): journal/snapshots.jsonl, same append-only rules as trades.jsonl, one line per bot run
const snapshotFile = () => path.join(dir(), 'snapshots.jsonl');
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));
function appendSnapshot(i, cfg, nowMs = Date.now()) {
  const { mode, ...rest } = i;
  return appendRecord({ v: SCHEMA, type: 'snapshot', event_id: crypto.randomUUID(), ts: isoOf(nowMs), ts_ms: nowMs, mode, ...rest, provenance: provenance(cfg, mode) }, snapshotFile());
}

// a writer bound to one mode/config source. cfgFn() returns the current config.
function makeWriter({ mode, cfgFn, f = null }) {
  const target = () => f || file();
  // build first, then append; if the append fails the error carries the built record (e.rec) so the dashboard can still get the event
  const write = (build) => (i) => { const rec = build(i, cfgFn(), mode()); try { return appendRecord(rec, target()); } catch (e) { e.rec = rec; throw e; } };
  return { entry: write(entryEvent), exit: write(exitEvent), skip: write(skipEvent), session: write(sessionEvent) };
}

module.exports = { BOT_VERSION, dir, file, snapshotFile, pick, appendSnapshot, appendRecord, readAll, indicators, provenance, configHash, codeHash, tradeId, sideName, entryEvent, exitEvent, skipEvent, sessionEvent, makeWriter };
