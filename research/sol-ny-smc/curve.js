// Cumulative-R curve (fixed-risk view) across out-of-sample + development years.
// Writes results/equity-15m.csv and results/equity-15m.svg.
const E = require('./engine'), fs = require('fs');
const funding = E.loadBars('funding.json');
const CONS = { fill: 'through', throughPct: 0.0002, funding, stopSlip: 0.0005 };
const series = {};
for (const [name, filter] of [['Frozen baseline', 'base'], ['+ location filter', 'location']]) {
  const T = [];
  for (const f of ['sol15-oos.json', 'sol15.json']) T.push(...E.run(E.prepare(E.loadBars(f), 900, CONS), E.FILTERS[filter]).trades);
  let c = 0; series[name] = T.map((t) => [t.exitTime, (c += t.R)]);
}
const csv = ['series,exitTimeISO,cumR'];
for (const [k, pts] of Object.entries(series)) for (const [t, r] of pts) csv.push(`${k},${new Date(t * 1000).toISOString()},${r.toFixed(3)}`);
fs.writeFileSync(__dirname + '/results/equity-15m.csv', csv.join('\n'));

const W = 900, H = 380, L = 56, R = 16, T = 34, Bm = 40;
const t0 = Date.parse('2023-10-18') / 1000, t1 = Date.parse('2026-10-18') / 1000;
const all = Object.values(series).flat().map((p) => p[1]).concat([0]);
const lo = Math.floor(Math.min(...all) / 5) * 5, hi = Math.ceil(Math.max(...all) / 5) * 5;
const X = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R), Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - Bm);
const colors = { 'Frozen baseline': '#2a6fdb', '+ location filter': '#d9822b' };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Segoe UI, sans-serif" font-size="11">` +
  `<rect width="${W}" height="${H}" fill="#fff"/>` +
  `<rect x="${X(Date.parse('2025-10-18') / 1000)}" y="${T}" width="${X(t1) - X(Date.parse('2025-10-18') / 1000)}" height="${H - T - Bm}" fill="#f2f2f2"/>` +
  `<text x="${X(Date.parse('2026-04-18') / 1000)}" y="${T + 14}" text-anchor="middle" fill="#666">development year</text>` +
  `<text x="${X(Date.parse('2024-10-18') / 1000)}" y="${T + 14}" text-anchor="middle" fill="#666">out-of-sample (never used to build rules)</text>`;
for (let v = lo; v <= hi; v += 5) svg += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? '#999' : '#e6e6e6'}"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" fill="#555">${v}R</text>`;
for (const y of ['2024-01-01', '2025-01-01', '2026-01-01']) { const x = X(Date.parse(y) / 1000); svg += `<text x="${x}" y="${H - Bm + 16}" text-anchor="middle" fill="#555">${y.slice(0, 4)}</text>`; }
for (const [k, pts] of Object.entries(series)) {
  const d = [[t0, 0], ...pts].map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  svg += `<path d="${d}" fill="none" stroke="${colors[k]}" stroke-width="1.8"/>`;
}
let lx = L + 8;
for (const k of Object.keys(series)) { svg += `<rect x="${lx}" y="10" width="14" height="3" fill="${colors[k]}"/><text x="${lx + 18}" y="15" fill="#333">${k}</text>`; lx += 150; }
svg += `<text x="${W - R}" y="15" text-anchor="end" fill="#333">SOL 15m · NY session · cumulative R (1R = risk per trade), conservative execution</text></svg>`;
fs.writeFileSync(__dirname + '/results/equity-15m.svg', svg);
console.log(Object.fromEntries(Object.entries(series).map(([k, p]) => [k, { trades: p.length, finalR: +p[p.length - 1][1].toFixed(1) }])));
