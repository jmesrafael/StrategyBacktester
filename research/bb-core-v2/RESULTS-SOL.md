# bb-core v2 research — binance candles, costs x1, coins SOL
Baseline = bb-core rules unchanged (market entry at the next open, stop = middle band, 4R target, 48-bar time exit). Exits: target 48 · time 96 · stop 165

## Baseline

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bb-core (baseline) | 309 | 100% | **+105.4** | +0.341 | 39% | 12.8 | 7/7 | +78.6 | +26.8 | 1/1 | +97.2 |

## A. Break-even stop (market entry, target 4R)
beAtR = how far in profit (in R) before the stop jumps to entry. offset 0.12% = entry + enough to pay the exit fee/slippage. Takes effect from the NEXT candle.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE at 0.5R, offset 0% | 407 | 100% | **+59.2** | +0.146 | 16% | 15.0 | 5/7 | +52.0 | +7.2 | 1/1 | +50.7 |
| BE at 0.75R, offset 0% | 353 | 100% | **+67.8** | +0.192 | 22% | 14.2 | 7/7 | +52.3 | +15.5 | 1/1 | +58.5 |
| BE at 1R, offset 0% | 343 | 100% | **+69.9** | +0.204 | 26% | 10.8 | 7/7 | +48.4 | +21.4 | 1/1 | +61.0 |
| BE at 1.25R, offset 0% | 328 | 100% | **+81.7** | +0.249 | 30% | 11.2 | 7/7 | +59.7 | +22.0 | 1/1 | +73.2 |
| BE at 1.5R, offset 0% | 319 | 100% | **+84.5** | +0.265 | 33% | 10.8 | 7/7 | +61.1 | +23.4 | 1/1 | +80.4 |
| BE at 2R, offset 0% | 313 | 100% | **+88.6** | +0.283 | 36% | 10.8 | 7/7 | +68.5 | +20.2 | 1/1 | +82.8 |
| BE at 2.5R, offset 0% | 309 | 100% | **+108.7** | +0.352 | 39% | 10.8 | 7/7 | +81.6 | +27.0 | 1/1 | +100.5 |
| BE at 3R, offset 0% | 309 | 100% | **+107.4** | +0.348 | 39% | 11.8 | 7/7 | +80.6 | +26.8 | 1/1 | +99.2 |
| BE at 0.5R, offset 0.12% | 411 | 100% | **+61.6** | +0.150 | 30% | 15.0 | 5/7 | +53.7 | +8.0 | 1/1 | +52.9 |
| BE at 0.75R, offset 0.12% | 354 | 100% | **+70.0** | +0.198 | 31% | 13.8 | 7/7 | +53.7 | +16.3 | 1/1 | +59.5 |
| BE at 1R, offset 0.12% | 343 | 100% | **+72.3** | +0.211 | 32% | 10.6 | 7/7 | +49.5 | +22.9 | 1/1 | +62.3 |
| BE at 1.25R, offset 0.12% | 328 | 100% | **+83.3** | +0.254 | 35% | 10.9 | 7/7 | +60.4 | +22.9 | 1/1 | +74.7 |
| BE at 1.5R, offset 0.12% | 319 | 100% | **+85.5** | +0.268 | 37% | 10.8 | 7/7 | +61.5 | +24.1 | 1/1 | +81.5 |
| BE at 2R, offset 0.12% | 313 | 100% | **+89.3** | +0.285 | 38% | 10.8 | 7/7 | +68.8 | +20.4 | 1/1 | +83.3 |
| BE at 2.5R, offset 0.12% | 309 | 100% | **+108.9** | +0.352 | 39% | 10.8 | 7/7 | +81.8 | +27.1 | 1/1 | +100.7 |
| BE at 3R, offset 0.12% | 309 | 100% | **+107.5** | +0.348 | 39% | 11.7 | 7/7 | +80.7 | +26.8 | 1/1 | +99.3 |

