# regime: market regime, regime changes, volatility clustering

Answers: what state is each coin and the market in? Does that state explain bot results on data it was not fitted on?

## Inputs

Dataset `market` (1h candles of BTC and every bot coin). Dataset `derived/reference-trades` (optional; the validation step needs it).

## Outputs

Dataset `derived/regime`: `history.csv`, `market.csv`, `transitions.json`, `volatility.json`, `validation.csv`, `verdict.json`. Report `reports\regime.md`. Columns: `DATA-DICTIONARY.md`.

## How to run

```
node run.js reports
node engines/regime/index.js
```

## Method in plain words

Per coin, using only closed bars:

| State | Rule |
|---|---|
| `trending_up` / `trending_down` | efficiency ratio over 48h at or above 0.30. Up if the close is at or above its 800 hour average. |
| `volatile` | not trending, Bollinger band width (80 bars, 2 sd) in the widest fifth (80th percentile or higher) of the last 90 days |
| `quiet` | band width at or below the 20th percentile |
| `ranging` | everything else |

Market state, from the five core coins SOL, ZEC, NEAR, ADA, GALA: at least half trending gives `trending_up` or `trending_down`. At least half ranging or quiet gives `choppy`. Else `mixed`.

- Volatility clustering (BTC): autocorrelation of absolute hourly returns at 1h, 24h, 168h. Next-day movement after the calmest and the most active fifth of days.
- Validation: each v3 standard-cost reference trade is labelled with the state at its signal. States are ranked on trades before 2024. The gap between the better and the worse states is then measured from 2024 on. A fixed-seed shuffle test (2,000 relabelings) gives a chance value. `validated` needs a positive gap and a chance value below 0.05. Fewer than 3 states with 20 trades, or fewer than 60 later trades: `not enough data`.

The label definitions follow the recorder's `lucidio-recorder/regime.js`, re-implemented here. The code header names `test/regime.test.js` as the proof. The match with the recorder is tested in `test\regime-parity.test.js`.

## Tests

| File | Covers |
|---|---|
| `test\regime.test.js` | `regimeAt` (minimum bars, trend and range cases, no look-ahead), `coinRegimeAt`, `validate` |
| `test\regime-parity.test.js` | same output as the recorder's classifier on 200 real positions (skipped if the recorder code or market data is missing) |

## Limits

- Thresholds were chosen by hand for the recorder. They are not tuned here.
- `not validated` means the label is context for reading the journal. It must not be used as a trade filter.
- History starts 2020-06-01 and each coin needs 805 bars before it has a state.
