# Batch 2 — next 18 indicators from the list (4h, 7 coins, no look-ahead: lookahead2.js 0 mismatches)

Indicators: ZLEMA, LSMA, McGinley, Supertrend, PSAR, Aroon, DMI/ADX, Vortex, MACD, TRIX, TSI, STC, CKSP, LinReg slope, Donchian, Keltner, Squeeze, Chandelier. 900 configs (params x SMA200 filter on/off x kInit 2/3 x kTrail 7/14/20). Same trade loop, costs and long-only rules as MA Trend.

## Plateau + risk-adjusted (analyze-b2b.js)
```
BASELINE calmar (CAGR/|DD|) full, test:
bb-core            13.77 9.67 DD -58 cagr 802
I-Core             6.92 4.56 DD -76 cagr 525
MA Trend SMA200    10.13 12.30 DD -84 cagr 846

TOP 15 by FULL calmar, requiring train calmar>0 & test calmar>0 & n>=150
CKSP 10-1-9                  f1 i2 t14 n=485 R1238 exp2.55 PF4.14 win21% DD-71% calmar 15.53 test 14.91
Donchian n20                 f1 i2 t14 n=492 R1241 exp2.52 PF4.04 win21% DD-77% calmar 13.65 test 12.79
Keltner ema20x2              f1 i2 t14 n=412 R1205 exp2.93 PF4.61 win23% DD-84% calmar 13.49 test 19.42
CKSP 20-2-18                 f1 i2 t14 n=454 R1215 exp2.68 PF4.29 win21% DD-72% calmar 12.48 test 11.05
TRIX n30zero                 f1 i2 t14 n=260 R967 exp3.72 PF5.72 win24% DD-49% calmar 11.71 test 10.67
Donchian n50                 f1 i2 t14 n=417 R1123 exp2.69 PF4.27 win22% DD-78% calmar 11.51 test 11.66
MACD 8-17-9sig               f1 i2 t14 n=448 R1101 exp2.46 PF4.03 win21% DD-69% calmar 11.48 test 9.18
Keltner ema20x2              f1 i2 t20 n=389 R1320 exp3.39 PF4.92 win19% DD-87% calmar 11.41 test 10.01
CKSP 10-1-9                  f1 i2 t20 n=456 R1363 exp2.99 PF4.38 win17% DD-80% calmar 11.17 test 7.53
CKSP 40-2-36                 f1 i2 t14 n=431 R1100 exp2.55 PF4.13 win22% DD-78% calmar 10.98 test 12.14
Keltner ema100x3             f1 i2 t14 n=385 R1131 exp2.94 PF4.61 win22% DD-78% calmar 10.93 test 15.42
Keltner ema100x3             f0 i2 t14 n=390 R1129 exp2.90 PF4.54 win22% DD-78% calmar 10.81 test 15.15
CKSP 10-1-9                  f1 i2 t7 n=751 R906 exp1.21 PF2.72 win28% DD-70% calmar 10.78 test 8.68
Keltner ema20x2              f0 i2 t14 n=541 R1221 exp2.26 PF3.64 win18% DD-91% calmar 10.58 test 14.54
Donchian n20                 f1 i2 t7 n=702 R909 exp1.30 PF2.79 win26% DD-71% calmar 10.35 test 9.12

Smoothest: lowest DD with full totR>=800 (beats bb/I-Core R)
TRIX n30zero                 f1 i2 t14 n=260 R967 PF5.72 win24% DD-49% test R535
TRIX n60sig                  f1 i2 t14 n=211 R852 PF6.04 win24% DD-59% test R432
Vortex n14                   f1 i2 t7 n=671 R809 PF2.73 win28% DD-60% test R411
CKSP 40-2-36                 f1 i2 t7 n=609 R830 PF2.93 win28% DD-61% test R472
TRIX n30zero                 f1 i2 t20 n=244 R939 PF5.59 win22% DD-63% test R475
TRIX n60sig                  f1 i2 t20 n=195 R890 PF6.39 win21% DD-64% test R411
CKSP 10-1-9                  f1 i3 t14 n=386 R817 PF3.95 win28% DD-65% test R435
MACD 12-26-9sigpos           f1 i2 t14 n=337 R923 PF4.39 win22% DD-65% test R482
CKSP 20-2-18                 f1 i2 t7 n=669 R880 PF2.88 win28% DD-66% test R459
Vortex n21                   f1 i2 t7 n=615 R822 PF2.98 win30% DD-66% test R425

Plateau per indicator (filter on, kInit 2, kTrail 14): median over its param settings
CKSP        cfgs 3 medR 1215 medTestR 653 medPF 4.14 medDD -72% profit both halves 3/3
Keltner     cfgs 3 medR 1131 medTestR 645 medPF 4.61 medDD -78% profit both halves 3/3
Donchian    cfgs 4 medR 1123 medTestR 599 medPF 4.41 medDD -69% profit both halves 4/4
Vortex      cfgs 3 medR 1069 medTestR 563 medPF 4.31 medDD -84% profit both halves 3/3
TSI         cfgs 2 medR 1050 medTestR 540 medPF 4.25 medDD -78% profit both halves 2/2
LSMA        cfgs 4 medR 1021 medTestR 507 medPF 4.28 medDD -81% profit both halves 4/4
ZLEMA       cfgs 4 medR 1016 medTestR 516 medPF 4.44 medDD -78% profit both halves 4/4
PSAR        cfgs 3 medR 1007 medTestR 534 medPF 3.57 medDD -82% profit both halves 3/3
LRslope     cfgs 3 medR 976 medTestR 455 medPF 4.03 medDD -86% profit both halves 3/3
Aroon       cfgs 4 medR 969 medTestR 520 medPF 3.88 medDD -76% profit both halves 4/4
TRIX        cfgs 6 medR 962 medTestR 527 medPF 4.85 medDD -65% profit both halves 6/6
STC         cfgs 3 medR 943 medTestR 471 medPF 3.67 medDD -82% profit both halves 3/3
MACD        cfgs 9 medR 935 medTestR 481 medPF 4.03 medDD -76% profit both halves 9/9
Squeeze     cfgs 2 medR 741 medTestR 376 medPF 3.35 medDD -68% profit both halves 2/2
Supertrend  cfgs 9 medR 711 medTestR 350 medPF 3.65 medDD -86% profit both halves 9/9
McGinley    cfgs 4 medR 673 medTestR 336 medPF 4.99 medDD -68% profit both halves 4/4
DMI         cfgs 6 medR 580 medTestR 263 medPF 3.68 medDD -72% profit both halves 4/6
Chandelier  cfgs 3 medR 506 medTestR 329 medPF 3.43 medDD -84% profit both halves 3/3
```

