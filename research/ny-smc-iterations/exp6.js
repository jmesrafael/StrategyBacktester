// exp6.js — test refinements on several bases; per coin, per year, plus pooled train / Y3.
// usage: node exp6.js <roundFile.js>   (exports { round, bases: {id: conf}, exps: [[id, desc, patch]] })
const fs = require('fs'), path = require('path'), E = require('./ie.js');
const R = require(path.resolve(process.argv[2]));
const LOG = __dirname + '/results/log.jsonl';
const Ys = ['Y1', 'Y2', 'Y3'], sg = (x) => ((x >= 0 ? '+' : '') + x.toFixed(1)).padStart(6);
const rows = [];
console.log(`ROUND ${R.round}. Columns: R per coin-year | coin-years positive /6 | pooled train PF & R | pooled Y3 PF & R | 3-yr R, ddR, trades`);
console.log('base  id'.padEnd(16), 'description'.padEnd(40), '| SOL Y1   Y2    Y3   | ETH Y1   Y2    Y3   | +/6 | train PF    R  | Y3  PF    R  | 3yr R   ddR   n');
for (const [bid, bconf] of Object.entries(R.bases)) {
  for (const [id, desc, patch] of R.exps) {
    const c = { ...bconf, ...patch };
    const res = { SOL: E.runSym('SOL', c), ETH: E.runSym('ETH', c) };
    const T = [...res.SOL.trades, ...res.ETH.trades].sort((a, b) => a.t - b.t);
    const tr = E.stats(T.filter((t) => t.t < E.Y.Y3[0])), y3 = E.stats(T.filter((t) => t.t >= E.Y.Y3[0])), all = E.stats(T);
    const cy = ['SOL', 'ETH'].flatMap((k) => Ys.map((y) => res[k].by[y].sumR));
    const pos = cy.filter((x) => x > 0).length;
    rows.push({ round: R.round, base: bid, id, desc, cy, pos, train: tr, y3, all, conf: JSON.stringify(c) });
    console.log(`${bid.padEnd(5)} ${id}`.padEnd(16), desc.slice(0, 40).padEnd(40), '|', cy.slice(0, 3).map(sg).join(''), ' |', cy.slice(3).map(sg).join(''), ` | ${pos}/6 |`,
      tr.pfR.toFixed(2).padStart(5), sg(tr.sumR), ' |', y3.pfR.toFixed(2).padStart(5), sg(y3.sumR), ' |', sg(all.sumR), all.ddR.toFixed(1).padStart(5), String(all.n).padStart(4));
  }
  console.log('');
}
fs.appendFileSync(LOG, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
