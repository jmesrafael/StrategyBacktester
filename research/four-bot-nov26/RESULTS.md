# 3 live bots vs 4 new strategies, and a 4th bot at 25% each (Nov 26, 2026)

Same basis for all: entries from Jan 1 2020, exits to Nov 24 2026, open trades valued every hour. Live bots run their own coins (BB-CORE 6, I-CORE 6, T-CORE 8); each new strategy runs SOL, ZEC, NEAR, ADA, GALA, ARB. Money tests use live sizing (2.5% risk, 2% from $500 base, 1.5% from $1,000), shared sizing across sub-accounts, quarterly rebalance, MEXC minimum orders, start US$750.

R = profit or loss counted in units of the amount risked on a trade (+2R = made twice what was risked). Profit factor = money won ÷ money lost. Worst fall = biggest drop from a high point. Sharpe / Sortino = return compared with how bumpy it was (Sortino counts only the downward bumps); higher is better.

## Verdict

- **Best single strategy: a near tie.** BB-1H-WIDE (average rank 2.3) and BB-CORE (2.6), then BB-CORE 1h (3.2). Live BB-CORE and BB-1H-WIDE are near twins: profit factor 1.78 vs 1.77, R per R of fall 21.3 vs 21.4, and at the same risk +198% vs +195% in a middle year.
- **Adding a 4th bot at 25% each: no clear gain.** At the same typical fall, a middle 12 months gives +648% today, +675% with BB-1H-WIDE, +666% with BB-CORE 1h, +627% with ICHI-X4 and +536% with VOL-MOM-2H. Matched on the single worst fall instead, today is ahead of all four.
- **Equal split of the current 3 is slightly worse than 50/25/25:** deepest 12-month fall 59% vs 53%; it fell less than today in only 15% of 12-month runs.
- **Suggestion:** keep the 3 bots at 50/25/25. Paper-test ICHI-X4 (the new one that moves least like what you run) and BB-1H-WIDE, and decide with the BB-CORE v4 review around late February 2027. Do not add VOL-MOM-2H.

## Pick by what matters to you

| If you care most about | Winner | Number | The catch |
|---|---|---|---|
| Win rate | ICHI-X4 | 48% | Smallest edge: 0.14R per trade, profit factor 1.36 |
| Profit factor | T-CORE | 2.57 | Account falls 61% when run alone |
| Smallest account fall (alone) | BB-1H-WIDE | 35% | Earns less per year than BB-CORE (188% vs 238%, backtest) |
| Most growth (alone, full risk) | BB-CORE 1h | 289% a year | Falls 49%; the extra comes with extra risk |
| Most total R | T-CORE | +1105 | Gives back a lot while trades are open (171.1R) |
| Different from what you run | ICHI-X4 | link 0.07 | Positive in 10 of 18 losing months of the mix |

## Scorecard (bold = best on that line)

| Measure | BB-1H-WIDE | BB-CORE | BB-CORE 1h | I-CORE | ICHI-X4 | T-CORE | VOL-MOM-2H |
|---|---|---|---|---|---|---|---|
| Profit factor | 1.77 | 1.78 | 1.72 | 2.38 | 1.36 | **2.57** | 1.75 |
| R earned per R of worst fall | **21.4** | 21.3 | 16.6 | 9.3 | 6.6 | 6.5 | 9.5 |
| Account worst fall | **35%** | 39% | 49% | 46% | 38% | 61% | 59% |
| Growth per year ÷ worst fall | 5.3 | **6.1** | 5.9 | 5.8 | 1.2 | 4.5 | 2.2 |
| Sharpe | 1.96 | **2.05** | 2.03 | 1.94 | 1.31 | 1.77 | 1.43 |
| Sortino | 3.57 | **3.80** | 3.72 | 3.35 | 2.32 | 2.92 | 2.53 |
| Losing months | **33%** | 34% | **33%** | 39% | **33%** | 41% | 42% |
| Worst month | -19% | -24% | -23% | -22% | **-19%** | -41% | -24% |
| Worst 12-month run | **+42%** | +38% | +25% | -16% | -26% | -13% | -60% |
| 12-month return at the same risk | +195% | **+198%** | +188% | +182% | +76% | +86% | +63% |
| Profit kept at double costs | 94% | 92% | 93% | 97% | 83% | **97%** | 93% |
| 12 hold-out coins: R per R of fall | 4.6 | 4.7 | 4.3 | 2.8 | **5.6** | 2.2 | 4.0 |
| Since 2024: R per R of fall | 10.2 | 9.1 | **11.3** | 4.3 | 5.8 | 4.4 | 4.2 |
| Average rank (1 = best) | 2.3 | 2.6 | 3.2 | 4.1 | 4.8 | 5.0 | 5.8 |
| Measures won | 4 | 4 | 2 | 0 | 3 | 2 | 0 |

