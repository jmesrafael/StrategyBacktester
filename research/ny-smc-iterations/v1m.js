// v1m.js — the v7 concept run natively on 1m candles: NY session → 1m CHoCH → 1m FVG → limit at FVG mid, stop beyond the leg,
// fixed R target, breakeven at 1R. Same ie.js setup/execution code as v7 (read-only), fed Binance futures 1m bars.
// usage (module): require('./v1m.js').run(overrides, years) → trades; CLI: node v1m.js → quick table
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js');
const D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const SEC = 60;
const cache = {};
function data(sym, y, swingLen) {
  const k = `${sym}${y}:${swingLen}`;
  if (cache[k]) return cache[k];
  const raw = JSON.parse(fs.readFileSync(`data/binance-${sym.toLowerCase()}1-${y}.json`, 'utf8'));
  const B = raw.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
  const A = E.SMC.analyze(B, SEC, { ch1_len: swingLen, chBreak: 'close', fvgFill: 'wick', tz: 8, nyTime: '21:30', nyAutoDST: true, dayStart: '08:00' });
  const N = B.length, tIdx = new Map(B.map((b, i) => [b.time, i])), atr = new Array(N).fill(null);
  { let s = 0; for (let i = 1; i < N; i++) {
    const tr = Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close));
    if (i <= 14) { s += tr; if (i === 14) atr[i] = s / 14; } else atr[i] = (atr[i - 1] * 13 + tr) / 14; } }
  // keep only the most recent dataset in memory (each year is ~0.5M bars)
  for (const key of Object.keys(cache)) delete cache[key];
  return (cache[k] = { B, A, N, tIdx, atr, htf: {} });
}
// "literal" = v7's bar counts as 1m bars; "clock" = v7's bar counts × 15 (same minutes as v7)
const MODES = { literal: {}, clock: { maxFillBars: 120, fvgWindow: 150, ftBars: 60 } };
function run(over = {}, years = [2021, 2022, 2023, 2024, 2025], sym = 'SOL') {
  const C = { ...T.C, ...over }, out = {};
  for (const y of years) {
    const D = data(sym, y, C.swingLen);
    const t = E.execute(D, C, E.setupsFor(D, C)).filter((x) => x.t >= D0(`${y}-10-18`) && x.t < D0(`${y + 1}-10-18`));
    out[y] = t.map((x) => ({ t: x.t, R: x.R, reason: x.reason, long: x.long, stopPct: x.stopPct, riskPx: x.riskPx, fillPx: x.fillPx, mins: x.exitIdx - x.fillIdx + 1,
      feeR: (x.fillPx * C.makerFee * C.costMult + x.exitPx * (x.reason === 'TP' ? C.makerFee : C.takerFee) * C.costMult) / x.riskPx }));
  }
  return out;
}
module.exports = { run, MODES, D0 };
if (require.main === module) {
  const YRS = [2021, 2022, 2023, 2024, 2025];
  const G = JSON.parse(process.env.GRID || 'null') || [['v7 on 1m, literal bars', MODES.literal], ['v7 on 1m, same clock time', MODES.clock]];
  console.log('variant'.padEnd(40), YRS.map((y) => `Oct${String(y).slice(2)}`.padStart(8)).join(''), '   total    n  win%  medStop%  fee/trade(R)');
  for (const [n, o] of G) {
    const r = run(o, YRS), all = YRS.flatMap((y) => r[y]);
    const st = all.map((x) => x.stopPct).sort((a, b) => a - b), fe = all.map((x) => x.feeR).sort((a, b) => a - b);
    console.log(n.padEnd(40), YRS.map((y) => r[y].reduce((a, x) => a + x.R, 0).toFixed(1).padStart(8)).join(''), all.reduce((a, x) => a + x.R, 0).toFixed(1).padStart(8),
      String(all.length).padStart(5), (all.filter((x) => x.R > 0.15).length / Math.max(1, all.length) * 100).toFixed(0).padStart(5),
      ((st[st.length >> 1] || 0) * 100).toFixed(3).padStart(9), (fe[fe.length >> 1] || 0).toFixed(2).padStart(10));
  }
}
