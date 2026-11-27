# Second search: more return AND a smaller worst fall, on the strict engine (written Nov 27, 2026 before running)

Why again: the crowded-side rule (`../improve-nov27`) did not survive the independent check. This time every candidate is
run from the start on that check's causal engine (`../improve-nov27/opus-validate/causal.js`, 0 look-ahead mismatches)
with the live US$500 risk cap. Read-only: no bot changes.

## Candidates (few, each with a reason; no risk multiplier is fitted afterwards)
| Id | Change | Reason | Settings |
|---|---|---|---|
| K | ICHI-X4 as a 4th part, others scaled down | Least like the live bots (monthly link 0.07) | share 10, 15, 20, 25% x risk 1.0, 1.1, 1.2 |
| M | Less T-CORE | T-CORE gives most of the worst fall | BB/I/T 60/25/15, 65/20/15, 70/15/15, 60/20/20 x risk 1.0, 1.1 |
| N | Both | combine the two reasons | 55/20/10/15, 55/20/15/10, 60/15/10/15 (BB/I/T/ICHI) x risk 1.0, 1.1 |

## Pass rules (all, against TRI-CORE 50/25/25 at risk 1.0)
1. Flat account, 2020-23 and 2024-26 each: higher growth AND smaller worst fall.
2. Live account (US$600, US$500 cap, MEXC minimums), full period: higher end AND smaller fall.
3. Same account, fresh start 2024: higher growth AND smaller fall.
4. Every 12-month start (live account): higher return in more than half AND smaller fall in more than half.
5. Double fees and slippage (live account, full period): higher end AND smaller fall.
6. At least half of the family's settings pass rule 1.
Then a walk-forward (each Jan 1 2022-26 choose from all candidates, including no change, using earlier data only).

## Limits fixed in advance
- All of 2020 to Nov 2026 has now been used many times (229 settings in the first search). A pass is a lead to shadow test.
- ICHI-X4 itself was found on this history.
