# BB-CORE 4H vs 1H: every version side by side, and with I-CORE + T-CORE (Nov 26, 2026)

Same basis for all: entries from Jan 1 2020, exits to Nov 24 2026, open trades valued every hour, Binance candles + real funding, fee 0.05% + slippage 0.02% per side. All four BB versions trade SOL, ZEC, NEAR, ADA, GALA, ARB; I-CORE 6 coins, T-CORE 8. Money tests use live sizing (2.5% risk, 2% from $500 base, 1.5% from $1,000), shared sizing across sub-accounts, quarterly rebalance, MEXC minimum orders, start US$750.

R = profit or loss in units of the amount risked (+2R = made twice what was risked). Profit factor = money won ÷ money lost. Worst fall = biggest drop from a high point, open trades counted. Same typical fall / same worst fall = risk per trade turned up or down until each one falls the same, then compare what it earns.

## Verdict

- **Best BB version alone: live 4H v4 and 1H WIDE, near tie.** Average rank 1.8 (WIDE) and 1.9 (v4), then 1H 2.6 and old 4H 3.4. v4 earns the most at the same fall (+198% middle year at the same typical fall, 245% a year at the same 40% worst fall, vs WIDE +195% / 226% and 1H +188% / 194%). WIDE falls least (35% vs 39%).
- **BB 1H makes the most raw R (+815 vs +711) but only because it takes more risk:** worst fall 49% vs 39%, deepest 12-month fall 58% vs 43%. At equal fall it is behind v4. On the 12 hold-out coins it lost in 2025 (-44R).
- **Nothing beats v4 clearly.** The old 4H rules are last on the 6 live coins but best on the 12 hold-out coins (R per R of fall 5.0 vs v4 4.7, 7/7 positive years vs 6/7), a sign that part of v4's lead over the old rules is fitted to the coins it was tuned on.
- **Adding a BB bot to the 3 live bots: small gain at best.** Matched to today's typical fall: today +648%, + 1H +666%, + WIDE +675%, + 1H + WIDE (5 bots) +705%. Matched to today's single worst fall: today 558% a year, 5 bots 571%, + WIDE 548%, + 1H 535%. Only the 5-bot mix is ahead on both, by 2 to 9%, inside the noise of 7 overlapping years.
- **Swapping v4 out is worse:** 1H instead of v4 grows faster at live risk (339% vs 308% a year) but falls deeper (12-month deepest 59% vs 53%) and earns less at the same worst fall (500% vs 558%). WIDE instead of v4: 514%. Old 4H instead: 427%.
- **Suggestion:** keep 50/25/25 with v4. The extra BB bots move almost exactly like v4 month by month (link 0.84 to 0.91, 1.00 = identical), so they add copies, not variety. Let the BB 1H (bb1h) paper bot and the WIDE paper test run and decide at the late-February 2027 v4 review.

## Scorecard (bold = best on that line)

| Measure | BB 1H WIDE | BB 4H v4 (live) | BB 1H | BB 4H old |
|---|---|---|---|---|
| Profit factor | 1.77 | **1.78** | 1.72 | 1.68 |
| Win rate | **39%** | 38% | 36% | 37% |
| R earned per R of worst fall | **21.4** | 21.3 | 16.6 | 15.7 |
| Account worst fall (alone, live sizing) | **35%** | 39% | 49% | 44% |
| Growth per year ÷ worst fall | 5.3 | **6.1** | 5.9 | 4.5 |
| Sharpe | 1.96 | **2.05** | 2.03 | 1.82 |
| Sortino | 3.57 | **3.80** | 3.72 | 3.29 |
| Losing months | **33%** | 34% | **33%** | 35% |
| Worst month | **-19%** | -24% | -23% | -32% |
| Worst 12-month run | **+42%** | +38% | +25% | +20% |
| 12-month return at the same typical fall | +195% | **+198%** | +188% | +144% |
| Growth per year at the same worst fall (40%) | 226% | **245%** | 194% | 166% |
| Profit kept at double costs | **94%** | 92% | 93% | 93% |
| 12 main coins: R per R of fall | 14.4 | **19.4** | 15.6 | 13.5 |
| 12 hold-out coins: R per R of fall | 4.6 | 4.7 | 4.3 | **5.0** |
| 12 hold-out coins: positive years | **7/7** | 6/7 | 6/7 | **7/7** |
| Since 2024: R per R of fall | 10.2 | 9.1 | **11.3** | 8.3 |
| Average rank (1 = best) | 1.8 | 1.9 | 2.6 | 3.4 |
| Measures won | 8 | 7 | 2 | 2 |

