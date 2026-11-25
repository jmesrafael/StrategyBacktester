# Results: tweaks to BB-CORE (candles to 2026-11-24, live coins SOL ZEC NEAR ADA GALA ARB)

Replay equals the project engine on 28385 trades (0 different). No-future-sight check: 20359 trades and 207822 equity points identical when the data is cut at 8 dates (0 failures).
Tweaks locked 2026-11-25T01:13Z from data before 2024 only (132 tested, 3 passed every check).

## Years used to choose (2020-2023)

| Version | Trades | Total R | Max drawdown R (closed) | Max drawdown R (with open trades) | R / drawdown | Longest losing run | Without best 10 | Return at 1% risk | Worst fall at 1% risk |
|---|---|---|---|---|---|---|---|---|---|
| A BB-CORE today | 828 | +423 | 27.2 | 45.4 | 9.3 | 14 | +222 | +4473% | 24% |
| B Intensity filter alone | 756 | +401 | 23.7 | 29.4 | 13.7 | 15 | +204 | +3714% | 21% |
| C ADX>27 half (picked by the procedure) | 828 | +475 | 25.4 | 36.4 | 13.0 | 14 | +247 | +7002% | 23% |
| D II(21)>0 S only skip + ADX>27 half (best with Intensity) | 781 | +443 | 24.5 | 29.3 | 15.1 | 16 | +216 | +5188% | 22% |
| C1 C without raising risk (never above today's risk) | 828 | +418 | 22.3 | 32.0 | 13.0 | 14 | +217 | +4346% | 20% |
| D1 D without raising risk | 781 | +387 | 21.4 | 25.6 | 15.1 | 16 | +189 | +3247% | 20% |

## UNSEEN years (2024 to Nov 2026)

| Version | Trades | Total R | Max drawdown R (closed) | Max drawdown R (with open trades) | R / drawdown | Longest losing run | Without best 10 | Return at 1% risk | Worst fall at 1% risk |
|---|---|---|---|---|---|---|---|---|---|
| A BB-CORE today | 880 | +285 | 27.0 | 34.9 | 8.2 | 14 | +163 | +1265% | 24% |
| B Intensity filter alone | 806 | +288 | 25.5 | 34.9 | 8.3 | 15 | +167 | +1344% | 23% |
| C ADX>27 half (picked by the procedure) | 880 | +331 | 32.2 | 39.5 | 8.4 | 14 | +192 | +1968% | 28% |
| D II(21)>0 S only skip + ADX>27 half (best with Intensity) | 842 | +333 | 28.9 | 35.9 | 9.3 | 14 | +194 | +2036% | 26% |
| C1 C without raising risk (never above today's risk) | 880 | +291 | 28.3 | 34.7 | 8.4 | 14 | +169 | +1375% | 25% |
| D1 D without raising risk | 842 | +291 | 25.3 | 31.4 | 9.3 | 14 | +169 | +1390% | 23% |

## Everything (2020 to Nov 2026)

| Version | Trades | Total R | Max drawdown R (closed) | Max drawdown R (with open trades) | R / drawdown | Longest losing run | Without best 10 | Return at 1% risk | Worst fall at 1% risk |
|---|---|---|---|---|---|---|---|---|---|
| A BB-CORE today | 1708 | +707 | 27.2 | 45.4 | 15.6 | 14 | +496 | +62314% | 24% |
| B Intensity filter alone | 1562 | +689 | 25.5 | 34.9 | 19.8 | 15 | +480 | +54974% | 23% |
| C ADX>27 half (picked by the procedure) | 1708 | +805 | 32.2 | 39.5 | 20.4 | 14 | +565 | +146771% | 28% |
| D II(21)>0 S only skip + ADX>27 half (best with Intensity) | 1623 | +776 | 28.9 | 35.9 | 21.6 | 16 | +536 | +112850% | 26% |
| C1 C without raising risk (never above today's risk) | 1708 | +708 | 28.3 | 34.7 | 20.4 | 14 | +497 | +65486% | 25% |
| D1 D without raising risk | 1623 | +677 | 25.3 | 31.4 | 21.6 | 16 | +468 | +49790% | 23% |

## Year by year

Years 2020-2023 were used to choose; 2024-2026 were not. 2020 starts with the data; 2026 ends Nov 24.

### Total R

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| A | +38 | +178 | +85 | +122 | +95 | +64 | +126 |
| B | +24 | +172 | +85 | +120 | +68 | +86 | +134 |
| C | +40 | +210 | +93 | +132 | +111 | +84 | +136 |
| D | +27 | +207 | +84 | +124 | +92 | +97 | +144 |
| C1 | +35 | +184 | +82 | +116 | +98 | +74 | +119 |
| D1 | +23 | +181 | +74 | +108 | +80 | +85 | +125 |

### Max drawdown R inside the year, with open trades

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| A | 24.3 | 18.0 | 30.6 | 45.4 | 34.9 | 34.6 | 30.3 |
| B | 26.9 | 17.9 | 22.3 | 29.4 | 34.9 | 30.5 | 24.6 |
| C | 27.7 | 18.8 | 29.1 | 36.4 | 30.7 | 31.3 | 33.1 |
| D | 29.3 | 19.0 | 24.5 | 27.6 | 29.8 | 27.8 | 29.2 |
| C1 | 24.3 | 16.6 | 25.6 | 32.0 | 27.0 | 27.5 | 29.1 |
| D1 | 25.6 | 16.6 | 21.4 | 24.1 | 26.0 | 24.3 | 25.5 |

### Max drawdown R inside the year, closed trades

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| A | 10.1 | 14.0 | 27.2 | 26.8 | 27.0 | 24.3 | 26.5 |
| B | 10.1 | 12.9 | 18.5 | 23.7 | 25.5 | 16.5 | 25.4 |
| C | 10.8 | 13.8 | 25.3 | 25.4 | 23.0 | 23.2 | 32.2 |
| D | 10.9 | 13.3 | 20.2 | 24.5 | 23.8 | 17.8 | 28.9 |
| C1 | 9.5 | 12.1 | 22.3 | 22.3 | 20.2 | 20.4 | 28.3 |
| D1 | 9.5 | 11.6 | 17.6 | 21.4 | 20.8 | 15.6 | 25.3 |

### Return at 1% risk per trade (compounded inside the year)

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| A | +42% | +393% | +121% | +195% | +142% | +79% | +215% |
| B | +24% | +371% | +123% | +194% | +86% | +125% | +245% |
| C | +44% | +547% | +137% | +222% | +181% | +117% | +240% |
| D | +27% | +533% | +119% | +201% | +134% | +149% | +267% |
| C1 | +38% | +428% | +115% | +183% | +150% | +99% | +197% |
| D1 | +23% | +412% | +100% | +165% | +112% | +123% | +216% |

### Worst fall inside the year at 1% risk

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| A | 10% | 13% | 24% | 24% | 24% | 22% | 24% |
| B | 10% | 12% | 17% | 21% | 23% | 15% | 23% |
| C | 10% | 13% | 23% | 23% | 21% | 21% | 28% |
| D | 10% | 13% | 19% | 22% | 22% | 17% | 26% |
| C1 | 9% | 12% | 20% | 20% | 19% | 19% | 25% |
| D1 | 9% | 11% | 17% | 20% | 19% | 15% | 23% |

### Trades

| Version | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| A | 93 | 208 | 233 | 294 | 307 | 288 | 285 |
| B | 90 | 192 | 212 | 262 | 292 | 257 | 257 |
| C | 93 | 208 | 233 | 294 | 307 | 288 | 285 |
| D | 93 | 202 | 217 | 269 | 299 | 270 | 273 |
| C1 | 93 | 208 | 233 | 294 | 307 | 288 | 285 |
| D1 | 93 | 202 | 217 | 269 | 299 | 270 | 273 |

## Walk-forward (the most realistic test)

On every 1 January the whole selection is run again on past data only, and the winner is traded for that year. "C" = procedure winner, "D" = winner joined with the best Intensity setting of that date. Years are by entry date.

| Year | C used | D used |
|---|---|---|
| 2022 | (nothing qualified: today's rules) | II(10)>0.05 half |
| 2023 | time exit 48 + max 4 per direction | II(21)>-0.05 half + time exit 48 + max 4 per direction |
| 2024 | ADX>27 half | II(21)>0 S only skip + ADX>27 half |
| 2025 | (nothing qualified: today's rules) | II(21)>0 S only skip |
| 2026 | ADX>27 half + same-direction size 0.15 | II(21)>-0.05 half + ADX>27 half + same-direction size 0.15 |

| Version | Total R 2022-26 | Max drawdown closed | Max drawdown with open trades | R / drawdown | Return at 1% risk | Worst fall at 1% risk | 2022 R | 2023 R | 2024 R | 2025 R | 2026 R | 2022 DD | 2023 DD | 2024 DD | 2025 DD | 2026 DD |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BB-CORE today | +489 | 27.2 | 45.4 | 10.8 | +8630% | 24% | +83 | +122 | +95 | +64 | +126 | 30.6 | 45.4 | 34.9 | 34.6 | 30.3 |
| walk-forward C | +495 | 28.6 | 41.3 | 12.0 | +9041% | 26% | +83 | +89 | +110 | +63 | +150 | 30.6 | 41.3 | 30.7 | 34.6 | 32.6 |
| walk-forward D (with Intensity) | +507 | 29.6 | 40.7 | 12.5 | +10107% | 26% | +72 | +103 | +91 | +78 | +163 | 30.1 | 40.7 | 29.8 | 30.5 | 30.8 |

## Stress tests, unseen years only (2024 to Nov 2026)

### Double fees and slippage

| Case | Total R | DD closed | DD with open trades | R / drawdown |
|---|---|---|---|---|
| A | +256 | 29.3 | 37.3 | 6.9 |
| B | +263 | 27.8 | 37.2 | 7.1 |
| C | +302 | 34.8 | 40.8 | 7.4 |
| D | +306 | 31.5 | 37.1 | 8.2 |

### Orders filled 2 minutes late (real 1-minute prices)

| Case | Total R | DD closed | DD with open trades | R / drawdown |
|---|---|---|---|---|
| A | +254 | 29.2 | 36.8 | 6.9 |
| B | +261 | 26.2 | 35.4 | 7.4 |
| C | +296 | 32.8 | 41.2 | 7.2 |
| D | +302 | 29.5 | 38.3 | 7.9 |

1-minute price found for 99.9% of entries.

### Neighbour settings (shown for stability, not used to choose)

| Case | Total R | DD closed | DD with open trades | R / drawdown |
|---|---|---|---|---|
| A today | +285 | 27.0 | 34.9 | 8.2 |
| ADX>22 half | +322 | 29.8 | 45.9 | 7.0 |
| ADX>25 half | +329 | 31.1 | 41.1 | 8.0 |
| ADX>27 half | +331 | 32.2 | 39.5 | 8.4 |
| ADX>30 half | +311 | 31.7 | 37.5 | 8.3 |
| ADX>35 half | +300 | 29.1 | 36.1 | 8.3 |
| ADX>40 half | +294 | 26.3 | 35.5 | 8.3 |
| D with Intensity length 10 | +316 | 32.2 | 36.9 | 8.6 |
| D with Intensity length 14 | +295 | 31.7 | 36.7 | 8.1 |
| D with Intensity length 21 | +333 | 28.9 | 35.9 | 9.3 |
| D with Intensity length 28 | +299 | 29.0 | 38.7 | 7.7 |
| D with Intensity length 35 | +294 | 29.3 | 38.5 | 7.6 |

### Leave one coin out

| Without | A: R / DDopen | C: R / DDopen | D: R / DDopen |
|---|---|---|---|
| SOL | +251 / 28.5 | +282 / 32.0 | +275 / 31.4 |
| ZEC | +228 / 37.3 | +258 / 38.2 | +271 / 35.0 |
| NEAR | +225 / 32.2 | +265 / 34.4 | +266 / 30.6 |
| ADA | +246 / 30.4 | +295 / 35.1 | +302 / 31.5 |
| GALA | +235 / 29.9 | +276 / 31.7 | +278 / 31.1 |
| ARB | +238 / 28.5 | +278 / 30.5 | +273 / 27.7 |

### 300 random baskets of 6 other coins (unseen years 2024-26, other coins)

| Version | More R than today | Smaller drawdown (open) | Better R / drawdown | Both more R and smaller drawdown | Median R | Median drawdown (open) |
|---|---|---|---|---|---|---|
| A today | | | | | +95 | 64.2 |
| B | 42% | 88% | 56% | 39% | +83 | 56.9 |
| C | 71% | 44% | 66% | 34% | +100 | 65.2 |
| D | 63% | 75% | 66% | 54% | +99 | 59.8 |

### 300 random baskets of 6 other coins (all years, other coins)

| Version | More R than today | Smaller drawdown (open) | Better R / drawdown | Both more R and smaller drawdown | Median R | Median drawdown (open) |
|---|---|---|---|---|---|---|
| A today | | | | | +232 | 80.6 |
| B | 21% | 74% | 38% | 19% | +200 | 74.8 |
| C | 91% | 47% | 80% | 45% | +255 | 80.1 |
| D | 49% | 57% | 51% | 31% | +233 | 79.5 |

## Risk actually used (all years)

| Version | Average risk per trade | Largest risk per trade | Trades at reduced risk |
|---|---|---|---|
| A | 1.00x | 1.00x | 0% |
| B | 1.00x | 1.00x | 0% |
| C | 0.99x | 1.14x | 25% |
| D | 1.00x | 1.15x | 26% |
| C1 | 0.87x | 1.00x | 25% |
| D1 | 0.87x | 1.00x | 26% |

## Luck test (closed trades)

Take BB-CORE's own trades and give the same number of reduced and skipped sizes to trades picked at random (20,000 draws).

| Version | Window | Total R | Drawdown | Random picks with at least this R | with at least this R / drawdown | with both |
|---|---|---|---|---|---|---|
| B | 2024-26 unseen | 288 | 25.5 | 0.7% | 10.6% | 0.6% |
| B | all years | 689 | 25.5 | 0.0% | 2.0% | 0.0% |
| C1 | 2024-26 unseen | 291 | 28.3 | 0.2% | 35.2% | 0.2% |
| C1 | all years | 708 | 28.3 | 0.0% | 17.5% | 0.0% |
| D1 | 2024-26 unseen | 291 | 25.3 | 0.1% | 8.6% | 0.1% |
| D1 | all years | 677 | 25.3 | 0.0% | 2.6% | 0.0% |

## Same drawdown comparison

BB-CORE today scaled down or up until its drawdown equals the version's drawdown: how much R would each earn?

| Version | Window | Drawdown measure | Version R | BB-CORE R at the same drawdown | Version ahead by |
|---|---|---|---|---|---|
| B | 2024-26 unseen | closed | 288 | 269 | 7% |
| B | 2024-26 unseen | with open trades | 288 | 285 | 1% |
| B | all years | closed | 689 | 663 | 4% |
| B | all years | with open trades | 689 | 544 | 27% |
| C1 | 2024-26 unseen | closed | 291 | 298 | -2% |
| C1 | 2024-26 unseen | with open trades | 291 | 283 | 3% |
| C1 | all years | closed | 708 | 735 | -4% |
| C1 | all years | with open trades | 708 | 541 | 31% |
| D1 | 2024-26 unseen | closed | 291 | 266 | 9% |
| D1 | 2024-26 unseen | with open trades | 291 | 256 | 14% |
| D1 | all years | closed | 677 | 656 | 3% |
| D1 | all years | with open trades | 677 | 489 | 38% |
