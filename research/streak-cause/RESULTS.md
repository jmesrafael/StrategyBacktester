# Why we lose in streaks, and where we make the money
Generated 2026-11-19T01:49 UTC by `node analyze.js`. Live rules (v3) on each bot's live coins, Binance 4h, Jan 2020 to Nov 12 2026, costs and funding in R.
TRI-CORE R = 0.5 x BB-CORE + 0.25 x I-CORE + 0.25 x T-CORE. "Next 7 days" columns are hindsight: they explain a result, they cannot be traded.

## 1. The base numbers
| Bot | Trades | Win | Total R | Avg R | Max DD R | Longest losing | Best 10% of trades | Other 90% |
|---|---|---|---|---|---|---|---|---|
| BB-CORE | 1723 | 37% | +741.9 | +0.43 | 28.5 | 14 | +1194.5 | -452.6 |
| I-CORE | 822 | 33% | +821.5 | +1.00 | 25.4 | 14 | +1074.7 | -253.2 |
| T-CORE | 1154 | 37% | +1191.0 | +1.03 | 32.9 | 14 | +1634.2 | -443.2 |

## 2. How trades end
| Bot | Exit | Trades | Share | Avg R | Total R |
|---|---|---|---|---|---|
| BB-CORE | stop | 1002 | 58% | -1.04 | -1040.4 |
| BB-CORE | time | 721 | 42% | +2.47 | +1782.3 |
| I-CORE | stop | 822 | 100% | +1.00 | +821.5 |
| T-CORE | stop | 833 | 72% | +1.25 | +1037.8 |
| T-CORE | time | 321 | 28% | +0.48 | +153.1 |

## 3. What the market did in the 7 days after entry (hindsight)
Coin path over the next 42 candles: **with us** = moved 3+ ATR our way, **against** = 3+ ATR the other way, **sideways** = net move under 3 ATR. Efficiency = net move / total distance travelled (0 = pure chop, 1 = straight line).
| Bot | Next 7 days | Trades | Share | Win | Avg R | Total R | Share of profit | Median efficiency |
|---|---|---|---|---|---|---|---|---|
| BB-CORE | with us | 462 | 27% | 76% | +3.06 | +1415.4 | 191% | 0.24 |
| BB-CORE | sideways | 896 | 52% | 31% | -0.33 | -298.5 | -40% | 0.08 |
| BB-CORE | against | 365 | 21% | 0% | -1.03 | -375.0 | -51% | 0.26 |
| I-CORE | with us | 220 | 27% | 77% | +4.61 | +1014.2 | 123% | 0.25 |
| I-CORE | sideways | 420 | 51% | 24% | -0.03 | -13.7 | -2% | 0.09 |
| I-CORE | against | 182 | 22% | 2% | -0.98 | -179.0 | -22% | 0.27 |
| T-CORE | with us | 316 | 27% | 76% | +5.17 | +1633.7 | 137% | 0.25 |
| T-CORE | sideways | 618 | 54% | 31% | -0.35 | -216.3 | -18% | 0.08 |
| T-CORE | against | 220 | 19% | 0% | -1.03 | -226.5 | -19% | 0.27 |

Same trades by how choppy the next 7 days were (coin efficiency):
| Bot | Efficiency next 7 days | Trades | Win | Avg R | Total R |
|---|---|---|---|---|---|
| BB-CORE | under 0.10 (chop) | 583 | 30% | -0.41 | -236.5 |
| BB-CORE | 0.10-0.20 | 526 | 39% | +0.13 | +68.4 |
| BB-CORE | 0.20-0.35 | 472 | 43% | +1.09 | +513.9 |
| BB-CORE | 0.35-0.50 | 127 | 35% | +2.67 | +338.8 |
| BB-CORE | 0.50+ (clean trend) | 15 | 33% | +3.83 | +57.4 |
| I-CORE | under 0.10 (chop) | 248 | 21% | -0.18 | -44.3 |
| I-CORE | 0.10-0.20 | 251 | 29% | +0.13 | +33.7 |
| I-CORE | 0.20-0.35 | 241 | 49% | +2.69 | +648.8 |
| I-CORE | 0.35-0.50 | 76 | 36% | +2.41 | +182.9 |
| I-CORE | 0.50+ (clean trend) | 6 | 17% | +0.07 | +0.4 |
| T-CORE | under 0.10 (chop) | 407 | 30% | -0.43 | -174.6 |
| T-CORE | 0.10-0.20 | 324 | 38% | +0.14 | +45.6 |
| T-CORE | 0.20-0.35 | 328 | 45% | +3.12 | +1022.7 |
| T-CORE | 0.35-0.50 | 85 | 40% | +3.30 | +280.3 |
| T-CORE | 0.50+ (clean trend) | 10 | 40% | +1.69 | +16.9 |

