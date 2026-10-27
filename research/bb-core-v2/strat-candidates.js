// strat-candidates.js — candidate bb-core additions. Every threshold is a TRAIN-period (pre-2023) tercile cut from `node strat-search.js features`;
// nothing here was tuned on 2023+. Idea behind them: the worst bb-core signals are the OVER-EXTENDED ones (wide bands, far from the 200 SMA,
// high volatility, already-strong push, overbought, BTC stretched the same way). Skip those, keep the early breakouts.
'use strict';
const CUT = { bw: 0.159, ext: 0.204, atrPct: 0.044, er: 0.373, diDir: 20.776, rsi: 69.436, btc: 0.107 };   // top-third boundaries (TRAIN)
const over = (f) => ['bw', 'ext', 'atrPct', 'er', 'diDir', 'rsi'].filter((k) => f[k] != null && f[k] >= CUT[k]).length;   // how many "stretched" flags

module.exports = [
  // one filter at a time: drop the most-stretched third
  ['skip widest bands (bw ≥ 0.159)', { filterFn: (f) => !(f.bw >= CUT.bw) }],
  ['skip far from SMA200 (ext ≥ 20%)', { filterFn: (f) => !(f.ext >= CUT.ext) }],
  ['skip high volatility (ATR ≥ 4.4% of price)', { filterFn: (f) => !(f.atrPct >= CUT.atrPct) }],
  ['skip very efficient run-up (ER ≥ 0.37)', { filterFn: (f) => !(f.er >= CUT.er) }],
  ['skip strong DI push (DI diff ≥ 20.8)', { filterFn: (f) => !(f.diDir >= CUT.diDir) }],
  ['skip overbought/oversold (RSI ≥ 69.4 in trade dir)', { filterFn: (f) => !(f.rsi >= CUT.rsi) }],
  ['skip when BTC stretched ≥ 10.7% the same way', { filterFn: (f) => !(f.btc >= CUT.btc) }],
  // "not stretched" score: count the stretched flags
  ['STRETCH score: skip if ≥ 3 of 6 flags', { filterFn: (f) => over(f) < 3 }],
  ['STRETCH score: skip if ≥ 2 of 6 flags', { filterFn: (f) => over(f) < 2 }],
  ['STRETCH score: skip if any flag', { filterFn: (f) => over(f) < 1 }],
  ['STRETCH ≥ 2 flags OR BTC stretched → skip', { filterFn: (f) => over(f) < 2 && !(f.btc >= CUT.btc) }],
  // the same, with the longer hold (96 candles)
  ['STRETCH ≥ 2 → skip + hold 96', { filterFn: (f) => over(f) < 2, maxBars: 96 }],
  ['STRETCH ≥ 2 or BTC → skip + hold 96', { filterFn: (f) => over(f) < 2 && !(f.btc >= CUT.btc), maxBars: 96 }],
  ['hold 96 only', { maxBars: 96 }],
  // POST-HOC (picked after seeing the TEST column above — treat as optimistic)
  ['(post-hoc) skip ext ≥ 20% + hold 96', { filterFn: (f) => !(f.ext >= CUT.ext), maxBars: 96 }],
  ['(post-hoc) skip ext ≥ 20% or ATR ≥ 4.4% + hold 96', { filterFn: (f) => !(f.ext >= CUT.ext) && !(f.atrPct >= CUT.atrPct), maxBars: 96 }],
  ['(post-hoc) skip ext ≥ 20% or DI ≥ 20.8 + hold 96', { filterFn: (f) => !(f.ext >= CUT.ext) && !(f.diDir >= CUT.diDir), maxBars: 96 }],
];
