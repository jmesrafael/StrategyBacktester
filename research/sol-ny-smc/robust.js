// Robustness checks on the base-variant trade list: bootstrap CI, period split,
// long/short split, and a raw-candle spot check of a few trades.
const fs = require('fs');
const tf = process.argv[2];
const T = JSON.parse(fs.readFileSync(__dirname + `/results/trades-${tf}.json`, 'utf8'));
const B = JSON.parse(fs.readFileSync(__dirname + (tf === '15m' ? '/data/sol15.json' : '/data/sol1.json'), 'utf8'));
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

// seeded bootstrap of mean R (net)
let seed = 42; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const R = T.map((t) => t.R), means = [];
for (let k = 0; k < 10000; k++) { let s = 0; for (let i = 0; i < R.length; i++) s += R[Math.floor(rnd() * R.length)]; means.push(s / R.length); }
means.sort((a, b) => a - b);
const pPos = means.filter((m) => m > 0).length / means.length;
console.log(tf, `n=${T.length} meanR=${avg(R).toFixed(3)} 95%CI=[${means[250].toFixed(3)}, ${means[9750].toFixed(3)}] P(mean>0)=${(pPos * 100).toFixed(1)}%`);

const split = Date.parse('2026-04-18T00:00:00Z');
for (const [name, set] of [['H1 Oct25–Apr26', T.filter((t) => Date.parse(t.fillTime) < split)], ['H2 Apr26–Oct26', T.filter((t) => Date.parse(t.fillTime) >= split)],
  ['longs', T.filter((t) => t.long)], ['shorts', T.filter((t) => !t.long)]]) {
  const w = set.filter((t) => t.pnl > 0).length;
  const gp = set.filter((t) => t.pnl > 0).reduce((a, t) => a + t.pnl, 0), gl = -set.filter((t) => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0);
  console.log('  ', name.padEnd(16), `n=${set.length}`.padEnd(7), `win=${(w / (set.length || 1) * 100).toFixed(1)}%`.padEnd(11), `PF=${(gl ? gp / gl : 0).toFixed(2)}`.padEnd(9), `avgR=${avg(set.map((t) => t.R)).toFixed(3)}`);
}

// spot check: replay 3 trades bar by bar from the raw file
if (process.argv[3] === '--spot') {
  for (const t of [T[0], T[Math.floor(T.length / 2)], T[T.length - 1]]) {
    const bars = B.slice(t.fillIdx, t.exitIdx + 1);
    const side = t.long ? 1 : -1;
    const hitStop = bars.findIndex((b) => (t.long ? b[3] <= t.stop : b[2] >= t.stop));
    const hitTp = bars.findIndex((b) => (t.long ? b[2] >= t.tp : b[3] <= t.tp));
    console.log(`  ${t.long ? 'LONG ' : 'SHORT'} fill ${t.fillTime} @${t.fillPx.toFixed(3)} stop ${t.stop.toFixed(3)} tp ${t.tp.toFixed(3)} → ${t.reason} ${t.exitTime} @${t.exitPx.toFixed(3)}`,
      `| fill bar L/H ${B[t.fillIdx][3]}/${B[t.fillIdx][2]} | bars held ${bars.length - 1} | first stop-touch bar ${hitStop} first tp-touch bar ${hitTp} | R=${t.R.toFixed(2)}`);
  }
}
