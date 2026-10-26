// cmp5y.js — ZIL vs GALA (and BTC) over the SAME window, alone and added to SOL+ZEC+NEAR+ADA. usage: node cmp5y.js
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js');
const APP = path.resolve(__dirname, '../..'), COINS = (process.argv[2] || 'SOL,ZEC,NEAR,ADA').split(','), RISK = 5, START = 1000, TP = 4;
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
// 4 coins, 5% risk of 1000 = 50 per trade, fresh 1000 each calendar year. Trades counted in the month they CLOSE.
const CAP = 1000, RK = 50, MN = MON;
const TR = COINS.flatMap((c) => bot(c, REAL)).sort((a, b) => a.x - b.x).map((t) => ({ ...t, p: t.R * RK }));
const first = {}; for (const c of COINS) first[c] = iso(TR.find((t) => t.sym === c).t);
console.log('First trade per coin:', JSON.stringify(first), '| last exit', iso(TR[TR.length - 1].x), '| trades', TR.length);
const yrs = [...new Set(TR.map((t) => yr(t.x)))];
const mkey = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
const M = {}; for (const t of TR) { const k = ym(t.x); (M[k] = M[k] || []).push(t); }
const mp = (k) => (M[k] || []).reduce((s, t) => s + t.p, 0);
const f0 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(0);
const pc = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1) + '%';

console.log('\n## 1. YEARLY (fresh 1000 each Jan 1)');
console.log('| Year | Net | Return | Trades | Win% | PF | Avg R | 4R hits | Max DD from peak | Lowest bal | Lose streak | +Months | Best month | Worst month |');
for (const y of yrs) {
  const t = TR.filter((x) => yr(x.x) === y); let eq = CAP, pk = CAP, dd = 0, low = CAP, s = 0, ms = 0;
  for (const x of t) { eq += x.p; pk = Math.max(pk, eq); dd = Math.max(dd, (pk - eq) / pk); low = Math.min(low, eq); if (x.R <= 0) { s++; ms = Math.max(ms, s); } else s = 0; }
  const w = t.filter((x) => x.R > 0), gp = w.reduce((a, x) => a + x.p, 0), gl = -t.filter((x) => x.R <= 0).reduce((a, x) => a + x.p, 0);
  const ms12 = [...Array(12).keys()].map((m) => ({ m, v: mp(mkey(y, m)), has: !!M[mkey(y, m)] })).filter((o) => o.has);
  const b = ms12.reduce((a, o) => (o.v > a.v ? o : a)), wm = ms12.reduce((a, o) => (o.v < a.v ? o : a));
  console.log(`| ${y} | ${f0(eq - CAP)} | ${pc((eq - CAP) / 10)} | ${t.length} | ${(w.length / t.length * 100).toFixed(0)}% | ${(gp / gl).toFixed(2)} | ${(t.reduce((a, x) => a + x.R, 0) / t.length).toFixed(2)} | ${t.filter((x) => x.why === 'target').length} | −${(dd * 100).toFixed(0)}% | ${low.toFixed(0)} | ${ms} | ${ms12.filter((o) => o.v > 0).length}/${ms12.length} | ${MN[b.m]} ${f0(b.v)} | ${MN[wm.m]} ${f0(wm.v)} |`);
}

console.log('\n## 2. MONTHLY P&L (on 1000; divide by 10 for % of 1000)');
console.log('| Year | ' + MN.join(' | ') + ' | Year |');
for (const y of yrs) console.log(`| ${y} | ` + MN.map((_, m) => (M[mkey(y, m)] ? f0(mp(mkey(y, m))) : '·')).join(' | ') + ` | ${f0(TR.filter((x) => yr(x.x) === y).reduce((a, x) => a + x.p, 0))} |`);

