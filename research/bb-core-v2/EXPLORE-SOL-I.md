# bb-core v2 — trying to beat the baseline on SOL (binance, costs x1)
Baseline bb-core: 309 trades, +105.4R, avg +0.341R, maxDD 12.8R, ≤2023 +78.6R (167 trades), ≥2024 +26.8R (142 trades)

## I1. Stop distance (bb-core: the middle band, 1.0×). Target stays targetR × risk

| config | trades | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 |
|---|---|---|---|---|---|---|---|---|
| stop 0.5× the close→middle-band distance, target 4R | 474 | **+79.9** | +0.168 | 27% | 24.2 | 5/7 | +61.7 | +18.2 |
| stop 0.75× the close→middle-band distance, target 4R | 364 | **+102.4** | +0.281 | 33% | 13.4 | 7/7 | +81.9 | +20.4 |
| stop 1× the close→middle-band distance, target 4R | 309 | **+105.4** | +0.341 | 39% | 12.8 | 7/7 | +78.6 | +26.8 |
| stop 1.25× the close→middle-band distance, target 4R | 283 | **+64.7** | +0.229 | 40% | 12.1 | 7/7 | +55.9 | +8.9 |
| stop 1.5× the close→middle-band distance, target 4R | 254 | **+68.6** | +0.270 | 45% | 9.2 | 6/7 | +58.4 | +10.2 |
| stop 2× the close→middle-band distance, target 4R | 230 | **+33.1** | +0.144 | 48% | 9.4 | 5/7 | +37.8 | -4.7 |
| stop 0.75× the middle-band distance, target 6R | 341 | **+120.6** | +0.354 | 30% | 13.4 | 7/7 | +96.3 | +24.3 |
| stop 0.75× the middle-band distance, target 8R | 323 | **+139.5** | +0.432 | 31% | 13.4 | 7/7 | +115.0 | +24.5 |
| stop 1× the middle-band distance, target 6R | 285 | **+115.1** | +0.404 | 39% | 11.1 | 7/7 | +89.6 | +25.5 |
| stop 1× the middle-band distance, target 8R | 280 | **+108.5** | +0.388 | 39% | 14.7 | 7/7 | +87.1 | +21.4 |
| stop 1.5× the middle-band distance, target 6R | 248 | **+61.6** | +0.248 | 46% | 9.3 | 5/7 | +52.8 | +8.7 |
| stop 1.5× the middle-band distance, target 8R | 246 | **+77.9** | +0.317 | 46% | 9.6 | 5/7 | +67.3 | +10.6 |

## I2. ATR-based stop

| config | trades | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 |
|---|---|---|---|---|---|---|---|---|
| stop 1 ATR, target 3R | 563 | **+58.8** | +0.104 | 29% | 26.2 | 4/7 | +48.7 | +10.0 |
| stop 1 ATR, target 4R | 512 | **+76.0** | +0.148 | 25% | 24.3 | 4/7 | +61.3 | +14.7 |
| stop 1 ATR, target 6R | 451 | **+100.0** | +0.222 | 21% | 25.7 | 6/7 | +51.4 | +48.6 |
| stop 1.5 ATR, target 3R | 426 | **+83.5** | +0.196 | 34% | 16.5 | 7/7 | +62.0 | +21.5 |
| stop 1.5 ATR, target 4R | 384 | **+98.0** | +0.255 | 31% | 20.3 | 7/7 | +57.0 | +41.0 |
| stop 1.5 ATR, target 6R | 344 | **+151.1** | +0.439 | 30% | 15.3 | 7/7 | +108.3 | +42.8 |
| stop 2 ATR, target 3R | 339 | **+106.3** | +0.314 | 41% | 10.5 | 7/7 | +67.3 | +39.0 |
| stop 2 ATR, target 4R | 309 | **+122.3** | +0.396 | 39% | 9.2 | 7/7 | +82.1 | +40.2 |
| stop 2 ATR, target 6R | 291 | **+139.1** | +0.478 | 38% | 11.0 | 7/7 | +93.0 | +46.1 |
| stop 2.5 ATR, target 3R | 304 | **+71.9** | +0.237 | 41% | 11.0 | 7/7 | +50.5 | +21.4 |
| stop 2.5 ATR, target 4R | 287 | **+78.1** | +0.272 | 39% | 9.2 | 7/7 | +57.3 | +20.8 |
| stop 2.5 ATR, target 6R | 265 | **+92.6** | +0.349 | 40% | 11.6 | 7/7 | +70.6 | +22.0 |
| stop 3 ATR, target 3R | 274 | **+58.1** | +0.212 | 43% | 10.5 | 7/7 | +48.5 | +9.7 |
| stop 3 ATR, target 4R | 262 | **+67.4** | +0.257 | 44% | 13.1 | 7/7 | +58.0 | +9.4 |
| stop 3 ATR, target 6R | 249 | **+58.7** | +0.236 | 44% | 14.4 | 7/7 | +51.8 | +6.9 |
| stop 4 ATR, target 3R | 239 | **+56.2** | +0.235 | 47% | 7.9 | 6/7 | +46.4 | +9.8 |
| stop 4 ATR, target 4R | 226 | **+56.9** | +0.252 | 49% | 7.9 | 6/7 | +49.6 | +7.3 |
| stop 4 ATR, target 6R | 224 | **+48.3** | +0.216 | 48% | 8.7 | 6/7 | +40.0 | +8.3 |

