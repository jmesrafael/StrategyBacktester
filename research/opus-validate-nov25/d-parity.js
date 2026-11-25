// d-parity.js: do ADX(14), II(21) and ATR on what the live bot sees equal the backtest values on the signal candle?
// (1) live window: BB-CORE fetches 500 MEXC 4h candles (lucidio.js fetchMexc bars = 500, incl. the forming one) -> 499 closed.
// (2) venue: backtest = Binance USDT-M candles; live = MEXC. Local MEXC copies: D:/testing/Strat/bb-core/data/MEXC_<coin>.json (to Oct 2026, no ARB).
'use strict';
const fs = require('fs');
const K = require('./core');
const { E } = K;
const WIN = 499;
const sig = (coin) => { const s = new Set([...K.runBB(coin, {}).trades, ...K.runBB(coin, K.NEW_BB).trades].map((t) => t.sigT)); return [...s].sort((a, b) => a - b); };
const tot = { n: 0, adxFlip: 0, iiFlip: 0, atrRel: 0, adxMax: 0, nearAdx: 0, nearIi: 0, mn: 0, mAdxFlip: 0, mIiFlip: 0, mIiFlipShort: 0, mShort: 0, mAdxDiff: [], mIiDiff: [], mAtr: [] };
const per = [];
for (const coin of K.COINS.bb) {
  const d = K.data(coin), B = d.B, full = { adx: K.adx(B), ii: K.ii(B), atr: E.atrA(B, 14) };
  let n = 0, af = 0, iff = 0, amax = 0, atrMax = 0;
  const mexcFile = `D:/testing/Strat/bb-core/data/MEXC_${coin}.json`;
  const M = fs.existsSync(mexcFile) ? JSON.parse(fs.readFileSync(mexcFile, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })) : null;
  const mIdx = M ? new Map(M.map((b, i) => [b.time, i])) : null;
  let mn = 0, maf = 0, mif = 0, mifS = 0, mS = 0;
  const longShort = new Map(K.runBB(coin, {}).trades.map((t) => [t.sigT, t.dir]));
  for (const t of sig(coin)) {
    const i = d.idx.get(t); if (i == null || i < WIN + 50) continue;
    const W = B.slice(i - WIN + 1, i + 1), a = K.adx(W)[WIN - 1], v = K.iiAt(W, WIN - 1), at = E.atrA(W, 14)[WIN - 1];
    n++; if ((a > 27) !== (full.adx[i] > 27)) af++; if ((v < 0) !== (full.ii[i] < 0)) iff++;
    amax = Math.max(amax, Math.abs(a - full.adx[i])); atrMax = Math.max(atrMax, Math.abs(at / full.atr[i] - 1));
    if (Math.abs(full.adx[i] - 27) < 1) tot.nearAdx++; if (Math.abs(full.ii[i]) < 0.02) tot.nearIi++;
    if (M) { const j = mIdx.get(t); if (j != null && j >= WIN) {
      const MW = M.slice(j - WIN + 1, j + 1), ma = K.adx(MW)[WIN - 1], mv = K.iiAt(MW, WIN - 1), mat = E.atrA(MW, 14)[WIN - 1];
      mn++; if ((ma > 27) !== (full.adx[i] > 27)) maf++; const fl = (mv < 0) !== (full.ii[i] < 0); if (fl) mif++;
      const dir = longShort.get(t) ?? -1; if (dir === -1) { mS++; if (fl) mifS++; }
      tot.mAdxDiff.push(Math.abs(ma - full.adx[i])); tot.mIiDiff.push(Math.abs(mv - full.ii[i])); tot.mAtr.push(Math.abs(mat / full.atr[i] - 1));
    } }
  }
  per.push({ coin, n, af, iff, amax, atrMax, mn, maf, mif, mS, mifS });
  Object.assign(tot, { n: tot.n + n, adxFlip: tot.adxFlip + af, iiFlip: tot.iiFlip + iff, adxMax: Math.max(tot.adxMax, amax), atrRel: Math.max(tot.atrRel, atrMax), mn: tot.mn + mn, mAdxFlip: tot.mAdxFlip + maf, mIiFlip: tot.mIiFlip + mif, mShort: tot.mShort + mS, mIiFlipShort: tot.mIiFlipShort + mifS });
}
const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
console.log('| Coin | Signals (500-candle check) | ADX>27 differs | II<0 differs | max ADX diff | max ATR rel diff | Signals with MEXC copy | ADX>27 differs (MEXC) | II<0 differs (MEXC) | of them short signals |');
for (const r of per) console.log(`| ${r.coin} | ${r.n} | ${r.af} | ${r.iff} | ${r.amax.toExponential(1)} | ${r.atrMax.toExponential(1)} | ${r.mn} | ${r.maf} (${r.mn ? (100 * r.maf / r.mn).toFixed(1) : '-'}%) | ${r.mif} (${r.mn ? (100 * r.mif / r.mn).toFixed(1) : '-'}%) | ${r.mifS} of ${r.mS} |`);
console.log(`| Total | ${tot.n} | ${tot.adxFlip} | ${tot.iiFlip} | ${tot.adxMax.toExponential(1)} | ${tot.atrRel.toExponential(1)} | ${tot.mn} | ${tot.mAdxFlip} (${(100 * tot.mAdxFlip / tot.mn).toFixed(1)}%) | ${tot.mIiFlip} (${(100 * tot.mIiFlip / tot.mn).toFixed(1)}%) | ${tot.mIiFlipShort} of ${tot.mShort} |`);
console.log(`signals with Binance ADX within 1 of 27: ${tot.nearAdx}; |II| < 0.02: ${tot.nearIi} (of ${tot.n})`);
console.log(`MEXC vs Binance |ADX diff| median ${q(tot.mAdxDiff, 0.5).toFixed(2)} p90 ${q(tot.mAdxDiff, 0.9).toFixed(2)} max ${Math.max(...tot.mAdxDiff).toFixed(2)}; |II diff| median ${q(tot.mIiDiff, 0.5).toFixed(3)} p90 ${q(tot.mIiDiff, 0.9).toFixed(3)}; ATR rel diff median ${(100 * q(tot.mAtr, 0.5)).toFixed(2)}% p90 ${(100 * q(tot.mAtr, 0.9)).toFixed(2)}%`);
