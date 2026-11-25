# News reaction study: raw results

Run 2026-11-25. Rules: PLAN.md. 743 release minutes, 946 normal days, 2020-09-01 to 2026-11-18. All trade results are % per trade after 0.14% costs and funding.
Check against the stored history: 743 15-minute BTC moves recomputed, 0 differ.

## 1. Speed (move at each time against the move at 6 h)

### BTC

Cell = median size against the 6 h move / share already on the 6 h side.

| Group | 1m | 5m | 15m | 1h | 3h |
|---|---|---|---|---|---|
| All releases (n=743) | 0.14 / 56% | 0.20 / 58% | 0.26 / 60% | 0.42 / 66% | 0.82 / 82% |
| FOMC (n=50) | 0.20 / 68% | 0.34 / 60% | 0.26 / 72% | 0.42 / 80% | 0.92 / 94% |
| CPI (n=76) | 0.32 / 59% | 0.34 / 62% | 0.38 / 62% | 0.61 / 68% | 0.97 / 82% |
| NFP (n=74) | 0.29 / 54% | 0.34 / 53% | 0.39 / 51% | 0.49 / 66% | 0.98 / 76% |
| Normal days (n=946) | 0.05 / 51% | 0.10 / 52% | 0.15 / 55% | 0.29 / 61% | 0.75 / 81% |

### ETH

Cell = median size against the 6 h move / share already on the 6 h side.

| Group | 1m | 5m | 15m | 1h | 3h |
|---|---|---|---|---|---|
| All releases (n=742) | 0.14 / 56% | 0.21 / 58% | 0.27 / 60% | 0.46 / 67% | 0.83 / 83% |
| FOMC (n=50) | 0.21 / 68% | 0.32 / 64% | 0.32 / 74% | 0.48 / 80% | 0.84 / 90% |
| CPI (n=76) | 0.30 / 67% | 0.35 / 71% | 0.47 / 67% | 0.58 / 80% | 0.84 / 84% |
| NFP (n=74) | 0.19 / 55% | 0.32 / 55% | 0.37 / 58% | 0.48 / 65% | 0.90 / 88% |
| Normal days (n=946) | 0.06 / 51% | 0.11 / 54% | 0.17 / 56% | 0.29 / 62% | 0.76 / 80% |

### SOL

Cell = median size against the 6 h move / share already on the 6 h side.

| Group | 1m | 5m | 15m | 1h | 3h |
|---|---|---|---|---|---|
| All releases (n=738) | 0.13 / 54% | 0.20 / 57% | 0.29 / 58% | 0.50 / 66% | 0.80 / 79% |
| FOMC (n=50) | 0.16 / 64% | 0.29 / 70% | 0.29 / 68% | 0.57 / 82% | 0.78 / 94% |
| CPI (n=75) | 0.33 / 64% | 0.39 / 67% | 0.51 / 67% | 0.61 / 83% | 0.97 / 80% |
| NFP (n=73) | 0.22 / 52% | 0.32 / 47% | 0.35 / 58% | 0.51 / 64% | 0.80 / 79% |
| Normal days (n=941) | 0.05 / 51% | 0.11 / 54% | 0.17 / 55% | 0.31 / 61% | 0.76 / 80% |

## 2 and 3. Trading rules (BTC; ETH and SOL beside)