## All measures, each strategy on the coins it would run

| Measure | BB-1H-WIDE | BB-CORE | BB-CORE 1h | I-CORE | ICHI-X4 | T-CORE | VOL-MOM-2H |
|---|---|---|---|---|---|---|---|
| Timeframe | 1h | 4h | 1h | 4h | 4h | 4h | 2h |
| Status | new lead | LIVE (rules v4, x1.05) | paper bot | LIVE (rules v3) | new lead | LIVE (rules v3) | weak lead |
| Coins | 6 | 6 | 6 | 6 | 6 | 8 | 6 |
| Trades | 1,316 | 1,623 | 1,783 | 1,016 | 1,370 | 1,150 | 1,096 |
| Trades per month | 15.9 | 19.6 | 21.5 | 12.3 | 16.6 | 13.9 | 13.2 |
| Win rate | 39% | 38% | 36% | 32% | 48% | 37% | 27% |
| Average R per trade | 0.45 | 0.44 | 0.46 | 0.92 | 0.14 | 0.96 | 0.53 |
| Average win ÷ average loss | 2.74 | 2.92 | 3.11 | 5.10 | 1.49 | 4.36 | 4.82 |
| Profit factor | 1.77 | 1.78 | 1.72 | 2.38 | 1.36 | 2.57 | 1.75 |
| Total R | +589 | +711 | +815 | +933 | +195 | +1105 | +581 |
| Worst fall, closed trades (R) | 20.1 | 26.5 | 31.2 | 30.3 | 28.2 | 30.9 | 46.2 |
| Worst fall, open trades counted (R) | 27.5 | 33.4 | 49.1 | 100.8 | 29.5 | 171.1 | 61.2 |
| R ÷ worst fall (open) | 21.4 | 21.3 | 16.6 | 9.3 | 6.6 | 6.5 | 9.5 |
| Longest losing streak | 19 | 16 | 21 | 18 | 15 | 15 | 19 |
| Longest time under old high (days) | 130 | 167 | 102 | 322 | 494 | 414 | 385 |
| Losing months | 31% | 33% | 31% | 37% | 33% | 43% | 43% |
| Worst month (R) | -13 | -16 | -16 | -16 | -11 | -11 | -14 |
| Best month (R) | +40 | +55 | +66 | +159 | +21 | +241 | +89 |
| Positive years | 7/7 | 7/7 | 7/7 | 7/7 | 6/7 | 7/7 | 6/7 |
| Total R without best 10 trades | +441 | +491 | +601 | +371 | +135 | +391 | +167 |
| Longs / shorts (R) | +395 / +194 | +398 / +314 | +480 / +336 | +766 / +167 | +119 / +76 | +1017 / +88 | +512 / +69 |
| Average hold (days) | 5.1 | 4.4 | 4.6 | 8.2 | 1.8 | 11.0 | 4.7 |
| Total R at double costs | +554 | +658 | +757 | +901 | +161 | +1073 | +541 |
| Total R since 2024 | +280 | +305 | +393 | +431 | +115 | +754 | +249 |
| Worst fall since 2024, open (R) | 27.5 | 33.4 | 34.6 | 100.8 | 20.0 | 171.1 | 59.1 |

## All measures, all seven on the same 6 coins