## B. Break-even at 1R vs target size
Does BE change which target is best?

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| target 2R, no BE | 360 | 100% | **+74.4** | +0.207 | 45% | 9.7 | 7/7 | +52.8 | +21.7 | 1/1 | +66.2 |
| target 2R, BE at 1R (+0.12%) | 392 | 100% | **+44.2** | +0.113 | 36% | 12.5 | 7/7 | +33.2 | +11.1 | 1/1 | +34.1 |
| target 3R, no BE | 326 | 100% | **+82.4** | +0.253 | 40% | 12.4 | 7/7 | +60.9 | +21.6 | 1/1 | +74.3 |
| target 3R, BE at 1R (+0.12%) | 360 | 100% | **+55.9** | +0.155 | 33% | 11.6 | 7/7 | +37.0 | +18.9 | 1/1 | +44.8 |
| target 4R, no BE | 309 | 100% | **+105.4** | +0.341 | 39% | 12.8 | 7/7 | +78.6 | +26.8 | 1/1 | +97.2 |
| target 4R, BE at 1R (+0.12%) | 343 | 100% | **+72.3** | +0.211 | 32% | 10.6 | 7/7 | +49.5 | +22.9 | 1/1 | +62.3 |
| target 5R, no BE | 297 | 100% | **+106.3** | +0.358 | 37% | 13.1 | 7/7 | +75.5 | +30.8 | 1/1 | +98.2 |
| target 5R, BE at 1R (+0.12%) | 334 | 100% | **+72.3** | +0.216 | 31% | 11.3 | 7/7 | +46.8 | +25.5 | 1/1 | +62.4 |
| target 6R, no BE | 285 | 100% | **+115.1** | +0.404 | 39% | 11.1 | 7/7 | +89.6 | +25.5 | 1/1 | +106.9 |
| target 6R, BE at 1R (+0.12%) | 325 | 100% | **+71.1** | +0.219 | 31% | 11.3 | 7/7 | +51.7 | +19.4 | 1/1 | +61.1 |
| target 8R, no BE | 280 | 100% | **+108.5** | +0.388 | 39% | 14.7 | 7/7 | +87.1 | +21.4 | 1/1 | +100.3 |
| target 8R, BE at 1R (+0.12%) | 321 | 100% | **+63.9** | +0.199 | 30% | 15.7 | 6/7 | +46.5 | +17.3 | 1/1 | +53.8 |
| target 10R, no BE | 279 | 100% | **+116.9** | +0.419 | 39% | 14.7 | 7/7 | +95.2 | +21.6 | 1/1 | +108.5 |
| target 10R, BE at 1R (+0.12%) | 319 | 100% | **+78.7** | +0.247 | 30% | 15.7 | 6/7 | +53.0 | +25.7 | 1/1 | +68.6 |

## B2. Break-even at 1R vs time exit

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| maxBars 24, no BE | 391 | 100% | **+71.5** | +0.183 | 43% | 17.4 | 6/7 | +74.5 | -3.1 | 1/1 | +60.7 |
| maxBars 24, BE at 1R (+0.12%) | 409 | 100% | **+44.2** | +0.108 | 37% | 12.6 | 6/7 | +36.4 | +7.8 | 1/1 | +31.2 |
| maxBars 48, no BE | 309 | 100% | **+105.4** | +0.341 | 39% | 12.8 | 7/7 | +78.6 | +26.8 | 1/1 | +97.2 |
| maxBars 48, BE at 1R (+0.12%) | 343 | 100% | **+72.3** | +0.211 | 32% | 10.6 | 7/7 | +49.5 | +22.9 | 1/1 | +62.3 |
| maxBars 72, no BE | 262 | 100% | **+111.4** | +0.425 | 38% | 15.0 | 7/7 | +68.6 | +42.8 | 1/1 | +104.8 |
| maxBars 72, BE at 1R (+0.12%) | 307 | 100% | **+91.3** | +0.297 | 35% | 10.6 | 7/7 | +55.9 | +35.4 | 1/1 | +82.5 |
| maxBars 96, no BE | 245 | 100% | **+132.2** | +0.540 | 39% | 10.2 | 7/7 | +86.8 | +45.5 | 1/1 | +125.9 |
| maxBars 96, BE at 1R (+0.12%) | 297 | 100% | **+96.4** | +0.325 | 32% | 9.5 | 7/7 | +65.7 | +30.7 | 1/1 | +88.0 |

