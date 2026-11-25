# Round 2 (post-hoc): sizing ideas suggested by round 1

Chosen after seeing round 1, **including 2024-26**, so this is weaker evidence than a pre-registered test. Same trades as BB-CORE v3; only the risk per trade changes, rescaled to the same average risk.

## R1: double risk after a 6-month squeeze

| Version | Total R | Max DD | R/DD | R/DD IS / OOS | Sharpe IS / OOS | ex-top10 | 2x R/DD | WIDE R/DD IS / OOS | WIDE Sharpe IS / OOS | Rules 1245 |
|---|---|---|---|---|---|---|---|---|---|---|
| BB-CORE v3 | +707 | 27.2 | 26.0 | 15.5 / 10.5 | 2.02 / 1.74 | +496 | 21.2 | 3.6 / 2.6 | 0.95 / 0.96 |  |
| R1 | +755 | 31.6 | 23.8 | 15.5 / 9.2 | 2.05 / 1.66 | +492 | 20.0 | 5.1 / 3.1 | 1.05 / 1.08 | ...y |
| R1 N=500 | +753 | 29.1 | 25.8 | 16.0 / 10.5 | 2.10 / 1.68 | +499 | 21.8 | 5.1 / 3.1 | 1.03 / 1.09 | y.yy |
| R1 N=750 | +758 | 32.4 | 23.4 | 14.5 / 9.2 | 2.09 / 1.66 | +499 | 19.5 | 5.0 / 3.0 | 1.04 / 1.06 | ...y |
| R1 N=1500 | +758 | 30.9 | 24.5 | 15.6 / 9.4 | 2.07 / 1.63 | +493 | 19.8 | 5.0 / 2.9 | 1.06 / 1.02 | ...y |
| R1 K=10 | +737 | 31.0 | 23.8 | 15.0 / 9.3 | 2.06 / 1.64 | +484 | 20.0 | 5.0 / 2.8 | 1.08 / 0.99 | ...y |
| R1 K=40 | +787 | 32.0 | 24.6 | 16.2 / 9.6 | 2.10 / 1.68 | +529 | 20.8 | 5.1 / 3.1 | 1.09 / 1.06 | ...y |

Flagged trades: 66 of 1708 (LIVE), 1213 of 26664 (WIDE).
Random control (same number of trades flagged at random, 4000 draws): R/DD at least this good 60% of the time, Sharpe 55%.
Month-block bootstrap: Sharpe beats BB-CORE in 31% of resampled histories (50% = coin toss).

| Set | Group | Trades | Avg R | Win | Avg R without its best 1% | Median stop distance |
|---|---|---|---|---|---|---|
| LIVE | flagged | 66 | +1.154 | 32% | +0.944 | 3% |
| LIVE | rest | 1642 | +0.384 | 37% | +0.217 | 5% |
| WIDE | flagged | 1213 | +0.695 | 31% | +0.445 | 3% |
| WIDE | rest | 25451 | +0.100 | 31% | -0.046 | 5% |

WIDE coins where flagged trades average more R than the rest: 56 of 84 (coins with 5+ trades in each group).

| LIVE R by year | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB-CORE v3 | +38 | +178 | +85 | +122 | +95 | +64 | +126 |
| R1 | +37 | +185 | +106 | +135 | +94 | +60 | +138 |

| Leave one coin out (R/DD all) | SOL | ZEC | NEAR | ADA | GALA | ARB |
|---|---|---|---|---|---|---|
| BB-CORE v3 | 22.2 | 20.0 | 20.5 | 20.5 | 18.5 | 22.8 |
| R1 | 20.7 | 19.8 | 19.9 | 21.5 | 21.2 | 20.8 |

## R2: half-size when RSI(10) already past 70/30 (1.5 otherwise)

| Version | Total R | Max DD | R/DD | R/DD IS / OOS | Sharpe IS / OOS | ex-top10 | 2x R/DD | WIDE R/DD IS / OOS | WIDE Sharpe IS / OOS | Rules 1245 |
|---|---|---|---|---|---|---|---|---|---|---|
| BB-CORE v3 | +707 | 27.2 | 26.0 | 15.5 / 10.5 | 2.02 / 1.74 | +496 | 21.2 | 3.6 / 2.6 | 0.95 / 0.96 |  |
| R2 | +800 | 35.7 | 22.4 | 16.1 / 8.9 | 1.89 / 1.56 | +509 | 19.6 | 3.8 / 2.6 | 1.02 / 0.92 | ...y |
| R2 65/35 | +767 | 33.8 | 22.7 | 15.3 / 9.3 | 1.89 / 1.37 | +485 | 19.1 | 4.2 / 3.2 | 1.10 / 0.99 | ...y |
| R2 75/25 | +750 | 31.1 | 24.1 | 14.4 / 10.1 | 1.94 / 1.71 | +508 | 20.7 | 3.5 / 2.4 | 0.94 / 0.88 | .... |

