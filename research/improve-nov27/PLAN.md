# Improve TRI-CORE: more return AND a smaller worst fall (plan, written Nov 27, 2026 before the first run)

Owner goal: an addition or tweak that raises the return and lowers the drawdown. Research only: no bot, server or database is touched.

## Basis
- Trades: live BB-CORE v4 (x1.05), I-CORE v3, T-CORE v3, own live coins, Binance 4h candles, fees + slippage + real funding
  (same trade engine as `../tri-vs-four-nov27`). Account: one sub-account per bot, shared sizing 50 / 25 / 25, hourly-marked open trades.
- Judging account: flat risk 2.5% x k, no MEXC minimums, so a difference comes from the rule alone.
- Live account (check only): PHP 1,000 at PHP 60/US$, live risk steps, MEXC minimum orders, risk x k.
- Parity gate: the new account code with every tweak off must reproduce PHP 43.03M and a 46.6% worst fall.

## Pass rules (a candidate must pass all)
1. **k is set on 2020-23 only:** the risk multiplier that makes its 2020-23 worst fall 2 points smaller than TRI-CORE's.
2. **One setting per family** is picked: the highest 2020-23 growth at that k. It must beat TRI-CORE's 2020-23 growth.
3. **2024-26 with the same k:** growth higher AND worst fall smaller than TRI-CORE.
4. **Live account, 2020 to Nov 2026:** ends higher AND worst fall smaller.
5. **Every 12-month start (live account):** higher return in more than half, smaller fall in more than half.
6. **Double costs:** rule 3 still holds.
7. **Neighbours:** at least half of the family's settings pass rule 3 (each with its own k).
8. **Luck check (size rules only):** the same size cuts given to random trades (200 draws) do as well on 2024-26 growth per fall in no more than 10%.
9. **Without the 10 biggest winners** (removed from both), full period: still higher growth and smaller fall.

Combinations are only built from families that pass rules 1-7, and must pass 1-6 and 9 themselves.

## Families, round 1 (each has a reason stated before testing)
| Id | Change | Reason | Settings |
|---|---|---|---|
| A | Size new trades from equity minus part of the open profit | Live sizing counts unbanked profit, so trades are largest just before it is given back | part 0.25, 0.5, 0.75, 1.0 |
| B | Smaller new trade when N+ trades are already open the same way | The worst falls are many trades one way giving back together | N 4, 6, 8, 10 x size 0.25, 0.5, 0.75 |
| C | Smaller new trade when another bot already holds the same coin and side | Same bet twice (I-CORE / T-CORE monthly link 0.59) | I+T only or any pair x size 0, 0.25, 0.5, 0.75 |
| D | Half size on I-CORE / T-CORE when ADX(14) is high | Late-trend entries; the same idea passed for BB-CORE (in v4) | ADX 25, 27, 30 x I, T, both |
| E | Smaller new trade while open profit is large | Entries made at a stretched moment | open profit over 10, 20, 30% x size 0.25, 0.5 |
| F | Smaller new trade while the account is below its high | Classic drawdown throttle, not tested on the whole account | 15, 25, 35% below x size 0.5, 0.75 |
| G | Rebalance more or less often | capital-split found 2-3 months best | 1, 2, 6 months |
| H | Other BB / I / T shares | Nov 27 split test | BB 40-75, I 10-35, T >= 5, steps of 5 |
| I | Add ICHI-X4 as a small 4th part | Monthly link 0.07 with the mix; only tested at 25% | 5, 10, 15, 20% |
| J | Add BB 1H WIDE as a small 4th part | Calmer 12-month falls; only tested at 25% | 5, 10, 15, 20% |

## Limits fixed in advance
- 2024-26 has been used by many earlier studies: it is not unseen data. A pass is a LEAD for paper testing, never a go-live.
- About 100 settings are tried, so one lucky pass is expected; rules 5, 7, 8 and 9 are there for that.
- If nothing passes, new ideas may be added as a new round. The pass rules do not change.

## Rounds (added as they happened)
- Round 2 (round2.js): designed after round 1, where the crowded-side family (B) was the only near pass. Wider grid and other ways to count.
- Round 3 (round3.js): designed after round 2, where the per-bot count failed only the neighbour rule. The same idea without a hard threshold.

## Extra checks on a version that passes (written after round 3, before running them)
1. Other coins: 200 random coin sets in the live shape, drawn from library coins none of the bots trade, listed before 2022.
   Same rule, same k, against TRI-CORE rules on the same set. Wanted: higher growth AND smaller fall in more than half.
2. Same-candle order reversed (which of two simultaneous entries gets the cut).
3. Risk multiplier sweep on the live account; year by year; 3-month block reshuffle of monthly returns.
