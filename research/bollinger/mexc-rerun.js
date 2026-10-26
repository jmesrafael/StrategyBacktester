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
// Headline results re-run on MEXC candles vs Binance candles (same 4 coins, same rules, same Binance funding for both)
for (const c of COINS) FUND['MEXC_' + c] = FUND[c];
const CUT = Date.UTC(2026, 9, 17, 23) / 1000, S0 = 30000, DAY = 86400, YRS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const venue = (pre) => COINS.flatMap((c) => bot(pre + c, REAL)).filter((t) => t.x <= CUT).sort((a, b) => a.x - b.x);
const V = { Binance: venue(''), MEXC: venue('MEXC_') };
const N = (v) => Math.round(v).toLocaleString('en-US'), sgn = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
function chain(tr, rp) { let bal = S0, pk = S0, dd = 0, low = S0; const ye = {}; for (const y of YRS) { for (const x of tr.filter((t) => yr(t.x) === y)) { bal *= 1 + x.R * rp; pk = Math.max(pk, bal); dd = Math.max(dd, (pk - bal) / pk); low = Math.min(low, bal); } ye[y] = bal; } return { final: bal, dd, ye, low }; }
const fresh = (tr, y, rp) => { let b = S0, pk = S0, dd = 0; for (const x of tr.filter((t) => yr(t.x) === y)) { b *= 1 + x.R * rp; pk = Math.max(pk, b); dd = Math.max(dd, (pk - b) / pk); } return { end: b, dd }; };
function starts(tr, rp, from, H) { const lows = [], ends = []; const last = tr[tr.length - 1].x; for (let s = from; s + (H || 0) * DAY <= last || (!H && s <= last - 10 * DAY); s += DAY) { let b = S0, lo = S0; const e = H ? s + H * DAY : 1e12; for (const x of tr) { if (x.t < s) continue; if (x.x > e) break; b *= 1 + x.R * rp; lo = Math.min(lo, b); } lows.push(lo); ends.push(b); } return { lows, ends }; }
console.log(`Cut-off for both venues: trades closed by ${iso(CUT)}`);
console.log('\n## Overall (all years, each venue from the start of its own data)');
console.log('| | Binance candles | MEXC candles |'); const row = (n, f) => console.log(`| ${n} | ${f(V.Binance)} | ${f(V.MEXC)} |`);
const vst = (tr) => { const w = tr.filter((t) => t.R > 0), l = tr.filter((t) => t.R <= 0); return { n: tr.length, R: tr.reduce((a, t) => a + t.R, 0), wr: w.length / tr.length, pf: w.reduce((a, t) => a + t.R, 0) / -l.reduce((a, t) => a + t.R, 0), tp: tr.filter((t) => t.why === 'target').length }; };
row('Trades', (t) => vst(t).n); row('Total R', (t) => vst(t).R.toFixed(1)); row('Average R per trade', (t) => (vst(t).R / vst(t).n).toFixed(2)); row('Win rate', (t) => (vst(t).wr * 100).toFixed(0) + '%'); row('Profit factor', (t) => vst(t).pf.toFixed(2)); row('Hit the 4R target', (t) => vst(t).tp);
console.log('\n## Year by year (R)'); console.log('| Year | Binance R | MEXC R | Difference | Binance profit factor | MEXC profit factor |');
for (const y of YRS) { const a = V.Binance.filter((t) => yr(t.x) === y), b = V.MEXC.filter((t) => yr(t.x) === y), sa = vst(a), sb = vst(b); console.log(`| ${y}${y === 2026 ? '*' : ''} | ${sa.R.toFixed(1)} | ${sb.R.toFixed(1)} | ${sgn(sb.R - sa.R)} | ${sa.pf.toFixed(2)} | ${sb.pf.toFixed(2)} |`); }
console.log('\n## By coin (total R / avg R)'); console.log('| Coin | Binance | MEXC |');
for (const c of COINS) { const a = V.Binance.filter((t) => t.sym === c), b = V.MEXC.filter((t) => t.sym === 'MEXC_' + c); console.log(`| ${c} | ${a.reduce((s, t) => s + t.R, 0).toFixed(1)}R / ${(a.reduce((s, t) => s + t.R, 0) / a.length).toFixed(2)} (${a.length} trades) | ${b.reduce((s, t) => s + t.R, 0).toFixed(1)}R / ${(b.reduce((s, t) => s + t.R, 0) / b.length).toFixed(2)} (${b.length} trades) |`); }
for (const rp of [0.05, 0.025]) {
  console.log(`\n## ₱30,000 at ${rp * 100}% risk`);
  console.log('| | Binance candles | MEXC candles |');
  const cb = chain(V.Binance, rp), cm = chain(V.MEXC, rp);
  console.log(`| Fresh ₱30,000 each year, ending balance 2020 / 2021 / 2022 / 2023 / 2024 / 2025 / 2026 | ${YRS.map((y) => N(fresh(V.Binance, y, rp).end / 1000) + 'k').join(' / ')} | ${YRS.map((y) => N(fresh(V.MEXC, y, rp).end / 1000) + 'k').join(' / ')} |`);
  console.log(`| Worst drop inside a year (fresh) | −${(Math.max(...YRS.map((y) => fresh(V.Binance, y, rp).dd)) * 100).toFixed(0)}% | −${(Math.max(...YRS.map((y) => fresh(V.MEXC, y, rp).dd)) * 100).toFixed(0)}% |`);
  console.log(`| Carried from 2020 to Oct 2026 | ₱${N(cb.final)} | ₱${N(cm.final)} |`);
  console.log(`| Worst drop from a high, whole run | −${(cb.dd * 100).toFixed(0)}% | −${(cm.dd * 100).toFixed(0)}% |`);
  const f21 = Date.UTC(2021, 0, 1) / 1000, sb = starts(V.Binance, rp, f21, 365), sm = starts(V.MEXC, rp, f21, 365), nb = starts(V.Binance, rp, CUT - 365 * DAY), nm = starts(V.MEXC, rp, CUT - 365 * DAY);
  const mn = (a) => Math.min(...a), sh = (a) => (a.filter((v) => v < S0 / 2).length / a.length * 100).toFixed(0) + '%';
  console.log(`| Worst lowest balance from any start (2021 on, 12 months after the start) | ₱${N(mn(sb.lows))} (${((mn(sb.lows) / S0 - 1) * 100).toFixed(0)}%) | ₱${N(mn(sm.lows))} (${((mn(sm.lows) / S0 - 1) * 100).toFixed(0)}%) |`);
  console.log(`| Starts that fell below half (12-month window) | ${sh(sb.lows)} | ${sh(sm.lows)} |`);
  console.log(`| Worst lowest balance, starts in the last 12 months | ₱${N(mn(nb.lows))} (${((mn(nb.lows) / S0 - 1) * 100).toFixed(0)}%) | ₱${N(mn(nm.lows))} (${((mn(nm.lows) / S0 - 1) * 100).toFixed(0)}%) |`);
}
