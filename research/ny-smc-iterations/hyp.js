// hyp.js — hypothesis round H1–H8 on frozen v7 (SOL + ETH, Binance 15m). Protocol: ITERATION-LOG.md, "Hypothesis round H1–H8".
// Each rule keeps a subset of v7's trades; judged per cell (coin × regime) and against random subsets of the same size.
// Every feature uses only information available when the CHoCH candle closes (completed higher-timeframe candles, closed trades).
// usage: node hyp.js → results/hyp.md, results/hyp.json
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js'), PD = require('./pdny.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const SPLIT = D0('2023-10-18'), END = D0('2026-10-18'), START = { SOL: D0('2020-10-18'), ETH: D0('2019-12-15') };
let seed = 99; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

// completed higher-timeframe closes + EMA: map bucket → { close, ema }
function htf(B, sec, len) {
  const m = new Map(); let bk = null, close = null, ema = null, n = 0, sum = 0; const k = 2 / (len + 1);
  const flush = () => { if (bk == null) return; n++; if (n <= len) { sum += close; if (n === len) ema = sum / len; } else ema = close * k + ema * (1 - k); m.set(bk, { close, ema }); };
  for (const b of B) { const x = Math.floor(b.time / sec); if (x !== bk) { flush(); bk = x; } close = b.close; }
  return m; // the last bucket is never flushed (incomplete)
}
const lastDone = (m, sec, tClose) => m.get(Math.floor(tClose / sec) - 1); // last bucket fully closed at tClose
// daily ATR% (UTC days) and its trailing-365-day midpoint
function dailyAtr(B) {
  const days = []; let cur = null;
  for (const b of B) { const d = Math.floor(b.time / 86400); if (!cur || cur.d !== d) { if (cur) days.push(cur); cur = { d, h: b.high, l: b.low, c: b.close }; } else { cur.h = Math.max(cur.h, b.high); cur.l = Math.min(cur.l, b.low); cur.c = b.close; } }
  const out = new Map(); let atr = null;
  for (let i = 1; i < days.length; i++) {
    const tr = Math.max(days[i].h - days[i].l, Math.abs(days[i].h - days[i - 1].c), Math.abs(days[i].l - days[i - 1].c));
    atr = atr == null ? tr : (atr * 13 + tr) / 14; days[i].atrPct = atr / days[i].c;
    if (i >= 365) { let mn = Infinity, mx = -Infinity; for (let j = i - 365; j < i; j++) { mn = Math.min(mn, days[j].atrPct); mx = Math.max(mx, days[j].atrPct); } out.set(days[i].d, { v: days[i].atrPct, mid: (mn + mx) / 2 }); }
  }
  return out;
}

const btcFile = 'data/binance-btc15.json';
const btc = fs.existsSync(btcFile) ? htf(JSON.parse(fs.readFileSync(btcFile, 'utf8')).map(([time, , , , close]) => ({ time, close })), 3600, 50) : null;
const rows = [];
for (const sym of ['SOL', 'ETH']) {
  const D = E.analyze(sym + '-binance', JSON.parse(fs.readFileSync(`data/binance-${sym.toLowerCase()}15.json`, 'utf8')), C.swingLen), B = D.B;
  const d1 = htf(B, 86400, 20), h4 = htf(B, 14400, 50), datr = dailyAtr(B);
  // overnight range per ET day (00:00–08:30 ET)
  const on = new Map();
  for (const b of B) { const e = PD.et(b.time); if (e.min >= 510) continue; const o = on.get(e.day); on.set(e.day, o ? { hi: Math.max(o.hi, b.high), lo: Math.min(o.lo, b.low) } : { hi: b.high, lo: b.low }); }
  const trades = E.execute(D, C, E.setupsFor(D, C));
  const closed = []; // [exitTime, R] for H7
  for (const t of trades) {
    const s = t.s, c = s.chochIdx, tClose = B[c].time + 900, dir = t.long ? 1 : -1, sigT = B[s.fvgIdx].time + 900;
    const e = PD.et(B[c].time), wd = new Date(e.day + 'T12:00:00Z').getUTCDay();
    const legX = t.long ? s.stop / (1 - C.slBufferPct) : s.stop / (1 + C.slBufferPct);
    const dd = lastDone(d1, 86400, tClose), hh = lastDone(h4, 14400, tClose), bb = btc && lastDone(btc, 3600, tClose);
    let vs = 0; for (let j = c - 20; j < c; j++) vs += B[j].volume;
    const o = on.get(e.day), va = datr.get(Math.floor(tClose / 86400) - 1);
    const last20 = closed.filter((x) => x[0] < sigT).slice(-20);
    const f = {
      H1: wd >= 1 && wd <= 5,
      H2: dd && dd.ema != null ? dir * (dd.close - dd.ema) > 0 : null,
      H3: hh && hh.ema != null ? dir * (hh.close - hh.ema) > 0 : null,
      H4: B[c].volume >= 1.5 * (vs / 20),
      H5: o && e.min >= 510 ? (t.long ? legX < o.lo : legX > o.hi) : null,
      H6: bb && bb.ema != null ? dir * (bb.close - bb.ema) > 0 : null,
      H7: last20.length < 20 ? true : last20.reduce((a, x) => a + x[1], 0) > 0,
      H8: va ? va.v >= va.mid : null,
    };
    closed.push([B[t.exitIdx].time + 900, t.R]);
    if (t.t >= START[sym] && t.t < END) rows.push({ sym, post: t.t >= SPLIT, R: t.R, f });
  }
}
const H = { H1: 'Weekday only (Mon–Fri ET)', H2: 'With the daily trend (EMA20)', H3: 'With the 4h trend (EMA50)', H4: 'CHoCH volume ≥ 1.5× avg',
  H5: 'Leg swept the overnight range', H6: 'BTC 1h agrees (EMA50)', H7: 'Regime switch: last 20 v7 trades > 0R', H8: 'Daily volatility in top half of year' };
