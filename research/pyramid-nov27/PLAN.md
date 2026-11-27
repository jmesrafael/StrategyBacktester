# Pyramid add-on: PLAN (written before any run, 2026-11-27)

Question: does adding a half-size add-on to a winning trade improve R per drawdown (R/DD)?
Context: registry row 2026-11-26 "Partial profit at open-profit level" was REJECTED (it cut winners). A pyramid is the opposite
(add to winners), but a break-even stop after the add can also cut winners; this tests it.

Strategies (4h, coins SOL NEAR ADA GALA, 2020-Nov 2026, engine = strat-hunt-nov6/engine.js rules, 0.05% fee + 0.02% slip + funding):
- BB-CORE: Bollinger(20,2) close-through, 200-SMA trend, 0.3 ATR filter, stop at middle band, 48-candle time exit.
- T-CORE: same entry flags, 2 ATR stop, 14 ATR trail, no time exit.
R unit = original risk (entry-to-stop distance). Add-on = 0.5 x original size, so total trade R = R_orig + 0.5 x R_add (same unit).

Add-on rules (fixed now):
- Level variants k = 1.5, 2, 3: when price reaches entry +/- k x R-distance (first touch, candle high/low, checked after the stop check
  of that candle), add 0.5 size filled at max(level, open) (long) + 0.02% slip. Original stop moves to break-even (entry price) from the
  NEXT candle on (never loosened; T-CORE keeps trailing if higher). Add-on shares stop and exit (time exit or stop). One add per trade.
- Band variant "B": after entry (not the entry candle), the first fresh close-through in trade direction (flag on at close i, off at i-1)
  adds 0.5 size at the next open; stop to break-even if price is beyond entry at that open. One add per trade.
- 4 variants x 2 strategies = 8 configs (max 9). Every config logged with harness-nov27/trials.js. Baselines are not configs.

Selection: per strategy, pick the variant with the best IS (exits <= 2023) R/DD. Only the IS pick is judged.
Pass (all required, per strategy, for the IS pick vs its own baseline):
 1. OOS (exits 2024+) R/DD higher than baseline OOS R/DD.
 2. At 2x costs the pyramid still beats baseline at 2x on full-period R/DD AND OOS R/DD.
 3. Ex top-10 trades: full-period total R (pyramid) > baseline ex-top-10, and R/DD ex-top-10 not worse.
 4. Pyramid total R positive in more than half of the 7 years (>=4), and pyramid beats baseline R in >=4 of 7 years.
Verdict: LEAD if both strategies pass or one passes with the other not worse; REJECTED if neither passes. Only passing one while the other
fails = LEAD (weak) only if it passes all four above. Look-ahead audit: signals are unchanged from BB-CORE (truncation audit via harness);
pyramid logic uses only data up to the current candle (checked: no future bars).
Also reported (info): monthly correlation and trade overlap with baseline.
