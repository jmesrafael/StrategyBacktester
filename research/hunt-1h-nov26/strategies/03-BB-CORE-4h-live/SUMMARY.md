# BB-CORE 4h (the live bot)

**Status:** LIVE (`bbcore`). Reference for comparison.

## Rules
- 4h close outside Bollinger(20, 2.0) with SMA(200). Stop = middle band (skip if < 0.3 ATR), 48-candle time exit.

## PHP 1,000 (live coins SOL NEAR ADA GALA ZEC ARB, live risk steps 2.5% / 2% / 1.5%)
| Compounding Jan 2020 to Nov 2026 | Worst fall | Average year (fresh 1,000 each Jan) | Worst year | Worst fall inside a year | Worst month | Trades / month | Win rate |
|---|---|---|---|---|---|---|---|
| 4.9M | -38% | +433% | +105% | -56% (2026) | -48% (Oct 2026) | 19 | 37% |

## Verdict
- Middle on return and the worst on risk of the three Bollinger bots here: deepest single month (-48%).
- The 1h versions beat it in most years (BB-CORE 1h in 6 of 7, BB-1H-WIDE in 5).
- Earlier study: +594R, 7/7 years on 4h (`research/strat-hunt-nov6/REPORT.md`). Not tested on the hold-out coins in this study.

## Files in this folder
- `compare3.md`

These are copies. The scripts are two folders up (`../../`) and share `lib.js`; re-running one rewrites its output there.
