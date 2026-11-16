# Validation: tcore

Coins SOL ZEC NEAR ADA GALA. 4h Binance candles, standard costs, real funding. Run 2026-11-16T05:03 UTC. Experiments logged before this one: 0.

## Verdict: PASSES

All checks passed. May be tried on a paper bot. Live use needs its own risk review.

799 trades, +890.0R total, +1.114R per trade, win rate 37%, worst drop 26.4R, longest losing run 13.

| # | Type | Check | Result | Detail |
|---|---|---|---|---|
| 1 | hard | No look-ahead (truncation audit) | pass | 20 random cut-offs: 0 gave different earlier trades |
| 2 | hard | Enough trades and significant | pass | 799 trades, t-stat 2.96 (needs >= 2.00 after 1 experiment(s) logged; and at least 150 trades) |
| 3 | hard | Positive on data from 2024 on | pass | before 2024: 411 trades, +1.193R each; from 2024: 388 trades, +1.030R each (86% of the earlier result) |
| 4 | hard | Survives 2x costs | pass | at 2x costs: +1.085R per trade (at 1x: +1.114R) |
| 5 | hard | Positive without its 10 best trades | pass | total 890.0R; without the 10 best trades 190.1R (the 10 best are 79% of the total) |
| 6 | hard | Not a copy of the live bots | skipped | skipped for a live bot itself |
| 8 | soft | Neighbouring settings (+-20%) mostly positive | pass | 12 of 12 neighbouring settings are positive overall and from 2024 |
| 9 | soft | Most years positive | pass | 7 of 7 years positive: 2020 +26, 2021 +208, 2022 +9, 2023 +33, 2024 +291, 2025 +224, 2026 +100 |
| 10 | soft | Leave-one-coin-out stays positive | pass | without SOL +660R, ZEC +614R, NEAR +763R, ADA +747R, GALA +776R |
| 11 | soft | No single regime holds most of the profit | pass | R by regime at the signal: trending_down +2, ranging +285, trending_up +496, quiet +103, volatile +4; the largest state holds 56% of the total |
| 12 | soft | Walk-forward parameter choice works | pass | years 2022, 2023, 2024, 2025, 2026: parameters picked on the past gave +571.6R in the next year, the unchanged default +655.9R |

## Limits

- A pass is not a promise. It means the idea survived these tests on past data.
- Soft checks use few samples for some strategies; read the detail column.
- The experiment count raises the bar for the t-statistic as more ideas are tried.
