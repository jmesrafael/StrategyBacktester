# Validation: rsi2

Coins SOL ZEC NEAR ADA GALA. 4h Binance candles, standard costs, real funding. Run 2026-11-16T05:04 UTC. Experiments logged before this one: 0.

## Verdict: REJECTED

Failed hard check(s): 2 Enough trades and significant; 3 Positive on data from 2024 on; 4 Survives 2x costs; 5 Positive without its 10 best trades; 6 Not a copy of the live bots. Record this in research/TESTED-STRATEGIES.md as rejected.

3074 trades, -2.3R total, -0.001R per trade, win rate 50%, worst drop 79.3R, longest losing run 24.

| # | Type | Check | Result | Detail |
|---|---|---|---|---|
| 1 | hard | No look-ahead (truncation audit) | pass | 20 random cut-offs: 0 gave different earlier trades |
| 2 | hard | Enough trades and significant | FAIL | 3074 trades, t-stat -0.05 (needs >= 2.00 after 1 experiment(s) logged; and at least 150 trades) |
| 3 | hard | Positive on data from 2024 on | FAIL | before 2024: 1609 trades, +0.023R each; from 2024: 1465 trades, -0.026R each (-117% of the earlier result) |
| 4 | hard | Survives 2x costs | FAIL | at 2x costs: -0.026R per trade (at 1x: -0.001R) |
| 5 | hard | Positive without its 10 best trades | FAIL | total -2.3R; without the 10 best trades -40.6R (the 10 best are n/a of the total) |
| 6 | hard | Not a copy of the live bots | FAIL | 88% of its trades start while a live-bot rule already holds the same coin and side; monthly correlation with TRI-CORE 0.04 (81 months). Fails at 70% overlap or 0.85 correlation |
| 8 | soft | Neighbouring settings (+-20%) mostly positive | FAIL | 0 of 8 neighbouring settings are positive overall and from 2024 |
| 9 | soft | Most years positive | FAIL | 3 of 7 years positive: 2020 +4, 2021 +7, 2022 +30, 2023 -5, 2024 -20, 2025 -6, 2026 -13 |
| 10 | soft | Leave-one-coin-out stays positive | FAIL | without SOL -22R, ZEC -11R, NEAR +4R, ADA +9R, GALA +12R |
| 11 | soft | No single regime holds most of the profit | pass | R by regime at the signal: quiet -39, volatile +37, trending_down -14, ranging +5, trending_up +9 |
| 12 | soft | Walk-forward parameter choice works | pass | years 2022, 2023, 2024, 2025, 2026: parameters picked on the past gave +7.4R in the next year, the unchanged default -13.3R |

## Limits

- A pass is not a promise. It means the idea survived these tests on past data.
- Soft checks use few samples for some strategies; read the detail column.
- The experiment count raises the bar for the t-statistic as more ideas are tried.
