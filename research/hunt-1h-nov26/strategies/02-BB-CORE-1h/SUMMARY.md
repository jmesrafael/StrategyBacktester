# BB-CORE 1h (1h, Bollinger 80 / 2.0 sigma, the `bb1h` paper bot)

**Status:** PAPER (`bb1h`). Highest returns, fails the hold-out test.

## Rules
- Same as BB-1H-WIDE but with 2.0 sigma bands: 1h close outside Bollinger(80, 2.0) with SMA(800).
- Stop = middle band, 192-bar time exit.

## R per year (1R = the stop distance; 1x = real costs)
| Test | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Max DD | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| Main 12, 1x | 163 | 391 | 240 | 170 | 201 | 169 | 260 | 1594 | 89 | PASS 7/7 |
| Main 12, 3x costs | 132 | 358 | 195 | 86 | 150 | 121 | 193 | 1235 | 119 | PASS 7/7 |
| Hold-out 12, 1x | 97 | 164 | 146 | 34 | 142 | -44 | 51 | 590 | 100 | FAIL 6/7 |
| Hold-out 12, 2x | 83 | 147 | 125 | -3 | 115 | -69 | 20 | 419 | 124 | FAIL 5/7 |
| All 24, 3x costs | 202 | 488 | 299 | 47 | 239 | 28 | 182 | 1485 | 219 | PASS 7/7 |

## PHP 1,000 (live coins SOL NEAR ADA GALA ZEC ARB, live risk steps 2.5% / 2% / 1.5%)
| Compounding Jan 2020 to Nov 2026 | Worst fall | Average year (fresh 1,000 each Jan) | Worst year | Worst fall inside a year | Worst month | Trades / month | Win rate |
|---|---|---|---|---|---|---|---|
| 33.9M | -39% | +646% | +147% | -58% (2023) | -38% | 22 | 36% |

## Standard metrics (live coins, PHP 1,000 from Jan 2020, net of fees, slippage, funding, MEXC minimum orders)
| Metric | Value |
|---|---|
| Max drawdown, peak to trough (open trades marked hourly) | -48.1% (Mar 10 - Apr 12 2023) |
| Max drawdown, closed trades only | -39.1% |
| Profit factor | 1.65 |
| Sharpe ratio (daily, annualised) | 2.09 |
| Sortino ratio (daily, annualised) | 3.84 |
| Total trades | 1,783 |
| Win rate | 35.6% |
| Trades skipped (MEXC minimum order / margin) | 0 |
| PHP 1,000 grows to (net) | PHP 32.76M |
| Yearly growth (CAGR) | 352% |

**Recent test: fresh PHP 1,000 from Jan 1 2026**
| Metric | Value |
|---|---|
| Max drawdown, peak to trough (Sep 23 - Nov 4 2026) | -51.3% |
| Profit factor | 1.55 |
| Sharpe / Sortino | 2.72 / 5.27 |
| Trades / win rate | 286 / 36.4% |
| PHP 1,000 -> Nov 25 2026 (net) | PHP 12,970 (+1,197%) |

Source: `metrics.md`, `metrics-2026.md` (script `../../metrics.js`).

## Verdict
- Most money of all: best year in 5 of 7 and the biggest compounding result.
- Bigger falls than BB-1H-WIDE, and it lost 2025 on unseen coins: the edge depends more on which coins it trades.

## Files in this folder
- `months-core1h.md`
- `compare3.md`
- `metrics.md`
- `metrics-2026.md`
- `METRICS-COPY.txt`
- `validate.txt`

These are copies. The scripts are two folders up (`../../`) and share `lib.js`; re-running one rewrites its output there.