## All measures, 6 live coins

| Measure | BB 1H WIDE | BB 4H v4 (live) | BB 1H | BB 4H old |
|---|---|---|---|---|
| Timeframe | 1h | 4h | 1h | 4h |
| Status | new lead (2.6σ) | LIVE (rules v4, x1.05) | paper bot (bb1h) | old rules (2.0σ, 48 candles) |
| Coins | 6 | 6 | 6 | 6 |
| Trades | 1,316 | 1,623 | 1,783 | 1,514 |
| Trades per month | 15.9 | 19.6 | 21.5 | 18.3 |
| Win rate | 39% | 38% | 36% | 37% |
| Average R per trade | 0.45 | 0.44 | 0.46 | 0.42 |
| Average win ÷ average loss | 2.74 | 2.92 | 3.11 | 2.90 |
| Profit factor | 1.77 | 1.78 | 1.72 | 1.68 |
| Total R | +589 | +711 | +815 | +641 |
| Worst fall, closed trades (R) | 20.1 | 26.5 | 31.2 | 31.2 |
| Worst fall, open trades counted (R) | 27.5 | 33.4 | 49.1 | 40.7 |
| R ÷ worst fall (open) | 21.4 | 21.3 | 16.6 | 15.7 |
| Longest losing streak | 19 | 16 | 21 | 20 |
| Longest time under old high (days) | 130 | 167 | 102 | 230 |
| Losing months | 31% | 33% | 31% | 30% |
| Worst month (R) | -13 | -16 | -16 | -25 |
| Best month (R) | +40 | +55 | +66 | +61 |
| Positive years | 7/7 | 7/7 | 7/7 | 7/7 |
| Total R without best 10 trades | +441 | +491 | +601 | +426 |
| Longs / shorts (R) | +395 / +194 | +398 / +314 | +480 / +336 | +370 / +270 |
| Average hold (days) | 5.1 | 4.4 | 4.6 | 4.9 |
| Total R at double costs | +554 | +658 | +757 | +595 |
| Total R since 2024 | +280 | +305 | +393 | +275 |
| Worst fall since 2024, open (R) | 27.5 | 33.4 | 34.6 | 33.2 |

## Money account, one BB version alone

| Money account (US$750 start, one bot alone) | BB 1H WIDE | BB 4H v4 (live) | BB 1H | BB 4H old |
|---|---|---|---|---|
| Growth per year (backtest, not a forecast) | 188% | 238% | 289% | 195% |
| Worst fall, open trades counted | 35% | 39% | 49% | 44% |
| Growth per year ÷ worst fall | 5.3 | 6.1 | 5.9 | 4.5 |
| Sharpe (daily, yearly) | 1.96 | 2.05 | 2.03 | 1.82 |
| Sortino (daily, yearly) | 3.57 | 3.80 | 3.72 | 3.29 |
| Ulcer index (lower = calmer) | 0.14 | 0.16 | 0.19 | 0.18 |
| Profit factor (money) | 1.69 | 1.54 | 1.66 | 1.49 |
| Losing months | 33% | 34% | 33% | 35% |
| Worst month | -19% | -24% | -23% | -32% |
| Longest time under old high (days) | 130 | 182 | 160 | 241 |
| Orders too small / no margin | 0 | 0 | 0 | 0 |
| 12-month runs: middle return | +202% | +248% | +280% | +189% |
| 12-month runs: bad case (1 in 10) | +64% | +69% | +70% | +49% |
| 12-month runs: worst | +42% | +38% | +25% | +20% |
| 12-month runs ending in profit | 100% | 100% | 100% | 100% |
| 12-month runs: middle worst fall | 31% | 33% | 39% | 35% |
| 12-month runs: deepest fall | 41% | 43% | 58% | 53% |
| 12-month runs that fell over 40% | 1% | 7% | 35% | 15% |
| Same typical fall (30%): middle 12-month return | +195% | +198% | +188% | +144% |
| Same typical fall: bad case (1 in 10) | +58% | +53% | +58% | +43% |
| Same worst fall (40%): growth per year | 226% | 245% | 194% | 166% |
| Growth per year at double costs | 167% | 203% | 245% | 168% |

