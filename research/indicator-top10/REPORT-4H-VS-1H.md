# bb-core 4h vs 1h: side by side (5 bot coins, real funding, sized at entry)

Funding check against the core on 4h SOL: 275 trades, 0 differences

## A. Side by side, 5 bot coins, Binance futures, fees + slippage + real funding

| | 4h (live) | 1h |
|---|---|---|
| Trades | 1341 | 1585 |
| Trades per month | 16.8 | 19.8 |
| Longs / shorts | 656 / 685 | 765 / 820 |
| Average hold | 5.0 days | 4.6 days |
| Median stop distance | 5.83% | 5.41% |
| Average / max open positions | 2.73 / 5 | 3.01 / 5 |
| Win rate | 36.4% | 35.2% |
| Average win / loss | +2.93R / -0.98R | +3.11R / -0.99R |
| Average R per trade | 0.443 | 0.457 |
| Total R (with funding) | 594.3 | 723.8 |
| Funding effect on total R | -24.8 | -30.4 |
| Profit factor | 1.71 | 1.72 |
| Best trade / worst trade | +65.8R / -2.7R | +64.7R / -1.8R |
| Top 10 trades, share of total R | 35% | 29% |
| Exits: stop / time | 785 / 556 | 948 / 637 |
| Longest losing streak | 20 trades | 21 trades |
| Max drawdown, fixed risk | -24.9R | -31.2R |
| Longest time below a peak | 151 days | 143 days |
| Losing months | 28 of 81 | 27 of 81 |
| Median / best / worst month | 5.0R / 60.6R / -22.5R | 6.7R / 66.5R / -14.6R |
| Worst 3 months / worst 6 months | -13.3R / 0.0R | -16.3R / -0.1R |
| Monthly R spread (std dev) | 14.3R | 15.7R |
| R before 2023 / 2023 onward | 299 / 296 | 332 / 392 |
| ₱1,000 from 2020, ₱3,150 cap: end (worst drop) | ₱939,025 (-33%) | ₱1,377,148 (-38%) |
| ₱15,750 from 2020, ₱3,150 cap: end (worst drop) | ₱1,501,298 (-21%) | ₱1,909,674 (-20%) |
| ₱15,750 from 2020, $500 cap: end (worst drop) | ₱8,391,592 (-30%) | ₱12,286,446 (-39%) |
| ₱15,750 from 2023, ₱3,150 cap: end (worst drop) | ₱535,868 (-47%) | ₱777,168 (-58%) |
| ₱15,750 from 2026, ₱3,150 cap: end (worst drop) | ₱56,978 (-45%) | ₱83,605 (-46%) |

## B. R by year

| Year | 4h | 1h | Difference |
|---|---|---|---|
| 2020 | 45.5 | 54.2 | 8.6 |
| 2021 | 172.0 | 163.9 | -8.1 |
| 2022 | 81.2 | 113.9 | 32.8 |
| 2023 | 69.9 | 86.9 | 17.0 |
| 2024 | 69.8 | 95.6 | 25.8 |
| 2025 | 72.3 | 88.3 | 16.0 |
| 2026 | 83.5 | 121.0 | 37.4 |

## C. R by coin and year (4h / 1h)

| Coin | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total |
|---|---|---|---|---|---|---|---|---|
| SOL | 4 / 3 | 47 / 35 | 11 / 26 | 31 / 33 | 11 / 21 | 1 / 10 | 13 / 29 | 119 / 157 |
| ZEC | 21 / 14 | 23 / 20 | 18 / 17 | -3 / -19 | 12 / 7 | 33 / 34 | 17 / 27 | 120 / 100 |
| NEAR | -6 / -5 | 24 / 23 | 15 / 28 | 1 / 16 | 17 / 18 | 3 / 6 | 30 / 40 | 85 / 126 |
| ADA | 27 / 42 | 21 / 29 | 15 / 12 | 16 / 20 | 11 / 32 | 12 / 20 | 9 / 7 | 111 / 162 |
| GALA | 0 / 0 | 58 / 56 | 22 / 31 | 24 / 37 | 18 / 18 | 23 / 20 | 15 / 18 | 160 / 179 |

## D. Longs vs shorts

| | 4h trades | 4h R | 1h trades | 1h R |
|---|---|---|---|---|
| Long | 656 | 359 | 765 | 464 |
| Short | 685 | 235 | 820 | 260 |

## E. 2026 by month

