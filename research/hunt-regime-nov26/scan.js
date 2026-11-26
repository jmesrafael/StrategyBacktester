'use strict';
const L = require('./lib.js'), F = require('./fam.js');
const fam = process.argv[2];
const sc = L.IV === 14400 ? 1 / 4 : 1; // lookback scale for 4h
const S = (x) => Math.max(2, Math.round(x * sc));
const grids = [];
const regs = [{ erN: S(96), erMax: 0.15 }, { erN: S(96), erMax: 0.25 }, { erN: S(96), erMax: 0.25, adxMax: 22 }, { erN: S(200), erMax: 0.12 }, { erN: S(48), erMax: 0.2 }];
function add(f, p, ex) { grids.push({ f, p, ex }); }
if (fam === 'donch') for (const r of regs) for (const N of [48, 96, 192]) for (const look of [1, 3]) for (const pad of [0.2, 0.5]) for (const mb of [48, 120])
  add('failDonch', { ...r, N: S(N), look, pad, minStop: 0.5 }, { maxBars: S(mb), sigExit: true, kInit: 0, kTrail: 0 });
if (fam === 'bb') for (const r of regs) for (const len of [S(48), S(96)]) for (const mult of [2, 2.5]) for (const look of [1, 3]) for (const pad of [0.2, 0.5]) for (const mb of [48, 120])
  add('failBB', { ...r, len, mult, look, pad, minStop: 0.5 }, { maxBars: S(mb), sigExit: true, kInit: 0, kTrail: 0 });
if (fam === 'rsi') for (const r of regs) for (const rsiN of [S(14), S(28)]) for (const lo of [20, 25, 30]) for (const kStop of [3, 5]) for (const mb of [48, 120])
  add('rsiRange', { ...r, rsiN, lo, kStop }, { maxBars: S(mb), sigExit: true, kInit: 0, kTrail: 0 });
if (fam === 'spike') for (const N of [24, 48, 96]) for (const k of [4, 6, 8]) for (const s of [3, 5]) for (const so of [true, false]) for (const mb of [48, 120])
  add('spike', { ma: S(200), N: S(N), k: k * Math.sqrt(S(N)) / Math.sqrt(S(24)) , s, shortOnly: so }, { maxBars: S(mb), sigExit: true, kInit: 0, kTrail: 0 });
if (fam === 'wk') for (const day of [5, 6, 0, 1]) for (const hour of [0, 12, 20]) for (const dir of [1, -1]) for (const kStop of [2, 4]) for (const mb of [24, 48])
  add('weekend', { day, hour, dir, kStop }, { maxBars: S(mb), sigExit: false, kInit: 0, kTrail: 0 });
const out = [];
for (const g of grids) {
  const r = L.evaluate((c) => F[g.f](c, g.p), g.ex, L.MAIN, 1);
  const is = [2020, 2021, 2022, 2023].map((y) => r.years[y]);
  out.push({ g, r, is, isTot: is.reduce((a, b) => a + b, 0), isPos: is.filter((v) => v > 0).length });
}
out.sort((a, b) => b.isPos - a.isPos || b.isTot - a.isTot);
const pos4 = out.filter((o) => o.isPos === 4);
console.log(`fam=${fam} TF=${L.IV} configs=${out.length} IS4/4 positive=${pos4.length}`);
for (const o of out.slice(0, 12)) console.log(o.isPos + '/4', 'ISR=' + o.isTot.toFixed(0), JSON.stringify(o.g.p), JSON.stringify(o.g.ex), L.fmt(o.r));
