# Results: replace the live bots? (candles to 2026-11-24)

Study engine against the project engine: 8140 trades, 0 different.

## 1. History, complete stats (2020 to Nov 24 2026, R)

Bots first, then the account (weighted 50 / 25 / 25; compare accounts only with accounts).

| Version | Trades | Total R | Drop closed | Drop open | R / drop open | Longest under water (days) | Longest losing run | Losing months | Worst month | Win | Avg R | Profit factor | Without best 10 | Longs / shorts |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BB-CORE live | 1708 | +707 | 27.2 | 45.4 | 15.6 | 159 | 14 | 25/81 | -16.8 | 37% | +0.41 | 1.67 | +496 | +390 / +317 |
| BB tweak 1.00x | 1623 | +677 | 25.3 | 31.4 | 21.6 | 179 | 16 | 28/81 | -15.2 | 38% | +0.42 | 1.78 | +468 | +379 / +299 |
| BB tweak 1.05x | 1623 | +711 | 26.5 | 32.9 | 21.6 | 179 | 16 | 28/81 | -15.9 | 38% | +0.44 | 1.78 | +491 | +398 / +314 |
| I-CORE live | 816 | +806 | 27.6 | 89.4 | 9.0 | 326 | 17 | 33/81 | -13.8 | 32% | +0.99 | 2.49 | +252 | +673 / +133 |
| T-CORE live (trail 14) | 1150 | +1105 | 30.9 | 148.2 | 7.5 | 414 | 15 | 36/81 | -11.1 | 37% | +0.96 | 2.57 | +391 | +1017 / +88 |
| T-CORE trail 12 | 1220 | +1198 | 28.5 | 157.4 | 7.6 | 320 | 15 | 36/81 | -12.4 | 37% | +0.98 | 2.60 | +459 | +1083 / +114 |
| Account ORIG | 3674 | +832 | 21.9 | 65.7 | 12.7 | 200 | 31 | 21/81 | -9.9 | 36% | +0.23 | 1.99 | +597 | +618 / +214 |
| Account NEW | 3659 | +857 | 21.0 | 66.1 | 13.0 | 208 | 32 | 19/81 | -8.2 | 36% | +0.23 | 2.10 | +618 | +638 / +219 |
| Account NEW-BB | 3589 | +833 | 20.5 | 63.8 | 13.1 | 221 | 31 | 20/81 | -8.0 | 36% | +0.23 | 2.09 | +597 | +622 / +212 |
| Account NEW-T | 3744 | +855 | 22.4 | 68.0 | 12.6 | 193 | 31 | 20/81 | -9.6 | 36% | +0.23 | 2.00 | +618 | +634 / +221 |
| Account SAFE | 3589 | +816 | 20.0 | 63.4 | 12.9 | 221 | 31 | 20/81 | -7.9 | 36% | +0.23 | 2.10 | +582 | +612 / +204 |
| Account ORIG-LOW | 3674 | +707 | 18.6 | 55.8 | 12.7 | 200 | 31 | 21/81 | -8.4 | 36% | +0.19 | 1.99 | +507 | +525 / +182 |

| Version | 2024-26 R | 2024-26 drop closed | 2024-26 drop open | Double costs R | Double costs drop open | Green years |
|---|---|---|---|---|---|---|
| BB-CORE live | +285 | 27.0 | 34.9 | +647 | 46.1 | 7/7 |
| BB tweak 1.00x | +291 | 25.3 | 31.4 | +626 | 32.5 | 7/7 |
| BB tweak 1.05x | +305 | 26.5 | 32.9 | +658 | 34.1 | 7/7 |
| I-CORE live | +383 | 27.6 | 89.4 | +783 | 91.3 | 7/7 |
| T-CORE live (trail 14) | +754 | 20.9 | 148.2 | +1073 | 149.1 | 7/7 |
| T-CORE trail 12 | +811 | 20.8 | 157.4 | +1164 | 158.4 | 7/7 |
| Account ORIG | +427 | 18.5 | 65.7 | +788 | 66.8 | 7/7 |
| Account NEW | +451 | 19.1 | 66.1 | +816 | 67.2 | 7/7 |
| Account NEW-BB | +437 | 18.5 | 63.8 | +793 | 64.8 | 7/7 |
| Account NEW-T | +441 | 19.0 | 68.0 | +810 | 69.2 | 7/7 |
| Account SAFE | +430 | 17.9 | 63.4 | +777 | 64.4 | 7/7 |
| Account ORIG-LOW | +363 | 15.7 | 55.8 | +669 | 56.8 | 7/7 |

