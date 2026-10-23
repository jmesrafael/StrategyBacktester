# BB Breakout — what a LATE entry costs (SOL, ZEC)

Engine: 🔴BB-Core/lucidio-core.js defaults (4h, BB 20/2, SMA200, 1:4, 48-bar time exit), Binance USDT-M data, real fees + 0.02% slippage, funding left out. Run 2026-10-21.
Each trade is replayed on 1-minute candles of its entry candle with the fill moved to minute d. Stop and target prices are unchanged; size is fixed-$ risk on the actual fill.
**SKIP** = do not enter if stop or target was already touched before the fill.  **CHASE** = enter anyway if the price is still between stop and target.

## SOL — 309 trades 2020-10 → 2026-10

4h engine (no funding): total +109.80R, avg +0.355R. The d=0 row below re-checks the entry candle on 1m bars, so it can differ slightly (the engine assumes stop-first when a 4h candle touches both).

### SKIP policy

| Late by | Trades taken | Skipped | Total R | Avg R | vs on-time | Win% | Target hits | Max DD (R) | Avg price drift at fill |
|---|---|---|---|---|---|---|---|---|---|
| on time | 309 | 0 | +109.80 | +0.355 | — | 39% | 48 | 11.9 | +0.000R |
| 1 min | 309 | 0 | +105.90 | +0.343 | -3.89R (-4%) | 38% | 48 | 12.1 | +0.008R |
| 2 min | 309 | 0 | +104.82 | +0.339 | -4.97R (-5%) | 38% | 48 | 12.0 | +0.006R |
| 5 min | 309 | 0 | +103.69 | +0.336 | -6.11R (-6%) | 39% | 48 | 11.9 | +0.008R |
| 10 min | 309 | 0 | +107.20 | +0.347 | -2.60R (-2%) | 39% | 48 | 12.1 | +0.006R |
| 15 min | 309 | 0 | +112.58 | +0.364 | +2.78R (3%) | 39% | 48 | 11.6 | +0.003R |
| 30 min | 309 | 0 | +116.50 | +0.377 | +6.70R (6%) | 40% | 48 | 13.2 | +0.007R |
| 60 min | 309 | 0 | +111.92 | +0.362 | +2.12R (2%) | 39% | 48 | 12.2 | +0.003R |
| 120 min | 306 | 3 | +112.31 | +0.367 | +2.52R (2%) | 40% | 48 | 10.6 | +0.003R |

### CHASE policy

| Late by | Trades taken | Skipped | Total R | Avg R | vs on-time | Win% | Target hits | Max DD (R) | Avg price drift at fill |
|---|---|---|---|---|---|---|---|---|---|
| on time | 309 | 0 | +109.80 | +0.355 | — | 39% | 48 | 11.9 | +0.000R |
| 1 min | 309 | 0 | +105.90 | +0.343 | -3.89R (-4%) | 38% | 48 | 12.1 | +0.008R |
| 2 min | 309 | 0 | +104.82 | +0.339 | -4.97R (-5%) | 38% | 48 | 12.0 | +0.006R |
| 5 min | 309 | 0 | +103.69 | +0.336 | -6.11R (-6%) | 39% | 48 | 11.9 | +0.008R |
| 10 min | 309 | 0 | +107.20 | +0.347 | -2.60R (-2%) | 39% | 48 | 12.1 | +0.006R |
| 15 min | 309 | 0 | +112.58 | +0.364 | +2.78R (3%) | 39% | 48 | 11.6 | +0.003R |
| 30 min | 309 | 0 | +116.50 | +0.377 | +6.70R (6%) | 40% | 48 | 13.2 | +0.007R |
| 60 min | 309 | 0 | +111.92 | +0.362 | +2.12R (2%) | 39% | 48 | 12.2 | +0.003R |
| 120 min | 308 | 1 | +109.95 | +0.357 | +0.15R (0%) | 40% | 48 | 11.9 | -0.002R |

## ZEC — 332 trades 2020-03 → 2026-10

4h engine (no funding): total +122.56R, avg +0.369R. The d=0 row below re-checks the entry candle on 1m bars, so it can differ slightly (the engine assumes stop-first when a 4h candle touches both).

### SKIP policy

| Late by | Trades taken | Skipped | Total R | Avg R | vs on-time | Win% | Target hits | Max DD (R) | Avg price drift at fill |
|---|---|---|---|---|---|---|---|---|---|
| on time | 332 | 0 | +122.56 | +0.369 | — | 40% | 58 | 15.4 | +0.000R |
| 1 min | 332 | 0 | +115.15 | +0.347 | -7.41R (-6%) | 39% | 58 | 15.3 | +0.013R |
| 2 min | 332 | 0 | +113.71 | +0.342 | -8.85R (-7%) | 39% | 58 | 15.4 | +0.015R |
| 5 min | 332 | 0 | +119.07 | +0.359 | -3.49R (-3%) | 39% | 58 | 15.4 | +0.010R |
| 10 min | 332 | 0 | +123.30 | +0.371 | +0.74R (1%) | 40% | 58 | 15.4 | -0.002R |
| 15 min | 332 | 0 | +121.84 | +0.367 | -0.72R (-1%) | 40% | 58 | 15.4 | -0.001R |
| 30 min | 332 | 0 | +113.33 | +0.341 | -9.23R (-8%) | 39% | 58 | 15.4 | +0.002R |
| 60 min | 332 | 0 | +110.78 | +0.334 | -11.78R (-10%) | 39% | 58 | 15.4 | +0.011R |
| 120 min | 332 | 0 | +94.69 | +0.285 | -27.87R (-23%) | 39% | 58 | 15.7 | +0.025R |