## R per year, 6 live coins

| Strategy | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB 1H WIDE | +28 | +137 | +62 | +82 | +75 | +89 | +115 |
| BB 4H v4 (live) | +24 | +190 | +77 | +114 | +84 | +89 | +132 |
| BB 1H | +54 | +164 | +114 | +91 | +110 | +109 | +174 |
| BB 4H old | +46 | +172 | +81 | +67 | +66 | +88 | +121 |

## Money per year: return / worst fall inside the year

| Strategy | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB 1H WIDE | +64% / 20% | +456% / 25% | +130% / 31% | +125% / 32% | +155% / 35% | +205% / 29% | +298% / 30% |
| BB 4H v4 (live) | +48% / 30% | +925% / 23% | +148% / 30% | +245% / 33% | +176% / 36% | +183% / 31% | +334% / 35% |
| BB 1H | +139% / 30% | +548% / 28% | +321% / 35% | +108% / 49% | +253% / 39% | +247% / 35% | +606% / 35% |
| BB 4H old | +111% / 27% | +613% / 29% | +181% / 35% | +71% / 44% | +115% / 35% | +184% / 28% | +290% / 39% |

## 12 main coins

| Measure | BB 1H WIDE | BB 4H v4 (live) | BB 1H | BB 4H old |
|---|---|---|---|---|
| Timeframe | 1h | 4h | 1h | 4h |
| Status | new lead (2.6σ) | LIVE (rules v4, x1.05) | paper bot (bb1h) | old rules (2.0σ, 48 candles) |
| Coins | 12 | 12 | 12 | 12 |
| Trades | 3,137 | 3,740 | 4,208 | 3,572 |
| Trades per month | 37.9 | 45.2 | 50.8 | 43.2 |
| Win rate | 36% | 35% | 33% | 34% |
| Average R per trade | 0.37 | 0.37 | 0.38 | 0.35 |
| Average win ÷ average loss | 2.78 | 3.02 | 3.20 | 2.95 |
| Profit factor | 1.59 | 1.63 | 1.56 | 1.53 |
| Total R | +1157 | +1401 | +1594 | +1245 |
| Worst fall, closed trades (R) | 66.7 | 63.2 | 89.1 | 78.5 |
| Worst fall, open trades counted (R) | 80.4 | 72.1 | 102.2 | 92.1 |
| R ÷ worst fall (open) | 14.4 | 19.4 | 15.6 | 13.5 |
| Longest losing streak | 25 | 39 | 37 | 36 |
| Longest time under old high (days) | 196 | 136 | 216 | 137 |
| Losing months | 34% | 34% | 34% | 34% |
| Worst month (R) | -31 | -32 | -48 | -37 |
| Best month (R) | +100 | +105 | +157 | +111 |
| Positive years | 7/7 | 7/7 | 7/7 | 7/7 |
| Total R without best 10 trades | +894 | +1088 | +1198 | +937 |
| Longs / shorts (R) | +874 / +283 | +961 / +440 | +1144 / +450 | +901 / +344 |
| Average hold (days) | 4.9 | 4.2 | 4.4 | 4.7 |
| Total R at double costs | +1046 | +1257 | +1413 | +1107 |
| Total R since 2024 | +388 | +545 | +630 | +402 |
| Worst fall since 2024, open (R) | 80.4 | 59.2 | 101.6 | 92.1 |

## R per year, 12 main coins

| Strategy | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB 1H WIDE | +89 | +324 | +184 | +172 | +116 | +126 | +145 |
| BB 4H v4 (live) | +135 | +372 | +173 | +176 | +176 | +157 | +213 |
| BB 1H | +162 | +392 | +240 | +170 | +201 | +169 | +260 |
| BB 4H old | +167 | +344 | +216 | +115 | +95 | +112 | +194 |

## 12 hold-out coins (never used to pick the BB rules)

