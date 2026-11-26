# Baseline: 27 strat-hunt strategies scaled to 1h

**Status:** INFO.

## Rules
- The 27 indicator strategies from `research/strat-hunt-nov6` (RSI, StochRSI, CCI, AO, Elder, Fisher, KST, Heikin-Ashi, EMA ribbon, Ichimoku, VWAP, OBV, Donchian, fractal, BB variants, mean reversion), periods x4 and ATR multiples x2 for 1h.

## Verdict
- 40 of 55 variants are 7/7 on the 12 main coins: "every year positive" alone is easy in 2020-26.
- On the hold-out coins only one stays 7/7 (BB-CORE 1h with a 32-day hold, folder 04).
- Mean reversion (z-score, RSI(2), BB fade) loses in almost every year.

## Files in this folder
- `baseline.txt`
- `strict-baseline.txt`

These are copies. The scripts are two folders up (`../../`) and share `lib.js`; re-running one rewrites its output there.
