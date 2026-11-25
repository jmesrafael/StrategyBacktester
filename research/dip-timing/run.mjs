// read candles straight from the library so the intel registry is not rewritten
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), app = 'D:/testing/Strat/StrategyBacktester/';
const C = require(app + 'candles/candles.js'), MK = require(app + 'intel/lib/market');
MK.has = () => true; MK.candles = (c, tf) => C.load(c, tf).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
MK.bars = (c, tf) => (tf === 'funding' ? C.funding(c) : C.load(c, tf));
console.log(Object.keys(C).join(' '));
await import("./dip.mjs");
