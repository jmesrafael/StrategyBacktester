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
// Verify the 4-coin inputs: files, candle ranges, live-exchange spot check, per-coin trade pool vs the registry
const FS = require('fs');
const src = (c) => { const p = (...a) => path.join(__dirname, ...a), r15 = path.join(__dirname, '../ny-smc-iterations/data/binance-' + c.toLowerCase() + '15.json'); if (FS.existsSync(p('datatf','4h',c+'.json'))) return 'native 4h (datatf/4h)'; if (FS.existsSync(p('data4h',c+'.json'))) return 'native 4h (data4h)'; if (FS.existsSync(r15)) return '15m aggregated to 4h (ny-smc-iterations/data)'; if (FS.existsSync(p('datatf','15m',c+'.json'))) return '15m aggregated to 4h (datatf/15m)'; return 'unknown'; };
const rowsOf = (c) => L.bars(c, 240).map((b) => [b.time, b.open, b.high, b.low, b.close, b.volume]);
(async () => {
  console.log('## Candle files used by the engine');
  for (const c of COINS) {
    const rows = rowsOf(c), gaps = rows.slice(1).filter((r, i) => r[0] - rows[i][0] !== 14400).length;
    console.log(`${c}: ${src(c)} | ${rows.length} 4h candles | ${iso(rows[0][0])} -> ${iso(rows[rows.length - 1][0])} | gaps/irregular steps: ${gaps} | last close ${rows[rows.length - 1][4]}`);
  }
  console.log('\n## Spot check against Binance USDT-M futures (live API), 6 candles at 3 random past dates per coin');
  let bad = 0, tot = 0;
  for (const c of COINS) {
    const rows = rowsOf(c); let seed = 99 + c.length;
    for (let k = 0; k < 3; k++) {
      seed = (seed * 1103515245 + 12345) % 2147483648; const i = 300 + (seed % (rows.length - 400)), t0 = rows[i][0];
      const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${c}USDT&interval=4h&limit=6&startTime=${t0 * 1000}`), j = await r.json();
      if (!Array.isArray(j)) { console.log(c, 'api error', JSON.stringify(j).slice(0, 80)); continue; }
      for (const q of j) { const m = rows.find((x) => x[0] === q[0] / 1000); tot++; const ok = m && Math.abs(m[1] - +q[1]) < 1e-9 * Math.max(1, +q[1]) + 1e-12 && Math.abs(m[2] - +q[2]) < 1e-9 * Math.max(1, +q[2]) + 1e-12 && Math.abs(m[3] - +q[3]) < 1e-9 * Math.max(1, +q[3]) + 1e-12 && Math.abs(m[4] - +q[4]) < 1e-9 * Math.max(1, +q[4]) + 1e-12; if (!ok) { bad++; console.log('  MISMATCH', c, new Date(q[0]).toISOString(), 'api', q.slice(1, 5).join(','), 'file', m ? m.slice(1, 5).join(',') : 'missing'); } }
      console.log(`${c}: ${iso(t0)} -> ${j.length} candles compared`);
      await new Promise((x) => setTimeout(x, 150));
    }
  }
  console.log(`Result: ${tot - bad}/${tot} candles identical (open/high/low/close) to the live Binance chart`);
  console.log('\n## Trade pool by coin (the exact trades used in every test)');
  const TR2 = COINS.flatMap((c) => bot(c, REAL)); let T = 0, TP = 0;
  console.log('| Coin | Trades | Avg R | Net at 250/trade (R x 250) | Registry avgR (realistic) |'); const reg = { SOL: 0.35, ZEC: 0.36, NEAR: 0.26, ADA: 0.33 };
  for (const c of COINS) { const t = TR2.filter((x) => x.sym === c), R = t.reduce((a, x) => a + x.R, 0); T += t.length; TP += R * 250; console.log(`| ${c} | ${t.length} | ${(R / t.length).toFixed(2)} | ${Math.round(R * 250).toLocaleString('en-US')} | ${reg[c]} |`); }
  console.log(`| All | ${T} | ${(TR2.reduce((a, x) => a + x.R, 0) / T).toFixed(2)} | ${Math.round(TP).toLocaleString('en-US')} | |`);
  const ft = TR2.filter((x) => yr(x.x) >= 2021); console.log(`Simulation pool (2021 on): ${ft.length} trades: ` + COINS.map((c) => c + ' ' + ft.filter((x) => x.sym === c).length).join(', '));
  console.log('\n## Three sample trades traced to the candles');
  const smp = [TR2.filter((x) => x.sym === 'SOL')[40], TR2.filter((x) => x.sym === 'ZEC')[90], TR2.filter((x) => x.sym === 'ADA')[150]];
  for (const t of smp) { const B = L.bars(t.sym, 240), i0 = t.i0, c0 = B[i0], ci = B[t.i1]; console.log(`${t.sym} ${t.dir === 1 ? 'LONG' : 'SHORT'} entered ${new Date(t.t * 1000).toISOString().slice(0, 16)}Z at open ${c0.open} (candle O/H/L/C ${c0.open}/${c0.high}/${c0.low}/${c0.close}); exit by ${t.why} on candle ${new Date(ci.time * 1000).toISOString().slice(0, 16)}Z (O/H/L/C ${ci.open}/${ci.high}/${ci.low}/${ci.close}); result ${t.R.toFixed(2)}R`); }
})();
