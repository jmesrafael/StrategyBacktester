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
// Start P30,000 on 19 Oct 2026: (1) every past 19 Oct start, (2) the real result so far, (3) forward Monte Carlo for the next 12 months
const S0 = 30000, DAY = 86400, TRS = COINS.flatMap((c) => bot(c, REAL)).sort((a, b) => a.x - b.x), lastX = TRS[TRS.length - 1].x;
const N = (v) => Math.round(v).toLocaleString('en-US'), RISKS = [0.05, 0.035, 0.025];
const dt = (y, m, d) => Date.UTC(y, m, d) / 1000;
// ---- 1. past 19 October starts
console.log('## (1) Real history: P30,000 started on 19 October, compounding on every trade, followed 12 months');
console.log('| Start | Risk | After 1 month | After 3 months | After 6 months | After 12 months | Lowest point in the year | Trades |');
for (let y = 2020; y <= 2025; y++) for (const rp of RISKS) {
  const s = dt(y, 9, 19), t = TRS.filter((x) => x.t >= s && x.x <= s + 365 * DAY); let bal = S0, low = S0; const at = {}; const marks = [[1, 30.44], [3, 91.3], [6, 182.6], [12, 365]];
  const bals = []; for (const x of t) { bal *= 1 + x.R * rp; low = Math.min(low, bal); bals.push([x.x, bal]); }
  const val = (days) => { let b = S0; for (const [tx, bb] of bals) { if (tx <= s + days * DAY) b = bb; else break; } return b; };
  console.log(`| 19 Oct ${y}${y === 2020 ? ' (only ZEC+ADA live)' : ''} | ${rp * 100}% | ${N(val(30.44))} | ${N(val(91.3))} | ${N(val(182.6))} | ${N(val(365))} (${((val(365) / S0 - 1) * 100 >= 0 ? '+' : '') + ((val(365) / S0 - 1) * 100).toFixed(0)}%) | ${N(low)} (${((low / S0 - 1) * 100).toFixed(0)}%) | ${t.length} |`);
}
// ---- 2. since 19 Oct 2026
const s26 = dt(2026, 9, 19), since = TRS.filter((x) => x.t >= s26);
console.log(`\n## (2) Real result since 19 Oct 2026 (data ends ${iso(lastX)})`);
for (const rp of RISKS) { let bal = S0; for (const x of since) bal *= 1 + x.R * rp; console.log(`${rp * 100}%: ₱${N(bal)} after ${since.length} trade(s) opened since 19 Oct and closed/marked by the end of the data` + (since.length ? ': ' + since.map((x) => `${x.sym} ${x.dir === 1 ? 'long' : 'short'} ${iso(x.t)} ${x.why} ${x.R.toFixed(2)}R`).join('; ') : '')); }
// trades that were opened before 19 Oct but still open, and Oct month-to-date
const octAll = TRS.filter((x) => iso(x.x).startsWith('2026-10')); let o5 = 1; for (const x of octAll) o5 *= 1 + x.R * 0.05;
console.log(`October 2026 so far (all trades that closed): ${octAll.length} trades, net ${(octAll.reduce((a, x) => a + x.R, 0)).toFixed(1)}R, balance effect at 5% compounding ${((o5 - 1) * 100).toFixed(0)}%`);
// ---- 3. forward Monte Carlo
let seed = 2026; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296), BL = 20, SIMS = 20000, LEN = 200;
const pools = { 'As tested (2021 on, +0.32R)': TRS.filter((t) => yr(t.x) >= 2021).map((t) => t.R), 'Recent regime (2023 on)': TRS.filter((t) => yr(t.x) >= 2023).map((t) => t.R) };
pools['Weaker edge (as tested, −0.15R)'] = pools['As tested (2021 on, +0.32R)'].map((r) => r - 0.15);
const pc = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
console.log(`\n## (3) Forward simulation: next 12 months (~${LEN} trades), ₱30,000 from 19 Oct 2026, ${SIMS} random re-orderings of real trades (20-trade blocks)`);
for (const [pn, R] of Object.entries(pools)) {
  const avg = R.reduce((a, b) => a + b, 0) / R.length; console.log(`\n### ${pn}: avg ${avg.toFixed(2)}R over ${R.length} trades`);
  console.log('| Risk | 5th pct end | 25th | Median end | 75th | 95th | Ends below ₱30,000 | Dips below half | Median lowest point | 5th pct lowest |');
  for (const rp of RISKS) {
    const ends = [], lows = []; let nb = 0, nh = 0;
    for (let i = 0; i < SIMS; i++) { let bal = S0, low = S0, n = 0; while (n < LEN) { const st = Math.floor(rnd() * (R.length - BL)); for (let k = 0; k < BL && n < LEN; k++, n++) { bal *= 1 + R[st + k] * rp; if (bal < low) low = bal; } } ends.push(bal); lows.push(low); if (bal < S0) nb++; if (low < S0 / 2) nh++; }
    ends.sort((a, b) => a - b); lows.sort((a, b) => a - b);
    console.log(`| ${rp * 100}% | ${N(pc(ends, 0.05))} | ${N(pc(ends, 0.25))} | ${N(pc(ends, 0.5))} | ${N(pc(ends, 0.75))} | ${N(pc(ends, 0.95))} | ${(nb / SIMS * 100).toFixed(1)}% | ${(nh / SIMS * 100).toFixed(1)}% | ${N(pc(lows, 0.5))} | ${N(pc(lows, 0.05))} |`);
  }
}
