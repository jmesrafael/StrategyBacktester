# Correlation, contagion and lead-lag

As of 2026-11-16 05:00 UTC. Coins: BTC, ETH, SOL, ZEC, NEAR, ADA, GALA, SUI, ARB, BNB, XRP, DOGE, AVAX, LINK, DOT. Window: 168 hours (7 days) of 1h returns.

## Now

- Average pair correlation on 2026-11-16: **0.78** (15 coins).
- Average correlation with BTC: 0.78. Lowest pair: 0.52.
- Percentile in the last year: 73 (0 = most spread out, 100 = most tied together).

## Each coin against BTC (latest sample)

Sample: 2026-11-16 00:00 UTC. Beta = how many percent the coin moves for 1 percent in BTC. Volatility = typical size of one hourly move.

| Coin | Corr to BTC | Beta to BTC | Hourly vol % |
|---|---|---|---|
| ETH | 0.93 | 1.22 | 0.779 |
| SOL | 0.89 | 1.26 | 0.843 |
| ZEC | 0.64 | 1.72 | 1.592 |
| NEAR | 0.69 | 1.52 | 1.301 |
| ADA | 0.83 | 1.18 | 0.843 |
| GALA | 0.75 | 1.06 | 0.840 |
| SUI | 0.81 | 1.30 | 0.947 |
| ARB | 0.58 | 1.10 | 1.134 |
| BNB | 0.90 | 0.94 | 0.619 |
| XRP | 0.77 | 1.08 | 0.831 |
| DOGE | 0.87 | 1.21 | 0.824 |
| AVAX | 0.68 | 1.25 | 1.086 |
| LINK | 0.84 | 1.19 | 0.843 |
| DOT | 0.74 | 1.10 | 0.882 |

## What the coins do after a BTC shock (542 first-of-episode shocks)

Ratio = coin median move / BTC median move. Above 1 means the coin moves more than BTC. Same direction = share of shocks where the coin moved the same way. Bot coins are marked with *.

### BTC shock down

| Coin | Window | n | BTC median % | Coin median % | Ratio | Same direction | Ratio before 2024 (n) | Ratio from 2024 (n) |
|---|---|---|---|---|---|---|---|---|
| ETH | shock_hour | 271 | -2.03 | -2.28 | 1.12 | 98.9% | 1.11 (153) | 1.17 (118) |
| ETH | next_24h | 271 | 0.02 | 0.20 | - | 47.6% | 1.44 (153) | -0.30 (118) |
| SOL* | shock_hour | 247 | -1.98 | -2.58 | 1.30 | 99.2% | 1.30 (129) | 1.31 (118) |
| SOL* | next_24h | 247 | 0.02 | -0.17 | - | 54.3% | -0.11 (129) | 1.05 (118) |
| ZEC* | shock_hour | 268 | -2.02 | -2.32 | 1.15 | 97.4% | 1.22 (150) | 1.14 (118) |
| ZEC* | next_24h | 268 | 0.02 | -0.06 | - | 50.7% | 1.09 (150) | 1.07 (118) |
| NEAR* | shock_hour | 243 | -2.02 | -2.75 | 1.36 | 96.7% | 1.39 (125) | 1.44 (118) |
| NEAR* | next_24h | 243 | -0.00 | -0.09 | - | 50.2% | 0.89 (125) | 1.10 (118) |
| ADA* | shock_hour | 268 | -2.02 | -2.57 | 1.27 | 98.5% | 1.20 (150) | 1.36 (118) |
| ADA* | next_24h | 268 | 0.02 | 0.32 | - | 45.9% | 2.63 (150) | -0.26 (118) |
| GALA* | shock_hour | 211 | -1.91 | -2.88 | 1.51 | 98.6% | 1.43 (93) | 1.51 (118) |
| GALA* | next_24h | 211 | -0.10 | -0.07 | 0.70 | 50.2% | 2.78 (93) | 1.24 (118) |
| SUI | shock_hour | 147 | -1.78 | -2.57 | 1.44 | 96.6% | 1.49 (29) | 1.44 (118) |
| SUI | next_24h | 147 | -0.10 | -0.05 | 0.51 | 51.0% | 1.15 (29) | 0.87 (118) |
| ARB | shock_hour | 150 | -1.79 | -2.67 | 1.49 | 98.0% | 1.34 (32) | 1.51 (118) |
| ARB | next_24h | 150 | -0.06 | -0.10 | 1.58 | 50.0% | 2.01 (32) | 1.02 (118) |
| BNB | shock_hour | 267 | -2.02 | -1.84 | 0.92 | 98.9% | 0.96 (149) | 0.82 (118) |
| BNB | next_24h | 267 | 0.02 | 0.43 | - | 44.2% | 2.56 (149) | -0.08 (118) |
| XRP | shock_hour | 268 | -2.02 | -2.21 | 1.09 | 98.1% | 1.09 (150) | 1.14 (118) |
| XRP | next_24h | 268 | 0.02 | 0.08 | - | 48.9% | 1.57 (150) | 0.61 (118) |
| DOGE | shock_hour | 253 | -1.98 | -2.44 | 1.23 | 98.0% | 1.09 (135) | 1.35 (118) |
| DOGE | next_24h | 253 | 0.02 | 0.42 | - | 45.5% | 3.16 (135) | 0.90 (118) |
| AVAX | shock_hour | 246 | -2.00 | -2.75 | 1.38 | 99.2% | 1.30 (128) | 1.44 (118) |
| AVAX | next_24h | 246 | 0.02 | -0.01 | - | 50.0% | 2.08 (128) | 0.71 (118) |
| LINK | shock_hour | 268 | -2.02 | -2.68 | 1.33 | 98.5% | 1.28 (150) | 1.36 (118) |
| LINK | next_24h | 268 | 0.02 | 0.37 | - | 46.6% | 2.96 (150) | 0.10 (118) |
| DOT | shock_hour | 250 | -2.00 | -2.59 | 1.30 | 98.4% | 1.29 (132) | 1.28 (118) |
| DOT | next_24h | 250 | 0.02 | 0.40 | - | 46.0% | 2.61 (132) | -0.03 (118) |

