// v1m-grid.js — filter grid for v7-on-1m (SOL). Years outer, variants inner (one 1m dataset in memory at a time).
// usage: GRID='[[name,{...}],…]' YEARS='[2021,2022,2023]' node --max-old-space-size=8192 v1m-grid.js
const V = require('./v1m.js');
const YRS = JSON.parse(process.env.YEARS || '[2021,2022,2023]');
const base = V.MODES.literal;
const G = JSON.parse(process.env.GRID || 'null') || [
  ['v7 on 1m (literal)', {}],
  ['+ 15m trend (EMA50)', { htfMin: 15, htfEma: 50 }],
  ['+ 1h trend (EMA50)', { htfMin: 60, htfEma: 50 }],
  ['+ 4h trend (EMA50)', { htfMin: 240, htfEma: 50 }],
  ['1m swing 10', { swingLen: 10 }],
  ['1m swing 20', { swingLen: 20 }],
  ['displacement ≥ 2 ATR', { minDispATR: 2 }],
  ['FVG ≥ 0.5 ATR', { minFvgATR: 0.5 }],
  ['1 trade per session', { maxTradesPerSession: 1 }],
  ['target 5R', { tpR: 5 }],
  ['first window only (08:30–09:30)', { chochWindowH: 1, chochSkip: null }],
  ['1h trend + swing 10', { htfMin: 60, htfEma: 50, swingLen: 10 }],
  ['1h trend + swing 10 + 1/session', { htfMin: 60, htfEma: 50, swingLen: 10, maxTradesPerSession: 1 }],
  ['1h trend + swing 10 + disp 2 + 5R', { htfMin: 60, htfEma: 50, swingLen: 10, minDispATR: 2, tpR: 5 }],
];
const res = G.map(() => ({}));
for (const y of YRS) G.forEach(([, o], i) => { res[i][y] = V.run({ ...base, ...o }, [y])[y]; });
console.log('variant'.padEnd(38), YRS.map((y) => `Oct${String(y).slice(2)}`.padStart(8)).join(''), '   total     n  R/trade  win%  fee(R)');
G.forEach(([n], i) => {
  const all = YRS.flatMap((y) => res[i][y]), tot = all.reduce((a, x) => a + x.R, 0), fe = all.map((x) => x.feeR).sort((a, b) => a - b);
  console.log(n.padEnd(38), YRS.map((y) => res[i][y].reduce((a, x) => a + x.R, 0).toFixed(1).padStart(8)).join(''), tot.toFixed(1).padStart(8), String(all.length).padStart(6),
    (tot / Math.max(1, all.length)).toFixed(3).padStart(8), (all.filter((x) => x.R > 0.15).length / Math.max(1, all.length) * 100).toFixed(0).padStart(5), (fe[fe.length >> 1] || 0).toFixed(2).padStart(7));
});
