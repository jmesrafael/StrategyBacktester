// bbot.js — BBOT — BB Breakout auto-trader. PAPER mode only for now (no orders are ever sent to an exchange).
//
//   node bbot.js once              fetch closed 4h candles from MEXC, process anything new, save state          (run every 4h)
//   node bbot.js loop              same, but stays running and wakes up 30s after every 4h candle close
//   node bbot.js status            show open positions + results so far
//   node bbot.js replay SOL,ZEC    parity test: push the whole history in data/ through this bot and compare with backtest.js
//
// How it decides (identical to bb-breakout.js — the entry rule is the shared signalFrom()):
//   per closed candle: (1) stop/target hit inside it? (2) 48 candles old -> exit at next open (3) flat + signal -> enter at next open.
// Execution is behind an "executor" with 3 methods, so going live later = writing one more executor, the decision logic is untouched:
//   enter(coin, {dir, stop, tp, refOpen}) -> position | null     checkExit(pos, candle) -> {px, why, R} | null     timeExit(pos, refOpen) -> {px, why, R}
'use strict';
const fs = require('fs'), path = require('path');
const { signalFrom, DEFAULTS } = require('./bb-breakout.js');

const DIR = __dirname, STATE_DIR = path.join(DIR, 'state'), STATE_FILE = path.join(STATE_DIR, 'state.json');
// Sizing: riskPct > 0 -> risk riskPct of the account balance on every trade (compounds after each closed trade, both coins share one balance);
//         riskPct = 0 -> fixed riskUsd per trade.
const CFG = { coins: ['SOL', 'ZEC'], riskUsd: 1, riskPct: 0, startBalance: 100, haltAtR: -39, maxEntryDelaySec: 900, ...(fs.existsSync(path.join(DIR, 'bot-config.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'bot-config.json'), 'utf8')) : {}) };
const S = { ...DEFAULTS }, COST = DEFAULTS.cost, IV = 14400;
const riskFor = (acct) => (CFG.riskPct > 0 ? acct.balance * CFG.riskPct : CFG.riskUsd);
const usd = (v) => (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
const iso = (t) => new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
const log = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(' ')}`; console.log(line); try { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.appendFileSync(path.join(STATE_DIR, 'bot.log'), line + '\n'); } catch {} };

// ---------------- paper executor (same fill/exit/fee rules as bb-breakout.js, minus funding) ----------------
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
  timeExit(pos, refOpen) { return this._close(pos, refOpen * (1 - pos.dir * COST.slip), COST.timeFee, 'time'); },
  _close(pos, px, fee, why) { return { px, why, R: (pos.dir * (px - pos.entry) / pos.entry - COST.entryFee - fee) / pos.dist }; },
};

// ---------------- the decision logic (pure state machine; used live AND by replay) ----------------
// B = candles oldest→newest; B[n-1] may be the still-forming one (it only supplies the open price for fills).
// st = per-coin state { lastTime, pos, realizedR, n }. opt.acct = the shared account { balance } (sizing + P&L).
// Returns events for logging. Processes closed candles with time > st.lastTime.
function processCoin(coin, B, st, exec, opt = {}) {
  const acct = opt.acct || { balance: CFG.startBalance };
  const n = B.length, ev = [];
  const closes = B.map((b) => b.close), atr = new Array(n).fill(null);
  let a = null, trPrev;
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
    if (st.pos) {
      const x = exec.checkExit(st.pos, c);
      if (x) finish(x, c.time + IV);                        // stop / target: flat again, a new signal on this same candle is allowed
      else {
        if (S.maxBars > 0 && (c.time - st.pos.t0) / IV >= S.maxBars) finish(exec.timeExit(st.pos, next.open), next.time);
        st.lastTime = c.time; continue;                     // still in the trade (or a time exit, which uses up this candle)
      }
    }
    if (!st.pos && i >= S.warmup) {
      const sig = signalFrom(closes.slice(Math.max(0, i - 399), i + 1), atr[i], S);
      if (sig) {
        const stale = !opt.replay && Date.now() / 1000 - next.time > CFG.maxEntryDelaySec;
        if (stale) ev.push(`SIGNAL ${coin} ${sig.dir === 1 ? 'LONG' : 'SHORT'} on candle ${iso(c.time)} SKIPPED: next candle opened ${Math.round((Date.now() / 1000 - next.time) / 60)} min ago (too late to enter at its open)`);
        else if (st.realizedR <= CFG.haltAtR) ev.push(`SIGNAL ${coin} ${sig.dir === 1 ? 'LONG' : 'SHORT'} skipped: HALTED (realized ${st.realizedR.toFixed(1)}R <= ${CFG.haltAtR}R)`);
        else if (!opt.replay && fs.existsSync(path.join(DIR, 'STOP'))) ev.push(`SIGNAL ${coin} skipped: STOP file present`);
        else {
          const p = exec.enter(coin, { ...sig, refOpen: next.open, t0: next.time, riskUsd: riskFor(acct) });
          if (p) { st.pos = p; ev.push(`ENTER ${coin} ${p.dir === 1 ? 'LONG' : 'SHORT'} @ ${p.entry.toPrecision(6)}  stop ${p.stop.toPrecision(6)}  tp ${p.tp.toPrecision(6)}  qty ${p.qty.toPrecision(4)} (risk ${usd(p.riskUsd)} of balance ${usd(acct.balance)})`); }
        }
      }
    }
    st.lastTime = c.time;
  }
  return ev;

  function finish(x, tExit) {
    const p = st.pos; st.pos = null; st.realizedR += x.R; st.n++;
    const pnl = x.R * (p.riskUsd ?? CFG.riskUsd);
    acct.balance += pnl;
    const rec = { coin: p.coin, dir: p.dir, t: p.t0, tExit, entry: p.entry, exit: x.px, why: x.why, R: x.R, usd: pnl, balance: acct.balance };
    (st.trades = st.trades || []).push(rec);
    ev.push(`EXIT  ${p.coin} ${p.dir === 1 ? 'LONG' : 'SHORT'} ${x.why}  ${x.R >= 0 ? '+' : ''}${x.R.toFixed(2)}R  (${usd(pnl)})  total ${st.realizedR.toFixed(2)}R  balance ${usd(acct.balance)}`);
  }
}

// ---------------- data: MEXC USDT-M perpetual 4h klines (the venue we trade) ----------------
async function fetchMexc(coin, bars = 500) {
  const end = Math.floor(Date.now() / 1000), start = end - bars * IV;
  const r = await fetch(`https://contract.mexc.com/api/v1/contract/kline/${coin}_USDT?interval=Hour4&start=${start}&end=${end}`);
  const j = await r.json();
  if (!j || !j.success || !j.data || !j.data.time) throw new Error(`MEXC ${coin}: ${JSON.stringify(j).slice(0, 150)}`);
  const d = j.data;
  return d.time.map((t, i) => ({ time: t, open: +d.open[i], high: +d.high[i], low: +d.low[i], close: +d.close[i] }));
}

// ---------------- state ----------------
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { coins: {}, startedAt: new Date().toISOString() }; } };
const saveState = (s) => { fs.mkdirSync(STATE_DIR, { recursive: true }); const tmp = STATE_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(s, null, 1)); fs.renameSync(tmp, STATE_FILE); };

