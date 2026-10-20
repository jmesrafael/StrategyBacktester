// lib.js — fast research engine for Bollinger strategies.
// Same indicator math as the app (js/indicators.js is loaded verbatim) and the same fill rules as the app's
// Strategy-mode simulate(): signal on a bar's close -> market fill at the NEXT open (+slippage), stop / target
// touched intrabar (stop first if one bar hits both, gap fills at the open), slippage on every exit, commission
// both sides. R = result / amount risked at the stop, so 1R = $1 at "$1 risk per trade".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const ctx = { Math, Array, Object, Number, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/indicators.js'), 'utf8') +
  '\n;this.IND = { sma, ema, atr, adx, bollinger, rsi, highest, lowest };', ctx);
const IND = ctx.IND;

const DATA = path.join(ROOT, 'research/ny-smc-iterations/data');
const _raw = {};
function loadRaw(sym) {
  if (!_raw[sym]) _raw[sym] = JSON.parse(fs.readFileSync(path.join(DATA, `binance-${sym.toLowerCase()}15.json`), 'utf8'));
  return _raw[sym];
}
// 15m rows [time, o, h, l, c, v] -> bars aggregated to `min` minutes (whole buckets only)
const _bars = {};
function bars(sym, min) {
  const key = sym + min;
  if (_bars[key]) return _bars[key];
  const TFN = { 5: '5m', 15: '15m', 60: '1h', 240: '4h' }[min];
  const ftf = TFN && path.join(__dirname, 'datatf', TFN, sym + '.json'); // native klines from fetchtf.js
  if (ftf && fs.existsSync(ftf))
    return (_bars[key] = JSON.parse(fs.readFileSync(ftf, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })));
  const f4 = path.join(__dirname, 'data4h', sym + '.json'); // coins with only native 4h data (fetch4h.js)
  if (min === 240 && fs.existsSync(f4))
    return (_bars[key] = JSON.parse(fs.readFileSync(f4, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })));
  const raw = loadRaw(sym), per = min / 15, out = [];
  if (per === 1) { for (const r of raw) out.push({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }); }
  else {
    const sec = min * 60;
    let cur = null, cnt = 0;
    for (const r of raw) {
      const b = Math.floor(r[0] / sec) * sec;
      if (!cur || cur.time !== b) { if (cur && cnt === per) out.push(cur); cur = { time: b, open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }; cnt = 1; }
      else { cur.high = Math.max(cur.high, r[2]); cur.low = Math.min(cur.low, r[3]); cur.close = r[4]; cur.volume += r[5]; cnt++; }
    }
    if (cur && cnt === per) out.push(cur);
  }
  return (_bars[key] = out);
}

// indicator cache per (sym, tf)
const _ind = {};
function ind(sym, min) {
  const key = sym + min;
  if (_ind[key]) return _ind[key];
  const B = bars(sym, min);
  const o = { B, closes: B.map((b) => b.close), _bb: {}, _atr: {}, _adx: {}, _sma: {} };
  o.bb = (n, k) => o._bb[n + ',' + k] || (o._bb[n + ',' + k] = IND.bollinger(o.closes, n, k));
  o.atr = (n) => o._atr[n] || (o._atr[n] = IND.atr(B, n));
  o.adx = (n) => o._adx[n] || (o._adx[n] = IND.adx(B, n));
  o.sma = (n) => o._sma[n] || (o._sma[n] = IND.sma(o.closes, n));
  return (_ind[key] = o);
}

const COST = { comm: 0.0004, slip: 0.0002 };