const full = (k) => k >= '2021-01';
console.log('\n## 3. CALENDAR MONTH (2021-01 onward, all 4 coins live)');
console.log('| Month | Avg | Median | Positive | Worst | Best | Avg trades | Win% | Avg R |');
for (let m = 0; m < 12; m++) {
  const ks = Object.keys(M).filter((k) => full(k) && +k.slice(5) === m + 1).sort(), pairs = ks.map((k) => ({ k, v: mp(k) })).sort((a, b) => a.v - b.v), v = pairs.map((o) => o.v), tt = ks.flatMap((k) => M[k]);
  const avg = v.reduce((a, b) => a + b, 0) / v.length, med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  console.log(`| ${MN[m]} | ${f0(avg)} | ${f0(med)} | ${v.filter((x) => x > 0).length}/${v.length} | ${f0(v[0])} (${pairs[0].k.slice(0, 4)}) | ${f0(v[v.length - 1])} (${pairs[v.length - 1].k.slice(0, 4)}) | ${(tt.length / v.length).toFixed(0)} | ${(tt.filter((x) => x.R > 0).length / tt.length * 100).toFixed(0)}% | ${(tt.reduce((a, x) => a + x.R, 0) / tt.length).toFixed(2)} |`);
}
const allM = Object.keys(M).filter(full).map((k) => ({ m: +k.slice(5) - 1, v: mp(k) }));
const spread = (arr) => { const s = Array(12).fill(0), n = Array(12).fill(0); for (const o of arr) { s[o.m] += o.v; n[o.m]++; } const a = s.map((x, i) => x / n[i]); return Math.max(...a) - Math.min(...a); };
const obs = spread(allM); let ge = 0, seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let i = 0; i < 5000; i++) { const vs = allM.map((o) => o.v); for (let j = vs.length - 1; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [vs[j], vs[r]] = [vs[r], vs[j]]; } if (spread(allM.map((o, k) => ({ m: o.m, v: vs[k] }))) >= obs) ge++; }
console.log(`Seasonality test: best-vs-worst calendar month spread ${f0(obs)}; random shuffles of the same months give a spread at least this big ${(ge / 50).toFixed(0)}% of the time (p=${(ge / 5000).toFixed(2)}).`);

const mv = Object.keys(M).filter(full).sort().map((k) => ({ k, v: mp(k) }));
const neg = mv.filter((o) => o.v < 0); let rs = 0, mrs = 0, rsEnd = '';
for (const o of mv) { if (o.v < 0) { rs++; if (rs > mrs) { mrs = rs; rsEnd = o.k; } } else rs = 0; }
const r3 = mv.slice(2).map((o, i) => ({ k: mv[i].k + '→' + o.k, v: mv[i].v + mv[i + 1].v + o.v })).sort((a, b) => a.v - b.v);
const sortedV = mv.map((o) => o.v).sort((a, b) => a - b);
console.log(`\n## 4. MONTHLY DISTRIBUTION (2021-01 → ${mv[mv.length - 1].k}, ${mv.length} months)`);
console.log(`Positive months ${mv.length - neg.length}/${mv.length} (${((1 - neg.length / mv.length) * 100).toFixed(0)}%). Avg month ${f0(mv.reduce((a, o) => a + o.v, 0) / mv.length)}, median ${f0(sortedV[Math.floor(sortedV.length / 2)])}. Avg losing month ${f0(neg.reduce((a, o) => a + o.v, 0) / neg.length)}.`);
console.log(`Bands: < −100: ${sortedV.filter((v) => v < -100).length} | −100..0: ${sortedV.filter((v) => v >= -100 && v < 0).length} | 0..+200: ${sortedV.filter((v) => v >= 0 && v < 200).length} | +200..+500: ${sortedV.filter((v) => v >= 200 && v < 500).length} | > +500: ${sortedV.filter((v) => v >= 500).length}`);
console.log(`Longest run of negative months: ${mrs} (ending ${rsEnd}). Worst 3-month stretches: ${r3.slice(0, 3).map((o) => o.k + ' ' + f0(o.v)).join(', ')}. Negative 3-month stretches: ${r3.filter((o) => o.v < 0).length}/${r3.length}.`);
console.log('10 worst months: ' + [...mv].sort((a, b) => a.v - b.v).slice(0, 10).map((o) => o.k + ' ' + f0(o.v)).join(', '));
console.log('10 best months: ' + [...mv].sort((a, b) => b.v - a.v).slice(0, 10).map((o) => o.k + ' ' + f0(o.v)).join(', '));

