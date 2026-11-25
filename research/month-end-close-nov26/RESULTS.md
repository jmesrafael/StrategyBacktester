# Close every open trade at the monthly settlement? (Nov 26 2026)

Today = BB-CORE v4 (x1.05), I-CORE v3, T-CORE v3, live coins, one pool sized 50/25/25, 2.5% risk per trade, Jan 2020 to Nov 24 2026. Settlement = 12:00am Manila on the 1st. Investor columns: ₱1,000 in, 20% profit share monthly above a high-water mark. Peso rate held fixed. Backtest, not live results; BB v4 rules were chosen on this same history.

**Verdict: REJECTED.** Closing every open trade at settlement ends behind today over the whole history at every risk level tried, and in 5 of 7 calendar years (ahead in 2022 and 2026). It cuts the long trend trades that pay for the system. Nothing was changed on the bots.

In section 3 the R columns count a trade in the year it closes, while the peso columns value open trades at year end, so the two can point different ways for one year.

## 1. Whole history

| Version | Trades | Closed by the rule | Win rate | Total R (weighted) | Without best 10 | Worst drop (R, closed) | BB / I / T raw R |
|---|---|---|---|---|---|---|---|
| Today (no forced close) | 3,789 | 0 | 36.0% | +865 | +629 | 21.1 | +683 / +933 / +1105 |
| Close ALL at settlement | 4,597 | 880 | 37.1% | +659 | +525 | 26.1 | +631 / +562 / +787 |
| Close only winners at settlement | 4,521 | 723 | 38.2% | +669 | +535 | 27.8 | +642 / +568 / +789 |
| Close only losers at settlement | 3,865 | 152 | 34.8% | +854 | +618 | 21.4 | +672 / +924 / +1102 |
| Close all + re-open the same trades at once | 3,789 | 891 | 36.0% | +857 | +621 | 21.1 (before extra fees) | as today, minus fees |
| Close all at month end UTC (8h later) | 4,611 | 886 | 37.5% | +652 | +520 | 27.2 | +630 / +549 / +765 |
| Close all on the 8th instead | 4,572 | 861 | 37.5% | +626 | +507 | 36.4 | +617 / +508 / +741 |
| Close all on the 15th instead | 4,589 | 933 | 37.3% | +747 | +617 | 34.4 | +651 / +730 / +904 |
| Close all on the 22nd instead | 4,661 | 891 | 36.1% | +661 | +529 | 31.6 | +619 / +605 / +780 |

## 2. One ₱1,000, left in from Jan 2020 (full compounding)

| Version | Before profit share | Investor after 20% | vs today | Profit share paid | Deepest fall (after fee) | Months up / down | Worst month |
|---|---|---|---|---|---|---|---|
| Today (no forced close) | ₱559.57M | **₱67.04M** | — | ₱18.91M | 58% | 50 / 33 | -39.7% |
| Close ALL at settlement | ₱50.89M | **₱8.49M** | -87% | ₱2.15M | 58% | 47 / 36 | -28.3% |
| Close only winners at settlement | ₱68.44M | **₱10.86M** | -84% | ₱2.72M | 57% | 48 / 35 | -28.8% |
| Close only losers at settlement | ₱424.40M | **₱53.75M** | -20% | ₱15.33M | 59% | 49 / 34 | -39.8% |
| Close all + re-open the same trades at once | ₱474.24M | **₱58.37M** | -13% | ₱16.52M | 58% | 50 / 33 | -39.9% |
| Close all at month end UTC (8h later) | ₱45.17M | **₱7.72M** | -88% | ₱1.94M | 55% | 46 / 37 | -26.7% |
| Close all on the 8th instead | ₱36.59M | **₱6.19M** | -91% | ₱1.65M | 68% | 51 / 32 | -24.8% |
| Close all on the 15th instead | ₱284.23M | **₱34.56M** | -48% | ₱8.74M | 61% | 54 / 29 | -31.7% |
| Close all on the 22nd instead | ₱43.36M | **₱7.39M** | -89% | ₱1.85M | 61% | 52 / 31 | -28.0% |

### Same, at lower risk per trade (investor after 20%)

| Risk per trade | Today | Close all | Close all + re-open | Close-all vs today | Deepest fall today / close all |
|---|---|---|---|---|---|
| 0.5% | ₱22,660 | ₱11,691 | ₱21,993 | -48% | 22% / 16% |
| 1.0% | ₱289,649 | ₱94,237 | ₱273,280 | -67% | 34% / 29% |
| 1.5% | ₱2.44M | ₱553,178 | ₱2.24M | -77% | 44% / 40% |
| 2.5% | ₱67.04M | ₱8.49M | ₱58.37M | -87% | 58% / 58% |

