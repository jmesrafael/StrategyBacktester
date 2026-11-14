// lab.js — Nov 13, 2026: weaknesses of the three live bots and one-change-at-a-time tweaks, on each bot's LIVE coins, Jan 2020 -> Nov 11 2026.
// Same data, costs and rules as ../coin-history-nov13 (base rows must match its totals: BB-CORE +663.3R, I-CORE +696.8R, T-CORE +1081.2R).
// runX = ../strat-hunt-nov6/engine.js run() plus: fixed target (tpR), partial at a target (partR/partFrac), breakeven (beR), stale exit,
// stop that follows the Bollinger middle (midTrail), direction switch, entry gate, cooldown after a loss.
// Every tweak is judged on BOTH halves (2020-22 and 2023-26), on profit without the 10 best trades, drawdown, losing months and how many coins it helps.
//   node lab.js  -> lab.json + console tables
'use strict';
const fs = require('fs'), path = require('path');
const Z = path.join(__dirname, '..', 'zec-replacement'), H = path.join(__dirname, '..', 'strat-hunt-nov6');
const I = require(path.join(H, 'ind.js')), { ok, N } = I;
const KX = +process.env.COSTX || 1, FEE = 0.0005 * KX, SLIP = 0.0002 * KX, IV = 14400; // COSTX=2 node lab.js = doubled fees and slippage
const LINEUP = { 'BB-CORE': ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'], 'I-CORE': ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], 'T-CORE': ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'] };
const EXTRA = ['ETH', 'SUI', 'ARB', 'BNB', 'BTC', 'DOGE', 'XRP', 'LINK', 'DOT', 'AVAX'];
const START = Date.UTC(2020, 0, 1) / 1000, END = Date.UTC(2026, 10, 12) / 1000, SPLIT = Date.UTC(2023, 0, 1) / 1000, L12 = Date.UTC(2025, 10, 12) / 1000;

function cumFunding(F) {
  const T = F.map((r) => r[0]), C = new Float64Array(F.length + 1);
  for (let i = 0; i < F.length; i++) C[i + 1] = C[i] + F[i][1];
  const idx = (t) => { let lo = 0, hi = T.length; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m + 1; else hi = m; } return lo; };
  return (t0, t1) => C[idx(t1)] - C[idx(t0)];
}
const DATA = {};
function load(c) {
  if (DATA[c]) return DATA[c];
  const f10 = path.join(Z, 'data4h-10y', c + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })); const fp = path.join(Z, 'funding', c + '.json');
  const F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null, n = B.length;
  const Hh = Float64Array.from(B, (b) => b.high), Ll = Float64Array.from(B, (b) => b.low), C = Float64Array.from(B, (b) => b.close), V = Float64Array.from(B, (b) => b.volume);
  const x = { c, B, n, H: Hh, L: Ll, C, V, atr: I.atr(Hh, Ll, C, 14), sma200: I.sma(C, 200), fr: F && F.length ? cumFunding(F) : null, cache: {} };
  return (DATA[c] = x);
}
// the same coin with only its first k candles: what the bot could know at that moment (used by verify.js, never cached)
function loadCut(c, k) {
  const full = load(c), B = full.B.slice(0, k), Hh = Float64Array.from(B, (b) => b.high), Ll = Float64Array.from(B, (b) => b.low), C = Float64Array.from(B, (b) => b.close), V = Float64Array.from(B, (b) => b.volume);
  return { c, B, n: k, H: Hh, L: Ll, C, V, atr: I.atr(Hh, Ll, C, 14), sma200: I.sma(C, 200), fr: full.fr, cache: {} };
}
const memo = (x, k, fn) => (x.cache[k] ??= fn());
// BTC regime at each candle of coin x: +1 BTC above its SMA200, -1 below
function btcReg(x) { return memo(x, 'btc', () => { const b = load('BTC'), m = new Map(); for (let i = 0; i < b.n; i++) m.set(b.B[i].time, ok(b.sma200[i]) ? (b.C[i] > b.sma200[i] ? 1 : -1) : 0); return Int8Array.from(x.B, (r) => m.get(r.time) || 0); }); }

