# Improve TRI-CORE: more return and a smaller worst fall (Nov 27, 2026)

**Status: UNPROVEN, shadow log only (independent check, same day). No bot, server or database was changed.**

> **Read `opus-validate/REPORT.md` first.** It corrects this file: the live US$500 per-trade risk cap was not modelled, so the
> PHP amounts below are not reachable. With the cap the full-period money is about the same as today (worst fall 41.9% vs
> 43.7% at x1.11). "x1.05 same money, smaller fall" and "x1.11 tie on worst fall" did not hold, a walk-forward never picked
> this rule, and `engine.js` has two small look-ahead faults.

## The change
Each bot makes a new trade smaller when it already holds several trades in the same direction.

| Bot's own open trades in the same direction | Size of the new trade |
|---|---|
| 0, 1 or 2 | full |
| 3 | 3/4 |
| 4 | 1/2 |
| 5 or more | 1/4 |

Then raise base risk by 5% to 11% (live steps 2.5 / 2 / 1.5% become about 2.6 / 2.1 / 1.6% or 2.8 / 2.2 / 1.7%; bot cap is 5%).
Entries, stops and exits do not change. Each bot only needs its own open positions.

## Live account: PHP 1,000, Jan 2020 to Nov 24 2026 (risk steps, MEXC minimum orders)
| Version | Ends at | Growth per year | Worst fall |
|---|---|---|---|
| TRI-CORE today | PHP 43.0M | 370% | 46.6% |
| Rule, risk x1.00 | PHP 30.6M | 347% | 44.2% |
| Rule, risk x1.05 | PHP 43.9M | 371% | 44.7% |
| Rule, risk x1.11 (the tested pick) | PHP 61.1M | 394% | 46.5% |
| Rule, risk x1.15 | PHP 79.9M | 414% | 47.0% |

- **The rule on its own earns less on the live coins.** The higher return comes from the rule plus a higher base risk.
- At x1.11 the live worst fall is a tie (46.5% vs 46.6%; 46.8% with same-candle order reversed). x1.05 gives the same money
  with a 1.9 point smaller fall. x1.05 and x1.15 were looked at after the pick.
- PHP amounts are backtest compounding with perfect fills. Use them only to compare.

## Judging account (flat 2.5% x k, no minimum orders)
| | TRI-CORE | Rule x1.11 |
|---|---|---|
| 2020-23 growth / worst fall (k was set here) | 531% / 53.9% | 563% / 51.9% |
| 2024-26 growth / worst fall | 605% / 54.3% | 663% / 49.3% |

## Year by year, live account (compounding)
| Year | TRI-CORE return / fall | Rule x1.11 return / fall |
|---|---|---|
| 2020 | +118% / 46.6% | +158% / 46.3% |
| 2021 | +2,499% / 46.5% | +3,198% / 46.5% |
| 2022 | +196% / 33.5% | +179% / 28.9% |
| 2023 | +355% / 43.5% | +314% / 34.9% |
| 2024 | +181% / 36.2% | +178% / 29.7% |
| 2025 | +371% / 31.5% | +441% / 28.8% |
| 2026 | +325% / 39.8% | +314% / 35.9% |

Smaller fall in 6 of 7 years (2021 equal). Higher return in only 3 of 7.

## Why it works: trades made into a crowded side are worse
Average R per trade by the bot's own open trades in the same direction:

| Open | Live coins | 81 other coins |
|---|---|---|
| 0-2 | 0.88R | 0.21R |
| 3 | 0.64R | 0.15R |
| 4 | 0.34R | 0.11R |
| 5+ | 0.38R | 0.03R |

In 2024-26 alone the other-coin pattern is weak (0.10 / 0.12 / 0.12 / 0.06R).

## Checks on the pick
| Check | Result |
|---|---|
| Rules 1-9 of PLAN.md | all pass |
| Neighbour settings better on 2024-26 | 8 of 12 |
| Rolling 12 months (live): higher return / smaller fall | 87% / 63% |
| Same cuts given to random trades do as well | 0.5% of 200 draws |
| 3-month block reshuffle: higher return / smaller fall | 71% / 98% |
| Same-candle order reversed | PHP 55.3M vs 43.1M, fall 46.8% vs 46.6% |
| 200 random sets of other coins, x1.11: higher growth AND smaller fall | 98.5% (2024-26: 86%) |
| Other coins, rule x1.00 against the same average size spread evenly: more growth / smaller fall | 91% / 83% (2024-26: 66% / 61%) |
| Live coins, same control | rule 518% / 47.8%, even cut 432% / 48.5% |

On random other coins TRI-CORE itself does badly (middle set: +6% a year, 92% fall), where almost any size cut helps.
The even-cut control is the fairer test there.

## What did not work
229 settings in 3 rounds; 1 family passed. Round 1 (97 settings): sizing without open profit, cut when another bot holds
the same coin, ADX half size on I / T, cut while open profit is large, drawdown throttle, rebalance 1 / 2 / 6 months, other
BB / I / T shares, adding ICHI-X4 or BB 1H WIDE at 5-20%: none passed. Rounds 2 and 3 are versions of the one near pass
(crowded side): versions counting all three bots together raised return strongly but failed the live worst-fall rules.

## Limits
- Rounds 2 and 3 were designed after seeing earlier results. With 229 settings, some luck in the pick is likely.
- 2024-26 has been used by many earlier studies. The other-coin check is the most independent evidence.
- Candles after Nov 24 2026 are the only unseen data.

## Next step
Paper / shadow test: for each new live trade, record the size the rule would have used. Review late February 2027 with the
BB-CORE v4 review. Three months cannot prove the gain; it checks that the rule behaves as in the backtest.

## Files
`PLAN.md` (rules, written first), `engine.js` (parity: PHP 43.03M, 46.6%), `run.js` + `round1-3.js` -> `results-round*.json`,
`diag.js`, `verify.js` -> `verify.json`, `control.js` -> `control.json`.
