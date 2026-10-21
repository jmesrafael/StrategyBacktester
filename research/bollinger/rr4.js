// rr4.js — 1:3 vs 1:4 target, v7 and BB Breakout run separately, year by year, $5 risk per trade. usage: node rr4.js -> results-rr4.md
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js'), F = require('./fam.js');
const APP = path.resolve(__dirname, '../..'), RISK = 5, YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat, window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {}; vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/ny-smc-v7-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const v7 = ctx.window.__STRATEGIES.nysmcv7, v7p = Object.fromEntries(Object.entries(v7.params).map(([k, d]) => [k, d.default]));
const v7trades = (tp) => (sym) => { const bars = L.bars(sym, 15); const r = ctx.SM.simulate(v7, { ...v7p, targetR: tp }, bars, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0.04, slippagePct: 0.02,
  startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } }, null);
  let bal = 10000; return r.trades.map((t) => { const R = t.usd / (bal * 0.01); bal += t.usd; return { t: bars[t.entryIndex].time, R }; }); };
const BB = (tp) => ({ tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 });
const f = (v) => v == null ? '·' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(0);
const dd = (tr) => { let c = 0, pk = 0, d = 0; for (const x of tr.slice().sort((a, b) => a.t - b.t)) { c += x.R; pk = Math.max(pk, c); d = Math.max(d, pk - c); } return d * RISK; };
const SYS = [
  ['v7 15m, 1:3', ['SOL', 'ETH', 'DOGE', 'ZEC'], v7trades(3)], ['v7 15m, 1:4', ['SOL', 'ETH', 'DOGE', 'ZEC'], v7trades(4)], ['v7 15m, 1:5', ['SOL', 'ETH', 'DOGE', 'ZEC'], v7trades(5)],
  ['BB Breakout 4h, 1:3', ['SOL', 'DOGE', 'ZEC', 'ETH'], (s) => F.sq(s, BB(3))], ['BB Breakout 4h, 1:4', ['SOL', 'DOGE', 'ZEC', 'ETH'], (s) => F.sq(s, BB(4))], ['BB Breakout 4h, 1:5', ['SOL', 'DOGE', 'ZEC', 'ETH'], (s) => F.sq(s, BB(5))]];
const out = ['# Target 1:3 vs 1:4 vs 1:5 — v7 and BB Breakout separately, $5 risk per trade\n', 'Everything but the target is unchanged. 0.04% commission + 0.02% slippage, no funding. BB settings were tuned 2019–22 (BTC/ETH/SOL) at 3R; v7 was tuned Oct 2023→2026 at 3R. 2026 is to Oct.\n'];
const sum = [];
for (const [name, coins, fn] of SYS) {
  const per = Object.fromEntries(coins.map((s) => [s, fn(s)]));
  out.push(`## ${name}\n`, `| Year | ${coins.join(' | ')} | **All** |`, '|---|' + coins.map(() => '---|').join('') + '---|');
  for (const y of YEARS) { const v = coins.map((s) => { const t = L.slice(per[s], L.ts(y), L.ts(y + 1)); return t.length ? L.sum(t.map((x) => x.R)) * RISK : null; });
    out.push(`| ${y} | ${v.map(f).join(' | ')} | **${f(L.sum(v.map((x) => x || 0)))}** |`); }
  const all = coins.flatMap((s) => per[s]), st = L.stats(all), held = coins.flatMap((s) => L.slice(per[s], L.ts(2023), L.ts(2100)));
  const hit = all.filter((x) => x.R > (name.endsWith('1:5') ? 4.2 : name.endsWith('1:4') ? 3.3 : 2.5)).length;
  out.push(`| **Total** | ${coins.map((s) => f(L.sum(per[s].map((x) => x.R)) * RISK)).join(' | ')} | **${f(L.sum(all.map((x) => x.R)) * RISK)}** |`, '');
  sum.push({ name, n: all.length, tot: L.sum(all.map((x) => x.R)) * RISK, held: L.sum(held.map((x) => x.R)) * RISK, hn: held.length, avg: st.avg, dd: dd(all), hit: hit / all.length });
}
out.push('## Scoreboard\n', '| System | Trades | Total $ | Held-out 2023→ $ | Avg R/trade | Target-hit % | Max DD $ |', '|---|---|---|---|---|---|---|');
for (const s of sum) out.push(`| ${s.name} | ${s.n} | ${f(s.tot)} | ${f(s.held)} (${s.hn}) | ${L.f2(s.avg)} | ${(s.hit * 100).toFixed(0)}% | $${s.dd.toFixed(0)} |`);
fs.writeFileSync(__dirname + '/results-rr4.md', out.join('\n') + '\n'); console.log(out.join('\n'));