## 3. ₱1,000 put in fresh at the start of each year (2.5% risk)

| Year | Today: ₱1,000 becomes | Close all: becomes | Difference | Close all + re-open | Before fee: today / close all | Profit share paid: today / close all | Deepest fall: today / close all | Months up: today / close all | R: today / close all |
|---|---|---|---|---|---|---|---|---|---|
| 2020 | ₱1,912 | ₱1,414 | −₱498 | ₱1,893 | ₱2,290 / ₱1,595 | ₱324 / ₱174 | 44% / 45% | 6 / 7 of 12 | +36 / +28 |
| 2021 | ₱16,500 | ₱10,053 | −₱6,448 | ₱16,297 | ₱27,340 / ₱15,340 | ₱4,528 / ₱2,358 | 49% / 53% | 8 / 7 of 12 | +220 / +164 |
| 2022 | ₱2,682 | ₱3,497 | +₱814 | ₱2,631 | ₱3,390 / ₱4,531 | ₱545 / ₱636 | 46% / 41% | 7 / 8 of 12 | +61 / +82 |
| 2023 | ₱5,495 | ₱3,608 | −₱1,887 | ₱5,365 | ₱7,520 / ₱4,631 | ₱1,124 / ₱652 | 56% / 58% | 8 / 7 of 12 | +94 / +104 |
| 2024 | ₱3,175 | ₱2,800 | −₱374 | ₱3,080 | ₱4,214 / ₱3,532 | ₱762 / ₱539 | 52% / 55% | 8 / 6 of 12 | +159 / +86 |
| 2025 | ₱6,013 | ₱2,190 | −₱3,822 | ₱5,884 | ₱8,490 / ₱2,755 | ₱1,423 / ₱470 | 45% / 46% | 6 / 6 of 12 | +154 / +65 |
| 2026 (to Nov 24) | ₱6,613 | ₱6,979 | +₱366 | ₱6,447 | ₱9,796 / ₱10,191 | ₱1,616 / ₱1,514 | 58% / 55% | 7 / 6 of 11 | +141 / +130 |

Seven separate ₱1,000 (₱7,000 in): today ₱42,390, close all ₱30,540, close + re-open ₱41,598.

### The same at 1% risk

| Year | Today: ₱1,000 becomes | Close all: becomes | Difference | Close all + re-open | Before fee: today / close all | Profit share paid: today / close all | Deepest fall: today / close all | Months up: today / close all | R: today / close all |
|---|---|---|---|---|---|---|---|---|---|
| 2020 | ₱1,347 | ₱1,198 | −₱149 | ₱1,341 | ₱1,469 / ₱1,271 | ₱113 / ₱70 | 22% / 23% | 6 / 7 of 12 | +36 / +28 |
| 2021 | ₱4,062 | ₱3,072 | −₱990 | ₱4,040 | ₱5,493 / ₱3,905 | ₱847 / ₱526 | 25% / 26% | 8 / 8 of 12 | +220 / +164 |
| 2022 | ₱1,600 | ₱1,798 | +₱198 | ₱1,587 | ₱1,795 / ₱2,056 | ₱165 / ₱200 | 22% / 19% | 7 / 9 of 12 | +61 / +82 |
| 2023 | ₱2,619 | ₱1,979 | −₱640 | ₱2,593 | ₱3,212 / ₱2,303 | ₱405 / ₱245 | 29% / 29% | 8 / 7 of 12 | +94 / +104 |
| 2024 | ₱1,752 | ₱1,748 | −₱5 | ₱1,731 | ₱2,037 / ₱1,997 | ₱239 / ₱205 | 26% / 27% | 8 / 7 of 12 | +159 / +86 |
| 2025 | ₱2,641 | ₱1,524 | −₱1,117 | ₱2,617 | ₱3,260 / ₱1,723 | ₱433 / ₱171 | 26% / 23% | 7 / 6 of 12 | +154 / +65 |
| 2026 (to Nov 24) | ₱2,574 | ₱2,598 | +₱23 | ₱2,546 | ₱3,211 / ₱3,206 | ₱432 / ₱399 | 34% / 27% | 7 / 6 of 11 | +141 / +130 |

Seven separate ₱1,000 (₱7,000 in): today ₱16,595, close all ₱13,917, close + re-open ₱16,456.

### One ₱1,000 from 2020, balance at the end of each year (after fee, 2.5% risk)

