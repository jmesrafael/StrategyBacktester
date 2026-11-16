# Correlation engine

## What it answers

- How much do the coins move together right now, and is that high or low for the last year?
- When BTC has a sudden shock, do the other coins move more or less than BTC?
- Does any coin follow BTC with a delay?
- When BTC has a very bad (or very good) hour, how often does a coin have one too?

## Inputs

- `market`: the 1h candles of the coins in `marketCoins` (only coins with clean candles).
- `events`: BTC `price_shock` events (only `episode_first`, the first shock of an episode).

## Outputs

Dataset `derived/correlation` and the report `reports/correlation.md`.

`daily.csv` (one row per day, sampled at 00:00 UTC)
- `day`: date, YYYY-MM-DD.
- `t`: the sample time, unix seconds.
- `n_coins`: coins with a full 168 hour window that day.
- `avg_pair_corr`: mean of all pairwise correlations.
- `avg_corr_to_btc`: mean correlation of each other coin with BTC.
- `min_pair_corr`: the lowest pairwise correlation.
- `pctile_1y`: 0 to 100, where today's `avg_pair_corr` sits in the previous 365 days. Empty if fewer than 90 earlier days.

`matrix.json`
- `as_of`, `window_hours`, `coins`: the newest sample and its window.
- `corr`: correlation matrix, same order as `coins`.
- `beta_to_btc`: per coin, how many percent it moves for 1 percent in BTC.
- `vol_1h_pct`: per coin, typical size of one hourly move in percent.

`contagion.csv` (one row per direction, coin and window)
- `direction`: BTC shock direction, `down` or `up`.
- `coin`: the other coin.
- `window`: `shock_hour`, `next_1h`, `next_4h` or `next_24h`.
- `n`: shocks with prices for both coins.
- `btc_median_pct`, `coin_median_pct`: median move in percent for BTC and the coin.
- `ratio`: coin median divided by BTC median. Empty if the BTC median is within 0.05 of 0.
- `same_direction_share`: share of shocks where the coin moved the way of the shock.
- `n_before_2024`, `ratio_before_2024`: same for shocks before 2024-01-01 UTC.
- `n_from_2024`, `ratio_from_2024`: same for shocks from 2024-01-01 UTC.

`leadlag.csv`
- `coin`: the other coin.
- `lag_h`: k from -3 to 3. Above 0 means the coin follows BTC.
- `corr`: correlation of BTC at hour t with the coin at hour t+k, last 365 days.
- `n`: number of hour pairs used.

`tail.csv`
- `coin`: the other coin.
- `n_btc_tail_hours`: BTC hours in its worst 5%.
- `p_down_together`: chance the coin is in its own worst 5% in those hours.
- `p_up_together`: same for the best 5%.
- `baseline`: 0.05, the chance if the two were unrelated.
- `n_before_2024`, `p_down_before_2024`: the worst-5% numbers before 2024-01-01 UTC.
- `n_from_2024`, `p_down_from_2024`: the same from 2024-01-01 UTC.

## How to run

From the `intel` folder:

    node engines/correlation/index.js
    node --test test/correlation.test.js

Other code can call `run(opts)` (`opts.asOf` is optional, unix seconds) or `latest(asOf)`, which returns `{ coins, corr, cov, vol }` for the 168 hour window ending at `asOf`. `cov` is the covariance matrix and `vol` is the hourly standard deviation (as a fraction).

## Method in plain words

- Return = log of close divided by the previous close, per hour. All coins sit on one hourly time line.
- If a bar is missing, that hour is skipped for the pair.
- Every day at 00:00 UTC we take the last 168 closed hours and correlate every pair of coins. Only coins with all 168 hours are used.
- After a BTC shock we compare the coin move with the BTC move over the shock hour and the next 1, 4 and 24 hours. Windows that are not closed yet are not used.
- Lead-lag shifts the coin by -3 to +3 hours and checks if the correlation grows. A shift that wins clearly means a delay.
- Tail: we find BTC's worst 5% hours, then count how often the coin is also in its own worst 5%.
- Nothing uses data after the as-of time.

## Limits

- Correlation is not causation.
- Coins listed later have shorter history.
- Daily samples use overlapping windows, so neighbouring days are not independent.
- Shocks come in clusters. Many shocks are not many independent tests.
- Over 24 hours the BTC median is near zero, so the ratio there is often empty.
- Binance prices. The bots trade on MEXC.
