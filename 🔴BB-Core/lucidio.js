// lucidio.js — Lucid'io — auto-trader for MEXC USDT-M perpetuals. PAPER by default; LIVE when bot-config.json has "mode": "live".
//
//   node lucidio.js check             read-only pre-flight: clock, contracts, candles, sizing preview, API key, position mode, open positions
//   node lucidio.js test-trade SOL --yes   LIVE API test with real money: 1 minimum contract, stop + target attached, verified, closed again
//   node lucidio.js once              fetch closed 4h candles from MEXC, process anything new, save state          (run every 4h)
//   node lucidio.js loop              same, stays running: wakes 2 s after every 4h close (MEXC server time), waits for the new candle
//   node lucidio.js status            show open positions + results so far
//   node lucidio.js replay SOL,ZEC    parity test: push the whole history in data/ through this bot and compare with backtest.js
//   node test/selftest.js          live executor against a simulated MEXC: same trades as paper + crash / failure scenarios
//
// How it decides (identical to lucidio-core.js — the entry rule is the shared signalFrom()):
//   per closed candle: (1) stop/target hit inside it? (2) 48 candles after the entry candle (= 49 held, audit C2) -> exit at next open (3) flat + signal -> enter at next open.
// Execution is behind an "executor" (paper here, MEXC in live.js) with the same methods, so the decision logic is the same in all modes:
//   enter(coin, o) -> position | {pos} | {skip}     checkExit(pos, candle) -> {px, why, R} | null     timeExit(pos, px) -> {px, why, R} | null
'use strict';
const fs = require('fs'), path = require('path');
const { signalFrom, gapInWindow, DEFAULTS } = require('./lucidio-core.js');
const mexc = require('./mexc.js');
const { createLiveExecutor } = require('./live.js');
const ledgerSync = require('./ledger-sync.js');