### Total R per year

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB-CORE live | +38 | +178 | +85 | +122 | +95 | +64 | +126 |
| BB tweak 1.00x | +23 | +181 | +74 | +108 | +80 | +85 | +125 |
| BB tweak 1.05x | +24 | +190 | +77 | +114 | +84 | +89 | +132 |
| I-CORE live | +16 | +202 | +51 | +153 | +87 | +167 | +129 |
| T-CORE live (trail 14) | +54 | +256 | +16 | +25 | +352 | +259 | +143 |
| T-CORE trail 12 | +65 | +266 | +29 | +26 | +403 | +262 | +146 |
| Account ORIG | +37 | +204 | +59 | +105 | +157 | +138 | +131 |
| Account NEW | +32 | +212 | +59 | +102 | +165 | +152 | +135 |
| Account NEW-BB | +30 | +210 | +56 | +101 | +152 | +151 | +134 |
| Account NEW-T | +39 | +206 | +63 | +106 | +170 | +139 | +132 |
| Account SAFE | +29 | +205 | +54 | +99 | +150 | +149 | +131 |
| Account ORIG-LOW | +31 | +173 | +51 | +89 | +134 | +118 | +111 |

### Drop open per year (R)

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB-CORE live | 24 | 18 | 31 | 45 | 35 | 35 | 30 |
| BB tweak 1.00x | 26 | 17 | 21 | 24 | 26 | 24 | 25 |
| BB tweak 1.05x | 27 | 17 | 22 | 25 | 27 | 25 | 27 |
| I-CORE live | 27 | 43 | 27 | 32 | 35 | 80 | 43 |
| T-CORE live (trail 14) | 60 | 79 | 36 | 70 | 107 | 137 | 96 |
| T-CORE trail 12 | 52 | 75 | 37 | 65 | 103 | 146 | 84 |
| Account ORIG | 24 | 30 | 25 | 39 | 38 | 58 | 48 |
| Account NEW | 25 | 31 | 22 | 31 | 36 | 59 | 43 |
| Account NEW-BB | 25 | 30 | 22 | 31 | 38 | 56 | 46 |
| Account NEW-T | 24 | 31 | 25 | 38 | 36 | 61 | 45 |
| Account SAFE | 25 | 30 | 21 | 31 | 38 | 56 | 46 |
| Account ORIG-LOW | 20 | 25 | 21 | 33 | 33 | 49 | 41 |

### Drop closed per year (R)

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB-CORE live | 10 | 14 | 27 | 27 | 27 | 24 | 26 |
| BB tweak 1.00x | 9 | 12 | 18 | 21 | 21 | 16 | 25 |
| BB tweak 1.05x | 10 | 12 | 19 | 22 | 22 | 16 | 27 |
| I-CORE live | 13 | 19 | 16 | 21 | 20 | 14 | 28 |
| T-CORE live (trail 14) | 27 | 16 | 28 | 31 | 21 | 17 | 16 |
| T-CORE trail 12 | 26 | 17 | 19 | 29 | 21 | 16 | 19 |
| Account ORIG | 11 | 10 | 15 | 22 | 18 | 11 | 18 |
| Account NEW | 12 | 10 | 13 | 21 | 15 | 10 | 19 |
| Account NEW-BB | 12 | 9 | 13 | 20 | 16 | 10 | 19 |
| Account NEW-T | 11 | 10 | 16 | 22 | 17 | 11 | 19 |
| Account SAFE | 12 | 8 | 12 | 20 | 16 | 9 | 18 |
| Account ORIG-LOW | 9 | 8 | 13 | 19 | 15 | 10 | 16 |

## 2. PHP 1,000 account

Minimum position per coin today (USD): SOL 7.20, ZEC 7.76, NEAR 2.99, ADA 0.15, GALA 0.01, ARB 0.11, ETH 17.10, SUI 0.67. PHP 58 per USD.

### Start Jan 2020 with PHP 1,000, run to Nov 24 2026

Money this large after 7 years is not realistic (order size, slippage, withdrawals); compare the versions and the falls, not the final amount.

| Version | End (PHP) | Deepest fall | Lowest value (PHP) | Longest under water (days) | Orders filled / failed attempts | End after 20% fee | End if no order minimums | Deepest fall if no minimums |
|---|---|---|---|---|---|---|---|---|
| ORIG (3 live bots) | 26.8M | 48.9% | 1,000 | 225 | 3580 / 842 | 6.9M | 40.2M | 45.9% |
| NEW (BB 1.05x + I + T12) | 35.3M | 47.9% | 1,000 | 209 | 3538 / 976 | 9.2M | 51.7M | 45.6% |
| NEW-BB (BB 1.05x only) | 27.4M | 47.9% | 999 | 209 | 3463 / 1022 | 7.8M | 42.4M | 48.0% |
| NEW-T (T12 only) | 35.2M | 48.6% | 1,000 | 225 | 3645 / 830 | 8.0M | 49.1M | 43.5% |
| SAFE (BB 1.00x only) | 25.1M | 52.7% | 998 | 225 | 3463 / 998 | 5.4M | 41.1M | 47.7% |
| ORIG-LOW (live, risk x0.85) | 7.0M | 50.7% | 1,000 | 225 | 3516 / 1441 | 2.0M | 15.6M | 43.7% |

