# Execution engine

Read-only. It only describes. It never suggests a change to any bot.

## What it answers

- How good are the live entry fills (slippage and delay)?
- How far past the stop do stop exits fill?
- What do fees and funding cost per trade?
- How liquid is each coin, and is liquidity falling?
- How much size can each bot + coin take before it moves the market?

## Inputs

- Dataset `trades`: `trades.csv`, `exchange_closed.csv`, `wallets.csv`.
- Dataset `market`: Binance 1h candles. Volume is in coin units, so dollar volume of a bar = volume x close.
- Dataset `mexc` (`book_daily.csv`): optional. If it is missing, section F is skipped and a note says so.

## Outputs

Dataset `derived/execution` and the report `reports/execution.md`.

R means the risk of one trade (the distance from entry to first stop).
bp means basis point, 1/100 of one percent.

`entry_quality.csv` (live trades, per bot and per bot + coin; coin `ALL` = whole bot)
- `n`: number of entries.
- `median_slip_r`, `mean_slip_r`, `worst_slip_r`: entry slippage in R. Negative is worse than intended. Worst is the most negative.
- `median_delay_s`, `p90_delay_s`: seconds from signal to fill. P90 = 90 percent of fills were faster.
- `n_bp`: entries that have an intended price.
- `median_slip_bp`, `mean_slip_bp`: (entry - intended) / intended x 10000 x direction. Positive means paid more than intended.

`stop_quality.csv` (closed trades that ended on the stop, first stop unmoved)
- `n`: number of trades.
- `median_overshoot_r`, `p90_overshoot_r`, `worst_overshoot_r`: how much worse than the stop price the exit was, in R. Positive is worse.

`costs.csv` (exchange records, per bot)
- `n_closed`: closed trades.
- `fees_usd`, `funding_usd`, `realized_usd`: totals in USD. Negative means paid.
- `fees_share_of_gross`: |fees| divided by the sum of |realized|.
- `n_cost_r`: trades used for the R estimate (r_result not near 0).
- `avg_cost_r`: average of (fees + paid funding) / dollar value of 1R. Estimate.

`liquidity.csv` (per coin, Binance)
- `n_bars_30d`, `n_bars_180d`: hourly bars used.
- `median_usd_30d`, `median_usd_180d`: median dollar volume of one hour.
- `ratio_30d_180d`: 30 day median divided by 180 day median.
- `falling`: true when the ratio is below 0.6.
- `median_range_bp_30d`: median of (high / low - 1) per hour, in bp.

`capacity.csv` (per bot + coin, estimate from Binance volume)
- `n_trades`, `n_sized`: live trades, and trades with equity and risk known.
- `notional_usd`: typical position size = risk % x equity at entry x entry price / 1R distance.
- `median_hour_usd_30d`: median hourly dollar volume, 30 days.
- `participation`: notional / that hourly volume.
- `max_notional_1pct_usd`: 1% of that hourly volume (a common rough limit).
- `headroom_x`: max size / notional.

`book_capacity.csv` (only when the `mexc` dataset exists)
- `coin`, `size_usd`: order size tested.
- `n_days`: recorder days used (last 30).
- `roundtrip_bp`: median of buy bp + sell bp.
- `stop_bp`: median stop distance of live trades on that coin, in bp.
- `limit_bp`: 10% of `stop_bp`.
- `ok`: true when round trip slippage is below the limit.

## How to run

From the `intel` folder:

    node engines/execution/index.js
    node --test test/execution.test.js

## Method in plain words

Entry and stop numbers come straight from the recorded trades. Costs come from the exchange records. Equity at entry is the last wallet snapshot of that bot before the entry. Liquidity uses the last 30 and 180 days before the as-of time. Statistics are medians, so one odd trade does not move them much.

## Limits

- Samples are small. Read the `n` next to every number.
- Binance volume stands in for MEXC volume. The bots trade on MEXC.
- Cost in R is an estimate.
- The 1% of hourly volume limit is a rough rule, not a measured fact.