### CHASE policy

| Late by | Trades taken | Skipped | Total R | Avg R | vs on-time | Win% | Target hits | Max DD (R) | Avg price drift at fill |
|---|---|---|---|---|---|---|---|---|---|
| on time | 332 | 0 | +122.56 | +0.369 | — | 40% | 58 | 15.4 | +0.000R |
| 1 min | 332 | 0 | +115.15 | +0.347 | -7.41R (-6%) | 39% | 58 | 15.3 | +0.013R |
| 2 min | 332 | 0 | +113.71 | +0.342 | -8.85R (-7%) | 39% | 58 | 15.4 | +0.015R |
| 5 min | 332 | 0 | +119.07 | +0.359 | -3.49R (-3%) | 39% | 58 | 15.4 | +0.010R |
| 10 min | 332 | 0 | +123.30 | +0.371 | +0.74R (1%) | 40% | 58 | 15.4 | -0.002R |
| 15 min | 332 | 0 | +121.84 | +0.367 | -0.72R (-1%) | 40% | 58 | 15.4 | -0.001R |
| 30 min | 332 | 0 | +113.33 | +0.341 | -9.23R (-8%) | 39% | 58 | 15.4 | +0.002R |
| 60 min | 332 | 0 | +110.78 | +0.334 | -11.78R (-10%) | 39% | 58 | 15.4 | +0.011R |
| 120 min | 332 | 0 | +94.69 | +0.285 | -27.87R (-23%) | 39% | 58 | 15.7 | +0.025R |

## SOL + ZEC together (trades in time order)

### SKIP policy

| Late by | Trades | Total R | Avg R | vs on-time | Per-trade change (±2 SE) | Max DD (R) | $ at $1 risk |
|---|---|---|---|---|---|---|---|
| on time | 641 | +232.35 | +0.362 | — | — | 13.5 | +$232 |
| 1 min | 641 | +221.05 | +0.345 | -11.30R (-5%) | -0.018 ± 0.007R **real** | 13.8 | +$221 |
| 2 min | 641 | +218.53 | +0.341 | -13.82R (-6%) | -0.022 ± 0.012R **real** | 13.7 | +$219 |
| 5 min | 641 | +222.75 | +0.348 | -9.60R (-4%) | -0.015 ± 0.017R noise | 13.6 | +$223 |
| 10 min | 641 | +230.50 | +0.360 | -1.86R (-1%) | -0.003 ± 0.022R noise | 13.7 | +$230 |
| 15 min | 641 | +234.42 | +0.366 | +2.07R (1%) | +0.003 ± 0.026R noise | 13.6 | +$234 |
| 30 min | 641 | +229.83 | +0.359 | -2.52R (-1%) | -0.004 ± 0.033R noise | 15.0 | +$230 |
| 60 min | 641 | +222.69 | +0.347 | -9.66R (-4%) | -0.015 ± 0.036R noise | 16.0 | +$223 |
| 120 min | 638 | +207.00 | +0.324 | -25.35R (-11%) | -0.045 ± 0.047R noise | 17.0 | +$207 |

### CHASE policy

| Late by | Trades | Total R | Avg R | vs on-time | Per-trade change (±2 SE) | Max DD (R) | $ at $1 risk |
|---|---|---|---|---|---|---|---|
| on time | 641 | +232.35 | +0.362 | — | — | 13.5 | +$232 |
| 1 min | 641 | +221.05 | +0.345 | -11.30R (-5%) | -0.018 ± 0.007R **real** | 13.8 | +$221 |
| 2 min | 641 | +218.53 | +0.341 | -13.82R (-6%) | -0.022 ± 0.012R **real** | 13.7 | +$219 |
| 5 min | 641 | +222.75 | +0.348 | -9.60R (-4%) | -0.015 ± 0.017R noise | 13.6 | +$223 |
| 10 min | 641 | +230.50 | +0.360 | -1.86R (-1%) | -0.003 ± 0.022R noise | 13.7 | +$230 |
| 15 min | 641 | +234.42 | +0.366 | +2.07R (1%) | +0.003 ± 0.026R noise | 13.6 | +$234 |
| 30 min | 641 | +229.83 | +0.359 | -2.52R (-1%) | -0.004 ± 0.033R noise | 15.0 | +$230 |
| 60 min | 641 | +222.69 | +0.347 | -9.66R (-4%) | -0.015 ± 0.036R noise | 16.0 | +$223 |
| 120 min | 640 | +204.63 | +0.320 | -27.72R (-12%) | -0.045 ± 0.047R noise | 17.3 | +$205 |
