// run.js — grid-test the first 10 list indicators on 4h BTC/ETH/SOL/ADA, ~7y. Output results.json
const fs = require('fs'); const { IND, SMMA } = require('./indicators'); const { run } = require('./engine');
const COINS = ['BTC', 'ETH', 'SOL', 'ADA'], SPLIT = Date.UTC(2023, 0, 1) / 1000, PPY = 6 * 365;
const D = {}; for (const c of COINS) { const b = JSON.parse(fs.readFileSync(`data4h/${c}.json`)); D[c] = { b, C: b.map(r => r[4]), V: b.map(r => r[5]), T: b.map(r => r[0]) }; }
for (const c of COINS) { // ATR(14) Wilder, causal
  const { b } = D[c]; const tr = b.map((r, i) => i ? Math.max(r[2] - r[3], Math.abs(r[2] - b[i - 1][4]), Math.abs(r[3] - b[i - 1][4])) : r[2] - r[3]); D[c].ATR = SMMA(tr, 14); }
const grid = [...new Set(COINS.flatMap(c => D[c].T))].sort((a, b) => a - b); const gi = new Map(grid.map((t, i) => [t, i]));
const cache = new Map(); const ind = (name, c, n) => { const k = name + c + n; if (!cache.has(k)) cache.set(k, IND[name](D[c].C, D[c].V, n)); return cache.get(k); };

// signal: state machine with ATR-band hysteresis k. mode 'P' price vs MA(n); 'X' MA(fast) vs MA(slow)
function signal(name, c, mode, p, k) {
  const { C, ATR } = D[c]; const a = mode === 'P' ? C : ind(name, c, p[0]), m = ind(name, c, mode === 'P' ? p[0] : p[1]);
  const out = new Array(C.length).fill(0); let s = 0;
  for (let i = 0; i < C.length; i++) { if (Number.isNaN(a[i]) || Number.isNaN(m[i]) || Number.isNaN(ATR[i])) { out[i] = 0; continue; }
    const th = k * ATR[i], d = a[i] - m[i]; if (d > th) s = 1; else if (d < -th) s = -1; out[i] = s; }
  return out;
}
function stats(rets, trades, lo, hi) { // rets: portfolio per-bar returns on grid; window [lo,hi) by time
  let eq = 1, peak = 1, mdd = 0, s = 0, s2 = 0, n = 0, first = null, last = null;
  for (let i = 0; i < grid.length; i++) { if (grid[i] < lo || grid[i] >= hi || rets[i] === null) continue; const r = rets[i]; eq *= 1 + r; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq / peak - 1); s += r; s2 += r * r; n++; if (first === null) first = grid[i]; last = grid[i]; }
  if (n < 2) return null; const mean = s / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean)), yrs = (last - first) / 31557600;
  const tt = trades.filter(t => t.time >= lo && t.time < hi), w = tt.filter(t => t.r > 0), l = tt.filter(t => t.r <= 0);
  const gw = w.reduce((a, t) => a + t.r, 0), gl = -l.reduce((a, t) => a + t.r, 0);
  return { ret: eq - 1, cagr: yrs > 0.2 ? Math.pow(eq, 1 / yrs) - 1 : null, mdd, sharpe: sd ? mean / sd * Math.sqrt(PPY) : 0, trades: tt.length, win: tt.length ? w.length / tt.length : 0, pf: gl ? gw / gl : (gw ? 99 : 0), avg: tt.length ? tt.reduce((a, t) => a + t.r, 0) / tt.length : 0 };
}
function evalCfg(name, mode, p, k, longOnly) {
  const port = new Array(grid.length).fill(null).map(() => []); const allTr = [], perCoin = {};
  for (const c of COINS) {
    const { b, T } = D[c]; const r = run(b, signal(name, c, mode, p, k), longOnly);
    for (let i = 1; i < b.length; i++) port[gi.get(T[i])].push(r.ret[i]);
    const tr = r.trades.map(t => ({ r: t.r, time: T[t.t0], coin: c })); allTr.push(...tr);
    const cr = new Array(grid.length).fill(null); for (let i = 1; i < b.length; i++) cr[gi.get(T[i])] = r.ret[i];
    perCoin[c] = { rets: cr, trades: tr };
  }
  const rets = port.map(a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null); // equal-weight, rebalanced every bar
  const win = (r, tr, lo, hi) => stats(r, tr, lo, hi);
  const res = { full: win(rets, allTr, 0, 1e12), train: win(rets, allTr, 0, SPLIT), test: win(rets, allTr, SPLIT, 1e12), coins: {} };
  for (const c of COINS) res.coins[c] = win(perCoin[c].rets, perCoin[c].trades, 0, 1e12);
  return res;
}
const PN = [10, 20, 30, 50, 75, 100, 150, 200], XP = [[5, 20], [10, 30], [20, 50], [21, 55], [20, 100], [50, 100], [50, 200]], KS = [0, 0.5, 1];
const out = { configs: [], bench: {} };
for (const c of COINS) { const { b, T } = D[c]; const r = new Array(grid.length).fill(null); for (let i = 1; i < b.length; i++) r[gi.get(T[i])] = b[i][4] / b[i - 1][4] - 1; out.bench[c] = stats(r, [], 0, 1e12); }
{ const port = grid.map((_, i) => { const a = COINS.map(c => { const { b, T } = D[c]; const j = T.indexOf(grid[i]); return j > 0 ? b[j][4] / b[j - 1][4] - 1 : null; }).filter(x => x !== null); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }); out.bench.EW = stats(port, [], 0, 1e12); out.bench.EW_train = stats(port, [], 0, SPLIT); out.bench.EW_test = stats(port, [], SPLIT, 1e12); }
let cnt = 0;
for (const name of Object.keys(IND)) for (const longOnly of [false, true]) for (const k of KS) {
  for (const n of PN) { out.configs.push({ name, mode: 'P', p: [n], k, longOnly, ...evalCfg(name, 'P', [n], k, longOnly) }); cnt++; }
  for (const p of XP) { out.configs.push({ name, mode: 'X', p, k, longOnly, ...evalCfg(name, 'X', p, k, longOnly) }); cnt++; }
  process.stdout.write(`\r${name} ${cnt}`);
}
fs.writeFileSync('results.json', JSON.stringify(out)); console.log('\ndone', cnt);