| Rule | Trades | Win | Avg | to 2023 | 2024 on | 2x cost | No top 10 | t | Normal days | ETH | SOL | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 follow first 15m, exit 1h | 743 | 39% | -0.100 | -0.106 | -0.094 | -0.240 | -0.135 | -3.90 | -0.147 | -0.111 | -0.098 | fail: bothPeriods, costs2, ex10, otherCoins, t |
| R2 follow BIG first 15m, exit 1h | 294 | 46% | -0.034 | -0.028 | -0.041 | -0.174 | -0.119 | -0.66 | -0.158 | -0.062 | -0.027 | fail: bothPeriods, costs2, ex10, otherCoins, t |
| R1 fade first 15m, exit 1h | 743 | 38% | -0.180 | -0.174 | -0.186 | -0.320 | -0.214 | -7.05 | -0.133 | -0.169 | -0.182 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| R2 fade BIG first 15m, exit 1h | 294 | 38% | -0.246 | -0.252 | -0.239 | -0.386 | -0.332 | -4.76 | -0.122 | -0.218 | -0.253 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| R3 trade the surprise at 15m, exit 1h | 518 | 39% | -0.161 | -0.126 | -0.193 | -0.301 | -0.200 | -5.34 | -0.140 | -0.151 | -0.175 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| R1 follow first 15m, exit 3h | 743 | 47% | -0.078 | -0.158 | -0.000 | -0.218 | -0.135 | -1.49 | -0.233 | -0.115 | -0.191 | fail: bothPeriods, costs2, ex10, otherCoins, t |
| R2 follow BIG first 15m, exit 3h | 294 | 50% | -0.052 | -0.153 | +0.050 | -0.192 | -0.198 | -0.53 | -0.402 | -0.109 | -0.260 | fail: bothPeriods, costs2, ex10, otherCoins, t |
| R1 fade first 15m, exit 3h | 743 | 44% | -0.202 | -0.122 | -0.280 | -0.342 | -0.264 | -3.86 | -0.047 | -0.165 | -0.089 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| R2 fade BIG first 15m, exit 3h | 294 | 42% | -0.228 | -0.127 | -0.330 | -0.368 | -0.388 | -2.30 | +0.122 | -0.171 | -0.020 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| R3 trade the surprise at 15m, exit 3h | 518 | 43% | -0.250 | -0.228 | -0.270 | -0.390 | -0.325 | -4.16 | -0.138 | -0.270 | -0.336 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| R1 follow first 15m, exit 6h | 743 | 47% | -0.088 | -0.223 | +0.041 | -0.228 | -0.165 | -1.29 | -0.247 | -0.156 | -0.166 | fail: bothPeriods, costs2, ex10, otherCoins, t |
| R2 follow BIG first 15m, exit 6h | 294 | 48% | -0.077 | -0.229 | +0.077 | -0.217 | -0.271 | -0.62 | -0.437 | -0.225 | -0.210 | fail: bothPeriods, costs2, ex10, otherCoins, t |
| R1 fade first 15m, exit 6h | 743 | 44% | -0.192 | -0.057 | -0.321 | -0.332 | -0.270 | -2.79 | -0.033 | -0.124 | -0.114 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| R2 fade BIG first 15m, exit 6h | 294 | 45% | -0.203 | -0.051 | -0.357 | -0.343 | -0.396 | -1.63 | +0.157 | -0.055 | -0.070 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| R3 trade the surprise at 15m, exit 6h | 518 | 43% | -0.307 | -0.331 | -0.285 | -0.447 | -0.397 | -3.79 | -0.136 | -0.330 | -0.378 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| Drift all: enter 6h, exit 24h | 743 | 43% | -0.067 | +0.008 | -0.140 | -0.207 | -0.206 | -0.77 | -0.175 | +0.011 | +0.381 | fail: bothPeriods, costs2, ex10, otherCoins, t |
| Drift after UP moves (long): enter 6h, exit 24h | 363 | 43% | -0.076 | +0.082 | -0.211 | -0.216 | -0.310 | -0.60 | -0.003 | +0.063 | +0.633 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| Drift after DOWN moves (short): enter 6h, exit 24h | 380 | 42% | -0.059 | -0.055 | -0.063 | -0.199 | -0.277 | -0.48 | -0.338 | -0.040 | +0.133 | fail: bothPeriods, costs2, ex10, otherCoins, t |
| Drift all: enter 6h, exit 72h | 743 | 45% | -0.015 | +0.050 | -0.078 | -0.155 | -0.210 | -0.09 | +0.001 | +0.329 | +0.683 | fail: bothPeriods, costs2, ex10, otherCoins, beatsNormal, t |
| Drift after UP moves (long): enter 6h, exit 72h | 363 | 45% | -0.036 | -0.025 | -0.046 | -0.176 | -0.323 | -0.16 | +0.355 | +0.331 | +1.607 | fail: bothPeriods, costs2, ex10, beatsNormal, t |
| Drift after DOWN moves (short): enter 6h, exit 72h | 380 | 46% | +0.005 | +0.114 | -0.112 | -0.135 | -0.374 | 0.02 | -0.336 | +0.327 | -0.227 | fail: bothPeriods, costs2, ex10, otherCoins, t |