## 4. The longest losing streaks, one by one
Streak = losing trades in a row by exit time. Market columns cover the streak window: BTC change, BTC efficiency and the 8 coins' average efficiency over the whole window (all-time median of 7-day efficiency is given below for comparison).
All-time median 7-day efficiency: BTC 0.15, coins 0.15.

### BB-CORE
| Window | Losses | R | Coins | Side | BTC change | BTC eff. | Coin eff. | Went sideways next 7d | Hit the stop | Likely cause |
|---|---|---|---|---|---|---|---|---|---|---|
| 2022-10-26 to 2022-11-08 | 14 | -14.5 | ZEC NEAR ADA SOL GALA | 8L/6S | -2% | 0.05 | 0.10 | 21% | 100% | reversals against us |
| 2024-12-26 to 2025-01-14 | 14 | -14.0 | ADA ARB SOL GALA ZEC NEAR | 4L/10S | 0% | 0.12 | 0.15 | 36% | 93% | reversals against us + BTC range-bound |
| 2023-02-02 to 2023-02-23 | 14 | -13.8 | NEAR ADA ZEC SOL GALA | 8L/6S | 2% | 0.40 | 0.17 | 71% | 93% | no follow-through (sideways) + BTC range-bound |
| 2026-04-24 to 2026-05-06 | 13 | -12.6 | ARB SOL ADA NEAR ZEC GALA | 7L/6S | 5% | 0.05 | 0.12 | 54% | 92% | sideways chop + reversals against us |
| 2022-11-28 to 2022-12-18 | 13 | -12.0 | GALA NEAR ADA ZEC SOL | 2L/11S | 3% | 0.28 | 0.22 | 54% | 85% | mixed |
| 2024-09-06 to 2024-09-19 | 12 | -12.4 | ZEC GALA ADA ARB NEAR SOL | 4L/8S | 11% | 0.12 | 0.16 | 50% | 100% | reversals against us |
| 2021-03-15 to 2021-04-03 | 12 | -12.1 | ZEC SOL NEAR ADA | 7L/5S | 1% | 0.03 | 0.09 | 42% | 92% | reversals against us + BTC range-bound |
| 2022-09-26 to 2022-10-09 | 12 | -10.8 | ADA GALA SOL ZEC NEAR | 3L/9S | 3% | 0.04 | 0.08 | 75% | 83% | sideways chop |

