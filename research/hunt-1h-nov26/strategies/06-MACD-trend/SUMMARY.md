# MACD x8 signal cross + SMA 1200 (trend-family leader)

**Status:** REJECTED (fails hold-out).

## Rules
- MACD(96, 208, 72) line crosses its signal line, only with the SMA(1200) trend. 4 x ATR initial stop, exit on the opposite cross.

## R per year (1R = the stop distance; 1x = real costs)
| Test | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Max DD | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| Main 12, 1x | 107 | 312 | 160 | 150 | 76 | 101 | 74 | 980 | 67 | PASS 7/7 |
| Hold-out 12, 1x | 105 | 193 | 116 | 66 | 132 | -23 | -34 | 555 | 125 | FAIL 5/7 |
| Hold-out 12, 2x | 99 | 184 | 104 | 47 | 117 | -39 | -58 | 455 | 148 | FAIL 5/7 |

## Verdict
- All 12 neighbour settings were 7/7 on the main coins, yet each tested one loses 2025-26 on unseen coins. Monthly correlation with BB-1H-WIDE 0.68.

## Files in this folder
- `fam-trend-results.txt`
- `hold-trend.txt`

These are copies. The scripts are two folders up (`../../`) and share `lib.js`; re-running one rewrites its output there.