Passing the full pass mark: 0 of 21.

Average BTC result before costs (shows whether any edge exists before fees):

| Rule | Before costs % |
|---|---|
| R1 follow first 15m, exit 1h | +0.040 |
| R2 follow BIG first 15m, exit 1h | +0.106 |
| R1 fade first 15m, exit 1h | -0.040 |
| R2 fade BIG first 15m, exit 1h | -0.106 |
| R3 trade the surprise at 15m, exit 1h | -0.021 |
| R1 follow first 15m, exit 3h | +0.062 |
| R2 follow BIG first 15m, exit 3h | +0.088 |
| R1 fade first 15m, exit 3h | -0.062 |
| R2 fade BIG first 15m, exit 3h | -0.088 |
| R3 trade the surprise at 15m, exit 3h | -0.110 |
| R1 follow first 15m, exit 6h | +0.052 |
| R2 follow BIG first 15m, exit 6h | +0.063 |
| R1 fade first 15m, exit 6h | -0.052 |
| R2 fade BIG first 15m, exit 6h | -0.063 |
| R3 trade the surprise at 15m, exit 6h | -0.167 |
| Drift all: enter 6h, exit 24h | +0.073 |
| Drift after UP moves (long): enter 6h, exit 24h | +0.064 |
| Drift after DOWN moves (short): enter 6h, exit 24h | +0.081 |
| Drift all: enter 6h, exit 72h | +0.125 |
| Drift after UP moves (long): enter 6h, exit 72h | +0.104 |
| Drift after DOWN moves (short): enter 6h, exit 72h | +0.145 |

## Per family (exploratory, at least 15 trades in each period)

Cells tried: 96. Passing points 2 to 5: 0.