const DIR = __dirname;
const STATE_DIR = process.env.LUCIDIO_STATE_DIR || path.join(DIR, 'state'), STATE_FILE = path.join(STATE_DIR, 'state.json');
// Sizing: riskPct > 0 -> risk riskPct of the account balance on every trade (compounds; SOL and ZEC share one balance; in LIVE mode the
//         balance is the real MEXC futures equity, re-read every run); riskPct = 0 -> fixed riskUsd per trade. maxRiskUsd caps either.
// haltAtR: no new entries once the account is this many R below its best point (the report's 99th-percentile drawdown is 39R).
// bot-config.json is re-read at the start of every run (the dashboard Settings panel writes it), so changes apply at the next 4h close.
const config = require('./config.js');
const CFG = config.load();
function reloadConfig() {
  const next = config.load(), changed = Object.keys(next).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(CFG[k]));
  Object.assign(CFG, next);
  return changed;
}
// LIVE needs TWO things: "mode": "live" in bot-config.json AND an explicit flag on the machine (--allow-live on the command line, or
// LUCIDIO_ALLOW_LIVE=1 in the environment, e.g. a systemd drop-in). Copying a bot-config.json that says live to a new box, or a stray click in the
// dashboard, therefore never starts real trading by itself.
const liveAllowed = () => process.argv.includes('--allow-live') || process.env.LUCIDIO_ALLOW_LIVE === '1';
const S = { ...DEFAULTS }, COST = DEFAULTS.cost, IV = 14400;
const riskFor = (acct) => Math.min(CFG.maxRiskUsd, CFG.riskPct > 0 ? acct.balance * CFG.riskPct : CFG.riskUsd);
const usd = (v) => (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
const iso = (t) => new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowSec = () => mexc.client.now() / 1000;         // MEXC-corrected clock (offset measured every run, like a TOTP code)
const log = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(' ')}`; console.log(line); try { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.appendFileSync(path.join(STATE_DIR, 'bot.log'), line + '\n'); } catch {} };

// ---------------- paper executor (same fill/exit/fee rules as lucidio-core.js, minus funding) ----------------
const paper = {
  enter(coin, o) {
    const d = o.dir, fill = o.refOpen * (1 + d * COST.slip), dist = Math.abs(fill - o.stop) / fill;
    if (!(dist > 0) || !(o.riskUsd > 0) || !(d === 1 ? o.stop < fill : o.stop > fill)) return null;
    return { coin, dir: d, entry: fill, stop: o.stop, tp: o.tp, dist, riskUsd: o.riskUsd, qty: o.riskUsd / Math.abs(fill - o.stop), t0: o.t0 };
  },
  checkExit(pos, c) {
    const d = pos.dir;
    if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) return this._close(pos, (d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * COST.slip), COST.stopFee, 'stop');
    if (d === 1 ? c.high >= pos.tp * (1 + COST.tpBuf) : c.low <= pos.tp * (1 - COST.tpBuf)) return this._close(pos, (d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open)) * (1 - d * COST.tpSlip), COST.tpFee, 'target');
    return null;
  },
  timeExit(pos, px) { return this._close(pos, px * (1 - pos.dir * COST.slip), COST.timeFee, 'time'); },
  _close(pos, px, fee, why) { return { px, why, R: (pos.dir * (px - pos.entry) / pos.entry - COST.entryFee - fee) / pos.dist }; },
};

// ---------------- the decision logic (one state machine for replay, paper and live) ----------------
// B = candles oldest→newest; B[n-1] is the still-forming one. st = per-coin state { lastTime, pos, realizedR, n, trades, pending }.
// opt: acct (shared { balance, totalR, peakR }), replay, now (sec), nowPx (price right now), blocked (reason no new entries), save().
// Fills: replay uses the next candle's open (= the backtest); paper/live use the price NOW — if the bot is late, the result shows it.
async function processCoin(coin, B, st, exec, opt = {}) {
  const acct = opt.acct || { balance: CFG.startBalance };
  const now = opt.now ?? Date.now() / 1000;
  const n = B.length, ev = [];
  const closes = B.map((b) => b.close), atr = new Array(n).fill(null);
  let a = null;
  for (let i = 0; i < n; i++) {
    const tr = i === 0 ? B[i].high - B[i].low : Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close));
    if (i === 13) { let s = 0; for (let j = 0; j < 14; j++) s += j === 0 ? B[0].high - B[0].low : Math.max(B[j].high - B[j].low, Math.abs(B[j].high - B[j - 1].close), Math.abs(B[j].low - B[j - 1].close)); a = s / 14; }
    else if (i > 13) a = (a * 13 + tr) / 14;
    atr[i] = a;
  }
  if (st.lastTime == null) st.lastTime = n >= 3 ? B[n - 3].time : 0; // fresh start: evaluate only the newest closed candle
  for (let i = 1; i < n - 1; i++) {
    const c = B[i], next = B[i + 1];
    if (c.time <= st.lastTime) continue;
    const fillPx = opt.replay ? next.open : (opt.nowPx ?? next.open);
    if (st.pos) {
      const x = await exec.checkExit(st.pos, c);
      if (x) finish(x, c.time + IV);                        // stop / target: flat again, a new signal on this same candle is allowed
      else {
        if (S.maxBars > 0 && (c.time - st.pos.t0) / IV >= S.maxBars) {
          const t = await exec.timeExit(st.pos, fillPx);
          if (t) finish(t, opt.replay ? next.time : Math.round(now));
          else ev.push(`ERROR ${coin}: time exit failed — position still open on MEXC (its stop/target still protect it); retrying next run`);
        }
        st.lastTime = c.time; continue;                     // still in the trade (or a time exit, which uses up this candle)
      }
    }
    // C3: a missing candle among the last 200 means the indicators span a hole: no new signal (same rule as backtest(): gapSkip)
    const gap = !st.pos && i >= S.warmup && S.gapSkip && gapInWindow(B, i, Math.max(S.bbLen, S.trendLen), IV);
    if (gap && signalFrom(closes.slice(Math.max(0, i - 399), i + 1), atr[i], S)) ev.push(`WARNING ${coin}: signal on candle ${iso(c.time)} SKIPPED: gap in the last ${Math.max(S.bbLen, S.trendLen)} candles (MEXC history has a hole, indicators unreliable)`);
    if (!st.pos && i >= S.warmup && !gap) {
      const sig = signalFrom(closes.slice(Math.max(0, i - 399), i + 1), atr[i], S);
      if (sig) {
        const tag = `SIGNAL ${coin} ${sig.dir === 1 ? 'LONG' : 'SHORT'} on candle ${iso(c.time)}`, dd = (acct.peakR || 0) - (acct.totalR || 0);
        if (!opt.replay && now - next.time > CFG.maxEntryDelaySec) ev.push(`${tag} SKIPPED: next candle opened ${Math.round((now - next.time) / 60)} min ago (too late to enter at its open)`);
        else if (dd >= -CFG.haltAtR) ev.push(`${tag} skipped: HALTED (account ${dd.toFixed(1)}R below its best point, limit ${-CFG.haltAtR}R)`);
        else if (!opt.replay && fs.existsSync(path.join(DIR, 'STOP'))) ev.push(`${tag} skipped: STOP file present`);
        else if (opt.blocked) ev.push(`${tag} skipped: ${opt.blocked}`);
        else {
          const r = await exec.enter(coin, { ...sig, refOpen: fillPx, t0: next.time, sigTime: c.time, riskUsd: riskFor(acct), st, save: opt.save || (() => {}) });
          const p = r && (r.pos || (r.skip ? null : r));
          if (r && r.skip && !r.aborted) ev.push(`${r.error ? 'ERROR ' : ''}${tag} skipped: ${r.skip}`);
          if (p) {
            st.pos = p;
            if (!opt.replay) { p.entryDelaySec = Math.round(now - next.time); p.slipR = +(p.dir * (p.entry - next.open) / Math.abs(next.open - p.stop)).toFixed(4); }
            ev.push(`ENTER ${coin} ${p.dir === 1 ? 'LONG' : 'SHORT'} @ ${p.entry.toPrecision(6)}  stop ${p.stop.toPrecision(6)}  tp ${p.tp.toPrecision(6)}  qty ${p.qty.toPrecision(4)}${p.vol ? ` (${p.vol} contracts, ${p.lev}x isolated)` : ''} (risk ${usd(p.riskUsd)} of balance ${usd(acct.balance)})${p.slipR != null ? ` · ${p.entryDelaySec}s after the open, price ${p.slipR >= 0 ? '+' : ''}${p.slipR.toFixed(3)}R from it` : ''}`);
            if (r.warn) ev.push(`ERROR ${coin}: ${r.warn}`);
            if (r.aborted) { ev.push(`ERROR ${tag}: ${r.skip}`); finish(r.aborted, Math.round(now)); }
          }
        }
      }
    }
    st.lastTime = c.time;
  }
  return ev;

  function finish(x, tExit) {
    const p = st.pos; st.pos = null; st.realizedR += x.R; st.n++;
    const pnl = x.usd ?? x.R * (p.riskUsd ?? CFG.riskUsd);
    acct.balance += pnl;
    acct.totalR = (acct.totalR || 0) + x.R; acct.peakR = Math.max(acct.peakR || 0, acct.totalR);
    const rec = { coin: p.coin, dir: p.dir, t: p.t0, tExit, entry: p.entry, exit: x.px, why: x.why, R: x.R, usd: pnl, balance: acct.balance, entryDelaySec: p.entryDelaySec };
    if (p.live) Object.assign(rec, { live: true, vol: p.vol, riskUsd: p.riskUsd, slipR: p.slipR, fees: x.fees, funding: x.funding, positionId: p.positionId });
    (st.trades = st.trades || []).push(rec);
    ev.push(`EXIT  ${p.coin} ${p.dir === 1 ? 'LONG' : 'SHORT'} ${x.why}  ${x.R >= 0 ? '+' : ''}${x.R.toFixed(2)}R  (${usd(pnl)})  total ${st.realizedR.toFixed(2)}R  balance ${usd(acct.balance)}`);
  }
}

// ---------------- data: MEXC USDT-M perpetual 4h klines (the venue we trade) ----------------
// Up to 3 attempts (waits 2s, then 5s). Returns { B, ms, attempts }; ms = the successful request's time.
async function fetchMexc(coin, bars = 500) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { const { data, ms } = await mexc.klines(coin, bars); return { B: data, ms, attempts: attempt }; }
    catch (e) { lastErr = e; if (mexc.isBlocked(e)) throw e; if (attempt < 3) { event('warn', coin, `candle fetch failed (attempt ${attempt}/3): ${e.message} — retrying`); await sleep(attempt === 1 ? 2000 : 5000); } }
  }
  throw lastErr;
}
// right after a 4h close MEXC may need a moment to start the new candle: poll until it exists (audit C4).
// Waits up to maxWaitSec (default 10 min) after the close, polling every 1.5 s then every 4.5 s after ~1 min. If the new candle is STILL missing it returns
// { stale: true }: the caller must not treat the just-closed candle as the forming one — it raises an alert and runOnce is retried while the entry window is open.
async function fetchCandles(coin, o = {}) {
  const maxWaitSec = o.maxWaitSec ?? 600, pollMs = o.pollMs ?? 1500;
  for (let k = 0; ; k++) {
    const f = await fetchMexc(coin), expected = Math.floor(nowSec() / IV) * IV, waited = nowSec() - expected;
    if (f.B[f.B.length - 1].time >= expected) return { ...f, polls: k + 1 };
    if (waited > maxWaitSec) return { ...f, polls: k + 1, stale: true, waitedSec: Math.round(waited), expected };
    await sleep(k < 40 ? pollMs : pollMs * 3);
  }
}

// ---------------- state + run records (read by dashboard.js) ----------------
//   state/state.json   positions, trades, balance, lastRun summary
//   state/runs.jsonl   one line per run: execution time, MEXC latency, candle lag/gaps, clock drift, errors, MEXC balance snapshot
//   state/events.jsonl one line per event: enter / exit / skip / warn / error / start
//   state/bot.pid      written while `loop` is running, so the dashboard can tell whether the bot is alive
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { coins: {}, startedAt: new Date().toISOString() }; } };
const saveState = (s) => { fs.mkdirSync(STATE_DIR, { recursive: true }); const tmp = STATE_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(s, null, 1)); fs.renameSync(tmp, STATE_FILE); };
const appendJsonl = (name, obj) => { try { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.appendFileSync(path.join(STATE_DIR, name), JSON.stringify(obj) + '\n'); } catch {} };
function event(type, coin, msg) {
  log(type === 'error' && !msg.startsWith('ERROR') ? `${coin} ERROR ${msg}` : type === 'warn' && !msg.startsWith('WARNING') ? `${coin} WARNING ${msg}` : msg);
  appendJsonl('events.jsonl', { ts: new Date().toISOString(), type, coin, msg });
  if (type === 'enter' || type === 'exit' || type === 'error' || type === 'skip' || /SIGNAL .*SKIPPED/i.test(msg)) notify(msg);   // a skipped signal is a missed trade: tell the phone
}
const typeOf = (msg) => (msg.startsWith('ENTER') ? 'enter' : msg.startsWith('EXIT') ? 'exit' : msg.startsWith('ERROR') ? 'error' : msg.startsWith('WARNING') ? 'warn' : /skip/i.test(msg) ? 'skip' : 'info');

// optional phone alerts: add "telegramToken" + "telegramChatId" to mexc-keys.json
function notify(text) {
  let k = {}; try { k = JSON.parse(fs.readFileSync(path.join(DIR, 'mexc-keys.json'), 'utf8')); } catch {}
  if (!k.telegramToken || !k.telegramChatId || process.env.LUCIDIO_NO_NOTIFY) return;
  fetch(`https://api.telegram.org/bot${k.telegramToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000), body: JSON.stringify({ chat_id: k.telegramChatId, text: `Lucid'io ${CFG.mode.toUpperCase()}: ${text}` }) }).catch(() => {});
}

