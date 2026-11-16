# exposure: combined exposure and stress test

Observation and alerts only. It never touches a bot.
Answers: how big is the one combined bet of all live bots right now? What would a BTC move do?

## Inputs

Datasets `trades` (`trades.csv`, `wallets.csv`) and `market`. The correlation matrix comes from `engines\correlation` (`latest()`). Open R comes from `engines\journal` (`rAt()`). Config `exposure`.

## Outputs

Dataset `derived/exposure`: `history.csv` (every 4 hours), `now.json`, `stress.csv`, `alerts.csv`. Report `reports\exposure.md`. Columns: `DATA-DICTIONARY.md`.

## How to run

```
node run.js reports
node engines/exposure/index.js
```

In code: `build({ asOf })`, `run({ asOf })`, `effectiveBets`, `analyse`, `stress`, `positionsAt`.

## Method in plain words

- For each open live position: `risk_usd` = `risk_pct` x equity of its bot at entry (last non-suspect wallet snapshot before the entry). Signed risk = direction x `risk_usd`.
- Effective bets = (sum of absolute signed risks) squared, divided by (s' C s). C is the correlation of the coins' 1h returns over the last `exposure.corrWindowHours` hours. Positions on the same coin have correlation 1. 1 means everything is one bet. N means N independent bets.
- Alerts: effective bets below `exposure.alertEffectiveBets` (only with 3 or more positions), or open net R beyond plus or minus `exposure.alertNetR`.
- Stress: BTC moves by -10, -5, +5, +10 percent. Each coin moves by its beta to BTC. Loss in R = coin move divided by the stop distance.
- History: the same numbers every 4 hours from the first live day, using the correlation matrix of each day.

## Tests

`test\exposure.test.js` covers `effectiveBets`, `analyse`, `stress` and `positionsAt` (including an `asOf` replay) with hand-made numbers.

## Limits

- Correlation changes fast in a sell-off. The matrix uses the last 7 days only.
- Thresholds are first guesses in `config.json`. They are not tuned. The history shows how often each would have fired.
- Open R is valued from Binance prices.
- A trade without `risk_pct` or without an equity snapshot is left out.