### BTC shock up

| Coin | Window | n | BTC median % | Coin median % | Ratio | Same direction | Ratio before 2024 (n) | Ratio from 2024 (n) |
|---|---|---|---|---|---|---|---|---|
| ETH | shock_hour | 260 | 2.06 | 1.95 | 0.95 | 97.3% | 0.86 (153) | 1.02 (107) |
| ETH | next_24h | 260 | 0.51 | 0.41 | 0.80 | 56.2% | 0.59 (153) | 0.87 (107) |
| SOL* | shock_hour | 229 | 2.06 | 2.13 | 1.03 | 93.0% | 0.89 (122) | 1.18 (107) |
| SOL* | next_24h | 229 | 0.55 | 0.53 | 0.96 | 53.7% | -0.08 (122) | 1.15 (107) |
| ZEC* | shock_hour | 252 | 2.07 | 1.70 | 0.82 | 92.1% | 0.68 (145) | 1.04 (107) |
| ZEC* | next_24h | 252 | 0.48 | 0.67 | 1.41 | 54.8% | 1.55 (145) | 1.03 (107) |
| NEAR* | shock_hour | 226 | 2.07 | 2.27 | 1.10 | 92.0% | 0.84 (119) | 1.36 (107) |
| NEAR* | next_24h | 226 | 0.57 | -0.05 | -0.09 | 49.6% | 1.21 (119) | -1.20 (107) |
| ADA* | shock_hour | 252 | 2.07 | 2.06 | 0.99 | 96.8% | 0.79 (145) | 1.20 (107) |
| ADA* | next_24h | 252 | 0.48 | -0.14 | -0.30 | 48.8% | -0.86 (145) | 0.00 (107) |
| GALA* | shock_hour | 191 | 2.00 | 2.33 | 1.17 | 95.3% | 0.82 (84) | 1.38 (107) |
| GALA* | next_24h | 191 | 0.50 | 0.21 | 0.42 | 50.3% | 0.11 (84) | 0.42 (107) |
| SUI | shock_hour | 127 | 1.79 | 2.37 | 1.32 | 93.7% | 0.99 (20) | 1.40 (107) |
| SUI | next_24h | 127 | 0.45 | -0.66 | -1.46 | 43.3% | -3.30 (20) | -0.63 (107) |
| ARB | shock_hour | 131 | 1.79 | 2.21 | 1.23 | 96.2% | 1.04 (24) | 1.27 (107) |
| ARB | next_24h | 131 | 0.45 | -0.32 | -0.72 | 45.8% | -3.82 (24) | -0.05 (107) |
| BNB | shock_hour | 252 | 2.07 | 1.30 | 0.63 | 95.6% | 0.61 (145) | 0.67 (107) |
| BNB | next_24h | 252 | 0.48 | 0.01 | 0.02 | 50.0% | -0.27 (145) | 0.34 (107) |
| XRP | shock_hour | 257 | 2.06 | 1.46 | 0.71 | 96.5% | 0.60 (150) | 0.89 (107) |
| XRP | next_24h | 257 | 0.45 | 0.03 | 0.07 | 50.2% | -0.18 (150) | 0.22 (107) |
| DOGE | shock_hour | 235 | 2.06 | 1.85 | 0.90 | 94.0% | 0.64 (128) | 1.30 (107) |
| DOGE | next_24h | 235 | 0.55 | 0.29 | 0.53 | 54.0% | 0.34 (128) | 0.70 (107) |
| AVAX | shock_hour | 229 | 2.06 | 2.12 | 1.03 | 93.9% | 0.80 (122) | 1.19 (107) |
| AVAX | next_24h | 229 | 0.55 | 0.40 | 0.73 | 53.7% | 0.66 (122) | 0.80 (107) |
| LINK | shock_hour | 256 | 2.06 | 2.07 | 1.00 | 95.3% | 0.85 (149) | 1.16 (107) |
| LINK | next_24h | 256 | 0.45 | -0.07 | -0.16 | 49.6% | -1.27 (149) | 0.95 (107) |
| DOT | shock_hour | 230 | 2.07 | 1.95 | 0.94 | 97.0% | 0.84 (123) | 1.03 (107) |
| DOT | next_24h | 230 | 0.55 | 0.28 | 0.50 | 52.6% | 1.22 (123) | 0.11 (107) |

