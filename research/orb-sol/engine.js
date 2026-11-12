// ORB live-replay engine for SOLUSDT perp.
// Honesty rules (no repaint / no future sight):
//  * Signal TF candles (1h or 4h) are fed ONE AT A TIME, in order. The strategy only sees a candle
//    after it has closed, and every indicator is updated incrementally from closed candles.
//  * A decision made at a candle's close is executed at the NEXT moment (first 1m open after close).
//  * Resting stop / target / retest-limit orders are simulated on 1m candles, minute by minute, from
//    the fill onward. If stop and target are both touched inside one 1m candle, the STOP wins.
//  * Costs: taker fee, maker fee for target/limit fills, slippage on market + stop fills, real funding.
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, 'data');

let _cache = null, _coin = null;
const U = path.join(__dirname, '../orb-universe/data');
function loadData(coin = 'SOL') {
  if (_cache && _coin === coin) return _cache;
  _cache = null; _coin = coin;
  const j = f => JSON.parse(fs.readFileSync(coin === 'SOL' ? path.join(D, f) : path.join(U, f.replace(/^sol/, coin).replace(/^funding/, coin + '-funding'))));
  const m = j('sol-1m.json'), n = m.length;
  const M = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n };
  for (let i = 0; i < n; i++) { const r = m[i]; M.t[i] = r[0]; M.o[i] = r[1]; M.h[i] = r[2]; M.l[i] = r[3]; M.c[i] = r[4]; }
  _cache = { m1: M, tf: { 60: j('sol-1h.json'), 240: j('sol-4h.json') }, funding: j('funding.json') };
  return _cache;
}
function lb(arr, x, n) { let a = 0, b = n; while (a < b) { const k = (a + b) >> 1; if (arr[k] < x) a = k + 1; else b = k; } return a; }

// ---- session calendar (pure clock arithmetic, no market data) ----
const fmtCache = {};
function tzOffsetSec(tz, tSec) {           // local - UTC, in seconds, at instant tSec
  const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const p = {}; for (const x of f.formatToParts(new Date(tSec * 1000))) p[x.type] = x.value;
  return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) / 1000) - tSec;
}
const SESS = {
  utc0: { tz: null, h: 0, m: 0 },
  ldn: { tz: 'Europe/London', h: 8, m: 0 },
  ny: { tz: 'America/New_York', h: 9, m: 30 },
};
function sessionStarts(name, tfSec, t0, t1) {
  const S = SESS[name], out = [];
  for (let day = Math.floor(t0 / 86400) * 86400 - 86400; day <= t1 + 86400; day += 86400) {
    let s = day + S.h * 3600 + S.m * 60;
    if (S.tz) s -= tzOffsetSec(S.tz, s);
    const dow = new Date(s * 1000).getUTCDay();
    s = Math.floor(s / tfSec) * tfSec;      // snap to the candle that contains the open
    out.push({ s, dow });
  }
  return out;
}

const DEF = {
  coin: 'SOL', tf: 60, session: 'ny', orBars: 1, stop: 'mid', target: 2, entry: 'close', dir: 'both',
  filters: [], rvolMin: 1.5, narrowMax: 0.30, entryHours: 12, weekends: true,
  risk: 0.01, maxLev: 10, takerFee: 0.0004, makerFee: 0.0002, slip: 0.0002, stopSlip: 0.0003,
  startEquity: 10000, tStart: 1603152000 /* 2020-10-20, first full 1m day */, tEnd: Infinity,
};

