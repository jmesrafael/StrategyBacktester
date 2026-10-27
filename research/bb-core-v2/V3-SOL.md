# v3 ideas vs bb-core — SOL

robust? = beats bb-core in 2020–2023 AND 2024+ AND on MEXC candles AND with costs doubled. "max open" = most positions open at the same time (risk scales with it).

## Baseline

| config | trades | total R | win% | avg R | maxDD R | R/DD | yrs+ | R ≤2023 | R ≥2024 | MEXC R | costs ×2 R | max open | R per 100 position-candles | robust? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bb-core | 309 | **+105.4** | 39% | +0.34 | 12.8 | 8.3 | 7/7 | +78.6 | +26.8 | +104.5 | +97.2 | 1 | 1.30 |  |

## 1. Pyramiding — take signals that fire while a trade is open
Each extra position risks the same 1R with its own stop/target/time exit. addMinR = only add when every open position is already that far in profit.

| config | trades | total R | win% | avg R | maxDD R | R/DD | yrs+ | R ≤2023 | R ≥2024 | MEXC R | costs ×2 R | max open | R per 100 position-candles | robust? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| up to 2 positions | 541 | **+212.4** | 41% | +0.39 | 20.4 | 10.4 | 7/7 | +158.6 | +53.8 | +197.5 | +198.8 | 2 | 1.43 | **yes** |
| up to 2 positions, add only if open ones ≥ +0R | 523 | **+187.7** | 41% | +0.36 | 23.0 | 8.2 | 7/7 | +141.5 | +46.2 | +172.4 | +174.6 | 2 | 1.30 | **yes** |
| up to 2 positions, add only if open ones ≥ +1R | 416 | **+132.1** | 41% | +0.32 | 13.9 | 9.5 | 7/7 | +111.7 | +20.4 | +127.4 | +122.0 | 2 | 1.13 |  |
| up to 2 positions, add only if open ones ≥ +2R | 347 | **+125.3** | 41% | +0.36 | 11.6 | 10.8 | 7/7 | +104.6 | +20.7 | +123.9 | +114.0 | 2 | 1.30 |  |
| up to 3 positions | 726 | **+275.9** | 42% | +0.38 | 29.4 | 9.4 | 7/7 | +208.7 | +67.2 | +255.7 | +258.3 | 3 | 1.34 | **yes** |
| up to 3 positions, add only if open ones ≥ +0R | 686 | **+243.9** | 42% | +0.36 | 28.7 | 8.5 | 7/7 | +191.5 | +52.4 | +225.6 | +227.2 | 3 | 1.25 | **yes** |
| up to 3 positions, add only if open ones ≥ +1R | 435 | **+131.6** | 41% | +0.30 | 14.9 | 8.8 | 6/7 | +114.7 | +16.9 | +126.7 | +121.3 | 3 | 1.06 |  |
| up to 3 positions, add only if open ones ≥ +2R | 347 | **+125.3** | 41% | +0.36 | 11.6 | 10.8 | 7/7 | +104.6 | +20.7 | +123.9 | +114.0 | 2 | 1.30 |  |
| up to 5 positions | 979 | **+325.6** | 42% | +0.33 | 30.5 | 10.7 | 6/7 | +272.4 | +53.2 | +302.8 | +303.0 | 5 | 1.15 | **yes** |
| up to 5 positions, add only if open ones ≥ +0R | 902 | **+258.9** | 40% | +0.29 | 29.3 | 8.8 | 5/7 | +239.6 | +19.3 | +245.6 | +239.3 | 5 | 0.99 |  |
| up to 5 positions, add only if open ones ≥ +1R | 435 | **+131.6** | 41% | +0.30 | 14.9 | 8.8 | 6/7 | +114.7 | +16.9 | +126.7 | +121.3 | 3 | 1.06 |  |
| up to 5 positions, add only if open ones ≥ +2R | 347 | **+125.3** | 41% | +0.36 | 11.6 | 10.8 | 7/7 | +104.6 | +20.7 | +123.9 | +114.0 | 2 | 1.30 |  |
| up to 2 positions, either direction | 549 | **+216.5** | 41% | +0.39 | 20.4 | 10.6 | 7/7 | +156.4 | +60.1 | +203.8 | +202.5 | 2 | 1.45 | **yes** |

