// cmp5y.js — ZIL vs GALA (and BTC) over the SAME window, alone and added to SOL+ZEC+NEAR+ADA. usage: node cmp5y.js
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js');
const APP = path.resolve(__dirname, '../..'), COINS = ['SOL','ZEC','NEAR','ADA'], RISK = 5, START = 1000, TP = 4;
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
const X = (k) => ({ ...REAL, entryFee: REAL.entryFee * k, stopFee: REAL.stopFee * k, tpFee: REAL.tpFee * k, timeFee: REAL.timeFee * k, slip: REAL.slip * k });
// Front-loaded drawdown stress test: SOL+ZEC+NEAR+ADA, per-trade compounding, start 30,000.
const START_BAL = 30000;
const TRS = COINS.flatMap((c) => bot(c, REAL)).sort((a, b) => a.x - b.x);
const YRS = [...new Set(TRS.map((t) => yr(t.x)))];
const N = (v) => Math.round(v).toLocaleString('en-US');
const byYear = (y) => TRS.filter((t) => yr(t.x) === y);

// worst peak-to-trough stretch of the year, in cumulative R (trades in exit order)
function ddSeg(t) {
  let cum = 0, pk = 0, pkIdx = -1, best = 0, bi = 0, bj = -1;
  for (let k = 0; k < t.length; k++) { cum += t[k].R; if (cum > pk) { pk = cum; pkIdx = k; } if (pk - cum > best) { best = pk - cum; bi = pkIdx + 1; bj = k; } }
  return { bi, bj, best, n: bj - bi + 1 };
}
const front = (t) => { const s = ddSeg(t); return s.best > 0 ? [...t.slice(s.bi, s.bj + 1), ...t.slice(0, s.bi), ...t.slice(s.bj + 1)] : t; };

function sim(seq, bal0, rp) {
  let bal = bal0, pk = bal0, low = bal0, ddp = 0, ddAbs = 0;
  for (const x of seq) { bal *= 1 + x.R * rp; if (bal > pk) pk = bal; if (bal < low) low = bal; ddp = Math.max(ddp, (pk - bal) / pk); ddAbs = Math.max(ddAbs, pk - bal); }
  return { end: bal, low, ddp, ddAbs };
}
function run(mode, fl, rp) { // mode 'chain' = carry the balance year to year, 'fresh' = restart at START_BAL each year
  let bal = START_BAL; const out = [];
  for (const y of YRS) {
    const t = byYear(y), s0 = mode === 'chain' ? bal : START_BAL, seg = ddSeg(t), r = sim(fl ? front(t) : t, s0, rp);
    out.push({ y, start: s0, ...r, seg, n: t.length }); bal = r.end;
  }
  return { out, final: bal, lowAll: Math.min(...out.map((o) => o.low)) };
}
const pc = (v) => (v < 0 ? '−' : '+') + Math.abs(v * 100).toFixed(0) + '%';
const date = (t) => iso(t);
for (const rp of [0.05, 0.025]) {
  console.log(`\n================ RISK ${rp * 100}% PER TRADE, compounding on every trade, start ${N(START_BAL)} ================`);
  const A = run('chain', false, rp), B = run('chain', true, rp), C = run('fresh', false, rp), D = run('fresh', true, rp);
  console.log('\n--- CHAINED (balance carries from 2020 to 2026): actual order vs drawdown first ---');
  console.log('| Year | Drawdown trades (n, R lost) | ACTUAL: start → end | ACTUAL worst drop | DD FIRST: start → end | DD FIRST lowest point | DD FIRST drop | cost of order |');
  A.out.forEach((a, i) => { const b = B.out[i];
    console.log(`| ${a.y} | ${a.seg.n} trades, −${a.seg.best.toFixed(1)}R | ${N(a.start)} → ${N(a.end)} | −${(a.ddp * 100).toFixed(0)}% | ${N(b.start)} → ${N(b.end)} | ${N(b.low)} (${pc(b.low / b.start - 1)}) | −${(b.ddp * 100).toFixed(0)}% | ${pc(b.end / a.end - 1)} vs actual |`); });
  console.log(`FINAL chained: actual ${N(A.final)} (x${(A.final / START_BAL).toFixed(1)}) | drawdown-first ${N(B.final)} (x${(B.final / START_BAL).toFixed(1)}) | lowest balance ever: actual ${N(A.lowAll)}, dd-first ${N(B.lowAll)}`);
  console.log('\n--- FRESH 30,000 EACH JANUARY, per-trade compounding within the year ---');
  console.log('| Year | ACTUAL end | ACTUAL return | ACTUAL worst drop | DD FIRST lowest | DD FIRST end | DD FIRST return | DD FIRST worst drop |');
  C.out.forEach((c, i) => { const d = D.out[i];
    console.log(`| ${c.y} | ${N(c.end)} | ${pc(c.end / c.start - 1)} | −${(c.ddp * 100).toFixed(0)}% | ${N(d.low)} (${pc(d.low / d.start - 1)}) | ${N(d.end)} | ${pc(d.end / d.start - 1)} | −${(d.ddp * 100).toFixed(0)}% |`); });
  console.log(`Total profit fresh: actual ${N(C.out.reduce((a, o) => a + o.end - o.start, 0))} | dd-first ${N(D.out.reduce((a, o) => a + o.end - o.start, 0))} | worst lowest balance: actual ${N(C.lowAll)}, dd-first ${N(D.lowAll)}`);
  if (rp === 0.05) {
    console.log('\n--- the drawdown stretch itself per year (original dates) ---');
    for (const y of YRS) { const t = byYear(y), s = ddSeg(t), seg = t.slice(s.bi, s.bj + 1); const wins = seg.filter((x) => x.R > 0).length;
      console.log(`${y}: ${s.n} trades (${seg.length - wins} losses, ${wins} wins), ${date(seg[0].t)} → ${date(seg[seg.length - 1].x)}, −${s.best.toFixed(1)}R, coins ${[...new Set(seg.map((x) => x.sym))].join('/')}`); }
  }
}
