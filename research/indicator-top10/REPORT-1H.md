# 1-hour timeframe search (Binance USDT-M futures 1h, Sep 2019 - 5 Nov 2026, 7 coins; reports use the 5 bot coins)

Signals on closed 1h bar, fill next open, stop-first on ambiguous candles, fees 0.05%+slip 0.02% per side, funding scaled to 1h. Lengths = 4h values x4. No look-ahead (indicators identical to the 4h-tested code, lookahead2.js).

## A. Sweep summary (analyze-1h.js)
```
configs 684  profitable full: 684  profitable in BOTH halves: 680

TOP 20: profitable both halves, n>=200, by full totR
Keltner ema80x2            f1 i2 t30 n=  897 R 2630 exp 2.93 PF4.11 win14% DD-95% | train  1088R | test  1542R exp2.65 PF3.76
Keltner ema20x2            f0 i2 t30 n= 1502 R 2597 exp 1.73 PF2.79 win11% DD-100% | train  1169R | test  1429R exp1.50 PF2.54
Keltner ema80x2            f0 i2 t30 n= 1608 R 2519 exp 1.57 PF2.61 win11% DD-100% | train  1069R | test  1450R exp1.44 PF2.47
Keltner ema20x2            f0 i2 t20 n= 1805 R 2471 exp 1.37 PF2.47 win14% DD-99% | train   900R | test  1572R exp1.36 PF2.43
CKSP 80-2-72               f0 i2 t20 n= 1484 R 2461 exp 1.66 PF2.81 win15% DD-98% | train   874R | test  1587R exp1.73 PF2.89
PSAR step0.02              f1 i2 t30 n= 1047 R 2447 exp 2.34 PF3.48 win13% DD-96% | train  1078R | test  1370R exp2.08 PF3.18
Donchian n48               f0 i2 t30 n= 1530 R 2435 exp 1.59 PF2.63 win11% DD-100% | train  1027R | test  1408R exp1.49 PF2.51
TSI 25-13                  f1 i2 t30 n=  990 R 2426 exp 2.45 PF3.59 win13% DD-95% | train  1054R | test  1372R exp2.14 PF3.22
Chandelier n200x5          f1 i2 t30 n=  756 R 2415 exp 3.19 PF4.44 win14% DD-90% | train  1050R | test  1365R exp2.83 PF4.00
ZLEMA n50                  f1 i2 t30 n= 1032 R 2414 exp 2.34 PF3.48 win13% DD-95% | train  1086R | test  1328R exp2.06 PF3.14
ZLEMA n400                 f0 i2 t20 n= 2184 R 2411 exp 1.10 PF2.20 win14% DD-100% | train   836R | test  1576R exp1.13 PF2.21
Keltner ema200x3           f0 i2 t30 n= 1177 R 2405 exp 2.04 PF3.12 win12% DD-99% | train  1033R | test  1372R exp1.92 PF2.98
Keltner ema80x2            f0 i2 t20 n= 1899 R 2397 exp 1.26 PF2.34 win13% DD-100% | train   837R | test  1560R exp1.30 PF2.35
Keltner ema400x3           f0 i2 t20 n= 1236 R 2397 exp 1.94 PF3.12 win15% DD-96% | train   839R | test  1557R exp2.01 PF3.17
Donchian n24               f1 i2 t20 n= 1262 R 2389 exp 1.89 PF3.07 win15% DD-96% | train   896R | test  1493R exp1.86 PF3.00
MACD 8-17-9sig             f1 i2 t30 n= 1023 R 2387 exp 2.33 PF3.48 win14% DD-94% | train   982R | test  1405R exp2.24 PF3.35
CKSP 80-2-72               f0 i2 t30 n= 1289 R 2384 exp 1.85 PF2.91 win11% DD-100% | train  1072R | test  1312R exp1.66 PF2.71
Keltner ema50x3            f0 i2 t30 n= 1173 R 2384 exp 2.03 PF3.10 win12% DD-99% | train  1003R | test  1382R exp1.91 PF2.95
Donchian n24               f0 i2 t30 n= 1949 R 2379 exp 1.22 PF2.25 win10% DD-100% | train  1022R | test  1357R exp1.12 PF2.13
CKSP 80-2-72               f1 i2 t20 n= 1025 R 2379 exp 2.32 PF3.58 win16% DD-90% | train   938R | test  1440R exp2.22 PF3.45

TOP 10 by expectancy (n>=300, both halves +)
TRIX n120zero              f1 i2 t30 n=  301 R 1501 exp 4.99 PF6.30 win14% DD-72% | train   570R | test   932R exp4.88 PF6.00
MACD 48-104-72sigpos       f1 i2 t30 n=  448 R 1609 exp 3.59 PF4.76 win13% DD-80% | train   707R | test   902R exp3.14 PF4.24
TRIX n120zero              f1 i2 t20 n=  319 R 1114 exp 3.49 PF4.91 win17% DD-69% | train   350R | test   764R exp3.82 PF5.15
MACD 32-68-36sigpos        f1 i2 t30 n=  564 R 1914 exp 3.39 PF4.63 win14% DD-83% | train   801R | test  1113R exp3.26 PF4.45
Chandelier n200x5          f1 i2 t30 n=  756 R 2415 exp 3.19 PF4.44 win14% DD-90% | train  1050R | test  1365R exp2.83 PF4.00
Aroon n200                 f1 i2 t30 n=  412 R 1300 exp 3.16 PF4.33 win13% DD-96% | train   531R | test   769R exp3.01 PF4.15
TRIX n120zero              f0 i2 t30 n=  523 R 1649 exp 3.15 PF4.27 win11% DD-90% | train   687R | test   962R exp2.94 PF4.00
MACD 48-104-72sigpos       f0 i2 t30 n=  559 R 1730 exp 3.09 PF4.20 win12% DD-92% | train   819R | test   911R exp2.60 PF3.66
MACD 48-104-72sigpos       f1 i3 t30 n=  376 R 1153 exp 3.07 PF4.50 win17% DD-63% | train   505R | test   648R exp2.69 PF4.01
Donchian n400              f1 i2 t30 n=  552 R 1675 exp 3.03 PF4.29 win15% DD-86% | train   643R | test  1032R exp3.08 PF4.26

Plateau per indicator: median full R / share of configs profitable in both halves
Keltner     medR  1561 medExp 1.65 bothHalves 60/60
Chandelier  medR  1550 medExp 1.19 bothHalves 24/24
CKSP        medR  1448 medExp 1.37 bothHalves 48/48
TSI         medR  1426 medExp 0.93 bothHalves 24/24
Donchian    medR  1418 medExp 1.49 bothHalves 60/60
ZLEMA       medR  1364 medExp 0.90 bothHalves 60/60
LSMA        medR  1337 medExp 0.93 bothHalves 24/24
MACD        medR  1330 medExp 1.11 bothHalves 96/96
Vortex      medR  1325 medExp 0.88 bothHalves 48/48
PSAR        medR  1322 medExp 0.93 bothHalves 24/24
Supertrend  medR  1317 medExp 1.01 bothHalves 48/48
McGinley    medR  1261 medExp 1.08 bothHalves 24/24
Aroon       medR  1113 medExp 0.98 bothHalves 47/48
TRIX        medR  1051 medExp 1.36 bothHalves 48/48
Squeeze     medR   694 medExp 1.05 bothHalves 21/24
DMI         medR   381 medExp 1.00 bothHalves 24/24
```