// healthchecks.io style ping after EVERY run: plain URL = the run succeeded, URL/fail = errors or a candle that never showed up.
// With the check set to period 4h + grace 20 min, healthchecks.io alerts when no run has pinged for 4h20m (deploy/watchdog.js does the same on the box).
function heartbeat(ok) {
  if (!CFG.heartbeatUrl) return;
  fetch(CFG.heartbeatUrl.replace(/\/+$/, '') + (ok ? '' : '/fail'), { signal: AbortSignal.timeout(10000) }).catch(() => {});
}

let liveExec = null, lastRun = null;
const getLive = () => (liveExec = liveExec || createLiveExecutor({ api: mexc.client, cfg: CFG, log: (m) => event('warn', 'MEXC', m) }));

// MEXC says no (HTTP 403/451, or a region / IP / permission error): not a glitch, so no retries. Alert ONCE (state.accessLost), then only warnings until it clears.
// Nothing here touches positions: their stop/target live on MEXC, and the next run re-checks everything. See DEPLOY.md "If MEXC access is lost".
function noteBlocked(run, state, e, where) {
  if (!mexc.isBlocked(e)) return false;
  const msg = `${where}: ${e.message}`;
  run.errors.push(msg);
  if (!state.accessLost) { state.accessLost = { since: new Date().toISOString(), msg }; event('error', 'MEXC', `ERROR MEXC ACCESS BLOCKED (no retries; open positions stay protected by their stop/target on MEXC; bot will try again next 4h run): ${msg}`); }
  else event('warn', 'MEXC', `WARNING MEXC access still blocked since ${state.accessLost.since}: ${msg}`);
  return true;
}