### Return and deepest fall inside each year (same run)

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| ORIG (3 live bots) | +89% / 42% | +1456% / 49% | +222% / 45% | +452% / 49% | +185% / 36% | +285% / 35% | +367% / 41% |
| NEW (BB 1.05x + I + T12) | +62% / 41% | +1569% / 48% | +222% / 41% | +519% / 42% | +203% / 31% | +349% / 30% | +383% / 37% |
| NEW-BB (BB 1.05x only) | +58% / 41% | +1525% / 48% | +207% / 40% | +483% / 45% | +180% / 33% | +356% / 30% | +368% / 39% |
| NEW-T (T12 only) | +90% / 41% | +1485% / 46% | +254% / 42% | +476% / 49% | +213% / 35% | +278% / 36% | +383% / 39% |
| SAFE (BB 1.00x only) | +63% / 40% | +1529% / 53% | +198% / 39% | +466% / 43% | +175% / 32% | +348% / 30% | +355% / 38% |
| ORIG-LOW (live, risk x0.85) | +53% / 32% | +746% / 43% | +190% / 44% | +468% / 51% | +149% / 32% | +237% / 31% | +289% / 36% |

### Does the starting amount matter? (start Nov 2024, 24 months)

| Start (PHP) | Version | End (PHP) | Return | Deepest fall | Failed order attempts (too small or no margin; repeats counted) |
|---|---|---|---|---|---|
| 1,000 | ORIG | 82,408 | 8141% | 52.7% | 33% |
| 1,000 | NEW | 146,955 | 14595% | 48.9% | 35% |
| 5,000 | ORIG | 344,737 | 6795% | 50.0% | 10% |
| 5,000 | NEW | 445,563 | 8811% | 45.9% | 10% |
| 10,000 | ORIG | 532,845 | 5228% | 49.8% | 8% |
| 10,000 | NEW | 694,710 | 6847% | 46.6% | 9% |
| 50,000 | ORIG | 2.3M | 4461% | 42.0% | 0% |
| 50,000 | NEW | 2.7M | 5358% | 39.4% | 1% |

## 3. Randomness on the PHP 1,000 account

### Every start month from Jan 2020

#### 6 months (77 start dates)

| Version | Median end (PHP) | Bad case end (1 in 20) | Ended with a profit | Median deepest fall | Bad case fall (1 in 20) | Worst fall | Smaller fall than ORIG | More money than ORIG |
|---|---|---|---|---|---|---|---|---|
| ORIG (3 live bots) | 1,654 | 922 | 90% | 40.7% | 57.4% | 59.8% | - | - |
| NEW (BB 1.05x + I + T12) | 1,754 | 986 | 95% | 36.1% | 50.0% | 52.1% | 73% | 61% |
| NEW-BB (BB 1.05x only) | 1,741 | 997 | 95% | 36.1% | 50.1% | 53.2% | 73% | 56% |
| NEW-T (T12 only) | 1,722 | 882 | 88% | 40.5% | 55.6% | 60.3% | 68% | 77% |
| SAFE (BB 1.00x only) | 1,740 | 1,000 | 95% | 35.7% | 50.1% | 52.6% | 78% | 52% |
| ORIG-LOW (live, risk x0.85) | 1,505 | 923 | 92% | 35.3% | 50.4% | 51.1% | 92% | 26% |

#### 12 months (71 start dates)

| Version | Median end (PHP) | Bad case end (1 in 20) | Ended with a profit | Median deepest fall | Bad case fall (1 in 20) | Worst fall | Smaller fall than ORIG | More money than ORIG |
|---|---|---|---|---|---|---|---|---|
| ORIG (3 live bots) | 3,027 | 1,255 | 100% | 49.7% | 59.4% | 59.8% | - | - |
| NEW (BB 1.05x + I + T12) | 3,921 | 1,527 | 100% | 44.4% | 50.8% | 53.7% | 77% | 69% |
| NEW-BB (BB 1.05x only) | 4,102 | 1,449 | 100% | 44.7% | 52.3% | 54.2% | 76% | 56% |
| NEW-T (T12 only) | 3,491 | 1,231 | 100% | 49.8% | 60.2% | 60.6% | 65% | 62% |
| SAFE (BB 1.00x only) | 3,514 | 1,485 | 100% | 43.5% | 50.8% | 52.6% | 77% | 55% |
| ORIG-LOW (live, risk x0.85) | 2,929 | 1,406 | 100% | 42.9% | 51.0% | 53.7% | 94% | 37% |

#### 24 months (59 start dates)