function run(cfg) {
  const C = { ...DEF, ...cfg }, DATA = loadData(C.coin), M = DATA.m1, F = DATA.funding;
  const Ft = F._t || (F._t = Float64Array.from(F, x => x[0]));
  const tf = C.tf * 60, bars = DATA.tf[C.tf].filter(b => b[0] >= C.tStart - 40 * 86400 && b[0] + tf <= Math.min(C.tEnd, M.t[M.n - 1] + 60));
  const starts = sessionStarts(C.session, tf, bars[0][0], bars.at(-1)[0]);
  let si = 0;
  const flt = new Set(C.filters);

  // incremental indicator state (only closed candles ever enter here)
  const vols = []; let ema = null; const k200 = 2 / 201;
  let curDay = null, dayH = -Infinity, dayL = Infinity, dayC = null; const days = []; // completed UTC days
  let S = null;                 // current session state
  let pos = null, pend = null;  // open position / pending entry order
  let eq = C.startEquity, peak = eq, maxDD = 0, peakR = 0, cumR = 0, maxDDR = 0;
  const trades = [], log = [];

  function closePos(i1, px, reason) {
    const p = pos, side = p.long ? 1 : -1, t = M.t[i1];
    const exitFee = reason === 'TP' ? C.makerFee : C.takerFee;
    let fund = 0;
    for (let k = lb(Ft, p.tFill + 1, F.length); k < F.length && F[k][0] <= t; k++) fund += side * F[k][1] * p.qty * M.o[lb(M.t, F[k][0], M.n)];
    const gross = side * (px - p.fill) * p.qty;
    const fees = p.fill * p.qty * p.entryFee + px * p.qty * exitFee;
    const pnl = gross - fees - fund;
    const R = pnl / p.riskUsd;
    eq += pnl; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, 1 - eq / peak);
    cumR += R; peakR = Math.max(peakR, cumR); maxDDR = Math.max(maxDDR, peakR - cumR);
    trades.push({ sig: p.sigT, tFill: p.tFill, tExit: t, long: p.long, fill: p.fill, stop: p.stop, tp: p.tp, exit: px, reason, R, pnl, eq, lev: p.lev });
    pos = null;
  }
  function openPos(i1, px, isLimit, o) {
    const long = o.long, fill = isLimit ? px : px * (1 + (long ? 1 : -1) * C.slip);
    const dist = long ? fill - o.stop : o.stop - fill;
    if (!(dist > fill * 0.0005)) return false;            // stop already crossed / meaningless
    const tp = C.target ? fill + (long ? 1 : -1) * C.target * dist : null;
    let riskUsd = eq * C.risk, qty = riskUsd / dist;
    if (qty * fill > eq * C.maxLev) { qty = eq * C.maxLev / fill; riskUsd = qty * dist; }
    pos = { long, fill, stop: o.stop, tp, qty, riskUsd, tFill: M.t[i1], sigT: o.sigT, end: o.end, entryFee: isLimit ? C.makerFee : C.takerFee, lev: qty * fill / eq };
    return true;
  }
  // walk 1m candles in [a, b): fills of pending orders and exits of the open position
  function walk(a, b) {
    let i = lb(M.t, a, M.n);
    for (; i < M.n && M.t[i] < b; i++) {
      if ((pos || pend) && i > 0 && M.t[i] - M.t[i - 1] > 1440 * 60) throw new Error('1m data gap at ' + new Date(M.t[i - 1] * 1e3).toISOString() + ': orders cannot be simulated');
      if (pend) {
        if (M.t[i] >= pend.expire) { pend = null; }
        else if (pend.type === 'mkt') { const o = pend; pend = null; if (!openPos(i, M.o[i], false, o)) continue; }
        else {                                            // retest limit at the broken edge
          const o = pend, hit = o.long ? M.l[i] <= o.px : M.h[i] >= o.px;
          if (!hit) continue;
          pend = null;
          const px = o.long ? Math.min(M.o[i], o.px) : Math.max(M.o[i], o.px);
          if (!openPos(i, px, true, o)) continue;
          // same minute: only the stop can be judged honestly (we don't know the path) -> stop check below
        }
      }
      if (!pos) continue;
      const p = pos;
      if (M.t[i] >= p.end) { closePos(i, M.o[i] * (1 + (p.long ? -1 : 1) * C.slip), 'TIME'); continue; }
      if (p.long) {
        if (M.l[i] <= p.stop) { closePos(i, Math.min(M.o[i], p.stop) * (1 - C.stopSlip), 'SL'); continue; }
        if (p.tp && M.h[i] >= p.tp && p.tFill !== M.t[i]) { closePos(i, Math.max(M.o[i], p.tp), 'TP'); continue; }
      } else {
        if (M.h[i] >= p.stop) { closePos(i, Math.max(M.o[i], p.stop) * (1 + C.stopSlip), 'SL'); continue; }
        if (p.tp && M.l[i] <= p.tp && p.tFill !== M.t[i]) { closePos(i, Math.min(M.o[i], p.tp), 'TP'); continue; }
      }
    }
  }

  for (let bi = 0; bi < bars.length; bi++) {
    const [t, o, h, l, c, v] = bars[bi], tClose = t + tf;
    // 1) the market moves through this candle: resting orders live minute by minute
    if (t >= C.tStart) walk(t, tClose);

    // 2) candle CLOSED -> update indicators with it (and only it)
    const d = Math.floor(t / 86400);
    if (curDay !== d) { if (curDay !== null) days.push({ h: dayH, l: dayL, c: dayC }); curDay = d; dayH = -Infinity; dayL = Infinity; }
    dayH = Math.max(dayH, h); dayL = Math.min(dayL, l); dayC = c;
    ema = ema === null ? c : ema + k200 * (c - ema);
    const volAvg = vols.length >= 20 ? vols.slice(-20).reduce((a, x) => a + x, 0) / 20 : null;
    vols.push(v); if (vols.length > 40) vols.shift();
    while (si + 1 < starts.length && starts[si + 1].s <= t) si++;
    const ss = starts[si];
    if (!S || S.start !== ss.s) {
      const nextS = starts[si + 1] ? starts[si + 1].s : ss.s + 86400;
      S = { start: ss.s, dow: ss.dow, orEnd: ss.s + C.orBars * tf, end: nextS, hi: -Infinity, lo: Infinity, vn: 0, vd: 0, done: false, pdh: days.at(-1)?.h, pdl: days.at(-1)?.l };
      let atr = null;
      if (days.length >= 15) { let s = 0; for (let k = days.length - 14; k < days.length; k++) { const x = days[k], pc = days[k - 1].c; s += Math.max(x.h - x.l, Math.abs(x.h - pc), Math.abs(x.l - pc)); } atr = s / 14; }
      S.atr = atr;
    }
    S.vn += (h + l + c) / 3 * v; S.vd += v;
    if (t < S.orEnd) { S.hi = Math.max(S.hi, h); S.lo = Math.min(S.lo, l); continue; }
    if (t < C.tStart || S.done || pos || pend) continue;
    if (!C.weekends && (S.dow === 0 || S.dow === 6)) continue;
    if (tClose > S.orEnd + C.entryHours * 3600 || tClose >= S.end) continue;

    // 3) signal on the CLOSED candle
    const up = C.control ? true : c > S.hi, dn = C.control ? false : c < S.lo;   // control: no breakout needed (long only)
    if (!up && !dn) continue;
    const long = up;
    if (C.dir === 'long' && !long) continue;
    if (C.dir === 'short' && long) continue;
    S.done = true;                                         // first break of the session only (taken or filtered)
    const vwap = S.vn / S.vd, width = S.hi - S.lo, mid = (S.hi + S.lo) / 2;
    if (flt.has('vwap') && (long ? c < vwap : c > vwap)) continue;
    if (flt.has('rvol') && !(volAvg && v >= C.rvolMin * volAvg)) continue;
    if (flt.has('narrow') && !(S.atr && width <= C.narrowMax * S.atr)) continue;
    if (flt.has('ema') && (long ? c < ema : c > ema)) continue;
    let stop = C.stop === 'mid' ? mid : C.stop === 'opp' ? (long ? S.lo : S.hi) : (long ? l : h);
    if (flt.has('pd') && S.pdh != null) {                  // don't break straight into yesterday's high/low
      const r = Math.abs(c - stop) * (C.target || 2);
      if (long && S.pdh > c && S.pdh < c + r) continue;
      if (!long && S.pdl < c && S.pdl > c - r) continue;
    }
    const ord = { long, stop, sigT: tClose, end: S.end };
    if (C.entry === 'close') pend = { ...ord, type: 'mkt', expire: tClose + tf };
    else pend = { ...ord, type: 'lmt', px: long ? S.hi : S.lo, expire: Math.min(S.end, S.orEnd + C.entryHours * 3600 + tf) };
  }
  return summarize(C, trades, eq, maxDD, maxDDR);
}