## C. Partial profit and trailing the stop (market entry)
partial = sell part at X R and move the rest to break-even; trail = after BE the stop follows the 20-SMA (only in profit direction).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| partial 50% at 1R + BE rest (4R) | 343 | 100% | **+54.4** | +0.159 | 55% | 7.1 | 7/7 | +33.9 | +20.4 | 1/1 | +42.6 |
| partial 33% at 1R + BE rest (4R) | 343 | 100% | **+60.5** | +0.176 | 55% | 8.3 | 7/7 | +39.2 | +21.3 | 1/1 | +48.6 |
| partial 50% at 2R + BE rest (4R) | 312 | 100% | **+70.7** | +0.227 | 41% | 11.3 | 7/7 | +49.5 | +21.2 | 1/1 | +63.1 |
| partial 33% at 2R + BE rest (4R) | 312 | 100% | **+77.8** | +0.249 | 41% | 11.1 | 7/7 | +56.8 | +21.0 | 1/1 | +70.0 |
| partial 50% at 3R + BE rest (4R) | 309 | 100% | **+101.0** | +0.327 | 39% | 9.9 | 7/7 | +75.2 | +25.8 | 1/1 | +93.3 |
| BE 1R + trail 20-SMA, target 4R | 370 | 100% | **+58.9** | +0.159 | 45% | 12.2 | 6/7 | +45.6 | +13.3 | 1/1 | +46.9 |
| BE 1.5R + trail 20-SMA, target 4R | 336 | 100% | **+65.6** | +0.195 | 43% | 12.1 | 6/7 | +55.1 | +10.5 | 1/1 | +58.6 |
| BE 1R + trail 20-SMA, target 6R | 358 | 100% | **+59.4** | +0.166 | 44% | 11.7 | 5/7 | +38.6 | +20.8 | 1/1 | +47.2 |
| BE 1R + trail 20-SMA, target 8R | 354 | 100% | **+62.5** | +0.177 | 44% | 13.1 | 7/7 | +38.8 | +23.7 | 1/1 | +50.2 |
| BE 1R + trail 20-SMA, target 10R | 351 | 100% | **+66.6** | +0.190 | 44% | 13.3 | 7/7 | +39.5 | +27.2 | 1/1 | +54.3 |
| BE 2R + trail 20-SMA, target 8R | 300 | 100% | **+73.1** | +0.244 | 43% | 15.8 | 7/7 | +53.8 | +19.3 | 1/1 | +67.0 |
| partial 50% at 2R + trail, target 8R | 299 | 100% | **+63.8** | +0.213 | 44% | 13.0 | 7/7 | +45.3 | +18.5 | 1/1 | +57.2 |
| partial 50% at 2R + trail, target 6R | 306 | 100% | **+68.7** | +0.225 | 43% | 11.7 | 7/7 | +46.2 | +22.6 | 1/1 | +62.1 |
| partial 50% at 1R + trail, target 8R | 354 | 100% | **+45.2** | +0.128 | 55% | 9.5 | 6/7 | +31.6 | +13.6 | 1/1 | +32.6 |

## D. Limit entry — mid: limit at the midpoint of the signal candle (wicks included)
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 1 candle(s), target entry | 286 | 58% | **+104.1** | +0.364 | 40% | 7.4 | 7/7 | +72.8 | +31.2 | 1/1 | +96.1 |
| mid, wait 1 candle(s), target signal | 278 | 58% | **+110.4** | +0.397 | 40% | 9.4 | 7/7 | +85.8 | +24.6 | 1/1 | +104.3 |
| mid, wait 2 candle(s), target entry | 287 | 66% | **+81.7** | +0.285 | 37% | 10.4 | 7/7 | +60.6 | +21.0 | 1/1 | +76.0 |
| mid, wait 2 candle(s), target signal | 274 | 66% | **+76.3** | +0.279 | 36% | 11.4 | 7/7 | +60.0 | +16.3 | 1/1 | +70.5 |
| mid, wait 3 candle(s), target entry | 271 | 67% | **+49.6** | +0.183 | 34% | 16.0 | 5/7 | +47.6 | +2.0 | 1/1 | +44.0 |
| mid, wait 3 candle(s), target signal | 261 | 66% | **+49.2** | +0.189 | 33% | 18.6 | 4/7 | +48.6 | +0.6 | 1/1 | +43.6 |
| mid, wait 6 candle(s), target entry | 272 | 75% | **+60.0** | +0.220 | 32% | 15.9 | 6/7 | +50.3 | +9.7 | 1/1 | +54.2 |
| mid, wait 6 candle(s), target signal | 261 | 75% | **+66.0** | +0.253 | 31% | 19.0 | 7/7 | +57.0 | +9.0 | 1/1 | +60.0 |