| Version | Median end (PHP) | Bad case end (1 in 20) | Ended with a profit | Median deepest fall | Bad case fall (1 in 20) | Worst fall | Smaller fall than ORIG | More money than ORIG |
|---|---|---|---|---|---|---|---|---|
| ORIG (3 live bots) | 22,184 | 8,558 | 100% | 53.7% | 60.7% | 62.8% | - | - |
| NEW (BB 1.05x + I + T12) | 31,828 | 8,687 | 100% | 47.9% | 52.4% | 52.7% | 90% | 81% |
| NEW-BB (BB 1.05x only) | 28,770 | 7,425 | 100% | 48.9% | 53.2% | 53.5% | 90% | 71% |
| NEW-T (T12 only) | 26,214 | 8,380 | 100% | 52.7% | 59.9% | 61.8% | 73% | 73% |
| SAFE (BB 1.00x only) | 27,992 | 6,982 | 100% | 48.4% | 52.7% | 52.7% | 85% | 54% |
| ORIG-LOW (live, risk x0.85) | 16,835 | 6,807 | 100% | 47.8% | 53.8% | 54.1% | 98% | 7% |

### 300 runs with missed signals (15%), random extra slippage and fees: 12 months from a random start date

| Version | Median end (PHP) | Bad case end (1 in 20) | Ended with a profit | Median deepest fall | Bad case fall (1 in 20) | Chance of a fall over 50% | Smaller fall than ORIG | More money than ORIG |
|---|---|---|---|---|---|---|---|---|
| ORIG (3 live bots) | 2,700 | 1,063 | 97% | 50.2% | 60.0% | 51% | - | - |
| NEW (BB 1.05x + I + T12) | 3,134 | 1,228 | 99% | 45.2% | 54.7% | 20% | 75% | 66% |
| NEW-BB (BB 1.05x only) | 3,016 | 1,186 | 99% | 45.7% | 54.6% | 23% | 74% | 59% |
| NEW-T (T12 only) | 2,794 | 1,086 | 98% | 49.9% | 60.5% | 50% | 51% | 65% |
| SAFE (BB 1.00x only) | 2,764 | 1,122 | 98% | 45.2% | 54.9% | 22% | 80% | 53% |
| ORIG-LOW (live, risk x0.85) | 2,518 | 1,136 | 99% | 43.3% | 52.9% | 15% | 97% | 28% |

### 300 runs with missed signals (15%), random extra slippage and fees: Full run 2020-2026

| Version | Median end (PHP) | Bad case end (1 in 20) | Ended with a profit | Median deepest fall | Bad case fall (1 in 20) | Chance of a fall over 50% | Smaller fall than ORIG | More money than ORIG |
|---|---|---|---|---|---|---|---|---|
| ORIG (3 live bots) | 7.8M | 4.2M | 100% | 59.5% | 64.5% | 98% | - | - |
| NEW (BB 1.05x + I + T12) | 10.7M | 6.0M | 100% | 51.4% | 55.6% | 70% | 99% | 98% |
| NEW-BB (BB 1.05x only) | 8.6M | 5.3M | 100% | 52.7% | 56.6% | 87% | 96% | 83% |
| NEW-T (T12 only) | 9.7M | 5.2M | 100% | 58.3% | 63.0% | 96% | 94% | 100% |
| SAFE (BB 1.00x only) | 7.6M | 4.7M | 100% | 52.3% | 56.5% | 82% | 97% | 53% |
| ORIG-LOW (live, risk x0.85) | 2.4M | 1.6M | 100% | 57.3% | 61.5% | 100% | 87% | 0% |

### Each bot, 200 randomized 7-year histories (R)

| Change | Open drop smaller | Closed drop smaller | More R | Median open drop: new / live | Median R: new / live | Runs with positive total: new / live |
|---|---|---|---|---|---|---|
| BB tweak 1.05x | 100% | 97% | 76% | 33.0 / 45.4 | +609 / +597 | 100% / 100% |
| BB tweak 1.00x | 100% | 100% | 4% | 31.4 / 45.4 | +580 / +597 | 100% / 100% |
| T-CORE trail 12 | 16% | 100% | 100% | 157.6 / 148.0 | +1136 / +1041 | 100% / 100% |

## 4. Coin toss

200 runs each, same exits and costs. "Flip": the bot's own entry times, direction by coin flip. "Random": entry times and direction both random, same number of signals.

