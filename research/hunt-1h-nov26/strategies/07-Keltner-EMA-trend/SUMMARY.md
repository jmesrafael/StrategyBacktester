# Keltner breakout and EMA 50/200 cross (trend family)

**Status:** REJECTED (fail hold-out).

## Rules
- Keltner(50 or 200, 3.5 x ATR) close breakout, 3-4 x ATR stop with an 18-22 x ATR trail.
- EMA 50/200 cross with efficiency ratio > 0.2, 4 x ATR stop, 22 x ATR trail.

## R per year (1R = the stop distance; 1x = real costs)
| Test | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Max DD | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| Keltner 50, main 1x | 232 | 712 | 38 | 353 | 324 | 150 | 138 | 1946 | 129 | PASS 7/7 |
| Keltner 50, hold-out 1x | 9 | 142 | -25 | 171 | 396 | -131 | 43 | 604 | 233 | FAIL 5/7 |
| Keltner 200, hold-out 1x | -19 | 241 | 40 | 103 | 336 | -112 | -58 | 530 | 231 | FAIL 4/7 |
| EMA, main 1x | 63 | 484 | 77 | 172 | 182 | 123 | 45 | 1147 | 84 | PASS 7/7 |
| EMA, hold-out 1x | 18 | 90 | -9 | 45 | 223 | -139 | 3 | 231 | 200 | FAIL 5/7 |

## Verdict
- Big main-coin profits driven by 2021 and the alt runs; large losses in 2025 on unseen coins.

## Files in this folder
- `fam-trend-results.txt`
- `hold-trend.txt`

These are copies. The scripts are two folders up (`../../`) and share `lib.js`; re-running one rewrites its output there.