// ---- entries (identical to strategies.js at the defaults)
function bbSig(x, p = {}) {
  const len = p.len || 20, sig = p.sigma || 2, minD = p.minD ?? 0.3, key = `bb${len}|${sig}|${minD}`;
  return memo(x, key, () => { const m = I.sma(x.C, len), s = I.stdev(x.C, len), L = new Uint8Array(x.n), S = new Uint8Array(x.n);
    for (let i = 1; i < x.n; i++) { if (!ok(x.sma200[i]) || !ok(m[i]) || !ok(x.atr[i])) continue;
      const up = m[i] + sig * s[i], lo = m[i] - sig * s[i], d = x.C[i] > up && x.C[i] > x.sma200[i] ? 1 : x.C[i] < lo && x.C[i] < x.sma200[i] ? -1 : 0; if (!d) continue;
      const dist = Math.abs(x.C[i] - m[i]); if (dist > 0 && dist >= minD * x.atr[i]) (d === 1 ? L : S)[i] = 1; }
    return { L, S, mid: Float64Array.from(m) }; });
}
function ichiSig(x) {
  return memo(x, 'ichi', () => { const kj = 26, ten = I.midHL(x.H, x.L, 9), kij = I.midHL(x.H, x.L, 26), sb = I.midHL(x.H, x.L, 52), A = ten.map((v, i) => (v + kij[i]) / 2), top = N(x.n), bot = N(x.n), L = new Uint8Array(x.n), S = new Uint8Array(x.n);
    for (let i = kj; i < x.n; i++) { const a = A[i - kj], b = sb[i - kj]; if (ok(a) && ok(b)) { top[i] = Math.max(a, b); bot[i] = Math.min(a, b); } }
    for (let i = 1; i < x.n; i++) { if (!ok(x.sma200[i]) || !ok(top[i]) || !ok(top[i - 1])) continue;
      if (x.C[i] > top[i] && x.C[i - 1] <= top[i - 1] && x.C[i] > x.sma200[i]) L[i] = 1; else if (x.C[i] < bot[i] && x.C[i - 1] >= bot[i - 1] && x.C[i] < x.sma200[i]) S[i] = 1; }
    return { L, S }; });
}
// entry gates: (x) -> (i, dir) -> bool
const GATES = {
  btc: (x) => { const r = btcReg(x); return (i, d) => r[i] === d; },                                    // only with BTC's own trend
  btcShort: (x) => { const r = btcReg(x); return (i, d) => d === 1 || r[i] === -1; },                    // shorts only while BTC is below its SMA200
  adx20: (x) => { const a = memo(x, 'adx', () => I.adx(x.H, x.L, x.C, 14).adx); return (i) => a[i] > 20; },
  adx25: (x) => { const a = memo(x, 'adx', () => I.adx(x.H, x.L, x.C, 14).adx); return (i) => a[i] > 25; },
  vol15: (x) => { const v = memo(x, 'vsma', () => I.sma(x.V, 20)); return (i) => x.V[i] > 1.5 * v[i]; },
  slope: (x) => (i, d) => i >= 30 && ok(x.sma200[i - 30]) && (d === 1 ? x.sma200[i] > x.sma200[i - 30] : x.sma200[i] < x.sma200[i - 30]), // SMA200 itself points the same way
  far: (x) => (i, d) => Math.abs(x.C[i] - x.sma200[i]) < 6 * x.atr[i],                                    // not already stretched far from the SMA200
  near: (x) => (i, d) => Math.abs(x.C[i] - x.sma200[i]) > 2 * x.atr[i],                                   // clear of the SMA200 (not chopping around it)
};