## D. Limit entry — 25% pullback from the close, % of the candle range
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rr25, wait 1 candle(s), target entry | 288 | 58% | **+107.6** | +0.374 | 41% | 8.5 | 7/7 | +79.1 | +28.5 | 1/1 | +102.4 |
| rr25, wait 1 candle(s), target signal | 281 | 58% | **+122.3** | +0.435 | 40% | 8.8 | 7/7 | +88.8 | +33.5 | 1/1 | +116.9 |
| rr25, wait 2 candle(s), target entry | 285 | 68% | **+71.2** | +0.250 | 39% | 11.4 | 7/7 | +61.9 | +9.2 | 1/1 | +65.8 |
| rr25, wait 2 candle(s), target signal | 278 | 68% | **+95.4** | +0.343 | 38% | 11.5 | 7/7 | +79.6 | +15.8 | 1/1 | +89.8 |
| rr25, wait 3 candle(s), target entry | 271 | 67% | **+56.8** | +0.209 | 36% | 10.3 | 6/7 | +60.1 | -3.4 | 1/1 | +51.4 |
| rr25, wait 3 candle(s), target signal | 267 | 69% | **+86.4** | +0.324 | 35% | 12.2 | 6/7 | +77.0 | +9.3 | 1/1 | +81.0 |
| rr25, wait 6 candle(s), target entry | 277 | 77% | **+62.5** | +0.226 | 34% | 10.4 | 7/7 | +57.6 | +4.9 | 1/1 | +56.8 |
| rr25, wait 6 candle(s), target signal | 275 | 79% | **+92.0** | +0.335 | 33% | 11.4 | 7/7 | +82.1 | +9.9 | 1/1 | +86.3 |

## D. Limit entry — 50% pullback from the close, % of the candle range
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rr50, wait 1 candle(s), target entry | 229 | 29% | **+92.5** | +0.404 | 41% | 9.7 | 7/7 | +60.3 | +32.2 | 1/1 | +88.3 |
| rr50, wait 1 candle(s), target signal | 213 | 28% | **+116.8** | +0.548 | 39% | 11.6 | 7/7 | +89.5 | +27.2 | 1/1 | +112.5 |
| rr50, wait 2 candle(s), target entry | 240 | 42% | **+67.7** | +0.282 | 36% | 12.3 | 6/7 | +50.1 | +17.6 | 1/1 | +60.7 |
| rr50, wait 2 candle(s), target signal | 224 | 41% | **+81.2** | +0.362 | 34% | 18.2 | 6/7 | +78.0 | +3.2 | 1/1 | +74.0 |
| rr50, wait 3 candle(s), target entry | 235 | 46% | **+41.9** | +0.178 | 31% | 15.9 | 6/7 | +47.0 | -5.1 | 1/1 | +34.1 |
| rr50, wait 3 candle(s), target signal | 217 | 45% | **+41.3** | +0.190 | 29% | 24.8 | 5/7 | +51.3 | -9.9 | 1/1 | +33.4 |
| rr50, wait 6 candle(s), target entry | 241 | 56% | **+64.8** | +0.269 | 33% | 12.8 | 6/7 | +56.9 | +7.9 | 1/1 | +55.6 |
| rr50, wait 6 candle(s), target signal | 224 | 56% | **+73.0** | +0.326 | 29% | 21.4 | 6/7 | +70.8 | +2.2 | 1/1 | +63.6 |

