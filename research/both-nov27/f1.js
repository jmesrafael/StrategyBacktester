// F1 exits. PRE-LISTED GRID (written before running). 18 single changes, each via spec={bot:{...}}:
//  tc kTrail 10/11/12/13 | tc staleBars 36/60 | tc staleR 0.5 | ic kTrail 6/8 | ic lockAtR 3/5 | ic kInit 1.5/2 | bb maxBars 36/48 | bb cool 0/6
// Selection rule (declared before running): per bot, the single with best test-3 (flat 2020-23) cagr/dd ratio, only if it beats the
// baseline test-3 ratio; bots with no such single keep live rules. ONE combination = all per-bot picks together; fitK on it, then evaluate.
const fs = require('fs'), H = require('./h.js');
const out = []; const log = console.log; console.log = (...a) => { const s = a.join(' '); out.push(s); log(s); };
const G = [];
for (const v of [10, 11, 12, 13]) G.push(['tc', 'kTrail', v]);
for (const v of [36, 60]) G.push(['tc', 'staleBars', v]);
G.push(['tc', 'staleR', 0.5]);
for (const v of [6, 8]) G.push(['ic', 'kTrail', v]);
for (const v of [3, 5]) G.push(['ic', 'lockAtR', v]);
for (const v of [1.5, 2]) G.push(['ic', 'kInit', v]);
for (const v of [36, 48]) G.push(['bb', 'maxBars', v]);
for (const v of [0, 6]) G.push(['bb', 'cool', v]);
const B = H.base(); const br = B[2].cagr / B[2].dd;
console.log('baseline test3 ratio ' + br.toFixed(2));
const rs = G.map(([b, k, v]) => ({ b, k, v, r: H.evaluate({ spec: { [b]: { [k]: v } } }, `${b} ${k} ${v}`) }));
const picks = {};
for (const x of rs) { const q = x.r.res[2].cagr / x.r.res[2].dd; x.q = q; if (q > br && (!picks[x.b] || q > picks[x.b].q)) picks[x.b] = x; }
console.log('test-3 ratios: ' + rs.map((x) => `${x.b}.${x.k}=${x.v}:${x.q.toFixed(2)}`).join(' '));
console.log('picks: ' + (Object.keys(picks).map((b) => `${b}.${picks[b].k}=${picks[b].v}`).join(', ') || 'none'));
if (Object.keys(picks).length) {
  const spec = {}; for (const b in picks) spec[b] = { [picks[b].k]: picks[b].v };
  const c = { spec }; const K = H.fitK(c); console.log('COMBO spec ' + JSON.stringify(spec));
  H.evaluate(c, 'combo K=1'); H.evaluate({ ...c, K }, 'combo fitK K=' + K.toFixed(3));
}
fs.writeFileSync(__dirname + '/f1-results.md', '# F1 exits results (Nov 27, 2026)\n```\n' + out.join('\n') + '\n```\n');
