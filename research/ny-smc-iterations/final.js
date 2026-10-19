const fs = require('fs'), E = require('./ie.js');
const S2 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5 };
const V = [
  ['v0', 'original formula', {}],
  ['v1', 'v0 + CHoCH 09:30-11:30 only', { chochWindowH: 2 }],
  ['v2', 'session 08:30, CHoCH 08:30-11:30', S2],
  ['v3', 'v2 + fixed 3R target', { ...S2, tpMode: 'R', tpR: 3 }],
  ['v4', 'v3 + CHoCH bar >= 1 ATR', { ...S2, tpMode: 'R', tpR: 3, minDispATR: 1 }],
  ['v5a', 'v4 + 4h EMA200 trend', { ...S2, tpMode: 'R', tpR: 3, minDispATR: 1, htfMin: 240, htfEma: 200 }],
  ['v5b', 'v4 + FVG >= 0.2 ATR', { ...S2, tpMode: 'R', tpR: 3, minDispATR: 1, minFvgATR: 0.2 }],
];
const out = { versions: {}, stress: {} };
const fmt = (x) => `n=${String(x.n).padStart(3)} win=${(x.win * 100).toFixed(0).padStart(3)}% PF=${x.pf.toFixed(2).padStart(5)} R=${x.sumR.toFixed(1).padStart(6)} net=${(x.netPct * 100).toFixed(1).padStart(6)}% DD=${(x.maxDD * 100).toFixed(1).padStart(5)}%`;
const boot = (T, it = 4000) => { const a = T.map((t) => t.R), m = []; let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < it; i++) { let s = 0; for (let j = 0; j < a.length; j++) s += a[Math.floor(r() * a.length)]; m.push(s / a.length); }
  m.sort((x, y) => x - y); return [m[Math.floor(it * 0.05)], m[Math.floor(it * 0.95)]]; };
for (const [id, desc, c] of V) {
  console.log(`\n== ${id}: ${desc}`);
  const rec = {};
  const all = [];
  for (const sym of ['SOL', 'ETH']) {
    const r = E.runSym(sym, c); all.push(...r.trades);
    rec[sym] = r.by;
    for (const k of ['Y1', 'Y2', 'Y3']) console.log(`  ${sym} ${k}${k === 'Y3' ? '*' : ' '} ${fmt(r.by[k])}`);
  }
  const P = (f) => E.stats(all.filter(f).sort((a, b) => a.t - b.t));
  rec.poolTrain = P((t) => t.t < E.Y.Y3[0]); rec.poolY3 = P((t) => t.t >= E.Y.Y3[0]); rec.poolAll = P(() => true);
  rec.ci90 = boot(all); rec.ci90Y3 = boot(all.filter((t) => t.t >= E.Y.Y3[0]));
  console.log(`  POOL train ${fmt(rec.poolTrain)} avgR=${rec.poolTrain.avgR.toFixed(3)}`);
  console.log(`  POOL Y3*   ${fmt(rec.poolY3)} avgR=${rec.poolY3.avgR.toFixed(3)}  90%CI ${rec.ci90Y3.map((x) => x.toFixed(3)).join('..')}`);
  console.log(`  POOL 3yr   ${fmt(rec.poolAll)} avgR=${rec.poolAll.avgR.toFixed(3)}  90%CI ${rec.ci90.map((x) => x.toFixed(3)).join('..')}`);
  out.versions[id] = { desc, conf: c, ...rec };
}
// stress on finalists, all 3 years
const ST = [['costs x2', { costMult: 2 }], ['costs x3', { costMult: 3 }], ['fill must trade 0.02% through', { fillThrough: 0.0002 }],
  ['fill must trade 0.05% through', { fillThrough: 0.0005 }], ['costs x2 + 0.02% through', { costMult: 2, fillThrough: 0.0002 }]];
for (const id of ['v4', 'v5a']) {
  console.log(`\n== stress ${id} (pooled SOL+ETH; train | Y3 | 3yr)`);
  out.stress[id] = {};
  for (const [nm, p] of ST) {
    const c = { ...out.versions[id].conf, ...p };
    const T = [...E.runSym('SOL', c).trades, ...E.runSym('ETH', c).trades].sort((a, b) => a.t - b.t);
    const a = E.stats(T.filter((t) => t.t < E.Y.Y3[0])), b = E.stats(T.filter((t) => t.t >= E.Y.Y3[0])), z = E.stats(T);
    out.stress[id][nm] = { train: a, y3: b, all: z };
    console.log(`  ${nm.padEnd(32)} PF ${a.pfR.toFixed(2)} ${a.sumR.toFixed(1).padStart(6)}R | PF ${b.pfR.toFixed(2)} ${b.sumR.toFixed(1).padStart(6)}R | PF ${z.pfR.toFixed(2)} ${z.sumR.toFixed(1).padStart(6)}R`);
  }
}
fs.writeFileSync(__dirname + '/results/final.json', JSON.stringify(out, null, 1));