| Family | Rule | Trades | Avg | to 2023 | 2024 on | t | ETH | SOL | Result |
|---|---|---|---|---|---|---|---|---|---|
| NFP | R1 fade first 15m, exit 1h | 74 | -0.132 | -0.105 | -0.164 | -2.01 | -0.135 | -0.056 | fail |
| ISM services | R3 trade the surprise at 15m, exit 3h | 61 | -0.335 | -0.537 | -0.127 | -2.01 | -0.309 | -0.236 | fail |
| NFP | R1 follow first 15m, exit 6h | 74 | -0.468 | -0.763 | -0.120 | -2.01 | -0.393 | -0.300 | fail |
| ISM services | R3 trade the surprise at 15m, exit 1h | 61 | -0.172 | -0.092 | -0.255 | -2.05 | -0.106 | -0.118 | fail |
| Jobless claims | R1 fade first 15m, exit 6h | 91 | -0.372 | -0.288 | -0.402 | -2.08 | -0.237 | -0.271 | fail |
| NFP | R1 follow first 15m, exit 3h | 74 | -0.391 | -0.435 | -0.340 | -2.09 | -0.280 | -0.347 | fail |
| FOMC minutes | R1 fade first 15m, exit 6h | 48 | -0.437 | -0.452 | -0.422 | -2.09 | -0.255 | -0.930 | fail |
| Retail sales | R3 trade the surprise at 15m, exit 1h | 49 | -0.154 | -0.165 | -0.135 | -2.11 | -0.136 | -0.110 | fail |
| Retail sales | R1 follow first 15m, exit 6h | 59 | -0.497 | -0.782 | -0.050 | -2.19 | -0.752 | -1.086 | fail |
| Jobless claims | R1 fade first 15m, exit 3h | 91 | -0.281 | +0.032 | -0.393 | -2.22 | -0.214 | -0.225 | fail |
| Jobless claims | R1 follow first 15m, exit 1h | 91 | -0.095 | -0.047 | -0.113 | -2.23 | -0.092 | -0.098 | fail |
| NFP | R1 follow first 15m, exit 1h | 74 | -0.148 | -0.175 | -0.116 | -2.24 | -0.145 | -0.224 | fail |
| FOMC minutes | R1 fade first 15m, exit 3h | 48 | -0.344 | -0.244 | -0.444 | -2.27 | -0.168 | -0.535 | fail |
| PPI | R1 follow first 15m, exit 1h | 65 | -0.139 | -0.130 | -0.148 | -2.30 | -0.163 | -0.025 | fail |
| ISM manufacturing | R1 fade first 15m, exit 3h | 69 | -0.342 | -0.380 | -0.298 | -2.32 | -0.427 | -0.145 | fail |
| PPI | R1 fade first 15m, exit 1h | 65 | -0.141 | -0.150 | -0.132 | -2.33 | -0.117 | -0.255 | fail |
| Jobless claims | R3 trade the surprise at 15m, exit 6h | 87 | -0.432 | -0.258 | -0.498 | -2.33 | -0.638 | -0.790 | fail |
| GDP | R3 trade the surprise at 15m, exit 1h | 46 | -0.226 | -0.193 | -0.272 | -2.36 | -0.158 | -0.413 | fail |
| FOMC | R1 fade first 15m, exit 3h | 50 | -0.657 | -0.776 | -0.517 | -2.37 | -0.063 | -0.555 | fail |
| GDP | R1 follow first 15m, exit 1h | 51 | -0.224 | -0.316 | -0.112 | -2.49 | -0.241 | -0.209 | fail |
| ISM services | R1 fade first 15m, exit 3h | 62 | -0.408 | -0.468 | -0.348 | -2.51 | -0.512 | +0.183 | fail |
| FOMC | R1 fade first 15m, exit 6h | 50 | -0.946 | -1.085 | -0.783 | -2.59 | -0.456 | -0.872 | fail |
| PCE | R1 follow first 15m, exit 3h | 63 | -0.481 | -0.384 | -0.569 | -2.71 | -0.560 | -0.656 | fail |
| PCE | R1 follow first 15m, exit 6h | 63 | -0.627 | -0.789 | -0.479 | -2.87 | -0.548 | -1.011 | fail |
| ISM services | R1 fade first 15m, exit 6h | 62 | -0.709 | -0.598 | -0.820 | -2.88 | -0.512 | +0.109 | fail |
| Jobless claims | R3 trade the surprise at 15m, exit 3h | 87 | -0.379 | -0.337 | -0.395 | -2.91 | -0.558 | -0.609 | fail |
| ISM manufacturing | R3 trade the surprise at 15m, exit 1h | 69 | -0.296 | -0.149 | -0.466 | -3.14 | -0.338 | -0.376 | fail |
| ISM manufacturing | R1 fade first 15m, exit 1h | 69 | -0.297 | -0.250 | -0.350 | -3.15 | -0.313 | -0.262 | fail |
| Retail sales | R1 follow first 15m, exit 1h | 59 | -0.200 | -0.215 | -0.176 | -3.17 | -0.180 | -0.290 | fail |
| ISM services | R1 fade first 15m, exit 1h | 62 | -0.277 | -0.251 | -0.303 | -3.42 | -0.245 | -0.208 | fail |
| CPI | R1 fade first 15m, exit 1h | 76 | -0.269 | -0.394 | -0.114 | -3.58 | -0.400 | -0.415 | fail |
| PCE | R1 follow first 15m, exit 1h | 63 | -0.210 | -0.134 | -0.279 | -3.73 | -0.223 | -0.255 | fail |
| Jobless claims | R3 trade the surprise at 15m, exit 1h | 87 | -0.170 | -0.310 | -0.116 | -3.84 | -0.169 | -0.200 | fail |
| Jobless claims | R1 fade first 15m, exit 1h | 91 | -0.185 | -0.233 | -0.167 | -4.34 | -0.188 | -0.182 | fail |

