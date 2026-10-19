// v7m.js — "v7+1m": v7's 15m setups (NY session → CHoCH → FVG), executed and managed on Binance futures 1m candles.
// Options on top of v7: entry (FVG mid / fib level / 1m-CHoCH confirmation), target (fixed R / next 15m swing),
// breakeven (R trigger / 1m-structure), 1m trailing. ie.js is used read-only for the 15m setups.
// usage (module): const V = require('./v7m.js'); V.run('SOL', overrides, [fromISO, toISO])
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js');
const D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

const DEF = {
  ...T.C,                 // frozen v7 15m setup rules (session windows, CHoCH, FVG, filters, maxStopATR, maxFillBars 8)
  entry: 'mid',           // 'mid' = v7 FVG midpoint limit · 'fib' = limit at fib level of the CHoCH leg · 'confirm' = 1m CHoCH after FVG touch
  fib: 0.618,             // fib retracement of the leg (0 = impulse extreme, 1 = leg origin / stop side)
  fibNeedFvg: true,       // fib entry only if the fib level lies inside the FVG (FVG + fib confluence)
  fibClamp: false,        // fib entry: if the fib level is outside the FVG, use the nearest FVG edge instead of skipping
  confLen: 2,             // 1m pivot length for confirmation / structure
  confStop: '1m',         // confirm entry stop: '1m' = below the 1m sweep low · '15m' = the v7 stop
  confTouch: 'mid',       // confirm: zone touch level 'edge' (FVG proximal edge) or 'mid'
  tp: 'R', tpR: 3,        // 'R' fixed multiple · 'swing' next 15m swing high/low · 'swingFloor' max(swing, tpR)
  tpKeepPrice: false,     // confirm entry: keep the original 3R target price (bigger RR) instead of tpR × new risk
  beR: 1, beLock: 0,      // breakeven: trigger at +beR, stop to entry + beLock·R
  sbMode: null,           // 1m structure breakeven: after +sbMinR, first confirmed 1m higher low (long) above entry → stop to entry + beLock·R
  sbMinR: 0.5,
  trailR: null,           // after +trailR, trail stop under each new confirmed 1m swing (len trailLen)
  trailLen: 3,
  ftMin: 60, ftMinR: 0.25, ftTightR: 0.5, // v7 follow-through: after ftMin minutes, if best < ftMinR → stop to −ftTightR
  fillMins: null,         // optional cap on minutes to fill (default: v7's 8 × 15m bars)
  advLen: null,           // 1m early exit: before BE and while best < advMaxR, a 1m close beyond the latest confirmed 1m pivot (len advLen) against the trade → exit at market
  advMaxR: 0.5,
  advAfterMin: 0,         // ignore adverse 1m breaks during the first N minutes after fill
};

const cache = {};
function load(sym, year) {
  const k = sym + year;
  if (cache[k]) return cache[k];
  const raw = JSON.parse(fs.readFileSync(`data/binance-${sym.toLowerCase()}1-${year}.json`, 'utf8'));
  return (cache[k] = { t0: raw[0][0], raw });
}
const d15 = {};
function setups(sym, C) {
  if (!d15[sym]) d15[sym] = E.analyze(sym + '-binance', JSON.parse(fs.readFileSync(`data/binance-${sym.toLowerCase()}15.json`, 'utf8')), C.swingLen);
  const D = d15[sym];
  // 15m setups with v7 rules but a swing target attached (tpMode swingFloorR keeps every v7 setup; the swing price rides along as s.swingTp)
  const S = E.setupsFor(D, { ...C, tpMode: 'R' });
  return { D, S };
}