### I-CORE
| Window | Losses | R | Coins | Side | BTC change | BTC eff. | Coin eff. | Went sideways next 7d | Hit the stop | Likely cause |
|---|---|---|---|---|---|---|---|---|---|---|
| 2023-06-19 to 2023-07-14 | 14 | -13.8 | ADA SOL GALA NEAR ZEC | 5L/9S | 15% | 0.20 | 0.17 | 71% | 100% | no follow-through (sideways) |
| 2026-02-12 to 2026-03-10 | 13 | -13.4 | ZEC SOL ADA NEAR GALA | 0L/13S | 8% | 0.06 | 0.08 | 69% | 100% | sideways chop + BTC range-bound + shorting into a bounce |
| 2024-10-07 to 2024-10-30 | 13 | -13.1 | NEAR SOL GALA ADA ZEC | 6L/7S | 14% | 0.12 | 0.18 | 77% | 100% | no follow-through (sideways) |
| 2025-01-08 to 2025-01-20 | 13 | -12.8 | GALA NEAR ZEC ADA | 8L/5S | 6% | 0.03 | 0.07 | 77% | 100% | sideways chop + BTC range-bound |
| 2024-04-27 to 2024-05-16 | 13 | -12.7 | GALA NEAR ZEC SOL | 4L/9S | 5% | 0.08 | 0.08 | 62% | 100% | sideways chop + BTC range-bound |
| 2023-02-12 to 2023-02-25 | 12 | -12.4 | ZEC SOL NEAR GALA ADA | 6L/6S | 6% | 0.33 | 0.16 | 75% | 100% | no follow-through (sideways) + BTC range-bound |
| 2026-10-08 to 2026-11-09 | 12 | -12.2 | ADA GALA NEAR ZEC | 6L/6S | -8% | 0.09 | 0.12 | 58% | 100% | sideways chop |
| 2021-10-04 to 2021-10-26 | 12 | -11.9 | NEAR ADA SOL ZEC GALA | 5L/7S | 23% | 0.22 | 0.17 | 67% | 100% | no follow-through (sideways) |

### T-CORE
| Window | Losses | R | Coins | Side | BTC change | BTC eff. | Coin eff. | Went sideways next 7d | Hit the stop | Likely cause |
|---|---|---|---|---|---|---|---|---|---|---|
| 2023-06-28 to 2023-07-19 | 14 | -14.4 | GALA ARB ETH ZEC ADA NEAR SUI | 7L/7S | -1% | 0.07 | 0.10 | 79% | 100% | sideways chop |
| 2022-10-26 to 2022-11-08 | 13 | -13.5 | ADA ZEC GALA SOL ETH | 7L/6S | -11% | 0.12 | 0.10 | 31% | 100% | reversals against us |
| 2026-04-14 to 2026-05-13 | 13 | -13.5 | ETH GALA ADA SUI SOL NEAR | 5L/8S | 6% | 0.10 | 0.14 | 54% | 100% | mixed |
| 2024-02-21 to 2024-03-18 | 11 | -11.2 | ARB SUI NEAR | 6L/5S | 32% | 0.38 | 0.19 | 73% | 100% | no follow-through (sideways) |
| 2024-10-23 to 2024-11-06 | 11 | -11.2 | ETH SUI ARB ADA | 4L/7S | 10% | 0.38 | 0.08 | 45% | 100% | reversals against us |
| 2020-11-21 to 2020-12-13 | 10 | -10.8 | ADA NEAR ZEC SOL | 6L/4S | 3% | 0.16 | 0.09 | 50% | 100% | sideways chop + reversals against us + BTC range-bound |
| 2021-10-11 to 2021-11-06 | 10 | -10.1 | ZEC NEAR SOL ADA GALA | 3L/7S | 7% | 0.11 | 0.14 | 40% | 100% | reversals against us + BTC range-bound + shorting into a bounce |
| 2023-03-22 to 2023-04-06 | 10 | -8.7 | NEAR SOL ETH ADA GALA | 4L/6S | 3% | 0.08 | 0.08 | 90% | 80% | sideways chop |

