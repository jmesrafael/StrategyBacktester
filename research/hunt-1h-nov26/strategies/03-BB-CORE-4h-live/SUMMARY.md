# BB-CORE 4h (the live bot)

**Status:** LIVE (`bbcore`). Reference for comparison.

## Rules
- 4h close outside Bollinger(20, 2.0) with SMA(200). Stop = middle band (skip if < 0.3 ATR), 48-candle time exit.

## PHP 1,000 (live coins SOL NEAR ADA GALA ZEC ARB, live risk steps 2.5% / 2% / 1.5%)
| Compounding Jan 2020 to Nov 2026 | Worst fall | Average year (fresh 1,000 each Jan) | Worst year | Worst fall inside a year | Worst month | Trades / month | Win rate |
|---|---|---|---|---|---|---|---|
| 4.9M | -38% | +433% | +105% | -56% (2026) | -48% (Oct 2026) | 19 | 37% |

## Standard metrics (live coins, PHP 1,000 from Jan 2020, net of fees, slippage, funding, MEXC minimum orders)
| Metric | Value |
|---|---|
| Max drawdown, peak to trough (open trades marked hourly) | -43.4% (Mar 10 - May 3 2023) |
| Max drawdown, closed trades only | -38.0% |
| Profit factor | 1.48 |
| Sharpe ratio (daily, annualised) | 1.90 |
| Sortino ratio (daily, annualised) | 3.46 |
| Total trades | 1,514 |
| Win rate | 36.7% |
| Trades skipped (MEXC minimum order / margin) | 0 |
| PHP 1,000 grows to (net) | PHP 5.03M |
| Yearly growth (CAGR) | 244% |

**Recent test: fresh PHP 1,000 from Jan 1 2026**
| Metric | Value |
|---|---|
| Max drawdown, peak to trough (Sep 23 - Nov 4 2026) | -57.6% |
| Profit factor | 1.37 |
| Sharpe / Sortino | 2.24 / 4.35 |
| Trades / win rate | 249 / 36.9% |
| PHP 1,000 -> Nov 25 2026 (net) | PHP 5,959 (+496%) |

Source: `metrics.md`, `metrics-2026.md` (script `../../metrics.js`).

## Verdict
- Middle on return and the worst on risk of the three Bollinger bots here: deepest single month (-48%).
- The 1h versions beat it in most years (BB-CORE 1h in 6 of 7, BB-1H-WIDE in 5).
- Earlier study: +594R, 7/7 years on 4h (`research/strat-hunt-nov6/REPORT.md`). Not tested on the hold-out coins in this study.

## Files in this folder
- `compare3.md`
- `metrics.md`
- `metrics-2026.md`
- `METRICS-COPY.txt`

These are copies. The scripts are two folders up (`../../`) and share `lib.js`; re-running one rewrites its output there.
