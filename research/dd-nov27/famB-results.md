# Family B: portfolio heat (results)

Baseline (causalB, no sizeFn, live US$600, cap US$500): end US$782,730, worst fall 43.7%, 3791 trades. Reproduces PLAN baseline (782,730 / 43.7).

Rules: 1 = fall at least 1 pt smaller AND end >= 85% of base. 2 = fresh 2024: fall smaller AND CAGR >= 85% of base. 3 = double costs: end > 600 AND fall smaller. 4 = 71 12-month fresh starts: smaller fall in > half AND positive count >= baseline. Rule 5 (shuffle) not run here.

| setting | end US$ | % of base | fall % | trades | R1 | fresh24 CAGR % / fall % | R2 | x2 end / fall | R3 | 12m smaller fall | 12m positive (base) | R4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BASE | 782,730 | 100.0 | 43.7 | 3791 | . | 396.8 / 49.1 | . | 714,731 / 44.2 | . | 0/71 | 71 (71) | . |
| T6 | 327,577 | 41.9 | 36.7 | 3789 | . | 183.8 / 32.1 | . | 252,740 / 37.9 | y | 71/71 | 71 (71) | y |
| T8 | 496,697 | 63.5 | 39.7 | 3789 | . | 254.0 / 34.3 | . | 418,432 / 41.1 | y | 71/71 | 71 (71) | y |
| T10 | 617,197 | 78.9 | 41.6 | 3789 | . | 284.3 / 38.2 | . | 546,882 / 43.4 | y | 70/71 | 71 (71) | y |
| S4 | 437,789 | 55.9 | 30.7 | 3789 | . | 261.7 / 31.2 | . | 371,739 / 31.9 | y | 71/71 | 71 (71) | y |
| S6 | 610,096 | 77.9 | 38.9 | 3789 | . | 355.3 / 34.8 | y | 526,516 / 40.3 | y | 71/71 | 71 (71) | y |
| S8 | 692,294 | 88.4 | 40.0 | 3789 | y | 378.9 / 36.7 | y | 632,687 / 41.4 | y | 71/71 | 71 (71) | y |
| R4 | 636,999 | 81.4 | 36.6 | 3789 | . | 252.2 / 33.8 | . | 525,471 / 38.9 | y | 71/71 | 71 (71) | y |
| R6 | 763,497 | 97.5 | 39.9 | 3791 | y | 332.4 / 36.4 | . | 695,719 / 41.4 | y | 67/71 | 71 (71) | y |
| R8 | 783,721 | 100.1 | 43.2 | 3791 | . | 385.2 / 41.4 | y | 713,963 / 43.7 | y | 56/71 | 71 (71) | y |
| R10 | 782,730 | 100.0 | 43.7 | 3791 | . | 393.4 / 43.8 | y | 714,731 / 44.2 | . | 44/71 | 71 (71) | y |
| R12 | 782,730 | 100.0 | 43.7 | 3791 | . | 395.4 / 48.4 | y | 714,731 / 44.2 | . | 40/71 | 71 (71) | y |
| R8skip | 779,791 | 99.6 | 43.7 | 3790 | . | 360.0 / 43.7 | y | 711,410 / 44.1 | y | 52/71 | 69 (71) | . |
| T8q | 206,968 | 26.4 | 39.4 | 3789 | . | 182.5 / 29.6 | . | 169,811 / 40.7 | y | 71/71 | 71 (71) | y |
| S6q | 435,100 | 55.6 | 38.2 | 3789 | . | 316.4 / 31.6 | . | 366,727 / 39.6 | y | 71/71 | 71 (71) | y |

Passing rules 1-4: S8

## Notes (honest reading)
- Only S8 (same-side across all bots > 8 -> x0.5) passes rules 1-4: end 692,294 (88.4% of base), fall 40.0% (-3.7 pts), fresh-2024 CAGR 378.9% vs 396.8% (95.5%), fall 36.7 vs 49.1, double cost ends 632,687 / fall 41.4 vs 44.2, 71/71 12-month starts with smaller fall.
- R6 (open risk > 6% -> x0.5) is the near miss: end 97.5% of base, fall 39.9, but fresh-2024 CAGR 332.4% is 83.8% of base (needs 85%), so it FAILS rule 2 by a hair. Reported as failed, not rescued.
- Tight settings (T6, T8, T4-S4, T8q, S6q, R4) cut the fall a lot but cost 20-75% of the end; they fail rule 1 and/or 2.
- R8/R10/R12/R8skip rarely bind (fall barely moves) and fail rule 1 (fall gain < 1 pt).
- Trades differ by 2 (3789 vs 3791) in most settings; the lower sizes sometimes fall under MEXC minimum contract and are skipped.
- Risk is measured at each open trade's ORIGINAL stop (qty*|entry-stop0|) as a fraction of marked equity; trailed stops are not used to reduce it. Orders placed at the same 4h close by earlier bots (bb, ic, tc order) count toward the heat.
- Rule 5 (shuffle) not run by me. Trade lists: famB-trades.json (BASE + 14 settings: bot,R,t,tExit,mult,w).
- Caveat: 2020-2026 used many times; a pass is a lead to shadow-test.
