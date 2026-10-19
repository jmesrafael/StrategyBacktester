// Out-of-sample test of FROZEN rules on 2023-10-18 → 2025-10-18 (never used before),
// conservative execution. Reported per year and combined, next to the development year.
const E = require('./engine'), fs = require('fs');
const funding = E.loadBars('funding.json');
const CONSERVATIVE = { fill: 'through', throughPct: 0.0002, funding, stopSlip: 0.0005 };
const RULESETS = [
  ['1 frozen baseline (TP swing)', 'base', {}],
  ['2 + location filter (TP swing)', 'location', {}],
  ['3 + location, TP 2R [dev-year idea]', 'location', { tpMode: 'R2' }],
  ['  PD/PDL only (TP swing)', 'pd', {}],
  ['  S/D only (TP swing)', 'sd', {}],
  ['  Fib golden zone (TP swing)', 'fib', {}],
  ['  trendline (TP swing)', 'tl', {}],
  ['  baseline, TP 2R', 'base', { tpMode: 'R2' }],
];
const PERIODS = [['Y1 Oct23-Oct24', '2023-10-18', '2024-10-18'], ['Y2 Oct24-Oct25', '2024-10-18', '2025-10-18'], ['DEV Oct25-Oct26', '2025-10-18', '2026-10-18']];
function stat(T) {
  const w = T.filter((t) => t.pnl > 0), gp = w.reduce((a, t) => a + t.pnl, 0), gl = -T.filter((t) => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0);
  let cr = 0, pk = 0, dd = 0, st = 0, ms = 0;
  for (const t of T) { cr += t.R; pk = Math.max(pk, cr); dd = Math.max(dd, pk - cr); if (t.pnl <= 0) ms = Math.max(ms, ++st); else st = 0; }
  return { n: T.length, win: T.length ? w.length / T.length : 0, pf: gl ? gp / gl : (gp ? Infinity : 0),
    avgR: T.length ? cr / T.length : 0, sumR: cr, ddR: dd, streak: ms };
}
const fmt = (s) => `n=${s.n}`.padEnd(6) + `win=${(s.win * 100).toFixed(0)}%`.padEnd(9) + `PF=${s.pf === Infinity ? 'inf' : s.pf.toFixed(2)}`.padEnd(9) +
  `avgR=${s.avgR.toFixed(2)}`.padEnd(11) + `sumR=${s.sumR.toFixed(1)}`.padEnd(11) + `ddR=${s.ddR.toFixed(1)}`.padEnd(9);

const tfArg = +(process.argv[2] || 15);
const files = tfArg === 15 ? ['sol15-oos.json', 'sol15.json'] : ['sol1-oos.json', 'sol1.json'];
const result = {};
for (const [name, filter, conf] of RULESETS) {
  const all = [];
  for (const f of files) { const P = E.prepare(E.loadBars(f), tfArg * 60, { ...CONSERVATIVE, ...conf }); all.push(...E.run(P, E.FILTERS[filter]).trades); }
  const by = PERIODS.map(([lab, a, b]) => [lab, stat(all.filter((t) => t.fillTime >= Date.parse(a) / 1000 && t.fillTime < Date.parse(b) / 1000))]);
  const oos = stat(all.filter((t) => t.fillTime < Date.parse('2025-10-18') / 1000));
  result[name] = { periods: Object.fromEntries(by), oos };
  console.log(`${tfArg}m ${name}`);
  for (const [lab, s] of by) console.log('    ' + lab.padEnd(17) + fmt(s) + `streak=${s.streak}`);
  console.log('    ' + 'OOS 2 years'.padEnd(17) + fmt(oos) + `streak=${oos.streak}`);
}
fs.writeFileSync(__dirname + `/results/oos-${tfArg}m.json`, JSON.stringify(result, null, 1));
