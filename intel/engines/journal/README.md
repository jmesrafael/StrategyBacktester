# journal: daily journal, streaks, clusters, entry stamps

Answers: which kind of day makes or loses money for each live bot?

## Inputs

Datasets `trades`, `market`, `events`, and `headlines` (optional). Live trades only for days, streaks and stamps. Clusters use live and paper entries.

## Outputs

Dataset `derived/journal`: `days.csv`, `stamps.csv`, `streaks.csv`, `clusters.csv`, `summary.json`. Report `reports\journal.md`. Columns: `DATA-DICTIONARY.md`.

## How to run

```
node run.js reports
node engines/journal/index.js
```

In code: `run({ asOf, noReport })`. `asOf` is Unix seconds. With `asOf`, later exits are unknown: a trade that exited after `asOf` is treated as open.

## Method in plain words

- R of an open trade at time T = direction x (last price - entry) / (entry - first stop). A closed trade keeps its recorded R. Open R is an estimate: it uses Binance prices, the bots trade on MEXC.
- One row per bot per UTC day, plus `ALL`. `day_r` is the change in total R during the day.
- Context per day: BTC day move, BTC 7-day phase (`down` at -4 percent or lower, `up` at +4 or higher), day range against the median of the last 30 days, BTC shocks, owner tags, news mood.
- News mood: bearish minus bullish market-impact stories in the previous 24 hours, each weighted by strength / 100. `mood` uses only labels that existed at that time. `mood_hindsight` also uses later labels, for comparison only.
- Streak: 3 or more days in a row with the same sign. A day within 0.05R of zero is flat and ends a streak.
- Cluster: 3 or more entries inside 4 hours.
- Stamp: what was known at each live entry (BTC move before, shock context in the previous 72 hours, mood, tags).

## Tests

`test\journal.test.js` covers `rAt` (R of a trade at a time, no look-ahead) and the exports. `build` and the report are checked only by `test\end-to-end.test.js` (journal summary on the real data).

## Limits

- A few dozen days describe one period. They are not evidence of a rule.
- Groups with few days or entries swing on single trades.
- Open R is an estimate.
