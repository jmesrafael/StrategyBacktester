// execC.js — execution-mode simulator for Validation Check C. v7's entry / exit RULES are those of ie.js execute();
// only the intrabar ORDERING assumption changes.
//   mode 'current'     : identical to ie.js execute() (verified trade-for-trade by checkC.js)
//   mode 'pessimistic' : worst-case ordering when one candle touches an adverse and a favourable level:
//        (a) breakeven trigger and the breakeven stop level touched in the same candle -> stopped at breakeven that candle
//            (current mode arms breakeven at the END of the candle and would let the trade continue);
//        (b) breakeven and tightened-stop exits pay one extra tick of slippage.
//        Stop-before-target on one candle is already the rule in 'current' mode and is kept.
//   replay1m(...)      : re-simulates given trades on 1-minute candles (entries unchanged); a 1m candle that still contains
//        both levels falls back to the pessimistic rule (stop first; trigger+breakeven-level -> stopped at breakeven).
// Exit-ordering ambiguity is audited by audit().
const E = require('./ie.js');

function finish(C, s, fillPx, riskPx, exitPx, reason) {
  const dir = s.long ? 1 : -1;
  const gross = dir * (exitPx - fillPx);
  const fee = C.costMult * (fillPx * C.makerFee + exitPx * (reason === 'TP' ? C.makerFee : C.takerFee));
  const capF = Math.min(1, (C.maxLeverage / fillPx) / (C.riskPct / riskPx));
  return ((gross - fee) / riskPx) * capF;
}

// ---- 15m simulator with execution mode (copy of ie.js execute(); `pess` switches the two pessimistic rules) ----
function execute(D, C, setups, mode, tick) {
  const pess = mode === 'pessimistic';
  const { B, N, A, tIdx } = D;
  const breaks = A.structure.map((e) => ({ bull: e.bull, b: tIdx.get(e.t2) }));
  const trades = [];
  let busyUntil = -1, bi = 0;
  for (const s of setups) {
    if (s.fvgIdx < busyUntil) continue;
    while (bi < breaks.length && breaks[bi].b <= s.fvgIdx) bi++;
    let cancelAt = Infinity;
    for (let q = bi; q < breaks.length; q++) if (breaks[q].bull !== s.long) { cancelAt = breaks[q].b; break; }
    let fillIdx = -1, fillPx = 0;
    for (let j = s.fvgIdx + 1; j < N && B[j].time < s.sessEnd && j < cancelAt && j - s.fvgIdx <= C.maxFillBars; j++) {
      const b = B[j];
      if (s.long ? b.low <= s.entry : b.high >= s.entry) { fillIdx = j; fillPx = s.long ? Math.min(b.open, s.entry) : Math.max(b.open, s.entry); break; }
      if (s.long ? b.high >= s.tp : b.low <= s.tp) break;
    }
    if (fillIdx < 0) continue;
    const riskPx = Math.abs(fillPx - s.stop), dir = s.long ? 1 : -1;
    let stop = s.stop, be = false, tight = false, exitIdx = -1, exitPx = 0, reason = '', mfe = 0, ftDone = false;
    const beTrig = s.long ? fillPx + C.beR * riskPx : fillPx - C.beR * riskPx;
    const beLvl = s.long ? fillPx + C.beLockR * riskPx : fillPx - C.beLockR * riskPx;
    const slip = C.stopSlip * C.costMult;
    const stopExit = (lvl) => { let p = s.long ? lvl * (1 - slip) : lvl * (1 + slip); if (pess && (be || tight)) p -= dir * tick; return p; };
    for (let j = fillIdx; j < N; j++) {
      const b = B[j], atOpen = j === fillIdx && fillPx === b.open;
      if (s.long ? b.low <= stop : b.high >= stop) {
        exitIdx = j; reason = be ? 'BE' : 'SL';
        exitPx = stopExit((j > fillIdx && (s.long ? b.open < stop : b.open > stop)) ? b.open : stop);
        break;
      }
      if ((j > fillIdx || atOpen) && (s.long ? b.high >= s.tp : b.low <= s.tp)) { exitIdx = j; reason = 'TP'; exitPx = s.tp; break; }
      if (j > fillIdx || atOpen) mfe = Math.max(mfe, (dir * ((s.long ? b.high : b.low) - fillPx)) / riskPx);
      if (C.ftBars && !ftDone && j === fillIdx + C.ftBars) {
        ftDone = true;
        if (!be && mfe < C.ftMinR) { const t2 = fillPx - dir * C.ftTightR * riskPx; if (s.long ? t2 > stop : t2 < stop) { stop = t2; tight = true; } }
      }
      if (!be && (j > fillIdx || atOpen) && (s.long ? b.high >= beTrig : b.low <= beTrig)) {
        be = true; stop = beLvl; tight = false;
        // pessimistic: the same candle also came back to the breakeven level -> stopped there
        if (pess && (s.long ? b.low <= beLvl : b.high >= beLvl)) { exitIdx = j; reason = 'BE'; exitPx = stopExit(beLvl); break; }
      }
    }
    if (exitIdx < 0) { exitIdx = N - 1; exitPx = B[N - 1].close; reason = 'END'; }
    trades.push({ long: s.long, t: B[fillIdx].time, fillIdx, exitIdx, fillPx, exitPx, reason, R: finish(C, s, fillPx, riskPx, exitPx, reason), s, riskPx });
    busyUntil = exitIdx + 1;
  }
  return trades;
}