| Measure | BB-1H-WIDE | BB-CORE | BB-CORE 1h | I-CORE | ICHI-X4 | T-CORE | VOL-MOM-2H |
|---|---|---|---|---|---|---|---|
| Timeframe | 1h | 4h | 1h | 4h | 4h | 4h | 2h |
| Status | new lead | LIVE (rules v4, x1.05) | paper bot | LIVE (rules v3) | new lead | LIVE (rules v3) | weak lead |
| Coins | 6 | 6 | 6 | 6 | 6 | 6 | 6 |
| Trades | 1,316 | 1,623 | 1,783 | 924 | 1,370 | 895 | 1,096 |
| Trades per month | 15.9 | 19.6 | 21.5 | 11.2 | 16.6 | 10.8 | 13.2 |
| Win rate | 39% | 38% | 36% | 32% | 48% | 38% | 27% |
| Average R per trade | 0.45 | 0.44 | 0.46 | 0.90 | 0.14 | 1.04 | 0.53 |
| Average win ÷ average loss | 2.74 | 2.92 | 3.11 | 5.05 | 1.49 | 4.47 | 4.82 |
| Profit factor | 1.77 | 1.78 | 1.72 | 2.36 | 1.36 | 2.70 | 1.75 |
| Total R | +589 | +711 | +815 | +832 | +195 | +928 | +581 |
| Worst fall, closed trades (R) | 20.1 | 26.5 | 31.2 | 32.9 | 28.2 | 27.0 | 46.2 |
| Worst fall, open trades counted (R) | 27.5 | 33.4 | 49.1 | 106.2 | 29.5 | 170.5 | 61.2 |
| R ÷ worst fall (open) | 21.4 | 21.3 | 16.6 | 7.8 | 6.6 | 5.4 | 9.5 |
| Longest losing streak | 19 | 16 | 21 | 19 | 15 | 16 | 19 |
| Longest time under old high (days) | 130 | 167 | 102 | 293 | 494 | 414 | 385 |
| Losing months | 31% | 33% | 31% | 41% | 33% | 53% | 43% |
| Worst month (R) | -13 | -16 | -16 | -12 | -11 | -16 | -14 |
| Best month (R) | +40 | +55 | +66 | +160 | +21 | +239 | +89 |
| Positive years | 7/7 | 7/7 | 7/7 | 7/7 | 6/7 | 7/7 | 6/7 |
| Total R without best 10 trades | +441 | +491 | +601 | +278 | +135 | +228 | +167 |
| Longs / shorts (R) | +395 / +194 | +398 / +314 | +480 / +336 | +695 / +137 | +119 / +76 | +845 / +83 | +512 / +69 |
| Average hold (days) | 5.1 | 4.4 | 4.6 | 8.1 | 1.8 | 10.9 | 4.7 |
| Total R at double costs | +554 | +658 | +757 | +806 | +161 | +904 | +541 |
| Total R since 2024 | +280 | +305 | +393 | +415 | +115 | +649 | +249 |
| Worst fall since 2024, open (R) | 27.5 | 33.4 | 34.6 | 106.2 | 20.0 | 170.5 | 59.1 |

## Money account, one strategy alone

| Money account (US$750 start, one bot alone) | BB-1H-WIDE | BB-CORE | BB-CORE 1h | I-CORE | ICHI-X4 | T-CORE | VOL-MOM-2H |
|---|---|---|---|---|---|---|---|
| Growth per year (backtest, not a forecast) | 188% | 238% | 289% | 267% | 46% | 278% | 128% |
| Worst fall, open trades counted | 35% | 39% | 49% | 46% | 38% | 61% | 59% |
| Growth per year ÷ worst fall | 5.3 | 6.1 | 5.9 | 5.8 | 1.2 | 4.5 | 2.2 |
| Sharpe (daily, yearly) | 1.96 | 2.05 | 2.03 | 1.94 | 1.31 | 1.77 | 1.43 |
| Sortino (daily, yearly) | 3.57 | 3.80 | 3.72 | 3.35 | 2.32 | 2.92 | 2.53 |
| Ulcer index (lower = calmer) | 0.14 | 0.16 | 0.19 | 0.21 | 0.13 | 0.29 | 0.29 |
| Profit factor (money) | 1.69 | 1.54 | 1.66 | 2.38 | 1.30 | 1.87 | 1.59 |
| Losing months | 33% | 34% | 33% | 39% | 33% | 41% | 42% |
| Worst month | -19% | -24% | -23% | -22% | -19% | -41% | -24% |
| Longest time under old high (days) | 130 | 182 | 160 | 185 | 511 | 275 | 473 |
| Orders too small / no margin | 0 | 0 | 0 | 0 | 0 | 6 | 0 |
| 12-month runs: middle return | +202% | +248% | +280% | +296% | +55% | +291% | +129% |
| 12-month runs: bad case (1 in 10) | +64% | +69% | +70% | +62% | +9% | +32% | +1% |
| 12-month runs: worst | +42% | +38% | +25% | -16% | -26% | -13% | -60% |
| 12-month runs ending in profit | 100% | 100% | 100% | 99% | 90% | 94% | 92% |
| 12-month runs: middle worst fall | 31% | 33% | 39% | 39% | 21% | 55% | 51% |
| 12-month runs: deepest fall | 41% | 43% | 58% | 49% | 48% | 66% | 64% |
| 12-month runs that fell over 40% | 1% | 7% | 35% | 46% | 6% | 97% | 80% |
| Same risk (typical fall 30%): middle 12-month return | +195% | +198% | +188% | +182% | +76% | +86% | +63% |
| Same risk: bad case (1 in 10) | +58% | +53% | +58% | +36% | -3% | +12% | +3% |
| Growth per year at double costs | 167% | 203% | 245% | 243% | 36% | 253% | 109% |