async function runOnce(opt = {}) {
  const changed = reloadConfig();
  if (changed.length) event('info', 'BOT', `settings reloaded: ${changed.join(', ')}`);
  const live = CFG.mode === 'live';
  if (CFG.riskPctClamped) event('warn', 'BOT', `WARNING bot-config.json riskPct ${CFG.riskPctClamped} is above the ${config.MAX_RISK_PCT} cap: using ${config.MAX_RISK_PCT}`);
  const t0 = Date.now(), run = { ts: new Date().toISOString(), mode: live ? 'live' : 'paper', coins: {}, warnings: [], errors: [], stale: [] };
  const state = loadState();
  // coins removed in Settings while a trade is still open keep being managed (exits only) until that trade is closed
  const managedOnly = Object.keys(state.coins || {}).filter((c) => !CFG.coins.includes(c) && (state.coins[c].pos || state.coins[c].pending));
  const runCoins = [...CFG.coins, ...managedOnly];
  const finishRun = () => {
    run.balance = state.balance;
    run.durationMs = Date.now() - t0; lastRun = run;
    state.lastRun = { ts: run.ts, durationMs: run.durationMs, errors: run.errors.length, warnings: run.warnings.length };
    saveState(state);
    appendJsonl('runs.jsonl', run);
    log(`run finished in ${run.durationMs} ms · ${run.errors.length} error(s) · ${run.warnings.length} warning(s)`);
    heartbeat(!run.errors.length && !run.stale.length);
  };
  const fail = (msg) => { run.errors.push(msg); event('error', 'BOT', msg); finishRun(); };

  if (live && !liveAllowed()) return fail('bot-config.json says LIVE but live trading is not enabled on this machine: start the bot with --allow-live or LUCIDIO_ALLOW_LIVE=1 (systemd drop-in). No trading this run');
  if (state.mode && state.mode !== run.mode) return fail(`state/ belongs to ${state.mode.toUpperCase()} mode but bot-config.json says ${run.mode}: rename the state folder (e.g. to state-${state.mode}) to start ${run.mode} with a clean record`);
  state.mode = run.mode;
  if (state.balance == null) state.balance = CFG.startBalance;
  if (state.totalR == null) { state.totalR = Object.values(state.coins || {}).reduce((s, c) => s + (c.realizedR || 0), 0); state.peakR = Math.max(0, state.totalR); }

  try { // clock check: wake-up time, the 15-min entry window and every signed request depend on the VPS clock
    const { data, ms } = await mexc.serverTime();
    run.clockDriftMs = Math.round(Date.now() - ms / 2 - data); run.pingMs = ms;
    if (Math.abs(run.clockDriftMs) > 5000) { run.warnings.push(`VPS clock is ${(run.clockDriftMs / 1000).toFixed(1)}s off MEXC time`); event('warn', 'BOT', run.warnings[run.warnings.length - 1]); }
  } catch (e) { if (noteBlocked(run, state, e, 'clock check')) return finishRun(); run.warnings.push('clock check failed: ' + e.message); }

  let exec = paper;
  if (live) {
    if (!mexc.hasKeys()) return fail('LIVE mode needs mexc-keys.json (trade permission) — no trading this run');
    try {
      exec = getLive();
      await exec.beginRun(runCoins);
      const t = Date.now(), a = await mexc.client.asset('USDT');
      run.account = { ...a, equity: +a.equity, available: +a.availableBalance, unrealized: +a.unrealized, ms: Date.now() - t };
      state.balance = +a.equity;                             // live sizing uses the real futures equity
    } catch (e) { if (noteBlocked(run, state, e, 'live setup')) return finishRun(); return fail('live setup failed (MEXC account / contract info): ' + e.message + ' — no trading this run'); }
  }

  for (const coin of runCoins) {
    const c = (run.coins[coin] = {});
    try {
      const f = await fetchCandles(coin, opt.fetch);
      if (state.accessLost) { delete state.accessLost; event('info', 'MEXC', 'MEXC access restored'); }
      if (f.stale) { // C4: the new candle never appeared: no decision is possible this run. Alert (first time = error -> Telegram, retries = warning) and let loop() retry.
        const msg = `${coin}: MEXC has not published the new 4h candle ${iso(f.expected)} ${f.waitedSec}s after the close (newest candle ${iso(f.B[f.B.length - 1].time)}) — no decision made, retrying`;
        c.stale = true; run.stale.push(coin); run.warnings.push(msg); if (!opt.retry) run.errors.push(msg); event(opt.retry ? 'warn' : 'error', coin, (opt.retry ? 'WARNING ' : 'ERROR ') + msg);
        continue;
      }
      const B = f.B, n = B.length, now = nowSec();
      Object.assign(c, { fetchMs: f.ms, attempts: f.attempts, polls: f.polls, candles: n });
      if (f.attempts > 1) run.warnings.push(`${coin}: candles needed ${f.attempts} attempts`);
      let gaps = 0; for (let i = 1; i < n; i++) if (B[i].time - B[i - 1].time !== IV) gaps++;
      c.gaps = gaps; if (gaps) { run.warnings.push(`${coin}: ${gaps} gap(s) in MEXC candles`); event('warn', coin, `${gaps} gap(s) in MEXC 4h candles`); }
      if (B[n - 1].time + IV <= now) { run.warnings.push(`${coin}: no forming candle`); event('warn', coin, 'newest MEXC candle is already closed — no forming candle to take the next open from; waiting'); }
      c.lastClosed = n >= 2 ? B[n - 2].time : null;
      c.lagSec = c.lastClosed ? Math.round(now - (c.lastClosed + IV)) : null; // seconds between that candle's close and this check
      const st = state.coins[coin] = state.coins[coin] || { lastTime: null, pos: null, realizedR: 0, n: 0, trades: [] };
      let blocked = managedOnly.includes(coin) ? `${coin} was removed in Settings: managing the open trade only, no new entries` : null;
      if (live) {
        const r = await exec.reconcile(coin, st);
        r.ev.forEach((e) => event(typeOf(e), coin, e));
        if (r.blocked) blocked = r.blocked;
        if (blocked) { run.warnings.push(blocked); event('warn', coin, blocked); }
        saveState(state);
      }
      const p0 = Date.now();
      const ev = await processCoin(coin, B, st, exec, { acct: state, now: nowSec(), nowPx: B[n - 1].close, blocked, save: () => saveState(state) });
      c.processMs = Date.now() - p0;
      c.events = ev.length;
      ev.forEach((e) => { const ty = typeOf(e); if (ty === 'error') run.errors.push(e); event(ty, coin, e); });
      saveState(state);
      log(`${coin}: checked through candle ${iso(st.lastTime)} · ${st.pos ? (st.pos.dir === 1 ? 'LONG' : 'SHORT') + ' open since ' + iso(st.pos.t0) : 'flat'} · realized ${st.realizedR.toFixed(2)}R in ${st.n} trades · fetch ${f.ms} ms`);
    } catch (e) { c.error = e.message; if (noteBlocked(run, state, e, coin)) break; run.errors.push(`${coin}: ${e.message}`); event('error', coin, e.message); }
  }
  if (!live && mexc.hasKeys()) { // capital snapshot from the real MEXC futures wallet (read only)
    try { const { data, ms } = await mexc.account(); run.account = { ...data, ms }; }
    catch (e) { run.errors.push('MEXC account: ' + e.message); event('error', 'MEXC', 'account read failed: ' + e.message); }
  }
  await syncLedger(run, state);
  finishRun();
}

