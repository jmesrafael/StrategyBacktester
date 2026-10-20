// fvg.js — Pullback FVG: a fair value gap forms with displacement, then we WAIT for price to retrace into it and enter on the pullback
// with a resting limit order (never at the market). Everything is decided on a bar's close.
//   bullish FVG at bar i (3rd candle): low[i] > high[i-2], zone [high[i-2], low[i]], middle candle bullish
//   bearish FVG at bar i:              high[i] < low[i-2], zone [high[i], low[i-2]], middle candle bearish
// p: { tf, minGap (gap height >= x ATR14), disp (middle candle body >= x ATR, 0 = off), depth (0 = limit at the near edge of the gap,
//      0.5 = middle, 1 = far edge), stop:'gap'|'c2'|'origin', tp (R multiple), expire (bars the order may rest), trend:0|'htf'
//      (longs only above / shorts only below the 4h SMA200 of CLOSED 4h bars), maxHold (bars in trade, 0 = off), minStop, maxStop (x ATR) }
const L = require('./lib.js');

// Confirmation pullback (p.confirm): after the FVG forms, wait (up to p.expire bars) for a bar that dips into the gap and closes back in the
// trend direction (bullish: low <= gap top, close > open, close above the gap middle; bearish mirrors). Then a MARKET entry at the next open —
// no resting order, so no touch-fill assumption. The setup dies if a bar closes beyond the gap's far side. Same stop / target rules.
function fvgConfirm(sym, p) {
  const I = L.ind(sym, p.tf), B = I.B, atr = I.atr(14);
  const tr = p.trend === 'htf' ? L.htfSma(sym, p.tf, 240, 200) : null;
  const minStop = p.minStop == null ? 0.3 : p.minStop, maxStop = p.maxStop == null ? 5 : p.maxStop;
  let st = null; // the latest valid FVG waiting for its pullback
  const sig = (i) => {
    const a = atr[i], c3 = B[i];
    if (a == null) return null;
    if (st && i > st.born) {
      const mid = (st.top + st.bot) / 2;
      if (i - st.born > p.expire || (st.dir === 1 ? c3.close < st.bot : c3.close > st.top)) st = null;
      else if (st.dir === 1 ? (c3.low <= st.top - p.depth * (st.top - st.bot) && c3.close > c3.open && c3.close > mid)
        : (c3.high >= st.bot + p.depth * (st.top - st.bot) && c3.close < c3.open && c3.close < mid)) {
        const dist = st.dir * (c3.close - st.stop); const o = st; st = null;
        if (!(dist >= minStop * a) || dist > maxStop * a) return null;
        return { dir: o.dir, stop: o.stop, tp: c3.close + o.dir * p.tp * dist, maxBars: p.maxHold || 0 };
      }
    }
    if (i < 2) return null;
    const c1 = B[i - 2], c2 = B[i - 1];
    let dir = 0, top, bot;
    if (c3.low > c1.high && c2.close > c2.open) { dir = 1; top = c3.low; bot = c1.high; }
    else if (c3.high < c1.low && c2.close < c2.open) { dir = -1; top = c1.low; bot = c3.high; }
    if (!dir || top - bot < p.minGap * a) return null;
    if (p.disp && Math.abs(c2.close - c2.open) < p.disp * a) return null;
    if (tr && (tr[i] == null || (dir === 1 ? c3.close < tr[i] : c3.close > tr[i]))) return null;
    let stop;
    if (p.stop === 'gap') stop = dir === 1 ? bot - 0.1 * a : top + 0.1 * a;
    else if (p.stop === 'c2') stop = dir === 1 ? c2.low : c2.high;
    else stop = dir === 1 ? Math.min(c1.low, c2.low) : Math.max(c1.high, c2.high);
    st = { dir, top, bot, stop, born: i };
    return null;
  };
  return L.run(B, (i) => sig(i), 220);
}

function fvgpb(sym, p) {
  if (p.confirm) return fvgConfirm(sym, p);
  const I = L.ind(sym, p.tf), B = I.B, atr = I.atr(14), n = B.length;
  const tr = p.trend === 'htf' ? L.htfSma(sym, p.tf, 240, 200) : null;
  const minStop = p.minStop == null ? 0.3 : p.minStop, maxStop = p.maxStop == null ? 5 : p.maxStop;
  const sig = (i) => {
    if (i < 2) return null;
    const a = atr[i], c1 = B[i - 2], c2 = B[i - 1], c3 = B[i];
    if (a == null) return null;
    let dir = 0, top, bot;
    if (c3.low > c1.high && c2.close > c2.open) { dir = 1; top = c3.low; bot = c1.high; }
    else if (c3.high < c1.low && c2.close < c2.open) { dir = -1; top = c1.low; bot = c3.high; }
    if (!dir) return null;
    const h = top - bot;
    if (h < p.minGap * a) return null;
    if (p.disp && Math.abs(c2.close - c2.open) < p.disp * a) return null;
    if (tr && (tr[i] == null || (dir === 1 ? c3.close < tr[i] : c3.close > tr[i]))) return null;
    const limit = dir === 1 ? top - p.depth * h : bot + p.depth * h;
    let stop;
    if (p.stop === 'gap') stop = dir === 1 ? bot - 0.1 * a : top + 0.1 * a;
    else if (p.stop === 'c2') stop = dir === 1 ? c2.low : c2.high;
    else stop = dir === 1 ? Math.min(c1.low, c2.low) : Math.max(c1.high, c2.high);
    const dist = dir * (limit - stop);
    if (!(dist >= minStop * a) || dist > maxStop * a) return null;
    if (p.direct) { // control: no pullback — market entry at the next open, same stop and target distance
      const d2 = dir * (c3.close - stop);
      if (!(d2 >= minStop * a) || d2 > maxStop * a) return null;
      return { dir, stop, tp: c3.close + dir * p.tp * d2, maxBars: p.maxHold || 0 };
    }
    return { dir, limit, stop, tp: limit + dir * p.tp * dist, expire: p.expire, maxBars: p.maxHold || 0, buf: (p.fillBuf || 0) * a };
  };
  return p.direct ? L.run(B, sig, 220) : L.runLO(B, sig, 220);
}

module.exports = { fvgpb };
