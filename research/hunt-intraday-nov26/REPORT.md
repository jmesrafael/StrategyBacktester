# Intraday hunt (2h), Nov 26 2026
Winner: VOL-MOM-2H (volume-surge momentum continuation on 2h bars built from 1h; 15m/30m not testable: candles/ has no 1m files and the HOLD coins have no 1m anywhere).
Rules: 2h bar (even UTC hours) closes with volume > 2.5 x SMA(volume,50), range > 1.2 x ATR(14), close in top (bottom) 30% of range, green (red) candle, and close above (below) SMA(400). Enter next open. Stop 2 ATR, ATR trail 8 x ATR(14) from best price, no time exit.
Scan: scan.js (2688 configs, 5 families: compression breakout, volume momentum, failed breakout, session range, funding-time; MAIN). Plateau: plateau.js, plateau2.js (70 of 324 neighbours pass 7/7 MAIN+HOLD+2x with ex10>0). Full checks: validate.js / validate.txt.
See validate.txt for yearly tables, audit (0 mismatches/960), correlation 0.51, overlap 48% (entry within 24h) / 85% (holding intervals intersect).
Caveat: long-heavy (longs +1156R, shorts +165R MAIN); HOLD 2x is not 7/7 (2023 -5) and HOLD ex10 at 2x is negative; win rate 26%.
