# Validation: bbFade

Coins SOL ZEC NEAR ADA GALA. 4h Binance candles, standard costs, real funding. Run 2026-11-16T05:04 UTC. Experiments logged before this one: 0.

## Verdict: REJECTED

Failed hard check(s): 2 Enough trades and significant; 3 Positive on data from 2024 on; 4 Survives 2x costs; 5 Positive without its 10 best trades. Record this in research/TESTED-STRATEGIES.md as rejected.

3771 trades, -406.8R total, -0.108R per trade, win rate 42%, worst drop 427.1R, longest losing run 29.

| # | Type | Check | Result | Detail |
|---|---|---|---|---|
| 1 | hard | No look-ahead (truncation audit) | pass | 20 random cut-offs: 0 gave different earlier trades |
| 2 | hard | Enough trades and significant | FAIL | 3771 trades, t-stat -6.42 (needs >= 2.00 after 1 experiment(s) logged; and at least 150 trades) |
| 3 | hard | Positive on data from 2024 on | FAIL | before 2024: 2016 trades, -0.136R each; from 2024: 1755 trades, -0.076R each (n/a) |
| 4 | hard | Survives 2x costs | FAIL | at 2x costs: -0.132R per trade (at 1x: -0.108R) |
| 5 | hard | Positive without its 10 best trades | FAIL | total -406.8R; without the 10 best trades -452.4R (the 10 best are n/a of the total) |
| 6 | hard | Not a copy of the live bots | pass | 28% of its trades start while a live-bot rule already holds the same coin and side; monthly correlation with TRI-CORE -0.25 (81 months). Fails at 70% overlap or 0.85 correlation |
| 8 | soft | Neighbouring settings (+-20%) mostly positive | FAIL | 0 of 4 neighbouring settings are positive overall and from 2024 |
| 9 | soft | Most years positive | FAIL | 0 of 7 years positive: 2020 -30, 2021 -54, 2022 -108, 2023 -81, 2024 -75, 2025 -32, 2026 -26 |
| 10 | soft | Leave-one-coin-out stays positive | FAIL | without SOL -333R, ZEC -344R, NEAR -358R, ADA -283R, GALA -309R |
| 11 | soft | No single regime holds most of the profit | pass | R by regime at the signal: quiet -53, ranging -145, trending_down -61, trending_up -144, volatile -4 |
| 12 | soft | Walk-forward parameter choice works | FAIL | years 2022, 2023, 2024, 2025, 2026: parameters picked on the past gave -253.0R in the next year, the unchanged default -322.2R |

## Limits

- A pass is not a promise. It means the idea survived these tests on past data.
- Soft checks use few samples for some strategies; read the detail column.
- The experiment count raises the bar for the t-statistic as more ideas are tried.
