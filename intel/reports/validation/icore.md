# Validation: icore

Coins SOL ZEC NEAR ADA GALA. 4h Binance candles, standard costs, real funding. Run 2026-11-16T05:03 UTC. Experiments logged before this one: 0.

## Verdict: PASSES

All checks passed. May be tried on a paper bot. Live use needs its own risk review.

813 trades, +788.1R total, +0.969R per trade, win rate 32%, worst drop 27.6R, longest losing run 17.

| # | Type | Check | Result | Detail |
|---|---|---|---|---|
| 1 | hard | No look-ahead (truncation audit) | pass | 20 random cut-offs: 0 gave different earlier trades |
| 2 | hard | Enough trades and significant | pass | 813 trades, t-stat 3.61 (needs >= 2.00 after 1 experiment(s) logged; and at least 150 trades) |
| 3 | hard | Positive on data from 2024 on | pass | before 2024: 428 trades, +1.031R each; from 2024: 385 trades, +0.901R each (87% of the earlier result) |
| 4 | hard | Survives 2x costs | pass | at 2x costs: +0.939R per trade (at 1x: +0.969R) |
| 5 | hard | Positive without its 10 best trades | pass | total 788.1R; without the 10 best trades 233.9R (the 10 best are 70% of the total) |
| 6 | hard | Not a copy of the live bots | skipped | skipped for a live bot itself |
| 8 | soft | Neighbouring settings (+-20%) mostly positive | pass | 16 of 16 neighbouring settings are positive overall and from 2024 |
| 9 | soft | Most years positive | pass | 7 of 7 years positive: 2020 +16, 2021 +202, 2022 +51, 2023 +134, 2024 +107, 2025 +167, 2026 +111 |
| 10 | soft | Leave-one-coin-out stays positive | pass | without SOL +655R, ZEC +555R, NEAR +710R, ADA +556R, GALA +677R |
| 11 | soft | No single regime holds most of the profit | pass | R by regime at the signal: trending_down +17, ranging +483, quiet +101, trending_up +176, volatile +11; the largest state holds 61% of the total |
| 12 | soft | Walk-forward parameter choice works | pass | years 2022, 2023, 2024, 2025, 2026: parameters picked on the past gave +584.9R in the next year, the unchanged default +570.0R |

## Limits

- A pass is not a promise. It means the idea survived these tests on past data.
- Soft checks use few samples for some strategies; read the detail column.
- The experiment count raises the bar for the t-statistic as more ideas are tried.