## R per year (own coins)

| Strategy | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB-1H-WIDE | +28 | +137 | +62 | +82 | +75 | +89 | +115 |
| BB-CORE | +24 | +190 | +77 | +114 | +84 | +89 | +132 |
| BB-CORE 1h | +54 | +164 | +114 | +91 | +110 | +109 | +174 |
| I-CORE | +41 | +243 | +73 | +145 | +94 | +179 | +158 |
| ICHI-X4 | +15 | +30 | +36 | -1 | +39 | +32 | +44 |
| T-CORE | +54 | +256 | +16 | +25 | +352 | +259 | +143 |
| VOL-MOM-2H | 0 | +135 | +58 | +140 | +76 | +72 | +101 |

## Money per year: return / worst fall inside the year

| Strategy | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB-1H-WIDE | +64% / 20% | +456% / 25% | +130% / 31% | +125% / 32% | +155% / 35% | +205% / 29% | +298% / 30% |
| BB-CORE | +48% / 30% | +925% / 23% | +148% / 30% | +245% / 33% | +176% / 36% | +183% / 31% | +334% / 35% |
| BB-CORE 1h | +139% / 30% | +548% / 28% | +321% / 35% | +108% / 49% | +253% / 39% | +247% / 35% | +606% / 35% |
| I-CORE | +89% / 39% | +961% / 37% | +185% / 36% | +227% / 39% | +107% / 39% | +360% / 34% | +339% / 43% |
| ICHI-X4 | +31% / 11% | +51% / 19% | +66% / 13% | -9% / 38% | +72% / 16% | +53% / 27% | +75% / 20% |
| T-CORE | +166% / 44% | +723% / 61% | +21% / 42% | +437% / 58% | +229% / 44% | +497% / 55% | +240% / 54% |
| VOL-MOM-2H | +4% / 48% | +247% / 45% | +124% / 28% | +217% / 59% | +77% / 51% | +134% / 50% | +177% / 45% |

## 12 hold-out coins (not used to tune)

