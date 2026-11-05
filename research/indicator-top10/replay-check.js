// replay-check.js — "live replay" test of strategies/ma-trend-strategy.js (the file the app loads), no repaint / no look-ahead.
//  1. every STREAMING MA in the strategy file == the batch indicator (indicators.js) at every bar, for all 10 types.
//  2. a bar-by-bar replay engine that copies the app's order semantics (strategy.js simulate(): decision on a closed bar -> fills at NEXT open,
//     stop touched inside the bar, trailing stop ratchets after a surviving bar and is live from the next bar). The strategy is only ever shown
//     candles 0..i (truncated copies), never the full series. Its trades are compared with the research batch run (rstrat.sim, stopRef 'close').
const fs = require('fs'), vm = require('vm'), path = require('path');
const { IND, SMA, SMMA } = require('./indicators');
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../strategies/ma-trend-strategy.js'), 'utf8'), { window: win, Math, Number, isNaN, Array, Object });
const Strat = win.__STRATEGIES.matrend;
const COINS = (process.env.COINS || 'BTC,ETH,SOL,ADA,ZEC,NEAR,GALA').split(','); process.env.COINS = COINS.join(',');
const R = require('./rstrat.js');
// ---- 1. streaming == batch -------------------------------------------------------------------------------------------------------------
{ let bad = 0, n = 0; const b = JSON.parse(fs.readFileSync('data4h/BTC.json')); const C = b.map(r => r[4]), V = b.map(r => r[5]);
  for (const t of Object.keys(IND)) for (const len of [20, 50, 200]) { const batch = IND[t](C, V, len); const s = Strat; s.init({ maType: t, entry: 'Price crosses MA', maLen: len, fastLen: 10, trendLen: 0, kInit: 2, kTrail: 14, riskPct: 2.5, maxBars: 600, direction: 'Long only' });
    const ind = { candles: b.map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })) };
    s._build(ind, 0); s.last = 0; for (let j = 1; j < C.length; j++) { s._push(ind.candles[j], j); const v = s.curM, w = batch[j]; n++; if (!(Number.isNaN(v) && Number.isNaN(w)) && !(Math.abs(v - w) <= 1e-9 * Math.max(1, Math.abs(w)))) { bad++; if (bad < 4) console.log('MISMATCH', t, len, j, v, w); } } }
  console.log(`1) streaming MAs vs batch: ${n} bar-values, ${bad} mismatches`); }
// ---- 2. replay engine -------------------------------------------------------------------------------------------------------------------
const COST = { fee: 0.0005, slip: 0.0002, fund: 0.00005 };
function atrAt(C, i) { // Wilder ATR(14) of candles 0..i ONLY (recomputed on the truncated series)
  const tr = (k) => k ? Math.max(C[k].high - C[k].low, Math.abs(C[k].high - C[k - 1].close), Math.abs(C[k].low - C[k - 1].close)) : C[0].high - C[0].low;
  if (i < 14) return null; let a = 0; for (let k = 1; k <= 14; k++) a += tr(k); a /= 14; for (let k = 15; k <= i; k++) a = (a * 13 + tr(k)) / 14; return a; }