## B. Capped account, 5 bot coins (capped-1h.js)

5 bot coins · start ₱15,750 · cap ₱3,150 
| strategy | trades | R total | exp R | PF | win | avg hold | 2020-26 ends | worst drop | 2023-26 ends | worst drop | 2026 only | worst drop |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4h bb-core (live) | 1341 | 619 | 0.46 | 1.75 | 37% | 5.0d | ₱1,663,354 | -17% | ₱639,921 | -44% | ₱72,822 | -44% |
| 4h I-Core (live) | 764 | 654 | 0.86 | 2.32 | 32% | 8.9d | ₱1,723,282 | -27% | ₱881,588 | -54% | ₱64,572 | -51% |
| 1h bb-core scaled | 1585 | 754 | 0.48 | 1.75 | 35% | 4.6d | ₱2,088,370 | -20% | ₱937,288 | -55% | ₱122,826 | -46% |
| 1h I-Core scaled | 0 | 0 | 0.00 | 99.00 | 0% | NaNd | ₱15,750 | 0% | ₱15,750 | 0% | ₱15,750 | 0% |
| 1h TRIX120 zero f1 i2 t30 | 206 | 1024 | 4.97 | 6.17 | 11% | 7.3d | ₱2,549,307 | -52% | ₱2,053,758 | -54% | ₱25,723 | -38% |
| 1h MACD 48-104-72 sigpos f1 t30 | 308 | 1038 | 3.37 | 4.55 | 12% | 6.6d | ₱2,789,711 | -49% | ₱498,427 | -73% | ₱8,284 | -67% |
| 1h MACD 32-68-36 sigpos f1 t30 | 390 | 1325 | 3.40 | 4.59 | 12% | 6.9d | ₱3,636,375 | -31% | ₱2,017,462 | -82% | ₱11,038 | -67% |
| 1h Keltner80x2 f1 t30 | 626 | 1738 | 2.78 | 3.94 | 12% | 6.8d | ₱4,961,873 | -57% | ₱3,070,343 | -91% | ₱47,902 | -68% |
| 1h Chandelier200x5 f1 t30 | 551 | 1638 | 2.97 | 4.16 | 12% | 7.2d | ₱4,642,638 | -48% | ₱2,887,608 | -82% | ₱46,297 | -66% |
| 1h Donchian400 f1 t30 | 390 | 1088 | 2.79 | 3.97 | 12% | 7.2d | ₱3,009,303 | -36% | ₱1,909,106 | -78% | ₱47,705 | -48% |
| 1h CKSP 80-2-72 f1 t20 | 695 | 1759 | 2.53 | 3.80 | 15% | 5.2d | ₱5,075,994 | -40% | ₱3,148,742 | -90% | ₱107,578 | -43% |

