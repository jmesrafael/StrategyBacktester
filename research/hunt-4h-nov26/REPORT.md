# 4h hunt (Nov 26, 2026): non-Bollinger strategy positive in every year 2020-2026

Result: ICHI-X4 passes every gate. Harness: lib.js (4h copy of the 1h harness, same engine, 0.05% fee + 0.02% slip + real funding). Scan: scan.js (3,804 configs on MAIN: Donchian, ROC/momentum, Ichimoku, vol-contraction breakout, RSI pullback-in-trend, MA slope; exits ATR stop + time or ATR trail or channel stop). 1,089 were 7/7 on MAIN, 53 of those also 7/7 on HOLD (hold.js). Easy on MAIN, as the 1h hunt found; HOLD and 2x costs separate them.

Rules (4h, long and short, one position per coin): Ichimoku tenkan(9) crosses kijun(26) AND close is outside the cloud (cloud = senkou A/B built from bars 26 earlier, causal; senkou B = 52-bar mid). Long: tenkan crosses above kijun with close above both spans; short mirror. No trend filter. Stop 2 ATR(14) from fill. Exit at the next open after 12 bars (2 days) if the stop was not hit. Decide on closed bar, fill next open.

Files: fam.js, scan.js, scan.json, hold.js, hold.json, plateau.js/.txt, validate.js, validate-b12.txt (candidate), validate-b15.txt (neighbour), audit.js.

## Yearly R (candidate = bars 12; years 2020..2026)
MAIN 1x   49 39 66 34 77 68 46 (R 381, DD 30, ex-top10 298)
MAIN 2x   42 30 54 13 66 51 28
HOLD 1x   46 37 49 32 44 49 53 (R 311); HOLD 2x 39 28 34 13 30 35 33
Neighbour (exit 15 bars): MAIN 1x 42 80 85 50 75 78 50; 2x 35 71 73 29 61 61 32; HOLD 1x 40 54 69 32 46 31 30.
Audit: 480 checks, 0 mismatches. Overlap with BB-CORE 4h: 40% (entry within 24h, same coin+side); 77% if counting any entry while a BB-CORE position is open. Monthly corr 0.42 (neighbour 0.52).
Plateau (plateau.js): 41 of 135 variants pass every gate; the passing region is tenkan 9-10, kijun 20-28, senkou B 52-78, stop 1.5-2.5 ATR, exit 12-18 bars. Tenkan 6, kijun 34 and exits of 8-10 bars fail (2x costs / HOLD).
Weak points: 3x costs 2023 -9R on MAIN (candidate); thin edge per trade (0.12R); 2023 is the thinnest year. Selection note: HOLD was used as a filter on the MAIN 7/7 list (53 passed), as in the 1h hunt.
