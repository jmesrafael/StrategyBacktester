# 1h hunt: a strategy positive in every year 2020 to Nov 2026 (Nov 26, 2026)

## Answer
**BB-1H-WIDE** is positive in all 7 years (2020-2026 YTD) on the 12 coins it was picked on. It is also 7/7 on 12 hold-out coins it never saw, and 7/7 on all 24 coins at 1x, 2x and 3x costs.

Rules (1h chart, long and short, one position per coin):
- Entry: a 1h close above the upper Bollinger band (80, **2.6** sigma) while the close is above SMA(800). Shorts are the mirror. Decide on the closed bar, fill at the next open.
- Stop: the middle band (SMA 80) at entry, fixed. Skip the trade if that stop is closer than 0.3 ATR(14).
- Exit: the stop, or the next open after 192 bars (8 days).

This is BB-CORE 1h (the `bb1h` paper bot) with 2.6 sigma bands instead of 2.0. It is a refinement, not a new strategy: 86% of its trades overlap BB-CORE 1h, and the monthly correlation is 0.96.

| R per year | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Max DD | R/DD |
|---|---|---|---|---|---|---|---|---|---|---|
| Main 12, 1x | 89 | 324 | 184 | 172 | 116 | 126 | 145 | 1157 | 67 | 17.4 |
| Main 12, 3x costs | 70 | 304 | 157 | 118 | 84 | 97 | 107 | 936 | 75 | 12.4 |
| Hold-out 12, 1x | 68 | 164 | 59 | 48 | 117 | 6 | 30 | 492 | 81 | 6.1 |
| Hold-out 12, 2x | 59 | 153 | 46 | 25 | 101 | **-7** | 10 | 386 | 87 | 4.5 |
| All 24, 2x | 138 | 467 | 216 | 169 | 201 | 104 | 136 | 1432 | 154 | 9.3 |
| *BB-CORE 1h, hold-out 1x* | 97 | 164 | 146 | 34 | 142 | **-44** | 51 | 590 | 100 | 5.9 |

Main = BTC ETH SOL ADA XRP LINK BNB DOGE AVAX DOT NEAR ZEC. Hold-out = LTC BCH TRX ETC XLM ATOM UNI FIL AAVE ALGO XTZ VET.
R = 1 unit of stop-distance risk per trade, summed (not compounded).
Costs: 0.05% fee and 0.02% slippage per side, plus real Binance funding. "2x" and "3x" multiply fees and slippage.

## Checks (`validate.js`, `validate.txt`)
- **No look-ahead:** truncation audit (`audit.js`) gave 0 mismatches in 960 checks on SOL, BTC, ADA and LTC. The audit's self-test catches a deliberate cheat that reads the next candle.
- **Engine:** `strat-hunt-nov6/engine.js` decides on closed bars only, fills at the next open, checks the stop first inside a bar and fills gaps at the open. Candles come from the local library (closed bars only, 0 gaps).
- **IS / OOS (24 coins):** 2020-23 earned 0.307R per trade; 2024-26 earned 0.190R per trade. The edge is still there but smaller.
- **Plateau:** 8 of 144 hold-out-tested configs are 7/7 on both baskets. All 8 use SMA 800 with a 192-bar exit, bands 60-120 long and 2.2-2.6 sigma wide (`hold-vol.txt`). The candidate was chosen by main-basket R/DD within that group.
- **Fat tails:** win rate 35%. The top 10% of trades make 234% of the profit (the rest lose in sum, as is normal for breakouts). Biggest trade +55R. Coin-years positive: 130 of 168. Months positive: 50 of 82; worst month −58R.
- **Long/short (24 coins):** longs +1,191R, shorts +459R. Shorts carry 2022 (+222R); longs were only +22R that year.

## Weak points
- On the hold-out coins **2025 is only +6R** (−7R at 2x costs). That is the thinnest year.
- It trades almost the same signals as BB-CORE 1h, so it does not diversify the paper bot. It is a candidate replacement setting for `bb1h`, not an extra bot.
- 7/7 years is easy on this 2020-26 sample: 40 of 55 baseline variants and 51-86% of the family grids are 7/7 on the main coins. Only the hold-out basket separates the strategies.

## What failed (and why it matters)
- **Trend strategies with wide ATR trails** were 7/7 on the main coins but **lost 2025-2026 on the hold-out coins** (`hold-trend.txt`, `hold-vol.txt`). This covers the agents' leaders: MACD×8 signal cross + SMA1200 (a 12/12 plateau on the main coins), Keltner 50/200 ×3.5, EMA 50/200 + ER, and Bollinger + 20 ATR trail. The main-coin fit is driven by 2021 and the big alt runs.
- **Baseline** (`baseline.txt`, `strict-baseline.txt`): the 27 strat-hunt strategies scaled to 1h. BB-CORE 1h is 7/7 on the main coins but 6/7 on the hold-out coins (2025 −44R). Mean reversion loses every year.

## Files
`lib.js` (harness), `audit.js` (look-ahead audit), `baseline.js`, `strict-baseline.js`, `fam-vol.js` (Bollinger grid, 2,205 configs), `fam-trend.js` (trend grid, 3,483 configs), `hold-vol.js`, `hold-trend.js`, `validate.js`, plus a `.txt` output for each.

## Next step
Run BB-1H-WIDE next to the `bb1h` paper bot (only the band multiplier changes) and judge it on candles after 2026-11-25. Do not re-tune on 2024-26.

## PHP 1,000 comparison (Nov 26, `pesos.js`, `pesos.md`)
On the live coins, BB-1H-WIDE is the smoothest (worst fall -27% vs -38% BB-CORE 4h, -39% BB-CORE 1h) but grows less: PHP 1,000 -> 4.4M vs 4.9M vs 33.9M by Nov 2026, live bot risk steps, realised balance only. Best coins for it (every year positive 2020-26, hindsight): SOL VET ADA ZEC LINK XTZ. A pick made on 2020-23 only (FIL SOL VET ADA BTC LINK XRP ZEC) did worse after 2023 than the live coins (FIL, BTC, XRP faded).
