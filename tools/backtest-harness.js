// tools/backtest-harness.js — standalone Node tester that mirrors js/strategy.js simulate()
// exactly, so a strategy file can be validated on REAL Bybit candles before wiring it in.
//
//   node tools/backtest-harness.js <strategyFile> <symbol> <interval> <bars> [paramJSON]
//
// Loads the strategy file in a `window` shim, fetches paginated klines from Bybit's public
// v5 API, runs the same warmup/SL-TP/open/close logic as the app, and prints the stats.
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

// ── indicator helpers identical to js/indicators.js (what makeIndicators exposes) ─────────
function ema(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1); let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) { let s = 0; for (let j = i - period + 1; j <= i; j++) s += values[j]; prev = s / period; }
    else prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let s = 0;
  for (let i = 0; i < values.length; i++) { s += values[i]; if (i >= period) s -= values[i - period]; if (i >= period - 1) out[i] = s / period; }
  return out;
}
function rsi(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) { const d = values[i] - values[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= period; l /= period;
  out[period] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    g = (g * (period - 1) + (d > 0 ? d : 0)) / period;
    l = (l * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
function makeIndicators(closes, candleSlice) {
  return { ema, sma, rsi, closes, candles: candleSlice };
}

// ── simulate() — copied faithfully from js/strategy.js ────────────────────────────────────
function computeStats(trades, startBalance, finalBalance, totalFees) {
  const n = trades.length;
  const netUsd = finalBalance - startBalance;
  const wins = trades.filter((t) => t.usd > 0);
  const losses = trades.filter((t) => t.usd < 0);
  const grossProfit = wins.reduce((a, t) => a + t.usd, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.usd, 0));
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? -grossLoss / losses.length : 0;
  const largestWin = n ? Math.max(...trades.map((t) => t.usd)) : 0;
  const largestLoss = n ? Math.min(...trades.map((t) => t.usd)) : 0;
  let cw = 0, cl = 0, maxCW = 0, maxCL = 0;
  trades.forEach((t) => { if (t.usd > 0) { cw++; cl = 0; maxCW = Math.max(maxCW, cw); } else if (t.usd < 0) { cl++; cw = 0; maxCL = Math.max(maxCL, cl); } });
  let eq = startBalance, peak = startBalance, maxDD = 0;
  trades.forEach((t) => { eq += t.usd; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, (peak - eq) / peak); });
  const rets = trades.map((t) => t.pct);
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const variance = rets.length ? rets.reduce((a, r) => a + (r - mean) * (r - mean), 0) / rets.length : 0;
  const sd = Math.sqrt(variance);
  const sharpe = sd ? mean / sd : 0;
  // R-multiple expectancy: each trade's pct / its own risk pct (approx via avg). We compute
  // per-trade R from recorded riskPct when available.
  const Rs = trades.filter((t) => t.R != null).map((t) => t.R);
  const expectancyR = Rs.length ? Rs.reduce((a, b) => a + b, 0) / Rs.length : null;
  return {
    netUsd, netPct: (netUsd / startBalance) * 100, totalTrades: n,
    winners: wins.length, losers: losses.length, winRate: n ? (wins.length / n) * 100 : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0),
    maxDrawdown: -maxDD * 100, sharpe, avgWin, avgLoss, largestWin, largestLoss,
    maxConsecWins: maxCW, maxConsecLosses: maxCL, totalFees, expectancyR,
  };
}

function simulate(strat, prms, candles, cfg) {
  const s = Object.create(strat);
  s.init(prms);
  const warm = strat.warmUpBars || 0;
  const comm = cfg.commissionPct / 100, slip = cfg.slippagePct / 100, sizeFrac = cfg.sizePct / 100;
  const closesAll = candles.map((c) => c.close);
  let balance = cfg.startBalance, totalFees = 0;
  let pos = null, sl = null, tp = null;
  const trades = [], signals = [];

  function openPos(side, price, i, reason) {
    const fill = side === 'long' ? price * (1 + slip) : price * (1 - slip);
    pos = { side, entry: fill, size: balance * sizeFrac, entryIndex: i, entryStop: sl };
    signals.push({ index: i, time: candles[i].time, type: side, price: fill, reason });
  }
  function closePos(price, i, reason) {
    if (!pos) return;
    const exitFill = pos.side === 'long' ? price * (1 - slip) : price * (1 + slip);
    const grossPct = pos.side === 'long' ? (exitFill - pos.entry) / pos.entry * 100 : (pos.entry - exitFill) / pos.entry * 100;
    const fees = pos.size * comm * 2;
    const usd = pos.size * (grossPct / 100) - fees;
    totalFees += fees; balance += usd;
    let R = null;
    if (pos.entryStop != null) { const riskPct = Math.abs(pos.entry - pos.entryStop) / pos.entry * 100; if (riskPct > 0) R = grossPct / riskPct; }
    trades.push({ side: pos.side, entry: pos.entry, exit: exitFill, pct: grossPct, usd, R });
    signals.push({ index: i, time: candles[i].time, type: 'close', price: exitFill, reason });
    pos = null; sl = null; tp = null;
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (pos && (sl != null || tp != null)) {
      const hitSL = pos.side === 'long' ? (sl != null && c.low <= sl) : (sl != null && c.high >= sl);
      const hitTP = pos.side === 'long' ? (tp != null && c.high >= tp) : (tp != null && c.low <= tp);
      if (hitSL) { closePos(sl, i, 'Stop loss'); continue; }
      if (hitTP) { closePos(tp, i, 'Take profit'); continue; }
    }
    if (i < warm) continue;
    const closes = closesAll.slice(0, i + 1);
    const indicators = makeIndicators(closes, candles.slice(0, i + 1));
    const account = { position: pos ? pos.side : null, entryPrice: pos ? pos.entry : null, balance };
    const res = s.onCandle(c, indicators, account);
    const signal = typeof res === 'string' ? res : (res && res.signal) || null;
    if (res && typeof res === 'object') { if (res.stopLoss != null) sl = res.stopLoss; if (res.takeProfit != null) tp = res.takeProfit; }
    const reason = s.reason || '';
    if (signal === 'long') { if (pos && pos.side === 'short') closePos(c.close, i, reason); if (!pos) openPos('long', c.close, i, reason); }
    else if (signal === 'short') { if (pos && pos.side === 'long') closePos(c.close, i, reason); if (!pos) openPos('short', c.close, i, reason); }
    else if (signal === 'close') { if (pos) closePos(c.close, i, reason); }
  }
  if (pos) closePos(candles[candles.length - 1].close, candles.length - 1, 'Session end');
  return { trades, signals, stats: computeStats(trades, cfg.startBalance, balance, totalFees), finalBalance: balance };
}

