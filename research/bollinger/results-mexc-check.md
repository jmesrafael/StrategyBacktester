# BB Breakout on MEXC — SOL / DOGE / ZEC, 4h

MEXC USDT-M perpetual 4h candles (Sep 2020 / Oct 2020 / Jun 2020 → Oct 20 2026). Same rules and the same closed-candle bot replay as the Binance tests. $5 risk per trade, trades counted in the year they close. Funding: MEXC history from Apr 2025, Binance funding as a stand-in before that.

## 1. Are MEXC prices the same as Binance?

| Coin | Overlapping 4h candles | Avg close difference | Avg high–low range difference | BB trades on MEXC | on Binance | Same entry candle |
|---|---|---|---|---|---|---|
| SOL | 13283 | 0.061% | 3.5% | 321 | 321 | 311 (97%) |
| DOGE | 13110 | 0.035% | 3.2% | 338 | 338 | 331 (98%) |
| ZEC | 13446 | 0.055% | 4.5% | 325 | 334 | 304 (94%) |

## 2. Year by year, all three coins together ($5 risk)

| Case | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Years + |
|---|---|---|---|---|---|---|---|---|---|
| MEXC, fees 0.02% maker / 0.06% taker (docs example), 0.02% slippage | +$50 | +$374 | +$149 | +$59 | +$208 | +$239 | +$74 | **+$1152** | 7 of 7 |
| MEXC, low fees 0% maker / 0.02% taker, 0.02% slippage | +$51 | +$382 | +$161 | +$78 | +$219 | +$249 | +$87 | **+$1225** | 7 of 7 |
| MEXC, 0.06% taker + 0.05% slippage + target must trade 0.05% through | +$22 | +$367 | +$145 | +$52 | +$199 | +$206 | +$64 | **+$1054** | 7 of 7 |
| Binance candles, Binance base fees (for comparison) | +$154 | +$356 | +$173 | +$88 | +$216 | +$248 | +$55 | **+$1292** | 7 of 7 |

## 3. Each coin on MEXC (0.06% taker / 0.02% maker), profit and trades per year

| Year | SOL | DOGE | ZEC |
|---|---|---|---|
| 2020 | −$5 (9) | +$19 (4) | +$35 (14) |
| 2021 | +$106 (57) | +$151 (60) | +$118 (51) |
| 2022 | +$66 (60) | +$64 (60) | +$19 (52) |
| 2023 | +$126 (51) | −$72 (63) | +$6 (58) |
| 2024 | +$38 (48) | +$72 (56) | +$98 (54) |
| 2025 | +$44 (53) | +$79 (50) | +$115 (51) |
| 2026 | +$26 (45) | +$5 (45) | +$42 (47) |
| **Total** | **+$401** | **+$318** | **+$432** |
| Years positive | 6 of 7 | 6 of 7 | 7 of 7 |