// Pushes the real MEXC equity to the Ledger (only when bot-config.json has "ledgerSync": true). A ledger problem never touches trading.
async function syncLedger(run, state) {
  try {
    // snapshot first: open positions as the bot tracks them (in LIVE they were just reconciled with MEXC), open orders = unfinished entries
    const coins = Object.values(state.coins || {});
    const snap = await ledgerSync.postSnapshot({ enabled: CFG.ledgerSync, equity: run.account && run.account.equity, unrealized: run.account ? run.account.unrealized : null,
      openPositions: run.account ? coins.filter((c) => c.pos).length : undefined, openOrders: run.account ? coins.filter((c) => c.pending).length : undefined });
    run.ledgerSnapshot = snap;
    if (snap.status === 'error') event('error', 'LEDGER', `snapshot not sent: ${snap.detail}`);
    const r = await ledgerSync.postEquity({ enabled: CFG.ledgerSync, equity: run.account && run.account.equity, last: state.ledgerPost || null });
    run.ledger = r;
    if (r.status === 'posted') { state.ledgerPost = { ts: Date.now(), equity: r.equity }; event('info', 'LEDGER', `MEXC balance ${r.equity} USDT sent to the ledger (unit price ${(+r.unitPrice).toFixed(4)})`); }
    else if (r.status === 'skipped' || r.status === 'error') event(r.status === 'error' ? 'error' : 'warn', 'LEDGER', `balance ${r.equity} not posted: ${r.detail}`);
    else if (r.status === 'noequity') event('warn', 'LEDGER', r.detail);
  } catch (e) { run.ledger = { status: 'error', detail: e.message }; event('error', 'LEDGER', e.message); }
}

function status() {
  const s = loadState();
  const bal = s.balance ?? CFG.startBalance;
  console.log(`Lucid'io ${CFG.mode.toUpperCase()} bot · coins ${CFG.coins.join(', ')} · ${CFG.riskPct > 0 ? `risk ${CFG.riskPct * 100}% of balance/trade (next trade ${usd(riskFor({ balance: bal }))})` : `risk $${CFG.riskUsd}/trade`} · started ${s.startedAt}`);
  console.log(`balance ${usd(bal)} (start ${usd(CFG.startBalance)}, ${bal >= CFG.startBalance ? '+' : ''}${((bal / CFG.startBalance - 1) * 100).toFixed(1)}%) · ${((s.peakR || 0) - (s.totalR || 0)).toFixed(1)}R below best point (halt at ${-CFG.haltAtR}R)`);
  for (const [coin, st] of Object.entries(s.coins)) {
    console.log(`\n${coin}: realized ${st.realizedR.toFixed(2)}R (${usd((st.trades || []).reduce((a, t) => a + t.usd, 0))}) in ${st.n} trades · last candle ${st.lastTime ? iso(st.lastTime) : '—'}`);
    if (st.pending) console.log(`  UNFINISHED ORDER ${st.pending.oid} (resolved on the next run)`);
    if (st.pos) console.log(`  OPEN ${st.pos.dir === 1 ? 'LONG' : 'SHORT'} entry ${st.pos.entry.toPrecision(6)} stop ${st.pos.stop.toPrecision(6)} tp ${st.pos.tp.toPrecision(6)} since ${iso(st.pos.t0)}${st.pos.vol ? ` · ${st.pos.vol} contracts · MEXC position ${st.pos.positionId}` : ''}`);
    for (const t of (st.trades || []).slice(-5)) console.log(`  ${iso(t.t)} ${t.dir === 1 ? 'L' : 'S'} ${t.why.padEnd(6)} ${t.R >= 0 ? '+' : ''}${t.R.toFixed(2)}R`);
  }
}

