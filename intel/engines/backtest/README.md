# backtest: one engine for every strategy

Answers: what would a strategy have done on past candles, in R, after costs?

Files: `engine.js` (loop, indicators, `stats`, cost models), `strategies.js` (`bbcore`, `tcore`, `icore` in rules `v3` and `legacy`, `bbFade`, `rsi2`, `liveRules`), `index.js` (reference trades and report).

## Inputs and outputs

Input: dataset `market` (4h candles and funding of each bot coin in `config.json` `bots`). Output: `derived/reference-trades` (`trades.csv`, `summary.json`) and `reports\backtest.md`. Columns: `DATA-DICTIONARY.md`. Other engines read this dataset: regime, validator, health.

## How to run

```
node run.js reports
node engines/backtest/index.js
node run.js validate <strategy>      # uses this engine through the validator
```

## Method in plain words

- Decide on a candle close. Fill at the next candle open.
- Inside a candle the stop is checked first. If a candle touches both the stop and something better, the stop is assumed (worst case). A gap through the stop fills at the open.
- Indicators at candle i use candles 0 to i only.
- A strategy is an object: `signal(ctx, i)` plus exit settings (initial stop, trail in ATR, profit lock, stale exit, maximum bars, cool-down after a loss).
- R = result divided by the amount risked (entry to first stop), after costs.
- Candles with a time gap inside the indicator window give no signal.

## Cost models

| Model | Rule |
|---|---|
| `standardCost` (cost = `standard`) | Taker fee 0.05 percent on entry and exit. Slippage 0.02 percent against you on both fills. Funding from the real settled rates when a series is given, else a flat 0.005 percent per candle. Optional `scale` multiplies fee, slippage and flat funding (the validator uses 2). One model for all new research. |
| `bbNativeCost` (cost = `native`, BB-CORE) | BB-CORE's own: slippage in the fills, entry fee 0.05 percent, exit fee 0.05 percent (stop or time), real funding. |
| `icNativeCost` (cost = `native`, I-CORE and T-CORE) | Fills at the raw price. R is charged 2 x (fee + slippage) plus 0.005 percent per candle. |
| `freeCost` | No costs. For tests. |

## Parity guarantee

The engine reproduces each bot's own backtest trade for trade (same entry, exit, direction, reason, and R within 1e-9) under that bot's native costs. This is checked in `test\backtest-parity.test.js` for `bbcore`, `icore`, `tcore`, each with `v3` and `legacy` rules, on SOL ZEC NEAR ADA GALA. It needs the bot repos beside this project: a missing repo skips that test. The same file checks that T-CORE legacy rules give about 613 trades up to 2026-11-06.

## Tests

`test\backtest-parity.test.js` (parity), `test\backtest-engine.test.js` (ATR, bands, costs, fills, stops, gaps, cool-down, no look-ahead), `test\backtest-strategies.test.js` (v3 and legacy parameters, `bbFade`, `rsi2`). `index.js` is covered only by `test\end-to-end.test.js`.

## Limits

- No `asOf`: the engine runs over all candles given.
- The reference backtests use today's coin lists over each coin's whole Binance history.
- Binance candles. The bots trade on MEXC.
- Rules: `v3` applies from the signal candle of 2026-11-14 00:00 UTC, `legacy` before. `liveRules` joins both.