async function runOnce() {
  const state = loadState();
  if (state.balance == null) state.balance = CFG.startBalance;
  for (const coin of CFG.coins) {
    try {
      const B = await fetchMexc(coin);
      const last = B[B.length - 1];
      if (last.time + IV <= Date.now() / 1000) log(coin, 'WARNING: newest MEXC candle is already closed — no forming candle to take the next open from; waiting');
      const st = state.coins[coin] = state.coins[coin] || { lastTime: null, pos: null, realizedR: 0, n: 0, trades: [] };
      const ev = processCoin(coin, B, st, paper, { acct: state });
      ev.forEach((e) => log(e));
      log(`${coin}: checked through candle ${iso(st.lastTime)} · ${st.pos ? (st.pos.dir === 1 ? 'LONG' : 'SHORT') + ' open since ' + iso(st.pos.t0) : 'flat'} · realized ${st.realizedR.toFixed(2)}R in ${st.n} trades`);
    } catch (e) { log(coin, 'ERROR', e.message); }
  }
  saveState(state);
}

function status() {
  const s = loadState();
  const bal = s.balance ?? CFG.startBalance;
  console.log(`BBOT (BB Breakout) PAPER bot · coins ${CFG.coins.join(', ')} · ${CFG.riskPct > 0 ? `risk ${CFG.riskPct * 100}% of balance/trade (next trade ${usd(bal * CFG.riskPct)})` : `risk $${CFG.riskUsd}/trade`} · started ${s.startedAt}`);
  console.log(`balance ${usd(bal)} (start ${usd(CFG.startBalance)}, ${bal >= CFG.startBalance ? '+' : ''}${((bal / CFG.startBalance - 1) * 100).toFixed(1)}%)`);
  for (const [coin, st] of Object.entries(s.coins)) {
    console.log(`\n${coin}: realized ${st.realizedR.toFixed(2)}R (${usd((st.trades || []).reduce((a, t) => a + t.usd, 0))}) in ${st.n} trades · last candle ${st.lastTime ? iso(st.lastTime) : '—'}`);
    if (st.pos) console.log(`  OPEN ${st.pos.dir === 1 ? 'LONG' : 'SHORT'} entry ${st.pos.entry.toPrecision(6)} stop ${st.pos.stop.toPrecision(6)} tp ${st.pos.tp.toPrecision(6)} since ${iso(st.pos.t0)}`);
    for (const t of (st.trades || []).slice(-5)) console.log(`  ${iso(t.t)} ${t.dir === 1 ? 'L' : 'S'} ${t.why.padEnd(6)} ${t.R >= 0 ? '+' : ''}${t.R.toFixed(2)}R`);
  }
}

