// live-parity.js — does the BB Breakout backtest behave exactly like a live bot would? Three checks on SOL / DOGE / ZEC 4h:
//  1. TRUNCATION (no future data): run the app's engine on the candles up to a random cut k only, and check every order decided up to k is
//     identical to the full-history run. Any look-ahead or repainting would make them differ.
//  2. BOT REPLAY: an independent, from-scratch bot that receives one CLOSED candle at a time, recomputes Bollinger / SMA / ATR only from what
//     it has seen, decides at the close, fills at the next open, and manages stop / target / time exit candle by candle. Compared trade by
//     trade with the app's backtest.
//  3. REAL BINANCE COSTS: the bot re-run with taker 0.05% on market orders and stops, maker 0.02% on the take-profit limit, 0.02% slippage
//     on market orders and stops, real funding, and stricter take-profit fills (price must trade THROUGH the target).
// usage: node live-parity.js  -> results-live-parity.md
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js');
const APP = path.resolve(__dirname, '../..'), COINS = ['SOL', 'DOGE', 'ZEC'], RISK = 5;
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat, window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {}; vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/bb-breakout-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const strat = ctx.window.__STRATEGIES.bbbreakout, prm = Object.fromEntries(Object.entries(strat.params).map(([k, d]) => [k, d.default]));
const CFGAPP = { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0.04, slippagePct: 0.02, startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } };
const appRun = (bars) => ctx.SM.simulate(strat, prm, bars, CFGAPP, null);
const FUND = Object.fromEntries(COINS.map((s) => [s, JSON.parse(fs.readFileSync(path.join(__dirname, 'datafund', s + '.json'), 'utf8'))]));
const out = []; const P = (s = '') => { out.push(s); console.log(s); };
let rng = 12345; const rand = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;

P('# BB Breakout — is the backtest the same as live execution?\n');
// ---------- 1. truncation ----------
P('## 1. Truncation test (no future data, no repainting)\n');
P('The app engine is run on the candles **up to a random cut only** (as if that candle had just closed and nothing after it exists), and every order it decided up to the cut is compared with the full-history run.\n');
P('| Coin | Cuts tested | Orders compared | Mismatches |'); P('|---|---|---|---|');
for (const sym of COINS) {
  const bars = L.bars(sym, 240), full = appRun(bars).signals;
  let cuts = 0, compared = 0, bad = 0;
  for (let r = 0; r < 150; r++) {
    const k = 250 + Math.floor(rand() * (bars.length - 260));
    const part = appRun(bars.slice(0, k + 1)).signals.filter((s) => s.reason !== 'Session end');
    const ref = full.filter((s) => s.index <= k);
    cuts++; compared += ref.length;
    const same = part.length === ref.length && part.every((s, j) => s.index === ref[j].index && s.type === ref[j].type && Math.abs(s.price - ref[j].price) < 1e-9);
    if (!same) bad++;
  }
  P(`| ${sym} | ${cuts} | ${compared.toLocaleString()} | **${bad}** |`);
}