| Bot | Coin toss | Real strategy R | Toss median R | Toss 5th | Toss 95th | Toss runs with profit | Toss runs green all 7 years | Toss runs the real one beats | Closed drop: real / toss median |
|---|---|---|---|---|---|---|---|---|---|
| BB-CORE live | Flip | +707 | +242 | +109 | +358 | 100% | 34% | 100.0% | 27 / 52 |
| BB-CORE live | Random | +707 | +231 | -15 | +541 | 94% | 7% | 100.0% | 27 / 120 |
| BB tweak 1.05x | Flip | +711 | +275 | +154 | +385 | 100% | 38% | 100.0% | 27 / 42 |
| BB tweak 1.05x | Random | +711 | +247 | +14 | +489 | 98% | 9% | 100.0% | 27 / 98 |
| I-CORE live | Flip | +806 | +331 | +165 | +526 | 100% | 20% | 100.0% | 28 / 49 |
| I-CORE live | Random | +806 | +276 | +117 | +473 | 99% | 7% | 100.0% | 28 / 58 |
| T-CORE live (trail 14) | Flip | +1105 | +688 | +517 | +848 | 100% | 20% | 100.0% | 31 / 75 |
| T-CORE live (trail 14) | Random | +1105 | +678 | +482 | +862 | 100% | 14% | 100.0% | 31 / 81 |
| T-CORE trail 12 | Flip | +1198 | +753 | +577 | +918 | 100% | 22% | 100.0% | 29 / 68 |
| T-CORE trail 12 | Random | +1198 | +733 | +502 | +932 | 100% | 10% | 100.0% | 29 / 78 |

### Share of coin-toss runs that made money, per year

| Bot | Coin toss | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| BB-CORE live | Flip | 79% | 99% | 80% | 85% | 80% | 85% | 93% |
| BB-CORE live | Random | 67% | 91% | 74% | 79% | 53% | 42% | 82% |
| BB tweak 1.05x | Flip | 62% | 99% | 89% | 89% | 89% | 96% | 98% |
| BB tweak 1.05x | Random | 61% | 91% | 73% | 80% | 56% | 53% | 87% |
| I-CORE live | Flip | 53% | 100% | 80% | 90% | 78% | 63% | 100% |
| I-CORE live | Random | 42% | 99% | 51% | 94% | 73% | 51% | 86% |
| T-CORE live (trail 14) | Flip | 100% | 100% | 42% | 40% | 100% | 97% | 100% |
| T-CORE live (trail 14) | Random | 98% | 100% | 56% | 27% | 100% | 91% | 97% |
| T-CORE trail 12 | Flip | 100% | 100% | 47% | 47% | 100% | 97% | 100% |
| T-CORE trail 12 | Random | 98% | 100% | 53% | 25% | 100% | 92% | 97% |

## 5. Synthetic markets

100 markets of each kind, 3 years each, built from real candles from Oct 2021 on. R over 3 years.

### Do the bots make money whatever the market does?

| Market | BB-CORE live | BB tweak 1.00x | BB tweak 1.05x | I-CORE live | T-CORE live (trail 14) | T-CORE trail 12 |
|---|---|---|---|---|---|---|
| Normal (30-day blocks) | 98% (+218R) | 99% (+195R) | 99% (+204R) | 98% (+142R) | 94% (+235R) | 95% (+239R) |
| Normal (90-day blocks) | 100% (+288R) | 100% (+273R) | 100% (+287R) | 100% (+266R) | 100% (+410R) | 100% (+440R) |
| Rising only | 100% (+441R) | 100% (+422R) | 100% (+443R) | 100% (+625R) | 100% (+2209R) | 100% (+1880R) |
| Falling only | 100% (+569R) | 100% (+494R) | 100% (+519R) | 100% (+362R) | 100% (+478R) | 100% (+476R) |
| Sideways only | 75% (+62R) | 86% (+72R) | 86% (+75R) | 67% (+35R) | 32% (-47R) | 37% (-36R) |
| No long-term drift | 100% (+189R) | 100% (+182R) | 100% (+191R) | 91% (+124R) | 95% (+229R) | 95% (+251R) |
| Mirrored (up becomes down) | 100% (+236R) | 100% (+233R) | 100% (+245R) | 92% (+152R) | 94% (+255R) | 94% (+238R) |
| Single candles shuffled (no trends) | 31% (-20R) | 38% (-20R) | 38% (-21R) | 40% (-28R) | 38% (-40R) | 37% (-50R) |

Each cell: share of markets with a profit (median R).

### Changed bot against the live bot

