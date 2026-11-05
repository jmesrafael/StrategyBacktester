# Pre-2020 out-of-sample check (Binance spot 4h, Aug 2017 - Dec 2019)

Same code and parameters as the main test, nothing re-tuned. Data: BTC/ETH from 2017-08, ADA from 2018-04, ZEC from 2019-03 (others not listed yet). Spot candles, so funding is only a small extra penalty. First trades start ~Oct 2017 after the 200-bar warm-up.

Coins BTC,ETH,ADA,ZEC — trades closing before 2020-01-01
| strategy | trades | total R | exp R | PF | win | worst drop @2.5% | 2017 R | 2018 R | 2019 R | 2.5%-risk compounded |
|---|---|---|---|---|---|---|---|---|---|---|
| bb-core | 237 | 149 | 0.63 | 2.05 | 38% | -40% | 19 | 64 | 66 | x22.95 |
| I-Core | 130 | 77 | 0.59 | 1.88 | 31% | -37% | 6 | 40 | 31 | x3.98 |
| MA Trend SMA200 | 68 | 69 | 1.02 | 2.17 | 16% | -52% | -8 | 49 | 29 | x2.59 |
| Chande Kroll 10-1-9 | 63 | 127 | 2.01 | 3.52 | 17% | -43% | -4 | 56 | 74 | x6.86 |
| Donchian 20 | 62 | 102 | 1.65 | 2.94 | 18% | -41% | -6 | 52 | 57 | x4.62 |
| Keltner 20x2 | 59 | 90 | 1.52 | 2.74 | 15% | -43% | -5 | 59 | 36 | x3.89 |
| TRIX 30 zero | 27 | 6 | 0.21 | 1.25 | 19% | -23% | -1 | 4 | 3 | x1.07 |
| MACD 8-17-9 | 47 | 139 | 2.95 | 4.89 | 26% | -35% | -2 | 54 | 87 | x9.93 |

By coin (total R):
| strategy | BTC | ETH | ADA | ZEC |
|---|---|---|---|---|
| bb-core | 62 | 44 | 30 | 14 |
| I-Core | 61 | -11 | 28 | -1 |
| MA Trend SMA200 | 29 | 31 | 8 | 1 |
| Chande Kroll 10-1-9 | 93 | 28 | 6 | -1 |
| Donchian 20 | 77 | 18 | 7 | -0 |
| Keltner 20x2 | 62 | 24 | 4 | -0 |
| TRIX 30 zero | -3 | -1 | 10 | -1 |
| MACD 8-17-9 | 80 | 39 | 15 | 4 |