console.log('\n## 5. IF YOU START ON THE 1st OF A MONTH (1000, 50/trade, only trades opened after the start)');
const lastX = TR[TR.length - 1].x, starts = [];
for (let y = 2021; y <= 2026; y++) for (let m = 0; m < 12; m++) { const s = Date.UTC(y, m, 1) / 1000; if (s > lastX - 30 * 86400) continue; starts.push({ y, m, s }); }
const res = starts.map(({ y, m, s }) => {
  const t = TR.filter((x) => x.t >= s);
  const at = (mo) => { const e = s + mo * 86400 * 30.44; return e > lastX ? null : t.filter((x) => x.x <= e).reduce((a, x) => a + x.p, 0); };
  let eq = 0, low = 0, under = null, back = null;
  for (const x of t) { if (x.x > s + 365 * 86400) break; eq += x.p; if (eq < low) low = eq; if (eq < 0 && under == null) under = x.x; if (under != null && back == null && eq >= 0 && x.x > under) back = x.x; }
  return { y, m, k: mkey(y, m), m1: at(1), m3: at(3), m6: at(6), m12: at(12), low, rec: under == null ? 0 : back == null ? null : (back - s) / 86400 };
});
console.log('| Start month | n | 1st month neg | 3 mo neg | 6 mo neg | avg 1st month | avg 3 mo | avg 6 mo | dip below 1000 in 1st yr (avg / worst) | dipped | avg days back to 1000 |');
for (let m = 0; m < 12; m++) {
  const r = res.filter((o) => o.m === m), q = (key) => r.filter((o) => o[key] != null), ng = (key) => q(key).filter((o) => o[key] < 0).length + '/' + q(key).length, av = (key) => f0(q(key).reduce((a, o) => a + o[key], 0) / q(key).length);
  const dips = r.filter((o) => o.low < 0), recs = dips.filter((o) => o.rec != null);
  console.log(`| ${MN[m]} | ${r.length} | ${ng('m1')} | ${ng('m3')} | ${ng('m6')} | ${av('m1')} | ${av('m3')} | ${av('m6')} | ${f0(r.reduce((a, o) => a + o.low, 0) / r.length)} / ${f0(Math.min(...r.map((o) => o.low)))} | ${dips.length}/${r.length} | ${recs.length ? (recs.reduce((a, o) => a + o.rec, 0) / recs.length).toFixed(0) : '—'} |`);
}
const all12 = res.filter((o) => o.m12 != null), c = (key) => res.filter((o) => o[key] != null);
console.log(`All starts: 1st month negative ${c('m1').filter((o) => o.m1 < 0).length}/${c('m1').length}; 3 mo negative ${c('m3').filter((o) => o.m3 < 0).length}/${c('m3').length}; 6 mo negative ${c('m6').filter((o) => o.m6 < 0).length}/${c('m6').length}; 12 mo negative ${all12.filter((o) => o.m12 < 0).length}/${all12.length}; worst 12-mo result ${f0(Math.min(...all12.map((o) => o.m12)))}, best ${f0(Math.max(...all12.map((o) => o.m12)))}, avg ${f0(all12.reduce((a, o) => a + o.m12, 0) / all12.length)}.`);
console.log('Worst starts (deepest dip below 1000 in first year): ' + [...res].sort((a, b) => a.low - b.low).slice(0, 8).map((o) => `${o.k} ${f0(o.low)} (${o.rec == null ? 'not back yet' : 'back in ' + o.rec.toFixed(0) + 'd'})`).join('; '));

