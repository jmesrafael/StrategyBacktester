// backtest.js — run BB Breakout on one or more coins from data/<COIN>.json (4h candles).
//   node backtest.js                   -> all coins found in data/
//   node backtest.js SOL,ZEC,NEAR      -> chosen coins
//   node backtest.js SOL --risk 10 --target 3 --costs 2     (--costs k = multiply fees+slippage by k, 0 = frictionless)
//   node backtest.js SOL --trades      -> also print every trade
// Candle files: [[time_sec, open, high, low, close, volume], ...]   Funding files (optional): [[time_sec, rate], ...]
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, stats, scaleCost, DEFAULTS, FREE } = require('./bb-breakout.js');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? +args[i + 1] : d; };
const DATA = path.join(__dirname, 'data');
const first = args[0] && !args[0].startsWith('--') ? args[0] : null;
const coins = first ? first.split(',') : fs.readdirSync(DATA).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const risk = opt('risk', 5), k = opt('costs', 1), fee = opt('fee', null), slip = opt('slip', null);
const cost = k === 0 ? { ...FREE } : scaleCost(DEFAULTS.cost, k);
if (fee != null) Object.assign(cost, { entryFee: fee / 100, stopFee: fee / 100, timeFee: fee / 100, tpFee: fee / 100 }); // --fee 0.08 = 0.08% on every fill
if (slip != null) Object.assign(cost, { slip: slip / 100, tpSlip: slip / 100 });                                       // --slip 0.05 = 0.05% on every fill
const cfg = { targetR: opt('target', DEFAULTS.targetR), maxBars: opt('bars', DEFAULTS.maxBars), cost };

// funding/<COIN>.json; for MEXC_<COIN> (MEXC history starts ~Apr 2025) the earlier years are filled with Binance funding
function loadFunding(coin) {
  const read = (c) => { const f = path.join(DATA, 'funding', c + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const own = read(coin);
  if (!coin.startsWith('MEXC_')) return own;
  const bin = read(coin.slice(5));
  if (!own || !own.length) return bin;
  return bin ? [...bin.filter((r) => r[0] < own[0][0]), ...own] : own;
}
const usd = (v) => (v < 0 ? '−$' : '+$') + Math.abs(v).toFixed(0);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const all = [];
for (const coin of coins) {
  const f = path.join(DATA, coin + '.json');
  if (!fs.existsSync(f)) { console.log(`${coin}: no data/${coin}.json — run  node fetch-data.js ${coin}`); continue; }
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const funding = loadFunding(coin);
  const res = backtest(B, cfg, funding), s = stats(res.trades, risk);
  all.push(...res.trades);
  const ys = Object.keys(s.years).sort(), pos = ys.filter((y) => s.years[y].net > 0.5).length;
  console.log(`\n${coin}  ${iso(B[0].time)} → ${iso(B[B.length - 1].time)}  (${B.length} candles${funding ? ', with funding' : ', NO funding file'})`);
  console.log(`  ${s.n} trades · net ${usd(s.net)} at $${risk} risk · avg ${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R · win ${(s.winRate * 100).toFixed(0)}% · PF ${s.pf.toFixed(2)} · maxDD ${usd(-s.maxDD)} (${(s.maxDD / risk).toFixed(1)}R) · worst losing streak ${s.maxLossStreak}`);
  console.log(`  exits: ${s.byWhy.map(([w, c]) => w + ' ' + c).join(' · ')}`);
  console.log(`  profitable years ${pos}/${ys.length}:  ` + ys.map((y) => `${y} ${usd(s.years[y].net)}`).join(' | '));
  if (res.open) console.log(`  OPEN now: ${res.open.dir === 1 ? 'LONG' : 'SHORT'} entry ${res.open.entry.toPrecision(6)} stop ${res.open.stop.toPrecision(6)} tp ${res.open.tp.toPrecision(6)}`);
  if (res.setup) console.log(`  NEW SETUP on the last candle: ${res.setup.dir === 1 ? 'LONG' : 'SHORT'} at next open, stop ${res.setup.stop.toPrecision(6)}, tp ${res.setup.tp.toPrecision(6)}`);
  if (args.includes('--trades')) for (const t of res.trades) console.log(`    ${iso(t.t)} ${t.dir === 1 ? 'L' : 'S'} ${t.entry.toPrecision(6)} → ${t.exit.toPrecision(6)}  ${t.why.padEnd(6)} ${t.R >= 0 ? '+' : ''}${t.R.toFixed(2)}R  ${t.bars} bars`);
}
if (all.length && coins.length > 1) {
  all.sort((a, b) => a.tExit - b.tExit);
  const s = stats(all, risk), ys = Object.keys(s.years).sort();
  console.log(`\nPORTFOLIO (${coins.join('+')}; trades of every coin summed, each coin independent)`);
  console.log(`  ${s.n} trades · net ${usd(s.net)} · avg ${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R · maxDD ${usd(-s.maxDD)} (${(s.maxDD / risk).toFixed(1)}R)`);
  console.log('  ' + ys.map((y) => `${y} ${usd(s.years[y].net)}`).join(' | '));
}