## D. Limit entry — 25% pullback from the close, % of the close→stop distance
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rd25, wait 1 candle(s), target entry | 260 | 37% | **+87.5** | +0.337 | 35% | 13.3 | 7/7 | +76.9 | +10.6 | 1/1 | +82.1 |
| rd25, wait 1 candle(s), target signal | 252 | 38% | **+103.7** | +0.411 | 33% | 13.3 | 7/7 | +88.2 | +15.5 | 1/1 | +98.0 |
| rd25, wait 2 candle(s), target entry | 264 | 54% | **+94.5** | +0.358 | 37% | 9.3 | 7/7 | +77.7 | +16.8 | 1/1 | +88.8 |
| rd25, wait 2 candle(s), target signal | 254 | 54% | **+105.6** | +0.416 | 36% | 11.4 | 7/7 | +90.1 | +15.6 | 1/1 | +99.8 |
| rd25, wait 3 candle(s), target entry | 266 | 61% | **+66.3** | +0.249 | 34% | 13.6 | 5/7 | +64.7 | +1.6 | 1/1 | +60.5 |
| rd25, wait 3 candle(s), target signal | 258 | 61% | **+72.4** | +0.281 | 33% | 14.6 | 6/7 | +70.5 | +1.9 | 1/1 | +66.5 |
| rd25, wait 6 candle(s), target entry | 274 | 74% | **+75.6** | +0.276 | 35% | 11.3 | 5/7 | +65.9 | +9.7 | 1/1 | +69.7 |
| rd25, wait 6 candle(s), target signal | 264 | 73% | **+83.1** | +0.315 | 32% | 11.9 | 6/7 | +71.5 | +11.5 | 1/1 | +77.1 |

## D. Limit entry — 50% pullback from the close, % of the close→stop distance
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rd50, wait 1 candle(s), target entry | 106 | 9% | **+26.7** | +0.252 | 29% | 14.3 | 3/7 | +22.2 | +4.4 | 1/1 | +22.6 |
| rd50, wait 1 candle(s), target signal | 97 | 9% | **+37.5** | +0.387 | 24% | 21.4 | 4/7 | +47.8 | -10.3 | 1/1 | +33.4 |
| rd50, wait 2 candle(s), target entry | 165 | 22% | **+22.4** | +0.136 | 27% | 13.9 | 5/7 | +27.9 | -5.5 | 1/1 | +16.5 |
| rd50, wait 2 candle(s), target signal | 153 | 22% | **+43.0** | +0.281 | 23% | 16.2 | 4/7 | +52.5 | -9.5 | 1/1 | +37.1 |
| rd50, wait 3 candle(s), target entry | 187 | 31% | **+3.3** | +0.018 | 24% | 30.7 | 4/7 | +28.4 | -25.0 | 1/1 | -3.3 |
| rd50, wait 3 candle(s), target signal | 173 | 31% | **+9.6** | +0.056 | 20% | 39.1 | 3/7 | +46.0 | -36.4 | 1/1 | +2.8 |
| rd50, wait 6 candle(s), target entry | 215 | 46% | **+16.1** | +0.075 | 24% | 27.9 | 4/7 | +27.8 | -11.8 | 1/1 | +8.4 |
| rd50, wait 6 candle(s), target signal | 199 | 46% | **+34.3** | +0.172 | 21% | 28.8 | 4/7 | +50.7 | -16.4 | 1/1 | +26.6 |

### D2. Which signals does a limit order miss? (R of the SAME signals traded at market, baseline rules)
| config | signals matched | market R of signals FILLED | limit R of the same trades | market R of signals MISSED | missed (ran away / expired / other) |
|---|---|---|---|---|---|
| mid, wait 1 | 276 | +10.4 (134) | +34.1 | +77.7 (142) | 2 / 206 / 0 |
| mid, wait 3 | 269 | -19.5 (178) | +14.2 | +108.6 (91) | 3 / 130 / 0 |
| rr25, wait 1 | 268 | +15.9 (144) | +38.6 | +76.5 (124) | 2 / 203 / 0 |
| rr25, wait 3 | 264 | -4.2 (186) | +28.3 | +90.0 (78) | 3 / 128 / 0 |
| rr50, wait 1 | 268 | +17.5 (47) | +35.2 | +89.4 (221) | 2 / 552 / 4 |
| rr50, wait 3 | 263 | -35.0 (116) | +4.4 | +115.0 (147) | 3 / 266 / 2 |
| rd25, wait 1 | 261 | -0.7 (110) | +24.1 | +89.5 (151) | 2 / 433 / 0 |
| rd25, wait 3 | 258 | -12.0 (162) | +27.7 | +103.4 (96) | 3 / 168 / 0 |
| rd50, wait 1 | 304 | -5.6 (34) | +9.5 | +105.2 (270) | 2 / 1060 / 0 |
| rd50, wait 3 | 275 | -53.5 (92) | -27.2 | +123.8 (183) | 3 / 422 / 0 |

