// matrix.js — per version: SOL and ETH, each year separately, with a positive-R check.
const f = require('./results/final.json').versions;
const Y = ['Y1', 'Y2', 'Y3'], lab = { Y1: 'Oct23-Oct24', Y2: 'Oct24-Oct25', Y3: 'Oct25-Oct26' };
const s = (x) => (x >= 0 ? '+' : '') + x.toFixed(1);
const out = ['| Version | Coin | Y1 (Oct23–Oct24) | Y2 (Oct24–Oct25) | Y3 (Oct25–Oct26) | Years positive | SOL+ETH same-year both positive |', '|---|---|---|---|---|---|---|'];
for (const [id, v] of Object.entries(f)) {
  const both = Y.map((y) => v.SOL[y].sumR > 0 && v.ETH[y].sumR > 0);
  for (const c of ['SOL', 'ETH']) {
    const pos = Y.filter((y) => v[c][y].sumR > 0).length;
    out.push(`| ${c === 'SOL' ? '**' + id + '** ' + v.desc : ''} | ${c} | ` + Y.map((y) => `${s(v[c][y].sumR)}R · PF ${v[c][y].pf.toFixed(2)} · n=${v[c][y].n}`).join(' | ') + ` | ${pos}/3 | ` +
      (c === 'SOL' ? Y.map((y, i) => (both[i] ? '✅' : '❌')).join(' ') + ` → ${both.filter(Boolean).length}/3` : '') + ' |');
  }
}
console.log(out.join('\n'));
