// rstrat.js — stop/trail "R" version of the MA strategies, built with the SAME trade loop + cost model as i-core
// (signal on closed bar i -> fill at open i+1, stop = entry -/+ kInit*ATR, ATR trail from best price, costs fee .05% + slip .02% per side + funding .005%/bar).
const fs = require('fs'); const { IND, SMA, SMMA } = require('./indicators'); const { account } = require('./baseline');
const COINS = (process.env.COINS || 'BTC,ETH,SOL,ADA').split(','), SPLIT = Date.UTC(2023, 0, 1) / 1000, COST = { fee: 0.0005, slip: 0.0002, fund: 0.00005 };
const D = {}; for (const c of COINS) { const b = JSON.parse(fs.readFileSync(`data4h/${c}.json`)); const C = b.map(r => r[4]);
  const tr = b.map((r, i) => i ? Math.max(r[2] - r[3], Math.abs(r[2] - b[i - 1][4]), Math.abs(r[3] - b[i - 1][4])) : r[2] - r[3]);
  const gap = new Array(b.length).fill(false); let last = -1e9; for (let i = 1; i < b.length; i++) { if (b[i][0] - b[i - 1][0] !== 14400) last = i; gap[i] = i - last < 200; }
  D[c] = { b, C, V: b.map(r => r[5]), T: b.map(r => r[0]), ATR: SMMA(tr, 14), S200: SMA(C, 200), gap, cache: new Map() }; }
const ind = (name, c, n) => { const d = D[c], k = name + n; if (!d.cache.has(k)) d.cache.set(k, IND[name](d.C, d.V, n)); return d.cache.get(k); };

function events(name, c, mode, p, filt, longOnly) { // +1/-1 at the bar where the cross happens (closed bar i)
  const d = D[c], C = d.C, a = mode === 'P' ? C : ind(name, c, p[0]), m = ind(name, c, mode === 'P' ? p[0] : p[1]); const e = new Array(C.length).fill(0);
  for (let i = 1; i < C.length; i++) { if ([a[i], m[i], a[i - 1], m[i - 1], d.ATR[i]].some(Number.isNaN)) continue;
    let s = 0; if (a[i] > m[i] && a[i - 1] <= m[i - 1]) s = 1; else if (a[i] < m[i] && a[i - 1] >= m[i - 1]) s = -1;
    if (s && filt && !(Number.isNaN(d.S200[i]) ? false : (s === 1 ? C[i] > d.S200[i] : C[i] < d.S200[i]))) s = 0;
    if (s < 0 && longOnly) s = 0; e[i] = s; } return e; }

function sim(c, ev, kInit, kTrail, maxBars = 600, stopRef = 'open', timeFill = 'close') {
  const { b, ATR, gap } = D[c], n = b.length, trades = []; let pos = null, pend = null;
  for (let i = 1; i < n; i++) { const [t, o, h, l, cl] = b[i];
    if (pend && pend.at === i) { const ref = stopRef === 'close' ? pend.ref : o, st0 = ref - pend.dir * kInit * pend.atr; pos = { dir: pend.dir, i0: i, entry: o, stop: st0, risk: Math.abs(o - st0) / o, ext: o }; pend = null; }
    if (pos) { const long = pos.dir === 1; let px = null, why = null;
      if (pos.exitNext) { px = o; why = 'time'; }
      else if (long ? l <= pos.stop : h >= pos.stop) { px = long ? Math.min(o, pos.stop) : Math.max(o, pos.stop); why = 'stop'; }
      else if (i - pos.i0 >= maxBars && timeFill === 'close') { px = cl; why = 'time'; }
      if (px !== null) { const gross = pos.dir * (px - pos.entry) / pos.entry, cc = 2 * (COST.fee + COST.slip) + COST.fund * (i - pos.i0 + 1);
        trades.push({ dir: pos.dir, t: b[pos.i0][0], tExit: t + 14400, R: (gross - cc) / pos.risk, bars: i - pos.i0 + 1, coin: c }); pos = null; }
      else { if (i - pos.i0 >= maxBars && timeFill === 'nextOpen') pos.exitNext = true; pos.ext = long ? Math.max(pos.ext, h) : Math.min(pos.ext, l); const ns = pos.ext - pos.dir * kTrail * ATR[i]; if (long ? ns > pos.stop : ns < pos.stop) pos.stop = ns; } }
    if (!pos && i + 1 < n && ev[i] && !gap[i] && ATR[i] > 0 && i >= 205) pend = { dir: ev[i], at: i + 1, atr: ATR[i], ref: cl }; }
  return trades;
}
function cfgRun(name, mode, p, filt, longOnly, kInit, kTrail, stopRef = 'open', timeFill = 'close') {
  const all = []; for (const c of COINS) all.push(...sim(c, events(name, c, mode, p, filt, longOnly), kInit, kTrail, 600, stopRef, timeFill));
  const byCoin = {}; for (const c of COINS) byCoin[c] = account(all.filter(t => t.coin === c));
  return { full: account(all), train: account(all, .025, 0, SPLIT), test: account(all, .025, SPLIT), coins: byCoin, trades: all };
}
module.exports = { cfgRun, COINS, SPLIT, sim, events, D };
if (require.main === module) {
  const PN = [20, 50, 100], XP = [[10, 30], [20, 50], [21, 55], [50, 200]], res = [];
  for (const name of Object.keys(IND)) { for (const lo of [false, true]) for (const filt of [false, true]) for (const kI of [2, 3]) for (const kT of [5, 7, 10]) {
    for (const n of PN) res.push({ name, mode: 'P', p: [n], filt, lo, kI, kT });
    for (const p of XP) res.push({ name, mode: 'X', p, filt, lo, kI, kT }); } }
  let k = 0; for (const r of res) { const o = cfgRun(r.name, r.mode, r.p, r.filt, r.lo, r.kI, r.kT); r.full = o.full; r.train = o.train; r.test = o.test; r.coins = o.coins; if (++k % 100 === 0) process.stdout.write('\r' + k + '/' + res.length); }
  fs.writeFileSync('results-R.json', JSON.stringify(res)); console.log('\ndone', res.length);
}