## D3. Fill model sensitivity (mid, wait 2, target entry)
limitBuf 0 = the order fills as soon as price TOUCHES the level (optimistic); 0.05% = price must trade through (default); 0.15% = harsher.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 2, limitBuf 0% | 290 | 68% | **+84.5** | +0.291 | 37% | 10.4 | 7/7 | +64.4 | +20.1 | 1/1 | +78.8 |
| mid, wait 2, limitBuf 0.05% | 287 | 66% | **+81.7** | +0.285 | 37% | 10.4 | 7/7 | +60.6 | +21.0 | 1/1 | +76.0 |
| mid, wait 2, limitBuf 0.15% | 281 | 64% | **+72.5** | +0.258 | 37% | 9.4 | 6/7 | +62.5 | +10.0 | 1/1 | +66.9 |

## D4. Limit entry that falls back to a MARKET entry if not filled
Order rests limitBars candles; if still unfilled it is bought at the next open (stop and target unchanged). Keeps the price improvement on pullbacks without missing the runaway breakouts, but the late market entries are worse than baseline.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 1 then market, target entry | 312 | 100% | **+94.3** | +0.302 | 40% | 14.6 | 7/7 | +73.9 | +20.4 | 1/1 | +87.2 |
| mid, wait 1 then market, target signal | 308 | 100% | **+98.0** | +0.318 | 39% | 13.8 | 7/7 | +80.4 | +17.5 | 1/1 | +90.8 |
| mid, wait 2 then market, target entry | 314 | 99% | **+89.9** | +0.286 | 39% | 14.0 | 7/7 | +71.3 | +18.7 | 1/1 | +83.1 |
| mid, wait 2 then market, target signal | 307 | 99% | **+88.6** | +0.289 | 39% | 13.7 | 7/7 | +75.4 | +13.2 | 1/1 | +81.7 |
| mid, wait 3 then market, target entry | 313 | 99% | **+85.0** | +0.272 | 39% | 13.6 | 7/7 | +69.2 | +15.8 | 1/1 | +78.3 |
| mid, wait 3 then market, target signal | 305 | 99% | **+83.6** | +0.274 | 39% | 13.6 | 6/7 | +75.0 | +8.5 | 1/1 | +76.7 |
| rr25, wait 1 then market, target entry | 313 | 100% | **+88.0** | +0.281 | 39% | 14.5 | 7/7 | +69.2 | +18.8 | 1/1 | +81.3 |
| rr25, wait 1 then market, target signal | 307 | 100% | **+105.2** | +0.343 | 39% | 13.4 | 7/7 | +84.2 | +20.9 | 1/1 | +98.5 |
| rr25, wait 2 then market, target entry | 313 | 99% | **+82.0** | +0.262 | 40% | 11.1 | 7/7 | +69.6 | +12.5 | 1/1 | +75.7 |
| rr25, wait 2 then market, target signal | 305 | 99% | **+103.0** | +0.338 | 39% | 13.0 | 7/7 | +85.1 | +18.0 | 1/1 | +96.7 |
| rr25, wait 3 then market, target entry | 312 | 99% | **+77.9** | +0.250 | 39% | 10.9 | 7/7 | +70.0 | +7.8 | 1/1 | +71.5 |
| rr25, wait 3 then market, target signal | 304 | 99% | **+99.0** | +0.326 | 39% | 11.8 | 6/7 | +86.5 | +12.5 | 1/1 | +92.7 |
| rd25, wait 1 then market, target entry | 313 | 100% | **+89.9** | +0.287 | 39% | 13.4 | 7/7 | +71.1 | +18.8 | 1/1 | +83.1 |
| rd25, wait 1 then market, target signal | 306 | 100% | **+105.6** | +0.345 | 39% | 13.0 | 7/7 | +83.5 | +22.1 | 1/1 | +98.8 |
| rd25, wait 2 then market, target entry | 315 | 99% | **+90.0** | +0.286 | 39% | 10.1 | 7/7 | +71.2 | +18.8 | 1/1 | +83.6 |
| rd25, wait 2 then market, target signal | 304 | 99% | **+102.5** | +0.337 | 39% | 12.6 | 7/7 | +82.3 | +20.2 | 1/1 | +96.0 |
| rd25, wait 3 then market, target entry | 314 | 99% | **+83.2** | +0.265 | 39% | 9.7 | 7/7 | +68.8 | +14.5 | 1/1 | +76.9 |
| rd25, wait 3 then market, target signal | 303 | 99% | **+96.6** | +0.319 | 39% | 11.3 | 6/7 | +81.8 | +14.8 | 1/1 | +90.2 |
| rd50, wait 1 then market, target entry | 312 | 100% | **+99.3** | +0.318 | 39% | 16.6 | 7/7 | +72.2 | +27.1 | 1/1 | +90.9 |
| rd50, wait 1 then market, target signal | 304 | 100% | **+106.4** | +0.350 | 38% | 15.3 | 7/7 | +86.0 | +20.5 | 1/1 | +98.2 |
| rd50, wait 2 then market, target entry | 310 | 99% | **+86.1** | +0.278 | 39% | 17.6 | 7/7 | +65.7 | +20.4 | 1/1 | +77.9 |
| rd50, wait 2 then market, target signal | 301 | 99% | **+102.7** | +0.341 | 39% | 15.1 | 7/7 | +83.9 | +18.8 | 1/1 | +94.5 |
| rd50, wait 3 then market, target entry | 309 | 99% | **+75.4** | +0.244 | 38% | 15.9 | 6/7 | +62.4 | +13.0 | 1/1 | +67.2 |
| rd50, wait 3 then market, target signal | 299 | 99% | **+89.0** | +0.298 | 37% | 17.7 | 6/7 | +79.2 | +9.8 | 1/1 | +80.9 |

