# Risk and PHP 1,000 accounts: ICHI-X4, VOL-MOM-2H (+ BB-1H-WIDE reference), Nov 26 2026

RISK SCALED: per-trade risk x 6 / number of coins (same total risk as the 6 live coins: x0.5 for 12 coins, x0.25 for 24).

Realised-balance model (see top of money.js). Costs per side: 0.05% fee + 0.02% slippage + real funding, already inside R. Min order: notional >= 5 USD (ETH 20, BTC 100), open notional <= 10x balance; otherwise the trade is skipped. PHP 60/USD. Sharpe/Sortino from monthly returns of the compounded account, annualised sqrt(12), risk-free 0. Open-trade swings are not in the drawdown.

## 1. Risk and quality (one PHP 1,000 account compounding Jan 2020 to Nov 2026)
| Set | Trades taken | Skipped (min order / leverage) | Win rate | Profit factor | Max peak-to-trough DD | Sharpe | Sortino | PHP 1,000 ends at |
|---|---|---|---|---|---|---|---|---|
| ICHI-X4 (4h), main 12 | 2267 of 3175 | 908 / 0 | 47% | 1.20 | -36% | 1.27 | 2.97 | PHP 23k |
| ICHI-X4 (4h), hold-out 12 | 2593 of 3171 | 578 / 0 | 47% | 1.21 | -44% | 1.19 | 2.47 | PHP 16k |
| ICHI-X4 (4h), all 24 | 440 of 6346 | 5906 / 0 | 44% | 1.39 | -11% | 0.77 | 1.60 | PHP 1,725 |
| VOL-MOM-2H, main 12 | 2375 of 2679 | 304 / 0 | 26% | 1.49 | -71% | 1.19 | 4.10 | PHP 478k |
| VOL-MOM-2H, hold-out 12 | 2575 of 2664 | 89 / 0 | 25% | 1.05 | -85% | 0.62 | 1.61 | PHP 4,688 |
| VOL-MOM-2H, all 24 | 2837 of 5343 | 2506 / 0 | 25% | 1.24 | -58% | 0.81 | 2.76 | PHP 25k |
| BB-1H-WIDE (ref), main 12 | 2551 of 3137 | 585 / 1 | 36% | 1.34 | -42% | 1.40 | 4.20 | PHP 323k |
| BB-1H-WIDE (ref), all 24 | 2887 of 6456 | 3569 / 0 | 33% | 1.19 | -59% | 0.94 | 2.08 | PHP 15k |

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
| ICHI-X4 (4h), main 12 | 1,176 | 1,396 | 2,782 | 3,819 | 8,280 | 16k | 23k |
| ICHI-X4 (4h), hold-out 12 | 1,377 | 2,061 | 3,175 | 4,022 | 6,429 | 9,931 | 16k |
| ICHI-X4 (4h), all 24 | 1,000 | 1,000 | 1,014 | 1,282 | 1,393 | 1,501 | 1,725 |
| VOL-MOM-2H, main 12 | 1,352 | 3,468 | 11k | 25k | 81k | 205k | 478k |
| VOL-MOM-2H, hold-out 12 | 1,554 | 2,780 | 2,570 | 1,721 | 4,990 | 4,793 | 4,688 |
| VOL-MOM-2H, all 24 | 1,093 | 1,086 | 1,406 | 2,576 | 7,631 | 14k | 25k |
| BB-1H-WIDE (ref), main 12 | 1,163 | 3,589 | 16k | 37k | 79k | 165k | 323k |
| BB-1H-WIDE (ref), all 24 | 1,058 | 1,092 | 1,400 | 2,615 | 5,362 | 9,267 | 15k |

## 4. Each year on its own: a fresh PHP 1,000 on Jan 1 (year result, worst realised fall inside that year)
| Set | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| ICHI-X4 (4h), main 12 | +18% (PHP 1,176, -15%) | +2% (PHP 1,018, -3%) | +34% (PHP 1,337, -19%) | +20% (PHP 1,198, -29%) | +108% (PHP 2,081, -17%) | +64% (PHP 1,643, -20%) | +62% (PHP 1,619, -26%) |
| ICHI-X4 (4h), hold-out 12 | +38% (PHP 1,377, -13%) | +34% (PHP 1,338, -7%) | +10% (PHP 1,104, -30%) | +44% (PHP 1,436, -23%) | +49% (PHP 1,486, -17%) | -4% (PHP 963, -19%) | +68% (PHP 1,678, -33%) |
| ICHI-X4 (4h), all 24 | +0% (PHP 1,000, -0%) | +0% (PHP 1,000, -0%) | +1% (PHP 1,014, -0%) | +27% (PHP 1,270, -5%) | +8% (PHP 1,083, -3%) | +2% (PHP 1,021, -2%) | +10% (PHP 1,096, -4%) |
| VOL-MOM-2H, main 12 | +54% (PHP 1,537, -41%) | +63% (PHP 1,634, -17%) | +82% (PHP 1,823, -32%) | +189% (PHP 2,886, -47%) | +117% (PHP 2,168, -59%) | +173% (PHP 2,731, -33%) | +25% (PHP 1,246, -68%) |
| VOL-MOM-2H, hold-out 12 | +82% (PHP 1,818, -46%) | +71% (PHP 1,710, -62%) | -26% (PHP 737, -60%) | -23% (PHP 765, -63%) | +161% (PHP 2,614, -60%) | +11% (PHP 1,113, -61%) | -10% (PHP 899, -50%) |
| VOL-MOM-2H, all 24 | +9% (PHP 1,093, -9%) | +0% (PHP 1,000, -0%) | -3% (PHP 971, -6%) | +92% (PHP 1,917, -35%) | +166% (PHP 2,656, -16%) | +11% (PHP 1,111, -10%) | +24% (PHP 1,237, -20%) |
| BB-1H-WIDE (ref), main 12 | +16% (PHP 1,163, -31%) | -5% (PHP 953, -11%) | +122% (PHP 2,216, -25%) | +105% (PHP 2,049, -43%) | +124% (PHP 2,238, -35%) | +207% (PHP 3,066, -23%) | 0% (PHP 997, -45%) |
| BB-1H-WIDE (ref), all 24 | +6% (PHP 1,058, -4%) | +4% (PHP 1,045, -1%) | +29% (PHP 1,286, -9%) | +22% (PHP 1,215, -39%) | +17% (PHP 1,172, -8%) | -2% (PHP 977, -7%) | +15% (PHP 1,152, -11%) |