## I3. Time exit and target

| config | trades | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 |
|---|---|---|---|---|---|---|---|---|
| maxBars 36 | 336 | **+96.2** | +0.286 | 40% | 13.2 | 7/7 | +77.5 | +18.7 |
| maxBars 48 | 309 | **+105.4** | +0.341 | 39% | 12.8 | 7/7 | +78.6 | +26.8 |
| maxBars 72 | 262 | **+111.4** | +0.425 | 38% | 15.0 | 7/7 | +68.6 | +42.8 |
| maxBars 96 | 245 | **+132.2** | +0.540 | 39% | 10.2 | 7/7 | +86.8 | +45.5 |
| maxBars 144 | 217 | **+120.1** | +0.553 | 36% | 9.3 | 7/7 | +75.5 | +44.6 |
| maxBars 200 | 187 | **+109.6** | +0.586 | 37% | 8.2 | 7/7 | +75.8 | +33.8 |
| target 3R | 326 | **+82.4** | +0.253 | 40% | 12.4 | 7/7 | +60.9 | +21.6 |
| target 4R | 309 | **+105.4** | +0.341 | 39% | 12.8 | 7/7 | +78.6 | +26.8 |
| target 5R | 297 | **+106.3** | +0.358 | 37% | 13.1 | 7/7 | +75.5 | +30.8 |
| target 6R | 285 | **+115.1** | +0.404 | 39% | 11.1 | 7/7 | +89.6 | +25.5 |
| target 8R | 280 | **+108.5** | +0.388 | 39% | 14.7 | 7/7 | +87.1 | +21.4 |
| target 10R | 279 | **+116.9** | +0.419 | 39% | 14.7 | 7/7 | +95.2 | +21.6 |
| target 15R | 275 | **+135.1** | +0.491 | 38% | 14.7 | 7/7 | +108.5 | +26.6 |

## I4. Stagnation exit: if the trade is below stagR in profit after stagBars candles, close at the next open

| config | trades | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 |
|---|---|---|---|---|---|---|---|---|
| after 6 candles, below 0R → exit | 346 | **+88.2** | +0.255 | 31% | 12.9 | 7/7 | +74.4 | +13.8 |
| after 6 candles, below 0.5R → exit | 408 | **+79.8** | +0.196 | 43% | 14.1 | 6/7 | +69.2 | +10.7 |
| after 6 candles, below 1R → exit | 444 | **+74.5** | +0.168 | 46% | 12.0 | 6/7 | +62.2 | +12.3 |
| after 12 candles, below 0R → exit | 346 | **+84.4** | +0.244 | 31% | 11.2 | 6/7 | +70.6 | +13.8 |
| after 12 candles, below 0.5R → exit | 382 | **+89.1** | +0.233 | 36% | 12.7 | 7/7 | +71.9 | +17.2 |
| after 12 candles, below 1R → exit | 413 | **+85.3** | +0.207 | 42% | 12.4 | 6/7 | +71.1 | +14.2 |
| after 18 candles, below 0R → exit | 331 | **+105.0** | +0.317 | 33% | 9.1 | 7/7 | +86.6 | +18.4 |
| after 18 candles, below 0.5R → exit | 365 | **+96.8** | +0.265 | 37% | 10.0 | 7/7 | +85.8 | +11.0 |
| after 18 candles, below 1R → exit | 388 | **+74.9** | +0.193 | 40% | 14.1 | 6/7 | +78.0 | -3.2 |
| after 24 candles, below 0R → exit | 322 | **+101.2** | +0.314 | 35% | 10.6 | 7/7 | +77.3 | +23.9 |
| after 24 candles, below 0.5R → exit | 350 | **+105.3** | +0.301 | 41% | 9.6 | 7/7 | +80.2 | +25.2 |
| after 24 candles, below 1R → exit | 366 | **+87.7** | +0.240 | 43% | 15.9 | 7/7 | +78.8 | +8.9 |
