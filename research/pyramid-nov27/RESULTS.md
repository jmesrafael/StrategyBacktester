# Pyramid add-on, RESULTS (2026-11-27)

Pre-registered in `PLAN.md` before any run. Code: `run.js` (own copy of the repo engine loop with the add-on; with the add-on off it reproduces
`strat-hunt-nov6/engine.js` exactly: BB-CORE 480.67R, T-CORE 561.15R on SOL NEAR ADA GALA). 8 configs, all logged with `harness-nov27/trials.js`.
Add-on = 0.5 x size, R in original-risk units (R_orig + 0.5 x R_add), costs 0.05% fee + 0.02% slip + funding, 2x run doubles fee and slip.
Note the add raises exposure to 1.5x on trades that get it, so R and DD both grow; only R/DD is compared.
Verdict: **REJECTED**. Neither strategy's IS pick passes.

## BB-CORE 4h (SOL NEAR ADA GALA)

| variant | adds | R | DD | R/DD | IS R/DD | OOS R/DD | OOS R | OOS DD | 2x R/DD | 2x OOS R/DD | ex10 R | ex10 R/DD | yrs+ | yrs beating base |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 0 | 481 | 26.5 | 18.16 | 11.72 | 7.17 | 170 | 23.7 | 16.14 | 6.09 | 277 | 10.46 | 7/7 | 0/7 |
| k1.5 | 480 | 428 | 25.8 | 16.59 | 9.95 | 6.85 | 171 | 25.0 | 13.87 | 5.64 | 228 | 6.44 | 7/7 | 4/7 |
| k2 | 374 | 510 | 30.1 | 16.96 | 11.09 | 7.12 | 177 | 24.8 | 15.12 | 5.90 | 232 | 6.72 | 7/7 | 4/7 |
| k3 | 240 | 540 | 29.9 | 18.04 | 12.34 | 7.27 | 171 | 23.5 | 16.01 | 5.58 | 257 | 7.45 | 7/7 | 5/7 |
| band | 683 | 475 | 36.3 | 13.09 | 9.47 | 4.36 | 159 | 36.3 | 10.47 | 3.28 | 279 | 7.67 | 7/7 | 3/7 |

IS pick: **k3** (IS R/DD 12.34 vs base IS 11.72). Pass checks:

| check | pass | values |
|---|---|---|
| OOS R/DD > baseline | yes | 7.27 vs 7.17 |
| 2x full R/DD > base 2x | NO | 16.01 vs 16.14 |
| 2x OOS R/DD > base 2x | NO | 5.58 vs 6.09 |
| ex10 R > base ex10 | NO | 257 vs 277 |
| ex10 R/DD not worse | NO | 7.45 vs 10.46 |
| yrs+ >= 4 | yes | 7/7 |
| beats base in >=4 yrs | yes | 5/7 |

=> BB FAILS

Per-year R (2020..2026): baseline    25  149   64   73   58   39   73 | k3    28  175   75   91   40   27  103
Add-on trades 240/1068; on those trades baseline R 899 -> with add 974; monthly corr vs baseline 0.983, overlap 1.00
IS->OOS R/DD gain vs baseline per variant (IS / OOS): k1.5 -1.78/-0.33, k2 -0.64/-0.05, k3 0.62/0.09, band -2.25/-2.81

## T-CORE 4h (SOL NEAR ADA GALA)

| variant | adds | R | DD | R/DD | IS R/DD | OOS R/DD | OOS R | OOS DD | 2x R/DD | 2x OOS R/DD | ex10 R | ex10 R/DD | yrs+ | yrs beating base |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 0 | 561 | 29.8 | 18.82 | 10.59 | 9.23 | 275 | 29.8 | 17.99 | 8.78 | 121 | 3.25 | 6/7 | 0/7 |
| k1.5 | 288 | 693 | 56.6 | 12.25 | 10.42 | 5.62 | 318 | 56.6 | 11.27 | 5.11 | 76 | 1.21 | 6/7 | 5/7 |
| k2 | 231 | 650 | 48.2 | 13.49 | 9.21 | 6.52 | 315 | 48.2 | 12.95 | 6.46 | 67 | 1.24 | 6/7 | 5/7 |
| k3 | 167 | 688 | 55.9 | 12.31 | 11.27 | 6.13 | 343 | 55.9 | 11.51 | 5.71 | 111 | 1.76 | 6/7 | 6/7 |
| band | 396 | 634 | 58.8 | 10.78 | 11.38 | 4.86 | 286 | 58.8 | 9.88 | 4.42 | 40 | 0.58 | 6/7 | 5/7 |

