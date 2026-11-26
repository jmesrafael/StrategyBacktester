# 1h strategy hunt: scorecard (Nov 26, 2026)

One line per strategy. Details, rules and result files: `strategies/<folder>/SUMMARY.md`. Full write-up: `REPORT.md`.

**Tests**
- **Main:** the 12 coins used to pick: BTC ETH SOL ADA XRP LINK BNB DOGE AVAX DOT NEAR ZEC.
- **Hold-out:** 12 coins never used to pick: LTC BCH TRX ETC XLM ATOM UNI FIL AAVE ALGO XTZ VET.
- **Years:** 2020 to Nov 25, 2026. 7/7 = positive in every year.
- **Costs:** 1x = 0.05% fee + 0.02% slippage per side + real funding.
- **No look-ahead:** decisions on closed candles only, filled at the next open (`audit.js`).
- **PHP columns:** 6 live coins (SOL NEAR ADA GALA ZEC ARB), live risk steps. "Average year" starts a fresh PHP 1,000 each January 1. PHP 1,000 can't place about 1 in 5 trades on MEXC, so real results start lower.

## At a glance

| # | Strategy | TF | Status | Main 7/7 | Hold-out 7/7 | Hold-out 2x | Worst hold-out year | Avg year (PHP 1k) | Worst fall in a year | Worst month | Trades / month | Win |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | **BB-1H-WIDE** (BB 80 / 2.6σ, SMA 800, mid stop, 192 bars) | 1h | **LEAD: best overall** | ✅ | ✅ | ❌ 6/7 | +6R (2025) | +416% | **−42%** | **−28%** | 16 | 39% |
| 02 | BB-CORE 1h (BB 80 / 2.0σ, `bb1h`) | 1h | PAPER: most money | ✅ | ❌ 6/7 | ❌ 5/7 | −44R (2025) | **+646%** | −58% | −38% | 22 | 36% |
| 03 | BB-CORE 4h (live bot) | 4h | LIVE | ✅ (live coins) | not tested | not tested | – | +433% | −56% | −48% | 19 | 37% |
| 04 | BB-CORE 1h, 32-day hold | 1h | INFO | ✅ | ✅ | ❌ 6/7 | +4R | – | – | – | – | – |
| 05 | BB 80 / 2.6σ + 20 ATR trail | 1h | REJECTED | ✅ | ❌ 5/7 | – | −34R (2026) | – | – | – | – | – |
| 06 | MACD ×8 cross + SMA 1200 | 1h | REJECTED | ✅ | ❌ 5/7 | ❌ 5/7 | −34R (2026) | – | – | – | – | – |
| 07 | Keltner 50/200 ×3.5, EMA 50/200 | 1h | REJECTED | ✅ | ❌ 4-5/7 | – | −139R (2025) | – | – | – | – | – |
| 08 | 27 baseline strategies (RSI, CCI, Ichimoku, ...) | 1h | INFO | 40 of 55 | 1 of 40 | – | – | – | – | – | – | – |

## PHP 1,000 each year, live coins (year-end balance)

| Year | BB-CORE 4h (live) | BB-CORE 1h | BB-1H-WIDE |
|---|---|---|---|
| 2020 | 2,551 | **2,890** | 1,751 |
| 2021 | **15.5k** | 14.8k | 12.4k |
| 2022 | 3,574 | **6,893** | 2,943 |
| 2023 | 2,047 | 2,469 | **3,174** |
| 2024 | 3,080 | **5,634** | 3,891 |
| 2025 | 4,532 | **5,758** | 5,108 |
| 2026 (to Nov 25) | 5,986 | **13.7k** | 6,873 |
| Compounded from 2020 (worst fall) | 4.9M (−38%) | 33.9M (−39%) | 4.4M (**−27%**) |

## Verdict
- **Safest: 01 BB-1H-WIDE.** It is the only one positive every year on unseen coins, with the smallest falls.
- **Most money: 02 BB-CORE 1h.** It had the best year 5 times out of 7, but lost 2025 on unseen coins and had deeper falls.
- **01, 02 and 03 trade the same Bollinger idea.** Their good and bad months line up, so run one 1h version, not both.
- **Trend strategies with wide trailing stops (05-07)** look great on the main coins and fail on new coins in 2025-26.

## How to add a strategy
1. Make a folder `strategies/NN-name/`.
2. Write a `SUMMARY.md` with the same sections (rules, R per year, PHP 1,000, verdict, files).
3. Add one row to the tables above and one row to `research/TESTED-STRATEGIES.md`.
