// tools/sweep.js — parameter sweep over the fixed-MTF strategy on cached real candles.
// Fetches once per (symbol,interval), runs every combo, ranks by profit factor /
// expectancy with a minimum-trades guard (avoid overfitting to a handful of trades).
'use strict';
const path = require('path');
const { simulate, fetchCandles, loadStrategy } = require('./backtest-harness');

const CFG = { startBalance: 10000, sizePct: 25, commissionPct: 0.05, slippagePct: 0.01 };

function combos(grid) {
  const keys = Object.keys(grid);
  let out = [{}];
  for (const k of keys) {
    const next = [];
    for (const base of out) for (const v of grid[k]) next.push({ ...base, [k]: v });
    out = next;
  }
  return out;
}

async function main() {
  const file = path.resolve('strategies/fixed-mtf-golden-cross-strategy.js');
  const { strat } = loadStrategy(file);
  const defaults = {};
  Object.entries(strat.params).forEach(([k, d]) => { defaults[k] = d.default; });

  const symbol = process.env.SYM || 'ETHUSDT';
  const interval = process.env.IV || '60';
  const bars = parseInt(process.env.BARS || '8000');
  console.error(`fetching ${symbol} ${interval} ${bars}...`);
  const candles = await fetchCandles(symbol, interval, bars);
  console.error(`got ${candles.length} candles`);

  const grid = {
    fixedTf:    ['4H', '12H', 'Daily'],
    entryMode:  ['Pullback to fast EMA', 'Rising edge'],
    useSmc:     ['On', 'Off'],
    direction:  ['Both', 'Long only'],
    tpATR:      [4, 6],
    regimeExit: ['On', 'Off'],
  };

  const rows = [];
  for (const c of combos(grid)) {
    const params = { ...defaults, ...c };
    let r; try { r = simulate(strat, params, candles, CFG); } catch (e) { continue; }
    const st = r.stats;
    rows.push({ c, st });
  }

  const pf = (x) => (x === Infinity ? 999 : x);
  // rank: enough trades, then profit factor, then expectancy
  rows.sort((a, b) => {
    const at = a.st.totalTrades >= 20, bt = b.st.totalTrades >= 20;
    if (at !== bt) return at ? -1 : 1;
    if (pf(b.st.profitFactor) !== pf(a.st.profitFactor)) return pf(b.st.profitFactor) - pf(a.st.profitFactor);
    return (b.st.expectancyR || 0) - (a.st.expectancyR || 0);
  });

  console.log(`\nTop 18 configs — ${symbol} ${interval} (${candles.length} bars, size ${CFG.sizePct}%, net of fees)\n`);
  console.log('  PF    net%    trades  win%   expR    maxDD   config');
  for (const { c, st } of rows.slice(0, 18)) {
    const pfs = (st.profitFactor === Infinity ? '∞' : st.profitFactor.toFixed(2)).padStart(5);
    console.log(
      `  ${pfs}  ${st.netPct.toFixed(1).padStart(6)}  ${String(st.totalTrades).padStart(5)}  ${st.winRate.toFixed(0).padStart(4)}  ${(st.expectancyR != null ? st.expectancyR.toFixed(2) : '-').padStart(5)}R  ${st.maxDrawdown.toFixed(0).padStart(5)}%  ` +
      `${c.fixedTf} | ${c.entryMode === 'Rising edge' ? 'edge' : 'pull'} | smc:${c.useSmc} | ${c.direction} | tp${c.tpATR} | rex:${c.regimeExit}`
    );
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