// o = { stop:'mid'|'atr', kInit, kTrail, maxBars, tpR, beR, beLock, partR, partFrac, staleBars, staleR, midTrail, dirs, gate, cooldown }
function runX(x, sig, o) {
  const { B, n, atr: ATR } = x, { L, S } = sig, mid = sig.mid, trades = [], gate = o.gate ? GATES[o.gate](x) : null;
  let pos = null, pend = null, pendClose = false, block = 0;
  function exit(px, i, why) {
    const fr = x.fr ? x.fr(B[pos.i0].time, B[i].time + IV / 2) : 0;
    let R = (pos.dir * (px - pos.entry) / pos.entry - 2 * FEE - pos.dir * fr) / pos.dist;
    if (pos.partDone) R = o.partFrac * (o.partR - 2 * FEE / pos.dist) + (1 - o.partFrac) * R;
    trades.push({ c: x.c, d: pos.dir, t0: B[pos.i0].time, t1: B[i].time + IV, R, why, bars: i - pos.i0 + 1 });
    if (R <= 0 && o.cooldown) block = i + o.cooldown;
    pos = null;
  }
  for (let i = 1; i < n; i++) {
    const b = B[i];
    if (pend) {
      const d = pend.dir, fill = b.open * (1 + d * SLIP); let stop = null, dist = 0;
      if (pend.stopPx != null) { stop = pend.stopPx; dist = Math.abs(fill - stop) / fill; if (!(dist > 0 && (d === 1 ? stop < fill : stop > fill))) stop = null; }
      else { dist = o.kInit * pend.atr / fill; stop = fill - d * o.kInit * pend.atr; }
      if (stop != null && dist > 0) pos = { dir: d, i0: i, entry: fill, stop, dist, ext: b.open, be: false, partDone: false };
      pend = null;
    }
    if (pendClose && pos) exit(b.open * (1 - pos.dir * SLIP), i, 'time');
    pendClose = false;
    if (pos) {
      const d = pos.dir, lvl = (r) => pos.entry * (1 + d * r * pos.dist), hit = (px) => (d === 1 ? b.high >= px : b.low <= px);
      if (d === 1 ? b.low <= pos.stop : b.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, b.open) : Math.max(pos.stop, b.open)) * (1 - d * SLIP), i, 'stop');
      else if (o.tpR && hit(lvl(o.tpR))) exit(lvl(o.tpR), i, 'tp');
      else {
        if (o.partR && !pos.partDone && hit(lvl(o.partR))) pos.partDone = true;
        if (o.beR && !pos.be && hit(lvl(o.beR))) { pos.be = true; const ns = lvl(o.beLock || 0); if (d === 1 ? ns > pos.stop : ns < pos.stop) pos.stop = ns; }
        if (o.kTrail > 0) { pos.ext = d === 1 ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low); const ns = pos.ext - d * o.kTrail * ATR[i]; if (d === 1 ? ns > pos.stop : ns < pos.stop) pos.stop = ns; }
        if (o.midTrail && ok(mid[i])) { const ns = mid[i]; if (d === 1 ? ns > pos.stop && ns < b.close : ns < pos.stop && ns > b.close) pos.stop = ns; }
      }
    }
    if (pos) {
      if (o.maxBars > 0 && i - pos.i0 >= o.maxBars) pendClose = true;
      else if (o.staleBars && i - pos.i0 >= o.staleBars && pos.dir * (b.close - pos.entry) / pos.entry / pos.dist < (o.staleR || 0)) pendClose = true;
      continue;
    }
    if (i < 205 || !(ATR[i] > 0) || i + 1 >= n || i < block) continue;
    const d = L[i] ? 1 : S[i] ? -1 : 0; if (!d) continue;
    if ((o.dirs === 'L' && d === -1) || (o.dirs === 'S' && d === 1)) continue;
    if (gate && !gate(i, d)) continue;
    pend = { dir: d, atr: ATR[i], stopPx: o.stop === 'mid' ? mid[i] : null };
    if (pend.stopPx != null && !(pend.stopPx > 0)) pend = null;
  }
  return trades.filter((t) => t.t1 > START && t.t1 <= END);
}

const BASE = { 'BB-CORE': { sig: 'bb', stop: 'mid', kInit: 0, kTrail: 0, maxBars: 48 }, 'I-CORE': { sig: 'ichi', stop: 'atr', kInit: 2, kTrail: 7, maxBars: 0 }, 'T-CORE': { sig: 'bb', stop: 'atr', kInit: 2, kTrail: 14, maxBars: 0 } };
function tradesOf(bot, c, ch = {}, cutAt = 0) { const o = { ...BASE[bot], ...ch }, x = cutAt ? loadCut(c, cutAt) : load(c); return runX(x, o.sig === 'bb' ? bbSig(x, o.bb) : ichiSig(x), o); }
function signalsOf(bot, c, ch = {}, cutAt = 0) { const o = { ...BASE[bot], ...ch }, x = cutAt ? loadCut(c, cutAt) : load(c); return { x, sig: o.sig === 'bb' ? bbSig(x, o.bb) : ichiSig(x) }; }

