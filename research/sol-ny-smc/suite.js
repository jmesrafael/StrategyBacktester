// Stress tests, alternative targets, alternative confluence definitions, sizing.
// usage: node suite.js <dataFile> <tfMinutes> <label>
const E = require('./engine'), fs = require('fs');
const [file, tfArg, label] = process.argv.slice(2);
const tf = +tfArg, raw = E.loadBars(file), funding = E.loadBars('funding.json');
const CONSERVATIVE = { fill: 'through', throughPct: 0.0002, funding, stopSlip: 0.0005 };
const out = [];
const row = (section, scen, filter, r) => {
  out.push({ section, scen, filter, ...r, trades: undefined, curve: undefined });
  console.log(section.padEnd(10), scen.padEnd(30), filter.padEnd(9), `n=${r.n}`.padEnd(7), `win=${(r.winRate * 100).toFixed(1)}%`.padEnd(11),
    `PF=${r.pf.toFixed(2)}`.padEnd(9), `net=${(r.netPct * 100).toFixed(1)}%`.padEnd(12), `DD=${(r.maxDD * 100).toFixed(1)}%`.padEnd(10),
    `avgR=${r.avgR.toFixed(3)}`.padEnd(12), `sumR=${r.sumR.toFixed(1)}`.padEnd(11), `ddR=${r.maxDDR.toFixed(1)}`.padEnd(9),
    `RR=${r.avgPlannedRR.toFixed(2)}`.padEnd(8), `streak=${r.maxLosingStreak}`.padEnd(10), `fund=$${r.funding.toFixed(0)}`);
};
const FIL = ['base', 'sd', 'pd', 'location'];
function scen(section, name, conf, filters = FIL) {
  const P = E.prepare(raw, tf * 60, conf);
  for (const f of filters) row(section, name, f, E.run(P, E.FILTERS[f]));
  return P;
}

// 1. execution stress (baseline rules)
scen('exec', 'as reported (touch fill)', {});
scen('exec', 'fill must trade through 0.02%', { fill: 'through' });
scen('exec', '+ real funding', { funding });
scen('exec', 'conservative: through+fund+slip.05', CONSERVATIVE);
scen('exec', 'conservative + fees x2', { ...CONSERVATIVE, makerFee: 0.0004, takerFee: 0.0011 });
scen('exec', 'conservative, FIXED 1% sizing', { ...CONSERVATIVE, sizing: 'fixed' });

// 2. alternative take-profit rules (conservative execution)
for (const tp of ['swing', 'impulse', 'swingMin1R', 'R1.5', 'R2']) scen('target', 'TP=' + tp, { ...CONSERVATIVE, tpMode: tp });

// 3. alternative confluence definitions (conservative execution)
for (const [n, c] of [['S/D impulse 1.5xATR', { sdImpulseATR: 1.5 }], ['S/D impulse 3xATR', { sdImpulseATR: 3 }],
  ['S/D 2-bar displacement', { sdBars: 2 }], ['S/D 5-bar displacement', { sdBars: 5 }], ['S/D zones <= 500 bars old', { sdMaxAge: 500 }],
  ['PD tol 0.10% / sweep 0.25%', { pdTol: 0.001, pdSweep: 0.0025 }], ['PD tol 0.30% / sweep 1.0%', { pdTol: 0.003, pdSweep: 0.01 }]])
  scen('confl', n, { ...CONSERVATIVE, ...c }, ['sd', 'pd', 'location']);

// 4. other filters under conservative execution (for completeness)
scen('filters', 'conservative', CONSERVATIVE, ['fib', 'tl', 'full', 'locTl']);

fs.writeFileSync(__dirname + `/results/suite-${label}.json`, JSON.stringify(out, null, 1));