## 1b. EVERY signal gets its own entry, even on a coin that already has trades open
maxPos 99 = no limit. "R per 100 position-candles" = return per unit of exposure (bb-core holds one position at a time, so more open trades = more money at risk at once).

| config | trades | total R | win% | avg R | maxDD R | R/DD | yrs+ | R ≤2023 | R ≥2024 | MEXC R | costs ×2 R | max open | R per 100 position-candles | robust? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| every signal, same direction as open trades | 1213 | **+373.4** | 41% | +0.31 | 44.0 | 8.5 | 5/7 | +357.1 | +16.3 | +351.4 | +346.7 | 12 | 1.05 |  |
| every signal, either direction | 1254 | **+410.5** | 42% | +0.33 | 30.8 | 13.3 | 6/7 | +369.0 | +41.6 | +390.8 | +382.2 | 12 | 1.14 | **yes** |
| every signal, same direction, only when open trades ≥ +0R | 1049 | **+291.5** | 41% | +0.28 | 43.8 | 6.7 | 5/7 | +301.2 | -9.7 | +284.6 | +269.6 | 11 | 0.95 |  |

## 2. Let winners run — at the 48-candle exit keep trades that are in profit
extendIfR = keep the trade if it is at least this far in profit at candle 48; lock = stop moves to entry + lock R; then exit at maxBars2 at the latest.

| config | trades | total R | win% | avg R | maxDD R | R/DD | yrs+ | R ≤2023 | R ≥2024 | MEXC R | costs ×2 R | max open | R per 100 position-candles | robust? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| keep if ≥ +0R, lock +0R, max 96 candles | 269 | **+111.9** | 31% | +0.42 | 11.5 | 9.7 | 7/7 | +77.6 | +34.4 | +109.6 | +105.2 | 1 | 1.23 |  |
| keep if ≥ +0R, lock +0R, max 144 candles | 262 | **+111.1** | 30% | +0.42 | 13.8 | 8.0 | 7/7 | +76.7 | +34.4 | +110.1 | +104.7 | 1 | 1.17 |  |
| keep if ≥ +0.5R, lock +0R, max 96 candles | 273 | **+108.9** | 33% | +0.40 | 12.5 | 8.7 | 7/7 | +75.1 | +33.8 | +106.5 | +102.0 | 1 | 1.21 |  |
| keep if ≥ +0.5R, lock +0R, max 144 candles | 268 | **+112.7** | 34% | +0.42 | 13.8 | 8.2 | 7/7 | +79.3 | +33.4 | +111.6 | +106.1 | 1 | 1.21 | **yes** |
| keep if ≥ +0.5R, lock +0.5R, max 96 candles | 285 | **+112.0** | 38% | +0.39 | 12.0 | 9.3 | 7/7 | +77.5 | +34.5 | +111.0 | +104.8 | 1 | 1.29 |  |
| keep if ≥ +0.5R, lock +0.5R, max 144 candles | 282 | **+104.9** | 38% | +0.37 | 13.3 | 7.9 | 7/7 | +71.3 | +33.6 | +103.7 | +97.9 | 1 | 1.17 |  |
| keep if ≥ +1R, lock +0R, max 96 candles | 284 | **+107.6** | 35% | +0.38 | 12.5 | 8.6 | 7/7 | +75.1 | +32.5 | +106.2 | +100.4 | 1 | 1.21 |  |
| keep if ≥ +1R, lock +0R, max 144 candles | 277 | **+103.3** | 35% | +0.37 | 13.8 | 7.5 | 7/7 | +70.5 | +32.8 | +104.1 | +96.4 | 1 | 1.12 |  |
| keep if ≥ +1R, lock +0.5R, max 96 candles | 288 | **+112.9** | 38% | +0.39 | 12.0 | 9.4 | 7/7 | +78.5 | +34.4 | +112.4 | +105.6 | 1 | 1.31 |  |
| keep if ≥ +1R, lock +0.5R, max 144 candles | 285 | **+106.4** | 38% | +0.37 | 13.3 | 8.0 | 7/7 | +72.3 | +34.2 | +105.8 | +99.3 | 1 | 1.19 |  |
| keep if ≥ +2R, lock +0R, max 96 candles | 302 | **+112.4** | 38% | +0.37 | 12.8 | 8.8 | 7/7 | +80.9 | +31.4 | +111.7 | +101.5 | 1 | 1.34 | **yes** |
| keep if ≥ +2R, lock +0R, max 144 candles | 301 | **+113.6** | 38% | +0.38 | 12.8 | 8.9 | 7/7 | +80.9 | +32.7 | +112.1 | +102.8 | 1 | 1.34 | **yes** |
| keep if ≥ +2R, lock +0.5R, max 96 candles | 303 | **+112.9** | 39% | +0.37 | 12.8 | 8.8 | 7/7 | +80.4 | +32.5 | +112.3 | +102.0 | 1 | 1.35 | **yes** |
| keep if ≥ +2R, lock +0.5R, max 144 candles | 303 | **+112.4** | 39% | +0.37 | 12.8 | 8.8 | 7/7 | +80.4 | +32.0 | +111.9 | +101.5 | 1 | 1.34 | **yes** |

