// bb-deep.js — six-year deep dive of BB Breakout (4h) on SOL / ZEC / BTC: monthly + yearly performance, market regime per year and month,
// drawdown phases, losing streaks, and which market conditions help or hurt the strategy.
//
// Execution: an independent bot that receives ONE CLOSED 4h candle at a time, recomputes Bollinger(20,2) / SMA200 / ATR14 only from candles
// it has already seen, decides at the close, and fills at the NEXT candle's open. Stop and target are fixed when the order is placed.
// If a candle touches both stop and target, it counts as a stop (worse case). Binance base-tier costs: taker 0.05% + 0.02% slippage on the
// entry, the stop and the time exit; maker 0.02% on the take-profit limit, which only fills if price trades 0.05% THROUGH it; real
// Binance funding for every funding event the trade was open through. Rules frozen since 2026-10-20 (tuned on 2019–22 BTC/ETH/SOL);
// only the target is set to 4R, as picked in rr4.js.
// usage: node bb-deep.js  -> results-bb-deep.md
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js');
const APP = path.resolve(__dirname, '../..'), COINS = (process.env.BB_COINS || 'SOL,ZEC,BTC').split(','), TAG = process.env.BB_TAG || '', RISK = 5, START = 1000, TP = 4;
const FUND = Object.fromEntries(COINS.map((s) => [s, JSON.parse(fs.readFileSync(path.join(__dirname, 'datafund', s + '.json'), 'utf8'))]));
const REAL = { entryFee: 0.0005, stopFee: 0.0005, tpFee: 0.0002, timeFee: 0.0005, slip: 0.0002, tpSlip: 0, tpBuf: 0.0005, funding: true };
const APPCOST = { entryFee: 0.0004, stopFee: 0.0004, tpFee: 0.0004, timeFee: 0.0004, slip: 0.0002, tpSlip: 0.0002, tpBuf: 0, funding: false };
const out = []; const P = (...a) => out.push(...(a.length ? a : ['']));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const usd = (v) => (Math.abs(v) < 0.5 ? '$0' : (v < 0 ? '−$' : '+$') + Math.abs(v).toFixed(0));
const pct = (v) => (v == null || !isFinite(v) ? '—' : (v * 100).toFixed(0) + '%');
const sp = (v) => (v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '+') + Math.abs(v * 100).toFixed(0) + '%');
const r2 = (v) => (v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2));
const pf = (v) => (v == null ? '—' : !isFinite(v) ? '∞' : v.toFixed(2));
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7), yr = (t) => +new Date(t * 1000).toISOString().slice(0, 4);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// ---------------- the bot ----------------
// opt.skip(f) -> true skips the signal (the slot stays free for the next one); opt.beR -> stop moves to entry once price has reached +beR
function bot(sym, cost, tpR = TP, opt = {}) {
  const B = L.bars(sym, 240), fd = FUND[sym], trades = [];
  const closes = [], trs = []; let atr = null, pos = null, pendEntry = null, pendClose = false;
  const smaHist = [], atrHist = [];
  for (let i = 0; i < B.length; i++) {
    const c = B[i];
    if (pendEntry) { const d = pendEntry.dir, fill = c.open * (1 + d * cost.slip), dist = Math.abs(fill - pendEntry.stop) / fill;
      if (dist > 0 && (d === 1 ? pendEntry.stop < fill : pendEntry.stop > fill)) pos = { ...pendEntry, entry: fill, i0: i, dist, mfe: 0, mae: 0 };
      pendEntry = null; }
    if (pendClose && pos) exit(c.open * (1 - pos.dir * cost.slip), i, cost.timeFee, 'time');
    pendClose = false;
    if (pos) {
      const d = pos.dir, risk = Math.abs(pos.entry - pos.stop);
      pos.mfe = Math.max(pos.mfe, d * ((d === 1 ? c.high : c.low) - pos.entry) / risk); pos.mae = Math.min(pos.mae, d * ((d === 1 ? c.low : c.high) - pos.entry) / risk);
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * cost.slip), i, cost.stopFee, 'stop');
      else if (d === 1 ? c.high >= pos.tp * (1 + cost.tpBuf) : c.low <= pos.tp * (1 - cost.tpBuf)) exit((d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open)) * (1 - d * cost.tpSlip), i, cost.tpFee, 'target');
      if (pos && opt.beR && pos.mfe >= opt.beR && (d === 1 ? pos.stop < pos.entry : pos.stop > pos.entry)) pos.stop = pos.entry; // from the next candle
    }
    // the candle has CLOSED: indicators get this candle and nothing later
    closes.push(c.close);
    trs.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - B[i - 1].close), Math.abs(c.low - B[i - 1].close)));
    if (i === 13) atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14; else if (i > 13) atr = (atr * 13 + trs[i]) / 14;
    const sma = i >= 199 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : null; smaHist.push(sma); atrHist.push(atr);
    if (pos) { if (i - pos.i0 >= 48) pendClose = true; continue; }
    if (i < 202 || i >= B.length - 1) continue;
    const w = closes.slice(-20), mid = w.reduce((a, b) => a + b, 0) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / 20);
    const up = mid + 2 * sd, lo = mid - 2 * sd;
    const dir = c.close > up ? 1 : c.close < lo ? -1 : 0;
    if (!dir || (dir === 1 ? c.close < sma : c.close > sma)) continue;
    const dist = Math.abs(c.close - mid); if (!(dist > 0) || dist < 0.3 * atr) continue;
    // features known at this close (for the regime analysis only — they never change the trade)
    let path60 = 0; for (let j = i - 59; j <= i; j++) path60 += Math.abs(closes[j] - closes[j - 1]);
    const er = Math.abs(closes[i] - closes[i - 60]) / path60;
    const atrp = atr / c.close; let below = 0, cnt = 0;
    for (let j = Math.max(14, i - 540); j < i; j++) { cnt++; if (atrHist[j] / closes[j] < atrp) below++; }
    const slope = smaHist[i - 30] ? dir * (sma - smaHist[i - 30]) / smaHist[i - 30] : null;
    const ext = dir * (c.close - sma) / atr;
    let crosses = 0; for (let j = i - 179; j <= i; j++) if (smaHist[j - 1] != null && (closes[j] > smaHist[j]) !== (closes[j - 1] > smaHist[j - 1])) crosses++;
    pendEntry = { dir, stop: mid, tp: c.close + dir * tpR * dist, f: { er, volRank: below / cnt, slope, ext, bandSd: (2 * sd) / c.close, crosses } };
    if (opt.skip && opt.skip(pendEntry.f)) pendEntry = null;
  }
  if (pos) exit(B[B.length - 1].close, B.length - 1, cost.timeFee, 'end');
  return trades;
  function exit(px, i, fee, why) {
    let fr = 0; if (cost.funding) { const te = B[pos.i0].time, tx = B[i].time + 7200; for (const [t, r] of fd) { if (t > tx) break; if (t > te) fr += r; } }
    const R = (pos.dir * (px - pos.entry) / pos.entry - cost.entryFee - fee - pos.dir * fr) / pos.dist;
    trades.push({ sym, dir: pos.dir, i0: pos.i0, i1: i, t: B[pos.i0].time, x: B[i].time + 14400, R, usd: R * RISK, why, bars: i - pos.i0 + 1,
      fundR: -pos.dir * fr / pos.dist, feeR: (cost.entryFee + fee) / pos.dist, slipR: (cost.slip + (why === 'target' ? cost.tpSlip : why === 'end' ? 0 : cost.slip)) / pos.dist,
      mfe: pos.mfe, mae: pos.mae, f: pos.f });
    pos = null;
  }
}

