# Validation: bbcore

Coins SOL ZEC NEAR ADA GALA. 4h Binance candles, standard costs, real funding. Run 2026-11-16T05:03 UTC. Experiments logged before this one: 0.

## Verdict: PASSES

All checks passed. May be tried on a paper bot. Live use needs its own risk review.

1517 trades, +643.2R total, +0.424R per trade, win rate 37%, worst drop 28.6R, longest losing run 17.

| # | Type | Check | Result | Detail |
|---|---|---|---|---|
| 1 | hard | No look-ahead (truncation audit) | pass | 20 random cut-offs: 0 gave different earlier trades |
| 2 | hard | Enough trades and significant | pass | 1517 trades, t-stat 5.73 (needs >= 2.00 after 1 experiment(s) logged; and at least 150 trades) |
| 3 | hard | Positive on data from 2024 on | pass | before 2024: 790 trades, +0.530R each; from 2024: 727 trades, +0.309R each (58% of the earlier result) |
| 4 | hard | Survives 2x costs | pass | at 2x costs: +0.388R per trade (at 1x: +0.424R) |
| 5 | hard | Positive without its 10 best trades | pass | total 643.2R; without the 10 best trades 432.2R (the 10 best are 33% of the total) |
| 6 | hard | Not a copy of the live bots | skipped | skipped for a live bot itself |
| 8 | soft | Neighbouring settings (+-20%) mostly positive | pass | 12 of 12 neighbouring settings are positive overall and from 2024 |
| 9 | soft | Most years positive | pass | 7 of 7 years positive: 2020 +38, 2021 +178, 2022 +85, 2023 +115, 2024 +81, 2025 +56, 2026 +90 |
| 10 | soft | Leave-one-coin-out stays positive | pass | without SOL +524R, ZEC +547R, NEAR +526R, ADA +498R, GALA +479R |
| 11 | soft | No single regime holds most of the profit | pass | R by regime at the signal: ranging +248, quiet +255, trending_up +111, trending_down +8, volatile +22; the largest state holds 40% of the total |
| 12 | soft | Walk-forward parameter choice works | pass | years 2022, 2023, 2024, 2025, 2026: parameters picked on the past gave +448.5R in the next year, the unchanged default +427.1R |

## Limits

- A pass is not a promise. It means the idea survived these tests on past data.
- Soft checks use few samples for some strategies; read the detail column.
- The experiment count raises the bar for the t-statistic as more ideas are tried.
