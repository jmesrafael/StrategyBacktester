// venue-parity.js — Binance vs MEXC SIGNAL parity per calendar year, and the cause of every disagreement from 2024 on.
//   node audit/venue-parity.js
// Signal = the entry rule evaluated on every closed candle, ignoring position state (so one venue's open trade can't hide a signal):
//   same candle + same direction = agree.  Year = year of the signal candle.  Each venue uses its own 200-candle warm-up (first 202 candles skipped).
// Cause of a disagreement is found by counterfactual substitution on the venue that DID differ, not guessed:
//   close  : replace that venue's CLOSES by the other venue's (high/low kept)  -> does the signal now match?
//   wick   : replace that venue's HIGH/LOW by the other venue's (close kept)    -> does it match? (high/low only enter via ATR14 and the stop-too-tight filter)
//   gap    : the candle (or one of the 200 before it) is missing in one venue's file
// 'both' = neither substitution alone fixes it, but swapping everything does.
'use strict';
const fs = require('fs'), path = require('path');
const { signalFrom, DEFAULTS } = require('../lucidio-core.js');
const D = path.join(__dirname, '..', 'data'), IV = 14400;
const rd = (c) => JSON.parse(fs.readFileSync(path.join(D, c + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const yr = (t) => new Date(t * 1000).getUTCFullYear();

// raw signal per candle (position-free). Returns Map(time -> {dir, detail}) plus a diagnostics fn for a given index.
function atrSeries(B) {
  const n = B.length, atr = new Array(n).fill(null); let a = null;
  for (let i = 0; i < n; i++) {
    const tr = i === 0 ? B[i].high - B[i].low : Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close));
    if (i === 13) { let s = 0; for (let j = 0; j < 14; j++) s += j === 0 ? B[0].high - B[0].low : Math.max(B[j].high - B[j].low, Math.abs(B[j].high - B[j - 1].close), Math.abs(B[j].low - B[j - 1].close)); a = s / 14; }
    else if (i > 13) a = (a * 13 + tr) / 14;
    atr[i] = a;
  }
  return atr;
}
function signals(B) {
  const atr = atrSeries(B), closes = B.map((b) => b.close), m = new Map();
  for (let i = DEFAULTS.warmup; i < B.length; i++) {
    const s = signalFrom(closes.slice(Math.max(0, i - 399), i + 1), atr[i], { gapSkip: false });
    if (s) m.set(B[i].time, s.dir);
  }
  return m;
}
const byTime = (B) => new Map(B.map((b, i) => [b.time, i]));
// why does venue X have NO signal (or a different one) at time t? returns the failing condition + margins (for the report)
function explain(B, i) {
  const closes = B.slice(Math.max(0, i - 399), i + 1).map((b) => b.close), atr = atrSeries(B)[i], n = closes.length, c = closes[n - 1];
  const w = closes.slice(-20), mid = w.reduce((a, b) => a + b, 0) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / 20), up = mid + 2 * sd, lo = mid - 2 * sd;
  const sma = closes.slice(-200).reduce((a, b) => a + b, 0) / 200, dist = Math.abs(c - mid);
  const longSide = c > mid, band = longSide ? c > up : c < lo, trend = longSide ? c >= sma : c <= sma, atrOk = dist >= 0.3 * atr;
  const fails = [!band && 'Bollinger band', !trend && 'SMA200 trend', !atrOk && 'ATR stop filter'].filter(Boolean).join('+') || 'none (signal present)';
  return { fails, c, up, lo, sma, mid, atr, dist, bandMarginPct: 100 * (c > mid ? (c - up) / c : (lo - c) / c), smaMarginPct: 100 * (c - sma) / c, atrRatio: dist / atr };
}
function hasGapNear(B, t) { // true if candle t is absent or any of the 200 candles before it is
  const idx = byTime(B).get(t); if (idx == null) return true;
  for (let j = Math.max(1, idx - 199); j <= idx; j++) if (B[j].time - B[j - 1].time !== IV) return true;
  return false;
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '  n/a').toString().padStart(5) + '%';

