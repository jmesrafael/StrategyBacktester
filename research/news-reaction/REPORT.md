# News reaction study (Nov 25, 2026)

**Verdict: no trading rule passes. The surprise does set the first direction, but it is used up before a 15-minute entry can pay its costs.**

743 US release minutes and 946 normal days, Sep 2020 to Nov 18, 2026, BTC / ETH / SOL on 1-minute candles, 0.14% costs plus funding. Rules and pass mark: [PLAN.md](PLAN.md). All tables: [RESULTS.md](RESULTS.md). Rebuild: `node --max-old-space-size=8192 study.js`.

## 1. Speed (BTC; median move now against the move at 6 hours)

| Group | 1 min | 5 min | 15 min | 1 h | 3 h | Already on the 6 h side after 1 h |
|---|---|---|---|---|---|---|
| All releases | 0.14 | 0.20 | 0.26 | 0.42 | 0.82 | 66% |
| FOMC | 0.20 | 0.34 | 0.26 | 0.42 | 0.92 | 80% |
| CPI | 0.32 | 0.34 | 0.38 | 0.61 | 0.97 | 68% |
| NFP | 0.29 | 0.34 | 0.39 | 0.49 | 0.98 | 66% |
| Normal days | 0.05 | 0.10 | 0.15 | 0.29 | 0.75 | 61% |

Releases front-load the move compared with normal days (CPI: 0.32 after one minute against 0.05), but much of the 6-hour move is still ahead after 15 minutes, in either direction.

## 2. Follow, fade or trade the surprise (BTC, enter at minute 15, % per trade after costs)

| Rule | Trades | Exit 1 h | Exit 3 h | Exit 6 h |
|---|---|---|---|---|
| Follow the first move | 743 | −0.100 | −0.078 | −0.088 |
| Fade the first move | 743 | −0.180 | −0.202 | −0.192 |
| Follow, only a big first move | 294 | −0.034 | −0.052 | −0.077 |
| Fade, only a big first move | 294 | −0.246 | −0.228 | −0.203 |
| Trade the surprise (good = long) | 518 | −0.161 | −0.250 | −0.307 |

All 21 rule and exit combinations (these 15 and 6 drift ones) fail the pass mark. Following beats fading by a little, but its edge before costs is 0.04 to 0.11%, under the 0.14% cost. Per family: 96 cells tried, 0 passed.

## 3. Longer drift (enter at 6 h in the direction of the 6 h move)

| Side | Exit 24 h | Exit 72 h |
|---|---|---|
| All | −0.067 | −0.015 |
| After up moves | −0.076 | −0.036 |
| After down moves | −0.059 | +0.005 |

No drift worth trading, and no sign that downward moves keep going more than upward ones.

## 4. Surprise size (FOMC, CPI, NFP, PCE; average BTC move)

| Surprise | n | 15 min | 1 h | 6 h | 24 h |
|---|---|---|---|---|---|
| Big bad | 16 | −0.94 | −0.99 | −0.80 | −1.44 |
| Small bad | 68 | −0.29 | −0.25 | −0.16 | −0.05 |
| In line | 73 | −0.02 | +0.03 | −0.22 | −0.43 |
| Small good | 43 | +0.57 | +0.76 | +0.12 | +0.39 |
| Big good | 21 | +0.59 | +0.58 | −0.09 | −0.19 |

Rank correlation between surprise and move, up to 2023 / 2024 on: 15 min **+0.48 / +0.53**, 1 h **+0.43 / +0.39**, 6 h +0.04 / +0.07, 24 h +0.14 / +0.04. The link is strong and holds in both periods for the first hour (CPI, NFP, PCE each), and is gone by 6 hours.

## Limits
- Entry is at minute 15 at the earliest. Reacting in the first seconds was **not** tested: 1-minute candles cannot show the fill, and spreads at the release are wide.
- Surprise uses the first published number against the calendar forecast; whether a bot could have read it within seconds is not covered.
- The big-bad and big-good groups are small (16 and 21).
- Releases within 72 hours of each other overlap in the drift tests.
- Normal days are measured at 8:30 New York time only (FOMC comes out later in the day).

## What would justify a re-test
Tick or 1-second data with real spreads, to test entry within the first minute on the surprise sign. Otherwise leave it: no bot change.