// ── Bybit paginated kline fetch ───────────────────────────────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => { let d = ''; res.on('data', (x) => d += x); res.on('end', () => resolve(d)); }).on('error', reject);
  });
}
async function fetchCandles(symbol, interval, total) {
  const out = [];
  let end = Date.now();
  while (out.length < total) {
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=1000&end=${end}`;
    const raw = await get(url);
    let j; try { j = JSON.parse(raw); } catch { break; }
    const list = j && j.result && j.result.list;
    if (!list || !list.length) break;
    // list is newest-first
    for (const r of list) out.push({ time: Math.floor(+r[0] / 1000), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] });
    end = +list[list.length - 1][0] - 1;
    if (list.length < 1000) break;
  }
  // dedupe + ascending
  const map = new Map();
  for (const c of out) map.set(c.time, c);
  return [...map.values()].sort((a, b) => a.time - b.time).slice(-total);
}

// ── strategy loader (window shim) ─────────────────────────────────────────────────────────
function loadStrategy(file) {
  const code = fs.readFileSync(file, 'utf8');
  const window = { __STRATEGIES: {} };
  const fn = new Function('window', code + '\nreturn window.__STRATEGIES;');
  const reg = fn(window);
  const keys = Object.keys(reg);
  return { id: keys[keys.length - 1], strat: reg[keys[keys.length - 1]] };
}

module.exports = { simulate, fetchCandles, loadStrategy, makeIndicators };

// ── CLI ───────────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const [file, symbol = 'ETHUSDT', interval = '60', bars = '6000', paramJSON = '{}'] = process.argv.slice(2);
    const { id, strat } = loadStrategy(path.resolve(file));
    const candles = await fetchCandles(symbol, interval, parseInt(bars));
    const overrides = JSON.parse(paramJSON);
    const params = {};
    Object.entries(strat.params || {}).forEach(([k, d]) => { params[k] = d.default; });
    Object.assign(params, overrides);
    const cfg = { startBalance: 10000, sizePct: 100, commissionPct: 0.05, slippagePct: 0.01 };
    const r = simulate(strat, params, candles, cfg);
    const st = r.stats;
    const from = new Date(candles[0].time * 1000).toISOString().slice(0, 10);
    const to = new Date(candles[candles.length - 1].time * 1000).toISOString().slice(0, 10);
    const pf = st.profitFactor === Infinity ? '∞' : st.profitFactor.toFixed(2);
    console.log(`\n${strat.name}  [${id}]`);
    console.log(`${symbol} ${interval}  ${candles.length} bars  ${from} → ${to}  (size ${cfg.sizePct}%, fee ${cfg.commissionPct}%, slip ${cfg.slippagePct}%)`);
    console.log(`overrides: ${JSON.stringify(overrides)}`);
    console.log(`  Net P&L     : $${st.netUsd.toFixed(2)}  (${st.netPct.toFixed(2)}%)`);
    console.log(`  Trades      : ${st.totalTrades}   Win% ${st.winRate.toFixed(1)}   PF ${pf}`);
    console.log(`  Expectancy  : ${st.expectancyR != null ? st.expectancyR.toFixed(3) + 'R' : 'n/a'}   Sharpe ${st.sharpe.toFixed(2)}`);
    console.log(`  MaxDD       : ${st.maxDrawdown.toFixed(1)}%   ConsecW/L ${st.maxConsecWins}/${st.maxConsecLosses}`);
    console.log(`  Avg W / L   : $${st.avgWin.toFixed(2)} / $${st.avgLoss.toFixed(2)}   Best/Worst $${st.largestWin.toFixed(2)}/$${st.largestLoss.toFixed(2)}`);
    console.log(`  Fees        : $${st.totalFees.toFixed(2)}`);
  })().catch((e) => { console.error(e); process.exit(1); });
}
