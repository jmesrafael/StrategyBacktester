// hyp-live.js — H1–H8 re-run "as live": each rule filters v7's SETUPS before the execution engine runs, so a skipped setup frees
// the slot for later setups exactly as it would in live trading. Random control: keep each setup at random with the rule's keep
// rate (per coin), re-run the engine, 1,000 times. Same pass criteria as the protocol (ITERATION-LOG.md, H1–H8).
// usage: node hyp-live.js → results/hyp-live.md
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js'), PD = require('./pdny.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const SPLIT = D0('2023-10-18'), END = D0('2026-10-18'), START = { SOL: D0('2020-10-18'), ETH: D0('2019-12-15') };
let seed = 7; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
function htf(B, sec, len) {
  const m = new Map(); let bk = null, close = null, ema = null, n = 0, sum = 0; const k = 2 / (len + 1);
  const flush = () => { if (bk == null) return; n++; if (n <= len) { sum += close; if (n === len) ema = sum / len; } else ema = close * k + ema * (1 - k); m.set(bk, { close, ema }); };
  for (const b of B) { const x = Math.floor(b.time / sec); if (x !== bk) { flush(); bk = x; } close = b.close; }
  return m;
}
const lastDone = (m, sec, tClose) => m.get(Math.floor(tClose / sec) - 1);
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
const btc = htf(JSON.parse(fs.readFileSync('data/binance-btc15.json', 'utf8')).map(([time, , , , close]) => ({ time, close })), 3600, 50);
const H = { H1: 'Weekday only (Mon–Fri ET)', H2: 'With the daily trend (EMA20)', H3: 'With the 4h trend (EMA50)', H4: 'CHoCH volume ≥ 1.5× avg',
  H5: 'Leg swept the overnight range', H6: 'BTC 1h agrees (EMA50)', H7: 'Regime switch: last 20 v7 trades > 0R', H8: 'Daily volatility in top half of year' };
const coin = {};
for (const sym of ['SOL', 'ETH']) {
  const D = E.analyze(sym + '-binance', JSON.parse(fs.readFileSync(`data/binance-${sym.toLowerCase()}15.json`, 'utf8')), C.swingLen), B = D.B;
  const S = E.setupsFor(D, C), base = E.execute(D, C, S);
  const d1 = htf(B, 86400, 20), h4 = htf(B, 14400, 50), datr = dailyAtr(B), on = new Map();
  for (const b of B) { const e = PD.et(b.time); if (e.min >= 510) continue; const o = on.get(e.day); on.set(e.day, o ? { hi: Math.max(o.hi, b.high), lo: Math.min(o.lo, b.low) } : { hi: b.high, lo: b.low }); }
  const closed = base.map((t) => [B[t.exitIdx].time + 900, t.R]); // shadow v7 (always tracked, as in paper trading)
  const feats = S.map((s) => {
    const c = s.chochIdx, tClose = B[c].time + 900, dir = s.long ? 1 : -1, sigT = B[s.fvgIdx].time + 900;
    const e = PD.et(B[c].time), wd = new Date(e.day + 'T12:00:00Z').getUTCDay(), legX = s.long ? s.stop / (1 - C.slBufferPct) : s.stop / (1 + C.slBufferPct);
    const dd = lastDone(d1, 86400, tClose), hh = lastDone(h4, 14400, tClose), bb = lastDone(btc, 3600, tClose);
    let vs = 0; for (let j = c - 20; j < c; j++) vs += B[j].volume;
    const o = on.get(e.day), va = datr.get(Math.floor(tClose / 86400) - 1), last20 = closed.filter((x) => x[0] < sigT).slice(-20);
    return {
      H1: wd >= 1 && wd <= 5, H2: dd && dd.ema != null ? dir * (dd.close - dd.ema) > 0 : true, H3: hh && hh.ema != null ? dir * (hh.close - hh.ema) > 0 : true,
      H4: B[c].volume >= 1.5 * (vs / 20), H5: o && e.min >= 510 ? (s.long ? legX < o.lo : legX > o.hi) : true,
      H6: bb && bb.ema != null ? dir * (bb.close - bb.ema) > 0 : true, H7: last20.length < 20 ? true : last20.reduce((a, x) => a + x[1], 0) > 0, H8: va ? va.v >= va.mid : true,
    };
  });
  coin[sym] = { D, S, feats };
}
const run = (keep) => { const out = []; for (const sym of ['SOL', 'ETH']) { const { D, S } = coin[sym]; for (const t of E.execute(D, C, S.filter((s, i) => keep(sym, i)))) if (t.t >= START[sym] && t.t < END) out.push({ sym, post: t.t >= SPLIT, R: t.R }); } return out; };
const cells = [['SOL', false], ['SOL', true], ['ETH', false], ['ETH', true]];
const avg = (a) => (a.length ? a.reduce((x, t) => x + t.R, 0) / a.length : NaN), sumR = (a) => a.reduce((x, t) => x + t.R, 0);
const f2 = (x) => (isNaN(x) ? '—' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(2));
const v7 = run(() => true);
const L = ['# Hypothesis round H1–H8, live-style simulation (setups filtered before execution) — SOL + ETH, Binance 15m, $1 risk', '',
  'Cell = average R per trade (trades). Random control = same per-coin setup keep rate, re-simulated 1,000×.', '',
  '| Rule | SOL 19–23 | SOL 23–26 | ETH 19–23 | ETH 23–26 | Cells better | Trades vs v7 | Pooled avg | Random percentile | Total R | **Pass** |', '|---|---|---|---|---|---|---|---|---|---|---|'];
L.push(`| v7 | ${cells.map(([s, p]) => { const a = v7.filter((t) => t.sym === s && t.post === p); return `${f2(avg(a))} (${a.length})`; }).join(' | ')} | — | 100% | ${f2(avg(v7))} | — | ${sumR(v7).toFixed(1)} | — |`);
for (const [h, name] of Object.entries(H)) {
  const tr = run((sym, i) => coin[sym].feats[i][h]);
  let better = 0;
  const txt = cells.map(([s, p]) => { const a = tr.filter((t) => t.sym === s && t.post === p), b = v7.filter((t) => t.sym === s && t.post === p); if (avg(a) > avg(b)) better++; return `${f2(avg(a))} (${a.length})`; });
  const rate = Object.fromEntries(['SOL', 'ETH'].map((s) => [s, coin[s].feats.filter((f) => f[h]).length / coin[s].feats.length]));
  const pooled = avg(tr); let below = 0;
  for (let i = 0; i < 1000; i++) if (avg(run((sym) => rnd() < rate[sym])) < pooled) below++;
  const pct = below / 10, share = tr.length / v7.length, pass = better >= 3 && pct >= 95 && share >= 0.4;
  L.push(`| ${h} ${name} | ${txt.join(' | ')} | ${better}/4 | ${(share * 100).toFixed(0)}% | ${f2(pooled)} | ${pct.toFixed(1)} | ${sumR(tr).toFixed(1)} | ${pass ? '✅' : '❌'} |`);
  process.stderr.write(h + ' done\n');
}
fs.writeFileSync('results/hyp-live.md', L.join('\n') + '\n');
console.log(L.join('\n'));
