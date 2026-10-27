# Robustness of the 7/7 big-swing candidates (BTC+ETH+SOL)

`2x cost` = fee/slippage/funding doubled. `unseen` = 10 other coins never used to pick the config (ADA NEAR ZEC GALA BNB XRP DOGE LINK LTC AVAX): coins profitable / total R. `lookahead` = trades recomputed on data cut 400 bars earlier must be identical for every trade that closed before the cut.

| strategy | R | DD | yrs+ | BTC / ETH / SOL R | years+ per coin | 2x cost R (yrs+) | 2020-22 R | 2023-26 R | unseen coins +/10 (R) | lookahead | blend w/ bb-core: R, DD, yrs+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| keltner {n:20,m:2} trail5 +SMA200 | +145 | 12 | 7/7 | +43 / +49 / +53 | 5 / 7 / 5 | +124 (6/7) | +75 | +71 | 9/10 (+313) | ok | +383, 33, 7/7 |
| keltner {n:20,m:2} trail3 +SMA200 | +143 | 13 | 7/7 | +52 / +64 / +27 | 5 / 7 / 6 | +113 (7/7) | +67 | +76 | 8/10 (+94) | ok | +381, 35, 7/7 |
| keltner {n:20,m:2} trail5 | +141 | 10 | 7/7 | +38 / +48 / +54 | 6 / 7 / 6 | +116 (6/7) | +72 | +69 | 9/10 (+286) | ok | +378, 32, 7/7 |
| donchian {n:20} trail5 +SMA200 | +136 | 12 | 7/7 | +51 / +49 / +36 | 5 / 7 / 6 | +109 (6/7) | +64 | +72 | 10/10 (+329) | ok | +373, 33, 7/7 |
| donchian {n:55} trail5 +SMA200 | +109 | 10 | 7/7 | +39 / +35 / +35 | 6 / 6 / 4 | +89 (6/7) | +63 | +46 | 8/10 (+253) | ok | +347, 32, 7/7 |
| ichimoku {full:false} trail3 +SMA200 | +120 | 16 | 7/7 | +48 / +59 / +13 | 5 / 7 / 5 | +84 (7/7) | +71 | +50 | 7/10 (+72) | ok | +358, 34, 7/7 |
| supertrend {n:10,m:3} trail5 +SMA200 | +100 | 12 | 7/7 | +32 / +41 / +28 | 4 / 7 / 5 | +83 (7/7) | +64 | +36 | 10/10 (+268) | ok | +338, 33, 7/7 |
| donchian {n:100} trail3 | +93 | 10 | 7/7 | +33 / +31 / +29 | 6 / 6 / 6 | +72 (5/7) | +38 | +55 | 8/10 (+94) | ok | +331, 31, 7/7 |

bb-core alone on the same 3 coins: +238R, DD 27, years 2020 +52 | 2021 +44 | 2022 +40 | 2023 +37 | 2024 +28 | 2025 +4 | 2026 +33
