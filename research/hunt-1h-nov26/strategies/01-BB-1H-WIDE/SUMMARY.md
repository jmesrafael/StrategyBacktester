# BB-1H-WIDE (1h, Bollinger 80 / 2.6 sigma)

**Status:** LEAD, best overall. Paper-test next to `bb1h`; judge on candles after 2026-11-25.

## Rules
- 1h close above the upper Bollinger band (80, **2.6 sigma**) and above SMA(800): long. Mirror for shorts.
- Decide on the closed bar, fill at the next open.
- Stop = middle band at entry, fixed. Skip the trade if the stop is closer than 0.3 ATR(14).
- Exit at the stop or after 192 bars (8 days).

## R per year (1R = the stop distance; 1x = real costs)
| Test | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Max DD | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| Main 12, 1x | 89 | 324 | 184 | 172 | 116 | 126 | 145 | 1157 | 67 | PASS 7/7 |
| Main 12, 3x costs | 70 | 304 | 157 | 118 | 84 | 97 | 107 | 936 | 75 | PASS 7/7 |
| Hold-out 12, 1x | 68 | 164 | 59 | 48 | 117 | 6 | 30 | 492 | 81 | PASS 7/7 |
| Hold-out 12, 2x | 59 | 153 | 46 | 25 | 101 | -7 | 10 | 386 | 87 | FAIL 6/7 |
| All 24, 3x costs | 119 | 447 | 189 | 120 | 169 | 76 | 97 | 1218 | 163 | PASS 7/7 |

## PHP 1,000 (live coins SOL NEAR ADA GALA ZEC ARB, live risk steps 2.5% / 2% / 1.5%)
| Compounding Jan 2020 to Nov 2026 | Worst fall | Average year (fresh 1,000 each Jan) | Worst year | Worst fall inside a year | Worst month | Trades / month | Win rate |
|---|---|---|---|---|---|---|---|
| 4.4M | -27% | +416% | +75% (2020, from March) | -42% | -28% | 16 | 39% |

## Standard metrics (live coins, PHP 1,000 from Jan 2020, net of fees, slippage, funding, MEXC minimum orders)
| Metric | Value |
|---|---|
| Max drawdown, peak to trough (open trades marked hourly) | -34.9% (Mar 12 - Jun 15 2021) |
| Max drawdown, closed trades only | -27.3% |
| Profit factor | 1.68 |
| Sharpe ratio (daily, annualised) | 2.05 |
| Sortino ratio (daily, annualised) | 3.71 |
| Total trades | 1,316 |
| Win rate | 39.2% |
| Trades skipped (MEXC minimum order / margin) | 0 |
| PHP 1,000 grows to (net) | PHP 4.40M |
| Yearly growth (CAGR) | 238% |

**Recent test: fresh PHP 1,000 from Jan 1 2026**
| Metric | Value |
|---|---|
| Max drawdown, peak to trough (Sep 23 - Nov 4 2026) | -43.7% |
| Profit factor | 1.60 |
| Sharpe / Sortino | 2.48 / 5.02 |
| Trades / win rate | 212 / 39.6% |
| PHP 1,000 -> Nov 25 2026 (net) | PHP 7,210 (+621%) |

Source: `metrics.md`, `metrics-2026.md` (script `../../metrics.js`).

## Verdict
- The only candidate positive every year on coins it never saw (hold-out) and on 24 coins at 3x costs.
- Smallest drawdowns of the Bollinger versions. Earns less than BB-CORE 1h.
- Same signals as BB-CORE 1h (86% trade overlap, monthly correlation 0.96): run one, not both.

## Notes
- Look-ahead audit: 0 mismatches in 960 checks.
- Plateau: bands 60-120 long, 2.2-2.6 sigma, SMA 800, 192-bar exit are all 7/7 on both baskets.
- Weak spot: hold-out 2025 was only +6R. Profit per trade fell from 0.31R (2020-23) to 0.19R (2024-26).
- Best coins (7/7 each, hindsight): SOL VET ADA ZEC LINK XTZ. Avoid TRX ATOM LTC AAVE.

## Files in this folder
- `validate.txt`
- `hold-vol.txt`
- `months.md`
- `pesos.md`
- `compare3.md`
- `metrics.md`
- `metrics-2026.md`
- `METRICS-COPY.txt`
- `REPORT.md`

These are copies. The scripts are two folders up (`../../`) and share `lib.js`; re-running one rewrites its output there.
