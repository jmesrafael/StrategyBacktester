// exp.js — run a list of experiments on TRAIN (Y1+Y2) for SOL and ETH, log every result.
// usage: node exp.js <roundFile.js>   (module exports { round, base, exps: [[id, desc, confPatch], ...], showY3 })
const fs = require('fs'), E = require('./ie.js');
const R = require(require('path').resolve(process.argv[2]));
const LOG = __dirname + '/results/log.jsonl';
const f = (x, d = 2) => (x >= 0 ? ' ' : '') + x.toFixed(d);
const pool = (a, b) => E.stats([...a, ...b].sort((x, y) => x.t - y.t));
const rows = [];
const periods = R.showY3 ? ['train', 'Y3'] : ['train'];
console.log(`ROUND ${R.round}  periods=${periods.join(',')}  (pooled = SOL+ETH trades combined)`);
console.log('id'.padEnd(8), 'description'.padEnd(46), 'per'.padEnd(6), '| SOL n  win   PF   sumR | ETH n  win   PF   sumR | POOL n  PF   avgR   sumR  ddR  Y1R   Y2R');
for (const [id, desc, patch] of R.exps) {
  const conf = { ...R.base, ...patch };
  const s = E.runSym('SOL', conf), e = E.runSym('ETH', conf);
  for (const per of periods) {
    const inP = (t) => (per === 'train' ? t.t < E.Y.Y3[0] : t.t >= E.Y.Y3[0]);
    const ts = s.trades.filter(inP), te = e.trades.filter(inP);
    const S = E.stats(ts), Et = E.stats(te), P = pool(ts, te);
    const y1 = pool(s.trades, e.trades); // placeholder
    const yr = (k) => E.stats([...s.trades, ...e.trades].filter((t) => t.t >= E.Y[k][0] && t.t < E.Y[k][1])).sumR;
    const row = { round: R.round, id, desc, per, SOL: S, ETH: Et, POOL: P, Y1R: yr('Y1'), Y2R: yr('Y2'), conf: JSON.stringify(patch, (k, v) => (typeof v === 'function' ? v.toString() : v)) };
    rows.push(row);
    console.log(id.padEnd(8), desc.slice(0, 46).padEnd(46), per.padEnd(6), '|',
      String(S.n).padStart(5), (S.win * 100).toFixed(0).padStart(4) + '%', f(S.pf).padStart(5), f(S.sumR, 1).padStart(6), '|',
      String(Et.n).padStart(5), (Et.win * 100).toFixed(0).padStart(4) + '%', f(Et.pf).padStart(5), f(Et.sumR, 1).padStart(6), '|',
      String(P.n).padStart(6), f(P.pfR).padStart(5), f(P.avgR, 3).padStart(7), f(P.sumR, 1).padStart(6), P.ddR.toFixed(1).padStart(5),
      per === 'train' ? f(yr('Y1'), 1).padStart(6) + f(yr('Y2'), 1).padStart(6) : '');
  }
}
fs.appendFileSync(LOG, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
