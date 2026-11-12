// No-future-sight audit: cut the data at random moments. If the engine peeked ahead, trades that
// finished before the cut would change when the future is removed. They must be identical.
// Also checks every fill happens AFTER the candle that produced the signal had closed.
const { run } = require('./engine');
const cfgs = [
  { tf: 60, session: 'ny', filters: ['vwap', 'rvol'] },
  { tf: 60, session: 'ldn', orBars: 2, entry: 'retest', stop: 'opp', target: 0, filters: ['narrow', 'pd'] },
  { tf: 240, session: 'utc0', filters: ['vwap', 'rvol', 'ema'], stop: 'bar', target: 3 },
];
let bad = 0, checked = 0;
for (const c of cfgs) {
  const full = run(c).trades;
  for (const tr of full) if (!(tr.tFill >= tr.sig && tr.tExit >= tr.tFill)) { bad++; console.log('ORDER BUG', c, tr); }
  for (let k = 0; k < 6; k++) {
    const cut = 1610000000 + Math.floor(Math.random() * (1790000000 - 1610000000));
    const part = run({ ...c, tEnd: cut }).trades.filter(t => t.tExit < cut - 86400 * 2);
    const ref = full.filter(t => t.tExit < cut - 86400 * 2);
    const same = part.length === ref.length && part.every((t, i) => t.tFill === ref[i].tFill && t.tExit === ref[i].tExit && Math.abs(t.R - ref[i].R) < 1e-9);
    checked++; if (!same) { bad++; console.log('MISMATCH', JSON.stringify(c), new Date(cut * 1e3).toISOString(), part.length, ref.length); }
  }
}
console.log(bad ? `FAIL ${bad}` : `PASS: ${checked} random cut-offs, trades before each cut identical; all fills after signal close`);
