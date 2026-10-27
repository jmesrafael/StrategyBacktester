// robust.js — stress the 7/7 winners of scan.js. Checks: per coin, 2x costs, early/late halves, 10 UNSEEN coins, look-ahead truncation test, blend with bb-core.
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const bb = require('../bb-core-v2/v2-core.js');
const { loadCoin } = require('../bb-core-v2/load.js');
const COINS = ['BTC', 'ETH', 'SOL'], YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const OTHER = ['BNB', 'XRP', 'DOGE', 'LINK', 'LTC', 'AVAX', 'ADA', 'NEAR', 'ZEC', 'GALA'];
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), sum = (T) => T.reduce((a, t) => a + t.R, 0);
const CAND = [
  ['keltner', { n: 20, m: 2 }, 5, true], ['keltner', { n: 20, m: 2 }, 3, true], ['keltner', { n: 20, m: 2 }, 5, false],
  ['donchian', { n: 20 }, 5, true], ['donchian', { n: 55 }, 5, true], ['ichimoku', { full: false }, 3, true],
  ['supertrend', { n: 10, m: 3 }, 5, true], ['donchian', { n: 100 }, 3, false],
];
const cache = {}; const get = (c) => cache[c] || (cache[c] = (() => { const B = E.load(c); return { B, X: E.base(B) }; })());
const runCoins = (cs, fam, p, k, tr) => cs.flatMap((c) => E.run(get(c).B, get(c).X, fam, p, { coin: c, kInit: k, kTrail: k, trend: tr }));

// bb-core trades for the blend
// (BTC/ETH have no funding file in bb-core's data: bb-core is run with funding = 0 there, a small tilt in its favour)
const bbT = COINS.flatMap((c) => { let d; try { d = loadCoin(c); } catch (e) { d = { B: get(c).B, funding: null }; } return bb.backtest(d.B, {}, d.funding).trades; });
let out = '# Robustness of the 7/7 big-swing candidates (BTC+ETH+SOL)\n\n';
out += '`2x cost` = fee/slippage/funding doubled. `unseen` = 10 other coins never used to pick the config (ADA NEAR ZEC GALA BNB XRP DOGE LINK LTC AVAX): coins profitable / total R. `lookahead` = trades recomputed on data cut 400 bars earlier must be identical for every trade that closed before the cut.\n\n';
out += '| strategy | R | DD | yrs+ | BTC / ETH / SOL R | years+ per coin | 2x cost R (yrs+) | 2020-22 R | 2023-26 R | unseen coins +/10 (R) | lookahead | blend w/ bb-core: R, DD, yrs+ |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n';
for (const [fam, p, k, tr] of CAND) {
  const T = runCoins(COINS, fam, p, k, tr), y = E.yearly(T), pos = (Y) => YEARS.filter((yy) => (Y[yy] || 0) > 0).length;
  const perR = COINS.map((c) => sum(T.filter((t) => t.coin === c))), perPos = COINS.map((c) => pos(E.yearly(T.filter((t) => t.coin === c))));
  const c0 = { ...E.COST }; E.COST.fee *= 2; E.COST.slip *= 2; E.COST.fund *= 2;
  const T2 = runCoins(COINS, fam, p, k, tr); Object.assign(E.COST, c0);
  const early = sum(T.filter((t) => new Date(t.tExit * 1000).getUTCFullYear() <= 2022)), late = sum(T) - early;
  const un = OTHER.map((c) => sum(runCoins([c], fam, p, k, tr))), unPos = un.filter((v) => v > 0).length;
  // look-ahead truncation test
  let bad = 0;
  for (const c of COINS) {
    const { B } = get(c), cut = B.length - 400, B2 = B.slice(0, cut), X2 = E.base(B2);
    const full = E.run(B, get(c).X, fam, p, { coin: c, kInit: k, kTrail: k, trend: tr }).filter((t) => t.tExit <= B2[cut - 1].time);
    const part = E.run(B2, X2, fam, p, { coin: c, kInit: k, kTrail: k, trend: tr }).filter((t) => t.tExit <= B2[cut - 1].time);
    if (full.length !== part.length || full.some((t, i) => t.t !== part[i].t || Math.abs(t.R - part[i].R) > 1e-9)) bad++;
  }
  const bl = [...T, ...bbT], yb = E.yearly(bl);
  out += `| ${fam} ${JSON.stringify(p).replace(/"/g, '')} trail${k}${tr ? ' +SMA200' : ''} | ${f1(sum(T))} | ${E.maxDD(T).toFixed(0)} | ${pos(y)}/7 | ${perR.map(f1).join(' / ')} | ${perPos.join(' / ')} | ${f1(sum(T2))} (${pos(E.yearly(T2))}/7) | ${f1(early)} | ${f1(late)} | ${unPos}/10 (${f1(un.reduce((a, b) => a + b, 0))}) | ${bad ? 'FAIL' : 'ok'} | ${f1(sum(bl))}, ${E.maxDD(bl).toFixed(0)}, ${pos(yb)}/7 |\n`;
}
const yb = E.yearly(bbT);
out += `\nbb-core alone on the same 3 coins: ${f1(sum(bbT))}R, DD ${E.maxDD(bbT).toFixed(0)}, years ${YEARS.map((y) => y + ' ' + f1(yb[y] || 0)).join(' | ')}\n`;
fs.writeFileSync(path.join(__dirname, 'RESULTS-robust.md'), out); console.log(out);