| Change | Market | Open drop smaller | Closed drop smaller | More R | Median open drop: new / live | Median R: new / live |
|---|---|---|---|---|---|---|
| BB tweak 1.05x | Normal (30-day blocks) | 89% | 87% | 48% | 50.4 / 57.2 | +204 / +218 |
| BB tweak 1.05x | Normal (90-day blocks) | 95% | 89% | 47% | 37.6 / 43.0 | +287 / +288 |
| BB tweak 1.05x | Rising only | 87% | 91% | 54% | 38.5 / 45.6 | +443 / +441 |
| BB tweak 1.05x | Falling only | 77% | 70% | 3% | 32.8 / 35.5 | +519 / +569 |
| BB tweak 1.05x | Sideways only | 89% | 85% | 70% | 70.5 / 83.1 | +75 / +62 |
| BB tweak 1.05x | No long-term drift | 79% | 78% | 51% | 53.7 / 60.6 | +191 / +189 |
| BB tweak 1.05x | Mirrored (up becomes down) | 92% | 87% | 72% | 56.2 / 62.0 | +245 / +236 |
| BB tweak 1.05x | Single candles shuffled (no trends) | 78% | 76% | 54% | 94.7 / 106.4 | -21 / -20 |
| BB tweak 1.00x | Normal (30-day blocks) | 94% | 93% | 32% | 48.0 / 57.2 | +195 / +218 |
| BB tweak 1.00x | Normal (90-day blocks) | 97% | 96% | 29% | 35.8 / 43.0 | +273 / +288 |
| BB tweak 1.00x | Rising only | 92% | 94% | 21% | 36.6 / 45.6 | +422 / +441 |
| BB tweak 1.00x | Falling only | 89% | 80% | 0% | 31.2 / 35.5 | +494 / +569 |
| BB tweak 1.00x | Sideways only | 94% | 95% | 59% | 67.1 / 83.1 | +72 / +62 |
| BB tweak 1.00x | No long-term drift | 85% | 84% | 39% | 51.2 / 60.6 | +182 / +189 |
| BB tweak 1.00x | Mirrored (up becomes down) | 96% | 94% | 51% | 53.5 / 62.0 | +233 / +236 |
| BB tweak 1.00x | Single candles shuffled (no trends) | 87% | 89% | 57% | 90.2 / 106.4 | -20 / -20 |
| T-CORE trail 12 | Normal (30-day blocks) | 68% | 59% | 69% | 101.5 / 110.3 | +239 / +235 |
| T-CORE trail 12 | Normal (90-day blocks) | 78% | 64% | 87% | 103.6 / 110.3 | +440 / +410 |
| T-CORE trail 12 | Rising only | 79% | 50% | 10% | 151.5 / 164.8 | +1880 / +2209 |
| T-CORE trail 12 | Falling only | 35% | 35% | 61% | 41.5 / 39.1 | +476 / +478 |
| T-CORE trail 12 | Sideways only | 68% | 62% | 76% | 144.4 / 150.5 | -36 / -47 |
| T-CORE trail 12 | No long-term drift | 76% | 60% | 60% | 108.8 / 122.2 | +251 / +229 |
| T-CORE trail 12 | Mirrored (up becomes down) | 64% | 59% | 46% | 99.1 / 104.9 | +238 / +255 |
| T-CORE trail 12 | Single candles shuffled (no trends) | 52% | 35% | 39% | 151.0 / 152.5 | -50 / -40 |

### PHP 1,000 for one year in each synthetic market