| Measure | BB-1H-WIDE | BB-CORE | BB-CORE 1h | I-CORE | ICHI-X4 | T-CORE | VOL-MOM-2H |
|---|---|---|---|---|---|---|---|
| Timeframe | 1h | 4h | 1h | 4h | 4h | 4h | 2h |
| Status | new lead | LIVE (rules v4, x1.05) | paper bot | LIVE (rules v3) | new lead | LIVE (rules v3) | weak lead |
| Coins | 12 | 12 | 12 | 12 | 12 | 12 | 12 |
| Trades | 3,319 | 3,900 | 4,454 | 2,417 | 3,171 | 2,451 | 2,664 |
| Trades per month | 40.1 | 47.1 | 53.8 | 29.2 | 38.3 | 29.6 | 32.2 |
| Win rate | 34% | 32% | 30% | 27% | 47% | 31% | 25% |
| Average R per trade | 0.15 | 0.15 | 0.13 | 0.16 | 0.10 | 0.27 | 0.21 |
| Average win ÷ average loss | 2.43 | 2.64 | 2.78 | 3.31 | 1.38 | 3.16 | 3.94 |
| Profit factor | 1.23 | 1.24 | 1.19 | 1.23 | 1.25 | 1.39 | 1.29 |
| Total R | +492 | +574 | +590 | +396 | +311 | +662 | +572 |
| Worst fall, closed trades (R) | 81.8 | 107.0 | 101.4 | 120.4 | 42.2 | 112.4 | 99.4 |
| Worst fall, open trades counted (R) | 108.0 | 121.4 | 138.8 | 140.7 | 55.6 | 304.4 | 142.7 |
| R ÷ worst fall (open) | 4.6 | 4.7 | 4.3 | 2.8 | 5.6 | 2.2 | 4.0 |
| Longest losing streak | 31 | 47 | 41 | 34 | 18 | 44 | 45 |
| Longest time under old high (days) | 394 | 751 | 374 | 887 | 374 | 1,296 | 570 |
| Losing months | 48% | 43% | 45% | 46% | 36% | 52% | 51% |
| Worst month (R) | -44 | -40 | -48 | -44 | -19 | -43 | -38 |
| Best month (R) | +89 | +79 | +93 | +248 | +33 | +254 | +292 |
| Positive years | 7/7 | 6/7 | 6/7 | 6/7 | 7/7 | 5/7 | 7/7 |
| Total R without best 10 trades | +255 | +293 | +316 | -24 | +234 | -35 | +100 |
| Longs / shorts (R) | +316 / +176 | +266 / +308 | +386 / +204 | +355 / +41 | +134 / +177 | +746 / -84 | +442 / +131 |
| Average hold (days) | 4.7 | 4.1 | 4.3 | 6.7 | 1.8 | 8.6 | 4.1 |
| Total R at double costs | +386 | +437 | +419 | +296 | +212 | +586 | +458 |
| Total R since 2024 | +153 | +235 | +149 | +221 | +146 | +284 | +389 |
| Worst fall since 2024, open (R) | 94.3 | 95.6 | 113.9 | 134.0 | 55.6 | 304.4 | 122.7 |

## R per year on the 12 hold-out coins

| Strategy | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB-1H-WIDE | +68 | +164 | +59 | +48 | +117 | +6 | +30 |
| BB-CORE | +80 | +188 | +86 | -15 | +131 | +70 | +34 |
| BB-CORE 1h | +97 | +164 | +146 | +34 | +142 | -44 | +51 |
| I-CORE | +0 | +162 | +0 | +12 | +233 | +12 | -24 |
| ICHI-X4 | +46 | +37 | +49 | +32 | +44 | +49 | +53 |
| T-CORE | +19 | +364 | -36 | +30 | +305 | -51 | +30 |
| VOL-MOM-2H | +36 | +103 | +26 | +18 | +296 | +53 | +41 |

## 12 main coins

| Measure | BB-1H-WIDE | BB-CORE | BB-CORE 1h | I-CORE | ICHI-X4 | T-CORE | VOL-MOM-2H |
|---|---|---|---|---|---|---|---|
| Timeframe | 1h | 4h | 1h | 4h | 4h | 4h | 2h |
| Status | new lead | LIVE (rules v4, x1.05) | paper bot | LIVE (rules v3) | new lead | LIVE (rules v3) | weak lead |
| Coins | 12 | 12 | 12 | 12 | 12 | 12 | 12 |
| Trades | 3,137 | 3,740 | 4,208 | 2,298 | 3,175 | 2,090 | 2,679 |
| Trades per month | 37.9 | 45.2 | 50.8 | 27.8 | 38.4 | 25.3 | 32.4 |
| Win rate | 36% | 35% | 33% | 29% | 47% | 36% | 26% |
| Average R per trade | 0.37 | 0.37 | 0.38 | 0.59 | 0.12 | 1.04 | 0.49 |
| Average win ÷ average loss | 2.78 | 3.02 | 3.20 | 4.48 | 1.47 | 4.71 | 4.72 |
| Profit factor | 1.59 | 1.63 | 1.56 | 1.85 | 1.31 | 2.63 | 1.68 |
| Total R | +1157 | +1401 | +1594 | +1364 | +381 | +2164 | +1321 |
| Worst fall, closed trades (R) | 66.7 | 63.2 | 89.1 | 89.9 | 29.8 | 68.4 | 95.2 |
| Worst fall, open trades counted (R) | 80.4 | 72.1 | 102.2 | 144.6 | 38.2 | 331.6 | 123.1 |
| R ÷ worst fall (open) | 14.4 | 19.4 | 15.6 | 9.4 | 10.0 | 6.5 | 10.7 |
| Longest losing streak | 25 | 39 | 37 | 31 | 21 | 18 | 51 |
| Longest time under old high (days) | 196 | 136 | 216 | 505 | 151 | 494 | 295 |
| Losing months | 34% | 34% | 34% | 41% | 36% | 46% | 43% |
| Worst month (R) | -31 | -32 | -48 | -39 | -21 | -36 | -36 |
| Best month (R) | +100 | +105 | +157 | +202 | +40 | +366 | +205 |
| Positive years | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 6/7 | 7/7 |
| Total R without best 10 trades | +894 | +1088 | +1198 | +702 | +298 | +996 | +744 |
| Longs / shorts (R) | +874 / +283 | +961 / +440 | +1144 / +450 | +1190 / +174 | +266 / +114 | +2115 / +49 | +1156 / +165 |
| Average hold (days) | 4.9 | 4.2 | 4.4 | 7.3 | 1.8 | 10.4 | 4.4 |
| Total R at double costs | +1046 | +1257 | +1413 | +1282 | +283 | +2091 | +1200 |
| Total R since 2024 | +388 | +545 | +630 | +664 | +191 | +1073 | +644 |
| Worst fall since 2024, open (R) | 80.4 | 59.2 | 101.6 | 144.6 | 38.2 | 188.2 | 120.2 |

