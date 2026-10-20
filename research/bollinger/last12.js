// last12.js — last 12 months (Oct 2025 → Oct 2026 so far), month by month, SOL / DOGE / ZEC, $5 risk per trade. usage: node last12.js
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js'), { fvgpb } = require('./fvg.js'), F = require('./fam.js');
const APP = path.resolve(__dirname, '../..'), COINS = ['SOL', 'DOGE', 'ZEC'], RISK = 5;
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat, window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {}; vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/ny-smc-v7-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const v7 = ctx.window.__STRATEGIES.nysmcv7, v7p = Object.fromEntries(Object.entries(v7.params).map(([k, d]) => [k, d.default]));
const v7trades = (sym) => { const bars = L.bars(sym, 15); const r = ctx.SM.simulate(v7, v7p, bars, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0.04, slippagePct: 0.02, startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } }, null);
  let bal = 10000; return r.trades.map((t) => { const R = t.usd / (bal * 0.01); bal += t.usd; return { t: bars[t.entryIndex].time, R }; }); };
const FVG = { minGap: 0.5, disp: 0, depth: 0, stop: 'origin', tp: 3, expire: 20, trend: 'htf', maxHold: 0, tf: 240 };
const BB = { tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 3, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const SYS = { 'BB Breakout 4h': (s) => F.sq(s, BB), 'FVG direct 4h': (s) => fvgpb(s, { ...FVG, direct: true }), 'FVG pullback (limit) 4h': (s) => fvgpb(s, FVG), 'NY SMC v7 15m': v7trades };
const MONTHS = []; for (let i = 0; i < 12; i++) { const d = new Date(Date.UTC(2025, 10 + i, 1)); MONTHS.push([d.toISOString().slice(0, 7), Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000, Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000]); }
const f = (v) => v == null ? '·' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
const out = ['# Last 12 months (Nov 2025 → Oct 2026 so far) — monthly, $5 risk per trade\n', '0.04% commission + 0.02% slippage, flat $5 per trade. · = no trades. Oct 2026 is the first 20 days.\n'];
const cache = {};
for (const [name, fn] of Object.entries(SYS)) {
  cache[name] = Object.fromEntries(COINS.map((s) => [s, fn(s)]));
  const per = cache[name];
  out.push(`## ${name}\n`, '| Month | SOL | DOGE | ZEC | **All three** | Trades |', '|---|---|---|---|---|---|');
  const tot = [0, 0, 0]; let n = 0;
  for (const [label, a, b] of MONTHS) {
    const t = COINS.map((s) => L.slice(per[s], a, b)), v = t.map((x) => x.length ? L.sum(x.map((y) => y.R)) * RISK : null);
    v.forEach((x, i) => { tot[i] += x || 0; }); const m = t.reduce((s, x) => s + x.length, 0); n += m;
    out.push(`| ${label} | ${v.map(f).join(' | ')} | **${f(L.sum(v.map((x) => x || 0)))}** | ${m} |`);
  }
  out.push(`| **12-month total** | ${tot.map((x) => '**' + f(x) + '**').join(' | ')} | **${f(L.sum(tot))}** | ${n} |`, '');
}
out.push('## Last 12 months — totals by strategy and coin ($5 risk)\n', '| Strategy | SOL | DOGE | ZEC | All three |', '|---|---|---|---|---|');
for (const [name, per] of Object.entries(cache)) { const v = COINS.map((s) => L.sum(L.slice(per[s], MONTHS[0][1], MONTHS[11][2]).map((x) => x.R)) * RISK); out.push(`| ${name} | ${v.map(f).join(' | ')} | **${f(L.sum(v))}** |`); }
fs.writeFileSync(__dirname + '/results-last12.md', out.join('\n') + '\n');
console.log(out.join('\n'));
