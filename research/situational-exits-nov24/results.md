# Situational early / late closes (Nov 24 2026)

Same entries and stops as the live bots (live coins, 4h, Jan 2020 -> Nov 12 2026, standard costs + real funding). Only WHEN a trade is closed changes. E = early close, L = late (hold longer). Fills at the next open after the candle that triggered the rule.
"Better" = more profit AND not a deeper drop. Halves: 2020-22 | 2023-26.

## BB-CORE

| Rule | Trades | Total R | vs today | Drop (R) | Win % | Losing months | 2020-22 | 2023-26 | Without best 10 | Years up | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **TODAY (live rules)** | 1537 | +663 | +0 | 31 | 36% | 34% | +324 | +340 | +448 | 7/7 | — |
| E  close every trade before the weekend (Fri 20:00 UTC) | 2025 | +367 | -296 | 38 | 40% | 43% | +206 | +161 | +225 | 7/7 | worse |
| E  close before weekend only if in profit | 1929 | +380 | -283 | 35 | 44% | 42% | +215 | +166 | +238 | 7/7 | worse |
| E  close before weekend only if losing | 1620 | +642 | -21 | 33 | 33% | 34% | +323 | +319 | +427 | 7/7 | worse |
| E  cut a loser: after 12 candles if under -0.3R | 1676 | +617 | -46 | 29 | 29% | 36% | +330 | +287 | +409 | 7/7 | worse |
| E  cut a loser: after 24 candles if under -0.5R | 1553 | +673 | +10 | 31 | 35% | 33% | +322 | +351 | +458 | 7/7 | mixed |
| E  cut a loser: after 24 candles if under 0R | 1628 | +650 | -13 | 31 | 29% | 33% | +309 | +342 | +435 | 7/7 | worse |
| E  BTC trend flips against the trade -> close | 1603 | +590 | -73 | 32 | 36% | 39% | +269 | +321 | +428 | 7/7 | worse |
| E  BTC flips against and trade in profit -> close | 1581 | +595 | -68 | 32 | 38% | 35% | +274 | +321 | +433 | 7/7 | worse |
| E  one candle > 2.5 ATR against us -> close | 1537 | +663 | -1 | 31 | 37% | 34% | +325 | +338 | +447 | 7/7 | worse |
| E  one candle > 2 ATR against us, only if in profit | 1539 | +670 | +6 | 31 | 37% | 33% | +324 | +346 | +454 | 7/7 | mixed |
| E  in small profit (<1R) after 24 candles -> bank it | 1767 | +597 | -67 | 37 | 46% | 37% | +302 | +295 | +376 | 7/7 | worse |
| E  winning but last 6 candles went against us -> close | 2149 | +273 | -391 | 48 | 56% | 35% | +115 | +158 | +168 | 7/7 | worse |
| L  time exit: if >= +0.5R, hold 12 more candles | 1439 | +638 | -25 | 33 | 35% | 29% | +307 | +332 | +438 | 7/7 | worse |
| L  time exit: if >= +1R, hold 24 more candles | 1394 | +702 | +38 | 37 | 34% | 31% | +381 | +320 | +420 | 7/7 | mixed |
| L  time exit: if >= +2R, hold 48 more candles | 1365 | +752 | +89 | 32 | 36% | 33% | +422 | +330 | +434 | 7/7 | mixed |
| L  time exit: if > 0R, hold 12 more | 1432 | +611 | -52 | 33 | 33% | 31% | +292 | +319 | +411 | 7/7 | worse |

Years today: 2020 +79, 2021 +171, 2022 +73, 2023 +81, 2024 +66, 2025 +88, 2026 +105

## I-CORE

| Rule | Trades | Total R | vs today | Drop (R) | Win % | Losing months | 2020-22 | 2023-26 | Without best 10 | Years up | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **TODAY (live rules)** | 769 | +697 | +0 | 33 | 33% | 45% | +261 | +436 | +222 | 7/7 | — |
| E  close every trade before the weekend | 1238 | +174 | -523 | 41 | 41% | 46% | +115 | +59 | +80 | 7/7 | worse |
| E  close before weekend only if in profit | 1146 | +162 | -535 | 45 | 46% | 49% | +107 | +55 | +68 | 6/7 | worse |
| E  close before weekend only if losing | 843 | +719 | +22 | 30 | 30% | 45% | +262 | +457 | +242 | 7/7 | **BETTER both halves** |
| E  cut a loser: after 12 candles if under -0.3R | 887 | +658 | -39 | 28 | 27% | 42% | +230 | +427 | +209 | 7/7 | safer, less profit |
| E  cut a loser: after 24 candles if under -0.5R | 804 | +709 | +12 | 34 | 32% | 42% | +251 | +458 | +232 | 7/7 | mixed |
| E  cut a loser: after 24 candles if under 0R | 882 | +665 | -32 | 39 | 27% | 45% | +211 | +454 | +194 | 7/7 | worse |
| E  BTC trend flips against the trade -> close | 860 | +627 | -70 | 26 | 34% | 46% | +183 | +444 | +205 | 7/7 | worse |
| E  BTC flips against and trade in profit -> close | 841 | +600 | -96 | 30 | 37% | 48% | +181 | +420 | +179 | 7/7 | worse |
| E  one candle > 2.5 ATR against us -> close | 772 | +700 | +3 | 32 | 34% | 43% | +262 | +438 | +225 | 7/7 | mixed |
| E  one candle > 2 ATR against us, only if in profit | 785 | +677 | -20 | 31 | 34% | 43% | +264 | +414 | +219 | 7/7 | worse |
| E  in small profit (<1R) after 24 candles -> bank it | 1027 | +356 | -341 | 47 | 46% | 46% | +110 | +246 | +26 | 7/7 | worse |
| E  winning but last 6 candles went against us -> close | 1287 | +58 | -638 | 38 | 56% | 51% | +31 | +27 | -21 | 5/7 | worse |
| L  hard cap: time exit at 96 candles (16d) | 895 | +529 | -168 | 30 | 33% | 34% | +246 | +283 | +263 | 7/7 | worse |
| L  hard cap: time exit at 192 candles (32d) | 791 | +621 | -76 | 35 | 33% | 45% | +265 | +356 | +215 | 7/7 | worse |