function stats(T) {
  const n = T.length; if (!n) return { n: 0, sumR: 0, avgR: 0, win: 0, pf: 0 };
  let s = 0, w = 0, gp = 0, gl = 0;
  for (const x of T) { s += x.R; if (x.R > 0) { w++; gp += x.R; } else gl -= x.R; }
  return { n, sumR: s, avgR: s / n, win: w / n, pf: gl ? gp / gl : Infinity };
}
const Y2024 = 1704067200;
function summarize(C, T, eq, maxDD, maxDDR) {
  const years = {};
  for (const x of T) { const y = new Date(x.tFill * 1000).getUTCFullYear(); (years[y] = years[y] || []).push(x); }
  const span = (Math.min(C.tEnd, T.at(-1)?.tExit || C.tStart) - C.tStart) / (365.25 * 86400);
  return {
    all: stats(T), is: stats(T.filter(x => x.tFill < Y2024)), oos: stats(T.filter(x => x.tFill >= Y2024)),
    years: Object.fromEntries(Object.entries(years).map(([y, a]) => [y, stats(a)])),
    eq, retPct: eq / C.startEquity - 1, cagr: span > 0 ? Math.pow(Math.max(eq, 1) / C.startEquity, 1 / span) - 1 : 0,
    maxDD, maxDDR, perMonth: T.length / (span * 12 || 1), trades: T,
  };
}
module.exports = { run, loadData, DEF };