R by year
| strategy | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
| 4h bb-core (live) | 49 | 181 | 85 | 73 | 73 | 73 | 85 |
| 4h I-Core (live) | 19 | 193 | 40 | 95 | 93 | 130 | 84 |
| 1h bb-core scaled | 59 | 174 | 119 | 91 | 100 | 89 | 123 |
| 1h I-Core scaled | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1h TRIX120 zero f1 i2 t30 | 12 | 129 | -7 | -31 | 368 | 502 | 51 |
| 1h MACD 48-104-72 sigpos f1 t30 | 51 | 261 | -31 | -46 | 169 | 656 | -21 |
| 1h MACD 32-68-36 sigpos f1 t30 | 9 | 432 | -18 | -45 | 298 | 641 | 8 |
| 1h Keltner80x2 f1 t30 | 32 | 500 | -37 | -52 | 583 | 602 | 110 |
| 1h Chandelier200x5 f1 t30 | 55 | 459 | -38 | -32 | 498 | 613 | 83 |
| 1h Donchian400 f1 t30 | 28 | 283 | -43 | -10 | 423 | 326 | 80 |
| 1h CKSP 80-2-72 f1 t20 | 40 | 539 | -41 | 207 | 223 | 634 | 155 |

By coin R
| strategy | SOL | ZEC | NEAR | ADA | GALA |
| 4h bb-core (live) | 127 | 125 | 89 | 118 | 161 |
| 4h I-Core (live) | 123 | 198 | 71 | 177 | 85 |
| 1h bb-core scaled | 167 | 106 | 131 | 169 | 181 |
| 1h I-Core scaled | 0 | 0 | 0 | 0 | 0 |
| 1h TRIX120 zero f1 i2 t30 | 174 | 588 | 109 | 86 | 67 |
| 1h MACD 48-104-72 sigpos f1 t30 | 180 | 673 | 34 | 129 | 22 |
| 1h MACD 32-68-36 sigpos f1 t30 | 189 | 737 | 139 | 159 | 100 |
| 1h Keltner80x2 f1 t30 | 411 | 770 | 200 | 232 | 125 |
| 1h Chandelier200x5 f1 t30 | 405 | 666 | 139 | 274 | 153 |
| 1h Donchian400 f1 t30 | 259 | 403 | 87 | 250 | 89 |
| 1h CKSP 80-2-72 f1 t20 | 372 | 724 | 169 | 285 | 209 |

2026 monthly R (Jan..Nov5) for 1h candidates + 4h bb-core
4h bb-core (live)                    -1   8  -2  -6  36  16  -3  44  16 -22  -2
4h I-Core (live)                     -2   3  -5 -11   8  20  -4   2  59  16  -2
1h bb-core scaled                    -4  22  -4  -5  42   9   4  50  24 -13  -3
1h I-Core scaled                      0   0   0   0   0   0   0   0   0   0   0
1h TRIX120 zero f1 i2 t30            -2  -1  -3  -4  -4  10  -4  -4  -4  69   0
1h MACD 48-104-72 sigpos f1 t30      -5   0   0 -10  -8   0  -4  -6  -8  21   0
1h MACD 32-68-36 sigpos f1 t30      -10   0  -5  -8  -7   0  -2  -2 -10  52   0
1h Keltner80x2 f1 t30               -10  -1 -13 -12  -8  34 -17  -3  18 122   0
1h Chandelier200x5 f1 t30           -21  -1  -9  -9  -1  34  -9  -6  21  85   0
1h Donchian400 f1 t30                -8  -1  -5  -6  -6  31  -7  -7  17  73   0
1h CKSP 80-2-72 f1 t20               -5   0  -7  -3  13  15 -11   5  17 131   0