// ---------------- statistics over a list of trades (in exit order) ----------------
function st(tr, start = START) {
  const n = tr.length, w = tr.filter((t) => t.R > 0), l = tr.filter((t) => t.R <= 0);
  const gp = w.reduce((a, t) => a + t.usd, 0), gl = -l.reduce((a, t) => a + t.usd, 0);
  let eq = start, pk = start, dd = 0, ddPct = 0, streak = 0, maxStreak = 0, lossRun = 0, maxLossRun = 0;
  for (const t of tr) {
    eq += t.usd; if (eq > pk) pk = eq; if (pk - eq > dd) { dd = pk - eq; ddPct = dd / pk; }
    if (t.R <= 0) { streak++; lossRun += t.usd; if (streak > maxStreak) maxStreak = streak; } else { streak = 0; lossRun = 0; }
  }
  const net = gp - gl;
  return { n, w: w.length, l: l.length, wr: n ? w.length / n : null, net, pf: gl ? gp / gl : n ? Infinity : null, avgR: n ? net / RISK / n : null,
    avgW: w.length ? gp / w.length / RISK : null, avgL: l.length ? -gl / l.length / RISK : null, dd, ddPct, maxStreak, start, end: start + net,
    tp: tr.filter((t) => t.why === 'target').length, sl: tr.filter((t) => t.why === 'stop').length, tx: tr.filter((t) => t.why === 'time').length,
    long: tr.filter((t) => t.dir === 1), short: tr.filter((t) => t.dir === -1), best: n ? Math.max(...tr.map((t) => t.R)) : null, fund: tr.reduce((a, t) => a + t.fundR * RISK, 0) };
}
// --------------- market regime from candles ---------------
function regime(sym, lo, hi, step = 1) {
  const B = L.bars(sym, 240), sm = L.ind(sym, 240).sma(200), idx = [];
  for (let i = 0; i < B.length; i++) if (B[i].time >= lo && B[i].time < hi) idx.push(i);
  if (idx.length < 12) return null;
  const o = B[idx[0]].open, c = B[idx[idx.length - 1]].close, lr = [];
  for (const i of idx) if (i > 0) lr.push(Math.log(B[i].close / B[i - 1].close));
  const mean = lr.reduce((a, b) => a + b, 0) / lr.length, vol = Math.sqrt(lr.reduce((a, b) => a + (b - mean) ** 2, 0) / lr.length) * Math.sqrt(6 * 365);
  const day = []; for (const i of idx) if ((B[i].time % (86400 * step)) === (step === 1 ? 72000 : 72000 + 86400 * 3)) day.push(B[i].close); // daily (or weekly, step 7) close = the 20:00 UTC 4h candle's close
  let path = 0; for (let j = 1; j < day.length; j++) path += Math.abs(day[j] - day[j - 1]);
  const er = day.length > 2 ? Math.abs(day[day.length - 1] - day[0]) / path : null;
  let above = 0, crosses = 0, prevSide = null, hiP = -Infinity, ddP = 0;
  for (const i of idx) { if (sm[i] == null) continue; const side = B[i].close > sm[i]; if (side) above++; if (prevSide != null && side !== prevSide) crosses++; prevSide = side;
    hiP = Math.max(hiP, B[i].high); ddP = Math.max(ddP, 1 - B[i].low / hiP); }
  const range = Math.max(...idx.map((i) => B[i].high)) / Math.min(...idx.map((i) => B[i].low)) - 1;
  return { ret: c / o - 1, vol, er, above: above / idx.length, crosses, ddP, range };
}
const label = (g, volMed) => {
  if (!g) return '—';
  const v = g.vol > volMed * 1.3 ? ', high vol' : g.vol < volMed * 0.75 ? ', quiet' : '';
  if (g.er >= 0.3 && g.ret >= 0.1) return 'Trend up' + v;
  if (g.er >= 0.3 && g.ret <= -0.1) return 'Trend down' + v;
  if (g.er < 0.15) return 'Choppy' + v;
  return (g.ret > 0.05 ? 'Drift up' : g.ret < -0.05 ? 'Drift down' : 'Range') + v;
};