## 3. Chandelier trailing stop for big moves
Once the trade has been chandAtR in profit, the stop trails the best price − k × ATR. Larger targets let the trail do the exiting.

| config | trades | total R | win% | avg R | maxDD R | R/DD | yrs+ | R ≤2023 | R ≥2024 | MEXC R | costs ×2 R | max open | R per 100 position-candles | robust? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| trail from +1R at 2 ATR, target 4R | 376 | **+47.7** | 50% | +0.13 | 16.0 | 3.0 | 5/7 | +34.5 | +13.3 | +39.7 | +37.4 | 1 | 0.83 |  |
| trail from +1R at 2 ATR, target 8R | 369 | **+48.2** | 50% | +0.13 | 16.0 | 3.0 | 5/7 | +32.5 | +15.6 | +40.1 | +37.6 | 1 | 0.88 |  |
| trail from +1R at 3 ATR, target 4R | 349 | **+58.6** | 42% | +0.17 | 14.5 | 4.0 | 6/7 | +54.2 | +4.4 | +58.4 | +49.2 | 1 | 0.89 |  |
| trail from +1R at 3 ATR, target 8R | 333 | **+57.9** | 41% | +0.17 | 13.9 | 4.2 | 6/7 | +43.9 | +14.1 | +60.0 | +48.3 | 1 | 0.90 |  |
| trail from +1R at 4 ATR, target 4R | 330 | **+78.5** | 38% | +0.24 | 11.4 | 6.9 | 7/7 | +70.7 | +7.8 | +77.5 | +69.8 | 1 | 1.07 |  |
| trail from +1R at 4 ATR, target 8R | 302 | **+77.7** | 37% | +0.26 | 13.7 | 5.7 | 7/7 | +61.9 | +15.8 | +76.2 | +68.9 | 1 | 1.11 |  |
| trail from +2R at 2 ATR, target 4R | 326 | **+72.4** | 42% | +0.22 | 14.2 | 5.1 | 7/7 | +53.2 | +19.2 | +69.0 | +66.8 | 1 | 0.97 |  |
| trail from +2R at 2 ATR, target 8R | 316 | **+64.1** | 43% | +0.20 | 14.2 | 4.5 | 7/7 | +46.4 | +17.7 | +58.3 | +58.2 | 1 | 0.90 |  |
| trail from +2R at 3 ATR, target 4R | 319 | **+81.4** | 42% | +0.26 | 12.0 | 6.8 | 7/7 | +65.3 | +16.1 | +78.9 | +77.6 | 1 | 1.08 |  |
| trail from +2R at 3 ATR, target 8R | 299 | **+78.4** | 43% | +0.26 | 14.2 | 5.5 | 7/7 | +58.0 | +20.4 | +77.6 | +74.5 | 1 | 1.09 |  |
| trail from +2R at 4 ATR, target 4R | 315 | **+96.8** | 40% | +0.31 | 11.1 | 8.7 | 7/7 | +73.2 | +23.6 | +96.0 | +90.6 | 1 | 1.24 |  |
| trail from +2R at 4 ATR, target 8R | 288 | **+95.4** | 41% | +0.33 | 11.5 | 8.3 | 7/7 | +70.1 | +25.3 | +91.8 | +89.2 | 1 | 1.27 |  |
| trail from +3R at 2 ATR, target 4R | 314 | **+93.5** | 39% | +0.30 | 10.7 | 8.8 | 7/7 | +74.6 | +18.9 | +88.8 | +85.1 | 1 | 1.19 |  |
| trail from +3R at 2 ATR, target 8R | 301 | **+86.9** | 40% | +0.29 | 11.6 | 7.5 | 7/7 | +68.2 | +18.7 | +82.5 | +78.1 | 1 | 1.18 |  |
| trail from +3R at 3 ATR, target 4R | 311 | **+101.6** | 39% | +0.33 | 12.5 | 8.1 | 7/7 | +80.4 | +21.3 | +97.4 | +93.4 | 1 | 1.28 |  |
| trail from +3R at 3 ATR, target 8R | 293 | **+95.0** | 40% | +0.32 | 14.5 | 6.5 | 7/7 | +71.4 | +23.6 | +91.7 | +86.5 | 1 | 1.27 |  |
| trail from +3R at 4 ATR, target 4R | 310 | **+105.1** | 39% | +0.34 | 11.8 | 8.9 | 7/7 | +80.2 | +24.9 | +101.5 | +96.9 | 1 | 1.31 |  |
| trail from +3R at 4 ATR, target 8R | 283 | **+109.5** | 41% | +0.39 | 12.1 | 9.1 | 7/7 | +81.8 | +27.7 | +103.2 | +101.1 | 1 | 1.43 |  |
| trail from +2R at 3 ATR, target 8R, max 96 candles | 257 | **+81.9** | 44% | +0.32 | 13.9 | 5.9 | 7/7 | +56.2 | +25.7 | +76.7 | +74.7 | 1 | 1.05 |  |
| trail from +2R at 4 ATR, target 8R, max 96 candles | 241 | **+94.0** | 41% | +0.39 | 14.8 | 6.3 | 7/7 | +63.7 | +30.2 | +86.2 | +87.2 | 1 | 1.14 |  |
| trail from +3R at 3 ATR, target 8R, max 96 candles | 241 | **+90.4** | 40% | +0.38 | 13.4 | 6.8 | 7/7 | +58.6 | +31.8 | +88.7 | +83.5 | 1 | 1.10 |  |
| trail from +3R at 4 ATR, target 8R, max 96 candles | 229 | **+111.0** | 40% | +0.48 | 12.0 | 9.3 | 7/7 | +77.3 | +33.6 | +105.5 | +104.3 | 1 | 1.31 |  |