const MONTHS = []; for (let d = new Date(START * 1000); d.getTime() / 1000 < END; d.setUTCMonth(d.getUTCMonth() + 1, 1)) MONTHS.push(d.toISOString().slice(0, 7));
function measure(tr) {
  tr = [...tr].sort((a, b) => a.t1 - b.t1); const R = tr.map((t) => t.R), sum = (a) => a.reduce((s, v) => s + v, 0), w = R.filter((r) => r > 0), l = R.filter((r) => r <= 0);
  let e = 0, p = 0, dd = 0, ls = 0, cur = 0; for (const r of R) { e += r; p = Math.max(p, e); dd = Math.max(dd, p - e); cur = r <= 0 ? cur + 1 : 0; ls = Math.max(ls, cur); }
  const m = Object.fromEntries(MONTHS.map((k) => [k, 0])), y = {}; for (const t of tr) { const k = new Date(t.t1 * 1000).toISOString(); m[k.slice(0, 7)] += t.R; y[k.slice(0, 4)] = (y[k.slice(0, 4)] || 0) + t.R; }
  const mv = Object.values(m), mean = sum(mv) / mv.length, sd = Math.sqrt(sum(mv.map((v) => (v - mean) ** 2)) / (mv.length - 1));
  const top10 = sum([...R].sort((a, b) => b - a).slice(0, 10));
  return { n: tr.length, wr: w.length / tr.length, R: e, avg: e / tr.length, pf: sum(w) / -sum(l), dd, rdd: e / dd, ls, loseM: mv.filter((v) => v < 0).length / mv.length, sharpe: (mean / sd) * Math.sqrt(12),
    is: sum(tr.filter((t) => t.t1 <= SPLIT).map((t) => t.R)), oos: sum(tr.filter((t) => t.t1 > SPLIT).map((t) => t.R)), l12: sum(tr.filter((t) => t.t1 > L12).map((t) => t.R)),
    ex10: e - top10, yrs: y, yrsUp: Object.values(y).filter((v) => v > 0).length, worstYr: Math.min(...Object.values(y)), avgWin: sum(w) / w.length, avgLoss: sum(l) / l.length, holdD: sum(tr.map((t) => t.bars)) / tr.length / 6 };
}
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d), pc = (v) => (v * 100).toFixed(0) + '%';
const out = { generated: '2026-11-13', bots: {} };

// used as a library by search.js / build-report.js: stop here when required
if (require.main !== module) { module.exports = { load, tradesOf, signalsOf, measure, LINEUP, BASE, MONTHS, START, END, SPLIT, KX }; return; }

