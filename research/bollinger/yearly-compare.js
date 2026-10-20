// yearly-compare.js — every strategy, year by year, on SOL / DOGE / ZEC at $5 risk per trade (R x 5). usage: node yearly-compare.js
// BB Breakout and FVG variants: research engine (frozen settings, 4h). v7: the app's own engine on 15m candles (Standard mode, default settings).
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js'), { fvgpb } = require('./fvg.js'), F = require('./fam.js');
const APP = path.resolve(__dirname, '../..'), COINS = ['SOL', 'DOGE', 'ZEC'], RISK = 5, YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat, window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {}; vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/ny-smc-v7-strategy.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const v7 = ctx.window.__STRATEGIES.nysmcv7, v7p = Object.fromEntries(Object.entries(v7.params).map(([k, d]) => [k, d.default]));
const v7trades = (sym) => { const bars = L.bars(sym, 15); const r = ctx.SM.simulate(v7, v7p, bars, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0.04, slippagePct: 0.02,
  startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } }, null);
  let bal = 10000; return r.trades.map((t) => { const R = t.usd / (bal * 0.01); bal += t.usd; return { t: bars[t.entryIndex].time, R }; }); };
const FVG = { minGap: 0.5, disp: 0, depth: 0, stop: 'origin', tp: 3, expire: 20, trend: 'htf', maxHold: 0, tf: 240 };
const BB = { tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 3, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const SYS = { 'BB Breakout 4h': (s) => F.sq(s, BB), 'FVG direct 4h': (s) => fvgpb(s, { ...FVG, direct: true }), 'FVG pullback (limit) 4h': (s) => fvgpb(s, FVG),
  'FVG pullback + confirm 4h': (s) => fvgpb(s, { ...FVG, confirm: true }), 'NY SMC v7 15m': v7trades };
const f = (v) => v == null ? '·' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(0);
const out = ['# Year by year on SOL / DOGE / ZEC — $5 risk per trade (whole dollars)\n', 'BB Breakout and FVG: frozen settings, 4h, research engine. v7: the app engine on 15m. 0.04% commission + 0.02% slippage. Train years were 2019–22 for the BB/FVG settings (picked on BTC/ETH/SOL); 2023+ is held out. v7 was tuned on Oct 2023 → 2026.\n'];
const score = [];
for (const [name, fn] of Object.entries(SYS)) {
  const per = Object.fromEntries(COINS.map((s) => [s, fn(s)]));
  out.push(`## ${name}\n`, `| Year | SOL | DOGE | ZEC | **All three** |`, '|---|---|---|---|---|');
  let posYears = 0, years = 0, posCoinYears = 0, coinYears = 0;
  for (const y of YEARS) {
    const v = COINS.map((s) => { const t = L.slice(per[s], L.ts(y), L.ts(y + 1)); return t.length ? L.sum(t.map((x) => x.R)) * RISK : null; });
    const tot = L.sum(v.map((x) => x || 0)); years++; if (tot > 0) posYears++;
    v.forEach((x) => { if (x != null) { coinYears++; if (x > 0) posCoinYears++; } });
    out.push(`| ${y}${y === 2026 ? ' (to Oct)' : ''} | ${v.map(f).join(' | ')} | **${f(tot)}** |`);
  }
  const all = COINS.flatMap((s) => per[s]), st = L.stats(all);
  const held = COINS.flatMap((s) => L.slice(per[s], L.ts(2023), L.ts(2100)));
  out.push(`| **Total** | ${COINS.map((s) => f(L.sum(per[s].map((x) => x.R)) * RISK)).join(' | ')} | **${f(L.sum(all.map((x) => x.R)) * RISK)}** |`, '');
  score.push({ name, posYears, years, posCoinYears, coinYears, total: L.sum(all.map((x) => x.R)) * RISK, held: L.sum(held.map((x) => x.R)) * RISK, trades: all.length, heldTrades: held.length, avgR: st.avg });
}
out.push('## Scoreboard\n', '| Strategy | Years positive (all three combined) | Coin-years positive | Total $ | Held-out 2023→ $ | Trades | Avg R / trade |', '|---|---|---|---|---|---|---|');
for (const s of score.sort((a, b) => b.total - a.total)) out.push(`| ${s.name} | ${s.posYears} of ${s.years} | ${s.posCoinYears} of ${s.coinYears} | ${f(s.total)} | ${f(s.held)} | ${s.trades} | ${L.f2(s.avgR)} |`);
fs.writeFileSync(__dirname + '/results-yearly-compare.md', out.join('\n') + '\n');
console.log(out.join('\n'));
