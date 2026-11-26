# Regime hunt (Nov 26, 2026): NONE FOUND

Harness: lib.js (copy of hunt-1h-nov26, TF env for 4h), engine strat-hunt-nov6, costs 0.05% fee + 0.02% slip + funding. MAIN 12 only; HOLD 12 never touched.
Regime fixed before testing: efficiency ratio ER(96 bars) < 0.15/0.25 (+ ADX14 < 22 variant; ER200<0.12; ER48<0.2). 4h lookbacks scaled /4.
Scans (fam.js, scan.js, out-*.txt), 1h and 4h, ranked on 2020-23 only:
- Donchian failed-breakout fade (120 configs/TF), Bollinger failed-breakout fade (160), RSI extreme in range (120), parabolic-spike fade (72): 0 configs positive in all 4 IS years. Best: ~-0.02 to +0.06R/trade, ex-top-10 negative.
- Weekend/low-volume drift (96 + 576 configs, scan.js wk, scan2.js): only family with an IS edge: LONG Friday evening UTC, hold 24-48 1h bars, 2 ATR stop, with close > SMA800.
  Controls (final.js / run-final.js): no trend filter 2025 -84R; Mon-Thu entries ~0 or negative, Sat/Sun/Mon negative; mirrored short below SMA800 = 0. Edge is Friday-specific but 1 of 4 weekdays scanned (multiple-comparison caveat).
Best IS-pick (Fri 16 UTC, SMA800, 2 ATR, 24 bars): MAIN 1x +546R, 20:91 21:159 22:61 23:150 24:86 25:-18 26:18 (6/7); 2x 2025 -32; corr vs BB-CORE 4h monthly 0.31; positive in 13/28 BB-CORE losing months (sum +29R). Fails 7/7, 2x, corr, half-of-losing-months.
Grid of 4 regimes x 4 hours x 3 holds x 2 stops (grid-gates.json, grid-gates.js): no cell passes all gates. Only 7/7 at 1x and 2x: Fri 16 UTC, 48 bars (+450R ex10, worst +7R at 2x) but corr 0.36-0.39 and 46% of losing months. Best corr/loss-month cell (Fri 22, 24 bars, 3 ATR): corr 0.22, 71% losing months, but 2x 2025 -11R and 1x 2025 +1R.
HOLD, audit.js and plateau checks not run: no candidate cleared MAIN gates.