## 4. Equity-curve filter — pause when the strategy itself is cold
Shadow book: every bb-core signal is paper-tracked; a real trade is taken only when the last N closed shadow trades sum to ≥ thr R.

| config | trades | total R | win% | avg R | maxDD R | R/DD | yrs+ | R ≤2023 | R ≥2024 | MEXC R | costs ×2 R | max open | R per 100 position-candles | robust? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| last 5 trades ≥ 0R | 200 | **+53.7** | 37% | +0.27 | 14.6 | 3.7 | 7/7 | +45.4 | +8.3 | +48.5 | +44.0 | 1 | 1.01 |  |
| last 5 trades ≥ -3R | 263 | **+79.5** | 38% | +0.30 | 19.7 | 4.0 | 7/7 | +56.5 | +23.0 | +76.4 | +69.0 | 1 | 1.16 |  |
| last 10 trades ≥ 0R | 229 | **+61.9** | 38% | +0.27 | 11.5 | 5.4 | 6/7 | +58.9 | +2.9 | +56.8 | +50.3 | 1 | 1.00 |  |
| last 10 trades ≥ -3R | 263 | **+80.9** | 38% | +0.31 | 12.9 | 6.3 | 7/7 | +66.5 | +14.4 | +69.2 | +75.4 | 1 | 1.17 |  |
| last 20 trades ≥ 0R | 262 | **+75.0** | 38% | +0.29 | 13.9 | 5.4 | 6/7 | +63.4 | +11.6 | +75.0 | +75.9 | 1 | 1.08 |  |
| last 20 trades ≥ -3R | 289 | **+89.1** | 38% | +0.31 | 14.5 | 6.1 | 7/7 | +64.8 | +24.2 | +85.0 | +83.7 | 1 | 1.17 |  |
| last 30 trades ≥ 0R | 281 | **+77.7** | 37% | +0.28 | 18.7 | 4.2 | 6/7 | +69.4 | +8.3 | +83.3 | +68.5 | 1 | 1.05 |  |
| last 30 trades ≥ -3R | 294 | **+93.4** | 38% | +0.32 | 13.8 | 6.8 | 7/7 | +72.2 | +21.3 | +93.8 | +83.1 | 1 | 1.22 |  |