console.log('\n## 6. PER COIN');
console.log('| Coin | ' + yrs.join(' | ') + ' | Total | Best cal. month | Worst cal. month | +Months |');
const cmv = (cn) => mv.map((o) => (M[o.k] || []).filter((x) => x.sym === cn).reduce((a, x) => a + x.p, 0));
for (const cn of COINS) {
  const t = TR.filter((x) => x.sym === cn && full(ym(x.x))), cm = MN.map((_, m) => t.filter((x) => +ym(x.x).slice(5) === m + 1).reduce((a, x) => a + x.p, 0));
  const b = cm.indexOf(Math.max(...cm)), w = cm.indexOf(Math.min(...cm)), mm = cmv(cn);
  console.log(`| ${cn} | ` + yrs.map((y) => f0(TR.filter((x) => x.sym === cn && yr(x.x) === y).reduce((a, x) => a + x.p, 0))).join(' | ') + ` | ${f0(TR.filter((x) => x.sym === cn).reduce((a, x) => a + x.p, 0))} | ${MN[b]} ${f0(cm[b])} | ${MN[w]} ${f0(cm[w])} | ${mm.filter((v) => v > 0).length}/${mm.length} |`);
}
const cr = (a, b) => { const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length; let x = 0, y = 0, z = 0; for (let i = 0; i < a.length; i++) { x += (a[i] - ma) * (b[i] - mb); y += (a[i] - ma) ** 2; z += (b[i] - mb) ** 2; } return x / Math.sqrt(y * z); };
console.log('Monthly correlation: ' + COINS.flatMap((a, i) => COINS.slice(i + 1).map((b) => `${a}-${b} ${cr(cmv(a), cmv(b)).toFixed(2)}`)).join(', '));
console.log(`Months where ALL 4 coins lost: ${mv.filter((o) => COINS.every((cn) => (M[o.k] || []).filter((x) => x.sym === cn).reduce((a, x) => a + x.p, 0) < 0)).map((o) => o.k + ' ' + f0(o.v)).join(', ') || 'none'}`);
console.log(`Months where 3+ coins lost: ${mv.filter((o) => COINS.filter((cn) => (M[o.k] || []).filter((x) => x.sym === cn).reduce((a, x) => a + x.p, 0) < 0).length >= 3).length}/${mv.length}`);

const ft = TR.filter((x) => full(ym(x.x)));
const grp = (name, fn) => { const g = {}; for (const x of ft) { const k = fn(x); (g[k] = g[k] || []).push(x); } console.log(`${name}: ` + Object.entries(g).sort().map(([k, v]) => `${k} n=${v.length} win ${(v.filter((x) => x.R > 0).length / v.length * 100).toFixed(0)}% avgR ${(v.reduce((a, x) => a + x.R, 0) / v.length).toFixed(2)} net ${f0(v.reduce((a, x) => a + x.p, 0))}`).join(' | ')); };
console.log('\n## 7. TRADE-LEVEL ANGLES (2021-01 onward)');
grp('Direction', (x) => (x.dir === 1 ? 'long' : 'short'));
grp('Exit type', (x) => x.why);
grp('Entry weekday (UTC)', (x) => new Date(x.t * 1000).getUTCDay() + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(x.t * 1000).getUTCDay()]);
grp('Entry 4h bar (UTC)', (x) => String(new Date(x.t * 1000).getUTCHours()).padStart(2, '0') + 'h');
grp('Quarter', (x) => 'Q' + (Math.floor(new Date(x.x * 1000).getUTCMonth() / 3) + 1));
grp('Direction by year', (x) => yr(x.x) + (x.dir === 1 ? 'L' : 'S'));
const W = ft.filter((x) => x.R > 0), Ls = ft.filter((x) => x.R <= 0);
console.log(`Hold time: avg ${(ft.reduce((a, x) => a + x.bars * 4, 0) / ft.length / 24).toFixed(1)} days; winners ${(W.reduce((a, x) => a + x.bars * 4, 0) / W.length / 24).toFixed(1)}d, losers ${(Ls.reduce((a, x) => a + x.bars * 4, 0) / Ls.length / 24).toFixed(1)}d. Trades/month ${(ft.length / mv.length).toFixed(1)}. Win ${(W.length / ft.length * 100).toFixed(0)}%, avg win ${(W.reduce((a, x) => a + x.R, 0) / W.length).toFixed(2)}R, avg loss ${(Ls.reduce((a, x) => a + x.R, 0) / Ls.length).toFixed(2)}R. Funding total ${f0(ft.reduce((a, x) => a + x.fundR * RK, 0))}.`);
let s = 0, ms = 0, cur = 0, worstRun = 0; for (const x of ft) { if (x.R <= 0) { s++; cur += x.p; ms = Math.max(ms, s); worstRun = Math.min(worstRun, cur); } else { s = 0; cur = 0; } }
console.log(`Longest losing streak ${ms} trades; worst single losing run ${f0(worstRun)}.`);