// ======================================================================================================
// 0. no-look-ahead checks
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat, window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {}; vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/bb-breakout-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const strat = ctx.window.__STRATEGIES.bbbreakout, prm = { ...Object.fromEntries(Object.entries(strat.params).map(([k, d]) => [k, d.default])), targetR: TP };
const appRun = (bars) => ctx.SM.simulate(strat, prm, bars, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0.04, slippagePct: 0.02, startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } }, null);
let rng = 777; const rand = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
const checks = [];
for (const sym of COINS) {
  const bars = L.bars(sym, 240), full = appRun(bars); let bad = 0, compared = 0;
  for (let r = 0; r < 100; r++) {
    const k = 250 + Math.floor(rand() * (bars.length - 260));
    const part = appRun(bars.slice(0, k + 1)).signals.filter((s) => s.reason !== 'Session end'), ref = full.signals.filter((s) => s.index <= k);
    compared += ref.length;
    if (!(part.length === ref.length && part.every((s, j) => s.index === ref[j].index && s.type === ref[j].type && Math.abs(s.price - ref[j].price) < 1e-9))) bad++;
  }
  const b = bot(sym, APPCOST), aBy = new Map(full.trades.map((t) => [t.entryIndex, t]));
  const same = b.filter((t) => aBy.has(t.i0) && aBy.get(t.i0).exitIndex === t.i1).length;
  checks.push({ sym, cuts: 100, compared, bad, app: full.trades.length, bot: b.length, same, amb: full.stats.ambiguousBars });
}

// ======================================================================================================
const T = Object.fromEntries(COINS.map((s) => [s, bot(s, REAL).sort((a, b) => a.x - b.x)]));
const T3 = Object.fromEntries(COINS.map((s) => [s, bot(s, REAL, 3).sort((a, b) => a.x - b.x)]));
const T2x = Object.fromEntries(COINS.map((s) => [s, bot(s, { ...REAL, entryFee: 0.001, stopFee: 0.001, tpFee: 0.0004, timeFee: 0.001, slip: 0.0004 }).sort((a, b) => a.x - b.x)]));
const firstYear = (s) => yr(T[s][0].x), YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const months = (s) => { const a = [], d0 = new Date(L.bars(s, 240)[0].time * 1000); let y = d0.getUTCFullYear(), m = d0.getUTCMonth();
  for (;;) { const lo = Date.UTC(y, m, 1) / 1000; if (lo > Date.UTC(2026, 9, 1) / 1000) break; a.push({ y, m, lo, hi: Date.UTC(y, m + 1, 1) / 1000, key: `${y}-${String(m + 1).padStart(2, '0')}` }); m++; if (m === 12) { m = 0; y++; } }
  return a; };
P(`# BB Breakout (4h) — six-year deep dive on ${COINS.join(", ")}\n`);
P(`*Generated by \`bb-deep.js\` on ${new Date().toISOString().slice(0, 10)}. Binance USDT-M futures 4h candles. Data starts (listing dates): ${COINS.map((c) => c + ' ' + new Date(L.bars(c, 240)[0].time * 1000).toISOString().slice(0, 7)).join(', ')}; all to 20 Oct 2026.*\n`);
P('## How this was tested\n');
P('**Rules (frozen):** at the close of a 4h candle, go long if it closed above the upper Bollinger band (20, 2σ) and above the 200-candle SMA; go short if it closed below the lower band and below the SMA. The stop is the middle band at that close. The target is 4× the stop distance. If neither is hit, exit at the next open after 48 candles (8 days). One trade at a time per coin; no new signal while in a trade.\n');
P('**Execution:** an independent bot gets one *closed* candle at a time and recomputes every indicator only from candles it has already seen. It decides at the close and fills at the next candle\'s open. A candle that touches both the stop and the target counts as a stop.\n');
P('**Costs (Binance base tier):** 0.05% taker fee + 0.02% slippage on the entry, stop and time exit; 0.02% maker fee on the take-profit, which only fills if price trades 0.05% through it; real Binance funding for every 8h funding event the trade was open through.\n');
P(`**Money:** fixed **$${RISK} risk per trade** (no compounding), on a notional **$${START} account per coin** — so equity below is $${START} + cumulative profit. Profit is booked in the month the trade *closes*. Max drawdown is peak-to-trough on closed-trade equity.\n`);
P(`**Tuning status:** the Bollinger/SMA/stop/time-exit settings were picked on 2019–22 BTC, ETH and SOL and frozen; 2023→2026 was never used for tuning, and ${COINS.filter((c) => !['BTC', 'ETH', 'SOL'].includes(c)).join(', ') || 'no other coin'} ${COINS.filter((c) => !['BTC', 'ETH', 'SOL'].includes(c)).length > 1 ? 'were' : 'was'} never used at all. The 4R target was picked after looking at all years (rr4.js), so it is mildly in-sample everywhere.\n`);
P('### Look-ahead / repainting checks (run in this script)\n');
P('| Coin | Truncation cuts | Orders compared | Mismatches | App engine trades | Bot trades | Same entry and exit candle | Candles touching both stop and target |', '|---|---|---|---|---|---|---|---|');
for (const c of checks) P(`| ${c.sym} | ${c.cuts} | ${c.compared.toLocaleString()} | **${c.bad}** | ${c.app} | ${c.bot} | ${c.same} | ${c.amb} (counted as stops) |`);
P('\nThe truncation test runs the app\'s engine on candles up to a random cut only and checks every decision up to the cut matches the full-history run. Any use of future candles would make them differ. The bot is a second, independent implementation; it matches the app trade for trade.\n');

