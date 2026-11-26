# Risk and PHP 1,000 accounts: ICHI-X4, VOL-MOM-2H (+ BB-1H-WIDE reference), Nov 26 2026

Realised-balance model (see top of money.js). Costs per side: 0.05% fee + 0.02% slippage + real funding, already inside R. Min order: notional >= 5 USD (ETH 20, BTC 100), open notional <= 10x balance; otherwise the trade is skipped. PHP 60/USD. Sharpe/Sortino from monthly returns of the compounded account, annualised sqrt(12), risk-free 0. Open-trade swings are not in the drawdown.

## 1. Risk and quality (one PHP 1,000 account compounding Jan 2020 to Nov 2026)
| Set | Trades taken | Skipped (min order / leverage) | Win rate | Profit factor | Max peak-to-trough DD | Sharpe | Sortino | PHP 1,000 ends at |
|---|---|---|---|---|---|---|---|---|
| ICHI-X4 (4h), main 12 | 3020 of 3175 | 154 / 1 | 47% | 1.17 | -65% | 1.24 | 3.06 | PHP 167k |
| ICHI-X4 (4h), hold-out 12 | 3143 of 3171 | 28 / 0 | 48% | 1.17 | -71% | 1.15 | 2.56 | PHP 74k |
| ICHI-X4 (4h), all 24 | 6241 of 6346 | 102 / 3 | 47% | 1.12 | -72% | 1.31 | 3.33 | PHP 757k |
| VOL-MOM-2H, main 12 | 2587 of 2679 | 85 / 7 | 26% | 1.34 | -81% | 1.27 | 4.10 | PHP 2.1M |
| VOL-MOM-2H, hold-out 12 | 1548 of 2664 | 1099 / 17 | 24% | 0.99 | -99% | 0.37 | 0.78 | PHP 179 |
| VOL-MOM-2H, all 24 | 4819 of 5343 | 109 / 415 | 25% | 1.05 | -95% | 1.07 | 3.55 | PHP 72k |
| BB-1H-WIDE (ref), main 12 | 3045 of 3137 | 90 / 2 | 37% | 1.25 | -65% | 1.51 | 5.49 | PHP 39.2M |
| BB-1H-WIDE (ref), all 24 | 6166 of 6456 | 163 / 127 | 35% | 1.03 | -93% | 1.09 | 4.18 | PHP 431k |

## 2. R view without any account rules (unlimited size, no min order)
| Set | Trades | Win rate | Profit factor (R) | Total R | Max DD (R) | R per trade |
|---|---|---|---|---|---|---|
| ICHI-X4 (4h), main 12 | 3175 | 47% | 1.31 | 381 | 30 | 0.120 |
| ICHI-X4 (4h), hold-out 12 | 3171 | 47% | 1.25 | 311 | 42 | 0.098 |
| ICHI-X4 (4h), all 24 | 6346 | 47% | 1.28 | 691 | 67 | 0.109 |
| VOL-MOM-2H, main 12 | 2679 | 26% | 1.68 | 1321 | 94 | 0.493 |
| VOL-MOM-2H, hold-out 12 | 2664 | 25% | 1.29 | 572 | 99 | 0.215 |
| VOL-MOM-2H, all 24 | 5343 | 25% | 1.48 | 1893 | 192 | 0.354 |
| BB-1H-WIDE (ref), main 12 | 3137 | 36% | 1.59 | 1157 | 67 | 0.369 |
| BB-1H-WIDE (ref), all 24 | 6456 | 35% | 1.40 | 1650 | 145 | 0.256 |

## 3. PHP 1,000 compounding from Jan 2020 (balance at each year end)
| Set | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| ICHI-X4 (4h), main 12 | 1,956 | 3,376 | 11k | 12k | 53k | 112k | 167k |
| ICHI-X4 (4h), hold-out 12 | 2,817 | 4,079 | 8,164 | 9,917 | 22k | 39k | 74k |
| ICHI-X4 (4h), all 24 | 4,430 | 7,850 | 41k | 47k | 177k | 430k | 757k |
| VOL-MOM-2H, main 12 | 1,474 | 6,390 | 30k | 73k | 217k | 851k | 2.1M |
| VOL-MOM-2H, hold-out 12 | 1,140 | 1,683 | 815 | 316 | 218 | 259 | 179 |
| VOL-MOM-2H, all 24 | 972 | 9,860 | 35k | 16k | 42k | 70k | 72k |
| BB-1H-WIDE (ref), main 12 | 2,556 | 149k | 856k | 2.0M | 5.5M | 17.3M | 39.2M |
| BB-1H-WIDE (ref), all 24 | 1,439 | 111k | 270k | 154k | 453k | 453k | 431k |

## 4. Each year on its own: a fresh PHP 1,000 on Jan 1 (year result, worst realised fall inside that year)
| Set | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| ICHI-X4 (4h), main 12 | +128% (PHP 2,276, -37%) | +80% (PHP 1,801, -28%) | +251% (PHP 3,509, -32%) | +55% (PHP 1,554, -55%) | +246% (PHP 3,463, -26%) | +193% (PHP 2,932, -43%) | +90% (PHP 1,904, -54%) |
| ICHI-X4 (4h), hold-out 12 | +182% (PHP 2,817, -33%) | +123% (PHP 2,226, -34%) | +99% (PHP 1,987, -61%) | +23% (PHP 1,232, -49%) | +126% (PHP 2,261, -46%) | +74% (PHP 1,740, -47%) | +75% (PHP 1,747, -72%) |
| ICHI-X4 (4h), all 24 | +414% (PHP 5,145, -59%) | +140% (PHP 2,396, -50%) | +411% (PHP 5,112, -71%) | -37% (PHP 633, -81%) | +414% (PHP 5,135, -60%) | +174% (PHP 2,742, -64%) | +87% (PHP 1,867, -83%) |
| VOL-MOM-2H, main 12 | +107% (PHP 2,070, -77%) | +219% (PHP 3,191, -68%) | +172% (PHP 2,721, -58%) | -81% (PHP 190, -90%) | +66% (PHP 1,656, -86%) | +152% (PHP 2,521, -76%) | -49% (PHP 511, -91%) |
| VOL-MOM-2H, hold-out 12 | +62% (PHP 1,616, -76%) | +39% (PHP 1,394, -88%) | -63% (PHP 374, -82%) | -69% (PHP 310, -87%) | +122% (PHP 2,215, -85%) | -70% (PHP 303, -83%) | -61% (PHP 392, -81%) |
| VOL-MOM-2H, all 24 | +92% (PHP 1,918, -92%) | +296% (PHP 3,959, -87%) | -17% (PHP 835, -78%) | -82% (PHP 177, -91%) | -25% (PHP 754, -94%) | -76% (PHP 243, -83%) | -77% (PHP 226, -93%) |
| BB-1H-WIDE (ref), main 12 | +265% (PHP 3,650, -54%) | +2964% (PHP 31k, -45%) | +427% (PHP 5,267, -55%) | +32% (PHP 1,316, -76%) | +459% (PHP 5,593, -53%) | +442% (PHP 5,425, -46%) | +78% (PHP 1,782, -79%) |
| BB-1H-WIDE (ref), all 24 | +150% (PHP 2,503, -76%) | +2963% (PHP 31k, -72%) | -36% (PHP 636, -88%) | -80% (PHP 201, -92%) | +378% (PHP 4,777, -77%) | -38% (PHP 620, -72%) | -71% (PHP 292, -89%) |
