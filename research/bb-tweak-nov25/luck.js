// luck.js: could the same gain come from cutting risk on RANDOM trades? And what is the fair "same drawdown" comparison?
//   node luck.js  -> appends a section to RESULTS.md
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./engine');
const { END } = require('./check');
const K = JSON.parse(fs.readFileSync(path.join(__dirname, 'locked.json'), 'utf8')), CUT = K.cut, T0 = Date.UTC(2020, 0, 1) / 1000;
const A = L.replay({}, { endT: END }).trades;
let s = 2026; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
const stat = (R) => { let e = 0, p = 0, d = 0; for (const r of R) { e += r; p = Math.max(p, e); d = Math.max(d, p - e); } return { R: e, dd: d, rdd: e / d }; };
const md = ['', '## Luck test (closed trades)', '', 'Take BB-CORE\'s own trades and give the same number of reduced and skipped sizes to trades picked at random (20,000 draws).', '', '| Version | Window | Total R | Drawdown | Random picks with at least this R | with at least this R / drawdown | with both |', '|---|---|---|---|---|---|---|'];
for (const [id, cfg] of [['B', { ii: { len: 21, th: 0, lo: 0 } }], ['C1', K.champion.cfg], ['D1', K.iiCombo.cfg]]) {
  const V = L.replay(cfg, { endT: END }).trades, key = (t) => t.c + t.t, w = new Map(V.map((t) => [key(t), t.w]));
  for (const [name, a, b] of [['2024-26 unseen', CUT, END], ['all years', T0, END]]) {
    const base = A.filter((t) => t.tExit > a && t.tExit <= b), mine = stat(V.filter((t) => t.tExit > a && t.tExit <= b).map((t) => t.w * t.R));
    // sizes BB-CORE's trades got under the version (0 = not taken)
    const sizes = base.map((t) => w.get(key(t)) ?? 0), N = 20000; let r = 0, q = 0, both = 0;
    for (let n = 0; n < N; n++) { for (let i = sizes.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const v = sizes[i]; sizes[i] = sizes[j]; sizes[j] = v; }
      const x = stat(base.map((t, i) => sizes[i] * t.R)); if (x.R >= mine.R) r++; if (x.rdd >= mine.rdd) q++; if (x.R >= mine.R && x.dd <= mine.dd) both++; }
    md.push(`| ${id} | ${name} | ${mine.R.toFixed(0)} | ${mine.dd.toFixed(1)} | ${(100 * r / N).toFixed(1)}% | ${(100 * q / N).toFixed(1)}% | ${(100 * both / N).toFixed(1)}% |`);
  }
}
md.push('', '## Same drawdown comparison', '', 'BB-CORE today scaled down or up until its drawdown equals the version\'s drawdown: how much R would each earn?', '', '| Version | Window | Drawdown measure | Version R | BB-CORE R at the same drawdown | Version ahead by |', '|---|---|---|---|---|---|');
const full = L.replay({}, { endT: END });
for (const [id, cfg] of [['B', { ii: { len: 21, th: 0, lo: 0 } }], ['C1', K.champion.cfg], ['D1', K.iiCombo.cfg]]) {
  const v = L.replay(cfg, { endT: END });
  for (const [name, a, b] of [['2024-26 unseen', CUT, END], ['all years', T0, END]]) {
    const m = L.measure(v, a, b), z = L.measure(full, a, b);
    for (const [lab, k] of [['closed', 'dd'], ['with open trades', 'mdd']]) { const eq = z.R * (m[k] / z[k]); md.push(`| ${id} | ${name} | ${lab} | ${m.R.toFixed(0)} | ${eq.toFixed(0)} | ${(100 * (m.R / eq - 1)).toFixed(0)}% |`); }
  }
}
const f = path.join(__dirname, 'RESULTS.md'), old = fs.readFileSync(f, 'utf8').split('\n## Luck test')[0].trimEnd();
fs.writeFileSync(f, old + '\n' + md.join('\n') + '\n'); console.log(md.join('\n'));
