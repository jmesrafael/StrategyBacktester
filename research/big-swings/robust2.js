// robust2.js — audit of the search.js winners: look-ahead truncation, 2x costs, per coin, neighbours (plateau), leverage needed, blend with bb-core.
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const bb = require('../bb-core-v2/v2-core.js');
const COINS = ['BTC', 'ETH', 'SOL'], YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), sum = (T) => T.reduce((a, t) => a + t.R, 0), RISK = 5;
const yr = (t) => new Date(t.tExit * 1000).getUTCFullYear();
const cache = {}; const get = (c) => cache[c] || (cache[c] = (() => { const B = E.load(c); return { B, X: E.base(B) }; })());
const runC = (cs, fam, p, ex) => cs.flatMap((c) => E.run(get(c).B, get(c).X, fam, p, { coin: c, ...ex }));
const pos = (T) => { const y = E.yearly(T); return YEARS.filter((v) => (y[v] || 0) > 0).length; };
const bbT = COINS.flatMap((c) => bb.backtest(get(c).B, {}, null).trades);

const CAND = [
  ['keltner', { n: 20, m: 2 }, { kInit: 1.5, kTrail: 5, trend: true, exitOpp: false }],
  ['keltner', { n: 10, m: 1.5 }, { kInit: 1.5, kTrail: 5, trend: false, exitOpp: false }],
  ['donchian', { n: 20 }, { kInit: 1.5, kTrail: 5, trend: true, exitOpp: false }],
  ['donchian', { n: 30 }, { kInit: 1.5, kTrail: 5, trend: true, exitOpp: false }],
];
let out = `# Audit of the bb-core beaters — BTC+ETH+SOL, $${RISK} risk per trade\n\nbb-core: ${f1(sum(bbT))}R, DD ${E.maxDD(bbT).toFixed(0)}R, ${pos(bbT)}/7 years\n\n`;
for (const [fam, p, ex] of CAND) {
  const name = `${fam} ${JSON.stringify(p).replace(/"/g, '')} stop${ex.kInit}ATR trail${ex.kTrail}ATR${ex.trend ? ' +SMA200' : ''}`;
  const T = runC(COINS, fam, p, ex), y = E.yearly(T);
  out += `## ${name}\n\n`;
  out += `- all: ${T.length} trades, win ${(100 * T.filter((t) => t.R > 0).length / T.length).toFixed(0)}%, **${f1(sum(T))}R = ${f1(sum(T) * RISK)}$**, DD ${E.maxDD(T).toFixed(0)}R ($${Math.round(E.maxDD(T) * RISK)}), ${pos(T)}/7 yrs; years: ${YEARS.map((v) => v + ' ' + f1(y[v] || 0)).join(' | ')}\n`;
  for (const c of COINS) { const t = T.filter((x) => x.coin === c), yy = E.yearly(t); out += `- ${c}: ${t.length} trades, ${f1(sum(t))}R ($${f1(sum(t) * RISK)}), DD ${E.maxDD(t).toFixed(0)}R, ${pos(t)}/7 yrs; ${YEARS.map((v) => f1(yy[v] || 0)).join(' ')}\n`; }
  // 2x cost
  const c0 = { ...E.COST }; E.COST.fee *= 2; E.COST.slip *= 2; E.COST.fund *= 2; const T2 = runC(COINS, fam, p, ex); Object.assign(E.COST, c0);
  // 3x slippage-only stress
  E.COST.slip *= 3; const T3 = runC(COINS, fam, p, ex); Object.assign(E.COST, c0);
  out += `- 2x all costs: ${f1(sum(T2))}R (${pos(T2)}/7 yrs); 3x slippage only: ${f1(sum(T3))}R (${pos(T3)}/7)\n`;
  // leverage: notional per $ of risk = 1 / stop distance (%), from entry
  const lev = []; for (const c of COINS) { const { B, X } = get(c); for (let i = 205; i < B.length - 1; i += 40) lev.push(1 / (ex.kInit * X.atr[i] / B[i + 1].open)); }
  lev.sort((a, b) => a - b); out += `- position size: notional = ${lev[Math.floor(lev.length / 2)].toFixed(0)}x the $ you risk (median); so $${RISK} risk = ~$${(lev[Math.floor(lev.length / 2)] * RISK).toFixed(0)} notional, tightest 10% of cases ${lev[Math.floor(lev.length * 0.9)].toFixed(0)}x\n`;
  // look-ahead truncation
  let bad = 0;
  for (const c of COINS) {
    const { B } = get(c), cut = B.length - 400, B2 = B.slice(0, cut);
    const a = E.run(B, get(c).X, fam, p, { coin: c, ...ex }).filter((t) => t.tExit <= B2[cut - 1].time);
    const b = E.run(B2, E.base(B2), fam, p, { coin: c, ...ex }).filter((t) => t.tExit <= B2[cut - 1].time);
    if (a.length !== b.length || a.some((t, i) => t.t !== b[i].t || Math.abs(t.R - b[i].R) > 1e-9)) bad++;
  }
  out += `- look-ahead truncation test: ${bad ? 'FAIL' : 'ok'}\n`;
  // plateau: neighbours of the stop/trail
  const nb = []; for (const kI of [1.5, 2, 2.5]) for (const kT of [4, 5, 6, 7]) { const t = runC(COINS, fam, p, { ...ex, kInit: kI, kTrail: kT }); nb.push(`${kI}/${kT}: ${f1(sum(t))}R ${pos(t)}/7`); }
  out += `- neighbours (stop/trail ATR): ${nb.join(' ; ')}\n`;
  const bl = [...T, ...bbT]; out += `- blended with bb-core: ${f1(sum(bl))}R, DD ${E.maxDD(bl).toFixed(0)}R, ${pos(bl)}/7 yrs\n\n`;
}
fs.writeFileSync(path.join(__dirname, 'RESULTS-audit.md'), out); console.log(out);