Years today: 2020 +46, 2021 +181, 2022 +34, 2023 +105, 2024 +93, 2025 +143, 2026 +94

## T-CORE

| Rule | Trades | Total R | vs today | Drop (R) | Win % | Losing months | 2020-22 | 2023-26 | Without best 10 | Years up | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **TODAY (live rules)** | 922 | +1081 | +0 | 50 | 22% | 47% | +378 | +704 | +413 | 6/7 | — |
| E  close every trade before the weekend | 2635 | +450 | -631 | 44 | 40% | 46% | +204 | +246 | +299 | 7/7 | worse |
| E  close before weekend only if in profit | 2501 | +448 | -633 | 44 | 43% | 42% | +209 | +239 | +297 | 7/7 | worse |
| E  close before weekend only if losing | 1013 | +1112 | +31 | 47 | 20% | 45% | +389 | +723 | +417 | 6/7 | **BETTER both halves** |
| E  cut a loser: after 12 candles if under -0.3R | 1103 | +1075 | -6 | 44 | 18% | 43% | +412 | +662 | +437 | 7/7 | worse |
| E  cut a loser: after 24 candles if under -0.5R | 975 | +1088 | +7 | 44 | 21% | 43% | +400 | +688 | +448 | 7/7 | mixed |
| E  cut a loser: after 24 candles if under 0R | 1126 | +1149 | +68 | 48 | 18% | 43% | +409 | +740 | +466 | 7/7 | **BETTER both halves** |
| E  BTC trend flips against the trade -> close | 1257 | +1048 | -33 | 42 | 27% | 51% | +320 | +729 | +427 | 7/7 | safer, less profit |
| E  BTC flips against and trade in profit -> close | 1226 | +1039 | -42 | 43 | 30% | 52% | +318 | +721 | +417 | 7/7 | worse |
| E  one candle > 2.5 ATR against us -> close | 983 | +1071 | -10 | 60 | 23% | 49% | +363 | +708 | +397 | 6/7 | worse |
| E  one candle > 2 ATR against us, only if in profit | 1086 | +940 | -141 | 60 | 26% | 43% | +339 | +601 | +377 | 7/7 | worse |
| E  in small profit (<1R) after 24 candles -> bank it | 1575 | +1160 | +79 | 55 | 47% | 49% | +376 | +784 | +420 | 7/7 | mixed |
| E  winning but last 6 candles went against us -> close | 2795 | +301 | -780 | 55 | 55% | 36% | +121 | +180 | +204 | 7/7 | worse |
| L  hard cap: time exit at 96 candles (16d) | 1603 | +809 | -272 | 64 | 29% | 33% | +328 | +481 | +536 | 7/7 | worse |
| L  hard cap: time exit at 192 candles (32d) | 1216 | +1041 | -41 | 61 | 23% | 42% | +402 | +639 | +640 | 7/7 | worse |

Years today: 2020 +101, 2021 +252, 2022 +25, 2023 -4, 2024 +314, 2025 +252, 2026 +141

## "What if some trades are closed early at a random time?" (random-early-close noise test, 25 draws each)

A chosen share of trades is closed at the close of a random candle 1-48 after entry (drawn without looking at how the trade ends; if the stop is hit first the trade is unchanged); the rest run as normal.

| Bot | Share closed early | Mean total R | Worst draw | Best draw | vs today (mean) | Mean drop | Years that stay positive (of 7) |
|---|---|---|---|---|---|---|---|
| BB-CORE | 10% | +638 | +558 | +688 | -25 (-4%) | 31 (today 31) | 7.0 |
| BB-CORE | 25% | +601 | +477 | +712 | -62 (-9%) | 30 (today 31) | 7.0 |
| BB-CORE | 50% | +536 | +425 | +616 | -128 (-19%) | 30 (today 31) | 7.0 |
| BB-CORE | 100% | +384 | +295 | +470 | -279 (-42%) | 28 (today 31) | 7.0 |
| I-CORE | 10% | +629 | +461 | +704 | -67 (-10%) | 33 (today 33) | 7.0 |
| I-CORE | 25% | +563 | +388 | +699 | -134 (-19%) | 32 (today 33) | 7.0 |
| I-CORE | 50% | +450 | +279 | +561 | -247 (-35%) | 29 (today 33) | 7.0 |
| I-CORE | 100% | +154 | +111 | +222 | -542 (-78%) | 26 (today 33) | 6.7 |
| T-CORE | 10% | +966 | +702 | +1113 | -115 (-11%) | 46 (today 50) | 6.6 |
| T-CORE | 25% | +842 | +580 | +1045 | -239 (-22%) | 44 (today 50) | 7.1 |
| T-CORE | 50% | +640 | +405 | +931 | -441 (-41%) | 39 (today 50) | 7.4 |
| T-CORE | 100% | +175 | +129 | +222 | -906 (-84%) | 30 (today 50) | 7.4 |

## Replay check (no future sight)

Each rule rerun with only the candles up to 6 random cut-offs per coin; trades closed before the cut compared with the full run.

160,939 trades compared across all rules -> 0 different: **PASS**
