// pd-rules.js — PDH/PDL rules on top of frozen v7, judged per regime (2019–23 vs 2023–26) and per coin. Binance 15m, $1 risk.
// Rules: skip / keep by PD label, or move the take-profit to a PD level that lies between +minR and 3R.
// usage: node pd-rules.js [coins…] (default SOL ETH) → printed table; COINS other than SOL/ETH = untouched check
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js'), P = require('./pd-study.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const coins = process.argv.slice(2).length ? process.argv.slice(2) : ['SOL', 'ETH'];
const SPLIT = D0('2023-10-18'), END = D0('2026-10-18');
const RULES = [
  ['v7', null],
  ['skip: PD level between +1R and 3R', { skip: (f) => f.block3 }],
  ['skip: no PD level involved', { skip: (f) => f.none }],
  ['skip: both of the above', { skip: (f) => f.block3 || f.none }],
  ['only: classic sweep (long PDL / short PDH)', { skip: (f, s) => !((s.long && f.sweep === 'PDL') || (!s.long && f.sweep === 'PDH')) }],
  ['only: any sweep / bounce / retest', { skip: (f) => !(f.sweep || f.bounce || f.retest) }],
  ['only: entry outside previous-day range', { skip: (f) => f.inRange }],
  ['only: reclaim (long PDH / short PDL)', { skip: (f, s) => !((s.long && f.sweep === 'PDH') || (!s.long && f.sweep === 'PDL')) }],
  ['only: outside range or reclaim', { skip: (f, s) => f.inRange && !((s.long && f.sweep === 'PDH') || (!s.long && f.sweep === 'PDL')) }],
  ['target: PD level if between +1R and 3R', { tpAt: 1 }],
  ['target: PD level if between +1.5R and 3R', { tpAt: 1.5 }],
  ['target: PD level if between +2R and 3R', { tpAt: 2 }],
];
const res = {};
for (const sym of coins) {
  const file = `data/binance-${sym.toLowerCase()}15.json`;
  if (!fs.existsSync(file)) { console.log('missing', file); continue; }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')), D = E.analyze(sym + '-binance', raw, C.swingLen);
  const start = raw[0][0] + 30 * 86400, S = E.setupsFor(D, C);
  const pdAt = require('./pdny.js').levels(D, process.env.PD || 'nyday');
  for (const [name, r] of RULES) {
    let setups = S;
    if (r && r.skip) setups = S.filter((s) => { const f = P.label(D, s); return f && !r.skip(f, s); });
    if (r && r.tpAt != null) setups = S.map((s) => {
      const day = pdAt(s.chochIdx); if (!day) return s;
      const dir = s.long ? 1 : -1;
      const lv = [day.pdh, day.pdl].map((p) => ({ p, r: dir * (p - s.entry) / s.risk })).filter((x) => x.r >= r.tpAt && x.r < C.tpR).sort((a, b) => a.r - b.r)[0];
      return lv ? { ...s, tp: s.entry + dir * (lv.r - 0.05) * s.risk } : s; // just in front of the level
    });
    const t = E.execute(D, C, setups).filter((x) => x.t >= start && x.t < END);
    const k = (a) => ({ n: a.length, R: a.reduce((p, x) => p + x.R, 0) });
    (res[name] = res[name] || {})[sym] = { pre: k(t.filter((x) => x.t < SPLIT)), post: k(t.filter((x) => x.t >= SPLIT)) };
  }
}
const f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(1);
console.log('rule'.padEnd(44), coins.map((c) => `${c} pre`.padStart(13) + `${c} post`.padStart(13)).join(''), '      all');
for (const [name] of RULES) {
  let tot = 0;
  const cells = coins.map((c) => { const r = res[name][c]; if (!r) return ''.padStart(26); tot += r.pre.R + r.post.R; return `${f(r.pre.R)} (${r.pre.n})`.padStart(13) + `${f(r.post.R)} (${r.post.n})`.padStart(13); });
  console.log(name.padEnd(44), cells.join(''), f(tot).padStart(9));
}
console.log('\npooled over', coins.join(' '), '— average R per trade (trades)');
for (const [name] of RULES) {
  const pool = (k) => { let n = 0, R = 0; for (const c of coins) if (res[name][c]) { n += res[name][c][k].n; R += res[name][c][k].R; } return `${(R / Math.max(1, n)).toFixed(3)} (${n}, ${f(R)})`; };
  console.log(name.padEnd(44), '2019–23', pool('pre').padStart(22), '   2023–26', pool('post').padStart(22));
}