function run(sym, over = {}, range = ['2025-10-18', '2026-10-18'], year = 2025) {
  const C = { ...DEF, ...over }, { D, S } = setups(sym, C), { B } = D;
  const M = load(sym, year), m = M.raw, base = M.t0;
  const at = (t) => (t - base) / 60; // 1m index of a time (no gaps)
  const lo = D0(range[0]), hi = D0(range[1]);
  const breaks = D.A.structure.map((e) => ({ bull: e.bull, b: D.tIdx.get(e.t2) }));
  const out = [];
  let busyT = -Infinity;
  for (const s of S) {
    const fvgT = B[s.fvgIdx].time, t0 = fvgT + 900;
    if (fvgT < lo || fvgT >= hi || t0 <= busyT) continue;
    if (at(t0) < 0 || at(t0) >= m.length - 1) continue;
    const long = s.long, dir = long ? 1 : -1;
    // opposing 15m structure break cancels the order
    let cancelT = Infinity;
    for (const br of breaks) if (br.b > s.fvgIdx && br.bull !== long) { cancelT = B[br.b].time; break; }
    const endFill = Math.min(fvgT + (C.maxFillBars + 1) * 900, s.sessEnd, cancelT, C.fillMins ? t0 + C.fillMins * 60 : Infinity);
    // leg geometry
    const legX = long ? s.stop / (1 - C.slBufferPct) : s.stop / (1 + C.slBufferPct);
    let imp = long ? -Infinity : Infinity;
    for (let j = s.legXi; j <= s.fvgIdx; j++) imp = long ? Math.max(imp, B[j].high) : Math.min(imp, B[j].low);
    const fvgMid = s.entry, fvgHalf = Math.abs(s.risk) && null; // (mid is v7's entry)
    // find the FVG used (same rule as ie.js): first same-direction FVG after the CHoCH
    const entryTarget = (px, r) => {
      const fixed = px + dir * C.tpR * r, sw = s.swingTp;
      if (C.tp === 'R') return fixed;
      if (C.tp === 'swing') return sw != null && dir * (sw - px) > 0.5 * r ? sw : null;
      if (C.tp === 'swingFloor') return sw == null ? fixed : (long ? Math.max(sw, fixed) : Math.min(sw, fixed));
      if (C.tp === 'swingCap') return sw == null ? fixed : (long ? Math.min(Math.max(sw, px + r), fixed) : Math.max(Math.min(sw, px - r), fixed));
      return fixed;
    };
    const g = D.A.fvg.find((x) => x.bull === long && D.tIdx.get(x.t1) + 2 === s.fvgIdx);
    const top = g ? g.top : fvgMid, bot = g ? g.bottom : fvgMid;
    let plan = s.entry;
    if (C.entry === 'fib') {
      plan = imp - dir * C.fib * Math.abs(imp - legX);
      if (C.fibNeedFvg && (plan > top || plan < bot)) { if (!C.fibClamp) continue; plan = Math.min(top, Math.max(bot, plan)); }
    }
    let stop = s.stop;
    if (long ? plan <= stop : plan >= stop) continue;
    // ---- entry ----
    let fi = -1, fillPx = 0, taker = false, touched = -1, sweep = long ? Infinity : -Infinity;
    const touchLvl = C.confTouch === 'edge' ? (long ? top : bot) : fvgMid;
    const swingTp = s.swingTp;
    for (let i = at(t0); i < m.length && m[i][0] < endFill; i++) {
      const [, o, h, l, c] = m[i];
      if (C.entry !== 'confirm') {
        if (long ? l <= plan : h >= plan) { fi = i; fillPx = long ? Math.min(o, plan) : Math.max(o, plan); break; }
        const r = Math.abs(plan - stop), tp0 = entryTarget(plan, r);
        if (tp0 != null && (long ? h >= tp0 : l <= tp0)) break;
      } else {
        if (touched < 0) { if (long ? l <= touchLvl : h >= touchLvl) touched = i; else continue; }
        sweep = long ? Math.min(sweep, l) : Math.max(sweep, h);
        if (long ? sweep <= s.stop : sweep >= s.stop) break; // invalidated before confirmation
        // 1m CHoCH: close beyond the latest confirmed 1m pivot (len confLen) formed at/after touch−20
        const k = C.confLen; let piv = null;
        for (let p = i - k; p >= Math.max(touched - 20, k); p--) {
          let ok = true; for (let q = 1; q <= k; q++) if (long ? !(m[p][2] > m[p - q][2] && m[p][2] >= m[p + q][2]) : !(m[p][3] < m[p - q][3] && m[p][3] <= m[p + q][3])) { ok = false; break; }
          if (ok) { piv = long ? m[p][2] : m[p][3]; break; }
        }
        if (piv != null && (long ? c > piv : c < piv) && i > touched) {
          fi = i; fillPx = c; taker = true;
          if (C.confStop === '1m') { stop = long ? sweep * (1 - C.slBufferPct) : sweep * (1 + C.slBufferPct); if (long ? stop < s.stop : stop > s.stop) stop = s.stop; }
          if (long ? fillPx <= stop : fillPx >= stop) { fi = -1; break; }
          break;
        }
      }
    }
    if (fi < 0) continue;
    const risk = Math.abs(fillPx - stop);
    if (risk <= 0) continue;
    let tp;
    if (C.entry === 'confirm' && C.tpKeepPrice) tp = s.entry + dir * C.tpR * s.risk; else tp = entryTarget(fillPx, risk);
    if (tp == null || (long ? tp <= fillPx : tp >= fillPx)) continue;
    // ---- management on 1m ----
    let be = false, sb = false, exitI = -1, exitPx = 0, reason = '', mfe = 0, mae = 0, ftDone = false, t1R = null, tHalf = null;
    const beTrig = C.beR == null ? null : fillPx + dir * C.beR * risk, beLvl = fillPx + dir * C.beLock * risk;
    let lastPivLo = null; // trailing / structure pivots (long: lows; short: highs)
    for (let i = fi; i < m.length; i++) {
      const [t, o, h, l, c] = m[i];
      const first = i === fi;
      if (long ? l <= stop : h >= stop) {
        const lvl = !first && (long ? o < stop : o > stop) ? o : stop;
        exitI = i; exitPx = lvl * (1 - dir * C.stopSlip); reason = be || sb ? (Math.abs(stop - fillPx) / risk < 0.05 ? 'BE' : dir * (stop - fillPx) > 0 ? 'TRAIL' : 'BE') : (dir * (stop - fillPx) / risk > -0.9 ? 'CUT' : 'SL');
        break;
      }
      if (!first && (long ? h >= tp : l <= tp)) { exitI = i; exitPx = tp; reason = 'TP'; break; }
      if (C.advLen && !first && !be && !sb && mfe < C.advMaxR && t - m[fi][0] >= C.advAfterMin * 60) {
        // latest confirmed 1m pivot (long: low, short: high) formed after the fill
        const k = C.advLen; let piv = null;
        for (let p = i - 1 - k; p > fi; p--) {
          let ok = true; for (let q = 1; q <= k; q++) if (long ? !(m[p][3] < m[p - q][3] && m[p][3] <= m[p + q][3]) : !(m[p][2] > m[p - q][2] && m[p][2] >= m[p + q][2])) { ok = false; break; }
          if (ok) { piv = long ? m[p][3] : m[p][2]; break; }
        }
        if (piv != null && (long ? c < piv : c > piv)) { exitI = i; exitPx = c * (1 - dir * C.stopSlip); reason = 'ADV'; break; }
      }
      const fav = dir * ((long ? h : l) - fillPx) / risk, adv = dir * ((long ? l : h) - fillPx) / risk;
      if (!first || !taker) { mfe = Math.max(mfe, fav); mae = Math.min(mae, adv); }
      if (t1R == null && mfe >= 1) t1R = (t - m[fi][0]) / 60;
      if (tHalf == null && mfe >= 0.5) tHalf = (t - m[fi][0]) / 60;
      if (!ftDone && t - m[fi][0] >= C.ftMin * 60) {
        ftDone = true;
        if (!be && !sb && mfe < C.ftMinR) { const t2 = fillPx - dir * C.ftTightR * risk; if (long ? t2 > stop : t2 < stop) stop = t2; }
      }
      if (beTrig != null && !be && (long ? h >= beTrig : l <= beTrig)) { be = true; if (long ? beLvl > stop : beLvl < stop) stop = beLvl; }
      // confirmed 1m pivot at i−k
      const k = C.sbMode || C.trailR != null ? (C.trailR != null && mfe >= C.trailR ? C.trailLen : C.confLen) : 0;
      if (k && i - k > fi) {
        const p = i - k; let ok = true;
        for (let q = 1; q <= k; q++) if (long ? !(m[p][3] < m[p - q][3] && m[p][3] <= m[p + q][3]) : !(m[p][2] > m[p - q][2] && m[p][2] >= m[p + q][2])) { ok = false; break; }
        if (ok) {
          const pv = long ? m[p][3] : m[p][2];
          if (C.sbMode && !sb && !be && mfe >= C.sbMinR && dir * (pv - fillPx) > 0) { sb = true; if (long ? beLvl > stop : beLvl < stop) stop = beLvl; }
          if (C.trailR != null && mfe >= C.trailR) { const ns = long ? pv * (1 - C.slBufferPct) : pv * (1 + C.slBufferPct); if (long ? ns > stop : ns < stop) stop = ns; }
          lastPivLo = pv;
        }
      }
    }
    if (exitI < 0) continue; // ran past the data
    const gross = dir * (exitPx - fillPx);
    const fee = fillPx * (taker ? C.takerFee + C.stopSlip : C.makerFee) + exitPx * (reason === 'TP' ? C.makerFee : C.takerFee);
    const capF = Math.min(1, (C.maxLeverage / fillPx) / (C.riskPct / risk));
    const R = ((gross - fee) / risk) * capF;
    out.push({ sym, long, fvgT, t: m[fi][0], exitT: m[exitI][0], fillPx, stop0: long ? Math.min(stop, fillPx - risk) : Math.max(stop, fillPx + risk), risk, tp, rr: Math.abs(tp - fillPx) / risk,
      swingRR: swingTp != null ? dir * (swingTp - fillPx) / risk : null, reason, R, mfe, mae, t1R, tHalf, mins: (m[exitI][0] - m[fi][0]) / 60, stopPct: risk / fillPx });
    busyT = m[exitI][0];
  }
  return out;
}
module.exports = { run, DEF, D0 };