// ---------------- headline ----------------
P('## 1. Six-year headline\n');
P('| | ' + COINS.join(' | ') + ' | **All coins** |', '|' + '---|'.repeat(COINS.length + 2));
const ALL = COINS.flatMap((s) => T[s]).sort((a, b) => a.x - b.x), SA = Object.fromEntries(COINS.map((s) => [s, st(T[s])])), SALL = st(ALL, START * COINS.length);
const row = (name, fn) => P(`| ${name} | ${COINS.map((s) => fn(SA[s], s)).join(' | ')} | **${fn(SALL, null)}** |`);
row('Period', (x, s) => s ? `${iso(T[s][0].t)} → ${iso(T[s].at(-1).x)}` : '—');
row('Trades', (x) => x.n); row('Wins / losses', (x) => `${x.w} / ${x.l}`); row('Win rate', (x) => pct(x.wr));
row('Net profit', (x) => usd(x.net)); row('Return on notional account', (x) => sp(x.net / x.start));
row('Profit factor', (x) => pf(x.pf)); row('Average trade', (x) => r2(x.avgR) + 'R'); row('Average win / average loss', (x) => `${r2(x.avgW)}R / ${r2(x.avgL)}R`);
row('Max drawdown', (x) => `${usd(-x.dd)} (${pct(x.ddPct)} of peak equity)`); row('Return / max drawdown', (x) => (x.net / x.dd).toFixed(1));
row('Longest losing streak', (x) => `${x.maxStreak} trades`);
row('Exits: target / stop / time', (x) => `${x.tp} / ${x.sl} / ${x.tx}`);
row('Longs: trades, net', (x) => `${x.long.length}, ${usd(x.long.reduce((a, t) => a + t.usd, 0))}`); row('Shorts: trades, net', (x) => `${x.short.length}, ${usd(x.short.reduce((a, t) => a + t.usd, 0))}`);
row('Funding paid (−) / received (+)', (x) => usd(x.fund));
row('Same with 1:3 target', (x, s) => usd((s ? T3[s] : COINS.flatMap((c) => T3[c])).reduce((a, t) => a + t.usd, 0)));
row('Same with double costs', (x, s) => usd((s ? T2x[s] : COINS.flatMap((c) => T2x[c])).reduce((a, t) => a + t.usd, 0)));
row('Held-out 2023→ net (never tuned on)', (x, s) => usd((s ? T[s] : ALL).filter((t) => t.x >= L.ts(2023)).reduce((a, t) => a + t.usd, 0)));
const timeIn = (s) => { const n = L.bars(s, 240).length; return T[s].reduce((a, t) => a + t.bars, 0) / n; };
row('Time in a trade', (x, s) => s ? pct(timeIn(s)) : '—');
P('');

