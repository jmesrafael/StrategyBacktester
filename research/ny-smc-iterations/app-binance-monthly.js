// app-binance-monthly.js — v7 run end to end the way the app runs it now: candles from the app's own
// loader (js/binance.js, live Binance USDT-M 15m), the app's Strategy-mode engine (js/strategy.js
// simulate()) with strategies/ny-smc-v7-strategy.js at its default settings. Monthly P&L at $1 risk,
// compared with the research result (results/binance-v7.json, saved data + research engine).
// usage: node app-binance-monthly.js        → results/app-binance-monthly.md
const fs = require('fs'), vm = require('vm'), path = require('path');
const APP = path.resolve(__dirname, '../..');
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat,
  fetch, setTimeout, Promise, Error,
  window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {};
vm.createContext(ctx);
for (const f of ['js/binance.js', 'js/indicators.js', 'strategies/registry.js', 'strategies/ny-smc-v7-strategy.js'])
  vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode; this.BN = BINANCE;', ctx);
const strat = ctx.window.__STRATEGIES.nysmcv7;
const prm = Object.fromEntries(Object.entries(strat.params).map(([k, d]) => [k, d.default]));

const OLD = JSON.parse(fs.readFileSync(path.join(__dirname, 'results/binance-v7.json'), 'utf8')).monthly || {};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const f = (v) => v == null ? '·' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
const mk = (t) => new Date(t * 1000).toISOString().slice(0, 7);

(async () => {
  const L = ['# v7 in the app on live Binance data — monthly P&L ($1 risk)', '',
    `Run ${new Date().toISOString().slice(0, 16)} UTC. Candles: js/binance.js (app loader, live fapi.binance.com 15m). ` +
    'Engine: js/strategy.js simulate(), v7 defaults (Standard risk mode), next-open fills, stop-first on ambiguous candles, ' +
    '0.04% commission + 0.02% slippage. 1R = $1 (app risks 1% of balance; each trade is divided by its own risked amount).', ''];
  const all = {};
  const summary = [];
  for (const sym of ['SOL', 'ETH']) {
    process.stdout.write(`${sym}: downloading… `);
    const bars = await ctx.BN.fetchPages(`${sym}USDT.P`, '15', 260000, null, null);
    console.log(`${bars.length} candles ${mk(bars[0].time)} → ${new Date(bars.at(-1).time * 1000).toISOString().slice(0, 16)}`);
    const res = ctx.SM.simulate(strat, prm, bars, { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0.04, slippagePct: 0.02,
      startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 1000, session: { enabled: false } }, null);
    let bal = 10000;
    const trades = res.trades.map((t) => { const R = t.usd / (bal * 0.01); bal += t.usd; return { t: bars[t.entryIndex].time, R }; });
    const m = {};
    for (const t of trades) m[mk(t.t)] = (m[mk(t.t)] || 0) + t.R;
    all[sym] = m;
    const tot = trades.reduce((a, t) => a + t.R, 0);
    const recent = trades.filter((t) => t.t >= Date.UTC(2023, 9, 1) / 1000);
    const oldTot = Object.values(OLD[sym] || {}).reduce((a, v) => a + v, 0);
    summary.push([sym, trades.length, tot, recent.length, recent.reduce((a, t) => a + t.R, 0), oldTot,
      res.stats.winRate, res.stats.profitFactor]);
  }
  all.Both = {};
  for (const s of ['SOL', 'ETH']) for (const [k, v] of Object.entries(all[s])) all.Both[k] = (all.Both[k] || 0) + v;
  const oldBoth = OLD.Both || {};

  L.push('## Summary', '', '| Coin | Trades | App total | Since Oct 2023: trades | Since Oct 2023: total | Research total (yesterday) | Win % | PF |',
    '|---|---|---|---|---|---|---|---|');
  for (const [s, n, tot, rn, rt, ot, w, pf] of summary)
    L.push(`| ${s} | ${n} | **${f(tot)}** | ${rn} | ${f(rt)} | ${f(ot)} | ${w.toFixed(0)}% | ${pf.toFixed(2)} |`);

  for (const s of ['SOL', 'ETH', 'Both']) {
    L.push('', `## ${s === 'Both' ? 'SOL + ETH combined' : s} — monthly ($1 risk, · = no trades; research value in brackets when different by > $0.50)`, '',
      `| Year | ${MON.join(' | ')} | **Year** | Research year |`, `|---|${MON.map(() => '---').join('|')}|---|---|`);
    const old = s === 'Both' ? oldBoth : (OLD[s] || {});
    const years = [...new Set(Object.keys(all[s]).concat(Object.keys(old)).map((k) => k.slice(0, 4)))].sort();
    for (const y of years) {
      let yt = 0, oy = 0;
      const cells = MON.map((_, i) => {
        const k = `${y}-${String(i + 1).padStart(2, '0')}`, v = all[s][k], o = old[k];
        if (v != null) yt += v; if (o != null) oy += o;
        const diff = Math.abs((v || 0) - (o || 0)) > 0.5;
        return f(v) + (diff ? ` (${f(o)})` : '');
      });
      L.push(`| ${y} | ${cells.join(' | ')} | **${f(yt)}** | ${f(oy)} |`);
    }
  }
  const out = path.join(__dirname, 'results/app-binance-monthly.md');
  fs.writeFileSync(out, L.join('\n') + '\n');
  console.log(L.slice(5, 9 + summary.length).join('\n'));
  console.log('→', out);
})();
