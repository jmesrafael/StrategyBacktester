# health: live against backtest

Information only. Nothing here reaches a bot.
Answers: do the live bots behave like their backtests? Is the live result unusually low?

## Inputs

Datasets `trades` (`trades.csv`, `signals.csv`, `wallets.csv`), `market`, `derived/reference-trades`, and `derived/execution` (optional). Config `bots`, `coinStart`, `health`. Engines: `engines\backtest` (engine and strategies), `engines\journal` (`rAt`).

## Outputs

Dataset `derived/health`: `parity.csv`, `decay.csv`, `daily.json`. Report `reports\health.md`. Columns: `DATA-DICTIONARY.md`.

## How to run

```
node run.js reports
node engines/health/index.js
```

## Method in plain words

1. Parity. For each bot, the backtest runs the bot's current rules (`liveRules`, which switches from legacy to v3 at 2026-11-14) with the bot's native costs on Binance candles. Its entries are compared with the live entries by coin and 4h candle. Each is `matched`, `live_only` or `backtest_only`. For a backtest-only entry, the bot's own skip reason is taken from `signals.csv` when it exists. For matched closed trades the R difference is listed.
2. Edge decay. The live result so far (closed plus open at the last price) against all backtest windows of the same length (in days) since 2021. The percentile is the share of windows that did worse than live. An alert fires below `health.alertPercentile`. Open trades are valued at today's price, backtest trades are final, so a young window reads low.
3. Losing run. The current run of live losses in a row against the longest run in the backtest. An alert fires at 70 percent of it or more.
4. Execution: entry slippage from `derived/execution`, if built.

Parity alert: any live-only entry, or a largest R difference above 0.15.

## Parity cold-start rule

The live bot began with no open position and no history. A backtest over all history would hold positions at the live start that the bot never had. So for each coin the backtest starts like this:

- Start time `cs` = the later of the bot's start and the coin's `config.json` `coinStart` date (set for ARB, SUI, ETH, which joined a bot after it went live).
- The bot's start = the earliest of its wallet snapshots and its live entries.
- Candles are loaded from `cs` minus the strategy's warm-up (in 4h candles). Indicators are warm, but there is no trade before `cs`.
- Only backtest trades with entry time at or after `cs` minus one 4h candle are compared.

Add a new late coin to `coinStart`, or its first backtest trades will be listed as `backtest_only`.

## Tests

`test\health.test.js` checks only the exports. The engine is exercised by `test\end-to-end.test.js` on the real data (invariants, not exact numbers). Parity and decay have no unit test.

## Limits

- A few weeks of live trades cannot show a decay. Read the percentile as "not unusual yet" or "unusual", not as proof.
- Parity uses Binance candles. The bots trade on MEXC, so a small difference at a threshold can change a signal.