(Only cells that pass or have |t| >= 2 are listed; all cells are in results.json.)

## 4. Surprise size against the BTC move

584 releases have a surprise score.

### All releases

Average BTC move % / share up.

| Surprise group | n | 15m | 1h | 6h | 24h |
|---|---|---|---|---|---|
| Big bad (<= -1) | 68 | -0.28 / 34% | -0.27 / 40% | -0.20 / 43% | -0.86 / 41% |
| Small bad | 206 | -0.08 / 41% | -0.06 / 48% | -0.07 / 50% | +0.02 / 49% |
| In line | 85 | +0.03 / 53% | +0.12 / 52% | -0.13 / 42% | -0.35 / 47% |
| Small good | 162 | +0.14 / 55% | +0.17 / 61% | -0.15 / 44% | -0.13 / 49% |
| Big good (>= 1) | 63 | +0.19 / 68% | +0.29 / 65% | -0.10 / 52% | +0.14 / 56% |

### Top tier (FOMC, CPI, NFP, PCE)

Average BTC move % / share up.

| Surprise group | n | 15m | 1h | 6h | 24h |
|---|---|---|---|---|---|
| Big bad (<= -1) | 16 | -0.94 / 13% | -0.99 / 19% | -0.80 / 38% | -1.44 / 38% |
| Small bad | 68 | -0.29 / 38% | -0.25 / 38% | -0.16 / 47% | -0.05 / 51% |
| In line | 73 | -0.02 / 49% | +0.03 / 48% | -0.22 / 40% | -0.43 / 47% |
| Small good | 43 | +0.57 / 79% | +0.76 / 77% | +0.12 / 42% | +0.39 / 49% |
| Big good (>= 1) | 21 | +0.59 / 86% | +0.58 / 67% | -0.09 / 48% | -0.19 / 62% |

### Rank correlation: better surprise with higher BTC price (positive = as expected)

`*` = unlikely to be chance on its own (rho x sqrt(n-1) >= 2).

| Group | 15m: to 2023 / 2024 on | 1h: to 2023 / 2024 on | 6h: to 2023 / 2024 on | 24h: to 2023 / 2024 on |
|---|---|---|---|---|
| All (n=584) | +0.30* / +0.19* | +0.28* / +0.13* | +0.05 / -0.02 | +0.07 / +0.05 |
| Top tier (n=221) | +0.48* / +0.53* | +0.43* / +0.39* | +0.04 / +0.07 | +0.14 / +0.04 |
| FOMC (n=33) | – / +0.19 | – / +0.26 | – / +0.29 | – / +0.35 |
| CPI (n=67) | +0.54* / +0.58* | +0.57* / +0.40* | +0.32 / +0.13 | +0.52* / +0.05 |
| NFP (n=66) | +0.44* / +0.54* | +0.41* / +0.47* | -0.03 / -0.14 | -0.07 / -0.18 |
| PCE (n=55) | +0.68* / +0.55* | +0.39 / +0.36* | -0.12 / +0.23 | -0.01 / +0.13 |
| PPI (n=57) | +0.11 / +0.34 | +0.28 / +0.34 | -0.22 / +0.18 | -0.08 / +0.27 |
| Retail sales (n=49) | -0.02 / +0.15 | -0.14 / +0.10 | -0.29 / +0.14 | -0.20 / -0.08 |
| Jobless claims (n=85) | +0.24 / +0.11 | -0.04 / +0.12 | -0.27 / -0.20 | -0.36 / +0.01 |
| ISM manufacturing (n=61) | +0.28 / -0.17 | +0.25 / -0.41* | +0.24 / -0.37* | +0.14 / +0.08 |
| ISM services (n=54) | -0.03 / +0.01 | +0.18 / +0.02 | +0.12 / +0.01 | +0.03 / +0.07 |
| JOLTS (n=30) | +0.70* / -0.32 | +0.62 / -0.15 | +0.68* / -0.03 | +0.32 / -0.08 |
