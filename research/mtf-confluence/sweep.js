// 24 pre-declared variants x 14 coins. IS = trades closed before 2024, OOS = 2024+.
const fs = require('fs'), path = require('path');
const LIB = require(path.join(__dirname, '../../candles/candles.js'));
const { build, backtest, COST } = require('./mtf.js');
const COINS = LIB.coins(), BOT = ['SOL', 'NEAR', 'ADA', 'GALA'], Y24 = Date.UTC(2024, 0, 1) / 1000;
const SUBS = [[], ['adx'], ['pull'], ['vol'], ['adx', 'pull'], ['adx', 'vol'], ['pull', 'vol'], ['adx', 'pull', 'vol']];
const CFGS = []; for (const exit of ['P7', 'P14', 'SW7']) for (const filters of SUBS) CFGS.push({ filters, exit });
const name = c => `${c.exit} [${c.filters.join('+') || 'core'}]`;
const st = a => { const n = a.length, s = a.reduce((x, t) => x + t.R, 0); return { n, sum: s, avg: n ? s / n : 0, win: n ? a.filter(t => t.R > 0).length / n : 0 }; };
const out = {};
for (const coin of COINS) {
  const d = build(coin);
  for (const c of CFGS) {
    const T = backtest(coin, c, { data: d }), T2 = backtest(coin, c, { data: d, cost: { fee: COST.fee * 2, slip: COST.slip * 2 } });
    (out[name(c)] = out[name(c)] || { cfg: c, coins: {} }).coins[coin] = { all: st(T), is: st(T.filter(t => t.tExit < Y24)), oos: st(T.filter(t => t.tExit >= Y24)), x2: st(T2), long: st(T.filter(t => t.dir === 1)), short: st(T.filter(t => t.dir === -1)) };
  }
  console.error(coin, 'done');
}
fs.writeFileSync(path.join(__dirname, 'sweep.json'), JSON.stringify(out));
const pool = (o, cs, k) => { let n = 0, s = 0; for (const c of cs) { const x = o.coins[c][k]; n += x.n; s += x.sum; } return { n, avg: n ? s / n : 0, sum: s }; };
console.log('variant            | ALL 14 coins: n  avgR  IS   OOS  2xcost | coins + IS/OOS/both | BOT 4: avgR IS OOS');
for (const [k, o] of Object.entries(out)) {
  const a = pool(o, COINS, 'all'), is = pool(o, COINS, 'is'), oo = pool(o, COINS, 'oos'), x2 = pool(o, COINS, 'x2');
  const pIS = COINS.filter(c => o.coins[c].is.avg > 0).length, pO = COINS.filter(c => o.coins[c].oos.avg > 0).length, pB = COINS.filter(c => o.coins[c].is.avg > 0 && o.coins[c].oos.avg > 0).length;
  const b = pool(o, BOT, 'all'), bi = pool(o, BOT, 'is'), bo = pool(o, BOT, 'oos');
  console.log(`${k.padEnd(19)}| ${String(a.n).padStart(5)} ${a.avg.toFixed(3).padStart(6)} ${is.avg.toFixed(2).padStart(5)} ${oo.avg.toFixed(2).padStart(5)} ${x2.avg.toFixed(2).padStart(6)} | ${String(pIS).padStart(2)}/${String(pO).padStart(2)}/${String(pB).padStart(2)} of ${COINS.length} | ${b.avg.toFixed(3)} ${bi.avg.toFixed(2)} ${bo.avg.toFixed(2)}`);
}
