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
// Historical worst case for 30,000: start on EVERY day, replay the real 4-coin trades that opened after the start.
const S0 = 30000, DAY = 86400, TRS = COINS.flatMap((c) => bot(c, REAL)).sort((a, b) => a.x - b.x), lastX = TRS[TRS.length - 1].x, firstT = TRS[0].t;
const N = (v) => Math.round(v).toLocaleString('en-US'), med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
function one(s, H, rp, mode) { // lowest balance and balance at the end of the horizon
  let bal = S0, low = S0, pk = S0, dd = 0, ddAt = null; const e = s + H * DAY;
  for (const x of TRS) { if (x.t < s) continue; if (x.x > e) break; bal = mode === 'comp' ? bal * (1 + x.R * rp) : bal + x.R * rp * S0; if (bal < low) { low = bal; } if (bal > pk) pk = bal; if ((pk - bal) / pk > dd) { dd = (pk - bal) / pk; ddAt = x.x; } }
  return { end: bal, low, dd };
}
function scan(from, H, rp, mode) {
  const rows = []; for (let s = from; s + H * DAY <= lastX; s += DAY) rows.push({ s, ...one(s, H, rp, mode) });
  return rows;
}
const show = (label, from, H) => {
  console.log(`\n### ${label}: ₱30,000 started on every day from ${iso(from)}, followed for ${H} days`);
  console.log('| Sizing | Starts tested | Worst lowest balance (start date) | Median lowest | Starts that fell below 50% | below 25% | below 10% | Worst balance at the end (start date) | Starts ending below ₱30,000 |');
  for (const [mode, ml] of [['comp', 'Compounding every trade'], ['flat', 'Flat size (no compounding)']]) for (const rp of [0.05, 0.025]) {
    const r = scan(from, H, rp, mode), wl = r.reduce((a, o) => (o.low < a.low ? o : a)), we = r.reduce((a, o) => (o.end < a.end ? o : a));
    console.log(`| ${ml} ${rp * 100}% | ${r.length} | **₱${N(wl.low)}** (${(wl.low / S0 * 100 - 100).toFixed(0)}%) from ${iso(wl.s)} | ₱${N(med(r.map((o) => o.low)))} | ${(r.filter((o) => o.low < S0 * 0.5).length / r.length * 100).toFixed(0)}% | ${(r.filter((o) => o.low < S0 * 0.25).length / r.length * 100).toFixed(0)}% | ${(r.filter((o) => o.low < S0 * 0.1).length / r.length * 100).toFixed(0)}% | ₱${N(we.end)} (${iso(we.s)}) | ${r.filter((o) => o.end < S0).length}/${r.length} |`);
  }
};
const Y21 = Date.UTC(2021, 0, 1) / 1000;
show('12 months, all four coins live (2021 on)', Y21, 365);
show('3 years, all four coins live (2021 on)', Y21, 1095);
show('12 months, whole history incl. 2020 (only some coins live early)', firstT, 365);
// whole run from the very first trade
console.log('\n### From the very first trade (Mar 2020) all the way to Oct 2026, continuous');
for (const [mode, ml] of [['comp', 'Compounding'], ['flat', 'Flat']]) for (const rp of [0.05, 0.025]) { const o = one(firstT, 9999, rp, mode); let bal = S0, pk = S0, dd = 0, at = ''; for (const x of TRS) { bal = mode === 'comp' ? bal * (1 + x.R * rp) : bal + x.R * rp * S0; if (bal > pk) pk = bal; if ((pk - bal) / pk > dd) { dd = (pk - bal) / pk; at = iso(x.x); } } console.log(`${ml} ${rp * 100}%: lowest balance ever ₱${N(o.low)}, worst drop from a high −${(dd * 100).toFixed(0)}% (${at}), ends ₱${N(o.end)}`); }
// the single worst real stretch
let cum = 0, pk = 0, pi = -1, best = 0, bi = 0, bj = 0; for (let k = 0; k < TRS.length; k++) { cum += TRS[k].R; if (cum > pk) { pk = cum; pi = k; } if (pk - cum > best) { best = pk - cum; bi = pi + 1; bj = k; } }
console.log(`\nWorst real stretch of all: ${best.toFixed(1)}R over ${bj - bi + 1} trades, ${iso(TRS[bi].t)} -> ${iso(TRS[bj].x)}. At flat 5% (₱1,500/trade): -₱${N(best * 1500)} of ₱30,000. At flat 2.5%: -₱${N(best * 750)}. Compounding 5%: ${(100 * (1 - TRS.slice(bi, bj + 1).reduce((a, x) => a * (1 + x.R * 0.05), 1))).toFixed(0)}% of the balance; 2.5%: ${(100 * (1 - TRS.slice(bi, bj + 1).reduce((a, x) => a * (1 + x.R * 0.025), 1))).toFixed(0)}%.`);
console.log('\n### Recent starts (last 12 months, followed only up to now): lowest balance so far');
{ const from = lastX - 365 * DAY; for (const [mode, ml] of [['comp', 'Compounding'], ['flat', 'Flat']]) for (const rp of [0.05, 0.025]) { const r = []; for (let s = from; s <= lastX - 10 * DAY; s += DAY) r.push({ s, ...one(s, 9999, rp, mode) }); const w = r.reduce((a, o) => (o.low < a.low ? o : a)); console.log(`${ml} ${rp * 100}%: worst lowest ₱${N(w.low)} (${(w.low / S0 * 100 - 100).toFixed(0)}%) from ${iso(w.s)}, that start is now ₱${N(w.end)}; starts below 50%: ${(r.filter((o) => o.low < S0 / 2).length / r.length * 100).toFixed(0)}%`); } }