let allCauses = [];
for (const coin of ['SOL', 'ZEC']) {
  const BB = rd(coin), MM = rd('MEXC_' + coin), sb = signals(BB), sm = signals(MM), ib = byTime(BB), im = byTime(MM);
  console.log(`\n================ ${coin}: Binance ${BB.length} candles (${iso(BB[0].time)}..${iso(BB[BB.length - 1].time)}) | MEXC ${MM.length} candles (${iso(MM[0].time)}..${iso(MM[MM.length - 1].time)}) ================`);
  console.log('year | Binance sigs | MEXC sigs | both agree | agree/Binance | agree/MEXC | agree/union | only-Binance | only-MEXC | opposite dir');
  const rows = {}, dis = [], missing = {};
  const times = new Set([...sb.keys(), ...sm.keys()]);
  for (const t of [...times].sort((a, b) => a - b)) {
    const y = yr(t), r = (rows[y] = rows[y] || { b: 0, m: 0, both: 0, onlyB: 0, onlyM: 0, opp: 0 });
    const db = sb.get(t), dm = sm.get(t);
    if (db) r.b++; if (dm) r.m++;
    if (db && dm && db === dm) r.both++;
    else {
      if (db && dm) r.opp++; else if (db) r.onlyB++; else r.onlyM++;
      dis.push({ t, db: db || 0, dm: dm || 0 });
      if (!(db ? im : ib).has(t)) missing[y] = (missing[y] || 0) + 1;
    }
  }
  const tot = { b: 0, m: 0, both: 0, onlyB: 0, onlyM: 0, opp: 0 };
  for (const y of Object.keys(rows).sort()) {
    const r = rows[y]; for (const k in tot) tot[k] += r[k];
    const union = r.b + r.m - r.both;
    console.log(`${y} | ${String(r.b).padStart(12)} | ${String(r.m).padStart(9)} | ${String(r.both).padStart(10)} | ${pct(r.both, r.b).padStart(13)} | ${pct(r.both, r.m).padStart(10)} | ${pct(r.both, union).padStart(11)} | ${String(r.onlyB).padStart(12)} | ${String(r.onlyM).padStart(9)} | ${String(r.opp).padStart(12)}`);
  }
  const union = tot.b + tot.m - tot.both;
  console.log('disagreements on candles that do not exist in the other venue file (no data at all, not a price difference): ' + (Object.keys(missing).sort().map((y) => y + ':' + missing[y]).join('  ') || 'none') + '   <- 2020 only; warm-up/start dates differ and MEXC_ZEC has a 63-day hole');
  console.log(`ALL  | ${String(tot.b).padStart(12)} | ${String(tot.m).padStart(9)} | ${String(tot.both).padStart(10)} | ${pct(tot.both, tot.b).padStart(13)} | ${pct(tot.both, tot.m).padStart(10)} | ${pct(tot.both, union).padStart(11)} | ${String(tot.onlyB).padStart(12)} | ${String(tot.onlyM).padStart(9)} | ${String(tot.opp).padStart(12)}`);

  // ---- every disagreement from 2024 on, with cause
  const late = dis.filter((d) => yr(d.t) >= 2024);
  console.log(`\n${coin}: ${late.length} disagreements from 2024-01-01 on (signal-candle time, who signalled, cause, evidence)`);
  // substitution helpers: build venue A's candles with some fields taken from venue B (matched on time)
  const subst = (A, Bv, fields) => { const mb = byTime(Bv); return A.map((a) => { const j = mb.get(a.time); if (j == null) return a; const b = Bv[j]; const o = { ...a }; for (const f of fields) o[f] = b[f]; return o; }); };
  const cache = {};
  const sig = (key, mk) => (cache[key] = cache[key] || signals(mk()));
  for (const d of late) {
    const who = d.db && d.dm ? `opposite (Bin ${d.db > 0 ? 'L' : 'S'} / MEXC ${d.dm > 0 ? 'L' : 'S'})` : d.db ? `Binance only (${d.db > 0 ? 'LONG' : 'SHORT'})` : `MEXC only (${d.dm > 0 ? 'LONG' : 'SHORT'})`;
    let cause, ev = '';
    if (hasGapNear(BB, d.t) || hasGapNear(MM, d.t)) { cause = 'gap'; ev = `candle or one of the 200 before it missing in ${hasGapNear(BB, d.t) ? 'Binance' : 'MEXC'}`; }
    else {
      // the venue that is "wrong" relative to the other: test substituting into the one WITHOUT the other's signal. Target = the other venue's signal state at t.
      const fixVenue = d.db && !d.dm ? 'M' : !d.db && d.dm ? 'B' : 'M'; // for opposite, fix MEXC toward Binance
      const A = fixVenue === 'M' ? MM : BB, O = fixVenue === 'M' ? BB : MM, want = fixVenue === 'M' ? d.db : d.dm;
      const k = (f) => `${fixVenue}:${f}`;
      const sC = sig(k('close'), () => subst(A, O, ['close'])).get(d.t) || 0, sW = sig(k('hl'), () => subst(A, O, ['high', 'low'])).get(d.t) || 0, sA = sig(k('all'), () => subst(A, O, ['open', 'high', 'low', 'close'])).get(d.t) || 0;
      const x = explain(A, (fixVenue === 'M' ? im : ib).get(d.t)), xo = explain(O, (fixVenue === 'M' ? ib : im).get(d.t));
      const dc = 100 * (x.c / xo.c - 1);
      const one = subst(A, O, ['close']).map((b, ix) => (b.time === d.t ? b : A[ix])); // only the signal bar's own close swapped
      const sOne = signals(one).get(d.t) || 0;
      if (sOne === want && sW !== want) cause = 'close difference (signal bar)';
      else if (sC === want && sW !== want) cause = 'close differences earlier in the 20/200-bar window';
      else if (sW === want && sC !== want) cause = 'wick (high/low -> ATR filter)';
      else if (sC === want && sW === want) cause = 'close difference (wick swap also fixes it)';
      else if (sA === want) cause = 'close+wick combined';
      else cause = 'indicator history (earlier candles differ)';
      ev = `${fixVenue === 'M' ? 'MEXC' : 'Binance'} had no signal, failing: ${x.fails} | close diff vs other venue ${dc >= 0 ? '+' : ''}${dc.toFixed(3)}% | band margin ${x.bandMarginPct.toFixed(3)}% (>0 = beyond band) | close-vs-SMA200 ${x.smaMarginPct.toFixed(3)}% | stop-dist/ATR ${x.atrRatio.toFixed(2)} (min 0.30) vs other venue ${xo.atrRatio.toFixed(2)} | ATR ${x.atr.toPrecision(5)} vs ${xo.atr.toPrecision(5)}`;
    }
    allCauses.push({ coin, cause });
    console.log(`  ${iso(d.t)}  ${who.padEnd(34)} cause: ${cause.padEnd(40)} ${ev}`);
  }
}
const sum = {}; allCauses.forEach((c) => (sum[c.cause] = (sum[c.cause] || 0) + 1));
console.log('\nCAUSE SUMMARY (SOL+ZEC, 2024 onward):', JSON.stringify(sum), ' total', allCauses.length);