## 5. Breakout must also be a new N-candle closing high/low

| config | trades | total R | win% | avg R | maxDD R | R/DD | yrs+ | R ≤2023 | R ≥2024 | MEXC R | costs ×2 R | max open | R per 100 position-candles | robust? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| new 10-candle extreme | 309 | **+104.5** | 39% | +0.34 | 12.8 | 8.2 | 7/7 | +78.6 | +25.9 | +104.7 | +96.4 | 1 | 1.29 |  |
| new 20-candle extreme | 304 | **+106.3** | 39% | +0.35 | 12.8 | 8.3 | 7/7 | +79.7 | +26.7 | +106.5 | +98.3 | 1 | 1.32 |  |
| new 50-candle extreme | 236 | **+85.4** | 41% | +0.36 | 7.7 | 11.0 | 7/7 | +60.5 | +24.9 | +79.2 | +79.9 | 1 | 1.30 |  |
| new 100-candle extreme | 179 | **+93.2** | 48% | +0.52 | 6.7 | 14.0 | 7/7 | +74.0 | +19.2 | +86.0 | +89.3 | 1 | 1.67 |  |

## Robust on SOL (12 of the rows above)

- up to 2 positions: +212.4R (bb-core +105.4R), maxDD 20.4R (bb-core 12.8R), max 2 open at once
- up to 2 positions, add only if open ones ≥ +0R: +187.7R (bb-core +105.4R), maxDD 23.0R (bb-core 12.8R), max 2 open at once
- up to 3 positions: +275.9R (bb-core +105.4R), maxDD 29.4R (bb-core 12.8R), max 3 open at once
- up to 3 positions, add only if open ones ≥ +0R: +243.9R (bb-core +105.4R), maxDD 28.7R (bb-core 12.8R), max 3 open at once
- up to 5 positions: +325.6R (bb-core +105.4R), maxDD 30.5R (bb-core 12.8R), max 5 open at once
- up to 2 positions, either direction: +216.5R (bb-core +105.4R), maxDD 20.4R (bb-core 12.8R), max 2 open at once
- every signal, either direction: +410.5R (bb-core +105.4R), maxDD 30.8R (bb-core 12.8R), max 12 open at once
- keep if ≥ +0.5R, lock +0R, max 144 candles: +112.7R (bb-core +105.4R), maxDD 13.8R (bb-core 12.8R), max 1 open at once
- keep if ≥ +2R, lock +0R, max 96 candles: +112.4R (bb-core +105.4R), maxDD 12.8R (bb-core 12.8R), max 1 open at once
- keep if ≥ +2R, lock +0R, max 144 candles: +113.6R (bb-core +105.4R), maxDD 12.8R (bb-core 12.8R), max 1 open at once
- keep if ≥ +2R, lock +0.5R, max 96 candles: +112.9R (bb-core +105.4R), maxDD 12.8R (bb-core 12.8R), max 1 open at once
- keep if ≥ +2R, lock +0.5R, max 144 candles: +112.4R (bb-core +105.4R), maxDD 12.8R (bb-core 12.8R), max 1 open at once