// sig(i) -> null | { dir:1|-1, stop, tp?, trail?, be?, maxBars? } decided at the CLOSE of bar i (only called while flat).
// Returns trades [{ dir, i0 (entry bar), i1 (exit bar), t (entry time), R, why }].
function run(B, sig, warm, cost = COST) {
  const n = B.length, trades = [];
  let pos = null, pending = null;
  for (let i = 0; i < n; i++) {
    const c = B[i];
    if (pending) {
      if (pending.kind === 'open' && !pos) {
        const d = pending.o.dir, fill = c.open * (1 + d * cost.slip);
        const stop = pending.o.stop, dist = Math.abs(fill - stop) / fill;
        if (dist > 0 && (d === 1 ? stop < fill : stop > fill)) {
          pos = { dir: d, entry: fill, i0: i, sl: stop, tp: pending.o.tp == null ? null : pending.o.tp, trail: pending.o.trail || null,
            be: pending.o.be == null ? null : pending.o.be, beDone: false, ext: fill, maxBars: pending.o.maxBars || 0, dist };
          if (pos.trail && pos.sl == null) pos.sl = fill - d * pos.trail;
        }
      } else if (pending.kind === 'close' && pos) closeAt(c.open, i, 'time');
      pending = null;
    }
    if (pos) {
      const d = pos.dir;
      const hitSL = pos.sl != null && (d === 1 ? c.low <= pos.sl : c.high >= pos.sl);
      const hitTP = pos.tp != null && (d === 1 ? c.high >= pos.tp : c.low <= pos.tp);
      if (hitSL) closeAt(d === 1 ? Math.min(pos.sl, c.open) : Math.max(pos.sl, c.open), i, 'sl');
      else if (hitTP) closeAt(d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open), i, 'tp');
      if (pos) { // survived: trail / break-even from the finished bar (applies from the next bar)
        pos.ext = d === 1 ? Math.max(pos.ext, c.high) : Math.min(pos.ext, c.low);
        if (pos.trail) { const lvl = pos.ext - d * pos.trail; if (d === 1 ? lvl > pos.sl : lvl < pos.sl) pos.sl = lvl; }
        if (pos.be != null && !pos.beDone && (d === 1 ? c.high >= pos.be : c.low <= pos.be)) {
          pos.beDone = true; if (d === 1 ? pos.entry > pos.sl : pos.entry < pos.sl) pos.sl = pos.entry;
        }
        if (pos.maxBars && i - pos.i0 >= pos.maxBars && !pending) pending = { kind: 'close' };
      }
    }
    if (!pos && !pending && i >= warm && i < n - 1) {
      const o = sig(i);
      if (o) pending = { kind: 'open', o };
    }
  }
  if (pos) closeAt(B[n - 1].close, n - 1, 'end');
  return trades;

  function closeAt(price, i, why) {
    const d = pos.dir, exit = price * (1 - d * cost.slip);
    const R = (d * (exit - pos.entry) / pos.entry - 2 * cost.comm) / pos.dist;
    trades.push({ dir: d, i0: pos.i0, i1: i, t: B[pos.i0].time, R, why });
    pos = null;
  }
}