// ============ 1. weaknesses of the bots as they run today
console.log('================ WEAKNESSES (live rules, live coins) ================');
for (const bot of Object.keys(LINEUP)) {
  const tr = LINEUP[bot].flatMap((c) => tradesOf(bot, c)), M = measure(tr), sum = (a) => a.reduce((s, v) => s + v.R, 0);
  const sorted = [...tr].sort((a, b) => b.R - a.R), top = (k) => sum(sorted.slice(0, k));
  const dirY = {}; for (const t of tr) { const y = new Date(t.t1 * 1000).getUTCFullYear(), k = (t.d === 1 ? 'L' : 'S'); (dirY[k] ||= {})[y] = ((dirY[k] ||= {})[y] || 0) + t.R; }
  const buckets = [[1, 3], [4, 6], [7, 12], [13, 24], [25, 48], [49, 96], [97, 1e9]].map(([a, b]) => { const x = tr.filter((t) => t.bars >= a && t.bars <= b); return { bars: b > 1e6 ? a + '+' : a + '-' + b, n: x.length, R: sum(x), wr: x.length ? x.filter((t) => t.R > 0).length / x.length : 0 }; });
  const why = {}; for (const t of tr) { const k = t.why + (t.R > 0 ? ' win' : ' loss'); (why[k] ||= { n: 0, R: 0 }); why[k].n++; why[k].R += t.R; }
  const small = tr.filter((t) => t.R > -1.15 && t.R <= 0), big = tr.filter((t) => t.R <= -1.15);
  // concurrent exposure + cross-coin same-day losses
  const byEntry = [...tr].sort((a, b) => a.t0 - b.t0); let maxOpen = 0; for (const t of byEntry) maxOpen = Math.max(maxOpen, tr.filter((u) => u.t0 <= t.t0 && u.t1 > t.t0).length);
  const L = tr.filter((t) => t.d === 1), S = tr.filter((t) => t.d === -1);
  const w = { base: M, top1pctShare: top(Math.ceil(tr.length / 100)) / M.R, top10: top(10), top20Share: top(20) / M.R, long: { n: L.length, R: sum(L), wr: L.filter((t) => t.R > 0).length / L.length }, short: { n: S.length, R: sum(S), wr: S.filter((t) => t.R > 0).length / S.length }, dirY, buckets, why, worseThan1R: { n: big.length, R: sum(big), worst: Math.min(...tr.map((t) => t.R)) }, maxOpen };
  out.bots[bot] = { weak: w, tweaks: [] };
  console.log(`\n--- ${bot}: ${M.n} trades, win ${pc(M.wr)}, ${f(M.R, 1)}R, PF ${M.pf.toFixed(2)}, DD ${M.dd.toFixed(1)}, losing months ${pc(M.loseM)}, longest losing run ${M.ls}, avg win ${f(M.avgWin, 2)} / loss ${f(M.avgLoss, 2)}, hold ${M.holdD.toFixed(1)}d`);
  console.log(`  10 best trades = ${f(w.top10)}R (${pc(w.top10 / M.R)} of profit); top 1% of trades = ${pc(w.top1pctShare)}; top 20 = ${pc(w.top20Share)}; without the 10 best: ${f(M.ex10)}R`);
  console.log(`  longs ${L.length} tr ${f(w.long.R)}R (win ${pc(w.long.wr)}, ${f(w.long.R / L.length, 2)}/tr) | shorts ${S.length} tr ${f(w.short.R)}R (win ${pc(w.short.wr)}, ${f(w.short.R / S.length, 2)}/tr)`);
  console.log('  shorts by year: ' + Object.entries(dirY.S).map(([y, v]) => y + ' ' + f(v)).join(', ') + ' | longs by year: ' + Object.entries(dirY.L).map(([y, v]) => y + ' ' + f(v)).join(', '));
  console.log('  by hold (candles): ' + buckets.map((b) => `${b.bars}: ${b.n} tr ${f(b.R)}R win ${pc(b.wr)}`).join(' | '));
  console.log('  by exit: ' + Object.entries(why).map(([k, v]) => `${k} ${v.n} tr ${f(v.R)}R`).join(' | '));
  console.log(`  losses worse than -1.15R (gaps, costs on tight stops): ${big.length} trades, ${f(w.worseThan1R.R)}R, worst ${f(w.worseThan1R.worst, 2)}R | most positions open at once: ${maxOpen}`);
  console.log('  years: ' + Object.entries(M.yrs).map(([y, v]) => y + ' ' + f(v)).join(', '));
}

