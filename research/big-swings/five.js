// five.js — frozen strategies (tuned only on BTC/ETH/SOL 2020-22) on SOL ZEC NEAR ADA GALA, 2020-2026, 2.5% of current equity risked per trade, compounded.
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const bb = require('../bb-core-v2/v2-core.js');
const { loadCoin } = require('../bb-core-v2/load.js');
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const START = 1000, RISKPCT = 0.025;
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), pc = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%', usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
const yrOf = (t) => new Date(t.tExit * 1000).getUTCFullYear();
const cache = {}; const get = (c) => cache[c] || (cache[c] = (() => { const B = E.load(c); return { B, X: E.base(B) }; })());

const STRATS = [
  { name: 'bb-core (current bot)', run: (c) => { const d = loadCoin(c); return bb.backtest(d.B, {}, d.funding).trades.map((t) => ({ ...t, coin: c, risk: Math.abs(t.entry - t.stop) / t.entry })); } },
  { name: 'Keltner 20/2 + SMA200 (stop 1.5 ATR, trail 5 ATR)', run: (c) => E.run(get(c).B, get(c).X, 'keltner', { n: 20, m: 2 }, { coin: c, kInit: 1.5, kTrail: 5, trend: true, exitOpp: false }) },
  { name: 'Keltner 10/1.5 (stop 1.5 ATR, trail 5 ATR)', run: (c) => E.run(get(c).B, get(c).X, 'keltner', { n: 10, m: 1.5 }, { coin: c, kInit: 1.5, kTrail: 5, trend: false, exitOpp: false }) },
  { name: 'Donchian 20 + SMA200 (stop 1.5 ATR, trail 5 ATR)', run: (c) => E.run(get(c).B, get(c).X, 'donchian', { n: 20 }, { coin: c, kInit: 1.5, kTrail: 5, trend: true, exitOpp: false }) },
  { name: 'Donchian 30 + SMA200 (stop 1.5 ATR, trail 5 ATR)', run: (c) => E.run(get(c).B, get(c).X, 'donchian', { n: 30 }, { coin: c, kInit: 1.5, kTrail: 5, trend: true, exitOpp: false }) },
];

// compounding account: each trade risks RISKPCT of the REALISED equity at the moment it opens
function account(T) {
  const tr = [...T].sort((a, b) => a.t - b.t), closed = [];           // closed = {tExit, pnl}
  const ev = [];                                                       // {t, eq} realised equity after every exit
  let peakOpenRisk = 0, peakLev = 0;
  const done = [];
  for (const x of tr) {
    const eq = START + done.filter((d) => d.tExit <= x.t).reduce((a, d) => a + d.pnl, 0);
    const rd = RISKPCT * eq, pnl = x.R * rd;
    done.push({ t: x.t, tExit: x.tExit, pnl, eq, rd, notional: rd / x.risk });
  }
  // leverage: sum of notionals open at once / equity at the time
  for (const d of done) { const open = done.filter((o) => o.t <= d.t && o.tExit > d.t); const n = open.reduce((a, o) => a + o.notional, 0); peakLev = Math.max(peakLev, n / d.eq); peakOpenRisk = Math.max(peakOpenRisk, open.length); }
  const byExit = [...done].sort((a, b) => a.tExit - b.tExit);
  let eq = START, pk = START, dd = 0; const yEnd = {}, yStart = {};
  for (const d of byExit) { eq += d.pnl; pk = Math.max(pk, eq); dd = Math.max(dd, (pk - eq) / pk); const y = new Date(d.tExit * 1000).getUTCFullYear(); yEnd[y] = eq; }
  const yr = {}; let prev = START; for (const y of YEARS) { if (yEnd[y] !== undefined) { yr[y] = yEnd[y] / prev - 1; prev = yEnd[y]; } else yr[y] = 0; }
  return { final: eq, dd, yr, peakLev, peakOpen: peakOpenRisk };
}

let out = `# Frozen strategies on SOL · ZEC · NEAR · ADA · GALA — Binance USDT-M 4h, 2020 → Oct 2026\n\n- Settings are **frozen**: they were picked only on BTC/ETH/SOL 2020-22. ZEC, NEAR, ADA, GALA were never used to tune anything (SOL was in the tuning set).\n- **${RISKPCT * 100}% of current equity risked per trade, compounded**, starting ${usd(START)}; coins can be open at the same time (up to 5). Equity = closed trades only.\n- Costs: 0.07% per side (fee + slippage) + funding (new strategies: flat 0.005%/4h bar; bb-core: its real funding files). Entry at next open, stops on high/low, no look-ahead.\n- Coin data start: ZEC Feb 2020, ADA Jan 2020, SOL Sep 2020, NEAR Oct 2020, GALA Sep 2021. 2026 = up to Oct 21-27.\n\n`;
const summary = [];
for (const s of STRATS) {
  const per = Object.fromEntries(COINS.map((c) => [c, s.run(c)])), all = COINS.flatMap((c) => per[c]);
  out += `## ${s.name}\n\n| coin | trades | win% | total R | max DD (R) | yrs+ | ${YEARS.join(' | ')} |\n|---|---|---|---|---|---|${YEARS.map(() => '---').join('|')}|\n`;
  for (const c of [...COINS, 'ALL 5']) {
    const T = c === 'ALL 5' ? all : per[c], y = E.yearly(T);
    out += `| ${c} | ${T.length} | ${(100 * T.filter((t) => t.R > 0).length / T.length).toFixed(0)}% | ${f1(T.reduce((a, t) => a + t.R, 0))} | ${E.maxDD(T).toFixed(0)} | ${YEARS.filter((v) => (y[v] || 0) > 0).length}/7 | ${YEARS.map((v) => f1(y[v] || 0)).join(' | ')} |\n`;
  }
  const a = account(all);
  out += `| **account @2.5%** (yearly return) | | | **${usd(a.final)}** | **−${(a.dd * 100).toFixed(0)}% DD** | ${YEARS.filter((v) => a.yr[v] > 0).length}/7 | ${YEARS.map((v) => pc(a.yr[v])).join(' | ')} |\n\n`;
  summary.push({ name: s.name, a, n: all.length, R: all.reduce((x, t) => x + t.R, 0), rdd: E.maxDD(all), y: E.yearly(all), ypos: YEARS.filter((v) => (E.yearly(all)[v] || 0) > 0).length });
}
out += `## Comparison (all 5 coins, ${RISKPCT * 100}% risk per trade, start ${usd(START)})\n\n| strategy | trades | total R | max DD (R) | end equity | max DD (% of equity) | peak open positions | peak notional ÷ equity | yrs+ (R) | ${YEARS.join(' | ')} |\n|---|---|---|---|---|---|---|---|---|${YEARS.map(() => '---').join('|')}|\n`;
for (const s of summary) out += `| ${s.name} | ${s.n} | ${f1(s.R)} | ${s.rdd.toFixed(0)} | ${usd(s.a.final)} | −${(s.a.dd * 100).toFixed(0)}% | ${s.a.peakOpen} | ${s.a.peakLev.toFixed(1)}x | ${s.ypos}/7 | ${YEARS.map((v) => pc(s.a.yr[v])).join(' | ')} |\n`;
out += `\nYearly figures in the comparison are the account's % return that calendar year. "Max DD" is on closed-trade equity (open-trade swings not included, so the live dip would be somewhat deeper).\n`;
fs.writeFileSync(path.join(__dirname, 'RESULTS-5coins.md'), out); console.log(out);
