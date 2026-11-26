# BB-CORE 1h with a 32-day hold (bb-hybrid BBX192)

**Status:** INFO. Robust on the hold-out coins, but weaker than BB-1H-WIDE.

## Rules
- BB-CORE 1h entry (80 / 2.0 sigma, SMA 800), middle-band stop, time exit after 768 bars (32 days) instead of 192.

## R per year (1R = the stop distance; 1x = real costs)
| Test | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Max DD | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| Main 12, 1x | 124 | 617 | 121 | 60 | 393 | 145 | 214 | 1676 | 163 | PASS 7/7 |
| Main 12, 2x |  |  |  |  |  |  |  |  |  | PASS 7/7 (worst +39) |
| Hold-out 12, 1x |  |  |  |  |  |  |  |  |  | PASS 7/7 (worst +4, 12/12 coins) |
| Hold-out 12, 2x |  |  |  |  |  |  |  |  |  | FAIL 6/7 (worst -9) |

## Verdict
- Passes the hold-out test like BB-1H-WIDE, but return/drawdown is much lower (10.3 vs 17.4) and the drawdown is 2.4x bigger (163R vs 67R).

## Files in this folder
- `strict-baseline.txt`
- `baseline.txt`

These are copies. The scripts are two folders up (`../../`) and share `lib.js`; re-running one rewrites its output there.