| Measure | BB 1H WIDE | BB 4H v4 (live) | BB 1H | BB 4H old |
|---|---|---|---|---|
| Timeframe | 1h | 4h | 1h | 4h |
| Status | new lead (2.6σ) | LIVE (rules v4, x1.05) | paper bot (bb1h) | old rules (2.0σ, 48 candles) |
| Coins | 12 | 12 | 12 | 12 |
| Trades | 3,319 | 3,900 | 4,454 | 3,730 |
| Trades per month | 40.1 | 47.1 | 53.8 | 45.1 |
| Win rate | 34% | 32% | 30% | 32% |
| Average R per trade | 0.15 | 0.15 | 0.13 | 0.16 |
| Average win ÷ average loss | 2.43 | 2.64 | 2.78 | 2.60 |
| Profit factor | 1.23 | 1.24 | 1.19 | 1.23 |
| Total R | +492 | +574 | +590 | +591 |
| Worst fall, closed trades (R) | 81.8 | 107.0 | 101.4 | 92.0 |
| Worst fall, open trades counted (R) | 108.0 | 121.4 | 138.8 | 118.8 |
| R ÷ worst fall (open) | 4.6 | 4.7 | 4.3 | 5.0 |
| Longest losing streak | 31 | 47 | 41 | 36 |
| Longest time under old high (days) | 394 | 751 | 374 | 464 |
| Losing months | 48% | 43% | 45% | 47% |
| Worst month (R) | -44 | -40 | -48 | -49 |
| Best month (R) | +89 | +79 | +93 | +82 |
| Positive years | 7/7 | 6/7 | 6/7 | 7/7 |
| Total R without best 10 trades | +255 | +293 | +316 | +296 |
| Longs / shorts (R) | +316 / +176 | +266 / +308 | +386 / +204 | +408 / +183 |
| Average hold (days) | 4.7 | 4.1 | 4.3 | 4.6 |
| Total R at double costs | +386 | +437 | +419 | +458 |
| Total R since 2024 | +153 | +235 | +149 | +137 |
| Worst fall since 2024, open (R) | 94.3 | 95.6 | 113.9 | 101.9 |

## R per year, 12 hold-out coins

| Strategy | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| BB 1H WIDE | +68 | +164 | +59 | +48 | +117 | +6 | +30 |
| BB 4H v4 (live) | +80 | +188 | +86 | -15 | +131 | +70 | +34 |
| BB 1H | +97 | +164 | +146 | +34 | +142 | -44 | +51 |
| BB 4H old | +74 | +171 | +138 | +71 | +107 | +5 | +24 |

## Do they move together? (monthly R, 1.00 = identical)

|  | BB 1H WIDE | BB 4H v4 (live) | BB 1H | BB 4H old | I-CORE | T-CORE |
|---|---|---|---|---|---|---|
| BB 1H WIDE | 1.00 | 0.84 | 0.91 | 0.89 | 0.23 | -0.07 |
| BB 4H v4 (live) | 0.84 | 1.00 | 0.91 | 0.87 | 0.22 | -0.06 |
| BB 1H | 0.91 | 0.91 | 1.00 | 0.93 | 0.24 | -0.05 |
| BB 4H old | 0.89 | 0.87 | 0.93 | 1.00 | 0.17 | -0.10 |
| I-CORE | 0.23 | 0.22 | 0.24 | 0.17 | 1.00 | 0.59 |
| T-CORE | -0.07 | -0.06 | -0.05 | -0.10 | 0.59 | 1.00 |

## Against today's 3-bot mix

| Strategy | Monthly link with today's 3-bot mix | Trades taken while a live bot already holds the same coin and side | Losing months of the mix where this one made money | Its total R in those months |
|---|---|---|---|---|
| BB 1H WIDE | 0.42 | 74% | 2 of 18 | -71 |
| BB 4H v4 (live) | 0.49 | 82% | 2 of 18 | -76 |
| BB 1H | 0.46 | 67% | 2 of 18 | -89 |
| BB 4H old | 0.39 | 95% | 3 of 18 | -66 |

## Mixes with I-CORE and T-CORE

