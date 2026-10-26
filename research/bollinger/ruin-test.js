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
// How often does a 30,000 account get badly hurt or wiped out? Monte Carlo over the REAL trades of the 4 coins (2021 on), block bootstrap keeps clusters of losses.
const TRS = COINS.flatMap((c) => bot(c, REAL)).sort((a, b) => a.x - b.x).filter((t) => yr(t.x) >= 2021), RS = TRS.map((t) => t.R), NT = RS.length;
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const BL = 20, SIMS = 20000;
function mkPath(len) { const out = []; while (out.length < len) { const s = Math.floor(rnd() * (NT - BL)); for (let k = 0; k < BL && out.length < len; k++) out.push(RS[s + k]); } return out; }
const pctile = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
function sim(len, rp, mode, shift) {
  let n50 = 0, n25 = 0, n10 = 0, nEnd = 0, nZero = 0; const dds = [];
  for (let i = 0; i < SIMS; i++) {
    const p = mkPath(len); let bal = 1, pk = 1, mn = 1, dd = 0;
    for (const r0 of p) { const r = r0 + shift; bal = mode === 'comp' ? bal * (1 + r * rp) : bal + r * rp; if (bal > pk) pk = bal; if (bal < mn) mn = bal; const d = (pk - bal) / pk; if (d > dd) dd = d; if (bal <= 0) { bal = 0; break; } }
    if (mn < 0.5) n50++; if (mn < 0.25) n25++; if (mn < 0.1) n10++; if (mn <= 0) nZero++; if (bal < 1) nEnd++; dds.push(dd);
  }
  dds.sort((a, b) => a - b);
  return { p50: n50 / SIMS, p25: n25 / SIMS, p10: n10 / SIMS, p0: nZero / SIMS, pEnd: nEnd / SIMS, med: pctile(dds, 0.5), p95: pctile(dds, 0.95), p99: pctile(dds, 0.99) };
}
const avgR = RS.reduce((a, b) => a + b, 0) / NT, wins = RS.filter((r) => r > 0).length / NT;
let ls = 0, mls = 0; for (const r of RS) { if (r <= 0) { ls++; mls = Math.max(mls, ls); } else ls = 0; }
console.log(`Pool: ${NT} real trades 2021→Oct 2026, avg ${avgR.toFixed(2)}R, win ${(wins * 100).toFixed(0)}%, longest real losing streak ${mls}. Sims per row ${SIMS}, 20-trade blocks.`);
const f = (v) => (v * 100).toFixed(1) + '%';
const Y1 = 200, Y3 = 600;
for (const [label, len] of [['12 MONTHS (~200 trades)', Y1], ['3 YEARS (~600 trades)', Y3]]) {
  console.log(`\n### ${label}`);
  console.log('| Sizing | Risk | Edge | Dips below 50% of start | below 25% | below 10% (wipe-out) | Ends below start | Median worst drop | 95th pct worst drop | 99th pct |');
  for (const [mode, ml] of [['comp', 'every trade compounding'], ['flat', 'flat size (no compounding)']]) for (const rp of [0.05, 0.025]) for (const [shift, el] of [[0, 'as tested'], [-0.15, 'weaker (−0.15R/trade)']]) {
    const r = sim(len, rp, mode, shift);
    console.log(`| ${ml} | ${rp * 100}% | ${el} | ${f(r.p50)} | ${f(r.p25)} | ${f(r.p10)} | ${f(r.pEnd)} | −${(r.med * 100).toFixed(0)}% | −${(r.p95 * 100).toFixed(0)}% | −${(r.p99 * 100).toFixed(0)}% |`);
  }
}
// worst real losing run in R, and what that does
const worstRun = (() => { let cum = 0, pk = 0, d = 0; for (const r of RS) { cum += r; pk = Math.max(pk, cum); d = Math.max(d, pk - cum); } return d; })();
console.log(`\nWorst real peak-to-trough in R over 2021→now: ${worstRun.toFixed(1)}R. Flat 5% size = 20R wipes the account; flat 2.5% = 40R.`);
for (const rp of [0.05, 0.025]) console.log(`  ${rp * 100}% risk: flat -> that run costs ${(worstRun * rp * 100).toFixed(0)}% of the starting money; compounding -> ${(100 * (1 - Math.pow(1 - rp, worstRun))).toFixed(0)}% of the balance (approx, all-loss run)`);
for (const rp of [0.05, 0.025]) { const n = Math.ceil(Math.log(0.1) / Math.log(1 - rp)); console.log(`  compounding ${rp * 100}%: ${n} full −1R losses in a row would be needed to lose 90%. At the real 61% loss rate, odds of that in a row = ${Math.pow(0.61, n).toExponential(1)} per start point`); }
