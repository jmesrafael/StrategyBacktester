// perf-5coin.js — yearly + monthly results (realistic fees + funding, $5 risk) for any coin list. usage: node perf-5coin.js SOL,ZEC,BTC,NEAR,ADA
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js');
const APP = path.resolve(__dirname, '../..'), COINS = (process.argv[2] || 'NEAR,SOL,ZEC,BTC').split(','), RISK = 5, START = 1000, TP = 4;
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
      fundR: -pos.dir * fr / pos.dist, mfe: pos.mfe, mae: pos.mae, f: pos.f });
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
const T = Object.fromEntries(COINS.map((s) => [s, bot(s, REAL).sort((a, b) => a.x - b.x)]));
const ALL = COINS.flatMap((s) => T[s]).sort((a, b) => a.x - b.x);
const Y = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const cell = (tr) => (tr.length ? usd(tr.reduce((a, t) => a + t.usd, 0)) : '·');
console.log('\n## YEARLY net $ (trades counted in year they close, $5 risk)');
console.log('| Year | ' + COINS.join(' | ') + ' | ALL | trades | maxDD in yr |');
for (const y of Y) { const a = ALL.filter((t) => yr(t.x) === y); console.log(`| ${y}${y === 2026 ? '*' : ''} | ${COINS.map((s) => cell(T[s].filter((t) => yr(t.x) === y))).join(' | ')} | ${cell(a)} | ${a.length} | ${usd(-st(a).dd)} |`); }
console.log(`| Total | ${COINS.map((s) => usd(st(T[s]).net)).join(' | ')} | ${usd(st(ALL).net)} | ${ALL.length} | ${usd(-st(ALL).dd)} |`);
console.log('\n## MONTHLY net $ (all coins, then per coin)');
const keys = [...new Set(ALL.map((t) => ym(t.x)))].sort();
console.log('| Month | ' + COINS.join(' | ') + ' | ALL | trades |');
let eq = 0, mpos = 0;
for (const k of keys) { const a = ALL.filter((t) => ym(t.x) === k), v = a.reduce((s, t) => s + t.usd, 0); eq += v; if (v > 0.5) mpos++;
  console.log(`| ${k} | ${COINS.map((s) => cell(T[s].filter((t) => ym(t.x) === k))).join(' | ')} | **${usd(v)}** | ${a.length} |`); }
const mv = keys.map((k) => ALL.filter((t) => ym(t.x) === k).reduce((s, t) => s + t.usd, 0));
console.log(`\nmonths ${keys.length}, winning ${mpos}, losing ${mv.filter((v) => v < -0.5).length}, best ${usd(Math.max(...mv))}, worst ${usd(Math.min(...mv))}, avg ${usd(mv.reduce((a, b) => a + b, 0) / mv.length)}`);
// worst rolling 3 / 6 months and longest stretch below a prior equity peak (in months)
let c = 0, pk = 0, run = 0, longest = 0; for (const v of mv) { c += v; if (c >= pk) { pk = c; run = 0; } else { run++; longest = Math.max(longest, run); } }
const roll = (n) => Math.min(...mv.map((_, i) => i + n <= mv.length ? mv.slice(i, i + n).reduce((a, b) => a + b, 0) : Infinity));
console.log(`worst 3-month ${usd(roll(3))}, worst 6-month ${usd(roll(6))}, longest time under an equity peak ${longest} months`);
// ---- per-coin per-year max drawdown ($, peak-to-trough inside the year, trades in exit order) and losing streaks
const ddOf = (tr) => { let c = 0, pk = 0, d = 0; for (const t of tr) { c += t.usd; pk = Math.max(pk, c); d = Math.max(d, pk - c); } return d; };
const stk = (tr) => { let cur = 0, mx = 0, lost = 0, mxl = 0; for (const t of tr) { if (t.R <= 0) { cur++; lost += t.usd; mx = Math.max(mx, cur); mxl = Math.min(mxl, lost); } else { cur = 0; lost = 0; } } return [mx, -mxl]; };
console.log('\n## MAX DRAWDOWN per coin per year ($, inside that year)');
console.log('| Year | ' + COINS.join(' | ') + ' | ALL |');
for (const y of Y) console.log(`| ${y}${y === 2026 ? '*' : ''} | ${COINS.map((s) => { const t = T[s].filter((x) => yr(x.x) === y); return t.length ? '−$' + ddOf(t).toFixed(0) : '·'; }).join(' | ')} | −$${ddOf(ALL.filter((x) => yr(x.x) === y)).toFixed(0)} |`);
console.log(`| Whole period | ${COINS.map((s) => '−$' + ddOf(T[s]).toFixed(0)).join(' | ')} | −$${ddOf(ALL).toFixed(0)} |`);
console.log('\n## LONGEST LOSING STREAK per coin per year (trades in a row, entry-to-exit order) / $ lost in that run');
console.log('| Year | ' + COINS.join(' | ') + ' | ALL |');
const sc = (tr) => { if (!tr.length) return '·'; const [n, l] = stk(tr); return `${n} (−$${l.toFixed(0)})`; };
for (const y of Y) console.log(`| ${y}${y === 2026 ? '*' : ''} | ${COINS.map((s) => sc(T[s].filter((x) => yr(x.x) === y))).join(' | ')} | ${sc(ALL.filter((x) => yr(x.x) === y))} |`);
console.log(`| Whole period | ${COINS.map((s) => sc(T[s])).join(' | ')} | ${sc(ALL)} |`);