## C. 1h bb-core robustness + slippage stress (bb1h-robust.js)

| config | trades | R | exp R | PF | win | R <2023 / 2023+ | R by year 2020..2026 | ends (cap) | worst drop | 2026 only ends |
|---|---|---|---|---|---|---|---|---|---|---|
| 1h bb-core x4 (80/800/192) [base] | 1585 | 754 | 0.48 | 1.75 | 35% | 351 / 403 | 59 / 174 / 119 / 91 / 100 / 89 / 123 | ₱2,088,370 | -20% | ₱122,826 |
| bbLen 40 | 2133 | 932 | 0.44 | 1.59 | 27% | 542 / 390 | 87 / 269 / 187 / 102 / 114 / 49 / 124 | ₱2,637,842 | -23% | ₱101,135 |
| bbLen 60 | 1808 | 831 | 0.46 | 1.67 | 31% | 412 / 419 | 56 / 227 / 130 / 105 / 106 / 92 / 116 | ₱2,314,366 | -32% | ₱103,423 |
| bbLen 100 | 1490 | 599 | 0.40 | 1.66 | 36% | 258 / 341 | 57 / 127 / 74 / 88 / 59 / 88 / 105 | ₱1,599,744 | -17% | ₱96,037 |
| bbLen 120 | 1392 | 525 | 0.38 | 1.65 | 39% | 209 / 316 | 42 / 125 / 42 / 95 / 54 / 66 / 101 | ₱1,358,235 | -23% | ₱95,091 |
| trendLen 400 | 1840 | 682 | 0.37 | 1.57 | 33% | 297 / 385 | 71 / 143 / 82 / 106 / 92 / 54 / 134 | ₱1,838,422 | -29% | ₱141,796 |
| trendLen 600 | 1685 | 734 | 0.44 | 1.68 | 34% | 314 / 420 | 67 / 145 / 101 / 106 / 105 / 80 / 130 | ₱1,993,172 | -27% | ₱134,695 |
| trendLen 1000 | 1537 | 700 | 0.46 | 1.72 | 35% | 347 / 353 | 48 / 182 / 116 / 90 / 71 / 71 / 120 | ₱1,915,799 | -20% | ₱109,712 |
| trendLen 1200 | 1484 | 674 | 0.45 | 1.71 | 35% | 350 / 324 | 53 / 189 / 108 / 83 / 62 / 63 / 116 | ₱1,829,302 | -21% | ₱110,313 |
| maxBars 96 | 2166 | 507 | 0.23 | 1.42 | 40% | 265 / 242 | 64 / 102 / 98 / 64 / 65 / 74 / 39 | ₱1,316,243 | -28% | ₱26,383 |
| maxBars 144 | 1834 | 631 | 0.34 | 1.57 | 37% | 296 / 335 | 33 / 143 / 120 / 48 / 94 / 112 / 81 | ₱1,690,764 | -27% | ₱68,952 |
| maxBars 288 | 1340 | 768 | 0.57 | 1.85 | 32% | 471 / 297 | 49 / 282 / 140 / 25 / 108 / 111 / 52 | ₱2,108,976 | -20% | ₱38,270 |
| maxBars 384 | 1171 | 760 | 0.65 | 1.91 | 29% | 443 / 317 | 40 / 252 / 151 / 42 / 111 / 84 / 79 | ₱2,097,416 | -26% | ₱53,055 |
| native 20/200/48 on 1h | 6022 | 634 | 0.11 | 1.15 | 31% | 366 / 267 | 111 / 148 / 108 / 13 / 88 / 50 / 117 | ₱1,683,201 | -40% | ₱94,173 |
| slippage x2 (0.04%) | 1585 | 736 | 0.46 | 1.73 | 35% | 346 / 390 | 57 / 172 / 117 / 87 / 97 / 86 / 119 | ₱2,036,156 | -20% | ₱114,022 |
| slippage x3 (0.06%) | 1585 | 719 | 0.45 | 1.71 | 35% | 340 / 378 | 56 / 170 / 114 / 84 / 94 / 84 / 116 | ₱1,978,671 | -20% | ₱107,163 |
| slippage x5 (0.10%) | 1585 | 684 | 0.43 | 1.67 | 35% | 330 / 354 | 54 / 166 / 109 / 76 / 89 / 79 / 109 | ₱1,866,615 | -20% | ₱102,998 |

Note: I-Core scaled to 1h returned 0 trades (parameter mapping not solved; not tested).
