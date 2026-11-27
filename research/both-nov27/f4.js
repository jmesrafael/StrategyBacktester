// F4 coins. PRE-LISTED before running (scores on 2020-23 only, cagr/fall single-coin per bot, from score.js -> score-*.out):
//  weakest scorable live coins: bb ZEC .57, NEAR 1.16 | ic ZEC .17, NEAR .71 | tc ZEC -.23, ETH .97 (ARB/SUI have no 2020-22 history: unscorable, kept)
//  best pool adds (pool BTC ETH BNB XRP DOGE LINK AVAX DOT LTC TRX; not live in that bot): bb AVAX 2.31, DOGE 1.28, DOT 1.14 |
//   ic BNB .86, BTC .51, AVAX .44 | tc BTC 2.70, AVAX 1.16, BNB 1.01.  Settings (8 only), usage: node f4.js <1..8>
const H = require('./h.js'), X = require('./causalF4.js');
const L = X.COINS, D = (b, drop) => L[b].filter((c) => !drop.includes(c));
const mk = (d, a) => ({ bb: [...D('bb', d.bb), ...a.bb], ic: [...D('ic', d.ic), ...a.ic], tc: [...D('tc', d.tc), ...a.tc] });
const N = { bb: [], ic: [], tc: [] };
const d1 = { bb: ['ZEC'], ic: ['ZEC'], tc: ['ZEC'] }, d2 = { bb: ['ZEC', 'NEAR'], ic: ['ZEC', 'NEAR'], tc: ['ZEC', 'ETH'] };
const a1 = { bb: ['AVAX'], ic: ['BNB'], tc: ['BTC'] }, a2 = { bb: ['AVAX', 'DOGE'], ic: ['BNB', 'BTC'], tc: ['BTC', 'AVAX'] }, a3 = { bb: ['AVAX', 'DOGE', 'DOT'], ic: ['BNB', 'BTC', 'AVAX'], tc: ['BTC', 'AVAX', 'BNB'] };
const S = [['drop1', mk(d1, N)], ['drop2', mk(d2, N)], ['add1', mk(N, a1)], ['add2', mk(N, a2)], ['add3', mk(N, a3)], ['drop1+add1', mk(d1, a1)], ['drop2+add2', mk(d2, a2)], ['drop2+add3', mk(d2, a3)]];
const i = +process.argv[2] - 1, [label, coins] = S[i];
console.log(label, JSON.stringify(coins));
H.evaluate({ coins, engine: X }, 'F4 ' + label);
