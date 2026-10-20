// yearly-dd.js — BB Breakout (4h) vs NY SMC v7 (15m, app engine) on SOL / DOGE / ZEC, every year: profit, trades, win rate and max drawdown, $5 risk per trade.
// Drawdown = deepest fall of the running closed-trade P&L inside the calendar year (trades ordered by EXIT time, all three coins pooled; starts at 0 each January).
// usage: node yearly-dd.js  -> results-yearly-dd.md
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js'), F = require('./fam.js');
const APP = path.resolve(__dirname, '../..'), COINS = ['SOL', 'DOGE', 'ZEC'], RISK = 5, YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat, window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {}; vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/ny-smc-v7-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const v7 = ctx.window.__STRATEGIES.nysmcv7, v7p = Object.fromEntries(Object.entries(v7.params).map(([k, d]) => [k, d.default]));
const v7trades = (sym) => { const bars = L.bars(sym, 15); const r = ctx.SM.simulate(v7, v7p, bars, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0.04, slippagePct: 0.02, startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } }, null);
  let bal = 10000; return r.trades.map((t) => { const R = t.usd / (bal * 0.01); bal += t.usd; return { sym, t: bars[t.entryIndex].time, x: bars[t.exitIndex].time, R }; }); };
const BB = { tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 3, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const bbTrades = (sym) => { const B = L.bars(sym, 240); return F.sq(sym, BB).map((t) => ({ sym, t: t.t, x: B[t.i1].time + 14400, R: t.R })); }; // exit at the close of its exit bar
const SYS = { 'BB Breakout 4h': bbTrades, 'NY SMC v7 15m': v7trades };
const all = {}; for (const [n, fn] of Object.entries(SYS)) all[n] = COINS.flatMap(fn);
const f0 = (v) => (v >= 0 ? '+' : '−') + '$' + Math.abs(v).toFixed(0);
function year(tr, y, coin) {
  const a = L.ts(y), b = L.ts(y + 1), t = tr.filter((x) => x.x >= a && x.x < b && (!coin || x.sym === coin)).sort((p, q) => p.x - q.x);
  let eq = 0, pk = 0, dd = 0; for (const x of t) { eq += x.R * RISK; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { n: t.length, usd: eq, win: t.length ? t.filter((x) => x.R > 0).length / t.length : 0, dd };
}
const out = ['# BB Breakout (4h) vs NY SMC v7 (15m) — every year on SOL / DOGE / ZEC, $5 risk per trade\n',
  '0.04% commission + 0.02% slippage, flat $5 per trade. Trades counted in the year they CLOSE. Max drawdown = the deepest fall of the running closed-trade P&L inside that year (all three coins pooled, starting at $0 each January; open-trade swings not counted). 2020 is partial (SOL from Sep, DOGE from Jul, ZEC from Feb; first ~35 days of each lost to warm-up). 2026 is to Oct 20.\n',
  '## Year by year (all three coins)\n', '| Year | BB Breakout: profit | trades | win | **max DD** | v7: profit | trades | win | **max DD** | **Winner** | Margin |', '|---|---|---|---|---|---|---|---|---|---|---|'];
const wins = { 'BB Breakout 4h': 0, 'NY SMC v7 15m': 0 }, tot = { 'BB Breakout 4h': 0, 'NY SMC v7 15m': 0 }, perYear = {};
for (const y of YEARS) {
  const a = year(all['BB Breakout 4h'], y), b = year(all['NY SMC v7 15m'], y); perYear[y] = [a, b];
  const w = a.usd >= b.usd ? 'BB Breakout' : 'v7'; wins[a.usd >= b.usd ? 'BB Breakout 4h' : 'NY SMC v7 15m']++; tot['BB Breakout 4h'] += a.usd; tot['NY SMC v7 15m'] += b.usd;
  out.push(`| ${y}${y === 2020 ? ' (partial)' : y === 2026 ? ' (to Oct)' : ''} | ${f0(a.usd)} | ${a.n} | ${(a.win * 100).toFixed(0)}% | −$${a.dd.toFixed(0)} | ${f0(b.usd)} | ${b.n} | ${(b.win * 100).toFixed(0)}% | −$${b.dd.toFixed(0)} | **${w}** | ${f0(Math.abs(a.usd - b.usd))} |`);
}
out.push(`| **All years** | **${f0(tot['BB Breakout 4h'])}** | ${YEARS.reduce((s, y) => s + perYear[y][0].n, 0)} | | worst −$${Math.max(...YEARS.map((y) => perYear[y][0].dd)).toFixed(0)} | **${f0(tot['NY SMC v7 15m'])}** | ${YEARS.reduce((s, y) => s + perYear[y][1].n, 0)} | | worst −$${Math.max(...YEARS.map((y) => perYear[y][1].dd)).toFixed(0)} | **BB ${wins['BB Breakout 4h']} – v7 ${wins['NY SMC v7 15m']}** | |`);
out.push('', '## Each coin, each year (profit / max drawdown)\n', '| Year | Coin | BB Breakout | BB max DD | v7 | v7 max DD | Winner |', '|---|---|---|---|---|---|---|');
for (const y of YEARS) for (const c of COINS) {
  const a = year(all['BB Breakout 4h'], y, c), b = year(all['NY SMC v7 15m'], y, c); if (!a.n && !b.n) continue;
  out.push(`| ${y} | ${c} | ${f0(a.usd)} (${a.n}) | −$${a.dd.toFixed(0)} | ${f0(b.usd)} (${b.n}) | −$${b.dd.toFixed(0)} | ${a.usd >= b.usd ? 'BB' : 'v7'} |`);
}
out.push('', '## Whole history, all three coins\n', '| | Profit | Trades | Max DD (whole history, running P&L) | Worst single year | Best year | Years positive |', '|---|---|---|---|---|---|---|');
for (const [n, tr] of Object.entries(all)) {
  const s = tr.filter((x) => x.x >= L.ts(2020)).sort((p, q) => p.x - q.x); let eq = 0, pk = 0, dd = 0; for (const x of s) { eq += x.R * RISK; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const ys = YEARS.map((y) => year(tr, y).usd);
  out.push(`| ${n} | ${f0(eq)} | ${s.length} | −$${dd.toFixed(0)} | ${f0(Math.min(...ys))} | ${f0(Math.max(...ys))} | ${ys.filter((v) => v > 0).length} of ${ys.length} |`);
}
fs.writeFileSync(__dirname + '/results-yearly-dd.md', out.join('\n') + '\n');
console.log(out.join('\n'));