const cells = [['SOL', false], ['SOL', true], ['ETH', false], ['ETH', true]], cname = ([s, p]) => `${s} ${p ? '23–26' : '19–23'}`;
const avg = (a) => (a.length ? a.reduce((x, t) => x + t.R, 0) / a.length : NaN);
const f2 = (x) => (isNaN(x) ? '—' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(2));
const L = ['# Hypothesis round H1–H8 on v7 — SOL + ETH, Binance 15m ($1 risk = 1R)', '', 'Protocol and thresholds fixed in ITERATION-LOG.md before this run. Cell = average R per trade (trades kept / trades).', '',
  `| Rule | ${cells.map(cname).join(' | ')} | Cells better | Kept | Pooled avg | Random-subset percentile | Total R (v7 ${rows.reduce((a, t) => a + t.R, 0).toFixed(1)}) | **Pass** |`, `|---|${cells.map(() => '---').join('|')}|---|---|---|---|---|---|`];
L.push(`| v7 (all trades) | ${cells.map(([s, p]) => { const a = rows.filter((t) => t.sym === s && t.post === p); return `${f2(avg(a))} (${a.length})`; }).join(' | ')} | — | 100% | ${f2(avg(rows))} | — | ${rows.reduce((a, t) => a + t.R, 0).toFixed(1)} | — |`);
const J = {};
for (const [h, name] of Object.entries(H)) {
  const known = rows.filter((t) => t.f[h] != null);
  if (!known.length) { L.push(`| ${h} ${name} | no data |`); continue; }
  let better = 0, kept = 0, keptR = 0; const keepPer = [];
  const cellTxt = cells.map(([s, p]) => {
    const all = rows.filter((t) => t.sym === s && t.post === p), k = all.filter((t) => t.f[h] !== false); // unknown → kept
    if (avg(k) > avg(all)) better++; kept += k.length; keptR += k.reduce((a, t) => a + t.R, 0); keepPer.push([all, k.length]);
    return `${f2(avg(k))} (${k.length}/${all.length})`;
  });
  const pooled = keptR / kept; let below = 0;
  for (let i = 0; i < 5000; i++) { let n = 0, R = 0; for (const [all, k] of keepPer) { const idx = all.map((_, j) => j); for (let j = 0; j < k; j++) { const r = j + Math.floor(rnd() * (idx.length - j)); [idx[j], idx[r]] = [idx[r], idx[j]]; R += all[idx[j]].R; n++; } } if (R / n < pooled) below++; }
  const pct = below / 50, keptShare = kept / rows.length, pass = better >= 3 && pct >= 95 && keptShare >= 0.4;
  J[h] = { better, pct, keptShare, pooled, total: keptR };
  L.push(`| ${h} ${name} | ${cellTxt.join(' | ')} | ${better}/4 | ${(keptShare * 100).toFixed(0)}% | ${f2(pooled)} | ${pct.toFixed(1)} | ${keptR.toFixed(1)} | ${pass ? '✅' : '❌'} |`);
}
L.push('', btc ? '' : 'H6 skipped: BTC data not downloaded yet.');
fs.writeFileSync('results/hyp.md', L.join('\n') + '\n'); fs.writeFileSync('results/hyp.json', JSON.stringify(J, null, 1));
console.log(L.join('\n'));