## Do they move together? (monthly R, 1.00 = identical)

|  | BB-1H-WIDE | BB-CORE | BB-CORE 1h | I-CORE | ICHI-X4 | T-CORE | VOL-MOM-2H |
|---|---|---|---|---|---|---|---|
| BB-1H-WIDE | 1.00 | 0.84 | 0.91 | 0.23 | 0.31 | -0.07 | 0.43 |
| BB-CORE | 0.84 | 1.00 | 0.91 | 0.22 | 0.26 | -0.06 | 0.38 |
| BB-CORE 1h | 0.91 | 0.91 | 1.00 | 0.24 | 0.31 | -0.05 | 0.44 |
| I-CORE | 0.23 | 0.22 | 0.24 | 1.00 | -0.02 | 0.59 | 0.35 |
| ICHI-X4 | 0.31 | 0.26 | 0.31 | -0.02 | 1.00 | -0.06 | -0.08 |
| T-CORE | -0.07 | -0.06 | -0.05 | 0.59 | -0.06 | 1.00 | 0.01 |
| VOL-MOM-2H | 0.43 | 0.38 | 0.44 | 0.35 | -0.08 | 0.01 | 1.00 |

## Against today's mix

| Strategy | Monthly link with today's 3-bot mix | Trades taken while another live bot already holds the same coin and side | Losing months of the mix where this one made money | Its total R in those months |
|---|---|---|---|---|
| BB-1H-WIDE | 0.42 | 74% | 2 of 18 | -71 |
| BB-CORE | 0.49 | 82% | 2 of 18 | -76 |
| BB-CORE 1h | 0.46 | 67% | 2 of 18 | -89 |
| I-CORE | 0.83 | 67% | 3 of 18 | -104 |
| ICHI-X4 | 0.07 | 76% | 10 of 18 | +4 |
| T-CORE | 0.79 | 76% | 6 of 18 | -64 |
| VOL-MOM-2H | 0.30 | 79% | 5 of 18 | -57 |

## Portfolios: add a 4th bot