| End of year | Today | Close all |
|---|---|---|
| 2020 | ₱1,912 | ₱1,414 |
| 2021 | ₱32,323 | ₱14,589 |
| 2022 | ₱88,326 | ₱51,238 |
| 2023 | ₱498,849 | ₱185,200 |
| 2024 | ₱1.58M | ₱518,622 |
| 2025 | ₱9.95M | ₱1.16M |
| 2026 (Nov 24) | ₱67.04M | ₱8.49M |

## 4. Add ₱1,000 at the start of every year and never withdraw (₱7,000 in total)

| Risk per trade | Today | Close all | Close all + re-open |
|---|---|---|---|
| 0.5% | ₱66,156 | ₱38,907 | ₱64,491 |
| 1.0% | ₱607,472 | ₱225,091 | ₱575,568 |
| 1.5% | ₱4.39M | ₱1.13M | ₱4.05M |
| 2.5% | ₱104.22M | ₱15.15M | ₱91.11M |

## 5. Every possible start month (investor after fee, 2.5% risk)

| Time in the pool | Start months tried | Close all beats today | Median ₱1,000: today / close all | Worst: today / close all | Ended below ₱1,000: today / close all | Close all + re-open beats today |
|---|---|---|---|---|---|---|
| 1 month | 81 | 46% | ₱1,077 / ₱1,043 | ₱603 / ₱717 | 41% / 44% | 1% |
| 3 months | 79 | 42% | ₱1,378 / ₱1,304 | ₱627 / ₱578 | 16% / 15% | 0% |
| 6 months | 76 | 32% | ₱2,100 / ₱1,708 | ₱711 / ₱710 | 7% / 5% | 0% |
| 12 months | 70 | 30% | ₱5,758 / ₱3,316 | ₱960 / ₱1,213 | 1% / 0% | 0% |
| 24 months | 58 | 17% | ₱20,858 / ₱11,425 | ₱5,722 / ₱2,731 | 0% / 0% | 0% |
| 36 months | 46 | 0% | ₱84,881 / ₱41,451 | ₱20,254 / ₱11,745 | 0% / 0% | 0% |

## 6. Why: the trades that were open at a settlement

Each forced close is matched with the same trade (same bot, coin, entry candle) left alone in today's run. Raw R, unweighted.

| Open at settlement | Trades | R if closed there | R if left alone | Closing gains / loses | Better left alone |
|---|---|---|---|---|---|
| All | 759 | +1914 | +3042 | -1128 | 40% |
| In profit at the close | 599 | +1970 | +3014 | -1044 | 42% |
| In loss at the close | 160 | -56 | +28 | -84 | 33% |
| BB-CORE | 225 | +174 | +265 | -91 | 46% |
| I-CORE | 249 | +738 | +1192 | -454 | 35% |
| T-CORE | 285 | +1003 | +1586 | -583 | 40% |

Trades open at a settlement (today's run, closed trades only): average 10.8, most 20; settlements with nothing open: 0 of 82.

## 7. 2026 month by month, ₱1,000 from Jan 1 (after fee, 2.5% risk)

| Month | Today | value | Close all | value |
|---|---|---|---|---|
| Jan | +19.1% | ₱1,191 | +31.2% | ₱1,312 |
| Feb | +12.4% | ₱1,339 | -6.7% | ₱1,224 |
| Mar | -17.6% | ₱1,103 | -13.6% | ₱1,057 |
| Apr | -23.2% | ₱847 | -28.3% | ₱758 |
| May | +142.8% | ₱2,057 | +144.9% | ₱1,856 |
| Jun | +26.0% | ₱2,591 | +25.6% | ₱2,331 |
| Jul | -12.1% | ₱2,279 | -10.0% | ₱2,097 |
| Aug | +67.7% | ₱3,822 | +74.5% | ₱3,658 |
| Sep | +95.3% | ₱7,463 | +92.9% | ₱7,056 |
| Oct | -39.7% | ₱4,499 | -25.9% | ₱5,229 |
| Nov 1-24 | +47.0% | ₱6,613 | +33.5% | ₱6,979 |

## 8. Checks

- Engine parity: with the earlier study's settings this loop gives ₱26,768,963; replace-nov25/TRICORE-7Y.md says ₱26,768,963.
- Without the new BB-CORE v4 rules (v3): today ₱55.05M (+863R), close all ₱6.46M (+658R), close all vs today -88%.
- Close-all run: forced closes at a wrong time 0; trades still held across a settlement 0 (should be 0, apart from missing candles).
