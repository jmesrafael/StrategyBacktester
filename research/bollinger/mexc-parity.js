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
// Binance vs MEXC for SOL, ZEC, NEAR, ADA: (A) candle differences, (B) the same strategy run on each venue's candles, trade by trade
for (const c of COINS) FUND['MEXC_' + c] = FUND[c];   // same (Binance) funding for both so only the CANDLES differ
const IVL = 14400, f = (v, d = 3) => (v >= 0 ? '+' : '') + v.toFixed(d);
const pcl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const rowsOf = (sym) => L.bars(sym, 240);
console.log('## A. Candle-by-candle (same 4h candle on both venues)');
console.log('| Coin | Common candles | Only on Binance | Only on MEXC | Avg close gap | 99th pct gap | Largest gap (date) | Closes >0.1% apart | >0.5% apart | Avg high gap | Avg low gap |');
const cache = {};
for (const c of COINS) {
  const B = rowsOf(c), M = rowsOf('MEXC_' + c), mb = new Map(B.map((x) => [x.time, x])), mm = new Map(M.map((x) => [x.time, x]));
  const common = M.filter((x) => mb.has(x.time)), onlyB = B.filter((x) => !mm.has(x.time) && x.time >= M[0].time && x.time <= M[M.length - 1].time).length, onlyM = M.filter((x) => !mb.has(x.time) && x.time >= B[0].time && x.time <= B[B.length - 1].time).length;
  const dc = common.map((x) => Math.abs(x.close / mb.get(x.time).close - 1) * 100), dh = common.map((x) => Math.abs(x.high / mb.get(x.time).high - 1) * 100), dl = common.map((x) => Math.abs(x.low / mb.get(x.time).low - 1) * 100);
  const mx = dc.indexOf(Math.max(...dc)); cache[c] = { common: common.length };
  console.log(`| ${c} | ${common.length} | ${onlyB} | ${onlyM} | ${(dc.reduce((a, b) => a + b, 0) / dc.length).toFixed(3)}% | ${pcl(dc, 0.99).toFixed(3)}% | ${Math.max(...dc).toFixed(2)}% (${iso(common[mx].time)}) | ${(dc.filter((v) => v > 0.1).length / dc.length * 100).toFixed(1)}% | ${(dc.filter((v) => v > 0.5).length / dc.length * 100).toFixed(2)}% | ${(dh.reduce((a, b) => a + b, 0) / dh.length).toFixed(3)}% | ${(dl.reduce((a, b) => a + b, 0) / dl.length).toFixed(3)}% |`);
}
console.log('\n## B. Same strategy, each venue\'s own candles (common window per coin: from MEXC start + 210 candles; fees + funding included, same funding)');
console.log('| Coin | Window starts | Binance trades | MEXC trades | Same trade on both (same candle + direction) | Only Binance | Only MEXC | Binance net R | MEXC net R | Difference | Binance avg R | MEXC avg R | Avg |R gap| on matched trades |');
let totB = [], totM = [];
for (const c of COINS) {
  const M = rowsOf('MEXC_' + c), W0 = M[0].time + 210 * IVL;
  const tb = bot(c, REAL).filter((t) => t.t >= W0), tm = bot('MEXC_' + c, REAL).filter((t) => t.t >= W0);
  const km = new Map(tm.map((t) => [t.t + ':' + t.dir, t])), kb = new Map(tb.map((t) => [t.t + ':' + t.dir, t]));
  const both = tb.filter((t) => km.has(t.t + ':' + t.dir)), onlyB = tb.length - both.length, onlyM = tm.filter((t) => !kb.has(t.t + ':' + t.dir)).length;
  const gap = both.map((t) => Math.abs(t.R - km.get(t.t + ':' + t.dir).R)), Rb = tb.reduce((a, t) => a + t.R, 0), Rm = tm.reduce((a, t) => a + t.R, 0);
  totB.push(...tb.map((t) => ({ ...t, c }))); totM.push(...tm.map((t) => ({ ...t, c })));
  console.log(`| ${c} | ${iso(W0)} | ${tb.length} | ${tm.length} | ${both.length} (${(both.length / Math.max(tb.length, tm.length) * 100).toFixed(0)}%) | ${onlyB} | ${onlyM} | ${Rb.toFixed(1)} | ${Rm.toFixed(1)} | ${f(Rm - Rb, 1)}R | ${(Rb / tb.length).toFixed(2)} | ${(Rm / tm.length).toFixed(2)} | ${(gap.reduce((a, b) => a + b, 0) / gap.length).toFixed(3)} |`);
}
const Rb = totB.reduce((a, t) => a + t.R, 0), Rm = totM.reduce((a, t) => a + t.R, 0);
console.log(`| ALL 4 | | ${totB.length} | ${totM.length} | | | | ${Rb.toFixed(1)} | ${Rm.toFixed(1)} | ${f(Rm - Rb, 1)}R | ${(Rb / totB.length).toFixed(2)} | ${(Rm / totM.length).toFixed(2)} | |`);
console.log('\n## C. Per year, all four coins together (R, common windows)');
console.log('| Year | Binance trades | Binance R | MEXC trades | MEXC R | Difference |');
for (const y of [2020, 2021, 2022, 2023, 2024, 2025, 2026]) { const a = totB.filter((t) => yr(t.x) === y), b = totM.filter((t) => yr(t.x) === y); if (!a.length && !b.length) continue; const ra = a.reduce((s, t) => s + t.R, 0), rb = b.reduce((s, t) => s + t.R, 0); console.log(`| ${y} | ${a.length} | ${ra.toFixed(1)} | ${b.length} | ${rb.toFixed(1)} | ${f(rb - ra, 1)}R |`); }
// last 12 months only (what matters for live trading)
const t12 = Date.now() / 1000 - 365 * 86400, a12 = totB.filter((t) => t.t >= t12), b12 = totM.filter((t) => t.t >= t12);
console.log(`\nLast 12 months: Binance ${a12.length} trades ${a12.reduce((s, t) => s + t.R, 0).toFixed(1)}R | MEXC ${b12.length} trades ${b12.reduce((s, t) => s + t.R, 0).toFixed(1)}R`);
// the sign of the venue gap: does MEXC systematically pay more or less per trade
const kb = new Map(totB.map((t) => [t.c + t.t + ':' + t.dir, t])), pairs = totM.filter((t) => kb.has(t.c + t.t + ':' + t.dir)).map((t) => t.R - kb.get(t.c + t.t + ':' + t.dir).R);
console.log(`Matched trades: ${pairs.length}; mean R gap (MEXC minus Binance) ${f(pairs.reduce((a, b) => a + b, 0) / pairs.length, 3)}R; share within 0.1R ${(pairs.filter((v) => Math.abs(v) <= 0.1).length / pairs.length * 100).toFixed(0)}%; within 0.25R ${(pairs.filter((v) => Math.abs(v) <= 0.25).length / pairs.length * 100).toFixed(0)}%; largest ${Math.max(...pairs.map(Math.abs)).toFixed(2)}R`);