// C4: a coin whose new candle was missing is retried every 30 s until the entry window (maxEntryDelaySec after the close) is over; the first stale run already alerted.
async function retryStale() {
  const closeT = Math.floor(nowSec() / IV) * IV;
  for (let tries = 0; lastRun && lastRun.stale.length && nowSec() - closeT < CFG.maxEntryDelaySec; tries++) {
    await sleep(30000);
    try { await runOnce({ retry: true }); } catch (e) { event('error', 'BOT', 'retry run crashed: ' + (e.stack || e.message)); break; }
  }
  if (lastRun && lastRun.stale.length) event('error', 'BOT', `ERROR gave up: MEXC candle still missing for ${lastRun.stale.join(', ')} ${Math.round(nowSec() - closeT)}s after the close — signals on that candle are lost (entry window over)`);
}

async function loop() {
  const PID = path.join(STATE_DIR, 'bot.pid');
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(PID, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), mode: 'loop' }));
  const cleanup = () => { try { if (JSON.parse(fs.readFileSync(PID, 'utf8')).pid === process.pid) fs.unlinkSync(PID); } catch {} };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { event('info', 'BOT', 'stopped (Ctrl+C)'); process.exit(0); });
  process.on('SIGTERM', () => { event('info', 'BOT', 'stopped (service stop)'); process.exit(0); });
  event('start', 'BOT', `started loop · ${CFG.mode.toUpperCase()} · pid ${process.pid} · coins ${CFG.coins.join(', ')} · ${CFG.riskPct > 0 ? `risk ${CFG.riskPct * 100}% of balance (max $${CFG.maxRiskUsd})` : `risk $${CFG.riskUsd}`}`);
  for (;;) {
    lastRun = null;
    try { await runOnce(); } catch (e) { event('error', 'BOT', 'run crashed: ' + (e.stack || e.message)); } // never let one bad run kill the loop
    await retryStale();
    const wake = (Math.floor(nowSec() / IV) + 1) * IV + CFG.wakeDelaySec;
    try { const s = loadState(); s.nextWakeAt = new Date(wake * 1000).toISOString(); saveState(s); } catch {}
    log(`sleeping until ${iso(wake)} (candle close + ${CFG.wakeDelaySec}s, MEXC time)`);
    while (nowSec() < wake) await sleep(Math.min(60000, (wake - nowSec()) * 1000)); // short naps: robust to clock fixes / VM pauses
  }
}