## F. Maximise profit without break-even: target size × time exit (market entry)
CAUTION: the 4R target was already chosen after seeing these years; every extra grid cell here adds more in-sample selection. Look for a broad plateau, not the best single cell.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| target 4R, maxBars 48 | 309 | 100% | **+105.4** | +0.341 | 39% | 12.8 | 7/7 | +78.6 | +26.8 | 1/1 | +97.2 |
| target 4R, maxBars 72 | 262 | 100% | **+111.4** | +0.425 | 38% | 15.0 | 7/7 | +68.6 | +42.8 | 1/1 | +104.8 |
| target 4R, maxBars 96 | 245 | 100% | **+132.2** | +0.540 | 39% | 10.2 | 7/7 | +86.8 | +45.5 | 1/1 | +125.9 |
| target 4R, maxBars 144 | 217 | 100% | **+120.1** | +0.553 | 36% | 9.3 | 7/7 | +75.5 | +44.6 | 1/1 | +114.6 |
| target 6R, maxBars 48 | 285 | 100% | **+115.1** | +0.404 | 39% | 11.1 | 7/7 | +89.6 | +25.5 | 1/1 | +106.9 |
| target 6R, maxBars 72 | 242 | 100% | **+89.2** | +0.369 | 35% | 15.3 | 7/7 | +58.7 | +30.5 | 1/1 | +82.7 |
| target 6R, maxBars 96 | 218 | 100% | **+117.0** | +0.537 | 36% | 13.9 | 7/7 | +88.2 | +28.8 | 1/1 | +110.8 |
| target 6R, maxBars 144 | 190 | 100% | **+83.3** | +0.438 | 31% | 16.3 | 7/7 | +73.0 | +10.3 | 1/1 | +78.0 |
| target 8R, maxBars 48 | 280 | 100% | **+108.5** | +0.388 | 39% | 14.7 | 7/7 | +87.1 | +21.4 | 1/1 | +100.3 |
| target 8R, maxBars 72 | 232 | 100% | **+101.2** | +0.436 | 36% | 16.9 | 7/7 | +70.4 | +30.8 | 1/1 | +94.7 |
| target 8R, maxBars 96 | 211 | 100% | **+110.3** | +0.523 | 36% | 16.2 | 6/7 | +86.3 | +24.1 | 1/1 | +104.1 |
| target 8R, maxBars 144 | 182 | 100% | **+91.2** | +0.501 | 30% | 19.1 | 7/7 | +81.4 | +9.8 | 1/1 | +86.0 |
| target 10R, maxBars 48 | 279 | 100% | **+116.9** | +0.419 | 39% | 14.7 | 7/7 | +95.2 | +21.6 | 1/1 | +108.5 |
| target 10R, maxBars 72 | 230 | 100% | **+96.2** | +0.418 | 36% | 16.9 | 7/7 | +67.4 | +28.8 | 1/1 | +89.7 |
| target 10R, maxBars 96 | 207 | 100% | **+113.9** | +0.550 | 35% | 16.2 | 6/7 | +91.8 | +22.0 | 1/1 | +107.8 |
| target 10R, maxBars 144 | 174 | 100% | **+77.6** | +0.446 | 29% | 22.1 | 6/7 | +72.6 | +4.9 | 1/1 | +72.6 |
| target 15R, maxBars 48 | 275 | 100% | **+135.1** | +0.491 | 38% | 14.7 | 7/7 | +108.5 | +26.6 | 1/1 | +126.6 |
| target 15R, maxBars 72 | 229 | 100% | **+108.1** | +0.472 | 34% | 16.9 | 7/7 | +81.9 | +26.2 | 1/1 | +101.5 |
| target 15R, maxBars 96 | 200 | 100% | **+135.6** | +0.678 | 35% | 16.2 | 6/7 | +111.7 | +24.0 | 1/1 | +129.5 |
| target 15R, maxBars 144 | 174 | 100% | **+80.2** | +0.461 | 28% | 22.1 | 6/7 | +77.4 | +2.9 | 1/1 | +75.1 |
| target 20R, maxBars 48 | 273 | 100% | **+119.8** | +0.439 | 38% | 14.7 | 7/7 | +94.5 | +25.3 | 1/1 | +111.5 |
| target 20R, maxBars 72 | 229 | 100% | **+108.1** | +0.472 | 34% | 16.9 | 7/7 | +81.9 | +26.2 | 1/1 | +101.5 |
| target 20R, maxBars 96 | 202 | 100% | **+133.7** | +0.662 | 34% | 16.2 | 6/7 | +107.5 | +26.2 | 1/1 | +127.4 |
| target 20R, maxBars 144 | 174 | 100% | **+91.4** | +0.525 | 27% | 22.1 | 6/7 | +87.3 | +4.1 | 1/1 | +86.1 |

