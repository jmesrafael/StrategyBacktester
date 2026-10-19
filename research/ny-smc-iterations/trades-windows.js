// trades-windows.js — baseline v7 trades (continuous series, as in Check A/B) and the time windows needing 1m candles.
const fs = require('fs'), path = require('path'), E = require('./ie.js');
const DATA = path.resolve(__dirname, '../sol-ny-smc/data');
const V7 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5, tpMode: 'R', tpR: 3, minDispATR: 1, minFvgATR: 0.2,
  chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5, maxStopATR: 4, maxFillBars: 8 };
const C = { ...E.BASE, ...V7 };
const SERIES = { SOL: ['data/sol15-pre.json', DATA + '/sol15-oos.json', DATA + '/sol15.json'], ETH: ['data/eth15-pre.json', DATA + '/eth15-all.json'] };
function build(sym) {
  const raw = SERIES[sym].flatMap((f) => JSON.parse(fs.readFileSync(path.resolve(__dirname, f), 'utf8')));
  const D = E.analyze(sym + '-full', raw, C.swingLen);
  const trades = E.execute(D, C, E.setupsFor(D, C));
  return { D, trades };
}
function windows(D, trades) {
  const w = trades.map((t) => [D.B[t.fillIdx].time, D.B[t.exitIdx].time + 900]).sort((a, b) => a[0] - b[0]);
  const m = []; for (const x of w) { if (m.length && x[0] <= m[m.length - 1][1]) m[m.length - 1][1] = Math.max(m[m.length - 1][1], x[1]); else m.push([...x]); }
  return m;
}
module.exports = { C, V7, SERIES, build, windows };
if (require.main === module) for (const s of ['SOL', 'ETH']) { const { D, trades } = build(s), w = windows(D, trades);
  const mins = w.reduce((a, [x, y]) => a + (y - x) / 60, 0); const hold = trades.map((t) => t.exitIdx - t.fillIdx).sort((a, b) => a - b);
  console.log(s, 'trades', trades.length, 'windows', w.length, '1m candles needed', mins, 'requests ~', Math.ceil(mins / 1000) + w.length, 'median hold bars', hold[hold.length >> 1], 'max', hold[hold.length - 1]); }