// ---- ambiguity audit of one (current-mode) trade: list the candles where the sim had to guess the order ----
function audit(D, C, t) {
  const { B } = D, s = t.s, dir = s.long ? 1 : -1, hits = { stopTp: 0, stopTrig: 0, trigBe: 0 };
  let stop = s.stop, be = false, mfe = 0, ftDone = false;
  const beTrig = s.long ? t.fillPx + C.beR * t.riskPx : t.fillPx - C.beR * t.riskPx;
  const beLvl = s.long ? t.fillPx + C.beLockR * t.riskPx : t.fillPx - C.beLockR * t.riskPx;
  for (let j = t.fillIdx; j <= t.exitIdx; j++) {
    const b = B[j], atOpen = j === t.fillIdx && t.fillPx === b.open, live = j > t.fillIdx || atOpen;
    const adv = s.long ? b.low <= stop : b.high >= stop;
    const tpT = s.long ? b.high >= s.tp : b.low <= s.tp, trigT = !be && (s.long ? b.high >= beTrig : b.low <= beTrig);
    if (adv && tpT) hits.stopTp++;
    else if (adv && live && trigT) hits.stopTrig++;
    if (adv) break;
    if (tpT && live) break;
    if (live) mfe = Math.max(mfe, (dir * ((s.long ? b.high : b.low) - t.fillPx)) / t.riskPx);
    if (C.ftBars && !ftDone && j === t.fillIdx + C.ftBars) { ftDone = true; if (!be && mfe < C.ftMinR) { const t2 = t.fillPx - dir * C.ftTightR * t.riskPx; if (s.long ? t2 > stop : t2 < stop) stop = t2; } }
    if (trigT && live) { be = true; stop = beLvl; if (s.long ? b.low <= beLvl : b.high >= beLvl) hits.trigBe++; }
  }
  return hits;
}

// ---- 1m replay of one trade; m1 = Map(time -> [t,o,h,l,c]) ----
function replay1m(D, C, t, m1, tick) {
  const { B } = D, s = t.s, dir = s.long ? 1 : -1, fillPx = t.fillPx, riskPx = t.riskPx, slip = C.stopSlip * C.costMult;
  const beTrig = s.long ? fillPx + C.beR * riskPx : fillPx - C.beR * riskPx;
  const beLvl = s.long ? fillPx + C.beLockR * riskPx : fillPx - C.beLockR * riskPx;
  let stop = s.stop, be = false, tight = false, mfe = 0, ftDone = false, amb1m = 0;
  // the extra tick belongs to the pessimistic rule, so in the replay it is paid only when a 1m candle was still ambiguous
  const stopExit = (lvl, ambiguous) => { let p = s.long ? lvl * (1 - slip) : lvl * (1 + slip); if (ambiguous && (be || tight)) p -= dir * tick; return p; };
  const fin = (exitPx, reason, exitTime) => ({ R: finish(C, s, fillPx, riskPx, exitPx, reason), reason, exitPx, exitTime, amb1m });
  for (let j = t.fillIdx; j < D.N; j++) {
    const bar = B[j], atOpenBar = j === t.fillIdx && fillPx === bar.open;
    let k0 = 0;
    const mins = []; for (let k = 0; k < 15; k++) { const m = m1.get(bar.time + k * 60); if (!m) return { missingAt: bar.time + k * 60 }; mins.push(m); }
    if (j === t.fillIdx && !atOpenBar) { k0 = mins.findIndex((m) => (s.long ? m[3] <= s.entry : m[2] >= s.entry)); if (k0 < 0) return null; }
    for (let k = k0; k < 15; k++) {
      const m = mins[k], isFill = j === t.fillIdx && k === k0, live = !isFill || atOpenBar, [tm, o, h, l, c] = m;
      const adv = s.long ? l <= stop : h >= stop, tpT = s.long ? h >= s.tp : l <= s.tp;
      if (adv) {
        const amb = tpT && live; if (amb) amb1m++;
        const lvl = (!isFill && (s.long ? o < stop : o > stop)) ? o : stop;
        return fin(stopExit(lvl, amb), be ? 'BE' : 'SL', tm);
      }
      if (live && tpT) return fin(s.tp, 'TP', tm);
      if (live) mfe = Math.max(mfe, (dir * ((s.long ? h : l) - fillPx)) / riskPx);
      if (!be && live && (s.long ? h >= beTrig : l <= beTrig)) {
        be = true; stop = beLvl; tight = false;
        if (s.long ? l <= beLvl : h >= beLvl) { amb1m++; return fin(stopExit(beLvl, true), 'BE', tm); }
      }
      if (C.ftBars && !ftDone && j === t.fillIdx + C.ftBars && k === 14) {
        ftDone = true;
        if (!be && mfe < C.ftMinR) { const t2 = fillPx - dir * C.ftTightR * riskPx; if (s.long ? t2 > stop : t2 < stop) { stop = t2; tight = true; } }
      }
    }
  }
  return null;
}

module.exports = { execute, audit, replay1m };