## 5. TRI-CORE's 8 deepest drawdowns (closed trades, weighted R)
| Peak to low | Recovered | Depth R | Trades | Win | R by bot (BB/I/T) | Worst coins | BTC change | BTC eff. | Coin eff. | Went sideways | Likely cause |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2023-06-26 to 2023-08-16 | 2023-08-22 | -20.2 | 117 | 24% | -25.0 / -14.2 / -12.5 | GALA -6.4, ADA -4.6 | -5% | 0.08 | 0.14 | 74% | no follow-through (sideways) |
| 2024-08-14 to 2024-11-07 | 2024-12-10 | -19.3 | 193 | 28% | -24.3 / -18.2 / -4.8 | ADA -6.7, ARB -5.1 | 25% | 0.14 | 0.13 | 47% | mixed |
| 2023-03-14 to 2023-05-07 | 2023-06-18 | -18.7 | 111 | 21% | -18.4 / -10.1 / -23.9 | SOL -6.2, ZEC -5.3 | 16% | 0.19 | 0.15 | 71% | no follow-through (sideways) |
| 2022-07-26 to 2022-12-18 | 2023-01-14 | -18.2 | 237 | 28% | -18.9 / -4.9 / -29.3 | SOL -13.2, ADA -4.0 | -21% | 0.17 | 0.17 | 54% | mixed |
| 2026-02-12 to 2026-05-07 | 2026-05-23 | -17.2 | 171 | 26% | -21.5 / -17.7 / +6.3 | ADA -11.3, SOL -5.3 | 18% | 0.15 | 0.13 | 64% | sideways chop |
| 2020-10-06 to 2020-12-27 | 2021-01-14 | -12.8 | 116 | 22% | -2.7 / -14.6 / -25.4 | NEAR -7.2, ZEC -3.9 | 153% | 0.19 | 0.15 | 49% | mixed |
| 2024-12-26 to 2025-01-20 | 2025-02-07 | -12.2 | 71 | 21% | -6.4 / -12.3 / -12.9 | ADA -3.8, NEAR -2.0 | 4% | 0.12 | 0.08 | 70% | sideways chop + BTC range-bound |
| 2025-08-16 to 2025-09-21 | 2025-10-01 | -10.4 | 78 | 21% | -17.2 / -12.3 / +6.1 | GALA -6.8, NEAR -1.6 | -2% | 0.16 | 0.16 | 50% | mixed |

## 6. Where the money comes from
Best 5% of trades (185 of 3699, all bots): +951.6 weighted R of TRI-CORE's +874.1 total.
They had a median next-7-day efficiency of 0.31 (all trades: 0.15), 79% were on BTC's side of its SMA200 (all trades: 73%), and held a median 23.2 days (all: 4.7).

### By side and BTC's trend at entry (BTC above/below its 4h SMA200)
| Bot | Side | BTC | Trades | Win | Avg R | Total R |
|---|---|---|---|---|---|---|
| BB-CORE | long | with BTC trend | 670 | 34% | +0.54 | +361.2 |
| BB-CORE | long | against BTC trend | 144 | 32% | +0.51 | +73.4 |
| BB-CORE | short | with BTC trend | 615 | 38% | +0.29 | +175.4 |
| BB-CORE | short | against BTC trend | 294 | 43% | +0.45 | +131.9 |
| I-CORE | long | with BTC trend | 289 | 34% | +1.64 | +474.7 |
| I-CORE | long | against BTC trend | 67 | 25% | +3.37 | +225.8 |
| I-CORE | short | with BTC trend | 294 | 36% | +0.30 | +88.3 |
| I-CORE | short | against BTC trend | 172 | 29% | +0.19 | +32.7 |
| T-CORE | long | with BTC trend | 428 | 36% | +1.79 | +765.4 |
| T-CORE | long | against BTC trend | 96 | 31% | +3.31 | +318.2 |
| T-CORE | short | with BTC trend | 395 | 42% | +0.26 | +104.1 |
| T-CORE | short | against BTC trend | 235 | 36% | +0.01 | +3.3 |

### By coin (weighted TRI-CORE R)
| Coin | Trades | TRI-CORE R | BB-CORE R | I-CORE R | T-CORE R | of which best 5 trades |
|---|---|---|---|---|---|---|
| ZEC | 718 | +194.8 | +113.4 | +237.1 | +315.0 | +128.1 |
| ADA | 715 | +179.2 | +166.4 | +225.4 | +158.3 | +61.0 |
| SOL | 623 | +156.7 | +117.9 | +148.6 | +242.5 | +70.6 |
| GALA | 519 | +139.0 | +170.2 | +114.6 | +100.8 | +59.4 |
| NEAR | 595 | +118.2 | +122.2 | +95.8 | +132.6 | +44.6 |
| ETH | 167 | +41.0 | +0.0 | +0.0 | +163.9 | +30.3 |
| ARB | 274 | +39.8 | +51.8 | +0.0 | +55.8 | +26.3 |
| SUI | 88 | +5.5 | +0.0 | +0.0 | +22.2 | +9.4 |