// ---------- 2. independent bot replay ----------
// cost: { entryFee, stopFee, tpFee, timeFee, slip (market orders + stops), tpSlip, tpBuf (fraction beyond TP needed to fill), funding }
function bot(sym, cost) {
  const B = L.bars(sym, 240), fd = FUND[sym], trades = [];
  const closes = [], trs = []; let atr = null;
  let pos = null, pendEntry = null, pendClose = false;
  for (let i = 0; i < B.length; i++) {
    const c = B[i];
    // --- orders resting / pending while this candle trades ---
    if (pendEntry) { const d = pendEntry.dir, fill = c.open * (1 + d * cost.slip), dist = Math.abs(fill - pendEntry.stop) / fill;
      if (dist > 0 && (d === 1 ? pendEntry.stop < fill : pendEntry.stop > fill)) pos = { dir: d, entry: fill, stop: pendEntry.stop, tp: pendEntry.tp, i0: i, dist };
      pendEntry = null; }
    if (pendClose && pos) { exit(c.open * (1 - pos.dir * cost.slip), i, cost.timeFee, 'time'); }
    pendClose = false;
    if (pos) {
      const d = pos.dir;
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * cost.slip), i, cost.stopFee, 'stop');
      else if (d === 1 ? c.high >= pos.tp * (1 + cost.tpBuf) : c.low <= pos.tp * (1 - cost.tpBuf)) exit((d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open)) * (1 - d * cost.tpSlip), i, cost.tpFee, 'target');
    }
    // --- the candle has CLOSED: update indicators with it (and only it) ---
    closes.push(c.close);
    trs.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - B[i - 1].close), Math.abs(c.low - B[i - 1].close)));
    if (i === 13) atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14; else if (i > 13) atr = (atr * 13 + trs[i]) / 14;
    if (pos) { if (i - pos.i0 >= 48) pendClose = true; continue; }
    if (i < 202) continue;
    const w = closes.slice(-20), mid = w.reduce((a, b) => a + b, 0) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / 20);
    const up = mid + 2 * sd, lo = mid - 2 * sd, sma = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
    const dir = c.close > up ? 1 : c.close < lo ? -1 : 0;
    if (!dir || (dir === 1 ? c.close < sma : c.close > sma)) continue;
    const dist = Math.abs(c.close - mid); if (!(dist > 0) || dist < 0.3 * atr) continue;
    pendEntry = { dir, stop: mid, tp: c.close + dir * 3 * dist };
  }
  return trades;
  function exit(px, i, fee, why) {
    let fr = 0; if (cost.funding) { const te = B[pos.i0].time, tx = B[i].time + 7200; for (const [t, r] of fd) { if (t > tx) break; if (t > te) fr += r; } }
    const R = (pos.dir * (px - pos.entry) / pos.entry - cost.entryFee - fee - pos.dir * fr) / pos.dist;
    trades.push({ i0: pos.i0, i1: i, t: B[pos.i0].time, x: B[i].time, R, why }); pos = null;
  }
}
const APPCOST = { entryFee: 0.0004, stopFee: 0.0004, tpFee: 0.0004, timeFee: 0.0004, slip: 0.0002, tpSlip: 0.0002, tpBuf: 0, funding: false };
P('\n## 2. Bot replay vs the backtest (same costs as the backtest, no funding)\n');
P('An independent bot written from scratch: it gets one closed 4h candle at a time, recomputes the indicators only from candles it has already seen, decides at the close, and its orders fill on the next candle. Compared with the app\'s backtest trade by trade.\n');
P('| Coin | Backtest trades | Bot trades | Same entry candle | Same exit candle | Backtest R | Bot R |'); P('|---|---|---|---|---|---|---|');
for (const sym of COINS) {
  const bars = L.bars(sym, 240), res = appRun(bars);
  let bal = 10000; const a = res.trades.map((t) => { const R = t.usd / (bal * 0.01); bal += t.usd; return { ...t, R }; });
  const b = bot(sym, APPCOST), aBy = new Map(a.map((t) => [t.entryIndex, t]));
  const same = b.filter((t) => aBy.has(t.i0)), sameX = same.filter((t) => aBy.get(t.i0).exitIndex === t.i1);
  P(`| ${sym} | ${a.length} | ${b.length} | ${same.length} | ${sameX.length} | ${L.f2(L.sum(a.map((t) => t.R)))} | ${L.f2(L.sum(b.map((t) => t.R)))} |`);
  const amb = res.stats.ambiguousBars; P(`| ↳ ${sym} candles where stop AND target were both touched | ${amb} (counted as a stop — the worse case) | | | | | |`);
}

// ---------- 3. realistic Binance execution ----------
P('\n## 3. Re-run with Binance\'s real cost structure ($5 risk per trade, SOL + DOGE + ZEC, by year the trade closes)\n');
P('Market entry, stop and time exit = taker fee + 0.02% slippage; take-profit = resting limit (maker fee, no slippage). Funding = actual Binance history.\n');
const CASES = [
  ['Backtest assumption (0.04% + 0.02% every side, no funding)', APPCOST],
  ['Binance base tier: taker 0.05%, maker 0.02%, + funding', { entryFee: 0.0005, stopFee: 0.0005, tpFee: 0.0002, timeFee: 0.0005, slip: 0.0002, tpSlip: 0, tpBuf: 0, funding: true }],
  ['…and the target only fills if price trades 0.05% through it', { entryFee: 0.0005, stopFee: 0.0005, tpFee: 0.0002, timeFee: 0.0005, slip: 0.0002, tpSlip: 0, tpBuf: 0.0005, funding: true }],
  ['…and 0.05% slippage on market orders / stops (thin books)', { entryFee: 0.0005, stopFee: 0.0005, tpFee: 0.0002, timeFee: 0.0005, slip: 0.0005, tpSlip: 0, tpBuf: 0.0005, funding: true }],
];
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
P('| Case | ' + YEARS.join(' | ') + ' | Total | Years + |'); P('|---|' + YEARS.map(() => '---').join('|') + '|---|---|');
for (const [label, cost] of CASES) {
  const tr = COINS.flatMap((s) => bot(s, cost)), ys = YEARS.map((y) => L.sum(tr.filter((t) => t.x >= L.ts(y) && t.x < L.ts(y + 1)).map((t) => t.R)) * RISK);
  P(`| ${label} | ${ys.map((v) => (v >= 0 ? '+$' : '−$') + Math.abs(v).toFixed(0)).join(' | ')} | **${(L.sum(ys) >= 0 ? '+$' : '−$') + Math.abs(L.sum(ys)).toFixed(0)}** | ${ys.filter((v) => v > 0).length} of 7 |`);
}
fs.writeFileSync(__dirname + '/results-live-parity.md', out.join('\n') + '\n');
