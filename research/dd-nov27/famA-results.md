# Family A - fall throttle results

Baseline: live, US$600, 50/25/25, risk x1, US$500 cap. 71 twelve-month windows. Peak equity is observed at signal times only (engine calls sizeFn only at signals).

| setting | end US$ | worst fall | end % base | 2024 growth/yr (base) | 2024 fall (base) | 2x cost end | 2x cost fall (base) | 12m smaller fall | 12m profitable (base) | R1 | R2 | R3 | R4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BASELINE | 782,730 | 43.7% | 100% | 396.8% | 49.1% | 714,731 | 44.2% | - | 71/71 | - | - | - | - |
| T10_f0.75 | 666,247 | 37.3% | 85.1% | 292.2% (396.8%) | 43.7% (49.1%) | 561,569 | 38.6% (44.2%) | 100.0% | 71/71 (71) | pass | fail | pass | pass |
| T10_f0.5 | 341,711 | 32.7% | 43.7% | 192.5% (396.8%) | 37.7% (49.1%) | 247,137 | 33.8% (44.2%) | 100.0% | 71/71 (71) | fail | fail | pass | pass |
| T10_f0.35 | 125,590 | 30.2% | 16.0% | 132.5% (396.8%) | 34.5% (49.1%) | 63,681 | 28.6% (44.2%) | 100.0% | 70/71 (71) | fail | fail | pass | fail |
| T15_f0.75 | 679,183 | 39.5% | 86.8% | 302.8% (396.8%) | 43.7% (49.1%) | 598,275 | 40.8% (44.2%) | 98.6% | 71/71 (71) | pass | fail | pass | pass |
| T15_f0.5 | 402,446 | 37.5% | 51.4% | 197.1% (396.8%) | 39.0% (49.1%) | 321,117 | 38.6% (44.2%) | 100.0% | 69/71 (71) | fail | fail | pass | fail |
| T15_f0.35 | 107,664 | 33.6% | 13.8% | 154.8% (396.8%) | 36.4% (49.1%) | 61,657 | 33.1% (44.2%) | 100.0% | 69/71 (71) | fail | fail | pass | fail |
| T20_f0.75 | 700,350 | 38.9% | 89.5% | 311.7% (396.8%) | 45.5% (49.1%) | 622,927 | 40.3% (44.2%) | 100.0% | 70/71 (71) | pass | fail | pass | fail |
| T20_f0.5 | 514,139 | 35.3% | 65.7% | 198.7% (396.8%) | 39.9% (49.1%) | 340,462 | 37.3% (44.2%) | 98.6% | 69/71 (71) | fail | fail | pass | fail |
| T20_f0.35 | 270,077 | 33.1% | 34.5% | 158.5% (396.8%) | 37.6% (49.1%) | 170,967 | 34.1% (44.2%) | 100.0% | 69/71 (71) | fail | fail | pass | fail |
| T25_f0.75 | 728,052 | 40.1% | 93.0% | 310.8% (396.8%) | 47.0% (49.1%) | 635,440 | 41.4% (44.2%) | 100.0% | 69/71 (71) | pass | fail | pass | fail |
| T25_f0.5 | 626,129 | 38.5% | 80.0% | 204.6% (396.8%) | 44.0% (49.1%) | 359,270 | 37.5% (44.2%) | 100.0% | 69/71 (71) | fail | fail | pass | fail |
| T25_f0.35 | 336,633 | 35.9% | 43.0% | 178.5% (396.8%) | 41.3% (49.1%) | 253,025 | 36.1% (44.2%) | 100.0% | 68/71 (71) | fail | fail | pass | fail |
| T15_f0.5_r5 | 310,917 | 32.7% | 39.7% | 193.3% (396.8%) | 38.9% (49.1%) | 172,309 | 33.9% (44.2%) | 100.0% | 70/71 (71) | fail | fail | pass | fail |
| T15_f0.35_r5 | 56,738 | 29.8% | 7.2% | 145.2% (396.8%) | 36.4% (49.1%) | 36,395 | 30.6% (44.2%) | 100.0% | 71/71 (71) | fail | fail | pass | pass |
| T20_f0.5_r10 | 374,780 | 33.9% | 47.9% | 196.0% (396.8%) | 39.9% (49.1%) | 314,053 | 34.8% (44.2%) | 100.0% | 69/71 (71) | fail | fail | pass | fail |
| T20_f0.35_r10 | 218,532 | 30.1% | 27.9% | 142.3% (396.8%) | 37.6% (49.1%) | 97,242 | 32.0% (44.2%) | 100.0% | 69/71 (71) | fail | fail | pass | fail |

Passing rules 1-4: none

## Notes (honest)
- Baseline reproduces PLAN.md (782,730 / 43.7%, 3,791 trades). Grid was fixed before running; nothing was tuned afterwards.
- No setting passes rules 1-4. R2 (2024 growth >= 85% of baseline) fails for every setting: the closest (T20_f0.75) keeps 78.6% of baseline growth (311.7% vs 396.8%/yr).
- Mild throttles (f0.75, T10/T15) pass R1, R3, R4 (fall -6.4 and -4.2 points) but cost 13-15% of the end value and 26% of 2024 growth. Deeper factors cut the fall more but destroy growth (compounding drag while below peak).
- Throttling is a pure trade-off: the fall shrinks roughly in step with the lost growth. No free lunch seen.
- Limitation: peak equity is only observed at signal times (engine only calls sizeFn at signals), so the peak is slightly underestimated.
- Rule 5 (shuffle) not run here; trades per setting in famA-trades.json (bot, R, t, tExit, mult, w).
