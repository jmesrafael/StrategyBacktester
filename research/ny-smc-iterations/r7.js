const S2 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5 };
const v3 = { ...S2, tpMode: 'R', tpR: 3 };
const K1 = { chochSkip: [1, 2] }, FT = { ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5 }, X4 = { maxStopATR: 4 };
module.exports = { round: 7, bases: { v4: { ...v3, minDispATR: 1 }, v5b: { ...v3, minDispATR: 1, minFvgATR: 0.2 } }, exps: [
 ['base', 'unchanged', {}],
 ['K1+FT', 'skip open hour + tighten', { ...K1, ...FT }],
 ['K1+X4', 'skip open hour + stop <= 4 ATR', { ...K1, ...X4 }],
 ['FT+X4', 'tighten + stop <= 4 ATR', { ...FT, ...X4 }],
 ['ALL3', 'K1 + FT + X4', { ...K1, ...FT, ...X4 }],
 ['ALL3 k.75', 'nbr: skip 09:15-10:30', { ...K1, ...FT, ...X4, chochSkip: [0.75, 2] }],
 ['ALL3 k1.75', 'nbr: skip 09:30-10:15', { ...K1, ...FT, ...X4, chochSkip: [1, 1.75] }],
 ['ALL3 k2.25', 'nbr: skip 09:30-10:45', { ...K1, ...FT, ...X4, chochSkip: [1, 2.25] }],
 ['ALL3 t.3', 'nbr: tighten to -0.3R', { ...K1, ...FT, ...X4, ftTightR: 0.3 }],
 ['ALL3 t.7', 'nbr: tighten to -0.7R', { ...K1, ...FT, ...X4, ftTightR: 0.7 }],
 ['ALL3 b3', 'nbr: check after 3 bars', { ...K1, ...FT, ...X4, ftBars: 3 }],
 ['ALL3 b6', 'nbr: check after 6 bars', { ...K1, ...FT, ...X4, ftBars: 6 }],
 ['ALL3 m.5', 'nbr: need +0.5R by bar 4', { ...K1, ...FT, ...X4, ftMinR: 0.5 }],
 ['ALL3 x3.5', 'nbr: stop <= 3.5 ATR', { ...K1, ...FT, ...X4, maxStopATR: 3.5 }],
 ['ALL3 x5', 'nbr: stop <= 5 ATR', { ...K1, ...FT, ...X4, maxStopATR: 5 }],
 ['ALL3 T2.5', 'nbr: 2.5R target', { ...K1, ...FT, ...X4, tpR: 2.5 }],
 ['ALL3 T3.5', 'nbr: 3.5R target', { ...K1, ...FT, ...X4, tpR: 3.5 }],
 ['ALL3+F8', '+ cancel unfilled after 8 bars', { ...K1, ...FT, ...X4, maxFillBars: 8 }],
]};
