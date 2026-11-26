// pesos.js — PHP 1,000 accounts: BB-CORE 4h (live rules) vs BB-CORE 1h vs BB-1H-WIDE, coin sets, compounding from 2020
// and a fresh PHP 1,000 every Jan 1. Risk = live bot steps (2.5% -> 2% at $500 -> 1.5% at $1000 highest balance, PHP 60/USD),
// risk amount fixed at entry from the realised balance, P/L = R x risk at exit (costs + funding already in R).
// Drawdown = largest fall of the realised balance from its high, trade by trade (open-trade swings not included).
'use strict';
const fs = require('fs'), L = require('./lib.js'), V = require('./fam-vol.js');
const { run } = require('../strat-hunt-nov6/engine.js'), { S, makeCtx, exitOf } = require('../strat-hunt-nov6/strategies.js');
const START = 1000, PHP = 60, TIERS = [[0, 0.025], [500 * PHP, 0.02], [1000 * PHP, 0.015]];
const pct = (pk) => { let p = TIERS[0][1]; for (const [b, r] of TIERS) if (pk >= b) p = r; return p; };
const Y = L.YEARS, yOf = L.yearOf;

// ---- trade lists ----
const E = { kind: 'M', bars: 192 };
const wide = (coins) => L.evaluate(V.strat({ len: 80, mult: 2.6, trend: 800, minStop: 0.3, filt: null }, E), V.mkEx(E), coins, 1, true).trades;
const core1h = (coins) => L.evaluate(V.strat({ len: 80, mult: 2.0, trend: 800, minStop: 0.3, filt: null }, E), V.mkEx(E), coins, 1, true).trades;
function core4h(coins) { // live BB-CORE: BB(20,2), SMA200, middle-band stop, 48 candles, 4h
  const s = S.find((x) => x.id === 'bb-core'), out = [];
  for (const cn of coins) {
    const B = L.C.load(cn, '4h', { from: L.C.load(cn, '4h')[0][0] }).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })).filter((b) => b.time >= Date.parse('2020-01-01') / 1000 - 200 * 14400);
    const c = makeCtx(B, '4h'), r = run(B, c.atr14, s.build(c), exitOf('BBX', c), L.C.funding(cn), 14400);
    for (const t of r.trades) if (t.tExit >= Date.parse('2020-01-01') / 1000) { t.coin = cn; out.push(t); }
  }
  return out;
}
// ---- account ----
function account(trades, fresh, scale = 1) {
  const ev = []; trades.forEach((t, i) => { ev.push([t.t, 0, i]); ev.push([t.tExit, 1, i]); });
  ev.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const acc = {}; // fresh: one account per entry year; compounding: one account 'all'
  const get = (k) => acc[k] || (acc[k] = { bal: START, peak: START, dd: 0, n: 0, risk: {} });
  const owner = {};
  for (const [ts, kind, i] of ev) {
    if (kind === 0) { const k = fresh ? yOf(ts) : 'all', a = get(k); owner[i] = k; a.risk[i] = a.bal * pct(a.peak) * scale; }
    else { const a = get(owner[i]); a.bal += trades[i].R * a.risk[i]; delete a.risk[i]; a.n++; a.peak = Math.max(a.peak, a.bal); a.dd = Math.max(a.dd, 1 - a.bal / a.peak); if (!fresh) { const y = yOf(ts); a.ye = a.ye || {}; a.ye[y] = a.bal; } }
  }
  return acc;
}
const php = (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? Math.round(v / 1e3) + 'k' : Math.round(v).toLocaleString('en-US');
const pctS = (v) => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';

const LIVE = ['SOL', 'NEAR', 'ADA', 'GALA', 'ZEC', 'ARB'];
const ALL24 = [...L.MAIN, ...L.HOLD];
// ---- per-coin table for BB-1H-WIDE (24 coins) + picks made on 2020-23 only ----
const wt = wide(ALL24), per = {};
for (const t of wt) { const p = per[t.coin] = per[t.coin] || { y: {}, n: 0, R: 0, isR: 0, isN: 0, oosR: 0, oosN: 0 }; const y = yOf(t.tExit); p.y[y] = (p.y[y] || 0) + t.R; p.n++; p.R += t.R; if (y <= 2023) { p.isR += t.R; p.isN++; } else { p.oosR += t.R; p.oosN++; } }
const rows = Object.entries(per).sort((a, b) => b[1].R - a[1].R);
let o = '## BB-1H-WIDE per coin (R, 1x costs)\n| Coin | ' + Y.join(' | ') + ' | Total | R/trade 2020-23 | R/trade 2024-26 | + years |\n|' + '---|'.repeat(Y.length + 5) + '\n';
for (const [cn, p] of rows) o += `| ${cn} | ${Y.map((y) => p.y[y] == null ? '–' : p.y[y].toFixed(0)).join(' | ')} | ${p.R.toFixed(0)} | ${(p.isR / p.isN).toFixed(2)} | ${(p.oosR / p.oosN).toFixed(2)} | ${Y.filter((y) => (p.y[y] || 0) > 0).length}/${Y.filter((y) => p.y[y] != null).length} |\n`;
// pick: 2020-23 only — top 8 by R/trade among coins positive in every year they traded 2020-23
const pick = rows.filter(([, p]) => [2020, 2021, 2022, 2023].every((y) => p.y[y] == null || p.y[y] > 0) && p.isN >= 40)
  .sort((a, b) => b[1].isR / b[1].isN - a[1].isR / a[1].isN).slice(0, 8).map(([cn]) => cn);
const hind = rows.filter(([, p]) => Y.every((y) => p.y[y] == null || p.y[y] > 0)).map(([cn]) => cn);
o += `\nPicked on 2020-23 only (top 8 R/trade, every 2020-23 year positive): ${pick.join(' ')}\nPositive every year 2020-26 (hindsight, not a fair pick): ${hind.join(' ')}\n`;

// ---- the account comparison ----
const SETS = [
  ['BB-CORE 4h (live rules), live coins', core4h(LIVE)],
  ['BB-CORE 1h (2.0), live coins', core1h(LIVE)],
  ['BB-1H-WIDE, live coins', wide(LIVE)],
  ['BB-CORE 1h (2.0), main 12', core1h(L.MAIN)],
  ['BB-1H-WIDE, main 12', wide(L.MAIN)],
  ['BB-1H-WIDE, 8 coins picked on 2020-23', wide(pick)],
  ['BB-1H-WIDE, hindsight all-years coins', wide(hind)],
];
// same total risk as 6 coins: per-trade risk x 6 / number of coins
for (const [nm, tr, k] of [['BB-CORE 1h (2.0), main 12, risk x0.5', core1h(L.MAIN), 0.5], ['BB-1H-WIDE, main 12, risk x0.5', wide(L.MAIN), 0.5], ['BB-1H-WIDE, 8 picked, risk x0.75', wide(pick), 0.75]]) SETS.push([nm, tr, k]);
o += `\n## PHP 1,000 compounding from Jan 2020 (balance at each year end)\n| Strategy | ${Y.join(' | ')} | Worst fall | Trades |\n|${'---|'.repeat(Y.length + 3)}\n`;
const fr = [];
for (const [nm, tr, k = 1] of SETS) {
  const a = account(tr, false, k).all; let last = START;
  const cells = Y.map((y) => { if (a.ye[y] != null) last = a.ye[y]; return php(last); });
  o += `| ${nm} | ${cells.join(' | ')} | -${Math.round(a.dd * 100)}% | ${a.n} |\n`;
  fr.push([nm, account(tr, true, k)]);
}
o += `\n## Fresh PHP 1,000 every Jan 1 (that year's result, worst fall inside the year)\n| Strategy | ${Y.join(' | ')} |\n|${'---|'.repeat(Y.length + 1)}\n`;
for (const [nm, acc] of fr) o += `| ${nm} | ${Y.map((y) => acc[y] ? `${pctS(acc[y].bal / START - 1)} (-${Math.round(acc[y].dd * 100)}%)` : '–').join(' | ')} |\n`;
fs.writeFileSync('pesos.md', o); console.log(o);
