// mc-zec.js — what could the next 12 months look like? Resample ZEC's real trade results (BB Breakout, MEXC 4h, 0% fees, $1 risk)
// into 10,000 simulated years of 54 trades. Three views: all history, only the last 2 years, and an edge cut in half. usage: node mc-zec.js
const fs = require('fs'), path = require('path'), L = require('./lib.js');
const SLIP = 0.0002, FEE = { taker: 0, maker: 0 };
const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const m = load('datafund/MEXC_ZEC.json'), b = load('datafund/ZEC.json'), FD = b.filter((r) => r[0] < m[0][0]).concat(m);
function bot(B, fd, fee) {
  const trades = [], closes = [], trs = []; let atr = null, pos = null, pend = null, pendClose = false, fi = 0;
  for (let i = 0; i < B.length; i++) {
    const c = B[i];
    if (pend) { const d = pend.dir, fill = c.open * (1 + d * SLIP), dist = Math.abs(fill - pend.stop) / fill;
      if (dist > 0 && (d === 1 ? pend.stop < fill : pend.stop > fill)) pos = { dir: d, entry: fill, stop: pend.stop, tp: pend.tp, i0: i, dist }; pend = null; }
    if (pendClose && pos) exit(c.open * (1 - pos.dir * SLIP), i, fee.taker, 'time'); pendClose = false;
    if (pos) { const d = pos.dir;
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * SLIP), i, fee.taker, 'stop');
      else if (d === 1 ? c.high >= pos.tp : c.low <= pos.tp) exit(d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open), i, fee.maker, 'target'); }
    closes.push(c.close);
    trs.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - B[i - 1].close), Math.abs(c.low - B[i - 1].close)));
    if (i === 13) atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14; else if (i > 13) atr = (atr * 13 + trs[i]) / 14;
    if (pos) { if (i - pos.i0 >= 48) pendClose = true; continue; }
    if (i < 202) continue;
    const w = closes.slice(-20), mid = w.reduce((a, b) => a + b, 0) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / 20);
    const up = mid + 2 * sd, lo = mid - 2 * sd, sma = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
    const dir = c.close > up ? 1 : c.close < lo ? -1 : 0;
    if (!dir || (dir === 1 ? c.close < sma : c.close > sma)) continue;
    const dist = Math.abs(c.close - mid); if (!(dist > 0) || dist < 0.3 * atr) continue;
    pend = { dir, stop: mid, tp: c.close + dir * 3 * dist };
  }
  return trades;
  function exit(px, i, f, why) {
    let fr = 0; const te = B[pos.i0].time, tx = B[i].time + 7200;
    while (fi < fd.length && fd[fi][0] <= te) fi++; for (let j = fi; j < fd.length && fd[j][0] <= tx; j++) fr += fd[j][1];
    trades.push({ t: te, x: B[i].time, R: (pos.dir * (px - pos.entry) / pos.entry - fee.taker - f - pos.dir * fr) / pos.dist, dist: pos.dist, bars: i - pos.i0, why }); pos = null;
  }
}
const all = bot(L.bars('MEXC_ZEC', 240), FD, FEE).filter((t) => t.x >= L.ts(2021));
const recent = all.filter((t) => t.x >= L.ts(2024, 11));
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function sim(Rs, label, shift = 0) {
  const N = 10000, T = 54, prof = [], dds = [], streaks = []; let losing = 0, stop = 0;
  const avg = Rs.reduce((a, x) => a + x, 0) / Rs.length;
  for (let k = 0; k < N; k++) {
    let e = 0, pk = 0, dd = 0, s = 0, ms = 0;
    for (let i = 0; i < T; i++) { const r = Rs[Math.floor(rnd() * Rs.length)] - shift * avg; e += r; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); s = r < 0 ? s + 1 : 0; ms = Math.max(ms, s); }
    prof.push(e); dds.push(dd); streaks.push(ms); if (e < 0) losing++; if (dd >= 33) stop++;
  }
  const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
  const f = (v) => (v >= 0 ? '+$' : '−$') + Math.abs(v).toFixed(0);
  console.log(`| ${label} | ${Rs.length} | ${f(q(prof, 0.05))} | ${f(q(prof, 0.25))} | **${f(q(prof, 0.5))}** | ${f(q(prof, 0.75))} | ${f(q(prof, 0.95))} | ${(losing / N * 100).toFixed(0)}% | −$${q(dds, 0.5).toFixed(0)} / −$${q(dds, 0.95).toFixed(0)} | ${(stop / N * 100).toFixed(1)}% | ${q(streaks, 0.5)} / ${q(streaks, 0.95)} |`);
}
console.log('| Assumption | Trades sampled | Bad year (5%) | Below avg (25%) | **Typical (50%)** | Good (75%) | Great (95%) | Chance of a losing year | Drawdown typical / bad (95%) | Chance of hitting −$33 stop | Losing streak typical / bad |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
sim(all.map((t) => t.R), 'Future like 2021–2026');
sim(recent.map((t) => t.R), 'Future like the last 2 years');
sim(all.map((t) => t.R), 'Edge cut in half', 0.5);
sim(all.map((t) => t.R), 'Edge gone (break-even)', 1);
