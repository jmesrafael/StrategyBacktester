// round1.js - the families of PLAN.md. size: true = a size rule (gets the random-trade luck check)
'use strict';
const { BASE, adxAt } = require('./engine');
const list = (...a) => a.reduce((acc, arr) => acc.flatMap((p) => arr.map((v) => [...p, v])), [[]]);
const fam = (id, name, versions, size = false) => ({ id, name, versions: versions.map((v) => ({ id, ...v })), size });
const openCount = (st, f) => st.W.reduce((n, w) => n + w.open.reduce((m, p) => m + (f(p.x, w.id) ? 1 : 0), 0), 0);
const scaled = (extra, w) => ({ ...Object.fromEntries(Object.entries(BASE).map(([id, v]) => [id, v * (1 - w)])), [extra]: w });

const weights = [];
for (let b = 40; b <= 75; b += 5) for (let i = 10; i <= 35; i += 5) { const t = 100 - b - i; if (t >= 5 && !(b === 50 && i === 25)) weights.push({ label: `BB ${b} / I ${i} / T ${t}`, weights: { bb: b / 100, ic: i / 100, tc: t / 100 } }); }

module.exports = [
  fam('A', 'size from equity minus open profit', [0.25, 0.5, 0.75, 1].map((h) => ({ label: `${h * 100}% of open profit left out`, openPart: h }))),
  fam('B', 'crowded side cut', list([4, 6, 8, 10], [0.25, 0.5, 0.75]).map(([n, m]) => ({ label: `${n}+ open same side: size x${m}`, mult: (x, id, st) => (openCount(st, (p) => p.dir === x.dir) >= n ? m : 1) })), true),
  fam('C', 'same coin and side held by another bot', list(['it', 'any'], [0, 0.25, 0.5, 0.75]).map(([p, m]) => ({ label: `${p === 'it' ? 'I+T' : 'any pair'}: size x${m}`,
    mult: (x, id, st) => { if (p === 'it' && id === 'bb') return 1; return openCount(st, (o, oid) => oid !== id && (p === 'any' || oid !== 'bb') && o.c === x.c && o.dir === x.dir) ? m : 1; } })), true),
  fam('D', 'high ADX half size on I / T', list([25, 27, 30], ['ic', 'tc', 'both']).map(([a, b]) => ({ label: `ADX>${a} half on ${b}`, mult: (x, id) => ((b === 'both' ? id !== 'bb' : id === b) && adxAt(x.c, x.t) > a ? 0.5 : 1) })), true),
  fam('E', 'cut while open profit is large', list([0.1, 0.2, 0.3], [0.25, 0.5]).map(([p, m]) => ({ label: `open profit > ${p * 100}%: size x${m}`, mult: (x, id, st) => (st.openPL > p * st.equity ? m : 1) })), true),
  fam('F', 'cut while below the high', list([0.15, 0.25, 0.35], [0.5, 0.75]).map(([d, m]) => ({ label: `${d * 100}% below high: size x${m}`, mult: (x, id, st) => (st.equity < (1 - d) * st.peak ? m : 1) })), true),
  fam('G', 'rebalance period', [1, 2, 6].map((r) => ({ label: `rebalance every ${r} months`, rebal: r }))),
  fam('H', 'other BB / I / T shares', weights),
  fam('I', 'add ICHI-X4', [0.05, 0.1, 0.15, 0.2].map((w) => ({ label: `ICHI-X4 ${w * 100}%`, weights: scaled('ichi', w) }))),
  fam('J', 'add BB 1H WIDE', [0.05, 0.1, 0.15, 0.2].map((w) => ({ label: `WIDE ${w * 100}%`, weights: scaled('wide', w) }))),
];