## E. Combinations

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 1, target signal | 278 | 58% | **+110.4** | +0.397 | 40% | 9.4 | 7/7 | +85.8 | +24.6 | 1/1 | +104.3 |
| mid, wait 1, target signal + BE 1R | 304 | 57% | **+66.4** | +0.218 | 38% | 14.5 | 5/7 | +57.4 | +9.0 | 1/1 | +60.2 |
| mid, wait 1, target signal + target 8R | 263 | 56% | **+95.3** | +0.363 | 38% | 11.4 | 6/7 | +70.1 | +25.2 | 1/1 | +89.1 |
| mid, wait 1, target signal + target 10R, maxBars 96 | 187 | 56% | **+140.6** | +0.752 | 37% | 9.5 | 7/7 | +98.7 | +41.9 | 1/1 | +136.1 |
| mid, wait 1 then market | 308 | 100% | **+98.0** | +0.318 | 39% | 13.8 | 7/7 | +80.4 | +17.5 | 1/1 | +90.8 |
| mid, wait 1 then market + BE 1R | 345 | 99% | **+56.9** | +0.165 | 37% | 19.6 | 5/7 | +56.6 | +0.4 | 1/1 | +47.8 |
| mid, wait 1 then market + target 8R | 280 | 100% | **+102.3** | +0.365 | 38% | 13.6 | 6/7 | +85.8 | +16.4 | 1/1 | +95.1 |
| mid, wait 1 then market + target 10R, maxBars 96 | 206 | 100% | **+118.3** | +0.574 | 33% | 16.6 | 6/7 | +97.0 | +21.3 | 1/1 | +113.0 |
| market + target 8R | 280 | 100% | **+108.5** | +0.388 | 39% | 14.7 | 7/7 | +87.1 | +21.4 | 1/1 | +100.3 |
| market + target 10R, maxBars 96 | 207 | 100% | **+113.9** | +0.550 | 35% | 16.2 | 6/7 | +91.8 | +22.0 | 1/1 | +107.8 |
