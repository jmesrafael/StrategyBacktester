# Second search for more return AND a smaller worst fall (Nov 27, 2026)

**Nothing passed.** 26 settings on the independent check's causal engine, live US$500 risk cap, rules fixed first (`PLAN.md`).
No bot, server or database was changed.

- ICHI-X4 4th part (12 settings), less T-CORE (8), both (6): none beat TRI-CORE on growth AND worst fall in both flat
  halves (rule 1). Typical result: lower fall with lower growth, or higher growth with higher fall.
- ICHI-X4 port check: 1,383 trades, +205R on the live coins (four-bot study: 1,370, +195R).

## Closest miss (not a pass): BB 55 / I 20 / T 15 / ICHI-X4 10, risk x1.1
| Test | TRI-CORE | Near miss |
|---|---|---|
| Live (US$600, cap), 2020 to Nov 2026: end / worst fall | US$783k / 43.7% | US$823k / 41.4% |
| Live, fresh 2024: growth per year / fall | 397% / 49.1% | 411% / 42.7% |
| Double costs: end / fall | US$715k / 44.2% | US$725k / 43.3% |
| 71 twelve-month starts: higher return / smaller fall | - | 58% / 83% |
| Flat 2020-23: growth / fall | 503% / 54.1% | 520% / 53.8% |
| Flat 2024-26: growth / fall | 640.9% / 53.0% | 640.7% / 52.1% (growth short by 0.2) |

Fails rule 1 (by 0.2 points of growth) and rule 6 (no setting in any family passes rule 1). It is one of 26, picked after
seeing results, so treat it as noise-sized.

## Walk-forward (flat account, each year's choice made from earlier data only)
| Year | Choice | Return / fall | TRI-CORE |
|---|---|---|---|
| 2022 | BB/I/T 70/15/15, x1.1 | 346% / 46.4% | 272% / 43.3% |
| 2023 | BB/I/T/ICHI 60/15/10/15, x1.1 | 573% / 51.8% | 737% / 54.1% |
| 2024 | BB/I/T 70/15/15, x1.0 | 321% / 53.2% | 313% / 52.9% |
| 2025 | BB/I/T/ICHI 60/15/10/15, x1.0 | 587% / 41.8% | 859% / 45.3% |
| 2026 | BB/I/T/ICHI 55/20/10/15, x1.0 | 812% / 46.9% | 1,054% / 53.0% |

No year gave both a higher return and a smaller fall.

## Without the US$500 risk cap (owner request, after the run; `nocap.js`)
Live account, US$600 start, Jan 2020 to Nov 24 2026. TRI-CORE: US$10.6M, worst fall 43.7%; fresh 2024 396% a year, fall 49.1%.
5 of 26 beat TRI-CORE on growth AND worst fall in both the full period and the fresh 2024 start:

| Version (risk) | Ends at | Worst fall | Fresh 2024: growth / fall |
|---|---|---|---|
| BB/I/T 65/20/15 (x1.1) | US$15.8M | 40.8% | 423% / 46.4% |
| BB/I/T 70/15/15 (x1.1) | US$14.6M | 39.5% | 405% / 46.5% |
| BB/I/T 60/20/20 (x1.1) | US$17.4M | 41.9% | 442% / 47.4% |
| BB/I/T 60/25/15 (x1.1) | US$16.8M | 42.3% | 412% / 47.0% |
| ICHI-X4 20% (x1.2) | US$13.9M | 43.3% | 427% / 46.2% |

Still not a pass: all five have a LARGER worst fall than TRI-CORE in the 2020-23 idealised test (rule 1), no rolling 12-month
or walk-forward check was run without the cap, and the dollar amounts assume perfect fills at any size.

## Every test, no cap (`allaspects.js`)
7 tests (live full period, live fresh 2020-23 and 2024-26, flat 2020-23 and 2024-26, double costs, fills 1 hour late), each
needing higher growth AND a smaller worst fall. **None of the 26 passes all 7.** Closest: ICHI-X4 20% x1.2 (6/7; fails flat 2020-23,
fall 55.8 vs 54.1%) and the four BB-heavier shares at x1.1 (5/7; fail both flat tests on the fall). In 71 rolling 12-month runs
none is better on both in more than 44% (BB/I/T 70/15/15 x1.1 best); by calendar year none is better on both in more than 3 of 7.

## Files
`PLAN.md`, `run.js` -> `results.json`, `nocap.js` -> `nocap.json`, `allaspects.js` -> `allaspects.json`.