// ---------------- per coin: yearly summary, regime, monthly ----------------
const REG = {}, MROWS = [];
for (const s of COINS) {
  const ms = months(s), volMed = (() => { const v = ms.map((m) => regime(s, m.lo, m.hi)).filter(Boolean).map((g) => g.vol).sort((a, b) => a - b); return v[v.length >> 1]; })();
  REG[s] = { volMed };
  P(`## 2.${COINS.indexOf(s) + 1} ${s}\n`);
  P(`### ${s} — yearly summary\n`);
  P('| Year | Trades | W / L | Win rate | Net | Avg trade | PF | Max DD | Longest losing streak | Target / stop / time | Long net | Short net | Start equity | End equity | 1:3 net |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  let eq = START;
  for (const y of YEARS) {
    const tr = T[s].filter((t) => yr(t.x) === y); if (!tr.length && y < firstYear(s)) continue;
    const x = st(tr, eq), t3 = T3[s].filter((t) => yr(t.x) === y).reduce((a, t) => a + t.usd, 0);
    P(`| ${y}${y === 2026 ? ' (to Oct)' : ''} | ${x.n} | ${x.w} / ${x.l} | ${pct(x.wr)} | **${usd(x.net)}** | ${r2(x.avgR)}R | ${pf(x.pf)} | ${usd(-x.dd)} | ${x.maxStreak} | ${x.tp} / ${x.sl} / ${x.tx} | ${usd(x.long.reduce((a, t) => a + t.usd, 0))} | ${usd(x.short.reduce((a, t) => a + t.usd, 0))} | $${x.start.toFixed(0)} | $${x.end.toFixed(0)} | ${usd(t3)} |`);
    eq = x.end;
  }
  const x = SA[s];
  P(`| **All** | **${x.n}** | ${x.w} / ${x.l} | ${pct(x.wr)} | **${usd(x.net)}** | ${r2(x.avgR)}R | ${pf(x.pf)} | ${usd(-x.dd)} | ${x.maxStreak} | ${x.tp} / ${x.sl} / ${x.tx} | ${usd(x.long.reduce((a, t) => a + t.usd, 0))} | ${usd(x.short.reduce((a, t) => a + t.usd, 0))} | $${START} | $${x.end.toFixed(0)} | ${usd(T3[s].reduce((a, t) => a + t.usd, 0))} |`, '');

  P(`### ${s} — market regime by year (from the candles)\n`);
  P('Buy-and-hold = first open to last close of the year. Volatility = annualised from 4h returns. Trend efficiency = |net move| ÷ total distance travelled by weekly closes (1 = straight line, near 0 = going nowhere). Above SMA200 = share of 4h closes above the 200-candle SMA. SMA crosses = how often price flipped sides of it (whipsaw).\n');
  P('| Year | Buy-and-hold | Volatility | Trend efficiency | Above SMA200 | SMA200 crosses | Deepest pullback | Strategy net | Avg trade |', '|---|---|---|---|---|---|---|---|---|');
  REG[s].years = {};
  for (const y of YEARS) {
    const g = regime(s, L.ts(y), L.ts(y + 1), 7); if (!g) continue; REG[s].years[y] = g;
    const tr = T[s].filter((t) => yr(t.x) === y), z = st(tr);
    P(`| ${y} | ${sp(g.ret)} | ${pct(g.vol)} | ${g.er.toFixed(2)} | ${pct(g.above)} | ${g.crosses} | −${pct(g.ddP)} | ${usd(z.net)} | ${r2(z.avgR)}R |`);
  }
  P('');

  P(`### ${s} — month by month\n`);
  P(`Regime label: *Trend up/down* = trend efficiency ≥ 0.30 and a move of ≥ 10%; *Choppy* = efficiency < 0.15; otherwise *Range / Drift*. *High vol* = volatility > 1.3× ${s}'s median month (${pct(volMed)}); *quiet* < 0.75×.\n`);
  P('| Month | Coin move | Regime | Trades | W / L | Win rate | Net | Avg trade | PF | Max DD | Losing streak | Start equity | End equity |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  let e = START, curY = null, yAgg = null;
  const flushY = () => { if (!yAgg) return; const z = st(yAgg.tr, yAgg.start); P(`| **${curY} total** | | | **${z.n}** | ${z.w} / ${z.l} | ${pct(z.wr)} | **${usd(z.net)}** | ${r2(z.avgR)}R | ${pf(z.pf)} | ${usd(-z.dd)} | ${z.maxStreak} | $${z.start.toFixed(0)} | $${z.end.toFixed(0)} |`); };
  for (const m of ms) {
    if (m.y !== curY) { flushY(); curY = m.y; yAgg = { tr: [], start: e }; }
    const tr = T[s].filter((t) => ym(t.x) === m.key), z = st(tr, e), g = regime(s, m.lo, m.hi);
    yAgg.tr.push(...tr);
    MROWS.push({ sym: s, key: m.key, y: m.y, g, z, R: z.net / RISK, n: z.n, lab: label(g, volMed), volRel: g ? g.vol / volMed : null });
    P(`| ${MON[m.m]} ${m.y} | ${g ? sp(g.ret) : '—'} | ${label(g, volMed)} | ${z.n} | ${z.w} / ${z.l} | ${z.n ? pct(z.wr) : '—'} | ${z.n ? usd(z.net) : '·'} | ${z.n ? r2(z.avgR) + 'R' : '—'} | ${z.n ? pf(z.pf) : '—'} | ${z.n ? usd(-z.dd) : '—'} | ${z.n ? z.maxStreak : '—'} | $${z.start.toFixed(0)} | $${z.end.toFixed(0)} |`);
    e = z.end;
  }
  flushY(); P('');

  // best/worst months, drawdown phases, streaks
  const mine = MROWS.filter((r) => r.sym === s && r.n), byR = mine.slice().sort((a, b) => b.R - a.R);
  P(`### ${s} — best and worst months\n`, '| | Month | Net | Trades | Win rate | Coin move | Regime |', '|---|---|---|---|---|---|---|');
  for (const [tag, r] of [...byR.slice(0, 5).map((r) => ['Best', r]), ...byR.slice(-5).reverse().map((r) => ['Worst', r])])
    P(`| ${tag} | ${MON[+r.key.slice(5) - 1]} ${r.y} | ${usd(r.z.net)} | ${r.n} | ${pct(r.z.wr)} | ${sp(r.g.ret)} | ${r.lab} |`);
  const posM = mine.filter((r) => r.R > 0).length, allM = MROWS.filter((r) => r.sym === s);
  let mrun = 0, mmax = 0, mmaxEnd = null; for (const r of allM) { if (r.R < 0) { mrun++; if (mrun > mmax) { mmax = mrun; mmaxEnd = r.key; } } else if (r.n) mrun = 0; }
  P('', `Profitable months: **${posM} of ${allM.length}** (${allM.length - mine.length} months with no closed trade). Longest run of losing months: **${mmax}** (ending ${mmaxEnd}).\n`);

  P(`### ${s} — drawdown phases (closed-trade equity, 3 deepest)\n`);
  const phases = []; { let eq2 = 0, pk = 0, pkT = T[s][0].t, cur = null;
    for (const t of T[s]) { eq2 += t.usd;
      if (eq2 >= pk) { if (cur) { cur.rec = t.x; phases.push(cur); cur = null; } pk = eq2; pkT = t.x; }
      else { if (!cur) cur = { peak: pkT, depth: 0, n: 0, trough: t.x, ls: 0 }; cur.n++; if (pk - eq2 > cur.depth) { cur.depth = pk - eq2; cur.trough = t.x; } } }
    if (cur) phases.push(cur); }
  P('| Peak | Trough | Recovered | Depth | Trades from peak to recovery | Peak → recovery |', '|---|---|---|---|---|---|');
  for (const p of phases.sort((a, b) => b.depth - a.depth).slice(0, 3))
    P(`| ${iso(p.peak)} | ${iso(p.trough)} | ${p.rec ? iso(p.rec) : '**not yet**'} | ${usd(-p.depth)} | ${p.n} | ${p.rec ? Math.round((p.rec - p.peak) / 86400) + ' days' : Math.round((T[s].at(-1).x - p.peak) / 86400) + '+ days'} |`);
  // streaks
  const streaks = []; { let k = 0, s0 = null, lost = 0; for (const t of T[s]) { if (t.R <= 0) { if (!k) s0 = t.t; k++; lost += t.usd; } else { if (k) streaks.push({ k, s0, e: t.t, lost }); k = 0; lost = 0; } } if (k) streaks.push({ k, s0, e: T[s].at(-1).x, lost }); }
  const top = streaks.sort((a, b) => b.k - a.k).slice(0, 3);
  P('', `**Losing streaks:** ${streaks.filter((z) => z.k >= 5).length} streaks of 5+ losses, ${streaks.filter((z) => z.k >= 8).length} of 8+, ${streaks.filter((z) => z.k >= 10).length} of 10+. Longest: ` +
    top.map((z) => `${z.k} losses (${iso(z.s0)} → ${iso(z.e)}, ${usd(z.lost)})`).join('; ') + '.\n');
}

// ======================================================================================================
P('## 3. Comparing the coins\n');
P('### Year by year side by side (net $ at $5 risk; avg trade in R)\n');
P('| Year | ' + COINS.join(' | ') + ' | All coins | Market (BTC buy-and-hold) |', '|' + '---|'.repeat(COINS.length + 3));
const BTCY = (y) => regime('BTC', L.ts(y), L.ts(y + 1), 7);
for (const y of YEARS) {
  const c = COINS.map((s) => { const tr = T[s].filter((t) => yr(t.x) === y); return tr.length ? `${usd(st(tr).net)} (${r2(st(tr).avgR)}R)` : '·'; });
  const all = ALL.filter((t) => yr(t.x) === y); P(`| ${y} | ${c.join(' | ')} | **${usd(st(all).net)}** | ${BTCY(y) ? sp(BTCY(y).ret) : '—'} |`);
}
P('', '### What differs between the coins\n');
P('| Metric | ' + COINS.join(' | ') + ' |', '|' + '---|'.repeat(COINS.length + 1));
const mrow = (name, fn) => P(`| ${name} | ${COINS.map(fn).join(' | ')} |`);
mrow('Average monthly volatility', (s) => pct(REG[s].volMed));
mrow('Average band half-width at entry (≈ minimum stop distance)', (s) => (T[s].reduce((a, t) => a + t.f.bandSd, 0) / T[s].length * 100).toFixed(1) + '% of price');
mrow('Trades per year', (s) => (T[s].length / ((T[s].at(-1).x - T[s][0].t) / 31557600)).toFixed(0));
mrow('Win rate', (s) => pct(SA[s].wr)); mrow('Target-hit rate', (s) => pct(SA[s].tp / SA[s].n)); mrow('Time-exit share', (s) => pct(SA[s].tx / SA[s].n));
mrow('Average time-exit result', (s) => { const t = T[s].filter((x) => x.why === 'time'); return r2(t.reduce((a, x) => a + x.R, 0) / t.length) + 'R'; });
mrow('Trades that reached +2R but closed ≤ 0', (s) => pct(T[s].filter((t) => t.mfe >= 2 && t.R <= 0).length / T[s].length));
mrow('Average trade', (s) => r2(SA[s].avgR) + 'R'); mrow('Profit factor', (s) => pf(SA[s].pf));
mrow('Long avg / short avg', (s) => `${r2(st(SA[s].long).avgR)}R / ${r2(st(SA[s].short).avgR)}R`);
mrow('Funding cost', (s) => usd(SA[s].fund));
// monthly correlation
const mv = (s) => Object.fromEntries(MROWS.filter((r) => r.sym === s).map((r) => [r.key, r.R]));
const corr = (a, b) => { const k = Object.keys(a).filter((x) => x in b); const xa = k.map((x) => a[x]), xb = k.map((x) => b[x]); const ma = xa.reduce((p, q) => p + q, 0) / k.length, mb = xb.reduce((p, q) => p + q, 0) / k.length;
  let s1 = 0, s2 = 0, s3 = 0; for (let i = 0; i < k.length; i++) { s1 += (xa[i] - ma) * (xb[i] - mb); s2 += (xa[i] - ma) ** 2; s3 += (xb[i] - mb) ** 2; } return s1 / Math.sqrt(s2 * s3); };
P('', `**Monthly result correlation:** ` + COINS.flatMap((a, i) => COINS.slice(i + 1).map((b) => a + '–' + b + ' ' + corr(mv(a), mv(b)).toFixed(2))).join(', ') + '. ' +
  `Running all ${COINS.length} together: max drawdown ${usd(-SALL.dd)} vs ${usd(-COINS.reduce((a, s) => a + SA[s].dd, 0))} if each coin's worst drawdown had landed at once; longest losing streak ${SALL.maxStreak}.\n`);

// ======================================================================================================
P('## 4. Which market conditions help or hurt — the evidence\n');
P('### 4a. Month regime vs result (all coins pooled, months with ≥ 1 closed trade)\n');
P('Each month\'s *coin* regime (measured after the fact) against the strategy\'s result in that month. This explains *when* it makes money; it is not tradeable by itself because the regime is only known once the month is over.\n');
const pooled = MROWS.filter((r) => r.n && r.g);
const BUCK = [], HYPR = [], THR = [];
const bucket = (name, arr, key, cuts, labels) => {
  const rows = []; BUCK.push({ name, rows });
  P(`| ${name} | Months | Trades | Net | Avg trade | Months positive |`, '|---|---|---|---|---|---|');
  for (let b = 0; b < labels.length; b++) {
    const g = arr.filter((r) => { const v = key(r); return v >= cuts[b] && v < cuts[b + 1]; });
    const n = g.reduce((a, r) => a + r.n, 0), R = g.reduce((a, r) => a + r.R, 0);
    rows.push({ label: labels[b], months: g.length, n, R, pos: g.length ? g.filter((r) => r.R > 0).length / g.length : null });
    P(`| ${labels[b]} | ${g.length} | ${n} | ${usd(R * RISK)} | ${n ? r2(R / n) + 'R' : '—'} | ${g.length ? pct(g.filter((r) => r.R > 0).length / g.length) : '—'} |`);
  }
  P('');
};
bucket('Trend efficiency of the month', pooled, (r) => r.g.er, [0, 0.15, 0.3, 0.5, 2], ['< 0.15 (choppy)', '0.15–0.30', '0.30–0.50', '≥ 0.50 (clean trend)']);
bucket('Size of the coin\'s move', pooled, (r) => Math.abs(r.g.ret), [0, 0.05, 0.15, 0.3, 99], ['< 5%', '5–15%', '15–30%', '≥ 30%']);
bucket('Direction of the month', pooled, (r) => r.g.ret, [-99, -0.1, 0.1, 99], ['Down > 10%', 'Within ±10%', 'Up > 10%']);
bucket('Volatility vs the coin\'s median', pooled, (r) => r.volRel, [0, 0.75, 1, 1.3, 99], ['Quiet (< 0.75×)', '0.75–1×', '1–1.3×', 'High (> 1.3×)']);
bucket('SMA200 crosses in the month (whipsaw)', pooled, (r) => r.g.crosses, [0, 1, 4, 9, 999], ['0 (stayed one side)', '1–3', '4–8', '9+']);
P('### 4b. Conditions known at entry — do they predict the trade? (train/test split)\n');
P('Each trade is tagged with facts available at its signal candle\'s close. Tercile cut-points are set on trades **before 2023** only, then applied unchanged to 2023→. A condition is only "supported" if the same tercile is best (or worst) in both halves.\n');
const feats = [
  ['Trend efficiency, last 60 candles (10 days)', (t) => t.f.er],
  ['ATR% rank vs the last 90 days', (t) => t.f.volRank],
  ['SMA200 slope over 30 candles, in trade direction', (t) => t.f.slope],
  ['Distance from SMA200 in ATRs (stretch)', (t) => t.f.ext],
  ['Bollinger band width (% of price)', (t) => t.f.bandSd],
];
const ALLc = COINS.flatMap((s) => T[s]), train = ALLc.filter((t) => t.t < L.ts(2023)), test = ALLc.filter((t) => t.t >= L.ts(2023));
const FEATRES = [];
for (const [name, fn] of feats) {
  const v = train.map(fn).filter((x) => x != null).sort((a, b) => a - b), c1 = v[Math.floor(v.length / 3)], c2 = v[Math.floor(2 * v.length / 3)];
  const tb = (arr, b) => arr.filter((t) => { const x = fn(t); return x != null && (b === 0 ? x < c1 : b === 1 ? x >= c1 && x < c2 : x >= c2); });
  P(`**${name}** (cut-points ${c1.toFixed(3)} / ${c2.toFixed(3)})\n`, '| Tercile | Before 2023: trades, avg | 2023→: trades, avg | Per coin 2023→ (' + COINS.join(' / ') + ') |', '|---|---|---|---|');
  const res = [];
  for (const b of [0, 1, 2]) {
    const a = tb(train, b), c = tb(test, b), av = (x) => x.length ? x.reduce((p, t) => p + t.R, 0) / x.length : null; res.push([av(a), av(c)]);
    P(`| ${['Low', 'Middle', 'High'][b]} | ${a.length}, ${r2(av(a))}R | ${c.length}, ${r2(av(c))}R | ${COINS.map((s) => r2(av(c.filter((t) => t.sym === s)))).join(' / ')} |`);
  }
  const bestA = res.map((x) => x[0]).indexOf(Math.max(...res.map((x) => x[0]))), bestB = res.map((x) => x[1]).indexOf(Math.max(...res.map((x) => x[1])));
  const worstA = res.map((x) => x[0]).indexOf(Math.min(...res.map((x) => x[0]))), worstB = res.map((x) => x[1]).indexOf(Math.min(...res.map((x) => x[1])));
  FEATRES.push({ name, bestA, bestB, worstA, worstB, res });
  P('', `→ best tercile: ${['low', 'middle', 'high'][bestA]} before 2023, ${['low', 'middle', 'high'][bestB]} after; worst: ${['low', 'middle', 'high'][worstA]} / ${['low', 'middle', 'high'][worstB]}. ${bestA === bestB && worstA === worstB ? '**Consistent in both halves.**' : bestA === bestB || worstA === worstB ? 'Partly consistent.' : 'Not consistent — no reliable signal.'}\n`);
}

P('### 4c. Exit anatomy — where the profit and the losses come from\n');
P('| Coin | Exit | Trades | Share | Avg R | Total $ |', '|---|---|---|---|---|---|');
for (const s of COINS) for (const why of ['target', 'stop', 'time']) { const g = T[s].filter((t) => t.why === why); P(`| ${s} | ${why} | ${g.length} | ${pct(g.length / T[s].length)} | ${r2(g.reduce((a, t) => a + t.R, 0) / g.length)} | ${usd(g.reduce((a, t) => a + t.usd, 0))} |`); }
P('', '| Coin | Stopped trades that first reached +1R | …+2R | …+3R | Avg max adverse excursion of winners |', '|---|---|---|---|---|');
for (const s of COINS) { const sl = T[s].filter((t) => t.why === 'stop'), w = T[s].filter((t) => t.R > 0);
  P(`| ${s} | ${pct(sl.filter((t) => t.mfe >= 1).length / sl.length)} | ${pct(sl.filter((t) => t.mfe >= 2).length / sl.length)} | ${pct(sl.filter((t) => t.mfe >= 3).length / sl.length)} | ${r2(w.reduce((a, t) => a + t.mae, 0) / w.length)}R |`); }
P('');
// ======================================================================================================
P('## 5. Candidate improvements — tested, train vs held-out\n');
P('Each idea is run inside the bot (a skipped signal frees the slot for the next one). Thresholds come from trades **before 2023 only**. "Before 2023" is partly the tuning period; **2023→ is the fair test**. All coins, $5 risk, same costs.\n');
const cr = train.map((t) => t.f.crosses).sort((a, b) => a - b), crMed = cr[cr.length >> 1];
const erHi = (() => { const v = train.map((t) => t.f.er).sort((a, b) => a - b); return v[Math.floor(2 * v.length / 3)]; })();
const vrHi = (() => { const v = train.map((t) => t.f.volRank).sort((a, b) => a - b); return v[Math.floor(2 * v.length / 3)]; })();
const HYP = [
  ['Baseline (as tested above)', {}],
  [`Skip if the last 10 days already trended hard (trend efficiency > ${erHi.toFixed(2)}, top third)`, { skip: (f) => f.er > erHi }],
  [`Skip if price crossed the SMA200 ≥ ${crMed} times in the last 30 days (whipsaw)`, { skip: (f) => f.crosses >= crMed }],
  [`Only trade when ATR% is in the bottom third of its 90-day range (rank < ${(() => { const v = train.map((t) => t.f.volRank).sort((a, b) => a - b); return v[Math.floor(v.length / 3)].toFixed(2); })()})`, { skip: (f) => f.volRank >= (() => { const v = train.map((t) => t.f.volRank).sort((a, b) => a - b); return v[Math.floor(v.length / 3)]; })() }],
  ['Break-even stop once +1R is reached', { beR: 1 }],
  ['Break-even stop once +2R is reached', { beR: 2 }],
];
P('| Idea | Before 2023: trades, avg, net | 2023→: trades, avg, net | 2023→ max DD (all coins) | 2023→ per coin net (' + COINS.join(' / ') + ') |', '|---|---|---|---|---|');
for (const [name, opt] of HYP) {
  const tr = COINS.flatMap((s) => bot(s, REAL, TP, opt)), a = tr.filter((t) => t.t < L.ts(2023)), b = tr.filter((t) => t.t >= L.ts(2023)).sort((p, q) => p.x - q.x), sb = st(b);
  const sa = st(a);
  HYPR.push({ name, a: { n: sa.n, avgR: sa.avgR, net: sa.net }, b: { n: sb.n, avgR: sb.avgR, net: sb.net, dd: sb.dd }, coins: COINS.map((s) => b.filter((t) => t.sym === s).reduce((p, t) => p + t.usd, 0)) });
  P(`| ${name} | ${sa.n}, ${r2(sa.avgR)}R, ${usd(sa.net)} | ${sb.n}, ${r2(sb.avgR)}R, **${usd(sb.net)}** | ${usd(-sb.dd)} | ${COINS.map((s) => usd(b.filter((t) => t.sym === s).reduce((p, t) => p + t.usd, 0))).join(' / ')} |`);
}
// risk throttle: sizing only, same trades
P('', '**Risk throttle (sizing only, same trades):** halve the risk after 5 losses in a row on a coin, back to full after the next win.\n','| | Net 2023→ | Max DD 2023→ | Net all years | Max DD all years |', '|---|---|---|---|---|');
const throttle = (tr) => { let k = 0; return tr.map((t) => { const m = k >= 5 ? 0.5 : 1; k = t.R <= 0 ? k + 1 : 0; return { ...t, usd: t.usd * m }; }); };
for (const [name, fn] of [['Fixed $5', (x) => x], ['Halve after 5 losses', throttle]]) {
  const all = COINS.flatMap((s) => fn(T[s])).sort((a, b) => a.x - b.x), b = all.filter((t) => t.t >= L.ts(2023));
  THR.push({ name, net23: st(b).net, dd23: st(b).dd, net: st(all).net, dd: st(all).dd });
  P(`| ${name} | ${usd(st(b).net)} | ${usd(-st(b).dd)} | ${usd(st(all).net)} | ${usd(-st(all).dd)} |`);
}
P('');
fs.writeFileSync(__dirname + '/results-bb-deep' + TAG + '.md', out.join('\n') + '\n');
// machine-readable bits for the write-up
fs.writeFileSync(__dirname + '/results-bb-deep' + TAG + '.json', JSON.stringify({ checks, SA: Object.fromEntries(COINS.map((s) => [s, { ...SA[s], long: undefined, short: undefined }])), FEATRES, BUCK, HYPR, THR }, null, 1));
module.exports = { T, T3, T2x, SA, SALL, MROWS, REG, checks, FEATRES, BUCK, HYPR, THR, st, regime, label, months, COINS, RISK, START, YEARS };
console.log(out.join('\n'));