### By year (weighted TRI-CORE R)
| Year | Trades | TRI-CORE R | BB-CORE | I-CORE | T-CORE | Avg coin efficiency |
|---|---|---|---|---|---|---|
| 2020 | 268 | +78.4 | +75.4 | +51.6 | +111.2 | 0.18 |
| 2021 | 436 | +201.8 | +178.3 | +197.8 | +252.9 | 0.16 |
| 2022 | 507 | +55.0 | +79.9 | +45.8 | +14.4 | 0.17 |
| 2023 | 626 | +105.3 | +132.2 | +135.1 | +21.6 | 0.16 |
| 2024 | 656 | +169.6 | +93.9 | +104.3 | +386.2 | 0.18 |
| 2025 | 639 | +143.4 | +68.1 | +175.1 | +262.2 | 0.16 |
| 2026 | 567 | +120.6 | +114.1 | +111.9 | +142.4 | 0.17 |

## 7. Months sorted by how trendy the market was
Each month gets the average 7-day efficiency of the 8 coins (measured in weekly pieces). Months are then cut into 5 equal groups.
| Group | Months | Efficiency | TRI-CORE R / month | Losing months | BB-CORE R/m | I-CORE R/m | T-CORE R/m | Examples |
|---|---|---|---|---|---|---|---|---|
| 1 choppiest | 16 | 0.09-0.13 | -0.1 | 50% | -0.2 | -1.3 | +1.3 | 2026-03 2020-09 2021-07 |
| 2 | 16 | 0.13-0.15 | +7.2 | 31% | +4.7 | +11.6 | +7.6 | 2026-10 2025-01 2022-08 |
| 3 | 17 | 0.15-0.17 | +20.3 | 18% | +9.7 | +20.4 | +41.2 | 2021-10 2022-07 2025-11 |
| 4 | 16 | 0.17-0.19 | +12.4 | 13% | +12.3 | +12.6 | +12.5 | 2021-08 2024-12 2024-11 |
| 5 trendiest | 17 | 0.19-0.27 | +13.0 | 6% | +18.3 | +6.5 | +9.0 | 2025-02 2020-10 2023-08 |

Correlation, month efficiency vs TRI-CORE month R: 0.19.