| Month | 4h R | 4h trades | 1h R | 1h trades |
|---|---|---|---|---|
| Jan | -1.5 | 17 | -3.7 | 21 |
| Feb | 8.2 | 22 | 19.7 | 24 |
| Mar | -1.8 | 17 | -1.9 | 20 |
| Apr | -6.0 | 23 | -5.2 | 26 |
| May | 36.2 | 14 | 41.5 | 17 |
| Jun | 16.3 | 17 | 13.8 | 21 |
| Jul | -3.3 | 20 | -0.9 | 24 |
| Aug | 43.8 | 21 | 49.3 | 22 |
| Sep | 15.6 | 20 | 23.3 | 25 |
| Oct | -22.5 | 25 | -12.6 | 25 |
| Nov | -1.5 | 5 | -2.5 | 7 |

## F. Is the gap real? Months paired

Total R gap (1h minus 4h): 129.5R. Mean monthly gap 1.60R, t = 2.67. Bootstrap 95% range of the total gap: 37R to 226R. Share of resamples where 1h wins: 100%. 1h better in 42 of 81 months. Monthly correlation 4h vs 1h: 0.94.

## G. Checks on data the 1h pick was not chosen from

| Test | 4h trades | 4h R | 4h avg | 4h PF | 1h trades | 1h R | 1h avg | 1h PF |
|---|---|---|---|---|---|---|---|---|
| BTC + ETH futures, 2020 to 2026 | 654 | 161 | 0.25 | 1.36 | 779 | 234 | 0.30 | 1.42 |
| Spot before 2020 (BTC ETH ADA ZEC), no funding | 237 | 149 | 0.63 | 2.05 | 205 | 138 | 0.67 | 2.16 |
| MEXC candles, 5 coins, MEXC listing to 2026 | 1290 | 496 | 0.38 | 1.61 | 1454 | 616 | 0.42 | 1.66 |
| MEXC candles, 2021 | 188 | 117 | 0.62 | 1.96 | 197 | 118 | 0.60 | 1.92 |
| MEXC candles, 2022 | 219 | 74 | 0.34 | 1.56 | 231 | 78 | 0.34 | 1.58 |
| MEXC candles, 2023 | 233 | 73 | 0.31 | 1.47 | 252 | 109 | 0.43 | 1.64 |
| MEXC candles, 2024 | 216 | 71 | 0.33 | 1.55 | 270 | 96 | 0.35 | 1.54 |
| MEXC candles, 2025 | 206 | 76 | 0.37 | 1.64 | 242 | 88 | 0.36 | 1.60 |
| MEXC candles, 2026 | 200 | 87 | 0.43 | 1.68 | 232 | 124 | 0.54 | 1.83 |

## H. Cost stress, 5 coins with funding (total R, 4h / 1h)

| Extra cost | 4h | 1h |
|---|---|---|
| Base (0.02% slip) | 594 | 724 |
| Slip 0.05% | 574 | 697 |
| Slip 0.10% | 541 | 654 |
| Slip 0.20% | 478 | 571 |
| Fees doubled (0.10% per side) | 567 | 689 |

## I. Nearby settings on both timeframes

| Setting (4h value, 1h = x4) | 4h R | 4h worst year | 1h R | 1h worst year |
|---|---|---|---|---|
| Base | 594 | 46 | 724 | 54 |
| Band 10 | 610 | -3 | 889 | 49 |
| Band 15 | 580 | 44 | 796 | 50 |
| Band 25 | 468 | 32 | 572 | 53 |
| Band 30 | 408 | 18 | 499 | 38 |
| Trend 100 | 580 | 54 | 653 | 53 |
| Trend 150 | 555 | 52 | 705 | 63 |
| Trend 250 | 524 | 29 | 669 | 43 |
| Trend 300 | 499 | 36 | 642 | 48 |
| Time exit 24 | 381 | 26 | 481 | 37 |
| Time exit 36 | 468 | 23 | 603 | 29 |
| Time exit 72 | 628 | 37 | 737 | 22 |
| Time exit 96 | 639 | 37 | 729 | 36 |

## J. The filter I did not scale on 1h (stop must be at least X times ATR)

| 1h setting | Trades | R | Avg R | Worst year |
|---|---|---|---|---|
| As tested: ATR 14, 0.3 | 1585 | 724 | 0.46 | 54 |
| ATR 56, 0.3 (length x4) | 1585 | 724 | 0.46 | 54 |
| ATR 14, 0.6 (matches 4h ATR in price) | 1585 | 724 | 0.46 | 54 |
| ATR 56, 0.6 | 1585 | 724 | 0.46 | 54 |