| Market | Version | Years with profit | Median end (PHP) | Bad case end (1 in 20) | Median fall | Bad case fall | Smaller fall than ORIG | More money than ORIG |
|---|---|---|---|---|---|---|---|---|
| Normal (30-day blocks) | ORIG | 70% | 1,781 | 529 | 58.4% | 77.2% | - | - |
| Normal (30-day blocks) | NEW | 75% | 2,023 | 549 | 53.0% | 74.8% | 79% | 62% |
| Normal (30-day blocks) | NEW-BB | 74% | 2,019 | 590 | 53.3% | 75.2% | 83% | 62% |
| Normal (30-day blocks) | NEW-T | 70% | 1,830 | 476 | 57.8% | 77.0% | 57% | 59% |
| Normal (30-day blocks) | SAFE | 74% | 1,896 | 569 | 52.1% | 72.7% | 87% | 60% |
| Normal (30-day blocks) | ORIG-LOW | 73% | 1,768 | 554 | 50.8% | 68.3% | 97% | 49% |
| Normal (90-day blocks) | ORIG | 93% | 3,393 | 814 | 54.2% | 71.2% | - | - |
| Normal (90-day blocks) | NEW | 94% | 3,851 | 873 | 49.8% | 66.8% | 81% | 67% |
| Normal (90-day blocks) | NEW-BB | 94% | 3,804 | 845 | 49.4% | 66.5% | 86% | 61% |
| Normal (90-day blocks) | NEW-T | 92% | 3,520 | 838 | 54.2% | 70.5% | 54% | 68% |
| Normal (90-day blocks) | SAFE | 94% | 3,511 | 878 | 48.6% | 65.5% | 92% | 60% |
| Normal (90-day blocks) | ORIG-LOW | 91% | 3,027 | 872 | 48.0% | 63.8% | 95% | 33% |
| Rising only | ORIG | 95% | 18,759 | 1,054 | 53.1% | 77.3% | - | - |
| Rising only | NEW | 97% | 18,509 | 1,428 | 50.9% | 72.6% | 66% | 48% |
| Rising only | NEW-BB | 98% | 20,700 | 1,198 | 50.9% | 72.6% | 77% | 63% |
| Rising only | NEW-T | 95% | 16,690 | 1,076 | 53.1% | 77.0% | 40% | 40% |
| Rising only | SAFE | 97% | 19,188 | 1,234 | 50.0% | 71.8% | 84% | 55% |
| Rising only | ORIG-LOW | 95% | 13,508 | 1,077 | 47.4% | 68.8% | 91% | 18% |
| Falling only | ORIG | 100% | 20,043 | 3,418 | 39.7% | 59.9% | - | - |
| Falling only | NEW | 100% | 17,722 | 2,664 | 38.6% | 57.7% | 63% | 25% |
| Falling only | NEW-BB | 100% | 17,215 | 2,860 | 38.0% | 55.9% | 70% | 19% |
| Falling only | NEW-T | 100% | 19,504 | 3,261 | 40.6% | 58.9% | 32% | 62% |
| Falling only | SAFE | 100% | 15,775 | 2,780 | 37.0% | 54.2% | 81% | 16% |
| Falling only | ORIG-LOW | 100% | 13,362 | 2,862 | 34.6% | 51.7% | 99% | 4% |
| Sideways only | ORIG | 39% | 817 | 330 | 63.8% | 80.1% | - | - |
| Sideways only | NEW | 43% | 907 | 387 | 58.8% | 77.8% | 85% | 66% |
| Sideways only | NEW-BB | 44% | 914 | 368 | 57.8% | 78.5% | 84% | 67% |
| Sideways only | NEW-T | 40% | 818 | 321 | 63.2% | 80.4% | 61% | 61% |
| Sideways only | SAFE | 42% | 898 | 372 | 56.9% | 78.5% | 90% | 69% |
| Sideways only | ORIG-LOW | 44% | 915 | 426 | 55.6% | 73.5% | 97% | 76% |
| No long-term drift | ORIG | 68% | 1,757 | 487 | 58.7% | 79.1% | - | - |
| No long-term drift | NEW | 69% | 1,706 | 505 | 57.7% | 74.6% | 75% | 61% |
| No long-term drift | NEW-BB | 69% | 1,678 | 485 | 56.4% | 76.9% | 76% | 55% |
| No long-term drift | NEW-T | 66% | 1,731 | 495 | 59.6% | 78.9% | 53% | 54% |
| No long-term drift | SAFE | 69% | 1,657 | 509 | 56.8% | 75.7% | 81% | 61% |
| No long-term drift | ORIG-LOW | 68% | 1,763 | 563 | 52.2% | 72.3% | 99% | 57% |
| Mirrored (up becomes down) | ORIG | 71% | 2,051 | 481 | 59.1% | 77.6% | - | - |
| Mirrored (up becomes down) | NEW | 80% | 2,277 | 560 | 55.1% | 77.1% | 73% | 64% |
| Mirrored (up becomes down) | NEW-BB | 78% | 2,451 | 548 | 55.8% | 76.7% | 80% | 67% |
| Mirrored (up becomes down) | NEW-T | 70% | 1,953 | 484 | 59.4% | 77.9% | 56% | 60% |
| Mirrored (up becomes down) | SAFE | 76% | 2,482 | 573 | 54.3% | 75.5% | 94% | 65% |
| Mirrored (up becomes down) | ORIG-LOW | 76% | 2,110 | 547 | 52.1% | 70.1% | 98% | 52% |
| Single candles shuffled (no trends) | ORIG | 22% | 611 | 320 | 64.9% | 75.7% | - | - |
| Single candles shuffled (no trends) | NEW | 24% | 620 | 307 | 64.0% | 74.6% | 65% | 55% |
| Single candles shuffled (no trends) | NEW-BB | 25% | 604 | 336 | 64.2% | 75.9% | 68% | 60% |
| Single candles shuffled (no trends) | NEW-T | 27% | 600 | 286 | 66.5% | 77.2% | 48% | 59% |
| Single candles shuffled (no trends) | SAFE | 25% | 637 | 350 | 61.2% | 76.1% | 84% | 67% |
| Single candles shuffled (no trends) | ORIG-LOW | 24% | 694 | 381 | 55.9% | 69.9% | 98% | 86% |

## 6. Pass mark (PLAN.md)

| Change | (a) history open drop | (b) synthetic | (c) randomized history | (d) profit kept | Verdict |
|---|---|---|---|---|---|
| BB tweak 1.05x | pass (32.9 vs 45.4) | pass (89%) | pass (100%) | FAIL (history 101%, synthetic +204 vs +218) | **do not replace** |
| BB tweak 1.00x | pass (31.4 vs 45.4) | pass (94%) | pass (100%) | FAIL (history 96%, synthetic +195 vs +218) | **do not replace** |
| T-CORE trail 12 | FAIL (157.4 vs 148.2) | FAIL (68%) | FAIL (16%) | pass (history 108%, synthetic +239 vs +235) | **do not replace** |