function replay(coin, params) {
  const rows = JSON.parse(fs.readFileSync(`data4h/${coin}.json`)); const all = rows.map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  Strat.init(params); const trades = []; let pos = null, pending = null, st = null; let atrState = null;
  const fullC = all.map(c => c.close); const sma200 = SMA(fullC, 200); // causal (value at i uses bars <=i) — only read at index i
  const atrFull = []; { const tr = (k) => k ? Math.max(all[k].high - all[k].low, Math.abs(all[k].high - all[k - 1].close), Math.abs(all[k].low - all[k - 1].close)) : all[0].high - all[0].low; let a = 0; for (let k = 0; k < all.length; k++) { if (k < 14) atrFull.push(null); else if (k === 14) { for (let q = 1; q <= 14; q++) a += tr(q); a /= 14; atrFull.push(a); } else { a = (a * 13 + tr(k)) / 14; atrFull.push(a); } } }
  for (let i = 0; i < all.length; i++) { const c = all[i];
    if (pending) { // fill at this bar's open
      if (pending === 'close') { if (pos) { const px = c.open, gross = pos.dir * (px - pos.entry) / pos.entry, cc = 2 * (COST.fee + COST.slip) + COST.fund * (i - pos.i0 + 1); trades.push({ t: all[pos.i0].time, tExit: c.time + 14400, R: (gross - cc) / pos.risk, bars: i - pos.i0 + 1, coin }); pos = null; } }
      else if (pending.signal) { const d = pending.signal === 'long' ? 1 : -1; pos = { dir: d, i0: i, entry: c.open, stop: pending.stopLoss, risk: Math.abs(c.open - pending.stopLoss) / c.open, ext: c.open }; }
      else if (pending.stopLoss != null && pos) { if (pos.dir === 1 ? pending.stopLoss > pos.stop : pending.stopLoss < pos.stop) pos.stop = pending.stopLoss; }
      pending = null; }
    if (pos) { const long = pos.dir === 1; if (long ? c.low <= pos.stop : c.high >= pos.stop) { const px = long ? Math.min(c.open, pos.stop) : Math.max(c.open, pos.stop);
        const gross = pos.dir * (px - pos.entry) / pos.entry, cc = 2 * (COST.fee + COST.slip) + COST.fund * (i - pos.i0 + 1); trades.push({ t: all[pos.i0].time, tExit: c.time + 14400, R: (gross - cc) / pos.risk, bars: i - pos.i0 + 1, coin }); pos = null; } }
    // the strategy only sees bars 0..i: truncated candle copy, truncated closes; indicators asked of it are computed on that prefix
    const prefC = all.slice(0, i + 1), prefCl = fullC.slice(0, i + 1);
    const ind = { candles: prefC, closes: prefCl, index: i, atr: (cs) => { const a = new Array(cs.length).fill(null); a[i] = atrFull[i]; return a; }, sma: (cl, n) => { const a = new Array(cl.length).fill(null); a[i] = sma200[i]; return a; } };
    if (i >= 205) { const acct = { position: pos ? (pos.dir === 1 ? 'long' : 'short') : null, entryPrice: pos ? pos.entry : null, stopLoss: pos ? pos.stop : null, takeProfit: null, barsInTrade: pos ? i - pos.i0 : 0, balance: 1, size: 1 };
      const res = Strat.onCandle(c, ind, acct); if (res) pending = res; } }
  return trades; }
const PARAMS = [ // [label, strategy params, research cfg]
  ['VWMA price×MA200', { maType: 'VWMA', entry: 'Price crosses MA', maLen: 200, fastLen: 50, trendLen: 200, kInit: 2, kTrail: 14, riskPct: 2.5, maxBars: 600, direction: 'Long only' }, ['VWMA', 'P', [200], true, true, 2, 14]],
  ['ALMA 50×200', { maType: 'ALMA', entry: 'Fast MA crosses slow MA', maLen: 200, fastLen: 50, trendLen: 200, kInit: 2, kTrail: 10, riskPct: 2.5, maxBars: 600, direction: 'Long only' }, ['ALMA', 'X', [50, 200], true, true, 2, 10]],
  ['HMA price×MA20 both sides', { maType: 'HMA', entry: 'Price crosses MA', maLen: 20, fastLen: 50, trendLen: 200, kInit: 2, kTrail: 14, riskPct: 2.5, maxBars: 600, direction: 'Both' }, ['HMA', 'P', [20], true, false, 2, 14]],
  ['KAMA price×MA100 both', { maType: 'KAMA', entry: 'Price crosses MA', maLen: 100, fastLen: 50, trendLen: 200, kInit: 2, kTrail: 20, riskPct: 2.5, maxBars: 600, direction: 'Both' }, ['KAMA', 'P', [100], true, false, 2, 20]],
];
let totalDiff = 0, totalT = 0;
for (const [label, sp, rc] of PARAMS) { let nT = 0, bad = 0, maxD = 0;
  for (const c of COINS) { const rp = replay(c, sp); const bt = R.sim(c, R.events(rc[0], c, rc[1], rc[2], rc[3], rc[4]), rc[5], rc[6], 600, 'close', 'nextOpen');
    nT += rp.length; if (rp.length !== bt.length) bad += Math.abs(rp.length - bt.length);
    for (let k = 0; k < Math.min(rp.length, bt.length); k++) { const d = Math.abs(rp[k].R - bt[k].R); maxD = Math.max(maxD, d); if (rp[k].t !== bt[k].t || rp[k].tExit !== bt[k].tExit || d > 1e-4) bad++; } }
  console.log(`2) ${label.padEnd(28)} replay trades ${nT}, mismatches vs batch ${bad}, max |R diff| ${maxD.toExponential(1)} (ATR seed differs in the 7th digit)`); totalDiff += bad; totalT += nT; }
console.log(`REPLAY CHECK: ${totalT} trades on ${COINS.length} coins x ${PARAMS.length} strategies, ${totalDiff} mismatches`);