// ---- limit-order engine (pullback entries). Mirrors the app's simulate(): a limit order decided on bar i's close is placed at bar
// i+1's open and rests until a bar trades through it (fill at the limit, or at the open if the bar gapped past it, NO slippage). On a
// bar where the fill happened mid-bar only the stop counts (the bar's best price may have come first) and no trail / break-even is
// armed. Stops / targets are absolute prices; exits pay slippage; commission both sides.
// sig(i) -> null | { dir, limit, stop, tp?, expire (bars the order may rest, 0 = forever), maxBars? } | { cancel: true }
function runLO(B, sig, warm, cost = COST) {
  const n = B.length, trades = [];
  let pos = null, pending = null, resting = null;
  for (let i = 0; i < n; i++) {
    const c = B[i];
    if (pending) {
      if (pending.kind === 'limit') { if (!pos) resting = { ...pending.o, sigBar: pending.sigBar }; }
      else if (pending.kind === 'cancel') resting = null;
      else if (pending.kind === 'close' && pos) closeAt(c.open, i, 'time');
      pending = null;
    }
    let limitBar = false;
    if (resting && !pos) {
      const d = resting.dir, lim = resting.limit;
      const buf = resting.buf || 0; // stress: price must trade THROUGH the limit by `buf` before it counts as filled (touch is not a fill)
      const fill = d === 1 ? (c.low <= lim - buf ? Math.min(c.open, lim) : null) : (c.high >= lim + buf ? Math.max(c.open, lim) : null);
      if (fill != null) {
        const o = resting; resting = null;
        const dist = Math.abs(fill - o.stop) / fill;
        if (dist > 0 && (d === 1 ? o.stop < fill : o.stop > fill)) {
          pos = { dir: d, entry: fill, i0: i, sl: o.stop, tp: o.tp == null ? null : o.tp, maxBars: o.maxBars || 0, dist, beR: o.be == null ? null : o.be, beDone: false };
          limitBar = fill !== c.open;
        }
      }
    }
    if (pos) {
      const d = pos.dir;
      const hitSL = d === 1 ? c.low <= pos.sl : c.high >= pos.sl;
      const hitTP = !limitBar && pos.tp != null && (d === 1 ? c.high >= pos.tp : c.low <= pos.tp);
      if (hitSL) closeAt(d === 1 ? Math.min(pos.sl, c.open) : Math.max(pos.sl, c.open), i, 'sl');
      else if (hitTP) closeAt(d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open), i, 'tp');
      if (pos && !limitBar) {
        if (pos.beR != null && !pos.beDone && (d === 1 ? c.high >= pos.beR : c.low <= pos.beR)) {
          pos.beDone = true; if (d === 1 ? pos.entry > pos.sl : pos.entry < pos.sl) pos.sl = pos.entry;
        }
      }
      if (pos && pos.maxBars && i - pos.i0 >= pos.maxBars) pending = { kind: 'close' };
    }
    if (!pos && i >= warm && i < n - 1) {
      const o = sig(i);
      if (o && o.cancel) pending = { kind: 'cancel' };
      else if (o) pending = { kind: 'limit', o, sigBar: i };
      else if (resting && resting.expire && i - resting.sigBar >= resting.expire) pending = { kind: 'cancel' };
    }
  }
  if (pos) closeAt(B[n - 1].close, n - 1, 'end');
  return trades;

  function closeAt(price, i, why) {
    const d = pos.dir, exit = price * (1 - d * cost.slip);
    const R = (d * (exit - pos.entry) / pos.entry - 2 * cost.comm) / pos.dist;
    trades.push({ dir: d, i0: pos.i0, i1: i, t: B[pos.i0].time, R, why });
    pos = null;
  }
}

// SMA(n) of a higher timeframe's closes, read at each base bar's close using only HTF bars that have CLOSED by then.
const _htf = {};
function htfSma(sym, min, htfMin, n) {
  const key = [sym, min, htfMin, n].join();
  if (_htf[key]) return _htf[key];
  const B = bars(sym, min), H = bars(sym, htfMin), hs = htfMin * 60, bs = min * 60;
  const sm = IND.sma(H.map((h) => h.close), n), out = new Array(B.length).fill(null);
  let j = -1;
  for (let i = 0; i < B.length; i++) {
    const ct = B[i].time + bs;
    while (j + 1 < H.length && H[j + 1].time + hs <= ct) j++;
    out[i] = j >= 0 ? sm[j] : null;
  }
  return (_htf[key] = out);
}

const sum = (a) => a.reduce((x, y) => x + y, 0);
function stats(tr) {
  const n = tr.length;
  if (!n) return { n: 0, sum: 0, avg: 0, pf: 0, win: 0, t: 0, dd: 0 };
  const R = tr.map((t) => t.R), s = sum(R), avg = s / n;
  const sd = Math.sqrt(sum(R.map((r) => (r - avg) ** 2)) / Math.max(1, n - 1));
  const gw = sum(R.filter((r) => r > 0)), gl = -sum(R.filter((r) => r < 0));
  let eq = 0, pk = 0, dd = 0;
  for (const r of R) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { n, sum: s, avg, pf: gl ? gw / gl : 99, win: R.filter((r) => r > 0).length / n, t: sd ? avg / (sd / Math.sqrt(n)) : 0, dd };
}
const ts = (y, m = 1) => Date.UTC(y, m - 1, 1) / 1000;
const slice = (tr, a, b) => tr.filter((t) => t.t >= a && t.t < b);
const f2 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);

module.exports = { IND, bars, ind, run, runLO, htfSma, stats, slice, ts, sum, f2, COST };