IS pick: **band** (IS R/DD 11.38 vs base IS 10.59). Pass checks:

| check | pass | values |
|---|---|---|
| OOS R/DD > baseline | NO | 4.86 vs 9.23 |
| 2x full R/DD > base 2x | NO | 9.88 vs 17.99 |
| 2x OOS R/DD > base 2x | NO | 4.42 vs 8.78 |
| ex10 R > base ex10 | NO | 40 vs 121 |
| ex10 R/DD not worse | NO | 0.58 vs 3.25 |
| yrs+ >= 4 | yes | 6/7 |
| beats base in >=4 yrs | yes | 5/7 |

=> T FAILS

Per-year R (2020..2026): baseline    31  210   11   34  225   -3   53 | band    45  252    5   46  278  -53   61
Add-on trades 396/692; on those trades baseline R 780 -> with add 931; monthly corr vs baseline 0.968, overlap 0.84
IS->OOS R/DD gain vs baseline per variant (IS / OOS): k1.5 -0.18/-3.62, k2 -1.39/-2.71, k3 0.67/-3.10, band 0.79/-4.38

Truncation audit of entry signals: OK (320 checks/0 mismatches; 160 checks/0 mismatches)
## Reading
- BB-CORE: the IS pick (k=3, add at +3R) lifts total R 481 -> 540 but raises DD 26.5 -> 29.9; OOS R/DD 7.27 vs 7.17 (noise-level), and it loses at 2x costs
  (OOS 5.58 vs 6.09), ex-top-10 R/DD falls 10.5 -> 7.5 (the add feeds on the same few big winners and gives back at the break-even stop). Only the first
  OOS check passes. Levels 1.5R and 2R are worse than baseline in IS and OOS; the band-break add is clearly worse (OOS R/DD 4.36).
- T-CORE: every variant adds R but DD roughly doubles (30 -> 48-59). The IS pick (band) has OOS R/DD 4.86 vs 9.23. All four variants lose OOS R/DD
  by 2.7 to 4.4 points. Ex-top-10 R drops from 121 to 40-111: the extra profit is in the top 10 trades.
- IS gain did not carry to OOS in 7 of 8 configs (only BB k3 stays slightly positive, +0.09). Same pattern as the partial-profit rejection from the other side:
  the break-even stop after the add cuts runners that would have recovered, and the add itself is largest where the trade is already extended.
- Monthly correlation with the baseline 0.97-0.98 and overlap 0.84-1.00: no diversification, only more leverage on the same trades.
  The same extra risk via a bigger base size gives the baseline R/DD unchanged, so a pyramid must beat that; it does not.

## Ready-to-paste registry row
| 2026-11-27 | **Pyramid add-on on BB-CORE 4h and T-CORE 4h** (add 0.5 size at +1.5R / +2R / +3R open profit or on a fresh band break, original stop to break-even, add shares the exit; SOL NEAR ADA GALA 2020-Nov 2026; 8 configs, pick on IS <=2023, judge 2024+; pre-registered) | REJECTED | IS picks fail OOS. BB-CORE k3: R 481 -> 540 but DD 26.5 -> 29.9, OOS R/DD 7.27 vs 7.17 (noise), 2x-cost OOS 5.58 vs 6.09, ex-top-10 R/DD 10.5 -> 7.5. T-CORE band: R 561 -> 634, DD 30 -> 59, OOS R/DD 4.86 vs 9.23; all four T-CORE variants cut OOS R/DD by 2.7-4.4. 7 of 8 configs lose OOS R/DD vs baseline; band-break add worst. Extra R is just leverage on the same trades (monthly corr 0.97-0.98) and the break-even stop cuts runners | `pyramid-nov27/PLAN.md`, `RESULTS.md`, `run.js` | Size the base trade up instead; no further add-on variants |