## Lead-lag (last 365 days)

Correlation of BTC at hour t with the coin at hour t+k. k above 0 means the coin follows BTC.

| Coin | Corr at same hour (k=0) | Best other lag k | Corr at that lag |
|---|---|---|---|
| ETH | 0.892 | 1 | 0.025 |
| SOL | 0.843 | 1 | 0.015 |
| ZEC | 0.504 | -3 | 0.019 |
| NEAR | 0.582 | -2 | 0.017 |
| ADA | 0.756 | -3 | 0.009 |
| GALA | 0.665 | 1 | 0.004 |
| SUI | 0.744 | -2 | 0.008 |
| ARB | 0.622 | -2 | 0.011 |
| BNB | 0.820 | 3 | 0.010 |
| XRP | 0.781 | 1 | 0.016 |
| DOGE | 0.785 | -2 | 0.012 |
| AVAX | 0.737 | 1 | 0.012 |
| LINK | 0.814 | 1 | 0.008 |
| DOT | 0.677 | 3 | 0.005 |

Best lag: no lag other than 0 has a correlation above 0.1. The coins move in the same hour and there is no usable delay.

## Tail co-movement (whole history)

When BTC has one of its worst 5% hours, how often does the coin also have one of its own worst 5% hours? If they were unrelated this would be 5%.

| Coin | BTC worst hours | Worst together | Best together | Baseline | Worst together before 2024 (n) | Worst together from 2024 (n) |
|---|---|---|---|---|---|---|
| ETH | 3056 | 65.7% | 57.7% | 5.0% | 65.9% (2161) | 65.1% (895) |
| SOL | 2705 | 52.2% | 41.0% | 5.0% | 53.4% (1810) | 49.6% (895) |
| ZEC | 2971 | 45.1% | 32.1% | 5.0% | 46.8% (2087) | 41.3% (884) |
| NEAR | 2668 | 47.8% | 34.3% | 5.0% | 49.2% (1784) | 45.0% (884) |
| ADA | 2977 | 55.0% | 41.4% | 5.0% | 53.3% (2091) | 58.9% (886) |
| GALA | 2263 | 48.3% | 37.2% | 5.0% | 49.3% (1141) | 47.3% (1122) |
| SUI | 1551 | 45.7% | 36.6% | 5.0% | 48.0% (173) | 45.4% (1378) |
| ARB | 1601 | 48.5% | 39.5% | 5.0% | 47.0% (219) | 48.7% (1382) |
| BNB | 2965 | 56.6% | 45.1% | 5.0% | 60.5% (2082) | 47.6% (883) |
| XRP | 3007 | 53.3% | 38.2% | 5.0% | 53.6% (2119) | 52.7% (888) |
| DOGE | 2784 | 49.8% | 36.7% | 5.0% | 46.2% (1878) | 57.2% (906) |
| AVAX | 2694 | 51.0% | 39.4% | 5.0% | 53.4% (1803) | 46.1% (891) |
| LINK | 2994 | 55.4% | 42.9% | 5.0% | 56.3% (2106) | 53.4% (888) |
| DOT | 2733 | 53.8% | 41.5% | 5.0% | 55.3% (1837) | 50.7% (896) |

## Limits

- Correlation is not causation. It says the coins moved together, not that BTC made them move.
- Coins listed later have shorter history. First candle: BTC 2019-09-08, ETH 2019-11-27, SOL 2020-09-14, ZEC 2020-02-05, NEAR 2020-10-15, ADA 2020-01-31, GALA 2021-09-18, SUI 2023-05-03, ARB 2023-03-23, BNB 2020-02-10, XRP 2020-01-06, DOGE 2020-07-10, AVAX 2020-09-23, LINK 2020-01-17, DOT 2020-08-22.
- Daily samples use overlapping 7-day windows. Neighbouring days share 6 of 7 days of data, so they are not independent.
- Over 24 hours the BTC median move is close to zero, so the ratio is often empty or meaningless there. Read the same-direction share instead.
- Shocks cluster in a few stormy periods. Many shocks are not many independent tests.
- Prices are Binance perpetual candles. The bots trade on MEXC.
