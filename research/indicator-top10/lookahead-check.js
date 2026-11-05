// Proves no repaint / no future peeking: indicator value at bar i computed on data truncated at i must equal the value from the full series.
const fs = require('fs'); const { IND } = require('./indicators');
let bad = 0, checked = 0;
for (const coin of ['BTC', 'SOL']) {
  const b = JSON.parse(fs.readFileSync(`data4h/${coin}.json`)); const C = b.map(r => r[4]), V = b.map(r => r[5]);
  for (const [name, f] of Object.entries(IND)) for (const n of [10, 50, 200]) {
    const full = f(C, V, n);
    for (const i of [300, 1000, 5000, 9000, b.length - 1]) {
      const cut = f(C.slice(0, i + 1), V.slice(0, i + 1), n)[i]; checked++;
      if (!(Math.abs(cut - full[i]) <= 1e-9 * Math.abs(full[i]) || (Number.isNaN(cut) && Number.isNaN(full[i])))) { bad++; console.log('MISMATCH', coin, name, n, i, cut, full[i]); }
    }
  }
}
console.log(`lookahead/repaint check: ${checked} points, ${bad} mismatches`);
