// export-examples.js — export every v7 trade (SOL, ETH, Oct21–Oct26) with the structure behind it, for the PDF charts.
// usage: node export-examples.js <outFile.json>
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js');
const out = process.argv[2] || 'results/pdf-trades.json';
const etFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
const et = (t) => { const p = Object.fromEntries(etFmt.formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value])); return { h: (+p.hour % 24) + +p.minute / 60, label: `${String(+p.hour % 24).padStart(2, '0')}:${p.minute}`, day: `${p.weekday} ${p.month} ${p.day}, ${p.year}` }; };
const res = [];
for (const sym of ['SOL', 'ETH']) {
  const { D, trades } = T.build(sym), { B, A, tIdx, atr } = D, SH = A.swings.hi, SL = A.swings.lo;
  const choch = new Map(A.structure.filter((e) => e.type === 'CHoCH').map((e) => [tIdx.get(e.t2), e]));
  const fvgBy = new Map(); for (const g of A.fvg) fvgBy.set(tIdx.get(g.t1) + 2 + ':' + g.bull, g);
  trades.forEach((t, n) => {
    const s = t.s, e = choch.get(s.chochIdx), g = fvgBy.get(s.fvgIdx + ':' + s.long);
    if (!e || !g) return;
    const swIdx = tIdx.get(e.t1), lo = Math.max(0, swIdx - 28), hi = Math.min(D.N - 1, t.exitIdx + 10);
    const sw = (arr) => arr.filter((p) => p.idx >= lo && p.idx <= hi && p.confirmIdx <= hi).map((p) => ({ i: p.idx - lo, price: p.price }));
    const legX = s.long ? Math.min(...B.slice(swIdx, s.chochIdx + 1).map((b) => b.low)) : Math.max(...B.slice(swIdx, s.chochIdx + 1).map((b) => b.high));
    res.push({
      sym, id: `${sym}-${n}`, long: s.long, reason: t.reason, R: t.R, hold: t.exitIdx - t.fillIdx, stopPct: t.stopPct, year: new Date(B[t.fillIdx].time * 1000).getUTCFullYear(),
      day: et(B[s.chochIdx].time).day, chochET: et(B[s.chochIdx].time).label,
      candles: B.slice(lo, hi + 1).map((b) => [b.time, b.open, b.high, b.low, b.close, et(b.time).label]),
      i: { swing: swIdx - lo, legX: s.legXi - lo, choch: s.chochIdx - lo, fvg1: s.fvgIdx - 2 - lo, fvg3: s.fvgIdx - lo, fill: t.fillIdx - lo, exit: t.exitIdx - lo },
      swingPrice: e.price, legX, fvgTop: g.top, fvgBottom: g.bottom, entry: s.entry, stop: s.stop, tp: s.tp, fillPx: t.fillPx, riskPx: t.riskPx, exitPx: t.exitPx,
      beTrig: s.long ? t.fillPx + t.riskPx : t.fillPx - t.riskPx, atrChoch: atr[s.chochIdx], atrFvg: atr[s.fvgIdx], chochRange: B[s.chochIdx].high - B[s.chochIdx].low,
      swingsHi: sw(SH), swingsLo: sw(SL),
    });
  });
}
fs.writeFileSync(out, JSON.stringify(res));
console.log('exported', res.length, 'trades;', res.filter((r) => r.reason === 'TP').length, 'target hits');
