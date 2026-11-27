# Family C results (streak / day limits)

Baseline (causalC, no change): end US$782,730, worst fall 43.7%, 3791 trades; fresh-2024 end 62,335 growth/yr 396.8% fall 49.1%; double-cost end 714,731 fall 44.2%; 12-month starts profitable 71/71.

Rules: 1 = fall at least 1pt smaller and end >=85% of baseline; 2 = fresh-2024 fall smaller and growth/yr >=85%; 3 = double cost ends >600 and fall smaller; 4 = smaller fall in >half of 71 12-month starts and profitable windows >= baseline. Rule 5 (shuffle) NOT run here.

| setting | end US$ | fall % | trades | fresh24 end | fresh24 g/yr % | fresh24 fall % | 2xcost end | 2xcost fall % | 12m smaller fall | 12m profitable | R1 | R2 | R3 | R4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S2x0.5 | 462,892 | 38.8 | 3789 | 19,223 | 231.0 | 43.9 | 353,422 | 40.9 | 64/71 | 69/71 | fail | fail | pass | fail |
| S3x0.5 | 558,683 | 38.2 | 3789 | 24,138 | 258.0 | 45.0 | 446,700 | 39.8 | 65/71 | 71/71 | fail | fail | pass | pass |
| S4x0.5 | 589,478 | 40.2 | 3789 | 25,345 | 264.1 | 49.8 | 478,453 | 41.7 | 56/71 | 71/71 | fail | fail | pass | pass |
| S2x0.25 | 198,494 | 41.4 | 3789 | 10,129 | 165.3 | 42.3 | 132,241 | 42.4 | 63/71 | 66/71 | fail | fail | pass | fail |
| S3x0.25 | 284,471 | 37.2 | 3789 | 13,238 | 191.0 | 43.1 | 218,267 | 39.2 | 58/71 | 66/71 | fail | fail | pass | fail |
| S4x0.25 | 339,675 | 39.4 | 3789 | 14,306 | 198.9 | 51.6 | 261,901 | 41.0 | 42/71 | 68/71 | fail | fail | pass | fail |
| P5/24 | 714,035 | 45.9 | 3556 | 11,610 | 178.1 | 51.3 | 627,284 | 47.3 | 18/71 | 71/71 | fail | fail | fail | fail |
| P5/48 | 612,530 | 46.5 | 3344 | 4,880 | 106.2 | 48.7 | 570,890 | 47.9 | 29/71 | 71/71 | fail | fail | fail | fail |
| P8/24 | 738,460 | 44.3 | 3732 | 40,497 | 328.1 | 51.1 | 656,898 | 49.4 | 22/71 | 69/71 | fail | fail | fail | fail |
| P8/48 | 702,947 | 49.1 | 3669 | 37,031 | 315.0 | 56.4 | 629,595 | 50.6 | 21/71 | 67/71 | fail | fail | fail | fail |
| P10/24 | 753,373 | 41.5 | 3754 | 54,729 | 375.0 | 48.5 | 674,187 | 45.9 | 27/71 | 69/71 | pass | pass | fail | fail |
| P10/48 | 752,069 | 40.9 | 3729 | 42,858 | 336.5 | 58.0 | 667,855 | 43.3 | 29/71 | 67/71 | pass | fail | pass | fail |
| C1 S3x0.5+P8/24 | 469,845 | 43.6 | 3737 | 22,119 | 247.4 | 44.8 | 410,644 | 45.0 | 56/71 | 69/71 | fail | fail | fail | fail |
| C2 S2x0.5+P5/24 | 300,446 | 43.3 | 3605 | 9,670 | 161.1 | 44.0 | 196,556 | 44.7 | 63/71 | 71/71 | fail | fail | fail | pass |

## Verdict
No setting passes rules 1-4. Streak cuts (S) lower the fall (best S3x0.25 37.2%, S3x0.5 38.2%) but end at 36-75% of baseline, so rule 1 and rule 2 fail on size of profit given up. Pauses (P) keep profit but fall 1-5 points WORSE in most cases (pausing misses recovery trades); only P10/24 (41.5%) and P10/48 (40.9%) pass rule 1, and then fail rule 3 or 4 (and P10/48 fails rule 2). Combined C1/C2 do not help.
Risk: streak rules look good in-sample and typically break under shuffle (they lean on the actual clustering of losses); rule 5 not run here, so even the partial passes are unproven. Not tested: per-bot streaks, time-of-day limits, pause defined on realized loss only, other grids. Per-setting trades (live full period) in famC-trades.json (key BASELINE too).