## 8. Could we see the chop coming at entry? (known at entry only)
Coin efficiency over the 7 days BEFORE the signal, and ADX(14), cut into 4 equal groups per bot. (A regime gate was already tested and rejected on Nov 16: see TESTED-STRATEGIES.md, "Regime label as a signal". This table is context.)
| Bot | Measure | Group | Trades | Win | Avg R | Total R | Then went sideways |
|---|---|---|---|---|---|---|---|
| BB-CORE | efficiency before | Q1 (0.00-0.06) | 430 | 38% | +0.95 | +406.4 | 48% |
| BB-CORE | efficiency before | Q2 (0.06-0.13) | 431 | 36% | +0.39 | +167.4 | 52% |
| BB-CORE | efficiency before | Q3 (0.13-0.22) | 431 | 36% | +0.31 | +131.8 | 50% |
| BB-CORE | efficiency before | Q4 (0.22-0.58) | 431 | 36% | +0.08 | +36.3 | 58% |
| BB-CORE | ADX | Q1 (6.70-16.16) | 430 | 35% | +0.79 | +339.5 | 46% |
| BB-CORE | ADX | Q2 (16.17-20.49) | 431 | 38% | +0.46 | +196.1 | 49% |
| BB-CORE | ADX | Q3 (20.49-26.90) | 431 | 38% | +0.44 | +191.2 | 50% |
| BB-CORE | ADX | Q4 (26.92-69.93) | 431 | 36% | +0.04 | +15.1 | 63% |
| I-CORE | efficiency before | Q1 (0.00-0.03) | 205 | 36% | +1.13 | +231.8 | 52% |
| I-CORE | efficiency before | Q2 (0.03-0.07) | 206 | 29% | +0.50 | +102.7 | 53% |
| I-CORE | efficiency before | Q3 (0.07-0.11) | 205 | 33% | +1.27 | +260.5 | 46% |
| I-CORE | efficiency before | Q4 (0.11-0.34) | 206 | 35% | +1.10 | +226.5 | 53% |
| I-CORE | ADX | Q1 (7.61-16.51) | 205 | 30% | +0.34 | +70.5 | 49% |
| I-CORE | ADX | Q2 (16.54-19.83) | 206 | 32% | +0.37 | +75.6 | 50% |
| I-CORE | ADX | Q3 (19.86-24.39) | 205 | 35% | +1.66 | +339.3 | 51% |
| I-CORE | ADX | Q4 (24.39-49.42) | 206 | 36% | +1.63 | +336.1 | 54% |
| T-CORE | efficiency before | Q1 (0.00-0.07) | 288 | 45% | +1.11 | +318.6 | 49% |
| T-CORE | efficiency before | Q2 (0.07-0.15) | 289 | 40% | +1.02 | +294.9 | 52% |
| T-CORE | efficiency before | Q3 (0.15-0.23) | 288 | 35% | +1.61 | +463.9 | 52% |
| T-CORE | efficiency before | Q4 (0.23-0.53) | 289 | 30% | +0.39 | +113.5 | 61% |
| T-CORE | ADX | Q1 (7.47-17.32) | 288 | 42% | +0.87 | +251.8 | 42% |
| T-CORE | ADX | Q2 (17.35-21.68) | 289 | 38% | +1.88 | +543.6 | 53% |
| T-CORE | ADX | Q3 (21.70-27.80) | 288 | 37% | +0.82 | +236.0 | 57% |
| T-CORE | ADX | Q4 (27.82-56.22) | 289 | 33% | +0.55 | +159.6 | 63% |

### Does it hold in both halves? (Q1 = quietest week before entry, Q4 = most already-trending; same cut points as above)
| Bot | Measure | Half | Q1 avg R (n) | Q2 | Q3 | Q4 |
|---|---|---|---|---|---|---|
| BB-CORE | efficiency before | 2020-22 | +1.38 (153) | +0.49 (146) | +0.28 (135) | +0.11 (125) |
| BB-CORE | efficiency before | 2023-26 | +0.71 (277) | +0.33 (285) | +0.32 (296) | +0.08 (306) |
| BB-CORE | ADX | 2020-22 | +1.20 (144) | +0.40 (143) | +0.61 (150) | +0.10 (122) |
| BB-CORE | ADX | 2023-26 | +0.58 (286) | +0.48 (288) | +0.36 (281) | +0.01 (309) |
| I-CORE | efficiency before | 2020-22 | +1.04 (76) | +1.24 (80) | +0.74 (76) | +0.94 (65) |
| I-CORE | efficiency before | 2023-26 | +1.19 (129) | +0.03 (126) | +1.58 (129) | +1.17 (141) |
| I-CORE | ADX | 2020-22 | +0.05 (66) | +0.67 (85) | +1.82 (76) | +1.38 (70) |
| I-CORE | ADX | 2023-26 | +0.48 (139) | +0.16 (121) | +1.56 (129) | +1.76 (136) |
| T-CORE | efficiency before | 2020-22 | +0.64 (92) | +1.48 (103) | +1.13 (83) | +0.96 (77) |
| T-CORE | efficiency before | 2023-26 | +1.33 (196) | +0.77 (186) | +1.81 (205) | +0.19 (212) |
| T-CORE | ADX | 2020-22 | +1.23 (82) | +1.56 (90) | +1.43 (98) | -0.03 (85) |
| T-CORE | ADX | 2023-26 | +0.73 (206) | +2.02 (199) | +0.51 (190) | +0.79 (204) |