| Measure | Today 50/25/25 | Equal 3 (33 each) | + BB-1H-WIDE (25 each) | + BB-CORE 1h (25 each) | + ICHI-X4 (25 each) | + VOL-MOM-2H (25 each) |
|---|---|---|---|---|---|---|
| Growth per year (backtest) | 308% | 317% | 297% | 331% | 252% | 274% |
| Worst fall, open trades counted | 40% | 41% | 39% | 40% | 36% | 46% |
| Growth per year ÷ worst fall | 7.7 | 7.7 | 7.7 | 8.4 | 7.0 | 5.9 |
| Sharpe | 2.13 | 2.07 | 2.11 | 2.13 | 2.10 | 1.99 |
| Sortino | 3.76 | 3.61 | 3.73 | 3.80 | 3.65 | 3.50 |
| Ulcer index (lower = calmer) | 0.19 | 0.21 | 0.19 | 0.19 | 0.17 | 0.21 |
| Profit factor (money) | 1.78 | 1.89 | 1.84 | 1.81 | 1.80 | 1.84 |
| Win rate | 36% | 36% | 37% | 36% | 39% | 34% |
| Trades | 3,789 | 3,788 | 5,105 | 5,572 | 5,159 | 4,884 |
| Losing months | 40% | 41% | 39% | 40% | 36% | 40% |
| Worst month | -29% | -29% | -27% | -28% | -23% | -25% |
| Longest time under old high (days) | 212 | 209 | 212 | 184 | 194 | 225 |
| 12-month runs: middle return | +542% | +565% | +555% | +598% | +444% | +492% |
| 12-month runs: bad case (1 in 10) | +132% | +125% | +131% | +139% | +111% | +111% |
| 12-month runs: worst | +8% | -3% | +12% | +4% | +17% | -3% |
| 12-month runs ending in profit | 100% | 97% | 100% | 100% | 100% | 97% |
| 12-month runs: middle worst fall | 43% | 47% | 43% | 45% | 42% | 48% |
| 12-month runs: deepest fall | 53% | 59% | 55% | 59% | 53% | 63% |
| 12-month runs that fell over 40% | 76% | 75% | 76% | 73% | 62% | 79% |
| Runs that earned more than today | - | 52% | 58% | 77% | 28% | 27% |
| Runs that fell less than today | - | 15% | 25% | 15% | 65% | 10% |
| Runs starting 2024 or later: middle return / fall | +546% / 44% | +587% / 47% | +600% / 44% | +629% / 46% | +484% / 42% | +453% / 49% |
| Since 2024: growth per year / worst fall | 349% / 43% | 362% / 45% | 360% / 47% | 400% / 48% | 314% / 39% | 317% / 54% |
| Double costs: growth per year / worst fall | 277% / 41% | 283% / 43% | 267% / 39% | 294% / 41% | 225% / 38% | 245% / 48% |
| SAME RISK (typical fall): middle 12-month return | +648% | +635% | +675% | +666% | +627% | +536% |
| SAME RISK (typical fall): bad case (1 in 10) | +117% | +109% | +124% | +133% | +125% | +97% |
| SAME RISK (single worst fall): growth per year | 558% | 488% | 548% | 535% | 486% | 362% |
| Reshuffled 2-year paths: earned more than today | - | 60% | 33% | 85% | 7% | 19% |
| Reshuffled 2-year paths: fell less than today (month-end values) | - | 10% | 66% | 55% | 85% | 43% |

## Portfolios per year: return / worst fall

| Mix | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| Today 50/25/25 | +133% / 37% | +1114% / 35% | +125% / 29% | +351% / 37% | +181% / 36% | +371% / 32% | +325% / 40% |
| Equal 3 (33 each) | +152% / 41% | +1120% / 39% | +115% / 30% | +367% / 41% | +180% / 36% | +421% / 33% | +319% / 41% |
| + BB-1H-WIDE (25 each) | +147% / 37% | +1023% / 35% | +120% / 27% | +306% / 37% | +174% / 36% | +379% / 31% | +315% / 39% |
| + BB-CORE 1h (25 each) | +182% / 38% | +1066% / 36% | +158% / 29% | +302% / 40% | +197% / 37% | +393% / 31% | +378% / 39% |
| + ICHI-X4 (25 each) | +131% / 36% | +826% / 34% | +106% / 25% | +247% / 35% | +154% / 28% | +329% / 30% | +253% / 35% |
| + VOL-MOM-2H (25 each) | +111% / 46% | +952% / 35% | +121% / 27% | +329% / 44% | +152% / 37% | +340% / 35% | +283% / 36% |

## Swaps: a new strategy replaces one live bot (12 tries picked after the fact, treat as ideas only)

