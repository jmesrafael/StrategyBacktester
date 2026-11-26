# Bollinger 80 / 2.6 sigma + 20 ATR trailing stop

**Status:** REJECTED (fails hold-out).

## Rules
- BB-1H-WIDE entry and middle-band first stop, then a 20 x ATR(14) trailing stop, no time exit.

## R per year (1R = the stop distance; 1x = real costs)
| Test | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Max DD | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| Main 12, 1x | 114 | 663 | 153 | 172 | 246 | 393 | 123 | 1863 | 78 | PASS 7/7 |
| Main 12, 2x | 107 | 655 | 144 | 151 | 233 | 379 | 108 |  |  | PASS 7/7 |
| Hold-out 12, 1x | 31 | 225 | 51 | 43 | 312 | -28 | -34 | 599 | 113 | FAIL 5/7 |

## Verdict
- Best main-coin numbers of the whole hunt (in-sample leader), but it loses 2025 and 2026 on unseen coins. Profit comes from a few huge trend trades; longs carry it.

## Files in this folder
- `fam-vol-results.txt`
- `hold-vol.txt`

These are copies. The scripts are two folders up (`../../`) and share `lib.js`; re-running one rewrites its output there.
