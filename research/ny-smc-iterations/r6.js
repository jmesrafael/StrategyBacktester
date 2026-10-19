const S2 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5 };
const v3 = { ...S2, tpMode: 'R', tpR: 3 };
module.exports = { round: 6, bases: { v3, v4: { ...v3, minDispATR: 1 }, v5b: { ...v3, minDispATR: 1, minFvgATR: 0.2 } }, exps: [
 ['base', 'unchanged', {}],
 ['K1', 'skip CHoCH 09:30-10:30 ET', { chochSkip: [1, 2] }],
 ['K2', 'skip CHoCH 09:30-10:00 ET', { chochSkip: [1, 1.5] }],
 ['F8', 'cancel order if no fill in 8 bars', { maxFillBars: 8 }],
 ['F4', 'cancel order if no fill in 4 bars', { maxFillBars: 4 }],
 ['X4', 'skip stop > 4 ATR', { maxStopATR: 4 }],
 ['X5', 'skip stop > 5 ATR', { maxStopATR: 5 }],
 ['FT4', 'exit at close if < +0.25R after 4 bars', { ftBars: 4, ftMinR: 0.25 }],
 ['FT3', 'exit at close if < +0.25R after 3 bars', { ftBars: 3, ftMinR: 0.25 }],
 ['FT6', 'exit at close if < +0.25R after 6 bars', { ftBars: 6, ftMinR: 0.25 }],
 ['FT4.5', 'exit at close if < +0.5R after 4 bars', { ftBars: 4, ftMinR: 0.5 }],
 ['FT4t', 'tighten stop to -0.5R if < +0.25R @4', { ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5 }],
 ['P1', 'take 50% at +1R, rest to 3R', { partialR: 1, partialFrac: 0.5 }],
 ['P1.5', 'take 50% at +1.5R, rest to 3R', { partialR: 1.5, partialFrac: 0.5 }],
 ['P2', 'take 50% at +2R, rest to 3R', { partialR: 2, partialFrac: 0.5 }],
]};