| Swap (3 bots, 33 each) | Growth per year | Worst fall | Losing months | Worst month | Same risk (typical): 12-month return | Same risk (worst fall): growth per year |
|---|---|---|---|---|---|---|
| Today 50/25/25 | 308% | 40% | 40% | -29% | +648% | 558% |
| BB-1H-WIDE replaces BB-CORE | 290% | 41% | 39% | -27% | +525% | 457% |
| BB-1H-WIDE replaces I-CORE | 282% | 42% | 39% | -31% | +647% | 458% |
| BB-1H-WIDE replaces T-CORE | 267% | 36% | 33% | -20% | +647% | 548% |
| BB-CORE 1h replaces BB-CORE | 335% | 44% | 39% | -28% | +577% | 456% |
| BB-CORE 1h replaces I-CORE | 326% | 43% | 37% | -32% | +625% | 490% |
| BB-CORE 1h replaces T-CORE | 308% | 38% | 36% | -21% | +708% | 558% |
| ICHI-X4 replaces BB-CORE | 229% | 40% | 39% | -22% | +411% | 370% |
| ICHI-X4 replaces I-CORE | 223% | 37% | 35% | -25% | +577% | 402% |
| ICHI-X4 replaces T-CORE | 205% | 33% | 35% | -14% | +610% | 512% |
| VOL-MOM-2H replaces BB-CORE | 260% | 52% | 41% | -23% | +376% | 279% |
| VOL-MOM-2H replaces I-CORE | 258% | 45% | 43% | -28% | +441% | 327% |
| VOL-MOM-2H replaces T-CORE | 242% | 43% | 39% | -17% | +444% | 384% |

## Can a small account still place the orders? (12-month runs from 2024)

| Starting money | Today 50/25/25 | Equal 3 (33 each) | + BB-1H-WIDE (25 each) | + BB-CORE 1h (25 each) | + ICHI-X4 (25 each) | + VOL-MOM-2H (25 each) |
|---|---|---|---|---|---|---|
| US$250 | 0.8% skipped, fall 50% | 1.2% skipped, fall 52% | 0.7% skipped, fall 47% | 0.7% skipped, fall 51% | 0.9% skipped, fall 44% | 1.2% skipped, fall 51% |
| US$750 | 0.5% skipped, fall 44% | 0.5% skipped, fall 47% | 0.3% skipped, fall 44% | 0.3% skipped, fall 46% | 0.4% skipped, fall 42% | 0.6% skipped, fall 49% |
| US$2,000 | 0.1% skipped, fall 37% | 0.0% skipped, fall 40% | 0.0% skipped, fall 37% | 0.0% skipped, fall 39% | 0.0% skipped, fall 36% | 0.1% skipped, fall 42% |
| US$5,000 | 0.0% skipped, fall 35% | 0.0% skipped, fall 38% | 0.0% skipped, fall 36% | 0.0% skipped, fall 38% | 0.0% skipped, fall 33% | 0.0% skipped, fall 36% |

## Check against published numbers

| Number already in the repo | Published | Re-run here |
|---|---|---|
| BB-1H-WIDE, main 12 | +1157 | +1157 |
| BB-CORE 1h, hold-out 12 | +590 | +590 |
| ICHI-X4, main 12 | +381 | +381 |
| ICHI-X4, hold-out 12 | +311 | +311 |
| VOL-MOM-2H, main 12 | +1321 | +1321 |
| VOL-MOM-2H, hold-out 12 | +572 | +572 |

## Read before trusting

- Growth percentages are what the backtest compounds to with perfect fills at any size. They are far above what to expect live. Use them only to compare one line with another.
- On the 12 hold-out coins (not used to tune), every strategy is much weaker (profit factor about 1.19 to 1.39 instead of 1.36 to 2.57). Expect something closer to that.
- None of the 7 has a clean out-of-sample test. The live rules (v3, v4) were chosen in November 2026 on this history; the new ones were picked on 12 main coins and filtered with the 12 hold-out coins.
- The 71 twelve-month runs overlap (about 7 separate years), so gaps of a few percent are noise.
- Binance candles and funding, fee 0.05% + slippage 0.02% per side. MEXC fills and funding differ. Trades still open on Nov 24 2026 are not counted.
- The Nov 26 hunt files compare against the old BB-CORE rules (2.0 bands, 48 candles). Here BB-CORE uses the live v4 rules, so its numbers differ from those files.
- Not tested: a 4th bot on other coins than the 6 below, other weights than the ones shown, exchange limits of a 4th sub-account.

Scripts: `study.js` (numbers, `results.json`), `report.js` (this file and `report.html`).