// ---------------- check: read-only pre-flight (run on the VPS before going live, and any time something looks off) ----------------
async function check() {
  let bad = 0, warn = 0;
  const hint = (e) => (mexc.isBlocked(e) ? ' — HTTP 403/451 or a region/IP/permission block: run deploy/mexc-reachability.sh' : '');
  const row = (lvl, what, msg) => { if (lvl === 'BAD') bad++; if (lvl === 'WARN') warn++; console.log(`${lvl.padEnd(4)}  ${what.padEnd(18)} ${msg}`); };
  console.log(`Lucid'io check · mode ${CFG.mode.toUpperCase()} · coins ${CFG.coins.join(', ')} · ${mexc.BASE}\n`);
  try {
    const { data, ms } = await mexc.serverTime(), drift = Math.round(Date.now() - ms / 2 - data);
    row(Math.abs(drift) > 2000 ? 'BAD' : Math.abs(drift) > 500 ? 'WARN' : 'OK', 'clock', `VPS ${drift >= 0 ? '+' : ''}${drift} ms vs MEXC · ping ${ms} ms (signed requests fail beyond ±10 s; keep chrony/NTP on)`);
  } catch (e) { row('BAD', mexc.isBlocked(e) ? 'MEXC BLOCKED' : 'MEXC reachable', e.message + hint(e)); }
  const st = loadState(), bal = CFG.mode === 'live' ? null : st.balance ?? CFG.startBalance;
  let equity = bal;
  if (mexc.hasKeys()) {
    try { const a = await mexc.client.asset('USDT'); equity = CFG.mode === 'live' ? +a.equity : bal; row('OK', 'API key', `works · futures equity $${(+a.equity).toFixed(2)} · available $${(+a.availableBalance).toFixed(2)}`); }
    catch (e) { row('BAD', mexc.isBlocked(e) ? 'MEXC BLOCKED' : 'API key', `${e.message}${hint(e)}${e.code === 406 ? ' — add this VPS IP to the key' : e.code === 402 ? ' — key expired (unbound keys last 90 days)' : ''}`); }
    try { const m = await mexc.client.positionMode(); row(+m === 1 ? 'OK' : 'BAD', 'position mode', +m === 1 ? 'hedge (what the bot expects)' : `one-way (${m}) — switch MEXC futures to HEDGE mode`); } catch (e) { row('WARN', 'position mode', e.message); }
    try {
      const p = await mexc.client.openPositions(), s = await mexc.client.openTpSl();
      row(p && p.length ? 'WARN' : 'OK', 'open positions', p && p.length ? p.map((x) => `${x.symbol} ${x.positionType === 1 ? 'LONG' : 'SHORT'} ${x.holdVol} @ ${x.holdAvgPrice}`).join(', ') + ' — the bot will not trade a coin with a position it did not open' : 'none');
      row('OK', 'open TP/SL', `${(s || []).length} order(s)`);
    } catch (e) { row('BAD', 'positions', e.message); }
  } else row(CFG.mode === 'live' ? 'BAD' : 'WARN', 'API key', 'none (mexc-keys.json) — fine for paper, required for live');
  for (const coin of CFG.coins) {
    try {
      const spec = await mexc.client.contract(`${coin}_USDT`);
      row(+spec.state === 0 && spec.apiAllowed !== false ? 'OK' : 'BAD', `${coin} contract`, `state ${spec.state} · API trading ${spec.apiAllowed ? 'allowed' : 'NOT allowed'} · 1 contract = ${spec.contractSize} ${coin} · min ${spec.minVol} · tick ${spec.priceUnit} · fees taker ${(spec.takerFeeRate * 100).toFixed(3)}% maker ${(spec.makerFeeRate * 100).toFixed(3)}% · max ${spec.maxLeverage}x`);
      const f = await fetchMexc(coin), B = f.B, n = B.length, now = nowSec();
      let gaps = 0; for (let i = 1; i < n; i++) if (B[i].time - B[i - 1].time !== IV) gaps++;
      const forming = B[n - 1].time + IV > now;
      row(!forming || gaps ? 'BAD' : n < 450 ? 'WARN' : 'OK', `${coin} candles`, `${n} × 4h in ${f.ms} ms · ${gaps} gaps · forming candle ${forming ? 'present' : 'MISSING'} · last close ${iso(B[n - 2].time + IV)}`);
      const closes = B.slice(0, n - 1).map((b) => b.close), mid = closes.slice(-20).reduce((x, y) => x + y, 0) / 20, px = B[n - 1].close;
      const risk = riskFor({ balance: equity ?? CFG.startBalance }), { sizeOrder, leverageFor } = require('./live.js'), sz = sizeOrder({ riskUsd: risk, px, stop: mid, spec, maxRiskMult: CFG.maxRiskMult });
      const lev = leverageFor(px, mid, spec, CFG.maxLeverage);
      row(sz ? 'OK' : 'WARN', `${coin} sizing`, `if a signal fired now: stop ${(Math.abs(px - mid) / px * 100).toFixed(2)}% away · target risk ${usd(risk)} -> ${sz ? `${sz.vol} contracts, real risk ${usd(sz.riskUsd)}, ${lev}x isolated, margin ≈ ${usd(sz.vol * spec.contractSize * px / lev)}` : 'NOT tradable (1 contract risks too much)'}`);
    } catch (e) { row('BAD', mexc.isBlocked(e) ? 'MEXC BLOCKED' : coin, e.message + hint(e)); }
  }
  row(fs.existsSync(path.join(DIR, 'STOP')) ? 'WARN' : 'OK', 'kill switch', fs.existsSync(path.join(DIR, 'STOP')) ? 'STOP file present: no new entries' : 'off');
  if (st.mode && st.mode !== CFG.mode) row('BAD', 'state', `state/ was written in ${st.mode} mode; rename it before running ${CFG.mode}`);
  row(CFG.riskPctClamped ? 'WARN' : 'OK', 'risk', CFG.riskPct > 0 ? `${CFG.riskPct * 100}% of balance per trade (hard cap ${config.MAX_RISK_PCT * 100}%), max $${CFG.maxRiskUsd}${CFG.riskPctClamped ? ` — bot-config.json asks for ${CFG.riskPctClamped}, clamped` : ''}` : `$${CFG.riskUsd} per trade`);
  row(CFG.mode === 'live' && !liveAllowed() ? 'WARN' : 'OK', 'live gate', CFG.mode !== 'live' ? 'mode is paper: no orders can be sent' : liveAllowed() ? 'LIVE enabled (--allow-live / LUCIDIO_ALLOW_LIVE=1): real orders will be sent' : 'bot-config.json says live but --allow-live / LUCIDIO_ALLOW_LIVE=1 is missing: the bot will refuse to trade');
  console.log(`\n${bad ? `${bad} problem(s)` : 'no problems'}${warn ? `, ${warn} warning(s)` : ''}.`);
  process.exitCode = bad ? 1 : 0;
}