## Capped account, 5 bot coins, ₱15,750 start, ₱3,150 risk cap (capped-b2.js)

5 bot coins, start ₱15,750 cap ₱3,150 
| strategy | trades | R total | PF | win | 2020-26 ends | worst drop | 2023-26 ends | worst drop | 2026 only ends | worst drop |
| bb-core | 1341 | 619 | 1.75 | 37% | ₱1,663,354 | -17% | ₱639,921 | -44% | ₱72,822 | -44% |
| I-Core | 764 | 654 | 2.32 | 32% | ₱1,723,282 | -27% | ₱881,588 | -54% | ₱64,572 | -51% |
| CKSP 10-1-9 | 339 | 834 | 4.02 | 20% | ₱2,184,850 | -30% | ₱1,147,264 | -62% | ₱33,548 | -52% |
| Donchian 20 | 355 | 838 | 3.78 | 18% | ₱2,194,366 | -32% | ₱1,146,098 | -72% | ₱34,519 | -55% |
| Keltner 20x2 | 292 | 806 | 4.32 | 20% | ₱2,119,425 | -30% | ₱1,211,698 | -52% | ₱37,008 | -49% |
| TRIX 30 zero | 185 | 648 | 5.12 | 18% | ₱1,647,187 | -27% | ₱988,256 | -35% | ₱19,025 | -33% |
| MACD 8-17-9 | 313 | 714 | 3.75 | 20% | ₱1,862,659 | -24% | ₱726,426 | -60% | ₱29,455 | -50% |
| MA Trend SMA200 | 399 | 767 | 3.27 | 18% | ₱2,026,070 | -33% | ₱1,099,935 | -66% | ₱24,507 | -61% |

