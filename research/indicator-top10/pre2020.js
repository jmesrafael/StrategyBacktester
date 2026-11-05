// pre2020.js — out-of-sample check on history BEFORE the main data (Binance spot 4h 2017-08 .. 2019-12; BTC/ETH/ADA/ZEC only: the others were not listed yet).
// Same code, same parameters as the main test, nothing re-tuned. Costs as before (spot has no funding, the funding term is just a small extra penalty).
process.env.DATADIR = 'data4h-spot'; process.env.COINS = 'BTC,ETH,ADA,ZEC';
const fs = require('fs'); const { run, CFG } = require('./batch2.js'); const { cfgRun, COINS } = require('./rstrat.js'); const { account } = require('./baseline');
const BB = require('../../../bb-core/lucidio-core.js'), IC = require('../../js/icore-core.js');
const END = Date.UTC(2020, 0, 1) / 1000;
const bots = core => { const all = []; for (const c of COINS) { const B = JSON.parse(fs.readFileSync(`data4h-spot/${c}.json`)).filter(r => r[0] < END).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })); all.push(...core.backtest(B).trades.map(t => ({ ...t, coin: c }))); } return all; };
const pick = (ind, lab, f, i, t) => run(ind, CFG.find(c => c[0] === ind && c[1] === lab)[2], f, i, t).trades;
const S = { 'bb-core': bots(BB), 'I-Core': bots(IC), 'MA Trend SMA200': cfgRun('SMA', 'P', [200], true, true, 2, 14, 'close', 'nextOpen').trades,
  'Chande Kroll 10-1-9': pick('CKSP', '10-1-9', true, 2, 14), 'Donchian 20': pick('Donchian', 'n20', true, 2, 14), 'Keltner 20x2': pick('Keltner', 'ema20x2', true, 2, 14),
  'TRIX 30 zero': pick('TRIX', 'n30zero', true, 2, 14), 'MACD 8-17-9': pick('MACD', '8-17-9sig', true, 2, 14) };
for (const k in S) S[k] = S[k].filter(t => t.tExit < END);
const P = (x, d = 2) => x.toFixed(d), Y = [2017, 2018, 2019];
console.log('Coins', COINS.join(','), '— trades closing before 2020-01-01\n| strategy | trades | total R | exp R | PF | win | worst drop @2.5% | ' + Y.map(y => y + ' R').join(' | ') + ' | 2.5%-risk compounded |\n|---|---|---|---|---|---|---|---|---|---|---|');
for (const k in S) { const a = account(S[k]), m = {}; S[k].forEach(t => { const y = new Date(t.tExit * 1000).getUTCFullYear(); m[y] = (m[y] || 0) + t.R; });
  console.log(`| ${k} | ${a.n} | ${P(a.totR, 0)} | ${P(a.expR)} | ${P(a.pf)} | ${P(a.win * 100, 0)}% | ${P(a.mdd * 100, 0)}% | ${Y.map(y => P(m[y] || 0, 0)).join(' | ')} | x${P(1 + a.ret, 2)} |`); }
console.log('\nBy coin (total R):\n| strategy | ' + COINS.join(' | ') + ' |\n|---|' + COINS.map(() => '---|').join(''));
for (const k in S) console.log(`| ${k} | ${COINS.map(c => P(S[k].filter(t => t.coin === c).reduce((s, t) => s + t.R, 0), 0)).join(' | ')} |`);
