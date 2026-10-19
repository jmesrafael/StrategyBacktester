// tools/compare.js — evaluate a handful of named candidate configs across windows/symbols
// to choose a robust DEFAULT (not an overfit single-window peak).
'use strict';
const path = require('path');
const { simulate, fetchCandles, loadStrategy } = require('./backtest-harness');
const CFG = { startBalance: 10000, sizePct: 25, commissionPct: 0.05, slippagePct: 0.01 };

const base = {
  crossMode: 'Regime (Fast>Slow)', entryMode: 'Rising edge', useSmc: 'On',
  macdMode: 'Line > Signal', pivotTf: 'Weekly', pivotRule: 'Price vs P',
  direction: 'Both', slATR: 2.0, tpATR: 6.0, exitStyle: 'Trailing + target',
  regimeExit: 'On', cooldown: 3, smcLookback: 12,
};
const candidates = {
  'Daily 50/200': { fixedTf: 'Daily', emaFastLen: 50, emaSlowLen: 200 },
  'Daily 21/55':  { fixedTf: 'Daily', emaFastLen: 21, emaSlowLen: 55 },
  'Daily 20/50':  { fixedTf: 'Daily', emaFastLen: 20, emaSlowLen: 50 },
  '4H 50/200':    { fixedTf: '4H',    emaFastLen: 50, emaSlowLen: 200 },
  '4H 21/55':     { fixedTf: '4H',    emaFastLen: 21, emaSlowLen: 55 },
  '12H 50/200':   { fixedTf: '12H',   emaFastLen: 50, emaSlowLen: 200 },
};

function fmtRow(name, st) {
  const pf = (st.profitFactor === Infinity ? '∞' : st.profitFactor.toFixed(2)).padStart(5);
  return `    ${name.padEnd(14)} PF ${pf}  net ${st.netPct.toFixed(1).padStart(6)}%  ${String(st.totalTrades).padStart(3)}t  win ${st.winRate.toFixed(0).padStart(2)}%  ${(st.expectancyR != null ? st.expectancyR.toFixed(2) : '-').padStart(5)}R  DD ${st.maxDrawdown.toFixed(0).padStart(4)}%`;
}

async function evalSet(strat, defaults, label, candles) {
  console.log(`\n  === ${label}  (${candles.length} bars, ${new Date(candles[0].time*1000).toISOString().slice(0,10)} → ${new Date(candles[candles.length-1].time*1000).toISOString().slice(0,10)}) ===`);
  for (const [name, ov] of Object.entries(candidates)) {
    const params = { ...defaults, ...base, ...ov };
    let st; try { st = simulate(strat, params, candles, CFG).stats; } catch (e) { console.log(`    ${name}: ERR ${e.message}`); continue; }
    console.log(fmtRow(name, st));
  }
}

async function main() {
  const { strat } = loadStrategy(path.resolve('strategies/fixed-mtf-golden-cross-strategy.js'));
  const defaults = {}; Object.entries(strat.params).forEach(([k, d]) => { defaults[k] = d.default; });

  const eth = await fetchCandles('ETHUSDT', '60', 8000);
  await evalSet(strat, defaults, 'ETH 1h — full', eth);
  await evalSet(strat, defaults, 'ETH 1h — recent ~6mo', eth.slice(-4300));

  const btc = await fetchCandles('BTCUSDT', '60', 8000);
  await evalSet(strat, defaults, 'BTC 1h — full', btc);

  const sol = await fetchCandles('SOLUSDT', '60', 8000);
  await evalSet(strat, defaults, 'SOL 1h — full', sol);
}
main().catch((e) => { console.error(e); process.exit(1); });
