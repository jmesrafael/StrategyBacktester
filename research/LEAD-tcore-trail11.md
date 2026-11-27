# Quick look: T-CORE trailing stop 11 ATR (live 14) - Nov 27, 2026
Status: LEAD, paper test only. No bot changed. Not yet reviewed by Opus.
Change: T-CORE `kTrail` 14 -> 11 (nothing else). Engine: `improve-nov27/opus-validate/causal.js` (causal, live rules, US$500 cap).

| Whole TRI-CORE 50/25/25 | Current (14) | Trail 11 | Change |
|---|---|---|---|
| End, US$600 live, 2020-Nov 2026 | US$782,730 | US$824,365 | +5.3% |
| Worst fall | 43.7% | 43.1% | -0.6 pts |
| Fresh start 2024: end on US$600 | US$62,335 | US$69,710 | +11.8% |
| Fresh start 2024: fall | 49.1% | 46.4% | -2.7 pts |
| Unseen flat 2024-26: growth/yr / fall | 640.9% / 53.0% | 709.0% / 52.7% | +68 pts / -0.3 |
| Flat 2020-23: growth/yr / fall | 503.0% / 54.1% | 505.5% / 53.9% | +2.5 / -0.2 |
| Double costs: growth/yr / fall | 179.3% / 44.2% | 181.3% / 43.6% | +2 / -0.6 |
| Fills 1h late: fall | 49.2% | 44.0% | -5.2 pts |
| T-CORE trades / total R | 1,152 / 1,057 | 1,268 / 1,155 | +9% R |

Checks: bench 6/6 (trail 10 and 11; 12-13 5/6; 9 and 8 fail). 12-month starts (71): trail 11 higher return 49, smaller fall 56 (trail 10: 58 / 62).
Standalone T-CORE live 8 coins: better on 7/8 coins, still higher at 3x costs and without the 10 best trades.
HOLD-OUT (9 coins not live): R 1,127 (14) / 1,087 (11) / 911 (10) -> trail 11 neutral, trail 10 does NOT hold out (use 11, not 10).
Weak spots: gain is modest (full-history fall -0.6 pts); trail 11 shuffle test not run (trail 10 was: +9% median end); no Opus review.

Other families tried the same day, nothing passed: signal-quality sizing (F2), allocation / vol targeting (F3), coin lists (F4, best 4/6).
Also: S8 heat rule (`dd-nov27/RESULTS.md`), weak lead, a smaller-fall option at -12% profit.

Files: `both-nov27/RESULTS.md` (summary), `PLAN.md`, `h.js` (bench), `f1-results.md`, `surv-f1.txt`, `shuf10.txt`, `tc.txt`.
Next: Opus review, shuffle test for trail 11, log-only paper test in the live bot.