Pairs/trios (equal split):
| bb-core + CKSP 10-1-9 | 1680 | 1454 | 2.32 | 33% | ₱1,990,936 | -17% | ₱934,440 | -40% | ₱56,637 | -43% |
| I-Core + CKSP 10-1-9 | 1103 | 1488 | 2.93 | 28% | ₱2,014,039 | -30% | ₱1,064,166 | -38% | ₱50,425 | -47% |
| bb-core + Donchian 20 | 1696 | 1457 | 2.29 | 33% | ₱1,994,603 | -17% | ₱938,118 | -44% | ₱57,211 | -43% |
| I-Core + Donchian 20 | 1119 | 1492 | 2.87 | 27% | ₱2,017,707 | -31% | ₱1,067,844 | -41% | ₱50,999 | -48% |
| bb-core + Keltner 20x2 | 1633 | 1425 | 2.33 | 34% | ₱1,954,809 | -15% | ₱972,121 | -36% | ₱58,455 | -41% |
| I-Core + Keltner 20x2 | 1056 | 1460 | 2.97 | 28% | ₱1,977,912 | -25% | ₱1,101,847 | -33% | ₱52,243 | -44% |
| bb-core + TRIX 30 zero | 1526 | 1267 | 2.29 | 34% | ₱1,730,334 | -13% | ₱857,091 | -28% | ₱49,464 | -34% |
| I-Core + TRIX 30 zero | 949 | 1302 | 2.99 | 29% | ₱1,753,437 | -16% | ₱986,818 | -28% | ₱43,251 | -37% |
| bb-core + MACD 8-17-9 | 1654 | 1333 | 2.23 | 33% | ₱1,822,772 | -13% | ₱802,769 | -34% | ₱54,679 | -38% |
| I-Core + MACD 8-17-9 | 1077 | 1368 | 2.81 | 28% | ₱1,845,875 | -24% | ₱932,495 | -34% | ₱48,466 | -43% |
| bb-core + MA Trend SMA200 | 1740 | 1386 | 2.19 | 32% | ₱1,899,425 | -15% | ₱914,144 | -45% | ₱52,205 | -47% |
| I-Core + MA Trend SMA200 | 1163 | 1421 | 2.70 | 27% | ₱1,922,529 | -23% | ₱1,043,870 | -43% | ₱45,993 | -51% |
| bb-core + I-Core | 2105 | 1273 | 1.96 | 35% | ₱1,761,504 | -18% | ₱824,877 | -46% | ₱73,690 | -47% |
| bb-core + I-Core + CKSP | 2444 | 2107 | 2.32 | 33% | ₱1,948,050 | -19% | ₱957,524 | -33% | ₱61,105 | -45% |
| bb-core + Keltner + TRIX | 1818 | 2073 | 2.69 | 32% | ₱1,898,356 | -11% | ₱1,012,413 | -33% | ₱47,208 | -34% |

By year R (sum) per strategy:
| strategy | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
| bb-core | 49 | 181 | 85 | 73 | 73 | 73 | 85 |
| I-Core | 19 | 193 | 40 | 95 | 93 | 130 | 84 |
| CKSP 10-1-9 | 48 | 301 | -25 | -10 | 325 | 148 | 46 |
| Donchian 20 | 54 | 293 | -33 | -27 | 312 | 189 | 51 |
| Keltner 20x2 | 55 | 260 | -47 | -6 | 335 | 159 | 50 |
| TRIX 30 zero | 78 | 141 | -16 | -8 | 241 | 194 | 19 |
| MACD 8-17-9 | 60 | 242 | -22 | -17 | 228 | 182 | 40 |
| MA Trend SMA200 | 7 | 294 | -45 | -9 | 331 | 151 | 37 |
