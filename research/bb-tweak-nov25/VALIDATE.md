# Validation of the two candidates (Nov 25, 2026)

Same basis as COMPARE.md: live coins, 4h, v3 rules, 0.05% fee + 0.02% slippage per side, real funding, to Nov 24 2026. "Drop closed" = worst fall on closed trades; "drop open" = including open trades. A paired test always gives both versions the same random draw.

## BB tweak 1.05x against BB-CORE live

### 1. Base numbers

| Version | Total R | Drop closed | Drop open | Longest losing run | Without best 10 | Green years |
|---|---|---|---|---|---|---|
| BB-CORE live | +707 | 27.2 | 45.4 | 14 | +496 | 7/7 |
| BB tweak 1.05x | +711 | 26.5 | 32.9 | 16 | +491 | 7/7 |

| Side | BB-CORE live R (trades) | BB tweak 1.05x R (trades) |
|---|---|---|
| Longs | +390 (806) | +398 (818) |
| Shorts | +317 (902) | +314 (805) |

### 2. Reshuffled histories (10,000 draws of 3-month blocks, same months for both)

| Candidate has more R | smaller drop (monthly) | better R / drop | more R AND drop not bigger |
|---|---|---|---|
| 53% | 90% | 88% | 49% |

### 3. Random start dates and rolling windows

| Windows | Count | Candidate more R | drop closed not bigger | drop open not bigger | all three | losing windows live / candidate |
|---|---|---|---|---|---|---|
| Start any month 2020-2025, run to Nov 2026 | 72 | 100% | 78% | 100% | 78% | 0 / 0 |
| Any 12 months in a row | 71 | 46% | 83% | 85% | 28% | 0 / 0 |
| Any 24 months in a row | 59 | 44% | 95% | 83% | 29% | 0 / 0 |

### 4. Randomly miss 20% of signals (120 runs; the same signals missed by both)

| Candidate more R | drop closed not bigger | drop open not bigger | all three | R difference: worst / median / best | runs with 7/7 green years: live / candidate |
|---|---|---|---|---|---|
| 43% | 97% | 100% | 43% | -46 / -3 / +38 | 120/120 / 120/120 |

### 5. Higher costs

| Fees and slippage | Live R / drop closed / drop open | Candidate R / drop closed / drop open | Green years live / candidate |
|---|---|---|---|
| 2x | +647 / 30.5 / 46.3 | +658 / 28.9 / 34.3 | 7 / 7 |
| 3x | +591 / 36.4 / 50.6 | +610 / 31.2 / 35.6 | 7 / 7 |

### 6. Each year: R / drop closed / drop open

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB-CORE live | +38 / 10 / 24 | +178 / 14 / 18 | +85 / 27 / 31 | +122 / 27 / 45 | +95 / 27 / 35 | +64 / 24 / 35 | +126 / 26 / 30 |
| BB tweak 1.05x | +24 / 10 / 27 | +190 / 12 / 17 | +77 / 19 / 22 | +114 / 22 / 25 | +84 / 22 / 27 | +89 / 16 / 25 | +132 / 27 / 27 |

## T-CORE trail 12 against T-CORE live (trail 14)

### 1. Base numbers

| Version | Total R | Drop closed | Drop open | Longest losing run | Without best 10 | Green years |
|---|---|---|---|---|---|---|
| T-CORE live (trail 14) | +1105 | 30.9 | 148.2 | 15 | +391 | 7/7 |
| T-CORE trail 12 | +1198 | 28.5 | 157.4 | 15 | +459 | 7/7 |

| Side | T-CORE live (trail 14) R (trades) | T-CORE trail 12 R (trades) |
|---|---|---|
| Longs | +1017 (522) | +1083 (557) |
| Shorts | +88 (628) | +114 (663) |

### 2. Reshuffled histories (10,000 draws of 3-month blocks, same months for both)

| Candidate has more R | smaller drop (monthly) | better R / drop | more R AND drop not bigger |
|---|---|---|---|
| 98% | 77% | 87% | 76% |

### 3. Random start dates and rolling windows

| Windows | Count | Candidate more R | drop closed not bigger | drop open not bigger | all three | losing windows live / candidate |
|---|---|---|---|---|---|---|
| Start any month 2020-2025, run to Nov 2026 | 72 | 90% | 76% | 1% | 0% | 0 / 0 |
| Any 12 months in a row | 71 | 77% | 69% | 75% | 55% | 0 / 0 |
| Any 24 months in a row | 59 | 98% | 93% | 73% | 68% | 0 / 0 |

### 4. Randomly miss 20% of signals (120 runs; the same signals missed by both)

| Candidate more R | drop closed not bigger | drop open not bigger | all three | R difference: worst / median / best | runs with 7/7 green years: live / candidate |
|---|---|---|---|---|---|
| 100% | 98% | 12% | 11% | +72 / +94 / +140 | 119/120 / 120/120 |

### 5. Higher costs

| Fees and slippage | Live R / drop closed / drop open | Candidate R / drop closed / drop open | Green years live / candidate |
|---|---|---|---|
| 2x | +1073 / 34.4 / 149.1 | +1164 / 31.7 / 158.4 | 7 / 7 |
| 3x | +1034 / 39.7 / 150.0 | +1123 / 33.6 / 159.5 | 7 / 7 |