| Measure | Today (v4 50 / I 25 / T 25) | 1H instead of v4 | WIDE instead of v4 | Old 4H instead of v4 | v4 + 1H + I + T (25 each) | v4 + WIDE + I + T (25 each) | v4 + 1H + WIDE + I + T (20 each) | BB half split v4/1H/WIDE, I 25, T 25 |
|---|---|---|---|---|---|---|---|---|
| Growth per year (backtest) | 308% | 339% | 274% | 282% | 331% | 297% | 312% | 316% |
| Worst fall, open trades counted | 40% | 42% | 37% | 42% | 40% | 39% | 39% | 39% |
| Growth per year ÷ worst fall | 7.7 | 8.0 | 7.3 | 6.7 | 8.4 | 7.7 | 7.9 | 8.2 |
| Sharpe | 2.13 | 2.11 | 2.06 | 2.02 | 2.13 | 2.11 | 2.14 | 2.12 |
| Sortino | 3.76 | 3.77 | 3.62 | 3.56 | 3.80 | 3.73 | 3.82 | 3.76 |
| Ulcer index (lower = calmer) | 0.19 | 0.20 | 0.19 | 0.19 | 0.19 | 0.19 | 0.18 | 0.19 |
| Profit factor (money) | 1.78 | 1.84 | 1.90 | 1.74 | 1.81 | 1.84 | 1.79 | 1.84 |
| Win rate | 36% | 35% | 36% | 35% | 36% | 37% | 37% | 37% |
| Trades | 3,789 | 3,949 | 3,482 | 3,680 | 5,572 | 5,105 | 6,888 | 6,888 |
| Losing months | 40% | 39% | 39% | 37% | 40% | 39% | 37% | 39% |
| Worst month | -29% | -27% | -26% | -32% | -28% | -27% | -27% | -27% |
| Longest time under old high (days) | 212 | 122 | 159 | 169 | 184 | 212 | 131 | 169 |
| 12-month runs: middle return | +542% | +550% | +448% | +430% | +598% | +555% | +609% | +613% |
| 12-month runs: bad case (1 in 10) | +132% | +117% | +119% | +99% | +139% | +131% | +148% | +143% |
| 12-month runs: worst | +8% | +2% | +14% | +6% | +4% | +12% | +15% | +8% |
| 12-month runs ending in profit | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| 12-month runs: middle worst fall | 43% | 44% | 41% | 45% | 45% | 43% | 44% | 45% |
| 12-month runs: deepest fall | 53% | 59% | 52% | 58% | 59% | 55% | 55% | 57% |
| 12-month runs that fell over 40% | 76% | 70% | 63% | 63% | 73% | 76% | 82% | 76% |
| Runs that earned more than today | - | 61% | 25% | 31% | 77% | 58% | 73% | 73% |
| Runs that fell less than today | - | 28% | 61% | 37% | 15% | 25% | 30% | 23% |
| Runs starting 2024 or later: middle return / fall | +546% / 44% | +620% / 47% | +588% / 45% | +507% / 45% | +629% / 46% | +600% / 44% | +632% / 44% | +645% / 46% |
| Since 2024: growth per year / worst fall | 349% / 43% | 424% / 45% | 340% / 47% | 318% / 45% | 400% / 48% | 360% / 47% | 397% / 49% | 390% / 50% |
| Double costs: growth per year / worst fall | 277% / 41% | 300% / 44% | 252% / 38% | 253% / 43% | 294% / 41% | 267% / 39% | 277% / 39% | 283% / 40% |
| SAME RISK (typical fall): middle 12-month return | +648% | +674% | +575% | +508% | +666% | +675% | +705% | +675% |
| SAME RISK (typical fall): bad case (1 in 10) | +117% | +114% | +103% | +97% | +133% | +124% | +145% | +138% |
| SAME RISK (single worst fall): growth per year | 558% | 500% | 514% | 427% | 535% | 548% | 571% | 532% |
| Reshuffled 2-year paths: earned more than today | - | 77% | 23% | 28% | 85% | 33% | 58% | 62% |
| Reshuffled 2-year paths: fell less than today | - | 46% | 62% | 43% | 55% | 66% | 76% | 63% |

## Mixes per year: return / worst fall