## 7. Risk level (added after the results above)

The same two accounts with every trade's risk multiplied. "Failed attempts" = share of order attempts below the exchange minimum or without margin. A signal that repeats on later candles counts again, so this is NOT the share of trades lost (see REPORT.md).

### Start PHP 1,000: 12 months from a random start, 300 runs with random frictions

| Account | Median end (PHP) | Bad case end (1 in 20) | Ended with a profit | Median deepest fall | Bad case fall (1 in 20) | Chance of a fall over 50% | Failed attempts |
|---|---|---|---|---|---|---|---|
| ORIG, risk x1 | 2,700 | 1,063 | 97% | 50.2% | 60.0% | 51% | 66% |
| ORIG, risk x0.7 | 2,036 | 1,186 | 99% | 35.3% | 44.8% | 1% | 77% |
| ORIG, risk x0.5 | 1,639 | 1,116 | 98% | 25.2% | 33.2% | 0% | 83% |
| BB tweak 1.00x (SAFE), risk x1 | 2,764 | 1,122 | 98% | 45.2% | 54.9% | 22% | 68% |
| BB tweak 1.00x (SAFE), risk x0.7 | 2,040 | 1,199 | 100% | 33.0% | 39.8% | 0% | 79% |
| BB tweak 1.00x (SAFE), risk x0.5 | 1,645 | 1,196 | 100% | 23.0% | 29.1% | 0% | 84% |

### Start PHP 1,000: 1 year in 100 synthetic markets (30-day blocks)

| Account | Median end (PHP) | Bad case end (1 in 20) | Ended with a profit | Median deepest fall | Bad case fall (1 in 20) | Chance of a fall over 50% | Failed attempts |
|---|---|---|---|---|---|---|---|
| ORIG, risk x1 | 1,781 | 529 | 70% | 58.4% | 77.2% | 79% | 68% |
| ORIG, risk x0.7 | 1,575 | 614 | 73% | 43.0% | 60.2% | 23% | 75% |
| ORIG, risk x0.5 | 1,420 | 801 | 76% | 30.2% | 48.1% | 2% | 81% |
| BB tweak 1.00x (SAFE), risk x1 | 1,896 | 569 | 74% | 52.1% | 72.7% | 57% | 69% |
| BB tweak 1.00x (SAFE), risk x0.7 | 1,677 | 726 | 78% | 38.5% | 55.6% | 15% | 77% |
| BB tweak 1.00x (SAFE), risk x0.5 | 1,393 | 827 | 77% | 26.8% | 44.0% | 0% | 82% |

### Start PHP 10,000: 12 months from a random start, 300 runs with random frictions

| Account | Median end (PHP) | Bad case end (1 in 20) | Ended with a profit | Median deepest fall | Bad case fall (1 in 20) | Chance of a fall over 50% | Failed attempts |
|---|---|---|---|---|---|---|---|
| ORIG, risk x1 | 53,480 | 9,309 | 94% | 50.3% | 62.3% | 51% | 5% |
| ORIG, risk x0.7 | 39,871 | 10,177 | 95% | 39.9% | 49.1% | 3% | 2% |
| ORIG, risk x0.5 | 30,259 | 10,567 | 97% | 31.2% | 38.0% | 0% | 4% |
| BB tweak 1.00x (SAFE), risk x1 | 59,448 | 10,613 | 96% | 46.4% | 53.8% | 22% | 6% |
| BB tweak 1.00x (SAFE), risk x0.7 | 43,361 | 11,249 | 98% | 37.1% | 42.0% | 0% | 2% |
| BB tweak 1.00x (SAFE), risk x0.5 | 31,086 | 11,245 | 99% | 29.1% | 32.9% | 0% | 5% |

### Start PHP 10,000: 1 year in 100 synthetic markets (30-day blocks)

| Account | Median end (PHP) | Bad case end (1 in 20) | Ended with a profit | Median deepest fall | Bad case fall (1 in 20) | Chance of a fall over 50% | Failed attempts |
|---|---|---|---|---|---|---|---|
| ORIG, risk x1 | 25,170 | 4,089 | 77% | 61.8% | 85.9% | 85% | 11% |
| ORIG, risk x0.7 | 20,743 | 5,880 | 79% | 48.7% | 74.2% | 47% | 2% |
| ORIG, risk x0.5 | 18,207 | 7,129 | 82% | 38.2% | 60.1% | 18% | 6% |
| BB tweak 1.00x (SAFE), risk x1 | 24,383 | 5,404 | 79% | 58.1% | 80.9% | 75% | 11% |
| BB tweak 1.00x (SAFE), risk x0.7 | 19,677 | 6,890 | 82% | 46.5% | 69.5% | 38% | 3% |
| BB tweak 1.00x (SAFE), risk x0.5 | 18,465 | 8,383 | 86% | 35.1% | 56.2% | 12% | 6% |