### 6. Each year: R / drop closed / drop open

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| T-CORE live (trail 14) | +54 / 27 / 60 | +256 / 16 / 79 | +16 / 28 / 36 | +25 / 31 / 70 | +352 / 21 / 107 | +259 / 17 / 137 | +143 / 16 / 96 |
| T-CORE trail 12 | +65 / 26 / 52 | +266 / 17 / 75 | +29 / 19 / 37 | +26 / 29 / 65 | +403 / 21 / 103 | +262 / 16 / 146 | +146 / 19 / 84 |

## T-CORE trail: neighbours and walk-forward

| Trail (ATR) | Total R | Drop closed | Drop open | 2020-23 R / drop closed | 2024-26 R / drop closed | Green years |
|---|---|---|---|---|---|---|
| 8 | +1008 | 46.1 | 72.8 | +435 / 35.2 | +574 / 46.1 | 7/7 |
| 9 | +1090 | 36.6 | 136.9 | +398 / 33.9 | +692 / 36.6 | 7/7 |
| 10 | +1263 | 30.5 | 136.9 | +370 / 30.5 | +893 / 23.1 | 7/7 |
| 11 | +1186 | 29.8 | 139.7 | +353 / 29.8 | +832 / 23.5 | 7/7 |
| 12 | +1198 | 28.5 | 157.4 | +387 / 28.5 | +811 / 20.8 | 7/7 |
| 13 | +1142 | 28.8 | 156.1 | +372 / 28.8 | +770 / 20.9 | 7/7 |
| 14 (live) | +1105 | 30.9 | 148.2 | +351 / 30.9 | +754 / 20.9 | 7/7 |
| 16 | +1192 | 36.4 | 179.0 | +451 / 36.4 | +741 / 27.4 | 7/7 |

Walk-forward: every 1 January the trail with the best R / closed drop on past data only is used for that year (2022: trail 16, 2023: trail 10, 2024: trail 12, 2025: trail 12, 2026: trail 12).

| 2022 to Nov 2026 | Total R | Drop closed | Drop open | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| Live trail 14 | +781 | 30.9 | 148.2 | +2 | +25 | +352 | +259 | +143 |
| Fixed trail 12 | +851 | 28.5 | 157.4 | +14 | +26 | +403 | +262 | +146 |
| Walk-forward pick | +834 | 36.4 | 157.4 | -10 | +32 | +404 | +262 | +146 |

## Other coins (never used for any choice): 150 random baskets

| Pair | Window | Candidate more R | drop closed not bigger | better R / drop | more R AND drop not bigger |
|---|---|---|---|---|---|
| T trail 12 vs 14 (8 coins) | all years | 53% | 33% | 38% | 24% |
| T trail 12 vs 14 (8 coins) | 2024-26 | 51% | 24% | 39% | 18% |
| BB 1.05x vs live (6 coins) | all years | 31% | 75% | 47% | 29% |
| BB 1.05x vs live (6 coins) | 2024-26 | 44% | 95% | 69% | 43% |

## New T-CORE search (chosen on 2020-23 only, then judged on 2024-26)

90 settings (trail 10-14, first stop 1.5/2/2.5 ATR, stale exit 36/48/60 candles below +0.5/+1R). Qualify on 2020-23: more R, both drops not bigger, R / drop not lower in either half. 12 qualify; ranked by R / open drop on 2020-23.

| Setting | 2020-23 R / closed / open | 2024-26 R / closed / open | All R / closed / open | Green years |
|---|---|---|---|---|
| LIVE (trail 14, stop 2, stale 48 / +1R) | +351 / 30.9 / 78.5 | +754 / 20.9 / 148.2 | +1105 / 30.9 / 148.2 | 7/7 |
| trail 10, stop 2, stale 36 / +1R | +382 / 29.8 / 66.0 | +888 / 25.5 / 136.9 | +1270 / 29.8 / 136.9 | 7/7 |
| trail 10, stop 2, stale 48 / +1R | +370 / 30.5 / 66.1 | +893 / 23.1 / 136.9 | +1263 / 30.5 / 136.9 | 7/7 |
| trail 12, stop 2, stale 36 / +1R | +400 / 30.5 / 75.5 | +831 / 24.6 / 155.2 | +1231 / 30.5 / 155.2 | 7/7 |
| trail 11, stop 2, stale 36 / +1R | +362 / 30.7 / 69.5 | +848 / 25.7 / 138.8 | +1211 / 30.7 / 138.8 | 7/7 |
| trail 12, stop 2, stale 48 / +1R | +387 / 28.5 / 75.2 | +811 / 20.8 / 157.4 | +1198 / 28.5 / 157.4 | 7/7 |
| trail 12, stop 2, stale 36 / +0.5R | +393 / 29.0 / 76.6 | +797 / 27.6 / 157.0 | +1191 / 29.0 / 157.0 | 7/7 |
| trail 13, stop 2, stale 36 / +1R | +383 / 30.6 / 74.8 | +794 / 23.9 / 153.9 | +1177 / 30.6 / 153.9 | 7/7 |
| trail 11, stop 2, stale 48 / +1R | +353 / 29.8 / 69.3 | +832 / 23.5 / 139.7 | +1186 / 29.8 / 139.7 | 7/7 |

The 2020-23 winner does NOT beat live on all three numbers in 2024-26.