async function loop() {
  for (;;) {
    await runOnce();
    const now = Date.now() / 1000, wake = (Math.floor(now / IV) + 1) * IV + 30;
    log(`sleeping until ${iso(wake)} (candle close + 30s)`);
    await new Promise((r) => setTimeout(r, (wake - now) * 1000));
  }
}

// parity test: whole history through processCoin with the paper executor, compared with backtest() on the same cost model (no funding)
function replay(coins) {
  const { backtest } = require('./bb-breakout.js');
  for (const coin of coins) {
    const B = JSON.parse(fs.readFileSync(path.join(DIR, 'data', coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
    const st = { lastTime: 0, pos: null, realizedR: 0, n: 0, trades: [] }, acct = { balance: CFG.startBalance };
    processCoin(coin, B, st, paper, { replay: true, acct });
    const ref = backtest(B, {}, null).trades;
    let diff = 0;
    for (let k = 0; k < Math.max(ref.length, st.trades.length); k++) {
      const a = ref[k], b = st.trades[k];
      if (!a || !b || a.t !== b.t || Math.abs(a.R - b.R) > 1e-9) { if (diff++ < 3) console.log(`  mismatch at trade ${k}:`, a && { t: a.t, R: a.R }, b && { t: b.t, R: b.R }); }
    }
    console.log(`${coin}: bot ${st.trades.length} trades ${st.realizedR.toFixed(2)}R · backtest ${ref.length} trades ${ref.reduce((x, t) => x + t.R, 0).toFixed(2)}R · ${diff ? diff + ' MISMATCHES' : 'IDENTICAL trade-for-trade'} · balance ${usd(CFG.startBalance)} -> ${usd(acct.balance)} on this coin alone`);
  }
}

module.exports = { processCoin, paper, CFG };
const cmd = require.main === module ? process.argv[2] : 'lib';
if (cmd === 'lib') {}
else if (cmd === 'once') runOnce();
else if (cmd === 'loop') loop();
else if (cmd === 'status') status();
else if (cmd === 'replay') replay((process.argv[3] || CFG.coins.join(',')).split(','));
else console.log('usage: node bbot.js once | loop | status | replay SOL,ZEC');