// ============ 2. tweaks, one change at a time
const T = {
  'BB-CORE': [
    ['hold 24 candles (4d)', { maxBars: 24 }], ['hold 36 (6d)', { maxBars: 36 }], ['hold 60 (10d)', { maxBars: 60 }], ['hold 72 (12d)', { maxBars: 72 }], ['hold 96 (16d)', { maxBars: 96 }],
    ['fixed target 2R', { tpR: 2 }], ['fixed target 3R', { tpR: 3 }], ['fixed target 4R', { tpR: 4 }], ['fixed target 6R', { tpR: 6 }], ['fixed target 8R', { tpR: 8 }], ['fixed target 12R', { tpR: 12 }],
    ['half off at 2R, rest runs', { partR: 2, partFrac: 0.5 }], ['half off at 3R, rest runs', { partR: 3, partFrac: 0.5 }],
    ['breakeven after +1R', { beR: 1 }], ['breakeven after +2R', { beR: 2 }], ['after +3R lock +1R', { beR: 3, beLock: 1 }],
    ['stop follows the middle band', { midTrail: true }], ['middle-band trail + hold 96', { midTrail: true, maxBars: 96 }], ['middle-band trail, no time exit', { midTrail: true, maxBars: 0 }],
    ['ATR trail 7 added', { kTrail: 7 }], ['ATR trail 10 + hold 96', { kTrail: 10, maxBars: 96 }],
    ['stale exit: out if not in profit after 12 candles', { staleBars: 12 }], ['stale exit after 24 candles', { staleBars: 24 }],
    ['min stop distance 0.5 ATR', { bb: { minD: 0.5 } }], ['min stop distance 0.75 ATR', { bb: { minD: 0.75 } }], ['min stop distance 1.0 ATR', { bb: { minD: 1 } }],
    ['bands 2.5 sigma', { bb: { sigma: 2.5 } }], ['bands 1.8 sigma', { bb: { sigma: 1.8 } }], ['Bollinger length 30', { bb: { len: 30 } }],
    ['longs only', { dirs: 'L' }], ['shorts only while BTC < SMA200', { gate: 'btcShort' }], ['trade only with BTC trend', { gate: 'btc' }],
    ['ADX > 20', { gate: 'adx20' }], ['ADX > 25', { gate: 'adx25' }], ['volume > 1.5x', { gate: 'vol15' }], ['SMA200 slope agrees', { gate: 'slope' }], ['price > 2 ATR clear of SMA200', { gate: 'near' }], ['price < 6 ATR from SMA200', { gate: 'far' }],
    ['wait 6 candles after a loss', { cooldown: 6 }], ['wait 12 candles after a loss', { cooldown: 12 }],
  ],
  'I-CORE': [
    ['trail 5 ATR', { kTrail: 5 }], ['trail 6 ATR', { kTrail: 6 }], ['trail 8 ATR', { kTrail: 8 }], ['trail 9 ATR', { kTrail: 9 }], ['trail 10 ATR', { kTrail: 10 }], ['trail 12 ATR', { kTrail: 12 }], ['trail 14 ATR', { kTrail: 14 }],
    ['first stop 1.5 ATR', { kInit: 1.5 }], ['first stop 2.5 ATR', { kInit: 2.5 }], ['first stop 3 ATR', { kInit: 3 }],
    ['fixed target 4R', { tpR: 4 }], ['fixed target 8R', { tpR: 8 }], ['fixed target 15R', { tpR: 15 }], ['half off at 3R, rest runs', { partR: 3, partFrac: 0.5 }], ['half off at 5R, rest runs', { partR: 5, partFrac: 0.5 }],
    ['breakeven after +1R', { beR: 1 }], ['breakeven after +2R', { beR: 2 }], ['after +3R lock +1R', { beR: 3, beLock: 1 }],
    ['time exit 48 candles', { maxBars: 48 }], ['time exit 96', { maxBars: 96 }], ['time exit 192', { maxBars: 192 }],
    ['stale exit after 12 candles', { staleBars: 12 }], ['stale exit after 24 candles', { staleBars: 24 }], ['stale exit after 48 candles', { staleBars: 48 }],
    ['longs only', { dirs: 'L' }], ['shorts only while BTC < SMA200', { gate: 'btcShort' }], ['trade only with BTC trend', { gate: 'btc' }],
    ['ADX > 20', { gate: 'adx20' }], ['ADX > 25', { gate: 'adx25' }], ['volume > 1.5x', { gate: 'vol15' }], ['SMA200 slope agrees', { gate: 'slope' }], ['price > 2 ATR clear of SMA200', { gate: 'near' }], ['price < 6 ATR from SMA200', { gate: 'far' }],
    ['wait 6 candles after a loss', { cooldown: 6 }], ['wait 12 candles after a loss', { cooldown: 12 }],
  ],
  'T-CORE': [
    ['trail 8 ATR', { kTrail: 8 }], ['trail 10 ATR', { kTrail: 10 }], ['trail 12 ATR', { kTrail: 12 }], ['trail 17 ATR', { kTrail: 17 }], ['trail 20 ATR', { kTrail: 20 }],
    ['first stop 1.5 ATR', { kInit: 1.5 }], ['first stop 2.5 ATR', { kInit: 2.5 }], ['first stop 3 ATR', { kInit: 3 }], ['first stop at middle band (BB-CORE stop)', { stop: 'mid' }],
    ['fixed target 8R', { tpR: 8 }], ['fixed target 15R', { tpR: 15 }], ['fixed target 25R', { tpR: 25 }], ['half off at 3R, rest runs', { partR: 3, partFrac: 0.5 }], ['half off at 5R, rest runs', { partR: 5, partFrac: 0.5 }], ['third off at 5R, rest runs', { partR: 5, partFrac: 0.33 }],
    ['breakeven after +1R', { beR: 1 }], ['breakeven after +2R', { beR: 2 }], ['breakeven after +3R', { beR: 3 }], ['after +3R lock +1R', { beR: 3, beLock: 1 }], ['after +5R lock +2R', { beR: 5, beLock: 2 }],
    ['time exit 96 candles', { maxBars: 96 }], ['time exit 192', { maxBars: 192 }], ['time exit 360', { maxBars: 360 }],
    ['stale exit after 12 candles', { staleBars: 12 }], ['stale exit after 24 candles', { staleBars: 24 }], ['stale exit after 48 candles', { staleBars: 48 }], ['out if under +1R after 48 candles', { staleBars: 48, staleR: 1 }],
    ['min stop distance 0.75 ATR at signal', { bb: { minD: 0.75 } }], ['bands 2.5 sigma', { bb: { sigma: 2.5 } }], ['Bollinger length 30', { bb: { len: 30 } }],
    ['longs only', { dirs: 'L' }], ['shorts only while BTC < SMA200', { gate: 'btcShort' }], ['trade only with BTC trend', { gate: 'btc' }],
    ['ADX > 20', { gate: 'adx20' }], ['ADX > 25', { gate: 'adx25' }], ['volume > 1.5x', { gate: 'vol15' }], ['SMA200 slope agrees', { gate: 'slope' }], ['price > 2 ATR clear of SMA200', { gate: 'near' }], ['price < 6 ATR from SMA200', { gate: 'far' }],
    ['wait 6 candles after a loss', { cooldown: 6 }], ['wait 12 candles after a loss', { cooldown: 12 }],
  ],
};
// combos are added after the single tweaks are known (argv: node lab.js combos) — see COMBOS
const COMBOS = fs.existsSync(path.join(__dirname, 'combos.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'combos.json'), 'utf8')) : {};

function evalTweak(bot, name, ch, baseByCoin, base) {
  const byCoin = Object.fromEntries(LINEUP[bot].map((c) => [c, tradesOf(bot, c, ch)])), M = measure(Object.values(byCoin).flat());
  const helped = LINEUP[bot].filter((c) => byCoin[c].reduce((s, t) => s + t.R, 0) > baseByCoin[c]).length;
  // a tweak "holds up" only if it is not worse in either half, keeps the profit without the 10 best trades, and does not deepen the drawdown by more than 10%
  const robust = M.is >= base.is * 0.98 && M.oos >= base.oos * 0.98 && M.ex10 >= base.ex10 * 0.98 && M.dd <= base.dd * 1.1 && M.R > base.R * 1.02;
  const safer = M.dd <= base.dd * 0.85 && M.loseM <= base.loseM + 0.001 && M.R >= base.R * 0.9 && M.is >= base.is * 0.85 && M.oos >= base.oos * 0.85;
  return { name, ch, ...M, helped, nCoins: LINEUP[bot].length, robust, safer };
}
const row = (r, base) => `${(r.robust ? '** ' : r.safer ? 's  ' : '   ') + r.name.padEnd(46)} ${String(r.n).padStart(5)} ${pc(r.wr).padStart(4)} ${f(r.R).padStart(6)} (${f(r.R - base.R).padStart(5)}) PF ${r.pf.toFixed(2)} DD ${r.dd.toFixed(0).padStart(3)} R/DD ${r.rdd.toFixed(1).padStart(5)} loseM ${pc(r.loseM).padStart(4)} run ${String(r.ls).padStart(2)} | 20-22 ${f(r.is).padStart(5)} 23-26 ${f(r.oos).padStart(5)} L12 ${f(r.l12).padStart(5)} | ex10 ${f(r.ex10).padStart(5)} | yrs ${r.yrsUp}/7 worst ${f(r.worstYr).padStart(4)} | helps ${r.helped}/${r.nCoins}`;
console.log('\n\n================ TWEAKS (** = better in both halves, without the 10 best trades, drawdown not deeper; s = clearly safer for little profit) ================');
for (const bot of Object.keys(LINEUP)) {
  const baseByCoin = Object.fromEntries(LINEUP[bot].map((c) => [c, tradesOf(bot, c).reduce((s, t) => s + t.R, 0)])), base = out.bots[bot].weak.base;
  console.log(`\n--- ${bot}`); console.log(row({ name: 'TODAY (live rules)', ...base, helped: 0, nCoins: LINEUP[bot].length }, base));
  for (const [name, ch] of [...T[bot], ...(COMBOS[bot] || [])]) { const r = evalTweak(bot, name, ch, baseByCoin, base); out.bots[bot].tweaks.push(r); console.log(row(r, base)); }
}

// ============ 3. coins: take one out / put one in, per bot
console.log('\n\n================ COINS (each bot today, minus one coin / plus one coin) ================');
for (const bot of Object.keys(LINEUP)) {
  const tr = Object.fromEntries([...new Set([...LINEUP[bot], ...EXTRA])].map((c) => [c, tradesOf(bot, c)])), base = measure(LINEUP[bot].flatMap((c) => tr[c]));
  const line = (label, coins) => { const M = measure(coins.flatMap((c) => tr[c])); return { label, ...M }; };
  const rows = [...LINEUP[bot].map((c) => line('without ' + c, LINEUP[bot].filter((k) => k !== c))), ...EXTRA.filter((c) => !LINEUP[bot].includes(c)).map((c) => { const own = measure(tr[c]); return { ...line('with ' + c, [...LINEUP[bot], c]), own }; })];
  out.bots[bot].coins = { base, rows };
  console.log(`\n--- ${bot} today: ${f(base.R)}R, DD ${base.dd.toFixed(0)}, R/DD ${base.rdd.toFixed(1)}, losing months ${pc(base.loseM)}, Sharpe ${base.sharpe.toFixed(2)}, worst year ${f(base.worstYr)}`);
  for (const r of rows) console.log(`   ${r.label.padEnd(14)} ${f(r.R).padStart(6)} (${f(r.R - base.R).padStart(5)}) DD ${r.dd.toFixed(0).padStart(3)} R/DD ${r.rdd.toFixed(1).padStart(5)} loseM ${pc(r.loseM).padStart(4)} Sharpe ${r.sharpe.toFixed(2)} worstYr ${f(r.worstYr).padStart(4)} 23-26 ${f(r.oos).padStart(5)}${r.own ? ` | alone: ${f(r.own.R)}R, yrs ${r.own.yrsUp}/${Object.keys(r.own.yrs).length}, PF ${r.own.pf.toFixed(2)}, ex10 ${f(r.own.ex10)}` : ''}`);
}
// ============ 4. finalists: year by year and coin by coin
const FINAL = { 'BB-CORE': [['bands 1.9 sigma', { bb: { sigma: 1.9 } }], ['bands 1.8 sigma', { bb: { sigma: 1.8 } }]], 'I-CORE': [['after +3R lock +1R', { beR: 3, beLock: 1 }], ['trail 8 ATR', { kTrail: 8 }], ['trail 8 + after +3R lock +1R', { kTrail: 8, beR: 3, beLock: 1 }]], 'T-CORE': [['out if under +1R after 48 candles', { staleBars: 48, staleR: 1 }], ['length 30 + out if under +1R after 48', { bb: { len: 30 }, staleBars: 48, staleR: 1 }]] };
console.log('\n\n================ FINALISTS (costs x' + KX + ') ================');
for (const bot of Object.keys(LINEUP)) for (const [name, ch] of [['TODAY', {}], ...FINAL[bot]]) {
  const by = Object.fromEntries(LINEUP[bot].map((c) => [c, tradesOf(bot, c, ch)])), M = measure(Object.values(by).flat());
  console.log(`FIN ${bot} | ${name.padEnd(38)} ${f(M.R).padStart(6)} DD ${M.dd.toFixed(0)} loseM ${pc(M.loseM)} run ${M.ls} win ${pc(M.wr)} | ${Object.entries(M.yrs).map(([y, v]) => y.slice(2) + ':' + f(v)).join(' ')} | ${LINEUP[bot].map((c) => c + ' ' + f(by[c].reduce((a, t) => a + t.R, 0))).join(' ')}`);
}
fs.writeFileSync(path.join(__dirname, KX === 1 ? 'lab.json' : 'lab-cost' + KX + '.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
