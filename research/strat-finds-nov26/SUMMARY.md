# Strategy finds, Nov 26, 2026: "positive in every year 2020-2026"

Goal: find a strategy that earns in all 7 years (2020, 2021, 2022, 2023, 2024, 2025, 2026 to Nov), on 12 main coins AND 12 hold-out coins that were never used for tuning.
Main = BTC ETH SOL ADA XRP LINK BNB DOGE AVAX DOT NEAR ZEC. Hold-out = LTC BCH TRX ETC XLM ATOM UNI FIL AAVE ALGO XTZ VET.
Costs everywhere: 0.05% fee + 0.02% slippage per side + real Binance funding. R = 1 unit of stop-distance risk per trade.

## Verdict at a glance
| # | Folder | Result | Takeaway |
|---|---|---|---|
| 1 | `1-ICHI-X4-4h` | LEAD, best of the new ones | Steady. Positive every year on both baskets, even at 2x costs. Thin edge (0.12R per trade). |
| 2 | `2-VOL-MOM-2H` | LEAD, weak | Big R on the main coins, but in a real PHP account the hold-out coins end at PHP 4.7k with -85% drawdown. Do not run. |
| 3 | `3-BB-1H-WIDE-reference` | Earlier find (same day) | BB-CORE 1h with 2.6 sigma bands. 86% overlap with BB-CORE 1h, so a refinement, not a new strategy. |
| 4 | `4-rejected-regime-fades` | REJECTED | Range-market fades, failed-breakout fades, RSI extremes: no family positive in 2020-23. Closest: Friday long, 6/7 years. |
| 5 | `5-rejected-cross-sectional` | REJECTED | Momentum rotation is 7/7 on main coins, loses on hold-out coins in 2025-26. Funding carry fails 2026. |

## The two winners: rules
- **ICHI-X4 (4h):** Ichimoku tenkan(9) crosses kijun(26) and the close is outside the cloud (senkou B 52). Long above the cloud, short below. No trend filter. Stop 2 ATR(14). Exit after 12 bars (2 days). Decide on the closed bar, fill at the next open.
- **VOL-MOM-2H (2h bars built from 1h):** bar volume > 2.5x SMA(vol,50), range > 1.2 ATR(14), close in the top 30% of the range (bottom 30% for shorts), green (red) candle, close above (below) SMA(400). Stop 2 ATR, ATR trail 8x, no time exit.

## R per year (1x costs, summed R)
| Strategy / basket | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Max DD |
|---|---|---|---|---|---|---|---|---|---|
| ICHI-X4 main | 49 | 39 | 66 | 34 | 77 | 68 | 46 | 381 | 30R |
| ICHI-X4 hold-out | 46 | 37 | 49 | 32 | 44 | 49 | 53 | 311 | 42R |
| ICHI-X4 main, 2x costs | 42 | 30 | 54 | 13 | 66 | 51 | 28 | 283 | |
| VOL-MOM-2H main | 145 | 199 | 146 | 187 | 257 | 177 | 210 | 1321 | 94R |
| VOL-MOM-2H hold-out | 36 | 103 | 26 | 15 | 299 | 53 | 41 | 572 | 99R |
| VOL-MOM-2H hold-out, 2x costs | 27 | 94 | 11 | -5 | 273 | 37 | 21 | 458 | |
| BB-1H-WIDE main (ref) | 89 | 324 | 184 | 172 | 116 | 126 | 145 | 1157 | 67R |

## Real-account view
PHP 1,000 (about USD 16.7), risk steps 2.5% / 2% / 1.5%, min-order and 10x leverage rules, per-trade risk scaled to the same total as 6 coins.

| Set | Trades taken | Win rate | Profit factor | Max DD | Sharpe | Sortino | PHP 1,000 ends at |
|---|---|---|---|---|---|---|---|
| ICHI-X4 main 12 | 2,267 of 3,175 | 47% | 1.20 | -36% | 1.27 | 2.97 | 23k |
| ICHI-X4 hold-out 12 | 2,593 of 3,171 | 47% | 1.21 | -44% | 1.19 | 2.47 | 16k |
| VOL-MOM-2H main 12 | 2,375 of 2,679 | 26% | 1.49 | -71% | 1.19 | 4.10 | 478k |
| VOL-MOM-2H hold-out 12 | 2,575 of 2,664 | 25% | 1.05 | -85% | 0.62 | 1.61 | 4.7k |
| BB-1H-WIDE main 12 (ref) | 2,551 of 3,137 | 36% | 1.34 | -42% | 1.40 | 4.20 | 323k |

Fresh PHP 1,000 each Jan 1 (year result, 2020 to 2026):
- ICHI-X4 hold-out: +38% +34% +10% +44% +49% **-4%** +68%
- VOL-MOM-2H hold-out: +82% +71% **-26%** **-23%** +161% +11% **-10%**

Full tables: `_money-and-risk/money-scaled.md`.

## Things to remember
- 7/7 years on the main coins is easy (about half of all tested configs). Only the hold-out coins separate strategies. Trust the hold-out rows.
- A PHP 1,000 account skips many trades under the exchange minimum order (assumed USD 5, ETH 20, BTC 100; not checked against Binance). On 24 coins, 93% of ICHI-X4 trades are skipped. Real results are weaker than the R totals.
- At full risk on every coin at once, drawdowns reach 65-99% (`_money-and-risk/money-fullrisk.md`). Scale risk down for wide coin sets.
- Neither winner had a clean out-of-sample test (hold-out coins were used to filter the main-coin 7/7 list). Next step: pick rules on 2020-23, judge 2024-26 on untouched coins, then paper trade. Not live-ready.
- Overlap with BB-CORE: ICHI-X4 monthly correlation 0.42 (40% entry overlap); VOL-MOM-2H 0.51 (48% entry, 85% holding overlap); regime Friday long 0.31; best cross-sectional blend 0.18 (but it failed other gates).
- Not tested: 15m and 30m (the intraday agent said no 1m candles exist; CLAUDE.md says they do, so check).

## About these folders
These are copies of the original study folders, so everything about this hunt is in one place. The originals are still at `research/hunt-4h-nov26`, `hunt-intraday-nov26`, `hunt-1h-nov26`, `hunt-regime-nov26`, `hunt-xsec-nov26`, `hunt-money-nov26`. Scripts use relative `require` paths, so **run them from the original folders**, not from these copies. Registry rows are in `research/TESTED-STRATEGIES.md`.