Flagged trades: 712 of 1708 (LIVE), 10751 of 26664 (WIDE).
Random control (same number of trades flagged at random, 4000 draws): R/DD at least this good 30% of the time, Sharpe 62%.
Month-block bootstrap: Sharpe beats BB-CORE in 4% of resampled histories (50% = coin toss).

| Set | Group | Trades | Avg R | Win | Avg R without its best 1% | Median stop distance |
|---|---|---|---|---|---|---|
| LIVE | flagged | 712 | +0.274 | 42% | +0.153 | 8% |
| LIVE | rest | 996 | +0.514 | 33% | +0.307 | 4% |
| WIDE | flagged | 10751 | +0.087 | 38% | -0.016 | 7% |
| WIDE | rest | 15913 | +0.154 | 27% | -0.028 | 4% |

WIDE coins where flagged trades average more R than the rest: 40 of 84 (coins with 5+ trades in each group).

| LIVE R by year | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB-CORE v3 | +38 | +178 | +85 | +122 | +95 | +64 | +126 |
| R2 | +54 | +200 | +109 | +120 | +116 | +69 | +132 |

| Leave one coin out (R/DD all) | SOL | ZEC | NEAR | ADA | GALA | ARB |
|---|---|---|---|---|---|---|
| BB-CORE v3 | 22.2 | 20.0 | 20.5 | 20.5 | 18.5 | 22.8 |
| R2 | 20.6 | 21.5 | 20.5 | 18.9 | 15.6 | 22.5 |

## R3: half-size when MFI(10) already past 80/20 (1.5 otherwise)

| Version | Total R | Max DD | R/DD | R/DD IS / OOS | Sharpe IS / OOS | ex-top10 | 2x R/DD | WIDE R/DD IS / OOS | WIDE Sharpe IS / OOS | Rules 1245 |
|---|---|---|---|---|---|---|---|---|---|---|
| BB-CORE v3 | +707 | 27.2 | 26.0 | 15.5 / 10.5 | 2.02 / 1.74 | +496 | 21.2 | 3.6 / 2.6 | 0.95 / 0.96 |  |
| R3 | +710 | 32.2 | 22.1 | 13.5 / 9.1 | 2.00 / 1.64 | +482 | 18.7 | 3.9 / 2.9 | 1.02 / 1.00 | ...y |
| R3 75/25 | +714 | 31.7 | 22.5 | 13.5 / 9.1 | 1.82 / 1.62 | +463 | 18.9 | 4.0 / 2.9 | 1.02 / 1.01 | ...y |
| R3 70/30 | +747 | 38.2 | 19.6 | 13.6 / 8.0 | 1.74 / 1.66 | +463 | 16.8 | 4.3 / 3.2 | 1.03 / 1.12 | ...y |

Flagged trades: 388 of 1708 (LIVE), 6008 of 26664 (WIDE).
Random control (same number of trades flagged at random, 4000 draws): R/DD at least this good 50% of the time, Sharpe 45%.
Month-block bootstrap: Sharpe beats BB-CORE in 22% of resampled histories (50% = coin toss).

| Set | Group | Trades | Avg R | Win | Avg R without its best 1% | Median stop distance |
|---|---|---|---|---|---|---|
| LIVE | flagged | 388 | +0.405 | 43% | +0.239 | 7% |
| LIVE | rest | 1320 | +0.417 | 35% | +0.237 | 5% |
| WIDE | flagged | 6008 | +0.039 | 36% | -0.071 | 7% |
| WIDE | rest | 20656 | +0.153 | 30% | -0.014 | 5% |

WIDE coins where flagged trades average more R than the rest: 27 of 84 (coins with 5+ trades in each group).

| LIVE R by year | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB-CORE v3 | +38 | +178 | +85 | +122 | +95 | +64 | +126 |
| R3 | +37 | +179 | +109 | +108 | +98 | +59 | +120 |

| Leave one coin out (R/DD all) | SOL | ZEC | NEAR | ADA | GALA | ARB |
|---|---|---|---|---|---|---|
| BB-CORE v3 | 22.2 | 20.0 | 20.5 | 20.5 | 18.5 | 22.8 |
| R3 | 21.9 | 21.7 | 21.8 | 19.1 | 13.4 | 21.0 |

