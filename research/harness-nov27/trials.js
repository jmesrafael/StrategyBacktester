// trials.js: log every tested config; warn about multiple testing when N>20.
'use strict';
const fs = require('fs'), path = require('path');
const LOG = path.join(__dirname, 'trials.log.jsonl');
const count = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).length : 0);
// Expected max of N iid standard normals ~ sqrt(2 ln N): a best-of-N winner among zero-edge configs looks this many
// sigma (t-stat / annualised-Sharpe units) better than a single honest test.
const inflation = (N) => Math.sqrt(2 * Math.log(Math.max(N, 1)));
function logTrial(cfg, result, note) {
  fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), cfg, result, note }) + '\n');
  const N = count();
  if (N > 20) console.warn(`WARNING multiple testing: ${N} trials logged. Best-of-${N} of zero-edge configs is expected to look ~${inflation(N).toFixed(2)} sigma (Sharpe-like) better than a single test; discount the winner or confirm on clean OOS.`);
  return N;
}
module.exports = { logTrial, count, inflation, LOG };