| Mix | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| Today (v4 50 / I 25 / T 25) | +133% / 37% | +1,114% / 35% | +125% / 29% | +351% / 37% | +181% / 36% | +371% / 32% | +325% / 40% |
| 1H instead of v4 | +207% / 34% | +895% / 38% | +193% / 31% | +255% / 42% | +210% / 38% | +413% / 35% | +433% / 39% |
| WIDE instead of v4 | +148% / 36% | +814% / 36% | +114% / 29% | +262% / 36% | +164% / 35% | +384% / 34% | +301% / 37% |
| Old 4H instead of v4 | +187% / 33% | +926% / 37% | +139% / 33% | +225% / 41% | +144% / 34% | +368% / 33% | +299% / 42% |
| v4 + 1H + I + T (25 each) | +182% / 38% | +1,066% / 36% | +158% / 29% | +302% / 40% | +197% / 37% | +393% / 31% | +378% / 39% |
| v4 + WIDE + I + T (25 each) | +147% / 37% | +1,023% / 35% | +120% / 27% | +306% / 37% | +174% / 36% | +379% / 31% | +315% / 39% |
| v4 + 1H + WIDE + I + T (20 each) | +162% / 39% | +1,065% / 33% | +153% / 28% | +268% / 37% | +188% / 36% | +361% / 30% | +363% / 38% |
| BB half split v4/1H/WIDE, I 25, T 25 | +178% / 38% | +1,024% / 36% | +143% / 28% | +289% / 38% | +186% / 36% | +391% / 32% | +352% / 39% |

## Can a small account still place the orders? (12-month runs from 2024)

| Starting money | Today (v4 50 / I 25 / T 25) | 1H instead of v4 | WIDE instead of v4 | Old 4H instead of v4 | v4 + 1H + I + T (25 each) | v4 + WIDE + I + T (25 each) | v4 + 1H + WIDE + I + T (20 each) | BB half split v4/1H/WIDE, I 25, T 25 |
|---|---|---|---|---|---|---|---|---|
| US$250 | 0.8% skipped, fall 50% | 0.9% skipped, fall 51% | 1.0% skipped, fall 48% | 1.1% skipped, fall 47% | 0.7% skipped, fall 51% | 0.7% skipped, fall 47% | 0.7% skipped, fall 48% | 0.8% skipped, fall 48% |
| US$750 | 0.5% skipped, fall 44% | 0.4% skipped, fall 47% | 0.5% skipped, fall 45% | 0.5% skipped, fall 45% | 0.3% skipped, fall 46% | 0.3% skipped, fall 44% | 0.3% skipped, fall 44% | 0.2% skipped, fall 46% |
| US$2,000 | 0.1% skipped, fall 37% | 0.1% skipped, fall 41% | 0.0% skipped, fall 38% | 0.0% skipped, fall 37% | 0.0% skipped, fall 39% | 0.0% skipped, fall 37% | 0.0% skipped, fall 40% | 0.0% skipped, fall 40% |
| US$5,000 | 0.0% skipped, fall 35% | 0.0% skipped, fall 38% | 0.0% skipped, fall 35% | 0.0% skipped, fall 34% | 0.0% skipped, fall 38% | 0.0% skipped, fall 36% | 0.0% skipped, fall 36% | 0.0% skipped, fall 36% |

## Check against published numbers

| Number already in the repo | Published | Re-run here |
|---|---|---|
| BB-1H-WIDE, main 12 | +1157 | +1157 |
| BB-CORE 1h, hold-out 12 | +590 | +590 |

## Read before trusting

- Growth percentages are backtest compounding with perfect fills at any size. Far above what to expect live. Use them only to compare lines.
- Every BB version trades the same 6 coins (SOL, ZEC, NEAR, ADA, GALA, ARB). In the 4- and 5-bot mixes two BB bots often hold the same coin and side at once; this assumes each bot has its own MEXC sub-account.
- The 5-bot mix gives the BB family 60% of the money instead of 50%, so part of its gain is just more BB. Splitting today's 50% three ways (v4/1H/WIDE) gives +675% at the same typical fall and 532% at the same worst fall: no clear gain.
- v4 rules were chosen in November 2026 on this same history; 1H and WIDE were picked on 12 main coins and screened on the 12 hold-out coins. No version has a clean out-of-sample test.
- The 71 twelve-month runs overlap (about 7 separate years), so gaps of a few percent are noise.
- Binance candles and funding, fee 0.05% + slippage 0.02% per side. MEXC fills differ. Trades still open on Nov 24 2026 are not counted.

Scripts: `study.js` (numbers, `results.json`), `report.js` (this file and `report.html`), verdict text in `verdict.json`.