// ---------------- test-trade: prove the trading API works BEFORE trusting it with the strategy (costs a few cents) ----------------
async function testTrade(coin) {
  if (!process.argv.includes('--yes')) return console.log(`This places a REAL order on MEXC: 1 minimum contract of ${coin}_USDT LONG with a stop 3% below and a target 6% above,\nchecks both are on MEXC, then closes it. Cost: fees + spread (cents). Run again with --yes to do it.`);
  if (!mexc.hasKeys()) return console.log('needs mexc-keys.json with trade permission');
  if (!liveAllowed()) return console.log('REFUSED: this sends real orders. Add --allow-live (or set LUCIDIO_ALLOW_LIVE=1) as well as --yes.');
  const api = mexc.client, ex = getLive(), symbol = `${coin}_USDT`;
  await api.syncTime(); await ex.beginRun([coin]);
  const spec = ex.spec(coin), px = +(await api.ticker(symbol)).lastPrice, { roundTo } = require('./live.js');
  const stop = roundTo(px * 0.97, +spec.priceUnit), tp = roundTo(px * 1.06, +spec.priceUnit), vol = +spec.minVol, oid = `bt${coin}${Math.floor(nowSec())}`;
  console.log(`1) market BUY ${vol} contract(s) ${symbol} @ ~${px}, stop ${stop}, target ${tp}, 5x isolated, id ${oid}`);
  const t = Date.now();
  try { await api.createOrder({ symbol, price: px, vol, leverage: 5, side: 1, type: 5, openType: 1, externalOid: oid, stopLossPrice: stop, takeProfitPrice: tp, lossTrend: 1, profitTrend: 1 }); }
  catch (e) { console.log(`   order/create FAILED: ${e.message}${e.code === 200006 || e.code === 300000 ? ' (KYC needed)' : e.code === 702 || e.code === 511 ? ' (key lacks Order Placing permission)' : ''}`); }
  const o = await api.orderByExternalOid(symbol, oid).catch((e) => ({ err: e.message }));
  if (!o || o.err || +o.state !== 3) return console.log(`   not filled: ${o && o.err ? o.err : JSON.stringify(o)} — the trading API does NOT work for this account yet. Do not go live.`);
  console.log(`   filled ${o.dealVol} @ ${o.dealAvgPrice} in ${Date.now() - t} ms · position ${o.positionId} · fee ${o.takerFee}`);
  const pos = { coin, dir: 1, entry: +o.dealAvgPrice, stop, tp, vol: +o.dealVol, qty: +o.dealVol * spec.contractSize, positionId: o.positionId, t0: Math.floor(nowSec()), openedAt: Date.now(), live: true };
  pos.riskUsd = pos.qty * Math.abs(pos.entry - stop);
  const list = ((await api.openTpSl(symbol)) || []).filter((s) => String(s.positionId) === String(o.positionId));
  console.log(`2) stop/target attached with the order: ${list.length ? list.map((s) => `SL ${s.stopLossPrice} TP ${s.takeProfitPrice} (state ${s.state})`).join(', ') : 'NOT visible yet'}`);
  const ok = await ex.ensureProtection(pos);
  console.log(`   protection verified: ${ok ? 'YES' : 'NO — stop/target could not be placed via the API'}`);
  const x = await ex.close(pos, 'test');
  console.log(`3) closed: ${x ? `exit ${x.px} · realised ${usd(x.usd)}${x.fees != null ? ` · fees ${x.fees}` : ''}` : 'CLOSE FAILED — close it in the MEXC app now'}`);
  console.log(`\n${ok && x ? 'PASS: entry, stop/target and close all work through the API.' : 'FAIL: see above. Do not go live until this passes.'}`);
}

// parity test: whole history through processCoin with the paper executor, compared with backtest() on the same cost model (no funding)
async function replay(coins) {
  const { backtest } = require('./lucidio-core.js');
  for (const coin of coins) {
    const B = JSON.parse(fs.readFileSync(path.join(DIR, 'data', coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
    const st = { lastTime: 0, pos: null, realizedR: 0, n: 0, trades: [] }, acct = { balance: CFG.startBalance };
    await processCoin(coin, B, st, paper, { replay: true, acct });
    const ref = backtest(B, {}, null).trades;
    let diff = 0;
    for (let k = 0; k < Math.max(ref.length, st.trades.length); k++) {
      const a = ref[k], b = st.trades[k];
      if (!a || !b || a.t !== b.t || Math.abs(a.R - b.R) > 1e-9) { if (diff++ < 3) console.log(`  mismatch at trade ${k}:`, a && { t: a.t, R: a.R }, b && { t: b.t, R: b.R }); }
    }
    console.log(`${coin}: bot ${st.trades.length} trades ${st.realizedR.toFixed(2)}R · backtest ${ref.length} trades ${ref.reduce((x, t) => x + t.R, 0).toFixed(2)}R · ${diff ? diff + ' MISMATCHES' : 'IDENTICAL trade-for-trade'} · balance ${usd(CFG.startBalance)} -> ${usd(acct.balance)} on this coin alone`);
    if (diff) process.exitCode = 1;
  }
}

module.exports = { processCoin, paper, CFG, riskFor, reloadConfig, fetchCandles, runOnce, liveAllowed, heartbeat, event };
// one sync right now: reads the MEXC futures equity and posts it. --dry shows what would be sent and sends nothing.
async function ledgerNow(dry) {
  await mexc.client.syncTime();
  const eq = (await mexc.account()).data.equity;
  const r = await ledgerSync.postEquity({ enabled: true, equity: eq, dry });
  console.log(`MEXC futures equity ${eq} USDT -> ledger: ${r.status}${r.detail ? ' — ' + r.detail : ''}`);
  if (r.status === 'posted') { const st = loadState(); st.ledgerPost = { ts: Date.now(), equity: r.equity }; saveState(st); console.log('unit price now ' + (+r.unitPrice).toFixed(4)); }
}

const cmd = require.main === module ? process.argv[2] : 'lib';
if (cmd === 'lib') {}
else if (cmd === 'once') runOnce();
else if (cmd === 'loop') loop();
else if (cmd === 'status') status();
else if (cmd === 'check') check();
else if (cmd === 'ledger-sync') ledgerNow(process.argv.includes('--dry')).catch((e) => { console.log('ledger-sync failed: ' + e.message); process.exitCode = 1; });
else if (cmd === 'test-trade') testTrade((process.argv[3] || 'SOL').toUpperCase());
else if (cmd === 'replay') replay((process.argv[3] || CFG.coins.join(',')).split(','));
else console.log('usage: node lucidio.js check | ledger-sync [--dry] | test-trade SOL --yes --allow-live | once | loop | status | replay SOL,ZEC   (live trading also needs --allow-live or LUCIDIO_ALLOW_LIVE=1)');
